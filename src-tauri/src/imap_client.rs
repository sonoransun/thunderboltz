use std::env;

use crate::settings::Settings;
use mail_parser::MessageParser;
use regex::Regex;
use serde_json;

fn remove_urls(input: &str) -> String {
    let url_regex = Regex::new(r"https?://[^\s]+|www\.[^\s]+").unwrap();
    let cleaned = url_regex.replace_all(input, "");
    let whitespace_regex = Regex::new(r"\s+").unwrap();
    whitespace_regex.replace_all(&cleaned, " ").to_string()
}

pub fn fetch_inbox(
    settings: &Settings,
    count: Option<usize>,
) -> anyhow::Result<Vec<mail_parser::Message>> {
    let settings = settings
        .account
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Account settings not found"))?;

    let domain = &settings.hostname;
    let username = &settings.username;
    let password = &settings.password;
    let port = settings.port;

    // Print all settings for debugging
    println!("IMAP Settings:");
    println!("  Domain: {}", domain);
    println!("  Username: {}", username);
    println!("  Password: {}", password);
    println!("  Port: {}", port);

    let client = imap::ClientBuilder::new(&domain, port)
        // .mode(imap::ConnectionMode::Tls)
        .danger_skip_tls_verify(true)
        .connect()?;

    let mut imap_session = client
        .login(&username, &password)
        .map_err(|e| anyhow::anyhow!(e.0))?;

    // imap_session.debug = true;
    imap_session.select("INBOX")?;

    let count = count.unwrap_or(10);
    let fetch_range = format!("1:{}", count);

    let messages = imap_session.fetch(&fetch_range, "RFC822")?;

    let mut result: Vec<mail_parser::Message> = Vec::new();

    for message in messages.iter() {
        let body = message.body().expect("message did not have a body!");
        let body = std::str::from_utf8(body)
            .expect("message was not valid utf-8")
            .to_string();

        let parsed_message = MessageParser::default().parse(body.as_bytes()).unwrap();
        result.push(parsed_message.into_owned());
    }

    // be nice to the server and log out
    imap_session.logout()?;

    Ok(result)
}

pub fn listen_for_emails() -> imap::error::Result<()> {
    // Try to load from .env if present, continue if not found
    if let Ok(path) = env::var("CARGO_MANIFEST_DIR") {
        let env_path = std::path::Path::new(&path).join(".env");
        if env_path.exists() {
            dotenv::from_path(env_path).ok();
        }
    }

    let domain = env::var("IMAP_DOMAIN").expect("IMAP_DOMAIN environment variable must be set");
    let username =
        env::var("IMAP_USERNAME").expect("IMAP_USERNAME environment variable must be set");
    let password =
        env::var("IMAP_PASSWORD").expect("IMAP_PASSWORD environment variable must be set");
    let port = env::var("IMAP_PORT")
        .expect("IMAP_PORT environment variable must be set")
        .parse::<u16>()
        .expect("IMAP_PORT must be a valid port number");

    let client = imap::ClientBuilder::new(&domain, port)
        // .mode(imap::ConnectionMode::Tls)
        .danger_skip_tls_verify(true)
        .connect()?;

    let mut imap_session = client.login(&username, &password).map_err(|e| e.0)?;

    imap_session.debug = true;

    imap_session
        .select("INBOX")
        .expect("Could not select mailbox");

    let mut num_responses = 0;
    let max_responses = 5;
    let idle_result = imap_session.idle().wait_while(|response| {
        num_responses += 1;
        println!("IDLE response #{}: {:?}", num_responses, response);

        if let imap::types::UnsolicitedResponse::Recent(uid) = response {
            println!("Recent uid: {:?}", uid);
        }

        if num_responses >= max_responses {
            // Stop IDLE
            false
        } else {
            // Continue IDLE
            true
        }
    });

    match idle_result {
        Ok(reason) => println!("IDLE finished normally {:?}", reason),
        Err(e) => println!("IDLE finished with error {:?}", e),
    }

    imap_session.logout().expect("Could not log out");

    Ok(())
}

/// Converts a mail_parser::Message to a serde_json::Value with proper body content
/// This replaces the array indices in html_body and text_body with the actual content
/// and handles multiple body parts if present
pub fn message_to_json_value(message: &mail_parser::Message) -> anyhow::Result<serde_json::Value> {
    let mut message_json = serde_json::to_value(message)?;

    if let Some(obj) = message_json.as_object_mut() {
        // Handle HTML body parts
        if obj.contains_key("html_body") {
            // Remove the original html_body array
            obj.remove("html_body");

            // Create a new array to store all HTML body parts as strings
            let mut html_bodies = Vec::new();

            // Try to get each HTML body part
            let mut index = 0;
            while let Some(html_body) = message.body_html(index) {
                html_bodies.push(serde_json::Value::String(html_body.to_string()));
                index += 1;
            }

            // If we found any HTML body parts
            if !html_bodies.is_empty() {
                if html_bodies.len() == 1 {
                    // If there's only one part, store it directly as a string
                    obj.insert("html_body".to_string(), html_bodies[0].clone());
                } else {
                    // If there are multiple parts, store them as an array
                    obj.insert(
                        "html_body".to_string(),
                        serde_json::Value::Array(html_bodies),
                    );
                }
            }
        }

        // Handle text body parts
        if obj.contains_key("text_body") {
            // Remove the original text_body array
            obj.remove("text_body");

            // Create a new array to store all text body parts as strings
            let mut text_bodies = Vec::new();

            // Try to get each text body part
            let mut index = 0;
            while let Some(text_body) = message.body_text(index) {
                text_bodies.push(serde_json::Value::String(text_body.to_string()));
                index += 1;
            }

            // If we found any text body parts
            if !text_bodies.is_empty() {
                if text_bodies.len() == 1 {
                    // If there's only one part, store it directly as a string
                    obj.insert("text_body".to_string(), text_bodies[0].clone());
                } else {
                    // If there are multiple parts, store them as an array
                    obj.insert(
                        "text_body".to_string(),
                        serde_json::Value::Array(text_bodies),
                    );
                }
            }
        }

        // Add a clean_text field that removes URLs from the text body
        if let Some(text_body) = message.body_text(0) {
            let clean_text = remove_urls(&text_body);
            obj.insert(
                "clean_text".to_string(),
                serde_json::Value::String(clean_text),
            );
        }
    }

    Ok(message_json)
}

/// Converts a vector of mail_parser::Message to a vector of serde_json::Value
/// This processes each message using the message_to_json_value function
pub fn messages_to_json_values(
    messages: &[mail_parser::Message],
) -> anyhow::Result<Vec<serde_json::Value>> {
    let mut result = Vec::with_capacity(messages.len());

    for message in messages {
        match message_to_json_value(message) {
            Ok(json_value) => result.push(json_value),
            Err(err) => {
                // Log the error but continue processing other messages
                eprintln!("Error converting message to JSON: {}", err);
                // Add a null value as a placeholder for the failed message
                result.push(serde_json::Value::Null);
            }
        }
    }

    Ok(result)
}

//! Auto-spawn / auto-kill a user-installed local model server (Ollama or llama.cpp).
//!
//! The binaries are NOT bundled with the app — users install them via their
//! package manager (brew, apt, etc.). We look them up on PATH, plus a few
//! well-known Unix bin directories that get stripped from AppImage-isolated
//! environments. When spawned, processes are tracked in app state and killed
//! on app exit so they don't leak.

#![cfg(desktop)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::time::timeout;

/// Per-app state tracking spawned child processes, keyed by `kind`
/// ("ollama" or "llama-cpp"). Wrapped in a Mutex because Tauri commands
/// need `Send + Sync`.
#[derive(Default)]
pub struct LocalServerState {
    children: Mutex<HashMap<String, Child>>,
}

impl LocalServerState {
    /// Kill every spawned child — called from the app's exit handler.
    pub fn kill_all(&self) {
        if let Ok(mut map) = self.children.lock() {
            for (_, mut child) in map.drain() {
                let _ = child.start_kill();
            }
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct DetectResult {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct StartResult {
    pub pid: u32,
    pub url: String,
}

#[derive(Serialize, Deserialize)]
pub struct StatusResult {
    pub running: bool,
    pub pid: Option<u32>,
    pub url: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct StartOptions {
    pub port: Option<u16>,
    pub model_dir: Option<String>,
    #[serde(default)]
    pub extra_args: Vec<String>,
}

fn binary_name_for(kind: &str) -> Option<&'static str> {
    match kind {
        "ollama" => Some("ollama"),
        "llama-cpp" => Some("llama-server"),
        _ => None,
    }
}

/// Extra well-known Unix paths to search when `which` fails — AppImages
/// strip PATH aggressively, so binaries installed via brew/apt may be
/// invisible to a plain `which()` lookup.
fn extra_lookup_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        paths.push(PathBuf::from(format!("{}/.local/bin", home)));
    }
    paths.push(PathBuf::from("/usr/local/bin"));
    paths.push(PathBuf::from("/opt/homebrew/bin"));
    paths.push(PathBuf::from("/usr/bin"));
    paths
}

fn locate_binary(name: &str) -> Option<PathBuf> {
    if let Ok(path) = which::which(name) {
        return Some(path);
    }
    for dir in extra_lookup_paths() {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

#[tauri::command]
pub async fn detect_local_binary(kind: String) -> Result<DetectResult, String> {
    let Some(binary) = binary_name_for(&kind) else {
        return Err(format!("Unsupported kind: {}", kind));
    };
    let Some(path) = locate_binary(binary) else {
        return Ok(DetectResult {
            found: false,
            path: None,
            version: None,
        });
    };

    let version = Command::new(&path)
        .arg("--version")
        .output()
        .await
        .ok()
        .and_then(|out| {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let combined = if stdout.trim().is_empty() { stderr } else { stdout };
            combined.lines().next().map(|s| s.trim().to_string())
        });

    Ok(DetectResult {
        found: true,
        path: Some(path.to_string_lossy().to_string()),
        version,
    })
}

fn default_port(kind: &str) -> u16 {
    match kind {
        "ollama" => 11434,
        "llama-cpp" => 8080,
        _ => 0,
    }
}

fn ready_pattern(kind: &str) -> &'static str {
    match kind {
        "ollama" => "Listening on",
        "llama-cpp" => "server is listening",
        _ => "",
    }
}

#[tauri::command]
pub async fn start_local_server(
    kind: String,
    options: Option<StartOptions>,
    state: State<'_, LocalServerState>,
) -> Result<StartResult, String> {
    let Some(binary) = binary_name_for(&kind) else {
        return Err(format!("Unsupported kind: {}", kind));
    };
    {
        let map = state.children.lock().map_err(|e| e.to_string())?;
        if map.contains_key(&kind) {
            return Err(format!("{} is already running", kind));
        }
    }

    let Some(path) = locate_binary(binary) else {
        return Err(format!("{} binary not found", binary));
    };

    let opts = options.unwrap_or_default();
    let port = opts.port.unwrap_or(default_port(&kind));

    let mut cmd = Command::new(&path);
    match kind.as_str() {
        "ollama" => {
            cmd.arg("serve");
            cmd.env("OLLAMA_HOST", format!("127.0.0.1:{}", port));
            if let Some(dir) = &opts.model_dir {
                cmd.env("OLLAMA_MODELS", dir);
            }
        }
        "llama-cpp" => {
            cmd.arg("--port").arg(port.to_string());
            if let Some(dir) = &opts.model_dir {
                cmd.arg("--models-path").arg(dir);
            }
        }
        _ => {}
    }
    for arg in &opts.extra_args {
        cmd.arg(arg);
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {}", e))?;

    let pid = child
        .id()
        .ok_or_else(|| "child process has no pid".to_string())?;

    // Wait for readiness by watching stdout/stderr for the kind-specific pattern.
    let pattern = ready_pattern(&kind).to_string();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let wait_ready = async move {
        let stdout_task = async {
            if let Some(stream) = stdout {
                let mut reader = BufReader::new(stream).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if line.contains(&pattern) {
                        return true;
                    }
                }
            }
            false
        };
        stdout_task.await
    };

    let _ = timeout(Duration::from_secs(15), wait_ready).await;

    // Drain stderr in the background — if we don't, the pipe buffer fills
    // and the child hangs. (We ignore errors.)
    if let Some(stream) = stderr {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stream).lines();
            while let Ok(Some(_)) = reader.next_line().await {}
        });
    }

    state
        .children
        .lock()
        .map_err(|e| e.to_string())?
        .insert(kind.clone(), child);

    Ok(StartResult {
        pid,
        url: format!("http://localhost:{}/v1", port),
    })
}

#[tauri::command]
pub async fn stop_local_server(
    kind: String,
    state: State<'_, LocalServerState>,
) -> Result<(), String> {
    let mut child = {
        let mut map = state.children.lock().map_err(|e| e.to_string())?;
        map.remove(&kind)
    };
    if let Some(ref mut child) = child {
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn local_server_status(
    kind: String,
    state: State<'_, LocalServerState>,
) -> Result<StatusResult, String> {
    let mut map = state.children.lock().map_err(|e| e.to_string())?;
    let entry = map.get_mut(&kind);
    let (running, pid) = match entry {
        Some(child) => match child.try_wait() {
            Ok(None) => (true, child.id()),
            _ => (false, None),
        },
        None => (false, None),
    };
    let url = if running {
        Some(format!("http://localhost:{}/v1", default_port(&kind)))
    } else {
        None
    };
    // If the child exited, remove it from the map so a subsequent start can succeed.
    if !running {
        map.remove(&kind);
    }
    Ok(StatusResult { running, pid, url })
}

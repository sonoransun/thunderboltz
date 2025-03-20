use anyhow::Result;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use bytes::Bytes;
use libsql::{Cipher, EncryptionConfig, Value};
use serde_json::Value as JsonValue;
use std::sync::Arc;
use tauri::{command, State};
use tokio::sync::Mutex;

// Import AppState from the state module
use crate::db_pool::DbPool;
use crate::state::AppState;

// Replace bind_values with this function to create params
pub fn create_params(values: &[JsonValue]) -> Result<Vec<libsql::Value>> {
    let mut params = Vec::with_capacity(values.len());

    for value in values {
        if value.is_null() {
            params.push(Value::Null);
        } else if let Some(s) = value.as_str() {
            params.push(Value::Text(s.to_string()));
        } else if let Some(n) = value.as_i64() {
            params.push(Value::Integer(n));
        } else if let Some(n) = value.as_f64() {
            params.push(Value::Real(n));
        } else if let Some(b) = value.as_bool() {
            params.push(Value::Integer(if b { 1 } else { 0 }));
        } else {
            // For complex types, serialize to JSON string
            params.push(Value::Text(value.to_string()));
        }
    }

    Ok(params)
}

pub fn value_to_json(value: Value) -> JsonValue {
    match value {
        Value::Null => JsonValue::Null,
        Value::Integer(i) => JsonValue::Number(i.into()),
        Value::Real(f) => {
            if let Some(n) = serde_json::Number::from_f64(f) {
                JsonValue::Number(n)
            } else {
                JsonValue::Null
            }
        }
        Value::Text(s) => JsonValue::String(s),
        Value::Blob(b) => {
            // Convert blob to base64 string
            let base64 = STANDARD.encode(&b);
            JsonValue::String(base64)
        }
    }
}

#[command]
pub async fn init_libsql(
    state: State<'_, Mutex<AppState>>,
    path: String,
    encryption_key: Option<String>,
    pool_size: Option<usize>,
) -> Result<(), String> {
    println!("🚀 ~ init_libsql: {:?}, {:?}", path, encryption_key);

    let fqdb = path.clone();
    let pool_size = pool_size.unwrap_or(4); // Default to 4 connections if not specified

    // Create the connection pool
    let db_pool = DbPool::new(&fqdb, encryption_key, pool_size)
        .await
        .map_err(|e| format!("Failed to build database pool: {}", e))?;

    // Store connection in state
    let mut state = state.lock().await;
    state.db_pool = Some(db_pool);

    Ok(())
}

/// Execute a command against the database
#[command]
pub async fn execute(
    state: State<'_, Mutex<AppState>>,
    query: String,
    values: Vec<JsonValue>,
) -> Result<(u64, i64), String> {
    let state = state.lock().await;

    // Get a connection from the pool
    let pool = state
        .db_pool
        .as_ref()
        .ok_or_else(|| "Database not initialized".to_string())?;

    let conn = pool.get_connection().await;
    let mut conn_guard = conn.lock().await;

    let mut stmt = conn_guard
        .prepare(&query)
        .await
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    // Create parameter values from JSON
    let params =
        create_params(&values).map_err(|e| format!("Failed to create parameters: {}", e))?;

    // Pass params directly, not as reference
    let affected = stmt
        .execute(params)
        .await
        .map_err(|e| format!("Failed to execute statement: {}", e))?;

    // libsql just returns the count as usize, no result object
    // We'll use 0 for last_insert_id (or implement another query to get it)
    let rows_affected = affected as u64;
    let last_insert_id = 0; // Would need separate "SELECT last_insert_rowid()" to get this

    Ok((rows_affected, last_insert_id))
}

#[command]
pub async fn select(
    state: State<'_, Mutex<AppState>>,
    query: String,
    values: Vec<JsonValue>,
) -> Result<Vec<Vec<JsonValue>>, String> {
    let state = state.lock().await;

    // Get a connection from the pool
    let pool = state
        .db_pool
        .as_ref()
        .ok_or_else(|| "Database not initialized".to_string())?;

    let conn = pool.get_connection().await;
    let mut conn_guard = conn.lock().await;

    let mut stmt = conn_guard
        .prepare(&query)
        .await
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    // Create parameter values from JSON
    let params =
        create_params(&values).map_err(|e| format!("Failed to create parameters: {}", e))?;

    // Pass params directly, not as reference
    let mut rows = stmt
        .query(params)
        .await
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut results = Vec::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| format!("Failed to fetch row: {}", e))?
    {
        let mut row_values = Vec::with_capacity(row.column_count() as usize);
        for i in 0..(row.column_count() as usize) {
            let v = match row.get::<libsql::Value>(i as i32) {
                Ok(v) => value_to_json(v),
                Err(_) => JsonValue::Null,
            };
            row_values.push(v);
        }
        results.push(row_values);
    }

    Ok(results)
}

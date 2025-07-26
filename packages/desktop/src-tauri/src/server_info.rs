use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub port: u16,
    pub hostname: String,
    pub url: String,
    pub pid: u32,
    #[serde(rename = "startTime")]
    pub start_time: String,
}

#[tauri::command]
pub async fn read_server_info() -> Result<Option<ServerInfo>, String> {
    // Get the XDG_STATE_HOME or default to ~/.local/state
    let state_dir = std::env::var("XDG_STATE_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .map_err(|_| "Could not determine home directory")?;
            PathBuf::from(home).join(".local").join("state")
        });

    let server_info_path = state_dir.join("kuuzuki").join("server.json");

    // Check if file exists
    if !server_info_path.exists() {
        return Ok(None);
    }

    // Read and parse the file
    let content = std::fs::read_to_string(&server_info_path)
        .map_err(|e| format!("Failed to read server info: {}", e))?;

    let info: ServerInfo = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse server info: {}", e))?;

    // Check if the process is still running (Unix-specific)
    #[cfg(unix)]
    {
        use std::process::Command;
        let output = Command::new("kill")
            .arg("-0")
            .arg(info.pid.to_string())
            .output()
            .map_err(|e| format!("Failed to check process: {}", e))?;

        if !output.status.success() {
            // Process is not running
            return Ok(None);
        }
    }

    Ok(Some(info))
}

#[tauri::command]
pub async fn find_kuuzuki_server() -> Result<Option<String>, String> {
    // First try to read from server.json
    if let Ok(Some(info)) = read_server_info().await {
        // Verify the server is actually responding
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(2))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let health_url = format!("{}/health", info.url);
        match client.get(&health_url).send().await {
            Ok(response) if response.status().is_success() => {
                return Ok(Some(info.url));
            }
            _ => {
                // Server not responding, continue with port scanning
            }
        }
    }

    // Try common ports
    let common_ports = vec![4096, 3000, 8080, 8000, 5000];
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(1))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    for port in common_ports {
        let url = format!("http://127.0.0.1:{}", port);
        let health_url = format!("{}/health", url);

        match client.get(&health_url).send().await {
            Ok(response) if response.status().is_success() => {
                return Ok(Some(url));
            }
            _ => continue,
        }
    }

    // Scan dynamic port range
    for port in (30000..50000).step_by(100) {
        let futures: Vec<_> = (0..10)
            .map(|i| {
                let client = client.clone();
                let port = port + i;
                async move {
                    let url = format!("http://127.0.0.1:{}", port);
                    let health_url = format!("{}/health", url);

                    match client.get(&health_url).send().await {
                        Ok(response) if response.status().is_success() => Some(url),
                        _ => None,
                    }
                }
            })
            .collect();

        let results = futures::future::join_all(futures).await;
        if let Some(url) = results.into_iter().flatten().next() {
            return Ok(Some(url));
        }
    }

    Ok(None)
}
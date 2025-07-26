// Prevents additional console window on Windows in release, DO NOT REMOVE!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::Manager;

mod server_info;
use server_info::{find_kuuzuki_server, read_server_info};

#[derive(Clone, serde::Serialize)]
struct ServerStarted {
    url: String,
}

#[tauri::command]
async fn start_kuuzuki_server(app_handle: tauri::AppHandle) -> Result<String, String> {
    // Check if server is already running
    if let Ok(Some(url)) = find_kuuzuki_server().await {
        return Ok(url);
    }

    // Get the path to the Kuuzuki binary
    let resource_path = app_handle
        .path_resolver()
        .resolve_resource("binaries/kuuzuki-x86_64-unknown-linux-gnu")
        .ok_or("Failed to resolve Kuuzuki binary path")?;

    // Start Kuuzuki in TUI mode with dynamic port
    let mut child = Command::new(resource_path)
        .args(&["--port", "0"]) // Use port 0 for dynamic allocation
        .env("KUUZUKI_HEADLESS", "1") // Run in headless mode for desktop
        .spawn()
        .map_err(|e| format!("Failed to start Kuuzuki: {}", e))?;

    // Wait for server to start (max 10 seconds)
    let start_time = std::time::Instant::now();
    loop {
        if start_time.elapsed().as_secs() > 10 {
            // Kill the process if it didn't start properly
            let _ = child.kill();
            return Err("Server failed to start within timeout".to_string());
        }

        if let Ok(Some(url)) = find_kuuzuki_server().await {
            // Emit event to notify frontend
            app_handle.emit_all("server-started", ServerStarted { url: url.clone() })
                .map_err(|e| format!("Failed to emit event: {}", e))?;

            return Ok(url);
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }
}

#[tauri::command]
async fn check_server_health(url: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let health_url = format!("{}/health", url);
    match client.get(&health_url).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_kuuzuki_server,
            find_kuuzuki_server,
            read_server_info,
            check_server_health,
        ])
        .setup(|app| {
            // Auto-start the server when the app launches
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                match start_Kuuzuki_server(app_handle.clone()).await {
                    Ok(url) => {
                        println!("Kuuzuki server started at: {}", url);
                    }
                    Err(e) => {
                        eprintln!("Failed to start Kuuzuki server: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
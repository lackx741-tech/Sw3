#![allow(clippy::pedantic)]
use anyhow::Result;
use std::sync::Arc;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
mod health;
mod router;
#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();
    let rpc_urls: Vec<String> = std::env::var("RPC_URLS")
        .unwrap_or_else(|_| "http://localhost:8545".to_string())
        .split(',').map(|s| s.trim().to_string()).collect();
    let listen_addr = std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:9090".to_string());
    info!(providers = rpc_urls.len(), "initializing RPC router");
    let rpc_router = Arc::new(router::RpcRouter::new(rpc_urls));
    { let r = Arc::clone(&rpc_router); tokio::spawn(async move { health::HealthChecker::new(r).run().await; }); }
    let app = router::create_router(Arc::clone(&rpc_router));
    let listener = tokio::net::TcpListener::bind(&listen_addr).await?;
    info!(addr = %listen_addr, "RPC router listening");
    axum::serve(listener, app).await?;
    Ok(())
}

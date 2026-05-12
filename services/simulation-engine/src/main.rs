#![allow(clippy::pedantic)]
use anyhow::Result;
use std::sync::Arc;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
mod api;
mod simulator;
#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();
    let rpc_url = std::env::var("RPC_URL").unwrap_or_else(|_| "http://localhost:8545".to_string());
    let listen_addr = std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:8082".to_string());
    let gas_multiplier: f64 = std::env::var("GAS_MULTIPLIER").ok().and_then(|s| s.parse().ok()).unwrap_or(1.2);
    let sim = Arc::new(simulator::TxSimulator::new(rpc_url, gas_multiplier).await?);
    info!("TxSimulator ready");
    let app = api::create_router(Arc::clone(&sim));
    let listener = tokio::net::TcpListener::bind(&listen_addr).await?;
    info!(addr = %listen_addr, "simulation engine listening");
    axum::serve(listener, app).await?;
    Ok(())
}

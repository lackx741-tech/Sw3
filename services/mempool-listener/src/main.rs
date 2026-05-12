#![allow(clippy::pedantic)]

use anyhow::Result;
use std::collections::HashSet;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod decoder;
mod filter;
mod listener;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let ws_url = std::env::var("WS_RPC_URL")
        .unwrap_or_else(|_| "ws://localhost:8545".to_string());
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());

    let redis_client = redis::Client::open(redis_url.as_str())?;
    let redis_conn = redis::aio::ConnectionManager::new(redis_client).await?;

    let watched_addresses: HashSet<String> = std::env::var("WATCHED_ADDRESSES")
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_lowercase())
        .collect();

    let tx_filter = filter::TxFilter::new(watched_addresses);
    let decoder = decoder::TxDecoder::new();

    let mempool_listener =
        listener::MempoolListener::new(ws_url, redis_conn, tx_filter, decoder).await?;

    info!("starting mempool listener");
    mempool_listener.run().await
}

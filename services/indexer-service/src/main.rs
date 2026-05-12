#![allow(clippy::pedantic)]
use anyhow::Result;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
mod indexer;
mod models;
mod multicall;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();
    let database_url = std::env::var("DATABASE_URL")?;
    let rpc_url = std::env::var("RPC_URL").unwrap_or_else(|_| "http://localhost:8545".to_string());
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let poll_interval_secs: u64 = std::env::var("POLL_INTERVAL_SECS").ok().and_then(|s| s.parse().ok()).unwrap_or(12);
    let pool = sqlx::postgres::PgPoolOptions::new().max_connections(10).connect(&database_url).await?;
    let redis_client = redis::Client::open(redis_url.as_str())?;
    let redis_conn = redis::aio::ConnectionManager::new(redis_client).await?;
    let balance_indexer = indexer::BalanceIndexer::new(rpc_url, pool, redis_conn, poll_interval_secs).await?;
    info!("starting balance indexer");
    balance_indexer.run().await
}

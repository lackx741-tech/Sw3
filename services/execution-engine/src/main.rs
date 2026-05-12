#![allow(clippy::pedantic)]

use anyhow::Result;
use redis::aio::ConnectionManager;
use std::sync::Arc;
use tokio::signal;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod api;
mod config;
mod db;
mod error;
mod executor;
mod models;
mod rpc;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let cfg = Arc::new(config::Config::from_env()?);
    info!(chain_id = cfg.chain_id, "loaded configuration");

    let pool = db::create_pool(&cfg.database_url).await?;
    info!("connected to database");

    let redis_client = redis::Client::open(cfg.redis_url.as_str())?;
    let redis_conn = ConnectionManager::new(redis_client).await?;
    info!("connected to Redis");

    let rpc_client = Arc::new(rpc::client::RpcClient::new(&cfg.rpc_urls)?);
    {
        let rpc_clone = Arc::clone(&rpc_client);
        tokio::spawn(async move { rpc_clone.health_check_loop().await });
    }

    let executor = Arc::new(executor::Executor::new(
        Arc::clone(&cfg),
        pool.clone(),
        redis_conn,
        Arc::clone(&rpc_client),
    ));
    {
        let exec_clone = Arc::clone(&executor);
        tokio::spawn(async move { exec_clone.run().await });
    }

    let state = api::routes::AppState {
        pool,
        config: Arc::clone(&cfg),
    };
    let app = api::routes::create_router(state);
    let addr = format!("{}:{}", cfg.server_host, cfg.server_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!(addr = %addr, "HTTP server listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async { signal::ctrl_c().await.expect("failed to install Ctrl+C handler") };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}

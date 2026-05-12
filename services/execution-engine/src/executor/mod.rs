pub mod builder;
pub mod submitter;

use crate::config::Config;
use crate::rpc::client::RpcClient;
use anyhow::Result;
use redis::aio::ConnectionManager;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};

pub struct Executor {
    config: Arc<Config>,
    pool: PgPool,
    redis: ConnectionManager,
    rpc: Arc<RpcClient>,
}

impl Executor {
    pub fn new(
        config: Arc<Config>,
        pool: PgPool,
        redis: ConnectionManager,
        rpc: Arc<RpcClient>,
    ) -> Self {
        Self { config, pool, redis, rpc }
    }

    pub async fn run(self: Arc<Self>) {
        info!("Executor started");
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            if let Err(e) = self.tick().await {
                error!("Executor tick error: {e}");
            }
        }
    }

    async fn tick(&self) -> Result<()> {
        let builder = builder::BatchBuilder::new(
            self.pool.clone(),
            self.rpc.clone(),
            self.config.clone(),
        );
        let batch = builder.build_next_batch().await?;
        if batch.is_empty() {
            return Ok(());
        }
        info!(count = batch.len(), "built sweep batch");
        let submitter = submitter::TxSubmitter::new(
            self.pool.clone(),
            self.rpc.clone(),
            self.config.clone(),
        );
        submitter.submit_batch(&batch).await?;
        Ok(())
    }
}

use crate::config::Config;
use crate::models::sweep::{SweepJob, SweepStatus};
use crate::rpc::client::RpcClient;
use anyhow::Result;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::debug;

pub struct BatchBuilder {
    pool: PgPool,
    rpc: Arc<RpcClient>,
    config: Arc<Config>,
}

impl BatchBuilder {
    pub fn new(pool: PgPool, rpc: Arc<RpcClient>, config: Arc<Config>) -> Self {
        Self { pool, rpc, config }
    }

    pub async fn build_next_batch(&self) -> Result<Vec<SweepJob>> {
        let pending = self.fetch_pending_sweeps().await?;
        if pending.is_empty() {
            return Ok(vec![]);
        }
        let batch: Vec<SweepJob> = pending
            .into_iter()
            .take(self.config.max_batch_size)
            .collect();
        debug!(count = batch.len(), "fetched pending sweeps for batch");
        Ok(batch)
    }

    async fn fetch_pending_sweeps(&self) -> Result<Vec<SweepJob>> {
        let jobs = sqlx::query_as::<_, SweepJob>(
            "SELECT * FROM sweep_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1",
        )
        .bind(self.config.max_batch_size as i64)
        .fetch_all(&self.pool)
        .await?;
        Ok(jobs)
    }
}

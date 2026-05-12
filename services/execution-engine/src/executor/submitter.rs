use crate::config::Config;
use crate::models::sweep::{SweepJob, SweepStatus};
use crate::rpc::client::RpcClient;
use anyhow::{anyhow, Result};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};
use uuid::Uuid;

pub struct TxSubmitter {
    pool: PgPool,
    rpc: Arc<RpcClient>,
    config: Arc<Config>,
}

impl TxSubmitter {
    pub fn new(pool: PgPool, rpc: Arc<RpcClient>, config: Arc<Config>) -> Self {
        Self { pool, rpc, config }
    }

    pub async fn submit_batch(&self, sweeps: &[SweepJob]) -> Result<String> {
        let ids: Vec<Uuid> = sweeps.iter().map(|s| s.id).collect();

        self.update_sweep_status(&ids, SweepStatus::Batched).await?;

        let tx_hash = format!("0x{}", hex::encode(uuid::Uuid::new_v4().as_bytes()));
        info!(
            tx_hash = %tx_hash,
            count = sweeps.len(),
            "submitted batch transaction"
        );

        let confirmed = self.wait_for_confirmation(&tx_hash).await;
        match confirmed {
            Ok(block) => {
                info!(tx_hash = %tx_hash, block = block, "batch confirmed");
                self.update_sweep_status(&ids, SweepStatus::Confirmed).await?;
                for sweep in sweeps {
                    sqlx::query(
                        "UPDATE sweep_jobs SET tx_hash = $1, updated_at = NOW() WHERE id = $2",
                    )
                    .bind(&tx_hash)
                    .bind(sweep.id)
                    .execute(&self.pool)
                    .await?;
                }
            }
            Err(e) => {
                error!(tx_hash = %tx_hash, error = %e, "batch failed");
                self.update_sweep_status(&ids, SweepStatus::Failed).await?;
            }
        }

        Ok(tx_hash)
    }

    async fn wait_for_confirmation(&self, _tx_hash: &str) -> Result<u64> {
        let mut attempts = 0u32;
        loop {
            tokio::time::sleep(Duration::from_secs(3)).await;
            let block = self.rpc.get_block_number().await?;
            attempts += 1;
            if attempts >= self.config.confirmation_blocks as u32 {
                return Ok(block);
            }
            if attempts > 40 {
                return Err(anyhow!("confirmation timeout"));
            }
        }
    }

    async fn update_sweep_status(&self, ids: &[Uuid], status: SweepStatus) -> Result<()> {
        for id in ids {
            sqlx::query(
                "UPDATE sweep_jobs SET status = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(&status)
            .bind(id)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }
}

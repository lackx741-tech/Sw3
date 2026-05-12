use crate::multicall::MulticallBatcher;
use anyhow::Result;
use ethers::providers::{Http, Middleware, Provider};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use sqlx::PgPool;
use std::time::Duration;
use tracing::{error, info};
use uuid::Uuid;

pub struct BalanceIndexer {
    provider: Provider<Http>,
    pool: PgPool,
    redis: ConnectionManager,
    multicall: MulticallBatcher,
    poll_interval: Duration,
}

impl BalanceIndexer {
    pub async fn new(rpc_url: String, pool: PgPool, redis: ConnectionManager, poll_interval_secs: u64) -> Result<Self> {
        let provider = Provider::<Http>::try_from(rpc_url.as_str())?;
        let multicall = MulticallBatcher::new(provider.clone())?;
        Ok(Self { provider, pool, redis, multicall, poll_interval: Duration::from_secs(poll_interval_secs) })
    }

    pub async fn run(mut self) -> Result<()> {
        let mut interval = tokio::time::interval(self.poll_interval);
        loop {
            interval.tick().await;
            if let Err(e) = self.index_balances().await { error!("balance indexing error: {e}"); }
        }
    }

    async fn index_balances(&mut self) -> Result<()> {
        let block_number = self.provider.get_block_number().await?.as_u64();
        info!(block = block_number, "indexing balances");
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT DISTINCT wallet_address, token_address FROM wallet_balances",
        ).fetch_all(&self.pool).await.unwrap_or_default();
        if rows.is_empty() { return Ok(()); }
        let results = self.multicall.batch_balance_of(&rows).await?;
        for r in &results {
            if !r.success { continue; }
            let bal = r.balance.to_string();
            let existing: Option<(String,)> = sqlx::query_as(
                "SELECT balance FROM wallet_balances WHERE wallet_address=$1 AND token_address=$2",
            ).bind(&r.wallet).bind(&r.token).fetch_optional(&self.pool).await?;
            let changed = existing.as_ref().map(|(b,)| b != &bal).unwrap_or(true);
            sqlx::query(
                "INSERT INTO wallet_balances (id,wallet_address,token_address,balance,block_number,updated_at) \
                 VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (wallet_address,token_address) \
                 DO UPDATE SET balance=$4,block_number=$5,updated_at=NOW()",
            ).bind(Uuid::new_v4()).bind(&r.wallet).bind(&r.token).bind(&bal).bind(block_number as i64)
             .execute(&self.pool).await?;
            if changed {
                let ev = serde_json::json!({"wallet":r.wallet,"token":r.token,"balance":bal,"block":block_number});
                let mut redis = self.redis.clone();
                let _ = redis.publish::<_,_,()>("indexer:balance_changes", serde_json::to_string(&ev)?).await;
            }
        }
        info!(count = results.len(), "indexed balances");
        Ok(())
    }
}

/// Deterministic nonce manager backed by Redis.
///
/// # Problem
///
/// The Ethereum mempool requires each transaction from an address to carry a
/// monotonically increasing nonce.  If two concurrent goroutines both call
/// `eth_getTransactionCount` at the same time they get the same pending nonce
/// and one of the resulting transactions will be silently dropped or require a
/// replacement.
///
/// # Solution
///
/// This module uses a Redis key-per-address as a distributed counter.  The
/// first call fetches the on-chain pending nonce and seeds the Redis counter.
/// Subsequent calls atomically increment the counter without touching the RPC.
/// If a transaction fails (revert or timeout) the caller must call
/// `rollback_nonce` so the slot can be re-used.
///
/// Keys are namespaced under `sw3:nonce:<hex_address>` and expire after
/// `NONCE_TTL_SECS` to allow recovery if the engine crashes mid-batch.
use anyhow::{anyhow, Result};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use std::time::Duration;
use tracing::{debug, warn};

use crate::rpc::client::RpcClient;

/// Redis key TTL (seconds).  The executor poll interval is 5 s, so 300 s
/// provides a safe margin for in-flight batches while still expiring stale
/// state after an engine restart.
const NONCE_TTL_SECS: u64 = 300;

pub struct NonceManager {
    redis: ConnectionManager,
    rpc: std::sync::Arc<RpcClient>,
}

impl NonceManager {
    pub fn new(redis: ConnectionManager, rpc: std::sync::Arc<RpcClient>) -> Self {
        Self { redis, rpc }
    }

    /// Acquire the next nonce for `address`.
    ///
    /// 1. If a Redis key exists for the address, atomically increment it and
    ///    return the *pre-increment* value (the nonce to use).
    /// 2. If no key exists, fetch the pending nonce from the RPC node, store it
    ///    in Redis (seeding future increments), and return it.
    pub async fn next_nonce(&mut self, address: &str) -> Result<u64> {
        let key = redis_key(address);

        // Try to increment an existing counter.
        let incremented: Option<i64> = self
            .redis
            .get_ex(&key, redis::Expiry::EX(NONCE_TTL_SECS as usize))
            .await
            .ok();

        if let Some(current) = incremented {
            // Key existed — INCR gives us the *new* value; return old value as nonce.
            let new_val: i64 = self.redis.incr(&key, 1i64).await?;
            let _ = self
                .redis
                .expire::<_, ()>(&key, NONCE_TTL_SECS as i64)
                .await;
            debug!(address = %address, nonce = new_val - 1, "nonce from redis");
            return Ok((new_val - 1) as u64);
        }

        // Key not set — seed from RPC.
        let on_chain = self.fetch_pending_nonce(address).await?;
        // SET key (on_chain + 1) EX TTL NX (don't overwrite if another worker
        // raced us here — if they won, the next INCR will give us the right value).
        let set_result: Option<String> = self
            .redis
            .set_options(
                &key,
                on_chain + 1,
                redis::SetOptions::default()
                    .with_expiration(redis::SetExpiry::EX(NONCE_TTL_SECS as usize))
                    .conditional_set(redis::ExistenceCheck::NX),
            )
            .await?;

        if set_result.is_some() {
            debug!(address = %address, nonce = on_chain, "nonce seeded from rpc");
            return Ok(on_chain);
        }

        // Another worker won the race — increment their counter.
        let new_val: i64 = self.redis.incr(&key, 1i64).await?;
        let _ = self
            .redis
            .expire::<_, ()>(&key, NONCE_TTL_SECS as i64)
            .await;
        debug!(address = %address, nonce = new_val - 1, "nonce from redis (after race)");
        Ok((new_val - 1) as u64)
    }

    /// Roll back the nonce counter after a failed submission.
    ///
    /// This decrements the counter by one so the slot is reused on the next
    /// attempt, avoiding gaps in the nonce sequence that would stall the mempool.
    ///
    /// **Note**: only call this when certain the transaction was *not* broadcast
    /// (e.g., pre-flight simulation failure or signing error).  If the tx was
    /// already sent, rolling back may cause a nonce collision.
    pub async fn rollback_nonce(&mut self, address: &str) -> Result<()> {
        let key = redis_key(address);
        let _: Option<i64> = self.redis.decr(&key, 1i64).await.ok();
        warn!(address = %address, "nonce rolled back");
        Ok(())
    }

    /// Forcefully reset the nonce to the current pending on-chain value.
    ///
    /// Call this after a transaction is confirmed to sync the counter with
    /// the canonical chain state, or after detecting a nonce gap.
    pub async fn sync_nonce(&mut self, address: &str) -> Result<u64> {
        let key = redis_key(address);
        let on_chain = self.fetch_pending_nonce(address).await?;
        let _: () = self
            .redis
            .set_ex(&key, on_chain, NONCE_TTL_SECS as usize)
            .await?;
        debug!(address = %address, nonce = on_chain, "nonce synced from rpc");
        Ok(on_chain)
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    async fn fetch_pending_nonce(&self, address: &str) -> Result<u64> {
        use ethers::providers::Middleware;
        use ethers::types::Address;
        use std::str::FromStr;

        let addr =
            Address::from_str(address).map_err(|e| anyhow!("invalid address {address}: {e}"))?;

        let provider = self.rpc.current_provider();
        let nonce = provider
            .get_transaction_count(addr, Some(ethers::types::BlockNumber::Pending.into()))
            .await
            .map_err(|e| anyhow!("get_transaction_count failed: {e}"))?;

        Ok(nonce.as_u64())
    }
}

fn redis_key(address: &str) -> String {
    format!("sw3:nonce:{}", address.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::redis_key;

    #[test]
    fn redis_key_is_lowercase() {
        let k = redis_key("0xAbCdEf1234567890abcdef1234567890ABCDEF12");
        assert_eq!(k, "sw3:nonce:0xabcdef1234567890abcdef1234567890abcdef12");
    }
}

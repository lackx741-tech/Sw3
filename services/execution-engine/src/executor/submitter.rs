use crate::config::Config;
use crate::executor::nonce_manager::NonceManager;
use crate::models::sweep::{SweepJob, SweepStatus};
use crate::rpc::client::RpcClient;
use anyhow::{anyhow, Result};
use ethers::middleware::SignerMiddleware;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer};
use ethers::types::{
    transaction::eip2718::TypedTransaction, Address, Bytes, NameOrAddress, TransactionRequest,
    U256,
};
use redis::aio::ConnectionManager;
use sqlx::PgPool;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};
use uuid::Uuid;

pub struct TxSubmitter {
    pool:   PgPool,
    rpc:    Arc<RpcClient>,
    config: Arc<Config>,
    redis:  ConnectionManager,
}

impl TxSubmitter {
    pub fn new(
        pool:   PgPool,
        rpc:    Arc<RpcClient>,
        config: Arc<Config>,
        redis:  ConnectionManager,
    ) -> Self {
        Self { pool, rpc, config, redis }
    }

    pub async fn submit_batch(&self, sweeps: &[SweepJob]) -> Result<String> {
        let ids: Vec<Uuid> = sweeps.iter().map(|s| s.id).collect();

        self.update_sweep_status(&ids, SweepStatus::Batched).await?;

        // ── Load wallet ───────────────────────────────────────────────────
        let wallet = self.load_wallet()?;
        let sender = format!("{:#x}", wallet.address());

        // ── Nonce management ──────────────────────────────────────────────
        let mut nonce_mgr = NonceManager::new(self.redis.clone(), Arc::clone(&self.rpc));
        let nonce = nonce_mgr.next_nonce(&sender).await?;

        // ── Build calldata ────────────────────────────────────────────────
        let calldata = self.encode_batch(sweeps);
        let to_addr  = Address::from_str(&self.config.sweeper_contract)
            .map_err(|e| anyhow!("invalid sweeper_contract address: {e}"))?;

        // ── Gas estimation ────────────────────────────────────────────────
        let provider = self.rpc.current_provider().clone();
        let tx_req: TypedTransaction = TransactionRequest {
            from:  Some(wallet.address()),
            to:    Some(NameOrAddress::Address(to_addr)),
            data:  Some(Bytes::from(calldata.clone())),
            nonce: Some(U256::from(nonce)),
            ..Default::default()
        }
        .into();

        let gas_limit = match provider.estimate_gas(&tx_req, None).await {
            Ok(g) => {
                let bumped = (g.as_u64() as f64 * self.config.gas_multiplier) as u64;
                U256::from(bumped)
            }
            Err(e) => {
                warn!("gas estimation failed, using fallback: {e}");
                U256::from(500_000u64)
            }
        };

        // ── Sign & send ───────────────────────────────────────────────────
        let client = SignerMiddleware::new(provider, wallet.with_chain_id(self.config.chain_id));

        let mut typed_tx: TypedTransaction = TransactionRequest {
            from:  Some(client.address()),
            to:    Some(NameOrAddress::Address(to_addr)),
            data:  Some(Bytes::from(calldata)),
            nonce: Some(U256::from(nonce)),
            gas:   Some(gas_limit),
            ..Default::default()
        }
        .into();

        // Fill in gas prices from the provider.
        client.fill_transaction(&mut typed_tx, None).await?;

        let pending_tx = client
            .send_transaction(typed_tx, None)
            .await
            .map_err(|e| anyhow!("send_transaction failed: {e}"))?;

        let tx_hash = format!("{:#x}", pending_tx.tx_hash());
        info!(tx_hash = %tx_hash, count = sweeps.len(), nonce = nonce, "batch transaction sent");

        self.update_sweep_status(&ids, SweepStatus::Submitted).await?;

        // ── Wait for confirmation ─────────────────────────────────────────
        let confirmed = self.wait_for_confirmation(pending_tx.tx_hash()).await;
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
                error!(tx_hash = %tx_hash, error = %e, "batch failed to confirm");
                self.update_sweep_status(&ids, SweepStatus::Failed).await?;
                // Roll back the nonce so the next batch can reuse this slot.
                let _ = nonce_mgr.rollback_nonce(&sender).await;
            }
        }

        Ok(tx_hash)
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    fn load_wallet(&self) -> Result<LocalWallet> {
        let key_hex = std::env::var(&self.config.private_key_env).map_err(|_| {
            anyhow!(
                "private key env var '{}' is not set",
                self.config.private_key_env
            )
        })?;
        let key_hex = key_hex.trim().trim_start_matches("0x");
        key_hex
            .parse::<LocalWallet>()
            .map_err(|e| anyhow!("failed to parse private key: {e}"))
    }

    /// Encode a batch of sweep jobs into calldata for the Sweeper contract.
    ///
    /// Each job is mapped to a `SweepLeg(token, owner, recipient, amount)` and
    /// the whole batch is ABI-encoded with a deadline set 5 minutes into the
    /// future.  The ABI encoding mirrors the `batchSweep(SweepLeg[],uint256)`
    /// function selector from the Sweeper contract.
    fn encode_batch(&self, sweeps: &[SweepJob]) -> Vec<u8> {
        use ethers::abi::{encode, Token};

        let deadline =
            U256::from(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
                + 300);

        let legs: Vec<Token> = sweeps
            .iter()
            .map(|s| {
                let token = Address::from_str(&s.token).unwrap_or_default();
                let from  = Address::from_str(&s.owner).unwrap_or_default();
                let to    = Address::from_str(&s.recipient).unwrap_or_default();
                let amount = U256::from_dec_str(&s.amount).unwrap_or_default();
                Token::Tuple(vec![
                    Token::Address(token),
                    Token::Address(from),
                    Token::Address(to),
                    Token::Uint(amount),
                ])
            })
            .collect();

        // batchSweep(SweepLeg[],uint256) — selector: first 4 bytes of keccak256
        let selector = &ethers::utils::keccak256(b"batchSweep((address,address,address,uint256)[],uint256)")[..4];
        let params   = encode(&[Token::Array(legs), Token::Uint(deadline)]);

        [selector, params.as_slice()].concat()
    }

    async fn wait_for_confirmation(
        &self,
        tx_hash: ethers::types::H256,
    ) -> Result<u64> {
        use ethers::providers::Middleware;

        let provider   = self.rpc.current_provider();
        let poll_delay = Duration::from_secs(3);
        let max_polls  = 40u32;

        for attempt in 0..max_polls {
            tokio::time::sleep(poll_delay).await;

            match provider.get_transaction_receipt(tx_hash).await {
                Ok(Some(receipt)) => {
                    let block = receipt.block_number.map(|b| b.as_u64()).unwrap_or(0);
                    let current = self.rpc.get_block_number().await?;

                    if current >= block + self.config.confirmation_blocks {
                        if receipt.status == Some(1.into()) {
                            return Ok(block);
                        } else {
                            return Err(anyhow!("transaction reverted on-chain"));
                        }
                    }
                }
                Ok(None) => {
                    // Not yet mined — keep polling.
                }
                Err(e) => {
                    warn!(attempt, "get_transaction_receipt error: {e}");
                }
            }
        }

        Err(anyhow!("confirmation timeout after {} polls", max_polls))
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


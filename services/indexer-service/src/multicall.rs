use anyhow::Result;
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, Bytes, U256};
use std::str::FromStr;
use tracing::debug;

const BALANCE_OF_SELECTOR: [u8; 4] = [0x70, 0xa0, 0x82, 0x31];

pub struct MulticallBatcher {
    pub provider: Provider<Http>,
}

#[derive(Debug, Clone)]
pub struct BalanceResult {
    pub wallet: String,
    pub token: String,
    pub balance: U256,
    pub success: bool,
}

impl MulticallBatcher {
    pub fn new(provider: Provider<Http>) -> Result<Self> {
        Ok(Self { provider })
    }

    pub async fn batch_balance_of(&self, queries: &[(String, String)]) -> Result<Vec<BalanceResult>> {
        let mut results = Vec::new();
        for chunk in queries.chunks(500) {
            for (wallet, token) in chunk {
                let wallet_addr = Address::from_str(wallet).unwrap_or_default();
                let token_addr = Address::from_str(token).unwrap_or_default();
                let mut calldata = BALANCE_OF_SELECTOR.to_vec();
                calldata.extend_from_slice(&[0u8; 12]);
                calldata.extend_from_slice(wallet_addr.as_bytes());
                debug!(wallet = %wallet, token = %token, "querying balance");
                let call = ethers::types::transaction::eip2718::TypedTransaction::Legacy(
                    ethers::types::TransactionRequest {
                        to: Some(token_addr.into()),
                        data: Some(Bytes::from(calldata)),
                        ..Default::default()
                    },
                );
                let balance = match self.provider.call(&call, None).await {
                    Ok(bytes) if bytes.len() >= 32 => U256::from_big_endian(&bytes[..32]),
                    _ => U256::zero(),
                };
                results.push(BalanceResult { wallet: wallet.clone(), token: token.clone(), balance, success: true });
            }
        }
        Ok(results)
    }
}

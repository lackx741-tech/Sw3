use anyhow::{anyhow, Result};
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, Bytes, U256};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateRequest { pub from: String, pub to: String, pub data: Option<String>, pub value: Option<String>, pub gas: Option<u64> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateResult { pub success: bool, pub gas_estimate: u64, pub revert_reason: Option<String> }

pub struct TxSimulator { provider: Provider<Http>, gas_multiplier: f64 }

impl TxSimulator {
    pub async fn new(rpc_url: String, gas_multiplier: f64) -> Result<Self> {
        Ok(Self { provider: Provider::<Http>::try_from(rpc_url.as_str())?, gas_multiplier })
    }
    pub async fn simulate(&self, req: &SimulateRequest) -> Result<SimulateResult> {
        let from = Address::from_str(&req.from).map_err(|e| anyhow!("invalid from: {e}"))?;
        let to   = Address::from_str(&req.to).map_err(|e| anyhow!("invalid to: {e}"))?;
        let data = req.data.as_deref().map(|d| {
            hex::decode(d.strip_prefix("0x").unwrap_or(d)).map(Bytes::from).map_err(|e| anyhow!("{e}"))
        }).transpose()?.unwrap_or_default();
        let value = req.value.as_deref().map(|v| {
            U256::from_str_radix(v.strip_prefix("0x").unwrap_or(v), 16).map_err(|e| anyhow!("{e}"))
        }).transpose()?.unwrap_or_default();
        let tx = ethers::types::transaction::eip2718::TypedTransaction::Legacy(
            ethers::types::TransactionRequest { from: Some(from), to: Some(to.into()), data: Some(data), value: Some(value), ..Default::default() },
        );
        debug!(from=%from, to=%to, "simulating");
        match self.provider.call(&tx, None).await {
            Ok(_) => match self.provider.estimate_gas(&tx, None).await {
                Ok(g) => { let est = (g.as_u64() as f64 * self.gas_multiplier) as u64; info!(gas=%est,"sim ok"); Ok(SimulateResult { success: true, gas_estimate: est, revert_reason: None }) }
                Err(e) => Ok(SimulateResult { success: false, gas_estimate: 0, revert_reason: Some(format!("gas estimation failed: {e}")) }),
            },
            Err(e) => Ok(SimulateResult { success: false, gas_estimate: 0, revert_reason: Some(parse_revert(&e.to_string())) }),
        }
    }
}

fn parse_revert(s: &str) -> String {
    if let Some(i) = s.find("execution reverted: ") { return s[i + 20..].trim_matches('"').to_string(); }
    s.chars().take(200).collect()
}

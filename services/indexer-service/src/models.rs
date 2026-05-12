use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WalletBalance {
    pub id: Uuid,
    pub wallet_address: String,
    pub token_address: String,
    pub balance: String,
    pub block_number: i64,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TokenInfo {
    pub address: String,
    pub symbol: String,
    pub decimals: i16,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct BalanceQuery {
    pub wallet: String,
    pub token: String,
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "batch_status", rename_all = "snake_case")]
pub enum BatchStatus {
    Building,
    Submitted,
    Confirmed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BatchJob {
    pub id: Uuid,
    pub sweep_ids: serde_json::Value,
    pub status: BatchStatus,
    pub gas_estimate: Option<i64>,
    pub submitted_tx_hash: Option<String>,
    pub block_number: Option<i64>,
    pub created_at: DateTime<Utc>,
}

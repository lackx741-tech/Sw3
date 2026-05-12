use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "sweep_status", rename_all = "snake_case")]
pub enum SweepStatus {
    Pending,
    Batched,
    Submitted,
    Confirmed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SweepJob {
    pub id: Uuid,
    pub owner: String,
    pub token: String,
    pub amount: String,
    pub recipient: String,
    pub status: SweepStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tx_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSweepRequest {
    pub owner: String,
    pub token: String,
    pub amount: String,
    pub recipient: String,
}

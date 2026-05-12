use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use prometheus::{Encoder, TextEncoder};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::info;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;
use crate::models::sweep::{CreateSweepRequest, SweepJob};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/sweep-jobs", post(create_sweep_job))
        .route("/sweep-jobs/:id", get(get_sweep_job))
        .with_state(state)
}

async fn health_handler() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

async fn metrics_handler() -> impl IntoResponse {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    if encoder.encode(&metric_families, &mut buffer).is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to encode metrics".to_string(),
        )
            .into_response();
    }
    (
        StatusCode::OK,
        [(axum::http::header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        buffer,
    )
        .into_response()
}

async fn create_sweep_job(
    State(state): State<AppState>,
    Json(req): Json<CreateSweepRequest>,
) -> Result<impl IntoResponse, AppError> {
    let job = sqlx::query_as::<_, SweepJob>(
        r#"INSERT INTO sweep_jobs (owner, token, amount, recipient)
           VALUES ($1, $2, $3, $4)
           RETURNING *"#,
    )
    .bind(&req.owner)
    .bind(&req.token)
    .bind(&req.amount)
    .bind(&req.recipient)
    .fetch_one(&state.pool)
    .await?;

    info!(id = %job.id, owner = %job.owner, "created sweep job");
    Ok((StatusCode::CREATED, Json(job)))
}

async fn get_sweep_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let job = sqlx::query_as::<_, SweepJob>("SELECT * FROM sweep_jobs WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(job))
}

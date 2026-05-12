use crate::simulator::{SimulateRequest, TxSimulator};
use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::{get, post}, Json, Router};
use std::sync::Arc;
use tracing::info;
pub fn create_router(sim: Arc<TxSimulator>) -> Router {
    Router::new().route("/health", get(|| async { Json(serde_json::json!({"status":"ok"})) })).route("/simulate", post(simulate_handler)).with_state(sim)
}
async fn simulate_handler(State(sim): State<Arc<TxSimulator>>, Json(req): Json<SimulateRequest>) -> impl IntoResponse {
    info!(from=%req.from, to=%req.to, "simulate request");
    match sim.simulate(&req).await {
        Ok(r) => (StatusCode::OK, Json(r)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":e.to_string()}))).into_response(),
    }
}

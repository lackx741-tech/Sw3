use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::{get, post}, Json, Router};
use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, warn};

#[derive(Debug, Clone)]
pub struct ProviderStats { pub url: String, pub healthy: bool, pub latency_ms: u64, pub failure_count: u32 }

pub struct RpcRouter {
    lock: RwLock<Vec<ProviderStats>>,
    counter: AtomicUsize,
    client: Client,
}

impl RpcRouter {
    pub fn new(urls: Vec<String>) -> Self {
        let providers = urls.into_iter().map(|url| ProviderStats { url, healthy: true, latency_ms: 0, failure_count: 0 }).collect();
        Self { lock: RwLock::new(providers), counter: AtomicUsize::new(0), client: Client::builder().timeout(Duration::from_secs(30)).build().expect("client") }
    }
    pub async fn mark_unhealthy(&self, url: &str) {
        let mut g = self.lock.write().await;
        if let Some(p) = g.iter_mut().find(|p| p.url == url) {
            p.failure_count += 1;
            if p.failure_count >= 3 { p.healthy = false; error!(url=%url,"provider unhealthy"); }
        }
    }
    pub async fn mark_healthy(&self, url: &str, latency_ms: u64) {
        let mut g = self.lock.write().await;
        if let Some(p) = g.iter_mut().find(|p| p.url == url) { p.healthy = true; p.failure_count = 0; p.latency_ms = latency_ms; }
    }
    pub async fn get_providers(&self) -> Vec<ProviderStats> { self.lock.read().await.clone() }
    pub async fn route_request(&self, body: Value) -> Result<Value, String> {
        let providers = self.get_providers().await;
        let healthy: Vec<&ProviderStats> = providers.iter().filter(|p| p.healthy).collect();
        if healthy.is_empty() { return Err("no healthy providers".to_string()); }
        let idx = self.counter.fetch_add(1, Ordering::Relaxed) % healthy.len();
        let url = healthy[idx].url.clone();
        let start = Instant::now();
        match self.client.post(&url).json(&body).send().await {
            Ok(r) => { self.mark_healthy(&url, start.elapsed().as_millis() as u64).await; r.json::<Value>().await.map_err(|e| e.to_string()) }
            Err(e) => { warn!(url=%url,error=%e,"provider error"); self.mark_unhealthy(&url).await; Err(e.to_string()) }
        }
    }
}

pub fn create_router(r: Arc<RpcRouter>) -> Router {
    Router::new().route("/", post(proxy_rpc)).route("/health", get(health_handler)).with_state(r)
}
async fn proxy_rpc(State(r): State<Arc<RpcRouter>>, Json(body): Json<Value>) -> impl IntoResponse {
    debug!(method=body["method"].as_str(),"proxying");
    match r.route_request(body).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"jsonrpc":"2.0","error":{"code":-32603,"message":e}}))).into_response(),
    }
}
async fn health_handler(State(r): State<Arc<RpcRouter>>) -> impl IntoResponse {
    let p = r.get_providers().await;
    let h = p.iter().filter(|x| x.healthy).count();
    Json(serde_json::json!({"status":"ok","providers":p.len(),"healthy":h}))
}

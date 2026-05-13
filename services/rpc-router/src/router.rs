use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
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
    Router::new()
        .route("/", post(proxy_rpc))
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .with_state(r)
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

async fn metrics_handler(State(r): State<Arc<RpcRouter>>) -> impl IntoResponse {
    let providers = r.get_providers().await;
    let healthy = providers.iter().filter(|p| p.healthy).count();
    let failure_total: u32 = providers.iter().map(|p| p.failure_count).sum();
    let latency_sum: u64 = providers.iter().map(|p| p.latency_ms).sum();

    let mut body = String::new();
    body.push_str("# TYPE rpc_router_providers_total gauge\n");
    body.push_str(&format!("rpc_router_providers_total {}\n", providers.len()));
    body.push_str("# TYPE rpc_router_providers_healthy gauge\n");
    body.push_str(&format!("rpc_router_providers_healthy {}\n", healthy));
    body.push_str("# TYPE rpc_router_provider_failures_total counter\n");
    body.push_str(&format!(
        "rpc_router_provider_failures_total {}\n",
        failure_total
    ));
    body.push_str("# TYPE rpc_router_provider_latency_ms_sum gauge\n");
    body.push_str(&format!(
        "rpc_router_provider_latency_ms_sum {}\n",
        latency_sum
    ));
    body.push_str("# TYPE rpc_router_provider_healthy gauge\n");
    body.push_str("# TYPE rpc_router_provider_latency_ms gauge\n");
    body.push_str("# TYPE rpc_router_provider_failures gauge\n");

    for provider in providers {
        let escaped_url = provider.url.replace('\\', r"\\").replace('"', "\\\"");
        let healthy_val = if provider.healthy { 1 } else { 0 };
        body.push_str(&format!(
            "rpc_router_provider_healthy{{url=\"{}\"}} {}\n",
            escaped_url, healthy_val
        ));
        body.push_str(&format!(
            "rpc_router_provider_latency_ms{{url=\"{}\"}} {}\n",
            escaped_url, provider.latency_ms
        ));
        body.push_str(&format!(
            "rpc_router_provider_failures{{url=\"{}\"}} {}\n",
            escaped_url, provider.failure_count
        ));
    }

    (StatusCode::OK, [("content-type", "text/plain; version=0.0.4")], body)
}

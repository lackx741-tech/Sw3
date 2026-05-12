use crate::router::RpcRouter;
use reqwest::Client;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::warn;
pub struct HealthChecker { router: Arc<RpcRouter>, client: Client }
impl HealthChecker {
    pub fn new(router: Arc<RpcRouter>) -> Self {
        Self { router, client: Client::builder().timeout(Duration::from_secs(5)).build().expect("client") }
    }
    pub async fn run(self) {
        let mut interval = tokio::time::interval(Duration::from_secs(15));
        loop {
            interval.tick().await;
            for p in self.router.get_providers().await {
                let url = p.url.clone();
                let payload = serde_json::json!({"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1});
                let start = Instant::now();
                match self.client.post(&url).json(&payload).send().await {
                    Ok(r) if r.status().is_success() => { self.router.mark_healthy(&url, start.elapsed().as_millis() as u64).await; }
                    Ok(r) => { warn!(url=%url,status=%r.status(),"health check failed"); self.router.mark_unhealthy(&url).await; }
                    Err(e) => { warn!(url=%url,error=%e,"health check error"); self.router.mark_unhealthy(&url).await; }
                }
            }
        }
    }
}

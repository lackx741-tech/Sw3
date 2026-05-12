use anyhow::{anyhow, Result};
use ethers::providers::{Http, Middleware, Provider};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

#[derive(Debug, Clone)]
pub struct ProviderHealth {
    pub url: String,
    pub healthy: bool,
    pub last_block: u64,
}

pub struct RpcClient {
    providers: Vec<Provider<Http>>,
    health: Arc<RwLock<Vec<ProviderHealth>>>,
    current: Arc<AtomicUsize>,
}

impl RpcClient {
    pub fn new(rpc_urls: &[String]) -> Result<Self> {
        let providers = rpc_urls
            .iter()
            .map(|url| Provider::<Http>::try_from(url.as_str()).map_err(|e| anyhow!("{e}")))
            .collect::<Result<Vec<_>>>()?;

        let health = rpc_urls
            .iter()
            .map(|url| ProviderHealth {
                url: url.clone(),
                healthy: true,
                last_block: 0,
            })
            .collect();

        Ok(Self {
            providers,
            health: Arc::new(RwLock::new(health)),
            current: Arc::new(AtomicUsize::new(0)),
        })
    }

    pub fn current_provider(&self) -> &Provider<Http> {
        let idx = self.current.load(Ordering::Relaxed) % self.providers.len();
        &self.providers[idx]
    }

    pub fn rotate(&self) {
        self.current.fetch_add(1, Ordering::Relaxed);
    }

    pub async fn get_block_number(&self) -> Result<u64> {
        for _ in 0..self.providers.len() {
            let provider = self.current_provider();
            match provider.get_block_number().await {
                Ok(n) => return Ok(n.as_u64()),
                Err(e) => {
                    warn!("RPC provider error, rotating: {e}");
                    self.rotate();
                }
            }
        }
        Err(anyhow!("all RPC providers failed"))
    }

    pub async fn health_check_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            for (i, provider) in self.providers.iter().enumerate() {
                let healthy = provider.get_block_number().await.is_ok();
                let mut guard = self.health.write().await;
                if let Some(h) = guard.get_mut(i) {
                    if h.healthy != healthy {
                        if healthy {
                            info!(index = i, url = %h.url, "RPC provider recovered");
                        } else {
                            error!(index = i, url = %h.url, "RPC provider unhealthy");
                        }
                        h.healthy = healthy;
                    }
                }
            }
        }
    }
}

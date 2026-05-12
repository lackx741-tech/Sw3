use crate::decoder::TxDecoder;
use crate::filter::TxFilter;
use anyhow::Result;
use ethers::providers::{Middleware, Provider, Ws};
use futures::StreamExt;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use tracing::{error, info, warn};

pub struct MempoolListener {
    provider: Provider<Ws>,
    redis: ConnectionManager,
    filter: TxFilter,
    decoder: TxDecoder,
}

impl MempoolListener {
    pub async fn new(
        ws_url: String,
        redis: ConnectionManager,
        filter: TxFilter,
        decoder: TxDecoder,
    ) -> Result<Self> {
        let provider = Provider::<Ws>::connect(&ws_url).await?;
        info!(url = %ws_url, "connected to WebSocket RPC");
        Ok(Self { provider, redis, filter, decoder })
    }

    pub async fn run(mut self) -> Result<()> {
        let mut stream = self.provider.subscribe_pending_txs().await?;
        info!("subscribed to pending transactions");

        while let Some(tx_hash) = stream.next().await {
            match self.provider.get_transaction(tx_hash).await {
                Ok(Some(tx)) => {
                    if self.filter.is_relevant(&tx) {
                        let decoded = self.decoder.decode(&tx);
                        let payload = serde_json::json!({
                            "hash": format!("{:?}", tx_hash),
                            "from": format!("{:?}", tx.from),
                            "to": tx.to.map(|a| format!("{a:?}")),
                            "decoded": decoded,
                        });
                        if let Ok(json) = serde_json::to_string(&payload) {
                            let mut redis = self.redis.clone();
                            if let Err(e) = redis
                                .publish::<_, _, ()>("mempool:relevant_txs", &json)
                                .await
                            {
                                error!("redis publish error: {e}");
                            }
                        }
                    }
                }
                Ok(None) => {}
                Err(e) => warn!("failed to fetch tx {tx_hash:?}: {e}"),
            }
        }

        Ok(())
    }
}

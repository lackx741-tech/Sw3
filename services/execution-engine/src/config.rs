use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub rpc_urls: Vec<String>,
    pub chain_id: u64,
    pub sweeper_contract: String,
    pub private_key_env: String,
    pub max_batch_size: usize,
    pub gas_multiplier: f64,
    pub confirmation_blocks: u64,
    pub server_host: String,
    pub server_port: u16,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let cfg = config::Config::builder()
            .add_source(config::Environment::default().separator("__"))
            .set_default("server_host", "0.0.0.0")?
            .set_default("server_port", 8080)?
            .set_default("max_batch_size", 50)?
            .set_default("gas_multiplier", 1.2)?
            .set_default("confirmation_blocks", 2)?
            .set_default("chain_id", 1)?
            .set_default("private_key_env", "SWEEPER_PRIVATE_KEY")?
            .set_default("sweeper_contract", "0x0000000000000000000000000000000000000000")?
            .build()?;
        Ok(cfg.try_deserialize()?)
    }
}

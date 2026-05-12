pub mod migrations;

use anyhow::Result;
use sqlx::PgPool;

pub async fn create_pool(database_url: &str) -> Result<PgPool> {
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .connect(database_url)
        .await?;
    Ok(pool)
}

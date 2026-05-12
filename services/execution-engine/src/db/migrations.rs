use sqlx::PgPool;
use anyhow::Result;

pub async fn run(pool: &PgPool) -> Result<()> {
    sqlx::migrate!("src/db/migrations").run(pool).await?;
    Ok(())
}

CREATE TABLE IF NOT EXISTS analytics_events
(
    event_type String,
    address Nullable(String),
    chain_id Nullable(UInt64),
    data_json String,
    correlation_id Nullable(String),
    created_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree
ORDER BY (event_type, created_at)
TTL created_at + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

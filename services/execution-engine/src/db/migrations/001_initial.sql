CREATE TYPE sweep_status AS ENUM (
    'pending',
    'batched',
    'submitted',
    'confirmed',
    'failed'
);

CREATE TYPE batch_status AS ENUM (
    'building',
    'submitted',
    'confirmed',
    'failed'
);

CREATE TABLE IF NOT EXISTS sweep_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner         TEXT NOT NULL,
    token         TEXT NOT NULL,
    amount        TEXT NOT NULL,
    recipient     TEXT NOT NULL,
    status        sweep_status NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tx_hash       TEXT
);

CREATE INDEX idx_sweep_jobs_status ON sweep_jobs(status);
CREATE INDEX idx_sweep_jobs_owner ON sweep_jobs(owner);
CREATE INDEX idx_sweep_jobs_token ON sweep_jobs(token);

CREATE TABLE IF NOT EXISTS batch_jobs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sweep_ids          JSONB NOT NULL DEFAULT '[]',
    status             batch_status NOT NULL DEFAULT 'building',
    gas_estimate       BIGINT,
    submitted_tx_hash  TEXT,
    block_number       BIGINT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);

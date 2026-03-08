export PGPASSWORD=Henl6DY7wVf3sddxWpIaF2P455FFUZQH
psql -h 172.16.16.80 -U medusa -d dev_db <<EOF
CREATE TABLE IF NOT EXISTS tr_province (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plate_code INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS tr_district (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    province_id TEXT REFERENCES tr_province(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS tr_neighborhood (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    postal_code TEXT,
    district_id TEXT REFERENCES tr_district(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
EOF

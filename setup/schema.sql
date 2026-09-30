CREATE TABLE IF NOT EXISTS requests (
 id TEXT PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
 region TEXT NOT NULL, building TEXT NOT NULL DEFAULT '', scope TEXT NOT NULL DEFAULT '',
 detail TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', landing TEXT NOT NULL DEFAULT '',
 device TEXT NOT NULL DEFAULT '', consent INTEGER NOT NULL, consent_version TEXT NOT NULL,
 sheets_synced_at TEXT
);

-- Bi Mola menu – basisschema.
-- Bedragen in kuruş (integer): 180 TL = 18000. Nooit floats voor geld.
-- Elke rij heeft een version (optimistic locking) en items/categorieën een
-- deleted_at (prullenbak in plaats van echt verwijderen).

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  note        TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  position    INTEGER NOT NULL,
  visible     INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  version     INTEGER NOT NULL DEFAULT 1,
  deleted_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX categories_live ON categories (position) WHERE deleted_at IS NULL;

CREATE TABLE items (
  id           INTEGER PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories (id),
  name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description  TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  price        INTEGER CHECK (price IS NULL OR price >= 0),
  price_small  INTEGER CHECK (price_small IS NULL OR price_small >= 0),
  price_large  INTEGER CHECK (price_large IS NULL OR price_large >= 0),
  available    INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  tags         TEXT NOT NULL DEFAULT '[]',
  allergens    TEXT NOT NULL DEFAULT '[]',
  position     INTEGER NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  deleted_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX items_live ON items (category_id, position) WHERE deleted_at IS NULL;

-- Wie heeft wat wanneer gewijzigd; before/after als JSON maken "terugdraaien" mogelijk.
CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY,
  at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  entity       TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  summary      TEXT NOT NULL DEFAULT '',
  before_json  TEXT,
  after_json   TEXT,
  reverted_by  INTEGER REFERENCES audit_log (id)
);
CREATE INDEX audit_log_at ON audit_log (id DESC);

-- Alleen voor lokaal ontwikkelen/testen: witte lijst zonder Cloudflare API.
-- In productie staat de witte lijst in de Cloudflare Access-groep.
CREATE TABLE dev_admin_emails (
  email     TEXT PRIMARY KEY,
  added_by  TEXT NOT NULL,
  added_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  membership_type TEXT NOT NULL DEFAULT 'none',
  membership_expire_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  original_price INTEGER CHECK (original_price IS NULL OR original_price >= price),
  currency TEXT NOT NULL DEFAULT 'CNY',
  cover_image TEXT,
  preview_images TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  device_types TEXT NOT NULL DEFAULT '[]',
  aspect_ratios TEXT NOT NULL DEFAULT '[]',
  resolutions TEXT NOT NULL DEFAULT '[]',
  file_format TEXT NOT NULL,
  file_size TEXT,
  wallpaper_count INTEGER NOT NULL DEFAULT 1,
  license_type TEXT NOT NULL DEFAULT 'personal',
  license_summary TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 0,
  product_type TEXT NOT NULL DEFAULT 'wallpaper_pack',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_files (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT NOT NULL,
  resolution TEXT,
  aspect_ratio TEXT,
  device_type TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  product_price_snapshot INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_provider TEXT NOT NULL,
  payment_transaction_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  canceled_at TEXT,
  refunded_at TEXT,
  expired_at TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  downloaded_at TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 1,
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  membership_type TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  order_id TEXT REFERENCES orders(id),
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS products_published_idx ON products(is_published, created_at);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases(user_id, created_at);
CREATE INDEX IF NOT EXISTS downloads_user_product_idx ON downloads(user_id, product_id);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);


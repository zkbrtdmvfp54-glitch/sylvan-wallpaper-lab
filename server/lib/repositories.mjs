import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.mjs';

const jsonFields = ['previewImages', 'tags', 'deviceTypes', 'aspectRatios', 'resolutions'];

function parseJson(value, fallback = []) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapProduct(row) {
  if (!row) return null;
  const product = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    price: row.price,
    originalPrice: row.original_price,
    currency: row.currency,
    coverImage: row.cover_image,
    previewImages: row.preview_images,
    category: row.category,
    tags: row.tags,
    deviceTypes: row.device_types,
    aspectRatios: row.aspect_ratios,
    resolutions: row.resolutions,
    fileFormat: row.file_format,
    fileSize: row.file_size,
    wallpaperCount: row.wallpaper_count,
    licenseType: row.license_type,
    licenseSummary: row.license_summary,
    isPublished: Boolean(row.is_published),
    isFeatured: Boolean(row.is_featured),
    isNew: Boolean(row.is_new),
    productType: row.product_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  for (const field of jsonFields) product[field] = parseJson(product[field]);
  return product;
}

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    productId: row.product_id,
    productNameSnapshot: row.product_name_snapshot,
    productPriceSnapshot: row.product_price_snapshot,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paymentProvider: row.payment_provider,
    paymentTransactionId: row.payment_transaction_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    canceledAt: row.canceled_at,
    refundedAt: row.refunded_at,
    expiredAt: row.expired_at,
  };
}

export function listProducts({ category = 'all', sort = 'latest' } = {}) {
  const database = getDatabase();
  const conditions = ['is_published = 1'];
  const values = [];
  if (category !== 'all') {
    conditions.push('category = ?');
    values.push(category);
  }
  const orderBy = {
    latest: 'created_at DESC',
    popular: 'is_featured DESC, created_at DESC',
    priceAsc: 'price ASC',
    priceDesc: 'price DESC',
  }[sort] || 'created_at DESC';
  const statement = database.prepare(
    `SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`,
  );
  return statement.all(...values).map(mapProduct);
}

export function getProductBySlug(slug) {
  return mapProduct(
    getDatabase().prepare('SELECT * FROM products WHERE slug = ? AND is_published = 1').get(slug),
  );
}

export function getProductById(id) {
  return mapProduct(
    getDatabase().prepare('SELECT * FROM products WHERE id = ?').get(id),
  );
}

export function getProductFile(productId) {
  return getDatabase()
    .prepare('SELECT * FROM product_files WHERE product_id = ? ORDER BY created_at LIMIT 1')
    .get(productId);
}

export function upsertUserByEmail(email) {
  const database = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();
  let user = database.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    database
      .prepare(
        `INSERT INTO users
        (id, email, name, role, membership_type, created_at, updated_at)
        VALUES (?, ?, ?, 'user', 'none', ?, ?)`,
      )
      .run(randomUUID(), normalizedEmail, normalizedEmail.split('@')[0], now, now);
    user = database.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  }
  return user;
}

export function createOrder({ orderNumber, userId, product, provider = 'mock' }) {
  const database = getDatabase();
  const existingPurchase = database
    .prepare('SELECT * FROM purchases WHERE user_id = ? AND product_id = ?')
    .get(userId, product.id);
  if (existingPurchase) return { alreadyPurchased: true, purchase: existingPurchase };

  const existingPending = database
    .prepare(
      `SELECT * FROM orders
       WHERE user_id = ? AND product_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(userId, product.id);
  if (existingPending) return { alreadyPurchased: false, order: mapOrder(existingPending), reused: true };

  const now = new Date().toISOString();
  const orderId = randomUUID();
  database
    .prepare(
      `INSERT INTO orders (
        id, order_number, user_id, product_id, product_name_snapshot,
        product_price_snapshot, amount, currency, status, payment_provider, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .run(
      orderId,
      orderNumber,
      userId,
      product.id,
      product.title,
      product.price,
      product.price,
      product.currency,
      provider,
      now,
    );
  return { alreadyPurchased: false, order: getOrderByNumber(orderNumber), reused: false };
}

export function getOrderByNumber(orderNumber) {
  return mapOrder(
    getDatabase().prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber),
  );
}

export function getOrderForUser(orderNumber, userId) {
  return mapOrder(
    getDatabase()
      .prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?')
      .get(orderNumber, userId),
  );
}

export function listOrdersByUser(userId) {
  return getDatabase()
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map(mapOrder);
}

export function completeOrder({ orderNumber, userId, transactionId, eventId }) {
  const database = getDatabase();
  const orderRow = database
    .prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?')
    .get(orderNumber, userId);
  if (!orderRow) return null;
  if (orderRow.status === 'paid') return mapOrder(orderRow);
  if (orderRow.status !== 'pending') throw new Error('ORDER_NOT_PAYABLE');

  const product = getProductById(orderRow.product_id);
  if (!product || orderRow.amount !== product.price) throw new Error('ORDER_AMOUNT_MISMATCH');

  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    database
      .prepare(
        `INSERT OR IGNORE INTO payment_events
        (id, provider, provider_event_id, order_id, event_type, payload, processed_at)
        VALUES (?, 'mock', ?, ?, 'payment.succeeded', ?, ?)`,
      )
      .run(randomUUID(), eventId, orderRow.id, JSON.stringify({ orderNumber, transactionId }), now);
    database
      .prepare(
        `UPDATE orders SET status = 'paid', payment_transaction_id = ?, paid_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(transactionId, now, orderRow.id);
    database
      .prepare(
        `INSERT OR IGNORE INTO purchases (id, user_id, product_id, order_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), userId, orderRow.product_id, orderRow.id, now);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return getOrderByNumber(orderNumber);
}

export function cancelOrder(orderNumber, userId) {
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE orders SET status = 'canceled', canceled_at = ?
       WHERE order_number = ? AND user_id = ? AND status = 'pending'`,
    )
    .run(now, orderNumber, userId);
  return getOrderForUser(orderNumber, userId);
}

export function failOrder(orderNumber, userId) {
  getDatabase()
    .prepare(
      `UPDATE orders SET status = 'failed'
       WHERE order_number = ? AND user_id = ? AND status = 'pending'`,
    )
    .run(orderNumber, userId);
  return getOrderForUser(orderNumber, userId);
}

export function hasPurchase(userId, productId) {
  return Boolean(
    getDatabase()
      .prepare('SELECT id FROM purchases WHERE user_id = ? AND product_id = ?')
      .get(userId, productId),
  );
}

export function listPurchasesByUser(userId) {
  const rows = getDatabase()
    .prepare(
      `SELECT purchases.*, products.slug, products.title, products.subtitle,
              products.wallpaper_count, orders.order_number
       FROM purchases
       JOIN products ON products.id = purchases.product_id
       JOIN orders ON orders.id = purchases.order_id
       WHERE purchases.user_id = ?
       ORDER BY purchases.created_at DESC`,
    )
    .all(userId);
  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    wallpaperCount: row.wallpaper_count,
    orderNumber: row.order_number,
    createdAt: row.created_at,
  }));
}

export function listDownloadsByUser(userId) {
  return getDatabase()
    .prepare(
      `SELECT downloads.*, products.title
       FROM downloads
       JOIN products ON products.id = downloads.product_id
       WHERE downloads.user_id = ?
       ORDER BY downloads.downloaded_at DESC`,
    )
    .all(userId)
    .map((row) => ({
      id: row.id,
      productId: row.product_id,
      productTitle: row.title,
      downloadedAt: row.downloaded_at,
      downloadCount: row.download_count,
    }));
}

export function recordDownload({ userId, productId, orderId, ip, userAgent }) {
  const database = getDatabase();
  const existing = database
    .prepare(
      'SELECT * FROM downloads WHERE user_id = ? AND product_id = ? AND order_id = ?',
    )
    .get(userId, productId, orderId);
  const now = new Date().toISOString();
  if (existing) {
    database
      .prepare(
        `UPDATE downloads SET download_count = download_count + 1, downloaded_at = ?,
         ip = ?, user_agent = ? WHERE id = ?`,
      )
      .run(now, ip, userAgent, existing.id);
    return existing.download_count + 1;
  }
  database
    .prepare(
      `INSERT INTO downloads
      (id, user_id, product_id, order_id, downloaded_at, download_count, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(randomUUID(), userId, productId, orderId, now, ip, userAgent);
  return 1;
}

export function getPaidOrderForProduct(userId, productId) {
  return getDatabase()
    .prepare(
      `SELECT orders.* FROM purchases
       JOIN orders ON orders.id = purchases.order_id
       WHERE purchases.user_id = ? AND purchases.product_id = ? AND orders.status = 'paid'
       LIMIT 1`,
    )
    .get(userId, productId);
}

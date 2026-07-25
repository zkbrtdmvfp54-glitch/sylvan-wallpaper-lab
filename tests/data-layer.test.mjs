import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'sylvan-premium-'));
process.env.DATABASE_PATH = join(temporaryDirectory, 'test.db');

const repository = await import('../server/lib/repositories.mjs');
const { closeDatabase } = await import('../server/lib/database.mjs');

test('seeds the original test product at ¥19.9', () => {
  const product = repository.getProductBySlug('sylvan-drop-01');
  assert.equal(product.title, 'SYLVAN DROP 01');
  assert.equal(product.price, 1990);
  assert.equal(product.currency, 'CNY');
  assert.equal(product.status, 'test');
  assert.equal(product.previewImages.length, 0);
});

test('creates an order from the server-side product price', () => {
  const user = repository.upsertUserByEmail('buyer@example.com');
  const product = repository.getProductBySlug('sylvan-drop-01');
  const result = repository.createOrder({
    orderNumber: 'SYL-TEST-0001',
    userId: user.id,
    product,
  });
  assert.equal(result.order.amount, 1990);
  assert.equal(result.order.status, 'pending');
});

test('mock completion is idempotent and grants one purchase', () => {
  const user = repository.upsertUserByEmail('buyer@example.com');
  const first = repository.completeOrder({
    orderNumber: 'SYL-TEST-0001',
    userId: user.id,
    transactionId: 'mock_tx_1',
    eventId: 'mock_event_1',
  });
  const second = repository.completeOrder({
    orderNumber: 'SYL-TEST-0001',
    userId: user.id,
    transactionId: 'mock_tx_1',
    eventId: 'mock_event_1',
  });
  assert.equal(first.status, 'paid');
  assert.equal(second.status, 'paid');
  assert.equal(repository.listPurchasesByUser(user.id).length, 1);
});

test.after(() => {
  closeDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

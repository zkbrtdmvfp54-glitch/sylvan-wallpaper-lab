import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'sylvan-flow-'));
process.env.DATABASE_PATH = join(temporaryDirectory, 'test.db');
process.env.AUTH_SECRET = 'flow-test-secret-with-enough-entropy';
process.env.APP_ENV = 'development';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.PORT = '0';

const { server } = await import('../server/dev-server.mjs');
if (!server.listening) await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const { closeDatabase } = await import('../server/lib/database.mjs');

async function jsonRequest(path, { body, cookie, method = 'GET' } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json', Origin: baseUrl } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : await response.text();
  return { response, payload };
}

test('authenticated mock purchase protects price and download delivery', async () => {
  const issued = await jsonRequest('/api/auth/request-code', {
    method: 'POST',
    body: { email: 'flow@example.com' },
  });
  assert.equal(issued.response.status, 200);
  assert.match(issued.payload.devCode, /^\d{6}$/);

  const verified = await jsonRequest('/api/auth/verify-code', {
    method: 'POST',
    body: { email: 'flow@example.com', code: issued.payload.devCode },
  });
  assert.equal(verified.response.status, 200);
  const cookie = verified.response.headers.get('set-cookie').split(';')[0];

  const created = await jsonRequest('/api/orders', {
    method: 'POST',
    cookie,
    body: { productId: 'prod_sylvan_drop_01', price: 1, amount: 1 },
  });
  assert.equal(created.response.status, 200);
  assert.equal(created.payload.order.amount, 1990);
  assert.equal(created.payload.payment.provider, 'mock');

  const denied = await jsonRequest('/api/downloads/prod_sylvan_drop_01', { cookie });
  assert.equal(denied.response.status, 403);

  const completed = await jsonRequest('/api/payments/mock/success', {
    method: 'POST',
    cookie,
    body: { orderNumber: created.payload.order.orderNumber },
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.payload.order.status, 'paid');

  const download = await jsonRequest('/api/downloads/prod_sylvan_drop_01', { cookie });
  assert.equal(download.response.status, 200);
  assert.match(download.response.headers.get('content-disposition'), /attachment/);
  assert.match(download.payload, /PROTECTED TEST PACKAGE/);
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  closeDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});


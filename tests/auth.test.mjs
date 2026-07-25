import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'sylvan-auth-'));
process.env.DATABASE_PATH = join(temporaryDirectory, 'test.db');
process.env.AUTH_SECRET = 'test-secret-with-enough-entropy';

const auth = await import('../server/lib/auth.mjs');
const { closeDatabase } = await import('../server/lib/database.mjs');

test('email code creates an opaque server-side session and is single use', () => {
  const issued = auth.issueAuthCode('  TEST@example.com ');
  assert.match(issued.code, /^\d{6}$/);
  const verified = auth.verifyAuthCode('test@example.com', issued.code);
  assert.equal(verified.user.email, 'test@example.com');
  assert.ok(verified.token.length >= 40);

  const request = { headers: { cookie: `sylvan_session=${verified.token}` } };
  assert.equal(auth.getSessionUser(request).email, 'test@example.com');
  assert.throws(() => auth.verifyAuthCode('test@example.com', issued.code), /CODE_EXPIRED/);
});

test('invalid code does not create a session', () => {
  auth.issueAuthCode('other@example.com');
  assert.throws(() => auth.verifyAuthCode('other@example.com', '000000'), /INVALID_CODE/);
});

test.after(() => {
  closeDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});


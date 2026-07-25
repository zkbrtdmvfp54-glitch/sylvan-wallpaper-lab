import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.mjs';
import {
  createNumericCode,
  createSessionToken,
  hashAuthCode,
  hashSessionToken,
  normalizeEmail,
  parseCookies,
  safeHexEqual,
} from './security.mjs';
import { upsertUserByEmail } from './repositories.mjs';

const codeLifetimeMs = 10 * 60 * 1000;
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export function issueAuthCode(rawEmail) {
  const database = getDatabase();
  const email = normalizeEmail(rawEmail);
  const code = createNumericCode();
  const now = new Date();
  database
    .prepare(
      `INSERT INTO auth_codes (email, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(email) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         created_at = excluded.created_at`,
    )
    .run(email, hashAuthCode(email, code), new Date(now.getTime() + codeLifetimeMs).toISOString(), now.toISOString());
  return { email, code, expiresInSeconds: codeLifetimeMs / 1000 };
}

export function verifyAuthCode(rawEmail, rawCode) {
  const database = getDatabase();
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode || '').trim();
  if (!/^\d{6}$/.test(code)) throw new Error('INVALID_CODE');
  const record = database.prepare('SELECT * FROM auth_codes WHERE email = ?').get(email);
  if (!record || new Date(record.expires_at).getTime() <= Date.now()) throw new Error('CODE_EXPIRED');
  if (record.attempts >= 5) throw new Error('CODE_ATTEMPTS_EXCEEDED');
  if (!safeHexEqual(record.code_hash, hashAuthCode(email, code))) {
    database.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE email = ?').run(email);
    throw new Error('INVALID_CODE');
  }
  database.prepare('DELETE FROM auth_codes WHERE email = ?').run(email);
  const user = upsertUserByEmail(email);
  const token = createSessionToken();
  const now = new Date();
  database
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      user.id,
      hashSessionToken(token),
      new Date(now.getTime() + sessionLifetimeMs).toISOString(),
      now.toISOString(),
    );
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, membershipType: user.membership_type },
  };
}

export function getSessionUser(request) {
  const token = parseCookies(request.headers.cookie).sylvan_session;
  if (!token) return null;
  const database = getDatabase();
  const session = database
    .prepare(
      `SELECT sessions.id AS session_id, sessions.expires_at, users.*
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .get(hashSessionToken(token));
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    database.prepare('DELETE FROM sessions WHERE id = ?').run(session.session_id);
    return null;
  }
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    membershipType: session.membership_type,
    membershipExpireAt: session.membership_expire_at,
  };
}

export function destroySession(request) {
  const token = parseCookies(request.headers.cookie).sylvan_session;
  if (token) getDatabase().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
}


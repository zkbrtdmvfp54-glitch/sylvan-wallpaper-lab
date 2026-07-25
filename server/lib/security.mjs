import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const authSecret = process.env.AUTH_SECRET || 'local-development-only-change-me';

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('INVALID_EMAIL');
  }
  return email;
}

export function createNumericCode() {
  return String(Number.parseInt(randomBytes(4).toString('hex'), 16) % 1_000_000).padStart(6, '0');
}

export function hashAuthCode(email, code) {
  return createHmac('sha256', authSecret).update(`${email}:${code}`).digest('hex');
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function safeHexEqual(left, right) {
  const leftBuffer = Buffer.from(String(left), 'hex');
  const rightBuffer = Buffer.from(String(right), 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return [
          decodeURIComponent(separator >= 0 ? part.slice(0, separator) : part),
          decodeURIComponent(separator >= 0 ? part.slice(separator + 1) : ''),
        ];
      }),
  );
}

export function sessionCookie(token, { clear = false } = {}) {
  const secure = process.env.APP_ENV === 'production' ? '; Secure' : '';
  const maxAge = clear ? 0 : 60 * 60 * 24 * 30;
  return `sylvan_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}


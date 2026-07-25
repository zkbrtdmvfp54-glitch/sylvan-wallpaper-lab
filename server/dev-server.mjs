import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { destroySession, getSessionUser, issueAuthCode, verifyAuthCode } from './lib/auth.mjs';
import { clientIp, readJson, requestOriginAllowed, sendJson, statusLabel } from './lib/http.mjs';
import {
  createOrder,
  getOrderForUser,
  getPaidOrderForProduct,
  getProductById,
  getProductBySlug,
  hasPurchase,
  listDownloadsByUser,
  listOrdersByUser,
  listProducts,
  listPurchasesByUser,
  recordDownload,
} from './lib/repositories.mjs';
import { sessionCookie } from './lib/security.mjs';
import { getPaymentProvider } from './payments/index.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const paymentProvider = process.env.PAYMENT_PROVIDER || 'mock';
const paymentAdapter = getPaymentProvider(paymentProvider);
const authRateLimits = new Map();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function publicFileFor(pathname) {
  const routeMap = new Map([
    ['/', 'index.html'],
    ['/premium/', 'premium/index.html'],
    ['/premium/sylvan-drop-01/', 'premium/sylvan-drop-01/index.html'],
    ['/login/', 'login/index.html'],
    ['/account/', 'account/index.html'],
    ['/payment/mock/', 'payment/mock/index.html'],
    ['/payment/success/', 'payment/success/index.html'],
    ['/payment/cancel/', 'payment/cancel/index.html'],
    ['/legal/', 'legal/index.html'],
    ['/robots.txt', 'robots.txt'],
    ['/sitemap.xml', 'sitemap.xml'],
  ]);
  if (routeMap.has(pathname)) return routeMap.get(pathname);
  if (pathname.startsWith('/assets/')) return pathname.slice(1);
  return null;
}

function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
}

async function sendStatic(response, relativePath) {
  const absolutePath = resolve(projectRoot, relativePath);
  if (!absolutePath.startsWith(`${projectRoot}${sep}`) && absolutePath !== projectRoot) {
    sendJson(response, 403, { message: '禁止访问该路径' });
    return;
  }
  try {
    const content = await readFile(absolutePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(absolutePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': content.length,
      'Cache-Control': relativePath.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { message: '页面或资源不存在' });
  }
}

function authUserOrReject(request, response) {
  const user = getSessionUser(request);
  if (!user) sendJson(response, 401, { code: 'AUTH_REQUIRED', message: '请先登录' });
  return user;
}

function orderView(order) {
  return {
    ...order,
    productTitle: order.productNameSnapshot,
    statusLabel: statusLabel(order.status),
  };
}

function rateLimitAuth(request, email) {
  const key = `${clientIp(request)}:${String(email || '').toLowerCase()}`;
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recent = (authRateLimits.get(key) || []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= 8) return false;
  recent.push(now);
  authRateLimits.set(key, recent);
  return true;
}

function createOrderNumber() {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `SYL${stamp}${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/products') {
    const sortMap = { newest: 'latest', popular: 'popular', 'price-asc': 'priceAsc', 'price-desc': 'priceDesc' };
    sendJson(response, 200, {
      products: listProducts({
        category: url.searchParams.get('category') || 'all',
        sort: sortMap[url.searchParams.get('sort')] || 'latest',
      }),
    });
    return true;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/products/')) {
    const product = getProductBySlug(decodeURIComponent(url.pathname.slice('/api/products/'.length)));
    if (!product) sendJson(response, 404, { code: 'PRODUCT_NOT_FOUND', message: '商品不存在或已下架' });
    else sendJson(response, 200, { product });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/session') {
    const user = getSessionUser(request);
    const productId = url.searchParams.get('productId');
    sendJson(response, 200, {
      user,
      purchased: Boolean(user && productId && hasPurchase(user.id, productId)),
    });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/request-code') {
    const body = await readJson(request);
    if (!rateLimitAuth(request, body.email)) {
      sendJson(response, 429, { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' });
      return true;
    }
    const issued = issueAuthCode(body.email);
    sendJson(response, 200, {
      email: issued.email,
      expiresInSeconds: issued.expiresInSeconds,
      ...(process.env.APP_ENV === 'production' ? {} : { devCode: issued.code }),
    });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/verify-code') {
    const body = await readJson(request);
    const result = verifyAuthCode(body.email, body.code);
    sendJson(response, 200, { user: result.user }, { 'Set-Cookie': sessionCookie(result.token) });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    destroySession(request);
    sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', { clear: true }) });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/account') {
    const user = authUserOrReject(request, response);
    if (!user) return true;
    sendJson(response, 200, {
      user,
      purchases: listPurchasesByUser(user.id).map((purchase) => ({
        ...purchase,
        productTitle: purchase.title,
        purchasedAt: purchase.createdAt,
      })),
      orders: listOrdersByUser(user.id).map(orderView),
      downloads: listDownloadsByUser(user.id),
      membership: {
        type: user.membershipType,
        expiresAt: user.membershipExpireAt,
        label: user.membershipType === 'none' ? '普通用户' : user.membershipType,
      },
    });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const user = authUserOrReject(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const product = getProductById(String(body.productId || ''));
    if (!product || !product.isPublished) {
      sendJson(response, 404, { code: 'PRODUCT_NOT_FOUND', message: '商品不存在或已下架' });
      return true;
    }
    const result = createOrder({
      orderNumber: createOrderNumber(),
      userId: user.id,
      product,
      provider: paymentProvider,
    });
    const payment = result.order ? paymentAdapter.createPayment({ order: result.order }) : null;
    sendJson(response, 200, {
      alreadyPurchased: result.alreadyPurchased,
      order: result.order ? orderView(result.order) : null,
      reused: Boolean(result.reused),
      payment,
    });
    return true;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/orders/')) {
    const user = authUserOrReject(request, response);
    if (!user) return true;
    const order = getOrderForUser(decodeURIComponent(url.pathname.slice('/api/orders/'.length)), user.id);
    if (!order) sendJson(response, 404, { code: 'ORDER_NOT_FOUND', message: '订单不存在' });
    else sendJson(response, 200, { order: orderView(order) });
    return true;
  }

  const mockMatch = url.pathname.match(/^\/api\/payments\/mock\/(success|failure|cancel)$/);
  if (request.method === 'POST' && mockMatch) {
    const user = authUserOrReject(request, response);
    if (!user) return true;
    if (paymentProvider !== 'mock') {
      sendJson(response, 409, { code: 'PAYMENT_PROVIDER_MISMATCH', message: '当前未启用 mock 支付' });
      return true;
    }
    const body = await readJson(request);
    const order = getOrderForUser(String(body.orderNumber || ''), user.id);
    if (!order) {
      sendJson(response, 404, { code: 'ORDER_NOT_FOUND', message: '订单不存在' });
      return true;
    }
    const updatedOrder = paymentAdapter.settle({ action: mockMatch[1], order, userId: user.id });
    sendJson(response, 200, { order: orderView(updatedOrder) });
    return true;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/downloads/')) {
    const user = authUserOrReject(request, response);
    if (!user) return true;
    const productId = decodeURIComponent(url.pathname.slice('/api/downloads/'.length));
    const product = getProductById(productId);
    const paidOrder = getPaidOrderForProduct(user.id, productId);
    if (!product || !paidOrder) {
      sendJson(response, 403, { code: 'PURCHASE_REQUIRED', message: '尚未获得该商品的下载权限' });
      return true;
    }
    recordDownload({
      userId: user.id,
      productId,
      orderId: paidOrder.id,
      ip: clientIp(request),
      userAgent: String(request.headers['user-agent'] || '').slice(0, 300),
    });
    const body = [
      'SYLVAN WALLPAPER LAB — PROTECTED TEST PACKAGE',
      `Product: ${product.title}`,
      `Order: ${paidOrder.order_number}`,
      'This is an authenticated MVP delivery placeholder.',
      'No third-party character artwork or public premium file URL is included.',
    ].join('\n');
    response.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${product.slug}-test-package.txt"`,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'private, no-store',
    });
    response.end(body);
    return true;
  }

  return false;
}

export const server = createServer(async (request, response) => {
  securityHeaders(response);
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'GET' && !requestOriginAllowed(request)) {
        sendJson(response, 403, { code: 'INVALID_ORIGIN', message: '请求来源无效' });
        return;
      }
      if (await handleApi(request, response, url)) return;
      sendJson(response, 404, { message: '接口不存在' });
      return;
    }
    const publicFile = request.method === 'GET' ? publicFileFor(url.pathname) : null;
    if (publicFile) {
      await sendStatic(response, publicFile);
      return;
    }
    sendJson(response, 404, { message: '页面不存在' });
  } catch (error) {
    const known = {
      INVALID_EMAIL: [400, '邮箱格式不正确'],
      INVALID_CODE: [400, '验证码不正确'],
      CODE_EXPIRED: [400, '验证码已失效，请重新获取'],
      CODE_ATTEMPTS_EXCEEDED: [429, '验证码尝试次数过多，请重新获取'],
      INVALID_JSON: [400, '请求内容格式不正确'],
      PAYLOAD_TOO_LARGE: [413, '请求内容过大'],
      ORDER_NOT_PAYABLE: [409, '当前订单状态无法支付'],
      ORDER_AMOUNT_MISMATCH: [409, '订单金额校验失败'],
    }[error.message];
    if (known) sendJson(response, known[0], { code: error.message, message: known[1] });
    else {
      console.error(error);
      sendJson(response, 500, { code: 'INTERNAL_ERROR', message: '服务暂时无法完成请求' });
    }
  }
});

server.listen(port, host, () => {
  console.log(`SYLVAN dev server running at http://${host}:${port}`);
  console.log(`Payment provider: ${paymentProvider}`);
});

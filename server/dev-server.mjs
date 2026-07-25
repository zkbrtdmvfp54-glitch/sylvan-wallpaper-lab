import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getProductBySlug, hasPurchase, listProducts } from './lib/repositories.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

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

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

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
  ]);
  if (routeMap.has(pathname)) return routeMap.get(pathname);
  if (pathname.startsWith('/assets/')) return pathname.slice(1);
  return null;
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/api/products') {
    const sortMap = { newest: 'latest', 'price-asc': 'priceAsc', 'price-desc': 'priceDesc' };
    sendJson(response, 200, {
      products: listProducts({
        category: url.searchParams.get('category') || 'all',
        sort: sortMap[url.searchParams.get('sort')] || 'latest',
      }),
    });
    return;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/api/products/')) {
    const product = getProductBySlug(decodeURIComponent(url.pathname.slice('/api/products/'.length)));
    if (!product) {
      sendJson(response, 404, { message: '商品不存在' });
      return;
    }
    sendJson(response, 200, { product });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/session') {
    const productId = url.searchParams.get('productId');
    const user = null;
    sendJson(response, 200, {
      user,
      purchased: Boolean(user && productId && hasPurchase(user.id, productId)),
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/account') {
    sendJson(response, 401, { code: 'AUTH_REQUIRED', message: '请先登录' });
    return;
  }
  const publicFile = request.method === 'GET' ? publicFileFor(url.pathname) : null;
  if (publicFile) {
    await sendStatic(response, publicFile);
    return;
  }
  sendJson(response, 404, { message: '接口或页面不存在' });
});

server.listen(port, host, () => {
  console.log(`SYLVAN dev server running at http://${host}:${port}`);
});

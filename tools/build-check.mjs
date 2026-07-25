import { accessSync, constants, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'index.html',
  'premium/index.html',
  'premium/sylvan-drop-01/index.html',
  'login/index.html',
  'account/index.html',
  'payment/mock/index.html',
  'payment/success/index.html',
  'payment/cancel/index.html',
  'legal/index.html',
  'assets/css/style.css',
  'assets/css/premium.css',
  'assets/js/wallpapers-data.js',
  'server/dev-server.mjs',
  'db/schema.sql',
  'db/seed.sql',
  'robots.txt',
  'sitemap.xml',
];

requiredFiles.forEach((file) => accessSync(resolve(root, file), constants.R_OK));
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (packageJson.private !== true) throw new Error('package.json 必须保持 private');
if (readFileSync(resolve(root, 'db/seed.sql'), 'utf8').includes('assets/wallpapers/')) {
  throw new Error('付费商品不能引用公开免费壁纸目录');
}
console.log(`Static build validation passed: ${requiredFiles.length} required files`);


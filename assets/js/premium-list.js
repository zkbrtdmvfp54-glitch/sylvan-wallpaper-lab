import { escapeHtml, formatPrice, request } from './premium-common.js';
import { trackEvent } from './analytics.js';

const grid = document.querySelector('#premiumGrid');
const filters = document.querySelectorAll('[data-premium-filter]');
const sort = document.querySelector('#premiumSort');
let currentCategory = 'all';

function renderCard(product) {
  const devices = product.deviceTypes.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  return `
    <article class="premium-card">
      <a class="premium-art" href="/premium/${encodeURIComponent(product.slug)}/" aria-label="查看 ${escapeHtml(product.title)}">
        <span class="test-badge">${product.status === 'test' ? 'TEST PRODUCT' : 'PREMIUM'}</span>
        <div class="premium-art-copy">
          <small>SYLVAN ORIGINAL / ${escapeHtml(product.category)}</small>
          <strong>${escapeHtml(product.subtitle || product.title)}</strong>
        </div>
      </a>
      <div class="premium-card-body">
        <div class="premium-card-top">
          <span class="premium-badge">${product.isNew ? 'NEW / PREMIUM' : 'PREMIUM'}</span>
          <span class="premium-label">${product.wallpaperCount} WALLPAPERS</span>
        </div>
        <h2>${escapeHtml(product.title)}</h2>
        <p class="premium-card-subtitle">${escapeHtml(product.subtitle || '')}</p>
        <div class="premium-card-meta">${devices}</div>
        <div class="premium-price-row">
          <div>
            <span class="premium-price">${formatPrice(product.price, product.currency)}</span>
            ${product.originalPrice ? `<span class="premium-original-price">${formatPrice(product.originalPrice, product.currency)}</span>` : ''}
          </div>
          <a class="premium-card-link" href="/premium/${encodeURIComponent(product.slug)}/">查看详情</a>
        </div>
      </div>
    </article>`;
}

async function loadProducts() {
  grid.innerHTML = '<div class="premium-loading">正在读取原创套装…</div>';
  try {
    const query = new URLSearchParams({ category: currentCategory, sort: sort.value });
    const payload = await request(`/api/products?${query}`);
    grid.innerHTML = payload.products.length
      ? payload.products.map(renderCard).join('')
      : '<div class="premium-empty">当前筛选条件下暂无套装。</div>';
    payload.products.forEach((product) => trackEvent('product_impression', { productId: product.id }));
    grid.querySelectorAll('.premium-card a').forEach((link) => {
      link.addEventListener('click', () => trackEvent('product_click', { href: link.getAttribute('href') }));
    });
  } catch (error) {
    grid.innerHTML = `<div class="premium-empty">${escapeHtml(error.message)}</div>`;
  }
}

filters.forEach((button) => {
  button.addEventListener('click', () => {
    currentCategory = button.dataset.premiumFilter;
    filters.forEach((item) => item.classList.toggle('active', item === button));
    loadProducts();
  });
});

sort.addEventListener('change', loadProducts);
loadProducts();

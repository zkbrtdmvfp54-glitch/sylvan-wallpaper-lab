import { escapeHtml, formatPrice, request } from './premium-common.js';

const shell = document.querySelector('#productShell');
const slug = document.body.dataset.productSlug;

function renderProduct(product, session) {
  const facts = [
    ['包含内容', `${product.wallpaperCount} 张原创壁纸`],
    ['支持设备', product.deviceTypes.join(' / ')],
    ['支持比例', product.aspectRatios.join(' / ')],
    ['分辨率', product.resolutions.join(' / ')],
    ['文件格式', product.fileFormat],
    ['文件大小', product.fileSize],
    ['更新时间', new Date(product.updatedAt).toLocaleDateString('zh-CN')],
  ];
  const buttonLabel = session.purchased ? '立即下载' : session.user ? '立即购买' : '登录后购买';
  const buttonAction = session.purchased ? 'download' : session.user ? 'purchase' : 'login';
  shell.innerHTML = `
    <div class="product-layout">
      <div class="product-preview">
        <div class="premium-art" role="img" aria-label="${escapeHtml(product.title)} 测试预览占位图">
          <span class="test-badge">TEST PREVIEW / 非最终商品图</span>
          <div class="premium-art-copy">
            <small>SYLVAN ORIGINAL WALLPAPER PACK</small>
            <strong>${escapeHtml(product.subtitle)}</strong>
          </div>
        </div>
      </div>
      <div class="product-panel">
        <div class="product-heading">
          <span class="product-kicker">PREMIUM DROP / ${escapeHtml(product.category)}</span>
          <h1>${escapeHtml(product.title)}<span>${escapeHtml(product.subtitle)}</span></h1>
        </div>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <dl class="product-facts">
          ${facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
        </dl>
        <div class="product-price-block">
          <strong>${formatPrice(product.price, product.currency)}</strong>
          ${product.originalPrice ? `<del>${formatPrice(product.originalPrice, product.currency)}</del>` : ''}
        </div>
        <div class="product-buy-row">
          <button class="button button-primary" type="button" data-product-action="${buttonAction}">${buttonLabel}</button>
          <a class="button button-secondary" href="/account/">查看订单</a>
        </div>
        <p class="product-hint">当前为 mock 支付测试商品。支付不会扣款，也未接入任何真实商户账户。</p>
        <div class="license-box"><h3>个人使用授权</h3><p>${escapeHtml(product.licenseSummary)}</p></div>
      </div>
    </div>`;

  shell.querySelector('[data-product-action]').addEventListener('click', () => {
    const returnTo = encodeURIComponent(location.pathname);
    if (buttonAction === 'login') location.href = `/login/?returnTo=${returnTo}`;
    if (buttonAction === 'purchase') purchase(product.id);
    if (buttonAction === 'download') location.href = `/api/downloads/${encodeURIComponent(product.id)}`;
  });
}

async function purchase(productId) {
  const button = shell.querySelector('[data-product-action]');
  button.disabled = true;
  button.textContent = '正在创建订单…';
  try {
    const payload = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    if (payload.alreadyPurchased) {
      location.reload();
      return;
    }
    location.href = `/payment/mock/?order=${encodeURIComponent(payload.order.orderNumber)}`;
  } catch (error) {
    button.disabled = false;
    button.textContent = error.message;
  }
}

async function loadProduct() {
  try {
    const productPayload = await request(`/api/products/${encodeURIComponent(slug)}`);
    const session = await request(`/api/session?productId=${encodeURIComponent(productPayload.product.id)}`);
    document.title = `${productPayload.product.title} — SYLVAN Wallpaper Lab`;
    renderProduct(productPayload.product, session);
  } catch (error) {
    shell.innerHTML = `<div class="premium-empty">${escapeHtml(error.message)}</div>`;
  }
}

loadProduct();

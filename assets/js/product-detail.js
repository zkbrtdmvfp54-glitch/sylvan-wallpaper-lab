import { escapeHtml, formatPrice, request } from './premium-common.js';
import { trackEvent } from './analytics.js';

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
    </div>
    <div class="product-extras">
      <article class="premium-note">
        <span class="section-index">FAQ / DELIVERY</span>
        <h2>购买后如何获取？</h2>
        <p>mock 支付成功后，下载权限立即写入当前登录账户。可随时在“我的账户”中再次发起鉴权下载。</p>
      </article>
      <article class="premium-note">
        <span class="section-index">REFUND / DIGITAL GOODS</span>
        <h2>退款说明</h2>
        <p>当前为零扣款测试商品。正式数字商品在未下载且符合法律规定时处理退款，下载后原则上不支持无理由退换。</p>
      </article>
      <article class="premium-note">
        <span class="section-index">COPYRIGHT / ORIGINAL</span>
        <h2>版权与授权</h2>
        <p>本测试套装为原创视觉占位内容，不使用第三方影视、动漫或游戏角色。禁止转售、重新打包与商业使用。</p>
      </article>
    </div>`;

  shell.querySelector('[data-product-action]').addEventListener('click', () => {
    trackEvent(buttonAction === 'download' ? 'download_start' : 'click_purchase', { productId: product.id });
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
    trackEvent('order_created', { productId, orderNumber: payload.order?.orderNumber });
    if (payload.alreadyPurchased) {
      location.reload();
      return;
    }
    if (!payload.payment?.checkoutUrl?.startsWith('/')) throw new Error('支付入口暂时不可用');
    location.href = payload.payment.checkoutUrl;
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
    trackEvent('product_detail_view', { productId: productPayload.product.id, slug });
    const structuredData = document.createElement('script');
    structuredData.type = 'application/ld+json';
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: productPayload.product.title,
      description: productPayload.product.description,
      brand: { '@type': 'Brand', name: 'SYLVAN Wallpaper Lab' },
      offers: {
        '@type': 'Offer',
        priceCurrency: productPayload.product.currency,
        price: (productPayload.product.price / 100).toFixed(2),
        availability: 'https://schema.org/InStock',
        url: location.href,
      },
    });
    document.head.appendChild(structuredData);
    renderProduct(productPayload.product, session);
  } catch (error) {
    shell.innerHTML = `<div class="premium-empty">${escapeHtml(error.message)}</div>`;
  }
}

loadProduct();

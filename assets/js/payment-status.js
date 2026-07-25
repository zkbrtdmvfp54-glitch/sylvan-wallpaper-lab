import { escapeHtml, formatPrice, request } from './premium-common.js';

const shell = document.querySelector('#paymentStatusShell');
const orderNumber = new URLSearchParams(location.search).get('order');
const requestedState = new URLSearchParams(location.search).get('state');

async function loadStatus() {
  if (!orderNumber) {
    shell.innerHTML = '<div class="premium-empty">缺少订单号。</div>';
    return;
  }
  try {
    const { order } = await request(`/api/orders/${encodeURIComponent(orderNumber)}`);
    const success = order.status === 'paid';
    const failed = order.status === 'failed' || requestedState === 'failure';
    shell.innerHTML = `
      <div class="payment-mark">${success ? '✓' : '×'}</div>
      <span class="section-index">ORDER / ${success ? 'COMPLETE' : failed ? 'FAILED' : 'CANCELLED'}</span>
      <h1>${success ? '订单完成' : failed ? '支付失败' : '订单已取消'}</h1>
      <p class="premium-intro">${success ? '测试商品已加入你的已购套装。' : '没有发生任何真实扣款，你可以返回商品重新创建订单。'}</p>
      <div class="payment-details">
        <div><span>订单号</span><strong>${escapeHtml(order.orderNumber)}</strong></div>
        <div><span>商品</span><strong>${escapeHtml(order.productTitle)}</strong></div>
        <div><span>金额</span><strong>${formatPrice(order.amount, order.currency)}</strong></div>
        <div><span>状态</span><strong>${escapeHtml(order.statusLabel)}</strong></div>
      </div>
      <div class="product-buy-row">
        <a class="button button-primary" href="${success ? '/account/' : '/premium/sylvan-drop-01/'}">${success ? '前往下载' : '返回商品'}</a>
        <a class="button button-secondary" href="/account/">查看订单</a>
      </div>`;
  } catch (error) {
    if (error.status === 401) {
      location.href = `/login/?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    shell.innerHTML = `<div class="premium-empty">${escapeHtml(error.message)}</div>`;
  }
}

loadStatus();


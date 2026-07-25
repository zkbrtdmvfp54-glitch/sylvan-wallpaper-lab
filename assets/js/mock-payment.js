import { escapeHtml, formatPrice, request } from './premium-common.js';

const shell = document.querySelector('#paymentShell');
const orderNumber = new URLSearchParams(location.search).get('order');

function renderOrder(order) {
  shell.innerHTML = `
    <div class="payment-mark">M</div>
    <span class="section-index">MOCK PAYMENT / NO CHARGE</span>
    <h1>测试支付</h1>
    <p class="premium-intro">这是开发阶段的模拟支付页。点击“模拟支付成功”只会更新测试订单，不会调用微信、支付宝或银行卡。</p>
    <div class="payment-details">
      <div><span>订单号</span><strong>${escapeHtml(order.orderNumber)}</strong></div>
      <div><span>商品</span><strong>${escapeHtml(order.productTitle)}</strong></div>
      <div><span>应付金额</span><strong>${formatPrice(order.amount, order.currency)}</strong></div>
      <div><span>当前状态</span><strong>${escapeHtml(order.statusLabel)}</strong></div>
    </div>
    <div class="product-buy-row">
      <button class="button button-primary" type="button" data-payment-action="success">模拟支付成功</button>
      <button class="button button-secondary" type="button" data-payment-action="failure">模拟支付失败</button>
      <button class="button button-secondary" type="button" data-payment-action="cancel">取消订单</button>
    </div>
    <p class="payment-hint">MOCK PAYMENT ONLY · NO REAL CHARGE · NO PAYMENT KEY</p>`;

  shell.querySelectorAll('[data-payment-action]').forEach((button) => {
    button.addEventListener('click', () => submitAction(button.dataset.paymentAction));
  });
}

async function submitAction(action) {
  shell.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  try {
    await request(`/api/payments/mock/${action}`, {
      method: 'POST',
      body: JSON.stringify({ orderNumber }),
    });
    location.href = action === 'success'
      ? `/payment/success/?order=${encodeURIComponent(orderNumber)}`
      : `/payment/cancel/?order=${encodeURIComponent(orderNumber)}&state=${action}`;
  } catch (error) {
    shell.querySelector('.premium-intro').textContent = error.message;
    shell.querySelectorAll('button').forEach((button) => {
      button.disabled = false;
    });
  }
}

async function loadOrder() {
  if (!orderNumber) {
    shell.innerHTML = '<div class="premium-empty">缺少订单号。</div>';
    return;
  }
  try {
    const payload = await request(`/api/orders/${encodeURIComponent(orderNumber)}`);
    renderOrder(payload.order);
  } catch (error) {
    if (error.status === 401) {
      location.href = `/login/?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    shell.innerHTML = `<div class="premium-empty">${escapeHtml(error.message)}</div>`;
  }
}

loadOrder();

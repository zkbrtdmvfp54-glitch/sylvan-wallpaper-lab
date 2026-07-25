import { escapeHtml, formatPrice, request } from './premium-common.js';

const identity = document.querySelector('#accountIdentity');
const purchaseList = document.querySelector('#purchaseList');
const orderList = document.querySelector('#orderList');
const downloadList = document.querySelector('#downloadList');
const membershipPanel = document.querySelector('#membershipPanel');
const logoutButton = document.querySelector('#logoutButton');

function renderPurchases(purchases) {
  purchaseList.innerHTML = purchases.length
    ? purchases.map((purchase) => `
      <article class="account-item account-row">
        <div>
          <h3>${escapeHtml(purchase.productTitle)}</h3>
          <p>购买于 ${new Date(purchase.purchasedAt).toLocaleString('zh-CN')}</p>
        </div>
        <a class="button button-primary" href="/api/downloads/${encodeURIComponent(purchase.productId)}">下载套装</a>
      </article>`).join('')
    : '<p class="premium-intro">还没有已购套装。前往原创套装页完成第一笔测试订单。</p>';
}

function renderOrders(orders) {
  orderList.innerHTML = orders.length
    ? orders.map((order) => `
      <article class="account-item">
        <div class="account-row">
          <div>
            <h3>${escapeHtml(order.productTitle)}</h3>
            <p>${escapeHtml(order.orderNumber)} · ${new Date(order.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <span class="status-pill">${escapeHtml(order.statusLabel)}</span>
        </div>
        <p>${formatPrice(order.amount, order.currency)}</p>
      </article>`).join('')
    : '<p class="premium-intro">暂无订单记录。</p>';
}

function renderDownloads(downloads) {
  downloadList.innerHTML = downloads.length
    ? downloads.map((download) => `
      <article class="account-item">
        <h3>${escapeHtml(download.productTitle)}</h3>
        <p>${new Date(download.downloadedAt).toLocaleString('zh-CN')} · 累计 ${download.downloadCount} 次</p>
      </article>`).join('')
    : '<p class="premium-intro">完成首次鉴权下载后，这里会显示下载记录。</p>';
}

function renderMembership(membership) {
  membershipPanel.innerHTML = `
    <article class="account-item">
      <div class="account-row">
        <div><h3>${escapeHtml(membership.label)}</h3><p>会员专属内容将在后续阶段开放。</p></div>
        <span class="status-pill">COMING SOON</span>
      </div>
    </article>`;
}

async function loadAccount() {
  try {
    const payload = await request('/api/account');
    identity.textContent = `${payload.user.email} · 已购 ${payload.purchases.length} 件原创套装`;
    renderPurchases(payload.purchases);
    renderOrders(payload.orders);
    renderDownloads(payload.downloads);
    renderMembership(payload.membership);
  } catch (error) {
    if (error.status === 401) {
      location.href = `/login/?returnTo=${encodeURIComponent(location.pathname)}`;
      return;
    }
    identity.textContent = error.message;
    purchaseList.innerHTML = '';
    orderList.innerHTML = '';
    downloadList.innerHTML = '';
    membershipPanel.innerHTML = '';
  }
}

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await request('/api/logout', { method: 'POST', body: '{}' });
    location.href = '/';
  } catch (error) {
    identity.textContent = error.message;
    logoutButton.disabled = false;
  }
});

loadAccount();

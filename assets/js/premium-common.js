export async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : null;
  if (!response.ok) {
    const error = new Error(payload?.message || '请求暂时无法完成');
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }
  return payload;
}

export function formatPrice(amount, currency = 'CNY') {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 1,
  }).format(amount / 100);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function hydrateAccountLink() {
  const links = document.querySelectorAll('[data-account-link]');
  if (!links.length) return null;
  try {
    const session = await request('/api/session');
    links.forEach((link) => {
      link.textContent = session.user ? '我的账户' : '登录';
      link.href = session.user ? '/account/' : `/login/?returnTo=${encodeURIComponent(location.pathname)}`;
    });
    return session.user;
  } catch {
    links.forEach((link) => {
      link.textContent = '登录';
      link.href = `/login/?returnTo=${encodeURIComponent(location.pathname)}`;
    });
    return null;
  }
}

export function setYear() {
  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
}

setYear();
hydrateAccountLink();


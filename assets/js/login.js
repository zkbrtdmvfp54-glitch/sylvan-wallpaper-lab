import { request } from './premium-common.js';

const requestForm = document.querySelector('#requestCodeForm');
const verifyForm = document.querySelector('#verifyCodeForm');
const changeEmailButton = document.querySelector('#changeEmailButton');
const message = document.querySelector('#authMessage');
const emailInput = document.querySelector('#email');
const codeInput = document.querySelector('#code');
const returnTo = new URLSearchParams(location.search).get('returnTo') || '/account/';
let pendingEmail = '';

function setBusy(form, busy) {
  form.querySelectorAll('button, input').forEach((element) => {
    element.disabled = busy;
  });
}

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  pendingEmail = emailInput.value.trim().toLowerCase();
  setBusy(requestForm, true);
  message.textContent = '正在创建测试验证码…';
  try {
    const payload = await request('/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ email: pendingEmail }),
    });
    requestForm.hidden = true;
    verifyForm.hidden = false;
    codeInput.focus();
    message.textContent = payload.devCode
      ? `开发环境测试验证码：${payload.devCode}`
      : '验证码已发送，请检查邮箱。';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    setBusy(requestForm, false);
  }
});

verifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(verifyForm, true);
  message.textContent = '正在验证…';
  try {
    await request('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email: pendingEmail, code: codeInput.value.trim() }),
    });
    location.href = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/account/';
  } catch (error) {
    message.textContent = error.message;
    setBusy(verifyForm, false);
  }
});

changeEmailButton.addEventListener('click', () => {
  verifyForm.hidden = true;
  requestForm.hidden = false;
  codeInput.value = '';
  message.textContent = '';
  emailInput.focus();
});


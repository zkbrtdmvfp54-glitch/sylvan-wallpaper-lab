import { trackEvent } from './analytics.js';

document.querySelectorAll('.gear-card a').forEach((link) => {
  link.addEventListener('click', () => trackEvent('gear_link_click', { label: link.textContent.trim() }));
});

document.querySelector('#contactQrButton')?.addEventListener('click', () => {
  trackEvent('custom_service_contact');
});


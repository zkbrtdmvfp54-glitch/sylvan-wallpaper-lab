// SYLVAN Wallpaper Lab — 图库、筛选与设备预览
// 图片数据来自 wallpapers-data.js；新增素材后运行 tools/generate-wallpaper-data.ps1 更新。

const wallpapers = Array.isArray(window.SYLVAN_WALLPAPERS) ? window.SYLVAN_WALLPAPERS : [];
const heroBackgroundVideo = document.querySelector('.hero-background-video');
if (heroBackgroundVideo) {
  const startHeroVideo = () => heroBackgroundVideo.play().catch(() => {});
  startHeroVideo();
  document.addEventListener('pointerdown', startHeroVideo, { once: true });
  document.addEventListener('touchstart', startHeroVideo, { once: true, passive: true });
}
const wallpaperGrid = document.querySelector('#wallpaperGrid');
const galleryCount = document.querySelector('#galleryCount');
const galleryTotal = document.querySelector('#galleryTotal');
const emptyState = document.querySelector('.filter-empty');
const loadMoreWrap = document.querySelector('#loadMoreWrap');
const loadMoreButton = document.querySelector('#loadMoreButton');
const loadMoreStatus = document.querySelector('#loadMoreStatus');
const collapseButton = document.querySelector('#collapseButton');
const categoryButtons = document.querySelectorAll('.filter-chip');
const orientationButtons = document.querySelectorAll('.orientation-chip');
const INITIAL_VISIBLE = 8;
const LOAD_STEP = 50;
let currentCategory = 'all';
let currentOrientation = 'all';
let visibleLimit = INITIAL_VISIBLE;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderGallery() {
  wallpaperGrid.innerHTML = wallpapers.map((item) => {
    const id = String(item.id).padStart(3, '0');
    const title = escapeHtml(item.title);
    const src = escapeHtml(item.src);
    const direction = item.orientation === 'landscape' ? '横屏' : '竖屏';
    const categories = escapeHtml(item.categories.join(' '));

    return `
      <article class="wallpaper-card ${item.orientation}" data-id="${item.id}" data-category="${categories}" data-orientation="${item.orientation}">
        <button class="image-button preview-trigger" type="button" data-id="${item.id}" aria-label="查看${title}上屏效果">
          <img src="${src}" alt="${title}" loading="lazy" decoding="async">
          <span class="card-number">W / ${id}</span>
          <span class="orientation-badge">${direction}</span>
          <span class="preview-cue">${item.orientation === 'landscape' ? '电脑预览' : '手机预览'} ↗</span>
        </button>
        <div class="card-body">
          <div><h3>${title}</h3><p>${escapeHtml(item.folder)} / ${item.width} × ${item.height}</p></div>
          <div class="tags"><span>${item.ratio}</span><span>${direction}</span></div>
        </div>
        <div class="card-actions">
          <a class="download-link" href="${src}" download>下载原图 <span>↓</span></a>
          <button class="text-link preview-trigger" type="button" data-id="${item.id}">查看${item.orientation === 'landscape' ? '电脑' : '手机'}效果</button>
        </div>
      </article>`;
  }).join('');
}

function getCategoryItems() {
  return wallpapers.filter((item) => currentCategory === 'all' || item.categories.includes(currentCategory));
}

function updateCounts() {
  const categoryItems = getCategoryItems();
  document.querySelector('#countAll').textContent = categoryItems.length;
  document.querySelector('#countLandscape').textContent = categoryItems.filter((item) => item.orientation === 'landscape').length;
  document.querySelector('#countPortrait').textContent = categoryItems.filter((item) => item.orientation === 'portrait').length;
}

function applyFilters() {
  let matchedCount = 0;
  let visibleCount = 0;
  document.querySelectorAll('.wallpaper-card').forEach((card) => {
    const categoryMatch = currentCategory === 'all' || card.dataset.category.split(' ').includes(currentCategory);
    const orientationMatch = currentOrientation === 'all' || card.dataset.orientation === currentOrientation;
    const matches = categoryMatch && orientationMatch;
    const show = matches && matchedCount < visibleLimit;
    if (matches) matchedCount += 1;
    card.classList.toggle('is-hidden', !show);
    if (show) visibleCount += 1;
  });
  galleryCount.textContent = visibleCount;
  galleryTotal.textContent = matchedCount;
  emptyState.hidden = matchedCount !== 0;
  loadMoreWrap.hidden = matchedCount === 0 || visibleCount >= matchedCount;
  collapseButton.hidden = visibleLimit <= INITIAL_VISIBLE || matchedCount <= INITIAL_VISIBLE;
  loadMoreStatus.textContent = `已展示最近更新的 ${visibleCount} 张，共 ${matchedCount} 张`;
  updateCounts();
}

categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentCategory = button.dataset.filter;
    visibleLimit = INITIAL_VISIBLE;
    categoryButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    applyFilters();
  });
});

orientationButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentOrientation = button.dataset.orientation;
    visibleLimit = INITIAL_VISIBLE;
    orientationButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    applyFilters();
  });
});

loadMoreButton.addEventListener('click', () => {
  visibleLimit += LOAD_STEP;
  applyFilters();
});

collapseButton.addEventListener('click', () => {
  visibleLimit = INITIAL_VISIBLE;
  applyFilters();
  wallpaperGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// 精选壁纸轮播：匀速循环、按住拖动/触摸滑动、点击大图预览。
const showcaseRail = document.querySelector('#showcaseRail');
const carouselLightbox = document.querySelector('#carouselLightbox');
const carouselLightboxImage = document.querySelector('#carouselLightboxImage');
const carouselLightboxTitle = document.querySelector('#carouselLightboxTitle');

if (showcaseRail) {
  const portraitPool = wallpapers.filter((item) => item.orientation === 'portrait');
  for (let index = portraitPool.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [portraitPool[index], portraitPool[randomIndex]] = [portraitPool[randomIndex], portraitPool[index]];
  }
  const randomPortraits = portraitPool.slice(0, 20);
  const firstGroup = document.createElement('div');
  firstGroup.className = 'rail-group';
  firstGroup.innerHTML = randomPortraits.map((item, index) => `
    <figure class="rail-item" data-wallpaper-id="${item.id}" data-title="${escapeHtml(item.title)}">
      <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
    </figure>`).join('');
  showcaseRail.replaceChildren(firstGroup);

  while (showcaseRail.querySelectorAll('.rail-group').length < 2) {
    const duplicateGroup = firstGroup.cloneNode(true);
    duplicateGroup.setAttribute('aria-hidden', 'true');
    showcaseRail.appendChild(duplicateGroup);
  }

  firstGroup.querySelectorAll('.rail-item').forEach((item) => {
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `放大预览 ${item.dataset.title || '精选壁纸'}`);
  });

  let groupWidth = 0;
  let isDragging = false;
  let didDrag = false;
  let suppressClick = false;
  let startX = 0;
  let startScroll = 0;
  let pressedItem = null;
  let resumeAt = 0;
  let previousTime = performance.now();
  let hasMeasured = false;

  function measureRail() {
    const oldGroupWidth = groupWidth;
    groupWidth = firstGroup.getBoundingClientRect().width;
    if (!hasMeasured) {
      showcaseRail.scrollLeft = 0;
      hasMeasured = true;
    } else if (oldGroupWidth && groupWidth) {
      showcaseRail.scrollLeft = (showcaseRail.scrollLeft / oldGroupWidth * groupWidth) % groupWidth;
    }
  }

  function wrapRailPosition(value) {
    if (!groupWidth) return 0;
    return ((value % groupWidth) + groupWidth) % groupWidth;
  }

  function animateRail(time) {
    const delta = Math.min(40, time - previousTime);
    previousTime = time;
    if (!isDragging && time >= resumeAt && !document.hidden) {
      showcaseRail.scrollLeft = wrapRailPosition(showcaseRail.scrollLeft + delta * 0.075);
    }
    requestAnimationFrame(animateRail);
  }

  function finishRailDrag(event) {
    if (!isDragging) return;
    isDragging = false;
    showcaseRail.classList.remove('is-dragging');
    resumeAt = performance.now() + 900;
    if (showcaseRail.hasPointerCapture?.(event.pointerId)) showcaseRail.releasePointerCapture(event.pointerId);
    if (didDrag) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  }

  showcaseRail.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    isDragging = true;
    didDrag = false;
    suppressClick = false;
    startX = event.clientX;
    startScroll = showcaseRail.scrollLeft;
    pressedItem = event.target.closest('.rail-item');
    showcaseRail.classList.add('is-dragging');
    showcaseRail.setPointerCapture?.(event.pointerId);
  });

  showcaseRail.addEventListener('pointermove', (event) => {
    if (!isDragging || !groupWidth) return;
    const distance = event.clientX - startX;
    if (Math.abs(distance) > 5) didDrag = true;
    if (!didDrag) return;
    event.preventDefault();
    showcaseRail.scrollLeft = wrapRailPosition(startScroll - distance);
  });

  showcaseRail.addEventListener('pointerup', (event) => {
    const item = pressedItem;
    const shouldOpen = !didDrag && Boolean(item);
    finishRailDrag(event);
    if (shouldOpen) {
      suppressClick = true;
      openCarouselItem(item);
      setTimeout(() => { suppressClick = false; }, 0);
    }
  });
  showcaseRail.addEventListener('pointercancel', finishRailDrag);
  showcaseRail.addEventListener('dragstart', (event) => event.preventDefault());
  showcaseRail.addEventListener('contextmenu', (event) => event.preventDefault());

  function openCarouselItem(item) {
    const image = item.querySelector('img');
    const title = item.dataset.title || '精选壁纸';
    carouselLightboxImage.src = image.currentSrc || image.src;
    carouselLightboxImage.alt = `${title}大图预览`;
    carouselLightboxTitle.textContent = title;
    carouselLightbox.hidden = false;
    document.body.classList.add('modal-open');
    carouselLightbox.querySelector('.modal-close').focus();
  }

  showcaseRail.addEventListener('click', (event) => {
    if (suppressClick) return;
    const item = event.target.closest('.rail-item');
    if (item) openCarouselItem(item);
  });

  showcaseRail.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest('.rail-item');
    if (!item) return;
    event.preventDefault();
    openCarouselItem(item);
  });

  requestAnimationFrame(() => {
    measureRail();
    requestAnimationFrame(animateRail);
  });
  window.addEventListener('resize', measureRail);
}

function closeCarouselLightbox() {
  carouselLightbox.hidden = true;
  document.body.classList.remove('modal-open');
}

document.querySelectorAll('[data-close-carousel]').forEach((item) => item.addEventListener('click', closeCarouselLightbox));

// 商务合作二维码弹层。
const contactQrButton = document.querySelector('#contactQrButton');
const contactQrModal = document.querySelector('#contactQrModal');
const contactQrGrid = contactQrModal.querySelector('.contact-qr-grid');
const contactQrCards = contactQrModal.querySelectorAll('.contact-qr-card');

function resetContactQrCards() {
  contactQrGrid.classList.remove('has-selection');
  contactQrCards.forEach((card) => {
    card.classList.remove('is-selected', 'is-muted');
    card.setAttribute('aria-pressed', 'false');
  });
}

function toggleContactQrCard(selectedCard) {
  if (selectedCard.classList.contains('is-selected')) {
    resetContactQrCards();
    return;
  }
  contactQrGrid.classList.add('has-selection');
  contactQrCards.forEach((card) => {
    const selected = card === selectedCard;
    card.classList.toggle('is-selected', selected);
    card.classList.toggle('is-muted', !selected);
    card.setAttribute('aria-pressed', String(selected));
  });
}

function openContactQrModal() {
  resetContactQrCards();
  contactQrModal.hidden = false;
  document.body.classList.add('modal-open');
  contactQrModal.querySelector('.modal-close').focus();
}

function closeContactQrModal() {
  contactQrModal.hidden = true;
  document.body.classList.remove('modal-open');
}

contactQrButton.addEventListener('click', openContactQrModal);
document.querySelectorAll('[data-close-contact-qr]').forEach((item) => item.addEventListener('click', closeContactQrModal));
contactQrCards.forEach((card) => {
  card.addEventListener('click', () => toggleContactQrCard(card));
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleContactQrCard(card);
  });
});

// 横屏使用显示器预览，竖屏使用手机预览。
const modal = document.querySelector('#previewModal');
const previewImages = document.querySelectorAll('.preview-device-image');
const previewTitle = document.querySelector('#previewTitle');
const previewMode = document.querySelector('#previewMode');
const previewDescription = document.querySelector('#previewDescription');

function openPreview(item) {
  const isPortrait = item.orientation === 'portrait';
  previewImages.forEach((image) => {
    image.src = item.src;
    image.alt = `${item.title}${isPortrait ? '手机' : '电脑'}上屏预览`;
  });
  previewTitle.textContent = item.title;
  previewMode.textContent = isPortrait ? 'MOBILE PREVIEW / 竖屏' : 'DESKTOP PREVIEW / 横屏';
  previewDescription.textContent = isPortrait
    ? `手机锁屏效果 · ${item.width} × ${item.height} · ${item.ratio}`
    : `电脑桌面效果 · ${item.width} × ${item.height} · ${item.ratio}`;
  modal.classList.toggle('is-portrait', isPortrait);
  modal.classList.toggle('is-landscape', !isPortrait);
  modal.hidden = false;
  document.body.classList.add('modal-open');
  modal.querySelector('.modal-close').focus();
}

function closePreview() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

wallpaperGrid.addEventListener('click', (event) => {
  const trigger = event.target.closest('.preview-trigger');
  if (!trigger) return;
  const item = wallpapers.find((wallpaper) => wallpaper.id === Number(trigger.dataset.id));
  if (item) openPreview(item);
});

document.querySelectorAll('[data-close-modal]').forEach((item) => item.addEventListener('click', closePreview));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closePreview();
  if (event.key === 'Escape' && !carouselLightbox.hidden) closeCarouselLightbox();
  if (event.key === 'Escape' && !contactQrModal.hidden) closeContactQrModal();
});

// 占位链接提示。替换为真实链接后，同时移除 placeholder-link 类名。
const toast = document.querySelector('#toast');
let toastTimer;
document.querySelectorAll('.placeholder-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (link.getAttribute('href') !== '#') return;
    event.preventDefault();
    toast.textContent = `${link.dataset.label || '此链接'}尚未配置，请在 index.html 中替换。`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.06 });

renderGallery();
applyFilters();
document.querySelectorAll('.reveal').forEach((item) => revealObserver.observe(item));
document.querySelector('#year').textContent = new Date().getFullYear();

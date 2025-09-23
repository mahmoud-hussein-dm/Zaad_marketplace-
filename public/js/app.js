const API_BASE = '/api';

const state = {
  locale: 'ar',
  dictionaries: {},
  dictionary: {},
  config: null,
  categories: [],
  cities: [],
  filters: {
    query: '',
    category: null,
    city: null,
    condition: null,
    sort: 'recent'
  },
  listings: [],
  trending: [],
  bumped: [],
  newArrivals: [],
  users: [],
  currentUser: null,
  currentView: 'home',
  orders: {
    bought: [],
    sold: []
  },
  wallet: {
    balanceSDG: 0,
    entries: []
  },
  notifications: [],
  adminReport: null
};

const elements = {
  brand: document.getElementById('brand'),
  searchInput: document.getElementById('global-search'),
  searchButton: document.getElementById('search-button'),
  sellButton: document.getElementById('sell-button'),
  localeSwitch: document.getElementById('locale-switch'),
  profileMenu: document.getElementById('profile-menu'),
  nav: document.getElementById('app-nav'),
  hero: document.getElementById('home-hero'),
  filters: document.getElementById('home-filters'),
  categories: document.getElementById('category-tiles'),
  trending: document.getElementById('trending-section'),
  bumped: document.getElementById('bumped-section'),
  newSection: document.getElementById('new-section'),
  sellerCenter: document.getElementById('seller-center'),
  ordersCenter: document.getElementById('orders-center'),
  walletCenter: document.getElementById('wallet-center'),
  adminCenter: document.getElementById('admin-center'),
  notificationsCenter: document.getElementById('notifications-center'),
  footer: document.getElementById('app-footer'),
  modalLayer: document.getElementById('modal-layer'),
  fab: document.getElementById('sell-fab')
};

function formatNumber(value) {
  return new Intl.NumberFormat(state.locale).format(Number(value || 0));
}

function formatCurrencySDG(value) {
  return `${formatNumber(Math.round(value))} ج.س`;
}

function getDictionary(locale = state.locale) {
  return state.dictionaries[locale] || {};
}

function t(key, vars = {}) {
  const dictionary = getDictionary();
  const value = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), dictionary);
  if (!value) return key;
  if (typeof value !== 'string') return value;
  return value.replace(/{{(.*?)}}/g, (_, token) => {
    const cleaned = token.trim();
    return vars[cleaned] !== undefined ? vars[cleaned] : '';
  });
}

async function request(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (state.currentUser) {
    headers['X-User-Id'] = state.currentUser.id;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body
  });
  if (!response.ok) {
    let error = 'unknown-error';
    try {
      const payload = await response.json();
      error = payload.error || response.statusText;
    } catch (err) {
      error = response.statusText;
    }
    throw new Error(error);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function loadDictionaries() {
  const [ar, en] = await Promise.all([
    fetch('/locales/ar.json').then((res) => res.json()),
    fetch('/locales/en.json').then((res) => res.json())
  ]);
  state.dictionaries = { ar, en };
  state.dictionary = ar;
}

function setDirection() {
  const dir = state.locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = state.locale;
  document.documentElement.dir = dir;
  if (dir === 'rtl') {
    elements.brand.style.textAlign = 'right';
  } else {
    elements.brand.style.textAlign = 'left';
  }
}

function setLocale(locale) {
  if (!state.dictionaries[locale]) return;
  state.locale = locale;
  state.dictionary = state.dictionaries[locale];
  setDirection();
  renderApp();
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach((section) => {
    section.classList.toggle('active', section.dataset.view === view);
  });
  document.querySelectorAll('.app-nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  if (view === 'seller') {
    loadSellerCenter();
  }
  if (view === 'orders') {
    loadOrders();
  }
  if (view === 'wallet') {
    loadWallet();
  }
  if (view === 'notifications') {
    loadNotifications();
  }
  if (view === 'admin') {
    loadAdmin();
  }
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

function renderHeader() {
  elements.brand.textContent = state.locale === 'ar' ? t('app.title') : t('app.title');
  elements.searchInput.placeholder = t('home.searchPlaceholder');
  elements.searchButton.textContent = t('nav.search');
  elements.sellButton.textContent = `${t('nav.sell')} +`;
  elements.fab.title = t('nav.sell');
  elements.fab.classList.toggle('show', true);
}

function renderLocaleSwitch() {
  const altLocale = state.locale === 'ar' ? 'en' : 'ar';
  elements.localeSwitch.innerHTML = '';
  const button = document.createElement('button');
  button.className = 'secondary';
  button.textContent = state.locale === 'ar' ? t('app.language.switch') : 'العربية';
  button.addEventListener('click', () => setLocale(altLocale));
  elements.localeSwitch.appendChild(button);
}

function renderProfileMenu() {
  elements.profileMenu.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'profile-selector';

  const select = document.createElement('select');
  select.style.minHeight = '44px';
  select.style.padding = '0.5rem 0.75rem';
  state.users.forEach((user) => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    if (state.currentUser && user.id === state.currentUser.id) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    state.currentUser = state.users.find((user) => user.id === select.value) || state.currentUser;
    renderApp();
    refreshHome();
  });

  const menu = document.createElement('div');
  menu.className = 'profile-links';
  const links = [
    { key: 'orders', view: 'orders' },
    { key: 'listings', view: 'seller' },
    { key: 'wallet', view: 'wallet' },
    { key: 'store', view: 'seller' },
    { key: 'notifications', view: 'notifications' }
  ];
  links.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent = t(`nav.${item.key}`);
    btn.addEventListener('click', () => switchView(item.view));
    menu.appendChild(btn);
  });
  if (state.currentUser?.roles?.includes('ADMIN')) {
    const adminBtn = document.createElement('button');
    adminBtn.className = 'secondary';
    adminBtn.textContent = t('nav.admin');
    adminBtn.addEventListener('click', () => switchView('admin'));
    menu.appendChild(adminBtn);
  }
  container.appendChild(select);
  container.appendChild(menu);
  elements.profileMenu.appendChild(container);
}

function renderNav() {
  elements.nav.innerHTML = '';
  const navItems = [
    { key: 'buy', view: 'home' },
    { key: 'sell', view: 'seller' },
    { key: 'orders', view: 'orders' },
    { key: 'wallet', view: 'wallet' },
    { key: 'notifications', view: 'notifications' }
  ];
  navItems.forEach((item) => {
    const button = document.createElement('button');
    button.dataset.view = item.view;
    button.textContent = t(`nav.${item.key}`);
    if (state.currentView === item.view) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => switchView(item.view));
    elements.nav.appendChild(button);
  });
  if (state.currentUser?.roles?.includes('ADMIN')) {
    const adminButton = document.createElement('button');
    adminButton.dataset.view = 'admin';
    adminButton.textContent = t('nav.admin');
    if (state.currentView === 'admin') {
      adminButton.classList.add('active');
    }
    adminButton.addEventListener('click', () => switchView('admin'));
    elements.nav.appendChild(adminButton);
  }
}

function buildHero() {
  elements.hero.innerHTML = '';
  const title = document.createElement('h1');
  title.textContent = t('home.heroTitle');
  const subtitle = document.createElement('p');
  subtitle.textContent = t('home.heroSubtitle');
  const form = document.createElement('form');
  form.innerHTML = `
    <input name="query" type="search" placeholder="${t('home.searchPlaceholder')}" value="${state.filters.query || ''}" />
    <select name="city">
      <option value="">${t('home.cityPlaceholder')}</option>
      ${state.cities
        .map((city) => `<option value="${city}" ${state.filters.city === city ? 'selected' : ''}>${city}</option>`)
        .join('')}
    </select>
    <select name="condition">
      <option value="">${t('home.condition')}</option>
      ${Object.entries(t('conditions'))
        .map(([value, label]) => `<option value="${value}" ${state.filters.condition === value ? 'selected' : ''}>${label}</option>`)
        .join('')}
    </select>
    <div class="price-range">
      <input name="minPrice" type="number" placeholder="${t('home.priceMin')}" value="${state.filters.minPrice || ''}" />
      <input name="maxPrice" type="number" placeholder="${t('home.priceMax')}" value="${state.filters.maxPrice || ''}" />
    </div>
    <button type="submit" class="primary">${t('app.actions.apply')}</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    state.filters.query = formData.get('query');
    state.filters.city = formData.get('city');
    state.filters.condition = formData.get('condition');
    state.filters.minPrice = formData.get('minPrice');
    state.filters.maxPrice = formData.get('maxPrice');
    refreshHome();
  });
  elements.hero.appendChild(title);
  elements.hero.appendChild(subtitle);
  elements.hero.appendChild(form);
}

function buildCategories() {
  elements.categories.innerHTML = '';
  state.categories.forEach((category) => {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `<div class="emoji">${category.icon}</div><div class="label">${category.name[state.locale] || category.name.ar}</div>`;
    card.addEventListener('click', () => {
      state.filters.category = category.id;
      refreshHome();
    });
    elements.categories.appendChild(card);
  });
}

function buildListingGroup(container, titleKey, items) {
  container.innerHTML = '';
  const heading = document.createElement('h2');
  heading.textContent = t(titleKey);
  container.appendChild(heading);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.textContent = t('app.status.empty');
    container.appendChild(empty);
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'listing-grid';
  items.forEach((listing) => {
    grid.appendChild(buildListingCard(listing));
  });
  container.appendChild(grid);
}

function buildListingCard(listing) {
  const card = document.createElement('article');
  card.className = 'listing-card';
  card.addEventListener('click', () => openListingModal(listing.id));
  const image = document.createElement('img');
  image.src = listing.photos?.[0] || 'https://placehold.co/600x600?text=Listing';
  image.alt = listing.title;
  const content = document.createElement('div');
  content.className = 'content';
  const title = document.createElement('h3');
  title.textContent = listing.title;
  const meta = document.createElement('div');
  meta.className = 'meta-row';
  const price = document.createElement('span');
  price.textContent = formatCurrencySDG(listing.priceSDG);
  const city = document.createElement('span');
  city.textContent = listing.city;
  meta.appendChild(price);
  meta.appendChild(city);
  const condition = document.createElement('span');
  condition.textContent = `${t('listing.condition')}: ${t('conditions')[listing.condition]}`;
  content.appendChild(title);
  content.appendChild(meta);
  content.appendChild(condition);
  card.appendChild(image);
  card.appendChild(content);
  if (listing.isBumped) {
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = t('listing.bumpBadge');
    card.appendChild(badge);
  }
  return card;
}

async function openListingModal(listingId) {
  try {
    const { listing } = await request(`/listings/${listingId}?locale=${state.locale}`);
    const modal = document.createElement('div');
    modal.className = 'modal';
    const content = document.createElement('div');
    content.className = 'modal-content';
    const close = document.createElement('button');
    close.className = 'modal-close';
    close.innerHTML = '&times;';
    close.addEventListener('click', () => modal.remove());
    const details = document.createElement('div');
    details.className = 'details-layout';
    const gallery = document.createElement('div');
    gallery.className = 'gallery';
    (listing.photos || []).forEach((url) => {
      const img = document.createElement('img');
      img.src = url;
      gallery.appendChild(img);
    });
    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `
      <h2>${listing.title}</h2>
      <p>${formatCurrencySDG(listing.priceSDG)} (${listing.priceUSD} USD)</p>
      <p>${t('listing.city')}: ${listing.city}</p>
      <p>${t('listing.condition')}: ${t('conditions')[listing.condition]}</p>
      <p>${listing.description || ''}</p>
      <div class="seller-card">
        <strong>${listing.seller?.name || ''}</strong>
        <span>${t('listing.sellerRating')}: ${listing.seller?.rating || '—'}</span>
      </div>
      <div class="policies">
        <h3>${t('listing.policiesTitle')}</h3>
        <ul class="checklist">
          <li>${t('listing.policyCOD')}</li>
          <li>${t('listing.policyOTP')}</li>
          <li>${t('listing.policyDispute')}</li>
        </ul>
      </div>
    `;
    const aiBlock = document.createElement('div');
    aiBlock.className = 'ai-insights';
    if (listing.ai?.suggestedPriceMin) {
      aiBlock.innerHTML += `<h3>${t('listing.aiPricingTitle')}</h3><p>${t('listing.aiPricingRange', {
        min: formatNumber(listing.ai.suggestedPriceMin),
        max: formatNumber(listing.ai.suggestedPriceMax),
        avg: formatNumber(Math.round((listing.ai.suggestedPriceMin + listing.ai.suggestedPriceMax) / 2))
      })}</p>`;
    }
    if (listing.ai?.qualityChecklist?.length) {
      const list = document.createElement('ul');
      list.className = 'checklist';
      listing.ai.qualityChecklist.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      aiBlock.innerHTML += `<h3>${t('listing.aiQualityTitle')}</h3>`;
      aiBlock.appendChild(list);
    }
    info.appendChild(aiBlock);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const buyButton = document.createElement('button');
    buyButton.className = 'primary';
    buyButton.textContent = t('listing.buyNow');
    buyButton.addEventListener('click', async () => {
      try {
        const { order } = await request(`/listings/${listingId}?action=buy`, { method: 'POST' });
        showToast(`${t('listing.buyNow')} ✅ OTP: ${order.otp}`, 'success');
        modal.remove();
        switchView('orders');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
    actions.appendChild(buyButton);
    info.appendChild(actions);

    details.appendChild(gallery);
    details.appendChild(info);

    content.appendChild(close);
    content.appendChild(details);
    modal.appendChild(content);
    elements.modalLayer.innerHTML = '';
    elements.modalLayer.appendChild(modal);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function computeListingBuckets() {
  state.trending = state.listings.slice(0, 6);
  state.bumped = state.listings.filter((listing) => listing.isBumped).slice(0, 6);
  state.newArrivals = [...state.listings]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
}

function renderHome() {
  buildHero();
  buildCategories();
  buildListingGroup(elements.trending, 'home.trending', state.trending);
  buildListingGroup(elements.bumped, 'home.bumped', state.bumped);
  buildListingGroup(elements.newSection, 'home.newArrivals', state.newArrivals);
  elements.filters.innerHTML = `<p>${t('home.aiGuardrails')}</p>`;
}

function renderFooter() {
  elements.footer.textContent = `${t('app.title')} · ${t('app.tagline')}`;
}

async function refreshHome() {
  try {
    const params = new URLSearchParams();
    params.set('locale', state.locale);
    if (state.filters.query) params.set('query', state.filters.query);
    if (state.filters.category) params.set('category', state.filters.category);
    if (state.filters.city) params.set('city', state.filters.city);
    if (state.filters.condition) params.set('condition', state.filters.condition);
    if (state.filters.minPrice) params.set('minPrice', state.filters.minPrice);
    if (state.filters.maxPrice) params.set('maxPrice', state.filters.maxPrice);
    if (state.filters.sort === 'price-asc') params.set('sort', 'price-asc');
    if (state.filters.sort === 'price-desc') params.set('sort', 'price-desc');
    const data = await request(`/listings?${params.toString()}`);
    state.listings = data.items || [];
    computeListingBuckets();
    renderHome();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderSellerCenter() {
  elements.sellerCenter.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = t('seller.centerTitle');
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
    <h3>${t('seller.newListing')}</h3>
    <label>${t('seller.form.titleAr')}<input name="titleAr" required /></label>
    <label>${t('seller.form.titleEn')}<input name="titleEn" /></label>
    <label>${t('seller.form.descriptionAr')}<textarea name="descriptionAr" rows="3" required></textarea></label>
    <label>${t('seller.form.descriptionEn')}<textarea name="descriptionEn" rows="3"></textarea></label>
    <label>${t('seller.form.category')}<select name="category">${state.categories
      .map((cat) => `<option value="${cat.id}">${cat.name[state.locale] || cat.name.ar}</option>`)
      .join('')}</select></label>
    <label>${t('seller.form.price')}<input name="priceSDG" type="number" required /></label>
    <label>${t('seller.form.city')}<select name="city">${state.cities
      .map((city) => `<option value="${city}">${city}</option>`)
      .join('')}</select></label>
    <label>${t('seller.form.condition')}<select name="condition">${Object.entries(t('conditions'))
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('')}</select></label>
    <label>${t('seller.form.photos')}<input name="photos" placeholder="https://" /></label>
    <label>${t('seller.form.tags')}<input name="tags" /></label>
    <div class="ai-suggestions" id="ai-suggestions"></div>
    <button type="submit" class="primary">${t('seller.form.submit')}</button>
  `;
  let suggestionTimer;
  form.addEventListener('input', () => {
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(async () => {
      const titleAr = form.elements['titleAr'].value;
      const descriptionAr = form.elements['descriptionAr'].value;
      if (!titleAr) return;
      try {
        const response = await request('/ai/listing-suggestions', {
          method: 'POST',
          body: {
            title: titleAr,
            description: descriptionAr,
            condition: form.elements['condition'].value,
            category: form.elements['category'].value,
            tags: (form.elements['tags'].value || '').split(',').map((tag) => tag.trim())
          }
        });
        const box = document.getElementById('ai-suggestions');
        box.innerHTML = '';
        if (response.categorySuggestion) {
          const cat = state.categories.find((item) => item.id === response.categorySuggestion);
          if (cat) {
            box.innerHTML += `<p>${t('seller.form.aiCategory')}: ${cat.name[state.locale] || cat.name.ar}</p>`;
          }
        }
        if (response.pricing && response.pricing.max) {
          box.innerHTML += `<p>${t('seller.form.aiPricing')}: ${formatNumber(response.pricing.min)} - ${formatNumber(response.pricing.max)} SDG</p>`;
        }
        if (response.qualityChecklist?.length) {
          const list = document.createElement('ul');
          list.className = 'checklist';
          response.qualityChecklist.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
          });
          box.appendChild(list);
        }
        if (response.moderation?.blocked) {
          box.innerHTML += `<p class="warning">${t('seller.form.moderationBlocked')}</p>`;
        }
      } catch (error) {
        // silent
      }
    }, 400);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      titleAr: formData.get('titleAr'),
      titleEn: formData.get('titleEn'),
      descriptionAr: formData.get('descriptionAr'),
      descriptionEn: formData.get('descriptionEn'),
      category: formData.get('category'),
      priceSDG: Number(formData.get('priceSDG')),
      city: formData.get('city'),
      condition: formData.get('condition'),
      photos: formData.get('photos') ? formData.get('photos').split(',').map((url) => url.trim()) : [],
      tags: formData.get('tags') ? formData.get('tags').split(',').map((tag) => tag.trim()) : [],
      storeId: state.currentUser?.store?.id || null
    };
    try {
      const result = await request('/listings', { method: 'POST', body: payload });
      showToast(t('seller.form.publishSuccess'), 'success');
      if (result.moderation?.blocked) {
        showToast(t('seller.form.moderationBlocked'), 'warning');
      }
      form.reset();
      loadSellerListings();
      refreshHome();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  const listingsContainer = document.createElement('div');
  listingsContainer.id = 'seller-listings';

  const storePromo = document.createElement('div');
  storePromo.className = 'promo-card';
  const costSDG = formatNumber((state.config.storeBumpUsd || 5) * (state.config.usdSdgRate || 600));
  storePromo.innerHTML = `
    <h3>${t('seller.storeBump')}</h3>
    <p>${t('seller.storeBumpDescription', { cost: costSDG })}</p>
    <button class="secondary" id="store-bump-button">${t('seller.storeBumpAction')}</button>
  `;
  const storeButton = storePromo.querySelector('button');
  if (!state.currentUser?.store?.id) {
    storeButton.disabled = true;
    storeButton.classList.add('disabled');
  } else {
    storeButton.addEventListener('click', async () => {
      try {
        await request('/promotions/store', {
          method: 'POST',
          body: { storeId: state.currentUser.store.id }
        });
        showToast(t('store.bumpSuccess'), 'success');
        loadSellerListings();
        refreshHome();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  elements.sellerCenter.appendChild(title);
  elements.sellerCenter.appendChild(form);
  elements.sellerCenter.appendChild(storePromo);
  elements.sellerCenter.appendChild(listingsContainer);
  loadSellerListings();
}

async function loadSellerListings() {
  if (!state.currentUser) return;
  const params = new URLSearchParams({ sellerId: state.currentUser.id, locale: state.locale, includeAll: 'true' });
  try {
    const data = await request(`/listings?${params.toString()}`);
    const container = document.getElementById('seller-listings');
    container.innerHTML = `<h3>${t('seller.listingsTitle')}</h3>`;
    if (!data.items?.length) {
      const p = document.createElement('p');
      p.textContent = t('app.status.empty');
      container.appendChild(p);
      return;
    }
    data.items.forEach((listing) => {
      const row = document.createElement('div');
      row.className = 'listing-row';
      row.innerHTML = `
        <div class="info">
          <strong>${listing.title}</strong>
          <span>${formatCurrencySDG(listing.priceSDG)}</span>
          <small>${t('orders.status')[listing.status] || listing.status}</small>
        </div>
      `;
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const bumpBtn = document.createElement('button');
      bumpBtn.className = 'secondary';
      bumpBtn.textContent = t('seller.bumpItem');
      bumpBtn.addEventListener('click', async () => {
        try {
          await request(`/listings/${listing.id}?action=bump`, { method: 'POST' });
          showToast(t('seller.bumpItem'), 'success');
          loadSellerListings();
          refreshHome();
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
      actions.appendChild(bumpBtn);
      row.appendChild(actions);
      container.appendChild(row);
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSellerCenter() {
  renderSellerCenter();
}

async function loadOrders() {
  if (!state.currentUser) return;
  try {
    const [bought, sold] = await Promise.all([
      request(`/orders?role=buyer&locale=${state.locale}`),
      request(`/orders?role=seller&locale=${state.locale}`)
    ]);
    state.orders.bought = bought.orders || [];
    state.orders.sold = sold.orders || [];
    renderOrders();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderOrders() {
  elements.ordersCenter.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = t('orders.title');
  const tabs = document.createElement('div');
  tabs.className = 'tab-row';
  const boughtBtn = document.createElement('button');
  boughtBtn.className = 'secondary';
  boughtBtn.textContent = t('orders.tabBought');
  const soldBtn = document.createElement('button');
  soldBtn.className = 'secondary';
  soldBtn.textContent = t('orders.tabSold');
  const table = document.createElement('div');
  table.className = 'orders-table';

  function renderList(list, role) {
    table.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.textContent = t('app.status.empty');
      table.appendChild(empty);
      return;
    }
    list.forEach((order) => {
      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = `
        <div class="order-head">
          <strong>${order.listing?.title || ''}</strong>
          <span>${formatCurrencySDG(order.priceSDG)}</span>
        </div>
        <div class="order-meta">
          <span>${t('orders.status')[order.status] || order.status}</span>
          <span>${new Date(order.createdAt).toLocaleString(state.locale)}</span>
        </div>
      `;
      const actions = document.createElement('div');
      actions.className = 'order-actions';
      if (order.status === 'PLACED' && role === 'seller') {
        const advanceBtn = document.createElement('button');
        advanceBtn.className = 'secondary';
        advanceBtn.textContent = t('orders.advance');
        advanceBtn.addEventListener('click', async () => {
          try {
            await request(`/orders/${order.id}/status`, {
              method: 'POST',
              body: { status: 'AWAITING_HANDOVER' }
            });
            showToast(t('orders.advance'), 'success');
            loadOrders();
          } catch (error) {
            showToast(error.message, 'error');
          }
        });
        actions.appendChild(advanceBtn);
      }
      if (order.status === 'AWAITING_HANDOVER' && role === 'buyer') {
        const otpInput = document.createElement('input');
        otpInput.placeholder = t('orders.otpPlaceholder');
        otpInput.style.marginInlineEnd = '0.5rem';
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'primary';
        confirmBtn.textContent = t('orders.confirmDelivery');
        confirmBtn.addEventListener('click', async () => {
          try {
            await request(`/orders/${order.id}/status`, {
              method: 'POST',
              body: { status: 'DELIVERED_CONFIRMED', otp: otpInput.value }
            });
            showToast(t('orders.confirmDelivery'), 'success');
            loadOrders();
          } catch (error) {
            showToast(error.message, 'error');
          }
        });
        actions.appendChild(otpInput);
        actions.appendChild(confirmBtn);
      }
      if (!['DISPUTED', 'RESOLVED'].includes(order.status)) {
        const disputeBtn = document.createElement('button');
        disputeBtn.className = 'secondary';
        disputeBtn.textContent = t('orders.openDispute');
        disputeBtn.addEventListener('click', () => openDisputeModal(order.id));
        actions.appendChild(disputeBtn);
      }
      card.appendChild(actions);
      const timeline = document.createElement('div');
      timeline.className = 'timeline';
      timeline.innerHTML = `<strong>${t('orders.timeline')}</strong>`;
      order.timeline.forEach((step) => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.textContent = `${t('orders.status')[step.status] || step.status} · ${new Date(step.at).toLocaleString(state.locale)}`;
        timeline.appendChild(item);
      });
      card.appendChild(timeline);
      table.appendChild(card);
    });
  }

  boughtBtn.addEventListener('click', () => {
    boughtBtn.classList.add('active');
    soldBtn.classList.remove('active');
    renderList(state.orders.bought, 'buyer');
  });
  soldBtn.addEventListener('click', () => {
    soldBtn.classList.add('active');
    boughtBtn.classList.remove('active');
    renderList(state.orders.sold, 'seller');
  });
  boughtBtn.classList.add('active');
  renderList(state.orders.bought, 'buyer');

  tabs.appendChild(boughtBtn);
  tabs.appendChild(soldBtn);

  elements.ordersCenter.appendChild(title);
  elements.ordersCenter.appendChild(tabs);
  elements.ordersCenter.appendChild(table);
}

function openDisputeModal(orderId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const content = document.createElement('div');
  content.className = 'modal-content';
  const close = document.createElement('button');
  close.className = 'modal-close';
  close.innerHTML = '&times;';
  close.addEventListener('click', () => modal.remove());
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
    <h3>${t('orders.openDispute')}</h3>
    <label>${t('orders.disputeReason')}<select name="reason">
      <option value="NOT_RECEIVED">${t('orders.status.DISPUTED')}</option>
      <option value="NOT_AS_DESCRIBED">${t('listing.report')}</option>
      <option value="DAMAGED">${t('orders.deliveryNotes')}</option>
    </select></label>
    <label>${t('orders.disputeEvidence')}<input name="evidence" /></label>
    <button type="submit" class="primary">${t('orders.submitDispute')}</button>
  `;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await request(`/orders/${orderId}/dispute`, {
        method: 'POST',
        body: {
          reason: formData.get('reason'),
          evidence: formData.get('evidence') ? formData.get('evidence').split(',').map((item) => item.trim()) : []
        }
      });
      showToast(t('orders.openDispute'), 'success');
      modal.remove();
      loadOrders();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  content.appendChild(close);
  content.appendChild(form);
  modal.appendChild(content);
  elements.modalLayer.innerHTML = '';
  elements.modalLayer.appendChild(modal);
}

async function loadWallet() {
  if (!state.currentUser) return;
  try {
    const wallet = await request('/wallet');
    state.wallet = wallet;
    renderWallet();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderWallet() {
  elements.walletCenter.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = t('wallet.title');
  const balance = document.createElement('div');
  balance.className = 'wallet-balance';
  balance.innerHTML = `<strong>${t('wallet.balance')}</strong><span>${formatCurrencySDG(state.wallet.balanceSDG)}</span>`;

  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
    <h3>${t('wallet.topUpTitle')}</h3>
    <label>${t('wallet.amount')}<input name="amount" type="number" required /></label>
    <label>${t('wallet.method')}<input name="method" required /></label>
    <label>${t('wallet.proof')}<input name="proof" /></label>
    <button type="submit" class="primary">${t('wallet.submitTopUp')}</button>
  `;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await request('/wallet/topup', {
        method: 'POST',
        body: {
          amountSDG: Number(formData.get('amount')),
          method: formData.get('method'),
          proofUrl: formData.get('proof')
        }
      });
      showToast(t('wallet.submitTopUp'), 'success');
      form.reset();
      loadWallet();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  const ledger = document.createElement('div');
  ledger.className = 'ledger-list';
  ledger.innerHTML = `<h3>${t('wallet.ledgerTitle')}</h3>`;
  if (!state.wallet.entries?.length) {
    const empty = document.createElement('p');
    empty.textContent = t('wallet.noEntries');
    ledger.appendChild(empty);
  } else {
    state.wallet.entries.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'ledger-item';
      const reasonLabel = t('wallet.reason')[entry.reason] || entry.reason;
      item.innerHTML = `
        <div>
          <strong>${reasonLabel}</strong>
          <div>${new Date(entry.createdAt).toLocaleString(state.locale)}</div>
        </div>
        <div>${entry.type === 'DEBIT' ? '-' : '+'}${formatCurrencySDG(entry.amountSDG)}</div>
      `;
      ledger.appendChild(item);
    });
  }

  elements.walletCenter.appendChild(title);
  elements.walletCenter.appendChild(balance);
  elements.walletCenter.appendChild(form);
  elements.walletCenter.appendChild(ledger);
}

async function loadNotifications() {
  if (!state.currentUser) return;
  try {
    const { notifications } = await request('/notifications');
    state.notifications = notifications;
    renderNotifications();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderNotifications() {
  elements.notificationsCenter.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = t('notifications.title');
  elements.notificationsCenter.appendChild(title);
  if (!state.notifications.length) {
    const empty = document.createElement('p');
    empty.textContent = t('notifications.empty');
    elements.notificationsCenter.appendChild(empty);
    return;
  }
  state.notifications.forEach((notif) => {
    const card = document.createElement('div');
    card.className = 'notification-card';
    card.innerHTML = `
      <strong>${notif.type}</strong>
      <p>${JSON.stringify(notif.payload)}</p>
      <span>${new Date(notif.createdAt).toLocaleString(state.locale)}</span>
    `;
    elements.notificationsCenter.appendChild(card);
  });
}

async function loadAdmin() {
  if (!state.currentUser?.roles?.includes('ADMIN')) {
    elements.adminCenter.innerHTML = `<p>${t('app.status.empty')}</p>`;
    return;
  }
  try {
    state.adminReport = await request('/admin/dashboard');
    renderAdmin();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderAdmin() {
  elements.adminCenter.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = t('admin.title');
  elements.adminCenter.appendChild(title);
  if (!state.adminReport) {
    return;
  }
  const metrics = document.createElement('div');
  metrics.className = 'metric-cards';
  const map = state.adminReport.metrics;
  const metricEntries = [
    { label: t('admin.metrics.bumpRevenue'), value: formatCurrencySDG(map.bumpRevenue) },
    { label: t('admin.metrics.gmv'), value: formatCurrencySDG(map.gmvCodExpected) },
    { label: t('admin.metrics.lag'), value: `${map.averageLagHours}h` },
    { label: t('admin.metrics.cancellationRate'), value: `${(map.cancellationRate * 100).toFixed(1)}%` },
    { label: t('admin.metrics.activeSellers'), value: map.dailyActiveSellers },
    { label: t('admin.metrics.usdRate'), value: map.usdSdgRate }
  ];
  metricEntries.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `<strong>${item.label}</strong><div>${item.value}</div>`;
    metrics.appendChild(card);
  });
  elements.adminCenter.appendChild(metrics);

  const flagged = document.createElement('div');
  flagged.innerHTML = `<h3>${t('admin.flaggedListings')}</h3>`;
  state.adminReport.flaggedListings.forEach((listing) => {
    const row = document.createElement('div');
    row.textContent = listing.title?.[state.locale] || listing.title?.ar || listing.title?.en;
    flagged.appendChild(row);
  });
  elements.adminCenter.appendChild(flagged);

  const moderation = document.createElement('div');
  moderation.innerHTML = `<h3>${t('admin.pendingModeration')}</h3>`;
  state.adminReport.pendingModeration.forEach((item) => {
    const row = document.createElement('div');
    row.textContent = `${item.listingId} · ${item.reason}`;
    moderation.appendChild(row);
  });
  elements.adminCenter.appendChild(moderation);

  const disputes = document.createElement('div');
  disputes.innerHTML = `<h3>${t('admin.openDisputes')}</h3>`;
  state.adminReport.openDisputes.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'dispute-row';
    row.innerHTML = `
      <strong>${item.orderId}</strong>
      <p>${item.reason}</p>
      <button class="secondary" data-id="${item.id}">${t('admin.resolveDispute')}</button>
    `;
    row.querySelector('button').addEventListener('click', () => openResolveDispute(item.id));
    disputes.appendChild(row);
  });
  elements.adminCenter.appendChild(disputes);

  const rateForm = document.createElement('form');
  rateForm.className = 'form-grid';
  rateForm.innerHTML = `
    <h3>${t('admin.updateRate')}</h3>
    <label>${t('admin.metrics.usdRate')}<input name="rate" type="number" value="${state.config.usdSdgRate}" /></label>
    <button class="secondary" type="submit">${t('app.actions.save')}</button>
  `;
  rateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const rate = Number(new FormData(rateForm).get('rate'));
    try {
      await request('/config', { method: 'PATCH', body: { usdSdgRate: rate } });
      showToast(t('app.actions.save'), 'success');
      await loadConfig();
      loadAdmin();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  elements.adminCenter.appendChild(rateForm);
}

function openResolveDispute(disputeId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const content = document.createElement('div');
  content.className = 'modal-content';
  const close = document.createElement('button');
  close.className = 'modal-close';
  close.innerHTML = '&times;';
  close.addEventListener('click', () => modal.remove());
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
    <h3>${t('admin.resolveDispute')}</h3>
    <label>${t('admin.resolutionPlaceholder')}<textarea name="resolution" rows="3" required></textarea></label>
    <label><input type="checkbox" name="refund" /> ${t('admin.buyerRefund')}</label>
    <button type="submit" class="primary">${t('admin.markResolved')}</button>
  `;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await request(`/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        body: {
          resolution: formData.get('resolution'),
          outcome: formData.get('refund') ? 'buyer_refund' : 'closed',
          orderStatus: formData.get('refund') ? 'CANCELLED' : 'RESOLVED'
        }
      });
      showToast(t('admin.markResolved'), 'success');
      modal.remove();
      loadAdmin();
      loadOrders();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  content.appendChild(close);
  content.appendChild(form);
  modal.appendChild(content);
  elements.modalLayer.innerHTML = '';
  elements.modalLayer.appendChild(modal);
}

async function loadConfig() {
  const config = await request('/config');
  state.config = config;
  state.categories = config.categories || [];
  state.cities = config.cities || [];
}

async function loadUsers() {
  const data = await request('/users');
  state.users = data.users || [];
  if (!state.currentUser) {
    state.currentUser = state.users[0];
  }
}

function renderApp() {
  renderHeader();
  renderLocaleSwitch();
  renderProfileMenu();
  renderNav();
  renderFooter();
  if (state.currentView === 'home') {
    renderHome();
  }
  if (state.currentView === 'seller') {
    renderSellerCenter();
  }
  if (state.currentView === 'orders') {
    renderOrders();
  }
  if (state.currentView === 'wallet') {
    renderWallet();
  }
  if (state.currentView === 'notifications') {
    renderNotifications();
  }
  if (state.currentView === 'admin') {
    renderAdmin();
  }
}

async function init() {
  try {
    await loadDictionaries();
    await loadConfig();
    await loadUsers();
    setDirection();
    renderApp();
    await refreshHome();
    elements.searchButton.addEventListener('click', () => {
      state.filters.query = elements.searchInput.value;
      refreshHome();
    });
    elements.searchInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        state.filters.query = elements.searchInput.value;
        refreshHome();
      }
    });
    elements.sellButton.addEventListener('click', () => switchView('seller'));
    elements.fab.addEventListener('click', () => switchView('seller'));
  } catch (error) {
    showToast(error.message, 'error');
  }
}

init();

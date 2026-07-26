/**
 * Bozor Top — Telegram WebApp
 * Katta bozorlarda qidiruv + do'kon egasi paneli
 */
(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor('#0b1220');
      tg.setBackgroundColor('#0b1220');
    } catch (_) { /* older clients */ }
  }

  const $ = (sel, el = document) => el.querySelector(sel);
  const view = $('#view');
  const pageTitle = $('#page-title');
  const pageSub = $('#page-sub');
  const btnBack = $('#btn-back');
  const toastEl = $('#toast');

  const state = {
    markets: [],
    selectedMarketId: null,
    route: { name: 'home', params: {} },
    history: [],
    me: null,
    searchQuery: '',
  };

  // ——— Utils ———

  function formatPrice(n) {
    const num = Number(n) || 0;
    return new Intl.NumberFormat('uz-UZ').format(num) + " so'm";
  }

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type = '') {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (type ? ` ${type}` : '');
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2800);
  }

  function haptic(type = 'light') {
    try {
      tg?.HapticFeedback?.impactOccurred(type);
    } catch (_) {}
  }

  function initDataHeader() {
    const headers = {};
    if (tg?.initData) {
      headers['X-Telegram-Init-Data'] = tg.initData;
    } else if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      headers['X-Dev-User'] = '100001';
    }
    return headers;
  }

  async function api(path, options = {}) {
    const opts = { ...options };
    opts.headers = { ...initDataHeader(), ...(opts.headers || {}) };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`/api${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'So\'rov muvaffaqiyatsiz');
    return data;
  }

  function phoneLink(phone) {
    const clean = String(phone).replace(/\s+/g, '');
    return `tel:${clean}`;
  }

  function iconPhone() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>`;
  }

  function iconPin() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  }

  function iconSearch() {
    return `<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`;
  }

  function iconChevron() {
    return `<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
  }

  function productThumb(p) {
    if (p.image_url) {
      return `<img src="${escapeHtml(p.image_url)}" alt="" loading="lazy" />`;
    }
    return `<span>${escapeHtml((p.name || '?').slice(0, 1))}</span>`;
  }

  // ——— Router ———

  function setHeader(title, sub, showBack = false) {
    pageTitle.textContent = title;
    pageSub.textContent = sub || '';
    btnBack.classList.toggle('hidden', !showBack);
  }

  function setNav(active) {
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.route === active);
    });
  }

  function navigate(name, params = {}, { push = true } = {}) {
    if (push && state.route.name) {
      state.history.push({ ...state.route });
    }
    state.route = { name, params };
    render();
  }

  function goBack() {
    haptic('light');
    const prev = state.history.pop();
    if (prev) {
      state.route = prev;
      render();
    } else {
      navigate('home', {}, { push: false });
    }
  }

  btnBack.addEventListener('click', goBack);

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      const route = btn.dataset.route;
      state.history = [];
      if (route === 'search') {
        navigate('search', { marketId: state.selectedMarketId }, { push: false });
      } else if (route === 'owner') {
        navigate('owner', {}, { push: false });
      } else {
        navigate('home', {}, { push: false });
      }
    });
  });

  // Hash routing for bot deep links
  function applyHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    if (hash === 'owner') {
      navigate('owner', {}, { push: false });
    } else if (hash.startsWith('market/')) {
      const id = Number(hash.split('/')[1]);
      if (id) navigate('market', { id }, { push: false });
    }
  }

  // ——— Views ———

  async function render() {
    const { name, params } = state.route;
    view.innerHTML = `<div class="loading"><div class="spinner"></div><span>Yuklanmoqda...</span></div>`;

    try {
      if (name === 'home') await renderHome();
      else if (name === 'market') await renderMarket(params.id);
      else if (name === 'search') await renderSearch(params.marketId, params.q);
      else if (name === 'shop') await renderShop(params.id);
      else if (name === 'product') await renderProduct(params.id);
      else if (name === 'owner') await renderOwner();
      else if (name === 'owner-create') await renderOwnerCreate();
      else if (name === 'owner-shop') await renderOwnerShop(params.id);
      else if (name === 'owner-product') await renderOwnerProduct(params.shopId, params.productId);
      else await renderHome();
    } catch (err) {
      view.innerHTML = `
        <div class="results-empty">
          <div class="empty-icon">!</div>
          <h4>Xatolik</h4>
          <p>${escapeHtml(err.message)}</p>
          <button type="button" class="btn btn-secondary mt-16" id="retry-btn">Qayta urinish</button>
        </div>`;
      $('#retry-btn')?.addEventListener('click', render);
    }
  }

  async function loadMarkets() {
    if (state.markets.length) return state.markets;
    const data = await api('/markets');
    state.markets = data.markets || [];
    if (!state.selectedMarketId && state.markets[0]) {
      state.selectedMarketId = state.markets[0].id;
    }
    return state.markets;
  }

  async function renderHome() {
    setNav('home');
    setHeader('Bozor Top', 'Katta bozorlarda qidirish', false);
    const markets = await loadMarkets();

    view.innerHTML = `
      <section class="hero">
        <div class="hero-kicker">Tezkor qidiruv</div>
        <h2>Nima kerak? Bozordan topamiz</h2>
        <p>Bozorni tanlang, kerakli narsani yozing — qaysi do'konlarda borligi, narxi va telefoni chiqadi.</p>
        <div class="stats-row">
          <div class="stat">
            <strong>${markets.length}</strong>
            <span>Katta bozor</span>
          </div>
          <div class="stat">
            <strong>${markets.reduce((s, m) => s + (m.shops_count || 0), 0)}</strong>
            <span>Do'kon</span>
          </div>
        </div>
      </section>

      <div class="section-head">
        <h3>Bozorlar</h3>
        <span>${markets.length} ta</span>
      </div>
      <div class="market-grid">
        ${markets.map((m) => `
          <button type="button" class="market-card" data-id="${m.id}">
            <div class="market-thumb">
              ${m.image_url
                ? `<img src="${escapeHtml(m.image_url)}" alt="" />`
                : escapeHtml(initials(m.name))}
            </div>
            <div class="market-info">
              <h4>${escapeHtml(m.name)}</h4>
              <p>${escapeHtml(m.description || m.address || m.city || '')}</p>
              <div class="market-meta">
                <span class="chip accent">${m.shops_count || 0} do'kon</span>
                <span class="chip">${escapeHtml(m.city || '')}</span>
              </div>
            </div>
            ${iconChevron()}
          </button>
        `).join('')}
      </div>
    `;

    view.querySelectorAll('.market-card').forEach((el) => {
      el.addEventListener('click', () => {
        haptic('light');
        const id = Number(el.dataset.id);
        state.selectedMarketId = id;
        navigate('market', { id });
      });
    });
  }

  async function renderMarket(id) {
    setNav('home');
    const data = await api(`/markets/${id}`);
    const { market, shops } = data;
    state.selectedMarketId = market.id;
    setHeader(market.name, market.city || 'Katta bozor', true);

    const popular = ["olma", "guruch", "non", "go'sht", "pomidor", "choy"];

    view.innerHTML = `
      <section class="hero" style="padding:16px;">
        <h2 style="font-size:1.2rem;margin-bottom:6px;">${escapeHtml(market.name)}</h2>
        <p>${escapeHtml(market.description || '')}</p>
        ${market.address ? `<p class="mt-8" style="font-size:0.85rem;">${escapeHtml(market.address)}</p>` : ''}
      </section>

      <div class="search-box">
        ${iconSearch()}
        <input type="search" id="market-q" placeholder="Nima qidiryapsiz? masalan: olma, guruch..." autocomplete="off" />
      </div>

      <div class="quick-tags" id="quick-tags">
        ${popular.map((t) => `<button type="button" class="tag-btn" data-q="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
      </div>

      <div class="section-head">
        <h3>Do'konlar</h3>
        <span>${shops.length} ta</span>
      </div>
      <div class="market-grid">
        ${shops.length ? shops.map((s) => `
          <button type="button" class="market-card" data-shop="${s.id}">
            <div class="market-thumb" style="background:linear-gradient(145deg,#1a2a40,#1e3a2f);">
              ${s.image_url
                ? `<img src="${escapeHtml(s.image_url)}" alt="" />`
                : escapeHtml(initials(s.name))}
            </div>
            <div class="market-info">
              <h4>${escapeHtml(s.name)}</h4>
              <p>${escapeHtml(s.address)}</p>
              <div class="market-meta">
                <span class="chip accent">${s.products_count || 0} mahsulot</span>
                <span class="chip">${escapeHtml(s.phone)}</span>
              </div>
            </div>
            ${iconChevron()}
          </button>
        `).join('') : `
          <div class="results-empty">
            <h4>Hali do'kon yo'q</h4>
            <p>Do'kon egasi bo'lsangiz, "Do'konim" bo'limidan qo'shing.</p>
          </div>
        `}
      </div>
    `;

    const input = $('#market-q');
    const goSearch = (q) => {
      const query = (q || input.value || '').trim();
      if (!query) return;
      navigate('search', { marketId: market.id, q: query });
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        goSearch();
      }
    });

    $('#quick-tags').addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-btn');
      if (!btn) return;
      haptic('light');
      goSearch(btn.dataset.q);
    });

    view.querySelectorAll('[data-shop]').forEach((el) => {
      el.addEventListener('click', () => {
        haptic('light');
        navigate('shop', { id: Number(el.dataset.shop) });
      });
    });
  }

  async function renderSearch(marketId, q = '') {
    setNav('search');
    const markets = await loadMarkets();
    const mid = Number(marketId) || state.selectedMarketId || markets[0]?.id;
    state.selectedMarketId = mid;
    const market = markets.find((m) => m.id === mid);
    setHeader('Qidiruv', market?.name || 'Bozor', true);

    view.innerHTML = `
      <select class="market-select" id="search-market">
        ${markets.map((m) => `
          <option value="${m.id}" ${m.id === mid ? 'selected' : ''}>${escapeHtml(m.name)} — ${escapeHtml(m.city || '')}</option>
        `).join('')}
      </select>
      <div class="search-box">
        ${iconSearch()}
        <input type="search" id="search-q" placeholder="Nima olmoqchisiz?" value="${escapeHtml(q || state.searchQuery)}" autocomplete="off" autofocus />
      </div>
      <div id="search-results">
        ${q ? `<div class="loading"><div class="spinner"></div></div>` : `
          <div class="results-empty">
            <div class="empty-icon">${iconSearch()}</div>
            <h4>Mahsulot qidiring</h4>
            <p>Masalan: olma, guruch, ko'ylak, choy...</p>
          </div>
        `}
      </div>
    `;

    const input = $('#search-q');
    const marketSelect = $('#search-market');
    const resultsEl = $('#search-results');
    let debounce;

    async function runSearch() {
      const query = input.value.trim();
      state.searchQuery = query;
      state.selectedMarketId = Number(marketSelect.value);
      if (!query) {
        resultsEl.innerHTML = `
          <div class="results-empty">
            <div class="empty-icon">${iconSearch()}</div>
            <h4>Mahsulot qidiring</h4>
            <p>Yozing va kerakli do'konlar chiqadi</p>
          </div>`;
        return;
      }
      resultsEl.innerHTML = `<div class="loading"><div class="spinner"></div><span>Qidirilmoqda...</span></div>`;
      try {
        const data = await api(`/markets/${state.selectedMarketId}/search?q=${encodeURIComponent(query)}`);
        renderSearchResults(resultsEl, data);
      } catch (err) {
        resultsEl.innerHTML = `<div class="results-empty"><h4>Xatolik</h4><p>${escapeHtml(err.message)}</p></div>`;
      }
    }

    function onInput() {
      clearTimeout(debounce);
      debounce = setTimeout(runSearch, 320);
    }

    input.addEventListener('input', onInput);
    marketSelect.addEventListener('change', runSearch);

    if (q) runSearch();
    else setTimeout(() => input.focus(), 100);
  }

  function renderSearchResults(container, data) {
    const { results, query } = data;
    if (!results.length) {
      container.innerHTML = `
        <div class="results-empty">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
          </div>
          <h4>Topilmadi</h4>
          <p>"${escapeHtml(query)}" bo'yicha bu bozorda mahsulot yo'q</p>
        </div>`;
      return;
    }

    const totalProducts = results.reduce((s, r) => s + r.products.length, 0);
    container.innerHTML = `
      <div class="section-head">
        <h3>Natijalar</h3>
        <span>${results.length} do'kon · ${totalProducts} mahsulot</span>
      </div>
      ${results.map((group) => `
        <article class="result-group">
          <div class="result-shop-head">
            <h4>${escapeHtml(group.shop_name)}</h4>
            <div class="shop-contacts">
              <div class="contact-row">${iconPin()}<span>${escapeHtml(group.shop_address)}</span></div>
              <div class="contact-row">${iconPhone()}<a href="${phoneLink(group.shop_phone)}">${escapeHtml(group.shop_phone)}</a></div>
            </div>
            <div class="action-row">
              <a class="btn btn-primary btn-sm" href="${phoneLink(group.shop_phone)}">Qo'ng'iroq</a>
              <button type="button" class="btn btn-secondary btn-sm" data-open-shop="${group.shop_id}">Do'kon</button>
            </div>
          </div>
          <div class="product-list">
            ${group.products.map((p) => `
              <button type="button" class="product-row" data-product="${p.id}">
                <div class="product-thumb">${productThumb(p)}</div>
                <div class="product-info">
                  <h5>${escapeHtml(p.name)}</h5>
                  <p>${escapeHtml(p.description || p.unit || '')}</p>
                </div>
                <div class="price-tag">
                  ${formatPrice(p.price)}
                  <small>/${escapeHtml(p.unit || 'dona')}</small>
                </div>
              </button>
            `).join('')}
          </div>
        </article>
      `).join('')}
    `;

    container.querySelectorAll('[data-open-shop]').forEach((el) => {
      el.addEventListener('click', () => navigate('shop', { id: Number(el.dataset.openShop) }));
    });
    container.querySelectorAll('[data-product]').forEach((el) => {
      el.addEventListener('click', () => {
        haptic('light');
        navigate('product', { id: Number(el.dataset.product) });
      });
    });
  }

  async function renderShop(id) {
    setNav('home');
    const data = await api(`/shops/${id}`);
    const { shop, products } = data;
    setHeader(shop.name, shop.market_name || "Do'kon", true);

    view.innerHTML = `
      <div class="detail-hero">
        <h2>${escapeHtml(shop.name)}</h2>
        <p class="muted">${escapeHtml(shop.description || shop.market_name || '')}</p>
        <div class="shop-contacts">
          <div class="contact-row">${iconPin()}<span>${escapeHtml(shop.address)}</span></div>
          <div class="contact-row">${iconPhone()}<a href="${phoneLink(shop.phone)}">${escapeHtml(shop.phone)}</a></div>
        </div>
        <div class="action-row">
          <a class="btn btn-primary" href="${phoneLink(shop.phone)}">Qo'ng'iroq qilish</a>
        </div>
      </div>
      <div class="section-head">
        <h3>Mahsulotlar</h3>
        <span>${products.length} ta</span>
      </div>
      ${products.length ? `
        <div class="product-grid">
          ${products.map((p) => `
            <button type="button" class="product-card" data-product="${p.id}">
              <div class="ph">${productThumb(p)}</div>
              <div class="body">
                <h5>${escapeHtml(p.name)}</h5>
                <div class="price-tag" style="text-align:left;font-size:0.88rem;">
                  ${formatPrice(p.price)}
                  <small style="display:inline;margin-left:4px;">/${escapeHtml(p.unit || 'dona')}</small>
                </div>
              </div>
            </button>
          `).join('')}
        </div>
      ` : `<div class="results-empty"><p>Mahsulotlar hali qo'shilmagan</p></div>`}
    `;

    view.querySelectorAll('[data-product]').forEach((el) => {
      el.addEventListener('click', () => navigate('product', { id: Number(el.dataset.product) }));
    });
  }

  async function renderProduct(id) {
    setNav('home');
    const { product } = await api(`/products/${id}`);
    setHeader(product.name, product.shop_name, true);

    view.innerHTML = `
      <div class="sheet">
        <div class="sheet-image">
          ${product.image_url
            ? `<img src="${escapeHtml(product.image_url)}" alt="" />`
            : `<span>Rasm yo'q</span>`}
        </div>
        <div class="sheet-body">
          <h2>${escapeHtml(product.name)}</h2>
          <div class="price-tag" style="font-size:1.25rem;text-align:left;margin:8px 0 12px;">
            ${formatPrice(product.price)}
            <small style="display:inline;margin-left:6px;">/ ${escapeHtml(product.unit || 'dona')}</small>
          </div>
          ${product.description ? `<p class="text-secondary mb-16">${escapeHtml(product.description)}</p>` : ''}
          <div class="form-card" style="margin:0;padding:12px;">
            <h3 style="font-size:0.95rem;margin-bottom:10px;">${escapeHtml(product.shop_name)}</h3>
            <div class="shop-contacts">
              <div class="contact-row">${iconPin()}<span>${escapeHtml(product.shop_address)}</span></div>
              <div class="contact-row">${iconPhone()}<a href="${phoneLink(product.shop_phone)}">${escapeHtml(product.shop_phone)}</a></div>
            </div>
          </div>
          <div class="action-row mt-16">
            <a class="btn btn-primary btn-block" href="${phoneLink(product.shop_phone)}">Do'konga qo'ng'iroq</a>
            <button type="button" class="btn btn-secondary btn-block" id="goto-shop">Do'kon sahifasi</button>
          </div>
        </div>
      </div>
    `;

    $('#goto-shop').addEventListener('click', () => navigate('shop', { id: product.shop_id }));
  }

  // ——— Owner panel ———

  async function renderOwner() {
    setNav('owner');
    setHeader("Mening do'konim", "Do'kon va mahsulotlar", false);

    let me;
    try {
      me = await api('/me');
      state.me = me;
    } catch (err) {
      view.innerHTML = `
        <div class="results-empty">
          <h4>Kirish kerak</h4>
          <p>Bu bo'lim Telegram bot orqali ochilganda ishlaydi. Lokal test uchun dev rejim yoqilgan.</p>
          <p class="text-muted mt-8">${escapeHtml(err.message)}</p>
        </div>`;
      return;
    }

    const shops = me.shops || [];
    view.innerHTML = `
      <section class="hero" style="padding:16px;">
        <div class="hero-kicker">Do'kon egasi</div>
        <h2 style="font-size:1.2rem;">${escapeHtml(me.user.first_name || 'Salom')}</h2>
        <p>Do'koningizni qo'shing, mahsulotlar (rasm + narx) kiriting. Xaridorlar qidiruvda sizni topadi.</p>
      </section>

      <button type="button" class="btn btn-primary btn-block mb-16" id="btn-new-shop">+ Yangi do'kon ochish</button>

      <div class="section-head">
        <h3>Do'konlarim</h3>
        <span>${shops.length} ta</span>
      </div>
      ${shops.length ? shops.map((s) => `
        <div class="owner-shop">
          <h4>${escapeHtml(s.name)}</h4>
          <p>${escapeHtml(s.market_name)} · ${escapeHtml(s.address)} · ${escapeHtml(s.phone)}</p>
          <div class="owner-actions">
            <button type="button" class="btn btn-primary btn-sm" data-manage="${s.id}">Mahsulotlar</button>
            <button type="button" class="btn btn-secondary btn-sm" data-view="${s.id}">Ko'rish</button>
          </div>
        </div>
      `).join('') : `
        <div class="results-empty">
          <h4>Do'kon yo'q</h4>
          <p>Yuqoridagi tugma orqali bozorga do'kon qo'shing</p>
        </div>
      `}
    `;

    $('#btn-new-shop').addEventListener('click', () => navigate('owner-create'));
    view.querySelectorAll('[data-manage]').forEach((el) => {
      el.addEventListener('click', () => navigate('owner-shop', { id: Number(el.dataset.manage) }));
    });
    view.querySelectorAll('[data-view]').forEach((el) => {
      el.addEventListener('click', () => navigate('shop', { id: Number(el.dataset.view) }));
    });
  }

  async function renderOwnerCreate() {
    setNav('owner');
    setHeader('Yangi do\'kon', 'Ma\'lumotlarni to\'ldiring', true);
    const markets = await loadMarkets();

    view.innerHTML = `
      <form class="form-card" id="shop-form">
        <h3>Do'kon ma'lumotlari</h3>
        <div class="field">
          <label>Bozor *</label>
          <select name="marketId" required>
            ${markets.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Do'kon nomi *</label>
          <input name="name" required placeholder="Masalan: Sifat Meva" maxlength="80" />
        </div>
        <div class="field">
          <label>Telefon raqam *</label>
          <input name="phone" required type="tel" placeholder="+99890..." maxlength="20" />
        </div>
        <div class="field">
          <label>Do'kon manzili (bozor ichida) *</label>
          <input name="address" required placeholder="12-qator, 5-do'kon" maxlength="120" />
        </div>
        <div class="field">
          <label>Qisqa tavsif</label>
          <textarea name="description" placeholder="Nima sotasiz?" maxlength="300"></textarea>
        </div>
        <div class="field">
          <label>Do'kon rasmi (ixtiyoriy)</label>
          <div class="file-drop" id="shop-file-drop">
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" />
            <span id="shop-file-label">Rasm tanlash</span>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Saqlash</button>
      </form>
    `;

    const form = $('#shop-form');
    const fileInput = form.querySelector('input[type=file]');
    const drop = $('#shop-file-drop');
    const label = $('#shop-file-label');

    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      drop.classList.add('has-preview');
      drop.innerHTML = '';
      drop.appendChild(fileInput);
      const img = document.createElement('img');
      img.src = url;
      drop.appendChild(img);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Saqlanmoqda...';
      try {
        await api('/shops', { method: 'POST', body: fd });
        haptic('medium');
        toast("Do'kon yaratildi", 'success');
        navigate('owner', {}, { push: false });
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Saqlash';
      }
    });
  }

  async function renderOwnerShop(shopId) {
    setNav('owner');
    const data = await api(`/shops/${shopId}`);
    const { shop, products } = data;
    setHeader(shop.name, 'Mahsulotlar boshqaruvi', true);

    view.innerHTML = `
      <div class="detail-hero" style="padding:14px;">
        <p class="muted" style="margin:0;">${escapeHtml(shop.address)} · ${escapeHtml(shop.phone)}</p>
      </div>
      <button type="button" class="btn btn-primary btn-block mb-16" id="btn-add-product">+ Mahsulot qo'shish</button>
      <div class="section-head">
        <h3>Mahsulotlar</h3>
        <span>${products.length} ta</span>
      </div>
      ${products.length ? `
        <div class="stack">
          ${products.map((p) => `
            <div class="owner-shop" style="display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;">
              <div class="product-thumb" style="width:56px;height:56px;">${productThumb(p)}</div>
              <div>
                <h4 style="margin-bottom:2px;">${escapeHtml(p.name)}</h4>
                <p style="margin-bottom:8px;">${formatPrice(p.price)} / ${escapeHtml(p.unit)}</p>
                <div class="owner-actions">
                  <button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}">Tahrir</button>
                  <button type="button" class="btn btn-danger btn-sm" data-del="${p.id}">O'chirish</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `<div class="results-empty"><p>Hali mahsulot yo'q. Rasm va narx bilan qo'shing.</p></div>`}
    `;

    $('#btn-add-product').addEventListener('click', () => {
      navigate('owner-product', { shopId, productId: null });
    });

    view.querySelectorAll('[data-edit]').forEach((el) => {
      el.addEventListener('click', () => {
        navigate('owner-product', { shopId, productId: Number(el.dataset.edit) });
      });
    });

    view.querySelectorAll('[data-del]').forEach((el) => {
      el.addEventListener('click', async () => {
        if (!confirm("Mahsulotni o'chirasizmi?")) return;
        try {
          await api(`/products/${el.dataset.del}`, { method: 'DELETE' });
          toast("O'chirildi", 'success');
          renderOwnerShop(shopId);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  async function renderOwnerProduct(shopId, productId) {
    setNav('owner');
    let product = null;
    if (productId) {
      const data = await api(`/products/${productId}`);
      product = data.product;
    }
    setHeader(product ? 'Tahrirlash' : 'Yangi mahsulot', "Rasm va narx", true);

    view.innerHTML = `
      <form class="form-card" id="product-form">
        <h3>${product ? 'Mahsulotni yangilash' : "Mahsulot qo'shish"}</h3>
        <div class="field">
          <label>Nomi *</label>
          <input name="name" required maxlength="100" value="${escapeHtml(product?.name || '')}" placeholder="Masalan: Olma (qizil)" />
        </div>
        <div class="field">
          <label>Narxi (so'm) *</label>
          <input name="price" required type="number" min="0" step="100" value="${product?.price ?? ''}" placeholder="12000" />
        </div>
        <div class="field">
          <label>Birlik</label>
          <select name="unit">
            ${['kg', 'dona', 'juft', 'litr', 'komplekt', 'qop'].map((u) => `
              <option value="${u}" ${(product?.unit || 'dona') === u ? 'selected' : ''}>${u}</option>
            `).join('')}
          </select>
        </div>
        <div class="field">
          <label>Tavsif</label>
          <textarea name="description" maxlength="400" placeholder="Sifat, kelib chiqishi...">${escapeHtml(product?.description || '')}</textarea>
        </div>
        <div class="field">
          <label>Rasm ${product ? '(yangi tanlasangiz almashtiriladi)' : '*'}</label>
          <div class="file-drop ${product?.image_url ? 'has-preview' : ''}" id="prod-file-drop">
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" ${product ? '' : ''} />
            ${product?.image_url
              ? `<img src="${escapeHtml(product.image_url)}" alt="" id="prod-preview" />`
              : `<span id="prod-file-label">Mahsulot rasmini tanlang</span>`}
          </div>
          <p class="field-hint">JPG, PNG yoki WebP · max 5 MB</p>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Saqlash</button>
      </form>
    `;

    const form = $('#product-form');
    const fileInput = form.querySelector('input[type=file]');
    const drop = $('#prod-file-drop');

    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      drop.classList.add('has-preview');
      const oldImg = drop.querySelector('img');
      const oldSpan = drop.querySelector('span');
      if (oldImg) oldImg.remove();
      if (oldSpan) oldSpan.remove();
      const img = document.createElement('img');
      img.src = url;
      drop.appendChild(img);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      if (!productId) {
        fd.append('shopId', shopId);
      }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Saqlanmoqda...';
      try {
        if (productId) {
          await api(`/products/${productId}`, { method: 'PATCH', body: fd });
        } else {
          await api('/products', { method: 'POST', body: fd });
        }
        haptic('medium');
        toast('Saqlandi', 'success');
        navigate('owner-shop', { id: shopId }, { push: false });
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Saqlash';
      }
    });
  }

  // ——— Boot ———

  async function boot() {
    try {
      await loadMarkets();
    } catch (err) {
      console.warn('Markets load failed', err);
    }
    applyHash();
    if (!location.hash) {
      navigate('home', {}, { push: false });
    }
  }

  boot();
})();

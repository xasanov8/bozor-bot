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

  const t = (key, vars) => (window.I18N ? window.I18N.t(key, vars) : key);

  function syncLangButtons() {
    const lang = window.I18N?.getLang?.() || 'uz';
    document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  function applyStaticI18n() {
    window.I18N?.applyDom?.(document);
    syncLangButtons();
  }

  function bindLangSwitch() {
    document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
      if (btn._langBound) return;
      btn._langBound = true;
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        if (!next || next === window.I18N?.getLang?.()) return;
        window.I18N.setLang(next);
        applyStaticI18n();
        // joriy sahifani qayta chizish
        if (typeof render === 'function') render();
      });
    });
  }

  const $ = (sel, el = document) => el.querySelector(sel);
  const view = $('#view');
  const pageTitle = $('#page-title');
  const pageSub = $('#page-sub');
  const btnBack = $('#btn-back');
  const btnChatTop = $('#btn-chat-top');
  const chatBadge = $('#chat-badge');
  const toastEl = $('#toast');
  let chatPollTimer = null;
  let unreadPollTimer = null;
  let lastUnreadSnapshot = '';
  let lastSupportUnreadSnap = '';

  function stopChatPoll() {
    if (chatPollTimer) {
      clearInterval(chatPollTimer);
      chatPollTimer = null;
    }
  }

  const OWNER_TOKEN_KEY = 'bozor_owner_token';
  const ROLE_KEY = 'bozor_session_role'; // session — har WebApp ochilganda qayta so'raladi
  const FAV_KEY = 'bozor_favorites';
  const CART_KEY = 'bozor_cart';

  const state = {
    markets: [],
    selectedMarketId: null,
    route: { name: 'role', params: {} },
    history: [],
    me: null,
    searchQuery: '',
    ownerToken: localStorage.getItem(OWNER_TOKEN_KEY) || '',
    role: sessionStorage.getItem(ROLE_KEY) || null, // 'buyer' | 'owner'
    favorites: [],
    cart: [],
  };

  function loadStore() {
    try {
      state.favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      if (!Array.isArray(state.favorites)) state.favorites = [];
    } catch {
      state.favorites = [];
    }
    try {
      state.cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(state.cart)) state.cart = [];
    } catch {
      state.cart = [];
    }
  }
  loadStore();

  function saveFavorites() {
    localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartBadge();
  }

  function updateCartBadge() {
    const badge = $('#cart-badge');
    if (!badge) return;
    const n = state.cart.reduce((s, i) => s + (i.qty || 1), 0);
    badge.textContent = String(n);
    badge.classList.toggle('hidden', n === 0);
  }

  function isFavorite(productId) {
    return state.favorites.some((f) => Number(f.id) === Number(productId));
  }

  function productSnapshot(p, extra = {}) {
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      unit: p.unit || 'dona',
      image_url: p.image_url || null,
      shop_id: p.shop_id || extra.shop_id || null,
      shop_name: p.shop_name || extra.shop_name || '',
      shop_phone: p.shop_phone || extra.shop_phone || '',
      shop_address: p.shop_address || extra.shop_address || '',
    };
  }

  function assertBuyerAction() {
    if (state.role === 'owner') {
      toast(t('owner_no_fav'), 'error');
      return false;
    }
    return true;
  }

  function toggleFavorite(p, extra = {}) {
    if (!assertBuyerAction()) return false;
    const id = Number(p.id);
    if (isFavorite(id)) {
      state.favorites = state.favorites.filter((f) => Number(f.id) !== id);
      saveFavorites();
      toast(t('fav_removed'));
      return false;
    }
    state.favorites.unshift(productSnapshot(p, extra));
    saveFavorites();
    toast(t('fav_added'), 'success');
    return true;
  }

  function addToCart(p, extra = {}) {
    if (!assertBuyerAction()) return;
    const id = Number(p.id);
    const existing = state.cart.find((c) => Number(c.id) === id);
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      state.cart.unshift({ ...productSnapshot(p, extra), qty: 1 });
    }
    saveCart();
    toast(t('cart_added'), 'success');
    haptic('light');
  }

  function setCartQty(productId, qty) {
    const item = state.cart.find((c) => Number(c.id) === Number(productId));
    if (!item) return;
    item.qty = Math.max(1, Number(qty) || 1);
    saveCart();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter((c) => Number(c.id) !== Number(productId));
    saveCart();
  }

  function marketLabel(name) {
    const n = String(name || '').trim();
    if (!n) return '';
    if (/bozori$/i.test(n)) return n;
    return `${n.replace(/\s*bozor$/i, '').trim()} bozori`;
  }

  function favBtnHtml(productId) {
    const on = isFavorite(productId);
    return `<button type="button" class="icon-chip ${on ? 'on' : ''}" data-fav="${productId}" aria-label="Sevimli">${on ? '♥' : '♡'}</button>`;
  }

  function cartBtnHtml(productId) {
    return `<button type="button" class="icon-chip cart" data-cart="${productId}" aria-label="Savat">+</button>`;
  }

  function setRole(role) {
    state.role = role;
    if (role) sessionStorage.setItem(ROLE_KEY, role);
    else sessionStorage.removeItem(ROLE_KEY);
    applyRoleChrome();
  }

  /** Chiqish: token o'chadi — qayta telefon/parol majburiy */
  function clearOwnerSession() {
    state.ownerToken = '';
    state.me = null;
    localStorage.removeItem(OWNER_TOKEN_KEY);
    sessionStorage.removeItem(OWNER_TOKEN_KEY);
  }

  function showOwnerLoginForm(message) {
    setNav('owner');
    setHeader(t('owner_login_title'), t('owner_login_sub'), false);
    applyRoleChrome();
    view.innerHTML = `
      <div class="form-card">
        <h3>${escapeHtml(t('owner_login_h'))}</h3>
        <p class="text-secondary mb-16">${escapeHtml(message || t('owner_login_hint'))}</p>
        <div class="field"><label>${escapeHtml(t('phone'))}</label><input id="own-phone" type="tel" placeholder="+99890..." autocomplete="tel" /></div>
        <div class="field"><label>${escapeHtml(t('password'))}</label><input id="own-pass" type="password" placeholder="${escapeHtml(t('password'))}" autocomplete="current-password" /></div>
        <button type="button" class="btn btn-primary btn-block" id="own-login">${escapeHtml(t('login'))}</button>
        <p class="mt-8" id="own-login-err" style="color:#fca5a5;font-size:0.88rem;" hidden></p>
        <button type="button" class="btn btn-ghost btn-block mt-12" id="back-role">${escapeHtml(t('change_role'))}</button>
      </div>`;
    $('#back-role')?.addEventListener('click', () => {
      clearOwnerSession();
      setRole(null);
      navigate('role', {}, { push: false });
    });
    $('#own-login')?.addEventListener('click', async () => {
      const errEl = $('#own-login-err');
      errEl.hidden = true;
      try {
        const body = {
          phone: $('#own-phone').value,
          password: $('#own-pass').value,
        };
        if (tg?.initDataUnsafe?.user?.id) {
          body.telegramId = String(tg.initDataUnsafe.user.id);
        }
        const data = await api('/owner/login', { method: 'POST', body });
        state.ownerToken = data.token;
        localStorage.setItem(OWNER_TOKEN_KEY, data.token);
        setRole('owner');
        toast(t('logged_in'), 'success');
        navigate('owner', {}, { push: false });
      } catch (ex) {
        errEl.textContent = ex.message;
        errEl.hidden = false;
      }
    });
  }

  function applyRoleChrome() {
    const nav = $('#bottom-nav');
    if (!nav) return;
    if (!state.role || state.route?.name === 'role') {
      nav.classList.add('hidden');
      btnChatTop?.classList.add('hidden');
      return;
    }
    nav.classList.remove('hidden');
    nav.querySelectorAll('.nav-item').forEach((el) => {
      const roles = (el.dataset.roles || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!roles.length) {
        el.classList.remove('hidden');
        return;
      }
      el.classList.toggle('hidden', !roles.includes(state.role));
    });
    // Chat ikonkasi: egasi (token bilan) yoki xaridor
    if (btnChatTop) {
      const show =
        (state.role === 'owner' && !!state.ownerToken) ||
        state.role === 'buyer';
      btnChatTop.classList.toggle('hidden', !show);
    }
    updateCartBadge();
    refreshChatBadge();
    refreshSupportBadge();
  }

  btnChatTop?.addEventListener('click', () => {
    haptic('light');
    if (state.role === 'owner' && state.ownerToken) {
      navigate('owner-chats', {}, { push: true });
    } else if (state.role === 'buyer') {
      navigate('chats', {}, { push: true });
    }
  });

  async function refreshChatBadge() {
    if (!btnChatTop || !chatBadge) return;
    if (!state.role || state.route?.name === 'role') {
      chatBadge.classList.add('hidden');
      return;
    }
    try {
      let data;
      if (state.role === 'owner' && state.ownerToken) {
        data = await api('/owner/chats/unread');
      } else if (state.role === 'buyer') {
        data = await api('/chats/unread');
      } else {
        chatBadge.classList.add('hidden');
        return;
      }
      const total = Number(data.total || 0);
      chatBadge.textContent = total > 99 ? '99+' : String(total);
      chatBadge.classList.toggle('hidden', total <= 0);

      // Yangi xabar kelganda qisqa eslatma (kim nechta)
      const snap = JSON.stringify(data.threads || []);
      if (lastUnreadSnapshot && snap !== lastUnreadSnapshot && total > 0 && data.threads?.length) {
        const parts = data.threads.slice(0, 3).map((t) => `${t.name}: ${t.unread}`);
        toast(`Yangi xabar · ${parts.join(' · ')}`, 'success');
      }
      lastUnreadSnapshot = snap;
    } catch (_) {
      /* ignore */
    }
  }

  async function refreshSupportBadge() {
    const badge = $('#support-badge');
    if (!badge) return;
    if (!state.role || state.route?.name === 'role') {
      badge.classList.add('hidden');
      return;
    }
    try {
      const data = await api('/support/unread');
      const total = Number(data.total || 0);
      badge.textContent = total > 99 ? '99+' : String(total);
      badge.classList.toggle('hidden', total <= 0);
      const snap = `${total}|${data.thread_id || ''}|${data.last_message || ''}`;
      if (
        lastSupportUnreadSnap &&
        snap !== lastSupportUnreadSnap &&
        total > 0 &&
        state.route?.name !== 'support'
      ) {
        toast(t('support_new'), 'success');
      }
      lastSupportUnreadSnap = snap;
    } catch (_) {
      badge.classList.add('hidden');
    }
  }

  function startUnreadPolling() {
    if (unreadPollTimer) clearInterval(unreadPollTimer);
    refreshChatBadge();
    refreshSupportBadge();
    unreadPollTimer = setInterval(() => {
      if (!document.hidden) {
        refreshChatBadge();
        refreshSupportBadge();
      }
    }, 3000);
  }

  function captureOwnerTokenFromUrl() {
    try {
      const hash = location.hash || '';
      // #/owner?token=...
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(hash.slice(qIndex + 1));
        const t = params.get('token');
        if (t) {
          state.ownerToken = t;
          localStorage.setItem(OWNER_TOKEN_KEY, t);
          // clean token from address bar
          const clean = hash.slice(0, qIndex);
          history.replaceState(null, '', `${location.pathname}${location.search}${clean}`);
        }
      }
      const searchParams = new URLSearchParams(location.search);
      const t2 = searchParams.get('token');
      if (t2) {
        state.ownerToken = t2;
        localStorage.setItem(OWNER_TOKEN_KEY, t2);
      }
    } catch (_) {}
  }
  captureOwnerTokenFromUrl();

  // ——— Utils ———

  function formatPrice(n) {
    const num = Number(n) || 0;
    const locale = window.I18N?.getLang?.() === 'ru' ? 'ru-RU' : 'uz-UZ';
    return new Intl.NumberFormat(locale).format(num) + ' ' + t('som');
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
    } else if (
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
      !state.ownerToken
    ) {
      headers['X-Dev-User'] = '100001';
    }
    if (state.ownerToken) {
      headers.Authorization = `Bearer ${state.ownerToken}`;
      headers['X-Owner-Token'] = state.ownerToken;
    }
    return headers;
  }

  async function api(path, options = {}) {
    const opts = { ...options };
    opts.headers = {
      // ngrok free interstitial sahifasini o'tkazib yuborish
      'ngrok-skip-browser-warning': '1',
      Accept: 'application/json',
      ...initDataHeader(),
      ...(opts.headers || {}),
    };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`/api${path}`, opts);
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // HTML (ngrok warning) yoki boshqa non-JSON
      throw new Error("Server javobi noto'g'ri. Qayta urinib ko'ring.");
    }
    if (!res.ok) throw new Error(data.error || "So'rov muvaffaqiyatsiz");
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

  let renderSeq = 0;

  function navigate(name, params = {}, { push = true } = {}) {
    stopChatPoll();
    if (push && state.route.name) {
      state.history.push({ ...state.route });
    }
    state.route = { name, params };
    return render();
  }

  function goBack() {
    haptic('light');
    const prev = state.history.pop();
    if (prev) {
      state.route = prev;
      return render();
    }
    return navigate('home', {}, { push: false });
  }

  btnBack.addEventListener('click', goBack);

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      const route = btn.dataset.route;
      state.history = [];
      if (route === 'search') {
        if (state.role !== 'buyer') setRole('buyer');
        navigate('search', { marketId: state.selectedMarketId }, { push: false });
      } else if (route === 'favorites') {
        if (state.role === 'owner') {
          toast(t('fav_buyer_only'), 'error');
          return;
        }
        if (state.role !== 'buyer') setRole('buyer');
        navigate('favorites', {}, { push: false });
      } else if (route === 'cart') {
        if (state.role === 'owner') {
          toast(t('cart_buyer_only'), 'error');
          return;
        }
        if (state.role !== 'buyer') setRole('buyer');
        navigate('cart', {}, { push: false });
      } else if (route === 'owner') {
        if (state.role !== 'owner') setRole('owner');
        navigate('owner', {}, { push: false });
      } else if (route === 'support') {
        navigate('support', {}, { push: false });
      } else {
        if (state.role !== 'buyer') setRole('buyer');
        navigate('home', {}, { push: false });
      }
    });
  });

  // Hash routing for bot deep links. true = marshrut tanlandi
  function routeFromHash() {
    captureOwnerTokenFromUrl();
    const raw = (location.hash || '').replace(/^#\/?/, '').trim();
    const hash = raw.split('?')[0];
    if (!hash) return false;
    if (hash === 'owner' || hash.startsWith('owner')) {
      setRole('owner');
      navigate('owner', {}, { push: false });
      return true;
    }
    if (hash.startsWith('market/')) {
      const id = Number(hash.split('/')[1]);
      if (id) {
        setRole('buyer');
        navigate('market', { id }, { push: false });
        return true;
      }
    }
    return false;
  }

  // ——— Views ———

  function setChatMode(on) {
    view.classList.toggle('chat-mode', !!on);
  }

  async function render() {
    const seq = ++renderSeq;
    const { name, params } = state.route;
    setChatMode(false);
    view.innerHTML = `<div class="loading"><div class="spinner"></div><span>${t('loading')}</span></div>`;

    try {
      if (name === 'role') await renderRoleGate();
      else if (name === 'home') await renderHome();
      else if (name === 'market') await renderMarket(params.id);
      else if (name === 'search') await renderSearch(params.marketId, params.q);
      else if (name === 'shop') await renderShop(params.id);
      else if (name === 'product') await renderProduct(params.id);
      else if (name === 'favorites') await renderFavorites();
      else if (name === 'cart') await renderCart();
      else if (name === 'chat') await renderChat(params.shopId, params.threadId, params.shopName);
      else if (name === 'chats') await renderChatsList();
      else if (name === 'owner-chats') await renderOwnerChatsList();
      else if (name === 'owner-chat') await renderOwnerChat(params.threadId);
      else if (name === 'support') await renderSupport();
      else if (name === 'owner') await renderOwner();
      else if (name === 'owner-create') await renderOwnerCreate();
      else if (name === 'owner-shop') await renderOwnerShop(params.id);
      else if (name === 'owner-product') await renderOwnerProduct(params.shopId, params.productId);
      else await renderRoleGate();
    } catch (err) {
      if (seq !== renderSeq) return;
      view.innerHTML = `
        <div class="results-empty">
          <div class="empty-icon">!</div>
          <h4>${t('error')}</h4>
          <p>${escapeHtml(err.message)}</p>
          <button type="button" class="btn btn-secondary mt-16" id="retry-btn">Qayta urinish</button>
        </div>`;
      $('#retry-btn')?.addEventListener('click', () => {
        state.markets = [];
        render();
      });
    }
  }

  async function renderRoleGate() {
    setHeader(t('role_title'), t('role_sub'), false);
    applyRoleChrome();
    view.innerHTML = `
      <section class="role-gate">
        <div class="role-hero">
          <div class="hero-kicker">${escapeHtml(t('role_title'))}</div>
          <h2>${escapeHtml(t('role_sub'))}</h2>
          <p>${escapeHtml(t('role_pick'))}</p>
        </div>
        <button type="button" class="role-card buyer" id="role-buyer">
          <div class="role-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/></svg>
          </div>
          <div class="role-text">
            <h3>${escapeHtml(t('role_buyer'))}</h3>
            <p>${escapeHtml(t('role_buyer_desc'))}</p>
          </div>
          ${iconChevron()}
        </button>
        <button type="button" class="role-card owner" id="role-owner">
          <div class="role-icon owner" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l1-4h16l1 4"/><path d="M4 9v11h16V9"/><path d="M9 13h6"/></svg>
          </div>
          <div class="role-text">
            <h3>${escapeHtml(t('role_owner'))}</h3>
            <p>${escapeHtml(t('role_owner_desc'))}</p>
          </div>
          ${iconChevron()}
        </button>
      </section>
    `;

    $('#role-buyer')?.addEventListener('click', () => {
      haptic('medium');
      setRole('buyer');
      state.history = [];
      navigate('home', {}, { push: false });
    });
    $('#role-owner')?.addEventListener('click', () => {
      haptic('medium');
      // Egasi savat/sevimlidan foydalanmasin
      setRole('owner');
      state.history = [];
      navigate('owner', {}, { push: false });
    });
  }

  async function loadMarkets(force = false) {
    if (!force && state.markets.length) return state.markets;

    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const data = await api('/markets');
        const list = Array.isArray(data.markets) ? data.markets : null;
        if (!list) throw new Error("Bozorlar ro'yxati kelmadi");
        state.markets = list;
        if (!state.selectedMarketId && state.markets[0]) {
          state.selectedMarketId = state.markets[0].id;
        }
        return state.markets;
      } catch (err) {
        lastErr = err;
        // qisqa kutib qayta urinish (ngrok / tarmoq)
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
    throw lastErr || new Error("Bozorlarni yuklab bo'lmadi");
  }

  async function renderHome() {
    if (state.role !== 'buyer') {
      return navigate('role', {}, { push: false });
    }
    setNav('home');
    setHeader(t('home_title'), t('home_sub'), false);
    applyRoleChrome();
    const markets = await loadMarkets(true);

    view.innerHTML = `
      <section class="hero">
        <div class="hero-kicker">${escapeHtml(t('search_title'))}</div>
        <h2>${escapeHtml(t('home_hero'))}</h2>
        <p>${escapeHtml(t('home_hero_sub'))}</p>
        <div class="stats-row">
          <div class="stat">
            <strong>${markets.length}</strong>
            <span>${escapeHtml(t('market_big'))}</span>
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
        ${markets.length ? markets.map((m) => `
          <button type="button" class="market-card" data-id="${m.id}">
            <div class="market-thumb">
              ${m.image_url
                ? `<img src="${escapeHtml(m.image_url)}" alt="" loading="lazy" />`
                : escapeHtml(initials(m.name))}
            </div>
            <div class="market-info">
              <h4>${escapeHtml(marketLabel(m.name))}</h4>
              <p>${escapeHtml(m.description || m.address || m.city || '')}</p>
              <div class="market-meta">
                <span class="chip accent">${m.shops_count || 0} do'kon</span>
                <span class="chip">${escapeHtml(m.city || '')}</span>
              </div>
            </div>
            ${iconChevron()}
          </button>
        `).join('') : `
          <div class="results-empty">
            <h4>Bozorlar topilmadi</h4>
            <p>Qayta yuklashni bosing</p>
            <button type="button" class="btn btn-primary mt-16" id="reload-markets">Qayta yuklash</button>
          </div>
        `}
      </div>
      <button type="button" class="btn btn-ghost btn-block mt-16" id="switch-role">Rolni almashtirish</button>
    `;

    $('#reload-markets')?.addEventListener('click', () => {
      state.markets = [];
      navigate('home', {}, { push: false });
    });
    $('#switch-role')?.addEventListener('click', () => {
      setRole(null);
      state.history = [];
      navigate('role', {}, { push: false });
    });

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
    setHeader(marketLabel(market.name), market.city || t('market_big'), true);

    const popular = ["olma", "guruch", "non", "go'sht", "pomidor", "choy"];

    view.innerHTML = `
      <section class="hero" style="padding:16px;">
        <h2 style="font-size:1.2rem;margin-bottom:6px;">${escapeHtml(marketLabel(market.name))}</h2>
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

  function priceHtml(p) {
    const eff = p.effective_price != null ? p.effective_price : p.price;
    if (p.has_promo || (p.is_promo && p.discount_percent > 0)) {
      return `<span class="price-tag">${formatPrice(eff)} <small class="old-price">${formatPrice(p.old_price || p.price)}</small> <span class="promo-chip">-${p.discount_percent || 0}%</span></span>`;
    }
    return `<span class="price-tag">${formatPrice(eff)} <small>/${escapeHtml(p.unit || 'dona')}</small></span>`;
  }

  function starsHtml(avg, count) {
    const a = Number(avg) || 0;
    if (!count) return '';
    const full = Math.min(5, Math.round(a));
    return `<span class="stars">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span><span class="stars-count">(${count})</span>`;
  }

  async function renderSearch(marketId, q = '') {
    if (state.role !== 'buyer') {
      return navigate('role', {}, { push: false });
    }
    setNav('search');
    applyRoleChrome();
    const markets = await loadMarkets();
    const mid = Number(marketId) || state.selectedMarketId || markets[0]?.id;
    state.selectedMarketId = mid;
    setHeader(t('search_title'), t('search_sub'), true);

    view.innerHTML = `
      <select class="market-select" id="search-market">
        <option value="all">Barcha bozorlar</option>
        ${markets.map((m) => `
          <option value="${m.id}">${escapeHtml(marketLabel(m.name))}</option>
        `).join('')}
      </select>
      <div class="search-box">
        ${iconSearch()}
        <input type="search" id="search-q" placeholder="Masalan: olma, guruch, non..." value="${escapeHtml(q || state.searchQuery)}" autocomplete="off" autofocus />
      </div>
      <div id="search-results">
        <div class="results-empty">
          <div class="empty-icon">${iconSearch()}</div>
          <h4>Qidiruv</h4>
          <p>«olma», «guruch» deb yozing</p>
        </div>
      </div>
    `;

    const marketSelect = $('#search-market');
    if (marketSelect) {
      marketSelect.value = marketId ? String(marketId) : 'all';
    }

    const input = $('#search-q');
    const resultsEl = $('#search-results');
    let debounce;

    async function runSearch() {
      const query = input.value.trim();
      state.searchQuery = query;
      const marketVal = marketSelect.value;
      const all = marketVal === 'all';
      if (!all) state.selectedMarketId = Number(marketVal);
      if (!query) {
        resultsEl.innerHTML = `
          <div class="results-empty">
            <div class="empty-icon">${iconSearch()}</div>
            <h4>Nima qidiryapsiz?</h4>
            <p>So'z yozing — natija chiqadi</p>
          </div>`;
        return;
      }
      resultsEl.innerHTML = `<div class="loading"><div class="spinner"></div><span>Qidirilmoqda...</span></div>`;
      try {
        const path = all
          ? `/search?q=${encodeURIComponent(query)}`
          : `/markets/${marketVal}/search?q=${encodeURIComponent(query)}`;
        const data = await api(path);
        renderSearchResults(resultsEl, data);
      } catch (err) {
        resultsEl.innerHTML = `<div class="results-empty"><h4>Xatolik</h4><p>${escapeHtml(err.message)}</p></div>`;
      }
    }

    function onInput() {
      clearTimeout(debounce);
      debounce = setTimeout(runSearch, 350);
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
          <p>${query ? `"${escapeHtml(query)}" bo'yicha` : ''} mahsulot yo'q. Boshqa so'z yoki «Barcha bozorlar» ni tanlang.</p>
        </div>`;
      return;
    }

    const totalProducts = results.reduce((s, r) => s + r.products.length, 0);
    container.innerHTML = `
      <div class="section-head">
        <h3>Natijalar ${query ? `— «${escapeHtml(query)}»` : ''}</h3>
        <span>${results.length} do'kon · ${totalProducts} mahsulot</span>
      </div>
      ${results.map((group) => `
        <article class="result-group">
          <div class="result-shop-head">
            <h4>${escapeHtml(group.shop_name)} ${group.is_open_now ? '<span class="chip accent">Ochiq</span>' : '<span class="chip">Yopiq</span>'}</h4>
            ${group.market_name ? `<p class="text-muted" style="font-size:0.8rem;margin:4px 0;">${escapeHtml(marketLabel(group.market_name))}</p>` : ''}
            <div class="shop-contacts">
              <div class="contact-row">${iconPin()}<span>${escapeHtml(group.shop_address)}</span></div>
              <div class="contact-row">${iconPhone()}<a href="${phoneLink(group.shop_phone)}" data-call-shop="${group.shop_id}">${escapeHtml(group.shop_phone)}</a></div>
              ${group.work_open ? `<div class="contact-row text-muted" style="font-size:0.8rem;">${escapeHtml(group.work_open)}–${escapeHtml(group.work_close)}</div>` : ''}
            </div>
            <div class="action-row">
              <a class="btn btn-primary btn-sm" href="${phoneLink(group.shop_phone)}" data-call-shop="${group.shop_id}">Qo'ng'iroq</a>
              <button type="button" class="btn btn-secondary btn-sm" data-open-shop="${group.shop_id}">Do'kon</button>
              <button type="button" class="btn btn-ghost btn-sm" data-chat-shop="${group.shop_id}" data-chat-name="${escapeHtml(group.shop_name)}">Chat</button>
            </div>
          </div>
          <div class="product-list">
            ${group.products.map((p) => `
              <div class="product-row-wrap">
                <button type="button" class="product-row" data-product="${p.id}">
                  <div class="product-thumb">${productThumb(p)}</div>
                  <div class="product-info">
                    <h5>${escapeHtml(p.name)} ${p.has_promo ? '<span class="promo-chip">Aksiya</span>' : ''}</h5>
                    <p>${escapeHtml(p.description || p.unit || '')}</p>
                  </div>
                  <div>${priceHtml(p)}</div>
                </button>
                ${state.role !== 'owner' ? `
                <div class="product-actions" data-meta="${encodeURIComponent(JSON.stringify({
                  shop_id: group.shop_id,
                  shop_name: group.shop_name,
                  shop_phone: group.shop_phone,
                  shop_address: group.shop_address,
                }))}">
                  ${favBtnHtml(p.id)}
                  <button type="button" class="icon-chip cart" data-add-cart="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.effective_price != null ? p.effective_price : p.price}" data-unit="${escapeHtml(p.unit || 'dona')}" data-img="${escapeHtml(p.image_url || '')}">Savat</button>
                </div>` : ''}
              </div>
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
    container.querySelectorAll('[data-fav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(el.dataset.fav);
        const row = el.closest('.product-row-wrap');
        let meta = {};
        try { meta = JSON.parse(decodeURIComponent(row.querySelector('.product-actions').dataset.meta || '%7B%7D')); } catch (_) {}
        const nameBtn = row.querySelector('[data-add-cart]');
        const p = {
          id,
          name: nameBtn?.dataset.name,
          price: Number(nameBtn?.dataset.price),
          unit: nameBtn?.dataset.unit,
          image_url: nameBtn?.dataset.img || null,
        };
        const on = toggleFavorite(p, meta);
        el.textContent = on ? '♥' : '♡';
        el.classList.toggle('on', on);
      });
    });
    container.querySelectorAll('[data-add-cart]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        let meta = {};
        try { meta = JSON.parse(decodeURIComponent(el.closest('.product-actions').dataset.meta || '%7B%7D')); } catch (_) {}
        addToCart({
          id: Number(el.dataset.addCart),
          name: el.dataset.name,
          price: Number(el.dataset.price),
          unit: el.dataset.unit,
          image_url: el.dataset.img || null,
        }, meta);
      });
    });
    container.querySelectorAll('[data-call-shop]').forEach((el) => {
      el.addEventListener('click', () => {
        api('/events', { method: 'POST', body: { shopId: Number(el.dataset.callShop), type: 'call' } }).catch(() => {});
      });
    });
    container.querySelectorAll('[data-chat-shop]').forEach((el) => {
      el.addEventListener('click', () => {
        if (state.role === 'owner') {
          toast(t('chat_buyer_only'), 'error');
          return;
        }
        navigate('chat', { shopId: Number(el.dataset.chatShop), shopName: el.dataset.chatName });
      });
    });
  }

  async function renderShop(id) {
    setNav('home');
    const data = await api(`/shops/${id}`);
    const { shop, products } = data;
    setHeader(shop.name, marketLabel(shop.market_name) || "Do'kon", true);
    const shopMeta = {
      shop_id: shop.id,
      shop_name: shop.name,
      shop_phone: shop.phone,
      shop_address: shop.address,
    };

    view.innerHTML = `
      <div class="detail-hero">
        <h2>${escapeHtml(shop.name)}</h2>
        <p class="muted">${escapeHtml(shop.description || marketLabel(shop.market_name) || '')}</p>
        <div class="shop-contacts">
          <div class="contact-row">${iconPin()}<span>${escapeHtml(shop.address)}</span></div>
          <div class="contact-row">${iconPhone()}<a href="${phoneLink(shop.phone)}">${escapeHtml(shop.phone)}</a></div>
        </div>
        <div class="action-row">
          <a class="btn btn-primary" href="${phoneLink(shop.phone)}">Qo'ng'iroq qilish</a>
          ${state.role !== 'owner' ? `<button type="button" class="btn btn-secondary" id="shop-chat">Chat</button>` : ''}
        </div>
        ${shop.rating_count ? `<div class="mt-8">${starsHtml(shop.rating_avg, shop.rating_count)}</div>` : ''}
        ${shop.work_open ? `<p class="text-muted mt-8" style="font-size:0.82rem;">Ish vaqti: ${escapeHtml(shop.work_open)}–${escapeHtml(shop.work_close)} · ${shop.is_open_now ? 'Hozir ochiq' : 'Hozir yopiq'}</p>` : ''}
      </div>
      <div class="section-head">
        <h3>Mahsulotlar</h3>
        <span>${products.length} ta</span>
      </div>
      ${products.length ? `
        <div class="product-grid">
          ${products.map((p) => `
            <div class="product-card-wrap">
              <button type="button" class="product-card" data-product="${p.id}">
                <div class="ph">${productThumb(p)}</div>
                <div class="body">
                  <h5>${escapeHtml(p.name)} ${p.has_promo ? '<span class="promo-chip">Aksiya</span>' : ''}</h5>
                  <div style="text-align:left;font-size:0.88rem;">${priceHtml(p)}</div>
                </div>
              </button>
              ${state.role !== 'owner' ? `
              <div class="card-actions">
                ${favBtnHtml(p.id)}
                <button type="button" class="btn btn-primary btn-sm" data-add-cart="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.effective_price != null ? p.effective_price : p.price}" data-unit="${escapeHtml(p.unit || 'dona')}" data-img="${escapeHtml(p.image_url || '')}">Savat</button>
              </div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `<div class="results-empty"><p>Mahsulotlar hali qo'shilmagan</p></div>`}
    `;

    $('#shop-chat')?.addEventListener('click', () => {
      navigate('chat', { shopId: shop.id, shopName: shop.name });
    });
    view.querySelectorAll('[data-product]').forEach((el) => {
      el.addEventListener('click', () => navigate('product', { id: Number(el.dataset.product) }));
    });
    view.querySelectorAll('[data-fav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap = el.closest('.product-card-wrap');
        const btn = wrap.querySelector('[data-add-cart]');
        const on = toggleFavorite({
          id: Number(el.dataset.fav),
          name: btn.dataset.name,
          price: Number(btn.dataset.price),
          unit: btn.dataset.unit,
          image_url: btn.dataset.img || null,
        }, shopMeta);
        el.textContent = on ? '♥' : '♡';
        el.classList.toggle('on', on);
      });
    });
    view.querySelectorAll('[data-add-cart]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        addToCart({
          id: Number(el.dataset.addCart),
          name: el.dataset.name,
          price: Number(el.dataset.price),
          unit: el.dataset.unit,
          image_url: el.dataset.img || null,
        }, shopMeta);
      });
    });
  }

  async function renderProduct(id) {
    setNav('home');
    const { product } = await api(`/products/${id}`);
    setHeader(product.name, product.shop_name, true);
    const meta = {
      shop_id: product.shop_id || product.shopId,
      shop_name: product.shop_name,
      shop_phone: product.shop_phone,
      shop_address: product.shop_address,
    };
    const cartProduct = {
      ...product,
      price: product.effective_price != null ? product.effective_price : product.price,
    };

    view.innerHTML = `
      <div class="sheet">
        <div class="sheet-image">
          ${product.image_url
            ? `<img src="${escapeHtml(product.image_url)}" alt="" />`
            : `<span>Rasm yo'q</span>`}
        </div>
        <div class="sheet-body">
          <h2>${escapeHtml(product.name)} ${product.has_promo ? '<span class="promo-chip">Aksiya</span>' : ''}</h2>
          <div style="font-size:1.25rem;text-align:left;margin:8px 0 12px;">${priceHtml(product)}</div>
          ${product.description ? `<p class="text-secondary mb-16">${escapeHtml(product.description)}</p>` : ''}
          <div class="form-card" style="margin:0;padding:12px;">
            <h3 style="font-size:0.95rem;margin-bottom:10px;">${escapeHtml(product.shop_name)}</h3>
            <div class="shop-contacts">
              <div class="contact-row">${iconPin()}<span>${escapeHtml(product.shop_address)}</span></div>
              <div class="contact-row">${iconPhone()}<a href="${phoneLink(product.shop_phone)}" id="call-product">${escapeHtml(product.shop_phone)}</a></div>
            </div>
          </div>
          <div class="action-row mt-16">
            ${state.role !== 'owner' ? `
            <button type="button" class="btn btn-primary btn-block" id="add-cart">Savatga qo'shish</button>
            <button type="button" class="btn btn-secondary btn-block" id="toggle-fav">${isFavorite(product.id) ? 'Sevimlidan olib tashlash' : "Sevimlilarga qo'shish"}</button>
            <button type="button" class="btn btn-ghost btn-block" id="open-chat">Do'kon bilan chat</button>
            ` : ''}
            <a class="btn btn-ghost btn-block" href="${phoneLink(product.shop_phone)}" id="call-product-2">Do'konga qo'ng'iroq</a>
            <button type="button" class="btn btn-secondary btn-block" id="goto-shop">Do'kon sahifasi</button>
          </div>
        </div>
      </div>
    `;

    $('#goto-shop').addEventListener('click', () => navigate('shop', { id: product.shop_id }));
    $('#add-cart')?.addEventListener('click', () => addToCart(cartProduct, meta));
    $('#toggle-fav')?.addEventListener('click', () => {
      const on = toggleFavorite(cartProduct, meta);
      $('#toggle-fav').textContent = on ? t('remove_fav') : t('add_fav');
    });
    $('#open-chat')?.addEventListener('click', () => {
      navigate('chat', { shopId: product.shop_id, shopName: product.shop_name });
    });
    const trackCall = () => {
      api('/events', { method: 'POST', body: { shopId: product.shop_id, productId: product.id, type: 'call' } }).catch(() => {});
    };
    $('#call-product')?.addEventListener('click', trackCall);
    $('#call-product-2')?.addEventListener('click', trackCall);
  }

  async function renderFavorites() {
    if (state.role === 'owner') {
      toast(t('owner_no_fav'), 'error');
      return navigate('owner', {}, { push: false });
    }
    if (state.role !== 'buyer') return navigate('role', {}, { push: false });
    setNav('favorites');
    // Ochilganda serverdan yangilash
    await syncFavoritesAndCartFromServer();
    setHeader(t('favorites'), t('pieces_n', { n: state.favorites.length }), false);
    applyRoleChrome();

    if (!state.favorites.length) {
      view.innerHTML = `
        <div class="results-empty">
          <h4>Sevimlilar bo'sh</h4>
          <p>Mahsulot yonidagi ♡ tugmasini bosing</p>
        </div>`;
      return;
    }

    view.innerHTML = `
      <div class="stack">
        ${state.favorites.map((p) => `
          <div class="owner-shop" style="display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;">
            <div class="product-thumb" style="width:56px;height:56px;">${productThumb(p)}</div>
            <div>
              <h4 style="margin-bottom:2px;">${escapeHtml(p.name)}</h4>
              <p style="margin-bottom:6px;">${formatPrice(p.price)} / ${escapeHtml(p.unit || 'dona')}</p>
              <p class="text-muted" style="margin-bottom:8px;font-size:0.8rem;">${escapeHtml(p.shop_name || '')}</p>
              <div class="owner-actions">
                <button type="button" class="btn btn-primary btn-sm" data-open="${p.id}">Ochish</button>
                <button type="button" class="btn btn-secondary btn-sm" data-to-cart="${p.id}">Savat</button>
                <button type="button" class="btn btn-danger btn-sm" data-unfav="${p.id}">Olib tashlash</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    view.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => navigate('product', { id: Number(el.dataset.open) }));
    });
    view.querySelectorAll('[data-to-cart]').forEach((el) => {
      el.addEventListener('click', () => {
        const p = state.favorites.find((f) => Number(f.id) === Number(el.dataset.toCart));
        if (p) addToCart(p);
      });
    });
    view.querySelectorAll('[data-unfav]').forEach((el) => {
      el.addEventListener('click', () => {
        state.favorites = state.favorites.filter((f) => Number(f.id) !== Number(el.dataset.unfav));
        saveFavorites();
        renderFavorites();
      });
    });
  }

  async function renderCart() {
    if (state.role === 'owner') {
      toast(t('owner_no_fav'), 'error');
      return navigate('owner', {}, { push: false });
    }
    if (state.role !== 'buyer') return navigate('role', {}, { push: false });
    setNav('cart');
    // Ochilganda serverdan yangilash
    await syncFavoritesAndCartFromServer();
    setHeader(t('cart'), `${state.cart.length} ${t('pieces')}`, false);
    applyRoleChrome();

    if (!state.cart.length) {
      view.innerHTML = `
        <div class="results-empty">
          <h4>Savat bo'sh</h4>
          <p>Mahsulotlarni savatga qo'shing</p>
        </div>`;
      return;
    }

    const total = state.cart.reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0);

    view.innerHTML = `
      <div class="stack">
        ${state.cart.map((p) => `
          <div class="owner-shop">
            <div style="display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;">
              <div class="product-thumb" style="width:56px;height:56px;">${productThumb(p)}</div>
              <div>
                <h4 style="margin-bottom:2px;">${escapeHtml(p.name)}</h4>
                <p style="margin-bottom:4px;">${formatPrice(p.price)} / ${escapeHtml(p.unit || 'dona')}</p>
                <p class="text-muted" style="font-size:0.8rem;margin-bottom:8px;">${escapeHtml(p.shop_name || '')} · ${escapeHtml(p.shop_phone || '')}</p>
              </div>
            </div>
            <div class="owner-actions mt-8" style="align-items:center;">
              <button type="button" class="btn btn-secondary btn-sm" data-dec="${p.id}">−</button>
              <span style="min-width:2rem;text-align:center;font-weight:600;">${p.qty || 1}</span>
              <button type="button" class="btn btn-secondary btn-sm" data-inc="${p.id}">+</button>
              <button type="button" class="btn btn-danger btn-sm" data-rm="${p.id}">O'chirish</button>
              ${p.shop_phone ? `<a class="btn btn-primary btn-sm" href="${phoneLink(p.shop_phone)}">Qo'ng'iroq</a>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="form-card mt-16">
        <div class="section-head" style="margin:0;">
          <h3>Jami</h3>
          <span class="price-tag" style="font-size:1.1rem;">${formatPrice(total)}</span>
        </div>
        <p class="text-muted mt-8" style="font-size:0.82rem;">Savat eslatma. Kerakli do'konga qo'ng'iroq qiling yoki chat yozing — buyurtma tizimi yo'q.</p>
        <button type="button" class="btn btn-ghost btn-block mt-12" id="clear-cart">Savatni tozalash</button>
      </div>
    `;

    view.querySelectorAll('[data-inc]').forEach((el) => {
      el.addEventListener('click', () => {
        const item = state.cart.find((c) => Number(c.id) === Number(el.dataset.inc));
        if (item) setCartQty(item.id, (item.qty || 1) + 1);
        renderCart();
      });
    });
    view.querySelectorAll('[data-dec]').forEach((el) => {
      el.addEventListener('click', () => {
        const item = state.cart.find((c) => Number(c.id) === Number(el.dataset.dec));
        if (!item) return;
        if ((item.qty || 1) <= 1) removeFromCart(item.id);
        else setCartQty(item.id, item.qty - 1);
        renderCart();
      });
    });
    view.querySelectorAll('[data-rm]').forEach((el) => {
      el.addEventListener('click', () => {
        removeFromCart(el.dataset.rm);
        renderCart();
      });
    });
    $('#clear-cart')?.addEventListener('click', () => {
      state.cart = [];
      saveCart();
      renderCart();
    });
  }

  // ——— Owner panel ———

  async function renderOwner() {
    if (state.role !== 'owner') {
      return navigate('role', {}, { push: false });
    }
    setNav('owner');
    setHeader(t('my_shop'), t('my_shop_sub'), false);
    applyRoleChrome();

    // Token yo'q = chiqilgan — Telegram orqali avtomatik kirish YO'Q
    if (!state.ownerToken) {
      showOwnerLoginForm();
      return;
    }

    let me;
    try {
      me = await api('/me');
      state.me = me;
    } catch (err) {
      // Token yaroqsiz — qayta login
      clearOwnerSession();
      showOwnerLoginForm(err.message || 'Qayta kiring');
      return;
    }

    const shops = me.shops || [];
    const displayName = me.user.name || me.user.first_name || 'Salom';
    const t = me.stats?.totals || {};
    view.innerHTML = `
      <section class="hero" style="padding:16px;">
        <div class="hero-kicker">Do'kon egasi</div>
        <h2 style="font-size:1.2rem;">${escapeHtml(displayName)}</h2>
        <p>Mahsulotlar moderatsiyadan o'tgach ko'rinadi.${me.user.phone ? ` · ${escapeHtml(me.user.phone)}` : ''}</p>
        <div class="stats-row">
          <div class="stat"><strong>${t.views || 0}</strong><span>Ko'rish</span></div>
          <div class="stat"><strong>${t.product_views || 0}</strong><span>Mahsulot ko'rish</span></div>
          <div class="stat"><strong>${t.products || 0}</strong><span>Mahsulot</span></div>
          <div class="stat"><strong>${t.calls || 0}</strong><span>Qo'ng'iroq</span></div>
        </div>
      </section>

      <div class="section-head">
        <h3>Do'konlarim</h3>
        <span>${shops.length} ta</span>
      </div>
      ${shops.length ? shops.map((s) => `
        <div class="owner-shop">
          <h4>${escapeHtml(s.name)} ${s.is_open_now ? '<span class="chip accent">Ochiq</span>' : '<span class="chip">Yopiq</span>'}</h4>
          <p>${escapeHtml(s.market_name)} · ${escapeHtml(s.address)} · ${escapeHtml(s.phone)}</p>
          <p class="text-muted" style="font-size:0.82rem;margin-bottom:8px;">Ish vaqti: ${escapeHtml(s.work_open || '09:00')}–${escapeHtml(s.work_close || '18:00')} · ${starsHtml(s.rating_avg, s.rating_count)}</p>
          <div class="owner-actions">
            <button type="button" class="btn btn-primary btn-sm" data-manage="${s.id}">Mahsulotlar</button>
            <button type="button" class="btn btn-secondary btn-sm" data-hours="${s.id}">Ish vaqti</button>
            <button type="button" class="btn btn-secondary btn-sm" data-view="${s.id}">Ko'rish</button>
          </div>
          <div class="form-card mt-12 hidden" id="hours-${s.id}">
            <div class="field"><label>Ochilish</label><input type="time" id="open-${s.id}" value="${escapeHtml((s.work_open || '09:00').slice(0, 5))}" /></div>
            <div class="field"><label>Yopilish</label><input type="time" id="close-${s.id}" value="${escapeHtml((s.work_close || '18:00').slice(0, 5))}" /></div>
            <button type="button" class="btn btn-primary btn-sm" data-save-hours="${s.id}">Saqlash</button>
          </div>
        </div>
      `).join('') : `
        <div class="results-empty">
          <h4>Do'kon yo'q</h4>
          <p>Superadmin sizga do'kon biriktirishi kerak.</p>
        </div>
      `}
      <p class="text-muted text-center mt-12" style="font-size:0.85rem;">Chatlar — yuqoridagi chat ikonkasi orqali</p>
      <button type="button" class="btn btn-ghost btn-block mt-16" id="owner-logout">Chiqish</button>
    `;

    $('#owner-logout')?.addEventListener('click', () => {
      clearOwnerSession();
      setRole(null);
      toast(t('logged_out'));
      navigate('role', {}, { push: false });
    });
    view.querySelectorAll('[data-manage]').forEach((el) => {
      el.addEventListener('click', () => navigate('owner-shop', { id: Number(el.dataset.manage) }));
    });
    view.querySelectorAll('[data-view]').forEach((el) => {
      el.addEventListener('click', () => navigate('shop', { id: Number(el.dataset.view) }));
    });
    view.querySelectorAll('[data-hours]').forEach((el) => {
      el.addEventListener('click', () => {
        $(`#hours-${el.dataset.hours}`)?.classList.toggle('hidden');
      });
    });
    view.querySelectorAll('[data-save-hours]').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.dataset.saveHours;
        try {
          await api(`/shops/${id}/hours`, {
            method: 'PATCH',
            body: {
              work_open: $(`#open-${id}`).value,
              work_close: $(`#close-${id}`).value,
            },
          });
          toast(t('hours_saved'), 'success');
          navigate('owner', {}, { push: false });
        } catch (ex) {
          toast(ex.message, 'error');
        }
      });
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
      btn.textContent = t('saving');
      try {
        await api('/shops', { method: 'POST', body: fd });
        haptic('medium');
        toast(t('shop_created'), 'success');
        navigate('owner', {}, { push: false });
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('save');
      }
    });
  }

  async function renderOwnerShop(shopId) {
    if (!state.ownerToken || state.role !== 'owner') {
      clearOwnerSession();
      setRole('owner');
      return navigate('owner', {}, { push: false });
    }
    setNav('owner');
    const data = await api(`/owner/shops/${shopId}`);
    const { shop, products } = data;
    setHeader(shop.name, 'Mahsulotlar boshqaruvi', true);

    const statusLabel = (st) => {
      if (st === 'pending') return '<span class="chip">Kutilmoqda</span>';
      if (st === 'rejected') return '<span class="chip" style="color:#fca5a5;">Rad etilgan</span>';
      return '<span class="chip accent">Tasdiqlangan</span>';
    };

    view.innerHTML = `
      <div class="detail-hero" style="padding:14px;">
        <p class="muted" style="margin:0;">${escapeHtml(shop.address)} · ${escapeHtml(shop.phone)}</p>
        <p class="text-muted mt-8" style="font-size:0.82rem;">Yangi mahsulot superadmin tasdiqlagach chiqadi.</p>
      </div>
      <button type="button" class="btn btn-primary btn-block mb-16" id="btn-add-product">+ Mahsulot qo'shish</button>
      <div class="section-head">
        <h3>Mahsulotlar</h3>
        <span>${products.length} ta</span>
      </div>
      ${products.length ? `
        <div class="stack">
          ${products.map((p) => `
            <div class="owner-shop">
              <div style="display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;">
                <div class="product-thumb" style="width:56px;height:56px;">${productThumb(p)}</div>
                <div>
                  <h4 style="margin-bottom:2px;">${escapeHtml(p.name)} ${statusLabel(p.moderation_status)}</h4>
                  <p style="margin-bottom:6px;">${formatPrice(p.effective_price != null ? p.effective_price : p.price)} / ${escapeHtml(p.unit)}
                    ${p.is_promo ? `<span class="promo-chip">-${p.discount_percent || 0}%</span>` : ''}</p>
                  <div class="owner-actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}">Tahrir</button>
                    <button type="button" class="btn btn-primary btn-sm" data-promo="${p.id}" data-disc="${p.discount_percent || 10}" data-on="${p.is_promo ? 1 : 0}">Aksiya</button>
                    <button type="button" class="btn btn-danger btn-sm" data-del="${p.id}">O'chirish</button>
                  </div>
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

    view.querySelectorAll('[data-promo]').forEach((el) => {
      el.addEventListener('click', async () => {
        const on = el.dataset.on === '1';
        let disc = 10;
        if (!on) {
          const v = prompt('Chegirma foizi (%)', el.dataset.disc || '10');
          if (v == null) return;
          disc = Number(v) || 10;
        }
        try {
          await api(`/products/${el.dataset.promo}/promo`, {
            method: 'PATCH',
            body: { is_promo: !on, discount_percent: disc },
          });
          toast(on ? 'Aksiya o‘chirildi' : `Aksiya: -${disc}%`, 'success');
          renderOwnerShop(shopId);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });

    view.querySelectorAll('[data-del]').forEach((el) => {
      el.addEventListener('click', async () => {
        if (!confirm("Mahsulotni o'chirasizmi?")) return;
        try {
          await api(`/products/${el.dataset.del}`, { method: 'DELETE' });
          toast(t('deleted'), 'success');
          renderOwnerShop(shopId);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  async function renderOwnerProduct(shopId, productId) {
    if (!state.ownerToken || state.role !== 'owner') {
      clearOwnerSession();
      setRole('owner');
      return navigate('owner', {}, { push: false });
    }
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
      btn.textContent = t('saving');
      try {
        if (productId) {
          await api(`/products/${productId}`, { method: 'PATCH', body: fd });
        } else {
          await api('/products', { method: 'POST', body: fd });
        }
        haptic('medium');
        toast(t('saved'), 'success');
        navigate('owner-shop', { id: shopId }, { push: false });
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('save');
      }
    });
  }

  // ——— Support (foydalanuvchi ↔ superadmin) ———

  async function renderSupport() {
    if (!state.role) return navigate('role', {}, { push: false });
    setNav('support');
    setHeader(t('support_title'), t('support_sub'), false);
    applyRoleChrome();
    view.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

    let thread = null;
    let messages = [];
    let lastMsgId = 0;

    try {
      const data = await api('/support');
      thread = data.thread;
      messages = data.messages || [];
    } catch (err) {
      view.innerHTML = `<div class="results-empty"><h4>${t('support_fail')}</h4><p>${escapeHtml(err.message)}</p></div>`;
      return;
    }

    lastMsgId = messages.length ? messages[messages.length - 1].id : 0;

    function paint(keepInput = false) {
      const draft = keepInput ? ($('#support-input')?.value || '') : '';
      const nearBottom = (() => {
        const box = $('#support-messages');
        if (!box) return true;
        return box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      })();
      setChatMode(true);
      view.innerHTML = `
        <div class="chat-layout">
          <p class="chat-hint">${t('support_hint')}</p>
          <div class="chat-box">
            <div class="chat-messages" id="support-messages">
              ${messages.length ? messages.map((m) => `
                <div class="chat-bubble ${m.sender_role === 'user' ? 'me' : 'them'}" data-mid="${m.id}">
                  <div class="chat-meta">${m.sender_role === 'user' ? t('you') : t('support_role')}</div>
                  <div>${escapeHtml(m.body)}</div>
                  <div class="chat-time">${escapeHtml((m.created_at || '').slice(11, 16))}</div>
                </div>
              `).join('') : '<p class="text-muted text-center">${t('support_empty')}</p>'}
            </div>
            <div class="chat-input-row">
              <input type="text" id="support-input" placeholder="${t('support_ph')}" maxlength="2000" value="${escapeHtml(draft)}" autocomplete="off" />
              <button type="button" class="btn btn-primary" id="support-send">${t('send')}</button>
            </div>
          </div>
        </div>
      `;
      const box = $('#support-messages');
      if (box && nearBottom) box.scrollTop = box.scrollHeight;
      $('#support-send')?.addEventListener('click', send);
      $('#support-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') send();
      });
      if (keepInput && draft) {
        const inp = $('#support-input');
        if (inp) {
          inp.focus();
          inp.selectionStart = inp.selectionEnd = inp.value.length;
        }
      }
    }

    async function send() {
      const input = $('#support-input');
      const body = (input?.value || '').trim();
      if (!body) return;
      try {
        const data = await api('/support/send', {
          method: 'POST',
          body: { body },
        });
        thread = data.thread;
        messages = data.messages || [];
        lastMsgId = messages.length ? messages[messages.length - 1].id : lastMsgId;
        paint(false);
        refreshSupportBadge();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function poll() {
      if (document.hidden) return;
      if (state.route?.name !== 'support') return;
      try {
        const data = await api('/support');
        const next = data.messages || [];
        const maxId = next.length ? next[next.length - 1].id : 0;
        if (maxId !== lastMsgId || next.length !== messages.length) {
          messages = next;
          thread = data.thread;
          lastMsgId = maxId;
          paint(true);
          refreshSupportBadge();
        }
      } catch (_) { /* ignore */ }
    }

    stopChatPoll();
    paint();
    chatPollTimer = setInterval(poll, 2000);
    refreshSupportBadge();
  }

  // ——— Chat (xaridor) ———

  async function renderChatsList() {
    if (state.role !== 'buyer') return navigate('role', {}, { push: false });
    setNav('home');
    setHeader(t('chats'), t('chat_live'), true);
    applyRoleChrome();
    let threads = [];
    try {
      const data = await api('/chats');
      threads = data.threads || [];
    } catch (err) {
      view.innerHTML = `<div class="results-empty"><p>${escapeHtml(err.message)}</p></div>`;
      return;
    }
    view.innerHTML = threads.length ? `
      <div class="stack">
        ${threads.map((t) => {
          const u = Number(t.unread || t.buyer_unread || 0);
          return `
          <button type="button" class="owner-shop" style="width:100%;text-align:left;" data-thread="${t.id}" data-shop="${t.shop_id}">
            <h4>${escapeHtml(t.shop_name)} ${u > 0 ? `<span class="chip accent">${u} yangi</span>` : ''}</h4>
            <p class="text-muted">${escapeHtml(t.market_name || '')}</p>
            <p style="margin-top:6px;">${escapeHtml(t.last_message || '')}</p>
            <p class="text-muted" style="font-size:0.75rem;">${escapeHtml((t.last_at || '').slice(0, 16))}</p>
          </button>`;
        }).join('')}
      </div>
    ` : `<div class="results-empty"><h4>Chat yo'q</h4><p>Do'kon sahifasidan «Chat» bosing</p></div>`;
    view.querySelectorAll('[data-thread]').forEach((el) => {
      el.addEventListener('click', () => {
        navigate('chat', { threadId: Number(el.dataset.thread), shopId: Number(el.dataset.shop) });
      });
    });
  }

  async function renderChat(shopId, threadId, shopName) {
    if (state.role === 'owner') {
      toast("Chat — yuqoridagi chat ikonkasi orqali", 'error');
      return navigate('owner-chats', {}, { push: false });
    }
    setHeader(shopName || 'Chat', "Do'kon bilan yozishma", true);
    applyRoleChrome();
    view.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

    let thread = null;
    let messages = [];
    let lastMsgId = 0;

    try {
      if (threadId) {
        const data = await api(`/chats/thread/${threadId}`);
        thread = data.thread;
        messages = data.messages || [];
      } else if (shopId) {
        const list = await api('/chats');
        thread = (list.threads || []).find((t) => Number(t.shop_id) === Number(shopId)) || null;
        if (thread) {
          const data = await api(`/chats/thread/${thread.id}`);
          messages = data.messages || [];
          thread = data.thread;
        }
      }
    } catch (_) { /* yangi chat */ }

    lastMsgId = messages.length ? messages[messages.length - 1].id : 0;
    setHeader(thread?.shop_name || shopName || "Do'kon", 'Chat (jonli)', true);

    function paint(keepInput = false) {
      const draft = keepInput ? ($('#chat-input')?.value || '') : '';
      const nearBottom = (() => {
        const box = $('#chat-messages');
        if (!box) return true;
        return box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      })();
      setChatMode(true);
      view.innerHTML = `
        <div class="chat-layout">
          <div class="chat-box">
            <div class="chat-messages" id="chat-messages">
              ${messages.length ? messages.map((m) => `
                <div class="chat-bubble ${m.sender_role === 'buyer' ? 'me' : 'them'}" data-mid="${m.id}">
                  <div class="chat-meta">${m.sender_role === 'buyer' ? t('you') : t('shop_role')}</div>
                  <div>${escapeHtml(m.body)}</div>
                  <div class="chat-time">${escapeHtml((m.created_at || '').slice(11, 16))}</div>
                </div>
              `).join('') : '<p class="text-muted text-center">${t('chat_empty')}</p>'}
            </div>
            <div class="chat-input-row">
              <input type="text" id="chat-input" placeholder="${t('chat_ph')}" maxlength="1000" value="${escapeHtml(draft)}" autocomplete="off" />
              <button type="button" class="btn btn-primary" id="chat-send">${t('send')}</button>
            </div>
          </div>
        </div>
      `;
      const box = $('#chat-messages');
      if (box && nearBottom) box.scrollTop = box.scrollHeight;
      $('#chat-send')?.addEventListener('click', send);
      $('#chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') send();
      });
      if (keepInput && draft) {
        const inp = $('#chat-input');
        if (inp) {
          inp.focus();
          inp.selectionStart = inp.selectionEnd = inp.value.length;
        }
      }
    }

    async function send() {
      const input = $('#chat-input');
      const body = (input?.value || '').trim();
      if (!body) return;
      const sid = shopId || thread?.shop_id;
      if (!sid) {
        toast("Do'kon topilmadi", 'error');
        return;
      }
      try {
        const data = await api('/chats/send', {
          method: 'POST',
          body: { shopId: Number(sid), body },
        });
        if (data.thread) thread = data.thread;
        const refreshed = await api(`/chats/thread/${thread.id}`);
        messages = refreshed.messages || [];
        thread = refreshed.thread;
        lastMsgId = messages.length ? messages[messages.length - 1].id : lastMsgId;
        paint(false);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function poll() {
      if (!thread?.id) return;
      if (document.hidden) return;
      try {
        const data = await api(`/chats/thread/${thread.id}`);
        const next = data.messages || [];
        const maxId = next.length ? next[next.length - 1].id : 0;
        if (maxId !== lastMsgId || next.length !== messages.length) {
          messages = next;
          thread = data.thread;
          lastMsgId = maxId;
          paint(true);
        }
      } catch (_) { /* ignore */ }
    }

    stopChatPoll();
    paint();
    chatPollTimer = setInterval(poll, 2000);
    refreshChatBadge();
  }

  async function renderOwnerReviews() {
    navigate('owner', {}, { push: false });
  }

  async function renderOwnerChatsList() {
    if (!state.ownerToken) return navigate('owner', {}, { push: false });
    setNav('owner');
    setHeader(t('owner_chats'), t('owner_chats_sub'), true);
    applyRoleChrome();
    let threads = [];
    try {
      const data = await api('/owner/chats');
      threads = data.threads || [];
    } catch (err) {
      view.innerHTML = `<div class="results-empty"><p>${escapeHtml(err.message)}</p></div>`;
      return;
    }
    const totalNew = threads.reduce((s, t) => s + Number(t.unread || t.owner_unread || 0), 0);
    view.innerHTML = `
      ${totalNew > 0 ? `<div class="form-card mb-16"><strong>${totalNew}</strong> ta yangi xabar</div>` : ''}
      ${threads.length ? `
      <div class="stack">
        ${threads.map((t) => {
          const u = Number(t.unread || t.owner_unread || 0);
          return `
          <button type="button" class="owner-shop" style="width:100%;text-align:left;" data-othread="${t.id}">
            <h4>${escapeHtml(t.buyer_name || 'Xaridor')} · ${escapeHtml(t.shop_name)}
              ${u > 0 ? `<span class="chip accent">${u} yangi</span>` : ''}</h4>
            <p>${escapeHtml(t.last_message || '')}</p>
            <p class="text-muted" style="font-size:0.75rem;">${escapeHtml((t.last_at || '').slice(0, 16))}</p>
          </button>`;
        }).join('')}
      </div>
    ` : `<div class="results-empty"><h4>Chat yo'q</h4><p>Xaridorlar do'konga chat yozganda shu yerda chiqadi</p></div>`}
    `;
    view.querySelectorAll('[data-othread]').forEach((el) => {
      el.addEventListener('click', () => navigate('owner-chat', { threadId: Number(el.dataset.othread) }));
    });
  }

  async function renderOwnerChat(threadId) {
    if (!state.ownerToken) return navigate('owner', {}, { push: false });
    setNav('owner');
    setHeader(t('chats'), t('live_chat'), true);
    applyRoleChrome();
    let thread;
    let messages = [];
    let lastMsgId = 0;
    try {
      const data = await api(`/owner/chats/${threadId}`);
      thread = data.thread;
      messages = data.messages || [];
    } catch (err) {
      view.innerHTML = `<div class="results-empty"><p>${escapeHtml(err.message)}</p></div>`;
      return;
    }
    lastMsgId = messages.length ? messages[messages.length - 1].id : 0;
    setHeader(thread.buyer_name || t('buyer'), thread.shop_name, true);

    function paint(keepInput = false) {
      const draft = keepInput ? ($('#ochat-input')?.value || '') : '';
      const nearBottom = (() => {
        const box = $('#ochat-messages');
        if (!box) return true;
        return box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      })();
      setChatMode(true);
      view.innerHTML = `
        <div class="chat-layout">
          <div class="chat-box">
            <div class="chat-messages" id="ochat-messages">
              ${messages.map((m) => `
                <div class="chat-bubble ${m.sender_role === 'owner' ? 'me' : 'them'}">
                  <div class="chat-meta">${m.sender_role === 'owner' ? t('you') : t('buyer')}</div>
                  <div>${escapeHtml(m.body)}</div>
                  <div class="chat-time">${escapeHtml((m.created_at || '').slice(11, 16))}</div>
                </div>
              `).join('')}
            </div>
            <div class="chat-input-row">
              <input type="text" id="ochat-input" placeholder="${t('reply_ph')}" maxlength="1000" value="${escapeHtml(draft)}" autocomplete="off" />
              <button type="button" class="btn btn-primary" id="ochat-send">${t('send')}</button>
            </div>
          </div>
        </div>
      `;
      const box = $('#ochat-messages');
      if (box && nearBottom) box.scrollTop = box.scrollHeight;
      $('#ochat-send')?.addEventListener('click', send);
      $('#ochat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') send();
      });
      if (keepInput && draft) {
        const inp = $('#ochat-input');
        if (inp) {
          inp.focus();
          inp.selectionStart = inp.selectionEnd = inp.value.length;
        }
      }
    }

    async function send() {
      const body = ($('#ochat-input')?.value || '').trim();
      if (!body) return;
      try {
        await api(`/owner/chats/${threadId}/reply`, { method: 'POST', body: { body } });
        const data = await api(`/owner/chats/${threadId}`);
        messages = data.messages || [];
        lastMsgId = messages.length ? messages[messages.length - 1].id : lastMsgId;
        paint(false);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function poll() {
      if (document.hidden) return;
      try {
        const data = await api(`/owner/chats/${threadId}`);
        const next = data.messages || [];
        const maxId = next.length ? next[next.length - 1].id : 0;
        if (maxId !== lastMsgId || next.length !== messages.length) {
          messages = next;
          lastMsgId = maxId;
          paint(true);
        }
      } catch (_) { /* ignore */ }
    }

    stopChatPoll();
    paint();
    chatPollTimer = setInterval(poll, 2000);
    refreshChatBadge();
  }

  // ——— Live updates (F5 shart emas) ———

  let liveAppVer = null;
  let liveDataRev = null;
  let liveBusy = false;
  const LIVE_INTERVAL_MS = 4000;

  function isUserTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function showLiveToast(msg) {
    toast(msg, 'success');
  }

  /**
   * Sevimli va savatni server bilan sinxronlash:
   * narx/nom/rasm yangilanadi, o'chirilgan mahsulotlar olib tashlanadi.
   */
  async function syncFavoritesAndCartFromServer() {
    loadStore();
    const ids = new Set([
      ...state.favorites.map((f) => Number(f.id)),
      ...state.cart.map((c) => Number(c.id)),
    ]);
    if (!ids.size) {
      updateCartBadge();
      return { favChanged: false, cartChanged: false, removed: 0 };
    }

    const freshMap = new Map();
    await Promise.all(
      [...ids].map(async (id) => {
        try {
          const data = await api(`/products/${id}`);
          const p = data.product;
          if (!p || p.is_available === 0) {
            freshMap.set(id, null);
            return;
          }
          freshMap.set(id, {
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit || 'dona',
            image_url: p.image_url || null,
            shop_id: p.shop_id || null,
            shop_name: p.shop_name || '',
            shop_phone: p.shop_phone || '',
            shop_address: p.shop_address || '',
          });
        } catch {
          freshMap.set(id, null); // o'chirilgan yoki topilmadi
        }
      })
    );

    let removed = 0;
    const prevFav = JSON.stringify(state.favorites);
    const prevCart = JSON.stringify(state.cart);

    state.favorites = state.favorites
      .map((f) => {
        const fresh = freshMap.get(Number(f.id));
        if (!fresh) {
          removed += 1;
          return null;
        }
        return { ...f, ...fresh };
      })
      .filter(Boolean);

    state.cart = state.cart
      .map((c) => {
        const fresh = freshMap.get(Number(c.id));
        if (!fresh) {
          removed += 1;
          return null;
        }
        return { ...c, ...fresh, qty: c.qty || 1 };
      })
      .filter(Boolean);

    const favChanged = JSON.stringify(state.favorites) !== prevFav;
    const cartChanged = JSON.stringify(state.cart) !== prevCart;

    if (favChanged) saveFavorites();
    if (cartChanged) saveCart();
    else updateCartBadge();

    return { favChanged, cartChanged, removed };
  }

  async function softRefreshCurrentView() {
    // Sevimli/savatni har doim server bilan yangilash
    const sync = await syncFavoritesAndCartFromServer();

    // Cache tozalash — yangi ma'lumot olinadi
    state.markets = [];
    const name = state.route?.name;
    // Forma yozilayotgan ekranlarni buzmaslik
    if (['owner-product', 'owner-create', 'role'].includes(name)) {
      // lekin badge yangilangan bo'lishi mumkin
      updateCartBadge();
      return;
    }
    if (isUserTyping()) return;

    // Sevimli / savat ochiq bo'lsa — albatta qayta chizish
    if (name === 'favorites' || name === 'cart') {
      await render();
      if (sync.removed > 0) {
        showLiveToast(name === 'cart' ? 'Savat yangilandi' : 'Sevimlilar yangilandi');
      }
      return;
    }

    await render();
    // Boshqa ekranda bo'lsa ham sevimli/savat badge yangilanadi
    updateCartBadge();
  }

  async function pollLiveVersion() {
    if (document.hidden || liveBusy) return;
    liveBusy = true;
    try {
      const res = await fetch(`/api/version?_=${Date.now()}`, {
        headers: { 'ngrok-skip-browser-warning': '1', Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const ver = await res.json();
      if (!ver || !ver.app) return;

      if (liveAppVer == null) {
        liveAppVer = ver.app;
        liveDataRev = ver.data;
        // Birinchi ishga tushishda ham sevimli/savatni sinxronlash
        await syncFavoritesAndCartFromServer();
        return;
      }

      // Kod (UI) yangilandi — avtomatik qayta yuklash (foydalanuvchi F5 bosmaydi)
      if (ver.app !== liveAppVer) {
        liveAppVer = ver.app;
        showLiveToast('Ilova yangilandi…');
        setTimeout(() => {
          const url = new URL(location.href);
          url.searchParams.set('_v', String(Date.now()));
          location.replace(url.toString());
        }, 400);
        return;
      }

      // Ma'lumotlar (bozor/do'kon/mahsulot) o'zgardi — joriy ekranni yumshoq yangilash
      if (ver.data !== liveDataRev) {
        liveDataRev = ver.data;
        if (!isUserTyping()) {
          await softRefreshCurrentView();
        } else {
          // Yozayotganda ham sevimli/savat fonda sinxronlansin
          await syncFavoritesAndCartFromServer();
        }
      }
    } catch (_) {
      /* tarmoq vaqtincha ishlamasa jim turamiz */
    } finally {
      liveBusy = false;
    }
  }

  function startLiveUpdates() {
    pollLiveVersion();
    setInterval(pollLiveVersion, LIVE_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pollLiveVersion();
    });
  }

  // ——— Boot ———

  async function boot() {
    captureOwnerTokenFromUrl();
    // Deep link token → egasi
    if (state.ownerToken && (location.hash || '').includes('owner')) {
      setRole('owner');
    }

    const routed = routeFromHash();
    if (!routed) {
      // Har WebApp ochilishida rol so'raladi (session ichida saqlanadi)
      if (!state.role) {
        await navigate('role', {}, { push: false });
      } else if (state.role === 'owner') {
        await navigate('owner', {}, { push: false });
      } else {
        await navigate('home', {}, { push: false });
      }
    }

    bindLangSwitch();
    applyStaticI18n();
    startLiveUpdates();
    startUnreadPolling();
    updateCartBadge();
  }

  // DOM tayyor bo'lishini kutish (Telegram WebView)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot().catch((e) => console.error('boot', e));
    });
  } else {
    boot().catch((e) => console.error('boot', e));
  }
})();

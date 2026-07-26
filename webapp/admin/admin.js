(() => {
  const TOKEN_KEY = 'bozor_superadmin_token';
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let tab = 'dashboard';
  let marketsCache = [];

  const $ = (s) => document.querySelector(s);
  const loginView = $('#login-view');
  const appView = $('#app-view');
  const panel = $('#panel');
  const pageTitle = $('#page-title');

  async function api(path, options = {}) {
    const opts = { ...options };
    opts.headers = {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    if (opts.body && typeof opts.body === 'object') {
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`/api/admin${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Xatolik');
    return data;
  }

  function showLogin() {
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
  }

  function showApp() {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    render();
    startLiveUpdates();
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#login-error');
    err.hidden = true;
    try {
      const data = await api('/login', {
        method: 'POST',
        body: { password: $('#login-password').value },
      });
      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      showApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  $('#logout').addEventListener('click', () => {
    token = '';
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  });

  document.querySelectorAll('.sidebar .nav').forEach((btn) => {
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab;
      document.querySelectorAll('.sidebar .nav').forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });

  async function render() {
    const titles = {
      dashboard: 'Dashboard',
      report: 'Hisobot',
      moderation: 'Moderatsiya',
      markets: 'Bozorlar',
      shops: "Do'konlar",
      owners: "Do'kon egalari",
    };
    pageTitle.textContent = titles[tab] || 'Admin';
    panel.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    try {
      if (tab === 'dashboard') await renderDashboard();
      else if (tab === 'report') await renderReport();
      else if (tab === 'moderation') await renderModeration();
      else if (tab === 'markets') await renderMarkets();
      else if (tab === 'shops') await renderShops();
      else if (tab === 'owners') await renderOwners();
    } catch (err) {
      if (String(err.message).includes('avtorizatsiya') || String(err.message).includes('401')) {
        token = '';
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
        return;
      }
      panel.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function renderDashboard() {
    const { stats } = await api('/stats');
    let pending = 0;
    try {
      const mod = await api('/moderation');
      pending = (mod.products || []).length;
    } catch (_) {}
    panel.innerHTML = `
      <div class="stats">
        <div class="stat"><strong>${stats.markets}</strong><span>Bozor</span></div>
        <div class="stat"><strong>${stats.shops}</strong><span>Do'kon</span></div>
        <div class="stat"><strong>${stats.products}</strong><span>Mahsulot</span></div>
        <div class="stat"><strong>${stats.owners}</strong><span>Do'kon egasi</span></div>
      </div>
      <div class="card">
        <h3>Moderatsiya</h3>
        <p class="muted">Kutilayotgan mahsulotlar: <strong style="color:var(--warn,#f59e0b)">${pending}</strong></p>
        <button type="button" class="btn secondary sm mt-8" id="go-mod">Moderatsiyaga o'tish</button>
      </div>
      <div class="card">
        <h3>Qisqa qo'llanma</h3>
        <p class="muted">1. Bozor qo'shing → 2. Do'kon egasi yarating → 3. Mahsulotlar moderatsiyadan o'tadi → 4. Hisobotda buyurtma va reytinglar.</p>
      </div>
    `;
    $('#go-mod')?.addEventListener('click', () => {
      tab = 'moderation';
      document.querySelectorAll('.sidebar .nav').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'moderation'));
      render();
    });
  }

  async function renderReport() {
    const { report } = await api('/report');
    const s = report.summary;
    panel.innerHTML = `
      <div class="stats" style="grid-template-columns:repeat(3,1fr);">
        <div class="stat"><strong>${s.markets || 0}</strong><span>Bozor</span></div>
        <div class="stat"><strong>${s.shops || 0}</strong><span>Do'kon</span></div>
        <div class="stat"><strong>${s.products || 0}</strong><span>Mahsulot</span></div>
        <div class="stat"><strong>${s.owners || 0}</strong><span>Egasi</span></div>
        <div class="stat"><strong>${s.pending_moderation || 0}</strong><span>Kutilayotgan</span></div>
        <div class="stat"><strong>${s.promo_products || 0}</strong><span>Aksiya</span></div>
      </div>
      <div class="card">
        <h3>Bozorlar bo'yicha</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Bozor</th><th>Do'kon</th><th>Mahsulot</th></tr></thead>
          <tbody>
            ${(report.byMarket || []).map((m) => `
              <tr><td>${esc(m.name)}</td><td>${m.shops}</td><td>${m.products}</td></tr>
            `).join('')}
          </tbody>
        </table></div>
      </div>
      <div class="card">
        <h3>Top do'konlar (ko'rish bo'yicha)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Do'kon</th><th>Bozor</th><th>Ko'rish</th></tr></thead>
          <tbody>
            ${(report.topShops || []).map((s) => `
              <tr>
                <td>${esc(s.name)}</td>
                <td>${esc(s.market_name)}</td>
                <td>${s.views_count || 0}</td>
              </tr>
            `).join('') || '<tr><td colspan="3">Hali yo‘q</td></tr>'}
          </tbody>
        </table></div>
      </div>
    `;
  }

  async function renderModeration() {
    const { products } = await api('/moderation');
    panel.innerHTML = `
      <div class="card">
        <h3>Kutilayotgan mahsulotlar (${products.length})</h3>
        <p class="muted" style="margin-bottom:12px;">Yangi mahsulotlar tasdiqlangach xaridorlarga ko'rinadi.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Mahsulot</th><th>Do'kon</th><th>Bozor</th><th>Narx</th><th>Sana</th><th></th></tr></thead>
          <tbody>
            ${products.length ? products.map((p) => `
              <tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td>${esc(p.shop_name)}</td>
                <td>${esc(p.market_name)}</td>
                <td>${Number(p.price).toLocaleString('uz-UZ')}</td>
                <td class="muted">${esc((p.created_at || '').slice(0, 16))}</td>
                <td class="row-actions">
                  <button type="button" class="btn primary sm" data-approve="${p.id}">Tasdiqlash</button>
                  <button type="button" class="btn secondary sm" data-reject="${p.id}">Rad etish</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="6">Kutilayotgan mahsulot yo‘q</td></tr>'}
          </tbody>
        </table></div>
      </div>
    `;
    panel.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/moderation/${btn.dataset.approve}`, { method: 'PATCH', body: { status: 'approved' } });
        renderModeration();
      });
    });
    panel.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/moderation/${btn.dataset.reject}`, { method: 'PATCH', body: { status: 'rejected' } });
        renderModeration();
      });
    });
  }

  async function renderMarkets() {
    const { markets } = await api('/markets');
    marketsCache = markets;
    panel.innerHTML = `
      <div class="card">
        <h3>Yangi bozor qo'shish</h3>
        <form id="market-form">
          <div class="grid-2">
            <div class="field"><label>Nomi *</label><input name="name" required placeholder="Masalan: O'rikzor" /></div>
            <div class="field"><label>Shahar</label><input name="city" value="Toshkent" /></div>
          </div>
          <div class="field"><label>Manzil</label><input name="address" placeholder="Manzil" /></div>
          <div class="field"><label>Tavsif</label><textarea name="description" placeholder="Qisqa tavsif"></textarea></div>
          <button class="btn primary" type="submit">Saqlash</button>
          <p class="success" id="market-msg" hidden></p>
          <p class="error" id="market-err" hidden></p>
        </form>
      </div>
      <div class="card">
        <h3>Barcha bozorlar</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nomi</th><th>Shahar</th><th>Do'kon</th><th>Holat</th><th></th></tr></thead>
            <tbody>
              ${markets.map((m) => `
                <tr>
                  <td><strong>${esc(m.name)}</strong><div class="muted">${esc(m.address || '')}</div></td>
                  <td>${esc(m.city || '')}</td>
                  <td>${m.shops_count || 0}</td>
                  <td>${m.is_active ? 'Faol' : 'O‘chiq'}</td>
                  <td><button type="button" class="btn secondary sm" data-view-market="${m.id}">Ko'rish</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div id="market-detail"></div>
      </div>
    `;

    $('#market-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      const msg = $('#market-msg');
      const err = $('#market-err');
      msg.hidden = true;
      err.hidden = true;
      try {
        await api('/markets', { method: 'POST', body });
        msg.textContent = 'Bozor qo‘shildi';
        msg.hidden = false;
        renderMarkets();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });

    panel.querySelectorAll('[data-view-market]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.viewMarket;
        const box = $('#market-detail');
        box.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
        try {
          const data = await api(`/markets/${id}`);
          const { market, shops } = data;
          box.innerHTML = `
            <div class="detail">
              <strong>${esc(market.name)}</strong> — ${esc(market.description || '')}<br/>
              Manzil: ${esc(market.address || '—')}<br/><br/>
              <strong>Do'konlar (${shops.length})</strong>
              <ul style="margin-top:8px;padding-left:18px;">
                ${shops.map((s) => `
                  <li style="margin-bottom:10px;">
                    <strong>${esc(s.name)}</strong> · ${esc(s.phone)} · ${esc(s.address)}
                    · mahsulot: ${s.products_count || 0}<br/>
                    <span class="muted">Egasi:</span> ${esc(s.owner_name || '—')}
                    · login: <code>${esc(s.owner_login_phone || '—')}</code>
                    · parol: ${s.owner_password
                      ? `<code>${esc(s.owner_password)}</code>`
                      : '<span class="muted">—</span>'}
                  </li>
                `).join('') || '<li>Do‘kon yo‘q</li>'}
              </ul>
            </div>
          `;
        } catch (ex) {
          box.innerHTML = `<p class="error">${esc(ex.message)}</p>`;
        }
      });
    });
  }

  function shopDetailHtml(shop, products = []) {
    const hasOwner = shop.owner_name || shop.owner_login_phone || shop.owner_password;
    return `
      <div class="detail">
        <strong style="font-size:1.05rem;color:var(--text);">${esc(shop.name)}</strong>
        <div style="margin-top:10px;display:grid;gap:6px;">
          <div><span class="muted">Bozor:</span> ${esc(shop.market_name || '—')}</div>
          <div><span class="muted">Do'kon telefoni:</span> ${esc(shop.phone || '—')}</div>
          <div><span class="muted">Manzil:</span> ${esc(shop.address || '—')}</div>
          ${shop.description ? `<div><span class="muted">Tavsif:</span> ${esc(shop.description)}</div>` : ''}
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:14px 0;" />
        <strong style="color:var(--text);">Do'kon egasi (kirish)</strong>
        ${hasOwner ? `
          <div style="margin-top:10px;display:grid;gap:6px;">
            <div><span class="muted">Ism:</span> ${esc(shop.owner_name || '—')}</div>
            <div><span class="muted">Login telefon:</span> <code>${esc(shop.owner_login_phone || '—')}</code></div>
            <div>
              <span class="muted">Parol:</span>
              ${shop.owner_password
                ? `<span class="pwd-wrap">
                    <code class="pwd-value" data-pwd="${esc(shop.owner_password)}">••••••••</code>
                    <button type="button" class="btn secondary sm btn-toggle-pwd">Ko'rish</button>
                  </span>`
                : '<span class="muted">saqlanmagan — Do\'kon egalari bo\'limidan yangilang</span>'}
            </div>
          </div>
        ` : `<p class="muted" style="margin-top:8px;">Egasi biriktirilmagan. «Do'kon egalari» dan egasi + do'kon yarating yoki egaga do'kon bog'lang.</p>`}
        <hr style="border:none;border-top:1px solid var(--border);margin:14px 0;" />
        <strong style="color:var(--text);">Mahsulotlar (${products.length})</strong>
        <ul style="margin-top:8px;padding-left:18px;">
          ${products.length
            ? products.map((p) => `<li>${esc(p.name)} — ${Number(p.price).toLocaleString('uz-UZ')} so'm / ${esc(p.unit)}</li>`).join('')
            : '<li class="muted">Mahsulot yo‘q</li>'}
        </ul>
      </div>
    `;
  }

  function bindPwdToggles(root) {
    (root || panel).querySelectorAll('.btn-toggle-pwd').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.parentElement.querySelector('.pwd-value');
        const real = code?.dataset?.pwd || '';
        if (!real) return;
        const showing = code.dataset.show === '1';
        if (showing) {
          code.textContent = '••••••••';
          code.dataset.show = '0';
          btn.textContent = "Ko'rish";
        } else {
          code.textContent = real;
          code.dataset.show = '1';
          btn.textContent = 'Yashirish';
        }
      });
    });
  }

  async function renderShops() {
    const { shops } = await api('/shops');
    panel.innerHTML = `
      <div class="card">
        <h3>Barcha do'konlar</h3>
        <p class="muted" style="margin-bottom:12px;">«Tafsilot» da do'kon ma'lumotlari, egasi login/paroli va mahsulotlar chiqadi.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Do'kon</th>
                <th>Bozor</th>
                <th>Telefon</th>
                <th>Egasi / Login</th>
                <th>Parol</th>
                <th>Mahsulot</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${shops.map((s) => `
                <tr>
                  <td><strong>${esc(s.name)}</strong><div class="muted">${esc(s.address)}</div></td>
                  <td>${esc(s.market_name)}</td>
                  <td>${esc(s.phone)}</td>
                  <td>${esc(s.owner_name || '—')}<div class="muted">${esc(s.owner_login_phone || '')}</div></td>
                  <td>
                    ${s.owner_password
                      ? `<span class="pwd-wrap">
                          <code class="pwd-value" data-pwd="${esc(s.owner_password)}">••••••••</code>
                          <button type="button" class="btn secondary sm btn-toggle-pwd">Ko'rish</button>
                        </span>`
                      : '<span class="muted">—</span>'}
                  </td>
                  <td>${s.products_count || 0}</td>
                  <td><button type="button" class="btn secondary sm" data-shop="${s.id}">Tafsilot</button></td>
                </tr>
              `).join('') || '<tr><td colspan="7">Do‘kon yo‘q</td></tr>'}
            </tbody>
          </table>
        </div>
        <div id="shop-detail"></div>
      </div>
    `;

    bindPwdToggles(panel);

    panel.querySelectorAll('[data-shop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const box = $('#shop-detail');
        box.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
        try {
          const { shop, products } = await api(`/shops/${btn.dataset.shop}`);
          box.innerHTML = shopDetailHtml(shop, products);
          bindPwdToggles(box);
          box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (ex) {
          box.innerHTML = `<p class="error">${esc(ex.message)}</p>`;
        }
      });
    });
  }

  async function renderOwners() {
    const [{ owners }, { markets }] = await Promise.all([api('/owners'), api('/markets')]);
    marketsCache = markets;
    panel.innerHTML = `
      <div class="card">
        <h3>Yangi do'kon egasi</h3>
        <form id="owner-form">
          <div class="grid-2">
            <div class="field"><label>Ism *</label><input name="name" required placeholder="Ism Familiya" /></div>
            <div class="field"><label>Telefon (login) *</label><input name="phone" required placeholder="+99890..." /></div>
          </div>
          <div class="grid-2">
            <div class="field"><label>Parol *</label><input name="password" required type="text" placeholder="Kamida 4 belgi" /></div>
            <div class="field">
              <label>Bozor (do'kon uchun)</label>
              <select name="marketId">
                <option value="">— do'konsiz —</option>
                ${markets.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="field"><label>Do'kon nomi</label><input name="shopName" placeholder="Masalan: Sifat Meva" /></div>
            <div class="field"><label>Do'kon telefoni</label><input name="shopPhone" placeholder="Bo'sh qoldirilsa login telefon" /></div>
          </div>
          <div class="field"><label>Do'kon manzili (bozor ichida)</label><input name="shopAddress" placeholder="12-qator, 5-do'kon" /></div>
          <div class="field"><label>Tavsif</label><textarea name="shopDescription"></textarea></div>
          <button class="btn primary" type="submit">Yaratish</button>
          <p class="success" id="owner-msg" hidden></p>
          <p class="error" id="owner-err" hidden></p>
        </form>
      </div>
      <div class="card">
        <h3>Ro'yxat</h3>
        <p class="muted" style="margin-bottom:12px;">Parollar faqat superadminga ko‘rinadi. Eski yozuvlarda parol bo‘sh bo‘lsa — “Parol o‘zgartirish” bilan yangilang.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ism</th>
                <th>Telefon</th>
                <th>Parol</th>
                <th>Telegram</th>
                <th>Do'kon</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${owners.map((o) => `
                <tr>
                  <td>${esc(o.name)}</td>
                  <td><code>${esc(o.phone)}</code></td>
                  <td>
                    <span class="pwd-wrap">
                      <code class="pwd-value" data-pwd="${esc(o.password || '')}">${o.password ? '••••••••' : '—'}</code>
                      ${o.password ? `<button type="button" class="btn secondary sm btn-toggle-pwd" title="Ko'rsatish">Ko'rish</button>` : ''}
                    </span>
                  </td>
                  <td>${o.telegram_id ? esc(o.telegram_id) : '—'}</td>
                  <td>${o.shops_count || 0}</td>
                  <td>
                    <button type="button" class="btn secondary sm" data-reset-pwd="${o.id}" data-name="${esc(o.name)}">Parol o'zgartirish</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="6">Hali yo‘q</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindPwdToggles(panel);

    panel.querySelectorAll('[data-reset-pwd]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.resetPwd;
        const name = btn.dataset.name || '';
        const pwd = prompt(`${name} uchun yangi parol (kamida 4 belgi):`);
        if (pwd == null) return;
        if (String(pwd).length < 4) {
          alert("Parol kamida 4 belgi bo'lsin");
          return;
        }
        try {
          await api(`/owners/${id}/password`, { method: 'PATCH', body: { password: pwd } });
          alert(`Parol yangilandi: ${pwd}`);
          renderOwners();
        } catch (ex) {
          alert(ex.message);
        }
      });
    });

    $('#owner-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      if (!body.marketId) delete body.marketId;
      const msg = $('#owner-msg');
      const err = $('#owner-err');
      msg.hidden = true;
      err.hidden = true;
      try {
        const data = await api('/owners', { method: 'POST', body });
        msg.innerHTML = `Yaratildi. Login: <strong>${esc(data.credentials.phone)}</strong> · Parol: <strong>${esc(data.credentials.password)}</strong>` +
          (data.shop ? ` · Do'kon: ${esc(data.shop.name)}` : '');
        msg.hidden = false;
        e.target.reset();
        setTimeout(() => renderOwners(), 800);
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // ——— Live updates (F5 shart emas) ———
  let liveAppVer = null;
  let liveDataRev = null;
  let liveBusy = false;
  let liveTimer = null;

  function isUserTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  async function pollLive() {
    if (document.hidden || liveBusy || !token) return;
    // Login yoki forma yozilayotganda aralashmaslik
    if (!appView || appView.classList.contains('hidden')) return;
    if (isUserTyping()) return;

    liveBusy = true;
    try {
      const res = await fetch(`/api/version?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const ver = await res.json();
      if (!ver?.app) return;

      if (liveAppVer == null) {
        liveAppVer = ver.app;
        liveDataRev = ver.data;
        return;
      }

      if (ver.app !== liveAppVer) {
        liveAppVer = ver.app;
        const url = new URL(location.href);
        url.searchParams.set('_v', String(Date.now()));
        location.replace(url.toString());
        return;
      }

      if (ver.data !== liveDataRev) {
        liveDataRev = ver.data;
        // Joriy tabni qayta chizish (to'liq sahifa refresh yo'q)
        await render();
      }
    } catch (_) {
      /* ignore */
    } finally {
      liveBusy = false;
    }
  }

  function startLiveUpdates() {
    if (liveTimer) clearInterval(liveTimer);
    pollLive();
    liveTimer = setInterval(pollLive, 4000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pollLive();
    });
  }

  // boot
  if (token) {
    api('/me')
      .then(showApp)
      .catch(() => {
        token = '';
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
      });
  } else {
    showLogin();
  }
})();

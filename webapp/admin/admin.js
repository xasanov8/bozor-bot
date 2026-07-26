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
    closeMenu();
    showLogin();
  });

  /* ——— Mobile drawer menu ——— */
  const menuToggle = $('#menu-toggle');
  const menuClose = $('#menu-close');
  const sidebarOverlay = $('#sidebar-overlay');
  const mobileTabLabel = $('#mobile-tab-label');

  function setMenuOpen(open) {
    document.body.classList.toggle('menu-open', !!open);
    if (menuToggle) menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (sidebarOverlay) {
      if (open) sidebarOverlay.hidden = false;
      else sidebarOverlay.hidden = true;
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  menuToggle?.addEventListener('click', () => {
    setMenuOpen(!document.body.classList.contains('menu-open'));
  });
  menuClose?.addEventListener('click', closeMenu);
  sidebarOverlay?.addEventListener('click', closeMenu);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
  });

  function setActiveNav(nextTab) {
    tab = nextTab;
    document.querySelectorAll('.sidebar .nav').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
  }

  document.querySelectorAll('.sidebar .nav').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveNav(btn.dataset.tab);
      closeMenu();
      render();
    });
  });

  let supportPollTimer = null;
  let supportSelectedId = null;
  let supportLastMsgId = 0;
  let supportLastListSnap = '';

  function stopSupportPoll() {
    if (supportPollTimer) {
      clearInterval(supportPollTimer);
      supportPollTimer = null;
    }
  }

  async function refreshSupportBadge() {
    const badge = document.getElementById('support-nav-badge');
    if (!badge || !token) return;
    try {
      const data = await api('/support/unread');
      const total = Number(data.total || 0);
      badge.textContent = total > 99 ? '99+' : String(total);
      badge.classList.toggle('hidden', total <= 0);
    } catch (_) { /* ignore */ }
  }

  async function render() {
    stopSupportPoll();
    const titles = {
      dashboard: 'Dashboard',
      report: 'Hisobot',
      support: 'Yordam',
      markets: 'Bozorlar',
      shops: "Do'konlar",
      owners: "Do'kon egalari",
    };
    const kickers = {
      dashboard: 'Asosiy',
      report: 'Asosiy',
      support: 'Asosiy',
      markets: 'Boshqaruv',
      shops: 'Boshqaruv',
      owners: 'Boshqaruv',
    };
    const title = titles[tab] || 'Admin';
    pageTitle.textContent = title;
    if (mobileTabLabel) mobileTabLabel.textContent = title;
    const kicker = document.getElementById('page-kicker');
    if (kicker) kicker.textContent = kickers[tab] || 'Panel';
    panel.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    try {
      if (tab === 'dashboard') await renderDashboard();
      else if (tab === 'report') await renderReport();
      else if (tab === 'support') await renderSupport();
      else if (tab === 'markets') await renderMarkets();
      else if (tab === 'shops') await renderShops();
      else if (tab === 'owners') await renderOwners();
      refreshSupportBadge();
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
    let supportUnread = 0;
    try {
      const su = await api('/support/unread');
      supportUnread = Number(su.total || 0);
    } catch (_) {}
    panel.innerHTML = `
      <div class="stats">
        <div class="stat"><strong>${stats.markets}</strong><span>Bozor</span></div>
        <div class="stat"><strong>${stats.shops}</strong><span>Do'kon</span></div>
        <div class="stat"><strong>${stats.products}</strong><span>Mahsulot</span></div>
        <div class="stat"><strong>${stats.owners}</strong><span>Do'kon egasi</span></div>
      </div>
      ${supportUnread > 0 ? `
      <div class="card">
        <h3>Yordam — yangi xabarlar</h3>
        <p class="muted" style="margin-bottom:12px;"><strong style="color:var(--warn)">${supportUnread}</strong> ta o‘qilmagan support xabari.</p>
        <button type="button" class="btn primary sm" data-go="support">Yordamga o‘tish</button>
      </div>` : ''}
      <div class="card">
        <h3>Tezkor harakatlar</h3>
        <p class="muted" style="margin-bottom:12px;">Kerakli bo‘limga bir bosishda o‘ting.</p>
        <div class="row-actions">
          <button type="button" class="btn secondary sm" data-go="markets">Bozorlar</button>
          <button type="button" class="btn secondary sm" data-go="shops">Do'konlar</button>
          <button type="button" class="btn secondary sm" data-go="owners">Do'kon egalari</button>
          <button type="button" class="btn secondary sm" data-go="support">Yordam</button>
          <button type="button" class="btn secondary sm" data-go="report">Hisobot</button>
        </div>
      </div>
      <div class="card">
        <h3>Qisqa qo'llanma</h3>
        <p class="muted">1. <strong>Bozor</strong> qo‘shing → 2. <strong>Do‘kon egasi</strong> yarating (login + parol) → 3. Egasi bot/WebApp orqali mahsulot qo‘shadi → 4. <strong>Hisobot</strong>da umumiy holatni kuzating.</p>
      </div>
    `;
    panel.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setActiveNav(btn.dataset.go);
        closeMenu();
        render();
      });
    });
  }

  async function renderReport() {
    const { report } = await api('/report');
    const s = report.summary;
    panel.innerHTML = `
      <div class="stats stats-5">
        <div class="stat"><strong>${s.markets || 0}</strong><span>Bozor</span></div>
        <div class="stat"><strong>${s.shops || 0}</strong><span>Do'kon</span></div>
        <div class="stat"><strong>${s.products || 0}</strong><span>Mahsulot</span></div>
        <div class="stat"><strong>${s.owners || 0}</strong><span>Egasi</span></div>
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

  async function renderSupport() {
    supportSelectedId = supportSelectedId || null;
    supportLastMsgId = 0;
    supportLastListSnap = '';

    panel.innerHTML = `
      <div class="support-layout">
        <div class="card support-list-card">
          <h3>Support so‘rovlar <span class="muted" id="support-live-dot" style="font-size:0.75rem;">· jonli</span></h3>
          <p class="muted" style="margin-bottom:12px;">Foydalanuvchilar yozgan muammolar. Yangi xabarlar avtomatik keladi.</p>
          <div id="support-thread-list" class="support-thread-list">
            <p class="muted">Yuklanmoqda...</p>
          </div>
        </div>
        <div class="card support-chat-card">
          <div id="support-chat-head" class="support-chat-head">
            <strong>Chat tanlang</strong>
            <span class="muted">Chapdagi ro‘yxatdan foydalanuvchini tanlang</span>
          </div>
          <div class="support-messages" id="support-messages">
            <p class="muted text-center" style="padding:24px 8px;">Hali chat ochilmagan</p>
          </div>
          <div class="support-compose" id="support-compose" hidden>
            <input type="text" id="support-input" placeholder="Javob yozing..." maxlength="2000" />
            <button type="button" class="btn primary" id="support-send">Yuborish</button>
          </div>
        </div>
      </div>
    `;

    const listEl = $('#support-thread-list');
    const msgEl = $('#support-messages');
    const headEl = $('#support-chat-head');
    const compose = $('#support-compose');
    const input = $('#support-input');
    const sendBtn = $('#support-send');

    function paintMessages(messages, keepInput = false) {
      const draft = keepInput ? (input?.value || '') : '';
      const nearBottom = (() => {
        if (!msgEl) return true;
        return msgEl.scrollHeight - msgEl.scrollTop - msgEl.clientHeight < 90;
      })();
      if (!messages.length) {
        msgEl.innerHTML = '<p class="muted text-center" style="padding:24px 8px;">Xabar yo‘q — birinchi bo‘lib yozing</p>';
      } else {
        msgEl.innerHTML = messages.map((m) => `
          <div class="support-bubble ${m.sender_role === 'admin' ? 'me' : 'them'}">
            <div class="support-meta">${m.sender_role === 'admin' ? 'Siz (admin)' : 'Foydalanuvchi'}</div>
            <div>${esc(m.body)}</div>
            <div class="support-time">${esc((m.created_at || '').slice(0, 16))}</div>
          </div>
        `).join('');
      }
      if (nearBottom) msgEl.scrollTop = msgEl.scrollHeight;
      if (keepInput && input) {
        input.value = draft;
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      }
    }

    async function loadThread(id, keepInput = false) {
      supportSelectedId = Number(id);
      const data = await api(`/support/${supportSelectedId}`);
      const t = data.thread;
      const messages = data.messages || [];
      supportLastMsgId = messages.length ? messages[messages.length - 1].id : 0;
      headEl.innerHTML = `
        <strong>${esc(t.user_name || t.user_key)}</strong>
        <span class="muted">${esc(t.user_role || 'user')} · ${esc(t.user_key)} · ${esc((t.last_at || '').slice(0, 16))}</span>
      `;
      compose.hidden = false;
      paintMessages(messages, keepInput);
      // ro'yxatdagi active holat
      listEl.querySelectorAll('[data-support-id]').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.supportId) === supportSelectedId);
      });
      refreshSupportBadge();
    }

    function paintList(threads) {
      if (!threads.length) {
        listEl.innerHTML = '<p class="muted">Hali support so‘rovi yo‘q</p>';
        return;
      }
      listEl.innerHTML = threads.map((t) => {
        const u = Number(t.unread || t.admin_unread || 0);
        const active = Number(t.id) === Number(supportSelectedId);
        return `
          <button type="button" class="support-thread ${active ? 'active' : ''}" data-support-id="${t.id}">
            <div class="support-thread-top">
              <strong>${esc(t.user_name || t.user_key)}</strong>
              ${u > 0 ? `<span class="chip-new">${u}</span>` : ''}
            </div>
            <div class="muted" style="font-size:0.78rem;">${esc(t.user_role || '')} · ${esc((t.last_at || '').slice(0, 16))}</div>
            <div class="support-thread-preview">${esc(t.last_message || '')}</div>
          </button>
        `;
      }).join('');
      listEl.querySelectorAll('[data-support-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await loadThread(btn.dataset.supportId, false);
          } catch (ex) {
            alert(ex.message);
          }
        });
      });
    }

    async function refreshList(selectFirst = false) {
      const { threads } = await api('/support');
      const snap = JSON.stringify((threads || []).map((t) => [t.id, t.admin_unread, t.last_message, t.last_at]));
      if (snap !== supportLastListSnap) {
        supportLastListSnap = snap;
        paintList(threads || []);
      }
      if (selectFirst && !supportSelectedId && threads?.length) {
        await loadThread(threads[0].id, false);
      } else if (supportSelectedId && threads?.some((t) => Number(t.id) === Number(supportSelectedId))) {
        // keep selection class
        listEl.querySelectorAll('[data-support-id]').forEach((btn) => {
          btn.classList.toggle('active', Number(btn.dataset.supportId) === Number(supportSelectedId));
        });
      }
      return threads || [];
    }

    async function pollSupport() {
      if (document.hidden || tab !== 'support') return;
      if (document.activeElement === input) {
        // yozayotganda faqat yangi xabarlarni nozik yangilash
      }
      try {
        await refreshList(false);
        if (supportSelectedId) {
          const data = await api(`/support/${supportSelectedId}`);
          const next = data.messages || [];
          const maxId = next.length ? next[next.length - 1].id : 0;
          if (maxId !== supportLastMsgId || next.length !== (msgEl.querySelectorAll('.support-bubble').length)) {
            supportLastMsgId = maxId;
            const head = data.thread;
            headEl.innerHTML = `
              <strong>${esc(head.user_name || head.user_key)}</strong>
              <span class="muted">${esc(head.user_role || 'user')} · ${esc(head.user_key)} · ${esc((head.last_at || '').slice(0, 16))}</span>
            `;
            paintMessages(next, true);
          }
        }
        refreshSupportBadge();
      } catch (_) { /* ignore */ }
    }

    sendBtn?.addEventListener('click', async () => {
      const body = (input?.value || '').trim();
      if (!body || !supportSelectedId) return;
      try {
        const data = await api(`/support/${supportSelectedId}/reply`, {
          method: 'POST',
          body: { body },
        });
        input.value = '';
        const messages = data.messages || [];
        supportLastMsgId = messages.length ? messages[messages.length - 1].id : supportLastMsgId;
        paintMessages(messages, false);
        supportLastListSnap = '';
        await refreshList(false);
      } catch (ex) {
        alert(ex.message);
      }
    });
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendBtn?.click();
    });

    try {
      await refreshList(true);
    } catch (ex) {
      listEl.innerHTML = `<p class="error">${esc(ex.message)}</p>`;
    }

    stopSupportPoll();
    supportPollTimer = setInterval(pollSupport, 2000);
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
                ? pwdToggleHtml(shop.owner_password)
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

  /** Parollar HTML atributida emas — xotirada (maxfiy va ishonchli) */
  const pwdStore = new Map();
  let pwdSeq = 0;

  function pwdToggleHtml(password) {
    const raw = password == null ? '' : String(password);
    if (!raw) return '<span class="muted">—</span>';
    const id = 'p' + String(++pwdSeq);
    pwdStore.set(id, raw);
    return (
      '<span class="pwd-wrap">' +
        '<code class="pwd-value" data-pwd-id="' + id + '">••••••••</code> ' +
        '<button type="button" class="btn secondary sm btn-toggle-pwd" data-pwd-id="' + id + '">Ko\'rish</button>' +
      '</span>'
    );
  }

  /** Bir marta document darajasida — qayta chizishdan mustaqil ishlaydi */
  function bindPwdToggles() {
    /* no-op: global handler ishlatiladi */
  }

  if (!window.__bozorPwdToggleBound) {
    window.__bozorPwdToggleBound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('.btn-toggle-pwd');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-pwd-id') || '';
      const real = pwdStore.get(id) || '';
      if (!real) return;
      const wrap = btn.closest('.pwd-wrap');
      const code = wrap
        ? wrap.querySelector('.pwd-value')
        : document.querySelector('.pwd-value[data-pwd-id="' + id + '"]');
      if (!code) return;
      const showing = code.getAttribute('data-show') === '1';
      if (showing) {
        code.textContent = '••••••••';
        code.setAttribute('data-show', '0');
        btn.textContent = "Ko'rish";
      } else {
        code.textContent = real;
        code.setAttribute('data-show', '1');
        btn.textContent = 'Yashirish';
      }
    });
  }

  function shopRowHtml(s) {
    return `
      <tr data-row="1"
          data-market-id="${s.market_id || ''}"
          data-phone="${esc(String(s.phone || '').toLowerCase())}"
          data-login="${esc(String(s.owner_login_phone || '').toLowerCase())}"
          data-name="${esc(String(s.name || '').toLowerCase())}">
        <td><strong>${esc(s.name)}</strong><div class="muted">${esc(s.address)}</div></td>
        <td>${esc(s.market_name)}</td>
        <td><code>${esc(s.phone)}</code></td>
        <td>${esc(s.owner_name || '—')}<div class="muted">${esc(s.owner_login_phone || '')}</div></td>
        <td>${pwdToggleHtml(s.owner_password)}</td>
        <td>${s.products_count || 0}</td>
        <td><button type="button" class="btn secondary sm" data-shop="${s.id}">Tafsilot</button></td>
      </tr>`;
  }

  function bindShopTable(root, allShops) {
    const marketSel = root.querySelector('#shop-market-filter');
    const phoneInput = root.querySelector('#shop-phone-filter');
    const tbody = root.querySelector('#shops-tbody');
    const countEl = root.querySelector('#shops-count');
    const emptyEl = root.querySelector('#shops-empty');

    function applyFilter() {
      const marketId = marketSel?.value || '';
      const phoneQ = (phoneInput?.value || '').replace(/\s+/g, '').toLowerCase();
      let shown = 0;
      tbody.querySelectorAll('tr[data-row]').forEach((tr) => {
        const mid = String(tr.dataset.marketId || '');
        const phone = String(tr.dataset.phone || '');
        const login = String(tr.dataset.login || '');
        const name = String(tr.dataset.name || '');
        let ok = true;
        if (marketId && mid !== marketId) ok = false;
        if (ok && phoneQ) {
          ok = phone.includes(phoneQ) || login.includes(phoneQ) || name.includes(phoneQ);
        }
        tr.style.display = ok ? '' : 'none';
        if (ok) shown += 1;
      });
      if (countEl) {
        const marketName = marketId
          ? (marketSel.options[marketSel.selectedIndex]?.text || 'Bozor')
          : 'Barcha bozorlar';
        countEl.textContent = `${marketName}: ${shown} ta do'kon`;
      }
      if (emptyEl) emptyEl.hidden = shown > 0;
    }

    marketSel?.addEventListener('change', applyFilter);
    phoneInput?.addEventListener('input', applyFilter);
    applyFilter();

    bindPwdToggles(root);
    root.querySelectorAll('[data-shop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const box = root.querySelector('#shop-detail');
        if (!box) return;
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

  function shopsBrowserHtml(shops, markets, title) {
    return `
      <div class="card">
        <h3>${esc(title)}</h3>
        <p class="muted" style="margin-bottom:12px;">
          Avval <strong>bozorni tanlang</strong> — shu bozorning barcha do'konlari chiqadi.
          Keyin ixtiyoriy <strong>telefon</strong> yozib aniq do'konni toping.
        </p>
        <div class="filter-bar">
          <div class="field" style="margin:0;">
            <label>Bozor *</label>
            <select id="shop-market-filter">
              <option value="">— Barcha bozorlar —</option>
              ${markets.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin:0;">
            <label>Telefon qidiruv</label>
            <input id="shop-phone-filter" type="search" placeholder="+99890... yoki do'kon nomi" />
          </div>
        </div>
        <p class="muted" id="shops-count" style="margin:10px 0 8px;"></p>
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
            <tbody id="shops-tbody">
              ${shops.map(shopRowHtml).join('') || ''}
            </tbody>
          </table>
        </div>
        <p class="muted" id="shops-empty" hidden style="margin-top:12px;">Bu bozor/telefon bo'yicha do'kon topilmadi.</p>
        <div id="shop-detail"></div>
      </div>
    `;
  }

  async function renderShops() {
    const [{ shops }, { markets }] = await Promise.all([api('/shops'), api('/markets')]);
    marketsCache = markets;
    panel.innerHTML = shopsBrowserHtml(shops, markets, "Do'konlar");
    bindShopTable(panel, shops);
  }

  async function renderOwners() {
    const [{ owners }, { markets }, shopsRes] = await Promise.all([
      api('/owners'),
      api('/markets'),
      api('/shops'),
    ]);
    marketsCache = markets;
    const shops = shopsRes.shops || [];

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
        <h3>Do'kon egalari ro'yxati</h3>
        <p class="muted" style="margin-bottom:12px;">
          Avval <strong>bozorni tanlang</strong> — shu bozordagi do'kon egalari chiqadi.
          Keyin ixtiyoriy <strong>telefon</strong> yozib toping. Parollar faqat superadminga ko‘rinadi.
        </p>
        <div class="filter-bar">
          <div class="field" style="margin:0;">
            <label>Bozor *</label>
            <select id="owner-market-filter">
              <option value="">— Barcha bozorlar —</option>
              ${markets.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin:0;">
            <label>Telefon / ism qidiruv</label>
            <input id="owner-phone-filter" type="search" placeholder="+99890... yoki ism" />
          </div>
        </div>
        <p class="muted" id="owners-count" style="margin:10px 0 8px;"></p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ism</th>
                <th>Telefon</th>
                <th>Parol</th>
                <th>Telegram</th>
                <th>Do'konlar</th>
                <th>Bozorlar</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="owners-tbody">
              ${owners.map((o) => {
                // Shu egaga tegishli do'konlarning bozorlari
                const ownerShops = shops.filter((s) =>
                  Number(s.owner_account_id) === Number(o.id) ||
                  String(s.owner_login_phone || '') === String(o.phone || '')
                );
                const marketIds = [...new Set(ownerShops.map((s) => String(s.market_id || '')).filter(Boolean))];
                const marketNames = [...new Set(ownerShops.map((s) => s.market_name).filter(Boolean))];
                return `
                <tr
                  data-owner-phone="${esc(String(o.phone || '').toLowerCase())}"
                  data-owner-name="${esc(String(o.name || '').toLowerCase())}"
                  data-market-ids="${esc(marketIds.join(','))}"
                >
                  <td>${esc(o.name)}</td>
                  <td><code>${esc(o.phone)}</code></td>
                  <td>${pwdToggleHtml(o.password)}</td>
                  <td>${o.telegram_id ? esc(o.telegram_id) : '—'}</td>
                  <td>${o.shops_count || ownerShops.length || 0}</td>
                  <td class="muted" style="font-size:0.85rem;">${esc(marketNames.join(', ') || '—')}</td>
                  <td>
                    <button type="button" class="btn secondary sm" data-reset-pwd="${o.id}" data-name="${esc(o.name)}">Parol o'zgartirish</button>
                  </td>
                </tr>`;
              }).join('') || '<tr><td colspan="7">Hali yo‘q</td></tr>'}
            </tbody>
          </table>
        </div>
        <p class="muted" id="owners-empty" hidden style="margin-top:12px;">Bu bozor/telefon bo'yicha ega topilmadi.</p>
      </div>
    `;

    // Egalar: bozor + telefon filtri
    const ownerMarket = $('#owner-market-filter');
    const ownerPhone = $('#owner-phone-filter');
    const ownersCount = $('#owners-count');
    const ownersEmpty = $('#owners-empty');

    function applyOwnerFilter() {
      const marketId = ownerMarket?.value || '';
      const q = (ownerPhone?.value || '').replace(/\s+/g, '').toLowerCase();
      let shown = 0;
      panel.querySelectorAll('#owners-tbody tr[data-owner-phone]').forEach((tr) => {
        const phone = tr.dataset.ownerPhone || '';
        const name = tr.dataset.ownerName || '';
        const marketIds = (tr.dataset.marketIds || '').split(',').filter(Boolean);
        let ok = true;
        if (marketId) {
          // Shu bozorda do'koni bor egalargina
          ok = marketIds.includes(String(marketId));
        }
        if (ok && q) {
          ok = phone.includes(q) || name.includes(q);
        }
        tr.style.display = ok ? '' : 'none';
        if (ok) shown += 1;
      });
      if (ownersCount) {
        const marketName = marketId
          ? (ownerMarket.options[ownerMarket.selectedIndex]?.text || 'Bozor')
          : 'Barcha bozorlar';
        ownersCount.textContent = `${marketName}: ${shown} ta do'kon egasi`;
      }
      if (ownersEmpty) ownersEmpty.hidden = shown > 0;
    }

    ownerMarket?.addEventListener('change', applyOwnerFilter);
    ownerPhone?.addEventListener('input', applyOwnerFilter);
    applyOwnerFilter();

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
        // Support ochiq bo'lsa o'z polleri yangilaydi — to'liq re-render shart emas
        if (tab === 'support') {
          refreshSupportBadge();
        } else {
          await render();
        }
      }
      refreshSupportBadge();
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

(() => {
  const TOKEN_KEY = 'bozor_superadmin_token';
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let tab = 'dashboard';
  let marketsCache = [];

  const t = (key, vars) => (window.AdminI18N ? window.AdminI18N.t(key, vars) : key);

  function syncLangButtons() {
    const lang = window.AdminI18N?.getLang?.() || 'uz';
    document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  function applyStaticI18n() {
    window.AdminI18N?.applyDom?.(document);
    syncLangButtons();
  }

  function bindLangSwitch() {
    document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
      if (btn._langBound) return;
      btn._langBound = true;
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        if (!next || next === window.AdminI18N?.getLang?.()) return;
        window.AdminI18N.setLang(next);
        applyStaticI18n();
        if (token && !appView.classList.contains('hidden')) render();
      });
    });
  }

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
    destroyReportCharts();
    const titles = {
      dashboard: t('nav_dashboard'),
      report: t('nav_report'),
      support: t('nav_support'),
      markets: t('nav_markets'),
      shops: t('nav_shops'),
      owners: t('nav_owners'),
    };
    const kickers = {
      dashboard: t('kicker_main'),
      report: t('kicker_main'),
      support: t('kicker_main'),
      markets: t('kicker_manage'),
      shops: t('kicker_manage'),
      owners: t('kicker_manage'),
    };
    const title = titles[tab] || 'Admin';
    pageTitle.textContent = title;
    if (mobileTabLabel) mobileTabLabel.textContent = title;
    const kicker = document.getElementById('page-kicker');
    if (kicker) kicker.textContent = kickers[tab] || 'Panel';
    panel.innerHTML = `<p class="muted">${t('loading')}</p>`;
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
        <div class="stat"><strong>${stats.markets}</strong><span>${esc(t('market'))}</span></div>
        <div class="stat"><strong>${stats.shops}</strong><span>${esc(t('shop'))}</span></div>
        <div class="stat"><strong>${stats.products}</strong><span>${esc(t('product'))}</span></div>
        <div class="stat"><strong>${stats.owners}</strong><span>${esc(t('owner'))}</span></div>
      </div>
      ${supportUnread > 0 ? `
      <div class="card">
        <h3>${esc(t('support_new_title'))}</h3>
        <p class="muted" style="margin-bottom:12px;">${t('support_new_body', { n: supportUnread })}</p>
        <button type="button" class="btn primary sm" data-go="support">${esc(t('go_support'))}</button>
      </div>` : ''}
      <div class="card">
        <h3>${esc(t('quick_actions'))}</h3>
        <p class="muted" style="margin-bottom:12px;">${esc(t('quick_hint'))}</p>
        <div class="row-actions">
          <button type="button" class="btn secondary sm" data-go="markets">${esc(t('nav_markets'))}</button>
          <button type="button" class="btn secondary sm" data-go="shops">${esc(t('nav_shops'))}</button>
          <button type="button" class="btn secondary sm" data-go="owners">${esc(t('nav_owners'))}</button>
          <button type="button" class="btn secondary sm" data-go="support">${esc(t('nav_support'))}</button>
          <button type="button" class="btn secondary sm" data-go="report">${esc(t('nav_report'))}</button>
        </div>
      </div>
      <div class="card">
        <h3>${esc(t('guide'))}</h3>
        <p class="muted">${t('guide_text')}</p>
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

  let reportCharts = [];

  function destroyReportCharts() {
    reportCharts.forEach((c) => {
      try { c.destroy(); } catch (_) {}
    });
    reportCharts = [];
  }

  function waitForChartJs(timeoutMs = 4000) {
    return new Promise((resolve) => {
      if (window.Chart) return resolve(true);
      const start = Date.now();
      const id = setInterval(() => {
        if (window.Chart) {
          clearInterval(id);
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(id);
          resolve(false);
        }
      }, 40);
    });
  }

  async function renderReport() {
    destroyReportCharts();
    const { report } = await api('/report');
    const s = report.summary || {};
    const byMarket = report.byMarket || [];
    const topShops = report.topShops || [];

    const maxViews = Math.max(1, ...topShops.map((x) => Number(x.views_count || 0)));

    panel.innerHTML = `
      <div class="report-hero">
        <div class="report-hero-text">
          <p class="report-kicker">${esc(t('nav_report'))}</p>
          <h3>${esc(t('report_overview'))}</h3>
          <p class="muted">${esc(t('nav_report_d'))}</p>
        </div>
        <div class="report-hero-glow" aria-hidden="true"></div>
      </div>

      <div class="report-kpis">
        <div class="report-kpi kpi-green">
          <div class="kpi-icon">🏛</div>
          <div class="kpi-body">
            <strong>${s.markets || 0}</strong>
            <span>${esc(t('kpi_markets'))}</span>
          </div>
        </div>
        <div class="report-kpi kpi-blue">
          <div class="kpi-icon">🛍</div>
          <div class="kpi-body">
            <strong>${s.shops || 0}</strong>
            <span>${esc(t('kpi_shops'))}</span>
          </div>
        </div>
        <div class="report-kpi kpi-violet">
          <div class="kpi-icon">📦</div>
          <div class="kpi-body">
            <strong>${s.products || 0}</strong>
            <span>${esc(t('kpi_products'))}</span>
          </div>
        </div>
        <div class="report-kpi kpi-amber">
          <div class="kpi-icon">👤</div>
          <div class="kpi-body">
            <strong>${s.owners || 0}</strong>
            <span>${esc(t('kpi_owners'))}</span>
          </div>
        </div>
        <div class="report-kpi kpi-rose">
          <div class="kpi-icon">🏷</div>
          <div class="kpi-body">
            <strong>${s.promo_products || 0}</strong>
            <span>${esc(t('kpi_promo'))}</span>
          </div>
        </div>
      </div>

      <div class="report-charts-grid">
        <div class="card report-chart-card">
          <div class="report-card-head">
            <h3>${esc(t('report_composition'))}</h3>
          </div>
          <div class="chart-wrap chart-wrap-donut">
            <canvas id="chart-composition"></canvas>
          </div>
        </div>
        <div class="card report-chart-card report-chart-wide">
          <div class="report-card-head">
            <h3>${esc(t('report_market_compare'))}</h3>
          </div>
          <div class="chart-wrap">
            <canvas id="chart-markets"></canvas>
          </div>
        </div>
      </div>

      <div class="report-charts-grid report-charts-bottom">
        <div class="card report-chart-card report-chart-wide">
          <div class="report-card-head">
            <h3>${esc(t('report_top_views'))}</h3>
          </div>
          <div class="chart-wrap">
            <canvas id="chart-top-shops"></canvas>
          </div>
        </div>
        <div class="card report-rank-card">
          <div class="report-card-head">
            <h3>${esc(t('top_shops'))}</h3>
          </div>
          <div class="rank-list">
            ${topShops.length ? topShops.slice(0, 8).map((shop, i) => {
              const views = Number(shop.views_count || 0);
              const pct = Math.round((views / maxViews) * 100);
              return `
                <div class="rank-row">
                  <div class="rank-num">${i + 1}</div>
                  <div class="rank-meta">
                    <strong>${esc(shop.name)}</strong>
                    <span class="muted">${esc(shop.market_name || '')}</span>
                    <div class="rank-bar"><i style="width:${pct}%"></i></div>
                  </div>
                  <div class="rank-val">${views}</div>
                </div>`;
            }).join('') : `<p class="muted">${esc(t('none_yet'))}</p>`}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="report-card-head">
          <h3>${esc(t('table_details'))} · ${esc(t('report_by_market'))}</h3>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>${esc(t('market'))}</th><th>${esc(t('shop'))}</th><th>${esc(t('product'))}</th></tr></thead>
          <tbody>
            ${byMarket.map((m) => `
              <tr><td>${esc(m.name)}</td><td>${m.shops}</td><td>${m.products}</td></tr>
            `).join('') || `<tr><td colspan="3">${esc(t('none_yet'))}</td></tr>`}
          </tbody>
        </table></div>
      </div>
    `;

    const ready = await waitForChartJs();
    if (!ready || !window.Chart) return;

    const textColor = '#8b9bb8';
    const gridColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.color = textColor;
    Chart.defaults.font.family = '"DM Sans", system-ui, sans-serif';
    Chart.defaults.borderColor = gridColor;

    // Doughnut — tarkib
    const compEl = document.getElementById('chart-composition');
    if (compEl) {
      reportCharts.push(new Chart(compEl, {
        type: 'doughnut',
        data: {
          labels: [t('kpi_markets'), t('kpi_shops'), t('kpi_products'), t('kpi_owners'), t('kpi_promo')],
          datasets: [{
            data: [
              Number(s.markets || 0),
              Number(s.shops || 0),
              Number(s.products || 0),
              Number(s.owners || 0),
              Number(s.promo_products || 0),
            ],
            backgroundColor: [
              'rgba(34, 197, 94, 0.85)',
              'rgba(56, 189, 248, 0.85)',
              'rgba(167, 139, 250, 0.85)',
              'rgba(251, 191, 36, 0.85)',
              'rgba(244, 114, 182, 0.85)',
            ],
            borderColor: '#121a2b',
            borderWidth: 3,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, padding: 14, usePointStyle: true },
            },
          },
        },
      }));
    }

    // Bar — bozorlar
    const mEl = document.getElementById('chart-markets');
    if (mEl) {
      reportCharts.push(new Chart(mEl, {
        type: 'bar',
        data: {
          labels: byMarket.map((m) => m.name),
          datasets: [
            {
              label: t('chart_shops'),
              data: byMarket.map((m) => Number(m.shops || 0)),
              backgroundColor: 'rgba(56, 189, 248, 0.75)',
              borderRadius: 8,
              borderSkipped: false,
            },
            {
              label: t('chart_products'),
              data: byMarket.map((m) => Number(m.products || 0)),
              backgroundColor: 'rgba(34, 197, 94, 0.75)',
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 40, minRotation: 0 },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { precision: 0 },
            },
          },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: { boxWidth: 12, usePointStyle: true, padding: 16 },
            },
          },
        },
      }));
    }

    // Horizontal bar — top shops views
    const tEl = document.getElementById('chart-top-shops');
    if (tEl) {
      const top = [...topShops].slice(0, 8).reverse();
      reportCharts.push(new Chart(tEl, {
        type: 'bar',
        data: {
          labels: top.map((x) => x.name),
          datasets: [{
            label: t('chart_views'),
            data: top.map((x) => Number(x.views_count || 0)),
            backgroundColor: (ctx) => {
              const i = ctx.dataIndex;
              const n = top.length || 1;
              const a = 0.45 + (i / Math.max(1, n - 1)) * 0.45;
              return `rgba(34, 197, 94, ${a})`;
            },
            borderRadius: 8,
            borderSkipped: false,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { precision: 0 },
            },
            y: {
              grid: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
          },
        },
      }));
    }
  }

  async function renderSupport() {
    supportSelectedId = supportSelectedId || null;
    supportLastMsgId = 0;
    supportLastListSnap = '';

    panel.innerHTML = `
      <div class="support-layout">
        <div class="card support-list-card">
          <h3>${esc(t('support_title'))} <span class="muted" id="support-live-dot" style="font-size:0.75rem;">${esc(t('support_live'))}</span></h3>
          <p class="muted" style="margin-bottom:12px;">${esc(t('support_hint'))}</p>
          <div id="support-thread-list" class="support-thread-list">
            <p class="muted">${esc(t('loading'))}</p>
          </div>
        </div>
        <div class="card support-chat-card">
          <div id="support-chat-head" class="support-chat-head">
            <strong>${esc(t('pick_chat'))}</strong>
            <span class="muted">${esc(t('pick_chat_hint'))}</span>
          </div>
          <div class="support-messages" id="support-messages">
            <p class="muted text-center" style="padding:24px 8px;">${esc(t('no_chat'))}</p>
          </div>
          <div class="support-compose" id="support-compose" hidden>
            <input type="text" id="support-input" placeholder="${esc(t('reply_ph'))}" maxlength="2000" />
            <button type="button" class="btn primary" id="support-send">${esc(t('send'))}</button>
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
            <div class="support-meta">${m.sender_role === 'admin' ? esc(t('you_admin')) : esc(t('user'))}</div>
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
        <h3>${esc(t('new_market'))}</h3>
        <form id="market-form">
          <div class="grid-2">
            <div class="field"><label>${esc(t('name'))} *</label><input name="name" required placeholder="${esc(t('name_ph'))}" /></div>
            <div class="field"><label>${esc(t('city'))}</label><input name="city" value="Toshkent" /></div>
          </div>
          <div class="field"><label>${esc(t('address'))}</label><input name="address" placeholder="${esc(t('address'))}" /></div>
          <div class="field"><label>${esc(t('description'))}</label><textarea name="description" placeholder="${esc(t('desc_ph'))}"></textarea></div>
          <button class="btn primary" type="submit">${esc(t('save'))}</button>
          <p class="success" id="market-msg" hidden></p>
          <p class="error" id="market-err" hidden></p>
        </form>
      </div>
      <div class="card">
        <h3>${esc(t('all_markets'))}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('city'))}</th><th>${esc(t('shop'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead>
            <tbody>
              ${markets.map((m) => `
                <tr>
                  <td><strong>${esc(m.name)}</strong><div class="muted">${esc(m.address || '')}</div></td>
                  <td>${esc(m.city || '')}</td>
                  <td>${m.shops_count || 0}</td>
                  <td>${m.is_active ? t('active') : t('inactive')}</td>
                  <td><button type="button" class="btn secondary sm" data-view-market="${m.id}">${esc(t('view_btn'))}</button></td>
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
        '<button type="button" class="btn secondary sm btn-toggle-pwd" data-pwd-id="' + id + '">' + t('show') + '</button>' +
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
        btn.textContent = t('show');
      } else {
        code.textContent = real;
        code.setAttribute('data-show', '1');
        btn.textContent = t('hide');
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
        <td><button type="button" class="btn secondary sm" data-shop="${s.id}">${t('detail')}</button></td>
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
          : t('all_markets');
        countEl.textContent = t('shops_count', { market: marketName, n: shown });
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
        box.innerHTML = `<p class="muted">${t('loading')}</p>`;
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
          ${t('shops_filter_hint')}
        </p>
        <div class="filter-bar">
          <div class="field" style="margin:0;">
            <label>${esc(t('market_required'))}</label>
            <select id="shop-market-filter">
              <option value="">${esc(t('all_markets_opt'))}</option>
              ${markets.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin:0;">
            <label>${esc(t('phone_search'))}</label>
            <input id="shop-phone-filter" type="search" placeholder="${esc(t('phone_ph'))}" />
          </div>
        </div>
        <p class="muted" id="shops-count" style="margin:10px 0 8px;"></p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${esc(t('shop'))}</th>
                <th>${esc(t('market'))}</th>
                <th>${esc(t('phone_search'))}</th>
                <th>${esc(t('owner_label'))}</th>
                <th>${esc(t('password_label'))}</th>
                <th>${esc(t('product'))}</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="shops-tbody">
              ${shops.map(shopRowHtml).join('') || ''}
            </tbody>
          </table>
        </div>
        <p class="muted" id="shops-empty" hidden style="margin-top:12px;">${esc(t('shops_empty'))}</p>
        <div id="shop-detail"></div>
      </div>
    `;
  }

  async function renderShops() {
    const [{ shops }, { markets }] = await Promise.all([api('/shops'), api('/markets')]);
    marketsCache = markets;
    panel.innerHTML = shopsBrowserHtml(shops, markets, t('shops_title'));
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
        <h3>${esc(t('new_owner'))}</h3>
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
          : t('all_markets');
        ownersCount.textContent = t('owners_count', { market: marketName, n: shown });
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
  bindLangSwitch();
  applyStaticI18n();
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

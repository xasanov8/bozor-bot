/**
 * Superadmin — O'zbek / Русский
 */
(() => {
  const LANG_KEY = 'bozor_admin_lang';
  const SUPPORTED = ['uz', 'ru'];

  const dict = {
    uz: {
      title: 'Superadmin — Bozor Top',
      badge: 'SUPERADMIN',
      login_h1: 'Bozor boshqaruvi',
      login_hint: 'Faqat localhost. Parolni kiriting.',
      password: 'Parol',
      password_ph: 'Superadmin paroli',
      login: 'Kirish',
      logout: 'Chiqish',
      brand_sub: 'Superadmin',
      menu: 'Menyu',
      close: 'Yopish',
      section_main: 'Asosiy',
      section_manage: 'Boshqaruv',
      nav_dashboard: 'Dashboard',
      nav_dashboard_d: 'Umumiy ko‘rinish',
      nav_report: 'Hisobot',
      nav_report_d: 'Statistika va top',
      nav_support: 'Yordam',
      nav_support_d: 'Support chat',
      nav_markets: 'Bozorlar',
      nav_markets_d: 'Bozor qo‘shish',
      nav_shops: "Do‘konlar",
      nav_shops_d: 'Bozor bo‘yicha',
      nav_owners: "Do‘kon egalari",
      nav_owners_d: 'Login va parol',
      localhost_only: 'Faqat localhost',
      kicker_main: 'Asosiy',
      kicker_manage: 'Boshqaruv',
      loading: 'Yuklanmoqda...',
      market: 'Bozor',
      shop: "Do'kon",
      product: 'Mahsulot',
      owner: "Do'kon egasi",
      owners: 'Egasi',
      promo: 'Aksiya',
      markets: 'Bozorlar',
      shops: "Do'konlar",
      products: 'Mahsulot',
      quick_actions: 'Tezkor harakatlar',
      quick_hint: 'Kerakli bo‘limga bir bosishda o‘ting.',
      guide: "Qisqa qo'llanma",
      guide_text: '1. <strong>Bozor</strong> qo‘shing → 2. <strong>Do‘kon egasi</strong> yarating (login + parol) → 3. Egasi bot/WebApp orqali mahsulot qo‘shadi → 4. <strong>Hisobot</strong>da umumiy holatni kuzating.',
      support_new_title: 'Yordam — yangi xabarlar',
      support_new_body: '<strong style="color:var(--warn)">{n}</strong> ta o‘qilmagan support xabari.',
      go_support: "Yordamga o‘tish",
      report_by_market: "Bozorlar bo'yicha",
      top_shops: "Top do'konlar (ko'rish bo'yicha)",
      views: "Ko'rish",
      none_yet: 'Hali yo‘q',
      new_market: "Yangi bozor qo'shish",
      name: 'Nomi',
      name_ph: "Masalan: O'rikzor",
      city: 'Shahar',
      address: 'Manzil',
      description: 'Tavsif',
      desc_ph: 'Qisqa tavsif',
      save: 'Saqlash',
      all_markets: 'Barcha bozorlar',
      status: 'Holat',
      active: 'Faol',
      inactive: "O‘chiq",
      view_btn: "Ko'rish",
      shops_n: "Do'konlar ({n})",
      owner_label: 'Egasi',
      login_phone: 'Login telefon',
      password_label: 'Parol',
      not_saved_pwd: "saqlanmagan — Do'kon egalari bo'limidan yangilang",
      no_owner: "Egasi biriktirilmagan. «Do'kon egalari» dan egasi + do'kon yarating yoki egaga do'kon bog'lang.",
      products_n: 'Mahsulotlar ({n})',
      no_products: 'Mahsulot yo‘q',
      show: "Ko'rish",
      hide: 'Yashirish',
      shops_title: "Do'konlar",
      shops_filter_hint: "Avval <strong>bozorni tanlang</strong> — shu bozorning barcha do'konlari chiqadi. Keyin ixtiyoriy <strong>telefon</strong> yozib aniq do'konni toping.",
      market_required: 'Bozor *',
      all_markets_opt: '— Barcha bozorlar —',
      phone_search: 'Telefon / ism qidiruv',
      phone_ph: '+99890... yoki ism',
      shops_count: "{market}: {n} ta do'kon",
      shops_empty: "Bu bozor/telefon bo'yicha do'kon topilmadi.",
      detail: 'Tafsilot',
      shop_phone: "Do'kon telefoni",
      new_owner: "Yangi do'kon egasi",
      owner_name: 'Ism *',
      owner_name_ph: 'Ism Familiya',
      owner_phone: 'Telefon (login) *',
      owner_pwd: 'Parol *',
      owner_pwd_ph: 'Kamida 4 belgi',
      market_for_shop: "Bozor (do'kon uchun)",
      no_shop: '— do‘konsiz —',
      shop_name: "Do'kon nomi",
      shop_name_ph: 'Masalan: Sifat Meva',
      shop_phone_ph: "Bo'sh qoldirilsa login telefon",
      shop_address: "Do'kon manzili (bozor ichida)",
      shop_address_ph: "12-qator, 5-do'kon",
      create: 'Yaratish',
      owners_list: "Do'kon egalari ro'yxati",
      owners_filter_hint: "Avval <strong>bozorni tanlang</strong> — shu bozordagi do'kon egalari chiqadi. Keyin ixtiyoriy <strong>telefon</strong> yozib toping. Parollar faqat superadminga ko‘rinadi.",
      telegram: 'Telegram',
      shops_col: "Do'konlar",
      markets_col: 'Bozorlar',
      reset_pwd: "Parol o'zgartirish",
      owners_count: "{market}: {n} ta do'kon egasi",
      owners_empty: "Bu bozor/telefon bo'yicha ega topilmadi.",
      support_title: "Support so‘rovlar",
      support_live: '· jonli',
      support_hint: "Foydalanuvchilar yozgan muammolar. Yangi xabarlar avtomatik keladi.",
      pick_chat: 'Chat tanlang',
      pick_chat_hint: "Chapdagi ro‘yxatdan foydalanuvchini tanlang",
      no_chat: 'Hali chat ochilmagan',
      no_messages: 'Xabar yo‘q — birinchi bo‘lib yozing',
      no_support: "Hali support so‘rovi yo‘q",
      reply_ph: 'Javob yozing...',
      send: 'Yuborish',
      you_admin: 'Siz (admin)',
      user: 'Foydalanuvchi',
      lang: 'Til',
      lang_uz: "O'zbekcha",
      lang_ru: 'Русский',
    },
    ru: {
      title: 'Суперадмин — Bozor Top',
      badge: 'SUPERADMIN',
      login_h1: 'Управление базарами',
      login_hint: 'Только localhost. Введите пароль.',
      password: 'Пароль',
      password_ph: 'Пароль суперадмина',
      login: 'Войти',
      logout: 'Выйти',
      brand_sub: 'Суперадмин',
      menu: 'Меню',
      close: 'Закрыть',
      section_main: 'Главное',
      section_manage: 'Управление',
      nav_dashboard: 'Дашборд',
      nav_dashboard_d: 'Обзор',
      nav_report: 'Отчёт',
      nav_report_d: 'Статистика и топ',
      nav_support: 'Помощь',
      nav_support_d: 'Support-чат',
      nav_markets: 'Базары',
      nav_markets_d: 'Добавить базар',
      nav_shops: 'Магазины',
      nav_shops_d: 'По базарам',
      nav_owners: 'Владельцы',
      nav_owners_d: 'Логин и пароль',
      localhost_only: 'Только localhost',
      kicker_main: 'Главное',
      kicker_manage: 'Управление',
      loading: 'Загрузка...',
      market: 'Базар',
      shop: 'Магазин',
      product: 'Товар',
      owner: 'Владелец',
      owners: 'Владельцы',
      promo: 'Акция',
      markets: 'Базары',
      shops: 'Магазины',
      products: 'Товары',
      quick_actions: 'Быстрые действия',
      quick_hint: 'Перейдите в нужный раздел одним нажатием.',
      guide: 'Краткая инструкция',
      guide_text: '1. Добавьте <strong>базар</strong> → 2. Создайте <strong>владельца</strong> (логин + пароль) → 3. Владелец добавляет товары в боте/WebApp → 4. Смотрите сводку в <strong>Отчёте</strong>.',
      support_new_title: 'Помощь — новые сообщения',
      support_new_body: '<strong style="color:var(--warn)">{n}</strong> непрочитанных сообщений поддержки.',
      go_support: 'Перейти в помощь',
      report_by_market: 'По базарам',
      top_shops: 'Топ магазинов (по просмотрам)',
      views: 'Просмотры',
      none_yet: 'Пока нет',
      new_market: 'Добавить базар',
      name: 'Название',
      name_ph: 'Например: Орикзор',
      city: 'Город',
      address: 'Адрес',
      description: 'Описание',
      desc_ph: 'Краткое описание',
      save: 'Сохранить',
      all_markets: 'Все базары',
      status: 'Статус',
      active: 'Активен',
      inactive: 'Выключен',
      view_btn: 'Смотреть',
      shops_n: 'Магазины ({n})',
      owner_label: 'Владелец',
      login_phone: 'Телефон (логин)',
      password_label: 'Пароль',
      not_saved_pwd: 'не сохранён — обновите в разделе «Владельцы»',
      no_owner: 'Владелец не привязан. Создайте владельца + магазин в разделе «Владельцы».',
      products_n: 'Товары ({n})',
      no_products: 'Нет товаров',
      show: 'Показать',
      hide: 'Скрыть',
      shops_title: 'Магазины',
      shops_filter_hint: 'Сначала <strong>выберите базар</strong> — появятся все магазины. Затем при желании введите <strong>телефон</strong>.',
      market_required: 'Базар *',
      all_markets_opt: '— Все базары —',
      phone_search: 'Поиск: телефон / имя',
      phone_ph: '+99890... или имя',
      shops_count: '{market}: {n} магазинов',
      shops_empty: 'По этому базару/телефону магазинов нет.',
      detail: 'Подробнее',
      shop_phone: 'Телефон магазина',
      new_owner: 'Новый владелец',
      owner_name: 'Имя *',
      owner_name_ph: 'Имя Фамилия',
      owner_phone: 'Телефон (логин) *',
      owner_pwd: 'Пароль *',
      owner_pwd_ph: 'Минимум 4 символа',
      market_for_shop: 'Базар (для магазина)',
      no_shop: '— без магазина —',
      shop_name: 'Название магазина',
      shop_name_ph: 'Например: Sifat Meva',
      shop_phone_ph: 'Если пусто — телефон логина',
      shop_address: 'Адрес в базаре',
      shop_address_ph: '12-й ряд, 5-й магазин',
      create: 'Создать',
      owners_list: 'Список владельцев',
      owners_filter_hint: 'Сначала <strong>выберите базар</strong> — появятся владельцы. Затем при желании введите <strong>телефон</strong>. Пароли видит только суперадмин.',
      telegram: 'Telegram',
      shops_col: 'Магазины',
      markets_col: 'Базары',
      reset_pwd: 'Сменить пароль',
      owners_count: '{market}: {n} владельцев',
      owners_empty: 'По этому базару/телефону владельцев нет.',
      support_title: 'Запросы поддержки',
      support_live: '· онлайн',
      support_hint: 'Сообщения пользователей. Новые приходят автоматически.',
      pick_chat: 'Выберите чат',
      pick_chat_hint: 'Выберите пользователя слева',
      no_chat: 'Чат ещё не открыт',
      no_messages: 'Сообщений нет — напишите первым',
      no_support: 'Запросов поддержки пока нет',
      reply_ph: 'Напишите ответ...',
      send: 'Отправить',
      you_admin: 'Вы (админ)',
      user: 'Пользователь',
      lang: 'Язык',
      lang_uz: "O'zbekcha",
      lang_ru: 'Русский',
    },
  };

  function normalize(lang) {
    const l = String(lang || '').toLowerCase().slice(0, 2);
    return SUPPORTED.includes(l) ? l : 'uz';
  }

  function detect() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved) return normalize(saved);
      const web = localStorage.getItem('bozor_lang');
      if (web) return normalize(web);
    } catch (_) {}
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ru')) return 'ru';
    return 'uz';
  }

  let lang = detect();

  function t(key, vars) {
    const table = dict[lang] || dict.uz;
    let s = table[key] ?? dict.uz[key] ?? key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
      });
    }
    return s;
  }

  function setLang(next) {
    lang = normalize(next);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uz';
    document.title = t('title');
    return lang;
  }

  function getLang() {
    return lang;
  }

  function applyDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  }

  setLang(lang);

  window.AdminI18N = { LANG_KEY, t, setLang, getLang, applyDom, SUPPORTED };
})();

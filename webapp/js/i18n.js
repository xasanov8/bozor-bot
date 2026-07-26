/**
 * Bozor Top WebApp — O'zbek / Русский
 */
(() => {
  const LANG_KEY = 'bozor_lang';
  const SUPPORTED = ['uz', 'ru'];

  const dict = {
    uz: {
      app_title: 'Bozor Top',
      app_sub: 'Katta bozorlarda qidirish',
      loading: 'Yuklanmoqda...',
      back: 'Orqaga',
      chats: 'Chatlar',
      nav_markets: 'Bozorlar',
      nav_search: 'Qidiruv',
      nav_favorites: 'Sevimli',
      nav_cart: 'Savat',
      nav_support: 'Yordam',
      nav_owner: "Do'konim",
      lang_uz: "O'zbekcha",
      lang_ru: 'Русский',
      role_title: 'Bozor Top',
      role_sub: 'Rolingizni tanlang',
      role_buyer: 'Xaridor',
      role_buyer_desc: 'Bozor va mahsulotlarni ko‘rish',
      role_owner: "Do'kon egasi",
      role_owner_desc: "Do'kon va mahsulotlarni boshqarish",
      role_pick: 'Davom etish uchun rolni tanlang',
      home_title: 'Bozor Top',
      home_sub: 'Katta bozorlarda qidirish',
      home_hero: 'Katta bozorlardan mahsulot toping',
      home_hero_sub: 'Bozorni tanlang va qidiring',
      markets_empty: 'Bozorlar topilmadi',
      shops_count: '{n} ta do‘kon',
      market_big: 'Katta bozor',
      search_in: 'Qidirish',
      search_ph: 'Mahsulot nomi...',
      search_title: 'Qidiruv',
      search_sub: 'Mahsulot qidirish',
      searching: 'Qidirilmoqda...',
      no_results: 'Natija yo‘q',
      error: 'Xatolik',
      shop: "Do'kon",
      call: "Qo'ng'iroq",
      open_chat: 'Chat',
      products: 'Mahsulotlar',
      no_products: 'Mahsulot yo‘q',
      add_cart: 'Savat',
      favorites: 'Sevimlilar',
      fav_empty_title: 'Sevimlilar bo‘sh',
      fav_empty_sub: 'Mahsulotlarni ♥ bilan saqlang',
      cart: 'Savat',
      cart_empty_title: 'Savat bo‘sh',
      cart_empty_sub: 'Mahsulot qo‘shing',
      cart_note: "Savat eslatma. Kerakli do'konga qo'ng'iroq qiling yoki chat yozing — buyurtma tizimi yo'q.",
      qty: 'Soni',
      remove: "O'chirish",
      total: 'Jami',
      open_shop: "Do'konni ochish",
      chat_with_shop: "Do'kon bilan chat",
      add_fav: "Sevimlilarga qo'shish",
      remove_fav: 'Sevimlidan olib tashlash',
      fav_added: 'Sevimlilarga qo‘shildi',
      fav_removed: 'Sevimlidan olib tashlandi',
      cart_added: 'Savatga qo‘shildi',
      owner_no_fav: "Do'kon egasi sevimli/savatdan foydalana olmaydi",
      fav_buyer_only: 'Sevimli faqat xaridor uchun',
      cart_buyer_only: 'Savat faqat xaridor uchun',
      chat_buyer_only: 'Chat faqat xaridor uchun',
      owner_login_title: "Do'kon egasi",
      owner_login_sub: 'Kirish',
      owner_login_h: "Do'kon egasi kirishi",
      owner_login_hint: "Superadmin bergan telefon va parolni kiriting.",
      phone: 'Telefon',
      password: 'Parol',
      login: 'Kirish',
      logged_in: 'Kirildi',
      change_role: '← Rolni almashtirish',
      my_shop: "Mening do'konim",
      my_shop_sub: "Do'kon va mahsulotlar",
      logout: 'Chiqish',
      logged_out: 'Chiqildi — qayta kirish uchun telefon va parol kerak',
      create_shop: "Yangi do'kon",
      manage: 'Boshqarish',
      view: "Ko'rish",
      chats_via_icon: 'Chatlar — yuqoridagi chat ikonkasi orqali',
      hours_saved: 'Ish vaqti saqlandi',
      shop_name: "Do'kon nomi",
      address: 'Manzil',
      description: 'Tavsif',
      save: 'Saqlash',
      saving: 'Saqlanmoqda...',
      shop_created: "Do'kon yaratildi",
      products_manage: 'Mahsulotlar boshqaruvi',
      new_product: 'Yangi mahsulot',
      edit_product: 'Tahrirlash',
      product_img_price: 'Rasm va narx',
      product_name: 'Nomi',
      price: 'Narx',
      unit: 'Birlik',
      category: 'Kategoriya',
      image: 'Rasm',
      saved: 'Saqlandi',
      deleted: "O'chirildi",
      promo_off: 'Aksiya o‘chirildi',
      promo_on: 'Aksiya: -{n}%',
      support_title: 'Yordam',
      support_sub: 'Superadmin bilan jonli chat',
      support_hint: 'Muammo yoki savolingizni yozing. Superadmin javobi <strong>jonli</strong> keladi.',
      support_ph: 'Muammoingizni yozing...',
      support_empty: 'Birinchi xabaringizni yozing — superadmin darhol ko‘radi',
      support_fail: 'Yordam ochilmadi',
      you: 'Siz',
      support_role: 'Support',
      send: 'Yuborish',
      support_new: 'Yordam: yangi javob keldi',
      chat_live: 'Chat (jonli)',
      chat_empty: "Xabar yozing — do'kon egasi darhol ko'radi",
      chat_ph: 'Xabar...',
      shop_role: "Do'kon",
      buyer: 'Xaridor',
      owner_chats: 'Chatlar',
      owner_chats_sub: 'Xaridorlar',
      no_chats: "Chat yo'q",
      no_chats_buyer: "Do'kon sahifasidan «Chat» bosing",
      no_chats_owner: "Xaridorlar do'konga chat yozganda shu yerda chiqadi",
      new_msg: '{n} yangi',
      new_messages: '{n} ta yangi xabar',
      live_chat: 'Jonli yozishma',
      reply_ph: 'Javob...',
      shop_not_found: "Do'kon topilmadi",
      new_message: 'Yangi xabar',
      pieces: 'xil',
      pieces_n: '{n} ta',
      som: "so'm",
      open_now: 'Ochiq',
      closed_now: 'Yopiq',
      filter: 'Filtr',
      all: 'Barchasi',
      fill_form: "Ma'lumotlarni to'ldiring",
      lang: 'Til',
    },
    ru: {
      app_title: 'Bozor Top',
      app_sub: 'Поиск на крупных базарах',
      loading: 'Загрузка...',
      back: 'Назад',
      chats: 'Чаты',
      nav_markets: 'Базары',
      nav_search: 'Поиск',
      nav_favorites: 'Избранное',
      nav_cart: 'Корзина',
      nav_support: 'Помощь',
      nav_owner: 'Мой магазин',
      lang_uz: "O'zbekcha",
      lang_ru: 'Русский',
      role_title: 'Bozor Top',
      role_sub: 'Выберите роль',
      role_buyer: 'Покупатель',
      role_buyer_desc: 'Смотреть базары и товары',
      role_owner: 'Владелец магазина',
      role_owner_desc: 'Управлять магазином и товарами',
      role_pick: 'Выберите роль, чтобы продолжить',
      home_title: 'Bozor Top',
      home_sub: 'Поиск на крупных базарах',
      home_hero: 'Найдите товары на крупных базарах',
      home_hero_sub: 'Выберите базар и ищите',
      markets_empty: 'Базары не найдены',
      shops_count: '{n} магазинов',
      market_big: 'Крупный базар',
      search_in: 'Искать',
      search_ph: 'Название товара...',
      search_title: 'Поиск',
      search_sub: 'Поиск товаров',
      searching: 'Идёт поиск...',
      no_results: 'Нет результатов',
      error: 'Ошибка',
      shop: 'Магазин',
      call: 'Позвонить',
      open_chat: 'Чат',
      products: 'Товары',
      no_products: 'Нет товаров',
      add_cart: 'В корзину',
      favorites: 'Избранное',
      fav_empty_title: 'Избранное пусто',
      fav_empty_sub: 'Сохраняйте товары кнопкой ♥',
      cart: 'Корзина',
      cart_empty_title: 'Корзина пуста',
      cart_empty_sub: 'Добавьте товары',
      cart_note: 'Корзина — напоминание. Позвоните в магазин или напишите в чат — заказов в системе нет.',
      qty: 'Кол-во',
      remove: 'Удалить',
      total: 'Итого',
      open_shop: 'Открыть магазин',
      chat_with_shop: 'Чат с магазином',
      add_fav: 'В избранное',
      remove_fav: 'Убрать из избранного',
      fav_added: 'Добавлено в избранное',
      fav_removed: 'Удалено из избранного',
      cart_added: 'Добавлено в корзину',
      owner_no_fav: 'Владелец не может пользоваться избранным/корзиной',
      fav_buyer_only: 'Избранное только для покупателя',
      cart_buyer_only: 'Корзина только для покупателя',
      chat_buyer_only: 'Чат только для покупателя',
      owner_login_title: 'Владелец магазина',
      owner_login_sub: 'Вход',
      owner_login_h: 'Вход владельца',
      owner_login_hint: 'Введите телефон и пароль от суперадмина.',
      phone: 'Телефон',
      password: 'Пароль',
      login: 'Войти',
      logged_in: 'Вы вошли',
      change_role: '← Сменить роль',
      my_shop: 'Мой магазин',
      my_shop_sub: 'Магазин и товары',
      logout: 'Выйти',
      logged_out: 'Вы вышли — для входа снова нужны телефон и пароль',
      create_shop: 'Новый магазин',
      manage: 'Управление',
      view: 'Смотреть',
      chats_via_icon: 'Чаты — через иконку чата сверху',
      hours_saved: 'Часы работы сохранены',
      shop_name: 'Название магазина',
      address: 'Адрес',
      description: 'Описание',
      save: 'Сохранить',
      saving: 'Сохранение...',
      shop_created: 'Магазин создан',
      products_manage: 'Управление товарами',
      new_product: 'Новый товар',
      edit_product: 'Редактирование',
      product_img_price: 'Фото и цена',
      product_name: 'Название',
      price: 'Цена',
      unit: 'Ед.',
      category: 'Категория',
      image: 'Фото',
      saved: 'Сохранено',
      deleted: 'Удалено',
      promo_off: 'Акция выключена',
      promo_on: 'Акция: -{n}%',
      support_title: 'Помощь',
      support_sub: 'Живой чат с суперадмином',
      support_hint: 'Опишите проблему или вопрос. Ответ суперадмина придёт <strong>вживую</strong>.',
      support_ph: 'Опишите проблему...',
      support_empty: 'Напишите первое сообщение — суперадмин увидит сразу',
      support_fail: 'Не удалось открыть поддержку',
      you: 'Вы',
      support_role: 'Поддержка',
      send: 'Отправить',
      support_new: 'Помощь: новый ответ',
      chat_live: 'Чат (онлайн)',
      chat_empty: 'Напишите сообщение — владелец увидит сразу',
      chat_ph: 'Сообщение...',
      shop_role: 'Магазин',
      buyer: 'Покупатель',
      owner_chats: 'Чаты',
      owner_chats_sub: 'Покупатели',
      no_chats: 'Чатов нет',
      no_chats_buyer: 'Нажмите «Чат» на странице магазина',
      no_chats_owner: 'Когда покупатели напишут, чаты появятся здесь',
      new_msg: '{n} новых',
      new_messages: '{n} новых сообщений',
      live_chat: 'Живой чат',
      reply_ph: 'Ответ...',
      shop_not_found: 'Магазин не найден',
      new_message: 'Новое сообщение',
      pieces: 'позиций',
      pieces_n: '{n} шт.',
      som: 'сум',
      open_now: 'Открыто',
      closed_now: 'Закрыто',
      filter: 'Фильтр',
      all: 'Все',
      fill_form: 'Заполните данные',
      lang: 'Язык',
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
    } catch (_) {}
    const tg = window.Telegram?.WebApp;
    const tgLang = tg?.initDataUnsafe?.user?.language_code;
    if (tgLang && String(tgLang).toLowerCase().startsWith('ru')) return 'ru';
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
    return lang;
  }

  function getLang() {
    return lang;
  }

  /** data-i18n, data-i18n-placeholder, data-i18n-aria, data-i18n-title */
  function applyDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      if (el.childElementCount && el.querySelector('.nav-badge, em, svg')) {
        // faqat matn tugunini yangilash
        const badge = el.querySelector('.nav-badge, em.nav-badge, em.chat-badge, #cart-badge, #support-badge');
        const textNode = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (textNode) textNode.textContent = t(key) + (badge ? ' ' : '');
        else {
          // span ichida matn
          const span = el.querySelector('span:not(.nav-badge)');
          if (span && !span.querySelector('em, svg')) span.textContent = t(key);
          else el.setAttribute('data-i18n-applied', t(key));
        }
      } else {
        el.textContent = t(key);
      }
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
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
  }

  setLang(lang);

  window.I18N = {
    LANG_KEY,
    dict,
    t,
    setLang,
    getLang,
    applyDom,
    SUPPORTED,
  };
})();

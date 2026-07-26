const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const {
  verifyPassword,
  normalizePhone,
  createOwnerToken,
} = require('./auth');

// telegramId -> { step: 'phone'|'password', phone? }
const sessions = new Map();

function createBot(token, webappUrl) {
  if (!token || token.includes('your_telegram')) {
    console.warn('[bot] BOT_TOKEN sozlanmagan — bot ishga tushmaydi, API ishlaydi.');
    return null;
  }

  const baseUrl = webappUrl.replace(/\/$/, '');
  const bot = new Telegraf(token);

  const appUrl = (path = '') => `${baseUrl}${path}`;

  /** Faqat bitta tugma: bozorni ochish */
  const onlyOpenKeyboard = (path = '', label = 'Bozorni ochish') =>
    Markup.keyboard([[Markup.button.webApp(label, appUrl(path))]])
      .resize()
      .persistent();

  const inlineOpen = (path = '', text = 'Bozorni ochish') =>
    Markup.inlineKeyboard([[Markup.button.webApp(text, appUrl(path))]]);

  async function setupMenuButton() {
    try {
      await bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: 'Bozor',
          web_app: { url: appUrl() },
        },
      });
      console.log('[bot] Menu button (WebApp) o‘rnatildi:', appUrl());
    } catch (err) {
      console.error('[bot] Menu button xato:', err.message);
    }
  }

  bot.start(async (ctx) => {
    sessions.delete(String(ctx.from.id));
    const name = ctx.from?.first_name || "do'st";
    await ctx.reply(
      `Assalomu alaykum, ${name}!\n\n` +
        `Katta bozorlardan kerakli narsani toping.\n` +
        `Ilovani oching — u yerda xaridor yoki do'kon egasi ekaningizni tanlaysiz.`,
      onlyOpenKeyboard()
    );
  });

  bot.command('app', async (ctx) => {
    await ctx.reply('Bozor ilovasini ochish:', onlyOpenKeyboard());
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `Yordam\n\n` +
        `«Bozorni ochish» tugmasini bosing.\n` +
        `WebApp ichida: Xaridor yoki Do'kon egasi.\n` +
        `Do'kon egasi: superadmin bergan telefon + parol.`
    );
  });

  // Eski klaviatura matnlari — faqat ochishga yo'naltirish
  bot.hears(
    [
      '🛒 Xaridorman',
      "🏪 Do'kon egasiman",
      'Yordam',
      '🔄 Rolni almashtirish',
      '❌ Bekor qilish',
      "Do'kon egasi bo'lish",
    ],
    async (ctx) => {
      sessions.delete(String(ctx.from.id));
      await ctx.reply('Ilovani oching:', onlyOpenKeyboard());
    }
  );

  bot.on('text', async (ctx) => {
    const text = (ctx.message?.text || '').trim();
    if (text.startsWith('/')) return;

    // Agar oldingi sessiyada egasi login qilayotgan bo'lsa (ixtiyoriy saqlab qoldik)
    const tid = String(ctx.from.id);
    const sess = sessions.get(tid);
    if (sess?.step === 'phone' || sess?.step === 'password') {
      // WebApp orqali kirishga yo'naltiramiz
      sessions.delete(tid);
      await ctx.reply(
        "Do'kon egasi kirishi WebApp ichida.\nIlovani oching va «Do'kon egasiman» ni tanlang.",
        onlyOpenKeyboard()
      );
      return;
    }

    await ctx.reply('Bozorni ochish tugmasini bosing:', onlyOpenKeyboard());
  });

  bot.catch((err, ctx) => {
    console.error(`[bot] xato ${ctx.updateType}:`, err);
  });

  bot.setupMenuButton = setupMenuButton;
  bot.webappUrl = baseUrl;
  return bot;
}

module.exports = { createBot };

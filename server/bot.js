const { Telegraf, Markup } = require('telegraf');

function createBot(token, webappUrl) {
  if (!token || token.includes('your_telegram')) {
    console.warn('[bot] BOT_TOKEN sozlanmagan — bot ishga tushmaydi, API ishlaydi.');
    return null;
  }

  const bot = new Telegraf(token);

  const openWebApp = (path = '') => {
    const url = `${webappUrl.replace(/\/$/, '')}${path}`;
    return Markup.keyboard([
      [Markup.button.webApp('Bozorlarni ochish', url)],
      ['Yordam', "Do'kon egasi bo'lish"],
    ]).resize();
  };

  bot.start(async (ctx) => {
    const name = ctx.from?.first_name || 'do\'st';
    await ctx.reply(
      `Assalomu alaykum, ${name}!\n\n` +
      `Bu bot orqali katta bozorlardagi do'konlardan kerakli narsani topishingiz mumkin.\n\n` +
      `Qanday ishlaydi:\n` +
      `1. Bozorni tanlang (masalan, O'rikzor)\n` +
      `2. Nima kerakligini yozing\n` +
      `3. Qaysi do'konlarda borligi, narxi va telefoni chiqadi\n\n` +
      `Pastdagi tugma orqali ilovani oching.`,
      openWebApp()
    );
  });

  bot.command('app', async (ctx) => {
    await ctx.reply('Bozor ilovasini ochish:', openWebApp());
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `Yordam\n\n` +
      `/start — botni boshlash\n` +
      `/app — WebApp ni ochish\n` +
      `/owner — do'kon egasi bo'lish haqida\n\n` +
      `Xaridor: bozorni tanlang → qidiruvga yozing → do'konlarni ko'ring.\n` +
      `Do'kon egasi: WebApp da "Mening do'konim" → do'kon oching → mahsulot qo'shing.`
    );
  });

  bot.hears('Yordam', async (ctx) => {
    await ctx.reply(
      `Qidiruv: bozorga kiring va "olma", "guruch", "ko'ylak" kabi so'z yozing.\n` +
      `Natijada do'kon nomi, manzil, telefon, mahsulot rasmi va narxi ko'rsatiladi.`
    );
  });

  bot.hears("Do'kon egasi bo'lish", ownerHelp);
  bot.command('owner', ownerHelp);

  async function ownerHelp(ctx) {
    await ctx.reply(
      `Do'kon egasi bo'lish\n\n` +
      `1. "Bozorlarni ochish" tugmasini bosing\n` +
      `2. Pastki menyudan "Mening do'konim" ni tanlang\n` +
      `3. Bozorni tanlab do'kon yarating\n` +
      `4. Telefon, manzil va mahsulotlar (rasm + narx) qo'shing\n\n` +
      `Keyin xaridorlar qidiruvda sizning tovarlaringizni topadi.`,
      openWebApp('/#/owner')
    );
  }

  bot.on('text', async (ctx) => {
    // Soft redirect to webapp for free text
    const text = ctx.message?.text || '';
    if (text.startsWith('/')) return;
    await ctx.reply(
      `Qidiruvni WebApp orqali qiling — bozorni tanlab, kerakli narsani yozing.`,
      openWebApp()
    );
  });

  bot.catch((err, ctx) => {
    console.error(`[bot] xato ${ctx.updateType}:`, err);
  });

  return bot;
}

module.exports = { createBot };

# Bozor Top — Telegram Bot + WebApp

Katta bozorlar (O'rikzor, Chorsu, Qo'yliq...) uchun Telegram Mini App.  
Foydalanuvchi bozorni tanlab, nima kerakligini yozadi — qaysi do'konlarda borligi, **narx**, **rasm**, **telefon** va **manzil** chiqadi.

## Imkoniyatlar

- **Bozorlar ro'yxati** — O'rikzor va boshqa yirik bozorlar
- **Qidiruv** — bozor ichida mahsulot nomi bo'yicha
- **Do'kon sahifasi** — telefon, manzil, mahsulotlar
- **Do'kon egasi paneli** — do'kon ochish, mahsulot (rasm + narx) qo'shish
- **Zamonaviy UI** — qorong'u, toza dizayn (stikerlarsiz)

## Texnologiyalar

- Node.js + Express
- Telegraf (Telegram Bot)
- SQLite (better-sqlite3)
- Vanilla JS Telegram WebApp

## O'rnatish

```bash
cd bozor-bot
npm install
copy .env.example .env
```

`.env` ni to'ldiring:

```env
BOT_TOKEN=123456:ABC...          # @BotFather dan
PORT=3000
WEBAPP_URL=https://xxxx.ngrok-free.app   # HTTPS URL majburiy (Telegram)
```

Demo ma'lumotlar:

```bash
npm run seed
```

Ishga tushirish:

```bash
npm start
```

## Telegram sozlash

1. [@BotFather](https://t.me/BotFather) da bot yarating → `BOT_TOKEN` oling.
2. Lokal serverni internetga oching (HTTPS):
   - **ngrok**: `ngrok http 3000`
   - yoki VPS + domen + SSL
3. `WEBAPP_URL` ni ngrok/domen URL qiling.
4. BotFather → `/setmenubutton` yoki bot kodidagi WebApp tugmasi orqali ilovani bog'lang.
5. Botga `/start` yuboring → **Bozorlarni ochish**.

### Menu Button (ixtiyoriy)

BotFather:

```
/setmenubutton
→ botni tanlang
→ Web App URL: https://your-domain.com
```

## Foydalanish

### Xaridor

1. Bozorni tanlang (masalan, O'rikzor)
2. Qidiruvga yozing: `olma`, `guruch`, `non`...
3. Natijada do'konlar, mahsulotlar, narx va telefon
4. **Qo'ng'iroq** tugmasi orqali do'konga bog'laning

### Do'kon egasi

1. Pastki menyu → **Do'konim**
2. Yangi do'kon: bozor, nom, telefon, manzil
3. Mahsulot qo'shing: nom, narx, birlik, rasm

## API (qisqa)

| Method | Path | Tavsif |
|--------|------|--------|
| GET | `/api/markets` | Bozorlar |
| GET | `/api/markets/:id` | Bozor + do'konlar |
| GET | `/api/markets/:id/search?q=` | Qidiruv |
| GET | `/api/shops/:id` | Do'kon + mahsulotlar |
| GET | `/api/me` | Ega do'konlari (auth) |
| POST | `/api/shops` | Do'kon yaratish |
| POST | `/api/products` | Mahsulot qo'shish |

Auth: `X-Telegram-Init-Data` header (Telegram WebApp `initData`).

## Lokal brauzerda test

`http://localhost:3000` — rivojlantirish rejimida `X-Dev-User: 100001` avtomatik yuboriladi (seed dagi demo egasi).

Telegram WebApp to'liq ishlashi uchun HTTPS + bot orqali ochish kerak.

## Loyiha tuzilishi

```
bozor-bot/
  server/
    index.js      # Express + bot
    bot.js        # Telegraf buyruqlar
    db.js         # SQLite
    seed.js       # Demo data
    routes/api.js
  webapp/
    index.html
    css/style.css
    js/app.js
  uploads/        # Mahsulot rasmlari
  data/           # bozor.db
```

## Keyingi qadamlar (ixtiyoriy)

- Admin panel orqali yangi bozor qo'shish
- Xarita / joylashuv
- Sevimli do'konlar
- Ko'p tillilik
- PostgreSQL production uchun

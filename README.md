# Bexa AI Academy — sayt

O'quv platformasi: bosh sahifa, o'quvchi kabineti, admin panel, chatlar, Bexa AI bot va **MongoDB** ma'lumotlar bazasi (Atlas + GridFS).

## Ishga tushirish

> ⚠️ `index.html` ni to'g'ridan-to'g'ri ochmang — sayt server orqali ishlaydi.

1. **Node.js** o'rnating (18 yoki undan yangi): https://nodejs.org
2. `.env.example` faylni `.env` ga nusxalab, ichiga **MongoDB Atlas** connection stringni yozing:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxx.mongodb.net/bexa?retryWrites=true&w=majority
```

3. Papkani ochib terminalda:

```bash
npm install
npm start
```

4. Brauzerda oching: **http://localhost:3000**

> Eski SQLite bazasini MongoDB'ga ko'chirish uchun: `npm run migrate` (data/bexa.sqlite va uploads/ papkalari o'qiladi).

## Kirish ma'lumotlari

| Rol | Login | Parol |
|---|---|---|
| Owner | `owner` | `bekzod20102414` |

> Saytni internetga chiqarishdan oldin owner parolini **Admin panel → Profil** bo'limida o'zgartiring.

Kurs pullik: o'quvchilar **Ariza qoldirish** orqali hisob ochadi. Admin **Arizalar** bo'limida tasdiqlamaguncha darslar, ishlar va o'quvchilar chati yopiq turadi (faqat Bexa AI bot orqali adminga yozish mumkin). Adminlarni faqat owner qo'shadi.

## Sahifalar

| Manzil | Nima |
|---|---|
| `/` | Bosh sahifa (kurs, narxlar, Bexa AI bot) |
| `/kirish` | Kirish / Ro'yxatdan o'tish |
| `/kabinet` | O'quvchi kabineti |
| `/admin` | Admin panel |

## Ma'lumotlar qayerda saqlanadi

- **MongoDB Atlas** — barcha ma'lumotlar: foydalanuvchilar, darslar, ishlar, loyihalar, chatlar, sozlamalar
- **GridFS** (xuddi shu MongoDB ichida) — yuklangan video fayllar (darslar va o'quvchi ishlari)

> Render.com bepul tarifida disk vaqta-vaqta tozalanadi — shuning uchun videolar ham, ma'lumotlar ham MongoDB'da turadi. Hech narsa yo'qolmaydi.

## Internetga chiqarish — Render.com

1. **GitHub'ga push qiling** (kod .env'siz saqlanadi — u .gitignore da):

```bash
git init
git add .
git commit -m "Bexa AI Academy"
git remote add origin https://github.com/USERNAME/bexa-ai-academy.git
git push -u origin main
```

2. **MongoDB Atlas**: https://cloud.mongodb.com → Database → Connect → Drivers — connection stringni ko'chirib oling (parolni o'zgartirgan bo'lsangiz, yangisini oling). Network Access'da **0.0.0.0/0** (Allow access from anywhere) bo'lishi kerak — Render IP'lari o'zgarmaydi.

3. **Render**: https://render.com → **New → Web Service** → GitHub repozitoriyni tanlang:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment** qo'shing:
     - `MONGODB_URI` = Atlas connection string (bexa bazasi bilan)
     - `COOKIE_SECURE` = `1`
   - **Create Web Service** — deploy boshlanadi.

4. Tugagach sayt `https://bexa-ai-academy.onrender.com` manzilida ochiladi. Birinchi ishga tushganda owner avtomatik yaratiladi (yoki allaqachon Atlas'da bo'ladi).

> `render.yaml` fayli ham joylashgan — uni Render'ga connect qilsangiz, sozlamalar avtomatik ko'tariladi (MONGODB_URI qo'lda kiritiladi).

## Imkoniyatlar

**O'quvchi:**
- Video darslarni ko'radi, xuddi shunday video yasab yuklaydi
- Admin tekshiradi (qabul / qaytarish + izoh)
- Boshqa o'quvchilarning ishlarini ko'radi
- O'quvchilar umumiy chati
- Bexa AI bot orqali admin bilan bog'lanish (bot darhol avto-javob beradi)

**Admin:**
- Dashboard: jami tushum, sarf, sof foyda, oylik grafik, adminlar reytingi
- Loyihalar: nomi, platforma, sahifa nomi, summa, sarf, qolgani avtomatik hisoblanadi
- Adminlar chati (yopiq), o'quvchilar ishlarini tekshirish
- Darslar qo'shish (YouTube havolasi yoki video fayl)
- Arizalar — to'lov qilganlarni tasdiqlash, rad etish, bloklash
- Bot xabarlari — o'quvchi va mehmonlarga javob yozish
- Sayt sozlamalari: kurs narxi, havolalar, matnlar

**Owner (qo'shimcha):**
- Yangi admin qo'shish, parol berish/o'zgartirish, adminlikdan olish

## Texnologiyalar

- Node.js + Express
- MongoDB Atlas (ma'lumotlar) + GridFS (videolar)
- Vanilla JS frontend (public/)

// Bexa AI Academy — server (MongoDB Atlas + GridFS)
// Ishga tushirish: npm install && npm start  →  http://localhost:3000
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const {
  init,
  close,
  col,
  nextId,
  now,
  nowMinusMinutes,
  plain,
  plainAll,
  saveUpload,
  findUpload,
  deleteUpload,
  downloadStream,
} = require('./db');

const PORT = process.env.PORT || 3000;
const OWNER_USERNAME = 'owner';
const OWNER_DEFAULT_PASSWORD = 'bekzod20102414';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Async xatolarni Express'ga uzatish uchun
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Yuklamalar (video fayllar — vaqtinchalik, keyin GridFS'ga) ----------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
['submissions', 'lessons'].forEach((d) => fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true }));

function makeUploader(sub) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, sub)),
      filename: (req, file, cb) => {
        const ext = (path.extname(file.originalname) || '.mp4').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Faqat video fayl yuklash mumkin')),
  });
}
const uploadSubmission = makeUploader('submissions');
const uploadLesson = makeUploader('lessons');
const withUpload = (up, field) => (req, res, next) =>
  up.single(field)(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Fayl juda katta (maksimum 500 MB)' : err.message;
    res.status(400).json({ error: msg });
  });
function removeLocal(rel) {
  if (!rel) return;
  const p = path.join(UPLOAD_DIR, rel);
  if (p.startsWith(UPLOAD_DIR)) fs.unlink(p, () => {});
}
// Faylni GridFS'ga ko'chirib, lokal nusxani o'chirish
async function storeUpload(rel) {
  await saveUpload(rel, path.join(UPLOAD_DIR, rel));
  removeLocal(rel);
}

// ---------- Sayt sozlamalari (admin o'zgartira oladi) ----------
const DEFAULT_SETTINGS = {
  heroBadge: 'Yangi oqim ochildi',
  heroTitle: "Sun'iy intellekt bilan kontent yarating va daromad qiling",
  heroSubtitle:
    "Bexa AI Academy — AI yordamida ko'p prosmotrli videolar yasash, sahifa yuritish va mijoz topishni amaliy o'rgatadigan akademiya.",
  oldPrice: 59000,
  price: 27000,
  telegramLink: 'https://t.me/bexaai',
  instagramLink: '',
  courseTitle: 'Asosiy kurs',
  courseFeatures: [
    'AI yordamida video yaratish',
    'Reels va Shorts uchun montaj',
    "Har bir dars bo'yicha amaliy topshiriq",
    'Ishingizni adminlar tekshiradi',
    "O'quvchilar hamjamiyati va umumiy chat",
    'Bexa AI bot orqali yordam',
  ],
  adminCourseTitle: "Adminlar safiga qo'shilish",
  adminCoursePrice: 250000,
  adminCourseFeatures: [
    'Mijoz topish sirlari',
    'Katta loyihalarda ishlash',
    "Har oy yutuqli, sovrinli o'yinlar",
    "Telegram kanal va Instagram sahifani to'g'ri yuritish",
    "Ko'p prosmotrli video yasash",
  ],
  footerText: "Bexa AI Academy — sun'iy intellekt davrida kasb egallang.",
};

async function getSettings() {
  const s = { ...DEFAULT_SETTINGS };
  for (const row of await col('settings').find({}, { projection: { key: 1, value: 1 } }).toArray()) {
    try {
      if (row.key in DEFAULT_SETTINGS) s[row.key] = JSON.parse(row.value);
    } catch (_) {}
  }
  return s;
}

// ---------- Avtorizatsiya ----------
async function loadUser(req, res, next) {
  try {
    const t = req.cookies.bx_token;
    if (t && typeof t === 'string') {
      const s = await col('sessions').findOne({ token: t }, { projection: { user_id: 1 } });
      if (s) {
        const u = await col('users').findOne(
          { id: s.user_id },
          { projection: { id: 1, username: 1, full_name: 1, role: 1, phone: 1, status: 1, telegram: 1, created_at: 1 } }
        );
        if (u) req.user = u;
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
app.use(loadUser);

const isAdmin = (u) => !!u && (u.role === 'admin' || u.role === 'owner');
const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Avval tizimga kiring' }));
const requireAdmin = (req, res, next) =>
  isAdmin(req.user) ? next() : res.status(403).json({ error: "Bu bo'lim faqat adminlar uchun" });
// Faqat tasdiqlangan o'quvchilar (yoki adminlar) darslarga kira oladi
const isActive = (u) => !!u && (isAdmin(u) || u.status === 'active');
const requireActive = (req, res, next) =>
  !req.user ? res.status(401).json({ error: 'Avval tizimga kiring' })
  : isActive(req.user) ? next() : res.status(403).json({ error: 'Arizangiz hali tasdiqlanmagan', pending: true });
const requireOwner = (req, res, next) =>
  req.user && req.user.role === 'owner' ? next() : res.status(403).json({ error: 'Bu amal faqat owner uchun' });

async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await col('sessions').insertOne({ token, user_id: userId, created_at: now() });
  res.cookie('bx_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => {
  const n = Math.round(Number(String(v ?? '').replace(/\s/g, '')));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

// Oddiy himoya: login urinishlarini cheklash
const attempts = new Map();
function tooMany(key) {
  const nowTs = Date.now();
  const a = (attempts.get(key) || []).filter((t) => nowTs - t < 10 * 60 * 1000);
  a.push(nowTs);
  attempts.set(key, a);
  return a.length > 20;
}

app.post(
  '/api/auth/register',
  ah(async (req, res) => {
    const full_name = str(req.body.full_name, 80);
    const username = str(req.body.username, 30).toLowerCase();
    const phone = str(req.body.phone, 30);
    const telegram = str(req.body.telegram, 60);
    const app_note = str(req.body.app_note, 500);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (full_name.length < 2) return res.status(400).json({ error: 'Ism-familiyani kiriting' });
    if (!phone && !telegram) return res.status(400).json({ error: "Telefon yoki Telegram'ni kiriting — admin siz bilan bog'lanadi" });
    if (!USERNAME_RE.test(username))
      return res.status(400).json({ error: 'Login 3–30 belgi: lotin harflari, raqam, _ yoki .' });
    if (password.length < 6) return res.status(400).json({ error: "Parol kamida 6 belgidan iborat bo'lsin" });
    if (await col('users').findOne({ username }, { projection: { id: 1 } }))
      return res.status(400).json({ error: 'Bu login band, boshqasini tanlang' });
    const hash = await bcrypt.hash(password, 10);
    // Ariza: o'quvchi sifatida, admin tasdiqlaguncha 'pending'
    const id = await nextId('users');
    try {
      await col('users').insertOne({
        id,
        username,
        password_hash: hash,
        full_name,
        phone,
        telegram,
        app_note,
        role: 'student',
        status: 'pending',
        approved_by: null,
        approved_at: null,
        created_at: now(),
      });
    } catch (e) {
      if (e.code === 11000) return res.status(400).json({ error: 'Bu login band, boshqasini tanlang' });
      throw e;
    }
    await startSession(res, id);
    res.json({ ok: true, role: 'student' });
  })
);

app.post(
  '/api/auth/login',
  ah(async (req, res) => {
    const username = str(req.body.username, 30).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (tooMany(req.ip + ':' + username))
      return res.status(429).json({ error: "Juda ko'p urinish. 10 daqiqadan so'ng qayta urinib ko'ring" });
    const u = await col('users').findOne({ username });
    if (!u || !(await bcrypt.compare(password, u.password_hash)))
      return res.status(400).json({ error: "Login yoki parol noto'g'ri" });
    await startSession(res, u.id);
    res.json({ ok: true, role: u.role });
  })
);

app.post(
  '/api/auth/logout',
  ah(async (req, res) => {
    if (req.cookies.bx_token) await col('sessions').deleteOne({ token: req.cookies.bx_token });
    res.clearCookie('bx_token');
    res.json({ ok: true });
  })
);

app.get('/api/auth/me', (req, res) => res.json({ user: plain(req.user) || null }));

app.post(
  '/api/auth/password',
  requireAuth,
  ah(async (req, res) => {
    const u = await col('users').findOne({ id: req.user.id });
    const oldP = typeof req.body.old_password === 'string' ? req.body.old_password : '';
    const newP = typeof req.body.new_password === 'string' ? req.body.new_password : '';
    if (!(await bcrypt.compare(oldP, u.password_hash))) return res.status(400).json({ error: "Joriy parol noto'g'ri" });
    if (newP.length < 6) return res.status(400).json({ error: "Yangi parol kamida 6 belgidan iborat bo'lsin" });
    await col('users').updateOne({ id: u.id }, { $set: { password_hash: await bcrypt.hash(newP, 10) } });
    res.json({ ok: true });
  })
);

app.post(
  '/api/auth/profile',
  requireAuth,
  ah(async (req, res) => {
    const full_name = str(req.body.full_name, 80);
    const phone = str(req.body.phone, 30);
    if (full_name.length < 2) return res.status(400).json({ error: 'Ism-familiyani kiriting' });
    await col('users').updateOne({ id: req.user.id }, { $set: { full_name, phone } });
    res.json({ ok: true });
  })
);

// ---------- Ochiq ma'lumotlar (bosh sahifa uchun) ----------
app.get(
  '/api/public',
  ah(async (req, res) => {
    res.json({
      settings: await getSettings(),
      counts: {
        lessons: await col('lessons').countDocuments(),
        works: await col('submissions').countDocuments({ status: 'approved' }),
      },
    });
  })
);

// ---------- Bexa AI bot (yordam chati) ----------
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function botReply(text, s) {
  const t = text.toLowerCase();
  const parts = [];
  if (/(assalom|salom|привет|здравств|hello|\bhi\b)/.test(t)) parts.push('Assalomu alaykum! Bexa AI botiga xush kelibsiz 👋');
  if (/(narx|qancha|necha pul|nech pul|price|цена|сколько|to'lov|tolov)/.test(t))
    parts.push(
      `${s.courseTitle} narxi hozir ${fmt(s.price)} so'm (oldin ${fmt(s.oldPrice)} so'm). Sotib olish uchun: ${s.telegramLink}`
    );
  if (/(adminlar saf|admin bo'l|admin bol|katta kurs|250)/.test(t))
    parts.push(`"${s.adminCourseTitle}" kursi — ${fmt(s.adminCoursePrice)} so'm. Batafsil: ${s.telegramLink}`);
  if (/(ariza|tasdiq|kira olmayap|ochilmayap)/.test(t))
    parts.push("Arizangizni admin ko'rib chiqadi. To'lovni amalga oshirgan bo'lsangiz, chekni shu yerga yoki Telegram'ga yuboring — tasdiqlangach barcha darslar ochiladi.");
  if (/(dars|video|topshiriq|vazifa)/.test(t) && !parts.length)
    parts.push("Darslar va topshiriqlar o'quvchi kabinetida joylashgan. Videoni ko'rib, o'zingiz ham shunday video yasab yuklaysiz — admin tekshiradi.");
  parts.push('Xabaringiz qabul qilindi. Admin sizga tez orada yozadi ✅');
  return parts.join('\n\n');
}

async function findThread(req, create) {
  if (req.user) {
    let t = await col('support_threads').findOne({ user_id: req.user.id });
    if (!t && create) {
      const id = await nextId('support_threads');
      const doc = { id, user_id: req.user.id, guest_key: null, guest_name: null, unread_admin: 0, last_at: now() };
      await col('support_threads').insertOne(doc);
      t = doc;
    }
    return t;
  }
  const key = str(req.body?.guest_key || req.query.guest_key, 64);
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(key)) return null;
  let t = await col('support_threads').findOne({ guest_key: key });
  if (!t && create) {
    const id = await nextId('support_threads');
    const doc = {
      id,
      user_id: null,
      guest_key: key,
      guest_name: str(req.body?.guest_name, 60) || 'Mehmon',
      unread_admin: 0,
      last_at: now(),
    };
    await col('support_threads').insertOne(doc);
    t = doc;
  }
  return t;
}

async function supportMessages(threadId, after) {
  const msgs = await col('support_messages').find({ thread_id: threadId, id: { $gt: after } }).sort({ id: 1 }).toArray();
  const adminIds = [...new Set(msgs.filter((m) => m.sender === 'admin' && m.admin_id).map((m) => m.admin_id))];
  const admins = adminIds.length
    ? await col('users').find({ id: { $in: adminIds } }, { projection: { id: 1, full_name: 1 } }).toArray()
    : [];
  const am = new Map(admins.map((a) => [a.id, a.full_name]));
  return msgs.map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    created_at: m.created_at,
    admin_name: m.sender === 'admin' ? am.get(m.admin_id) || null : null,
  }));
}

app.get(
  '/api/support',
  ah(async (req, res) => {
    const t = await findThread(req, false);
    if (!t) return res.json({ messages: [] });
    res.json({ messages: await supportMessages(t.id, int(req.query.after)) });
  })
);

app.post(
  '/api/support',
  ah(async (req, res) => {
    const body = str(req.body.body, 2000);
    if (!body) return res.status(400).json({ error: "Xabar bo'sh" });
    const t = await findThread(req, true);
    if (!t) return res.status(400).json({ error: 'Xatolik: sahifani yangilang' });
    if (!req.user && req.body.guest_name)
      await col('support_threads').updateOne({ id: t.id }, { $set: { guest_name: str(req.body.guest_name, 60) } });
    const ts = now();
    await col('support_messages').insertOne({
      id: await nextId('support_messages'),
      thread_id: t.id,
      sender: 'user',
      admin_id: null,
      body,
      created_at: ts,
    });
    // Admin yaqinda javob bergan bo'lsa bot jim turadi
    const recentAdmin = await col('support_messages').findOne({
      thread_id: t.id,
      sender: 'admin',
      created_at: { $gt: nowMinusMinutes(10) },
    });
    if (!recentAdmin)
      await col('support_messages').insertOne({
        id: await nextId('support_messages'),
        thread_id: t.id,
        sender: 'bot',
        admin_id: null,
        body: botReply(body, await getSettings()),
        created_at: now(),
      });
    await col('support_threads').updateOne({ id: t.id }, { $inc: { unread_admin: 1 }, $set: { last_at: ts } });
    res.json({ ok: true });
  })
);

// ---------- Darslar va topshiriqlar (o'quvchilar) ----------
app.get(
  '/api/lessons',
  requireActive,
  ah(async (req, res) => {
    const lessons = await col('lessons').find({}, { projection: { _id: 0 } }).sort({ sort_order: 1, id: 1 }).toArray();
    const counts = await col('submissions')
      .aggregate([{ $group: { _id: '$lesson_id', c: { $sum: 1 } } }])
      .toArray();
    const countMap = new Map(counts.map((x) => [x._id, x.c]));
    const mine = await col('submissions')
      .find({ user_id: req.user.id }, { projection: { lesson_id: 1, status: 1 } })
      .sort({ id: -1 })
      .toArray();
    const myMap = new Map();
    for (const s of mine) if (!myMap.has(s.lesson_id)) myMap.set(s.lesson_id, s.status);
    res.json({
      lessons: lessons.map((l) => ({
        ...l,
        sub_count: countMap.get(l.id) || 0,
        my_status: myMap.has(l.id) ? myMap.get(l.id) : null,
      })),
    });
  })
);

// Topshiriqlarni bog'langan ma'lumotlar bilan boyitish (author, lesson_title, reviewer)
async function enrichSubs(subs) {
  const userIds = new Set();
  const lessonIds = new Set();
  for (const s of subs) {
    userIds.add(s.user_id);
    if (s.reviewed_by) userIds.add(s.reviewed_by);
    lessonIds.add(s.lesson_id);
  }
  const users = userIds.size
    ? await col('users')
        .find({ id: { $in: [...userIds] } }, { projection: { id: 1, full_name: 1, username: 1 } })
        .toArray()
    : [];
  const lessons = lessonIds.size
    ? await col('lessons').find({ id: { $in: [...lessonIds] } }, { projection: { id: 1, title: 1 } }).toArray()
    : [];
  const um = new Map(users.map((u) => [u.id, u]));
  const lm = new Map(lessons.map((l) => [l.id, l]));
  return subs.map((s) => {
    const u = um.get(s.user_id);
    const l = lm.get(s.lesson_id);
    const r = s.reviewed_by ? um.get(s.reviewed_by) : null;
    return plain({
      ...s,
      author: u ? u.full_name : null,
      author_username: u ? u.username : null,
      lesson_title: l ? l.title : null,
      reviewer: r ? r.full_name : null,
    });
  });
}

app.get(
  '/api/lessons/:id',
  requireActive,
  ah(async (req, res) => {
    const lesson = await col('lessons').findOne({ id: int(req.params.id) }, { projection: { _id: 0 } });
    if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });
    const submissions = await col('submissions').find({ lesson_id: lesson.id }).sort({ id: -1 }).toArray();
    res.json({ lesson, submissions: await enrichSubs(submissions) });
  })
);

app.post(
  '/api/lessons/:id/submit',
  requireActive,
  withUpload(uploadSubmission, 'video'),
  ah(async (req, res) => {
    const lesson = await col('lessons').findOne({ id: int(req.params.id) }, { projection: { id: 1 } });
    if (!lesson) {
      if (req.file) removeLocal('submissions/' + req.file.filename);
      return res.status(404).json({ error: 'Dars topilmadi' });
    }
    if (!req.file) return res.status(400).json({ error: 'Video faylni tanlang' });
    const rel = 'submissions/' + req.file.filename;
    await storeUpload(rel);
    await col('submissions').insertOne({
      id: await nextId('submissions'),
      lesson_id: lesson.id,
      user_id: req.user.id,
      video_file: rel,
      note: str(req.body.note, 1000),
      status: 'pending',
      admin_comment: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: now(),
    });
    res.json({ ok: true });
  })
);

app.get(
  '/api/submissions',
  requireActive,
  ah(async (req, res) => {
    const q = {};
    if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) q.status = req.query.status;
    if (req.query.mine === '1') q.user_id = req.user.id;
    const submissions = await col('submissions').find(q).sort({ id: -1 }).limit(200).toArray();
    res.json({ submissions: await enrichSubs(submissions) });
  })
);

app.delete(
  '/api/submissions/:id',
  requireActive,
  ah(async (req, res) => {
    const s = await col('submissions').findOne({ id: int(req.params.id) });
    if (!s) return res.status(404).json({ error: 'Topilmadi' });
    if (s.user_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ error: "Ruxsat yo'q" });
    await col('submissions').deleteOne({ id: s.id });
    await deleteUpload(s.video_file);
    res.json({ ok: true });
  })
);

// ---------- Chatlar: 'students' (o'quvchilar) va 'admins' (adminlar) ----------
function canRoom(user, room) {
  if (room === 'admins') return isAdmin(user);
  if (room === 'students') return isActive(user);
  return false;
}
async function chatMessages(rows) {
  const userIds = [...new Set(rows.map((m) => m.user_id))];
  const users = userIds.length
    ? await col('users')
        .find({ id: { $in: userIds } }, { projection: { id: 1, full_name: 1, role: 1 } })
        .toArray()
    : [];
  const um = new Map(users.map((u) => [u.id, u]));
  return rows.map((m) => {
    const u = um.get(m.user_id) || {};
    return { id: m.id, body: m.body, created_at: m.created_at, user_id: m.user_id, full_name: u.full_name || null, role: u.role || null };
  });
}
app.get(
  '/api/chat/:room',
  requireActive,
  ah(async (req, res) => {
    const room = req.params.room;
    if (!canRoom(req.user, room)) return res.status(403).json({ error: "Ruxsat yo'q" });
    const after = int(req.query.after);
    const rows = after
      ? await col('messages').find({ room, id: { $gt: after } }).sort({ id: 1 }).limit(200).toArray()
      : (await col('messages').find({ room }).sort({ id: -1 }).limit(100).toArray()).reverse();
    res.json({ messages: await chatMessages(rows) });
  })
);
app.post(
  '/api/chat/:room',
  requireActive,
  ah(async (req, res) => {
    const room = req.params.room;
    if (!canRoom(req.user, room)) return res.status(403).json({ error: "Ruxsat yo'q" });
    const body = str(req.body.body, 2000);
    if (!body) return res.status(400).json({ error: "Xabar bo'sh" });
    await col('messages').insertOne({ id: await nextId('messages'), room, user_id: req.user.id, body, created_at: now() });
    res.json({ ok: true });
  })
);

// ---------- ADMIN PANEL ----------
const admin = express.Router();
admin.use(requireAuth, requireAdmin);

admin.get(
  '/badges',
  ah(async (req, res) => {
    const lastUserMsg = await col('support_messages').findOne({ sender: 'user' }, { projection: { id: 1 }, sort: { id: -1 } });
    res.json({
      pending: await col('submissions').countDocuments({ status: 'pending' }),
      support: await col('support_threads').countDocuments({ unread_admin: { $gt: 0 } }),
      applications: await col('users').countDocuments({ role: 'student', status: 'pending' }),
      last_support: lastUserMsg ? lastUserMsg.id : 0,
    });
  })
);

admin.get(
  '/stats',
  ah(async (req, res) => {
    const totalsArr = await col('projects')
      .aggregate([{ $group: { _id: null, income: { $sum: '$income' }, expense: { $sum: '$expense' }, cnt: { $sum: 1 } } }])
      .toArray();
    const totals = totalsArr[0]
      ? { income: totalsArr[0].income, expense: totalsArr[0].expense, cnt: totalsArr[0].cnt }
      : { income: 0, expense: 0, cnt: 0 };

    // Joriy oy (UTC) — eski SQLite: substr(project_date,1,7) = strftime('%Y-%m','now')
    const ym = now().slice(0, 7);
    const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
    const monthArr = await col('projects')
      .aggregate([
        { $match: { project_date: { $gte: ym + '-01', $lt: nextMonth } } },
        { $group: { _id: null, income: { $sum: '$income' }, expense: { $sum: '$expense' }, cnt: { $sum: 1 } } },
      ])
      .toArray();
    const month = monthArr[0]
      ? { income: monthArr[0].income, expense: monthArr[0].expense, cnt: monthArr[0].cnt }
      : { income: 0, expense: 0, cnt: 0 };

    const admins = await col('users')
      .aggregate([
        { $match: { role: { $in: ['admin', 'owner'] } } },
        { $lookup: { from: 'projects', localField: 'id', foreignField: 'admin_id', as: 'p' } },
        {
          $project: {
            _id: 0,
            id: 1,
            full_name: 1,
            username: 1,
            role: 1,
            cnt: { $size: '$p' },
            income: { $sum: '$p.income' },
            expense: { $sum: '$p.expense' },
          },
        },
        { $addFields: { profit: { $subtract: ['$income', '$expense'] } } },
        { $sort: { profit: -1, id: 1 } },
      ])
      .toArray();

    const monthly = (
      await col('projects')
        .aggregate([
          { $group: { _id: { $substrCP: ['$project_date', 0, 7] }, income: { $sum: '$income' }, expense: { $sum: '$expense' } } },
          { $project: { _id: 0, m: '$_id', income: 1, expense: 1 } },
          { $sort: { m: -1 } },
          { $limit: 6 },
        ])
        .toArray()
    ).reverse();

    // Javob kutayotgan yordam xabarlari
    const uts = await col('support_threads').find({ unread_admin: { $gt: 0 } }).sort({ last_at: -1 }).limit(5).toArray();
    const unread_threads = await Promise.all(
      uts.map(async (t) => {
        let name = t.guest_name || 'Mehmon';
        if (t.user_id) {
          const u = await col('users').findOne({ id: t.user_id }, { projection: { full_name: 1 } });
          if (u && u.full_name) name = u.full_name;
        }
        const lm = await col('support_messages')
          .find({ thread_id: t.id, sender: 'user' }, { projection: { body: 1 } })
          .sort({ id: -1 })
          .limit(1)
          .next();
        return {
          id: t.id,
          unread_admin: t.unread_admin,
          last_at: t.last_at,
          name,
          user_id: t.user_id || null,
          last_body: lm ? lm.body : null,
        };
      })
    );

    const recent = await col('projects').find({}, { projection: { _id: 0 } }).sort({ id: -1 }).limit(5).toArray();
    const recentIds = [...new Set(recent.map((p) => p.admin_id).filter((x) => x != null))];
    const recentUsers = recentIds.length
      ? await col('users').find({ id: { $in: recentIds } }, { projection: { id: 1, full_name: 1 } }).toArray()
      : [];
    const rum = new Map(recentUsers.map((u) => [u.id, u.full_name]));

    res.json({
      totals,
      month,
      admins,
      monthly,
      students: await col('users').countDocuments({ role: 'student', status: 'active' }),
      applications: await col('users').countDocuments({ role: 'student', status: 'pending' }),
      unread_threads,
      lessons: await col('lessons').countDocuments(),
      pending: await col('submissions').countDocuments({ status: 'pending' }),
      support: await col('support_threads').countDocuments({ unread_admin: { $gt: 0 } }),
      recent: recent.map((p) => ({ ...p, admin_name: p.admin_id != null ? rum.get(p.admin_id) || null : null })),
    });
  })
);

// Loyihalar (projects)
const PLATFORMS = ['telegram', 'instagram', 'youtube', 'tiktok', 'boshqa'];
function projectInput(b) {
  const name = str(b.name, 100);
  if (!name) return { error: 'Loyiha nomini kiriting' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.project_date || '') ? b.project_date : new Date().toISOString().slice(0, 10);
  return {
    name,
    platform: PLATFORMS.includes(b.platform) ? b.platform : 'boshqa',
    handle: str(b.handle, 120),
    income: int(b.income),
    expense: int(b.expense),
    note: str(b.note, 1000),
    project_date: date,
  };
}
admin.get(
  '/projects',
  ah(async (req, res) => {
    const mine = req.query.mine === '1';
    const q = mine ? { admin_id: req.user.id } : {};
    const projects = await col('projects').find(q, { projection: { _id: 0 } }).sort({ project_date: -1, id: -1 }).toArray();
    const ids = [...new Set(projects.map((p) => p.admin_id).filter((x) => x != null))];
    const users = ids.length
      ? await col('users').find({ id: { $in: ids } }, { projection: { id: 1, full_name: 1, username: 1 } }).toArray()
      : [];
    const um = new Map(users.map((u) => [u.id, u]));
    res.json({
      projects: projects.map((p) => ({
        ...p,
        admin_name: p.admin_id != null ? um.get(p.admin_id)?.full_name || null : null,
        admin_username: p.admin_id != null ? um.get(p.admin_id)?.username || null : null,
      })),
    });
  })
);
admin.post(
  '/projects',
  ah(async (req, res) => {
    const p = projectInput(req.body);
    if (p.error) return res.status(400).json(p);
    await col('projects').insertOne({
      id: await nextId('projects'),
      admin_id: req.user.id,
      ...p,
      created_at: now(),
    });
    res.json({ ok: true });
  })
);
async function ownProject(req, res) {
  const p = await col('projects').findOne({ id: int(req.params.id) });
  if (!p) {
    res.status(404).json({ error: 'Loyiha topilmadi' });
    return null;
  }
  if (p.admin_id !== req.user.id && req.user.role !== 'owner') {
    res.status(403).json({ error: "Faqat o'z loyihangizni o'zgartira olasiz" });
    return null;
  }
  return p;
}
admin.put(
  '/projects/:id',
  ah(async (req, res) => {
    const old = await ownProject(req, res);
    if (!old) return;
    const p = projectInput(req.body);
    if (p.error) return res.status(400).json(p);
    await col('projects').updateOne({ id: old.id }, { $set: p });
    res.json({ ok: true });
  })
);
admin.delete(
  '/projects/:id',
  ah(async (req, res) => {
    const old = await ownProject(req, res);
    if (!old) return;
    await col('projects').deleteOne({ id: old.id });
    res.json({ ok: true });
  })
);

// Topshiriqlarni tekshirish
admin.post(
  '/submissions/:id/review',
  ah(async (req, res) => {
    const status = req.body.status;
    if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: "Noto'g'ri holat" });
    const r = await col('submissions').updateOne(
      { id: int(req.params.id) },
      { $set: { status, admin_comment: str(req.body.comment, 1000), reviewed_by: req.user.id, reviewed_at: now() } }
    );
    if (!r.matchedCount) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ ok: true });
  })
);

// Darslarni boshqarish
async function saveLesson(req, res, id) {
  const title = str(req.body.title, 150);
  if (!title) {
    if (req.file) removeLocal('lessons/' + req.file.filename);
    return res.status(400).json({ error: 'Dars nomini kiriting' });
  }
  const description = str(req.body.description, 5000);
  const video_url = str(req.body.video_url, 500);
  const sort_order = int(req.body.sort_order);
  const file = req.file ? 'lessons/' + req.file.filename : null;
  if (file) await storeUpload(file); // avval GridFS'ga saqlaymiz
  if (id) {
    const old = await col('lessons').findOne({ id });
    if (!old) {
      if (file) await deleteUpload(file);
      return res.status(404).json({ error: 'Dars topilmadi' });
    }
    let video_file = old.video_file || null;
    if (file || req.body.remove_file === '1') {
      await deleteUpload(old.video_file);
      video_file = file; // remove_file=1 bo'lsa — null
    }
    await col('lessons').updateOne({ id }, { $set: { title, description, video_url, video_file, sort_order } });
  } else {
    await col('lessons').insertOne({
      id: await nextId('lessons'),
      title,
      description,
      video_url,
      video_file: file,
      sort_order,
      created_at: now(),
    });
  }
  res.json({ ok: true });
}
admin.post('/lessons', withUpload(uploadLesson, 'video'), ah((req, res) => saveLesson(req, res, null)));
admin.post('/lessons/:id', withUpload(uploadLesson, 'video'), ah((req, res) => saveLesson(req, res, int(req.params.id))));
admin.delete(
  '/lessons/:id',
  ah(async (req, res) => {
    const l = await col('lessons').findOne({ id: int(req.params.id) });
    if (!l) return res.status(404).json({ error: 'Dars topilmadi' });
    const subs = await col('submissions').find({ lesson_id: l.id }, { projection: { video_file: 1 } }).toArray();
    for (const s of subs) await deleteUpload(s.video_file);
    await col('submissions').deleteMany({ lesson_id: l.id });
    await col('lessons').deleteOne({ id: l.id });
    await deleteUpload(l.video_file);
    res.json({ ok: true });
  })
);

// Yordam (Bexa AI bot) xabarlari
admin.get(
  '/support/threads',
  ah(async (req, res) => {
    const threads = await col('support_threads').find({}, { projection: { _id: 0 } }).sort({ last_at: -1 }).limit(200).toArray();
    // Har bir threadning oxirgi xabari
    const lastMap = await col('support_messages')
      .aggregate([
        { $sort: { id: -1 } },
        { $group: { _id: '$thread_id', last_body: { $first: '$body' } } },
      ])
      .toArray();
    const lm = new Map(lastMap.map((x) => [x._id, x.last_body]));
    const userIds = [...new Set(threads.map((t) => t.user_id).filter((x) => x != null))];
    const users = userIds.length
      ? await col('users').find({ id: { $in: userIds } }, { projection: { id: 1, full_name: 1, username: 1, phone: 1 } }).toArray()
      : [];
    const um = new Map(users.map((u) => [u.id, u]));
    res.json({
      threads: threads.map((t) => {
        const u = t.user_id != null ? um.get(t.user_id) : null;
        return {
          ...t,
          full_name: u ? u.full_name : null,
          username: u ? u.username : null,
          phone: u ? u.phone : null,
          last_body: lm.has(t.id) ? lm.get(t.id) : null,
        };
      }),
    });
  })
);
admin.get(
  '/support/threads/:id',
  ah(async (req, res) => {
    const id = int(req.params.id);
    const t = await col('support_threads').findOne({ id });
    if (!t) return res.status(404).json({ error: 'Topilmadi' });
    await col('support_threads').updateOne({ id }, { $set: { unread_admin: 0 } });
    res.json({ messages: await supportMessages(id, int(req.query.after)) });
  })
);
admin.post(
  '/support/threads/:id',
  ah(async (req, res) => {
    const id = int(req.params.id);
    const body = str(req.body.body, 2000);
    if (!body) return res.status(400).json({ error: "Xabar bo'sh" });
    if (!(await col('support_threads').findOne({ id }, { projection: { id: 1 } })))
      return res.status(404).json({ error: 'Topilmadi' });
    await col('support_messages').insertOne({
      id: await nextId('support_messages'),
      thread_id: id,
      sender: 'admin',
      admin_id: req.user.id,
      body,
      created_at: now(),
    });
    await col('support_threads').updateOne({ id }, { $set: { unread_admin: 0, last_at: now() } });
    res.json({ ok: true });
  })
);

// O'quvchilar ro'yxati
admin.get(
  '/students',
  ah(async (req, res) => {
    const users = await col('users')
      .aggregate([
        { $match: { role: 'student' } },
        { $addFields: { is_pending: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } } },
        { $sort: { is_pending: -1, id: -1 } },
        { $lookup: { from: 'submissions', localField: 'id', foreignField: 'user_id', as: 'subs' } },
        {
          $project: {
            _id: 0,
            id: 1,
            username: 1,
            full_name: 1,
            phone: 1,
            telegram: 1,
            app_note: 1,
            status: 1,
            created_at: 1,
            approved_at: 1,
            approved_by: 1,
            subs: { $size: '$subs' },
            approved: { $size: { $filter: { input: '$subs', as: 's', cond: { $eq: ['$$s.status', 'approved'] } } } },
          },
        },
      ])
      .toArray();
    const approverIds = [...new Set(users.map((u) => u.approved_by).filter((x) => x != null))];
    const approvers = approverIds.length
      ? await col('users').find({ id: { $in: approverIds } }, { projection: { id: 1, full_name: 1 } }).toArray()
      : [];
    const am = new Map(approvers.map((a) => [a.id, a.full_name]));
    res.json({
      students: users.map((u) => ({ ...u, approved_by_name: u.approved_by != null ? am.get(u.approved_by) || null : null })),
    });
  })
);
// Arizalarni tasdiqlash / rad etish / bloklash
admin.post(
  '/students/:id/status',
  ah(async (req, res) => {
    const status = req.body.status;
    if (!['active', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: "Noto'g'ri holat" });
    const u = await col('users').findOne({ id: int(req.params.id), role: 'student' });
    if (!u) return res.status(404).json({ error: "O'quvchi topilmadi" });
    await col('users').updateOne(
      { id: u.id },
      { $set: { status, approved_by: req.user.id, approved_at: now() } }
    );
    // O'quvchiga Bexa AI bot orqali xabar yuboriladi
    const msg =
      status === 'active'
        ? "🎉 Tabriklaymiz! Arizangiz tasdiqlandi — endi barcha darslar sizga ochiq. Omad!"
        : status === 'rejected'
          ? "Arizangiz hozircha tasdiqlanmadi. Savollar bo'lsa, shu yerga yozing."
          : null;
    if (msg) {
      let t = await col('support_threads').findOne({ user_id: u.id });
      if (!t) {
        const id = await nextId('support_threads');
        t = { id, user_id: u.id, guest_key: null, guest_name: null, unread_admin: 0, last_at: now() };
        await col('support_threads').insertOne(t);
      }
      await col('support_messages').insertOne({
        id: await nextId('support_messages'),
        thread_id: t.id,
        sender: 'admin',
        admin_id: req.user.id,
        body: msg,
        created_at: now(),
      });
    }
    res.json({ ok: true });
  })
);
admin.delete(
  '/students/:id',
  ah(async (req, res) => {
    const u = await col('users').findOne({ id: int(req.params.id), role: 'student' });
    if (!u) return res.status(404).json({ error: 'Topilmadi' });
    const subs = await col('submissions').find({ user_id: u.id }, { projection: { video_file: 1 } }).toArray();
    for (const s of subs) await deleteUpload(s.video_file);
    await col('submissions').deleteMany({ user_id: u.id });
    await col('sessions').deleteMany({ user_id: u.id });
    await col('users').deleteOne({ id: u.id });
    res.json({ ok: true });
  })
);

// Sayt sozlamalari (narxlar, matnlar, havolalar)
admin.put(
  '/settings',
  ah(async (req, res) => {
    const b = req.body || {};
    const out = {};
    for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(k in b)) continue;
      if (Array.isArray(def)) out[k] = (Array.isArray(b[k]) ? b[k] : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 20);
      else if (typeof def === 'number') out[k] = int(b[k]);
      else out[k] = str(b[k], 600);
    }
    for (const k of ['telegramLink', 'instagramLink'])
      if (out[k] && !/^https?:\/\//i.test(out[k])) return res.status(400).json({ error: 'Havola http:// yoki https:// bilan boshlansin' });
    for (const [k, v] of Object.entries(out))
      await col('settings').updateOne({ key: k }, { $set: { value: JSON.stringify(v) } }, { upsert: true });
    res.json({ ok: true, settings: await getSettings() });
  })
);

// ---------- OWNER: adminlarni boshqarish ----------
admin.get(
  '/admins',
  requireOwner,
  ah(async (req, res) => {
    res.json({
      admins: plainAll(
        await col('users')
          .find({ role: { $in: ['admin', 'owner'] } }, { projection: { id: 1, username: 1, full_name: 1, phone: 1, role: 1, created_at: 1 } })
          .sort({ role: -1, id: 1 })
          .toArray()
      ),
    });
  })
);
admin.post(
  '/admins',
  requireOwner,
  ah(async (req, res) => {
    const full_name = str(req.body.full_name, 80);
    const username = str(req.body.username, 30).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (full_name.length < 2) return res.status(400).json({ error: 'Ismni kiriting' });
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Login 3–30 belgi: lotin harflari, raqam, _ yoki .' });
    if (password.length < 6) return res.status(400).json({ error: "Parol kamida 6 belgidan iborat bo'lsin" });
    const existing = await col('users').findOne({ username });
    if (existing) {
      if (existing.role !== 'student') return res.status(400).json({ error: 'Bu login band' });
      // Mavjud o'quvchini admin qilish
      await col('users').updateOne(
        { id: existing.id },
        { $set: { role: 'admin', full_name, password_hash: await bcrypt.hash(password, 10) } }
      );
      return res.json({ ok: true, promoted: true });
    }
    try {
      await col('users').insertOne({
        id: await nextId('users'),
        username,
        password_hash: await bcrypt.hash(password, 10),
        full_name,
        phone: null,
        telegram: null,
        app_note: null,
        role: 'admin',
        status: 'active',
        approved_by: null,
        approved_at: null,
        created_at: now(),
      });
    } catch (e) {
      if (e.code === 11000) return res.status(400).json({ error: 'Bu login band' });
      throw e;
    }
    res.json({ ok: true });
  })
);
admin.put(
  '/admins/:id',
  requireOwner,
  ah(async (req, res) => {
    const u = await col('users').findOne({ id: int(req.params.id), role: { $in: ['admin', 'owner'] } });
    if (!u) return res.status(404).json({ error: 'Admin topilmadi' });
    const full_name = str(req.body.full_name, 80) || u.full_name;
    await col('users').updateOne({ id: u.id }, { $set: { full_name } });
    if (req.body.password) {
      if (String(req.body.password).length < 6) return res.status(400).json({ error: "Parol kamida 6 belgidan iborat bo'lsin" });
      await col('users').updateOne({ id: u.id }, { $set: { password_hash: await bcrypt.hash(String(req.body.password), 10) } });
      if (u.id !== req.user.id) await col('sessions').deleteMany({ user_id: u.id });
    }
    res.json({ ok: true });
  })
);
admin.delete(
  '/admins/:id',
  requireOwner,
  ah(async (req, res) => {
    const u = await col('users').findOne({ id: int(req.params.id), role: 'admin' });
    if (!u) return res.status(404).json({ error: "Admin topilmadi (owner o'chirilmaydi)" });
    // Loyihalari saqlanib qoladi, foydalanuvchi o'quvchiga aylantiriladi
    await col('users').updateOne({ id: u.id }, { $set: { role: 'student' } });
    await col('sessions').deleteMany({ user_id: u.id });
    res.json({ ok: true });
  })
);

app.use('/api/admin', admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi' }));

// ---------- Video fayllar: GridFS dan (faqat tizimga kirganlarga) ----------
const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
};
app.get(
  '/uploads/*',
  requireActive,
  ah(async (req, res) => {
    const rel = req.params[0];
    if (!/^(submissions|lessons)\/[\w.-]+$/.test(rel)) return res.status(404).end();
    const f = await findUpload(rel);
    if (!f) return res.status(404).end();
    const type = MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!m) return res.status(416).set('Content-Range', `bytes */${f.length}`).end();
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : f.length - 1;
      if (!Number.isFinite(start) || start >= f.length || start > end)
        return res.status(416).set('Content-Range', `bytes */${f.length}`).end();
      end = Math.min(end, f.length - 1);
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${f.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': type,
        'Cache-Control': 'public, max-age=604800',
      });
      // NB: GridFS end — eksklyuziv, HTTP Range end — inklyuziv
      const stream = downloadStream(f._id, { start, end: end + 1 });
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } else {
      res.set({
        'Accept-Ranges': 'bytes',
        'Content-Length': f.length,
        'Content-Type': type,
        'Cache-Control': 'public, max-age=604800',
      });
      const stream = downloadStream(f._id);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    }
  })
);

// Sahifalar
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get(['/kirish', '/login'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/kabinet', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ error: status === 400 ? "Noto'g'ri so'rov" : 'Server xatosi' });
});

(async () => {
  await init();
  // Owner hisobini yaratish (faqat birinchi ishga tushganda)
  const owner = await col('users').findOne({ role: 'owner' }, { projection: { id: 1 } });
  if (!owner) {
    const ex = await col('users').findOne({ username: OWNER_USERNAME });
    const hash = await bcrypt.hash(OWNER_DEFAULT_PASSWORD, 10);
    if (ex) await col('users').updateOne({ id: ex.id }, { $set: { role: 'owner', password_hash: hash, status: 'active' } });
    else
      await col('users').insertOne({
        id: await nextId('users'),
        username: OWNER_USERNAME,
        password_hash: hash,
        full_name: 'Bekzod',
        phone: null,
        telegram: null,
        app_note: null,
        role: 'owner',
        status: 'active',
        approved_by: null,
        approved_at: null,
        created_at: now(),
      });
    console.log(`Owner yaratildi → login: ${OWNER_USERNAME}`);
  }
  app.listen(PORT, () => console.log(`Bexa AI Academy ishga tushdi: http://localhost:${PORT}`));

  const stop = async () => {
    try {
      await close();
    } catch (_) {}
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((e) => {
  console.error('Serverni ishga tushirib bo\'lmadi:', e);
  process.exit(1);
});

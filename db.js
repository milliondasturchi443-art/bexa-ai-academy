// MongoDB (Atlas) ma'lumotlar bazasi + GridFS (video fayllar)
// MONGODB_URI env orqali beriladi (yoki papkada .env fayli)
const fs = require('fs');
const path = require('path');
const { MongoClient, GridFSBucket } = require('mongodb');

// ---- Oddiy .env yuklagich (qo'shimcha kutubxonasiz) ----
(function loadEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
})();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

let client = null;
let db = null;
let bucket = null;

function col(name) {
  if (!db) throw new Error("MongoDB hali ulanmagan — avval db.init() chaqirilishi kerak");
  return db.collection(name);
}

// SQLite'dagidek: UTC vaqt 'YYYY-MM-DD HH:MM:SS' ko'rinishida
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const nowMinusMinutes = (min) => new Date(Date.now() - min * 60000).toISOString().slice(0, 19).replace('T', ' ');

// JSON javobdan MongoDB _id ni olib tashlash (API eski ko'rinishida qoladi)
function plain(d) {
  if (!d) return d;
  const { _id, ...rest } = d;
  return rest;
}
const plainAll = (arr) => (arr || []).map(plain);

function dbNameFrom(uri) {
  try {
    const u = new URL(uri);
    return u.pathname.replace(/^\//, '') || 'bexa';
  } catch (_) {
    return 'bexa';
  }
}

async function ensureIndexes() {
  await Promise.all([
    col('users').createIndexes([
      { key: { username: 1 }, unique: true },
      { key: { id: 1 }, unique: true },
      { key: { role: 1, status: 1 } },
    ]),
    col('sessions').createIndexes([
      { key: { token: 1 }, unique: true },
      { key: { user_id: 1 } },
    ]),
    col('lessons').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { sort_order: 1, id: 1 } },
    ]),
    col('submissions').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { lesson_id: 1, id: -1 } },
      { key: { user_id: 1, id: -1 } },
      { key: { status: 1, id: -1 } },
    ]),
    col('projects').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { admin_id: 1 } },
      { key: { project_date: -1, id: -1 } },
    ]),
    col('messages').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { room: 1, id: 1 } },
    ]),
    col('support_threads').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { guest_key: 1 } },
      { key: { user_id: 1 } },
      { key: { last_at: -1 } },
      { key: { unread_admin: 1 } },
    ]),
    col('support_messages').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { thread_id: 1, id: -1 } },
      { key: { sender: 1, id: -1 } },
    ]),
    col('settings').createIndexes([{ key: { key: 1 }, unique: true }]),
    col('videos.files').createIndexes([{ key: { filename: 1 }, unique: true }]),
  ]);
}

async function init() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI sozlanmagan (.env fayli yoki Render env o'zgaruvchisi)");
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  db = client.db(dbNameFrom(MONGODB_URI));
  bucket = new GridFSBucket(db, { bucketName: 'videos' });
  await ensureIndexes();
  return db;
}

async function close() {
  if (client) await client.close();
  client = null;
  db = null;
  bucket = null;
}

// ---- ID generator (eski SQLite autoincrement o'rniga) ----
async function nextId(name) {
  for (let i = 0; i < 5; i++) {
    try {
      const doc = await col('counters').findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      if (doc && Number.isFinite(doc.seq)) return doc.seq;
    } catch (e) {
      if (e.code !== 11000) throw e; // parallel upsert — qayta urinamiz
    }
  }
  throw new Error("ID yaratib bo'lmadi: " + name);
}

async function setCounter(name, value) {
  await col('counters').updateOne({ _id: name }, { $set: { seq: value } }, { upsert: true });
}

async function getCounter(name) {
  const d = await col('counters').findOne({ _id: name });
  return d && Number.isFinite(d.seq) ? d.seq : 0;
}

// ---- GridFS: video fayllar ----
async function findUpload(relPath) {
  return col('videos.files').findOne({ filename: relPath });
}

async function deleteUpload(relPath) {
  if (!relPath) return false;
  const f = await findUpload(relPath);
  if (!f) return false;
  try {
    await bucket.delete(f._id);
  } catch (_) {}
  return true;
}

// Lokal faylni GridFS'ga ko'chirish (fayl nomi — eski yo'l: 'submissions/xxx.mp4')
async function saveUpload(relPath, localPath) {
  const existing = await findUpload(relPath);
  if (existing) await deleteUpload(relPath);
  await new Promise((resolve, reject) => {
    const out = bucket.openUploadStream(relPath);
    const src = fs.createReadStream(localPath);
    let settled = false;
    const fail = (e) => {
      if (settled) return;
      settled = true;
      try {
        src.destroy();
        out.destroy();
      } catch (_) {}
      reject(e);
    };
    src.on('error', fail);
    out.on('error', fail);
    out.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve();
    });
    src.pipe(out);
  });
  return relPath;
}

function downloadStream(fileId, opts) {
  return bucket.openDownloadStream(fileId, opts);
}

module.exports = {
  init,
  close,
  col,
  nextId,
  setCounter,
  getCounter,
  now,
  nowMinusMinutes,
  plain,
  plainAll,
  saveUpload,
  findUpload,
  deleteUpload,
  downloadStream,
};

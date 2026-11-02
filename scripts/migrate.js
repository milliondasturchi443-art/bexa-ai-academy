// SQLite (data/bexa.sqlite) → MongoDB migratsiyasi + video fayllarni GridFS'ga ko'chirish
// Ishga tushirish: npm run migrate  (yoki: node scripts/migrate.js)
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const db = require('../db');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'data', 'bexa.sqlite');
const UPLOAD_DIR = path.join(ROOT, 'uploads');

const TABLES = [
  'users',
  'sessions',
  'lessons',
  'submissions',
  'projects',
  'messages',
  'support_threads',
  'support_messages',
  'settings',
];

// SQLite'da ustunlar bo'sh qolgan bo'lsa — eski standart qiymatlarni qo'yamiz
function normalize(table, row) {
  const r = { ...row };
  if (table === 'users') {
    r.status = r.status || 'active';
    r.phone = r.phone ?? null;
    r.telegram = r.telegram ?? null;
    r.app_note = r.app_note ?? null;
    r.approved_by = r.approved_by ?? null;
    r.approved_at = r.approved_at ?? null;
  } else if (table === 'lessons') {
    r.description = r.description ?? null;
    r.video_url = r.video_url ?? null;
    r.video_file = r.video_file ?? null;
  } else if (table === 'submissions') {
    r.note = r.note ?? null;
    r.admin_comment = r.admin_comment ?? null;
    r.reviewed_by = r.reviewed_by ?? null;
    r.reviewed_at = r.reviewed_at ?? null;
  } else if (table === 'projects') {
    r.handle = r.handle ?? null;
    r.note = r.note ?? null;
  } else if (table === 'support_threads') {
    r.user_id = r.user_id ?? null;
    r.guest_key = r.guest_key ?? null;
    r.guest_name = r.guest_name ?? null;
    r.unread_admin = r.unread_admin ?? 0;
  } else if (table === 'support_messages') {
    r.admin_id = r.admin_id ?? null;
  }
  return r;
}

async function migrateTable(sql, table) {
  const res = sql.exec(`SELECT * FROM ${table}`);
  const rows = res.length ? res[0].values : [];
  const cols = res.length ? res[0].columns : [];
  const docs = rows.map((vals) => {
    const obj = {};
    cols.forEach((c, i) => (obj[c] = vals[i]));
    return normalize(table, obj);
  });
  if (!docs.length) return { table, moved: 0, skipped: false };

  const existing = await db.col(table).countDocuments();
  if (existing > 0) {
    console.log(`  • ${table}: allaqachon ${existing} ta yozuv bor — o'tkazib yuborildi`);
    return { table, moved: 0, skipped: true };
  }
  // _id maydoni yo'q — MongoDB o'zi yaratadi
  await db.col(table).insertMany(docs);
  console.log(`  • ${table}: ${docs.length} ta yozuv ko'chirildi`);
  return { table, moved: docs.length, skipped: false };
}

async function migrateCounters(sql) {
  // Faqat id ustuni bor jadvallar (sessions — token PK, settings — key PK)
  const ID_TABLES = TABLES.filter((t) => t !== 'sessions' && t !== 'settings');
  for (const table of ID_TABLES) {
    const res = sql.exec(`SELECT COALESCE(MAX(id), 0) m FROM ${table}`);
    const sqliteMax = res.length ? res[0].values[0][0] : 0;
    const mongoDocs = await db.col(table).find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
    const mongoMax = mongoDocs.length ? mongoDocs[0].id : 0;
    const max = Math.max(sqliteMax || 0, mongoMax || 0);
    if (max > 0) await db.setCounter(table, max);
  }
}

async function migrateUploads(sql) {
  const rels = new Set();
  for (const table of ['lessons', 'submissions']) {
    const res = sql.exec(`SELECT video_file FROM ${table} WHERE video_file IS NOT NULL AND video_file != ''`);
    if (res.length) for (const [v] of res[0].values) rels.add(v);
  }
  let ok = 0;
  let missing = 0;
  for (const rel of rels) {
    const abs = path.join(UPLOAD_DIR, rel);
    if (!fs.existsSync(abs)) {
      console.log(`  ⚠️  ${rel} — lokal fayl topilmadi (video bo'sh bo'ladi)`);
      missing++;
      continue;
    }
    const exists = await db.findUpload(rel);
    if (exists) {
      console.log(`  • ${rel} — allaqachon GridFS'da bor`);
      continue;
    }
    await db.saveUpload(rel, abs);
    console.log(`  • ${rel} — GridFS'ga ko'chirildi (${(fs.statSync(abs).size / 1048576).toFixed(1)} MB)`);
    ok++;
  }
  return { total: rels.size, ok, missing };
}

(async () => {
  if (!fs.existsSync(DB_FILE)) {
    console.error('SQLite fayl topilmadi:', DB_FILE);
    process.exit(1);
  }
  console.log('MongoDB ulanmoqda...');
  await db.init();
  console.log('Ulandi. Migratsiya boshlanadi...\n');

  const SQL = await initSqlJs();
  const sql = new SQL.Database(fs.readFileSync(DB_FILE));

  let moved = 0;
  for (const t of TABLES) {
    const r = await migrateTable(sql, t);
    moved += r.moved;
  }
  await migrateCounters(sql);
  console.log('\nVideo fayllar (GridFS):');
  const up = await migrateUploads(sql);

  console.log('\n✅ Migratsiya tugadi:');
  console.log(`   - yozuvlar: ${moved}`);
  console.log(`   - videolar: ${up.ok} ko'chirildi, ${up.missing} topilmadi (jami ${up.total})`);

  await db.close();
  process.exit(0);
})().catch((e) => {
  console.error('Migratsiya xatosi:', e);
  process.exit(1);
});

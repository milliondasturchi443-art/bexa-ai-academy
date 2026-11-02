// O'quvchi kabineti
let ME = null;

function workCard(s, { showLesson = true, canDelete = false } = {}) {
  return `<div class="card work reveal">
    <video src="/uploads/${esc(s.video_file)}" controls preload="metadata" playsinline></video>
    <div class="wb">
      <div class="who"><div class="ava">${esc(initials(s.author))}</div><div><b>${esc(s.author)}</b><small>${fmtTime(s.created_at)}</small></div></div>
      ${showLesson ? `<div style="font-size:13px;font-weight:700">📘 ${esc(s.lesson_title || "O'chirilgan dars")}</div>` : ''}
      <div>${statusBadge(s.status)}</div>
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      ${s.admin_comment ? `<div class="cmt"><b>${esc(s.reviewer || 'Admin')} izohi:</b>${esc(s.admin_comment)}</div>` : ''}
      ${canDelete ? `<div class="acts"><button class="btn btn-sm" data-del="${s.id}">O'chirish</button></div>` : ''}
    </div></div>`;
}

function bindDelete(root, reload) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!(await confirmBox("Bu ishni o'chirasizmi?"))) return;
    try { await api('/api/submissions/' + b.dataset.del, { method: 'DELETE' }); toast("O'chirildi"); reload(); }
    catch (err) { toast(err.message, 'err'); }
  });
}

let TG = 'https://t.me/bexaai';
const LOCKED = ['darslar', 'ishlar', 'mening', 'chat'];

const views = {
  async ariza(page, _, ctx) {
    const rejected = ME.status === 'rejected';
    page.innerHTML = `<div class="page">
      <div class="lesson-layout">
        <div class="card panel reveal" style="padding:34px">
          <div style="width:64px;height:64px;border-radius:20px;display:grid;place-items:center;font-size:30px;background:${rejected ? 'var(--red-soft)' : 'rgba(245,165,36,.12)'};border:1px solid ${rejected ? 'rgba(240,20,20,.3)' : 'rgba(245,165,36,.3)'}">${rejected ? '✕' : '⏳'}</div>
          <h1 style="font-size:26px;margin:22px 0 10px">${rejected ? 'Arizangiz tasdiqlanmadi' : "Arizangiz ko'rib chiqilmoqda"}</h1>
          <p class="muted" style="font-size:15px">${rejected
            ? "Afsuski, arizangiz hozircha tasdiqlanmadi. Savolingiz bo'lsa, Bexa AI bot orqali adminga yozing."
            : "Kurs pullik. To'lovni amalga oshiring va chekni Telegram'ga yoki o'ngdagi chatga yuboring — admin tasdiqlagach, barcha darslar, o'quvchilar ishlari va chat ochiladi."}</p>
          <div style="display:grid;gap:10px;margin:26px 0">
            <div class="card" style="padding:14px 16px;background:var(--bg2);display:flex;gap:12px;align-items:center"><span class="check">✓</span>Ariza yuborildi</div>
            <div class="card" style="padding:14px 16px;background:var(--bg2);display:flex;gap:12px;align-items:center"><span class="check" style="background:rgba(245,165,36,.12);color:#fbbf24">2</span>To'lov va admin tasdig'i</div>
            <div class="card" style="padding:14px 16px;background:var(--bg2);display:flex;gap:12px;align-items:center;opacity:.6"><span class="check" style="background:var(--surface3);color:var(--muted)">3</span>Darslar ochiladi</div>
          </div>
          <a class="btn btn-red btn-lg" href="${esc(TG)}" target="_blank" rel="noopener">Kursni sotib olish <span class="arrow">→</span></a>
        </div>
        <div class="card chat-card reveal d1" style="height:560px"><div class="chat-head"><div class="ava">AI</div><div><b>Bexa AI bot</b><div style="font-size:12px;color:#4ade80">● Admin bilan bog'lanish</div></div></div><div id="sup" style="display:flex;flex-direction:column;flex:1;min-height:0"></div></div>
      </div></div>`;
    const sup = mountSupport($('#sup'), ME);
    ctx.track(setInterval(sup.load, 4000));
    // Tasdiqlansa — avtomatik ochiladi
    ctx.track(setInterval(async () => {
      const { user } = await api('/api/auth/me').catch(() => ({}));
      if (user && user.status === 'active') { toast('Arizangiz tasdiqlandi! 🎉'); setTimeout(() => location.reload(), 1200); }
    }, 8000));
  },
  async darslar(page, id) {
    if (id) return lessonView(page, id);
    const { lessons } = await api('/api/lessons');
    page.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>Darslar</h1><p>Videoni ko'ring, shunday video yasang va joylang — admin tekshiradi.</p></div></div>
      ${lessons.length ? `<div class="lessons">${lessons.map((l, i) => `
        <a class="card lesson reveal d${i % 4}" href="#darslar/${l.id}">
          <div class="ln"><span>DARS ${String(i + 1).padStart(2, '0')}</span>${l.my_status ? statusBadge(l.my_status) : '<span class="badge">Yangi</span>'}</div>
          <h3>${esc(l.title)}</h3><p>${esc(l.description || '')}</p>
          <div class="foot"><span>▶ Video dars</span><span>${l.sub_count} ta ish</span></div>
        </a>`).join('')}</div>`
      : `<div class="card empty"><b>📚</b>Darslar tez orada qo'shiladi.</div>`}</div>`;
  },
  async ishlar(page, _, ctx) {
    let filter = '';
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>O'quvchilar ishlari</h1><p>Boshqalar nima yasaganini ko'ring va o'rganing.</p></div>
      <div class="seg" id="seg"><button class="on" data-f="">Hammasi</button><button data-f="approved">Qabul qilingan</button></div></div><div id="list"></div></div>`;
    const load = async () => {
      const { submissions } = await api('/api/submissions' + (filter ? '?status=' + filter : ''));
      $('#list').innerHTML = submissions.length ? `<div class="works">${submissions.map((s) => workCard(s, { canDelete: s.user_id === ME.id })).join('')}</div>` : `<div class="card empty"><b>🎬</b>Hozircha ishlar yo'q.</div>`;
      initReveal();
    };
    $$('#seg button').forEach((b) => b.onclick = () => { $$('#seg button').forEach((x) => x.classList.toggle('on', x === b)); filter = b.dataset.f; load(); });
    bindDelete(page, load);
    await load();
  },
  async mening(page) {
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Mening ishlarim</h1><p>Yuklagan videolaringiz va adminlar izohlari.</p></div></div><div id="list"></div></div>`;
    const load = async () => {
      const { submissions } = await api('/api/submissions?mine=1');
      $('#list').innerHTML = submissions.length ? `<div class="works">${submissions.map((s) => workCard(s, { canDelete: true })).join('')}</div>` : `<div class="card empty"><b>🚀</b>Hali ish yuklamadingiz. <a href="#darslar" style="color:var(--red2)">Darslarga o'ting →</a></div>`;
      initReveal();
    };
    bindDelete(page, load);
    await load();
  },
  async chat(page, _, ctx) {
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>O'quvchilar chati</h1><p>Savol bering, tajriba almashing. Hurmat bilan yozing 🙌</p></div></div><div id="c"></div></div>`;
    ctx.track(mountChat($('#c'), 'students', ME, "Umumiy chat", "Barcha o'quvchilar va adminlar"));
  },
  async bot(page, _, ctx) {
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Bexa AI bot</h1><p>Admin bilan bog'lanish. Bot darhol javob beradi, admin esa tez orada yozadi.</p></div></div>
      <div class="card chat-card"><div class="chat-head"><div class="ava">AI</div><div><b>Bexa AI bot</b><div style="font-size:12px;color:#4ade80">● Onlayn</div></div></div><div id="sup" style="display:flex;flex-direction:column;flex:1;min-height:0"></div></div></div>`;
    const s = mountSupport($('#sup'), ME);
    ctx.track(setInterval(s.load, 4000));
  },
  async profil(page) {
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Profil</h1><p>Shaxsiy ma'lumotlaringiz</p></div></div>
      <div class="card panel" style="max-width:520px;margin-bottom:14px"><h3>Ma'lumotlar</h3>
        <form id="pf"><div class="field"><label>Login</label><input class="input" value="${esc(ME.username)}" disabled></div>
        <div class="field"><label>Ism va familiya</label><input class="input" name="full_name" value="${esc(ME.full_name)}" required></div>
        <div class="field"><label>Telefon</label><input class="input" name="phone" value="${esc(ME.phone || '')}"></div>
        <button class="btn btn-red">Saqlash</button></form></div><div id="pw"></div></div>`;
    $('#pf').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/auth/profile', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Saqlandi'); await loadMe(); }
      catch (err) { toast(err.message, 'err'); }
    };
    changePasswordForm($('#pw'));
  },
};

async function lessonView(page, id) {
  const { lesson, submissions } = await api('/api/lessons/' + id);
  const player = lesson.video_file ? `<video src="/uploads/${esc(lesson.video_file)}" controls playsinline></video>` : videoEmbed(lesson.video_url);
  const mine = submissions.filter((s) => s.user_id === ME.id);
  const others = submissions.filter((s) => s.user_id !== ME.id);
  page.innerHTML = `<div class="page">
    <a class="back" href="#darslar">← Barcha darslar</a>
    <div class="lesson-layout">
      <div>
        ${player ? `<div class="player">${player}</div>` : lesson.video_url ? `<a class="btn" href="${esc(lesson.video_url)}" target="_blank" rel="noopener">▶ Videoni ochish</a>` : ''}
        <h1 style="font-size:24px;margin:22px 0 10px">${esc(lesson.title)}</h1>
        <div class="desc">${linkify(lesson.description || '')}</div>
      </div>
      <div class="card panel">
        <h3>Topshiriqni yuklash</h3>
        <p class="muted" style="font-size:14px;margin-bottom:14px">Darsdagi kabi video yasang va shu yerga joylang.</p>
        <form id="up">
          <div class="file-drop" id="fd"><input type="file" name="video" accept="video/*"><div class="fd-label">🎬 Videoni tanlang yoki shu yerga tashlang<br><span class="hint">MP4, MOV, WEBM — 500 MB gacha</span></div></div>
          <div class="progress" id="pg"><i></i></div>
          <div class="field" style="margin-top:14px"><label>Izoh (ixtiyoriy)</label><textarea class="input" name="note" maxlength="1000" placeholder="Qaysi vositalardan foydalandingiz?"></textarea></div>
          <button class="btn btn-red btn-block">Yuborish</button>
        </form>
      </div>
    </div>
    ${mine.length ? `<h2 style="font-size:19px;margin:40px 0 16px">Mening ishlarim</h2><div class="works">${mine.map((s) => workCard(s, { showLesson: false, canDelete: true })).join('')}</div>` : ''}
    <h2 style="font-size:19px;margin:40px 0 16px">Boshqa o'quvchilar ishlari <span class="muted" style="font-size:14px">(${others.length})</span></h2>
    ${others.length ? `<div class="works">${others.map((s) => workCard(s, { showLesson: false })).join('')}</div>` : `<div class="card empty">Bu darsga hali boshqa ish yuklanmagan.</div>`}
  </div>`;
  fileDrop($('#fd'));
  bindDelete(page, () => lessonView(page, id).then(initReveal));
  $('#up').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!fd.get('video') || !fd.get('video').size) return toast('Avval videoni tanlang', 'err');
    const btn = $('button', e.target);
    btn.disabled = true;
    $('#pg').style.display = 'block';
    try {
      await uploadXHR(`/api/lessons/${id}/submit`, fd, (p) => { $('#pg i').style.width = p + '%'; btn.textContent = `Yuklanmoqda... ${p}%`; });
      toast('Ishingiz yuborildi! Admin tez orada tekshiradi ✅');
      await lessonView(page, id);
      initReveal();
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Yuborish'; $('#pg').style.display = 'none'; }
  };
}

async function loadMe() {
  const { user } = await api('/api/auth/me');
  if (!user) return (location.href = '/kirish');
  if (user.role !== 'student') return (location.href = '/admin');
  ME = user;
  $('#meName').textContent = user.full_name;
  $('#meAva').textContent = initials(user.full_name);
}

(async () => {
  await loadMe();
  const { settings } = await api('/api/public').catch(() => ({ settings: {} }));
  if (settings.telegramLink) TG = settings.telegramLink;
  $('#buyLink').href = TG;
  const active = ME.status === 'active';
  if (!active) {
    // Tasdiqlanmagan: faqat ariza holati, bot va profil
    LOCKED.forEach((v) => { delete views[v]; $(`.side nav a[data-v="${v}"]`)?.remove(); });
    $('.pending-only').hidden = false;
    $('.side .me small').textContent = ME.status === 'rejected' ? 'Rad etilgan' : 'Ariza kutilmoqda';
  }
  sidebarMobile();
  const go = makeRouter(views, active ? 'darslar' : 'ariza', (v) => $$('.side nav a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === v)));
  go();
})();

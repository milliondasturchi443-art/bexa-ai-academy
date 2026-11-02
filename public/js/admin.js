// Admin panel
let ME = null;
const PLAT = { telegram: 'Telegram', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', boshqa: 'Boshqa' };
const platTag = (p) => `<span class="plat ${esc(p)}">${esc(PLAT[p] || p)}</span>`;
const today = () => new Date().toISOString().slice(0, 10);
const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function projectForm(p = {}) {
  return `<form id="pjf">
    <div class="field"><label>Loyiha nomi</label><input class="input" name="name" required maxlength="100" placeholder="Masalan: Tilla Pay" value="${esc(p.name || '')}"></div>
    <div class="row2">
      <div class="field"><label>Platforma</label><select class="input" name="platform">${Object.entries(PLAT).map(([k, v]) => `<option value="${k}" ${p.platform === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Sahifa / kanal nomi</label><input class="input" name="handle" maxlength="120" placeholder="@admintila" value="${esc(p.handle || '')}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Olingan summa (so'm)</label><input class="input" name="income" inputmode="numeric" placeholder="500 000" value="${p.income != null ? num(p.income) : ''}"></div>
      <div class="field"><label>Sarflangan (so'm)</label><input class="input" name="expense" inputmode="numeric" placeholder="50 000" value="${p.expense != null ? num(p.expense) : ''}"></div>
    </div>
    <div class="card" style="padding:14px 16px;margin-bottom:14px;display:flex;justify-content:space-between;background:var(--bg2)"><span class="muted">Sof foyda:</span><b id="pjNet" class="num">0 so'm</b></div>
    <div class="field"><label>Sana</label><input class="input" type="date" name="project_date" value="${esc(p.project_date || today())}"></div>
    <div class="field"><label>Izoh</label><textarea class="input" name="note" maxlength="1000">${esc(p.note || '')}</textarea></div>
    <button class="btn btn-red btn-block">${p.id ? 'Saqlash' : "Loyihani qo'shish"}</button></form>`;
}

function openProject(p, reload) {
  const m = openModal(p ? 'Loyihani tahrirlash' : 'Yangi loyiha', projectForm(p || {}));
  const f = $('#pjf', m.el);
  const parse = (v) => Number(String(v).replace(/\D/g, '')) || 0;
  const calc = () => {
    const net = parse(f.income.value) - parse(f.expense.value);
    $('#pjNet', m.el).textContent = money(net);
    $('#pjNet', m.el).className = 'num ' + (net >= 0 ? 'pos' : 'neg');
  };
  ['income', 'expense'].forEach((n) => f[n].addEventListener('input', (e) => {
    const v = parse(e.target.value);
    e.target.value = v ? num(v) : '';
    calc();
  }));
  calc();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(f));
    body.income = parse(body.income);
    body.expense = parse(body.expense);
    try {
      await api('/api/admin/projects' + (p ? '/' + p.id : ''), { method: p ? 'PUT' : 'POST', body });
      toast(p ? 'Saqlandi' : "Loyiha qo'shildi");
      m.close();
      reload();
    } catch (err) { toast(err.message, 'err'); }
  };
}

const views = {
  async dashboard(page) {
    const d = await api('/api/admin/stats');
    const profit = d.totals.income - d.totals.expense;
    const mProfit = d.month.income - d.month.expense;
    const max = Math.max(1, ...d.monthly.map((m) => Math.max(m.income, m.expense)));
    page.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>Salom, ${esc(ME.full_name.split(' ')[0])} 👋</h1><p>Akademiya va jamoa ko'rsatkichlari</p></div>
        <button class="btn btn-red" id="addP">+ Yangi loyiha</button></div>
      <div class="stats">
        <div class="card stat hl reveal"><span class="ic">◆</span><small>Jami sof foyda</small><b class="${profit >= 0 ? '' : 'neg'}">${money(profit)}</b><div class="sub">${d.totals.cnt} ta loyiha</div></div>
        <div class="card stat reveal d1"><span class="ic">↗</span><small>Jami tushum</small><b>${money(d.totals.income)}</b><div class="sub">Sarf: ${money(d.totals.expense)}</div></div>
        <div class="card stat reveal d2"><span class="ic">◷</span><small>Shu oy foyda</small><b class="${mProfit >= 0 ? 'pos' : 'neg'}">${money(mProfit)}</b><div class="sub">${d.month.cnt} ta loyiha</div></div>
        <div class="card stat reveal d3"><span class="ic">👥</span><small>Faol o'quvchilar</small><b>${num(d.students)}</b><div class="sub">${d.lessons} ta dars</div></div>
      </div>
      <div class="grid2" style="margin-bottom:14px">
        <div class="card panel reveal"><h3>Oylik natija <span class="legend"><span><i style="background:var(--red)"></i>Tushum</span><span><i style="background:var(--surface3)"></i>Sarf</span></span></h3>
          ${d.monthly.length ? `<div class="bars">${d.monthly.map((m, i) => `<div class="bcol" title="${esc(m.m)}: ${money(m.income)} / ${money(m.expense)}">
            <div class="bwrap"><div class="bar" style="height:${(m.income / max) * 100}%;animation-delay:${i * 0.08}s"></div><div class="bar ex" style="height:${(m.expense / max) * 100}%;animation-delay:${i * 0.08 + 0.04}s"></div></div>
            <small>${MONTHS[+m.m.slice(5) - 1] || m.m}</small></div>`).join('')}</div>` : '<div class="empty">Loyihalar qo\'shilgach grafik paydo bo\'ladi</div>'}
        </div>
        <div class="card panel reveal d1"><h3>Vazifalar</h3>
          <a href="#arizalar" class="card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg2)"><span>✉ Yangi arizalar</span><b class="badge ${d.applications ? 'red' : ''}">${d.applications}</b></a>
          <a href="#tekshiruv" class="card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg2)"><span>✓ Tekshirilmagan ishlar</span><b class="badge ${d.pending ? 'amber' : ''}">${d.pending}</b></a>
          <a href="#yordam" class="card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg2)"><span>✦ Javobsiz xabarlar</span><b class="badge ${d.support ? 'red' : ''}">${d.support}</b></a>
          <a href="#chat" class="card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--bg2)"><span>💬 Adminlar chati</span><span class="muted">→</span></a>
        </div>
      </div>
      ${d.unread_threads.length ? `<div class="card panel reveal" style="margin-bottom:14px;border-color:rgba(240,20,20,.35)"><h3>✦ Bexa AI bot — javob kutayotgan xabarlar <a class="btn btn-sm" href="#yordam">Hammasi →</a></h3>
        ${d.unread_threads.map((t) => `<a href="#yordam/${t.id}" class="thread" style="border:1px solid var(--line);border-radius:12px;margin-bottom:8px">
          <div class="ava" style="${t.user_id ? '' : 'background:var(--surface3)'}">${esc(initials(t.name))}</div>
          <div class="tx"><b><span>${esc(t.name)}</span><small>${fmtTime(t.last_at)}</small></b><p>${esc(t.last_body || '')}</p></div>
          <span class="btn btn-sm btn-red" style="align-self:center">Javob berish</span></a>`).join('')}</div>` : ''}
      <div class="card panel reveal"><h3>Adminlar reytingi — kim qancha topdi</h3>
        <div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Admin</th><th>Loyihalar</th><th>Tushum</th><th>Sarf</th><th>Sof foyda</th></tr></thead><tbody>
        ${d.admins.map((a, i) => `<tr><td><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span></td>
          <td><div style="display:flex;gap:10px;align-items:center"><div class="ava" style="width:32px;height:32px;font-size:12px">${esc(initials(a.full_name))}</div><div><b>${esc(a.full_name)}</b>${a.role === 'owner' ? ' <span class="role-tag">owner</span>' : ''}<div class="muted" style="font-size:12px">@${esc(a.username)}</div></div></div></td>
          <td>${a.cnt}</td><td class="num">${money(a.income)}</td><td class="num muted">${money(a.expense)}</td><td class="num ${a.income - a.expense >= 0 ? 'pos' : 'neg'}">${money(a.income - a.expense)}</td></tr>`).join('')}
        </tbody></table></div></div>
    </div>`;
    $('#addP').onclick = () => openProject(null, () => views.dashboard(page).then(initReveal));
  },

  async loyihalar(page) {
    let mine = false;
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Loyihalar</h1><p>Har bir admin o'z loyihasini qo'shadi — barchasi hammaga ko'rinadi.</p></div>
      <div class="toolbar"><div class="seg" id="seg"><button class="on" data-m="0">Hammasi</button><button data-m="1">Meniki</button></div><button class="btn btn-red" id="addP">+ Yangi loyiha</button></div></div>
      <div id="sum" class="stats" style="grid-template-columns:repeat(3,1fr)"></div><div class="card" id="list"></div></div>`;
    let rows = [];
    const load = async () => {
      rows = (await api('/api/admin/projects' + (mine ? '?mine=1' : ''))).projects;
      const inc = rows.reduce((a, p) => a + p.income, 0);
      const exp = rows.reduce((a, p) => a + p.expense, 0);
      $('#sum').innerHTML = `<div class="card stat"><small>Tushum</small><b>${money(inc)}</b></div><div class="card stat"><small>Sarf</small><b>${money(exp)}</b></div><div class="card stat hl"><small>Sof foyda</small><b class="${inc - exp >= 0 ? 'pos' : 'neg'}">${money(inc - exp)}</b></div>`;
      $('#list').innerHTML = rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Loyiha</th><th>Sahifa</th><th>Admin</th><th>Olindi</th><th>Sarflandi</th><th>Qoldi</th><th>Sana</th><th></th></tr></thead><tbody>
        ${rows.map((p) => {
          const can = p.admin_id === ME.id || ME.role === 'owner';
          return `<tr><td><b>${esc(p.name)}</b>${p.note ? `<div class="muted" style="font-size:12px;max-width:240px">${esc(p.note)}</div>` : ''}</td>
          <td>${platTag(p.platform)} <span style="font-size:13px">${esc(p.handle || '')}</span></td>
          <td>${esc(p.admin_name || "O'chirilgan")}</td>
          <td class="num">${money(p.income)}</td><td class="num muted">${money(p.expense)}</td>
          <td class="num ${p.income - p.expense >= 0 ? 'pos' : 'neg'}">${money(p.income - p.expense)}</td>
          <td class="muted" style="white-space:nowrap">${fmtDate(p.project_date)}</td>
          <td style="white-space:nowrap">${can ? `<button class="icon-btn" data-ed="${p.id}" title="Tahrirlash">✎</button> <button class="icon-btn" data-rm="${p.id}" title="O'chirish">🗑</button>` : ''}</td></tr>`;
        }).join('')}</tbody></table></div>` : `<div class="empty"><b>◆</b>Hali loyiha yo'q. Birinchisini qo'shing!</div>`;
    };
    $$('#seg button').forEach((b) => b.onclick = () => { $$('#seg button').forEach((x) => x.classList.toggle('on', x === b)); mine = b.dataset.m === '1'; load(); });
    $('#addP').onclick = () => openProject(null, load);
    $('#list').onclick = async (e) => {
      const ed = e.target.closest('[data-ed]');
      const rm = e.target.closest('[data-rm]');
      if (ed) openProject(rows.find((p) => p.id == ed.dataset.ed), load);
      if (rm && (await confirmBox("Loyihani o'chirasizmi?"))) {
        try { await api('/api/admin/projects/' + rm.dataset.rm, { method: 'DELETE' }); toast("O'chirildi"); load(); } catch (err) { toast(err.message, 'err'); }
      }
    };
    await load();
  },

  async chat(page, _, ctx) {
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Adminlar chati</h1><p>Faqat adminlar ko'radi</p></div></div><div id="c"></div></div>`;
    ctx.track(mountChat($('#c'), 'admins', ME, 'Adminlar jamoasi', 'Yopiq chat'));
  },
  async ochat(page, _, ctx) {
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>O'quvchilar chati</h1><p>O'quvchilarning umumiy chati — admin sifatida qatnashing</p></div></div><div id="c"></div></div>`;
    ctx.track(mountChat($('#c'), 'students', ME, 'Umumiy chat', "Barcha o'quvchilar"));
  },

  async tekshiruv(page) {
    let status = 'pending';
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Tekshiruv</h1><p>O'quvchilar yuklagan videolarni ko'rib chiqing</p></div>
      <div class="seg" id="seg"><button class="on" data-s="pending">Kutilmoqda</button><button data-s="approved">Qabul qilingan</button><button data-s="rejected">Qaytarilgan</button><button data-s="">Hammasi</button></div></div><div id="list"></div></div>`;
    const load = async () => {
      const { submissions } = await api('/api/submissions' + (status ? '?status=' + status : ''));
      $('#list').innerHTML = submissions.length ? `<div class="works">${submissions.map((s) => `<div class="card work reveal">
        <video src="/uploads/${esc(s.video_file)}" controls preload="metadata" playsinline></video>
        <div class="wb">
          <div class="who"><div class="ava">${esc(initials(s.author))}</div><div><b>${esc(s.author)}</b><small>@${esc(s.author_username)} · ${fmtTime(s.created_at)}</small></div></div>
          <div style="font-size:13px;font-weight:700">📘 ${esc(s.lesson_title || "O'chirilgan dars")}</div>
          <div>${statusBadge(s.status)}</div>
          ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
          <textarea class="input" data-c="${s.id}" placeholder="Izoh yozing..." style="min-height:64px;font-size:13px">${esc(s.admin_comment || '')}</textarea>
          <div class="acts"><button class="btn btn-sm btn-red" data-r="${s.id}" data-st="approved">✓ Qabul</button><button class="btn btn-sm" data-r="${s.id}" data-st="rejected">✕ Qaytarish</button><button class="icon-btn" data-del="${s.id}" title="O'chirish" style="margin-left:auto">🗑</button></div>
        </div></div>`).join('')}</div>` : `<div class="card empty"><b>✓</b>Bu bo'limda ish yo'q</div>`;
      initReveal();
    };
    $$('#seg button').forEach((b) => b.onclick = () => { $$('#seg button').forEach((x) => x.classList.toggle('on', x === b)); status = b.dataset.s; load(); });
    $('#list').onclick = async (e) => {
      const r = e.target.closest('[data-r]');
      const del = e.target.closest('[data-del]');
      try {
        if (r) {
          await api(`/api/admin/submissions/${r.dataset.r}/review`, { method: 'POST', body: { status: r.dataset.st, comment: $(`[data-c="${r.dataset.r}"]`).value } });
          toast(r.dataset.st === 'approved' ? 'Ish qabul qilindi' : 'Ish qaytarildi');
          load(); badges();
        }
        if (del && (await confirmBox("Bu ishni o'chirasizmi?"))) { await api('/api/submissions/' + del.dataset.del, { method: 'DELETE' }); toast("O'chirildi"); load(); badges(); }
      } catch (err) { toast(err.message, 'err'); }
    };
    await load();
  },

  async darslar(page) {
    let rows = [];
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Darslar</h1><p>Video darslarni qo'shing va tartibini boshqaring</p></div><button class="btn btn-red" id="addL">+ Yangi dars</button></div><div class="card" id="list"></div></div>`;
    const load = async () => {
      rows = (await api('/api/lessons')).lessons;
      $('#list').innerHTML = rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Tartib</th><th>Dars</th><th>Video</th><th>Ishlar</th><th></th></tr></thead><tbody>
        ${rows.map((l) => `<tr><td><span class="rank">${l.sort_order}</span></td><td><b>${esc(l.title)}</b><div class="muted" style="font-size:12px;max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.description || '')}</div></td>
          <td>${l.video_file ? '<span class="badge green">Fayl</span>' : l.video_url ? '<span class="badge">Havola</span>' : '<span class="badge red">Yo\'q</span>'}</td><td>${l.sub_count}</td>
          <td style="white-space:nowrap"><button class="icon-btn" data-ed="${l.id}">✎</button> <button class="icon-btn" data-rm="${l.id}">🗑</button></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty"><b>▶</b>Birinchi darsni qo'shing</div>`;
    };
    const open = (l) => {
      const m = openModal(l ? 'Darsni tahrirlash' : 'Yangi dars', `<form id="lf">
        <div class="field"><label>Dars nomi</label><input class="input" name="title" required maxlength="150" value="${esc(l?.title || '')}"></div>
        <div class="field"><label>Tavsif / topshiriq</label><textarea class="input" name="description" style="min-height:120px">${esc(l?.description || '')}</textarea></div>
        <div class="field"><label>Video havolasi (YouTube yoki .mp4)</label><input class="input" name="video_url" placeholder="https://youtube.com/..." value="${esc(l?.video_url || '')}"></div>
        <div class="field"><label>yoki video fayl yuklang</label><div class="file-drop" id="fd"><input type="file" name="video" accept="video/*"><div class="fd-label">${l?.video_file ? '✓ Fayl yuklangan — almashtirish uchun bosing' : '🎬 Video faylni tanlang'}</div></div>
          ${l?.video_file ? `<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px"><input type="checkbox" name="remove_file" value="1"> Yuklangan faylni o'chirish</label>` : ''}<div class="progress" id="pg"><i></i></div></div>
        <div class="field"><label>Tartib raqami</label><input class="input" type="number" min="0" name="sort_order" value="${l?.sort_order ?? rows.length + 1}"></div>
        <button class="btn btn-red btn-block">Saqlash</button></form>`, { wide: true });
      fileDrop($('#fd', m.el));
      $('#lf', m.el).onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        if (fd.get('video') && !fd.get('video').size) fd.delete('video');
        const btn = $('button', e.target);
        btn.disabled = true;
        $('#pg', m.el).style.display = fd.get('video') ? 'block' : 'none';
        try {
          await uploadXHR('/api/admin/lessons' + (l ? '/' + l.id : ''), fd, (p) => { $('#pg i', m.el).style.width = p + '%'; btn.textContent = `Yuklanmoqda ${p}%`; });
          toast('Dars saqlandi'); m.close(); load();
        } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Saqlash'; }
      };
    };
    $('#addL').onclick = () => open(null);
    $('#list').onclick = async (e) => {
      const ed = e.target.closest('[data-ed]');
      const rm = e.target.closest('[data-rm]');
      if (ed) open(rows.find((x) => x.id == ed.dataset.ed));
      if (rm && (await confirmBox("Dars va unga yuklangan barcha ishlar o'chadi. Davom etasizmi?"))) {
        try { await api('/api/admin/lessons/' + rm.dataset.rm, { method: 'DELETE' }); toast("O'chirildi"); load(); } catch (err) { toast(err.message, 'err'); }
      }
    };
    await load();
  },

  async yordam(page, arg, ctx) {
    let current = null;
    let last = 0;
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Bexa AI bot xabarlari</h1><p>O'quvchilar va mehmonlar yozgan xabarlar. Bot avtomatik javob beradi, siz esa davom ettirasiz.</p></div></div>
      <div class="card inbox"><div class="threads" id="th"></div><div class="conv" id="cv"><div class="empty" style="margin:auto"><b>✦</b>Suhbatni tanlang</div></div></div></div>`;
    const loadThreads = async () => {
      const { threads } = await api('/api/admin/support/threads');
      $('#th').innerHTML = threads.length ? threads.map((t) => `<div class="thread ${t.id === current ? 'on' : ''}" data-id="${t.id}">
        <div class="ava" style="${t.user_id ? '' : 'background:var(--surface3)'}">${esc(initials(t.full_name || t.guest_name || 'M'))}</div>
        <div class="tx"><b><span>${esc(t.full_name || t.guest_name || 'Mehmon')}${t.user_id ? '' : ' <span class="muted" style="font-weight:500;font-size:11px">(mehmon)</span>'}</span><small>${fmtTime(t.last_at)}</small></b><p>${esc(t.last_body || '')}</p></div>
        ${t.unread_admin && t.id !== current ? `<span class="cnt">${t.unread_admin}</span>` : ''}</div>`).join('') : '<div class="empty">Xabarlar yo\'q</div>';
    };
    const loadMsgs = async () => {
      if (!current) return;
      const { messages } = await api(`/api/admin/support/threads/${current}?after=${last}`);
      const list = $('#cv .msgs');
      if (messages.length && list) {
        // Admin ko'rinishida: foydalanuvchi chapda, bot/admin o'ngda
        list.insertAdjacentHTML('beforeend', messages.map((m) => {
          if (m.sender === 'user') return `<div class="msg"><div class="bubble">${linkify(m.body)}</div><div class="meta">${fmtTime(m.created_at)}</div></div>`;
          const who = m.sender === 'bot' ? 'Bexa AI bot (avto)' : esc(m.admin_name || 'Admin');
          return `<div class="msg me ${m.sender === 'bot' ? 'bot' : ''}"><div class="meta"><b>${who}</b><span>${fmtTime(m.created_at)}</span></div><div class="bubble" style="${m.sender === 'bot' ? 'background:var(--surface3);color:var(--text)' : ''}">${linkify(m.body)}</div></div>`;
        }).join(''));
        last = messages[messages.length - 1].id;
        list.scrollTop = list.scrollHeight;
      }
    };
    const openThread = async (id) => {
      current = id;
      last = 0;
      $('#cv').innerHTML = `<div class="msgs"></div><form class="compose"><input class="input" maxlength="2000" placeholder="Javob yozing..." autocomplete="off"><button class="btn btn-red">➤</button></form>`;
      $('#cv form').onsubmit = async (ev) => {
        ev.preventDefault();
        const inp = $('#cv form input');
        const body = inp.value.trim();
        if (!body) return;
        inp.value = '';
        try { await api('/api/admin/support/threads/' + current, { method: 'POST', body: { body } }); await loadMsgs(); loadThreads(); }
        catch (err) { toast(err.message, 'err'); inp.value = body; }
      };
      await loadMsgs();
      loadThreads();
      badges();
      setTimeout(() => $('#cv form input')?.focus(), 50);
    };
    $('#th').onclick = (e) => { const t = e.target.closest('.thread'); if (t) openThread(+t.dataset.id); };
    await loadThreads();
    if (arg) openThread(+arg);
    ctx.track(setInterval(() => { loadThreads(); loadMsgs(); }, 4000));
  },

  async arizalar(page) {
    const { students } = await api('/api/admin/students');
    const apps = students.filter((s) => s.status !== 'active');
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Arizalar</h1><p>Kursga ariza qoldirganlar. To'lovni tekshirib, tasdiqlang — o'quvchiga barcha darslar ochiladi.</p></div></div>
      ${apps.length ? `<div class="works" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${apps.map((s) => `<div class="card panel reveal">
        <div class="who" style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><div class="ava">${esc(initials(s.full_name))}</div><div><b>${esc(s.full_name)}</b><div class="muted" style="font-size:12px">@${esc(s.username)} · ${fmtTime(s.created_at)}</div></div>
          <span style="margin-left:auto">${s.status === 'pending' ? '<span class="badge amber">Yangi</span>' : '<span class="badge red">Rad etilgan</span>'}</span></div>
        <div style="display:grid;gap:6px;font-size:14px;margin-bottom:14px">
          ${s.phone ? `<div>📞 <a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></div>` : ''}
          ${s.telegram ? `<div>✈️ <a href="https://t.me/${esc(s.telegram.replace(/^@/, ''))}" target="_blank" rel="noopener" style="color:#38bdf8">${esc(s.telegram)}</a></div>` : ''}
          ${s.app_note ? `<div class="cmt" style="font-size:13px;padding:10px 12px;border-radius:10px;background:var(--bg2);border:1px solid var(--line)">${esc(s.app_note)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px"><button class="btn btn-red btn-sm" data-st="active" data-id="${s.id}">✓ Tasdiqlash</button>${s.status === 'pending' ? `<button class="btn btn-sm" data-st="rejected" data-id="${s.id}">✕ Rad etish</button>` : ''}</div>
      </div>`).join('')}</div>` : `<div class="card empty"><b>✉</b>Yangi arizalar yo'q</div>`}</div>`;
    page.onclick = async (e) => {
      const b = e.target.closest('[data-st]');
      if (!b) return;
      try {
        await api(`/api/admin/students/${b.dataset.id}/status`, { method: 'POST', body: { status: b.dataset.st } });
        toast(b.dataset.st === 'active' ? "Tasdiqlandi — o'quvchiga darslar ochildi" : 'Rad etildi');
        badges(); views.arizalar(page).then(initReveal);
      } catch (err) { toast(err.message, 'err'); }
    };
  },

  async oquvchilar(page) {
    const { students } = await api('/api/admin/students');
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>O'quvchilar</h1><p>Faol: ${students.filter((s) => s.status === 'active').length} · Arizada: ${students.filter((s) => s.status === 'pending').length}</p></div><input class="input" id="q" placeholder="Qidirish..." style="max-width:260px"></div>
      <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>O'quvchi</th><th>Aloqa</th><th>Holat</th><th>Ishlar</th><th>Qabul</th><th>Ro'yxatdan o'tgan</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div></div>`;
    const render = (q = '') => {
      const f = students.filter((s) => (s.full_name + s.username + (s.phone || '')).toLowerCase().includes(q.toLowerCase()));
      $('#tb').innerHTML = f.length ? f.map((s) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><div class="ava" style="width:32px;height:32px;font-size:12px">${esc(initials(s.full_name))}</div><div><b>${esc(s.full_name)}</b><div class="muted" style="font-size:12px">@${esc(s.username)}</div></div></div></td>
        <td style="font-size:13px">${esc(s.phone || '')}${s.telegram ? `<div class="muted">${esc(s.telegram)}</div>` : ''}${!s.phone && !s.telegram ? '—' : ''}</td>
        <td>${s.status === 'active' ? '<span class="badge green">Faol</span>' : s.status === 'pending' ? '<span class="badge amber">Ariza</span>' : '<span class="badge red">Bloklangan</span>'}</td><td>${s.subs}</td><td><span class="badge green">${s.approved}</span></td><td class="muted">${fmtDate(s.created_at)}</td>
        <td style="white-space:nowrap">${s.status === 'active' ? `<button class="btn btn-sm" data-st="rejected" data-id="${s.id}">Bloklash</button>` : `<button class="btn btn-sm btn-red" data-st="active" data-id="${s.id}">Tasdiqlash</button>`} <button class="icon-btn" data-rm="${s.id}" title="O'chirish">🗑</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty">Topilmadi</td></tr>';
    };
    render();
    $('#q').oninput = (e) => render(e.target.value);
    $('#tb').onclick = async (e) => {
      const st = e.target.closest('[data-st]');
      if (st) {
        try { await api(`/api/admin/students/${st.dataset.id}/status`, { method: 'POST', body: { status: st.dataset.st } }); toast('Saqlandi'); badges(); views.oquvchilar(page); }
        catch (err) { toast(err.message, 'err'); }
        return;
      }
      const rm = e.target.closest('[data-rm]');
      if (rm && (await confirmBox("O'quvchi va uning barcha ishlari o'chadi. Davom etasizmi?"))) {
        try { await api('/api/admin/students/' + rm.dataset.rm, { method: 'DELETE' }); toast("O'chirildi"); views.oquvchilar(page); } catch (err) { toast(err.message, 'err'); }
      }
    };
  },

  async sayt(page) {
    const { settings: s } = await api('/api/public');
    const lines = (a) => esc((a || []).join('\n'));
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Sayt sozlamalari</h1><p>Bosh sahifadagi matnlar, narxlar va havolalar</p></div><a class="btn" href="/" target="_blank">Saytni ochish ↗</a></div>
      <form id="sf" style="display:grid;gap:14px;max-width:900px">
        <div class="card panel"><h3>Narxlar</h3>
          <div class="row2"><div class="field"><label>Asosiy kurs — eski narx (so'm)</label><input class="input" type="number" min="0" name="oldPrice" value="${s.oldPrice}"></div>
          <div class="field"><label>Asosiy kurs — hozirgi narx (so'm)</label><input class="input" type="number" min="0" name="price" value="${s.price}"></div></div>
          <div class="row2"><div class="field"><label>Asosiy kurs nomi</label><input class="input" name="courseTitle" value="${esc(s.courseTitle)}"></div>
          <div class="field"><label>Katta kurs narxi (so'm)</label><input class="input" type="number" min="0" name="adminCoursePrice" value="${s.adminCoursePrice}"></div></div>
          <div class="field"><label>Katta kurs nomi</label><input class="input" name="adminCourseTitle" value="${esc(s.adminCourseTitle)}"></div>
        </div>
        <div class="card panel"><h3>Havolalar</h3>
          <div class="field"><label>Telegram (sotib olish tugmasi shu yerga olib boradi)</label><input class="input" name="telegramLink" value="${esc(s.telegramLink)}"></div>
          <div class="field"><label>Instagram</label><input class="input" name="instagramLink" placeholder="https://instagram.com/..." value="${esc(s.instagramLink)}"></div>
        </div>
        <div class="card panel"><h3>Bosh sahifa matnlari</h3>
          <div class="field"><label>Yuqoridagi belgi</label><input class="input" name="heroBadge" value="${esc(s.heroBadge)}"></div>
          <div class="field"><label>Sarlavha</label><input class="input" name="heroTitle" value="${esc(s.heroTitle)}"></div>
          <div class="field"><label>Qisqa tavsif</label><textarea class="input" name="heroSubtitle">${esc(s.heroSubtitle)}</textarea></div>
          <div class="field"><label>Pastki yozuv (footer)</label><input class="input" name="footerText" value="${esc(s.footerText)}"></div>
        </div>
        <div class="card panel"><h3>Kurs imkoniyatlari</h3>
          <div class="row2"><div class="field"><label>Asosiy kurs (har qatorda bittadan)</label><textarea class="input" name="courseFeatures" style="min-height:170px">${lines(s.courseFeatures)}</textarea></div>
          <div class="field"><label>Katta kurs (har qatorda bittadan)</label><textarea class="input" name="adminCourseFeatures" style="min-height:170px">${lines(s.adminCourseFeatures)}</textarea></div></div>
        </div>
        <div><button class="btn btn-red btn-lg">O'zgarishlarni saqlash</button></div>
      </form></div>`;
    $('#sf').onsubmit = async (e) => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.target));
      b.courseFeatures = b.courseFeatures.split('\n').map((x) => x.trim()).filter(Boolean);
      b.adminCourseFeatures = b.adminCourseFeatures.split('\n').map((x) => x.trim()).filter(Boolean);
      try { await api('/api/admin/settings', { method: 'PUT', body: b }); toast('Sayt yangilandi ✅'); } catch (err) { toast(err.message, 'err'); }
    };
  },

  async adminlar(page) {
    if (ME.role !== 'owner') return (location.hash = '#dashboard');
    const { admins } = await api('/api/admin/admins');
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Adminlar</h1><p>Faqat owner ko'radi: yangi admin qo'shish, parol berish va o'chirish</p></div><button class="btn btn-red" id="addA">+ Yangi admin</button></div>
      <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Admin</th><th>Login</th><th>Rol</th><th>Qo'shilgan</th><th></th></tr></thead><tbody>
      ${admins.map((a) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><div class="ava" style="width:32px;height:32px;font-size:12px">${esc(initials(a.full_name))}</div><b>${esc(a.full_name)}</b></div></td>
        <td>@${esc(a.username)}</td><td>${a.role === 'owner' ? '<span class="badge red">♛ Owner</span>' : '<span class="badge">Admin</span>'}</td><td class="muted">${fmtDate(a.created_at)}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm" data-pw="${a.id}" data-n="${esc(a.full_name)}">Parol / ism</button> ${a.role !== 'owner' ? `<button class="icon-btn" data-rm="${a.id}" title="Adminlikdan olish">🗑</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div></div>`;
    const reload = () => views.adminlar(page);
    $('#addA').onclick = () => {
      const m = openModal('Yangi admin', `<form id="af">
        <div class="field"><label>Ism</label><input class="input" name="full_name" required></div>
        <div class="field"><label>Login</label><input class="input" name="username" required pattern="[a-zA-Z0-9_.]{3,30}"><span class="hint">Agar bu login o'quvchiga tegishli bo'lsa, u admin qilinadi</span></div>
        <div class="field"><label>Parol</label><input class="input" name="password" required minlength="6"></div>
        <button class="btn btn-red btn-block">Admin qo'shish</button></form>`);
      $('#af', m.el).onsubmit = async (e) => {
        e.preventDefault();
        try { const d = await api('/api/admin/admins', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast(d.promoted ? "O'quvchi admin qilindi" : "Admin qo'shildi"); m.close(); reload(); }
        catch (err) { toast(err.message, 'err'); }
      };
    };
    page.querySelector('tbody').onclick = async (e) => {
      const pw = e.target.closest('[data-pw]');
      const rm = e.target.closest('[data-rm]');
      if (pw) {
        const m = openModal('Adminni tahrirlash', `<form id="ef">
          <div class="field"><label>Ism</label><input class="input" name="full_name" value="${pw.dataset.n}"></div>
          <div class="field"><label>Yangi parol</label><input class="input" name="password" minlength="6" placeholder="O'zgartirmaslik uchun bo'sh qoldiring"></div>
          <button class="btn btn-red btn-block">Saqlash</button></form>`);
        $('#ef', m.el).onsubmit = async (ev) => {
          ev.preventDefault();
          try { await api('/api/admin/admins/' + pw.dataset.pw, { method: 'PUT', body: Object.fromEntries(new FormData(ev.target)) }); toast('Saqlandi'); m.close(); reload(); }
          catch (err) { toast(err.message, 'err'); }
        };
      }
      if (rm && (await confirmBox("Bu foydalanuvchi adminlikdan olinadi (loyihalari saqlanib qoladi).", 'Ha, olish'))) {
        try { await api('/api/admin/admins/' + rm.dataset.rm, { method: 'DELETE' }); toast('Adminlikdan olindi'); reload(); } catch (err) { toast(err.message, 'err'); }
      }
    };
  },

  async profil(page) {
    page.innerHTML = `<div class="page"><div class="page-head"><div><h1>Profil</h1><p>@${esc(ME.username)} · ${ME.role === 'owner' ? 'Owner' : 'Admin'}</p></div></div>
      <div class="card panel" style="max-width:520px;margin-bottom:14px"><h3>Ma'lumotlar</h3><form id="pf">
        <div class="field"><label>Ism</label><input class="input" name="full_name" value="${esc(ME.full_name)}" required></div>
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

let lastSeen = null;
function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.4);
    o.start(); o.stop(a.currentTime + 0.4);
  } catch (_) {}
}
async function badges() {
  try {
    const b = await api('/api/admin/badges');
    const set = (id, n) => { const el = $(id); el.hidden = !n; el.textContent = n; };
    set('#bPending', b.pending);
    set('#bSupport', b.support);
    set('#bApps', b.applications);
    const total = b.support + b.applications;
    document.title = (total ? `(${total}) ` : '') + 'Admin panel — Bexa AI Academy';
    // Yangi bot xabari kelsa — ovoz va bildirishnoma
    if (lastSeen !== null && b.last_support > lastSeen) {
      beep();
      toast('✦ Bexa AI botga yangi xabar keldi');
    }
    lastSeen = b.last_support;
  } catch (_) {}
}

async function loadMe() {
  const { user } = await api('/api/auth/me');
  if (!user) return (location.href = '/kirish');
  if (user.role === 'student') return (location.href = '/kabinet');
  ME = user;
  $('#meName').textContent = user.full_name;
  $('#meAva').textContent = initials(user.full_name);
  $('#meRole').textContent = user.role === 'owner' ? 'Owner' : 'Admin';
  $('#ownerLink').hidden = user.role !== 'owner';
}

(async () => {
  await loadMe();
  sidebarMobile();
  const go = makeRouter(views, 'dashboard', (v) => $$('.side nav a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === v)));
  go();
  badges();
  setInterval(badges, 6000);
})();

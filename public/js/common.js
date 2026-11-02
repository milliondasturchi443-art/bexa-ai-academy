// Umumiy yordamchi funksiyalar
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function api(url, opts = {}) {
  const o = { credentials: 'same-origin', ...opts };
  if (o.body && !(o.body instanceof FormData)) {
    o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) };
    o.body = JSON.stringify(o.body);
  }
  const r = await fetch(url, o);
  let d = {};
  try { d = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error(d.error || 'Xatolik yuz berdi');
  return d;
}

function uploadXHR(url, fd, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText); } catch (_) {}
      x.status < 300 ? resolve(d) : reject(new Error(d.error || 'Yuklashda xatolik'));
    };
    x.onerror = () => reject(new Error('Tarmoq xatosi'));
    x.send(fd);
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const money = (n) => num(n) + " so'm";
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function parseDate(s) {
  if (!s) return null;
  return new Date(s.length <= 10 ? s + 'T00:00:00' : s.replace(' ', 'T') + 'Z');
}
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(s) {
  const d = parseDate(s);
  if (!d) return '';
  const now = new Date();
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return t;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${t}`;
}
function fmtDate(s) {
  const d = parseDate(s);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : '';
}
// Matndagi havolalarni bosiladigan qilish
const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="text-decoration:underline">$1</a>');

function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
}

function openModal(title, html, { wide } = {}) {
  const m = document.createElement('div');
  m.className = 'modal-back';
  m.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><div class="modal-head"><h3>${esc(title)}</h3>
    <button class="icon-btn" data-close aria-label="Yopish">✕</button></div><div class="modal-body">${html}</div></div>`;
  document.body.appendChild(m);
  requestAnimationFrame(() => m.classList.add('open'));
  const close = () => { m.classList.remove('open'); setTimeout(() => m.remove(), 250); };
  m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
  m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  return { el: m, close };
}

function confirmBox(text, okLabel = "Ha, o'chirish") {
  return new Promise((res) => {
    const m = openModal('Tasdiqlang', `<p class="muted" style="margin-bottom:20px">${esc(text)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" data-close>Bekor qilish</button><button class="btn btn-red" id="cfOk">${esc(okLabel)}</button></div>`);
    $('#cfOk', m.el).onclick = () => { m.close(); res(true); };
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) res(false); });
  });
}

function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  $$('.reveal:not(.in)').forEach((el) => io.observe(el));
}

function videoEmbed(url) {
  if (!url) return '';
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `<iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen allow="accelerometer; autoplay; encrypted-media; picture-in-picture"></iframe>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video src="${esc(url)}" controls playsinline></video>`;
  return '';
}

const statusBadge = (s) =>
  ({ pending: '<span class="badge amber"><span class="dot"></span>Tekshirilmoqda</span>',
     approved: '<span class="badge green">✓ Qabul qilindi</span>',
     rejected: '<span class="badge red">✕ Qayta ishlang</span>' }[s] || '');

// ---- Guruh chati (o'quvchilar yoki adminlar) ----
function mountChat(root, room, me, title, subtitle) {
  root.innerHTML = `<div class="card chat-card">
    <div class="chat-head"><div class="ava">${room === 'admins' ? 'A' : 'O'}</div><div><b>${esc(title)}</b><div class="muted" style="font-size:12px">${esc(subtitle || '')}</div></div></div>
    <div class="msgs"><div class="empty"><b>💬</b>Hozircha xabar yo'q. Birinchi bo'lib yozing!</div></div>
    <form class="compose"><input class="input" maxlength="2000" placeholder="Xabar yozing..." autocomplete="off"><button class="btn btn-red" aria-label="Yuborish">➤</button></form></div>`;
  const list = $('.msgs', root);
  let last = 0;
  let busy = false;
  async function load() {
    if (busy) return;
    busy = true;
    try {
      const d = await api(`/api/chat/${room}?after=${last}`);
      if (d.messages.length) {
        const nearBottom = last === 0 || list.scrollHeight - list.scrollTop - list.clientHeight < 120;
        $('.empty', list)?.remove();
        list.insertAdjacentHTML('beforeend', d.messages.map((m) => {
          const mine = m.user_id === me.id;
          const tag = m.role === 'owner' ? '<span class="role-tag">owner</span>' : m.role === 'admin' ? '<span class="role-tag">admin</span>' : '';
          return `<div class="msg ${mine ? 'me' : ''}"><div class="meta">${mine ? '' : `<b>${esc(m.full_name)}</b>${tag}`}<span>${fmtTime(m.created_at)}</span></div><div class="bubble">${linkify(m.body)}</div></div>`;
        }).join(''));
        last = d.messages[d.messages.length - 1].id;
        if (nearBottom) list.scrollTop = list.scrollHeight;
      }
    } catch (_) {} finally { busy = false; }
  }
  $('form', root).onsubmit = async (e) => {
    e.preventDefault();
    const inp = $('input', root);
    const body = inp.value.trim();
    if (!body) return;
    inp.value = '';
    try { await api(`/api/chat/${room}`, { method: 'POST', body: { body } }); await load(); list.scrollTop = list.scrollHeight; }
    catch (err) { toast(err.message, 'err'); inp.value = body; }
  };
  load();
  return setInterval(load, 3000);
}

// ---- Yordam xabarlarini chizish ----
function supportMsgHTML(m) {
  if (m.sender === 'user') return `<div class="msg me"><div class="bubble">${linkify(m.body)}</div><div class="meta">${fmtTime(m.created_at)}</div></div>`;
  if (m.sender === 'bot') return `<div class="msg bot"><div class="meta"><b>Bexa AI bot</b><span>${fmtTime(m.created_at)}</span></div><div class="bubble">${linkify(m.body)}</div></div>`;
  return `<div class="msg adm"><div class="meta"><b>${esc(m.admin_name || 'Admin')}</b><span class="role-tag">admin</span><span>${fmtTime(m.created_at)}</span></div><div class="bubble">${linkify(m.body)}</div></div>`;
}
const WELCOME = `<div class="msg bot"><div class="meta"><b>Bexa AI bot</b></div><div class="bubble">Assalomu alaykum! 👋 Men Bexa AI botiman. Savolingizni yozing — kurs narxi, darslar yoki adminlar safiga qo'shilish haqida. Admin ham tez orada javob beradi.</div></div>`;

function guestKey() {
  let k = localStorage.getItem('bx_guest');
  if (!k) {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    k = [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('bx_guest', k);
  }
  return k;
}

// Bexa AI bot — o'quvchi yoki mehmon uchun yordam chati
function mountSupport(container, user) {
  container.innerHTML = `${user ? '' : `<div style="padding:12px 12px 0"><input class="input" id="gName" maxlength="60" placeholder="Ismingiz (ixtiyoriy)" value="${esc(localStorage.getItem('bx_guest_name') || '')}"></div>`}
    <div class="msgs">${WELCOME}</div>
    <form class="compose"><input class="input" maxlength="2000" placeholder="Savolingizni yozing..." autocomplete="off"><button class="btn btn-red" aria-label="Yuborish">➤</button></form>`;
  const list = $('.msgs', container);
  let last = 0;
  const q = () => (user ? '' : `guest_key=${guestKey()}&`);
  async function load() {
    try {
      const d = await api(`/api/support?${q()}after=${last}`);
      if (d.messages.length) {
        list.insertAdjacentHTML('beforeend', d.messages.map(supportMsgHTML).join(''));
        last = d.messages[d.messages.length - 1].id;
        list.scrollTop = list.scrollHeight;
      }
    } catch (_) {}
  }
  $('form', container).onsubmit = async (e) => {
    e.preventDefault();
    const inp = $('form input', container);
    const body = inp.value.trim();
    if (!body) return;
    inp.value = '';
    const payload = { body };
    if (!user) {
      payload.guest_key = guestKey();
      const nm = $('#gName', container)?.value.trim();
      if (nm) { payload.guest_name = nm; localStorage.setItem('bx_guest_name', nm); }
    }
    try { await api('/api/support', { method: 'POST', body: payload }); await load(); }
    catch (err) { toast(err.message, 'err'); inp.value = body; }
  };
  load();
  return { load };
}

// Suzuvchi bot tugmasi (bosh sahifa uchun)
function botWidget(user) {
  const fab = document.createElement('button');
  fab.className = 'bot-fab';
  fab.innerHTML = '<span class="av">AI</span><span class="lbl">Bexa AI bot</span>';
  const panel = document.createElement('div');
  panel.className = 'bot-panel';
  panel.innerHTML = `<div class="bot-head"><div class="av">AI</div><div><b>Bexa AI bot</b><small><span class="dot"></span>Onlayn</small></div><button class="icon-btn" aria-label="Yopish">✕</button></div><div class="bot-body" style="display:flex;flex-direction:column;flex:1;min-height:0"></div>`;
  document.body.append(fab, panel);
  let sup = null;
  let iv = null;
  const toggle = (open) => {
    panel.classList.toggle('open', open);
    if (open) {
      if (!sup) sup = mountSupport($('.bot-body', panel), user);
      else sup.load();
      iv = setInterval(() => sup.load(), 4000);
      setTimeout(() => $('form input', panel)?.focus(), 300);
    } else clearInterval(iv);
  };
  fab.onclick = () => toggle(!panel.classList.contains('open'));
  $('.bot-head .icon-btn', panel).onclick = () => toggle(false);
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/';
}

// Kabinet/admin uchun oddiy hash-router
function makeRouter(views, fallback, onRoute) {
  let timers = [];
  const ctx = { track: (id) => (timers.push(id), id) };
  async function go() {
    timers.forEach(clearInterval);
    timers = [];
    const [name, arg] = (location.hash.slice(1) || fallback).split('/');
    const view = views[name] ? name : fallback;
    onRoute && onRoute(view);
    const page = $('#page');
    page.innerHTML = '<div class="page"><div class="empty">Yuklanmoqda...</div></div>';
    try { await views[view](page, arg, ctx); }
    catch (err) { page.innerHTML = `<div class="page"><div class="empty"><b>⚠️</b>${esc(err.message)}</div></div>`; }
    initReveal();
  }
  window.addEventListener('hashchange', go);
  return go;
}

function sidebarMobile() {
  const side = $('.side');
  $('#menuBtn')?.addEventListener('click', () => side.classList.toggle('open'));
  side?.addEventListener('click', (e) => { if (e.target.closest('nav a')) side.classList.remove('open'); });
}

function changePasswordForm(root) {
  root.insertAdjacentHTML('beforeend', `<div class="card panel" style="max-width:520px">
    <h3>Parolni o'zgartirish</h3>
    <form id="pwForm">
      <div class="field"><label>Joriy parol</label><input class="input" type="password" name="old_password" required></div>
      <div class="field"><label>Yangi parol</label><input class="input" type="password" name="new_password" minlength="6" required></div>
      <button class="btn btn-red">Saqlash</button>
    </form></div>`);
  $('#pwForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await api('/api/auth/password', { method: 'POST', body: f }); toast("Parol o'zgartirildi"); e.target.reset(); }
    catch (err) { toast(err.message, 'err'); }
  };
}

function fileDrop(el) {
  const input = $('input[type=file]', el);
  const label = $('.fd-label', el);
  el.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) label.textContent = `🎬 ${input.files[0].name} (${(input.files[0].size / 1048576).toFixed(1)} MB)`; });
  ['dragover', 'dragenter'].forEach((ev) => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => el.addEventListener(ev, () => el.classList.remove('drag')));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); }
  });
}

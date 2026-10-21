const slug = qs('e') || '';
let info = null;          // data acara dari server
let currentFilter = 'asli';
let facing = 'environment';
let stream = null;
let shotsLeft = 0;
let sending = false;
let pendingCount = 0;

const screens = ['s-info', 's-join', 's-cam'];
const show = (id) => screens.forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
function infoScreen(title, text, actions = '') {
  stopCamera();
  $('#info-title').textContent = title;
  $('#info-text').textContent = text;
  $('#info-actions').innerHTML = actions;
  show('s-info');
}

async function init() {
  if (!configured()) return infoScreen('Belum dikonfigurasi', 'Admin perlu mengisi js/config.js terlebih dahulu.');
  if (!slug) return infoScreen('Link tidak lengkap', 'Scan ulang QR acara dari panitia.');
  try { info = await api('getEvent', { slug, pt: PT.get(slug) }); }
  catch (err) {
    return infoScreen(err.code === 'not_found' ? 'Acara tidak ditemukan' : 'Gagal memuat acara', err.message,
      err.retry ? '<button class="btn block" onclick="location.reload()">Coba lagi</button>' : '');
  }
  if (info.pt) PT.set(slug, info.pt);

  const { event: e, state, joined } = info;
  document.title = e.name;
  $$('.ev-name').forEach((el) => (el.textContent = e.name));
  const manageLink = info.canManage ? '<a class="btn ghost block" href="./">Kelola acara</a>' : '';
  const albumBtn = `<a class="btn block" href="album.html?e=${encodeURIComponent(slug)}">Lihat album</a>`;

  if (!joined) {
    if (e.status !== 'aktif') return infoScreen(e.name, 'Acara ini masih menunggu persetujuan admin prodi.', manageLink);
    // Akun kampus tanpa kode akses: langsung gabung.
    if (info.user && (!e.needsCode || info.canManage)) return doJoin({});
    return showJoin();
  }

  if (!state.active) return infoScreen(e.name, e.status === 'arsip' ? 'Acara ini sudah diarsipkan.' : 'Acara ini masih menunggu persetujuan admin prodi.', manageLink);
  if (state.phase === 'belum') return infoScreen(e.name, `Kamera dibuka ${fmtDate(e.start)}. Simpan link ini dan buka lagi saat acara dimulai.`, manageLink);
  if (state.phase === 'selesai') {
    sendQueue(); // kirim sisa foto yang tertunda
    const t = state.revealed ? 'Acara sudah selesai. Semua foto sudah bisa dilihat.'
      : `Acara sudah selesai. Album dibuka ${e.revealAt ? fmtDate(e.revealAt) : 'sebentar lagi'}.`;
    return infoScreen(e.name, t, (state.revealed ? albumBtn : '') + manageLink);
  }

  shotsLeft = info.shotsLeft;
  currentFilter = e.filter in FILTERS ? e.filter : 'asli';
  $('#album-link').href = `album.html?e=${encodeURIComponent(slug)}`;
  $('#album-link').classList.toggle('hidden', !(state.revealed || info.canManage));
  $('#vf').classList.toggle('square', e.frame === 'polaroid');
  renderFilters();
  show('s-cam');
  startCamera();
  document.fonts?.load('600 40px Caveat').catch(() => {});
  await refreshPending();
  updateCounter();
  sendQueue();
  const msLeft = new Date(e.end) - Date.now();
  if (msLeft > 0 && msLeft < 2 ** 31) setTimeout(() => init(), msLeft + 1500);
}

function showJoin() {
  const e = info.event;
  $('#join-desc').textContent = `${fmtDate(e.start)} – ${fmtTime(e.end)}${e.description ? '. ' + e.description : ''}`;
  const loggedIn = !!info.user;
  $('#login-box').classList.toggle('hidden', loggedIn);
  if (!loggedIn && !$('#g-btn').childElementCount) {
    GoogleLogin.render($('#g-btn'), {
      theme: 'filled_black',
      onDone: () => { showMsg($('#join-msg'), ''); init(); },
      onError: (e) => showMsg($('#join-msg'), e.message),
    });
  }
  $('#or').classList.toggle('hidden', !e.guests);
  $('#guest-fields').classList.toggle('hidden', loggedIn || !e.guests);
  $('#code-fields').classList.toggle('hidden', !e.needsCode);
  const canSubmit = loggedIn || e.guests;
  $('#join-form').classList.toggle('hidden', !canSubmit);
  $('#btn-join').textContent = loggedIn ? `Gabung sebagai ${info.user.name}` : 'Lanjut sebagai tamu';
  $('#btn-join').classList.toggle('ghost', !loggedIn);
  if (!e.guests && !loggedIn) showMsg($('#join-msg'), 'Acara ini khusus akun kampus.');
  show('s-join');
}

async function doJoin(body) {
  try {
    const r = await api('join', { slug, ...body });
    PT.set(slug, r.pt);
    showMsg($('#join-msg'), '');
    init();
  } catch (err) {
    if ($('#s-join').classList.contains('hidden')) showJoin();
    showMsg($('#join-msg'), err.message);
  }
}

$('#join-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const body = { code: $('#code').value.trim() };
  if (!info.user) {
    body.name = $('#guest-name').value.trim();
    if (body.name.length < 2) return showMsg($('#join-msg'), 'Tulis nama kamu (minimal 2 huruf).');
  }
  if (info.event.needsCode && !body.code) return showMsg($('#join-msg'), 'Masukkan kode akses dari panitia.');
  doJoin(body);
});

/* ---------- Kamera ---------- */
async function startCamera() {
  stopCamera();
  if (!navigator.mediaDevices?.getUserMedia) {
    return infoScreen('Kamera tidak tersedia', 'Buka link ini lewat Chrome (Android) atau Safari (iPhone), dan pastikan alamatnya diawali https://.');
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false,
    });
    const v = $('#video');
    v.srcObject = stream;
    await v.play().catch(() => {});
    $('#vf').classList.toggle('mirror', facing === 'user');
  } catch (err) {
    infoScreen('Kamera belum bisa dibuka',
      err.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Buka pengaturan situs di browser, izinkan kamera, lalu muat ulang halaman ini.'
        : 'Kamera sedang dipakai aplikasi lain atau tidak ditemukan. Tutup aplikasi kamera lain, lalu coba lagi.',
      '<button class="btn block" onclick="location.reload()">Coba lagi</button>');
  }
}
function stopCamera() { stream?.getTracks().forEach((t) => t.stop()); stream = null; }

$('#flip').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera();
  else if (!$('#s-cam').classList.contains('hidden')) { startCamera(); sendQueue(); }
});
window.addEventListener('online', () => sendQueue());

function renderFilters() {
  $('#filters').innerHTML = Object.entries(FILTERS).map(([k, f]) =>
    `<button type="button" data-f="${k}" aria-pressed="${k === currentFilter}">${f.label}<small>${f.mood}</small></button>`).join('');
  $('#video').style.filter = FILTERS[currentFilter].css;
  requestAnimationFrame(() => $('#filters [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  currentFilter = b.dataset.f;
  $$('#filters button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  $('#video').style.filter = FILTERS[currentFilter].css;
});

function updateCounter() {
  const left = Math.max(0, shotsLeft - pendingCount);
  $('#shots').textContent = left;
  $('#shutter').disabled = left <= 0;
  $('#shutter').setAttribute('aria-label', left <= 0 ? 'Jatah foto habis' : 'Ambil foto');
}

/* ---------- Ambil foto ---------- */
$('#shutter').addEventListener('click', async () => {
  const v = $('#video');
  if (!stream || !v.videoWidth || shotsLeft - pendingCount <= 0) return;
  $('#shutter').disabled = true;
  const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  navigator.vibrate?.(30);
  try {
    const takenAt = Date.now();
    const full = await renderPhoto(v, takenAt);
    const thumb = await makeThumb(full);
    await Queue.add({ id: crypto.randomUUID ? crypto.randomUUID() : String(takenAt) + Math.random(), slug, filter: currentFilter, takenAt, image: full.data, thumb });
    await refreshPending();
    updateCounter();
    sendQueue();
  } catch (err) {
    console.error(err);
    toast('Foto gagal diproses. Coba lagi.');
  } finally {
    updateCounter();
  }
});

/** Frame video → potong → filter → bingkai → JPEG (data URL). */
async function renderPhoto(v, takenAt) {
  const e = info.event;
  const polaroid = e.frame === 'polaroid';
  const vw = v.videoWidth, vh = v.videoHeight;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (polaroid) { const s = Math.min(vw, vh); sx = (vw - s) / 2; sy = (vh - s) / 2; sw = sh = s; }
  const scale = Math.min(1, (polaroid ? 1600 : 2048) / Math.max(sw, sh));
  const pw = Math.round(sw * scale), ph = Math.round(sh * scale);

  const work = document.createElement('canvas');
  work.width = pw; work.height = ph;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (facing === 'user') { wctx.translate(pw, 0); wctx.scale(-1, 1); }
  wctx.drawImage(v, sx, sy, sw, sh, 0, 0, pw, ph);
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  applyFilter(wctx, pw, ph, currentFilter);
  if (!polaroid) return { canvas: work, data: work.toDataURL('image/jpeg', 0.86) };

  const side = Math.round(pw * 0.06), bottom = Math.round(pw * 0.24);
  const out = $('#canvas');
  out.width = pw + side * 2; out.height = ph + side + bottom;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#FBFBF8'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(work, side, side);
  ctx.fillStyle = '#2B2B2B'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(pw * 0.07)}px Caveat, cursive`;
  let title = e.name;
  while (title.length > 3 && ctx.measureText(title).width > pw) title = title.slice(0, -2) + '…';
  ctx.fillText(title, side, ph + side + bottom * 0.42);
  ctx.font = `600 ${Math.round(pw * 0.038)}px Caveat, cursive`;
  ctx.fillStyle = '#6A6A6A';
  const stamp = new Date(takenAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(`${stamp} · ${info.me ? info.me.name : ''}`, side, ph + side + bottom * 0.72);
  return { canvas: out, data: out.toDataURL('image/jpeg', 0.86) };
}

async function makeThumb(full) {
  const src = full.canvas;
  const k = Math.min(1, 480 / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.74);
}

/* ---------- Kirim antrean (coba ulang otomatis) ---------- */
async function refreshPending() { pendingCount = (await Queue.list(slug)).length; updateQueueNote(); }

async function sendQueue() {
  if (sending) return;
  sending = true;
  let delay = 4000;
  try {
    for (;;) {
      const items = await Queue.list(slug);
      pendingCount = items.length; updateQueueNote(); updateCounter();
      if (!items.length) break;
      const it = items[0];
      try {
        const r = await api('upload', { slug, pt: PT.get(slug), image: it.image, thumb: it.thumb, filter: it.filter, takenAt: it.takenAt });
        await Queue.remove(it.id);
        shotsLeft = r.shotsLeft;
        delay = 4000;
        toast('Foto tersimpan di album');
      } catch (err) {
        if (err.retry) {
          updateQueueNote(true);
          await new Promise((res) => setTimeout(res, delay));
          delay = Math.min(delay * 2, 60000);
          continue;
        }
        // Ditolak server (jatah habis, acara selesai, dll.): tidak dicoba ulang.
        await Queue.remove(it.id);
        toast(err.message, 4000);
        if (err.code === 'quota') shotsLeft = 0;
        if (err.code === 'need_join') { PT.clear(slug); }
      }
    }
  } finally {
    sending = false;
    updateQueueNote(); updateCounter();
  }
}

function updateQueueNote(waiting = false) {
  const n = pendingCount;
  $('#queue-note').textContent = !n ? '' : waiting
    ? `Sinyal lemah atau server sibuk. ${n} foto menunggu dikirim ulang otomatis.`
    : `Mengirim ${n} foto…`;
}

init();

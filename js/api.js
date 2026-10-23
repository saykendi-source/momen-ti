// Komunikasi dengan backend Apps Script + penyimpanan token login & token peserta.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

function decodeTokenPayload(t) {
  try {
    let s = t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  } catch { return null; }
}

// Sesi admin (token dari server setelah kata sandi benar).
const Auth = {
  KEY: 'momen.admin',
  get() {
    const t = store.get(this.KEY);
    if (!t) return null;
    const p = decodeTokenPayload(t);
    if (!p || (p.x && Date.now() > p.x)) { store.del(this.KEY); return null; }
    return t;
  },
  set(t) { store.set(this.KEY, t); },
  logout() { store.del(this.KEY); },
};

// Token peserta per acara (tanda sudah bergabung).
const PT = {
  get: (slug) => store.get('momen.pt.' + slug),
  set: (slug, t) => t && store.set('momen.pt.' + slug, t),
  clear: (slug) => store.del('momen.pt.' + slug),
};

// Aksi yang aman diulang otomatis (hanya membaca data).
const SAFE_RETRY = ['me', 'getEvent', 'album', 'thumbs', 'photo', 'comments', 'listEvents', 'getManage', 'modList', 'modComments', 'boothInfo', 'wall', 'sharedPhoto'];

// Jelaskan balasan yang bukan JSON (biasanya halaman error dari Google).
function explainBadResponse(status, text) {
  const t = String(text || '');
  const title = (t.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  if (/authoriz/i.test(t)) return 'Apps Script perlu izin ulang. Admin: jalankan fungsi setup di editor, lalu Deploy → Manage deployments → New version.';
  if (/not found|tidak ditemukan|404/i.test(title) || status === 404) return 'Alamat API tidak ditemukan. Admin: periksa API_URL di js/config.js.';
  if (/too many|terlalu banyak|quota|kuota/i.test(t)) return 'Server Google sedang membatasi permintaan (kuota). Coba lagi beberapa saat lagi.';
  if (/sign in|login|masuk/i.test(title)) return 'API meminta login Google. Admin: pastikan deployment memakai akses "Anyone".';
  const detail = (title || t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 120);
  return 'Server mengirim balasan yang tidak dikenal' + (detail ? ` (“${detail}”)` : '') + '. Coba lagi.';
}

async function apiOnce(action, payload, timeoutMs) {
  const ctrl = 'AbortController' in window ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
  let res, text;
  try {
    // Dikirim sebagai text/plain agar tidak memicu preflight CORS, dan balasan JSON tetap bisa dibaca.
    res = await fetch(MOMEN.API_URL, {
      method: 'POST', signal: ctrl?.signal,
      body: JSON.stringify({ action, auth: Auth.get(), ...payload }),
    });
    text = await res.text();
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    const e = new Error(timedOut ? 'Server lambat menjawab. Mencoba lagi…' : 'Tidak bisa terhubung ke server. Periksa koneksi internet.');
    e.retry = true; e.code = timedOut ? 'timeout' : 'network'; throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  let data;
  try { data = JSON.parse(text); } catch {
    const e = new Error(explainBadResponse(res.status, text));
    e.retry = true; e.code = 'bad_response'; e.raw = String(text || '').slice(0, 500);
    console.warn('Balasan bukan JSON dari API:', res.status, e.raw);
    throw e;
  }
  if (!data.ok) {
    const e = new Error(data.error || 'Permintaan gagal.');
    e.code = data.code; e.retry = !!data.retry; e.resetAt = data.resetAt || null;
    if (data.code === 'need_login') Auth.logout();
    throw e;
  }
  return data;
}

/**
 * Panggil API. Aksi baca diulang otomatis (maks 2x) bila server lambat/sibuk.
 * opts.onSlow(msg): dipanggil bila belum ada jawaban setelah 4 detik (untuk pesan "server sedang bangun").
 */
async function api(action, payload = {}, opts = {}) {
  const heavy = ['upload', 'photo', 'boothUpload', 'sharedPhoto'].includes(action);
  const timeoutMs = opts.timeout || (heavy ? 90000 : 30000);
  const tries = opts.tries ?? (SAFE_RETRY.includes(action) || action === 'join' ? 3 : 1);
  const slowTimer = opts.onSlow && setTimeout(() => opts.onSlow('Server sedang bangun, tunggu sebentar…'), 4000);
  try {
    for (let i = 1; ; i++) {
      try { return await apiOnce(action, payload, timeoutMs); }
      catch (e) {
        // join hanya diulang bila balasan rusak/timeout (bukan karena ditolak server)
        const again = e.retry && i < tries && (action !== 'join' || ['bad_response', 'timeout', 'network', 'server'].includes(e.code));
        if (!again) throw e;
        opts.onSlow?.('Server lambat, mencoba lagi…');
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
  }
}

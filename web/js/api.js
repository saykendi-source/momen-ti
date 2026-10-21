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

async function api(action, payload = {}) {
  let res;
  try {
    // Dikirim sebagai text/plain agar tidak memicu preflight CORS, dan balasan JSON tetap bisa dibaca.
    res = await fetch(MOMEN.API_URL, { method: 'POST', body: JSON.stringify({ action, auth: Auth.get(), ...payload }) });
  } catch {
    const e = new Error('Tidak bisa terhubung ke server. Periksa koneksi internet.');
    e.retry = true; e.code = 'network'; throw e;
  }
  let data;
  try { data = await res.json(); } catch {
    const e = new Error('Server tidak memberi jawaban yang benar. Coba lagi.');
    e.retry = true; e.code = 'bad_response'; throw e;
  }
  if (!data.ok) {
    const e = new Error(data.error || 'Permintaan gagal.');
    e.code = data.code; e.retry = !!data.retry;
    if (data.code === 'need_login') Auth.logout();
    throw e;
  }
  return data;
}

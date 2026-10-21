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

const Auth = {
  KEY: 'momen.auth',
  get() {
    const t = store.get(this.KEY);
    if (!t) return null;
    const p = decodeTokenPayload(t);
    if (!p || (p.x && Date.now() > p.x)) { store.del(this.KEY); return null; }
    return t;
  },
  set(t) { store.set(this.KEY, t); },
  info() { const t = this.get(); const p = t && decodeTokenPayload(t); return p ? { email: p.e, name: p.n } : null; },
  logout() {
    store.del(this.KEY);
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
  },
};

// Tombol "Login dengan Google" (Google Identity Services).
const GoogleLogin = {
  _load: null,
  load() {
    if (!this._load) {
      this._load = new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) return resolve();
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { this._load = null; reject(new Error('Tombol login Google gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.')); };
        document.head.append(s);
      });
    }
    return this._load;
  },
  /** Tampilkan tombol di elemen `el`. onDone(user) dipanggil setelah login berhasil. */
  async render(el, { onDone, onError, theme = 'outline' } = {}) {
    try { await this.load(); } catch (e) { onError?.(e); return; }
    google.accounts.id.initialize({
      client_id: MOMEN.GOOGLE_CLIENT_ID,
      ux_mode: 'popup',
      callback: async (resp) => {
        try {
          const r = await api('login', { credential: resp.credential });
          Auth.set(r.auth);
          onDone?.(r.user);
        } catch (e) { onError?.(e); }
      },
    });
    const width = Math.max(200, Math.min(380, Math.round(el.getBoundingClientRect().width) || 320));
    google.accounts.id.renderButton(el, { theme, size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width });
  },
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

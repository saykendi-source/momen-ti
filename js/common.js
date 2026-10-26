// Utilitas bersama.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
let toastTimer;
function toast(text, ms = 2400) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = text; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
function showMsg(el, text, ok = false) { el.textContent = text; el.classList.toggle('ok', ok); el.classList.toggle('hidden', !text); }
const STATUS_LABEL = { aktif: 'Aktif', arsip: 'Diarsipkan' };
const PHASE_LABEL = { belum: 'Belum dimulai', berlangsung: 'Sedang berlangsung', selesai: 'Selesai' };
const REVEAL_LABEL = { langsung: 'Langsung terlihat', setelah: 'Dibuka setelah acara selesai', jadwal: 'Dibuka pada waktu tertentu' };
const qs = (k) => new URLSearchParams(location.search).get(k);
const configured = () => window.MOMEN && !/GANTI_DENGAN/.test(MOMEN.API_URL);
function setupWarning() {
  return `<div class="panel setup-warn"><h2>Aplikasi belum dikonfigurasi</h2>
    <p class="muted" style="margin:0">Isi <b>API_URL</b> di file <code>js/config.js</code> dengan URL deployment Apps Script (README, Tahap 6).</p></div>`;
}

// Safari iPhone sering memulihkan halaman dari keadaan "beku" (back-forward cache) dengan permintaan
// yang sudah terputus, sehingga layar tertahan di "Memuat…". Muat ulang halaman agar data diambil lagi.
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

// ---------- Warna acara ----------
const ACCENTS = [['#1A9BA1', 'Toska'], ['#F2A93B', 'Oranye'], ['#E0524A', 'Merah'], ['#3B7BE0', 'Biru'], ['#8A5CD6', 'Ungu'], ['#2FA36B', 'Hijau'], ['#E0558F', 'Merah muda']];
function inkFor(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#14110A' : '#FFFFFF';
}
// Terapkan warna acara ke tombol utama, penghitung, dan aksen lain di halaman ini.
function applyAccent(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return;
  // Dipasang di <html> dan <body>, karena halaman kamera menetapkan warna bawaan di <body>.
  [document.documentElement.style, document.body.style].forEach((st) => {
    st.setProperty('--accent', hex); st.setProperty('--accent-ink', inkFor(hex));
    st.setProperty('--event', hex); st.setProperty('--event-ink', inkFor(hex));
  });
}

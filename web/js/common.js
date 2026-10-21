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

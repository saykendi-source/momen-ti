// Form acara: dipakai di dasbor (buat) dan halaman kelola (ubah).
function eventFormHtml(e = {}) {
  const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
  const later = new Date(now.getTime() + 3 * 3600 * 1000);
  const reveal = e.reveal || 'setelah';
  const filter = e.filter || 'portra';
  const frame = e.frame || 'polaroid';
  const quota = e.quotaMode || 'total';
  const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
  return `
    <div class="field">
      <label for="f-name">Nama acara</label>
      <input id="f-name" name="name" maxlength="80" required value="${esc(e.name || '')}" placeholder="Contoh: Seminar Nasional Teknologi Informasi 2026">
    </div>
    <div class="field">
      <label for="f-desc">Keterangan <span class="hint">Opsional, tampil di halaman kamera</span></label>
      <input id="f-desc" name="description" maxlength="300" value="${esc(e.description || '')}">
    </div>
    <div class="grid2">
      <div><label for="f-start">Mulai</label><input id="f-start" name="start" type="datetime-local" required value="${toLocalInput(e.start || now.toISOString())}"></div>
      <div><label for="f-end">Selesai <span class="hint">Kamera tertutup otomatis</span></label><input id="f-end" name="end" type="datetime-local" required value="${toLocalInput(e.end || later.toISOString())}"></div>
    </div>
    <div class="grid2">
      <div><label for="f-reveal">Album dibuka</label>
        <select id="f-reveal" name="reveal">${opt('setelah', reveal, 'Setelah acara selesai')}${opt('langsung', reveal, 'Langsung, selama acara')}${opt('jadwal', reveal, 'Pada waktu tertentu')}</select></div>
      <div class="reveal-at ${reveal === 'jadwal' ? '' : 'hidden'}"><label for="f-reveal-at">Waktu album dibuka</label>
        <input id="f-reveal-at" name="revealAt" type="datetime-local" value="${toLocalInput(e.revealAt)}"></div>
    </div>
    <div class="grid2">
      <div><label for="f-quota">Jenis jatah foto</label>
        <select id="f-quota" name="quotaMode">
          ${opt('total', quota, 'Total selama acara')}${opt('harian', quota, 'Per hari (terisi lagi tiap 00.00)')}${opt('rol', quota, 'Rol film baru tiap beberapa jam')}${opt('bebas', quota, 'Tanpa batas')}
        </select></div>
      <div class="q-max ${quota === 'bebas' ? 'hidden' : ''}"><label for="f-max" id="f-max-label">${maxLabel(quota)}</label><input id="f-max" name="maxPhotos" type="number" min="1" max="100" value="${e.maxPhotos || 15}"></div>
    </div>
    <div class="grid2">
      <div class="q-roll ${quota === 'rol' ? '' : 'hidden'}"><label for="f-roll">Rol baru setiap <span class="hint">Jam, dihitung dari jam mulai acara</span></label><input id="f-roll" name="rollHours" type="number" min="1" max="24" value="${e.rollHours || 3}"></div>
      <div><label for="f-code">Kode akses <span class="hint">Kosongkan jika tidak perlu</span></label><input id="f-code" name="code" maxlength="12" value="${esc(e.code || '')}" autocapitalize="characters"></div>
    </div>
    <div class="grid2">
      <div><label for="f-filter">Filter awal</label>
        <select id="f-filter" name="filter">${Object.entries(FILTERS).map(([k, f]) => opt(k, filter, `${f.label} (${f.mood})`)).join('')}</select></div>
      <div><label for="f-frame">Bingkai foto</label>
        <select id="f-frame" name="frame">${opt('polaroid', frame, 'Polaroid dengan nama acara')}${opt('polos', frame, 'Polos, tanpa bingkai')}</select></div>
    </div>
    <div class="field">
      <label class="check"><input type="checkbox" name="comments" ${e.comments ? 'checked' : ''}> Izinkan peserta berkomentar di album</label>
      <span class="hint">Komentar disaring dari kata kasar, bisa dilaporkan peserta, dan bisa disembunyikan admin. Reaksi emoji selalu aktif.</span>
    </div>
`;
}

function maxLabel(mode) {
  return mode === 'harian' ? 'Jatah foto per orang per hari' : mode === 'rol' ? 'Isi satu rol (foto per orang)' : 'Jatah foto per orang';
}

function bindEventForm(form) {
  const sel = form.querySelector('[name=reveal]');
  sel.addEventListener('change', () => form.querySelector('.reveal-at').classList.toggle('hidden', sel.value !== 'jadwal'));
  const q = form.querySelector('[name=quotaMode]');
  q.addEventListener('change', () => {
    form.querySelector('.q-max').classList.toggle('hidden', q.value === 'bebas');
    form.querySelector('.q-roll').classList.toggle('hidden', q.value !== 'rol');
    form.querySelector('#f-max-label').textContent = maxLabel(q.value);
  });
}

// Kalimat ringkas tentang jatah, untuk halaman Kelola.
function quotaText(e) {
  const m = e.quotaMode || 'total';
  if (m === 'bebas') return 'jatah foto tanpa batas';
  if (m === 'harian') return `jatah ${e.maxPhotos} foto per orang per hari`;
  if (m === 'rol') return `rol ${e.maxPhotos} foto per orang, rol baru tiap ${e.rollHours} jam`;
  return `jatah ${e.maxPhotos} foto per orang`;
}

function readEventForm(form) {
  const v = (n) => form.querySelector(`[name=${n}]`).value;
  const iso = (s) => { const d = new Date(s); return s && !isNaN(d) ? d.toISOString() : ''; };
  return {
    name: v('name').trim(),
    description: v('description').trim(),
    start: iso(v('start')),
    end: iso(v('end')),
    reveal: v('reveal'),
    revealAt: v('reveal') === 'jadwal' ? iso(v('revealAt')) : '',
    maxPhotos: Number(v('maxPhotos')),
    quotaMode: v('quotaMode'),
    rollHours: Number(v('rollHours')) || 3,
    code: v('code').trim(),
    filter: v('filter'),
    frame: v('frame'),
    comments: form.querySelector('[name=comments]').checked,
  };
}

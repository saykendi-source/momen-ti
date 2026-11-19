// Pilihan preset Lightroom di form acara (dasbor & kelola).
// Admin memilih maks. 6 preset dari koleksi bawaan Preset Lab atau mengunggah file .xmp sendiri.

function presetFieldHtml(e = {}) {
  return `
    <div class="field preset-field">
      <span class="label-like">Preset Lightroom <span class="hint">Opsional, maks ${MAX_EVENT_PRESETS}. Tampil sebagai filter di kamera peserta dan booth.</span></span>
      <div class="pz-chips" id="pz-chips"></div>
      <button type="button" class="btn ghost small" id="pz-open">+ Pilih preset</button>
      <label class="check pz-only ${(e.presets || []).length ? '' : 'hidden'}"><input type="checkbox" name="presetOnly" ${e.presetOnly ? 'checked' : ''}> Hanya tampilkan preset ini (sembunyikan filter film bawaan)</label>
      <input type="hidden" name="presets" value="${esc((e.presets || []).join(','))}">
    </div>`;
}

/* ---------- Foto contoh untuk pratinjau ---------- */
let pzSample = null; // { canvas } foto contoh aktif
function pzDefaultSample() {
  const w = 480, h = 360, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  // Langit sore
  let g = x.createLinearGradient(0, 0, 0, h * .62);
  g.addColorStop(0, '#5B8FC7'); g.addColorStop(.55, '#A9C3DB'); g.addColorStop(1, '#F1C58F');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // Matahari
  g = x.createRadialGradient(370, 170, 4, 370, 170, 90);
  g.addColorStop(0, 'rgba(255,248,225,1)'); g.addColorStop(.25, 'rgba(255,215,150,.85)'); g.addColorStop(1, 'rgba(255,190,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // Bukit jauh & dekat
  x.fillStyle = '#5E7F86';
  x.beginPath(); x.moveTo(0, 215); x.bezierCurveTo(90, 160, 170, 205, 250, 185); x.bezierCurveTo(330, 165, 420, 200, 480, 190); x.lineTo(480, 360); x.lineTo(0, 360); x.fill();
  g = x.createLinearGradient(0, 220, 0, h);
  g.addColorStop(0, '#6E9A4C'); g.addColorStop(1, '#2F4F2A');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(0, 250); x.bezierCurveTo(120, 215, 260, 255, 480, 230); x.lineTo(480, 360); x.lineTo(0, 360); x.fill();
  // Jalan tanah
  x.fillStyle = '#B98A5E';
  x.beginPath(); x.moveTo(205, 360); x.bezierCurveTo(230, 300, 270, 270, 300, 250); x.lineTo(312, 252); x.bezierCurveTo(300, 280, 300, 320, 330, 360); x.fill();
  // Orang: kaus merah, celana denim, kulit sawo matang
  x.fillStyle = '#2F4A78'; x.fillRect(118, 270, 16, 62); x.fillRect(138, 270, 16, 62);
  x.fillStyle = '#C8392E'; x.beginPath(); x.roundRect(108, 200, 56, 78, 14); x.fill();
  x.fillStyle = '#C68E66'; x.beginPath(); x.arc(136, 180, 21, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#2A1E19'; x.beginPath(); x.arc(136, 172, 22, Math.PI * 1.05, Math.PI * 1.95); x.fill();
  // Bunga kuning & ungu
  for (let i = 0; i < 26; i++) {
    const px = 20 + (i * 71) % 440, py = 300 + (i * 37) % 55;
    x.fillStyle = i % 3 ? '#E8C440' : '#8A5CD6';
    x.beginPath(); x.arc(px, py, 4 + (i % 3), 0, Math.PI * 2); x.fill();
  }
  // Kartu warna kecil di pojok (membantu membandingkan)
  ['#111111', '#555555', '#999999', '#DDDDDD', '#E0524A', '#F2A93B', '#2FA36B', '#3B7BE0'].forEach((col, i) => {
    x.fillStyle = col; x.fillRect(12 + i * 22, 12, 20, 14);
  });
  return c;
}
function pzSampleCanvas() { return (pzSample = pzSample || pzDefaultSample()); }
async function pzSetSampleFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const w = 480, h = 360, c = document.createElement('canvas'); c.width = w; c.height = h;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    c.getContext('2d').drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    pzSample = c;
  } finally { URL.revokeObjectURL(url); }
}

/** Gambar foto contoh + preset (pakai mesin Preset Lab penuh; kecil jadi cepat). */
function pzRender(canvas, settings) {
  const src = pzSampleCanvas();
  const w = canvas.width, h = canvas.height, x = canvas.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, w, h);
  if (!settings) return;
  const img = x.getImageData(0, 0, w, h), out = new Uint8ClampedArray(img.data.length);
  const s = JSON.parse(JSON.stringify(settings));
  PresetEngine.processImage(img.data, out, w, h, s, 1);
  img.data.set(out); x.putImageData(img, 0, 0);
}

/* ---------- Bidang preset di form ---------- */
function bindPresetField(form, e = {}) {
  const field = form.querySelector('.preset-field');
  if (!field) return;
  const hidden = form.querySelector('[name=presets]');
  // Daftar preset terpilih: { k, n, s }
  let sel = [];
  const known = Object.assign({}, e.presetData || {});

  const refreshFilterSelect = () => {
    const s = form.querySelector('[name=filter]'); if (!s) return;
    const cur = s.value || e.filter || 'portra';
    const builtin = Object.entries(BUILTIN_FILTERS).map(([k, f]) => `<option value="${k}">${f.label} (${f.mood})</option>`).join('');
    const pre = sel.map((p) => `<option value="${esc(p.k)}">${esc(p.n)} (preset)</option>`).join('');
    s.innerHTML = (pre ? `<optgroup label="Preset Lightroom">${pre}</optgroup><optgroup label="Filter film">${builtin}</optgroup>` : builtin);
    s.value = [...s.options].some((o) => o.value === cur) ? cur : (sel[0] ? sel[0].k : 'portra');
  };
  const draw = () => {
    hidden.value = sel.map((p) => p.k).join(',');
    field.querySelector('.pz-only').classList.toggle('hidden', !sel.length);
    const box = field.querySelector('#pz-chips');
    box.innerHTML = sel.map((p, i) => `
      <span class="pz-chip"><canvas width="64" height="48" data-i="${i}"></canvas><b>${esc(p.n)}</b>
        <button type="button" data-rm="${i}" aria-label="Hapus preset ${esc(p.n)}">×</button></span>`).join('');
    box.querySelectorAll('canvas').forEach((c) => { try { pzRender(c, sel[+c.dataset.i].s); } catch {} });
    refreshFilterSelect();
  };
  field.querySelector('#pz-chips').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-rm]'); if (!b) return;
    sel.splice(+b.dataset.rm, 1); draw();
  });
  field.querySelector('#pz-open').addEventListener('click', () => openPresetPicker(sel, known, (next) => { sel = next; draw(); }));

  // Isi awal (mode ubah acara)
  const keys = e.presets || [];
  if (keys.length) {
    presetLibrary().then((lib) => {
      sel = keys.map((k) => (k.startsWith('u:') ? (known[k] ? { k, n: known[k].n, s: known[k].s } : null) : lib.find((p) => p.k === k))).filter(Boolean);
      draw();
    }).catch(() => {});
  } else refreshFilterSelect();
}

/* ---------- Dialog pemilih ---------- */
async function openPresetPicker(current, known, done) {
  let picked = current.slice();
  const dlg = document.createElement('dialog');
  dlg.className = 'pz-dialog';
  dlg.innerHTML = `
    <div class="pz-head">
      <div><h2>Pilih preset</h2><p class="muted small" id="pz-count"></p></div>
      <button type="button" class="btn small" id="pz-done">Selesai</button>
    </div>
    <div class="pz-tools">
      <label class="btn ghost small">Unggah .xmp<input type="file" id="pz-xmp" accept=".xmp,.dng,application/rdf+xml" multiple hidden></label>
      <label class="btn ghost small">Ganti foto contoh<input type="file" id="pz-photo" accept="image/*" hidden></label>
    </div>
    <div class="msg hidden" id="pz-msg" role="status"></div>
    <div class="pz-body" id="pz-body"><p class="muted">Memuat koleksi…</p></div>`;
  document.body.appendChild(dlg);
  dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', (ev) => { ev.preventDefault(); done(picked); close(); });
  dlg.querySelector('#pz-done').onclick = () => { done(picked); close(); };
  const msg = (t, ok) => { const m = dlg.querySelector('#pz-msg'); m.textContent = t || ''; m.classList.toggle('hidden', !t); m.classList.toggle('ok', !!ok); };

  let lib = [], mine = [];
  try { lib = await presetLibrary(); } catch { msg('Koleksi preset gagal dimuat. Periksa koneksi lalu coba lagi.'); }
  try { mine = (await api('listPresets')).presets || []; } catch (err) { /* tetap bisa memilih dari koleksi bawaan */ }
  mine.forEach((p) => { known[p.k] = { n: p.n, s: p.s }; });

  const groups = [];
  groups.push(['Unggahan saya', mine, true]);
  const cats = [...new Set(lib.map((p) => p.c))];
  cats.forEach((c) => groups.push([c, lib.filter((p) => p.c === c), false]));

  const body = dlg.querySelector('#pz-body');
  const isOn = (k) => picked.some((p) => p.k === k);
  const count = () => { dlg.querySelector('#pz-count').textContent = `${picked.length} dari ${MAX_EVENT_PRESETS} dipilih. Ketuk untuk memilih atau membatalkan.`; };
  const card = (p, own) => `
    <div class="pz-item"><button type="button" class="pz-card" data-k="${esc(p.k)}" aria-pressed="${isOn(p.k)}">
      <canvas width="240" height="180"></canvas>
      <span>${esc(p.n)}</span></button>${own ? `<button type="button" class="pz-del" data-del="${esc(p.k)}" title="Hapus dari unggahan" aria-label="Hapus ${esc(p.n)} dari unggahan">×</button>` : ''}
    </div>`;
  const all = () => [...mine, ...lib];
  const render = () => {
    body.innerHTML = groups.map(([name, list, own]) => `
      <section><h3>${esc(name)}</h3>
        ${list.length ? `<div class="pz-grid">${list.map((p) => card(p, own)).join('')}</div>`
          : own ? '<p class="muted small">Belum ada. Unggah file .xmp dari Lightroom atau Preset Lab.</p>' : ''}
      </section>`).join('');
    count();
    // Gambar pratinjau bertahap agar dialog langsung tampil.
    const cards = [...body.querySelectorAll('.pz-card')];
    let i = 0;
    const step = () => {
      const t = performance.now();
      while (i < cards.length && performance.now() - t < 24) {
        const c = cards[i++], p = all().find((x) => x.k === c.dataset.k);
        try { pzRender(c.querySelector('canvas'), p && p.s); } catch {}
      }
      if (i < cards.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  render();

  body.addEventListener('click', async (ev) => {
    const del = ev.target.closest('[data-del]');
    if (del) {
      ev.stopPropagation();
      const k = del.dataset.del;
      if (!confirm('Hapus preset ini dari daftar unggahan? Acara yang sudah memakainya tidak terpengaruh.')) return;
      try { await api('deletePreset', { k }); mine = mine.filter((p) => p.k !== k); groups[0][1] = mine; picked = picked.filter((p) => p.k !== k); render(); }
      catch (err) { msg(err.message); }
      return;
    }
    const b = ev.target.closest('.pz-card'); if (!b) return;
    const k = b.dataset.k;
    if (isOn(k)) picked = picked.filter((p) => p.k !== k);
    else {
      if (picked.length >= MAX_EVENT_PRESETS) { msg(`Maksimal ${MAX_EVENT_PRESETS} preset per acara. Batalkan salah satu dulu.`); return; }
      const p = all().find((x) => x.k === k); if (p) picked.push({ k: p.k, n: p.n, s: p.s });
    }
    msg('');
    b.setAttribute('aria-pressed', isOn(k));
    count();
  });

  dlg.querySelector('#pz-photo').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { await pzSetSampleFromFile(f); render(); } catch { msg('Foto contoh tidak bisa dibuka.'); }
    ev.target.value = '';
  });

  dlg.querySelector('#pz-xmp').addEventListener('change', async (ev) => {
    const files = [...ev.target.files]; ev.target.value = '';
    let added = 0; const notes = [];
    for (const f of files) {
      try {
        if (f.size > 30 * 1024 * 1024) throw new Error('file terlalu besar');
        const text = await f.text();
        const r = PresetEngine.parseXMP(text);
        if (!r) throw new Error('bukan file preset Lightroom');
        const settings = cleanPresetSettings(r.s);
        if (!Object.keys(settings).length) throw new Error('tidak berisi pengaturan');
        const name = (r.name || f.name.replace(/\.(xmp|dng)$/i, '')).slice(0, 40);
        if (r.lut) notes.push(`${name}: memakai profil/tabel warna yang belum didukung, hasil bisa berbeda dari Lightroom.`);
        const { preset } = await api('savePreset', { name, settings });
        mine.unshift(preset); known[preset.k] = { n: preset.n, s: preset.s }; added++;
        if (picked.length < MAX_EVENT_PRESETS) picked.push(preset);
      } catch (err) { notes.push(`${f.name}: ${err.message}`); }
    }
    groups[0][1] = mine;
    render();
    msg((added ? `${added} preset diunggah dan langsung dipilih. ` : '') + notes.join(' '), added && !notes.length);
  });
}

(function () {
  document.title = MOMEN.APP_NAME;
  $('.app-name').textContent = MOMEN.APP_NAME;
  if (!configured()) { $('#setup').innerHTML = setupWarning(); return; }

  const next = qs('next');
  const safeNext = next && next.startsWith(location.origin) ? next : null;

  const showLogin = () => {
    $('#login').classList.remove('hidden'); $('#dash').classList.add('hidden'); $('#who-box').innerHTML = '';
    $('#password').focus();
  };
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const password = $('#password').value;
    if (!password) return showMsg($('#login-msg'), 'Isi kata sandi admin.');
    btn.disabled = true; btn.textContent = 'Memeriksa…';
    try {
      const r = await api('adminLogin', { password });
      Auth.set(r.auth);
      if (safeNext) location.href = safeNext; else location.reload();
    } catch (err) {
      showMsg($('#login-msg'), err.message);
      btn.disabled = false; btn.textContent = 'Masuk';
    }
  });
  if (!Auth.get()) return showLogin();

  $('#who-box').innerHTML = '<span class="muted small">Admin</span><button class="btn ghost small" id="btn-logout">Keluar</button>';
  $('#btn-logout').onclick = () => { Auth.logout(); location.reload(); };
  $('#dash').classList.remove('hidden');

  async function load() {
    let data;
    try { data = await api('listEvents'); }
    catch (err) {
      if (err.code === 'need_login') { Auth.logout(); return showLogin(); }
      $('#loading').textContent = err.message; return;
    }
    $('#loading').classList.add('hidden');
    $('#empty').classList.toggle('hidden', data.events.length > 0);
    $('#list').innerHTML = data.events.map((e) => `
      <li class="event-item">
        <span class="sprocket" aria-hidden="true"></span>
        <div>
          <h3>${esc(e.name)}</h3>
          <div class="muted small">${fmtDate(e.start)} – ${fmtTime(e.end)}</div>
          <div class="row small" style="gap:.5rem; margin-top:.35rem">
            <span class="chip ${e.status}">${STATUS_LABEL[e.status] || e.status}</span>
            ${e.status === 'aktif' ? `<span class="chip">${PHASE_LABEL[e.state.phase]}</span>` : ''}
            <span class="muted">${e.stats.participants} peserta, ${e.stats.photos} foto</span>
            ${e.stats.reported ? `<span class="chip ditolak">${e.stats.reported} dilaporkan</span>` : ''}
          </div>
        </div>
        <a class="btn ghost small" href="kelola.html?id=${encodeURIComponent(e.id)}">Kelola</a>
      </li>`).join('');
  }
  load();
  // Tampilkan jumlah masukan baru di tombol "Masukan pengguna".
  api('listFeedback').then((r) => {
    const seen = Number(store.get('momen.fb.seen') || 0);
    const n = r.items.filter((i) => Date.parse(i.t) > seen).length;
    if (n) $('#fb-link').innerHTML = `💬 Masukan pengguna <span class="chip menunggu">${n} baru</span>`;
  }).catch(() => {});

  const form = $('#new-form');
  $('#btn-new').onclick = () => {
    $('#form-fields').innerHTML = eventFormHtml();
    bindEventForm(form); showMsg($('#msg'), '');
    form.classList.remove('hidden'); $('#f-name').focus();
  };
  $('#btn-cancel').onclick = () => form.classList.add('hidden');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      const { event } = await api('createEvent', { data: readEventForm(form) });
      location.href = `kelola.html?id=${encodeURIComponent(event.id)}`;
    } catch (err) {
      showMsg($('#msg'), err.message);
      btn.disabled = false; btn.textContent = 'Simpan acara';
    }
  });
})();

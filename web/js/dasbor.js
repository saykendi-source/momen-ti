(function () {
  document.title = MOMEN.APP_NAME;
  $('.app-name').textContent = MOMEN.APP_NAME;
  if (!configured()) { $('#setup').innerHTML = setupWarning(); return; }

  const next = qs('next');
  const safeNext = next && next.startsWith(location.origin) ? next : null;
  const showLogin = () => {
    $('#login').classList.remove('hidden'); $('#dash').classList.add('hidden'); $('#who-box').innerHTML = '';
    GoogleLogin.render($('#g-btn'), {
      onDone: () => { if (safeNext) location.href = safeNext; else location.reload(); },
      onError: (e) => showMsg($('#login-msg'), e.message),
    });
  };
  if (!Auth.get()) return showLogin();

  const info = Auth.info();
  $('#who-box').innerHTML = `<span class="muted small">${esc(info.name)}</span><button class="btn ghost small" id="btn-logout">Keluar</button>`;
  $('#btn-logout').onclick = () => { Auth.logout(); location.reload(); };
  $('#dash').classList.remove('hidden');

  let admin = false;
  async function load() {
    let data;
    try { data = await api('myEvents'); }
    catch (err) {
      if (err.code === 'need_login') return showLogin();
      $('#loading').textContent = err.message; return;
    }
    admin = data.admin;
    $('#loading').classList.add('hidden');
    $('#title').textContent = admin ? 'Semua acara' : 'Acara saya';
    $('#approval-note').textContent = admin ? 'Acara yang kamu buat langsung aktif.' : 'Acara akan aktif setelah disetujui admin prodi.';
    $('#empty').classList.toggle('hidden', data.events.length > 0);
    $('#list').innerHTML = data.events.map((e) => `
      <li class="event-item">
        <span class="sprocket" aria-hidden="true"></span>
        <div>
          <h3>${esc(e.name)}</h3>
          <div class="muted small">${fmtDate(e.start)} – ${fmtTime(e.end)}${admin && e.ownerName ? ` · oleh ${esc(e.ownerName)}` : ''}</div>
          <div class="row small" style="gap:.5rem; margin-top:.35rem">
            <span class="chip ${e.status}">${STATUS_LABEL[e.status]}</span>
            ${e.status === 'aktif' ? `<span class="chip">${PHASE_LABEL[e.state.phase]}</span>` : ''}
            <span class="muted">${e.stats.participants} peserta, ${e.stats.photos} foto</span>
            ${e.stats.reported ? `<span class="chip ditolak">${e.stats.reported} dilaporkan</span>` : ''}
          </div>
        </div>
        <a class="btn ghost small" href="kelola.html?id=${encodeURIComponent(e.id)}">Kelola</a>
      </li>`).join('');
  }
  load();

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

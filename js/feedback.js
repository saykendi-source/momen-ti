// Formulir "Beri masukan": cukup satu kolom tulisan.
const Feedback = (() => {
  function deviceId() {
    let id = store.get('momen.device');
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2); store.set('momen.device', id); }
    return id;
  }
  function deviceInfo() {
    const ua = navigator.userAgent;
    const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Lainnya';
    const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser lain';
    return `${os} · ${br}`;
  }

  let dlg = null, ctx = {};
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'fb-dialog';
    dlg.setAttribute('aria-labelledby', 'fb-title');
    dlg.innerHTML = `
      <form class="fb-form" novalidate>
        <div id="fb-body">
          <h2 id="fb-title">Beri masukan</h2>
          <label for="fb-msg" class="muted small" style="font-weight:400">Saran, ide, atau masalah yang kamu alami saat memakai Momen TI.</label>
          <textarea id="fb-msg" rows="5" maxlength="1000" required></textarea>
          <p class="msg hidden" id="fb-err" role="alert"></p>
          <div class="row" style="margin-top:.9rem; justify-content:flex-end">
            <button type="button" class="btn ghost" data-close>Batal</button>
            <button class="btn" id="fb-send">Kirim</button>
          </div>
        </div>
        <div id="fb-done" class="hidden fb-done">
          <h2>Terima kasih!</h2>
          <p class="muted">Masukanmu sudah kami terima.</p>
          <button type="button" class="btn" data-close>Tutup</button>
        </div>
      </form>`;
    document.body.append(dlg);
    dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });
    dlg.querySelector('form').addEventListener('submit', send);
    dlg.querySelector('#fb-msg').addEventListener('input', () => showMsg(dlg.querySelector('#fb-err'), ''));
  }

  async function send(e) {
    e.preventDefault();
    const message = dlg.querySelector('#fb-msg').value.trim();
    const err = dlg.querySelector('#fb-err');
    if (message.length < 3) { showMsg(err, 'Tulis masukanmu dulu.'); return; }
    const btn = dlg.querySelector('#fb-send'); btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      await api('sendFeedback', { auth: null, slug: ctx.slug || '', page: ctx.page || '', message, device: deviceInfo(), deviceId: deviceId() });
      dlg.querySelector('#fb-body').classList.add('hidden');
      dlg.querySelector('#fb-done').classList.remove('hidden');
    } catch (ex) { showMsg(err, ex.message); }
    btn.disabled = false; btn.textContent = 'Kirim';
  }

  return {
    /** Buka formulir. opts: { slug, page } */
    open(opts = {}) {
      ctx = opts;
      if (!dlg) build();
      dlg.querySelector('#fb-msg').value = '';
      showMsg(dlg.querySelector('#fb-err'), '');
      dlg.querySelector('#fb-body').classList.remove('hidden');
      dlg.querySelector('#fb-done').classList.add('hidden');
      dlg.showModal();
      setTimeout(() => dlg.querySelector('#fb-msg').focus(), 50);
    },
  };
})();

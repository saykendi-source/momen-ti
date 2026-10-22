// Pemuat thumbnail bertahap: hanya foto yang terlihat di layar yang diminta, maks 6 per permintaan, 2 permintaan bersamaan.
function ThumbLoader(slug, getPt) {
  const cache = new Map();
  const pending = new Set();
  const waiting = new Map(); // id -> [img]
  let inflight = 0;

  function apply(id, data) {
    (waiting.get(id) || []).forEach((img) => { img.src = data; img.closest('[data-id]')?.classList.add('loaded'); });
    waiting.delete(id);
  }
  function pump() {
    while (inflight < 2 && pending.size) {
      const ids = [...pending].slice(0, 6);
      ids.forEach((id) => pending.delete(id));
      inflight++;
      api('thumbs', { slug, pt: getPt(), ids })
        .then((r) => Object.entries(r.thumbs).forEach(([id, d]) => { if (d) { cache.set(id, d); apply(id, d); } }))
        .catch(() => setTimeout(() => { ids.forEach((id) => { if (waiting.has(id)) pending.add(id); }); pump(); }, 3000))
        .finally(() => { inflight--; pump(); });
    }
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const id = e.target.dataset.id;
      if (cache.has(id)) apply(id, cache.get(id)); else { pending.add(id); pump(); }
    });
  }, { rootMargin: '600px 0px' }) : null;

  return {
    get: (id) => cache.get(id),
    /** el: elemen pembungkus ber-data-id yang berisi <img>. */
    observe(el) {
      const id = el.dataset.id, img = el.querySelector('img');
      if (!waiting.has(id)) waiting.set(id, []);
      waiting.get(id).push(img);
      if (cache.has(id)) return apply(id, cache.get(id));
      if (io) io.observe(el); else { pending.add(id); pump(); }
    },
  };
}

// Antrean foto di perangkat (IndexedDB): foto tidak hilang walau sinyal putus atau halaman tertutup.
const Queue = (() => {
  let dbp = null;
  const memory = [];
  let useMemory = !('indexedDB' in window);

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const r = indexedDB.open('momen-ti', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('uploads', { keyPath: 'id' });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return dbp;
  }
  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('uploads', mode);
      const req = fn(tx.objectStore('uploads'));
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  }
  async function safe(fn, fallback) {
    if (useMemory) return fallback();
    try { return await fn(); } catch { useMemory = true; return fallback(); }
  }
  return {
    add: (item) => safe(() => run('readwrite', (s) => s.put(item)), () => { memory.push(item); }),
    remove: (id) => safe(() => run('readwrite', (s) => s.delete(id)), () => { const i = memory.findIndex((x) => x.id === id); if (i >= 0) memory.splice(i, 1); }),
    list: (slug) => safe(
      async () => (await run('readonly', (s) => s.getAll())).filter((x) => x.slug === slug).sort((a, b) => a.takenAt - b.takenAt),
      () => memory.filter((x) => x.slug === slug).sort((a, b) => a.takenAt - b.takenAt)),
    persistent: () => !useMemory,
  };
})();

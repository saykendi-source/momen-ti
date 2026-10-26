// Pemeriksaan kata di bingkai di HP (server memeriksa ulang dengan daftar yang sama).
const CAPTION_MAX = 40;
const CAPTION_BAD = ['anjing', 'anjir', 'bangsat', 'babi', 'bajingan', 'kontol', 'memek', 'ngentot', 'goblok', 'tolol',
  'bego', 'asu', 'jancok', 'jancuk', 'kampret', 'tai', 'brengsek', 'bodoh', 'idiot', 'lonte', 'pelacur'];
function captionProblem(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length > CAPTION_MAX) return `Maksimal ${CAPTION_MAX} karakter.`;
  const words = t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').replace(/(.)\1{2,}/g, '$1$1').split(/\s+/);
  if (words.some((w) => CAPTION_BAD.includes(w) || CAPTION_BAD.includes(w.replace(/(.)\1+/g, '$1')))) return 'Ada kata yang tidak pantas. Ubah dulu kata-katanya.';
  return '';
}

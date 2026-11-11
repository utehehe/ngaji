'use strict';
const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Antarmuka ke jembatan aplikasi (app-bridge.js menimpa bagian ini) ---------- */
const NGAJI = window.NGAJI = {
  getData: () => data,
  onChange: () => {},
  status(s) { const el = $('#saveState'); if (el && el.dataset.s !== s) { el.dataset.s = s; el.textContent = s === 'dirty' ? 'Menyimpan…' : 'Tersimpan'; } },
  toast(msg) {
    const el = $('#snack'); el.textContent = msg; el.classList.add('show');
    clearTimeout(NGAJI._t); NGAJI._t = setTimeout(() => el.classList.remove('show'), 3400);
  },
  save() { NGAJI.toast('Penyimpanan hanya tersedia di aplikasi desktop.'); },
  exportJs() { NGAJI.toast('Ekspor hanya tersedia di aplikasi desktop.'); },
  openProject() { NGAJI.toast('Membuka proyek hanya tersedia di aplikasi desktop.'); },
  newProject() { NGAJI.toast('Proyek baru hanya tersedia di aplikasi desktop.'); },
  resetData() { NGAJI.toast('Reset hanya tersedia di aplikasi desktop.'); },
  listFonts: () => Promise.resolve([]),
  addFonts: () => Promise.resolve({ ok: false, error: 'Menambah file font hanya tersedia di aplikasi desktop.' })
};

if (!window.NGAJI_DATA || !Array.isArray(window.NGAJI_DATA.pages) || !window.NGAJI_DATA.pages.length) {
  document.body.innerHTML = '<p style="padding:48px;font:16px system-ui;color:#fff">Data tidak terbaca. Periksa <code>app/data/ngaji-data.js</code>.</p>';
  throw new Error('NGAJI_DATA tidak ditemukan');
}
let data = window.NGAJI_DATA;
data.pages.forEach(p => {
  p.sentences = p.sentences || [];
  p.sentences.forEach(s => {
    if (!['text', 'heading', 'sub'].includes(s.type)) s.type = 'text';
    if (!['right', 'center', 'left', 'justify'].includes(s.align)) s.align = null;
    s.bold = s.bold === true;
    s.keterangan_kalimat = { catatan: (s.keterangan_kalimat && typeof s.keterangan_kalimat.catatan === 'string') ? s.keterangan_kalimat.catatan : '' }; });
});
if (data.progress && (typeof data.progress !== 'object' || Array.isArray(data.progress))) delete data.progress;
let dataVer = 0; // naik setiap data berubah -> indeks pencarian kata/kalimat dibangun ulang (lazy)
let kamusDirty = true; // indeks Kamus dibangun ulang (lazy) setelah data berubah
const touch = () => { kamusDirty = true; NGAJI.onChange(); histMark(); }; // perubahan struktur selalu diikuti render() yang menaikkan dataVer; ketikan biasa tidak perlu membangun ulang indeks

/* ---------- Urungkan / Ulangi (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, tombol di dock Mode Edit, menu Edit) ----------
   Riwayat berbasis snapshot isi buku (judul + semua bab). Perubahan digabung per jeda 0,5 detik, jadi mengetik satu kata = satu langkah.
   Pengaturan tampilan dan progres kajian tidak ikut diurungkan. Riwayat hanya berlaku selama aplikasi berjalan. */
const hist = { undo: [], redo: [], base: '', timer: 0 };
const HIST_MAX = 80, HIST_CHARS = 150e6;
const histSnap = () => JSON.stringify({ title: data.title, pages: data.pages });
hist.base = histSnap();
function histPaint() {
  const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn');
  if (u) u.disabled = !hist.undo.length && !hist.timer;
  if (r) r.disabled = !hist.redo.length;
}
function histMark() { clearTimeout(hist.timer); hist.timer = setTimeout(histCommit, 500); histPaint(); }
function histCommit() { // jadikan perubahan yang tertunda satu langkah riwayat
  clearTimeout(hist.timer); hist.timer = 0;
  const cur = histSnap();
  if (cur === hist.base) { histPaint(); return false; }
  hist.undo.push(hist.base); hist.base = cur; hist.redo.length = 0;
  let tot = hist.undo.reduce((n, x) => n + x.length, 0);
  while (hist.undo.length > HIST_MAX || (tot > HIST_CHARS && hist.undo.length > 1)) tot -= hist.undo.shift().length;
  histPaint(); return true;
}
function histApply(snap) {
  const o = JSON.parse(snap), pid = data.pages[pi] && data.pages[pi].id;
  data.title = o.title; data.pages = o.pages;
  dataVer++; kamusDirty = true;
  const k = data.pages.findIndex(p => p.id === pid); pi = k >= 0 ? k : Math.min(pi, data.pages.length - 1);
  mjOff(); fpReset(false); pick.on = false; pick.a = null; document.body.classList.remove('picking');
  const s = sel.sid && sentence(sel.sid);
  if (!s) sel = { sid: null, wid: null, rid: null, fid: null };
  else {
    if (sel.wid && !word(sel.wid)) sel.wid = null;
    if (sel.rid && !(s.rentang || []).some(r => r.id === sel.rid)) sel.rid = null;
    if (sel.fid && !(s.frasa || []).some(r => r.id === sel.fid)) sel.fid = null;
  }
  if (subSid && !sentence(subSid)) subSid = null;
  showPanel(null); NGAJI.onChange(); render(); syncDrawers();
}
function histUndo() {
  histCommit();
  if (!hist.undo.length) { NGAJI.toast('Tidak ada yang bisa diurungkan.'); return; }
  hist.redo.push(hist.base); hist.base = hist.undo.pop(); histApply(hist.base); histPaint(); NGAJI.toast('Diurungkan.');
}
function histRedo() {
  histCommit();
  if (!hist.redo.length) { NGAJI.toast('Tidak ada yang bisa diulangi.'); return; }
  hist.undo.push(hist.base); hist.base = hist.redo.pop(); histApply(hist.base); histPaint(); NGAJI.toast('Diulangi.');
}
// kind: 'undo' | 'redo'. Di kolom teks: urungkan ketikan kolom itu sendiri (bawaan browser); di luar itu: riwayat buku (hanya Mode Edit).
function histKey(kind, e, viaMenu) {
  const a = document.activeElement;
  const txt = !!a && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search|)$/i.test(a.type)));
  if (txt) { if (viaMenu) document.execCommand(kind); return; }
  if (mode !== 'edit' || !kamusModal.hidden || !modal.hidden) return;
  if (e) e.preventDefault();
  kind === 'undo' ? histUndo() : histRedo();
}
NGAJI.menuHist = kind => histKey(kind, null, true);
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'z') histKey(e.shiftKey ? 'redo' : 'undo', e);
  else if (k === 'y' && !e.metaKey) histKey('redo', e);
});

/* ---------- Pengaturan (disimpan di data.settings -> ikut file data .js) ---------- */
// [key, label, type, ...opsi]
const SCHEMA = [
  ['Bahasa / Language', [['lang', 'Bahasa aplikasi', 'strchoice', [['id', 'Indonesia'], ['en', 'English'], ['ar', 'العربية']]]]],
  ['Mode Lite', [
    ['liteMode', 'Aktifkan Mode Lite (ringan, tetap mulus)', 'check'],
    ['_liteHint', 'Mematikan blur kaca, liquid glass, bayangan & cahaya berat, serta animasi tanpa henti di latar, penanda nahwu, dan garis dhomir. Gerak geser panel, luncur kata, dan hover tetap halus. Pengaturan Anda tidak diubah: matikan Mode Lite untuk kembali ke tampilan penuh.', 'hint']]],
  ['Tema', [['theme', 'Tema', 'strchoice', [['aurora', 'Aurora'], ['dark', 'Gelap'], ['light', 'Terang'], ['sepia', 'Sepia'], ['oled', 'OLED'],
      ['masjid', 'Masjid malam (bergambar)'], ['bukitpasir', 'Bukit pasir berbintang (bergambar)'], ['arabesque', 'Arabesque emas (bergambar)'],
      ['kabah', "Ka'bah (bergambar)"], ['nabawi', 'Masjid Nabawi (bergambar)'], ['aqsa', 'Kubah Sakhrah (bergambar)'], ['ramadan', 'Lentera Ramadan (bergambar)'], ['mihrab', 'Mihrab zamrud (bergambar)'],
      ['laut', 'Samudra'], ['hutan', 'Hutan zamrud'], ['senja', 'Senja'], ['sakura', 'Sakura'], ['kopi', 'Kopi'], ['nord', 'Nord'],
      ['violet', 'Violet malam'], ['grafit', 'Grafit'], ['kerajaan', 'Kerajaan'], ['mint', 'Mint'], ['langit', 'Langit'],
      ['tengah', 'Tengah malam'], ['zamrudgelap', 'Zamrud gelap'], ['batu', 'Batu tulis'], ['anggur', 'Anggur'], ['lavender', 'Lavender gelap'],
      ['gurun', 'Gurun malam'], ['pinus', 'Pinus kelabu'], ['tinta', 'Tinta'], ['arang', 'Arang hangat'], ['mawar', 'Mawar debu'], ['kode', 'Kode malam']]],
    ['auroraAnim', 'Animasi latar aurora (matikan bila terasa berat)', 'check']]],
  ['Tipografi Arab', [
    ['fs', 'Ukuran font', 'range', 24, 96, 1, 'px'],
    ['lh', 'Jarak antar baris', 'range', 1.4, 4, 0.1, ''],
    ['ws', 'Jarak antar kata', 'range', 0, 30, 1, 'px'],
    ['padX', 'Margin samping area baca', 'range', 0, 240, 2, 'px'],
    ['font', 'Font Arab', 'select', () => fontOptions()],
    ['_fonts', '', 'fonttools'],
    ['arColor', 'Warna teks Arab', 'color'],
    ['hideHarakat', 'Sembunyikan harakat (hanya tampilan, data tidak berubah)', 'check']]],
  ['Teks dalam tanda kurung ( )', [
    ['prOn', 'Beri gaya khusus teks di dalam tanda kurung', 'check'],
    ['prColor', 'Warna teks', 'color'],
    ['prFont', 'Font', 'prfont'],
    ['prFs', 'Ukuran font (× ukuran teks Arab)', 'range', 0.6, 1.6, 0.05, '×'],
    ['prWeight', 'Ketebalan', 'choice', [[null, 'Ikut teks'], [100, 'Sangat tipis (100)'], [200, 'Tipis (200)'], [300, 'Ringan (300)'], [400, 'Normal (400)'], [700, 'Tebal (700)'], [900, 'Sangat tebal (900)']]],
    ['prItalic', 'Miring', 'check'],
    ['prOp', 'Transparansi teks', 'range', 0.2, 1, 0.05, ''],
    ['prMarks', 'Tanda kurungnya ikut diberi gaya yang sama', 'check']]],
  ['Efek hover', [
    ['hoverMotion', 'Animasi gerak teks saat hover (berulang selama kursor di atas kata)', 'strchoice', [['melayang', 'Melayang napas'], ['ayun', 'Ayun bandul'], ['denyut', 'Denyut jantung'], ['orbit', 'Orbit mungil'], ['lompat', 'Lompat membal'], ['off', 'Mati']]],
    ['mvSpeed', 'Kecepatan animasi gerak', 'range', 0.5, 2.5, 0.1, '×'],
    ['hoverStyle', 'Gaya hover', 'strchoice', [['zoom', 'Zoom (bawaan)'], ['angkat', 'Angkat melayang'], ['kaca', 'Kaca cair (liquid)'], ['garis', 'Garis menyapu'], ['kilau', 'Kilau menyapu'], ['neon', 'Neon menyala'], ['miring', 'Miring 3D mengikuti kursor'], ['cahaya', 'Cahaya mengikuti kursor']]],
    ['scale', 'Skala hover (Zoom / Angkat / Kaca)', 'range', 1, 1.6, 0.01, '×'],
    ['glow', 'Warna box & glow', 'color'],
    ['glowA', 'Transparansi box & glow', 'range', 0, 1, 0.05, ''],
    ['hovRadius', 'Kelengkungan sudut box', 'range', 0, 40, 1, 'px'],
    ['hovRing', 'Warna garis tepi box', 'color'],
    ['hovRingW', 'Tebal garis tepi box', 'range', 0, 6, 0.5, 'px'],
    ['clickSound', 'Suara klik (tombol & menu)', 'check']]],
  ['Blur latar panel (transparan)', [
    ['panelBlur', 'Aktifkan blur latar transparan di semua panel', 'check'],
    ['panelBlurAmt', 'Kekuatan blur latar', 'range', 0, 60, 1, 'px'],
    ['panelAlpha', 'Kepekatan panel (kiri = makin transparan)', 'range', 0, 1, 0.01, '']]],
  ['Liquid glass (semua panel)', [
    ['glassOn', 'Aktifkan efek liquid glass', 'check'],
    ['glassA', 'Kepekatan panel (kiri = makin bening)', 'range', 0, 0.95, 0.01, ''],
    ['blur', 'Intensitas blur kaca', 'range', 0, 50, 1, 'px'],
    ['glassSat', 'Saturasi warna latar di balik kaca', 'range', 1, 3, 0.1, '×'],
    ['glassShine', 'Kilau permukaan', 'range', 0, 1, 0.05, ''],
    ['glassEdge', 'Kilau tepi', 'range', 0, 1, 0.05, ''],
    ['glassWarp', 'Pembiasan cairan (distorsi latar)', 'range', 0, 40, 1, ''],
    ['glassTint', 'Warna tint kaca', 'color']]],
  ['Panel kata di bawah (hover)', [
    ['showHover', 'Panel kata yang di-hover (Mode Baca)', 'check'],
    ['hpFs', 'Ukuran font Arab', 'range', 16, 72, 1, 'px'],
    ['hpColor', 'Warna teks Arab', 'color'],
    ['hpPgFs', 'Ukuran font Pegon', 'range', 10, 48, 1, 'px'],
    ['hpPgColor', 'Warna teks Pegon', 'color'],
    ['hpBg', 'Warna latar box', 'color'],
    ['hpRadius', 'Kelengkungan sudut box', 'range', 0, 40, 1, 'px'],
    ['hpPad', 'Ruang dalam box (kiri-kanan)', 'range', 6, 48, 1, 'px']]],
  ['Tooltip Pegon', [
    ['showTip', 'Tampilkan tooltip', 'check'],
    ['pgFs', 'Ukuran font Pegon', 'range', 10, 40, 1, 'px'],
    ['pgColor', 'Warna teks Pegon', 'color'],
    ['tipBg', 'Warna latar tooltip', 'color']]],
  ['Dhomir & Marju\'', [
    ['showDhomir', 'Tampilkan sorotan', 'check'],
    ['link', 'Warna garis & sorotan', 'color'],
    ['linkStyle', 'Gaya penghubung dhomir → marju\'', 'strchoice', [['garis', 'Garis (bawaan)'], ['alir', 'Putus-putus mengalir'], ['komet', 'Komet bercahaya'], ['panah', 'Panah'], ['titik', 'Titik-titik berjalan'], ['neon', 'Neon berdenyut'], ['pelangi', 'Pelangi berputar'],
      ['kunang', 'Kunang-kunang'], ['riak', 'Riak air'], ['kilat', 'Kilat listrik'], ['tinta', 'Pena menulis'], ['napas', 'Bernapas'], ['bintang', 'Taburan bintang'], ['untai', 'Untai ganda']]],
    ['linkW', 'Tebal penghubung', 'range', 1.5, 8, 0.5, 'px'],
    ['linkSide', 'Posisi garis rujuk', 'strchoice', [['auto', 'Otomatis (di bawah bila tooltip tampil)'], ['bawah', 'Selalu di bawah kata'], ['atas', 'Selalu di atas kata']]],
    ['dhSound', 'Efek suara pada kata berdhomir', 'check'],
    ['dhSoundStyle', 'Jenis suara dhomir', 'strchoice', [['lonceng', 'Lonceng kristal'], ['gelembung', 'Gelembung'], ['harpa', 'Harpa petik'], ['tetes', 'Tetes air']]],
    ['dhVol', 'Volume suara dhomir', 'range', 0, 1, 0.05, '']]],
  ['Penanda kedudukan nahwu', [
    ['showNahwu', 'Tampilkan penanda nahwu di atas kata', 'check'],
    ['nhAnim', 'Animasi penanda', 'strchoice', [['muncul', 'Muncul membal (sekali)'], ['gelombang', 'Bergelombang (bergerak terus)'], ['lompat', 'Melompat-lompat'], ['orbit', 'Berputar melingkar'], ['melayang', 'Melayang pelan'], ['denyut', 'Denyut bercahaya'], ['kilau', 'Berkilau'], ['goyang', 'Goyang bandul'], ['pelangi', 'Warna berganti'], ['sorot', 'Menyala saat disorot'], ['mati', 'Tanpa animasi']]],
    ['nhFs', 'Ukuran penanda (× ukuran teks Arab)', 'range', 0.25, 0.8, 0.01, '×'],
    ['nhColor', 'Warna penanda', 'color'],
    ['nhAlign', 'Posisi penanda di atas kata', 'strchoice', [['awal', 'Di awal kata (kanan, sebelum teks)'], ['tengah', 'Di tengah kata'], ['akhir', 'Di akhir kata (kiri)']]],
    ['nhY', 'Posisi vertikal penanda (+ naik, − turun)', 'range', -3, 2.5, 0.02, 'em'],
    ['nhX', 'Posisi horizontal penanda (+ kanan, − kiri)', 'range', -150, 150, 1, 'px']]],
  ['Catatan kalimat', [
    ['noteFs', 'Ukuran font catatan', 'range', 12, 48, 1, 'px'],
    ['noteW', 'Lebar box catatan (catatan di tengah layar)', 'range', 320, 1600, 10, 'px'],
    ['noteH', 'Tinggi maksimum box catatan (catatan di tengah layar)', 'range', 240, 1400, 10, 'px'],
    ['noteColor', 'Warna teks catatan', 'color'],
    ['noteBg', 'Warna box catatan', 'color']]],
  ['Panel', [['showInspector', 'Panel catatan kalimat', 'check'],
    ['centerNote', 'Catatan di tengah layar, latar di-blur (Mode Baca)', 'check'],
    ['noteBlur', 'Intensitas blur latar saat catatan tampil', 'range', 0, 30, 1, 'px']]]
];
const DEFAULTS = {
  theme: 'anggur', auroraAnim: true, liteMode: false, fs: 44, lh: 2.4, ws: 6, padX: 24, font: 'Amiri', arColor: null,
  extraFonts: [], scale: 1.15, glow: null, glowA: 0.35, blur: 20,
  showTip: true, pgFs: 16, pgColor: null, tipBg: null,
  hideHarakat: false, prOn: true, prColor: null, prFont: null, prFs: 1, prWeight: null, prItalic: false, prOp: 1, prMarks: true,
  showDhomir: true, link: null, showInspector: true, centerNote: true, noteBlur: 8, noteFs: 20, noteW: 620, noteH: 700, noteColor: null, noteBg: null, showHover: true,
  hovRadius: 12, hovRing: null, hovRingW: 0, linkStyle: 'garis', linkW: 2.5, hoverStyle: 'zoom', lang: 'id', clickSound: true, panelBlur: true, panelBlurAmt: 26, panelAlpha: 0.05, hoverMotion: 'melayang', mvSpeed: 1, linkSide: 'auto', dhSound: true, dhSoundStyle: 'lonceng', dhVol: 0.5,
  glassOn: false, glassA: 0.38, glassSat: 1.8, glassShine: 0.35, glassEdge: 0.6, glassWarp: 14, glassTint: null,
  hpFs: 32, hpColor: null, hpPgFs: 18, hpPgColor: null, hpBg: null, hpRadius: 24, hpPad: 22,
  showNahwu: true, nhAnim: 'gelombang', nhFs: 0.42, nhColor: null, nhAlign: 'awal', nhY: 0, nhX: 0
};
/* ---------- Tampilan global: tema, pengaturan, & perubahan Developer berlaku untuk SEMUA kitab ----------
   Disimpan di penyimpanan peramban aplikasi (bukan di file kitab), jadi membuka kitab lain tidak mengembalikan tampilan.
   Pertama kali (belum ada simpanan): pengaturan di file kitab dipakai, tetapi tema & gaya panel dipaksa ke bawaan baru (Anggur transparan). */
const LOOK_KEY = 'ngaji.look.v1';
let look = null;
try { look = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null'); } catch (e) { look = null; }
if (look && look.settings && typeof look.settings === 'object') {
  data.settings = look.settings;
  if (look.dev && typeof look.dev === 'object') data.dev = look.dev;
} else {
  data.settings = { ...(data.settings || {}), theme: DEFAULTS.theme, panelBlur: DEFAULTS.panelBlur, panelBlurAmt: DEFAULTS.panelBlurAmt, panelAlpha: DEFAULTS.panelAlpha, glassOn: DEFAULTS.glassOn };
}
let lookT = 0;
function saveLookNow() {
  clearTimeout(lookT); lookT = 0;
  try { localStorage.setItem(LOOK_KEY, JSON.stringify({ settings: data.settings, dev: data.dev || null })); } catch (e) { /* abaikan */ }
}
NGAJI.saveLook = () => { clearTimeout(lookT); lookT = setTimeout(saveLookNow, 250); };
NGAJI.isClickSoundOn = () => S.clickSound !== false;
window.addEventListener('beforeunload', () => { if (lookT) saveLookNow(); });
let S = { ...DEFAULTS, ...(data.settings || {}) };
delete S.harakat; // fitur warna harakat sudah dihapus; buang sisa pengaturan lama

const VARS = { fs: ['--fs', 'px'], lh: ['--lh', ''], ws: ['--ws', 'px'], padX: ['--pad-x', 'px'], arColor: ['--ar-color'],
  scale: ['--scale', ''], glow: ['--glow'], glowA: ['--glow-a', ''], blur: ['--blur', 'px'], pgFs: ['--pgfs', 'px'], pgColor: ['--pg-color'], tipBg: ['--tip-bg'], link: ['--link'], noteBlur: ['--note-blur', 'px'], noteFs: ['--note-fs', 'px'], noteW: ['--note-w', 'px'], noteH: ['--note-h', 'px'], noteColor: ['--note-color'], noteBg: ['--note-bg'],
  linkW: ['--link-w', 'px'], mvSpeed: ['--mv-speed', ''], panelBlurAmt: ['--pb-blur', 'px'], panelAlpha: ['--pb-a', ''],
  glassA: ['--gl-a', ''], glassSat: ['--gl-sat', ''], glassShine: ['--gl-shine', ''], glassEdge: ['--gl-edge', ''], glassTint: ['--gl-tint0'],
  hovRadius: ['--hov-r', 'px'], hovRing: ['--hov-ring'], hovRingW: ['--hov-ringw', 'px'],
  hpFs: ['--hp-fs', 'px'], hpColor: ['--hp-color'], hpPgFs: ['--hp-pgfs', 'px'], hpPgColor: ['--hp-pg-color'], hpBg: ['--hp-bg'], hpRadius: ['--hp-r', 'px'], hpPad: ['--hp-pad', 'px'],
  prColor: ['--pr-color'], prFs: ['--pr-fs', ''], prWeight: ['--pr-fw', ''], prOp: ['--pr-op', ''],
  nhFs: ['--nh-fs', ''], nhColor: ['--nh-color'], nhY: ['--nh-y', 'em'], nhX: ['--nh-x', 'px'] };

const LITE_NH_LOOPS = ['gelombang', 'lompat', 'orbit', 'melayang', 'denyut', 'kilau', 'goyang', 'pelangi'];
let nhAnimPrev = null, hkPrev = null, hpLast = null;
let themePrev = null, themeVT = null;
/* Ganti tema dengan transisi halus: cross-fade seluruh tampilan (warna, kaca, aurora, dan gambar latar tema bergambar).
   Dilewati saat pertama dimuat, Mode Lite, atau "kurangi gerakan" di sistem; tanpa View Transitions langsung berganti. */
function setThemeSmooth(theme) {
  if (root.dataset.theme === theme) { themePrev = theme; return; }
  const first = themePrev === null;
  themePrev = theme;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (first || reduce || S.liteMode || typeof document.startViewTransition !== 'function') { root.dataset.theme = theme; return; }
  if (themeVT) { try { themeVT.skipTransition(); } catch {} } // ganti beruntun: lompat ke tema terbaru
  root.classList.add('theme-fade');
  let vt;
  try { vt = document.startViewTransition(() => { root.dataset.theme = theme; }); }
  catch { root.dataset.theme = theme; root.classList.remove('theme-fade'); return; }
  themeVT = vt;
  const done = () => { if (themeVT === vt) { themeVT = null; root.classList.remove('theme-fade'); } };
  vt.finished.then(done, done);
  vt.ready.catch(() => {}); // dilewati (skipTransition) -> ready ditolak; tanpa ini muncul "Uncaught (in promise)" di konsol
}
function applySettings(persist = true) {
  setThemeSmooth(S.theme);
  root.style.setProperty('--font', `"${String(S.font || 'Amiri').replace(/"/g, '')}"`); // nama font dikutip: aman untuk nama berspasi/angka
  for (const [k, [v, unit = '']] of Object.entries(VARS)) {
    S[k] == null ? root.style.removeProperty(v) : root.style.setProperty(v, S[k] + unit);
  }
  S.prFont ? root.style.setProperty('--pr-font', `"${String(S.prFont).replace(/"/g, '')}"`) : root.style.removeProperty('--pr-font');
  S.prItalic ? root.style.setProperty('--pr-fi', 'italic') : root.style.removeProperty('--pr-fi');
  document.body.classList.toggle('no-pr', !S.prOn);
  document.body.classList.toggle('pr-nomark', !S.prMarks);
  document.body.classList.toggle('no-tip', !S.showTip);
  document.body.classList.toggle('no-aurora', !S.auroraAnim);
  document.body.classList.toggle('no-dhomir', !S.showDhomir);
  document.body.classList.toggle('no-nahwu', !S.showNahwu);
  const lite = !!S.liteMode;
  document.body.classList.toggle('lite', lite);
  const nhEff = lite && LITE_NH_LOOPS.includes(S.nhAnim) ? 'muncul' : (S.nhAnim || 'muncul'); // Mode Lite: animasi penanda yang berulang selamanya diganti muncul-sekali
  ['muncul', 'gelombang', 'lompat', 'orbit', 'melayang', 'denyut', 'kilau', 'goyang', 'pelangi', 'sorot', 'mati'].forEach(a => document.body.classList.toggle('nha-' + a, a === nhEff));
  if (nhAnimPrev !== null && nhAnimPrev !== (S.nhAnim || 'muncul')) setTimeout(() => nhEnter(), 0); // pratinjau: penanda muncul lagi saat gaya diganti
  nhAnimPrev = S.nhAnim || 'muncul';
  ['awal', 'tengah', 'akhir'].forEach(a => document.body.classList.toggle('nh-' + a, a === (S.nhAlign || 'awal')));
  document.body.classList.toggle('no-insp', !S.showInspector);
  document.body.classList.toggle('hp', mode === 'read' && !!S.showHover);
  ['zoom', 'angkat', 'kaca', 'garis', 'kilau', 'neon', 'miring', 'cahaya'].forEach(h => document.body.classList.toggle('hv-' + h, h === (S.hoverStyle || 'zoom')));
  ['melayang', 'ayun', 'denyut', 'orbit', 'lompat'].forEach(m => document.body.classList.toggle('mv-' + m, m === S.hoverMotion));
  document.body.classList.toggle('mv-on', ['melayang', 'ayun', 'denyut', 'orbit', 'lompat'].includes(S.hoverMotion));
  document.body.classList.toggle('pb', !lite && !!S.panelBlur);                       // Mode Lite: tanpa backdrop-filter sama sekali
  document.body.classList.toggle('lq', !lite && !!S.glassOn);
  document.body.classList.toggle('lq-warp', !lite && !!S.glassOn && +S.glassWarp > 0);
  const disp = document.getElementById('lqDisp'); if (disp) disp.setAttribute('scale', lite ? 0 : (S.glassWarp || 0));
  const liteBtn = document.getElementById('liteBtn'); if (liteBtn) { liteBtn.classList.toggle('on', lite); liteBtn.setAttribute('aria-pressed', lite ? 'true' : 'false'); }
  if (window.NGAJI_I18N) NGAJI_I18N.set(S.lang || 'id');
  data.settings = { ...S };
  NGAJI.saveLook();
  if (persist) touch();
  syncDrawers();
  const hk = document.getElementById('harakatBtn'); if (hk) { hk.classList.toggle('on', !!S.hideHarakat); hk.setAttribute('aria-pressed', S.hideHarakat ? 'true' : 'false'); }
  const cs = document.getElementById('clickSoundBtn');
  if (cs) {
    const on = S.clickSound !== false;
    cs.classList.toggle('on', on);
    cs.setAttribute('aria-pressed', on ? 'true' : 'false');
    cs.title = on ? 'Matikan suara klik' : 'Nyalakan suara klik';
    cs.querySelector('use').setAttribute('href', on ? '#i-vol' : '#i-mute');
  }
  if (hkPrev !== null && hkPrev !== !!S.hideHarakat) { hkPrev = !!S.hideHarakat; render(); if (hpLast) showPanel(hpLast); } // ganti tampilan harakat: gambar ulang teks
  hkPrev = !!S.hideHarakat;
}

// Slider / pemilih warna menembakkan puluhan event per detik: nilai S langsung diperbarui, tetapi seluruh applySettings (±100 variabel CSS, kelas body, sinkron panel) cukup sekali per frame.
let applyRaf = 0;
function applySettingsSoon() {
  data.settings = { ...S }; NGAJI.saveLook(); touch(); // tetap tersimpan walau jendela ditutup sebelum frame berikutnya
  if (applyRaf) return;
  applyRaf = requestAnimationFrame(() => { applyRaf = 0; applySettings(false); });
}

/* ---------- Font (mode offline): font bawaan, file font yang ditambahkan, dan font sistem ---------- */
const BASE_FONTS = ['Amiri', 'Scheherazade New', 'Noto Naskh Arabic', 'Arabic Typesetting'];
let userFonts = []; // keluarga font dari folder font aplikasi (diisi oleh aplikasi desktop)
const fontOptions = () => [...new Set([...BASE_FONTS, ...userFonts, ...(S.extraFonts || []), S.font].filter(Boolean))];
const reloadFontCss = () => { const l = document.querySelector('link[href^="fonts.css"]'); if (l) l.href = 'fonts.css?v=' + Date.now(); };
let sysFontsLoaded = false;
async function fillSystemFonts(dl) {
  if (sysFontsLoaded || !window.queryLocalFonts) return;
  sysFontsLoaded = true;
  try {
    const fams = [...new Set((await window.queryLocalFonts()).map(f => f.family))].sort((a, b) => a.localeCompare(b));
    dl.innerHTML = fams.map(f => `<option value="${esc(f)}">`).join('');
  } catch (e) { sysFontsLoaded = false; /* izin ditolak / tidak didukung: tetap bisa mengetik nama font */ }
}
function useFont(name) {
  name = String(name || '').trim(); if (!name) return;
  if (!BASE_FONTS.includes(name) && !userFonts.includes(name)) S.extraFonts = [...new Set([...(S.extraFonts || []), name])];
  S.font = name; applySettings(); buildSettings();
}
function buildFontTools(row) {
  row.classList.add('tools');
  row.innerHTML = `<label>Font lain — bekerja tanpa internet</label>
    <input type="text" list="sysFonts" placeholder="Ketik nama font yang terpasang di komputer…" autocomplete="off" spellcheck="false"><datalist id="sysFonts"></datalist>
    <small class="hint">Contoh: Traditional Arabic, Sakkal Majalla. Tekan Enter untuk memakai.</small>
    <button type="button" class="btn btn-sm btn-tonal">Tambah file font (.ttf / .otf)…</button>`;
  const inp = row.querySelector('input'), dl = row.querySelector('datalist');
  inp.onfocus = () => fillSystemFonts(dl);
  inp.onchange = () => { if (inp.value.trim()) { useFont(inp.value); NGAJI.toast(`Font "${inp.value.trim()}" dipakai. Bila tidak terpasang di komputer ini, tampilan memakai Amiri.`); } };
  row.querySelector('button').onclick = async () => {
    const r = await NGAJI.addFonts();
    if (r && r.ok && r.added.length) { reloadFontCss(); userFonts = [...new Set([...userFonts, ...r.added])]; useFont(r.added[0]); NGAJI.toast('Font ditambahkan: ' + r.added.join(', ')); }
    else if (r && !r.canceled) NGAJI.toast(r.error || 'Font tidak dapat ditambahkan.');
  };
}

const openGroups = new Set(); // grup pengaturan yang sedang dibuka; kosong = semua tertutup (bawaan). Diingat selama aplikasi berjalan agar tidak menutup sendiri saat panel dibangun ulang
function buildSettings() {
  const body = $('#setBody'); body.innerHTML = '';
  for (const [group, items] of SCHEMA) {
    const d = document.createElement('details'); d.open = openGroups.has(group);
    d.addEventListener('toggle', () => { d.open ? openGroups.add(group) : openGroups.delete(group); });
    d.innerHTML = `<summary>${group}</summary>`;
    for (const [key, label, type, a, b, step, unit] of items) {
      const row = document.createElement('div'); row.className = 'row';
      const val = S[key];
      if (type === 'fonttools') { buildFontTools(row); d.appendChild(row); continue; }
      if (type === 'hint') { row.className = 'row hint-row'; row.innerHTML = `<small class="hint">${esc(label)}</small>`; d.appendChild(row); continue; }
      if (type === 'range') {
        row.innerHTML = `<label>${label}</label><small>${val}${unit}</small><input type="range" min="${a}" max="${b}" step="${step}" value="${val}">`;
        row.querySelector('input').oninput = e => { S[key] = +e.target.value; row.querySelector('small').textContent = S[key] + unit; applySettingsSoon(); };
      } else if (type === 'prfont') {
        const SAME = 'Sama dengan font Arab', opts = [SAME, ...new Set([...fontOptions(), S.prFont].filter(Boolean))];
        row.innerHTML = `<label>${label}</label><select>${opts.map(o => `<option ${(o === (S.prFont || SAME)) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        row.querySelector('select').onchange = e => { S.prFont = e.target.value === SAME ? null : e.target.value; applySettings(); };
      } else if (type === 'choice') {
        row.innerHTML = `<label>${label}</label><select>${a.map(([v, l]) => `<option value="${v == null ? '' : v}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        row.querySelector('select').onchange = e => { S[key] = e.target.value === '' ? null : +e.target.value; applySettings(); };
      } else if (type === 'strchoice') {
        row.innerHTML = `<label>${label}</label><select>${a.map(([v, l]) => `<option value="${v}" ${v === (val || a[0][0]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        row.querySelector('select').onchange = e => { S[key] = e.target.value; applySettings(); };
      } else if (type === 'select') {
        row.innerHTML = `<label>${label}</label><select>${(typeof a === 'function' ? a() : a).map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        row.querySelector('select').onchange = e => { S[key] = e.target.value; applySettings(); };
      } else if (type === 'color') {
        row.innerHTML = `<label>${label}</label><input type="color" value="${val || '#888888'}">`;
        row.querySelector('input').oninput = e => { S[key] = e.target.value; applySettingsSoon(); };
      } else {
        row.innerHTML = `<label>${label}</label><input type="checkbox" ${val ? 'checked' : ''}>`;
        row.querySelector('input').onchange = e => { S[key] = e.target.checked; if (key === 'centerNote') { clearSel(); render(); } applySettings(); };
      }
      d.appendChild(row);
    }
    body.appendChild(d);
  }
}

/* ---------- State ---------- */
let pi = 0, mode = 'read', sel = { sid: null, wid: null };
let subTitleOnly = false; // true: klik bab di daftar isi -> hanya judul sub bab pertama yang tampil
let subSid = null; // bila terisi (Mode Baca): hanya tampilkan satu sub bab ini
const drawers = { toc: false, inspector: false, settings: false };
const CV_MIN = 600; // jumlah paragraf per bab di Mode Edit yang memicu content-visibility
const TL_BACK = 15, TL_FWD = 5; // jendela kalimat pada daftar centang marju'
const clearSel = () => { sel = { sid: null, wid: null, rid: null, fid: null }; };
const page = () => data.pages[pi];
const allWords = () => page().sentences.flatMap(s => s.words);
// pencarian kata/kalimat O(1) (sebelumnya memindai seluruh kata di setiap hover/ketikan)
let idxPage = null, idxVer = -1, wIdx = new Map(), sIdx = new Map(), wsIdx = new Map();
function ensureIdx() {
  const p = page();
  if (idxPage === p && idxVer === dataVer) return;
  wIdx = new Map(); sIdx = new Map(); wsIdx = new Map();
  p.sentences.forEach(st => { sIdx.set(st.id, st); st.words.forEach(w => { wIdx.set(w.id, w); wsIdx.set(w.id, st); }); });
  idxPage = p; idxVer = dataVer;
}
const sentence = id => { ensureIdx(); return sIdx.get(id); };
const word = id => { ensureIdx(); return wIdx.get(id); };
// Huruf = satu huruf dasar + harakat yang menempel padanya
// Harakat & tanda baca Arab di atas / bawah huruf (fathah, kasrah, dhammah, tanwin, sukun, syaddah, alif khanjariah, tanda Quran kecil)
const HARAKAT_RE = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
const stripH = t => String(t ?? '').replace(HARAKAT_RE, '');
const showAr = t => S.hideHarakat ? stripH(t) : String(t ?? ''); // teks Arab untuk tampilan (indeks huruf dhomir tetap sama: yang dibuang hanya tanda di dalam tiap huruf)
const letters = t => String(t ?? '').match(/[^\u064B-\u065F\u0670][\u064B-\u065F\u0670]*|[\u064B-\u065F\u0670]+/g) || [];
// Marju' boleh lebih dari satu kata (dhomir_target_ids). Data lama (dhomir_target_id tunggal) tetap terbaca.
const targets = w => Array.isArray(w.dhomir_target_ids) ? w.dhomir_target_ids : (w.dhomir_target_id ? [w.dhomir_target_id] : []);
function setTargets(w, ids) {
  ids = [...new Set(ids)];
  w.dhomir_target_ids = ids; w.dhomir_target_id = ids[0] || null; // dhomir_target_id = kata pertama (kompatibilitas)
}
/* ---------- Penanda kedudukan nahwu (ala makna gandul pesantren) ----------
   Huruf singkatan kedudukan kata (mis. م = mubtada', خ = khobar) ditulis kecil di ATAS kata, di awal (sebelum) teksnya.
   Data per kata: w.nahwu = kunci dari daftar di bawah ("custom" = tulis sendiri), w.nahwuLabel = tulisan penanda (opsional, menimpa bawaan).
   Singkatan di bawah adalah bawaan yang lazim; tiap kata bisa memakai tulisan sendiri lewat kolom "Tulisan penanda". */
const NAHWU = [ // [kunci, singkatan, nama (latin), nama Arab]
  ['mubtada', 'م', "Mubtada'", 'مبتدأ'],
  ['khobar', 'خ', 'Khobar', 'خبر'],
  ['fiil', 'فع', "Fi'il", 'فعل'],
  ['fail', 'ف', "Fa'il", 'فاعل'],
  ['naibfail', 'نف', "Naibul fa'il", 'نائب فاعل'],
  ['mafulbih', 'مف', "Maf'ul bih", 'مفعول به'],
  ['mafulmutlaq', 'مط', "Maf'ul muthlaq", 'مفعول مطلق'],
  ['mafulliajlih', 'مل', "Maf'ul li ajlih", 'مفعول لأجله'],
  ['zharaf', 'ظ', 'Zharaf', 'ظرف'],
  ['hal', 'ح', 'Hal', 'حال'],
  ['tamyiz', 'تم', 'Tamyiz', 'تمييز'],
  ['isimkana', 'اك', 'Isim kana', 'اسم كان'],
  ['khobarkana', 'خك', 'Khobar kana', 'خبر كان'],
  ['isiminna', 'اإ', 'Isim inna', 'اسم إن'],
  ['khobarinna', 'خإ', 'Khobar inna', 'خبر إن'],
  ['mudhaf', 'مض', 'Mudhaf', 'مضاف'],
  ['mudhafilaih', 'إ', 'Mudhaf ilaih', 'مضاف إليه'],
  ['naat', 'ن', "Na'at (sifat)", 'نعت'],
  ['athaf', 'عط', "Ma'thuf", 'معطوف'],
  ['taukid', 'تو', 'Taukid', 'توكيد'],
  ['badal', 'بد', 'Badal', 'بدل'],
  ['jarmajrur', 'جر', 'Jar majrur', 'جار ومجرور'],
  ['syarat', 'ش', 'Syarat', 'شرط'],
  ['jawab', 'ج', 'Jawab syarat', 'جواب الشرط'],
  ['munada', 'ند', 'Munada', 'منادى'],
  ['mustatsna', 'است', 'Mustatsna', 'مستثنى'],
  ['custom', '…', 'Lainnya', 'أخرى']
];
const NAHWU_BY = Object.fromEntries(NAHWU.map(x => [x[0], x]));
// tulisan penanda yang tampil di atas kata ('' = tidak ada penanda)
const nahwuLabel = w => {
  if (!w || !w.nahwu) return '';
  const own = typeof w.nahwuLabel === 'string' ? w.nahwuLabel.trim() : '';
  return own || (w.nahwu !== 'custom' && NAHWU_BY[w.nahwu] ? NAHWU_BY[w.nahwu][1] : '');
};
const nahwuHtml = w => { const t = nahwuLabel(w); return t ? `<span class="nh" aria-hidden="true">${esc(t)}</span>` : ''; };
const nhSummary = w => { const t = nahwuLabel(w); if (!t) return 'belum dipilih'; const nm = w.nahwu !== 'custom' && NAHWU_BY[w.nahwu] ? NAHWU_BY[w.nahwu][2] : ''; return nm ? `${t} · ${nm}` : t; };
const nahwuName = w => (w && w.nahwu && NAHWU_BY[w.nahwu] && w.nahwu !== 'custom') ? NAHWU_BY[w.nahwu][3] : '';

/* ---------- Teks dalam tanda kurung ( ) ----------
   Teks di antara "(" dan ")" (boleh melewati beberapa kata dalam satu paragraf) dibungkus <span class="pr"> agar bisa diberi gaya sendiri.
   Tanda kurung di pangkal / ujung kata dikeluarkan dari kotak .word (pre / post) sehingga tidak ikut tersorot saat hover. */
const isParen = c => c[0] === '(' || c[0] === ')';
const PUNCT_RE = /^[\s.,;:!?،؛؟۔…"'«»“”„‘’‹›\[\]{}\-–—·•*\/\\|~﴾﴿\u200c-\u200f\u202a-\u202e\u2066-\u2069]+$/;
const isPunctL = c => isParen(c) || PUNCT_RE.test(c);
// batas huruf inti kata (tanpa tanda baca di pangkal / ujung); a >= b berarti token hanya berisi tanda baca
function coreBounds(ls) {
  let a = 0, b = ls.length;
  while (a < b && isPunctL(ls[a])) a++;
  while (b > a && isPunctL(ls[b - 1])) b--;
  return [a, b];
}
const coreText = w => { const ls = letters(w.arab), [a, b] = coreBounds(ls); return a >= b ? String(w.arab || '') : ls.slice(a, b).join(''); };
const okColor = c => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null;
const parenMark = c => `<span class="pr pr-mk">${esc(c)}</span>`;
// depth = kedalaman kurung buka sebelum kata ini; hasil: { pre, core, post, depth }
function wordRender(w, depth = 0) {
  const ls = letters(w.arab), on = new Set(w.dhomir_letters || []), n = ls.length, hh = !!S.hideHarakat;
  let [a, b] = coreBounds(ls);
  const only = a >= b; // token hanya tanda baca: tidak ikut di-hover
  if (only) { a = n; b = n; }
  let d = depth, pre = '', core = '', post = '', open = false;
  const step = c => { if (c[0] === '(') d++; else if (c[0] === ')') d = Math.max(0, d - 1); };
  for (let i = 0; i < n; i++) {
    const c = hh ? stripH(ls[i]) : ls[i];
    if (i < a || i >= b) { step(c); const h = isParen(c) ? parenMark(c) : esc(c); if (i < a) pre += h; else post += h; continue; }
    let h, inP = false;
    if (isParen(c)) { step(c); h = parenMark(c); }
    else { inP = d > 0; h = on.has(i) ? `<span class="dl">${esc(c)}</span>` : esc(c); }
    if (inP && !open) { core += '<span class="pr">'; open = true; }
    else if (!inP && open) { core += '</span>'; open = false; }
    core += h;
  }
  if (open) core += '</span>';
  return { pre, core, post, depth: d, only };
}
// kedalaman kurung buka di awal kata (dihitung dari kata-kata sebelumnya dalam paragraf yang sama)
function parenDepthBefore(st, wid) {
  let d = 0;
  for (const x of st.words) {
    if (x.id === wid) break;
    for (const ch of String(x.arab ?? '')) { if (ch === '(') d++; else if (ch === ')') d = Math.max(0, d - 1); }
  }
  return d;
}
// untuk panel hover: kata utuh, tanda kurung ikut ditampilkan (tidak ada kotak sorotan di sini)
// warna efektif sebuah kata: warna kata > warna kalimat pilihan > warna paragraf
function colorOf(w) {
  if (okColor(w.color)) return w.color;
  const st = wsIdx.get(w.id); if (!st) return null;
  const i = st.words.indexOf(w); let c = null;
  for (const r of st.rentang || []) { const x = rangeIdx(st, r); if (x && okColor(r.warna) && i >= x[0] && i <= x[1]) c = r.warna; }
  return c || okColor(st.color);
}
const wordHtml = (w, depth = 0) => { const r = wordRender(w, depth); return r.core; }; // panel bawah: tanda baca tidak ikut tampil
// Hapus kata-kata tertentu dari daftar marju' semua kata
const dropTargets = (ids, pg = page()) => pg.sentences.flatMap(s => s.words).forEach(w => {
  if (targets(w).some(t => ids.includes(t))) setTargets(w, targets(w).filter(t => !ids.includes(t)));
});
let uidN = 0;
const uid = p => `${p}-${Date.now().toString(36)}${(++uidN).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const newWord = a => ({ id: uid('w'), arab: a, pegon: '', dhomir_target_id: null, dhomir_target_ids: [], dhomir_letters: [] });
// satu blok (paragraf / judul / sub bab). type: text | heading | sub ; align: right | center | left | justify | null
const newSentence = (text, o = {}) => ({
  id: uid('s'), type: o.type || 'text', align: o.align || null, bold: !!o.bold,
  words: String(text).split(/\s+/).filter(Boolean).map(newWord), keterangan_kalimat: { catatan: '' }
});
const sentCls = s => `t-${s.type || 'text'} al-${s.align || 'right'}${s.bold ? ' bold' : ''}`;
const subsOf = p => p.sentences.filter(s => s.type === 'sub');
const sentText = s => s.words.map(w => w.arab).join(' ');

/* ---------- Tampilan satu sub bab ---------- */
// kalimat yang tampil: seluruh bab, atau hanya satu sub bab (dari judul sub bab itu sampai sub bab berikutnya)
function visibleSentences() {
  const arr = page().sentences;
  if (mode !== 'read' || !subSid) return arr;
  const k = arr.findIndex(s => s.id === subSid && s.type === 'sub');
  if (k < 0) { subSid = null; return arr; }
  let e = k + 1; while (e < arr.length && arr[e].type !== 'sub') e++;
  return subTitleOnly ? arr.slice(k, k + 1) : arr.slice(k, e);
}
const allSubs = () => data.pages.flatMap((p, i) => subsOf(p).map(s => ({ i, s })));
function stepNav(d) {
  if (mode === 'read' && subSid) {
    const list = allSubs(), k = list.findIndex(x => x.s.id === subSid && x.i === pi);
    if (subTitleOnly && d > 0) { goTo(pi, subSid); return; } // dari tampilan judul saja -> buka isi sub bab pertama
    const t = list[k + d];
    if (t) goTo(t.i, t.s.id);
  } else goTo(pi + d);
}
function showWholePage() {
  const sid = subSid; subSid = null; subTitleOnly = false; render();
  const el = sid && reader.querySelector(`[data-sid="${CSS.escape(sid)}"]`);
  if (el) el.scrollIntoView({ block: 'start' });
}

/* ---------- Kalimat pilihan manual (rentang kata + catatan) ---------- */
// s.rentang = [{ id, dari: id kata pertama, sampai: id kata terakhir, catatan }] — rentang selalu di dalam satu paragraf (blok)
const mj = { on: false }; // Mode Edit: klik langsung kata di teks tengah untuk menandainya sebagai marju' dari kata terpilih
const mjOff = () => { if (mj.on) { mj.on = false; document.body.classList.remove('mj-pick'); } };
const pick = { on: false, a: null }; // a = { sid, wid }: kata pertama yang sudah diklik
const rangeIdx = (s, r) => {
  const a = s.words.findIndex(w => w.id === r.dari), b = s.words.findIndex(w => w.id === r.sampai);
  return a < 0 || b < 0 ? null : [Math.min(a, b), Math.max(a, b)];
};
const rangeWords = (s, r) => { const x = rangeIdx(s, r); return x ? s.words.slice(x[0], x[1] + 1) : []; };
const rangeText = (s, r) => rangeWords(s, r).map(w => w.arab).join(' ');
// rentang terkecil yang memuat kata ini (rentang yang sedang dipilih diutamakan)
function rangeAt(s, wid) {
  const i = s.words.findIndex(w => w.id === wid); if (i < 0) return null;
  const hit = (s.rentang || []).map(r => ({ r, x: rangeIdx(s, r) })).filter(o => o.x && i >= o.x[0] && i <= o.x[1]);
  if (!hit.length) return null;
  const cur = hit.find(o => o.r.id === sel.rid && s.id === sel.sid);
  return (cur || hit.sort((a, b) => (a.x[1] - a.x[0]) - (b.x[1] - b.x[0]))[0]).r;
}
// setelah kata dihapus: rapikan ujung rentang / buang rentang yang kosong
function fixRanges(s, old) {
  if (!s.rentang) return;
  const alive = new Set(s.words.map(w => w.id));
  s.rentang = s.rentang.map(r => {
    const a = old.findIndex(w => w.id === r.dari), b = old.findIndex(w => w.id === r.sampai);
    if (a < 0 || b < 0) return null;
    const ids = old.slice(Math.min(a, b), Math.max(a, b) + 1).map(w => w.id).filter(id => alive.has(id));
    return ids.length ? { ...r, dari: ids[0], sampai: ids[ids.length - 1] } : null;
  }).filter(Boolean);
  if (!s.rentang.length) delete s.rentang;
  if (sel.rid && !(s.rentang || []).some(r => r.id === sel.rid)) sel.rid = null;
}
function setPick(on) {
  const old = pick.a;
  pick.on = !!on; pick.a = null; if (pick.on) { mjOff(); if (fp.on) fpReset(true); }
  document.body.classList.toggle('picking', pick.on);
  if (pick.on) NGAJI.toast('Klik kata pertama kalimat, lalu klik kata terakhirnya.');
  refreshBlocks(old && old.sid); renderInspector();
}
function handlePick(sid, wid) {
  if (!pick.a || pick.a.sid !== sid) {
    if (pick.a) NGAJI.toast('Kata terakhir harus satu paragraf dengan kata pertama — kata pertama dipindah ke sini.');
    const old = pick.a; pick.a = { sid, wid }; refreshBlocks(old && old.sid, sid); renderInspector(); return;
  }
  const st = sentence(sid), i = st.words.findIndex(w => w.id === pick.a.wid), j = st.words.findIndex(w => w.id === wid);
  if (i < 0 || j < 0) { pick.a = null; renderReader(); return; }
  const dari = st.words[Math.min(i, j)].id, sampai = st.words[Math.max(i, j)].id;
  let r = (st.rentang || []).find(x => x.dari === dari && x.sampai === sampai);
  if (!r) { r = { id: uid('r'), dari, sampai, catatan: '' }; (st.rentang ||= []).push(r); touch(); }
  pick.on = false; pick.a = null; document.body.classList.remove('picking');
  sel = { sid, wid: null, rid: r.id };
  openDrawer('inspector'); render(); syncDrawers();
  $('#inspBody [data-rn]')?.focus();
}

/* ---------- Makna Pegon untuk beberapa kata sekaligus (frasa) ----------
   s.frasa = [{ id, dari: id kata pertama, sampai: id kata terakhir, pegon }] — kata-kata berurutan dalam satu paragraf, satu makna.
   Di Mode Edit: klik sebanyak apa pun kata (2 atau lebih); kata di antaranya ikut terpilih. Hover di salah satu kata menyorot seluruh frasa dan menampilkan maknanya. */
const fp = { on: false, sid: null, idx: new Set() };
let nhMin = false; try { nhMin = localStorage.getItem('ngaji.nhMin') === '1'; } catch (e) {}
const fpRange = () => fp.idx.size ? [Math.min(...fp.idx), Math.max(...fp.idx)] : null;
function frasaAt(s, wid) {
  if (!s || !s.frasa) return null;
  const i = s.words.findIndex(w => w.id === wid); if (i < 0) return null;
  const hit = s.frasa.map(r => ({ r, x: rangeIdx(s, r) })).filter(o => o.x && i >= o.x[0] && i <= o.x[1]);
  if (!hit.length) return null;
  const cur = hit.find(o => o.r.id === sel.fid && s.id === sel.sid);
  return (cur || hit.sort((a, b) => (a.x[1] - a.x[0]) - (b.x[1] - b.x[0]))[0]).r;
}
function fixFrasa(s, old) { // setelah kata dihapus: rapikan ujung frasa / buang yang kosong
  if (!s.frasa) return;
  const alive = new Set(s.words.map(w => w.id));
  s.frasa = s.frasa.map(r => {
    const a = old.findIndex(w => w.id === r.dari), b = old.findIndex(w => w.id === r.sampai);
    if (a < 0 || b < 0) return null;
    const ids = old.slice(Math.min(a, b), Math.max(a, b) + 1).map(w => w.id).filter(id => alive.has(id));
    return ids.length ? { ...r, dari: ids[0], sampai: ids[ids.length - 1] } : null;
  }).filter(Boolean);
  if (!s.frasa.length) delete s.frasa;
  if (sel.fid && !(s.frasa || []).some(r => r.id === sel.fid)) sel.fid = null;
}
function fpReset(refresh) {
  const old = fp.sid; fp.on = false; fp.sid = null; fp.idx.clear();
  document.body.classList.remove('fpicking');
  if (refresh) { refreshBlocks(old); renderInspector(); }
}
function setFp(on) {
  if (!on) { fpReset(true); return; }
  mjOff(); pick.on = false; pick.a = null; document.body.classList.remove('picking');
  fp.on = true; fp.sid = sel.sid; fp.idx.clear();
  document.body.classList.add('fpicking');
  NGAJI.toast('Klik kata-kata yang akan diberi satu makna Pegon (2 kata atau lebih), lalu tekan Simpan.');
  refreshBlocks(sel.sid); renderInspector();
}
function handleFp(sid, wid) {
  const st = sentence(sid), i = st.words.findIndex(w => w.id === wid); if (i < 0) return;
  const oldSid = fp.sid;
  if (fp.sid !== sid) { fp.sid = sid; fp.idx.clear(); }
  if (!fp.idx.size) { sel.sid = sid; sel.wid = wid; }
  fp.idx.has(i) ? fp.idx.delete(i) : fp.idx.add(i);
  refreshBlocks(oldSid, sid, sel.sid); renderInspector();
}
function saveFp() {
  const st = fp.sid && sentence(fp.sid), x = fpRange();
  if (!st || !x || x[1] - x[0] < 1) { NGAJI.toast('Pilih minimal 2 kata.'); return; }
  const dari = st.words[x[0]].id, sampai = st.words[x[1]].id;
  let r = (st.frasa || []).find(f => f.dari === dari && f.sampai === sampai);
  if (!r) { r = { id: uid('f'), dari, sampai, pegon: '' }; (st.frasa ||= []).push(r); touch(); }
  const sid = fp.sid; fpReset(false);
  sel = { sid, wid: dari, rid: null, fid: r.id };
  render();
  $('#inspBody [data-fp]')?.focus();
}

/* ---------- Render pembaca ---------- */
const reader = $('#reader');
// Perbarui hanya blok / kata yang berubah (bukan seluruh halaman) -> tidak lag saat mengetik atau memilih kata
function refreshBlocks(...ids) {
  new Set(ids.filter(Boolean)).forEach(id => {
    const el = reader.querySelector(`.sentence[data-sid="${CSS.escape(id)}"]`), st = sentence(id);
    if (el && st) { el.outerHTML = blockHtml(st); subElsCache = null; }
  });
}
const rwPending = new Set(); let rwRaf = 0;
function refreshWord(id) {
  ensureIdx(); const st = wsIdx.get(id) || null;
  if (!st) return;
  rwPending.add(st.id); // satu paragraf: tanda kurung pada satu kata bisa mengubah gaya kata-kata sesudahnya
  if (rwRaf) return;
  rwRaf = requestAnimationFrame(() => { rwRaf = 0; const ids = [...rwPending]; rwPending.clear(); refreshBlocks(...ids); }); // digabung per frame: mengetik cepat tidak merender ulang paragraf tiap huruf
}
function blockHtml(s) {
  const any = new Set(); let selR = null;
  (s.rentang || []).forEach(r => {
    const x = rangeIdx(s, r); if (!x) return;
    for (let i = x[0]; i <= x[1]; i++) any.add(i);
    if (s.id === sel.sid && r.id === sel.rid) selR = x;
  });
  let depth = 0, anyNh = false;
  const mjSet = mj.on && mode === 'edit' && sel.wid && word(sel.wid) ? new Set(targets(word(sel.wid))) : null;
  const frOf = [], frSel = []; let fpR = null;
  (s.frasa || []).map(r => ({ r, x: rangeIdx(s, r) })).filter(o => o.x).sort((a, b) => (b.x[1] - b.x[0]) - (a.x[1] - a.x[0])).forEach(({ r, x }) => { // yang paling kecil menimpa
    for (let i = x[0]; i <= x[1]; i++) frOf[i] = r.id;
    if (mode === 'edit' && s.id === sel.sid && r.id === sel.fid) for (let i = x[0]; i <= x[1]; i++) frSel[i] = true;
  });
  if (fp.on && mode === 'edit' && fp.sid === s.id) fpR = fpRange();
  const rngCol = [];
  (s.rentang || []).forEach(r => { const x = rangeIdx(s, r); if (x && okColor(r.warna)) for (let i = x[0]; i <= x[1]; i++) rngCol[i] = r.warna; });
  const words = s.words.map((w, i) => {
    const r = wordRender(w, depth); depth = r.depth;
    const c = ['word'];
    if (r.only) c.push('pt-only');
    const col = okColor(w.color) || rngCol[i] || null, sty = col ? ` style="color:${col}"` : '';
    if (w.id === sel.wid && mode === 'edit') c.push('picked');
    if (any.has(i)) c.push('in-rng');
    if (selR && i >= selR[0] && i <= selR[1]) c.push('rng-sel');
    if (selR && i === selR[0]) c.push('rng-a');
    if (selR && i === selR[1]) c.push('rng-z');
    if (pick.a && pick.a.wid === w.id) c.push('pick-a');
    if (mjSet && mjSet.has(w.id)) c.push('mj-on');
    if (r.only) return `<span class="${c.join(' ')}" data-id="${w.id}"${sty}>${r.pre}</span>`;
    if (frOf[i]) c.push('in-fr');
    if (frSel[i]) c.push('fr-sel');
    if (fpR && i >= fpR[0] && i <= fpR[1]) c.push('fp-on');
    if (fpR && fp.idx.has(i)) c.push('fp-a');
    const nh = nahwuHtml(w); if (nh) { c.push('has-nh'); anyNh = true; }
    const inner = `<span class="${c.join(' ')}" data-id="${w.id}"${frOf[i] ? ` data-fr="${frOf[i]}"` : ''}${sty}>${r.core}${nh}</span>`;
    return r.pre || r.post ? `<span class="wg"${sty}>${r.pre}${inner}${r.post}</span>` : inner; // .wg: tanda kurung tidak terpisah dari kata saat pindah baris
  }).join(' ');
  const ssty = okColor(s.color) ? ` style="color:${s.color}"` : '';
  return `<div class="sentence ${sentCls(s)} ${s.id === sel.sid ? 'selected' : ''}${anyNh ? ' has-nh' : ''}" data-sid="${s.id}"${ssty}>${words}</div>`;
}
function renderReader() {
  subElsCache = null;
  const p = page();
  const vis = visibleSentences();
  reader.innerHTML = `<h2 class="page-title" dir="rtl">${esc(showAr(p.title || 'Bab ' + (pi + 1)))}</h2>` +
    (mode === 'read' && subSid ? `<div class="sub-banner" dir="ltr"><span>${subTitleOnly ? 'Hanya menampilkan judul sub bab pertama' : 'Hanya menampilkan satu sub bab'}</span><button type="button" class="btn btn-sm btn-tonal" id="showWhole">Tampilkan seluruh bab</button></div>` : '') +
    (vis.length ? vis.map(blockHtml).join('') : '<div class="empty">Halaman ini belum berisi kalimat. Pindah ke Mode Edit untuk menambahkan.</div>') +
    (vis.length ? doneBarHtml() : '');
  // Mode Edit + bab sangat besar: lewati layout paragraf di luar layar, dengan perkiraan tinggi dari rata-rata kata per paragraf (bukan 140px tetap)
  const big = mode === 'edit' && vis.length > CV_MIN;
  reader.classList.toggle('cv', big);
  if (big) {
    const nw = vis.reduce((a, s) => a + s.words.length, 0) / vis.length;
    const perLine = Math.max(1, Math.floor(Math.max(200, stageEl.clientWidth - 2 * (+S.padX || 24)) / ((+S.fs || 44) * 1.9 + (+S.ws || 6))));
    reader.style.setProperty('--ci-h', Math.round(Math.max(1, Math.ceil(nw / perLine)) * (+S.fs || 44) * (+S.lh || 2.4) + 24) + 'px');
  }
}
/* ---------- Area baca menyesuaikan panel (animasi FLIP per kata: layout langsung final, kata meluncur ke posisi barunya) ---------- */
const stageEl = $('#stage'), reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let flipAnims = [], flipToken = 0;
const FLIP = NGAJI.flip = { ms: 720, ease: 'cubic-bezier(.4,0,.1,1)', wave: 140 }; // mulai lembut, melambat panjang di akhir; gelombang tunda dari atas ke bawah (bisa diubah lewat panel Developer)
function flipLayout(change) {
  const els = [...reader.querySelectorAll('.word, .page-title')];
  if (!els.length || els.length > 6000 || reduceMotion.matches || !els[0].animate) { change(); return; }
  const sr = stageEl.getBoundingClientRect();
  const first = els.map(el => el.getBoundingClientRect());            // posisi visual saat ini (termasuk animasi yang masih jalan)
  flipAnims.forEach(a => a.cancel()); flipAnims = [];
  const ai = first.findIndex(r => r.height && r.bottom > sr.top + 90); // jangkar: elemen pertama yang terlihat di atas
  const aTop = ai >= 0 ? els[ai].getBoundingClientRect().top : 0;
  const token = ++flipToken;
  reader.classList.add('flipping');
  change();
  if (ai >= 0) { // jaga posisi bacaan: jangkar tetap di tempat yang sama di layar
    const d = els[ai].getBoundingClientRect().top - aTop;
    if (Math.abs(d) > 1) { const sb = stageEl.style.scrollBehavior; stageEl.style.scrollBehavior = 'auto'; stageEl.scrollTop += d; stageEl.style.scrollBehavior = sb; }
  }
  const vis = r => r.bottom > sr.top - 40 && r.top < sr.bottom + 40;
  const last = els.map(el => el.getBoundingClientRect());             // baca SEMUA posisi akhir sekaligus (tanpa menulis di sela-selanya -> tidak ada layout thrashing)
  const plan = [];
  els.forEach((el, i) => {
    const f = first[i], l = last[i];
    const dx = (f.left + f.width / 2) - (l.left + l.width / 2), dy = (f.top + f.height / 2) - (l.top + l.height / 2);
    if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || (!vis(f) && !vis(l))) return;
    plan.push({ el, dx, dy, top: l.top });
  });
  const anims = plan.map(({ el, dx, dy, top }) => {                   // baru setelah itu buat semua animasi
    const from = `translate(${dx}px,${dy}px)`;
    // kata yang pindah baris (lompatan horizontal jauh) memudar sebentar di tengah jalan -> tidak menyapu diagonal menimpa kata lain
    const wrapped = Math.abs(dy) > 4 && Math.abs(dx) > sr.width * .22;
    const frames = wrapped
      ? [{ transform: from, opacity: 1, offset: 0 }, { opacity: .1, offset: .45 }, { transform: 'translate(0,0)', opacity: 1, offset: 1 }]
      : [{ transform: from }, { transform: 'translate(0,0)' }];
    return el.animate(frames, {
      duration: FLIP.ms, easing: FLIP.ease, fill: 'backwards',
      delay: Math.min(FLIP.wave, Math.max(0, top - sr.top) / Math.max(1, sr.height) * FLIP.wave) // gelombang halus dari atas ke bawah
    });
  });
  flipAnims = anims;
  Promise.allSettled(anims.map(a => a.finished)).then(() => { if (token === flipToken) { reader.classList.remove('flipping'); flipAnims = []; } });
}

let noteHoldT = 0;
function render() {
  dataVer++;
  const p = page();
  const subList = allSubs(), sk = (mode === 'read' && subSid) ? subList.findIndex(x => x.s.id === subSid) : -1;
  $('#indicator').title = ''; $('#indicator').textContent = sk >= 0 ? `${sentText(subList[sk].s)} · ${sk + 1}/${subList.length}` : `${p.title || 'Bab'} · ${pi + 1}/${data.pages.length}`;
  $('#indicator').title = $('#indicator').textContent;
  renderReader(); clearLink();
  // dialog catatan sedang tampil lalu ditutup: pertahankan isinya sampai animasi keluar selesai (kalau tidak, isi berganti & panel mengerut sebelum memudar)
  if (S.centerNote && mode === 'read' && !sel.sid && $('#inspector').classList.contains('open')) {
    clearTimeout(noteHoldT); noteHoldT = setTimeout(() => { if (!sel.sid) renderInspector(); }, 480);
  } else renderInspector();
  // daftar isi berisi seluruh bab + sub bab: bangun ulang hanya bila panelnya terbuka (selain itu cukup ditandai kotor, dibangun saat dibuka)
  if (pi !== tocSeenPi) { if (data.pages[pi]) tocOpen.add(tocKey(data.pages[pi], pi)); tocSeenPi = pi; }
  if (drawers.toc) { renderToc(); tocDirty = false; } else tocDirty = true;
}

/* ---------- Penanda "sudah dikaji" + lanjutkan dari terakhir dibaca ----------
   data.progress = { done: { <id sub bab | kunci bab tanpa sub bab>: true }, last: { p: <kunci bab>, s: <id sub bab | null> } }
   Bab yang punya sub bab dianggap selesai bila SEMUA sub babnya sudah dikaji (menandai bab = menandai semua sub babnya). */
const doneMap = () => (data.progress && data.progress.done) || {};
function progW() { // objek progres yang boleh ditulis (dibuat bila belum ada)
  let pr = data.progress;
  if (!pr || typeof pr !== 'object' || Array.isArray(pr)) pr = data.progress = {};
  if (!pr.done || typeof pr.done !== 'object' || Array.isArray(pr.done)) pr.done = {};
  return pr;
}
const unitsOf = (p, i) => { const subs = subsOf(p); return subs.length ? subs.map(s => s.id) : [tocKey(p, i)]; };
function chapStat(p, i) {
  const d = doneMap(), u = unitsOf(p, i), n = u.filter(k => d[k]).length;
  return { n, m: u.length, all: n === u.length };
}
function overallStat() {
  let n = 0, m = 0, cd = 0;
  data.pages.forEach((p, i) => { const c = chapStat(p, i); n += c.n; m += c.m; if (c.all) cd++; });
  return { n, m, cd, cm: data.pages.length, pct: m ? Math.round(n / m * 100) : 0 };
}
// bagian yang ditandai tombol di bawah bacaan: sub bab yang sedang dibuka, atau seluruh bab
const curUnits = () => (mode === 'read' && subSid) ? [subSid] : unitsOf(page(), pi);
const unitsDone = keys => { const d = doneMap(); return keys.length > 0 && keys.every(k => d[k]); };
function setUnits(keys, on, quiet) {
  const pr = progW();
  keys.forEach(k => { if (on) pr.done[k] = true; else delete pr.done[k]; });
  NGAJI.onChange(); paintProgress();
  if (quiet) return;
  const o = overallStat();
  NGAJI.toast(on ? (o.m && o.n === o.m ? 'Semua bab sudah dikaji. Alhamdulillah!' : 'Ditandai sudah dikaji.') : 'Tanda sudah dikaji dibatalkan.');
}
function toggleChapter(i) { const p = data.pages[i]; if (p) setUnits(unitsOf(p, i), !chapStat(p, i).all); }

/* posisi terakhir dibaca */
function lastPos() {
  const l = data.progress && data.progress.last; if (!l) return null;
  const i = data.pages.findIndex((p, k) => tocKey(p, k) === l.p); if (i < 0) return null;
  const pg = data.pages[i], s = l.s ? pg.sentences.find(x => x.id === l.s && x.type === 'sub') : null;
  return { i, s, chapter: pg.title || 'Bab ' + (i + 1), sub: s ? sentText(s) : '' };
}
function recordLast() { // dipanggil saat berpindah / menggulir di Mode Baca; hanya menulis bila posisinya benar-benar berubah
  if (mode !== 'read' || !data.pages[pi]) return;
  const key = tocKey(page(), pi), sid = activeSubId() || null, l = data.progress && data.progress.last;
  if (l && l.p === key && (l.s || null) === sid) return;
  progW().last = { p: key, s: sid };
  NGAJI.onChange('lazy'); paintResume(); // 'lazy': tidak memicu tulis-ulang seluruh buku tiap pindah sub bab saat menggulir
}
function resume() {
  const l = lastPos();
  if (!l) { NGAJI.toast('Belum ada bacaan terakhir.'); return; }
  goTo(l.i, l.s ? l.s.id : undefined);
}
function resetProgress() {
  if (!confirm('Hapus semua tanda "sudah dikaji" dan posisi terakhir dibaca?')) return;
  delete data.progress; NGAJI.onChange(); paintProgress(); paintResume();
}

/* tombol "Tandai sudah dikaji" di bawah bacaan (Mode Baca) */
function nextTarget() {
  if (mode === 'read' && subSid) {
    const list = allSubs(), k = list.findIndex(x => x.s.id === subSid && x.i === pi), t = list[k + 1];
    return t ? { i: t.i, sid: t.s.id } : null;
  }
  return pi + 1 < data.pages.length ? { i: pi + 1 } : null;
}
function doneBarHtml() {
  if (mode !== 'read' || subTitleOnly) return '';
  const on = unitsDone(curUnits()), nx = nextTarget(), what = subSid ? 'sub bab' : 'bab';
  return `<div class="done-bar" dir="ltr">` +
    `<button type="button" id="doneBtn" class="btn ${on ? 'btn-primary' : 'btn-tonal'}" aria-pressed="${on}" title="${on ? 'Klik untuk membatalkan tanda sudah dikaji' : `Tandai ${what} ini sudah dikaji`}"><svg class="i"><use href="#i-check"/></svg><span>${on ? 'Sudah dikaji' : 'Tandai sudah dikaji'}</span></button>` +
    (!on && nx ? `<button type="button" id="doneNext" class="btn btn-gold" title="Tandai ${what} ini lalu buka berikutnya"><span>Tandai & lanjut</span><svg class="i"><use href="#i-next"/></svg></button>` : '') +
    `</div>`;
}
reader.addEventListener('click', e => {
  const b = e.target.closest('#doneBtn, #doneNext'); if (!b) return;
  e.stopPropagation();
  const keys = curUnits();
  if (b.id === 'doneBtn') { setUnits(keys, !unitsDone(keys)); return; }
  const nx = nextTarget(); setUnits(keys, true);
  if (nx) goTo(nx.i, nx.sid);
}, true);

/* perbarui tampilan di tempat (tanpa render ulang: daftar isi tidak melompat, bacaan tidak berkedip) */
function paintProgress() {
  const d = doneMap(), body = $('#tocBody');
  body.querySelectorAll('[data-chk-sub]').forEach(b => {
    const on = !!d[b.dataset.chkSub]; b.setAttribute('aria-checked', on);
    const row = b.closest('.toc-subrow'); if (row) row.classList.toggle('done', on);
  });
  body.querySelectorAll('.toc-group[data-pi]').forEach(g => {
    const i = +g.dataset.pi, p = data.pages[i]; if (!p) return;
    const st = chapStat(p, i);
    g.classList.toggle('done', st.all); g.classList.toggle('part', st.n > 0 && !st.all);
    const b = g.querySelector('[data-chk-page]'); if (b) b.setAttribute('aria-checked', st.all ? 'true' : st.n ? 'mixed' : 'false');
    const pm = g.querySelector('.pm'); if (pm) { const t = `${st.n}/${st.m} dikaji`; if (pm.textContent !== t) pm.textContent = t; pm.hidden = st.m < 2; }
    const bar = g.querySelector('.toc-bar i'); if (bar) bar.style.width = (st.m ? st.n / st.m * 100 : 0) + '%';
  });
  const o = overallStat(), card = $('#tocProg');
  if (card) {
    $('.tp-bar i', card).style.width = o.pct + '%';
    $('.tp-pct', card).textContent = o.pct + '%';
    $('.tp-ch', card).textContent = `${o.cd}/${o.cm}`;
    card.classList.toggle('all', o.m > 0 && o.n === o.m);
  }
  const bar = $('.done-bar'); if (bar) bar.outerHTML = doneBarHtml();
  const dd = $('#doneDock'); // tombol centang di dock: selalu terjangkau tanpa menggulir ke bawah
  if (dd) {
    const on = unitsDone(curUnits());
    dd.hidden = mode !== 'read'; dd.classList.toggle('on', on); dd.setAttribute('aria-pressed', on);
    dd.title = on ? 'Klik untuk membatalkan tanda sudah dikaji' : (subSid ? 'Tandai sub bab ini sudah dikaji' : 'Tandai bab ini sudah dikaji');
  }
}
function paintResume() {
  const l = lastPos(), b = $('#resumeBtn'), dock = $('#resumeDock');
  if (b) {
    b.disabled = !l;
    const t = $('#tocProg .tp-last');
    if (t) {
      t.hidden = !l;
      if (l) { $('.tp-lc', t).textContent = l.chapter; const sb = $('.tp-ls', t); sb.textContent = l.sub; sb.hidden = !l.sub; }
    }
  }
  if (dock) { // tombol di dock: tampil di Mode Baca bila ada bacaan terakhir yang berbeda dari posisi sekarang
    const here = l && l.i === pi && (!l.s || (mode === 'read' && l.s.id === activeSubId()));
    dock.hidden = !l || here || mode !== 'read';
  }
}

/* ---------- Daftar isi (bab + sub bab) ---------- */
/* ---------- Sorotan otomatis bab / sub bab yang sedang tampil di daftar isi ---------- */
// sub bab aktif: yang dibuka sendiri (Mode Baca), atau (seluruh bab tampil) yang terakhir lewat di bagian atas layar — scroll-spy
let subElsCache = null; // daftar elemen sub bab; dibatalkan setiap DOM bacaan berganti (renderReader / refreshBlocks)
function activeSubId() {
  if (mode === 'read' && subSid) return subSid;
  const subs = subElsCache || (subElsCache = [...reader.querySelectorAll('.sentence.t-sub')]); if (!subs.length) return null;
  const sr = stageEl.getBoundingClientRect(), line = sr.top + Math.min(280, sr.height * 0.35);
  // posisi atas sub bab menaik mengikuti urutan DOM -> pencarian biner: O(log n) pembacaan layout per frame scroll (dulu O(n))
  let lo = 0, hi = subs.length - 1, k = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (subs[mid].getBoundingClientRect().top <= line) { k = mid; lo = mid + 1; } else hi = mid - 1; }
  return k >= 0 ? subs[k].dataset.sid : null;
}
function revealIn(c, el, behavior) { // gulirkan daftar isi seperlunya agar item aktif terlihat
  const cr = c.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = 70;
  const d = r.top < cr.top + pad ? r.top - cr.top - pad : (r.bottom > cr.bottom - pad ? r.bottom - cr.bottom + pad : 0);
  if (d) c.scrollTo({ top: c.scrollTop + d, behavior });
}
let tocActiveKey = '';
function updateTocActive(force) {
  const body = $('#tocBody'); if (!body.firstChild) return;
  const sid = activeSubId(), key = pi + '|' + (sid || '');
  if (!force && key === tocActiveKey) return; // tidak berubah: jangan sentuh DOM tiap frame saat menggulir
  body.querySelectorAll('.toc-sub.on').forEach(e => e.classList.remove('on'));
  const el = sid ? body.querySelector(`.toc-sub[data-sub="${CSS.escape(sid)}"][data-pg="${pi}"]`) : null;
  if (el) el.classList.add('on');
  const target = (el && el.closest('.toc-group.open')) ? el : body.querySelector('.toc-item.on');
  if (target && drawers.toc && (force || key !== tocActiveKey)) revealIn($('#toc'), target, force ? 'auto' : 'smooth');
  tocActiveKey = key;
}
let spyRaf = 0;
stageEl.addEventListener('scroll', () => {
  if (spyRaf) return;
  if (mode === 'edit' && !drawers.toc) return; // Mode Edit + Daftar Isi tertutup: tidak ada yang perlu diperbarui (dibangun penuh saat Daftar Isi dibuka)
  spyRaf = requestAnimationFrame(() => { spyRaf = 0; updateTocActive(); recordLast(); });
}, { passive: true });

/* Status buka/tutup bab di daftar isi (bertahan antar-render). Bab yang sedang tampil otomatis dibuka saat berpindah bab. */
const tocOpen = new Set(); let tocSeenPi = -1, tocDirty = true;
const tocKey = (p, i) => p.id || ('i' + i);
function syncTocAllBtn() {
  const b = $('#tocAll'); if (!b) return;
  const groups = [...document.querySelectorAll('#tocBody .toc-group.has-subs')];
  const allOpen = groups.length && groups.every(g => g.classList.contains('open'));
  b.textContent = allOpen ? 'Tutup semua' : 'Buka semua'; b.disabled = !groups.length;
}
function setTocGroup(g, open) {
  g.classList.toggle('open', open);
  const t = g.querySelector('.toc-exp'); if (t) { t.setAttribute('aria-expanded', open); t.title = open ? 'Ciutkan sub bab' : 'Buka sub bab'; }
  const inner = g.querySelector('.toc-subs-in'); if (inner) inner.inert = !open;
  open ? tocOpen.add(g.dataset.key) : tocOpen.delete(g.dataset.key);
}

function renderToc() {
  const body = $('#tocBody'), edit = mode === 'edit', act = activeSubId();
  const onCls = (i, s) => (i === pi && s.id === act) ? 'on' : '';
  if (pi !== tocSeenPi) { if (data.pages[pi]) tocOpen.add(tocKey(data.pages[pi], pi)); tocSeenPi = pi; }
  const chev = '<svg class="i"><use href="#i-next"/></svg>';
  const list = data.pages.map((p, i) => {
    const subsArr = subsOf(p), key = tocKey(p, i), open = tocOpen.has(key);
    const hasSubs = edit || subsArr.length > 0;
    const title = p.title || 'Bab ' + (i + 1);
    const exp = hasSubs
      ? `<button class="toc-exp" aria-expanded="${open}" title="${open ? 'Ciutkan sub bab' : 'Buka sub bab'}"><svg class="i"><use href="#i-next"/></svg></button>`
      : '<span class="toc-exp ph" aria-hidden="true"></span>';
    const meta = `${p.sentences.length} kalimat` + (subsArr.length ? ` · ${subsArr.length} sub bab` : '');
    const head = edit
      ? `<div class="toc-item edit ${i === pi ? 'on' : ''}"><button class="toc-go" data-go="${i}" title="Buka bab ${i + 1}">${i + 1}</button><textarea rows="1" dir="rtl" class="toc-autogrow" data-title="${i}" title="Judul bab (tekan Enter)">${esc(p.title)}</textarea><button class="icon-btn" data-del="${i}" title="Hapus bab"><svg class="i"><use href="#i-x"/></svg></button></div>`
      : `<button class="toc-item ${i === pi ? 'on' : ''}" data-go="${i}" title="${esc(title)}"><span class="n">${i + 1}</span><span class="tx"><span class="t">${esc(title)}</span><small>${meta}<span class="pm" hidden></span></small>${subsArr.length ? '<span class="toc-bar"><i></i></span>' : ''}</span></button>`;
    const chk = edit ? '' : `<button type="button" class="toc-chk" role="checkbox" aria-checked="false" data-chk-page="${i}" title="Tandai bab ini sudah dikaji"><svg class="i"><use href="#i-check"/></svg></button>`;
    const subs = subsArr.map(s => edit
      ? `<div class="toc-sub edit ${onCls(i, s)}" data-sub="${s.id}" data-pg="${i}"><textarea rows="1" dir="rtl" class="toc-autogrow" data-subtext="${s.id}" data-sp="${i}" title="Teks sub bab (tekan Enter)">${esc(sentText(s))}</textarea><button class="icon-btn" data-gp="${i}" data-gs="${s.id}" title="Buka sub bab"><svg class="i"><use href="#i-next"/></svg></button><button class="icon-btn" data-delsub="${s.id}" data-sp="${i}" title="Hapus sub bab"><svg class="i"><use href="#i-x"/></svg></button></div>`
      : `<div class="toc-subrow"><button class="toc-sub ${onCls(i, s)}" data-sub="${s.id}" data-pg="${i}" data-gp="${i}" data-gs="${s.id}" title="${esc(sentText(s))}"><span class="t">${esc(sentText(s))}</span></button><button type="button" class="toc-chk" role="checkbox" aria-checked="false" data-chk-sub="${s.id}" title="Tandai sub bab ini sudah dikaji"><svg class="i"><use href="#i-check"/></svg></button></div>`).join('');
    const add = edit ? `<button class="btn btn-sm btn-tonal toc-add" data-addsub="${i}" title="Sisipkan sub bab baru (di atas kalimat terpilih; bila tidak ada, di akhir bab)"><svg class="i"><use href="#i-plus"/></svg>Sub bab</button>` : '';
    const inner = hasSubs ? `<div class="toc-subs"><div class="toc-subs-in"${open ? '' : ' inert'}>${subs}${add}</div></div>` : '';
    return `<div class="toc-group ${open ? 'open' : ''} ${hasSubs ? 'has-subs' : ''}" data-pi="${i}" data-key="${esc(key)}"><div class="toc-row">${exp}${head}${chk}</div>${inner}</div>`;
  }).join('');
  const anySubs = data.pages.some(p => edit || subsOf(p).length);
  const card = `<div id="tocProg" class="toc-prog"><div class="tp-head"><b>Progres kajian</b><button id="progReset" class="btn btn-sm btn-ghost" title="Hapus semua tanda sudah dikaji dan posisi terakhir dibaca">Reset progres</button></div>` +
    `<div class="tp-bar"><i></i></div><div class="tp-meta"><span class="tp-pct"></span><span class="tp-dot">·</span><span class="tp-ch"></span> <span>bab selesai</span></div>` +
    `<button id="resumeBtn" class="btn btn-primary btn-block" title="Lanjutkan dari terakhir dibaca"><svg class="i"><use href="#i-bookmark"/></svg><span>Lanjutkan dari terakhir dibaca</span></button>` +
    `<div class="tp-last" hidden><span class="tp-lbl">Terakhir dibaca:</span> <span class="tp-lc" dir="auto"></span><span class="tp-ls" dir="auto" hidden></span></div></div>`;
  body.innerHTML = card + (anySubs ? '<div class="toc-tools"><button id="tocAll" class="btn btn-sm btn-tonal"></button></div>' : '') + list;
  $('#resumeBtn').onclick = resume; $('#progReset').onclick = resetProgress;
  body.querySelectorAll('[data-chk-page]').forEach(b => b.onclick = e => { e.stopPropagation(); toggleChapter(+b.dataset.chkPage); });
  body.querySelectorAll('[data-chk-sub]').forEach(b => b.onclick = e => { e.stopPropagation(); setUnits([b.dataset.chkSub], !doneMap()[b.dataset.chkSub]); });
  body.querySelectorAll('.toc-exp:not(.ph)').forEach(b => b.onclick = () => {
    const g = b.closest('.toc-group'); setTocGroup(g, !g.classList.contains('open')); syncTocAllBtn();
  });
  const allBtn = $('#tocAll');
  if (allBtn) allBtn.onclick = () => {
    const gs = [...body.querySelectorAll('.toc-group.has-subs')], open = !gs.every(g => g.classList.contains('open'));
    gs.forEach(g => setTocGroup(g, open)); syncTocAllBtn();
  };
  syncTocAllBtn();
  // textarea judul: tinggi mengikuti isi agar judul panjang tetap terbaca utuh (dihitung ulang saat diketik)
  const grow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; };
  const areas = [...body.querySelectorAll('.toc-autogrow')];
  areas.forEach(el => {
    el.addEventListener('input', () => grow(el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });
  // ukur semua sekaligus: baca semua tinggi dulu, baru tulis (satu layout, bukan satu per textarea)
  const hs = areas.map(el => el.scrollHeight + 2);
  areas.forEach((el, i) => { el.style.height = hs[i] + 'px'; });
  body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const i = +b.dataset.go, first = mode === 'read' && subsOf(data.pages[i])[0]; // Mode Baca: klik bab -> hanya judul sub bab pertama
    first ? goTo(i, first.id, true) : goTo(i);
  });
  body.querySelectorAll('[data-gp]').forEach(b => b.onclick = () => goTo(+b.dataset.gp, b.dataset.gs));
  body.querySelectorAll('[data-title]').forEach(el => el.oninput = () => {
    const i = +el.dataset.title; data.pages[i].title = el.value; touch();
    if (i === pi) { $('#indicator').textContent = `${el.value || 'Bab'} · ${pi + 1}/${data.pages.length}`; const t = $('.page-title'); if (t) t.textContent = el.value; }
  });
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (data.pages.length < 2) { alert('Minimal harus ada satu bab.'); return; }
    const i = +b.dataset.del;
    if (!confirm(`Hapus bab "${data.pages[i].title}" beserta ${data.pages[i].sentences.length} kalimatnya?`)) return;
    data.pages.splice(i, 1); if (i < pi) pi--; pi = Math.max(0, Math.min(pi, data.pages.length - 1));
    sel = { sid: null, wid: null }; touch(); render();
  });
  // sub bab: ubah teks (kata yang tidak berubah tetap menyimpan pegon/dhomir-nya)
  body.querySelectorAll('[data-subtext]').forEach(el => {
    el.onkeydown = e => { if (e.key === 'Enter') el.blur(); };
    el.onchange = () => {
      const pg = data.pages[+el.dataset.sp], s = pg.sentences.find(x => x.id === el.dataset.subtext);
      const toks = el.value.trim().split(/\s+/).filter(Boolean);
      if (!s || !toks.length) { if (s) el.value = sentText(s); return; }
      const old = s.words;
      s.words = toks.map((a, k) => old[k] && old[k].arab === a ? old[k] : newWord(a));
      dropTargets(old.filter(w => !s.words.includes(w)).map(w => w.id), pg);
      touch(); render();
    };
  });
  body.querySelectorAll('[data-delsub]').forEach(b => b.onclick = () => {
    const pg = data.pages[+b.dataset.sp], s = pg.sentences.find(x => x.id === b.dataset.delsub);
    if (!s || !confirm(`Hapus sub bab "${sentText(s)}"?`)) return;
    pg.sentences = pg.sentences.filter(x => x !== s);
    dropTargets(s.words.map(w => w.id), pg);
    if (sel.sid === s.id) sel = { sid: null, wid: null };
    touch(); render();
  });
  body.querySelectorAll('[data-addsub]').forEach(b => b.onclick = () => addSub(+b.dataset.addsub));
  paintProgress(); paintResume();
  updateTocActive(true);
}
function addSub(i) {
  const pg = data.pages[i], s = newSentence('عُنْوَانٌ فَرْعِيٌّ', { type: 'sub' });
  let at = pg.sentences.length;
  if (i === pi && sel.sid) { const k = pg.sentences.findIndex(x => x.id === sel.sid); if (k >= 0) at = k; }
  pg.sentences.splice(at, 0, s); touch(); render();
  const el = $(`#tocBody [data-subtext="${s.id}"]`); if (el) { el.focus(); el.select(); }
}

/* ---------- Tooltip ---------- */
const tip = $('#tooltip');
function showTip(el) {
  const w = word(el.dataset.id);
  if (!w || !S.showTip) return false;
  let txt = w.pegon, nodes = [el];
  if (el.dataset.fr) { // kata bagian dari frasa ber-Pegon: tampilkan makna frasa, di atas kata-kata frasa pada baris yang sama
    const st = wsIdx.get(w.id), fr = st && (st.frasa || []).find(f => f.id === el.dataset.fr);
    if (fr && fr.pegon && fr.pegon.trim()) {
      txt = fr.pegon;
      const r0 = el.getBoundingClientRect(), sEl = el.closest('.sentence');
      const same = [...sEl.querySelectorAll(`.word[data-fr="${CSS.escape(el.dataset.fr)}"]`)].filter(n => Math.abs(n.getBoundingClientRect().top - r0.top) < r0.height * .6);
      if (same.length) nodes = same;
    }
  }
  if (!txt) return false;
  tip.textContent = txt;
  const rs = nodes.map(n => n.getBoundingClientRect());
  const r = { left: Math.min(...rs.map(x => x.left)), right: Math.max(...rs.map(x => x.right)), top: Math.min(...rs.map(x => x.top)) };
  tip.classList.add('show');
  const tw = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, (r.left + r.right) / 2 - tw / 2)) + 'px';
  let top0 = r.top;
  nodes.forEach(n => { const nhEl = n.querySelector('.nh'); if (nhEl && nhEl.offsetHeight) top0 = Math.min(top0, nhEl.getBoundingClientRect().top); }); // tooltip di atas penanda nahwu, bukan menimpanya
  tip.style.top = (top0 - tip.offsetHeight - 10) + 'px';
  return true;
}
const hideTip = () => tip.classList.remove('show');

/* ---------- Efek suara dhomir (disintesis dengan Web Audio, tanpa file audio) ---------- */
let actx = null, lastDh = 0;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (S.dhSound) audio(); }, { once: false, passive: true }));
function tone(c, out, { f, t = 0, dur = .5, type = 'sine', g = .3, f2 = null, atk = .006 }) {
  const o = c.createOscillator(), a = c.createGain(), t0 = c.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur * .8);
  a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g, t0 + atk); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(a); a.connect(out); o.start(t0); o.stop(t0 + dur + .05);
}
function playDhomir() {
  if (!S.dhSound || +S.dhVol <= 0) return;
  const now = performance.now(); if (now - lastDh < 90) return; lastDh = now;
  const c = audio(); if (!c) return;
  const out = c.createGain(); out.gain.value = Math.min(1, +S.dhVol) * .7; out.connect(c.destination);
  const base = [523.25, 587.33, 659.25, 783.99][Math.floor(Math.random() * 4)]; // C5 D5 E5 G5 (pentatonik: selalu enak didengar)
  switch (S.dhSoundStyle) {
    case 'gelembung': // pop gelembung naik
      tone(c, out, { f: base * .7, f2: base * 1.9, dur: .16, g: .5, atk: .004 });
      tone(c, out, { f: base * 1.05, f2: base * 2.6, t: .07, dur: .12, g: .22, atk: .003 }); break;
    case 'harpa': // petikan dua nada naik
      tone(c, out, { f: base, type: 'triangle', dur: .75, g: .42 });
      tone(c, out, { f: base * 1.5, type: 'triangle', t: .09, dur: .7, g: .3 });
      tone(c, out, { f: base * 2, type: 'sine', t: .17, dur: .6, g: .16 }); break;
    case 'tetes': // tetes air
      tone(c, out, { f: base * 2.2, f2: base * .9, dur: .22, g: .55, atk: .003 });
      tone(c, out, { f: base * 3.3, f2: base * 1.4, t: .01, dur: .12, g: .12, atk: .002 }); break;
    default: // lonceng kristal: nada + overtone tidak harmonis, lalu gema satu kuint di atasnya ("tersambung" ke marju')
      tone(c, out, { f: base, dur: 1.1, g: .36 });
      tone(c, out, { f: base * 2.76, dur: .55, g: .1 });
      tone(c, out, { f: base * 5.4, dur: .25, g: .04 });
      tone(c, out, { f: base * 1.5, t: .12, dur: .9, g: .2 });
  }
}

/* ---------- Garis Dhomir -> Marju' ---------- */
const svg = $('#links');
let linkDrawn = false; // true hanya setelah drawLink benar-benar menggambar -> hover biasa tidak memindai seluruh dokumen
function clearLink() {
  if (!linkDrawn) return;
  linkDrawn = false;
  svg.textContent = '';
  document.querySelectorAll('.marju').forEach(e => e.classList.remove('marju'));
}
function drawLink(el, tipOn = false) {
  clearLink();
  const w = word(el.dataset.id), ids = w ? targets(w) : [];
  if (!ids.length || !S.showDhomir) return;
  linkDrawn = true; // mulai dari sini svg / kelas .marju akan terisi -> clearLink wajib membersihkan
  const base = svg.getBoundingClientRect(); // svg menutupi .reader-wrap -> koordinat relatif tepat
  // titik awal garis: huruf dhomir bila ditandai, selain itu seluruh kata
  const dls = [...el.querySelectorAll('.dl')];
  const rs = (dls.length ? dls : [el]).map(n => n.getBoundingClientRect());
  const x1 = (Math.min(...rs.map(r => r.left)) + Math.max(...rs.map(r => r.right))) / 2 - base.left;
  // garis rujuk: di bawah kata bila tooltip Pegon tampil di atas (agar tidak menembus tooltip)
  const nhEl = el.querySelector('.nh'), nhOn = !!(nhEl && nhEl.offsetHeight); // ada penanda nahwu di atas kata: garis otomatis lewat bawah
  const below = S.linkSide === 'bawah' || (S.linkSide !== 'atas' && (tipOn || nhOn));
  const y1 = (below ? Math.max(...rs.map(r => r.bottom)) : Math.min(...rs.map(r => r.top))) - base.top;
  let n = 0;
  ids.forEach(id => {
    const target = reader.querySelector(`.word[data-id="${CSS.escape(id)}"]`);
    if (!target || target === el) return;
    target.classList.add('marju'); linkDrawn = true;
    const b = target.getBoundingClientRect();
    const x2 = b.left + b.width / 2 - base.left, y2 = (below ? b.bottom : b.top) - base.top;
    const lift = below ? 22 + Math.min(46, Math.abs(x1 - x2) / 8) + n++ * 12 : 40 + Math.min(80, Math.abs(x1 - x2) / 4) + n++ * 18;
    const top = below ? Math.max(y1, y2) + lift : Math.min(y1, y2) - lift;
    linkArt(`M${x1} ${y1} C${x1} ${top},${x2} ${top},${x2} ${y2}`, x1, y1, x2, y2, Math.hypot(x1 - x2, lift * 2) * 1.4, n - 1, below);
  });
}
/* Gaya penghubung: tiap gaya memakai elemen SVG + animasi CSS/SMIL berbeda (dipilih di Pengaturan -> Dhomir & Marju') */
const SVGNS = 'http://www.w3.org/2000/svg';
function mk(tag, attrs, cls) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (cls) e.setAttribute('class', cls);
  svg.appendChild(e); return e;
}
function linkArt(d, x1, y1, x2, y2, len, idx, below = false) {
  const st = S.linkStyle || 'garis', delay = (idx * 0.12) + 's';
  svg.dataset.style = st;
  if (st === 'komet') {
    mk('path', { d, pathLength: 100 }, 'lk-base');
    [[34, .22, 4.5], [20, .5, 4], [8, 1, 3.4]].forEach(([L, op, w]) => {
      const p = mk('path', { d, pathLength: 100 }, 'lk-comet');
      p.style.cssText = `--L:${L};--from:${L};--to:${L - 130};stroke-dasharray:${L} 300;stroke-width:calc(var(--link-w,2.5px)*${w / 3});opacity:${op};animation-delay:${delay}`;
    });
    const head = mk('circle', { r: 4.5 }, 'lk-head');
    const am = document.createElementNS(SVGNS, 'animateMotion');
    am.setAttribute('dur', '1.5s'); am.setAttribute('repeatCount', 'indefinite'); am.setAttribute('path', d); am.setAttribute('calcMode', 'linear');
    am.setAttribute('begin', (idx * 0.12) + 's'); head.appendChild(am);
  } else if (st === 'titik') {
    mk('path', { d }, 'lk-dots');
    for (let k = 0; k < 4; k++) {
      const c = mk('circle', { r: 4 - k * 0.5 }, 'lk-dot');
      const am = document.createElementNS(SVGNS, 'animateMotion');
      am.setAttribute('dur', '1.8s'); am.setAttribute('repeatCount', 'indefinite'); am.setAttribute('path', d);
      am.setAttribute('begin', (k * 0.45 + idx * 0.1) + 's'); c.appendChild(am);
    }
  } else if (st === 'panah') {
    const p = mk('path', { d }, 'lk-line'); p.style.setProperty('--len', len);
    mk('polygon', { points: below ? `${x2},${y2 - 1} ${x2 - 7},${y2 + 13} ${x2 + 7},${y2 + 13}` : `${x2},${y2 + 1} ${x2 - 7},${y2 - 13} ${x2 + 7},${y2 - 13}` }, 'lk-arrow');
  } else if (st === 'neon') {
    mk('path', { d }, 'lk-glow');
    const p = mk('path', { d }, 'lk-core'); p.style.setProperty('--len', len);
  } else if (st === 'pelangi') {
    const id = 'lg' + idx + '_' + Math.round(x1 + y1 + x2);
    const defs = mk('defs', {}), g = document.createElementNS(SVGNS, 'linearGradient');
    g.setAttribute('id', id); g.setAttribute('gradientUnits', 'userSpaceOnUse');
    g.setAttribute('x1', x1); g.setAttribute('y1', y1); g.setAttribute('x2', x2 + 0.01); g.setAttribute('y2', y2 + 0.01);
    ['#ff6b8b', '#ffb86b', '#ffe66b', '#6bffb0', '#6bc8ff', '#b06bff'].forEach((c, i, a) => {
      const sp = document.createElementNS(SVGNS, 'stop'); sp.setAttribute('offset', i / (a.length - 1)); sp.setAttribute('stop-color', c); g.appendChild(sp);
    });
    defs.appendChild(g);
    const p = mk('path', { d, stroke: `url(#${id})` }, 'lk-rainbow'); p.style.setProperty('--len', len);
  } else if (st === 'kunang') {
    mk('path', { d }, 'lk-base');
    [[2.4, 0, 3.6], [3.4, .5, 2.9], [2.8, 1.1, 3.3], [3.8, .3, 2.5], [2.2, 1.7, 3.9], [3, .9, 3.1]].forEach(([r, b, dur], k) => {
      const c = mk('circle', { r }, 'lk-fly');
      const am = document.createElementNS(SVGNS, 'animateMotion');
      am.setAttribute('dur', dur + 's'); am.setAttribute('repeatCount', 'indefinite'); am.setAttribute('path', d); am.setAttribute('begin', (b + idx * 0.1) + 's');
      am.setAttribute('calcMode', 'spline'); am.setAttribute('keyTimes', '0;1'); am.setAttribute('keySplines', '.4 0 .6 1');
      const op = document.createElementNS(SVGNS, 'animate');
      op.setAttribute('attributeName', 'opacity'); op.setAttribute('values', '0;1;.35;1;0'); op.setAttribute('dur', dur + 's'); op.setAttribute('repeatCount', 'indefinite'); op.setAttribute('begin', (b + idx * 0.1) + 's');
      c.appendChild(am); c.appendChild(op);
    });
  } else if (st === 'riak') {
    const p = mk('path', { d }, 'lk-line'); p.style.setProperty('--len', len);
    [[x1, y1, 0], [x2, y2, .35], [x2, y2, 1.2], [x1, y1, 1.05]].forEach(([cx, cy, dl]) => {
      const r = mk('circle', { cx, cy, r: 6 }, 'lk-ripple'); r.style.animationDelay = (dl + idx * 0.1) + 's';
    });
  } else if (st === 'kilat') {
    const p = mk('path', { d }, 'lk-bolt'); p.style.opacity = .55;
    mk('path', { d }, 'lk-spark');
  } else if (st === 'tinta') {
    const p = mk('path', { d }, 'lk-write'); p.style.setProperty('--len', len); p.style.animationDelay = (idx * 0.12) + 's';
    const pen = mk('circle', { r: 4.5 }, 'lk-pen');
    const am = document.createElementNS(SVGNS, 'animateMotion');
    am.setAttribute('dur', '2.4s'); am.setAttribute('repeatCount', 'indefinite'); am.setAttribute('path', d); am.setAttribute('begin', (idx * 0.12) + 's');
    am.setAttribute('calcMode', 'spline'); am.setAttribute('keyTimes', '0;.52;1'); am.setAttribute('keyPoints', '0;1;1'); am.setAttribute('keySplines', '.45 0 .55 1;0 0 1 1');
    const op = document.createElementNS(SVGNS, 'animate');
    op.setAttribute('attributeName', 'opacity'); op.setAttribute('values', '1;1;0;0'); op.setAttribute('keyTimes', '0;.52;.68;1'); op.setAttribute('dur', '2.4s'); op.setAttribute('repeatCount', 'indefinite'); op.setAttribute('begin', (idx * 0.12) + 's');
    pen.appendChild(am); pen.appendChild(op);
  } else if (st === 'napas') {
    mk('path', { d }, 'lk-breath').style.animationDelay = delay;
  } else if (st === 'bintang') {
    mk('path', { d }, 'lk-base');
    [[3.2, 0], [3.2, .8], [3.2, 1.6], [3.2, 2.4]].forEach(([dur, b], k) => {
      const g = mk('g', {});
      const star = document.createElementNS(SVGNS, 'polygon');
      const sc = k % 2 ? 1 : .75;
      star.setAttribute('points', [[0, -7], [2, -2], [7, 0], [2, 2], [0, 7], [-2, 2], [-7, 0], [-2, -2]].map(([a, b2]) => `${a * sc},${b2 * sc}`).join(' '));
      star.setAttribute('class', 'lk-star'); star.style.animationDelay = (-k * .3) + 's';
      const am = document.createElementNS(SVGNS, 'animateMotion');
      am.setAttribute('dur', dur + 's'); am.setAttribute('repeatCount', 'indefinite'); am.setAttribute('path', d); am.setAttribute('begin', (b + idx * 0.1) + 's');
      const op = document.createElementNS(SVGNS, 'animate');
      op.setAttribute('attributeName', 'opacity'); op.setAttribute('values', '0;1;1;0'); op.setAttribute('keyTimes', '0;.12;.85;1'); op.setAttribute('dur', dur + 's'); op.setAttribute('repeatCount', 'indefinite'); op.setAttribute('begin', (b + idx * 0.1) + 's');
      g.appendChild(am); g.appendChild(op); g.appendChild(star);
    });
  } else if (st === 'untai') {
    mk('path', { d }, 'lk-strand-a'); mk('path', { d }, 'lk-strand-b');
  } else if (st === 'alir') {
    mk('path', { d }, 'lk-flow').style.animationDelay = delay;
  } else {
    const p = mk('path', { d }); p.style.setProperty('--len', len);
  }
}

/* ---------- Panel kata yang di-hover (Mode Baca): kata + Pegon + dhomir + marju' ---------- */
const hpBody = $('#hpBody');
const HINT = '<span class="hp-hint" dir="ltr">Arahkan kursor ke sebuah kata untuk melihat Pegon, dhomir, dan marju\'-nya.</span>';
function showPanel(id) {
  hpLast = id || null;
  const w = id && word(id);
  if (!w) { hpBody.innerHTML = HINT; return; }
  const wc = colorOf(w);
  let html = `<div class="hp-part"><div class="hp-ar"${wc ? ` style="color:${wc}"` : ''}>${wordHtml(w, parenDepthBefore(wsIdx.get(w.id) || { words: [] }, w.id))}</div>${w.pegon ? `<div class="hp-pg">${esc(w.pegon)}</div>` : ''}</div>`;
  const frs = wsIdx.get(w.id) && frasaAt(wsIdx.get(w.id), w.id);
  if (frs && frs.pegon) html += `<div class="hp-sep"></div><div class="hp-part"><span class="hp-lbl" dir="ltr">Frasa</span><div class="hp-ar">${esc(showAr(rangeText(wsIdx.get(w.id), frs)))}</div><div class="hp-pg">${esc(frs.pegon)}</div></div>`;
  const nl = S.showNahwu ? nahwuLabel(w) : '';
  if (nl) html += `<div class="hp-sep"></div><div class="hp-part"><span class="hp-lbl" dir="ltr">Nahwu</span><div class="hp-ar hp-nh">${esc(nahwuName(w) || nl)}</div></div>`;
  const ms = S.showDhomir ? targets(w).map(word).filter(Boolean) : [];
  if (ms.length) {
    const on = new Set(w.dhomir_letters || []);
    const dh = on.size ? letters(w.arab).filter((_, i) => on.has(i)).join('') : coreText(w);
    html += `<div class="hp-sep"></div><div class="hp-part"><span class="hp-lbl" dir="ltr">Dhomir</span><div class="hp-ar">${esc(showAr(dh))}</div></div>`;
    html += `<div class="hp-sep"></div><div class="hp-part"><span class="hp-lbl" dir="ltr">Marju'</span><div class="hp-list">` +
      ms.map(m => `<div class="hp-chip"><span class="hp-ar"${colorOf(m) ? ` style="color:${colorOf(m)}"` : ''}>${esc(showAr(coreText(m)))}</span>${m.pegon ? `<small>${esc(m.pegon)}</small>` : ''}</div>`).join('') + '</div></div>';
  }
  hpBody.innerHTML = html;
}

/* ---------- Event pembaca (delegasi) ---------- */
let frHotEls = [];
function frHot(el) { // sorot seluruh kata dalam frasa yang sama
  frHotEls.forEach(n => n.classList.remove('fr-hot')); frHotEls = [];
  if (!el || !el.dataset.fr) return;
  const sEl = el.closest('.sentence'); if (!sEl) return;
  frHotEls = [...sEl.querySelectorAll(`.word[data-fr="${CSS.escape(el.dataset.fr)}"]`)];
  frHotEls.forEach(n => n.classList.add('fr-hot'));
}
reader.addEventListener('mouseover', e => {
  const el = e.target.closest('.word'); if (!el || el.classList.contains('pt-only')) return;
  if (e.relatedTarget && el.contains(e.relatedTarget)) return; // pindah antar huruf dhomir di kata yang sama: tak perlu hitung ulang
  if (scrollingOn) return; // teks lewat di bawah kursor saat menggulir: jangan hitung tooltip / garis / panel (menunggu gulir berhenti)
  frHot(el);
  const tipOn = showTip(el); drawLink(el, tipOn); if (mode === 'read') showPanel(el.dataset.id);
  if (mode === 'read') { const w = word(el.dataset.id); if (w && targets(w).length && S.showDhomir) playDhomir(); }
});
reader.addEventListener('click', e => { if (e.target.closest('#showWhole')) { e.stopPropagation(); showWholePage(); } }, true);
reader.addEventListener('mouseleave', () => showPanel(null));
// gaya hover yang mengikuti posisi kursor (Miring 3D, Cahaya kursor)
let hvRaf = 0;
reader.addEventListener('mousemove', e => {
  if (S.hoverStyle !== 'miring' && S.hoverStyle !== 'cahaya') return;
  const el = e.target.closest('.word'); if (!el || el.classList.contains('pt-only') || hvRaf) return;
  const cx = e.clientX, cy = e.clientY;
  hvRaf = requestAnimationFrame(() => {
    hvRaf = 0;
    const b = el.getBoundingClientRect(), x = Math.min(1, Math.max(0, (cx - b.left) / (b.width || 1))), y = Math.min(1, Math.max(0, (cy - b.top) / (b.height || 1)));
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    el.style.setProperty('--ry', ((x - .5) * 26).toFixed(1) + 'deg'); el.style.setProperty('--rx', ((.5 - y) * 20).toFixed(1) + 'deg');
  });
});
reader.addEventListener('mouseout', e => {
  const el = e.target.closest('.word'); if (!el) return;
  if (e.relatedTarget && el.contains(e.relatedTarget)) return;
  ['--mx', '--my', '--rx', '--ry'].forEach(v => el.style.removeProperty(v));
  hideTip(); clearLink(); frHot(null);
});
reader.addEventListener('click', e => {
  const wEl = e.target.closest('.word'), sEl = e.target.closest('.sentence');
  if (!sEl) return;
  if (fp.on && mode === 'edit') { if (wEl && !wEl.classList.contains('pt-only')) handleFp(sEl.dataset.sid, wEl.dataset.id); return; } // mode pilih beberapa kata (Pegon gabungan)
  if (pick.on && mode === 'edit') { if (wEl) handlePick(sEl.dataset.sid, wEl.dataset.id); return; } // mode pilih kalimat manual
  if (mj.on && mode === 'edit' && sel.wid) { // mode pilih marju': klik kata di teks = tambah / lepas dari marju' kata terpilih
    if (wEl && !wEl.classList.contains('pt-only') && wEl.dataset.id !== sel.wid) toggleMarju(wEl.dataset.id);
    return;
  }
  const prevSid = sel.sid;
  sel.sid = sEl.dataset.sid;
  sel.wid = mode === 'edit' && wEl ? wEl.dataset.id : sel.wid;
  sel.rid = wEl ? (rangeAt(sentence(sel.sid), wEl.dataset.id)?.id || null) : null;
  sel.fid = mode === 'edit' && wEl ? (frasaAt(sentence(sel.sid), wEl.dataset.id)?.id || null) : null;
  const hpId = wEl && wEl.dataset.id;
  if (S.showInspector || mode === 'edit') openDrawer('inspector');
  if (S.centerNote && mode === 'read') drawers.settings = false;
  refreshBlocks(prevSid, sel.sid); clearLink(); renderInspector(); syncDrawers(); // tanpa menggambar ulang seluruh halaman
  if (hpId) showPanel(hpId); // ketuk di layar sentuh juga memunculkan panel
});

function toggleMarju(id) {
  const w = word(sel.wid), t = word(id); if (!w || !t) return;
  const cur = targets(w), on = cur.includes(id);
  setTargets(w, on ? cur.filter(x => x !== id) : [...cur, id]); touch();
  const cb = $(`#inspBody [data-t="${CSS.escape(id)}"]`); if (cb) cb.checked = !on; // samakan dengan daftar centang
  refreshBlocks(wsIdx.get(id)?.id); clearLink();
  const nm = $('#mjCount'); if (nm) nm.textContent = String(targets(w).length);
}
/* ---------- Hapus harakat permanen (Mode Edit) ----------
   Harakat dibuang dari teks Arab kata. Nomor huruf dhomir disesuaikan (tiap huruf = huruf dasar + harakatnya, jadi nomornya tetap;
   hanya "huruf" yang berisi harakat saja yang hilang). Pegon, nahwu, marju' tidak berubah. Dapat diurungkan. */
function stripHarakatWord(w) {
  const old = String(w.arab ?? ''), neu = stripH(old); if (neu === old) return false;
  const ls = letters(old), map = [], out = [];
  ls.forEach((c, i) => { const t = stripH(c); if (t) { map[i] = out.length; out.push(t); } });
  w.dhomir_letters = (w.dhomir_letters || []).filter(i => map[i] !== undefined).map(i => map[i]);
  w.arab = out.join(''); return true;
}
function stripHarakatIn(sents, where) {
  const ss = sents.filter(Boolean);
  let n = 0; ss.forEach(s => s.words.forEach(w => { if (String(w.arab ?? '') !== stripH(w.arab)) n++; }));
  if (!n) { NGAJI.toast('Tidak ada harakat di ' + where + '.'); return; }
  if (!confirm(`Hapus harakat dari ${n} kata di ${where}? (Dapat diurungkan dengan Ctrl+Z.)`)) return;
  ss.forEach(s => s.words.forEach(stripHarakatWord));
  touch(); render(); NGAJI.toast(`Harakat dihapus dari ${n} kata.`);
}
/* ---------- Inspector (baca & edit) ---------- */
/* ---------- Kamus kata: Pegon yang pernah diisi disarankan untuk kata yang sama di bab lain ----------
   Kamus tidak disimpan terpisah: ia dibaca langsung dari semua kata yang sudah punya Pegon, jadi selalu mutakhir
   (hapus / ubah Pegon di mana pun = kamus ikut berubah). Kecocokan "sama" = teks Arab inti persis (dengan harakat);
   kecocokan "mirip" = huruf sama, harakat / bentuk alif-ya berbeda. */
const K_PUNCT = /[()\[\]{}«»"'،؛؟.,:;!?\-–—\u200c\u200d\u0640]/g;
const kExact = w => coreText(w).replace(K_PUNCT, '').trim();
const kNorm = t => String(t || '').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').trim();
const kPg = t => String(t || '').trim().replace(/\s+/g, ' ');
let kamusRec = [];
function kamusRecs() { // satu catatan per kata di seluruh buku (termasuk yang Pegon-nya masih kosong)
  if (!kamusDirty) return kamusRec;
  const out = [];
  data.pages.forEach((pg, k) => pg.sentences.forEach(st => st.words.forEach(w => {
    const ek = kExact(w); if (ek) out.push({ w, pi: k, ek, lk: kNorm(ek), p: kPg(w.pegon) });
  })));
  kamusRec = out; kamusDirty = false; return out;
}
const byCount = (a, b) => b.n - a.n || a.p.localeCompare(b.p);
function kamusSuggest(w) { // saran untuk satu kata: persis sama, mirip, dan kata sama yang masih kosong
  const ek = kExact(w), res = { exact: [], loose: [], empties: [] };
  if (!ek) return res;
  const lk = kNorm(ek), cur = kPg(w.pegon), ex = new Map(), lo = new Map();
  kamusRecs().forEach(r => {
    if (r.w === w || r.lk !== lk) return;
    if (!r.p) { if (r.ek === ek) res.empties.push(r); return; }
    if (r.p === cur) return;
    const m = r.ek === ek ? ex : lo, e = m.get(r.p) || { p: r.p, n: 0, ar: r.ek };
    e.n++; m.set(r.p, e);
  });
  res.exact = [...ex.values()].sort(byCount);
  res.loose = [...lo.values()].filter(e => !ex.has(e.p)).sort(byCount);
  return res;
}
function fillKamus() {
  const box = $('#kamusBox'), w = sel.wid && word(sel.wid); if (!box || !w) return;
  const sg = kamusSuggest(w), cur = kPg(w.pegon), any = sg.exact.length || sg.loose.length;
  const chip = (e, loose, best) => `<button type="button" class="kms-chip${loose ? ' loose' : ''}${best ? ' best' : ''}" data-kp="${esc(e.p)}" title="${loose ? 'Kata mirip (harakat berbeda) — klik untuk memakai' : 'Klik untuk memakai makna ini'}"><span class="ar" dir="rtl">${esc(e.p)}</span>${loose ? `<small class="ar" dir="rtl">${esc(e.ar)}</small>` : ''}<small>×${e.n}</small></button>`;
  box.innerHTML = `<div class="kms-h"><span class="kms-t">${cur ? 'Makna lain di Kamus' : 'Saran dari Kamus'}</span><button type="button" class="btn btn-sm btn-ghost" id="kamusOpen" title="Lihat seluruh Kamus kata">Buka Kamus</button></div>` +
    (any ? `<div class="kms-list">${sg.exact.map((e, i) => chip(e, false, i === 0 && !cur)).join('')}${sg.loose.map(e => chip(e, true, false)).join('')}</div>` +
      (!cur ? '<small class="kms-hint">Tekan Enter di kolom Pegon untuk memakai saran pertama.</small>' : '')
      : (!cur ? '<small class="kms-hint">Kata ini belum ada di Kamus. Setelah Pegon diisi, ia otomatis disarankan di tempat lain.</small>' : '')) +
    (cur && sg.empties.length ? `<button type="button" class="btn btn-sm btn-tonal" id="kamusAll">Isi ${sg.empties.length} kata sama yang masih kosong</button>` : '');
  const inp = $('[data-w="pegon"]');
  box.querySelectorAll('[data-kp]').forEach(b => b.onclick = () => {
    w.pegon = b.dataset.kp; if (inp) inp.value = w.pegon; touch(); fillKamus();
  });
  $('#kamusAll', box)?.addEventListener('click', () => {
    sg.empties.forEach(r => { r.w.pegon = cur; }); touch(); NGAJI.toast(`${sg.empties.length} kata diisi dari Kamus.`); fillKamus();
  });
  $('#kamusOpen', box)?.addEventListener('click', openKamus);
  if (inp && !inp._kamus) { // Enter di kolom Pegon yang masih kosong = pakai saran pertama
    inp._kamus = true;
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const cw = word(sel.wid); if (!cw || kPg(cw.pegon)) return;
      const first = $('#kamusBox .kms-chip'); if (first) { e.preventDefault(); first.click(); }
    });
  }
}

/* jendela Kamus: daftar semua kata ber-Pegon + isi sekaligus kata yang masih kosong */
// buka / tutup dialog dengan animasi: menutup memutar animasi keluar dulu, baru disembunyikan
const MODAL_OUT_MS = 330;
function showModal(el) { clearTimeout(el._hideT); el.classList.remove('closing'); el.hidden = false; }
function hideModal(el) {
  if (el.hidden || el.classList.contains('closing')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.hidden = true; return; }
  el.classList.add('closing');
  el._hideT = setTimeout(() => { el.hidden = true; el.classList.remove('closing'); }, MODAL_OUT_MS);
}
const kamusModal = $('#kamusModal');
function kamusEntries() { // dikelompokkan per kata Arab persis sama
  const g = new Map();
  kamusRecs().forEach(r => {
    const e = g.get(r.ek) || { ek: r.ek, lk: r.lk, vars: new Map(), empties: [], total: 0 };
    e.total++;
    if (r.p) e.vars.set(r.p, (e.vars.get(r.p) || 0) + 1); else e.empties.push(r);
    g.set(r.ek, e);
  });
  return [...g.values()].filter(e => e.vars.size).map(e => {
    e.list = [...e.vars].map(([p, n]) => ({ p, n })).sort(byCount); return e;
  }).sort((a, b) => b.total - a.total || a.ek.localeCompare(b.ek));
}
function renderKamus() {
  const all = kamusEntries(), q = $('#kamSearch').value.trim(), qn = kNorm(q).replace(K_PUNCT, '');
  const hit = q ? all.filter(e => e.lk.includes(qn) || e.list.some(v => v.p.includes(q))) : all;
  const empt = all.reduce((n, e) => n + e.empties.length, 0), shown = hit.slice(0, 300);
  $('#kamSum').innerHTML = `<span>${all.length} entri</span>` + (empt ? ` · <span>${empt} kata masih kosong dan bisa diisi</span>` : '') + (hit.length > shown.length ? ` · <span>Menampilkan ${shown.length} dari ${hit.length}</span>` : '');
  const fa = $('#kamFillAll'); fa.disabled = !empt; fa.querySelector('span').textContent = empt ? `Isi ${empt} kata kosong dari Kamus` : 'Tidak ada kata kosong';
  $('#kamList').innerHTML = shown.length ? shown.map(e => `<div class="kam-row"><div class="kam-ar ar" dir="rtl">${esc(e.ek)}</div><div class="kam-vars">${e.list.map(v => `<span class="kms-chip static"><span class="ar" dir="rtl">${esc(v.p)}</span><small>×${v.n}</small></span>`).join('')}</div>` +
    (e.empties.length ? `<button type="button" class="btn btn-sm btn-tonal" data-kfill="${all.indexOf(e)}" title="Isi kata ini yang masih kosong dengan makna terbanyak">Isi ${e.empties.length} kosong</button>` : '<span></span>') + '</div>').join('')
    : `<p class="kam-none">${all.length ? 'Tidak ada yang cocok.' : 'Kamus masih kosong. Isi Pegon pada kata di Mode Edit, lalu kata itu muncul di sini.'}</p>`;
  $('#kamList').querySelectorAll('[data-kfill]').forEach(b => b.onclick = () => {
    const e = all[+b.dataset.kfill], p = e.list[0].p;
    e.empties.forEach(r => { r.w.pegon = p; }); touch(); NGAJI.toast(`${e.empties.length} kata diisi dari Kamus.`); renderKamus(); if (mode === 'edit') renderInspector();
  });
}
function openKamus() { showModal(kamusModal); $('#kamSearch').value = ''; renderKamus(); $('#kamSearch').focus(); }
function closeKamus() { hideModal(kamusModal); if (mode === 'edit') renderInspector(); }
$('#kamusBtn').onclick = openKamus;
$('#kamClose').onclick = $('#kamDone').onclick = closeKamus;
kamusModal.addEventListener('mousedown', e => { if (e.target === kamusModal) closeKamus(); });
$('#kamSearch').oninput = renderKamus;
$('#kamFillAll').onclick = () => {
  const all = kamusEntries(), n = all.reduce((x, e) => x + e.empties.length, 0); if (!n) return;
  if (!confirm(`Isi ${n} kata yang masih kosong dengan makna Pegon terbanyak dari Kamus?`)) return;
  all.forEach(e => e.empties.forEach(r => { r.w.pegon = e.list[0].p; }));
  touch(); NGAJI.toast(`${n} kata diisi dari Kamus.`); renderKamus(); if (mode === 'edit') renderInspector();
};

function renderInspector() {
  const body = $('#inspBody'), s = sel.sid && sentence(sel.sid);
  if (mj.on && (!sel.wid || mode !== 'edit')) { mjOff(); refreshBlocks(...page().sentences.map(x => x.id)); }
  let html = '';
  if (mode === 'edit') html += `<div class="pick-row"><button type="button" class="btn btn-sm ${pick.on ? 'btn-gold' : 'btn-tonal'}" id="pickBtn">${pick.on ? 'Batal memilih' : 'Pilih kalimat manual'}</button>` +
    `<small>${pick.on ? `Langkah ${pick.a ? 2 : 1}/2: klik kata ${pick.a ? 'terakhir' : 'pertama'} kalimat.` : 'Klik kata pertama lalu kata terakhir untuk menentukan kalimat yang diberi catatan.'}</small></div>`;
  if (!s) html += '<p>Pilih kalimat untuk melihat catatannya.</p>';
  else {
    const k = s.keterangan_kalimat ||= { catatan: '' };
    const rs = s.rentang || [], r = rs.find(x => x.id === sel.rid) || null;
    if (!r) sel.rid = null;
    if (r) {
      html += `<div class="rng-box"><span class="rng-lbl" dir="ltr">Kalimat pilihan</span><div class="insp-ar">${esc(rangeText(s, r))}</div>`;
      html += mode === 'read'
        ? (r.catatan ? `<div class="block" dir="rtl"><b>Catatan</b>${esc(r.catatan)}</div>` : '<p>Belum ada catatan untuk kalimat ini. Pindah ke Mode Edit untuk mengisi.</p>')
        : `<div class="field"><label>Catatan kalimat pilihan</label><textarea dir="rtl" data-rn>${esc(r.catatan)}</textarea></div>
           <div class="fmt-row"><button type="button" class="btn btn-sm" id="unRng">Lihat paragraf</button><button type="button" class="btn btn-danger btn-sm" id="delRng">Hapus pilihan</button></div>
           <div class="field"><label>Warna teks kalimat pilihan</label><div class="fmt-row"><input type="color" class="clr" id="rngColor" value="${okColor(r.warna) || '#ffffff'}"><button type="button" class="btn btn-sm" id="rngColorReset">Bawaan</button></div></div>`;
      html += '</div>';
    } else html += `<div class="insp-ar">${s.words.map(w => esc(w.arab)).join(' ')}</div>`;
    if (mode === 'read') {
      if (k.catatan) html += `<div class="block" dir="rtl"><b>${r ? 'Catatan paragraf' : 'Catatan'}</b>${esc(k.catatan)}</div>`;
      else if (!r) html += '<p>Belum ada catatan. Pindah ke Mode Edit untuk mengisi.</p>';
    } else {
      html += `<div class="field"><label>${rs.length ? 'Catatan paragraf' : 'Catatan'}</label><textarea dir="rtl" data-k="catatan">${esc(k.catatan)}</textarea></div>`;
      if (rs.length) html += `<div class="field"><label>Kalimat bercatatan di paragraf ini</label><div class="rng-list">${rs.map(x => {
        const ws = rangeWords(s, x).map(w => w.arab), t = ws.length > 5 ? ws.slice(0, 5).join(' ') + ' …' : ws.join(' ');
        return `<button type="button" class="rng-chip ar ${x.id === sel.rid ? 'on' : ''}" dir="rtl" data-rid="${x.id}">${esc(t)}</button>`;
      }).join('')}</div></div>`;
      const seg = (key, cur, items) => `<div class="seg" data-seg="${key}">${items.map(([v, l, ic]) => `<button type="button" data-v="${v}" title="${l}" class="${cur === v ? 'on' : ''}">${ic ? `<svg class="i"><use href="#i-al-${v}"/></svg>` : l}</button>`).join('')}</div>`;
      html += `<hr><div class="field"><label>Jenis blok</label>${seg('type', s.type || 'text', [['text', 'Teks'], ['heading', 'Judul'], ['sub', 'Sub bab']])}</div>
        <div class="field"><label>Perataan (seperti di Word)</label>${seg('align', s.align || 'right', [['right', 'Rata kanan'], ['center', 'Rata tengah'], ['left', 'Rata kiri'], ['justify', 'Rata kiri-kanan (Justify)']].map(x => [...x, 1]))}
          <div class="fmt-row"><label class="chk"><input type="checkbox" id="fmtBold" ${s.bold ? 'checked' : ''}>Tebal</label>
          <button type="button" class="btn btn-sm" id="mvUp" title="Geser ke atas"><svg class="i"><use href="#i-up"/></svg>Naik</button>
          <button type="button" class="btn btn-sm" id="mvDown" title="Geser ke bawah"><svg class="i"><use href="#i-down2"/></svg>Turun</button></div></div>
        <div class="field"><label>Warna teks paragraf ini</label><div class="fmt-row"><input type="color" class="clr" id="sentColor" value="${okColor(s.color) || '#ffffff'}"><button type="button" class="btn btn-sm" id="sentColorReset">Bawaan</button></div></div>
        <div class="field"><label>Hapus harakat permanen <small>(dapat diurungkan dengan Ctrl+Z)</small></label><div class="fmt-row"><button type="button" class="btn btn-sm btn-tonal" id="hkSent">Paragraf ini</button><button type="button" class="btn btn-sm btn-tonal" id="hkPage">Satu bab</button><button type="button" class="btn btn-sm btn-tonal" id="hkBook">Seluruh buku</button></div></div>`;
      const w = sel.wid && word(sel.wid);
      if (w) {
        const tset = new Set(targets(w));
        const frs = frasaAt(s, w.id), fpN = fp.on && fp.sid === s.id ? fp.idx.size : 0;
        // Daftar centang marju' dulu memuat SEMUA kata di bab (ribuan <label>) setiap kata diklik. Kini: kalimat di sekitar kalimat terpilih + kata yang sudah dicentang; sisanya lewat tombol.
        if (sel.tlWid !== w.id) { sel.tlAll = false; sel.tlWid = w.id; } // pilih kata lain -> kembali ke jendela sekitar
        const sents = page().sentences, cur = Math.max(0, sents.findIndex(x => x.id === sel.sid));
        const from = cur - TL_BACK, to = cur + TL_FWD;
        let list = '', total = 0, shown = 0;
        sents.forEach((st, si) => st.words.forEach((x, wi) => {
          if (x.id === w.id) return;
          total++;
          if (!sel.tlAll && (si < from || si > to) && !tset.has(x.id)) return;
          shown++;
          list += `<label class="chk"><input type="checkbox" data-t="${x.id}" ${tset.has(x.id) ? 'checked' : ''}><span class="ar" dir="rtl">${esc(x.arab)}</span><small>${si + 1}.${wi + 1}</small></label>`;
        }));
        if (shown < total) list += `<button type="button" class="btn btn-sm btn-tonal" id="tlAll">Tampilkan semua ${total} kata…</button>`;
        html += `<hr><div class="field"><label>Teks Arab kata</label><input type="text" class="ar" dir="rtl" data-w="arab" value="${esc(w.arab)}"></div>
          <div class="field"><label>Warna teks kata ini</label><div class="fmt-row"><input type="color" class="clr" id="wordColor" value="${okColor(w.color) || '#ffffff'}"><button type="button" class="btn btn-sm" id="wordColorReset">Bawaan</button></div></div>
          <div class="field"><label>Makna Pegon</label><input type="text" class="ar" dir="rtl" data-w="pegon" value="${esc(w.pegon)}"><div class="kms" id="kamusBox"></div></div>
          <div class="field"><label>Makna Pegon beberapa kata <small>(2 kata atau lebih, satu makna)</small></label>
            <div class="pick-row"><button type="button" class="btn btn-sm ${fp.on ? 'btn-gold' : 'btn-tonal'}" id="fpBtn">${fp.on ? 'Batal memilih' : 'Pilih beberapa kata'}</button>${fp.on ? `<button type="button" class="btn btn-sm btn-gold" id="fpSave"${fpN < 2 ? ' disabled' : ''}>Simpan (${fpN} kata)</button>` : ''}
              <small>${fp.on ? 'Klik kata-kata di teks; kata di antaranya ikut terpilih. Klik lagi untuk melepas.' : 'Kata berurutan dalam satu paragraf diberi satu makna Pegon.'}</small></div>
            ${frs ? `<div class="fr-card"><div class="fr-txt ar" dir="rtl">${esc(rangeText(s, frs))}</div><input type="text" class="ar" dir="rtl" data-fp placeholder="Makna Pegon untuk kata-kata ini" value="${esc(frs.pegon || '')}"><button type="button" class="btn btn-danger btn-sm" id="delFr">Hapus makna gabungan</button></div>` : ''}</div>
          <div class="field nh-field${nhMin ? ' min' : ''}"><div class="nh-head"><label>Kedudukan nahwu <small>(tampil kecil di atas kata)</small></label><span class="nh-sum ar" dir="rtl" id="nhSum">${esc(nhSummary(w))}</span>
            <button type="button" class="btn btn-sm btn-tonal nh-min" id="nhMin" title="${nhMin ? 'Bentangkan pilihan' : 'Ciutkan pilihan'}" aria-expanded="${nhMin ? 'false' : 'true'}"><svg class="i"><use href="#i-${nhMin ? 'plus' : 'minus'}"/></svg></button></div>
            <div class="nh-grid" id="nhGrid">${NAHWU.map(([k, sym, nm]) => `<button type="button" class="nh-chip ${w.nahwu === k ? 'on' : ''}" data-nh="${k}" title="${esc(NAHWU_BY[k][3])}"><b>${esc(sym)}</b><small>${esc(nm)}</small></button>`).join('')}</div>
            <input type="text" class="ar" dir="rtl" id="nhLabel" data-nhl placeholder="Tulisan penanda (boleh diganti)" value="${esc(w.nahwu ? nahwuLabel(w) : '')}"${w.nahwu ? '' : ' disabled'}></div>
          <div class="field"><label>Huruf dhomir pada kata ini <small>(klik huruf; kosong = seluruh kata)</small></label><div id="chips" class="chips" dir="rtl"></div></div>
          <div class="field"><label>Marju' — boleh lebih dari satu kata <small>(no. kalimat.no. kata)</small></label>
            <div class="pick-row"><button type="button" class="btn btn-sm ${mj.on ? 'btn-gold' : 'btn-tonal'}" id="mjBtn">${mj.on ? "Selesai memilih marju'" : "Pilih marju' dari teks"}</button><small>${mj.on ? "Klik kata di teks untuk menambah / melepas marju'." : "Atau klik langsung kata di teks tengah."} (<span id="mjCount">${tset.size}</span>)</small></div>
            <div class="tlist">${list || '<small>Belum ada kata lain di halaman ini.</small>'}</div></div>
          <button class="btn btn-danger btn-sm" id="delWord">Hapus kata</button>`;
      } else html += '<p><small>Klik sebuah kata untuk mengedit Pegon dan Dhomir.</small></p>';
      html += ' <button class="btn btn-danger btn-sm" id="delSent">Hapus kalimat</button>';
    }
  }
  if (mode === 'edit') html += `<hr><div class="field"><label>Tambah kalimat baru (teks Arab, kata dipisah spasi)</label><textarea id="newSent" dir="rtl" class="ar"></textarea>
    <div class="fmt-row"><select id="newType" class="sel-sm"><option value="text">Teks</option><option value="heading">Judul</option><option value="sub">Sub bab</option></select>
    <select id="newAlign" class="sel-sm"><option value="">Perataan bawaan</option><option value="center">Tengah</option><option value="justify">Justify</option><option value="right">Kanan</option><option value="left">Kiri</option></select></div></div>
    <button class="btn btn-tonal" id="addSent">Tambah kalimat</button> <button class="btn btn-gold" id="openImport"><svg class="i"><use href="#i-file"/></svg>Dari Word…</button>`;
  body.innerHTML = html;
  if (mode !== 'edit') return;

  $('#pickBtn')?.addEventListener('click', () => setPick(!pick.on));
  $('#fpBtn')?.addEventListener('click', () => setFp(!fp.on));
  $('#fpSave')?.addEventListener('click', saveFp);
  $('[data-fp]', body)?.addEventListener('input', e => { const r = frasaAt(sentence(sel.sid), sel.wid); if (r) { r.pegon = e.target.value; touch(); } });
  $('#delFr')?.addEventListener('click', () => {
    const st = sentence(sel.sid), r = frasaAt(st, sel.wid); if (!r) return;
    st.frasa = (st.frasa || []).filter(x => x.id !== r.id); if (!st.frasa.length) delete st.frasa;
    sel.fid = null; touch(); refreshBlocks(sel.sid); renderInspector();
  });
  $('#nhMin')?.addEventListener('click', e => { // ciutkan / bentangkan pilihan kedudukan nahwu (diingat)
    nhMin = !nhMin; try { localStorage.setItem('ngaji.nhMin', nhMin ? '1' : '0'); } catch (err) {}
    $('.nh-field')?.classList.toggle('min', nhMin);
    const b = e.currentTarget; b.title = nhMin ? 'Bentangkan pilihan' : 'Ciutkan pilihan'; b.setAttribute('aria-expanded', nhMin ? 'false' : 'true');
    const u = b.querySelector('use'); if (u) u.setAttribute('href', '#i-' + (nhMin ? 'plus' : 'minus'));
  });
  $('#mjBtn')?.addEventListener('click', () => {
    if (!sel.wid) return;
    if (pick.on) setPick(false);
    if (fp.on) fpReset(true);
    mj.on = !mj.on; document.body.classList.toggle('mj-pick', mj.on);
    if (mj.on) NGAJI.toast("Klik kata di teks untuk menjadikannya marju'. Klik lagi untuk melepas.");
    refreshBlocks(...page().sentences.map(x => x.id)); renderInspector();
  });
  body.querySelectorAll('[data-rid]').forEach(b => b.onclick = () => { sel.rid = b.dataset.rid; sel.wid = null; render(); });
  body.querySelectorAll('[data-rn]').forEach(el => el.oninput = () => {
    const r = (sentence(sel.sid).rentang || []).find(x => x.id === sel.rid); if (r) { r.catatan = el.value; touch(); }
  });
  $('#unRng')?.addEventListener('click', () => { sel.rid = null; render(); });
  $('#delRng')?.addEventListener('click', () => {
    const st = sentence(sel.sid); st.rentang = (st.rentang || []).filter(x => x.id !== sel.rid);
    if (!st.rentang.length) delete st.rentang;
    sel.rid = null; touch(); render();
  });
  body.querySelectorAll('[data-seg] button').forEach(b => b.onclick = () => {
    const st = sentence(sel.sid), key = b.parentElement.dataset.seg;
    if (key === 'type') { st.type = b.dataset.v; if (st.type === 'heading' && !st.align) st.align = 'center'; }
    else st.align = b.dataset.v;
    touch(); render();
  });
  // warna teks tertentu: kata > kalimat pilihan > paragraf (disimpan sebagai "color" / "warna" di data)
  const bindColor = (id, get, set) => {
    const inp = $('#' + id), rst = $('#' + id + 'Reset'); if (!inp) return;
    inp.oninput = () => { const o = get(); if (o) { set(o, inp.value); touch(); refreshBlocks(sel.sid); } };
    if (rst) rst.onclick = () => { const o = get(); if (o) { set(o, null); touch(); refreshBlocks(sel.sid); inp.value = '#ffffff'; } };
  };
  bindColor('sentColor', () => sentence(sel.sid), (o, v) => v ? o.color = v : delete o.color);
  bindColor('wordColor', () => word(sel.wid), (o, v) => v ? o.color = v : delete o.color);
  bindColor('rngColor', () => (sentence(sel.sid).rentang || []).find(x => x.id === sel.rid), (o, v) => v ? o.warna = v : delete o.warna);
  $('#fmtBold')?.addEventListener('change', e => { sentence(sel.sid).bold = e.target.checked; touch(); refreshBlocks(sel.sid); });
  const move = d => {
    const arr = page().sentences, i = arr.findIndex(x => x.id === sel.sid), j = i + d;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; touch(); render();
    reader.querySelector('.sentence.selected')?.scrollIntoView({ block: 'nearest' });
  };
  $('#mvUp')?.addEventListener('click', () => move(-1));
  $('#mvDown')?.addEventListener('click', () => move(1));
  $('#openImport')?.addEventListener('click', () => openImport());
  $('#hkSent')?.addEventListener('click', () => stripHarakatIn([sentence(sel.sid)], 'paragraf ini'));
  $('#hkPage')?.addEventListener('click', () => stripHarakatIn(page().sentences, 'bab ini'));
  $('#hkBook')?.addEventListener('click', () => stripHarakatIn(data.pages.flatMap(p => p.sentences), 'seluruh buku'));
  body.querySelectorAll('[data-k]').forEach(el => el.oninput = () => { sentence(sel.sid).keterangan_kalimat[el.dataset.k] = el.value; touch(); });
  const fillChips = () => {
    const w = sel.wid && word(sel.wid), box = $('#chips'); if (!w || !box) return;
    const on = new Set(w.dhomir_letters || []);
    box.innerHTML = letters(w.arab).map((c, i) => `<button type="button" class="chip ar ${on.has(i) ? 'on' : ''}" data-l="${i}">${esc(c)}</button>`).join('');
    box.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
      const i = +b.dataset.l, cur = new Set(w.dhomir_letters || []);
      cur.has(i) ? cur.delete(i) : cur.add(i);
      w.dhomir_letters = [...cur].sort((x, y) => x - y);
      b.classList.toggle('on', cur.has(i)); touch(); refreshWord(w.id);
    });
  };
  body.querySelectorAll('[data-w]').forEach(el => el.oninput = () => {
    const w = word(sel.wid); w[el.dataset.w] = el.value;
    if (el.dataset.w === 'arab') { const n = letters(w.arab).length; w.dhomir_letters = (w.dhomir_letters || []).filter(i => i < n); fillChips(); refreshWord(w.id); } // Pegon tidak tampil di teks -> tak perlu render ulang
    touch();
  });
  $('#tlAll', body)?.addEventListener('click', () => { sel.tlAll = true; renderInspector(); });
  $('.tlist', body)?.addEventListener('change', e => { // satu handler untuk ribuan checkbox
    const el = e.target.closest('[data-t]'); if (!el) return;
    const w = word(sel.wid), cur = targets(w).filter(id => id !== el.dataset.t);
    if (el.checked) cur.push(el.dataset.t);
    setTargets(w, cur); touch(); // marju' hanya digambar saat hover: tak perlu render ulang
  });
  // kedudukan nahwu: klik singkatan untuk memilih (klik lagi = lepas); tulisan penanda boleh diganti per kata
  const nhSync = w => {
    const inp = $('#nhLabel');
    body.querySelectorAll('[data-nh]').forEach(b => b.classList.toggle('on', w.nahwu === b.dataset.nh));
    if (inp) { inp.disabled = !w.nahwu; inp.value = w.nahwu ? nahwuLabel(w) : ''; }
    const sm = $('#nhSum'); if (sm) sm.textContent = nhSummary(w);
  };
  body.querySelectorAll('[data-nh]').forEach(b => b.onclick = () => {
    const w = word(sel.wid); if (!w) return;
    if (w.nahwu === b.dataset.nh) delete w.nahwu; else w.nahwu = b.dataset.nh;
    delete w.nahwuLabel;
    nhSync(w); touch(); refreshBlocks(sel.sid);
    if (w.nahwu === 'custom') $('#nhLabel')?.focus();
  });
  $('#nhLabel')?.addEventListener('input', e => {
    const w = word(sel.wid); if (!w || !w.nahwu) return;
    const v = e.target.value.trim(), def = w.nahwu !== 'custom' && NAHWU_BY[w.nahwu] ? NAHWU_BY[w.nahwu][1] : '';
    if (v && v !== def) w.nahwuLabel = v; else delete w.nahwuLabel;
    const sm = $('#nhSum'); if (sm) sm.textContent = nhSummary(w);
    touch(); refreshBlocks(sel.sid);
  });
  fillChips(); fillKamus();
  $('#delWord')?.addEventListener('click', () => {
    const s = sentence(sel.sid), old = s.words; s.words = old.filter(w => w.id !== sel.wid);
    fixRanges(s, old); fixFrasa(s, old);
    dropTargets([sel.wid]);
    sel.wid = null; touch(); render();
  });
  $('#delSent')?.addEventListener('click', () => {
    const gone = sentence(sel.sid).words.map(w => w.id);
    page().sentences = page().sentences.filter(s => s.id !== sel.sid);
    dropTargets(gone);
    sel = { sid: null, wid: null }; touch(); render();
  });
  $('#addSent').onclick = () => {
    const txt = $('#newSent').value.trim(); if (!txt) return;
    const type = $('#newType').value;
    const ns = newSentence(txt, { type, align: $('#newAlign').value || (type === 'heading' ? 'center' : null) });
    page().sentences.push(ns);
    sel = { sid: ns.id, wid: null }; touch(); render();
  };
}

/* ---------- Panel, mode, navigasi ---------- */
const LEFT = ['toc', 'inspector'];
function openDrawer(name) {
  drawers[name] = true;
  if (LEFT.includes(name)) LEFT.filter(n => n !== name).forEach(n => { drawers[n] = false; });
}
function syncDrawers() {
  if (drawers.toc && tocDirty) { renderToc(); tocDirty = false; }
  // Mode Baca + "Catatan di tengah layar": panel jadi dialog di tengah (latar di-blur), hanya tampil saat ada kalimat terpilih
  const center = !!S.centerNote && mode === 'read';
  const showNote = drawers.inspector && (S.showInspector || mode === 'edit') && (!center || !!sel.sid);
  if (drawers.toc && !$('#toc').classList.contains('open')) requestAnimationFrame(() => updateTocActive(true));
  $('#toc').classList.toggle('open', drawers.toc);
  $('#inspector').classList.toggle('open', showNote);
  $('#inspector').classList.toggle('center', center);
  document.body.classList.toggle('note-center', showNote && center);
  // panel samping mendorong area baca (kiri: daftar isi / catatan; kanan: pengaturan)
  const dl = !!(drawers.toc || (showNote && !center)), dr = !!drawers.settings;
  if (dl !== document.body.classList.contains('dl') || dr !== document.body.classList.contains('dr'))
    flipLayout(() => { document.body.classList.toggle('dl', dl); document.body.classList.toggle('dr', dr); });
  $('#settings').classList.toggle('open', drawers.settings);
  root.classList.toggle('settings-open', !!drawers.settings); // tombol keluar Tampilan Bersih bergeser agar tidak tertutup panel pengaturan
  $('#tocBtn').classList.toggle('on', drawers.toc);
  $('#inspBtn').classList.toggle('on', showNote);
  $('#setBtn').classList.toggle('on', drawers.settings);
}
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => {
  drawers[b.dataset.close] = false;
  if (b.dataset.close === 'inspector' && S.centerNote && mode === 'read') { clearSel(); render(); } // dialog ditutup -> sorotan hilang
  syncDrawers();
});
$('#tocBtn').onclick = () => { drawers.toc ? drawers.toc = false : openDrawer('toc'); syncDrawers(); };
$('#setBtn').onclick = () => { drawers.settings = !drawers.settings; syncDrawers(); };
$('#inspBtn').onclick = () => {
  if (drawers.inspector && (S.showInspector || mode === 'edit')) drawers.inspector = false;
  else {
    openDrawer('inspector'); S.showInspector = true; applySettings(); buildSettings();
    if (S.centerNote && mode === 'read' && !sel.sid) NGAJI.toast('Klik sebuah kalimat untuk melihat catatannya.');
  }
  syncDrawers();
};
$('#harakatBtn').onclick = () => { S.hideHarakat = !S.hideHarakat; applySettings(); buildSettings(); NGAJI.toast(S.hideHarakat ? 'Harakat disembunyikan.' : 'Harakat ditampilkan.'); };
$('#liteBtn').onclick = () => { S.liteMode = !S.liteMode; applySettings(); buildSettings(); NGAJI.toast(S.liteMode ? 'Mode Lite aktif' : 'Mode Lite nonaktif'); };
$('#clickSoundBtn').onclick = () => { S.clickSound = S.clickSound === false; applySettings(); buildSettings(); NGAJI.toast(S.clickSound ? 'Suara klik dinyalakan.' : 'Suara klik dimatikan.'); };
$('#resetSet').onclick = () => { S = { ...DEFAULTS }; buildSettings(); applySettings(); };

function setMode(m) {
  mode = m; mjOff(); fpReset(false); pick.on = false; pick.a = null; document.body.classList.remove('picking');
  document.body.classList.toggle('editing', m === 'edit');
  $('#modeSwitch').dataset.mode = m;
  sel.wid = null; render(); syncDrawers();
  document.body.classList.toggle('hp', mode === 'read' && !!S.showHover); showPanel(null);
}
document.querySelectorAll('#modeSwitch button').forEach(b => b.onclick = () => setMode(b.dataset.mode));

/* ---------- Animasi masuk teks saat pindah bab / sub bab: judul lalu paragraf muncul berurutan (naik + memudar, arah mengikuti maju / mundur) ---------- */
let nhEnterT = 0;
function nhEnter() { // penanda nahwu muncul membal sebentar (hanya saat bab dibuka / gaya animasi diganti, bukan tiap paragraf digambar ulang)
  if (typeof reader === 'undefined' || !reader) return;
  reader.classList.add('nh-enter'); clearTimeout(nhEnterT); nhEnterT = setTimeout(() => reader.classList.remove('nh-enter'), 1500);
}
let enterAnims = [];
/* Teks Arab pindah bab / sub bab: fly-in 3D yang sama dengan saat memilih kitab (lihat sbFly di styles.css):
   tiap blok datang dari kedalaman (translateZ + perspektif) dengan pegas, berurutan; blok pertama dari atas. Hanya teks di #reader. */
function enterAnim() {
  enterAnims.forEach(a => a.cancel()); enterAnims = [];
  nhEnter();
  if (reduceMotion.matches) return;
  const P = 'perspective(1100px)', FIN = `${P} translate3d(0,0,0) rotateX(0deg) rotateY(0deg) scale(1)`;
  [...reader.children].slice(0, 16).forEach((el, i) => {
    if (!el.animate) return;
    const first = i === 0, fy = first ? -30 : 46, fz = first ? -380 : -260, frx = first ? -10 : 12;
    enterAnims.push(el.animate(
      [{ opacity: 0, transformOrigin: '50% 100%', transform: `${P} translate3d(0,${fy}px,${fz}px) rotateX(${frx}deg) rotateY(0deg) scale(1)` },
       { opacity: 1, transformOrigin: '50% 100%', transform: FIN }],
      { duration: 1000, delay: 120 + i * 55, easing: 'cubic-bezier(.2,1.2,.3,1)', fill: 'backwards' }));
  });
}
function goTo(n, sid, titleOnly) {
  if (n < 0 || n >= data.pages.length) return;
  const dir = n > pi ? 1 : n < pi ? -1 : 0, prevSub = subSid;
  goToNow(n, sid, titleOnly);
  enterAnim(dir || (subSid !== prevSub ? 1 : 0));
}
function goToNow(n, sid, titleOnly) {
  pi = n; mjOff(); fpReset(false); sel = { sid: null, wid: null }; showPanel(null);
  pick.on = false; pick.a = null; document.body.classList.remove('picking');
  const isSub = !!sid && data.pages[n].sentences.some(x => x.id === sid && x.type === 'sub');
  subSid = mode === 'read' && isSub ? sid : null; // sub bab dibuka -> hanya tampilkan itu
  subTitleOnly = !!subSid && !!titleOnly;
  render();
  if (subSid) { $('#stage').scrollTo({ top: 0 }); recordLast(); return; }
  const el = sid && reader.querySelector(`[data-sid="${CSS.escape(sid)}"]`);
  if (el) el.scrollIntoView({ block: 'start' }); else $('#stage').scrollTo({ top: 0 });
  recordLast();
}
$('#resumeDock').onclick = resume;
$('#doneDock').onclick = () => { const k = curUnits(); setUnits(k, !unitsDone(k)); };
$('#prev').onclick = () => stepNav(-1);
$('#next').onclick = () => stepNav(1);
$('#addPage').onclick = () => {
  data.pages.push({ id: uid('p'), title: `Bab ${data.pages.length + 1}`, sentences: [] });
  touch(); goTo(data.pages.length - 1);
};
$('#saveBtn').onclick = () => NGAJI.save();
$('#openBtn').onclick = () => NGAJI.openProject();
$('#newBtn').onclick = () => NGAJI.newProject();
$('#exportBtn').onclick = () => NGAJI.exportJs();
$('#resetAll').onclick = () => NGAJI.resetData();

/* ---------- Tambah teks Arab dari Word (tempel HTML / file .docx) ---------- */
const modal = $('#importModal'), zone = $('#wordPaste'), impPrev = $('#impPreview'), impSum = $('#impSummary');
let impBlocks = [];
// rata tengah => sub bab otomatis (kecuali Heading 1 yang dijadikan bab baru)
const effType = (b, asPage, centerSub) => (centerSub && b.align === 'center' && !(asPage && b.h1)) ? 'sub' : b.type;
function buildFromBlocks(blocks, h1AsPage, centerSub) {
  const head = [], pages = []; let cur = head;
  blocks.forEach(b => {
    if (h1AsPage && b.h1) { const np = { id: uid('p'), title: b.text, sentences: [] }; pages.push(np); cur = np.sentences; return; }
    cur.push(newSentence(b.text, { type: effType(b, h1AsPage, centerSub), align: b.align, bold: b.bold }));
  });
  return { head, pages };
}
function refreshImport() {
  const asPage = $('#optH1').checked, cs = $('#optCenter').checked, n = impBlocks.length;
  const c = { text: 0, heading: 0, sub: 0, center: 0, justify: 0, left: 0, h1: 0 };
  impBlocks.forEach(b => { c[effType(b, asPage, cs)]++; if (b.align === 'center' || b.align === 'justify' || b.align === 'left') c[b.align]++; if (b.h1) c.h1++; });
  impSum.textContent = n ? `${n} blok terbaca — ${c.heading} judul, ${c.sub} sub bab, ${c.text} teks · rata tengah ${c.center}, justify ${c.justify}, rata kiri ${c.left}` + (asPage ? ` · ${c.h1} bab baru` : '') : '';
  impPrev.innerHTML = impBlocks.slice(0, 80).map(b =>
    `<div class="sentence t-${effType(b, asPage, cs)} al-${b.align || 'right'}${b.bold ? ' bold' : ''}">${asPage && b.h1 ? '<span class="imp-tag">Bab baru</span>' : ''}${esc(b.text)}</div>`).join('') +
    (n > 80 ? `<div class="imp-more">… dan ${n - 80} blok lainnya</div>` : '');
  $('#impGo').disabled = !n;
}
function setBlocks(blocks, minH1) {
  impBlocks = blocks;
  $('#optH1').checked = blocks.filter(b => b.h1).length >= minH1;
  refreshImport();
  if (!blocks.length) NGAJI.toast('Tidak ada teks yang terbaca.');
}
function ingestClip(dt) {
  const html = dt.getData('text/html'), txt = dt.getData('text/plain');
  let blocks = html ? WordImport.fromHtml(html) : [];
  if (!blocks.length && txt) blocks = WordImport.fromText(txt);
  setBlocks(blocks, 2);
}
async function loadDocx(file) {
  try { setBlocks(await WordImport.fromDocx(await file.arrayBuffer()), 1); }
  catch (err) { NGAJI.toast('Gagal membaca .docx: ' + (err && err.message || err)); }
}
function openImport() {
  impBlocks = []; zone.innerHTML = ''; $('#optH1').checked = false; refreshImport();
  const where = $('#optWhere'), has = !!(sel.sid && sentence(sel.sid));
  where.querySelector('[value=after]').disabled = !has; where.value = has ? 'after' : 'end';
  showModal(modal); zone.focus();
}
const closeImport = () => { hideModal(modal); };
zone.addEventListener('paste', e => { e.preventDefault(); ingestClip(e.clipboardData); zone.innerHTML = ''; });
zone.addEventListener('keydown', e => { if (!e.ctrlKey && !e.metaKey && e.key.length === 1) e.preventDefault(); });
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
zone.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('drag');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) { if (/\.docx$/i.test(f.name)) loadDocx(f); else NGAJI.toast('Hanya file .docx yang didukung.'); } else ingestClip(e.dataTransfer);
});
$('#pickDocx').onclick = () => $('#docxFile').click();
$('#docxFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadDocx(f); };
$('#optH1').onchange = $('#optCenter').onchange = refreshImport;
$('#impClose').onclick = $('#impCancel').onclick = closeImport;
$('#importBtn').onclick = openImport;
$('#impGo').onclick = () => {
  if (!impBlocks.length) return;
  const { head, pages } = buildFromBlocks(impBlocks, $('#optH1').checked, $('#optCenter').checked);
  const arr = page().sentences;
  const at = $('#optWhere').value === 'after' && sel.sid ? arr.findIndex(x => x.id === sel.sid) + 1 : arr.length;
  arr.splice(at, 0, ...head);
  pages.forEach((np, k) => data.pages.splice(pi + 1 + k, 0, np));
  const nBlocks = head.length + pages.reduce((n, x) => n + x.sentences.length, 0);
  closeImport(); touch();
  if (pages.length) goTo(pi + 1); else render();
  NGAJI.toast(`${nBlocks} blok ditambahkan` + (pages.length ? `, ${pages.length} bab baru.` : '.'));
};

document.addEventListener('keydown', e => {
  if (!kamusModal.hidden) { if (e.key === 'Escape') closeKamus(); return; }
  if (!modal.hidden) { if (e.key === 'Escape') closeImport(); return; }
  if (e.key === 'Escape') {
    if (pick.on) { setPick(false); return; }
    if (fp.on) { fpReset(true); return; }
    if (mj.on) { mjOff(); refreshBlocks(...page().sentences.map(x => x.id)); renderInspector(); return; }
    drawers.toc = drawers.inspector = drawers.settings = false;
    if (S.centerNote && mode === 'read' && sel.sid) { clearSel(); render(); }
    syncDrawers();
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) e.target.blur();
    return;
  }
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight') stepNav(1); // kanan = berikutnya
  if (e.key === 'ArrowLeft') stepNav(-1); // kiri = sebelumnya
});

/* ---------- Mode tenang: animasi latar dijeda selama ada interaksi (kaca/backdrop-blur tidak perlu digambar ulang tiap frame) ---------- */
let calmT = 0, calmOn = false;
function calm() {
  if (!calmOn) { calmOn = true; document.body.classList.add('calm'); }
  clearTimeout(calmT); calmT = setTimeout(() => { calmOn = false; document.body.classList.remove('calm'); }, 1400);
}
['pointermove', 'pointerdown', 'wheel', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, calm, { passive: true, capture: true }));
stageEl.addEventListener('scroll', calm, { passive: true });
// selama menggulir, animasi penanda nahwu dijeda (kerja render lebih ringan)
let scrollingT = 0, scrollingOn = false;
stageEl.addEventListener('scroll', () => {
  if (!scrollingOn) { scrollingOn = true; document.body.classList.add('scrolling'); hideTip(); clearLink(); frHot(null); }
  clearTimeout(scrollingT); scrollingT = setTimeout(() => { scrollingOn = false; document.body.classList.remove('scrolling'); }, 160);
}, { passive: true });

/* ---------- Scroll halus: roda mouse / touchpad meluncur dengan easing, bukan loncat per langkah ---------- */
(function smoothScroll() {
  const TAU = 0.085; // detik; makin kecil makin responsif, makin besar makin licin
  let target = 0, cur = 0, lastSet = 0, raf = 0, prev = 0;
  const maxTop = () => Math.max(0, stageEl.scrollHeight - stageEl.clientHeight);
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  function step(t) {
    const dt = Math.min(0.05, (t - prev) / 1000 || 0.016); prev = t;
    if (Math.abs(stageEl.scrollTop - lastSet) > 2) { raf = 0; return; } // digeser dari luar (scrollbar, keyboard, pindah bab): lepaskan kendali
    target = Math.min(target, maxTop());
    cur += (target - cur) * (1 - Math.exp(-dt / TAU));
    const done = Math.abs(target - cur) < 0.4;
    if (done) cur = target;
    stageEl.scrollTo({ top: cur, behavior: 'instant' }); // 'instant': tidak ikut scroll-behavior:smooth di CSS
    lastSet = stageEl.scrollTop;
    raf = done ? 0 : requestAnimationFrame(step);
  }
  stageEl.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey || reduceMotion.matches || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (maxTop() <= 0) return;
    e.preventDefault();
    if (!raf) { cur = target = stageEl.scrollTop; lastSet = cur; prev = performance.now(); }
    const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? stageEl.clientHeight : 1;
    target = Math.max(0, Math.min(maxTop(), target + e.deltaY * k));
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: false });
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => stageEl.addEventListener(ev, stop, { passive: true, capture: true }));
})();

/* ---------- Klik di luar teks -> lepas sorotan kalimat/kata terpilih ---------- */
const KEEP_SEL = '.sentence,.drawer,.appbar,.toc-tab,.dock,#hoverPanel,.modal,#snack,#tooltip,#devPanel';
document.addEventListener('click', e => {
  if (pick.on || fp.on || !modal.hidden) return;
  if (e.composedPath().some(n => n.matches && n.matches(KEEP_SEL))) return; // composedPath: tetap benar walau elemen sudah dirender ulang
  if (!sel.sid && !sel.wid && !sel.rid) return;
  clearSel();
  if (S.centerNote && mode === 'read') drawers.inspector = false;
  render(); syncDrawers();
});

/* ---------- Init ---------- */
$('#bookTitle').textContent = /^(proyek baru|gasss)$/i.test((data.title || '').trim()) ? 'created by uteehehe' : (data.title || 'Ngaji'); // subjudul di bawah NGAJI
buildSettings(); applySettings(false); showPanel(null); render(); nhEnter();
// app-bridge.js memasang listFonts asli setelah file ini, lalu memanggil refreshFonts lagi
NGAJI.refreshFonts = () => NGAJI.listFonts().then(f => { userFonts = f || []; buildSettings(); });
NGAJI.refreshFonts();

/* ---------- Ganti kitab di tempat (tanpa memuat ulang jendela) ----------
   Dipakai jendela "Pilih Kitab": bilah atas, daftar isi, dock, dan panel lain tetap diam; hanya teks Arab di #reader yang
   memudar keluar lalu terbang masuk (CSS html[data-reveal][data-ready] #reader>*). Pengaturan tampilan global tetap dipakai. */
let swapT = 0;
NGAJI.fadeOutText = () => { const r = $('#reader'); if (r) r.classList.add('ng-out'); };
NGAJI.swapData = obj => {
  const keepSettings = { ...S }, keepDev = data.dev;
  if (!obj || !Array.isArray(obj.pages) || !obj.pages.length) throw new Error('Data kitab tidak valid');
  obj.pages.forEach(p => {
    p.sentences = p.sentences || [];
    p.sentences.forEach(sn => {
      if (!['text', 'heading', 'sub'].includes(sn.type)) sn.type = 'text';
      if (!['right', 'center', 'left', 'justify'].includes(sn.align)) sn.align = null;
      sn.bold = sn.bold === true;
      sn.keterangan_kalimat = { catatan: (sn.keterangan_kalimat && typeof sn.keterangan_kalimat.catatan === 'string') ? sn.keterangan_kalimat.catatan : '' };
    });
  });
  if (obj.progress && (typeof obj.progress !== 'object' || Array.isArray(obj.progress))) delete obj.progress;
  obj.settings = keepSettings; if (keepDev) obj.dev = keepDev;
  data = obj;
  // keadaan bacaan kembali ke awal kitab baru
  pi = 0; sel = { sid: null, wid: null, rid: null, fid: null }; subSid = null; subTitleOnly = false;
  dataVer++; kamusDirty = true; idxPage = null; idxVer = -1;
  tocOpen.clear(); tocSeenPi = -1; tocDirty = true;
  mjOff(); fpReset(false); pick.on = false; pick.a = null; document.body.classList.remove('picking');
  clearTimeout(hist.timer); hist.timer = 0; hist.undo.length = 0; hist.redo.length = 0; hist.base = histSnap(); histPaint();
  $('#bookTitle').textContent = /^(proyek baru|gasss)$/i.test((data.title || '').trim()) ? 'created by uteehehe' : (data.title || 'Ngaji');
  // animasi fly-in hanya untuk teks: pasang penanda sebelum teks baru digambar, lalu lepas setelah selesai
  clearTimeout(swapT);
  root.setAttribute('data-reveal', '1'); root.setAttribute('data-ready', '1');
  showPanel(null); render(); syncDrawers(); nhEnter(); paintProgress(); paintResume();
  const st = $('#stage'); if (st) st.scrollTo({ top: 0, behavior: 'instant' });
  const r = $('#reader'); if (r) r.classList.remove('ng-out'); // teks baru langsung tampil (fly-in ditangani CSS)
  swapT = setTimeout(() => { root.removeAttribute('data-reveal'); root.removeAttribute('data-ready'); }, 2800);
};

/* ---------- Tampilan Bersih ----------
   Menyembunyikan bilah atas & dock; panel samping (daftar isi / catatan / pengaturan) tetap. Kata-kata meluncur halus ke posisi baru (FLIP). */
let cleanOn = false;
function setClean(on) {
  on = on == null ? !cleanOn : !!on;
  if (on === cleanOn) return;
  cleanOn = on;
  hideTip();
  flipLayout(() => root.classList.toggle('clean', on));
  const b = $('#cleanBtn'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  const x = $('#cleanExit'); if (x) { x.tabIndex = on ? 0 : -1; x.setAttribute('aria-hidden', on ? 'false' : 'true'); }
  if (on) { const m = 'Tampilan bersih aktif — klik tombol di pojok kanan atas atau tekan Ctrl+Shift+H untuk kembali'; NGAJI.toast(window.NGAJI_I18N ? NGAJI_I18N.t(m) : m); }
}
NGAJI.cleanView = setClean;
$('#cleanBtn').onclick = () => setClean();
$('#cleanExit').onclick = () => setClean(false);
window.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'H' || e.key === 'h')) { e.preventDefault(); setClean(); }
}, true);

/* ---------- Tombol Urungkan / Ulangi di dock ---------- */
$('#undoBtn').onclick = histUndo;
$('#redoBtn').onclick = histRedo;
histPaint();

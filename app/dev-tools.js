/*
 * Developer Studio — satu tombol (</>) di bilah atas untuk mengubah tampilan LANGSUNG, tanpa membuka kode.
 *   Tema      : warna tiap tema, ukuran/radius/kecepatan panel, opasitas kaca, aurora, font antarmuka
 *   Animasi   : durasi, tunda & kurva gerak teks saat panel muncul, kecepatan geser panel
 *   Elemen    : klik bagian mana pun di layar -> ubah warna, ukuran, jarak, bayangan, dll.
 *   CSS       : kotak CSS bebas (langsung berlaku)
 * Semua perubahan tersimpan otomatis di dalam file data (kunci "dev") dan ikut ter-ekspor.
 * Pintasan: Ctrl+Shift+D. Saklar "Aktif" di panel membandingkan dengan tampilan asli.
 * Dimuat setelah renderer.js & app-bridge.js. Dibungkus IIFE agar tidak bentrok dengan variabel global renderer.
 */
(function () {
  'use strict';
  const NGAJI = window.NGAJI;
  if (!NGAJI || !NGAJI.getData) return;
  const $ = (s, r = document) => r.querySelector(s);
  const root = document.documentElement;
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const clean = s => String(s == null ? '' : s).replace(/[;{}]/g, '').trim();
  const theme = () => root.dataset.theme || 'aurora';

  /* ---------- Data & penerapan ---------- */
  const FLIP0 = Object.assign({ ms: 720, wave: 140, ease: 'cubic-bezier(.4,0,.1,1)' }, NGAJI.flip || {});
  const FLIP = NGAJI.flip || (NGAJI.flip = Object.assign({}, FLIP0));

  function dev() {
    const d = NGAJI.getData();
    const v = d.dev && typeof d.dev === 'object' && !Array.isArray(d.dev) ? d.dev : (d.dev = {});
    for (const k of ['vars', 'num', 'str', 'anim', 'rules']) if (!v[k] || typeof v[k] !== 'object' || Array.isArray(v[k])) v[k] = {};
    if (typeof v.css !== 'string') v.css = '';
    if (v.on === undefined) v.on = true;
    return v;
  }

  const COLORS = [
    ['--bg', 'Latar belakang'], ['--bg2', 'Latar panel & kolom'], ['--on', 'Teks utama'], ['--on2', 'Teks redup'],
    ['--primary', 'Aksen utama'], ['--on-primary', 'Teks di atas aksen utama'], ['--gold', 'Aksen emas / judul'], ['--on-gold', 'Teks di atas aksen emas'],
    ['--link-def', 'Warna marju’ bawaan'], ['--tip-bg-def', 'Latar tooltip bawaan']
  ];
  const auroraBase = () => parseFloat(getComputedStyle(root).getPropertyValue('--aur')) || 0;
  const NUM = [
    { k: 'drwW', tab: 'tema', label: 'Lebar panel samping', min: 260, max: 560, step: 2, unit: 'px', def: 380, css: v => [`--drw-w:${v}px`] },
    { k: 'drwR', tab: 'tema', label: 'Radius sudut panel', min: 0, max: 56, step: 1, unit: 'px', def: 28, css: v => [`--drw-r:${v}px`] },
    { k: 'drwTop', tab: 'tema', label: 'Jarak panel dari atas', min: 0, max: 200, step: 1, unit: 'px', def: 80, css: v => [`--drw-top:${v}px`] },
    { k: 'drwBot', tab: 'tema', label: 'Jarak panel dari bawah', min: 0, max: 200, step: 1, unit: 'px', def: 14, css: v => [`--drw-bot:${v}px`] },
    { k: 'glassA', tab: 'tema', label: 'Opasitas kaca (bilah atas & dock)', min: .2, max: 1, step: .01, unit: '', def: .62, css: v => [`--glass:color-mix(in srgb,var(--bg2) ${Math.round(v * 100)}%,transparent)`] },
    { k: 'glass2A', tab: 'tema', label: 'Opasitas panel & dialog', min: .4, max: 1, step: .01, unit: '', def: .9, css: v => [`--glass2:color-mix(in srgb,var(--bg2) ${Math.round(v * 100)}%,transparent)`] },
    { k: 'aur', tab: 'tema', label: 'Intensitas cahaya aurora', min: 0, max: 1, step: .01, unit: '', def: auroraBase, css: v => [`--aur:${v}`] },
    { k: 'drwMs', tab: 'anim', label: 'Kecepatan geser panel', min: 0, max: 1500, step: 10, unit: 'ms', def: 400, css: v => [`--drw-ms:${v}`] }
  ];
  const STR = [{ k: 'ui', v: '--ui', label: 'Font antarmuka (tombol, menu, panel)', ph: 'mis. Inter, "Segoe UI", sans-serif' }];

  function buildCss() {
    const v = dev(), out = [];
    for (const [th, map] of Object.entries(v.vars)) {
      const d = Object.entries(map).map(([k, val]) => `${k}:${clean(val)}!important`).join(';');
      if (d) out.push(`html[data-theme="${th}"]{${d}}`);
    }
    const g = [];
    for (const n of NUM) if (v.num[n.k] != null) g.push(...n.css(v.num[n.k]).map(x => x + '!important'));
    for (const s of STR) if (v.str[s.k]) g.push(`${s.v}:${clean(v.str[s.k])}!important`);
    if (g.length) out.push(`html[data-theme]{${g.join(';')}}`);
    for (const [sel, d] of Object.entries(v.rules)) {
      const body = Object.entries(d).filter(([, x]) => clean(x)).map(([p, x]) => `${p}:${clean(x)}!important`).join(';');
      if (body) out.push(`${sel}{${body}}`);
    }
    if (v.css.trim()) out.push(v.css);
    return out.join('\n');
  }

  const style = document.createElement('style'); style.id = 'devStyle'; document.head.appendChild(style);
  let saveT = 0;
  function apply() {
    const v = dev();
    style.textContent = buildCss();
    style.disabled = !v.on;
    Object.assign(FLIP, FLIP0, v.on ? v.anim : {});
  }
  function change() { apply(); if (NGAJI.saveLook) NGAJI.saveLook(); clearTimeout(saveT); saveT = setTimeout(() => NGAJI.onChange && NGAJI.onChange(), 350); }

  /* ---------- Util warna ---------- */
  // canvas membaca format warna modern apa pun (color-mix, color(srgb …), rgba, nama warna) menjadi #rrggbb
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  function toHex(c) {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000000'; ctx.fillStyle = String(c || '');
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [0, 1, 2].map(i => d[i].toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Panel ---------- */
  const panel = document.createElement('div');
  panel.id = 'devPanel'; panel.className = 'glass'; panel.setAttribute('aria-label', 'Developer Studio');
  panel.innerHTML = `
    <div class="dv-head"><strong>Developer</strong>
      <label class="dv-sw" title="Matikan untuk membandingkan dengan tampilan asli"><input type="checkbox" id="dvOn"><span>Aktif</span></label>
      <button type="button" class="icon-btn" id="dvClose" title="Tutup (Ctrl+Shift+D)"><svg class="i"><use href="#i-x"/></svg></button></div>
    <div class="dv-tabs" role="tablist"><button type="button" data-t="tema">Tema</button><button type="button" data-t="anim">Animasi</button><button type="button" data-t="el">Elemen</button><button type="button" data-t="css">CSS</button></div>
    <div class="dv-body"></div>
    <div class="dv-foot"><button type="button" class="btn btn-sm btn-tonal" id="dvCopy">Salin sebagai CSS</button><button type="button" class="btn btn-sm btn-ghost" id="dvReset">Reset developer</button></div>`;
  document.body.appendChild(panel);
  const hi = h('<div id="devHi"><span></span></div>'); document.body.appendChild(hi);
  const body = () => $('.dv-body', panel);
  const sec = t => h(`<div class="dv-sec">${t}</div>`);

  /* baris kontrol */
  function rangeRow(parent, n) {
    const r = h(`<div class="row"><label>${n.label}</label><span class="dv-val"><small></small><button type="button" class="dv-x" title="Kembalikan bawaan">↺</button></span><input type="range" min="${n.min}" max="${n.max}" step="${n.step}"></div>`);
    const inp = $('input', r), sm = $('small', r), x = $('.dv-x', r);
    const base = () => typeof n.def === 'function' ? n.def() : n.def;
    const show = () => { const set = dev().num[n.k] != null, val = set ? dev().num[n.k] : base(); inp.value = val; sm.textContent = val + n.unit; x.style.visibility = set ? 'visible' : 'hidden'; };
    inp.oninput = () => { dev().num[n.k] = +inp.value; change(); show(); };
    x.onclick = () => { delete dev().num[n.k]; change(); show(); };
    show(); parent.appendChild(r);
  }
  function colorRow(parent, tok, label) {
    const th = theme();
    const r = h(`<div class="row"><label>${label} <small class="dv-tok">${tok}</small></label><span class="dv-val"><button type="button" class="dv-x" title="Kembalikan bawaan tema">↺</button><input type="color"></span></div>`);
    const inp = $('input', r), x = $('.dv-x', r);
    const isSet = () => !!(dev().vars[th] || {})[tok];
    const show = () => { inp.value = toHex(getComputedStyle(root).getPropertyValue(tok)); x.style.visibility = isSet() ? 'visible' : 'hidden'; };
    inp.oninput = () => { const v = dev(); (v.vars[th] = v.vars[th] || {})[tok] = inp.value; change(); x.style.visibility = 'visible'; };
    x.onclick = () => { const v = dev(), m = v.vars[th]; if (m) { delete m[tok]; if (!Object.keys(m).length) delete v.vars[th]; } change(); show(); };
    show(); parent.appendChild(r);
  }
  function strRow(parent, s) {
    const r = h(`<div class="row tools"><label>${s.label}</label><input type="text" spellcheck="false" placeholder="${esc(s.ph || '')}"></div>`);
    const inp = $('input', r); inp.value = dev().str[s.k] || '';
    inp.oninput = () => { const val = inp.value.trim(); val ? dev().str[s.k] = val : delete dev().str[s.k]; change(); };
    parent.appendChild(r);
  }

  /* ---------- Tab: Tema ---------- */
  function buildTema(b) {
    b.appendChild(sec(`Warna — tema “${esc(theme())}”`));
    COLORS.forEach(([t, l]) => colorRow(b, t, l));
    b.appendChild(sec('Panel, kaca & latar'));
    NUM.filter(n => n.tab === 'tema').forEach(n => rangeRow(b, n));
    b.appendChild(sec('Teks antarmuka'));
    STR.forEach(s => strRow(b, s));
  }

  /* ---------- Tab: Animasi ---------- */
  const EASE = [
    ['Halus (bawaan)', 'cubic-bezier(.4,0,.1,1)'], ['Material emphasized', 'cubic-bezier(.2,0,0,1)'], ['Ease-out expo', 'cubic-bezier(.16,1,.3,1)'],
    ['Ease in-out', 'cubic-bezier(.65,0,.35,1)'], ['Pegas (sedikit melompat)', 'cubic-bezier(.34,1.56,.64,1)'], ['Linear', 'linear']
  ];
  function animRange(parent, k, label, min, max, step, unit) {
    const r = h(`<div class="row"><label>${label}</label><span class="dv-val"><small></small><button type="button" class="dv-x" title="Kembalikan bawaan">↺</button></span><input type="range" min="${min}" max="${max}" step="${step}"></div>`);
    const inp = $('input', r), sm = $('small', r), x = $('.dv-x', r);
    const show = () => { const set = dev().anim[k] != null, val = set ? dev().anim[k] : FLIP0[k]; inp.value = val; sm.textContent = val + unit; x.style.visibility = set ? 'visible' : 'hidden'; };
    inp.oninput = () => { dev().anim[k] = +inp.value; change(); show(); };
    x.onclick = () => { delete dev().anim[k]; change(); show(); };
    show(); parent.appendChild(r);
  }
  function buildAnim(b) {
    b.appendChild(sec('Teks menyesuaikan saat panel muncul'));
    animRange(b, 'ms', 'Durasi geser teks', 0, 2000, 10, 'ms');
    animRange(b, 'wave', 'Gelombang tunda (atas → bawah)', 0, 600, 5, 'ms');
    const r = h(`<div class="row tools"><label>Kurva gerak teks</label>
      <select>${EASE.map(([n, c]) => `<option value="${c}">${n}</option>`).join('')}<option value="">Kustom…</option></select>
      <input type="text" spellcheck="false" placeholder="cubic-bezier(.4,0,.1,1)">
      <small class="hint">Bisa diketik sendiri: cubic-bezier(x1,y1,x2,y2), ease-out, linear, dst.</small></div>`);
    const sel = $('select', r), txt = $('input', r);
    const cur = () => dev().anim.ease || FLIP0.ease;
    const sync = () => { txt.value = cur(); sel.value = EASE.some(([, c]) => c === cur()) ? cur() : ''; };
    const setEase = val => { dev().anim.ease = val; change(); sync(); };
    sel.onchange = () => { if (sel.value) setEase(sel.value); else txt.focus(); };
    txt.oninput = () => { const ok = window.CSS && CSS.supports('animation-timing-function', txt.value.trim()); txt.classList.toggle('bad', !ok); if (ok) { dev().anim.ease = txt.value.trim(); change(); sel.value = EASE.some(([, c]) => c === txt.value.trim()) ? txt.value.trim() : ''; } };
    sync(); b.appendChild(r);
    b.appendChild(sec('Panel samping'));
    NUM.filter(n => n.tab === 'anim').forEach(n => rangeRow(b, n));
    const t = h('<button type="button" class="btn btn-sm btn-primary dv-block" id="dvTest">▶ Coba animasi (buka & tutup Daftar Isi)</button>');
    t.onclick = () => { const btn = $('#tocBtn'); if (!btn) return; btn.click(); setTimeout(() => btn.click(), Math.max(1300, FLIP.ms + FLIP.wave + 500)); };
    b.appendChild(h('<div style="height:10px"></div>')); b.appendChild(t);
  }

  /* ---------- Tab: Elemen (pemilih + penyunting aturan) ---------- */
  const PROPS = [
    ['color', 'Warna teks', 1], ['background-color', 'Warna latar', 1], ['font-size', 'Ukuran font'], ['font-weight', 'Ketebalan'], ['line-height', 'Tinggi baris'],
    ['letter-spacing', 'Jarak huruf'], ['padding', 'Padding'], ['margin', 'Margin'], ['border-radius', 'Radius sudut'], ['border-color', 'Warna garis', 1],
    ['opacity', 'Opasitas'], ['box-shadow', 'Bayangan'], ['text-shadow', 'Bayangan teks'], ['backdrop-filter', 'Blur latar'], ['transform', 'Transform'],
    ['width', 'Lebar'], ['height', 'Tinggi'], ['gap', 'Jarak antar item']
  ];
  const DYN = /^(selected|open|on|picked|show|flipping|center|hp|dl|dr|calm|drag|in-rng|rng-sel|rng-a|rng-z|pick-a|pick-z|note-center|mod|bad|no-.+)$/;
  const defaultSel = el => el.id ? '#' + CSS.escape(el.id) : [...el.classList].filter(c => !DYN.test(c)).slice(0, 3).map(c => '.' + CSS.escape(c)).join('');
  function pathSel(el) {
    if (el === document.body) return 'body'; if (el === root) return 'html';
    const own = defaultSel(el); if (own) return own;
    const p = el.parentElement; if (!p) return el.localName;
    return pathSel(p) + ' > ' + el.localName + ':nth-child(' + ([...p.children].indexOf(el) + 1) + ')';
  }
  function chipList(el) {
    if (!el) return [];
    const out = [];
    if (el.id) out.push({ key: '#', token: '#' + CSS.escape(el.id), label: '#' + el.id });
    [...el.classList].filter(c => !DYN.test(c)).forEach(c => out.push({ key: '.' + c, token: '.' + CSS.escape(c), label: '.' + c }));
    return out;
  }
  const selFromChips = t => t.chips.filter(c => t.on.has(c.key)).map(c => c.token).join('');
  function makeTarget(el, sel) {
    const chips = chipList(el);
    const t = { el, chips, on: new Set(el && el.id ? ['#'] : chips.slice(0, 3).map(c => c.key)), sel: '' };
    t.sel = sel || selFromChips(t) || (el ? pathSel(el) : '');
    return t;
  }
  let target = null;
  const qs = sel => { try { return document.querySelector(sel); } catch { return null; } };
  const countOf = sel => { try { return document.querySelectorAll(sel).length; } catch { return -1; } };

  function setDecl(sel, prop, val) {
    const v = dev(); val = clean(val);
    const r = v.rules[sel] = v.rules[sel] || {};
    val ? r[prop] = val : delete r[prop];
    if (!Object.keys(r).length) delete v.rules[sel];
    change(); renderRules();
  }

  function renderRules() {
    const box = $('#dvRules'); if (!box) return;
    const rules = Object.entries(dev().rules);
    box.innerHTML = rules.length ? '' : '<p class="dv-hint">Belum ada aturan. Aturan yang kamu buat muncul di sini.</p>';
    rules.forEach(([sel, d]) => {
      const r = h(`<div class="dv-rule"><button type="button" class="dv-rsel" title="Sunting aturan ini">${esc(sel)}</button><small>${Object.keys(d).length} properti</small><button type="button" class="dv-x" title="Hapus aturan">✕</button></div>`);
      $('.dv-rsel', r).onclick = () => { const el = qs(sel); target = makeTarget(el, sel); renderTarget(); };
      $('.dv-x', r).onclick = () => { delete dev().rules[sel]; change(); renderRules(); if (target && target.sel === sel) renderTarget(); };
      box.appendChild(r);
    });
  }

  function renderTarget() {
    const box = $('#dvTarget'); if (!box) return;
    if (!target) { box.innerHTML = '<p class="dv-hint">Belum ada elemen dipilih. Tekan tombol di atas, lalu klik bagian mana saja di layar (buka dulu panel / dialog yang ingin diubah).</p>'; return; }
    const t = target, cs = t.el ? getComputedStyle(t.el) : null;
    box.innerHTML = `
      <div class="dv-sel"><input type="text" id="dvSel" spellcheck="false"><button type="button" class="icon-btn bordered" id="dvUp" title="Pilih elemen induk (satu tingkat ke atas)">↑</button></div>
      <div class="dv-chips">${t.chips.map(c => `<button type="button" class="dv-chip ${t.on.has(c.key) ? 'on' : ''}" data-k="${esc(c.key)}">${esc(c.label)}</button>`).join('')}</div>
      <small class="dv-count"></small>
      <div id="dvProps"></div>
      <div class="dv-add"><input type="text" id="dvNewP" placeholder="properti lain, mis. outline"><input type="text" id="dvNewV" placeholder="nilai"><button type="button" class="btn btn-sm btn-tonal" id="dvAddP">+</button></div>
      <button type="button" class="btn btn-sm btn-danger dv-block" id="dvDelRule">Hapus aturan elemen ini</button>`;
    const selInp = $('#dvSel', box), count = $('.dv-count', box);
    selInp.value = t.sel;
    const upCount = () => { const n = countOf(t.sel); count.textContent = n < 0 ? 'Selektor tidak valid' : n + ' elemen cocok — perubahan berlaku untuk semuanya'; count.classList.toggle('bad', n < 0); };
    upCount();
    selInp.oninput = () => { t.sel = selInp.value.trim(); upCount(); };
    selInp.onchange = renderRules;
    $('#dvUp', box).onclick = () => { const p = t.el && t.el.parentElement; if (p) { target = makeTarget(p); renderTarget(); } };
    box.querySelectorAll('.dv-chip').forEach(b => b.onclick = () => {
      t.on.has(b.dataset.k) ? t.on.delete(b.dataset.k) : t.on.add(b.dataset.k);
      t.sel = selFromChips(t) || (t.el ? pathSel(t.el) : ''); renderTarget();
    });
    const props = $('#dvProps', box), rule = dev().rules[t.sel] || {};
    const rows = PROPS.slice(); Object.keys(rule).forEach(p => { if (!PROPS.some(x => x[0] === p)) rows.push([p, p]); });
    rows.forEach(([p, label, isColor]) => {
      const val = rule[p] != null ? rule[p] : (cs ? cs.getPropertyValue(p) : '');
      const r = h(`<div class="dv-row ${rule[p] != null ? 'mod' : ''}"><label title="${esc(p)}">${esc(label)}</label><input type="text" spellcheck="false">${isColor ? '<input type="color">' : ''}</div>`);
      const txt = $('input[type=text]', r), col = $('input[type=color]', r);
      txt.value = val; if (col) col.value = toHex(val);
      const commit = v => { setDecl(t.sel, p, v); r.classList.toggle('mod', !!clean(v)); };
      txt.oninput = () => { if (col) col.value = toHex(txt.value); commit(txt.value); };
      if (col) col.oninput = () => { txt.value = col.value; commit(col.value); };
      props.appendChild(r);
    });
    $('#dvAddP', box).onclick = () => {
      const p = $('#dvNewP', box).value.trim().toLowerCase(), v = $('#dvNewV', box).value;
      if (!/^(--)?[a-z][\w-]*$/.test(p)) { NGAJI.toast('Nama properti tidak valid.'); return; }
      setDecl(t.sel, p, v); renderTarget();
    };
    $('#dvDelRule', box).onclick = () => { delete dev().rules[t.sel]; change(); renderRules(); renderTarget(); };
  }

  /* pemilih elemen: klik apa pun di layar */
  let picking = false;
  const BLOCK = ['mousedown', 'mouseup', 'pointerdown', 'click', 'dblclick', 'contextmenu', 'mouseout', 'pointerover', 'pointerout'];
  const label = t => { const c = [...t.classList].filter(x => !DYN.test(x)).slice(0, 2); return t.localName + (t.id ? '#' + t.id : '') + c.map(x => '.' + x).join(''); };
  function moveHi(t) {
    const r = t.getBoundingClientRect();
    Object.assign(hi.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    hi.firstChild.textContent = label(t) + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
    hi.classList.toggle('in', r.top < 26);
  }
  const outside = e => !(panel.contains(e.target) || e.target === hi);
  function onBlock(e) {
    if (!outside(e)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'click') { const el = e.target; stopPick(); target = makeTarget(el); renderTarget(); renderRules(); }
  }
  function onOver(e) {
    if (!outside(e)) { hi.style.display = 'none'; return; }
    e.stopPropagation(); moveHi(e.target);
  }
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); stopPick(); } };
  function startPick() {
    if (picking) return; picking = true;
    document.body.classList.add('dv-picking');
    BLOCK.forEach(t => document.addEventListener(t, onBlock, true));
    document.addEventListener('mouseover', onOver, true);
    window.addEventListener('keydown', onKey, true);
    const pb = $('#dvPick'); if (pb) pb.textContent = 'Klik elemen di layar…  (Esc = batal)';
  }
  function stopPick() {
    if (!picking) return; picking = false;
    document.body.classList.remove('dv-picking'); hi.style.display = 'none';
    BLOCK.forEach(t => document.removeEventListener(t, onBlock, true));
    document.removeEventListener('mouseover', onOver, true);
    window.removeEventListener('keydown', onKey, true);
    const pb = $('#dvPick'); if (pb) pb.textContent = 'Pilih elemen di layar';
  }

  function buildEl(b) {
    b.innerHTML = `<button type="button" class="btn btn-sm btn-primary dv-block" id="dvPick">Pilih elemen di layar</button>
      <div id="dvTarget"></div><div class="dv-sec">Aturan aktif</div><div id="dvRules"></div>`;
    $('#dvPick', b).onclick = () => picking ? stopPick() : startPick();
    renderTarget(); renderRules();
  }

  /* ---------- Tab: CSS bebas ---------- */
  function buildCssTab(b) {
    b.innerHTML = `<p class="dv-hint">CSS apa saja, langsung berlaku. Variabel yang berguna: <code>--primary</code> <code>--gold</code> <code>--bg</code> <code>--on</code> <code>--fs</code> <code>--lh</code> <code>--blur</code>.</p>
      <textarea id="dvCss" spellcheck="false" rows="16" placeholder="/* contoh */\n.sentence.selected { box-shadow: 0 0 0 2px var(--gold); }\n.word:hover { color: var(--gold); }"></textarea>`;
    const ta = $('#dvCss', b); ta.value = dev().css;
    ta.oninput = () => { dev().css = ta.value; change(); };
    ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.oninput(); } };
  }

  /* ---------- Tab, buka/tutup, tombol bawah ---------- */
  let tab = 'tema';
  function showTab(name) {
    stopPick(); tab = name;
    panel.querySelectorAll('.dv-tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === name));
    const b = body(); b.innerHTML = ''; b.scrollTop = 0;
    ({ tema: buildTema, anim: buildAnim, el: buildEl, css: buildCssTab })[name](b);
  }
  panel.querySelectorAll('.dv-tabs button').forEach(x => x.onclick = () => showTab(x.dataset.t));

  const devBtn = $('#devBtn');
  function toggle(open) {
    open = open == null ? !panel.classList.contains('open') : !!open;
    if (open) { $('#dvOn').checked = dev().on; showTab(tab); }
    else stopPick();
    panel.classList.toggle('open', open);
    if (devBtn) devBtn.classList.toggle('on', open);
  }
  if (devBtn) devBtn.onclick = () => toggle();
  $('#dvClose').onclick = () => toggle(false);
  $('#dvOn').onchange = e => { dev().on = e.target.checked; change(); };
  window.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); toggle(); } }, true);
  panel.addEventListener('keydown', e => e.stopPropagation()); // ketikan di panel tidak memicu pintasan halaman (panah, Esc, dst.)
  new MutationObserver(() => { if (panel.classList.contains('open') && tab === 'tema') showTab('tema'); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* geser panel lewat judulnya */
  $('.dv-head', panel).addEventListener('pointerdown', e => {
    if (e.target.closest('button,label,input')) return;
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, head = e.currentTarget;
    head.setPointerCapture(e.pointerId);
    const mv = ev => {
      const top = Math.max(0, Math.min(innerHeight - 120, ev.clientY - dy));
      panel.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
      panel.style.maxHeight = `calc(100vh - ${top + 14}px)`; // footer tetap terlihat di mana pun panel diletakkan
    };
    const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
  });

  $('#dvCopy').onclick = () => {
    const v = dev();
    const txt = `/* === Developer Studio — tema "${theme()}" === */\n${buildCss() || '/* (belum ada perubahan) */'}\n\n` +
      `/* Animasi teks (renderer.js → const FLIP): ${JSON.stringify(Object.assign({}, FLIP0, v.anim))} */\n`;
    const done = () => NGAJI.toast('CSS disalin. Tempel ke styles.css bila ingin dijadikan bawaan.');
    const fallback = () => { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch { NGAJI.toast('Gagal menyalin.'); } t.remove(); };
    navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt).then(done, fallback) : fallback();
  };
  $('#dvReset').onclick = () => {
    if (!confirm('Hapus SEMUA perubahan Developer (warna, ukuran, animasi, aturan elemen, CSS bebas)?')) return;
    NGAJI.getData().dev = {}; target = null; change(); showTab(tab); $('#dvOn').checked = true;
    NGAJI.toast('Perubahan Developer dikembalikan ke bawaan.');
  };

  apply(); // terapkan perubahan tersimpan saat aplikasi dibuka
})();

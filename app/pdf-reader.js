/*
 * Pembaca PDF (PDF.js dari app/vendor/pdfjs, dimuat saat dibutuhkan).
 *  - Arah baca: dari teks PDF. Latin -> LTR, Arab / Ibrani -> RTL. Bisa dipaksa LTR / RTL lewat tombol "Arah".
 *    Arah memengaruhi bilah alat, tombol & tombol panah halaman, serta urutan halaman pada tampilan dua halaman.
 *  - Warna latar: Asli · Invert · warna pilihan (latar terang = kalikan warna; latar gelap = dua warna teks/latar).
 *  - Tab: beberapa PDF terbuka sekaligus; tiap tab mengingat halaman & zoom-nya. Tutup tab dengan tombol × atau klik tengah;
 *    tombol + / "Buka PDF" menambah (boleh pilih banyak file). Ctrl+W tutup tab, Ctrl+Tab pindah tab.
 *  Pengaturan (arah, warna, tampilan dua halaman) diingat lewat localStorage bila tersedia.
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#pdfView');
  if (!view) return;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }
  };
  var el = {
    bar: $('#pdfBar'), scroll: $('#pdfScroll'), pages: null, tabs: $('#pdfTabs'), tabsWrap: $('#pdfTabsWrap'), tabAdd: $('#pdfTabAdd'), empty: $('#pdfEmpty'), busy: $('#pdfBusy'), file: $('#pdfFile'),
    name: $('#pdfName'), page: $('#pdfPage'), total: $('#pdfTotal'), zoomLbl: $('#pdfZoomLbl'), detect: $('#pdfDetect'),
    bgBtn: $('#pdfBgBtn'), bgPop: $('#pdfBgPop'), sw: $('#pdfSw'), color: $('#pdfColor'), duoM: $('#pdfDuoM'), spread: $('#pdfSpread')
  };

  /* ------------------------------------------------------------ pemuat PDF.js */
  var libP = null, libBase = new URL('./vendor/pdfjs/', document.baseURI).href;
  function lib() {
    if (!libP) {
      libP = import(libBase + 'pdf.min.mjs').then(function (m) {
        m.GlobalWorkerOptions.workerSrc = libBase + 'pdf.worker.min.mjs';
        return m;
      });
      libP.catch(function () { libP = null; });
    }
    return libP;
  }

  /* ------------------------------------------------------------ keadaan */
  var st = {
    open: false, doc: null, pdfjs: null, pages: [], baseW: 612, baseH: 792,
    zoom: 1, fitW: true, cols: store.get('ngaji.pdf.cols') === '2' ? 2 : 1,
    dirMode: store.get('ngaji.pdf.dir') || 'auto', detected: null, // 'ltr' | 'rtl' | null
    bg: { type: 'orig', color: '#f6efdc' }, token: 0, cur: 1, io: null, prevFocus: null,
    tabs: [], active: null, seq: 0 // st.doc/pages/zoom/cur/… = salinan keadaan TAB AKTIF; disimpan kembali ke tabnya saat pindah
  };
  try { var sb = JSON.parse(store.get('ngaji.pdf.bg') || 'null'); if (sb && /^(orig|invert|color)$/.test(sb.type) && /^#[0-9a-f]{6}$/i.test(sb.color || '')) st.bg = sb; } catch (e) { /* abaikan */ }
  if (!/^(auto|ltr|rtl)$/.test(st.dirMode)) st.dirMode = 'auto';

  var PRESETS = [
    { id: 'orig', label: 'Asli', type: 'orig', c: '#ffffff' },
    { id: 'invert', label: 'Invert', type: 'invert', c: '#111111' },
    { id: 'krem', label: 'Krem', type: 'color', c: '#f6efdc' },
    { id: 'sepia', label: 'Sepia', type: 'color', c: '#e8d9b5' },
    { id: 'hijau', label: 'Hijau', type: 'color', c: '#d7ecd5' },
    { id: 'abu', label: 'Abu', type: 'color', c: '#d9dbe0' },
    { id: 'gelap', label: 'Gelap', type: 'color', c: '#1d1b20' },
    { id: 'hitam', label: 'Hitam', type: 'color', c: '#000000' }
  ];

  var mk = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ------------------------------------------------------------ arah baca */
  var RE_RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/g;
  var RE_LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/g;
  function scriptOf(text) { // 'rtl' bila dominan Arab / Ibrani, 'ltr' bila dominan Latin, null bila hampir tak ada teks (mis. hasil scan)
    var r = (text.match(RE_RTL) || []).length, l = (text.match(RE_LATIN) || []).length;
    if (r + l < 20) return null;
    return r / (r + l) >= 0.4 ? 'rtl' : 'ltr';
  }
  function effDir() { return st.dirMode === 'auto' ? (st.detected || 'ltr') : st.dirMode; }
  function applyDir() {
    var d = effDir();
    el.bar.dir = d; el.tabsWrap.dir = d; st.tabs.forEach(function (t) { t.pagesEl.dir = d; }); view.setAttribute('data-dir', d);
    Array.prototype.forEach.call($('#pdfDirSeg').children, function (b) { b.classList.toggle('on', b.getAttribute('data-dir') === st.dirMode); });
    el.detect.hidden = !st.doc;
    if (st.doc) {
      el.detect.textContent = '';
      var t = st.detected === 'rtl' ? 'Teks Arab' : st.detected === 'ltr' ? 'Teks Latin' : 'Teks tak terdeteksi';
      el.detect.appendChild(mk('span', '', t)); el.detect.appendChild(document.createTextNode(' → ')); el.detect.appendChild(mk('span', '', d.toUpperCase()));
    }
  }

  function detectDirection(doc) { // contoh teks dari beberapa halaman pertama
    var n = Math.min(doc.numPages, 6), parts = [], len = 0;
    var next = function (i) {
      if (i > n || len > 6000) return Promise.resolve(scriptOf(parts.join(' ')));
      return doc.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) {
        var t = tc.items.map(function (it) { return it.str || ''; }).join(' ');
        parts.push(t); len += t.length;
        return next(i + 1);
      });
    };
    return next(1).catch(function () { return null; });
  }

  /* ------------------------------------------------------------ warna latar */
  var lum = function (hex) {
    var n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  var rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function applyBg() {
    var b = st.bg, cls = 'orig', surf = '';
    if (b.type === 'invert') { cls = 'invert'; surf = '#0c0c0e'; }
    else if (b.type === 'color') {
      surf = b.color;
      if (lum(b.color) >= 0.3) cls = 'multiply';
      else {
        cls = 'duo'; // dua warna: hitam -> teks terang bernuansa latar, putih -> warna latar
        var bg = rgb(b.color), tc = bg.map(function (v) { return Math.round(232 * 0.9 + v * 0.1); });
        var row = function (k) { var d = (bg[k] - tc[k]) / 255; return [d * 0.2126, d * 0.7152, d * 0.0722, 0, tc[k] / 255].map(function (x) { return +x.toFixed(4); }).join(' '); };
        el.duoM.setAttribute('values', row(0) + '  ' + row(1) + '  ' + row(2) + '  0 0 0 1 0');
      }
    }
    view.setAttribute('data-bg', cls);
    view.style.setProperty('--pdf-page-bg', cls === 'orig' ? '#ffffff' : cls === 'invert' ? '#0c0c0e' : b.color);
    view.style.setProperty('--pdf-surface', surf ? 'color-mix(in srgb,' + (cls === 'invert' ? '#0c0c0e' : b.color) + ' 82%,#000)' : '');
    paintSwatches();
  }
  function setBg(type, color) {
    st.bg = { type: type, color: color || st.bg.color };
    store.set('ngaji.pdf.bg', JSON.stringify(st.bg));
    applyBg();
  }
  function paintSwatches() {
    el.sw.textContent = '';
    PRESETS.forEach(function (p) {
      var on = st.bg.type === p.type && (p.type !== 'color' || st.bg.color.toLowerCase() === p.c.toLowerCase());
      var b = mk('button', 'pdfv-swb' + (on ? ' on' : '')); b.type = 'button'; b.title = p.label; b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var chip = mk('span', 'pdfv-chip' + (p.type === 'invert' ? ' inv' : '')); chip.style.background = p.c;
      b.appendChild(chip); b.appendChild(mk('span', '', p.label));
      b.addEventListener('click', function () { setBg(p.type, p.type === 'color' ? p.c : null); if (p.type === 'color') el.color.value = p.c; });
      el.sw.appendChild(b);
    });
  }

  /* ------------------------------------------------------------ tata letak & render */
  function scale() {
    var w = el.scroll.clientWidth - 40 - (st.cols - 1) * 16;
    var fit = clamp(w / st.cols / st.baseW, 0.3, 2);
    return st.fitW ? fit * st.zoom : st.zoom;
  }
  var curScale = 1;
  function sizeAll() {
    curScale = scale();
    if (!el.pages) return;
    el.pages.style.setProperty('--cols', String(st.cols));
    st.pages.forEach(function (p) {
      var w = p.w || st.baseW, h = p.h || st.baseH;
      p.el.style.width = Math.floor(w * curScale) + 'px'; p.el.style.height = Math.floor(h * curScale) + 'px';
      p.el.style.setProperty('--total-scale-factor', String(curScale));
    });
    el.zoomLbl.textContent = Math.round(curScale * 100) + '%';
  }

  function freePage(p) {
    if (p.task) { try { p.task.cancel(); } catch (e) { /* abaikan */ } p.task = null; }
    if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove(); p.canvas = null; }
    if (p.text) { p.text.remove(); p.text = null; }
    p.rendered = 0;
  }

  function renderPage(p) {
    if (!st.doc || p.rendering || p.rendered === curScale) return;
    var tok = st.token, sc = curScale, doc = st.doc;
    p.rendering = true;
    doc.getPage(p.num).then(function (page) {
      if (tok !== st.token) return;
      var vp = page.getViewport({ scale: sc });
      p.w = vp.width / sc; p.h = vp.height / sc;
      p.el.style.width = Math.floor(vp.width) + 'px'; p.el.style.height = Math.floor(vp.height) + 'px';
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = Math.floor(vp.width) + 'px'; canvas.style.height = Math.floor(vp.height) + 'px';
      var text = mk('div', 'textLayer');
      var task = page.render({ canvas: canvas, canvasContext: canvas.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      p.task = task;
      return task.promise.then(function () {
        if (tok !== st.token) return;
        freePage(p); // buang hasil lama (zoom berubah) lalu pasang yang baru
        p.canvas = canvas; p.text = text; p.rendered = sc; p.task = null;
        p.el.appendChild(canvas); p.el.appendChild(text);
        try {
          var tl = new st.pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: vp });
          tl.render().catch(function () { /* teks tak bisa dipilih; tampilan tetap jalan */ });
        } catch (e) { /* abaikan */ }
      });
    }).catch(function (e) {
      if (e && e.name === 'RenderingCancelledException') return;
      console.error('PDF: halaman ' + p.num + ' gagal dirender', e);
    }).then(function () { p.rendering = false; if (p.vis && tok === st.token && p.rendered !== curScale) renderPage(p); });
  }

  function buildPages() {
    el.pages.textContent = '';
    if (st.io) st.io.disconnect();
    var mine = st.pages = [];
    st.io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var p = en.target.__pdfp; if (!p) return;
        p.vis = en.isIntersecting;
        if (p.vis) renderPage(p);
      });
      // buang halaman yang jauh dari layar agar memori tetap kecil
      var far = el.scroll.clientHeight * 4, top = el.scroll.scrollTop;
      mine.forEach(function (p) { if (!p.vis && p.canvas && Math.abs(p.el.offsetTop - top) > far) freePage(p); });
    }, { root: el.scroll, rootMargin: '900px 0px' });
    for (var i = 1; i <= st.doc.numPages; i++) {
      var d = mk('div', 'pdfv-page'); d.setAttribute('data-n', String(i));
      var p = { num: i, el: d, w: 0, h: 0, vis: false, rendered: 0, rendering: false, canvas: null, text: null, task: null };
      d.__pdfp = p; st.pages.push(p); el.pages.appendChild(d);
    }
    sizeAll();
    st.pages.forEach(function (p) { st.io.observe(p.el); });
  }

  function relayout(keepPage) {
    var cur = keepPage || st.cur;
    sizeAll();
    st.pages.forEach(function (p) { if (p.rendered && p.rendered !== curScale) { if (p.vis) renderPage(p); else freePage(p); } });
    goPage(cur, true);
  }

  /* ------------------------------------------------------------ navigasi */
  function goPage(n, instant) {
    if (!st.doc) return;
    n = clamp(n | 0, 1, st.doc.numPages);
    var p = st.pages[n - 1]; if (!p) return;
    el.scroll.scrollTo({ top: Math.max(0, p.el.offsetTop - 16), behavior: instant ? 'auto' : 'smooth' });
    setCur(n);
  }
  function setCur(n) { st.cur = n; if (document.activeElement !== el.page) el.page.value = String(n); }
  var raf = 0;
  function onScroll() {
    if (raf || !st.doc) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var mid = el.scroll.scrollTop + el.scroll.clientHeight * 0.35, best = st.cur, bd = Infinity;
      for (var i = 0; i < st.pages.length; i++) {
        var p = st.pages[i], c = p.el.offsetTop + p.el.offsetHeight / 2, d = Math.abs(c - mid);
        if (p.el.offsetTop <= mid && p.el.offsetTop + p.el.offsetHeight >= mid) { best = p.num; break; }
        if (d < bd) { bd = d; best = p.num; }
      }
      setCur(best);
    });
  }
  var step = function () { return st.cols; };
  function nextPage() { goPage(st.cur + step()); }
  function prevPage() { goPage(st.cur - step()); }

  /* ------------------------------------------------------------ memuat berkas */
  function showEmpty(on) { el.empty.hidden = !on; if (el.pages) el.pages.hidden = on; }

  /* ------------------------------------------------------------ tab */
  function copyOut(t) { // keadaan tampilan aktif -> tab
    t.doc = st.doc; t.pages = st.pages; t.baseW = st.baseW; t.baseH = st.baseH; t.zoom = st.zoom; t.fitW = st.fitW; t.cur = st.cur; t.io = st.io;
    t.scrollTop = el.scroll.scrollTop;
  }
  function copyIn(t) { // tab -> keadaan tampilan aktif
    st.doc = t.doc; st.pages = t.pages; st.baseW = t.baseW; st.baseH = t.baseH; st.zoom = t.zoom; st.fitW = t.fitW; st.cur = t.cur; st.io = t.io;
    st.detected = t.detected; el.pages = t.pagesEl;
  }
  function park(t) { // tab ditinggalkan: batalkan render & buang kanvas (memori); dokumen tetap terbuka
    copyOut(t); st.token++;
    t.pages.forEach(freePage); t.pagesEl.hidden = true;
  }
  function activate(t, opts) {
    if (!t) return;
    if (st.active && st.active !== t) park(st.active);
    var changed = st.active !== t;
    st.active = t; copyIn(t);
    st.tabs.forEach(function (x) { if (x !== t) x.pagesEl.hidden = true; });
    el.busy.hidden = !t.loading;
    el.name.textContent = ''; el.total.textContent = t.doc ? String(t.doc.numPages) : '0';
    el.page.value = String(st.cur);
    showEmpty(false); el.pages.hidden = !t.doc; applyDir();
    if (t.doc) {
      if (!t.built) { t.built = true; buildPages(); t.pages = st.pages; t.io = st.io; el.scroll.scrollTop = 0; goPage(st.cur, true); }
      else { sizeAll(); st.pages.forEach(function (p) { if (p.vis) renderPage(p); }); el.scroll.scrollTop = t.scrollTop || 0; setCur(st.cur); } // kembali ke posisi gulir terakhir tab ini
    }
    paintTabs();
    if (changed && !(opts && opts.keepFocus)) el.scroll.focus({ preventScroll: true });
  }
  function closeTab(t) {
    var i = st.tabs.indexOf(t); if (i < 0) return;
    var wasActive = st.active === t;
    if (wasActive) { copyOut(t); st.token++; }
    (t.pages || []).forEach(freePage);
    if (t.io) t.io.disconnect();
    if (t.doc) { try { t.doc.destroy(); } catch (e) { /* abaikan */ } }
    t.closed = true; t.pagesEl.remove();
    st.tabs.splice(i, 1);
    if (!wasActive) { paintTabs(); return; }
    st.active = null; st.doc = null; st.pages = []; st.io = null; st.detected = null; el.pages = null;
    if (st.tabs.length) activate(st.tabs[Math.min(i, st.tabs.length - 1)]);
    else { el.busy.hidden = true; el.total.textContent = '0'; el.page.value = '1'; showEmpty(true); applyDir(); paintTabs(); }
  }
  function cycleTab(dir) {
    if (st.tabs.length < 2) return;
    var i = st.tabs.indexOf(st.active); activate(st.tabs[(i + dir + st.tabs.length) % st.tabs.length]);
  }
  function paintTabs() {
    el.tabsWrap.hidden = !st.tabs.length;
    el.tabs.textContent = '';
    st.tabs.forEach(function (t) {
      var on = t === st.active;
      var b = mk('div', 'pdfv-tab' + (on ? ' on' : '') + (t.loading ? ' loading' : '')); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1; b.title = t.name;
      b.appendChild(mk('span', 'pdfv-tab-t', t.name));
      var x = mk('button', 'pdfv-tab-x'); x.type = 'button'; x.title = 'Tutup tab'; x.setAttribute('aria-label', 'Tutup tab');
      var ic = document.createElementNS(el.tabAdd.querySelector('svg').namespaceURI, 'svg'); ic.setAttribute('class', 'i');
      var u = document.createElementNS(ic.namespaceURI, 'use'); u.setAttribute('href', '#i-x'); ic.appendChild(u); x.appendChild(ic);
      x.addEventListener('click', function (e) { e.stopPropagation(); closeTab(t); });
      b.appendChild(x);
      b.addEventListener('click', function () { if (st.active !== t) activate(t); });
      b.addEventListener('auxclick', function (e) { if (e.button === 1) { e.preventDefault(); closeTab(t); } });
      b.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); }); // cegah autoscroll klik-tengah
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(t); }
        else if (e.key === 'Delete') { e.preventDefault(); closeTab(t); }
      });
      el.tabs.appendChild(b);
      if (on) { try { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* abaikan */ } }
    });
  }

  function addFiles(files) { // satu tab per file; tab pertama dari kumpulan ini langsung aktif
    var list = Array.prototype.filter.call(files || [], function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!list.length) { if (files && files.length) toast('Bukan file PDF.'); return; }
    var first = null;
    list.forEach(function (file) {
      var key = file.name + '|' + file.size + '|' + file.lastModified;
      var dup = st.tabs.filter(function (t) { return t.key === key; })[0];
      var t = dup || newTab(file, key);
      if (!first) first = t;
    });
    if (first) activate(first);
  }
  function newTab(file, key) {
    var pagesEl = mk('div', 'pdfv-pages'); pagesEl.hidden = true; pagesEl.dir = effDir();
    el.scroll.insertBefore(pagesEl, el.empty);
    var t = { id: ++st.seq, key: key, name: file.name, loading: true, doc: null, pages: [], pagesEl: pagesEl, baseW: 612, baseH: 792, zoom: 1, fitW: true, cur: 1, io: null, scrollTop: 0, detected: null, built: false };
    st.tabs.push(t);
    loadTab(t, file);
    return t;
  }
  function loadTab(t, file) {
    Promise.all([lib(), file.arrayBuffer()]).then(function (r) {
      st.pdfjs = r[0];
      return r[0].getDocument({ data: new Uint8Array(r[1]), wasmUrl: libBase + 'wasm/', standardFontDataUrl: libBase + 'standard_fonts/', isEvalSupported: false }).promise;
    }).then(function (doc) {
      if (t.closed) { doc.destroy(); return; }
      return doc.getPage(1).then(function (p1) {
        var vp = p1.getViewport({ scale: 1 }); t.baseW = vp.width; t.baseH = vp.height;
        return detectDirection(doc);
      }).then(function (d) {
        if (t.closed) { doc.destroy(); return; }
        t.detected = d; t.doc = doc; t.loading = false;
        if (st.active === t) { st.active = null; activate(t, { keepFocus: false }); } // tab aktif selesai dimuat: bangun tampilannya
        else paintTabs();
      });
    }).catch(function (e) {
      console.error('PDF gagal dibuka', e);
      toast((e && e.name === 'PasswordException' ? 'PDF ini dilindungi kata sandi: ' : 'PDF tidak dapat dibuka (rusak / tidak didukung): ') + t.name);
      if (!t.closed) closeTab(t);
    });
  }

  function toast(msg) {
    var t = $('#toast'); if (t && window.NGAJI && NGAJI.toast) { NGAJI.toast(msg); return; }
    try { alert(msg); } catch (e) { /* abaikan */ }
  }

  /* ------------------------------------------------------------ buka / tutup */
  function openView() {
    if (st.open) return;
    st.open = true; st.prevFocus = document.activeElement;
    view.hidden = false; void view.offsetWidth; view.classList.add('show');
    showEmpty(!st.tabs.length); applyDir(); applyBg(); paintTabs();
    window.addEventListener('keydown', onKey, true);
    if (st.active && st.doc) { sizeAll(); st.pages.forEach(function (p) { if (p.vis) renderPage(p); }); goPage(st.cur, true); }
    setTimeout(function () { (st.doc ? el.scroll : $('#pdfOpen2')).focus({ preventScroll: true }); }, 60);
  }
  function closeView() {
    if (!st.open) return;
    st.open = false; closePop();
    window.removeEventListener('keydown', onKey, true);
    view.classList.remove('show');
    setTimeout(function () { if (!st.open) view.hidden = true; }, 280);
    try { if (st.prevFocus && st.prevFocus.focus) st.prevFocus.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
  }
  function pick() { el.file.click(); }

  function closePop() { el.bgPop.hidden = true; el.bgBtn.setAttribute('aria-expanded', 'false'); }

  function onKey(e) {
    if (!st.open) return;
    var inField = e.target && /input|textarea|select/i.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); e.stopImmediatePropagation(); zoomBy(1.15); }
      else if (e.key === '-') { e.preventDefault(); e.stopImmediatePropagation(); zoomBy(1 / 1.15); }
      else if (e.key === '0') { e.preventDefault(); e.stopImmediatePropagation(); st.fitW = true; st.zoom = 1; relayout(); }
      else if (e.key.toLowerCase() === 'o') { e.preventDefault(); e.stopImmediatePropagation(); pick(); }
      else if (e.key.toLowerCase() === 'w' && e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopImmediatePropagation(); if (st.active) closeTab(st.active); }
      else if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); cycleTab(e.shiftKey ? -1 : 1); }
      return; // pintasan lain (menu) tetap berjalan
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!el.bgPop.hidden) closePop(); else closeView(); return; }
    if (inField) { if (e.key === 'Enter' && e.target === el.page) { e.preventDefault(); goPage(parseInt(el.page.value, 10) || st.cur); el.scroll.focus({ preventScroll: true }); } e.stopImmediatePropagation(); return; }
    var rtl = effDir() === 'rtl';
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { // arah panah mengikuti arah baca: LTR kanan = maju, RTL kiri = maju
      e.preventDefault(); e.stopImmediatePropagation();
      ((e.key === 'ArrowRight') !== rtl) ? nextPage() : prevPage(); return;
    }
    if (e.key === 'Home') { e.preventDefault(); e.stopImmediatePropagation(); goPage(1); return; }
    if (e.key === 'End') { e.preventDefault(); e.stopImmediatePropagation(); goPage(st.doc ? st.doc.numPages : 1); return; }
    if (['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].indexOf(e.key) < 0) e.stopImmediatePropagation(); // jangan bocor ke pembaca kitab
  }

  function zoomBy(f) {
    if (!st.doc) return;
    var s = curScale * f; // zoom absolut dari skala sekarang
    var base = st.fitW ? scale() / st.zoom : 1;
    st.zoom = clamp(s / base, 0.25, 5); relayout();
  }

  /* ------------------------------------------------------------ pasang kejadian */
  function wire() {
    $('#pdfClose').addEventListener('click', closeView);
    $('#pdfOpen').addEventListener('click', pick); $('#pdfOpen2').addEventListener('click', pick);
    el.file.multiple = true;
    el.file.addEventListener('change', function () { addFiles(el.file.files); el.file.value = ''; });
    el.tabAdd.addEventListener('click', pick);
    $('#pdfPrev').addEventListener('click', prevPage); $('#pdfNext').addEventListener('click', nextPage);
    el.page.addEventListener('focus', function () { el.page.select(); });
    el.page.addEventListener('blur', function () { el.page.value = String(st.cur); });
    $('#pdfZoomIn').addEventListener('click', function () { zoomBy(1.15); });
    $('#pdfZoomOut').addEventListener('click', function () { zoomBy(1 / 1.15); });
    $('#pdfFit').addEventListener('click', function () { st.fitW = true; st.zoom = 1; relayout(); });
    el.spread.addEventListener('click', function () {
      st.cols = st.cols === 2 ? 1 : 2; store.set('ngaji.pdf.cols', String(st.cols));
      el.spread.setAttribute('aria-pressed', st.cols === 2 ? 'true' : 'false'); el.spread.classList.toggle('on', st.cols === 2);
      st.fitW = true; st.zoom = 1; if (st.doc) relayout();
    });
    el.spread.setAttribute('aria-pressed', st.cols === 2 ? 'true' : 'false'); el.spread.classList.toggle('on', st.cols === 2);
    Array.prototype.forEach.call($('#pdfDirSeg').children, function (b) {
      b.addEventListener('click', function () { st.dirMode = b.getAttribute('data-dir'); store.set('ngaji.pdf.dir', st.dirMode); applyDir(); });
    });
    el.bgBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var show = el.bgPop.hidden; el.bgPop.hidden = !show; el.bgBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
      if (show) { // letakkan di bawah tombol, tetap di dalam layar walau bilah alat terbungkus
        var r = el.bgBtn.getBoundingClientRect(), w = el.bgPop.offsetWidth || 330;
        el.bgPop.style.top = Math.round(r.bottom + 8) + 'px';
        el.bgPop.style.left = Math.round(clamp(r.right - w, 8, Math.max(8, window.innerWidth - w - 8))) + 'px';
      }
    });
    el.bgPop.addEventListener('click', function (e) { e.stopPropagation(); });
    view.addEventListener('pointerdown', function (e) { if (!el.bgPop.hidden && !el.bgPop.contains(e.target) && !el.bgBtn.contains(e.target)) closePop(); });
    el.color.addEventListener('input', function () { setBg('color', el.color.value); });
    el.color.value = st.bg.color;
    el.scroll.addEventListener('scroll', onScroll, { passive: true });
    var rz = 0;
    window.addEventListener('resize', function () { if (!st.open || !st.doc || !st.fitW) return; clearTimeout(rz); rz = setTimeout(function () { relayout(); }, 150); });
    // seret & lepas file PDF di mana pun pada jendela
    var hasPdf = function (e) { var f = e.dataTransfer && e.dataTransfer.files; return !!f && Array.prototype.some.call(f, function (x) { return /\.pdf$/i.test(x.name); }); };
    window.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); }, true);
    window.addEventListener('drop', function (e) {
      if (!hasPdf(e)) return;
      e.preventDefault(); e.stopPropagation();
      openView(); addFiles(e.dataTransfer.files);
    }, true);
    // pintu masuk
    var b = $('#pdfBtn'); if (b) b.addEventListener('click', function () { if (window.NGAJI && NGAJI.closeLauncher) NGAJI.closeLauncher(); openView(); });
    window.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'p' || st.open) return;
      e.preventDefault(); e.stopImmediatePropagation(); openView();
    }, true);
    paintSwatches(); applyBg(); applyDir();
    window.NGAJI = window.NGAJI || {};
    NGAJI.openPdf = openView; NGAJI.closePdf = closeView;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();

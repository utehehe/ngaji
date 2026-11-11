/*
 * Jembatan Tauri/Rust <-> aplikasi. Dimuat setelah renderer.js.
 * Tanpa API aplikasi (dibuka di browser biasa) berkas ini tidak melakukan apa-apa.
 */
(function () {
  'use strict';
  var api = window.ngajiApi;
  var NGAJI = window.NGAJI;
  if (!api || !NGAJI) return;

  var DELAY = 1200; // jeda autosave: tidak menyerialisasi seluruh data di sela-sela mengetik
  var DELAY_LAZY = 8000; // perubahan "murah" (posisi terakhir dibaca saat menggulir): jangan tulis ulang seluruh buku tiap kali
  var dirty = false;
  var timer = null;

  function json() { return JSON.stringify(NGAJI.getData()); }

  /* ---------------- autosave ---------------- */
  function flush(force) {
    clearTimeout(timer); timer = null;
    if (!dirty && !force) return Promise.resolve({ ok: true, skipped: true });
    var payload = json();
    dirty = false;
    return api.saveData(payload).then(function (res) {
      if (!res || !res.ok) { dirty = true; NGAJI.toast('Gagal menyimpan: ' + ((res && res.error) || 'tidak diketahui')); }
      else NGAJI.status('saved');
      return res;
    }, function (err) {
      dirty = true; console.error('Autosave gagal:', err);
      return { ok: false, error: String(err) };
    });
  }

  NGAJI.onChange = function (kind) {
    var lazy = kind === 'lazy';
    dirty = true;
    if (lazy && timer) return;            // sudah ada jadwal simpan (mungkin lebih cepat): biarkan
    if (!lazy) NGAJI.status('dirty');
    clearTimeout(timer);
    timer = setTimeout(function () { flush(false); }, lazy ? DELAY_LAZY : DELAY);
  };

  window.__ngajiFlush = function () { return flush(false); };

  // simpan sinkron saat halaman ditutup / dimuat ulang
  window.addEventListener('beforeunload', function () {
    if (!dirty) return;
    try { api.saveDataSync(json()); dirty = false; } catch (e) { console.error(e); }
  });

  /* ---------------- file proyek (.ngaji) & ekspor file data .js ---------------- */
  // Simpan / Buka / Baru dijalankan proses utama (dialog native, cek perubahan, font); hasilnya tampil sebagai toast.
  function projectAction(name) {
    return flush(true).then(function () { return api.runAction(name); }).catch(function (err) {
      console.error(err);
      alert('Gagal: ' + (err && err.message ? err.message : err));
    });
  }

  function exportFlow() {
    return flush(true).then(function () { return api.exportJs(json()); }).then(function (res) {
      if (res && res.canceled) return;
      if (res && res.ok) NGAJI.toast('Data diekspor ke: ' + res.path);
      else alert('Gagal mengekspor file: ' + ((res && res.error) || 'tidak diketahui'));
    }).catch(function (err) {
      console.error(err);
      alert('Gagal mengekspor: ' + (err && err.message ? err.message : err));
    });
  }

  NGAJI.listFonts = function () { return api.listFonts().catch(function () { return []; }); };
  NGAJI.addFonts = function () { return api.addFonts().catch(function (e) { return { ok: false, error: String(e) }; }); };
  if (NGAJI.refreshFonts) NGAJI.refreshFonts();
  NGAJI.save = function () { return projectAction('save'); };
  NGAJI.saveAs = function () { return projectAction('save-as'); };
  NGAJI.openProject = function () { return projectAction('open-project'); };
  NGAJI.newProject = function () { return projectAction('new-project'); };
  NGAJI.listKitab = function () { return api.listKitab().catch(function () { return { books: [], jenis: [] }; }); };
  NGAJI.addKitab = function (jenis) { return api.addKitab(jenis || '').catch(function (e) { console.error(e); return { ok: false }; }); };
  NGAJI.deleteKitab = function (id) { return api.deleteKitab(id).catch(function (e) { console.error(e); return { ok: false, error: String(e) }; }); };
  NGAJI.moveKitab = function (id, jenis) { return api.moveKitab(id, jenis).catch(function (e) { console.error(e); return { ok: false, error: String(e) }; }); };
  NGAJI.openKitabFolder = function (jenis) { return api.openKitabFolder(jenis || '').catch(function () { return { ok: false }; }); };
  // tanpa flush paksa: kitab yang belum diubah tidak dianggap "berubah" saat berpindah
  NGAJI.openKitab = function (name, holdMs) { // holdMs: animasi membuka kitab di jendela pilihan; teks baru ditukar tepat setelah animasi selesai
    var t0 = Date.now(), tFlush = 0;
    return flush(false).then(function () { tFlush = Date.now() - t0; return api.openKitab(name, 0); }).then(function (res) {
      if (!res || !res.ok || !res.swap || !res.data) return res; // dibatalkan / gagal
      var tInvoke = Date.now() - t0 - tFlush; // diagnostik: bila lambat, tampilkan rinciannya (juga ada di perf.log folder data)
      try {
        console.info('[ngaji] buka kitab: flush=' + tFlush + 'ms, panggilan=' + tInvoke + 'ms, rust=', res.timings);
        if (tFlush + tInvoke > 1200) NGAJI.toast('Buka kitab lambat: simpan ' + tFlush + ' ms, backend ' + tInvoke + ' ms (rinci di perf.log)');
      } catch (e) { /* abaikan */ }
      NGAJI.fadeOutText(); // hanya teks Arab yang memudar; panel lain tidak disentuh
      var wait = Math.max(0, (holdMs || 0) - (Date.now() - t0));
      return new Promise(function (resolve) { setTimeout(resolve, wait); }).then(function () {
        try {
          NGAJI.swapData(res.data);
          dirty = false; clearTimeout(timer); timer = null; NGAJI.status('saved');
          if (res.restored && NGAJI.refreshFonts) { var l = document.querySelector('link[href^="fonts.css"]'); if (l) l.href = 'fonts.css?v=' + Date.now(); NGAJI.refreshFonts(); }
          if (res.note) NGAJI.toast(res.note);
          return { ok: true, swapped: true };
        } catch (e) { // cadangan: data sudah tersimpan di disk, muat ulang biasa
          console.error(e); location.reload(); return { ok: true };
        }
      });
    }).catch(function (err) {
      console.error(err); alert('Gagal membuka kitab: ' + (err && err.message ? err.message : err));
    });
  };
  NGAJI.exportJs = exportFlow;

  /* ---------------- reset ke data bawaan ---------------- */
  NGAJI.resetData = function () {
    if (!confirm('Kembalikan semua halaman, kalimat, catatan, dan pengaturan ke data bawaan aplikasi?\n\n(Data saat ini dicadangkan otomatis.)')) return;
    clearTimeout(timer); dirty = false;
    api.resetData().then(function () { location.reload(); }, function () { location.reload(); });
  };

  /* ---------------- aksi dari menu aplikasi & pintasan keyboard ---------------- */
  // Aksi yang dikerjakan proses utama (dialog native, simpan/buka proyek, folder, muat ulang, ...).
  var NATIVE_ACTIONS = { 'save': 1, 'save-as': 1, 'open-project': 1, 'new-project': 1, 'import-data': 1, 'export-json': 1,
    'open-data-folder': 1, 'open-fonts-folder': 1, 'reload': 1, 'about': 1 };

  function checkUpdates() {
    return api.runAction('check-updates').then(function (r) {
      if (!r) return;
      if (r.status === 'update') NGAJI.toast('Versi baru tersedia: ' + (r.latest || '') + ' (sekarang ' + (r.current || '') + ')');
      else if (r.status === 'disabled' || r.status === 'error') alert(r.error || 'Pemeriksaan pembaruan tidak tersedia.');
      else NGAJI.toast('Aplikasi sudah versi terbaru.');
    }).catch(function (err) { console.error(err); });
  }

  function pasteIntoFocus() {
    var ok = false;
    try { ok = document.execCommand('paste'); } catch (e) { /* diblokir */ }
    if (ok || !navigator.clipboard || !navigator.clipboard.readText) return;
    navigator.clipboard.readText().then(function (t) {
      if (t) document.execCommand('insertText', false, t);
    }).catch(function () { /* izin ditolak */ });
  }

  function onMenuAction(action) {
    if (action === 'export-js') exportFlow();
    else if (action === 'launcher' && NGAJI.openLauncher) NGAJI.openLauncher();
    else if (action === 'tour' && NGAJI.startTour) NGAJI.startTour();
    else if (action === 'clean-view' && NGAJI.cleanView) NGAJI.cleanView();
    else if ((action === 'undo' || action === 'redo') && NGAJI.menuHist) NGAJI.menuHist(action);
    else if (action === 'reset-data') NGAJI.resetData();
    else if (action === 'check-updates') checkUpdates();
    else if (NATIVE_ACTIONS[action]) projectAction(action);
    else if (action === 'fullscreen') api.toggleFullscreen();
    else if (action === 'zoom_in') api.zoomIn();
    else if (action === 'zoom_out') api.zoomOut();
    else if (action === 'zoom_reset') api.zoomReset();
    else if (action === 'toggle_devtools') api.toggleDevTools();
    else if (action === 'cut') document.execCommand('cut');
    else if (action === 'copy') document.execCommand('copy');
    else if (action === 'paste') pasteIntoFocus();
    else if (action === 'select-all') document.execCommand('selectAll');
  }
  api.onMenu(onMenuAction);

  // Pintasan yang tidak ditangani menu native (menu bar dibuat sendiri di halaman). Dipasang di fase bubble pada window dan dilewati bila
  // sudah ditangani pihak lain (mis. pembaca PDF memakai Ctrl+O / Ctrl +/- / Ctrl+0 saat terbuka).
  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey) return;
    var k = e.key, low = k.length === 1 ? k.toLowerCase() : k, mod = e.ctrlKey || e.metaKey, action = null;
    if (k === 'F11') action = 'fullscreen';
    else if (mod && (k === '+' || k === '=')) action = 'zoom_in';   // "+" sering memerlukan Shift
    else if (mod && k === '-') action = 'zoom_out';
    else if (mod && k === '0') action = 'zoom_reset';
    else if (mod && !e.shiftKey) {
      if (low === 's') action = 'save';
      else if (low === 'o') action = 'open-project';
      else if (low === 'n') action = 'new-project';
      else if (low === 'k') action = 'launcher';
      else if (low === 'e') action = 'export-js';
      else if (low === 'i') action = 'import-data';
      else if (low === 'r') action = 'reload';
    } else if (mod && e.shiftKey) {
      if (low === 's') action = 'save-as';
      else if (low === 'i') action = 'toggle_devtools';
      // Ctrl+Shift+H (Tampilan Bersih) dan Ctrl+Shift+P (Buka PDF) sudah ditangani renderer / pdf-reader
    }
    if (!action) return;
    e.preventDefault();
    if (action === 'fullscreen') api.toggleFullscreen(); else onMenuAction(action);
  });
  api.onToast(function (m) { NGAJI.toast(m); });

  /* ---------------- bilah menu paling atas (tanpa bilah judul bawaan; Windows / Linux) ---------------- */
  if (api.customTitlebar && api.titlebarInfo) {
    var root = document.documentElement;
    api.titlebarInfo().then(function (info) {
      if (!info || !info.labels || !info.labels.length) return;
      var bar = document.createElement('div'); bar.id = 'titlebar';
      var menus = document.createElement('div'); menus.className = 'tb-menus'; menus.setAttribute('role', 'menubar');
      var T = function (t) { return window.NGAJI_I18N ? window.NGAJI_I18N.t(t) : t; }; // menu mengikuti bahasa aplikasi
      var btns = [], curIdx = -1, hot = -1, panel = null, seq = 0, hideTimer = 0;
      var SVG_CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var ensurePanel = function () {
        if (panel) return panel;
        panel = document.createElement('div'); panel.id = 'tbPanel'; panel.setAttribute('role', 'menu');
        panel.addEventListener('mousedown', function (e) { e.preventDefault(); }); // fokus tetap di halaman (Potong / Salin / Tempel)
        document.body.appendChild(panel);
        return panel;
      };
      var rows = function () { return panel ? Array.prototype.slice.call(panel.querySelectorAll('.tbi:not(.dis)')) : []; };
      var setHot = function (n) {
        var r = rows(); hot = n;
        r.forEach(function (el, k) { el.classList.toggle('hot', k === n); });
      };
      function closePanel() {
        if (curIdx < 0 || !panel) return;
        curIdx = -1; hot = -1; seq++;
        btns.forEach(function (x) { x.classList.remove('open'); x.setAttribute('aria-expanded', 'false'); });
        panel.classList.remove('in');
      }
      function openPanel(i) {
        var my = ++seq;
        api.menuItems(i).then(function (items) {
          if (my !== seq || !items) return;
          var p = ensurePanel(), was = curIdx >= 0 && p.classList.contains('in');
          curIdx = i; hot = -1;
          btns.forEach(function (x, k) { x.classList.toggle('open', k === i); x.setAttribute('aria-expanded', k === i ? 'true' : 'false'); });
          var html = '', n = 0, last = 'sep';
          items.forEach(function (it, j) {
            if (it.visible === false) return;
            if (it.sep) { if (last !== 'sep') { html += '<div class="tbi-sep" role="separator"></div>'; last = 'sep'; } return; }
            last = 'item';
            html += '<button type="button" class="tbi' + (it.enabled ? '' : ' dis') + (it.check ? ' on' : '') + '" role="' + (it.check === null ? 'menuitem' : 'menuitemcheckbox') + '"' +
              (it.check === null ? '' : ' aria-checked="' + (it.check ? 'true' : 'false') + '"') + ' data-j="' + j + '" style="--i:' + (n++) + '">' +
              '<span class="tbi-c">' + (it.check ? SVG_CHECK : '') + '</span><span class="tbi-l"></span><span class="tbi-k"></span></button>';
          });
          p.innerHTML = '<div class="tbp-in">' + html + '</div>';
          var vis = items.filter(function (it) { return !it.sep && it.visible !== false; }), q = 0;
          Array.prototype.forEach.call(p.querySelectorAll('.tbi'), function (el) {
            var it = vis[q++]; el.querySelector('.tbi-l').textContent = T(it.label); el.querySelector('.tbi-k').textContent = it.acc || '';
            if (!it.enabled) return;
            el.addEventListener('click', function () { var j = +el.getAttribute('data-j'); closePanel(); api.invokeMenu(i, j); });
            el.addEventListener('mouseenter', function () { setHot(rows().indexOf(el)); });
          });
          var r = btns[i].getBoundingClientRect(), bar2 = bar.getBoundingClientRect();
          var left = Math.max(6, Math.min(r.left, window.innerWidth - p.offsetWidth - 8));
          p.style.setProperty('--ox', Math.max(10, r.left + r.width / 2 - left) + 'px');
          p.style.top = Math.round(bar2.bottom + 4) + 'px';
          if (was) { p.classList.add('swap'); p.style.left = Math.round(left) + 'px'; }
          else { p.classList.remove('swap'); p.style.left = Math.round(left) + 'px'; void p.offsetWidth; }
          // mulai ulang animasi item (stagger) bila berpindah antar menu
          p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
        }).catch(function (e) { console.error(e); });
      }
      document.addEventListener('mousedown', function (e) {
        if (curIdx < 0) return;
        if (panel && panel.contains(e.target)) return;
        if (e.target.closest && e.target.closest('#titlebar .tb-menus')) return;
        closePanel();
      }, true);
      window.addEventListener('blur', closePanel);
      document.addEventListener('keydown', function (e) {
        if (curIdx < 0) return;
        var k = e.key, r = rows(), stop = function () { e.preventDefault(); e.stopPropagation(); };
        if (k === 'Escape') { stop(); closePanel(); }
        else if (k === 'ArrowDown') { stop(); setHot(hot + 1 >= r.length ? 0 : hot + 1); }
        else if (k === 'ArrowUp') { stop(); setHot(hot <= 0 ? r.length - 1 : hot - 1); }
        else if (k === 'ArrowRight') { stop(); openPanel((curIdx + 1) % btns.length); }
        else if (k === 'ArrowLeft') { stop(); openPanel((curIdx + btns.length - 1) % btns.length); }
        else if ((k === 'Enter' || k === ' ') && hot >= 0 && r[hot]) { stop(); r[hot].click(); }
      }, true);
      info.labels.forEach(function (label, i) {
        var b = document.createElement('button'); b.type = 'button'; b.dataset.l = label; b.textContent = T(label); b.setAttribute('role', 'menuitem'); b.setAttribute('aria-haspopup', 'true');
        b.addEventListener('click', function () { if (curIdx === i) closePanel(); else openPanel(i); });
        b.addEventListener('mouseenter', function () { if (curIdx >= 0 && curIdx !== i) openPanel(i); }); // menu sedang terbuka: geser ke menu lain
        btns.push(b);
        menus.appendChild(b);
      });
      document.addEventListener('ngaji-lang', function () { closePanel(); btns.forEach(function (x) { x.textContent = T(x.dataset.l); }); });
      bar.appendChild(menus);
      // Tauri window controls (minimize / maximize / close)
      var wc = document.createElement('div'); wc.id = 'tauri-win-controls';
      var mkBtn = function (cls, title, action) {
        var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.title = title;
        b.addEventListener('click', function () { if (api[action]) api[action](); });
        return b;
      };
      wc.appendChild(mkBtn('win-min', 'Minimalkan', 'minimize'));
      wc.appendChild(mkBtn('win-max', 'Perbesar', 'maximize'));
      wc.appendChild(mkBtn('win-close', 'Tutup', 'close'));
      bar.appendChild(wc);
      bar.appendChild(document.createElement('div')).className = 'tb-drag';
      root.appendChild(bar);
      root.classList.add('has-tb');
      var setH = function (zoom) { root.style.setProperty('--tb', (info.h / (zoom || 1)).toFixed(2) + 'px'); };
      setH(info.zoom); // jendela di-zoom -> tinggi bilah dibagi zoom agar tetap sama dengan tombol jendela bawaan
      if (api.onZoom) api.onZoom(setH);
      // warna tombol jendela (minimize / maximize / close) mengikuti tema
      var paint = function () {
        var cs = getComputedStyle(root), bg = cs.getPropertyValue('--bg').trim(), fg = cs.getPropertyValue('--on').trim();
        if (bg && fg && api.titlebarColors) api.titlebarColors(bg, fg);
      };
      paint();
      new MutationObserver(function () { setTimeout(paint, 0); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }).catch(function (e) { console.error(e); });
  }
})();

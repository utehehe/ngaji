/* Kaidah Nahwu: panel layar penuh (data di data/kaidah-nahwu-data.js; warna jenis kata di data/kaidah-warna-data.js). Buka: tombol "Nahwu" atau Ctrl+Shift+K. */
(function () {
  'use strict';
  var D = window.KAIDAH_NAHWU || [], open = false, cur = 'home', curR = null, prevFocus = null, LAST = 'ngaji.nahwu.last';
  /* Pengaturan khusus menu Nahwu (terpisah dari pengaturan di luar; disimpan di localStorage 'ngaji.nahwu.set') */
  var KEY = 'ngaji.nahwu.set', DEF = { font: 'Amiri', exFs: 32, exGap: 8, fs: 17, lh: 1.65, navW: 300, openAll: false, showEx: true, showAr: true, anim: true, pop: true, popOut: true, popArti: true, popRule: true, nW: 560, nH: 640, nBlur: 8, popFs: 52, nTx: 17, hl: true, txClr: '', nLh: 1.7, pFont: 'auto', pClr: '', pArFs: 0, pArClr: '', nArti: 18, nClr: '', nRuleClr: '', nW8: 500, pBg: '' };
  var SCHEMA = [
    ['Teks Arab', [['font', 'Font contoh Arab', 'select', ['Amiri', 'Scheherazade New', 'Noto Naskh Arabic', 'Traditional Arabic', 'Arabic Typesetting', 'Times New Roman']], ['exFs', 'Ukuran contoh Arab', 'range', 14, 80, 1, 'px'], ['exGap', 'Jarak antar contoh', 'range', 2, 20, 1, 'px']]],
    ['Teks Penjelasan', [['fs', 'Ukuran huruf', 'range', 11, 32, 1, 'px'], ['lh', 'Tinggi baris', 'range', 1.3, 2.4, 0.05, ''], ['txClr', 'Warna teks penjelasan (kosong = terang bawaan)', 'color']]],
    ['Tampilan', [['navW', 'Lebar panel Daftar Isi', 'range', 170, 340, 5, 'px'], ['openAll', 'Buka semua kaidah otomatis', 'check'], ['showEx', 'Tampilkan contoh Arab', 'check'], ['showAr', 'Tampilkan judul bab berbahasa Arab', 'check'], ['anim', 'Animasi kartu dan panel', 'check']]],
    ['Highlight', [['hl', 'Tandai kata/huruf yang sedang dijelaskan (pada penjelasan dan contoh)', 'check']]],
    ['Pop-up Catatan Contoh', [['pop', 'Buka catatan saat contoh Arab diklik', 'check'], ['nW', 'Lebar panel', 'range', 360, 900, 10, 'px'], ['nH', 'Tinggi maksimum panel', 'range', 300, 900, 10, 'px'], ['nBlur', 'Blur latar belakang', 'range', 0, 20, 1, 'px'], ['pFont', 'Font teks Arab', 'select', ['auto', 'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', 'Traditional Arabic', 'Arabic Typesetting', 'Times New Roman']], ['popFs', 'Ukuran teks Arab', 'range', 20, 120, 1, 'px'], ['pClr', 'Warna teks Arab', 'color'], ['nArti', 'Ukuran arti contoh', 'range', 11, 40, 1, 'px'], ['pArClr', 'Warna arti contoh', 'color'], ['nTx', 'Ukuran teks keterangan', 'range', 11, 32, 1, 'px'], ['nLh', 'Tinggi baris keterangan', 'range', 1.3, 2.4, 0.05, ''], ['nW8', 'Ketebalan teks keterangan', 'select', ['400', '500', '600', '700']], ['nClr', 'Warna teks keterangan', 'color'], ['nRuleClr', 'Warna nama kaidah', 'color'], ['pBg', 'Warna latar kotak keterangan', 'color'], ['popArti', 'Tampilkan arti contoh', 'check'], ['popRule', 'Tampilkan nama dan isi kaidah', 'check'], ['popOut', 'Tutup saat klik di luar panel', 'check']]]
  ], openG = {}, S = {};
  try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = Object.assign({}, DEF); }
  function h(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  /* Highlight kata/huruf yang sedang dijelaskan. Data per kaidah: data/kaidah-fokus-data.js (cara isinya dijelaskan di sana).
     Warna jenis kata (isim/fi'il/huruf) untuk mode 'i'/'f'/'h'/'all' diambil dari data/kaidah-warna-data.js. */
  var F = window.KAIDAH_FOKUS || {}, W = window.KAIDAH_WARNA || {};
  var DIAC = /[\u064B-\u065F\u0670]/, AR = /[\u0621-\u065F\u0670\u0671-\u06D3]/;
  function words(ar) { return ar.split(/\s+/).filter(Boolean); }
  function tagsOf(ar) { // kode jenis kata per kata; null bila tidak ada atau jumlahnya tidak cocok
    var t = W[ar]; if (!t) return null; t = t.split(/\s+/);
    return t.length === words(ar).length ? t : null;
  }
  function rx(re) { return new RegExp(re.source, re.flags.indexOf('g') < 0 ? re.flags + 'g' : re.flags); }
  function clusters(ar, s0, e0) { // huruf Arab beserta harakatnya, di dalam ar[s0..e0)
    while (e0 > s0 && /[\u060C\u061F,.;:!?]/.test(ar.charAt(e0 - 1))) e0--;
    var cl = [];
    for (var i = s0; i < e0; i++) { if (DIAC.test(ar.charAt(i)) && cl.length) cl[cl.length - 1][1] = i + 1; else cl.push([i, i + 1]); }
    return cl;
  }
  function textIv(text, list) { // bagian teks penjelasan yang di-highlight -> [[mulai, akhir, kelas]]
    var iv = [];
    (list || []).forEach(function (t) {
      if (typeof t === 'function') { iv = iv.concat(t(text)); return; }
      var re = rx(Array.isArray(t) ? t[0] : t), cls = Array.isArray(t) ? t[1] : 'g', m;
      while ((m = re.exec(text))) { if (!m[0]) { re.lastIndex++; continue; } iv.push([m.index, m.index + m[0].length, cls]); }
    });
    return iv;
  }
  function exIv(ar, spec, tg) { // bagian contoh Arab yang di-highlight
    var iv = [], ws = [], re = /\S+/g, m;
    while ((m = re.exec(ar))) ws.push([m.index, m.index + m[0].length]);
    (function add(sp) {
      if (sp == null) return;
      if (Array.isArray(sp)) { sp.forEach(add); return; }
      if (sp === 'w') { iv.push([0, ar.length, 'g']); return; }
      if (sp === 'all' || sp === 'i' || sp === 'f' || sp === 'h') {
        if (tg) ws.forEach(function (w, i) { var t = tg[i]; if (t && t !== '-' && (sp === 'all' || t === sp)) iv.push([w[0], w[1], t]); });
        return;
      }
      if (typeof sp === 'number') { if (ws[sp]) iv.push([ws[sp][0], ws[sp][1], 'g']); return; }
      if (sp instanceof RegExp) { var r = rx(sp), mm; while ((mm = r.exec(ar))) { if (!mm[0]) { r.lastIndex++; continue; } iv.push([mm.index, mm.index + mm[0].length, 'g']); } return; }
      var w = ws[sp.w]; if (!w) return;
      var cl = clusters(ar, w[0], w[1]), n = cl.length, a = 0, b = n;
      if (sp.l != null) b = Math.min(sp.l, n);
      else if (sp.e != null) a = Math.max(n - sp.e, 0);
      else if (sp.c) { a = sp.c[0] < 0 ? n + sp.c[0] : sp.c[0]; b = sp.c[1] == null ? n : (sp.c[1] < 0 ? n + sp.c[1] : sp.c[1]); }
      if (b > a && cl[a]) iv.push([cl[a][0], cl[b - 1][1], sp.cls || 'g']);
    })(spec);
    return iv;
  }
  function runs(el, text, iv, tag, pre) { // tulis text ke el; bagian iv dibungkus elemen berkelas
    if (!iv.length) { el.textContent = text; return el; }
    iv.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var pos = 0;
    iv.forEach(function (x) {
      if (x[0] < pos || x[1] <= x[0]) return;
      if (x[0] > pos) el.appendChild(document.createTextNode(text.slice(pos, x[0])));
      /* highlight yang memotong tengah kata Arab: tanpa padding/border/margin agar huruf tetap bersambung */
      var cut = AR.test(text.charAt(x[0] - 1)) || AR.test(text.charAt(x[1])) ? ' wp' : '';
      el.appendChild(h(tag, pre + x[2] + cut, text.slice(x[0], x[1]))); pos = x[1];
    });
    if (pos < text.length) el.appendChild(document.createTextNode(text.slice(pos)));
    return el;
  }
  function hlText(el, text, fk, force) { return (S.hl || force) && fk && fk.t ? runs(el, text, textIv(text, fk.t), 'span', 'nhv-k nhv-k-') : (el.textContent = text, el); }
  function hlEx(el, ar, fk, idx, tg, force) {
    var sp = fk && fk.ex; if (sp && !Array.isArray(sp) && sp.by) sp = sp.by[idx] !== undefined ? sp.by[idx] : sp.by.all;
    return (S.hl || force) && sp != null ? runs(el, ar, exIv(ar, sp, tg), 'i', 'w w-') : (el.textContent = ar, el);
  }
  var view = h('section', 'nhv'); view.hidden = true; view.setAttribute('aria-label', 'Kaidah Nahwu');
  var bar = h('div', 'nhv-bar glass'), close = h('button', 'icon-btn'), q = h('input', 'nhv-q'), cnt = h('span', 'nhv-cnt');
  close.type = 'button'; close.title = 'Tutup (Esc)'; close.innerHTML = '<svg class="i"><use href="#i-x"/></svg>';
  q.type = 'text'; q.placeholder = 'Cari kaidah, istilah, atau contoh…'; q.setAttribute('dir', 'auto'); q.autocomplete = 'off'; q.spellcheck = false;
  bar.appendChild(close); bar.appendChild(h('h2', 'nhv-ttl', 'Kaidah Nahwu')); bar.appendChild(q); bar.appendChild(cnt);
  var tools = h('div', 'nhv-tools'), liteB = h('button', 'icon-btn bordered'), cleanB = h('button', 'icon-btn bordered');
  [[liteB, 'Mode Lite — lebih ringan, tetap mulus', 'i-bolt'], [cleanB, 'Tampilan Bersih — sembunyikan panel, tab, dan menu (Ctrl+Shift+H / Esc untuk keluar)', 'i-clean']].forEach(function (x) {
    x[0].type = 'button'; x[0].title = x[1]; x[0].setAttribute('aria-label', x[1]); x[0].innerHTML = '<svg class="i"><use href="#' + x[2] + '"/></svg>';
  });
  liteB.setAttribute('aria-pressed', 'false'); cleanB.setAttribute('aria-pressed', 'false');
  tools.appendChild(liteB); tools.appendChild(cleanB); bar.appendChild(tools);
  var body = h('div', 'nhv-body'), nav = h('nav', 'nhv-nav'), list = h('div', 'nhv-list'); list.tabIndex = 0;
  body.appendChild(list); view.appendChild(bar); view.appendChild(body);
  var setTab = h('button', 'toc-tab set-tab glass'), setBox = h('aside', 'drawer right glass');
  setTab.type = 'button'; setTab.title = 'Pengaturan'; setTab.setAttribute('aria-label', 'Pengaturan'); setTab.innerHTML = '<svg class="i"><use href="#i-sliders"/></svg>';
  setBox.setAttribute('aria-label', 'Pengaturan'); setBox.innerHTML = '<div class="drawer-head"><h2>Pengaturan</h2><button class="btn btn-sm btn-ghost" type="button">Atur ulang</button><button class="icon-btn" type="button" title="Tutup"><svg class="i"><use href="#i-x"/></svg></button></div><div id="nhSetBody"></div>';
  view.appendChild(setTab); view.appendChild(setBox);
  var tocTab = h('button', 'toc-tab glass'), tocBox = h('aside', 'drawer left glass'), tocBody;
  tocTab.type = 'button'; tocTab.title = 'Daftar Isi'; tocTab.setAttribute('aria-label', 'Daftar Isi'); tocTab.innerHTML = '<svg class="i"><use href="#i-list"/></svg>';
  tocBox.setAttribute('aria-label', 'Daftar Isi Kaidah Nahwu'); tocBox.innerHTML = '<div class="drawer-head"><h2>Daftar Isi</h2><button class="icon-btn" type="button" title="Tutup"><svg class="i"><use href="#i-x"/></svg></button></div><div id="nhTocBody"></div>';
  tocBody = tocBox.querySelector('#nhTocBody'); view.appendChild(tocTab); view.appendChild(tocBox);
  function tocOpen(on) { if (on) chips(); tocBox.classList.toggle('open', on); tocTab.classList.toggle('on', on); view.classList.toggle('toc-open', on); }
  tocTab.onclick = function () { tocOpen(!tocBox.classList.contains('open')); };
  tocBox.querySelector('.icon-btn').onclick = function () { tocOpen(false); };
  function apply() {
    var st = view.style;
    st.setProperty('--nh-font', "'" + S.font + "'"); st.setProperty('--nh-exfs', S.exFs + 'px'); st.setProperty('--nh-gap', S.exGap + 'px');
    st.setProperty('--nh-fs', S.fs + 'px'); st.setProperty('--nh-lh', S.lh); st.setProperty('--nh-tocw', S.navW + 'px');
    st.setProperty('--nh-pfs', S.popFs + 'px'); st.setProperty('--nh-ptx', S.nTx + 'px'); st.setProperty('--note-w', S.nW + 'px'); st.setProperty('--note-h', S.nH + 'px'); st.setProperty('--note-blur', S.nBlur + 'px');
    var V = function (k, v) { if (v === '' || v == null) st.removeProperty(k); else st.setProperty(k, v); };
    V('--nh-tclr', S.txClr); V('--nh-plh', S.nLh); V('--nh-pfont', S.pFont === 'auto' ? '' : "'" + S.pFont + "'"); V('--nh-pclr', S.pClr);
    V('--nh-parc', S.pArClr); V('--nh-pars', S.nArti + 'px'); V('--nh-ptc', S.nClr); V('--nh-prc', S.nRuleClr); V('--nh-pw8', S.nW8); V('--nh-pbg', S.pBg);
    view.classList.toggle('nh-noex', !S.showEx); view.classList.toggle('nh-noar', !S.showAr); view.classList.toggle('nh-noanim', !S.anim);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* abaikan */ }
  }
  function build() {
    var bx = setBox.querySelector('#nhSetBody'); bx.textContent = '';
    SCHEMA.forEach(function (g) {
      var d = document.createElement('details'); d.open = !!openG[g[0]];
      d.addEventListener('toggle', function () { openG[g[0]] = d.open; });
      d.innerHTML = '<summary>' + g[0] + '</summary>';
      g[1].forEach(function (it) {
        var key = it[0], row = h('div', 'row'), v = S[key], lb = document.createElement('label'); lb.textContent = it[1]; row.appendChild(lb);
        if (it[2] === 'range') {
          var sm = h('small', '', v + it[6]), inp = document.createElement('input');
          inp.type = 'range'; inp.min = it[3]; inp.max = it[4]; inp.step = it[5]; inp.value = v; row.appendChild(sm); row.appendChild(inp);
          inp.oninput = function () { S[key] = +inp.value; sm.textContent = S[key] + it[6]; apply(); };
        } else if (it[2] === 'color') {
          var ci = document.createElement('input'), cb0 = h('button', 'btn btn-sm btn-ghost', 'Bawaan'); ci.type = 'color'; cb0.type = 'button';
          ci.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'; ci.style.opacity = v ? 1 : .45; var cw = h('div', 'nh-cw'); cw.appendChild(ci); cw.appendChild(cb0); row.appendChild(cw);
          ci.oninput = function () { S[key] = ci.value; ci.style.opacity = 1; apply(); };
          cb0.onclick = function () { S[key] = ''; ci.style.opacity = .45; apply(); };
        } else if (it[2] === 'select') {
          var se = document.createElement('select'); it[3].forEach(function (o) { var op = h('option', '', o === 'auto' ? 'Sama dengan contoh' : o); op.value = o; op.selected = String(o) === String(v); se.appendChild(op); });
          se.onchange = function () { S[key] = typeof DEF[key] === 'number' ? +se.value : se.value; apply(); }; row.appendChild(se);
        } else {
          var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!v; row.appendChild(cb);
          cb.onchange = function () { S[key] = cb.checked; apply(); if (key === 'openAll' || key === 'hl') paint(); };
        }
        d.appendChild(row);
      });
      bx.appendChild(d);
    });
  }
  function setOpen(on) {
    if (on) build();
    setBox.classList.toggle('open', on); setTab.classList.toggle('on', on); view.classList.toggle('set-open', on);
  }
  setTab.onclick = function () { setOpen(!setBox.classList.contains('open')); };
  setBox.querySelector('.icon-btn').onclick = function () { setOpen(false); };
  setBox.querySelector('.btn').onclick = function () { S = Object.assign({}, DEF); apply(); build(); paint(); };

  var openT = {};
  function chips() { // isi Daftar Isi (panel kiri)
    tocBody.textContent = '';
    var hm = h('button', 'nhv-toc-all' + (cur === 'home' ? ' on' : ''), 'Beranda'); hm.type = 'button';
    hm.onclick = function () { cur = 'home'; curR = null; q.value = ''; chips(); paint(); list.scrollTop = 0; }; tocBody.appendChild(hm);
    var all = h('button', 'nhv-toc-all' + (cur === 'all' ? ' on' : ''), 'Tampilkan semua kaidah'); all.type = 'button';
    all.onclick = function () { cur = 'all'; curR = null; q.value = ''; chips(); paint(); list.scrollTop = 0; }; tocBody.appendChild(all);
    D.forEach(function (b, bi) {
      var d = document.createElement('details'), sm = document.createElement('summary'); d.open = !!openT[bi] || cur === String(bi);
      d.addEventListener('toggle', function () { openT[bi] = d.open; });
      sm.appendChild(h('span', '', (bi + 1) + '. ' + b.t)); sm.appendChild(h('b', 'ar', b.a)); d.appendChild(sm);
      var only = h('button', 'nhv-toc-only' + (cur === String(bi) && curR == null ? ' on' : ''), 'Tampilkan bab ini saja'); only.type = 'button';
      only.onclick = function () { openBab(bi, true); }; d.appendChild(only);
      b.r.forEach(function (r, ri) {
        var a = h('button', 'nhv-toc-i' + (cur === String(bi) && curR === ri ? ' on' : ''), r[0]); a.type = 'button'; a.onclick = function () { go(bi, ri); }; d.appendChild(a);
      });
      tocBody.appendChild(d);
    });
  }
  function openBab(bi, whole) { cur = String(bi); curR = whole ? null : -1; /* -1 = daftar sub bab; null = seluruh bab */ q.value = ''; try { localStorage.setItem(LAST, bi); } catch (e) { /* abaikan */ } chips(); paint(); list.scrollTop = 0; }
  function home() { // layar awal: kartu bab
    var w = h('div', 'nhv-home'), hd = h('div', 'nhv-hero'), last = -1;
    hd.appendChild(h('h2', '', 'Kaidah Nahwu')); hd.appendChild(h('p', '', 'Pilih bab untuk mulai membaca, buka Daftar Isi di sisi kiri, atau cari istilah lewat kolom di atas.')); w.appendChild(hd);
    try { last = parseInt(localStorage.getItem(LAST), 10); } catch (e) { /* abaikan */ }
    if (D[last]) { var c = h('button', 'nhv-cont', 'Lanjutkan: ' + D[last].t); c.type = 'button'; c.onclick = function () { openBab(last); }; w.appendChild(c); }
    var g = h('div', 'nhv-grid');
    D.forEach(function (b, bi) {
      var t = h('button', 'nhv-tile'); t.type = 'button'; t.style.setProperty('--d', Math.min(bi, 14) * 40 + 'ms');
      t.appendChild(h('i', '', String(bi + 1))); t.appendChild(h('b', 'ar', b.a)); t.appendChild(h('span', '', b.t)); t.appendChild(h('small', '', b.r.length + ' kaidah'));
      t.onclick = function () { openBab(bi); }; g.appendChild(t);
    });
    w.appendChild(g); list.appendChild(w);
  }
  function go(bi, ri) { // buka satu kaidah saja (seperti sub bab di Mode Baca kitab)
    try { localStorage.setItem(LAST, bi); } catch (e) { /* abaikan */ }
    cur = String(bi); curR = ri; q.value = ''; chips(); paint(); list.scrollTop = 0;
  }
  function step(d) { // kaidah sebelum/sesudahnya (lintas bab)
    var bi = +cur, ri = curR + d;
    if (ri < 0) { bi--; if (bi < 0) return; ri = D[bi].r.length - 1; }
    else if (ri >= D[bi].r.length) { bi++; if (bi >= D.length) return; ri = 0; }
    go(bi, ri);
  }
  function banner() {
    var bn = h('div', 'nhv-sub'), bi = +cur, tx = h('span', '', 'Hanya menampilkan satu kaidah');
    var pv = h('button', 'btn btn-sm btn-ghost', '‹ Sebelumnya'), nx = h('button', 'btn btn-sm btn-ghost', 'Berikutnya ›'), wh = h('button', 'btn btn-sm btn-tonal', 'Tampilkan seluruh bab');
    pv.type = nx.type = wh.type = 'button';
    pv.disabled = bi === 0 && curR === 0; nx.disabled = bi === D.length - 1 && curR === D[bi].r.length - 1;
    pv.onclick = function () { step(-1); }; nx.onclick = function () { step(1); }; wh.onclick = function () { openBab(bi, true); };
    bn.appendChild(tx); bn.appendChild(pv); bn.appendChild(nx); bn.appendChild(wh); return bn;
  }
  /* Catatan contoh: dialog di tengah layar dengan latar di-blur, seperti panel catatan (pengaturan: grup "Pop-up Catatan Contoh") */
  var scrim = h('div', 'nhv-scrim'), note = h('aside', 'drawer left center glass'), nOpen = false;
  note.setAttribute('role', 'dialog'); note.setAttribute('aria-modal', 'true'); note.setAttribute('aria-label', 'Catatan contoh');
  note.innerHTML = '<div class="drawer-head"><h2></h2><button class="icon-btn" type="button" title="Tutup (Esc)"><svg class="i"><use href="#i-x"/></svg></button></div><div class="nhv-nbody"></div>';
  var nTitle = note.querySelector('h2'), nBody = note.querySelector('.nhv-nbody');
  view.appendChild(scrim); view.appendChild(note);
  function popHide() { if (!nOpen) return; nOpen = false; note.classList.remove('open'); view.classList.remove('note-on'); }
  function popShow(el) {
    var m = el._m; if (!m) return; nBody.textContent = ''; nTitle.textContent = m.bab;
    nBody.appendChild(hlEx(h('div', 'insp-ar ar'), m.ar, m.fk, m.i, m.w));
    if (S.popArti && m.arti) nBody.appendChild(h('div', 'nhv-nar', m.arti));
    if (S.popRule) { var bx = h('div', 'nhv-nb'); bx.appendChild(h('b', '', m.rule[0])); bx.appendChild(hlText(h('p'), m.rule[1], m.fk)); nBody.appendChild(bx); }
    nOpen = true; note.classList.add('open'); view.classList.add('note-on');
  }
  note.querySelector('.icon-btn').onclick = popHide;
  scrim.onclick = function () { if (S.popOut) popHide(); };
  list.addEventListener('click', function (e) { var t = e.target.closest ? e.target.closest('.nhv-ex span') : null; if (t && S.pop) popShow(t); });
  /* Performa: animasi highlight hanya jalan untuk kartu yang terlihat, dan dijeda saat list di-scroll */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('vis', e.isIntersecting); }); }, { root: list, rootMargin: '80px 0px' }) : null, scrT = 0;
  list.addEventListener('scroll', function () { view.classList.add('nh-scr'); clearTimeout(scrT); scrT = setTimeout(function () { view.classList.remove('nh-scr'); }, 160); }, { passive: true });
  function paint() {
    popHide(); if (io) io.disconnect();
    var s = q.value.trim().toLowerCase(), n = 0, d = 0; list.textContent = '';
    if (cur === 'home' && !s) { home(); cnt.textContent = D.length + ' bab'; return; }
    if (curR === -1 && !s && D[+cur]) { // daftar sub bab dalam satu bab
      var b0 = D[+cur], bi0 = +cur, w0 = h('div', 'nhv-home'), hd0 = h('h3', 'nhv-h'), g0 = h('div', 'nhv-idx'), wb = h('button', 'btn btn-sm btn-tonal nhv-whole', 'Tampilkan seluruh bab');
      hd0.appendChild(h('span', '', b0.t)); hd0.appendChild(h('b', 'ar', b0.a)); wb.type = 'button'; wb.onclick = function () { openBab(bi0, true); };
      w0.appendChild(hd0); w0.appendChild(wb);
      b0.r.forEach(function (r, ri) {
        var t0 = h('button', 'nhv-it'); t0.type = 'button'; t0.style.setProperty('--d', Math.min(ri, 14) * 28 + 'ms'); if (ri > 14) t0.style.animation = 'none';
        t0.appendChild(h('i', '', String(ri + 1))); t0.appendChild(h('b', '', r[0]));
        t0.appendChild(h('span', '', r[1].length > 90 ? r[1].slice(0, 90).replace(/\s+\S*$/, '') + '…' : r[1]));
        t0.onclick = function () { go(bi0, ri); }; g0.appendChild(t0);
      });
      w0.appendChild(g0); list.appendChild(w0); cnt.textContent = b0.r.length + ' sub bab'; return;
    }
    D.forEach(function (b, bi) {
      if (cur !== 'all' && cur !== 'home' && cur !== String(bi)) return;
      var rows = b.r.filter(function (r) { if (curR != null && !s && b.r.indexOf(r) !== curR) return false; return !s || (b.t + ' ' + r.join(' ')).toLowerCase().indexOf(s) >= 0; });
      if (!rows.length) return;
      if (curR != null && !s && !list.firstChild) list.appendChild(banner());
      var sec = h('div', 'nhv-sec'), hd = h('h3', 'nhv-h'); hd.appendChild(h('span', '', b.t)); hd.appendChild(h('b', 'ar', b.a)); sec.appendChild(hd);
      rows.forEach(function (r) {
        n++; var card = h('div', 'nhv-card' + (s || S.openAll || (curR != null && cur !== 'all') ? ' open' : '')), t = h('button', 'nhv-t'), w = h('div', 'nhv-w'), in_ = h('div', 'nhv-in');
        card.dataset.k = bi + '-' + b.r.indexOf(r); card.style.setProperty('--d', Math.min(d++, 14) * 28 + 'ms'); t.type = 'button';
        t.appendChild(h('span', '', r[0])); t.insertAdjacentHTML('beforeend', '<svg class="i"><use href="#i-next"/></svg>');
        t.onclick = function () { card.classList.toggle('open'); };
        var ri = b.r.indexOf(r), fk = (F[bi] || {})[ri];
        in_.appendChild(hlText(h('p'), r[1], fk));
        if (r[2]) { var ex = h('div', 'nhv-ex ar'); r[2].split(' · ').forEach(function (x, xi) { var p = x.split(' = '), tg = tagsOf(p[0]), sp = hlEx(h('span'), p[0], fk, xi, tg); sp._m = { ar: p[0], arti: p[1] || '', rule: r, bab: b.t, w: tg, fk: fk, i: xi }; ex.appendChild(sp); }); in_.appendChild(ex); }
        if (d > 14) card.style.animation = 'none';
        w.appendChild(in_); card.appendChild(t); card.appendChild(w); sec.appendChild(card); if (io) io.observe(card); else card.classList.add('vis');
      });
      list.appendChild(sec);
    });
    if (!n) list.appendChild(h('p', 'nhv-none', 'Tidak ada kaidah yang cocok.'));
    cnt.textContent = n + ' kaidah';
  }

  /* ---- Mode Lite (ikut tombol Lite aplikasi), Tampilan Bersih ---- */
  function syncLite() { var on = document.body.classList.contains('lite'); liteB.classList.toggle('on', on); liteB.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  liteB.onclick = function () { var b = document.getElementById('liteBtn'); if (b) b.click(); setTimeout(syncLite, 30); };
  try { new MutationObserver(syncLite).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* abaikan */ }
  function setClean(on) {
    view.classList.toggle('nh-clean', on); document.documentElement.classList.toggle('nh-clean-on', on); cleanB.classList.toggle('on', on); cleanB.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { tocOpen(false); setOpen(false); }
  }
  cleanB.onclick = function () { setClean(!view.classList.contains('nh-clean')); };
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (nOpen) popHide(); else if (view.classList.contains('nh-clean')) setClean(false); else if (setBox.classList.contains('open')) setOpen(false); else if (tocBox.classList.contains('open')) tocOpen(false); else if (q.value) { q.value = ''; paint(); } else shut(); }
  }
  function show() {
    if (open) return; open = true; cur = 'home'; curR = null; syncLite(); prevFocus = document.activeElement; chips(); paint();
    view.hidden = false; void view.offsetWidth; view.classList.add('show');
    window.addEventListener('keydown', onKey, true); setTimeout(function () { q.focus({ preventScroll: true }); }, 60);
  }
  function shut() {
    if (!open) return; open = false; popHide(); setOpen(false); tocOpen(false); setClean(false); view.classList.remove('show'); window.removeEventListener('keydown', onKey, true);
    setTimeout(function () { if (!open) view.hidden = true; }, 280);
    try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
  }
  function wire() {
    apply(); document.body.appendChild(view); close.onclick = shut; q.oninput = function () { if (q.value.trim()) curR = null; paint(); };
    ['nahwuBtn', 'lncNahwu'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener('click', function () { if (window.NGAJI && NGAJI.closeLauncher) NGAJI.closeLauncher(); show(); });
    });
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'k' && !open) { e.preventDefault(); e.stopImmediatePropagation(); show(); }
      if (open && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'h') { e.preventDefault(); e.stopImmediatePropagation(); setClean(!view.classList.contains('nh-clean')); }
    }, true);
    window.NGAJI = window.NGAJI || {}; NGAJI.openNahwu = show; NGAJI.closeNahwu = shut;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();

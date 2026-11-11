/*
 * Tutorial pertama kali (tur berpemandu): muncul SEKALI setelah aplikasi pertama dibuka usai di-install,
 * tepat setelah animasi pembuka dan sebelum jendela "Mau Ngaji Apa Hari Ini?". Tiap langkah menyorot
 * bagian aplikasi yang asli (tombol, tab, area baca) lalu menjelaskannya di kartu kecil.
 *
 *  - Status "sudah ditampilkan" disimpan proses utama di config (ngajiApi.tourDone); di browser biasa memakai localStorage.
 *  - Bisa diulang kapan saja: menu Bantuan → Tutorial Penggunaan  (aksi menu 'tour' → NGAJI.startTour()).
 *  - Pintasan: → / Enter = lanjut · ← = kembali · Esc = lewati.
 *  - Teks memakai simpul teks polos supaya otomatis diterjemahkan i18n.js (Indonesia / English / العربية).
 *  - DOM dibuat dengan createElement (tanpa innerHTML) agar lolos CSP.
 */
(function () {
  'use strict';

  /* =====================================================================
   *  Isi tutorial.  Sasaran: any = elemen pertama yang tampak; all = gabungan semua yang tampak.
   *  Tanpa sasaran (atau sasaran tak tampak) -> kartu di tengah layar.
   *  Jangan memakai tanda kutip lurus di teks — kunci terjemahan di i18n.js harus sama persis.
   * ===================================================================== */
  var STEPS = [
    { hero: true, icon: 'logo', title: 'Selamat datang di Ngaji',
      body: 'Pembaca kitab interaktif dengan Pegon, penanda nahwu, dan garis dhomir. Tur singkat ini mengenalkan bagian-bagian utamanya — tidak sampai satu menit.',
      cta: 'Mulai Tur', ctaIcon: 'i-play' },
    { icon: 'i-library', any: ['#libBtn', '.brand'], title: 'Pilih Kitab',
      body: 'Klik logo Ngaji atau tombol Pilih Kitab (Ctrl+K) kapan saja untuk membuka rak kitab. Pilih kitab bawaan, tambahkan atau pindahkan file .ngaji, buka folder jenis kitab, atau mulai dari lembar kosong.' },
    { icon: 'i-nahwu', all: ['#nahwuBtn', '#pdfBtn'], title: 'Kaidah Nahwu dan Pembaca PDF',
      body: 'Tombol Nahwu (Ctrl+Shift+K) membuka 12 bab kaidah yang bisa dicari dan dibuka-tutup. Tombol PDF (Ctrl+Shift+P) membuka pembaca PDF dengan arah baca otomatis, beberapa tab, zoom, dan warna latar. Keduanya juga tersedia di jendela Pilih Kitab.' },
    { icon: 'i-save', all: ['#newBtn', '#openBtn', '#saveBtn', '#exportBtn'], title: 'Simpan dan Buka Proyek',
      body: 'Perubahanmu tersimpan otomatis. Tombol Simpan (Ctrl+S) membuat file .ngaji yang bisa dibuka lagi lewat Buka (Ctrl+O) atau dibagikan; Ekspor JS membuat salinan datanya.' },
    { icon: 'i-list', any: ['#tocBtn'], title: 'Daftar Isi',
      body: 'Klik tab di tepi kiri untuk melihat semua bab dan sub bab, melompat ke mana saja, dan menandai yang sudah dikaji. Kemajuan belajarmu tampil sebagai persentase.' },
    { icon: 'i-book', any: ['.reader-wrap'], pad: 0, place: 'center', title: 'Area Baca',
      body: 'Arahkan kursor ke sebuah kata untuk melihat Pegon, dhomir, dan marju’-nya di panel bawah; di layar sentuh, ketuk katanya. Penanda nahwu tampil di atas kata, dan garis dhomir menghubungkan kata ke marju’nya. Klik sebuah kalimat untuk memilihnya dan melihat catatannya.' },
    { icon: 'i-note', any: ['#inspBtn'], title: 'Catatan kalimat',
      body: 'Tab ini membuka catatan untuk kalimat atau paragraf yang dipilih. Di Mode Edit, kamu juga bisa menulis catatan dan mengatur formatnya dari sini. Catatan juga bisa tampil di tengah layar dengan latar blur; ukuran dan warnanya diatur di Pengaturan.' },
    { icon: 'i-file', any: ['#modeSwitch'], title: 'Mode Baca dan Mode Edit',
      body: 'Mode Baca untuk mengkaji. Mode Edit memunculkan alat tambahan: Urungkan dan Ulangi, tambah Bab, Kamus kata, serta tempel teks dari Word.' },
    { icon: 'i-bookmark', all: ['#prev', '#next', '#resumeDock', '#doneDock'], title: 'Navigasi dan Progres',
      body: 'Tombol panah atau tombol ← → berpindah halaman (RTL: kiri = maju). Lanjutkan membawa kamu ke posisi terakhir dibaca, dan tombol centang menandai bab ini sudah dikaji; persentasenya terlihat di Daftar Isi.' },
    { icon: 'i-sliders', any: ['#setBtn'], title: 'Pengaturan',
      body: 'Ubah tema (termasuk tema bergambar), font Arab, ukuran teks, animasi, dan penanda nahwu. Tombol speaker di atas mematikan atau menyalakan suara klik; Atur ulang mengembalikan grup ini ke bawaan. Semua grup tertutup bawaan — buka hanya yang kamu perlukan.' },
    { icon: 'i-bolt', all: ['#devBtn', '#liteBtn', '#harakatBtn', '#cleanBtn'], title: 'Tombol Cepat',
      body: 'Mode Lite membuat aplikasi lebih ringan tanpa mengurangi kehalusan gerak. Tombol harakat menyembunyikan atau menampilkan harakat, dan Tampilan Bersih menyembunyikan panel agar fokus membaca. Tombol </> membuka Developer Studio untuk mengubah warna, animasi, dan CSS tampilan secara langsung.' },
    { hero: true, icon: 'logo', title: 'Siap Mengaji!',
      body: 'Tutorial ini bisa diulang kapan saja lewat menu Bantuan → Tutorial Penggunaan. Selamat mengaji!',
      cta: 'Mulai Ngaji', ctaIcon: 'i-play' }
  ];

  // Dipakai pengujian (Node): ekspor teks tanpa menyentuh DOM.
  if (typeof module === 'object' && module && module.exports) { module.exports = { STEPS: STEPS }; return; }

  var NG = window.NGAJI;
  if (!NG) return;

  var LS_KEY = 'ngaji.tour.v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var tour = null;

  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ikon: salin <svg class="i"> yang sudah ada di halaman lalu ganti rujukan simbolnya (tanpa menulis markup SVG)
  function icon(id) {
    var proto = $('#tocBtn svg.i') || $('.appbar svg.i');
    if (!proto) return null;
    var n = proto.cloneNode(true), u = n.querySelector('use');
    if (u) u.setAttribute('href', '#' + id);
    return n;
  }
  function logo() {
    var proto = $('.brand svg.logo') || $('.lnc-logo');
    if (!proto) return null;
    var n = proto.cloneNode(true); n.setAttribute('class', 'tour-logo');
    return n;
  }

  function markDone() {
    try {
      if (window.ngajiApi && typeof window.ngajiApi.tourDone === 'function') window.ngajiApi.tourDone();
      else localStorage.setItem(LS_KEY, '1');
    } catch (e) { /* abaikan */ }
  }

  /* =====================================================================
   *  Sasaran sorotan
   * ===================================================================== */
  function visible(el) {
    if (!el || el.hidden) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function targetRect(st) {
    var sels = st.all || st.any;
    if (!sels) return null;
    var els = sels.map(function (s) { return $(s); }).filter(visible);
    if (!els.length) return null;
    if (st.any) els = [els[0]];
    var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    els.forEach(function (el) {
      var q = el.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    });
    return { left: l, top: t, width: r - l, height: b - t };
  }

  // letak kartu: di samping sasaran (kanan / kiri untuk tab tepi), selain itu di bawah / atas; selalu tetap di dalam layar
  function placeCard(r, cw, ch, vw, vh) {
    var g = 16, m = 12, x, y, side;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (r.width < 70 && r.height > r.width * 1.5) side = cx < vw / 2 ? 'right' : 'left';
    else side = cy < vh / 2 ? 'below' : 'above';
    var fit = {
      right: r.left + r.width + g + cw <= vw - m,
      left: r.left - g - cw >= m,
      below: r.top + r.height + g + ch <= vh - m,
      above: r.top - g - ch >= m
    };
    if (!fit[side]) { var alt = { right: 'left', left: 'right', below: 'above', above: 'below' }[side]; if (fit[alt]) side = alt; }
    if (side === 'right') { x = r.left + r.width + g; y = cy - ch / 2; }
    else if (side === 'left') { x = r.left - g - cw; y = cy - ch / 2; }
    else { x = cx - cw / 2; y = side === 'below' ? r.top + r.height + g : r.top - g - ch; }
    return { x: Math.max(m, Math.min(vw - cw - m, x)), y: Math.max(m, Math.min(vh - ch - m, y)) };
  }

  function layout(instant) {
    if (!tour) return;
    var st = STEPS[tour.i], vw = window.innerWidth, vh = window.innerHeight;
    var root = tour.root, spot = tour.spot, card = tour.card;
    if (instant) root.classList.add('nt');
    var r = targetRect(st), pos;
    var cw = card.offsetWidth, ch = card.offsetHeight;
    if (!r) {
      spot.classList.add('off'); root.classList.add('dim');
      pos = { x: (vw - cw) / 2, y: (vh - ch) / 2 };
    } else {
      var pad = st.pad == null ? 8 : st.pad;
      var x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
      var w = Math.min(vw - 4 - x, r.width + pad * 2), h = Math.min(vh - 4 - y, r.height + pad * 2);
      spot.style.left = x + 'px'; spot.style.top = y + 'px'; spot.style.width = w + 'px'; spot.style.height = h + 'px';
      spot.classList.remove('off'); root.classList.remove('dim');
      pos = st.place === 'center'
        ? { x: (vw - cw) / 2, y: (vh - ch) / 2 }
        : placeCard({ left: x, top: y, width: w, height: h }, cw, ch, vw, vh);
    }
    card.style.left = Math.round(pos.x) + 'px'; card.style.top = Math.round(pos.y) + 'px';
    if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { if (tour) tour.root.classList.remove('nt'); }); });
  }
  var relayoutQueued = false;
  function relayout() {
    if (relayoutQueued || !tour) return;
    relayoutQueued = true;
    requestAnimationFrame(function () { relayoutQueued = false; layout(true); });
  }

  /* =====================================================================
   *  Tampilan
   * ===================================================================== */
  function btn(cls, label) {
    var b = mk('button', cls); b.type = 'button';
    b.appendChild(mk('span', '', label));
    return b;
  }
  function setNext(label, iconId, before) {
    var b = tour.next;
    while (b.firstChild) b.removeChild(b.firstChild);
    var ic = iconId ? icon(iconId) : null;
    if (ic && before) b.appendChild(ic);
    b.appendChild(mk('span', '', label));
    if (ic && !before) b.appendChild(ic);
  }

  function build() {
    var root = mk('div'); root.id = 'tour';
    var dim = mk('div', 'tour-dim'), spot = mk('div', 'tour-spot off');
    var card = mk('section', 'tour-card glass');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tourTitle'); card.setAttribute('aria-describedby', 'tourText');
    var head = mk('div', 'tour-head'), ico = mk('div', 'tour-ico'), count = mk('span', 'tour-count');
    head.appendChild(ico); head.appendChild(count);
    var body = mk('div', 'tour-body'), h = mk('h3'), p = mk('p');
    h.id = 'tourTitle'; p.id = 'tourText';
    body.appendChild(h); body.appendChild(p);
    var dots = mk('div', 'tour-dots'); dots.setAttribute('aria-hidden', 'true');
    STEPS.forEach(function () { dots.appendChild(mk('i')); });
    var row = mk('div', 'tour-btns');
    var skip = btn('btn btn-ghost btn-sm', 'Lewati'), prev = btn('btn btn-sm', 'Kembali'), next = btn('btn btn-primary', 'Lanjut');
    row.appendChild(skip); row.appendChild(mk('span', 'sp')); row.appendChild(prev); row.appendChild(next);
    card.appendChild(head); card.appendChild(body); card.appendChild(dots); card.appendChild(row);
    root.appendChild(dim); root.appendChild(spot); root.appendChild(card);
    document.body.appendChild(root);
    skip.addEventListener('click', function () { end(false); });
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    // klik di luar kartu tidak menembus ke aplikasi di belakangnya
    root.addEventListener('pointerdown', function (e) { if (!card.contains(e.target)) e.preventDefault(); });
    root.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
    return { root: root, spot: spot, card: card, ico: ico, count: count, body: body, h: h, p: p, dots: dots, skip: skip, prev: prev, next: next };
  }

  function show(i) {
    var st = STEPS[i], last = STEPS.length - 1;
    tour.i = i;
    tour.h.textContent = st.title;
    tour.p.textContent = st.body;
    tour.body.classList.remove('swap'); void tour.body.offsetWidth; tour.body.classList.add('swap');
    tour.card.classList.toggle('hero', !!st.hero);
    while (tour.ico.firstChild) tour.ico.removeChild(tour.ico.firstChild);
    var ic = st.icon === 'logo' ? logo() : icon(st.icon);
    if (ic) tour.ico.appendChild(ic);
    tour.count.textContent = st.hero ? '' : i + '/' + (last - 1);
    tour.skip.hidden = i === last;
    tour.prev.hidden = i === 0;
    if (st.cta) setNext(st.cta, st.ctaIcon, true); else setNext('Lanjut', 'i-next', false);
    Array.prototype.forEach.call(tour.dots.children, function (d, k) { d.classList.toggle('on', k === i); d.classList.toggle('past', k < i); });
    // ukur setelah teks (dan terjemahannya) terpasang
    requestAnimationFrame(function () {
      if (!tour || tour.i !== i) return;
      layout(!tour.shown);
      tour.shown = true;
      try { tour.next.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    });
  }

  function go(d) {
    if (!tour) return;
    var n = tour.i + d;
    if (n < 0) return;
    if (n >= STEPS.length) { end(true); return; }
    show(n);
  }

  function onKey(e) {
    if (!tour) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // pintasan menu tetap berjalan
    var k = e.key, swallow = function () { e.preventDefault(); e.stopImmediatePropagation(); };
    var onBtn = document.activeElement && tour.card.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON';
    if (k === 'Escape') { swallow(); end(false); return; }
    if (k === 'ArrowRight' || k === 'PageDown') { swallow(); go(1); return; }
    if (k === 'ArrowLeft' || k === 'PageUp') { swallow(); go(-1); return; }
    if (k === 'Enter' || k === ' ') { if (onBtn) { e.stopImmediatePropagation(); return; } swallow(); go(1); return; }
    if (k === 'Tab') { // fokus terkurung di dalam kartu
      var f = Array.prototype.filter.call(tour.card.querySelectorAll('button'), function (b) { return !b.hidden && b.offsetParent !== null; });
      if (!f.length) { swallow(); return; }
      var first = f[0], lastB = f[f.length - 1];
      if (!tour.card.contains(document.activeElement)) { swallow(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { swallow(); lastB.focus(); }
      else if (!e.shiftKey && document.activeElement === lastB) { swallow(); first.focus(); }
      return;
    }
    e.stopImmediatePropagation(); // tombol lain tidak bocor ke pembaca di belakang
  }

  /* =====================================================================
   *  Mulai / selesai
   * ===================================================================== */
  function start(opts) {
    if (tour) return;
    opts = opts || {};
    if (typeof NG.closeLauncher === 'function') NG.closeLauncher(); // dipanggil dari menu saat rak kitab terbuka
    var wasClean = false;
    var cb = $('#cleanBtn');
    if (cb && cb.getAttribute('aria-pressed') === 'true') { wasClean = true; cb.click(); } // sorotan butuh bilah atas yang tampak
    tour = build();
    tour.onEnd = typeof opts.onEnd === 'function' ? opts.onEnd : null;
    tour.prevFocus = document.activeElement;
    tour.shown = false;
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', relayout);
    document.addEventListener('ngaji-lang', relayout);
    var open = function () {
      if (!tour) return;
      void tour.root.offsetWidth; // reflow agar transisi masuk berjalan
      tour.root.classList.add('show');
      show(0);
    };
    if (wasClean) setTimeout(open, 420); else open();
  }

  function end(finished) {
    if (!tour) return;
    var t = tour; tour = null;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', relayout);
    document.removeEventListener('ngaji-lang', relayout);
    t.root.classList.remove('show');
    setTimeout(function () { if (t.root.parentNode) t.root.parentNode.removeChild(t.root); }, 360);
    try { if (t.prevFocus && t.prevFocus.focus) t.prevFocus.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    markDone();
    if (t.onEnd) { try { t.onEnd(!!finished); } catch (err) { console.error(err); } }
  }

  NG.startTour = start;
  NG.tourActive = function () { return !!tour; };
})();

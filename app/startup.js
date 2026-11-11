/*
 * Pembuka aplikasi:
 *   1) animasi logo pena (± 4 detik, bisa dilewati dengan klik / Esc / Spasi) lengkap dengan suara,
 *      disintesis langsung dengan Web Audio — tanpa file audio;
 *   2) jendela "Mau Ngaji Apa Hari Ini?" (latar di-blur) untuk memilih: Buka Kitab (.ngaji) atau File Kosong.
 *      Aplikasi selalu dimulai dengan lembar kosong; berkas hanya dipilih lewat jendela ini.
 * Keputusan tampil / tidak diambil di startup-gate.js (hanya pemuatan pertama setelah aplikasi dijalankan).
 * Pertama kali setelah install, tutorial berpemandu (tutorial.js) tampil di antara animasi dan jendela pilihan.
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var info = window.NGAJI_STARTUP || { intro: false, launcher: false, project: null };
  var NG = window.NGAJI;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }
  };

  /* =====================================================================
   *  Suara animasi logo  (garis waktu detik harus sejalan dengan keyframes #intro.go di styles.css)
   *    0.0  drone hangat D + hembusan lembut
   *    0.75 / 1.0 / 1.15  tiga goresan huruf N: gesekan tinta + petikan oud (skala hijaz)
   *    1.4 – 1.7  mata pena meluncur (desing turun) lalu menancap ("tok" kayu)
   *    1.85  akor hangat terbuka saat logo berdenyut
   *    2.0 – 2.32  marimba menanjak, satu nada per huruf NGAJI; denting penutup 2.62
   * ===================================================================== */
  var INTRO_MS = 4000;

  function impulse(ctx, secs, decay) {
    var n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  function buildSound(ctx, muted) {
    var T0 = ctx.currentTime + 0.06;
    var at = function (t) { return T0 + t; };

    var master = ctx.createGain();
    var level = muted ? 0.0001 : 0.9;
    master.gain.setValueAtTime(0.0001, T0);
    master.gain.exponentialRampToValueAtTime(level, T0 + 0.3);
    master.gain.setValueAtTime(level, T0 + 3.5);
    master.gain.exponentialRampToValueAtTime(0.0001, T0 + 4.0);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    var vol = ctx.createGain(); vol.gain.value = muted ? 0 : 1; // pengatur bisu (terpisah dari envelope master)
    master.connect(comp); comp.connect(vol); vol.connect(ctx.destination);

    var rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 2.6, 2.4);
    var wet = ctx.createGain(); wet.gain.value = 0.6; rev.connect(wet); wet.connect(master);
    var dry = ctx.createGain(); dry.gain.value = 0.85; dry.connect(master);
    var bus = ctx.createGain(); bus.connect(dry); bus.connect(rev);

    var nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nbuf.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    function panner(p) { var n = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (n.pan) n.pan.value = p; return n; }

    // petikan lembut (sinus + overtone)
    function pluck(f, t, g, dur, pan) {
      var p = panner(pan || 0), out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, at(t));
      out.gain.exponentialRampToValueAtTime(g, at(t) + 0.006);
      out.gain.exponentialRampToValueAtTime(0.0001, at(t) + dur);
      [[1, 1, 'sine'], [2, 0.28, 'sine'], [3, 0.1, 'triangle']].forEach(function (pr) {
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = pr[2]; o.frequency.value = f * pr[0]; og.gain.value = pr[1];
        o.connect(og); og.connect(out); o.start(at(t)); o.stop(at(t) + dur + 0.05);
      });
      out.connect(p); p.connect(bus);
    }

    // lonceng kristal: overtone tak harmonis, ekor panjang
    function bell(f, t, g, dur) {
      var ratios = [1, 2.0, 2.76, 5.4, 8.93], gains = [1, 0.55, 0.32, 0.14, 0.07];
      ratios.forEach(function (r, k) {
        var o = ctx.createOscillator(), a = ctx.createGain(), d = dur / (1 + k * 0.55);
        o.type = 'sine'; o.frequency.value = f * r;
        a.gain.setValueAtTime(0.0001, at(t));
        a.gain.exponentialRampToValueAtTime(g * gains[k], at(t) + 0.004);
        a.gain.exponentialRampToValueAtTime(0.0001, at(t) + d);
        o.connect(a); a.connect(bus); o.start(at(t)); o.stop(at(t) + d + 0.05);
      });
    }

    // desir / angin: derau disaring, frekuensi menyapu
    function whoosh(t, dur, f0, f1, g, q, pan) {
      var s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, at(t)); bp.frequency.exponentialRampToValueAtTime(f1, at(t) + dur);
      var a = ctx.createGain();
      a.gain.setValueAtTime(0.0001, at(t));
      a.gain.exponentialRampToValueAtTime(g, at(t) + dur * 0.5);
      a.gain.exponentialRampToValueAtTime(0.0001, at(t) + dur);
      var p = panner(pan || 0);
      s.connect(bp); bp.connect(a); a.connect(p); p.connect(bus);
      s.start(at(t), Math.random()); s.stop(at(t) + dur + 0.05);
    }

    // oud / kecapi: petikan hangat (gergaji disaring, menyurut cepat)
    function oud(f, t, g, dur, pan) {
      var p = panner(pan || 0), lp = ctx.createBiquadFilter(), out = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2; o2.detune.value = 4;
      lp.type = 'lowpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(f * 7, at(t)); lp.frequency.exponentialRampToValueAtTime(f * 1.4, at(t) + dur * 0.7);
      out.gain.setValueAtTime(0.0001, at(t)); out.gain.exponentialRampToValueAtTime(g, at(t) + 0.008); out.gain.exponentialRampToValueAtTime(0.0001, at(t) + dur);
      var g2 = ctx.createGain(); g2.gain.value = 0.35;
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(out); out.connect(p); p.connect(bus);
      o.start(at(t)); o2.start(at(t)); o.stop(at(t) + dur + 0.05); o2.stop(at(t) + dur + 0.05);
    }

    // marimba lembut (sinus + overtone ke-4 yang cepat padam)
    function mallet(f, t, g, dur, pan) {
      var p = panner(pan || 0), out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, at(t)); out.gain.exponentialRampToValueAtTime(g, at(t) + 0.004); out.gain.exponentialRampToValueAtTime(0.0001, at(t) + dur);
      [[1, 1, dur], [4, 0.22, dur * 0.18]].forEach(function (pr) {
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f * pr[0];
        og.gain.setValueAtTime(pr[1], at(t)); og.gain.exponentialRampToValueAtTime(0.0001, at(t) + pr[2]);
        o.connect(og); og.connect(out); o.start(at(t)); o.stop(at(t) + dur + 0.05);
      });
      out.connect(p); p.connect(bus);
    }

    // goresan pena: gesekan tinta (derau tinggi) yang menanjak lalu mereda, kiri → kanan
    function scratch(t, dur, f0, f1, g, pan) {
      var s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = true;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.4;
      bp.frequency.setValueAtTime(f0, at(t)); bp.frequency.linearRampToValueAtTime(f1, at(t) + dur);
      var a = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 38; lg.gain.value = g * 0.45; lfo.connect(lg); lg.connect(a.gain); // getaran serat kertas
      a.gain.setValueAtTime(0.0001, at(t)); a.gain.exponentialRampToValueAtTime(g, at(t) + dur * 0.25); a.gain.exponentialRampToValueAtTime(0.0001, at(t) + dur);
      var p = panner(pan || 0);
      s.connect(hp); hp.connect(bp); bp.connect(a); a.connect(p); p.connect(bus);
      s.start(at(t), Math.random()); s.stop(at(t) + dur + 0.05); lfo.start(at(t)); lfo.stop(at(t) + dur + 0.05);
    }

    // drone hangat: D rendah + kuint (A), naik pelan lalu menyurut
    [[73.42, 'sine', 1], [110, 'triangle', 0.6], [146.83, 'sine', 0.35]].forEach(function (v) {
      var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), a = ctx.createGain();
      o.type = v[1]; o.frequency.value = v[0];
      lp.type = 'lowpass'; lp.frequency.value = 520;
      a.gain.setValueAtTime(0.0001, at(0)); a.gain.exponentialRampToValueAtTime(0.11 * v[2], at(1.7)); a.gain.exponentialRampToValueAtTime(0.0001, at(3.9));
      o.connect(lp); lp.connect(a); a.connect(bus); o.start(at(0)); o.stop(at(4));
    });
    whoosh(0.0, 0.9, 200, 900, 0.07, 1.5, 0); // hembusan lembut pembuka

    // 0.75 / 1.0 / 1.15  tiga goresan huruf N (sejalan dengan inWipe) — gesekan + petikan oud skala hijaz D
    scratch(0.75, 0.75, 3200, 5200, 0.11, -0.4);
    scratch(1.0, 0.7, 3600, 5600, 0.1, 0.0);
    scratch(1.15, 0.75, 3000, 5000, 0.11, 0.4);
    oud(293.66, 0.75, 0.2, 1.3, -0.3);   // D4
    oud(369.99, 1.0, 0.17, 1.2, 0.0);    // F#4 (jarak hijaz)
    oud(440.0, 1.15, 0.17, 1.2, 0.3);    // A4
    oud(466.16, 1.3, 0.12, 1.1, 0.1);    // Bb4

    // 1.4 – 1.6 mata pena meluncur turun lalu menancap: desing menurun + "tok" kayu
    var gl = ctx.createOscillator(), gg = ctx.createGain();
    gl.type = 'sine'; gl.frequency.setValueAtTime(1500, at(1.4)); gl.frequency.exponentialRampToValueAtTime(380, at(1.66));
    gg.gain.setValueAtTime(0.0001, at(1.4)); gg.gain.exponentialRampToValueAtTime(0.05, at(1.5)); gg.gain.exponentialRampToValueAtTime(0.0001, at(1.7));
    gl.connect(gg); gg.connect(bus); gl.start(at(1.4)); gl.stop(at(1.75));
    var tk = ctx.createOscillator(), tkg = ctx.createGain();
    tk.type = 'sine'; tk.frequency.setValueAtTime(240, at(1.66)); tk.frequency.exponentialRampToValueAtTime(70, at(1.8));
    tkg.gain.setValueAtTime(0.0001, at(1.66)); tkg.gain.exponentialRampToValueAtTime(0.42, at(1.672)); tkg.gain.exponentialRampToValueAtTime(0.0001, at(1.95));
    tk.connect(tkg); tkg.connect(dry); tk.start(at(1.66)); tk.stop(at(2));
    mallet(880, 1.66, 0.07, 0.5, 0);

    // 1.85 akor hangat terbuka (D – A – D – F#) saat logo berdenyut
    [[146.83, 0.09], [220, 0.075], [293.66, 0.06], [369.99, 0.05], [587.33, 0.03]].forEach(function (v, k) {
      var o = ctx.createOscillator(), a = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = k < 4 ? 'triangle' : 'sine'; o.frequency.value = v[0]; lp.type = 'lowpass'; lp.frequency.value = 2200;
      a.gain.setValueAtTime(0.0001, at(1.85)); a.gain.exponentialRampToValueAtTime(v[1], at(2.05)); a.gain.exponentialRampToValueAtTime(0.0001, at(3.7));
      o.connect(lp); lp.connect(a); a.connect(bus); o.start(at(1.85)); o.stop(at(3.8));
    });

    // 2.0 – 2.32 huruf N-G-A-J-I: marimba menanjak (D E♭ F# G A), satu nada per huruf
    [587.33, 622.25, 739.99, 783.99, 880].forEach(function (f, k) { mallet(f, 2.0 + k * 0.08, 0.07 + k * 0.006, 0.9, -0.5 + k * 0.25); });
    mallet(1174.66, 2.62, 0.045, 1.4, 0.2); // satu denting penutup (tulisan "created by")

    return {
      setMuted: function (m) { vol.gain.cancelScheduledValues(ctx.currentTime); vol.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03); },
      stop: function () { // dilewati: senyap cepat lalu tutup
        try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16); } catch (e) { /* abaikan */ }
        setTimeout(function () { try { ctx.close(); } catch (e) { /* abaikan */ } }, 400);
      },
      close: function () { try { ctx.close(); } catch (e) { /* abaikan */ } }
    };
  }

  /* =====================================================================
   *  Animasi logo
   * ===================================================================== */
  function runIntro(done) {
    var intro = $('#intro'), root = document.documentElement;
    if (!intro) { done(); return; }
    var finished = false, timers = [], snd = null, muted = store.get('ngaji.introMute') === '1';

    // butir cahaya melayang
    var dust = $('#inDust');
    for (var i = 0; i < 26; i++) {
      var d = document.createElement('i');
      d.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;--s:' + (2 + Math.random() * 4).toFixed(1) + 'px;--dl:' + (Math.random() * 2.4).toFixed(2) + 's;--du:' + (3 + Math.random() * 2.4).toFixed(2) + 's;--dx:' + ((Math.random() - 0.5) * 80).toFixed(0) + 'px';
      dust.appendChild(d);
    }

    var btn = $('#inSound');
    function paintMute() { btn.querySelector('use').setAttribute('href', muted ? '#i-mute' : '#i-vol'); btn.classList.toggle('muted', muted); }
    paintMute();
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); muted = !muted; store.set('ngaji.introMute', muted ? '1' : '0'); paintMute();
      if (snd) snd.setMuted(muted);
    });

    function finish() {
      if (finished) return; finished = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey, true);
      intro.removeEventListener('pointerdown', finish);
      if (snd) snd.stop();
      intro.classList.add('out');
      timers = [setTimeout(done, 280)]; // jendela pilihan muncul saat animasi masih memudar (silang pudar)
      timers.push(setTimeout(function () {
        root.removeAttribute('data-intro');
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 560));
    }
    function onKey(e) {
      if (['Escape', ' ', 'Enter', 'Spacebar'].indexOf(e.key) >= 0) { e.preventDefault(); e.stopImmediatePropagation(); finish(); }
    }
    window.addEventListener('keydown', onKey, true);
    intro.addEventListener('pointerdown', finish);
    try { sessionStorage.setItem('ngaji.intro', '1'); } catch (e) { /* abaikan */ }

    function go() {
      if (finished) return;
      intro.classList.add('go');
      timers.push(setTimeout(finish, INTRO_MS));
    }

    var ctx = null;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { ctx = null; }
    if (!ctx) { go(); return; }
    var started = false;
    function begin() {
      if (started || finished) return; started = true;
      if (ctx.state === 'running') {
        try { snd = buildSound(ctx, muted); } catch (e) { console.error('Suara pembuka gagal:', e); snd = null; }
        timers.push(setTimeout(go, 60)); // gambar mulai tepat saat suara mulai (T0 = +0,06 dtk)
      } else { try { ctx.close(); } catch (e) { /* abaikan */ } ctx = null; go(); } // autoplay diblokir (browser): animasi tanpa suara
    }
    var resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    resume.then(begin, begin);
    timers.push(setTimeout(begin, 300)); // jaring pengaman bila resume() menggantung
  }

  /* =====================================================================
   *  Jendela "Mau Ngaji Apa Hari Ini?"
   *  Kitab bawaan berjajar menyamping (seperti memilih game di Steam): kartu terpilih di tengah, ← / → atau tombol panah / roda / geser untuk berpindah,
   *  Enter / klik kartu / "Mulai Ngaji" untuk membuka. Animasi membuka: kartu membesar & memudar -> halaman dimuat ulang -> tirai gelap memudar (#reveal).
   * ===================================================================== */
  var lnc = { el: null, open: false, busy: false, prevFocus: null };
  var car = { all: [], avail: [], books: [], els: [], i: 0, wheelAt: 0, swiped: false, jenis: '' };
  var JENIS_ALL = ''; // '' = semua jenis
  var JENIS_ORDER = ['Fiqih', 'Hadis', 'Tafsir', 'Akidah', 'Akhlak', 'Tasawuf', 'Nahwu', 'Sharaf']; // urutan chip; jenis lain menyusul menurut abjad, "Lainnya" paling akhir
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* abaikan */ }
  var OPEN_MS = 640, LEAVE_MS = 380; // jeda animasi sebelum proyek benar-benar diganti (harus sejalan dengan #launcher.opening / .leaving di styles.css)

  // pasangan warna sampul: [atas, bawah, bingkai/cahaya] — dipilih dari nama kitab agar tiap kitab punya warna tetap
  var COVERS = [['#0f766e', '#134e4a', '#5eead4'], ['#b45309', '#78350f', '#fcd34d'], ['#1d4ed8', '#1e3a8a', '#93c5fd'],
    ['#7e22ce', '#4c1d95', '#d8b4fe'], ['#be123c', '#881337', '#fda4af'], ['#047857', '#064e3b', '#6ee7b7']];
  function hashOf(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
  function mk(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  var isRtl = function () { return document.documentElement.dir === 'rtl'; };
  var canAct = function () { return !!(window.NGAJI && NGAJI.openProject && NGAJI.newProject); };

  function jenisOf(b) { return (b && b.jenis) || 'Lainnya'; }
  function jenisList(books) { // jenis yang ada, berurutan
    var seen = {}, out = [];
    car.avail.forEach(function (j) { if (!seen[j]) { seen[j] = 1; out.push(j); } });
    books.forEach(function (b) { var j = jenisOf(b); if (!seen[j]) { seen[j] = 1; out.push(j); } });
    var rank = function (j) { if (j === 'Lainnya') return 1e6; var k = JENIS_ORDER.map(function (x) { return x.toLowerCase(); }).indexOf(j.toLowerCase()); return k < 0 ? 1000 : k; };
    return out.sort(function (a, b) { return rank(a) - rank(b) || a.localeCompare(b, 'id'); });
  }
  function renderJenis() { // barisan pilihan jenis kitab di atas rak
    var box = $('#lncJenis'); if (!box) return;
    clear(box);
    var list = jenisList(car.all);
    if (list.indexOf(car.jenis) < 0) car.jenis = JENIS_ALL;
    box.hidden = !list.length;
    paintAdd();
    [JENIS_ALL].concat(list).forEach(function (j) {
      var n = j === JENIS_ALL ? car.all.length : car.all.filter(function (b) { return jenisOf(b) === j; }).length;
      var c = mk('button', 'lnc-chip' + (j === car.jenis ? ' on' : '')); c.type = 'button'; c.setAttribute('role', 'tab');
      c.setAttribute('aria-selected', j === car.jenis ? 'true' : 'false');
      c.appendChild(mk('span', '', j === JENIS_ALL ? 'Semua' : j)); c.appendChild(mk('small', '', String(n)));
      if (!n) c.classList.add('zero');
      c.addEventListener('click', function () { setJenis(j); });
      box.appendChild(c);
    });
  }
  function paintAdd() { // tombol "Tambah" menyebut jenis tujuan; teks kosong menyesuaikan jenis
    var l = $('#lncAddLbl'); if (!l) return;
    clear(l); l.appendChild(mk('span', '', car.jenis ? 'Tambah ke' : 'Tambah Kitab'));
    if (car.jenis) { l.appendChild(document.createTextNode(' ')); l.appendChild(mk('span', '', car.jenis)); }
    var em = $('#lncEmpty'); if (!em) return;
    clear(em);
    em.appendChild(mk('strong', '', 'Belum ada kitab'));
    if (car.jenis) { em.appendChild(document.createTextNode(' ')); em.appendChild(mk('strong', '', car.jenis)); }
    em.appendChild(mk('br'));
    em.appendChild(mk('span', '', 'Klik “Tambah” untuk memasukkan file .ngaji ke sini, atau “Buka Folder” lalu taruh filenya di folder itu.'));
  }
  function setJenis(j) {
    if (lnc.busy || j === car.jenis) return;
    car.jenis = j; store.set('ngaji.jenis', j);
    build(car.all); renderJenis();
  }

  function setMeta(b) { // kata "bab" / "kalimat" dipisah agar ikut diterjemahkan oleh i18n
    var m = $('#lncMeta'); clear(m);
    if (b.jenis) { m.appendChild(mk('span', 'lnc-jn', b.jenis)); m.appendChild(document.createTextNode(' · ')); }
    [[b.pages, 'bab'], [b.sentences, 'kalimat']].forEach(function (p, k) {
      if (k) m.appendChild(document.createTextNode(' · '));
      m.appendChild(mk('span', '', p[0])); m.appendChild(document.createTextNode(' ')); m.appendChild(mk('span', '', p[1]));
    });
  }

  // posisi tiap kartu = selisih indeks (--d) terhadap kartu terpilih; selebihnya dikerjakan CSS (transisi halus)
  function layout(swap) {
    var n = car.books.length; if (!n) return;
    car.els.forEach(function (el, k) {
      var d = k - car.i, a = Math.abs(d);
      el.style.setProperty('--d', String(d)); el.style.zIndex = String(40 - a);
      el.classList.toggle('cur', d === 0); el.classList.toggle('far', a > 3);
      el.tabIndex = d === 0 ? 0 : -1; el.setAttribute('aria-selected', d === 0 ? 'true' : 'false');
    });
    var b = car.books[car.i];
    $('#lncName').textContent = b.title; setMeta(b);
    if (swap) { var inf = $('#lncInfo'); inf.classList.remove('swap'); void inf.offsetWidth; inf.classList.add('swap'); }
    Array.prototype.forEach.call($('#lncDots').children, function (dt, k) { dt.classList.toggle('on', k === car.i); });
    var atStart = car.i === 0, atEnd = car.i === n - 1, r = isRtl();
    $('#lncPrev').disabled = r ? atEnd : atStart; // tombol kiri = berpindah ke kiri secara visual
    $('#lncNext').disabled = r ? atStart : atEnd;
    paintManage(b);
  }
  function paintManage(b) { // Pindah / Hapus aktif untuk kitab terpilih (gagal dengan pesan bila foldernya hanya-baca)
    var mv = $('#lncMove'), dl = $('#lncDel'); if (!mv || !dl) return;
    mv.disabled = dl.disabled = !(b && NG && NG.moveKitab && NG.deleteKitab);
  }

  function select(i, focus) {
    var n = car.books.length; if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    if (i === car.i) return;
    car.i = i; layout(true);
    if (focus && car.els[i]) car.els[i].focus({ preventScroll: true });
  }
  function step(sign) { select(car.i + (isRtl() ? -sign : sign), true); } // sign: +1 = ke kanan (visual)

  function build(all) {
    var track = $('#lncBookList'), stage = $('#lncStage'), dots = $('#lncDots');
    car.all = all || [];
    car.books = car.jenis ? car.all.filter(function (b) { return jenisOf(b) === car.jenis; }) : car.all.slice();
    car.els = []; car.i = 0;
    clear(track); clear(dots);
    stage.classList.remove('loading'); stage.classList.toggle('empty', !car.books.length);
    lnc.el.classList.toggle('nobooks', !car.books.length);
    var proto = $('.lnc-logo');
    car.books.forEach(function (b, k) {
      var sw = COVERS[hashOf(b.title) % COVERS.length];
      var btn = mk('button', 'lnc-cv'); btn.type = 'button'; btn.setAttribute('role', 'option'); btn.setAttribute('aria-label', b.title);
      btn.style.setProperty('--c1', sw[0]); btn.style.setProperty('--c2', sw[1]); btn.style.setProperty('--cg', sw[2]);
      var face = mk('span', 'cv'); face.appendChild(mk('span', 'cv-frame'));
      var star = proto.cloneNode(true); star.setAttribute('class', 'cv-star'); face.appendChild(star); // lencana logo pena
      face.appendChild(mk('span', 'cv-title', b.title)); btn.appendChild(face);
      btn.addEventListener('click', function () { if (car.swiped) return; if (k === car.i) openCurrent(); else select(k, true); });
      track.appendChild(btn); car.els.push(btn);
      if (car.books.length <= 12) dots.appendChild(mk('i'));
    });
    layout(false);
    if (!car.books.length) paintManage(null);
  }

  function focusDefault() {
    var f = car.els[car.i] || $(canAct() ? '#lncOpen' : '#lncClose');
    if (f) f.focus({ preventScroll: true });
  }

  function renderBooks() {
    var ok = window.NGAJI && NGAJI.listKitab && NGAJI.openKitab;
    var done = function (res) {
      var books = Array.isArray(res) ? res : (res && res.books) || [];
      car.avail = (res && res.jenis) || [];
      if (!lnc.open) return;
      if (!car.jenis) car.jenis = store.get('ngaji.jenis') || JENIS_ALL; // ingat jenis terakhir yang dipilih
      build(books); renderJenis(); restorePick();
      if (car.jenis && car.avail.indexOf(car.jenis) < 0 && !car.books.length) { car.jenis = JENIS_ALL; build(books); renderJenis(); } // jenis tersimpan sudah tak ada
      focusDefault();
    };
    (ok ? NGAJI.listKitab() : Promise.resolve({ books: [], jenis: [] })).then(done, function () { done({ books: [], jenis: [] }); });
  }

  function restorePick() { // setelah hapus / pindah: kartu terpilih tetap di sekitar posisi semula
    var id = car.pickId, i = car.pickIdx; car.pickId = null; car.pickIdx = null;
    if (id) { for (var k = 0; k < car.books.length; k++) if (car.books[k].id === id) { select(k, false); return; } }
    if (i != null) select(Math.min(i, car.books.length - 1), false);
  }

  function deleteCurrent() { // hapus kitab terpilih (konfirmasi memakai dialog native di proses utama)
    var b = car.books[car.i];
    if (!b || lnc.busy || !(NG && NG.deleteKitab)) return;
    lnc.busy = true; lnc.el.classList.add('busy');
    var idx = car.i;
    Promise.resolve(NG.deleteKitab(b.id)).then(function (res) {
      lnc.busy = false; lnc.el.classList.remove('busy');
      if (res && res.deleted) { car.pickIdx = idx; if (NG.toast) NG.toast('Kitab dihapus'); renderBooks(); }
      else if (res && res.error && NG.toast) NG.toast(res.error);
      if (lnc.open) focusDefault();
    });
  }

  function movePane() { var p = $('#lncMovePane'); return p && !p.hidden ? p : null; }
  function openMove() { // pilih jenis tujuan: klik salah satu jenis, atau ketik nama jenis baru
    var b = car.books[car.i];
    if (!b || lnc.busy || !(NG && NG.moveKitab)) return;
    var pane = $('#lncMovePane'), box = $('#lncMoveJenis'), cur = jenisOf(b).toLowerCase();
    clear(box);
    $('#lncMoveName').textContent = b.title;
    jenisList(car.all).filter(function (j) { return j.toLowerCase() !== cur; }).forEach(function (j) {
      var c = mk('button', 'lnc-chip', j); c.type = 'button';
      c.addEventListener('click', function () { doMove(j); });
      box.appendChild(c);
    });
    $('#lncMoveNew').value = '';
    pane.hidden = false;
    var f = box.firstChild || $('#lncMoveNew'); if (f) f.focus({ preventScroll: true });
  }
  function closeMove() {
    var pane = $('#lncMovePane'); if (pane) pane.hidden = true;
    if (lnc.open) focusDefault();
  }
  function doMove(jenis) {
    var b = car.books[car.i]; jenis = String(jenis || '').trim();
    if (!b || !jenis || lnc.busy || !(NG && NG.moveKitab)) return;
    lnc.busy = true; lnc.el.classList.add('busy');
    Promise.resolve(NG.moveKitab(b.id, jenis)).then(function (res) {
      lnc.busy = false; lnc.el.classList.remove('busy');
      if (res && res.ok) {
        var pane = $('#lncMovePane'); if (pane) pane.hidden = true;
        car.jenis = res.jenis || jenis; store.set('ngaji.jenis', car.jenis); car.pickId = res.id || null;
        if (NG.toast) NG.toast('Kitab dipindahkan');
        renderBooks();
      } else if (res && res.error && NG.toast) NG.toast(res.error);
    });
  }

  function openLauncher() {
    lnc.el = lnc.el || $('#launcher');
    if (!lnc.el || lnc.open) return;
    if (window.NGAJI && NGAJI.tourActive && NGAJI.tourActive()) return; // tutorial sedang tampil
    lnc.busy = false; lnc.el.classList.remove('busy', 'opening', 'leaving');
    $('#lncStage').classList.add('loading');
    $('#lncOpen').disabled = $('#lncNew').disabled = !canAct();
    $('#lncAdd').disabled = $('#lncFolder').disabled = !(NG && NG.addKitab);
    lnc.prevFocus = document.activeElement;
    lnc.el.hidden = false;
    void lnc.el.offsetWidth; // reflow agar transisi masuk berjalan
    lnc.el.classList.add('show');
    lnc.open = true;
    window.addEventListener('keydown', onLauncherKey, true);
    renderBooks();
    setTimeout(function () { if (lnc.open && !car.els.length) focusDefault(); }, 60);
  }

  function closeLauncher() {
    if (!lnc.open || lnc.busy) return;
    lnc.open = false;
    var mp = $('#lncMovePane'); if (mp) mp.hidden = true;
    window.removeEventListener('keydown', onLauncherKey, true);
    lnc.el.classList.remove('show');
    setTimeout(function () { if (!lnc.open) lnc.el.hidden = true; }, 320);
    try { if (lnc.prevFocus && lnc.prevFocus.focus) lnc.prevFocus.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
  }

  // Memulai pekerjaan proses utama (dialog native, ganti proyek). Hasil `true` / {ok:true} = proyek diganti -> halaman segera dimuat ulang,
  // jadi tampilan dibiarkan apa adanya (tidak mundur). Dibatalkan / gagal -> animasi dibalik dan pilihan tetap tampil.
  function run(cls, wait, fn, early) { // early: fn langsung dijalankan bersamaan dengan animasi (bukan menunggu animasi selesai)
    if (lnc.busy || !fn) return;
    lnc.busy = true; lnc.el.classList.add('busy');
    if (cls && !REDUCED) lnc.el.classList.add(cls); else wait = 0;
    var restore = function () { lnc.busy = false; lnc.el.classList.remove('busy', 'opening', 'leaving'); if (lnc.open) focusDefault(); };
    setTimeout(function () {
      Promise.resolve().then(fn).then(function (res) {
        if (res && res.swapped) { // kitab ditukar di tempat (tanpa muat ulang): jendela pilihan memudar, panel di belakangnya tidak berubah
          lnc.busy = false; lnc.el.classList.remove('busy'); closeLauncher();
          setTimeout(function () { if (!lnc.open) lnc.el.classList.remove('opening', 'leaving'); }, 450);
        } else if (res === true || (res && res.ok === true)) setTimeout(restore, 6000); // jaring pengaman bila muat ulang tak kunjung terjadi
        else restore();
      }, restore);
    }, early ? 0 : wait);
  }

  function openCurrent() {
    if (!car.books.length || !(NG && NG.openKitab)) return;
    var name = car.books[car.i].id || car.books[car.i].name;
    run('opening', OPEN_MS, function () { return NG.openKitab(name, REDUCED ? 0 : OPEN_MS); }, true);
  }
  function addBooks() { // salin file .ngaji ke jenis terpilih, lalu muat ulang rak
    if (!(NG && NG.addKitab) || lnc.busy) return;
    lnc.busy = true; lnc.el.classList.add('busy');
    Promise.resolve(NG.addKitab(car.jenis)).then(function (res) {
      lnc.busy = false; lnc.el.classList.remove('busy');
      if (res && res.added) renderBooks();
    }, function () { lnc.busy = false; lnc.el.classList.remove('busy'); });
  }
  function openPdfReader() { // pembaca PDF: tutup jendela ini lalu buka pembacanya
    if (!(NG && NG.openPdf) || lnc.busy) return;
    closeLauncher(); NG.openPdf();
  }
  function choose(kind) {
    var fn = kind === 'open' ? NG && NG.openProject : NG && NG.newProject;
    if (!fn) return;
    // Buka = dialog file native (tanpa animasi di depannya); File Kosong = jendela memudar dulu
    run(kind === 'new' ? 'leaving' : '', LEAVE_MS, function () { return fn(); });
  }

  function onLauncherKey(e) {
    if (!lnc.open) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl+O / Ctrl+N dst. tetap dikerjakan menu aplikasi
    var k = e.key, swallow = function () { e.preventDefault(); e.stopImmediatePropagation(); };
    if (lnc.busy) { swallow(); return; }
    var pane = movePane();
    if (pane) { // panel pindah jenis terbuka: Esc menutup panel; ketikan di kolom nama tidak boleh dianggap pintasan
      if (k === 'Escape') { swallow(); closeMove(); return; }
      if (k === 'Enter' && e.target && e.target.id === 'lncMoveNew') { swallow(); doMove($('#lncMoveNew').value); return; }
      if (k !== 'Tab') { if (!(e.target && /input/i.test(e.target.tagName))) e.stopImmediatePropagation(); return; }
    }
    if (k === 'Escape') { swallow(); closeLauncher(); return; }
    if (k === '1') { swallow(); choose('open'); return; }
    if (k === '2') { swallow(); choose('new'); return; }
    if (k === '3') { swallow(); addBooks(); return; }
    if (k === '4') { swallow(); openPdfReader(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { swallow(); step(k === 'ArrowRight' ? 1 : -1); return; } // jangan membalik halaman di belakang
    if (k === 'Home' || k === 'End') { swallow(); select(k === 'Home' ? 0 : car.books.length - 1, true); return; }
    if (k === 'Enter' && (!document.activeElement || document.activeElement === document.body)) { swallow(); openCurrent(); return; }
    if (['Tab', 'Enter', ' '].indexOf(k) < 0 && !(e.target && /input|textarea|select/i.test(e.target.tagName))) e.stopImmediatePropagation(); // tombol lain tidak bocor ke pembaca
    if (k === 'Tab') { // fokus terkurung di dalam jendela
      var f = Array.prototype.filter.call((pane || lnc.el).querySelectorAll('button:not([disabled]):not([tabindex="-1"]),input'), function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!(pane || lnc.el).contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function wireLauncher() {
    var el = $('#launcher'); if (!el) return;
    lnc.el = el;
    $('#lncOpen').addEventListener('click', function () { choose('open'); });
    $('#lncNew').addEventListener('click', function () { choose('new'); });
    $('#lncGo').addEventListener('click', openCurrent);
    $('#lncAdd').addEventListener('click', addBooks);
    $('#lncPdf').addEventListener('click', openPdfReader);
    $('#lncMove').addEventListener('click', openMove);
    $('#lncDel').addEventListener('click', deleteCurrent);
    $('#lncMoveGo').addEventListener('click', function () { doMove($('#lncMoveNew').value); });
    $('#lncMoveCancel').addEventListener('click', closeMove);
    $('#lncFolder').addEventListener('click', function () { if (NG && NG.openKitabFolder) NG.openKitabFolder(car.jenis); });
    $('#lncPrev').addEventListener('click', function () { step(-1); });
    $('#lncNext').addEventListener('click', function () { step(1); });
    $('#lncClose').addEventListener('click', closeLauncher);
    el.addEventListener('pointerdown', function (e) { if (e.target === el) closeLauncher(); }); // klik area buram = tutup, lembar tetap kosong
    var view = $('#lncStage'), x0 = null; // roda & geser berlaku di seluruh area rak (termasuk bagian kartu yang memudar)
    view.addEventListener('wheel', function (e) { // roda mouse / touchpad: satu langkah per gulir
      var dlt = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!dlt) return;
      e.preventDefault();
      var now = Date.now(); if (now - car.wheelAt < 260 || lnc.busy) return;
      car.wheelAt = now; step(dlt > 0 ? 1 : -1);
    }, { passive: false });
    view.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    view.addEventListener('pointerup', function (e) { // geser kiri / kanan
      if (x0 == null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50 && !lnc.busy) { car.swiped = true; setTimeout(function () { car.swiped = false; }, 80); step(dx < 0 ? 1 : -1); }
    });
    // tombol "Pilih Kitab" di bilah atas + Ctrl+K: kembali ke menu pilih kitab kapan saja (juga saat sedang membaca)
    var canBrowse = !!(window.NGAJI && NGAJI.listKitab && NGAJI.openKitab);
    var lib = $('#libBtn');
    if (lib) { lib.hidden = !canBrowse; lib.addEventListener('click', function () { openLauncher(); }); }
    if (canBrowse) {
      window.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== 'k') return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (lnc.open) closeLauncher(); else openLauncher();
      }, true);
    }
    if (window.NGAJI) NGAJI.openLauncher = openLauncher;
    if (window.NGAJI) NGAJI.closeLauncher = closeLauncher;
    // klik logo di bilah atas = buka lagi jendela ini kapan saja
    var brand = $('.brand');
    if (brand && window.NGAJI && NGAJI.openProject) {
      brand.style.cursor = 'pointer';
      brand.title = 'Mau ngaji apa hari ini?';
      brand.addEventListener('click', function () { openLauncher(); });
    }
  }

  /* =====================================================================
   *  Mulai
   * ===================================================================== */
  function start() {
    if (info.reveal) { // fly-in + tirai memudar dimulai LANGSUNG di frame pertama (tanpa menunggu font / jeda kosong)
      var root = document.documentElement, released = false;
      var release = function () {
        if (released) return; released = true;
        root.setAttribute('data-ready', '1');
        setTimeout(function () { root.removeAttribute('data-reveal'); root.removeAttribute('data-ready'); }, 2800); // setelah semua animasi fly-in selesai
      };
      release();
    }
    wireLauncher();
    var afterIntro = function () {
      var next = function () { if (info.launcher) setTimeout(openLauncher, 120); };
      // pertama kali setelah install: tutorial berpemandu dulu (tutorial.js), baru jendela pilih kitab
      if (info.tour && window.NGAJI && NGAJI.startTour) setTimeout(function () { NGAJI.startTour({ onEnd: next }); }, 180);
      else next();
      // pending toast dari proses utama (contoh: setelah simpan proyek saat muat ulang)
      if (info.pendingToast && window.NGAJI && NGAJI.toast) setTimeout(function () { NGAJI.toast(info.pendingToast); }, 300);
    };
    if (info.intro) runIntro(afterIntro); else afterIntro();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

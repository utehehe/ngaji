/*
 * Suara klik: diputar saat tombol / tab / kartu / kotak centang diklik atau diaktifkan dengan keyboard (Enter / Spasi).
 * Berkas suara: sounds/klik.wav. Dipicu saat pointerdown agar terasa seketika; klik dari keyboard (detail = 0) ditangani terpisah.
 * Web Audio dipakai supaya klik beruntun tidak saling menunggu dan tanpa jeda muat.
 */
(function () {
  'use strict';
  var SRC = 'sounds/klik.wav', VOLUME = 0.55;
  var SEL = 'button, a[href], select, summary, [role="button"], [role="tab"], [role="option"], [role="menuitem"], .lnc-cv, label.chk, ' +
    'input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"]';
  var ctx = null, buf = null, loading = false, bytes = null, lastAt = 0;

  // unduh berkas lebih awal (belum perlu AudioContext); dekode menunggu gestur pengguna pertama
  try {
    fetch(SRC).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (b) { bytes = b; }, function () { /* abaikan */ });
  } catch (e) { /* abaikan */ }

  function ready(then) {
    if (buf) { then(); return; }
    if (loading) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    loading = true;
    try {
      ctx = ctx || new AC({ latencyHint: 'interactive' });
      var go = function (b) {
        if (!b) { loading = false; return; }
        var done = function (decoded) { buf = decoded; loading = false; then(); };
        var fail = function () { loading = false; };
        var p = ctx.decodeAudioData(b.slice(0), done, fail);
        if (p && p.catch) p.catch(fail);
      };
      if (bytes) go(bytes);
      else fetch(SRC).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (b) { bytes = b; go(b); }, function () { loading = false; });
    } catch (e) { loading = false; }
  }

  function play() {
    if (window.NGAJI && typeof NGAJI.isClickSoundOn === 'function' && !NGAJI.isClickSoundOn()) return;
    var now = Date.now();
    if (now - lastAt < 40) return; // satu klik yang memicu dua peristiwa tidak berbunyi dua kali
    lastAt = now;
    ready(function () {
      try {
        if (ctx.state === 'suspended') ctx.resume();
        var s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = buf; g.gain.value = VOLUME;
        s.connect(g); g.connect(ctx.destination); s.start(0);
      } catch (e) { /* abaikan */ }
    });
  }

  function hit(e) {
    var t = e.target;
    if (!t || !t.closest) return false;
    if (t.closest('#intro')) return false; // animasi pembuka punya suara sendiri
    var el = t.closest(SEL);
    return !!(el && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || !hit(e)) return;
    play();
  }, true);
  document.addEventListener('click', function (e) { // detail 0 = diaktifkan dengan keyboard (Enter / Spasi)
    if (e.detail === 0 && hit(e)) play();
  }, true);
})();

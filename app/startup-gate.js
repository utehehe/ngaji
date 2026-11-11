/*
 * Gerbang pembuka — dimuat di <head> agar keputusan "tampilkan animasi pembuka atau tidak" jatuh
 * SEBELUM cat pertama (tanpa kedip antarmuka utama). Logika animasi, suara, dan jendela pilihan ada di startup.js.
 */
(function () {
  'use strict';
  var info = { intro: false, launcher: false, project: null, reveal: false, tour: false };
  try {
    var api = window.ngajiApi;
    if (window.__NGAJI_STARTUP_PRELOAD__) {
      // Tauri: proses utama menyisipkan keputusan ini langsung di <head> (tanpa IPC sinkron).
      info = window.__NGAJI_STARTUP_PRELOAD__ || info;
    } else if (api && typeof api.startup === 'function') {
      info = api.startup() || info; // jalur cadangan: API aplikasi menjawab "pemuatan pertama?" (tidak berulang saat muat ulang)
    } else {
      // dibuka di browser biasa: animasi sekali per sesi tab, tanpa jendela pilihan (tidak ada file proyek)
      if (!sessionStorage.getItem('ngaji.intro')) info.intro = true;
      try { if (localStorage.getItem('ngaji.tour.v1') !== '1') info.tour = true; } catch (e) { /* abaikan */ } // tutorial pertama kali: sekali per profil browser
    }
  } catch (e) { /* abaikan */ }
  try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) info.intro = info.reveal = false; } catch (e) { /* abaikan */ }
  try { // tema tersimpan dipasang sebelum cat pertama (tanpa kedip warna)
    var look = JSON.parse(localStorage.getItem('ngaji.look.v1') || 'null');
    if (look && look.settings && look.settings.theme) document.documentElement.setAttribute('data-theme', String(look.settings.theme));
  } catch (e) { /* abaikan */ }
  window.NGAJI_STARTUP = info;
  if (info.intro) document.documentElement.setAttribute('data-intro', '1');
  if (info.reveal) { document.documentElement.setAttribute('data-reveal', '1'); document.documentElement.setAttribute('data-ready', '1'); } // animasi fly-in langsung berjalan di cat pertama (tanpa jeda)
  // // tirai gelap (#reveal) memudar: kelanjutan animasi membuka kitab
})();

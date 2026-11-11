/* Tauri bridge shim — dimuat dari index.html.
   Menyediakan window.__TAURI__.invoke / event.listen lewat fetch SAME-ORIGIN ke protokol kustom aplikasi
   (/__invoke dan /__events). URL RELATIF dipakai sengaja: di Windows (WebView2) origin-nya
   http://ngaji.localhost, sedangkan di macOS/Linux ngaji://localhost — URL relatif benar di keduanya. */
(function () {
  'use strict';

  if (window.__TAURI__ && window.__TAURI__.invoke) return;

  var listeners = {};   // nama event -> daftar callback
  var polling = false;

  function poll() {
    fetch('/__events', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (events) {
        if (!Array.isArray(events)) return;
        events.forEach(function (ev) {
          (listeners[ev.event] || []).slice().forEach(function (cb) {
            try { cb({ event: ev.event, payload: ev.payload }); } catch (e) { console.error(e); } // bentuk event Tauri: tauri-api.js membaca e.payload
          });
        });
      })
      .catch(function () { /* abaikan; coba lagi di putaran berikutnya */ });
  }

  window.__TAURI__ = {
    // Data dikirim di BODY (POST, UTF-8) — bukan di URL — agar teks Arab utuh dan tidak kena batas panjang URL.
    invoke: function (cmd, args) {
      return fetch('/__invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ cmd: String(cmd), args: args || {} })
      }).then(function (r) { return r.json(); });
    },
    event: {
      listen: function (eventName, callback) {
        (listeners[eventName] = listeners[eventName] || []).push(callback);
        if (!polling) { polling = true; setInterval(poll, 400); }
        var unlisten = function () {
          var list = listeners[eventName] || [], i = list.indexOf(callback);
          if (i >= 0) list.splice(i, 1);
        };
        return unlisten;
      }
    }
  };
})();

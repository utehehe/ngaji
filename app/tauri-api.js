'use strict';
/* Tauri API shim — implements window.ngajiApi for the Ngaji frontend.
   Uses window.__TAURI__ injected by Tauri (withGlobalTauri: true). */

(function () {
  'use strict';

  function invoke(cmd, args) {
    if (!window.__TAURI__ || !window.__TAURI__.invoke) {
      return Promise.reject(new Error('Tauri API not available'));
    }
    return window.__TAURI__.invoke(cmd, args || {});
  }

  function listen(event, callback) {
    if (!window.__TAURI__ || !window.__TAURI__.event) {
      return function () {};
    }
    return window.__TAURI__.event.listen(event, function (e) {
      try { callback(e && e.payload); } catch (err) { console.error(err); }
    });
  }

  window.ngajiApi = {
    isTauri: true,
    customTitlebar: true,

    /* ---------------- data ---------------- */
    saveData: function (json) {
      return invoke('data_save', { json: String(json) });
    },
    saveDataSync: function (json) {
      invoke('data_save', { json: String(json) }).catch(function () {});
      return { ok: true };
    },
    resetData: function () {
      return invoke('data_reset');
    },

    /* ---------------- export data (.js) ---------------- */
    exportJs: function (json) {
      return invoke('js_export', { json: String(json) });
    },

    /* ---------------- native dialogs (WebView2 handles alert/confirm natively) ---------------- */
    alert: function (message) {
      window.alert(message == null ? '' : String(message));
      return true;
    },
    confirm: function (message) {
      return !!window.confirm(message == null ? '' : String(message));
    },

    /* ---------------- fonts ---------------- */
    listFonts: function () {
      return invoke('fonts_list');
    },
    addFonts: function () {
      return invoke('fonts_add');
    },

    /* ---------------- menu actions ---------------- */
    runAction: function (name) {
      return invoke('action_run', { name: String(name) });
    },

    /* ---------------- startup ---------------- */
    startup: function () {
      return (
        (window.__NGAJI_STARTUP_PRELOAD__ && window.__NGAJI_STARTUP_PRELOAD__) ||
        { intro: false, launcher: false, project: null }
      );
    },
    tourDone: function () {
      return invoke('tour_done');
    },

    /* ---------------- kitab library ---------------- */
    listKitab: function () {
      return invoke('kitab_list');
    },
    openKitab: function (id, hold) {
      return invoke('kitab_open', { id: String(id), hold: Number(hold) || 0 });
    },
    addKitab: function (jenis) {
      return invoke('kitab_add', { jenis: String(jenis || '') });
    },
    deleteKitab: function (id) {
      return invoke('kitab_delete', { id: String(id) });
    },
    moveKitab: function (id, jenis) {
      return invoke('kitab_move', { id: String(id), jenis: String(jenis || '') });
    },
    openKitabFolder: function (jenis) {
      return invoke('kitab_folder', { jenis: String(jenis || '') });
    },

    /* ---------------- events ---------------- */
    onToast: function (callback) {
      return listen('app:toast', function (m) { callback(String(m)); });
    },
    onMenu: function (callback) {
      return listen('menu:action', function (action) { callback(action); });
    },

    /* ---------------- titlebar (custom menu bar) ---------------- */
    titlebarInfo: function () {
      return invoke('titlebar_info');
    },
    menuItems: function (index) {
      return invoke('titlebar_menu', { idx: Number(index) || 0 });
    },
    invokeMenu: function (index, sub) {
      return invoke('titlebar_invoke', { idx: Number(index) || 0, sub: Number(sub) || 0 });
    },
    titlebarColors: function (bg, fg) {
      return invoke('titlebar_colors', { bg: String(bg), fg: String(fg) });
    },
    onZoom: function (callback) {
      return listen('app:zoom', function (z) {
        try { callback(Number(z) || 1); } catch (err) { console.error(err); }
      });
    },

    /* ---------------- window controls ---------------- */
    zoomIn: function () { return invoke('zoom_in'); },
    zoomOut: function () { return invoke('zoom_out'); },
    zoomReset: function () { return invoke('zoom_reset'); },
    toggleFullscreen: function () { return invoke('toggle_fullscreen'); },
    toggleDevTools: function () { return invoke('toggle_devtools'); },
    minimize: function () { return invoke('window_minimize'); },
    maximize: function () { return invoke('window_maximize'); },
    close: function () { return invoke('window_close'); },

    /* ---------------- flush ---------------- */
    flush: function () { return invoke('flush_now'); },
  };
})();

# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/).
Versi aplikasi saat ini: **1.0.0**. Rilis ini mencakup fitur mute suara klik, pembaruan tutorial, dan perubahan yang tercatat di bawah.

> **Catatan perubahan 2026-11-09 (perbaikan kelancaran):** perubahan di `state.rs`, `project.rs`, `kitab.rs`, `data.rs`, `protocol.rs`, `commands.rs`, dan `lib.rs` hanya diperiksa sintaksnya (rustfmt) — **belum dikompilasi dan belum diuji di WebView2**. Jalankan `cargo check` lalu `cargo tauri dev`, dan uji: buka beberapa kitab berturut-turut (dialog simpan tidak boleh muncul bila tidak ada perubahan isi), muat ulang (Ctrl+R) tanpa intro, dan font kustom.

> **Status verifikasi:** perubahan JavaScript sudah diuji di Chromium headless (origin ala Windows `http://ngaji.localhost`, backend Rust ditiru).
> Perubahan **Rust belum dikompilasi dan belum diuji di WebView2** — jalankan `cargo tauri dev` dan uji di Windows sebelum dirilis.

## [1.0.0] — 2026-11-11

### Dihapus
- Fitur **ekspor gambar (PNG / JPG)** dihapus seluruhnya: dialog ekspor, tombol ikon di bilah atas, tombol di menu Kaidah Nahwu, entri menu *Ekspor Gambar*, pintasan `Ctrl+P`, `app/export.js`, `app/export-doc.js`, `src-tauri/src/export.rs`, perintah `doc_export` / `doc_cancel`, rute `/__export/`, gaya CSS dialog, dan status ekspor di `state.rs`. Indeks menu Berkas di `commands.rs` dan `protocol.rs` disesuaikan. Ekspor data (.js / JSON) tidak berubah; `cdp.rs` tetap ada karena dipakai `flush_renderer`.
- Fitur **ekspor PDF** dihapus dari semua menu (menu Berkas, tombol bilah atas, dialog ekspor, tombol Kaidah Nahwu, pintasan `Ctrl+P`). Ekspor gambar PNG / JPG tetap ada dan kini memakai `Ctrl+P`. Pembaca PDF (membuka file PDF) tidak berubah. Perubahan Rust belum dikompilasi.

### Dihapus
- Seluruh sisa Electron: `main.js`, `preload.js`, folder `lib/` (`data-tools.js`, `doc-export.js`, `update-check.js`; padanannya sudah ada di `data.rs`, `export.rs`, `update.rs`).
- Skrip lama `jalankan.*` dan `buat-installer.*` yang memanggil Electron.
- Flag `isElectron`, cabang kode mati, dan komentar Electron di `app/*.js` dan `app/tauri-ui.css`.

### Diubah
- `NGAJI.openKitab` tidak lagi memicu dua kali flush ke renderer: `kitab::open_kitab` memakai `project::confirm_leave_after_flush` (renderer sudah menyimpan sebelum command dipanggil), menghindari satu putaran CDP.
- `StartupState` mendapat `take_for_page()` dan struct `StartupSnapshot` (`state.rs`).
- `jalankan.bat|sh` dan `buat-installer.bat|sh` kini memakai `cargo tauri dev|build` (cadangan: `npm run dev|build`).
- `README.md`: bagian menjalankan, installer, lokasi data, dan struktur proyek ditulis ulang untuk Tauri + Rust.
- Protokol kustom `ngaji://` kini **asinkron**, tiap permintaan diproses di thread sendiri (`lib.rs`).
- Perintah dikirim lewat **POST** (UTF-8) ke `/__invoke`; GET `?cmd=&args=` tetap diterima sebagai cadangan.
- `/startup-info.js` dibangun dengan `serde_json`, dengan field `intro`, `launcher`, `project`, `reveal`, `tour`, `pendingToast` (plus `hadOpen`, `deferred`).
- Menu *Keluar* menyimpan data dulu lalu memakai `app.exit(0)`.
- Label menu *Ekspor Gambar* tidak lagi menampilkan `Ctrl+Shift+P` (pintasan itu dipakai membuka PDF).
- `.gitignore` menambah `src-tauri/target`.

### Ditambahkan
- **Bilah judul mengikuti sistem operasi.** Windows memakai tombol caption 46×33 px (minimize / maximize-restore / close, hover close merah) di kanan; macOS memakai traffic lights 12 px di kiri, simbol muncul saat hover, dan meredup saat jendela tidak aktif. Tombol hijau macOS membuka **layar penuh native** (`toggle_fullscreen`), bukan zoom, dengan label dan ikon yang berganti mengikuti keadaan jendela.
- Kaidah Nahwu bab 6 (*Fi'il & Jazm/Nashab*) dilengkapi dari 10 menjadi 31 kaidah: pembagian fi'il, bina' madhi/amr, i'rab mudhari', af'al khamsah, nawashib, jawazim, adawat syarat, jawab syarat, af'al qulub, ta'liq/ilgha', lazim/muta'addi, af'al muqarabah, madh/dzamm, ta'ajjub, majhul, mu'tal, mudha'af, asma' af'al, nahi, dan latihan i'rab.
- Aksi menu yang sebelumnya tak berefek kini tersambung: Proyek Baru, Buka, Simpan, Simpan Sebagai, Impor Data, Ekspor JSON, Reset Data, Buka Folder Data / Font, Muat Ulang, Zoom (± / asli), Alat Pengembang, Periksa Pembaruan, Tentang.
- Menu *Edit*: Potong, Salin, Tempel, Pilih Semua.
- Pintasan keyboard: `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+O`, `Ctrl+N`, `Ctrl+K`, `Ctrl+P`, `Ctrl+E`, `Ctrl+I`, `Ctrl+R`, `Ctrl +` / `−` / `0`, `Ctrl+Shift+I`, `F11`.
  Dilewati bila sudah ditangani pihak lain (mis. pembaca PDF).
- Penghubung event: banyak callback per event dan `listen()` mengembalikan fungsi *unlisten*.

### Diperbaiki
- **Jeda ±2–4 detik antara memilih kitab dan teks berganti** (terlihat di rekaman layar; jeda sama untuk kitab kecil maupun besar, jadi bukan soal ukuran). Jalur `kitab_open` dirampingkan: cadangan data lama (`backup_content`) kini ditulis di thread terpisah, dan judul jendela diperbarui lewat `schedule_title_update` (async) alih-alih `update_title` yang membaca + mem-parse ulang data di jalur utama.
- **Diagnostik waktu pembukaan kitab.** Modul baru `perf.rs` mencatat waktu tiap langkah (`baca-file`, `parse`, `cek-perubahan`, `apply:cadangan`, `apply:font`, `apply:tulis-data`, `apply:config`, `selesai`) ke `perf.log` di folder data dan ke respons `kitab_open` (`timings`). `app-bridge.js` mencatat waktu flush dan panggilan ke console dan menampilkan toast "Buka kitab lambat…" bila total > 1,2 detik. Dipakai untuk menemukan langkah yang masih lambat; boleh dihapus setelah masalah selesai.
- **Dialog "Simpan perubahan pada …?" muncul setiap berpindah kitab, padahal tidak ada yang diubah.** Deteksi perubahan membandingkan SHA-1 teks `data.js` mentah dengan hash saat dibuka; renderer menyimpan ulang otomatis (pengaturan, posisi baca, field bawaan seperti `bold:false`, format ringkas/berindentasi) sehingga hash selalu berbeda. Kini yang dibandingkan adalah **isi kitab** (`content_hash` di `state.rs`): kunci diurutkan, nilai kosong dibuang, dan `settings` / `progress` / `dev` diabaikan. Dialog hanya muncul bila isi kitab benar-benar berubah. Berlaku juga untuk penanda "•" di judul jendela.
- **Membuka kitab dari jendela "Pilih Kitab" selalu memuat ulang seluruh jendela (macet, lalu intro muncul).** `open_kitab` mengirim `data` sebagai teks `window.NGAJI_DATA = …`, padahal `NGAJI.swapData()` membutuhkan objek → galat → `app-bridge.js` menjalankan `location.reload()`. Kini `data` berisi objek kitab, sehingga teks ditukar di tempat (hanya fade-out / fly-in teks). Respons juga memuat `restored` (font dipulihkan) yang dibaca `app-bridge.js`.
- **Animasi pembuka dan jendela "Pilih Kitab" berulang di setiap muat ulang** (Buka Proyek, Proyek Baru, Impor, Reset, Ctrl+R). `StartupState.done` / `had_open` tidak pernah di-set. Kini `StartupState::take_for_page()` menandai keduanya setelah pemuatan pertama; `reveal` dan toast tertunda hanya berlaku untuk satu muat ulang. Dipakai oleh `/startup-info.js`, `app_startup` (protokol), dan `app_startup` (command).
- **Daftar kitab lambat.** `read_kitab_summary` mem-parse penuh setiap file `.ngaji` dua kali setiap jendela pilihan dibuka. Kini file di-parse sekali (`data::parse_project_value`) dan ringkasannya di-cache per file (ukuran + waktu ubah) di `kitab.rs`.
- **UI tersendat saat dialog Tambah/Buka muncul, dan risiko kitab yang baru dibuka tertimpa isi lama.** Handler `WindowEvent::Focused(false)` membaca ulang lalu menulis balik `data.js` di thread UI setiap jendela kehilangan fokus. Dihapus (renderer sudah menyimpan lewat `data_save`); penyimpanan saat jendela ditutup tetap ada.
- **Font kustom tidak termuat.** URL font di-percent-encode penuh (`Amiri%2DRegular%2Ettf`) tetapi server protokol tidak men-decode-nya → 404. Kini path di-decode lewat `protocol::safe_rel()`.
- **Celah path traversal** pada `/user-fonts/…` dan fallback aset mode dev (`..`, path absolut, drive ditolak oleh `safe_rel()`).
- **Semua panggilan ke Rust gagal di Windows.** Shim mengubah `http://ngaji.localhost` menjadi `ngaji://…` yang tidak bisa di-`fetch`, sehingga menu bar dan tombol minimize / maximize / close tidak muncul (jendela tanpa dekorasi, tak bisa ditutup). Kini memakai URL relatif.
- **Teks Arab rusak saat disimpan.** `percent_decode` mengubah tiap byte menjadi karakter; kini dekode UTF-8 yang benar. Data juga tidak lagi lewat URL, jadi bebas batas panjang (diuji 400 KB).
- **`/startup-info.js` berisi sintaks salah** (`{{{{` pada `format!`) → `Unexpected token '{'`; animasi pembuka, jendela pilih kitab, dan buka file `.ngaji` lewat klik dua kali tidak berjalan benar.
- **Event dari Rust tidak pernah sampai ke JS** (menu, toast, progres ekspor, zoom): bentuknya tak cocok dengan `tauri-api.js` (`e.payload`). Kini `{ event, payload }`.
- **Penutupan jendela berulang tanpa henti:** `window.close()` di dalam handler `CloseRequested` dihapus.
- **UI membeku / deadlock** saat dialog native atau ekspor (WebView2/CDP) berjalan di main thread.
- Event `app:zoom` dikirim lewat `emit()` yang tak didengar JS; kini lewat antrean `emit_event`.
- Nilai `tour` terbalik (`tour = !tourDone`).

### Diketahui / belum diubah
- Ekspor PDF dan gambar hanya tersedia di **Windows** (WebView2).
- Alat Pengembang hanya aktif di build debug.
- Cek pembaruan nonaktif sampai kunci `"repository"` diisi di `config.json`.
- Perintah `#[tauri::command]` di `commands.rs` tidak dipakai frontend (semua lewat `/__invoke`); `commands.rs` hanya diperbaiki nilai `tour`-nya.

## [2.7.0] — basis
- Hasil porting Electron → Tauri 2 yang diterima: pembaca kitab interaktif (Pegon, dhomir → marju', nahwu), Mode Baca / Edit, file proyek `.ngaji`, pembaca PDF, ekspor PDF / gambar, Kaidah Nahwu, impor Word, dan pemeriksaan pembaruan.

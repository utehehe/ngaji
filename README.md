# Ngaji — Tauri + Rust (UI Noor Aurora)

Pembaca interaktif Ngaji (bab, sub bab, teks Arab berformat Word): kata Arab dengan tooltip Pegon, garis dhomir → marju', catatan kalimat,
panel kata yang di-hover (Pegon + dhomir + marju'), Mode Baca & Mode Edit. **Seluruh data disimpan sebagai file JavaScript (`.js`), bukan di HTML.**

## Menjalankan

Aplikasi ini **Tauri 2 + Rust**: logika (penyimpanan, file proyek, dialog, font, ekspor data, pembaruan) ada di `src-tauri/src/*.rs`,
antarmukanya HTML/JS statis di `app/`. Tidak ada Electron dan tidak ada proses Node saat aplikasi berjalan.

Prasyarat:
- [Rust](https://rustup.rs) (stable, minimal 1.77.2).
- **Windows:** *Microsoft C++ Build Tools* (beban kerja "Desktop development with C++") dan WebView2 (sudah ada di Windows 10/11 terbaru).
- **Linux:** paket pengembangan WebKitGTK sesuai [panduan Tauri](https://v2.tauri.app/start/prerequisites/#linux).
- Tauri CLI, salah satu: `cargo install tauri-cli --version "^2"` (murni Rust), atau Node.js 18+ (CLI diambil dari `package.json`).

Menjalankan mode pengembangan:
- Windows: klik dua kali `jalankan.bat`
- macOS / Linux: `./jalankan.sh`
- Manual: `cargo tauri dev` (atau `npm install` lalu `npm run dev`)

Tes Rust: `cargo test --manifest-path src-tauri/Cargo.toml`.

## Membuat installer / setup

Installer **dibuat di sistem operasi tujuannya** (aturan Tauri; installer macOS hanya bisa dibuat di Mac).
Klik dua kali `buat-installer.bat` (Windows) atau jalankan `./buat-installer.sh` (macOS / Linux). Manual: `cargo tauri build` (atau `npm run build`).
Hasil ada di `src-tauri/target/release/bundle/` — Windows: `.msi` dan `.exe` (NSIS); macOS: `.app` dan `.dmg`; Linux: `.deb`, `.rpm`, dan `.AppImage`.
Folder `kitab/` ikut terbungkus sebagai sumber daya aplikasi, dan file `.ngaji` / `.safinah` didaftarkan agar bisa dibuka dengan klik dua kali.

Catatan:
- Ikon ada di `src-tauri/icons/` dan `app/icon.png`. Untuk membuat ulang dari satu gambar: `cargo tauri icon app/icon.png` (PNG persegi 1024×1024 disarankan).
- Aplikasi **belum ditandatangani** (code signing). Windows SmartScreen bisa menampilkan peringatan → *Info lebih lanjut → Tetap jalankan*.
  Di macOS: klik kanan aplikasi → *Buka* (pertama kali), atau `xattr -cr /Applications/Ngaji.app`.
  Linux AppImage: `chmod +x Ngaji-*.AppImage` lalu jalankan.
- Nama, versi, dan identifier aplikasi ada di `src-tauri/tauri.conf.json` dan `src-tauri/Cargo.toml`; naikkan nomor versi di keduanya (dan `package.json`) bersamaan.
- Versi dependensi Rust dikunci oleh `src-tauri/Cargo.lock`; commit file itu.
- Data pengguna tetap di folder data aplikasi masing-masing sistem (lihat *Lokasi data*), sehingga tidak hilang saat memperbarui / menghapus aplikasi.

## Tutorial pertama kali

Saat aplikasi dibuka pertama kali setelah di-install, tutorial berpemandu (12 langkah, sorotan pada tombol asli) tampil setelah animasi logo dan sebelum jendela *Mau Ngaji Apa Hari Ini?*. Langkahnya mencakup rak kitab, Kaidah Nahwu, pembaca PDF, simpan/buka proyek, daftar isi, area baca, catatan kalimat, mode baca/edit, navigasi dan progres, pengaturan (termasuk mute suara klik), serta tombol cepat. Pintasan: `→` / `Enter` lanjut, `←` kembali, `Esc` lewati.

- Status "sudah ditampilkan" disimpan di `config.json` (kunci `tourDone`) di folder data aplikasi; tutorial tidak muncul otomatis lagi setelah diselesaikan atau dilewati. Hapus kunci itu untuk menampilkannya lagi di pembukaan berikutnya.
- Bisa diulang kapan saja lewat *Bantuan → Tutorial Penggunaan*.
- Isi langkah ada di `app/tutorial.js` (daftar `STEPS`); terjemahan English / Arab di `app/i18n.js`. Setiap teks langkah sebaiknya punya terjemahan di sana.

## Pembaca PDF

Tombol **PDF** di bilah atas, tombol **Buka PDF** di jendela pilih kitab (pintasan `4`), atau `Ctrl+Shift+P`; file PDF juga bisa diseret ke jendela.

- **Arah baca otomatis:** teks PDF dideteksi. Latin -> LTR, Arab/Ibrani -> RTL. Bisa dipaksa lewat tombol *Arah* (Otomatis / LTR / RTL). Arah memengaruhi bilah alat, tombol halaman, fungsi panah ← →, dan urutan halaman pada tampilan dua halaman. PDF hasil scan (tanpa lapisan teks) memakai LTR.
- **Warna latar:** Asli, Invert, Krem, Sepia, Hijau, Abu, Gelap, Hitam, atau warna pilihan sendiri. Latar terang mempertahankan warna gambar; latar gelap membuat halaman dua warna.
- **Tab:** beberapa PDF bisa dibuka sekaligus (pilih banyak file atau seret beberapa file). Tombol **+** / *Buka PDF* menambah tab baru, × atau klik tengah menutup, `Ctrl+W` tutup tab, `Ctrl+Tab` pindah tab. Tiap tab mengingat halaman, zoom, dan arah bacanya sendiri; membuka file yang sama lagi hanya berpindah ke tabnya.
- Zoom, lebar halaman, dua halaman berdampingan, lompat halaman, dan teks bisa diseleksi. Pengaturan diingat.
- Memakai PDF.js (Apache-2.0) di `app/vendor/pdfjs/`, berjalan offline.

## Pemeriksaan pembaruan

Aplikasi memeriksa **GitHub Releases** untuk versi yang lebih baru: otomatis (paling sering sekali sehari, tertunda beberapa detik setelah aplikasi terbuka) dan manual lewat *Bantuan → Periksa Pembaruan…*. Pemeriksaan otomatis bisa dimatikan di menu *Bantuan*. Aplikasi **hanya memberi tahu**: tombol *Unduh* membuka halaman rilis di browser; tidak ada yang diunduh atau dijalankan otomatis. Pilihan *Lewati versi ini* diingat.

Satu-satunya permintaan jaringan aplikasi: `GET https://api.github.com/repos/<pemilik>/<repo>/releases/latest` (tanpa data pengguna; hanya alamat IP dan `User-Agent: Ngaji/<versi>`).

Mengaktifkan:
1. Isi kunci `"repository"` di `config.json` (folder data aplikasi) dengan alamat repositori Anda, mis. `"https://github.com/pemilik/ngaji"`. Selama kosong, fitur ini nonaktif dan tidak menghubungi jaringan.
2. Rilis lewat GitHub Releases dengan tag `v*`. Nomor versi tag dibandingkan dengan versi di `Cargo.toml` (mis. `v2.8.0`). Rilis berstatus *draft* atau *pre-release* tidak dianggap sebagai pembaruan.


## Teks Arab berformat Word, sub bab, dan font Arabic Typesetting

**Mode Edit → tombol *Teks Word*** (atau *Dari Word…* di panel kalimat):

1. Di Microsoft Word, blok teks lalu `Ctrl+C`; di aplikasi klik kotak dialog dan `Ctrl+V`. Atau pilih / seret file `.docx`.
2. Pratinjau menampilkan hasilnya persis seperti formatnya: **judul rata tengah**, **justify (rata kiri-kanan)**, rata kanan/kiri, tebal.
3. Opsi *Semua yang rata tengah menjadi sub bab* (aktif bawaan): setiap paragraf rata tengah otomatis dibuat sub bab dan muncul di Daftar Isi.
   Opsi *Heading 1 menjadi bab baru* memecah dokumen menjadi beberapa bab. Heading 2 dst. menjadi **sub bab**.
4. Klik *Tambahkan* — masuk di akhir bab, atau setelah kalimat yang sedang dipilih.

Pemetaan format: `Heading 1 / Title` → blok *Judul*; `Heading 2…` → *Sub bab*; perataan `center`/`both`/`left`/`right` → tengah/justify/kiri/kanan
(untuk paragraf RTL, `left` di Word = awal baris = kanan, sudah diperhitungkan). Gambar, tabel, dan ukuran font tidak ikut.

**Sub bab**: setiap bab punya daftar sub bab di *Daftar Isi* (bertingkat di bawah bab). Di Mode Edit: tombol *+ Sub bab*
(disisipkan di atas kalimat terpilih, atau di akhir bab), ketik untuk mengubah teksnya (Enter), tombol hapus, dan klik panah untuk melompat ke sub bab.
**Kamus kata (saran Pegon otomatis):** kata yang pernah diberi Pegon otomatis disarankan saat kata yang sama muncul lagi, di bab mana pun.
- *Mode Edit → klik sebuah kata*: di bawah kolom *Makna Pegon* muncul **Saran dari Kamus** (urut dari yang paling sering dipakai, `×n` = jumlah pemakaian). Klik saran untuk memakainya, atau tekan **Enter** di kolom Pegon yang masih kosong untuk memakai saran pertama.
- Kecocokan **persis** = teks Arab inti sama (dengan harakat; tanda baca di pangkal/ujung diabaikan). Kecocokan **mirip** (kotak putus-putus, dengan bentuk Arabnya) = huruf sama tetapi harakat atau bentuk alif/ya berbeda.
- Bila kata sudah berPegon dan masih ada kata yang sama yang kosong, tombol *Isi n kata sama yang masih kosong* mengisinya sekaligus di semua bab.
- Tombol **Kamus** di dock (Mode Edit) membuka daftar seluruh kata berPegon (cari dengan huruf Arab atau Pegon), tombol *Isi n kosong* per kata, dan *Isi n kata kosong dari Kamus* untuk seluruh buku (memakai makna terbanyak; ada konfirmasi).
- Kamus tidak disimpan terpisah: ia dibaca langsung dari seluruh kata yang sudah berPegon, jadi selalu mutakhir dan tidak menambah apa pun ke file data.
**Penanda “sudah dikaji” & lanjutkan membaca:** setiap bab dan sub bab bisa ditandai selesai dikaji.
- *Daftar Isi* (Mode Baca): kotak centang di kanan tiap bab dan sub bab. Menandai bab = menandai semua sub babnya; bab dianggap selesai bila semua sub babnya selesai (kotak setengah terisi = sebagian). Tiap bab menampilkan bilah dan hitungan `n/m dikaji`; di atas daftar ada kartu *Progres kajian* (persen + jumlah bab selesai) dan tombol *Reset progres*.
- Di bawah bacaan (Mode Baca): tombol *Tandai sudah dikaji* dan *Tandai & lanjut* (menandai lalu membuka sub bab / bab berikutnya). Tombol centang di dock melakukan hal yang sama tanpa perlu menggulir ke bawah.
- *Lanjutkan dari terakhir dibaca*: tombol di kartu progres (Daftar Isi) dan ikon penanda buku di dock. Posisi terakhir (bab + sub bab) dicatat otomatis saat berpindah atau menggulir di Mode Baca, dan tetap tersimpan setelah aplikasi ditutup.
- Data disimpan di kunci `progress` pada file data (`{ done: { <id sub bab | id bab>: true }, last: { p, s } }`), sehingga ikut file proyek `.ngaji` dan ekspor `.js`. Rujukan ke bab / sub bab yang sudah dihapus dibuang otomatis saat menyimpan.
**Tanda baca tidak ikut di-hover:** koma, titik, tanda kutip, kurung, dan sejenisnya di pangkal/ujung kata berada di luar kotak hover. Token yang hanya berisi tanda baca (misalnya « atau -) tidak bisa di-hover di Mode Baca. Panel kata di bawah juga hanya menampilkan hurufnya, tanpa tanda baca.
**Gaya hover:** di *Pengaturan → Efek hover → Gaya hover* ada 8 pilihan: Zoom (bawaan), Angkat melayang, Kaca cair (liquid), Garis menyapu, Kilau menyapu, Neon menyala, Miring 3D mengikuti kursor, dan Cahaya mengikuti kursor. Warna box mengikuti *Warna box & glow*; skala hover memengaruhi gaya Zoom, Angkat, Kaca, Kilau, dan Miring.
**Liquid glass:** *Pengaturan → Liquid glass (semua panel)* (nonaktif secara bawaan). Setelah dicentang, bar atas, dock, Daftar Isi, panel catatan, Pengaturan, panel hover, tooltip, dialog, dan panel Developer memakai kaca cair. Yang bisa diatur: kepekatan (transparansi), blur, saturasi, kilau permukaan, kilau tepi, pembiasan (distorsi latar), dan warna tint. Efek pembiasan memakai `backdrop-filter: url()` yang didukung Chromium (WebView2).
**Warna teks tertentu (Mode Edit):** pilih kalimat lalu pakai *Warna teks paragraf ini*; klik sebuah kata untuk *Warna teks kata ini*; pada kalimat pilihan manual tersedia *Warna teks kalimat pilihan*. Prioritas: kata › kalimat pilihan › paragraf. Tombol *Bawaan* mengembalikan warna. Disimpan di data sebagai `color` (kata/paragraf) dan `warna` (kalimat pilihan), dan ikut tampil di panel kata di bawah.
**Gaya penghubung dhomir → marju':** di *Pengaturan → Dhomir & Marju'* pilih *Gaya penghubung*: Garis (bawaan), Putus-putus mengalir, Komet bercahaya (kepala putih dengan ekor memudar), Panah (ujung berdenyut), Titik-titik berjalan, Neon berdenyut, atau Pelangi berputar. *Tebal penghubung* mengatur ketebalannya. Animasi otomatis berhenti berulang bila sistem memakai pengaturan *reduce motion*.
**Garis rujuk di bawah kata:** bila kata yang di-hover punya tooltip Pegon, garis dhomir → marju' otomatis melengkung ke **bawah** kata (tidak menembus tooltip). Atur di *Pengaturan → Dhomir & Marju' → Posisi garis rujuk* (Otomatis / Selalu di bawah / Selalu di atas). Gaya Panah ikut membalik arah ujungnya.
**Animasi gerak saat hover:** di *Pengaturan → Efek hover → Animasi gerak teks* ada 5 gerakan yang berulang selama kursor di atas kata: Melayang napas (bawaan), Ayun bandul, Denyut jantung, Orbit mungil, dan Lompat membal; *Kecepatan animasi gerak* mengatur tempo. Animasi ini bertumpuk dengan gaya hover mana pun, hanya aktif di Mode Baca, dan mengikuti *reduce motion* sistem.
**Efek suara dhomir:** kata yang punya dhomir (marju' terhubung) berbunyi saat di-hover di Mode Baca. Suara disintesis langsung (tanpa file audio) dengan nada pentatonik acak agar selalu enak didengar. Pilih jenis (Lonceng kristal, Gelembung, Harpa petik, Tetes air), volume, atau matikan di *Pengaturan → Dhomir & Marju'*.
**Liquid glass ala iOS:** efek diperbarui menjadi kaca bening dengan kilau spekular diagonal, tepi bercahaya (terang di kiri-atas, redup di kanan-bawah), cahaya dalam, bayangan berlapis, dan pembiasan tepi seperti lensa (tepi menekuk, tengah jernih). Semua pengaturan liquid glass yang lama tetap berlaku.
**Blur latar transparan (semua panel):** *Pengaturan → Blur latar panel (transparan)*: nyalakan, lalu atur kekuatan blur dan kepekatan panel. Berlaku untuk bar atas, dock, Daftar Isi, catatan, Pengaturan, panel hover, tooltip, dialog, dan panel Developer, tanpa perlu mengaktifkan liquid glass.
**Tema:** selain Aurora, Gelap, Terang, Sepia, dan OLED, kini ada Samudra, Hutan zamrud, Senja, Sakura, Kopi, Nord, Violet malam, Grafit, Kerajaan, Mint, dan Langit (*Pengaturan → Tema*).

**Tema bergambar:** Masjid malam, Bukit pasir berbintang, Arabesque emas, serta lima tema baru berilustrasi SVG — **Ka'bah** (thawaf di Masjidil Haram), **Masjid Nabawi** (kubah hijau & payung), **Kubah Sakhrah** (kubah emas saat senja), **Lentera Ramadan**, dan **Mihrab zamrud**. Gambarnya ada di `app/themes/*.svg` (vektor, ringan, tajam di layar apa pun) dan diberi lapisan gelap tipis agar teks Arab tetap terbaca.
**Bahasa aplikasi:** *Pengaturan → Bahasa / Language*: Indonesia, English, العربية (isi panel menjadi kanan-ke-kiri). Kamus ada di `app/i18n.js` (baris `[Indonesia, English, Arab]`); teks baru tinggal ditambahkan di sana. Teks Arab/Pegon/catatan milik pengguna tidak pernah diterjemahkan. Panel Developer dan dialog bawaan sistem operasi tetap berbahasa Indonesia.
**Edit tampilan box hover & panel bawah (Pengaturan):** di *Efek hover* kamu bisa mengubah warna, transparansi, kelengkungan sudut, serta warna dan tebal garis tepi box yang muncul saat kata di-hover. Bagian baru *Panel kata di bawah (hover)* mengatur ukuran dan warna teks Arab dan Pegon, warna latar, kelengkungan sudut, dan ruang dalam box panel yang muncul di bawah layar.
**Expand / ciutkan bab di Daftar Isi:** setiap bab yang punya sub bab memiliki tombol panah (›) di sisi kirinya; klik untuk membuka atau menutup daftar sub bab dengan animasi halus. Bab yang sedang tampil otomatis terbuka saat kamu berpindah bab, dan status buka/tutup bab lain diingat selama aplikasi berjalan. Tombol *Buka semua / Tutup semua* di atas daftar membuka atau menutup semua bab sekaligus. Judul bab yang panjang dipotong maksimal 2 baris (judul lengkap muncul saat kursor diarahkan; di Mode Edit kolomnya otomatis memanjang ke bawah), sub bab dibatasi 2 baris, dan penunjuk bab di bar bawah dipotong dengan “…”.
**Membuka satu sub bab**: di Mode Baca, klik sub bab di Daftar Isi → hanya sub bab itu (sampai sub bab berikutnya) yang ditampilkan. Tombol ‹ › (atau panah keyboard) pindah ke sub bab sebelumnya/berikutnya, dan *Tampilkan seluruh bab* kembali ke bab utuh. Klik baris bab di Daftar Isi (Mode Baca) hanya menampilkan judul sub bab pertama bab itu (tanpa isinya); tombol › atau *Tampilkan seluruh bab* membuka isinya. Bab tanpa sub bab dan Mode Edit selalu menampilkan bab utuh.
**Kalimat pilihan manual (Mode Edit):** satu paragraf bisa berisi beberapa kalimat. Buka panel *Catatan kalimat*, tekan **Pilih kalimat manual**, lalu klik **kata pertama** dan **kata terakhir** kalimatnya (harus satu paragraf; urutan klik bebas). Rentang itu langsung punya kolom catatan sendiri, ditandai warna emas di teks, dan bisa dibuka lagi dengan mengklik kata di dalamnya (juga di Mode Baca). `Esc` membatalkan pemilihan. Disimpan di data sebagai `"rentang": [{ "id", "dari": id kata pertama, "sampai": id kata terakhir, "catatan" }]` pada paragraf terkait.

**Catatan di tengah layar:** di Mode Baca, klik kalimat/kata membuka catatan sebagai dialog di tengah, dengan seluruh latar di-blur. Nyalakan/matikan dan atur intensitas blur di *Pengaturan → Panel*. Klik area kosong (di luar teks), `Esc`, atau tombol ✕ untuk menutup dan melepas sorotan kuning; klik di luar teks juga melepas sorotan pada mode panel samping dan Mode Edit. Di Mode Edit panel tetap di samping agar teks tetap bisa diklik.

**Area baca penuh & menyesuaikan panel:** teks memakai seluruh lebar layar (margin samping diatur di *Pengaturan → Tipografi Arab → Margin samping area baca*). Saat Daftar Isi / panel catatan (kiri) atau Pengaturan (kanan) dibuka, area baca menyempit otomatis; kata-kata meluncur halus ke posisi barunya dan posisi bacaan dijaga. Di layar sempit (≤ 900 px) panel menimpa teks tanpa mendorongnya.

**Daftar isi menyorot otomatis:** bab yang sedang tampil dan sub bab yang sedang dibaca disorot di Daftar Isi. Saat satu sub bab dibuka, sub bab itu yang disorot; saat seluruh bab tampil, sorotan mengikuti sub bab yang sedang lewat di bagian atas layar ketika menggulir. Daftar isi ikut tergulir agar item aktif selalu terlihat.

**Teks dalam tanda kurung ( ):** teks di antara `(` dan `)` — juga yang melewati beberapa kata dalam satu paragraf — tampil dengan gaya sendiri.
Atur di *Pengaturan → Teks dalam tanda kurung ( )*: nyala/mati, warna, font, ukuran (× teks Arab), ketebalan (tipis … sangat tebal), miring, transparansi,
dan apakah tanda kurungnya ikut diberi gaya yang sama. Tanda kurung di pangkal / ujung kata ditampilkan di luar kotak kata,
sehingga **tidak ikut tersorot** saat hover (sorotan, glow, skala, dan huruf dhomir hanya mengenai hurufnya). Data tidak berubah: tanda kurung tetap bagian dari teks Arab kata.
Ketebalan tipis hanya terlihat bila font yang dipakai punya bobot tersebut.

**Penanda kedudukan nahwu (ala makna gandul pesantren):** huruf singkatan kedudukan kata — mis. **م** untuk mubtada', **خ** khobar, **ف** fa'il, **مف** maf'ul bih — ditulis kecil
di **atas kata, di awal (sebelum) teksnya**, seperti cara memaknai kitab di pesantren. Di Mode Edit: klik sebuah kata, lalu di panel *Catatan kalimat* pilih singkatan pada
*Kedudukan nahwu* (klik lagi untuk melepas). Tersedia 26 kedudukan (mubtada', khobar, fi'il, fa'il, naibul fa'il, maf'ul, hal, tamyiz, isim/khobar kana & inna, mudhaf/mudhaf ilaih,
na'at, ma'thuf, taukid, badal, jar majrur, syarat/jawab, munada, mustatsna) dan *Lainnya*; kolom *Tulisan penanda* mengganti singkatannya untuk kata itu saja (mis. bila pesantren Anda memakai singkatan lain).
Di Mode Baca, nama Arab kedudukan juga tampil di panel kata yang di-hover. Atur di *Pengaturan → Penanda kedudukan nahwu*: nyala/mati (berguna untuk latihan menebak), ukuran, warna, dan posisi (awal / tengah / akhir kata).
Data: bidang opsional pada kata — `nahwu` (kunci, mis. `"mubtada"`) dan `nahwuLabel` (tulisan penanda sendiri).

**Makna Pegon untuk beberapa kata sekaligus (Mode Edit):** klik sebuah kata, lalu di *Makna Pegon beberapa kata* tekan **Pilih beberapa kata**. Klik kata-kata yang dimaksud di teks (2 kata atau lebih; kata di antaranya otomatis ikut terpilih, klik lagi untuk melepas), tekan **Simpan**, lalu ketik maknanya. Di Mode Baca, hover pada salah satu kata menyorot seluruh frasa dan tooltip menampilkan makna gabungan (panel bawah juga menampilkannya di bagian *Frasa*); kata dalam frasa bergaris titik-titik emas. `Esc` membatalkan pemilihan; *Hapus makna gabungan* menghapusnya. Data: `"frasa": [{ "id", "dari": id kata pertama, "sampai": id kata terakhir, "pegon" }]` pada paragraf terkait.
**Minimize pilihan nahwu (Mode Edit):** tombol − / + di judul *Kedudukan nahwu* pada panel kata mengciutkan daftar singkatan (tersisa ringkasan pilihan saat ini + kolom tulisan penanda). Statusnya diingat.

**Urungkan / Ulangi (Mode Edit):** tombol panah melengkung di dock, menu *Edit*, atau `Ctrl+Z` (urungkan) dan `Ctrl+Y` / `Ctrl+Shift+Z` (ulangi); di macOS `⌘`. Mencakup semua perubahan isi buku: Pegon, nahwu, dhomir/marju', frasa Pegon, catatan, kalimat/kata, bab, impor Word, dan isi dari Kamus. Perubahan beruntun dalam jeda 0,5 detik (mis. mengetik satu kata) dihitung satu langkah; riwayat maksimal 80 langkah dan hilang saat aplikasi ditutup. Saat kursor ada di kolom teks, `Ctrl+Z` hanya mengurungkan ketikan di kolom itu. Pengaturan tampilan dan penanda *sudah dikaji* tidak ikut diurungkan.

**Scroll mulus di Mode Edit:** garis tepi kata kini solid (lebih murah digambar daripada putus-putus), blur kaca pada drawer / bar atas / dock dimatikan sementara selama menggulir (kembali sesaat setelah berhenti), tooltip / garis dhomir / panel hover tidak dihitung saat teks lewat di bawah kursor, pembaruan Daftar Isi dilewati bila panelnya tertutup, dan tiap paragraf diberi `contain: layout`. Bila masih terasa berat pada bab sangat besar, nyalakan *Mode Lite* (ikon petir).

**Sembunyikan harakat:** tombol *ـَ* di bar atas (atau *Pengaturan → Tipografi Arab → Sembunyikan harakat*) menyembunyikan fathah, kasrah, dhammah, tanwin, sukun, syaddah, dan tanda sejenis di seluruh teks Arab (bacaan, judul bab, panel hover). Hanya tampilan: data tetap berharakat, jadi bisa ditampilkan lagi kapan saja. Tanda dhomir per huruf tetap tepat. Untuk **menghapus permanen**: Mode Edit → pilih kalimat → *Hapus harakat permanen* (paragraf ini / satu bab / seluruh buku, dengan konfirmasi dan bisa diurungkan dengan Ctrl+Z). Catatan: Kamus mencocokkan kata dengan harakat, jadi setelah dihapus permanen kata yang sama tanpa harakat tetap dikenali sebagai "mirip".

**Mode Lite:** tombol petir (⚡) di bilah atas, atau *Pengaturan → Mode Lite*. Mematikan hal-hal yang berat bagi GPU: semua `backdrop-filter` (blur kaca, liquid glass, blur latar panel, blur latar catatan, hover *Kaca cair*), bayangan panel yang lebar, filter glow pada garis dhomir → marju', animasi latar aurora (latar tetap tampil, hanya diam), dan animasi penanda nahwu yang berulang selamanya (diganti muncul-sekali). Panel diberi latar lebih pekat sebagai pengganti kaca. Gerak yang berjalan di compositor tetap utuh — geser panel, kata meluncur saat area baca menyempit, hover, dan buka-tutup Daftar Isi — jadi tetap mulus. Pengaturan lain tidak diubah, sehingga mematikan Mode Lite mengembalikan tampilan penuh. Disimpan di data sebagai `settings.liteMode`.
**Panel Pengaturan:** semua grup tertutup (belum di-expand) saat aplikasi dibuka; grup yang Anda buka tetap terbuka selama aplikasi berjalan (tidak menutup sendiri saat mengubah pengaturan).

**Kinerja:** mengetik Pegon / Arab / catatan dan memilih kata hanya memperbarui bagian yang berubah (bukan seluruh halaman); pencarian kata memakai indeks; animasi latar aurora otomatis dijeda saat ada interaksi dan bisa dimatikan di *Pengaturan → Tema → Animasi latar aurora*; autosave menunggu 1,2 detik setelah berhenti mengetik.

Kalimat apa pun juga bisa diubah jenisnya (Teks / Judul / Sub bab), perataannya, tebal, dan urutannya (Naik/Turun) di panel *Catatan kalimat*.

Bidang baru pada kalimat di file data (semua opsional):

| Bidang | Nilai |
|---|---|
| `type` | `"text"` (bawaan), `"heading"` (judul), `"sub"` (sub bab) |
| `align` | `"right"` (bawaan), `"center"`, `"left"`, `"justify"` |
| `bold` | `true` / `false` |

**Memilih font tanpa internet** (*Pengaturan → Tipografi Arab*):
- *Font Arab*: daftar berisi font bawaan, font yang pernah Anda tambahkan, dan font sistem yang pernah dipilih.
- *Ketik nama font yang terpasang*: nama font apa pun di komputer (mis. Traditional Arabic, Sakkal Majalla, Arabic Typesetting); saran daftar font muncul bila diizinkan sistem.
- *Tambah file font…*: pilih file `.ttf/.otf/.woff/.woff2`; disalin ke folder font aplikasi, nama font dibaca otomatis dari isi file, lalu langsung bisa dipilih — tetap ada saat offline.
Nama font disimpan di file data; di komputer lain yang tidak punya font itu, tampilan jatuh ke Amiri.

**Font Arabic Typesetting**: tersedia di *Pengaturan → Tipografi Arab → Font Arab*. Font ini milik Microsoft (ikut Windows/Office),
jadi tidak disertakan; aplikasi memakainya langsung bila sudah terpasang di komputer. Bila tidak ada, otomatis jatuh ke Amiri.
Untuk dibawa ke komputer lain, salin `arabtype.ttf` ke folder font lokal sebagai `ArabicTypesetting.ttf` (Berkas → Buka Folder Font Lokal).
Glyph Arabic Typesetting kecil — naikkan *Ukuran font* sekitar 1,3× dibanding Amiri.

## File proyek (.ngaji) — simpan & buka dengan sempurna

Satu file `.ngaji` berisi **semuanya**: seluruh bab / kalimat / Pegon / dhomir / catatan, pengaturan tampilan, perubahan Developer Studio,
dan file font tambahan yang dipakai pengaturan (ikut terbungkus, jadi tampil sama persis di komputer lain). Tiap file berdiri sendiri,
jadi Anda bisa punya banyak proyek dan membuka yang mana pun kapan saja.

| Tombol (bilah atas) / menu | Fungsi |
|---|---|
| **Simpan** (`Ctrl+S`) | simpan ke file `.ngaji` yang sedang terbuka; bila belum punya file, muncul dialog lokasi |
| *Berkas → Simpan Proyek Sebagai…* (`Ctrl+Shift+S`) | simpan sebagai file `.ngaji` baru (salinan) |
| **Buka** (`Ctrl+O`) | buka file `.ngaji` (juga bisa membuka file data lama `.js` / `.json`) |
| **Proyek baru** (ikon dokumen+, `Ctrl+N`) | mulai proyek kosong |

- Nama file proyek tampil di judul jendela; tanda **•** berarti ada perubahan yang belum disimpan ke file.
- Sebelum Buka / Baru, bila ada perubahan belum tersimpan, aplikasi menanyakan *Simpan / Jangan Simpan / Batal*.
  Pilihan *Jangan Simpan* tetap aman: isi sebelumnya dicadangkan otomatis di folder `backups/`.
- Perubahan tetap **disimpan otomatis** ke salinan kerja (seperti sebelumnya); file `.ngaji` diperbarui saat Anda menekan Simpan.
- Klik dua kali file `.ngaji` (pada aplikasi hasil `cargo tauri build`) langsung membukanya.
- Font yang sudah ada di komputer tujuan tidak ditimpa. Font sistem (mis. Arabic Typesetting dari Windows/Office) tidak dibungkus —
  hanya file font yang Anda tambahkan lewat *Tambah file font…*.
- Format: JSON (`"format": "ngaji-project"`, `"version": 1`) dengan kunci `data` (isi sama seperti file data `.js`) dan `fonts` (base64).

## Pembuka aplikasi — animasi logo & "Mau Ngaji Apa Hari Ini?"

Setiap kali aplikasi dijalankan:

1. **Animasi logo** (± 4 detik): cahaya tema menyala, tiga goresan huruf N "ditulis" satu per satu, mata pena emas menancap, cahaya ilmu menyala, lalu tulisan NGAJI muncul —
   dengan **suara** (drone hangat, gesekan tinta + petikan oud tiap goresan, "tok" mata pena, marimba menanjak per huruf). Suara disintesis langsung di aplikasi
   (Web Audio), tanpa file audio. Klik / `Esc` / `Spasi` untuk melewati; ikon speaker di pojok kanan bawah untuk membisukan (diingat).
2. **Jendela "Mau Ngaji Apa Hari Ini?"** (latar di-blur): kitab bawaan berjajar menyamping seperti memilih game di Steam — kartu terpilih di
   tengah (lebih besar, menyala) dengan nama kitab di bawahnya. Pindah dengan tombol panah, `←` / `→`, roda mouse, atau geser; buka dengan
   **Mulai Ngaji** / `Enter` / klik kartu. Di bawahnya ada **Buka Kitab** (file proyek `.ngaji`, tombol `1`) dan **File Kosong** (proyek baru, tombol `2`).
   `Esc` / klik area buram menutup jendela dan lembar tetap kosong. Bila dialog Buka / tanya-simpan dibatalkan, jendela ini tetap terbuka.
   Animasi membuka kitab: kartu membesar lalu memudar, kartu lain menyingkir, latar menggelap; setelah halaman dimuat ulang, tirai gelap memudar
   menampilkan kitabnya (mengikuti pengaturan *kurangi gerakan*).
- **Kitab Bawaan**: file `.ngaji` yang ditaruh di folder `kitab/` tampil sebagai kartu sampul di rak ini (warna sampul tetap per judul).
  Dibuka sebagai *salinan* — "Simpan" menanyakan lokasi baru, jadi file bawaan tidak pernah tertimpa. Folder ini ikut dibundel ke installer
  (`extraResources`, menjadi `resources/kitab`); setelah menambah / mengganti file, buat installer ulang. Lihat `kitab/BACA-SAYA.txt`.
- **Aplikasi selalu dimulai dengan lembar kosong** — tidak ada teks yang otomatis termuat; kitab hanya dipilih lewat jendela ini.
  Isi sesi sebelumnya yang belum disimpan tetap dicadangkan otomatis (Berkas → Buka Folder Data → backups).
  Klik **logo** di bilah atas untuk membuka jendela pilihan lagi kapan saja.
- Keduanya hanya tampil pada pemuatan pertama; Buka / Baru / Atur ulang tidak mengulanginya. Membuka aplikasi dengan klik dua kali file `.ngaji`
  langsung membuka proyek itu tanpa jendela pilihan.
- Mengikuti pengaturan sistem *kurangi gerakan* (animasi dilewati). Mode Lite mematikan blur latar jendela pilihan.
- Berkas: `app/startup-gate.js` (keputusan sebelum cat pertama), `app/startup.js` (animasi, suara, jendela pilihan), gaya di akhir `app/styles.css`.
- Logo: huruf N dari mata pena. **Di dalam aplikasi** (bilah atas, jendela pilihan kitab, sampul, animasi pembuka) hanya goresannya saja — tanpa lencana / garis kotak / bayangan — dan warnanya mengikuti tema (emas = `--gold`, tinta = turunan `--bg`; lihat `#lgPen` & `--logo-ink` di akhir `app/styles.css`). Goresan tertanam di `app/index.html` sebagai `pen-A…pen-D` agar bisa dianimasikan. **Ikon aplikasi** (`build/icon.*`, `app/icon.png`) memakai logo asli berwarna lengkap dengan lencana krem; sumber vektornya `app/logo.svg`.

## Data dalam file .js

Data bawaan: `app/data/ngaji-data.js`

```js
window.NGAJI_DATA = {
  "title": "Ngaji",
  "settings": { },            // pengaturan tampilan (tema, font, warna, dst.)
  "pages": [
    { "id": "p1", "title": "Rukun Islam",
      "sentences": [
        { "id": "p1-s1",
          "words": [ { "id": "p1-s1-w1", "arab": "أَرْكَانُ", "pegon": "رُكُنْ", "dhomir_target_id": null } ],
          "keterangan_kalimat": { "catatan": "" } }
      ] }
  ]
};
```

Setiap kata punya bidang dhomir:

| Bidang | Arti |
|---|---|
| `dhomir_target_ids` | daftar id kata marju' — **boleh lebih dari satu kata** (mis. `["p1-s3-w1", "p1-s3-w2"]`) |
| `dhomir_target_id` | kata marju' pertama (dipertahankan agar data lama / program lain tetap cocok; abaikan saat mengedit manual, ubah `dhomir_target_ids`) |
| `dhomir_letters` | nomor urut huruf (mulai 0, harakat menempel pada hurufnya) yang menjadi dhomir di dalam kata, mis. `[1, 2]` = huruf ke-2 dan ke-3. Kosong `[]` = seluruh kata |

Di **Mode Edit**: klik sebuah kata → di panel pilih *Huruf dhomir* (klik satu atau beberapa huruf) dan centang kata-kata *Marju'*.
Saat kursor di atas kata, garis digambar dari huruf dhomir (atau dari kata bila tidak ada huruf yang ditandai) ke setiap marju'.
Data lama dengan `dhomir_target_id` tunggal otomatis terbaca dan dikonversi saat disimpan.

Boleh diedit manual dengan editor teks (kunci tanpa kutip dan koma akhir juga terbaca saat impor).
Perubahan dari dalam aplikasi **disimpan otomatis** (±0,7 detik) ke `ngaji-data.js` di folder data pengguna,
sehingga file bawaan tidak tertimpa. Dari file itulah halaman memuat data pada run berikutnya.

| Aksi | Keterangan |
|---|---|
| Simpan Proyek (`Ctrl+S`) / Simpan Sebagai (`Ctrl+Shift+S`) | file proyek `.ngaji` (lihat bagian di atas) |
| Ekspor Data .js (`Ctrl+E`) | salinan sekali jalan ke lokasi pilihan |
| Impor Data (`Ctrl+I`) | baca file `.js` atau `.json` tanpa menanyakan simpan; data lama dicadangkan otomatis |
| Ekspor Data (JSON) | untuk dipakai di program lain |
| Reset Data ke Bawaan | kembali ke `app/data/ngaji-data.js` (data lama dicadangkan) |

Untuk menjadikan hasil edit sebagai data bawaan: ekspor `.js`, lalu timpa `app/data/ngaji-data.js`.

## Lokasi data

Menu *Berkas → Buka Folder Data*. Windows `%APPDATA%\id.ngaji.app` • macOS `~/Library/Application Support/id.ngaji.app` • Linux `~/.local/share/id.ngaji.app` (folder lama `ngaji` dipindahkan otomatis pada pembukaan pertama).

Isi: `ngaji-data.js` (data hasil edit), `backups/` (`data-*.js` cadangan otomatis, 30 terakhir; `embedded-*.js` = data bawaan, tidak pernah dihapus),
`config.json`, `fonts/` (font lokal).

## Fitur antarmuka

- **Panel kata yang di-hover (Mode Baca)**: kotak di bagian bawah menampilkan kata yang sedang di-hover (atau diketuk) beserta Pegon,
  bagian dhomir-nya, dan semua marju'-nya. Bisa dimatikan di Pengaturan → Panel.
- **Semua kolom ketik berarah RTL** (Arab, Pegon, catatan, judul halaman, kalimat baru).
- Fitur i'rab, syarah, dan warna harakat sudah dihapus. Data lama yang berisi `irab` / `syarah` tetap aman: isinya diabaikan dan
  dibuang saat disimpan berikutnya (salinan sebelum perubahan ada di folder `backups/`).

- Latar aurora, panel kaca buram, appbar melayang, dock bawah dengan pengalih **Mode Baca / Mode Edit**.
- Tema: aurora (bawaan), dark, light, sepia, oled — semua pengaturan ada di panel Pengaturan dan ikut tersimpan di file data.
- **Daftar Isi** (halaman): klik untuk lompat; di Mode Edit judul halaman bisa diganti dan halaman dihapus.
- Navigasi: tombol ‹ ›, atau panah kiri/kanan (RTL: kiri = maju). `Esc` menutup panel.
- Font Arab: Amiri, Noto Naskh Arabic, dan Scheherazade New sudah **dibundel** (lisensi SIL OFL, lihat `app/fonts/LICENSES.md`), jadi tampil benar tanpa internet dan tanpa menghubungi server mana pun. Font lain bisa ditambah lewat *Berkas → Buka Folder Font Lokal*.

## Developer Studio (ubah tampilan tanpa membuka kode)

Klik tombol **`</>`** di bilah atas (atau **Ctrl+Shift+D**) untuk membuka panel melayang. Panel bisa digeser lewat judulnya dan tidak mendorong area baca, jadi hasil perubahan langsung terlihat.

- **Tema** — warna tiap tema (latar, teks, aksen, emas, marju’, tooltip), lebar / radius / jarak panel samping, opasitas kaca, intensitas aurora, font antarmuka. Warna disimpan per tema.
- **Animasi** — durasi, gelombang tunda, dan kurva gerak teks saat panel muncul; kecepatan geser panel. Tombol *Coba animasi* membuka-menutup Daftar Isi untuk menguji.
- **Elemen** — tekan *Pilih elemen di layar*, klik bagian mana pun (kata, kalimat, tombol, panel…), lalu ubah warna, ukuran font, padding, radius, bayangan, blur, dan lainnya. Chip kelas (`.word`, `.btn`…) mempersempit/memperluas elemen yang terkena; tombol ↑ memilih induknya. Properti lain bisa ditambah manual.
- **CSS** — kotak CSS bebas, langsung berlaku.

Semua perubahan tersimpan otomatis di file data (kunci `dev`) dan ikut ter-ekspor. Saklar **Aktif** membandingkan dengan tampilan asli, **Salin sebagai CSS** menyalin hasilnya untuk ditempel ke `styles.css`, dan **Reset developer** mengembalikan semuanya ke bawaan.

## Struktur proyek

```
src-tauri/src/main.rs, lib.rs   titik masuk Tauri: jendela, protokol ngaji://, event
src-tauri/src/protocol.rs       melayani aset + jembatan perintah (/__invoke, /__events)
src-tauri/src/project.rs        file proyek .ngaji, simpan / buka / baru, muat ulang
src-tauri/src/data.rs           baca / tulis / validasi file data .js dan proyek, metadata font
src-tauri/src/state.rs          jalur data, konfigurasi, cadangan, status startup
src-tauri/src/kitab.rs          perpustakaan kitab (bawaan + milik pengguna)
src-tauri/src/cdp.rs            jembatan WebView2 (Windows) untuk menyimpan data sebelum muat ulang
src-tauri/src/fonts.rs          font lokal
src-tauri/src/update.rs         pemeriksaan pembaruan (GitHub Releases)
src-tauri/src/dialogs.rs        dialog native
src-tauri/tauri.conf.json       konfigurasi aplikasi / bundel
app/index.html           kerangka antarmuka
app/styles.css           tema Noor Aurora
app/renderer.js          logika pembaca & editor
app/tauri-inject.js      penghubung window.__TAURI__ (invoke / event) ke protokol ngaji://
app/tauri-api.js         window.ngajiApi: pembungkus perintah Rust untuk antarmuka
app/app-bridge.js        simpan otomatis, menu bar, pintasan, simpan/buka/baru proyek, ekspor .js
app/startup-gate.js      keputusan animasi pembuka (dimuat di <head>)
app/startup.js           animasi logo + suara + jendela "Mau Ngaji Apa Hari Ini?"
app/data/ngaji-data.js DATA (JavaScript)
```

## Kaidah Nahwu

Tombol **Nahwu** di bilah atas (atau tombol *Kaidah Nahwu* di jendela pilih kitab, `Ctrl+Shift+K`) membuka panel kaidah nahwu: 12 bab (±272 kaidah; Bab 1–6 dibahas sangat rinci: daftar lengkap huruf jar, huruf syamsiyah/qamariyah, tasrif fi'il, asmaul khamsah, seluruh 15 isim manshub, serta pembagian fi'il, nawashib, jawazim, af'al qulub, dan i'rab fi'il), dapat dicari, tiap kaidah bisa dibuka-tutup dengan contoh Arab. Isinya ada di `app/data/kaidah-nahwu-data.js` (format `[{t, a, r:[[judul, penjelasan, 'contoh · contoh']]}]`), boleh diedit atau ditambah.

**Highlight kata/huruf yang sedang dijelaskan**: pada tiap kaidah, istilah atau huruf yang dibahas ditandai kuning pada penjelasan, dan bagian yang dimaksud ditandai pada contoh Arab (misalnya huruf bertanwin pada kaidah Tanwin, *ال* pada kaidah Alif-Lam, huruf jar pada kaidah Huruf Jar, akhiran ta' fa'il). Kaidah yang membahas isim / fi'il / huruf memakai warna biru / oranye / hijau. Contoh yang diklik juga tampil ber-highlight di pop-up. Saat ini baru Bab 1; daftar yang di-highlight per kaidah ada di `app/data/kaidah-fokus-data.js` (cara mengisinya dijelaskan di bagian atas berkas itu) dan kode jenis kata per contoh di `app/data/kaidah-warna-data.js`, jadi bab lain bisa ditambah dengan cara yang sama. Bisa dimatikan lewat Pengaturan (ikon di kanan) → *Highlight*.

Catatan contoh: klik contoh Arab untuk membuka panel catatan di tengah layar (latar di-blur, seperti Catatan kalimat) berisi arti dan kaidahnya; aturannya ada di Pengaturan menu Nahwu → *Pop-up Catatan Contoh*. Arti ditulis di data dengan pemisah ` = ` (mis. `قَامَ زَيْدٌ = Zaid telah berdiri`); contoh tanpa arti tetap menampilkan nama kaidahnya.

/* =====================================================================
   Bahasa antarmuka: Indonesia (bawaan) · English · العربية
   Cara kerja: teks sumber di aplikasi tetap bahasa Indonesia. Modul ini menerjemahkan teks
   yang cocok persis dengan kamus (node teks + atribut title/placeholder/aria-label) dan
   memantau perubahan DOM, sehingga teks yang dibuat ulang oleh aplikasi ikut diterjemahkan.
   Teks Arab pada kata/kalimat/catatan milik pengguna tidak pernah diubah.
   Menambah bahasa/teks: tambahkan baris di ROWS  [Indonesia, English, Arab].
   ===================================================================== */
(function () {
  'use strict';

  const ROWS = [
    /* ---- bilah atas, dock, umum ---- */
    ['Tersimpan', 'Saved', 'تم الحفظ'],
    ['Menyimpan…', 'Saving…', 'جارٍ الحفظ…'],
    ['Buka', 'Open', 'فتح'],
    ['Simpan', 'Save', 'حفظ'],
    ['Ekspor JS', 'Export JS', 'تصدير JS'],
    ['Mode Baca', 'Read mode', 'وضع القراءة'],
    ['Mode Edit', 'Edit mode', 'وضع التحرير'],
    ['Bab', 'Chapter', 'باب'],
    ['Teks Word', 'Word text', 'نص Word'],
    ['Daftar Isi', 'Contents', 'الفهرس'],
    ['Daftar isi', 'Contents', 'الفهرس'],
    ['Catatan kalimat', 'Sentence notes', 'ملاحظات الجمل'],
    ['Pengaturan', 'Settings', 'الإعدادات'],
    ['Atur ulang', 'Reset', 'إعادة ضبط'],
    ['Reset semua data ke bawaan', 'Reset all data to default', 'إعادة كل البيانات إلى الافتراضي'],
    ['Tutup', 'Close', 'إغلاق'],
    ['Batal', 'Cancel', 'إلغاء'],
    ['Tambahkan', 'Add', 'إضافة'],
    ['Pilih kitab — kembali ke menu pilihan kitab (Ctrl+K)', 'Choose a book — back to the book menu (Ctrl+K)', 'اختيار كتاب — العودة إلى قائمة الكتب (Ctrl+K)'],
    ['Pilih Kitab', 'Choose Book', 'اختيار كتاب'],
    ['Tampilan Bersih — sembunyikan semua panel kecuali panel samping (Ctrl+Shift+H)', 'Clean view — hide all panels except the side panels (Ctrl+Shift+H)', 'عرض نظيف — إخفاء كل اللوحات عدا اللوحات الجانبية (Ctrl+Shift+H)'],
    ['Keluar dari Tampilan Bersih (Ctrl+Shift+H)', 'Exit clean view (Ctrl+Shift+H)', 'الخروج من العرض النظيف (Ctrl+Shift+H)'],
    ['Keluar dari Tampilan Bersih', 'Exit clean view', 'الخروج من العرض النظيف'],
    ['Tampilan Bersih', 'Clean View', 'عرض نظيف'],
    ['Tampilan bersih aktif — klik tombol di pojok kanan atas atau tekan Ctrl+Shift+H untuk kembali', 'Clean view on — click the button at the top right or press Ctrl+Shift+H to return', 'العرض النظيف مفعّل — انقر الزر في الأعلى يمينًا أو اضغط Ctrl+Shift+H للعودة'],
    ['Proyek baru (Ctrl+N)', 'New project (Ctrl+N)', 'مشروع جديد (Ctrl+N)'],
    ['Buka file proyek .ngaji (Ctrl+O)', 'Open a .ngaji project file (Ctrl+O)', 'فتح ملف مشروع .ngaji (Ctrl+O)'],
    ['Simpan proyek ke file .ngaji (Ctrl+S)', 'Save project to a .ngaji file (Ctrl+S)', 'حفظ المشروع في ملف .ngaji (Ctrl+S)'],
    ['Ekspor salinan data .js (Ctrl+E)', 'Export a copy of the data as .js (Ctrl+E)', 'تصدير نسخة من البيانات بصيغة .js (Ctrl+E)'],
    ['Developer — ubah tampilan langsung (Ctrl+Shift+D)', 'Developer — edit the look live (Ctrl+Shift+D)', 'المطوّر — تعديل المظهر مباشرة (Ctrl+Shift+D)'],
    ['Mode tampilan', 'View mode', 'وضع العرض'],
    ['Tambah halaman (bab)', 'Add a page (chapter)', 'إضافة صفحة (باب)'],
    ['Tambah teks Arab dengan format Word (tempel / .docx)', 'Add Arabic text with Word formatting (paste / .docx)', 'إضافة نص عربي بتنسيق Word (لصق / .docx)'],
    ['Kata yang di-hover', 'Hovered word', 'الكلمة المحدَّدة بالمؤشر'],

    /* ---- dialog impor Word ---- */
    ['Tambah teks Arab (format Word)', 'Add Arabic text (Word format)', 'إضافة نص عربي (تنسيق Word)'],
    ['Klik di sini lalu tempel (Ctrl+V) teks dari Word — atau seret file .docx ke sini', 'Click here and paste (Ctrl+V) text from Word — or drag a .docx file here', 'انقر هنا ثم الصق (Ctrl+V) نصًا من Word — أو اسحب ملف .docx إلى هنا'],
    ['Pilih file .docx…', 'Choose a .docx file…', 'اختيار ملف .docx…'],
    ['Lokasi penyisipan', 'Insert location', 'موضع الإدراج'],
    ['Di akhir bab ini', 'At the end of this chapter', 'في نهاية هذا الباب'],
    ['Setelah kalimat terpilih', 'After the selected sentence', 'بعد الجملة المحدَّدة'],
    ['Tidak ada teks yang terbaca.', 'No text could be read.', 'لم يتم العثور على أي نص.'],
    ['Hanya file .docx yang didukung.', 'Only .docx files are supported.', 'ملفات .docx فقط مدعومة.'],
    ['Bab baru', 'New chapter', 'باب جديد'],
    ['Heading 1', 'Heading 1', 'العنوان 1'],

    /* ---- Daftar Isi ---- */
    ['Tampilkan seluruh bab', 'Show the whole chapter', 'عرض الباب كاملًا'],
    ['Hanya menampilkan judul sub bab pertama', 'Showing only the first sub-chapter title', 'عرض عنوان أول باب فرعي فقط'],
    ['Hanya menampilkan satu sub bab', 'Showing only one sub-chapter', 'عرض باب فرعي واحد فقط'],
    ['Halaman ini belum berisi kalimat. Pindah ke Mode Edit untuk menambahkan.', 'This page has no sentences yet. Switch to Edit mode to add some.', 'هذه الصفحة لا تحتوي على جمل بعد. انتقل إلى وضع التحرير للإضافة.'],
    ['Tutup semua', 'Collapse all', 'طيّ الكل'],
    ['Buka semua', 'Expand all', 'فتح الكل'],
    ['Ciutkan sub bab', 'Collapse sub-chapters', 'طيّ الأبواب الفرعية'],
    ['Buka sub bab', 'Expand sub-chapters', 'فتح الأبواب الفرعية'],
    ['Sub bab', 'Sub-chapter', 'باب فرعي'],
    ['+ Sub bab', '+ Sub-chapter', '+ باب فرعي'],
    ['Judul bab (tekan Enter)', 'Chapter title (press Enter)', 'عنوان الباب (اضغط Enter)'],
    ['Hapus bab', 'Delete chapter', 'حذف الباب'],
    ['Teks sub bab (tekan Enter)', 'Sub-chapter text (press Enter)', 'نص الباب الفرعي (اضغط Enter)'],
    ['Hapus sub bab', 'Delete sub-chapter', 'حذف الباب الفرعي'],
    ['Sisipkan sub bab baru (di atas kalimat terpilih; bila tidak ada, di akhir bab)', 'Insert a new sub-chapter (above the selected sentence; otherwise at the end of the chapter)', 'إدراج باب فرعي جديد (فوق الجملة المحدَّدة، وإلا ففي نهاية الباب)'],
    ['Minimal harus ada satu bab.', 'There must be at least one chapter.', 'يجب أن يبقى باب واحد على الأقل.'],

    /* ---- penanda "sudah dikaji" & lanjutkan membaca ---- */
    ['Progres kajian', 'Study progress', 'تقدّم الدراسة'],
    ['Reset progres', 'Reset progress', 'إعادة ضبط التقدّم'],
    ['Hapus semua tanda sudah dikaji dan posisi terakhir dibaca', 'Clear all “studied” marks and the last-read position', 'مسح كل علامات «تمّت دراسته» وموضع آخر قراءة'],
    ['bab selesai', 'chapters done', 'أبواب مكتملة'],
    ['Lanjutkan dari terakhir dibaca', 'Continue where you left off', 'متابعة من آخر موضع قراءة'],
    ['Terakhir dibaca:', 'Last read:', 'آخر قراءة:'],
    ['Belum ada bacaan terakhir.', 'Nothing read yet.', 'لا توجد قراءة سابقة بعد.'],
    ['Tandai sudah dikaji', 'Mark as studied', 'تعليم كمدروس'],
    ['Sudah dikaji', 'Studied', 'تمّت دراسته'],
    ['Tandai & lanjut', 'Mark & continue', 'علّم وتابع'],
    ['Tandai bab ini sudah dikaji', 'Mark this chapter as studied', 'علّم هذا الباب كمدروس'],
    ['Tandai sub bab ini sudah dikaji', 'Mark this sub-chapter as studied', 'علّم هذا الباب الفرعي كمدروس'],
    ['Tandai bab ini lalu buka berikutnya', 'Mark this chapter, then open the next', 'علّم هذا الباب ثم افتح التالي'],
    ['Tandai sub bab ini lalu buka berikutnya', 'Mark this sub-chapter, then open the next', 'علّم هذا الباب الفرعي ثم افتح التالي'],
    ['Klik untuk membatalkan tanda sudah dikaji', 'Click to remove the “studied” mark', 'انقر لإلغاء علامة «تمّت دراسته»'],
    ['Ditandai sudah dikaji.', 'Marked as studied.', 'تم التعليم كمدروس.'],
    ['Tanda sudah dikaji dibatalkan.', '“Studied” mark removed.', 'أُلغيت علامة «تمّت دراسته».'],
    /* ---- Kamus kata ---- */
    ['Kamus', 'Dictionary', 'القاموس'],
    ['Kamus kata', 'Word dictionary', 'قاموس الكلمات'],
    ['Kamus kata — Pegon yang pernah diisi', 'Word dictionary — Pegon you have already entered', 'قاموس الكلمات — البيغون الذي أدخلته سابقًا'],
    ['Semua kata yang pernah diberi Pegon terkumpul di sini. Saat kata yang sama muncul lagi di bab mana pun, Pegon-nya disarankan di panel kata (Mode Edit).', 'Every word that has been given Pegon is collected here. When the same word appears again in any chapter, its Pegon is suggested in the word panel (Edit mode).', 'تُجمع هنا كل كلمة أُعطيت بيغون. وعند ظهور الكلمة نفسها في أي باب يُقترح بيغونها في لوحة الكلمة (وضع التحرير).'],
    ['Cari kata Arab atau Pegon…', 'Search Arabic or Pegon…', 'ابحث عن كلمة عربية أو بيغون…'],
    ['Saran dari Kamus', 'Suggestions from the dictionary', 'اقتراحات من القاموس'],
    ['Makna lain di Kamus', 'Other meanings in the dictionary', 'معانٍ أخرى في القاموس'],
    ['Buka Kamus', 'Open dictionary', 'فتح القاموس'],
    ['Lihat seluruh Kamus kata', 'View the whole word dictionary', 'عرض قاموس الكلمات كاملًا'],
    ['Klik untuk memakai makna ini', 'Click to use this meaning', 'انقر لاستخدام هذا المعنى'],
    ['Kata mirip (harakat berbeda) — klik untuk memakai', 'Similar word (different vowel marks) — click to use', 'كلمة مشابهة (تشكيل مختلف) — انقر للاستخدام'],
    ['Tekan Enter di kolom Pegon untuk memakai saran pertama.', 'Press Enter in the Pegon field to use the first suggestion.', 'اضغط Enter في حقل البيغون لاستخدام أول اقتراح.'],
    ['Kata ini belum ada di Kamus. Setelah Pegon diisi, ia otomatis disarankan di tempat lain.', 'This word is not in the dictionary yet. Once its Pegon is filled in, it is suggested elsewhere automatically.', 'هذه الكلمة ليست في القاموس بعد. بعد إدخال بيغونها ستُقترح تلقائيًا في مواضع أخرى.'],
    ['Isi kata ini yang masih kosong dengan makna terbanyak', 'Fill this word’s empty occurrences with the most common meaning', 'املأ مواضع هذه الكلمة الفارغة بأكثر المعاني شيوعًا'],
    ['Tidak ada kata kosong', 'No empty words', 'لا توجد كلمات فارغة'],
    ['Tidak ada yang cocok.', 'No matches.', 'لا توجد نتائج مطابقة.'],
    ['Kamus masih kosong. Isi Pegon pada kata di Mode Edit, lalu kata itu muncul di sini.', 'The dictionary is empty. Fill in Pegon on words in Edit mode and they will appear here.', 'القاموس فارغ. أدخل البيغون للكلمات في وضع التحرير لتظهر هنا.'],
    ['Semua bab sudah dikaji. Alhamdulillah!', 'Everything is studied. Alhamdulillah!', 'تمّت دراسة كل شيء. الحمد لله!'],

    /* ---- panel kata di bawah ---- */
    ["Arahkan kursor ke sebuah kata untuk melihat Pegon, dhomir, dan marju'-nya.", 'Point at a word to see its Pegon, dhomir and marju’.', 'مرّر المؤشر على كلمة لعرض البيغون والضمير ومرجعه.'],
    ['Dhomir', 'Dhomir (pronoun)', 'الضمير'],
    ["Marju'", 'Marju’ (referent)', 'المرجع'],

    /* ---- panel catatan kalimat ---- */
    ['Pilih kalimat manual', 'Select sentence manually', 'تحديد جملة يدويًا'],
    ['Makna Pegon beberapa kata', 'Pegon meaning for several words', 'معنى الجاوي لعدة كلمات'],
    ['(2 kata atau lebih, satu makna)', '(2 or more words, one meaning)', '(كلمتان أو أكثر بمعنى واحد)'],
    ['Pilih beberapa kata', 'Select several words', 'تحديد عدة كلمات'],
    ['Batal memilih', 'Cancel selecting', 'إلغاء التحديد'],
    ['Hapus makna gabungan', 'Delete combined meaning', 'حذف المعنى المشترك'],
    ['Makna Pegon untuk kata-kata ini', 'Pegon meaning for these words', 'معنى الجاوي لهذه الكلمات'],
    ['Ciutkan pilihan', 'Collapse choices', 'طيّ الخيارات'],
    ['Bentangkan pilihan', 'Expand choices', 'توسيع الخيارات'],
    ['belum dipilih', 'not selected', 'لم يُحدَّد'],
    ['Frasa', 'Phrase', 'عبارة'],
    ['Sembunyikan harakat (hanya tampilan, data tidak berubah)', 'Hide diacritics (display only, data unchanged)', 'إخفاء الحركات (للعرض فقط، البيانات لا تتغير)'],
    ['Sembunyikan / tampilkan harakat', 'Hide / show diacritics', 'إخفاء / إظهار الحركات'],
    ['Harakat disembunyikan.', 'Diacritics hidden.', 'تم إخفاء الحركات.'],
    ['Harakat ditampilkan.', 'Diacritics shown.', 'تم إظهار الحركات.'],
    ['Hapus harakat permanen', 'Remove diacritics permanently', 'حذف الحركات نهائيًا'],
    ['(dapat diurungkan dengan Ctrl+Z)', '(undo with Ctrl+Z)', '(يمكن التراجع بـ Ctrl+Z)'],
    ['Paragraf ini', 'This paragraph', 'هذه الفقرة'],
    ['Satu bab', 'This chapter', 'هذا الباب'],
    ['Seluruh buku', 'Whole book', 'الكتاب كله'],
    ['Urungkan (Ctrl+Z)', 'Undo (Ctrl+Z)', 'تراجع (Ctrl+Z)'],
    ['Ulangi (Ctrl+Y)', 'Redo (Ctrl+Y)', 'إعادة (Ctrl+Y)'],
    ['Diurungkan.', 'Undone.', 'تم التراجع.'],
    ['Diulangi.', 'Redone.', 'تمت الإعادة.'],
    ['Tidak ada yang bisa diurungkan.', 'Nothing to undo.', 'لا شيء للتراجع عنه.'],
    ['Tidak ada yang bisa diulangi.', 'Nothing to redo.', 'لا شيء لإعادته.'],
    ['Batal memilih', 'Cancel selection', 'إلغاء التحديد'],
    ["Pilih marju' dari teks", "Pick marju' from text", 'اختيار المرجع من النص'],
    ["Selesai memilih marju'", "Done picking marju'", 'تم اختيار المرجع'],
    ["Klik kata di teks untuk menambah / melepas marju'.", "Click words in the text to add / remove marju'.", 'انقر كلمات النص لإضافة / إزالة المرجع.'],
    ["Atau klik langsung kata di teks tengah.", 'Or click words in the text directly.', 'أو انقر الكلمات في النص مباشرة.'],
    ["Klik kata di teks untuk menjadikannya marju'. Klik lagi untuk melepas.", "Click a word in the text to make it a marju'. Click again to remove.", 'انقر كلمة في النص لجعلها مرجعًا. انقر مرة أخرى للإزالة.'],
    ['Klik kata pertama lalu kata terakhir untuk menentukan kalimat yang diberi catatan.', 'Click the first word, then the last word, to define the sentence that gets a note.', 'انقر الكلمة الأولى ثم الأخيرة لتحديد الجملة التي ستُضاف لها ملاحظة.'],
    ['Klik kata pertama kalimat, lalu klik kata terakhirnya.', 'Click the first word of the sentence, then its last word.', 'انقر الكلمة الأولى من الجملة ثم الكلمة الأخيرة.'],
    ['Kata terakhir harus satu paragraf dengan kata pertama — kata pertama dipindah ke sini.', 'The last word must be in the same paragraph as the first — the first word was moved here.', 'يجب أن تكون الكلمة الأخيرة في نفس فقرة الأولى — نُقلت الكلمة الأولى إلى هنا.'],
    ['Pilih kalimat untuk melihat catatannya.', 'Select a sentence to see its note.', 'اختر جملة لعرض ملاحظتها.'],
    ['Klik sebuah kalimat untuk melihat catatannya.', 'Click a sentence to see its note.', 'انقر على جملة لعرض ملاحظتها.'],
    ['Kalimat pilihan', 'Selected sentence', 'الجملة المحدَّدة'],
    ['Catatan', 'Note', 'ملاحظة'],
    ['Belum ada catatan untuk kalimat ini. Pindah ke Mode Edit untuk mengisi.', 'No note for this sentence yet. Switch to Edit mode to write one.', 'لا توجد ملاحظة لهذه الجملة بعد. انتقل إلى وضع التحرير لكتابتها.'],
    ['Belum ada catatan. Pindah ke Mode Edit untuk mengisi.', 'No note yet. Switch to Edit mode to write one.', 'لا توجد ملاحظة بعد. انتقل إلى وضع التحرير لكتابتها.'],
    ['Catatan kalimat pilihan', 'Note for the selected sentence', 'ملاحظة الجملة المحدَّدة'],
    ['Catatan paragraf', 'Paragraph note', 'ملاحظة الفقرة'],
    ['Lihat paragraf', 'View paragraph', 'عرض الفقرة'],
    ['Hapus pilihan', 'Delete selection', 'حذف التحديد'],
    ['Warna teks kalimat pilihan', 'Text color of the selected sentence', 'لون نص الجملة المحدَّدة'],
    ['Bawaan', 'Default', 'افتراضي'],
    ['Kalimat bercatatan di paragraf ini', 'Sentences with notes in this paragraph', 'الجمل ذات الملاحظات في هذه الفقرة'],
    ['Jenis blok', 'Block type', 'نوع الكتلة'],
    ['Teks', 'Text', 'نص'],
    ['Judul', 'Title', 'عنوان'],
    ['Perataan (seperti di Word)', 'Alignment (as in Word)', 'المحاذاة (كما في Word)'],
    ['Perataan bawaan', 'Default alignment', 'المحاذاة الافتراضية'],
    ['Rata kanan', 'Align right', 'محاذاة لليمين'],
    ['Rata tengah', 'Center', 'توسيط'],
    ['Rata kiri', 'Align left', 'محاذاة لليسار'],
    ['Rata kiri-kanan (Justify)', 'Justify', 'ضبط (Justify)'],
    ['Tengah', 'Center', 'وسط'],
    ['Kanan', 'Right', 'يمين'],
    ['Kiri', 'Left', 'يسار'],
    ['Justify', 'Justify', 'ضبط'],
    ['Tebal', 'Bold', 'غامق'],
    ['Naik', 'Up', 'أعلى'],
    ['Turun', 'Down', 'أسفل'],
    ['Geser ke atas', 'Move up', 'نقل لأعلى'],
    ['Geser ke bawah', 'Move down', 'نقل لأسفل'],
    ['Warna teks paragraf ini', 'Text color of this paragraph', 'لون نص هذه الفقرة'],
    ['Teks Arab kata', 'Arabic text of the word', 'النص العربي للكلمة'],
    ['Warna teks kata ini', 'Text color of this word', 'لون نص هذه الكلمة'],
    ['Makna Pegon', 'Pegon meaning', 'المعنى بالبيغون'],
    ['Kedudukan nahwu', 'Grammatical role (nahwu)', 'الموقع الإعرابي'],
    ['(tampil kecil di atas kata)', '(shown small above the word)', '(يظهر صغيرًا فوق الكلمة)'],
    ['Tulisan penanda (boleh diganti)', 'Marker text (can be changed)', 'نص العلامة (يمكن تغييره)'],
    ['Penanda kedudukan nahwu', 'Nahwu role markers', 'علامات الموقع الإعرابي'],
    ['Tampilkan penanda nahwu di atas kata', 'Show nahwu markers above words', 'إظهار علامات الإعراب فوق الكلمات'],
    ['Animasi penanda', 'Marker animation', 'حركة العلامة'],
    ['Muncul membal (sekali)', 'Bouncy pop-in (once)', 'ظهور نطّاط (مرة)'],
    ['Bergelombang (bergerak terus)', 'Waving (keeps moving)', 'متموج (حركة مستمرة)'],
    ['Melompat-lompat', 'Hopping', 'قفز متكرر'],
    ['Berputar melingkar', 'Circular orbit', 'دوران دائري'],
    ['Melayang pelan', 'Gentle float', 'طفو هادئ'],
    ['Denyut bercahaya', 'Glowing pulse', 'نبض متوهج'],
    ['Berkilau', 'Twinkle', 'تلألؤ'],
    ['Goyang bandul', 'Pendulum sway', 'تأرجح'],
    ['Warna berganti', 'Colour shift', 'تبدّل الألوان'],
    ['Menyala saat disorot', 'Lights up on hover', 'يتوهج عند التمرير'],
    ['Tanpa animasi', 'No animation', 'بلا حركة'],
    ['Ukuran penanda (× ukuran teks Arab)', 'Marker size (× Arabic text size)', 'حجم العلامة (× حجم النص العربي)'],
    ['Posisi vertikal penanda (+ naik, − turun)', 'Marker vertical position (+ up, − down)', 'الموضع العمودي للعلامة (+ أعلى، − أسفل)'],
    ['Posisi horizontal penanda (+ kanan, − kiri)', 'Marker horizontal position (+ right, − left)', 'الموضع الأفقي للعلامة (+ يمين، − يسار)'],
    ['Warna penanda', 'Marker color', 'لون العلامة'],
    ['Posisi penanda di atas kata', 'Marker position above the word', 'موضع العلامة فوق الكلمة'],
    ['Di awal kata (kanan, sebelum teks)', 'At the start of the word (right, before the text)', 'في أول الكلمة (اليمين، قبل النص)'],
    ['Di tengah kata', 'Centered over the word', 'في وسط الكلمة'],
    ['Di akhir kata (kiri)', 'At the end of the word (left)', 'في آخر الكلمة (اليسار)'],
    ['Huruf dhomir pada kata ini', 'Dhomir letters in this word', 'حروف الضمير في هذه الكلمة'],
    ['(klik huruf; kosong = seluruh kata)', '(click letters; empty = whole word)', '(انقر الحروف؛ فارغ = الكلمة كلها)'],
    ["Marju' — boleh lebih dari satu kata", 'Marju’ — may be more than one word', 'المرجع — يمكن أن يكون أكثر من كلمة'],
    ['(no. kalimat.no. kata)', '(sentence no. . word no.)', '(رقم الجملة.رقم الكلمة)'],
    ['Belum ada kata lain di halaman ini.', 'There are no other words on this page yet.', 'لا توجد كلمات أخرى في هذه الصفحة بعد.'],
    ['Hapus kata', 'Delete word', 'حذف الكلمة'],
    ['Klik sebuah kata untuk mengedit Pegon dan Dhomir.', 'Click a word to edit its Pegon and dhomir.', 'انقر على كلمة لتعديل البيغون والضمير.'],
    ['Hapus kalimat', 'Delete sentence', 'حذف الجملة'],
    ['Tambah kalimat baru (teks Arab, kata dipisah spasi)', 'Add a new sentence (Arabic text, words separated by spaces)', 'إضافة جملة جديدة (نص عربي، الكلمات مفصولة بمسافات)'],
    ['Tambah kalimat', 'Add sentence', 'إضافة جملة'],
    ['Dari Word…', 'From Word…', 'من Word…'],
    ['Catatan di tengah layar', 'Note at screen center', 'الملاحظة في وسط الشاشة'],

    /* ---- font & dialog ---- */
    ['Font lain — bekerja tanpa internet', 'Other fonts — works offline', 'خطوط أخرى — تعمل بدون إنترنت'],
    ['Ketik nama font yang terpasang di komputer…', 'Type the name of a font installed on this computer…', 'اكتب اسم خط مثبّت على هذا الحاسوب…'],
    ['Contoh: Traditional Arabic, Sakkal Majalla. Tekan Enter untuk memakai.', 'Examples: Traditional Arabic, Sakkal Majalla. Press Enter to use.', 'أمثلة: Traditional Arabic، Sakkal Majalla. اضغط Enter للاستخدام.'],
    ['Tambah file font (.ttf / .otf)…', 'Add font file (.ttf / .otf)…', 'إضافة ملف خط (.ttf / .otf)…'],
    ['Font tidak dapat ditambahkan.', 'The font could not be added.', 'تعذّرت إضافة الخط.'],
    ['Sama dengan font Arab', 'Same as Arabic font', 'مثل الخط العربي'],
    ['Ikut teks', 'Follow text', 'مثل النص'],

    /* ---- pesan umum / error ---- */
    ['Penyimpanan hanya tersedia di aplikasi desktop.', 'Saving is only available in the desktop app.', 'الحفظ متاح في تطبيق سطح المكتب فقط.'],
    ['Ekspor hanya tersedia di aplikasi desktop.', 'Export is only available in the desktop app.', 'التصدير متاح في تطبيق سطح المكتب فقط.'],
    ['Membuka proyek hanya tersedia di aplikasi desktop.', 'Opening projects is only available in the desktop app.', 'فتح المشاريع متاح في تطبيق سطح المكتب فقط.'],
    ['Proyek baru hanya tersedia di aplikasi desktop.', 'New projects are only available in the desktop app.', 'المشروع الجديد متاح في تطبيق سطح المكتب فقط.'],
    ['Reset hanya tersedia di aplikasi desktop.', 'Reset is only available in the desktop app.', 'إعادة الضبط متاحة في تطبيق سطح المكتب فقط.'],
    ['Menambah file font hanya tersedia di aplikasi desktop.', 'Adding font files is only available in the desktop app.', 'إضافة ملفات الخطوط متاحة في تطبيق سطح المكتب فقط.'],
    ['tidak diketahui', 'unknown', 'غير معروف'],
    ['Bukan file .docx (zip tidak valid).', 'Not a .docx file (invalid zip).', 'ليس ملف .docx (ملف zip غير صالح).'],
    ['Metode kompresi zip tidak didukung.', 'This zip compression method is not supported.', 'طريقة ضغط zip غير مدعومة.'],
    ['XML .docx rusak.', 'The .docx XML is corrupted.', 'ملف XML في .docx تالف.'],
    ['word/document.xml tidak ditemukan — bukan file .docx.', 'word/document.xml not found — not a .docx file.', 'لم يتم العثور على word/document.xml — ليس ملف .docx.'],
    ['Kembalikan semua halaman, kalimat, catatan, dan pengaturan ke data bawaan aplikasi? (Data saat ini dicadangkan otomatis.)',
      'Restore all pages, sentences, notes and settings to the app’s default data?\n\n(Your current data is backed up automatically.)',
      'هل تريد استعادة كل الصفحات والجمل والملاحظات والإعدادات إلى بيانات التطبيق الافتراضية؟\n\n(تُحفظ نسخة احتياطية من بياناتك الحالية تلقائيًا.)'],

    /* ---- Pengaturan: grup ---- */
    ['Bahasa / Language', 'Language / Bahasa', 'اللغة / Language'],
    ['Bahasa aplikasi', 'App language', 'لغة التطبيق'],
    ['Mode Lite', 'Lite mode', 'الوضع الخفيف'],
    ['Aktifkan Mode Lite (ringan, tetap mulus)', 'Enable Lite mode (lighter, still smooth)', 'تفعيل الوضع الخفيف (أخف وبسلاسة)'],
    ['Mematikan blur kaca, liquid glass, bayangan & cahaya berat, serta animasi tanpa henti di latar, penanda nahwu, dan garis dhomir. Gerak geser panel, luncur kata, dan hover tetap halus. Pengaturan Anda tidak diubah: matikan Mode Lite untuk kembali ke tampilan penuh.',
     'Turns off glass blur, liquid glass, heavy shadows & glows, and endless animations on the background, nahwu markers, and dhomir lines. Panel slides, word glide, and hover stay smooth. Your settings are not changed: turn Lite mode off to return to the full look.',
     'يوقف تمويه الزجاج والزجاج السائل والظلال والتوهجات الثقيلة والحركات المتكررة في الخلفية وعلامات النحو وخطوط الضمير. تبقى حركة اللوحات وانزلاق الكلمات والتمرير سلسة. إعداداتك لا تتغير: أوقف الوضع الخفيف للعودة إلى المظهر الكامل.'],
    ['Mode Lite aktif', 'Lite mode on', 'الوضع الخفيف مفعّل'],
    ['Mode Lite nonaktif', 'Lite mode off', 'الوضع الخفيف متوقف'],
    ['Mode Lite — lebih ringan, tetap mulus', 'Lite mode — lighter, still smooth', 'الوضع الخفيف — أخف وبسلاسة'],
    ['Tema', 'Theme', 'السمة'],
    ['Animasi latar aurora (matikan bila terasa berat)', 'Aurora background animation (turn off if it feels heavy)', 'حركة خلفية الشفق (أوقفها إن كانت ثقيلة)'],
    ['Tipografi Arab', 'Arabic typography', 'الخط العربي'],
    ['Teks dalam tanda kurung ( )', 'Text in parentheses ( )', 'النص داخل الأقواس ( )'],
    ['Efek hover', 'Hover effects', 'تأثيرات التمرير'],
    ['Blur latar panel (transparan)', 'Panel background blur (transparent)', 'تمويه خلفية اللوحات (شفاف)'],
    ['Liquid glass (semua panel)', 'Liquid glass (all panels)', 'الزجاج السائل (كل اللوحات)'],
    ['Panel kata di bawah (hover)', 'Word panel at the bottom (hover)', 'لوحة الكلمة في الأسفل (عند التمرير)'],
    ['Tooltip Pegon', 'Pegon tooltip', 'تلميح البيغون'],
    ["Dhomir & Marju'", "Dhomir & Marju’", 'الضمير والمرجع'],
    ['Panel', 'Panels', 'اللوحات'],

    /* ---- Pengaturan: tema ---- */
    ['Aurora', 'Aurora', 'الشفق'],
    ['Gelap', 'Dark', 'داكن'],
    ['Terang', 'Light', 'فاتح'],
    ['Sepia', 'Sepia', 'بُنّي قديم'],
    ['OLED', 'OLED', 'OLED'],
    ['Samudra', 'Ocean', 'المحيط'],
    ['Hutan zamrud', 'Emerald forest', 'الغابة الزمردية'],
    ['Senja', 'Sunset', 'الغروب'],
    ['Sakura', 'Sakura', 'زهر الكرز'],
    ['Kopi', 'Coffee', 'قهوة'],
    ['Nord', 'Nord', 'نورد'],
    ['Violet malam', 'Midnight violet', 'بنفسجي الليل'],
    ['Grafit', 'Graphite', 'الجرافيت'],
    ['Kerajaan', 'Royal', 'ملكي'],
    ['Mint', 'Mint', 'نعناع'],
    ['Langit', 'Sky', 'السماء'],
    ['Tengah malam', 'Midnight', 'منتصف الليل'],
    ['Zamrud gelap', 'Dark emerald', 'زمردي داكن'],
    ['Batu tulis', 'Slate', 'حجر الأردواز'],
    ['Anggur', 'Wine', 'نبيذي'],
    ['Lavender gelap', 'Dark lavender', 'خزامى داكن'],
    ['Gurun malam', 'Desert night', 'ليل الصحراء'],
    ['Masjid malam (bergambar)', 'Night mosque (illustrated)', 'مسجد الليل (مصوَّر)'],
    ['Bukit pasir berbintang (bergambar)', 'Starry dunes (illustrated)', 'كثبان نجمية (مصوَّر)'],
    ['Arabesque emas (bergambar)', 'Golden arabesque (illustrated)', 'أرابيسك ذهبي (مصوَّر)'],
    ["Ka'bah (bergambar)", 'Kaaba (illustrated)', 'الكعبة المشرفة (مصوَّر)'],
    ['Masjid Nabawi (bergambar)', "Prophet's Mosque (illustrated)", 'المسجد النبوي (مصوَّر)'],
    ['Kubah Sakhrah (bergambar)', 'Dome of the Rock (illustrated)', 'قبة الصخرة (مصوَّر)'],
    ['Lentera Ramadan (bergambar)', 'Ramadan lanterns (illustrated)', 'فوانيس رمضان (مصوَّر)'],
    ['Mihrab zamrud (bergambar)', 'Emerald mihrab (illustrated)', 'محراب زمردي (مصوَّر)'],
    ['Pinus kelabu', 'Grey pine', 'صنوبر رمادي'],
    ['Tinta', 'Ink', 'حبر'],
    ['Arang hangat', 'Warm charcoal', 'فحم دافئ'],
    ['Mawar debu', 'Dusty rose', 'وردي باهت'],
    ['Kode malam', 'Night code', 'شيفرة الليل'],

    /* ---- Pengaturan: tipografi ---- */
    ['Ukuran font', 'Font size', 'حجم الخط'],
    ['Jarak antar baris', 'Line spacing', 'المسافة بين الأسطر'],
    ['Jarak antar kata', 'Word spacing', 'المسافة بين الكلمات'],
    ['Margin samping area baca', 'Side margin of the reading area', 'الهامش الجانبي لمنطقة القراءة'],
    ['Font Arab', 'Arabic font', 'الخط العربي'],
    ['Warna teks Arab', 'Arabic text color', 'لون النص العربي'],
    ['Beri gaya khusus teks di dalam tanda kurung', 'Give text inside parentheses a special style', 'تنسيق خاص للنص داخل الأقواس'],
    ['Warna teks', 'Text color', 'لون النص'],
    ['Font', 'Font', 'الخط'],
    ['Ukuran font (× ukuran teks Arab)', 'Font size (× Arabic text size)', 'حجم الخط (× حجم النص العربي)'],
    ['Ketebalan', 'Weight', 'السماكة'],
    ['Sangat tipis (100)', 'Very thin (100)', 'رفيع جدًا (100)'],
    ['Tipis (200)', 'Thin (200)', 'رفيع (200)'],
    ['Ringan (300)', 'Light (300)', 'خفيف (300)'],
    ['Normal (400)', 'Normal (400)', 'عادي (400)'],
    ['Tebal (700)', 'Bold (700)', 'غامق (700)'],
    ['Sangat tebal (900)', 'Extra bold (900)', 'غامق جدًا (900)'],
    ['Miring', 'Italic', 'مائل'],
    ['Transparansi teks', 'Text opacity', 'شفافية النص'],
    ['Tanda kurungnya ikut diberi gaya yang sama', 'Style the parentheses too', 'تطبيق نفس التنسيق على الأقواس'],

    /* ---- Pengaturan: hover ---- */
    ['Animasi gerak teks saat hover (berulang selama kursor di atas kata)', 'Text motion on hover (loops while the cursor is over the word)', 'حركة النص عند التمرير (تتكرر أثناء وجود المؤشر على الكلمة)'],
    ['Melayang napas', 'Breathing float', 'طفو متنفّس'],
    ['Ayun bandul', 'Pendulum sway', 'تأرجح البندول'],
    ['Denyut jantung', 'Heartbeat', 'نبض القلب'],
    ['Orbit mungil', 'Tiny orbit', 'مدار صغير'],
    ['Lompat membal', 'Bouncy hop', 'قفز مرتد'],
    ['Mati', 'Off', 'إيقاف'],
    ['Kecepatan animasi gerak', 'Motion speed', 'سرعة الحركة'],
    ['Gaya hover', 'Hover style', 'نمط التمرير'],
    ['Zoom (bawaan)', 'Zoom (default)', 'تكبير (افتراضي)'],
    ['Angkat melayang', 'Lift & float', 'رفع وطفو'],
    ['Kaca cair (liquid)', 'Liquid glass', 'زجاج سائل'],
    ['Garis menyapu', 'Sweeping line', 'خط ينساب'],
    ['Kilau menyapu', 'Sweeping shine', 'لمعان ينساب'],
    ['Neon menyala', 'Glowing neon', 'نيون متوهج'],
    ['Miring 3D mengikuti kursor', '3D tilt following the cursor', 'إمالة ثلاثية الأبعاد تتبع المؤشر'],
    ['Cahaya mengikuti kursor', 'Light following the cursor', 'ضوء يتبع المؤشر'],
    ['Skala hover (Zoom / Angkat / Kaca)', 'Hover scale (Zoom / Lift / Glass)', 'مقياس التمرير (تكبير / رفع / زجاج)'],
    ['Warna box & glow', 'Box & glow color', 'لون الصندوق والتوهج'],
    ['Transparansi box & glow', 'Box & glow opacity', 'شفافية الصندوق والتوهج'],
    ['Kelengkungan sudut box', 'Box corner radius', 'استدارة زوايا الصندوق'],
    ['Warna garis tepi box', 'Box border color', 'لون حدود الصندوق'],
    ['Tebal garis tepi box', 'Box border width', 'سماكة حدود الصندوق'],

    /* ---- Pengaturan: blur panel & liquid glass ---- */
    ['Aktifkan blur latar transparan di semua panel', 'Enable transparent background blur on all panels', 'تفعيل تمويه الخلفية الشفاف في كل اللوحات'],
    ['Kekuatan blur latar', 'Background blur strength', 'قوة تمويه الخلفية'],
    ['Kepekatan panel (kiri = makin transparan)', 'Panel density (left = more transparent)', 'كثافة اللوحة (يسار = أكثر شفافية)'],
    ['Aktifkan efek liquid glass', 'Enable liquid glass effect', 'تفعيل تأثير الزجاج السائل'],
    ['Kepekatan panel (kiri = makin bening)', 'Panel density (left = clearer)', 'كثافة اللوحة (يسار = أصفى)'],
    ['Intensitas blur kaca', 'Glass blur intensity', 'شدة تمويه الزجاج'],
    ['Saturasi warna latar di balik kaca', 'Color saturation behind the glass', 'تشبّع لون الخلفية خلف الزجاج'],
    ['Kilau permukaan', 'Surface shine', 'لمعان السطح'],
    ['Kilau tepi', 'Edge shine', 'لمعان الحواف'],
    ['Pembiasan cairan (distorsi latar)', 'Liquid refraction (background distortion)', 'انكسار السائل (تشويه الخلفية)'],
    ['Warna tint kaca', 'Glass tint color', 'لون صبغة الزجاج'],

    /* ---- Pengaturan: panel bawah, tooltip, dhomir ---- */
    ['Ukuran font Arab', 'Arabic font size', 'حجم الخط العربي'],
    ['Ukuran font Pegon', 'Pegon font size', 'حجم خط البيغون'],
    ['Warna teks Pegon', 'Pegon text color', 'لون نص البيغون'],
    ['Warna latar box', 'Box background color', 'لون خلفية الصندوق'],
    ['Ruang dalam box (kiri-kanan)', 'Box inner padding (left-right)', 'الحشو الداخلي للصندوق (يمين-يسار)'],
    ['Tampilkan tooltip', 'Show tooltip', 'إظهار التلميح'],
    ['Warna latar tooltip', 'Tooltip background color', 'لون خلفية التلميح'],
    ['Tampilkan sorotan', 'Show highlight', 'إظهار التمييز'],
    ['Warna garis & sorotan', 'Line & highlight color', 'لون الخط والتمييز'],
    ["Gaya penghubung dhomir → marju'", 'Dhomir → marju’ connector style', 'نمط الوصلة بين الضمير ← المرجع'],
    ['Garis (bawaan)', 'Line (default)', 'خط (افتراضي)'],
    ['Putus-putus mengalir', 'Flowing dashes', 'شرطات متدفقة'],
    ['Komet bercahaya', 'Glowing comet', 'مذنّب متوهج'],
    ['Panah', 'Arrow', 'سهم'],
    ['Titik-titik berjalan', 'Moving dots', 'نقاط متحركة'],
    ['Neon berdenyut', 'Pulsing neon', 'نيون نابض'],
    ['Pelangi berputar', 'Rotating rainbow', 'قوس قزح دوّار'],
    ['Kunang-kunang', 'Fireflies', 'اليراعات'],
    ['Riak air', 'Water ripples', 'تموجات الماء'],
    ['Kilat listrik', 'Lightning', 'برق كهربائي'],
    ['Pena menulis', 'Writing pen', 'قلم يكتب'],
    ['Bernapas', 'Breathing', 'تنفّس'],
    ['Taburan bintang', 'Star dust', 'غبار النجوم'],
    ['Untai ganda', 'Double strand', 'خيط مزدوج'],
    ['Tebal penghubung', 'Connector thickness', 'سماكة الوصلة'],
    ['Posisi garis rujuk', 'Reference line position', 'موضع خط الإحالة'],
    ['Otomatis (di bawah bila tooltip tampil)', 'Automatic (below when a tooltip shows)', 'تلقائي (أسفل الكلمة عند ظهور التلميح)'],
    ['Selalu di bawah kata', 'Always below the word', 'دائمًا أسفل الكلمة'],
    ['Selalu di atas kata', 'Always above the word', 'دائمًا أعلى الكلمة'],
    ['Efek suara pada kata berdhomir', 'Sound effect on words with a dhomir', 'مؤثر صوتي على الكلمات ذات الضمير'],
    ['Jenis suara dhomir', 'Dhomir sound type', 'نوع صوت الضمير'],
    ['Lonceng kristal', 'Crystal chime', 'جرس بلّوري'],
    ['Gelembung', 'Bubble', 'فقاعة'],
    ['Harpa petik', 'Plucked harp', 'قيثارة منقورة'],
    ['Tetes air', 'Water drop', 'قطرة ماء'],
    ['Volume suara dhomir', 'Dhomir sound volume', 'مستوى صوت الضمير'],
    ['Suara klik (tombol & menu)', 'Click sound (buttons & menus)', 'صوت النقر (الأزرار والقوائم)'],
    ['Suara klik', 'Click sound', 'صوت النقر'],
    ['Matikan suara klik', 'Mute click sound', 'كتم صوت النقر'],
    ['Nyalakan suara klik', 'Unmute click sound', 'تشغيل صوت النقر'],
    ['Suara klik dinyalakan.', 'Click sound on.', 'تم تشغيل صوت النقر.'],
    ['Suara klik dimatikan.', 'Click sound off.', 'تم كتم صوت النقر.'],

    /* ---- Pengaturan: catatan & panel ---- */
    ['Ukuran font catatan', 'Note font size', 'حجم خط الملاحظات'],
    ['Lebar box catatan (catatan di tengah layar)', 'Note box width (notes at screen center)', 'عرض صندوق الملاحظات (الملاحظات في وسط الشاشة)'],
    ['Tinggi maksimum box catatan (catatan di tengah layar)', 'Note box max height (notes at screen center)', 'أقصى ارتفاع لصندوق الملاحظات (الملاحظات في وسط الشاشة)'],
    ['Warna teks catatan', 'Note text color', 'لون نص الملاحظات'],
    ['Warna box catatan', 'Note box color', 'لون صندوق الملاحظات'],
    ['Panel catatan kalimat', 'Sentence notes panel', 'لوحة ملاحظات الجمل'],
    ['Catatan di tengah layar, latar di-blur (Mode Baca)', 'Notes at screen center, blurred background (Read mode)', 'الملاحظات في وسط الشاشة مع تمويه الخلفية (وضع القراءة)'],
    ['Intensitas blur latar saat catatan tampil', 'Background blur when a note is shown', 'شدة تمويه الخلفية عند ظهور الملاحظة'],
    ['Panel kata yang di-hover (Mode Baca)', 'Hovered-word panel (Read mode)', 'لوحة الكلمة المحدَّدة بالمؤشر (وضع القراءة)'],
    /* ---- pembuka aplikasi (animasi logo + jendela pilihan) ---- */
    ['Mau Ngaji Apa Hari Ini?', 'What will you study today?', 'ماذا تريد أن تدرس اليوم؟'],
    ['Pilih kitab yang ingin dikaji, atau mulai dari lembar kosong.', 'Pick the book you want to study, or start from a blank page.', 'اختر الكتاب الذي تريد دراسته، أو ابدأ من صفحة فارغة.'],
    ['Buka Kitab', 'Open a Book', 'فتح كتاب'],
    ['File Kosong', 'Blank File', 'ملف فارغ'],
    ['Mulai dari lembar baru, lalu isi teksnya sendiri', 'Start from a fresh page, then add your own text', 'ابدأ من صفحة جديدة ثم أضف نصك بنفسك'],
    ['Lanjutkan yang terakhir', 'Continue where you left off', 'متابعة آخر ما كنت عليه'],
    ['Mulai Ngaji', 'Start Studying', 'ابدأ الدراسة'],
    ['Sebelumnya (←)', 'Previous (←)', 'السابق (←)'],
    ['Berikutnya (→)', 'Next (→)', 'التالي (→)'],
    ['Pilih file proyek .ngaji yang sudah kamu simpan', 'Choose a .ngaji project file you saved', 'اختر ملف مشروع ‎.ngaji‎ الذي حفظته'],
    ['Belum ada kitab bawaan. Taruh file .ngaji di folder “kitab”, atau pakai tombol di bawah.', 'No built-in books yet. Put .ngaji files in the “kitab” folder, or use the buttons below.', 'لا توجد كتب مضمَّنة بعد. ضع ملفات ‎.ngaji‎ في مجلد «kitab» أو استخدم الأزرار أدناه.'],
    ['Kitab Bawaan', 'Built-in Books', 'الكتب المضمَّنة'],
    ['PDF', 'PDF', 'PDF'],
    ['Buka PDF', 'Open PDF', 'فتح PDF'],
    ['Tambah PDF', 'Add PDF', 'إضافة PDF'],
    ['Tutup tab', 'Close tab', 'إغلاق التبويب'],
    ['PDF yang terbuka', 'Open PDFs', 'ملفات PDF المفتوحة'],
    ['Tambah PDF baru (Ctrl+O)', 'Add a new PDF (Ctrl+O)', 'إضافة PDF جديد (Ctrl+O)'],
    ['Tambah PDF — dibuka di tab baru (Ctrl+O)', 'Add a PDF — opens in a new tab (Ctrl+O)', 'إضافة PDF — يُفتح في تبويب جديد (Ctrl+O)'],
    ['Klik “Buka PDF” atau seret file PDF ke jendela ini; beberapa file sekaligus akan dibuka di tab masing-masing. Jika teksnya Latin, tata letak otomatis menjadi LTR.', 'Click “Open PDF” or drag PDF files into this window; several files open in their own tabs. If the text is Latin, the layout switches to LTR automatically.', 'انقر «فتح PDF» أو اسحب ملفات PDF إلى هذه النافذة؛ تُفتح عدة ملفات في تبويبات منفصلة. إذا كان النص لاتينيًا يتحول التخطيط تلقائيًا إلى LTR.'],
    ['Warna Latar', 'Background', 'لون الخلفية'],
    ['Warna latar PDF', 'PDF background', 'خلفية PDF'],
    ['Warna sendiri', 'Custom color', 'لون مخصص'],
    ['Arah', 'Direction', 'الاتجاه'],
    ['Otomatis', 'Auto', 'تلقائي'],
    ['Asli', 'Original', 'الأصلي'],
    ['Invert', 'Invert', 'عكس'],
    ['Krem', 'Cream', 'كريمي'],
    ['Sepia', 'Sepia', 'سيبيا'],
    ['Hijau', 'Green', 'أخضر'],
    ['Abu', 'Gray', 'رمادي'],
    ['Gelap', 'Dark', 'داكن'],
    ['Hitam', 'Black', 'أسود'],
    ['Teks Latin', 'Latin text', 'نص لاتيني'],
    ['Teks Arab', 'Arabic text', 'نص عربي'],
    ['Teks tak terdeteksi', 'Text not detected', 'لم يُكتشف نص'],
    ['Baca file PDF', 'Read a PDF file', 'قراءة ملف PDF'],
    ['Baca file PDF (Ctrl+Shift+P)', 'Read a PDF file (Ctrl+Shift+P)', 'قراءة ملف PDF (Ctrl+Shift+P)'],
    ['Klik “Buka PDF” atau seret file PDF ke jendela ini. Jika teksnya Latin, tata letak otomatis menjadi LTR.', 'Click “Open PDF” or drag a PDF file into this window. If the text is Latin, the layout switches to LTR automatically.', 'انقر «فتح PDF» أو اسحب ملف PDF إلى هذه النافذة. إذا كان النص لاتينيًا يتحول التخطيط تلقائيًا إلى LTR.'],
    ['Memuat PDF…', 'Loading PDF…', 'جارٍ تحميل PDF…'],
    ['Pilih file PDF', 'Choose a PDF file', 'اختر ملف PDF'],
    ['Tutup pembaca PDF (Esc)', 'Close PDF reader (Esc)', 'إغلاق قارئ PDF (Esc)'],
    ['Halaman sebelumnya', 'Previous page', 'الصفحة السابقة'],
    ['Halaman berikutnya', 'Next page', 'الصفحة التالية'],
    ['Perkecil', 'Zoom out', 'تصغير'],
    ['Perbesar', 'Zoom in', 'تكبير'],
    ['Sesuaikan lebar halaman', 'Fit page width', 'ملاءمة عرض الصفحة'],
    ['Tampilkan dua halaman berdampingan', 'Show two pages side by side', 'عرض صفحتين متجاورتين'],
    ['Ubah warna latar PDF atau balik warna (invert)', 'Change the PDF background or invert colors', 'تغيير خلفية PDF أو عكس الألوان'],
    ['Latar terang mempertahankan warna gambar. Latar gelap mengubah halaman menjadi dua warna (teks terang di atas latar).', 'Light backgrounds keep image colors. Dark backgrounds turn the page two-tone (light text on the background).', 'الخلفيات الفاتحة تحافظ على ألوان الصور. الخلفيات الداكنة تحوّل الصفحة إلى لونين (نص فاتح على الخلفية).'],
    ['Baca file PDF dengan arah baca otomatis dan warna latar', 'Read a PDF with automatic reading direction and background colors', 'اقرأ ملف PDF باتجاه قراءة تلقائي وألوان خلفية'],
    ['Tambah Kitab', 'Add Book', 'إضافة كتاب'],
    ['Tambah ke', 'Add to', 'إضافة إلى'],
    ['Buka Folder', 'Open Folder', 'فتح المجلد'],
    ['Pindah', 'Move', 'نقل'],
    ['Hapus', 'Delete', 'حذف'],
    ['Pindahkan', 'Move here', 'نقل'],
    ['Pindahkan kitab terpilih ke jenis lain', 'Move the selected book to another type', 'انقل الكتاب المحدد إلى نوع آخر'],
    ['Hapus kitab terpilih', 'Delete the selected book', 'احذف الكتاب المحدد'],
    ['Pindahkan kitab ke jenis:', 'Move the book to type:', 'انقل الكتاب إلى النوع:'],
    ['Atau tulis nama jenis baru…', 'Or type a new type name…', 'أو اكتب اسم نوع جديد…'],
    ['Kitab dihapus', 'Book deleted', 'تم حذف الكتاب'],
    ['Kitab dipindahkan', 'Book moved', 'تم نقل الكتاب'],
    ['Belum ada kitab', 'No books yet', 'لا توجد كتب بعد'],
    ['Klik “Tambah” untuk memasukkan file .ngaji ke sini, atau “Buka Folder” lalu taruh filenya di folder itu.', 'Click “Add” to put a .ngaji file here, or “Open Folder” and drop the file into that folder.', 'انقر «إضافة» لوضع ملف ‎.ngaji‎ هنا، أو «فتح المجلد» ثم ضع الملف فيه.'],
    ['Masukkan file .ngaji ke jenis kitab yang dipilih', 'Put a .ngaji file into the selected book type', 'ضع ملف ‎.ngaji‎ في نوع الكتاب المحدد'],
    ['Buka folder jenis ini; taruh file .ngaji di sana', 'Open this type’s folder; drop .ngaji files there', 'افتح مجلد هذا النوع وضع ملفات ‎.ngaji‎ فيه'],
    ['Jenis Kitab', 'Book Type', 'نوع الكتاب'],
    ['Semua', 'All', 'الكل'],
    ['Fiqih', 'Fiqh', 'الفقه'],
    ['Hadis', 'Hadith', 'الحديث'],
    ['Tafsir', 'Tafsir', 'التفسير'],
    ['Akidah', 'Aqidah', 'العقيدة'],
    ['Tauhid', 'Tawhid', 'التوحيد'],
    ['Akhlak', 'Akhlaq', 'الأخلاق'],
    ['Tasawuf', 'Tasawwuf', 'التصوف'],
    ['Nahwu', 'Nahwu (Grammar)', 'النحو'],
    ['Sharaf', 'Sharaf (Morphology)', 'الصرف'],
    ['Sejarah', 'History', 'السيرة والتاريخ'],
    ['Doa', 'Supplications', 'الأدعية'],
    ['Lainnya', 'Other', 'أخرى'],
    ['bab', 'chapters', 'أبواب'],
    ['kalimat', 'sentences', 'جمل'],
    ['Tutup (Esc)', 'Close (Esc)', 'إغلاق (Esc)'],
    ['Tanpa Judul', 'Untitled', 'بلا عنوان'],
    ['Tampilkan jendela ini saat aplikasi dibuka', 'Show this window when the app opens', 'إظهار هذه النافذة عند فتح التطبيق'],
    ['Lanjutkan tanpa memilih (Esc)', 'Continue without choosing (Esc)', 'المتابعة دون اختيار (Esc)'],
    ['Mau ngaji apa hari ini?', 'What will you study today?', 'ماذا تريد أن تدرس اليوم؟'],
    ['Klik untuk melewati', 'Click to skip', 'انقر للتخطي'],
    ['Suara animasi pembuka', 'Intro animation sound', 'صوت الرسوم الافتتاحية'],
    /* ---- bilah menu atas (Berkas, Edit, Tampilan, Bantuan) ---- */
    ['Berkas', 'File', 'ملف'],
    ['Edit', 'Edit', 'تحرير'],
    ['Tampilan', 'View', 'عرض'],
    ['Bantuan', 'Help', 'مساعدة'],
    ['Pilih Kitab…', 'Choose Book…', 'اختيار كتاب…'],
    ['Proyek Baru', 'New Project', 'مشروع جديد'],
    ['Buka Proyek…', 'Open Project…', 'فتح مشروع…'],
    ['Simpan Proyek', 'Save Project', 'حفظ المشروع'],
    ['Simpan Proyek Sebagai…', 'Save Project As…', 'حفظ المشروع باسم…'],
    ['Ekspor Data (.js)…', 'Export Data (.js)…', 'تصدير البيانات (.js)…'],
    ['Impor Data (.js / .json)…', 'Import Data (.js / .json)…', 'استيراد البيانات (.js / .json)…'],
    ['Ekspor Data (JSON)…', 'Export Data (JSON)…', 'تصدير البيانات (JSON)…'],
    ['Reset Data ke Bawaan…', 'Reset Data to Default…', 'إعادة البيانات إلى الافتراضي…'],
    ['Buka Folder Data', 'Open Data Folder', 'فتح مجلد البيانات'],
    ['Buka Folder Font Lokal', 'Open Local Fonts Folder', 'فتح مجلد الخطوط المحلية'],
    ['Keluar', 'Exit', 'خروج'],
    ['Urungkan', 'Undo', 'تراجع'],
    ['Ulangi', 'Redo', 'إعادة'],
    ['Potong', 'Cut', 'قص'],
    ['Salin', 'Copy', 'نسخ'],
    ['Tempel', 'Paste', 'لصق'],
    ['Pilih Semua', 'Select All', 'تحديد الكل'],
    ['Muat Ulang', 'Reload', 'إعادة تحميل'],
    ['Layar Penuh', 'Full Screen', 'ملء الشاشة'],
    ['Perbesar (Ctrl +)', 'Zoom In (Ctrl +)', 'تكبير (Ctrl +)'],
    ['Perkecil (Ctrl -)', 'Zoom Out (Ctrl -)', 'تصغير (Ctrl -)'],
    ['Ukuran Asli (Ctrl 0)', 'Actual Size (Ctrl 0)', 'الحجم الأصلي (Ctrl 0)'],
    ['Alat Pengembang', 'Developer Tools', 'أدوات المطوّر'],
    ['Periksa Pembaruan…', 'Check for Updates…', 'التحقق من التحديثات…'],
    ['Periksa pembaruan otomatis', 'Check for updates automatically', 'التحقق من التحديثات تلقائيًا'],
    ['Tentang Aplikasi', 'About', 'حول التطبيق'],

    /* ---- tutorial pertama kali (tutorial.js) ---- */
    ['Tutorial Penggunaan', 'Usage Tutorial', 'دليل الاستخدام'],
    ['Mulai Tur', 'Start Tour', 'ابدأ الجولة'],
    ['Lewati', 'Skip', 'تخطّي'],
    ['Kembali', 'Back', 'رجوع'],
    ['Lanjut', 'Next', 'التالي'],
    ['Selamat datang di Ngaji', 'Welcome to Ngaji', 'مرحبًا بك في نغاجي'],
    ['Pembaca kitab interaktif dengan Pegon, penanda nahwu, dan garis dhomir. Tur singkat ini mengenalkan bagian-bagian utamanya — tidak sampai satu menit.', 'An interactive kitab reader with Pegon, nahwu markers and dhomir lines. This short tour introduces the main parts — it takes less than a minute.', 'قارئ كتب تفاعلي مع كتابة البيغون وعلامات النحو وخطوط الضمير. تعرّفك هذه الجولة القصيرة على أهم أجزاء التطبيق، وتستغرق أقل من دقيقة.'],
    ['Klik logo Ngaji atau tombol Pilih Kitab (Ctrl+K) kapan saja untuk membuka rak kitab. Pilih kitab bawaan, tambahkan atau pindahkan file .ngaji, buka folder jenis kitab, atau mulai dari lembar kosong.', 'Click the Ngaji logo or the Choose Book button (Ctrl+K) at any time to open the bookshelf. Pick a built-in kitab, add or move a .ngaji file, open a book-type folder, or start from a blank sheet.', 'انقر شعار نغاجي أو زر «اختيار كتاب» (Ctrl+K) في أي وقت لفتح رفّ الكتب. اختر كتابًا مضمَّنًا، أو أضف ملف .ngaji أو انقله، أو افتح مجلد نوع الكتاب، أو ابدأ من ورقة فارغة.'],
    ['Kaidah Nahwu dan Pembaca PDF', 'Nahwu Rules and PDF Reader', 'قواعد النحو وقارئ PDF'],
    ['Tombol Nahwu (Ctrl+Shift+K) membuka 12 bab kaidah yang bisa dicari dan dibuka-tutup. Tombol PDF (Ctrl+Shift+P) membuka pembaca PDF dengan arah baca otomatis, beberapa tab, zoom, dan warna latar. Keduanya juga tersedia di jendela Pilih Kitab.', 'The Nahwu button (Ctrl+Shift+K) opens 12 searchable rule chapters that you can expand and collapse. The PDF button (Ctrl+Shift+P) opens the PDF reader with automatic reading direction, multiple tabs, zoom and background colors. Both are also available in the Choose Book window.', 'يفتح زر «النحو» (Ctrl+Shift+K) اثني عشر بابًا من القواعد قابلة للبحث والفتح والطي. ويفتح زر PDF (Ctrl+Shift+P) قارئ PDF مع اتجاه قراءة تلقائي وتبويبات متعددة وتكبير وألوان خلفية. وكلاهما متاح أيضًا في نافذة اختيار الكتاب.'],
    ['Simpan dan Buka Proyek', 'Save and Open Projects', 'حفظ المشروع وفتحه'],
    ['Perubahanmu tersimpan otomatis. Tombol Simpan (Ctrl+S) membuat file .ngaji yang bisa dibuka lagi lewat Buka (Ctrl+O) atau dibagikan; Ekspor JS membuat salinan datanya.', 'Your changes are saved automatically. Save (Ctrl+S) creates a .ngaji file you can reopen with Open (Ctrl+O) or share; Export JS makes a copy of the data.', 'تُحفظ تغييراتك تلقائيًا. زر «حفظ» (Ctrl+S) ينشئ ملف .ngaji يمكنك فتحه لاحقًا عبر «فتح» (Ctrl+O) أو مشاركته؛ أما «تصدير JS» فينشئ نسخة من البيانات.'],
    ['Klik tab di tepi kiri untuk melihat semua bab dan sub bab, melompat ke mana saja, dan menandai yang sudah dikaji. Kemajuan belajarmu tampil sebagai persentase.', 'Click the tab on the left edge to see all chapters and sub-chapters, jump anywhere, and mark what you have studied. Your progress appears as a percentage.', 'انقر اللسان على الحافة اليسرى لعرض كل الأبواب والأبواب الفرعية، والانتقال إلى أي موضع، ووضع علامة على ما درسته. يظهر تقدّمك كنسبة مئوية.'],
    ['Area Baca', 'Reading Area', 'منطقة القراءة'],
    ['Arahkan kursor ke sebuah kata untuk melihat Pegon, dhomir, dan marju’-nya di panel bawah; di layar sentuh, ketuk katanya. Penanda nahwu tampil di atas kata, dan garis dhomir menghubungkan kata ke marju’nya. Klik sebuah kalimat untuk memilihnya dan melihat catatannya.', 'Hover over a word to see its Pegon, dhomir and marju’ in the panel below; on a touch screen, tap the word. Nahwu markers appear above words, and dhomir lines connect a word to its marju’. Click a sentence to select it and see its notes.', 'مرّر المؤشر فوق كلمة لعرض البيغون والضمير ومرجعه في اللوحة السفلية؛ وعلى شاشة اللمس انقر الكلمة. تظهر علامات النحو فوق الكلمات، وتربط خطوط الضمير الكلمة بمرجعها. انقر جملة لتحديدها وعرض ملاحظاتها.'],
    ['Tab ini membuka catatan untuk kalimat atau paragraf yang dipilih. Di Mode Edit, kamu juga bisa menulis catatan dan mengatur formatnya dari sini. Catatan juga bisa tampil di tengah layar dengan latar blur; ukuran dan warnanya diatur di Pengaturan.', 'This tab opens the notes for the selected sentence or paragraph. In Edit Mode you can also write notes and adjust their formatting from here. Notes can also appear at the center of the screen with a blurred background; their size and colors are set in Settings.', 'يفتح هذا اللسان ملاحظات الجملة أو الفقرة المحدَّدة. وفي وضع التحرير يمكنك أيضًا كتابة الملاحظات وضبط تنسيقها من هنا. ويمكن أن تظهر الملاحظات في وسط الشاشة بخلفية مموَّهة؛ ويُضبط حجمها وألوانها في الإعدادات.'],
    ['Mode Baca dan Mode Edit', 'Read Mode and Edit Mode', 'وضع القراءة ووضع التحرير'],
    ['Mode Baca untuk mengkaji. Mode Edit memunculkan alat tambahan: Urungkan dan Ulangi, tambah Bab, Kamus kata, serta tempel teks dari Word.', 'Read Mode is for studying. Edit Mode adds more tools: Undo and Redo, add a Chapter, the word Dictionary, and pasting text from Word.', 'وضع القراءة للدراسة. أما وضع التحرير فيُظهر أدوات إضافية: التراجع والإعادة، وإضافة باب، وقاموس الكلمات، ولصق النص من Word.'],
    ['Navigasi dan Progres', 'Navigation and Progress', 'التنقل والتقدّم'],
    ['Tombol panah atau tombol ← → berpindah halaman (RTL: kiri = maju). Lanjutkan membawa kamu ke posisi terakhir dibaca, dan tombol centang menandai bab ini sudah dikaji; persentasenya terlihat di Daftar Isi.', 'The arrow buttons or ← → keys move between pages (RTL: left = forward). Resume takes you back to where you last read, and the check button marks this chapter as studied; the percentage appears in Contents.', 'تنقّلك أزرار الأسهم أو مفتاحا ← → بين الصفحات (في الاتجاه من اليمين إلى اليسار: اليسار = التقدّم). ويعيدك زر «المتابعة» إلى آخر موضع قرأت فيه، ويضع زر علامة الصح علامة على أن هذا الباب قد دُرس؛ وتظهر النسبة في الفهرس.'],
    ['Ubah tema (termasuk tema bergambar), font Arab, ukuran teks, animasi, dan penanda nahwu. Tombol speaker di atas mematikan atau menyalakan suara klik; Atur ulang mengembalikan grup ini ke bawaan. Semua grup tertutup bawaan — buka hanya yang kamu perlukan.', 'Change the theme (including picture themes), Arabic font, text size, animations and nahwu markers. The speaker button at the top turns click sounds on or off; Reset restores this group to defaults. All groups start collapsed — open only what you need.', 'غيّر السمة (ومنها السمات المصوَّرة) وخط العربية وحجم النص والحركات وعلامات النحو. زر مكبر الصوت في الأعلى يشغّل صوت النقر أو يكتمه؛ و«إعادة ضبط» يعيد هذه المجموعة إلى الافتراضي. جميع المجموعات مطويّة افتراضيًا — افتح ما تحتاجه فقط.'],
    ['Tombol Cepat', 'Quick Buttons', 'أزرار سريعة'],
    ['Mode Lite membuat aplikasi lebih ringan tanpa mengurangi kehalusan gerak. Tombol harakat menyembunyikan atau menampilkan harakat, dan Tampilan Bersih menyembunyikan panel agar fokus membaca. Tombol </> membuka Developer Studio untuk mengubah warna, animasi, dan CSS tampilan secara langsung.', 'Lite Mode makes the app lighter without losing motion smoothness. The harakat button hides or shows harakat, and Clean View hides the panels so you can focus on reading. The </> button opens Developer Studio to change colors, animations and CSS live.', 'وضع Lite يجعل التطبيق أخفّ دون الإخلال بسلاسة الحركة. زر الحركات يُخفي التشكيل أو يُظهره، والعرض النظيف يُخفي اللوحات للتركيز على القراءة. وزر </> يفتح استوديو المطوّر لتغيير الألوان والحركات وCSS مباشرة.'],
    ['Siap Mengaji!', 'Ready to Study!', 'استعدّ للدراسة!'],
    ['Tutorial ini bisa diulang kapan saja lewat menu Bantuan → Tutorial Penggunaan. Selamat mengaji!', 'You can replay this tutorial any time from the Help menu → Usage Tutorial. Happy studying!', 'يمكنك إعادة هذا الدليل في أي وقت من قائمة «مساعدة» ← «دليل الاستخدام». دراسة موفّقة!'],
  ];

  /* teks bermarkup (innerHTML) — elemen bertanda data-i18n-h */
  const HTML_ROWS = [
    ['Salin teks di Microsoft Word (<b>Ctrl+C</b>), lalu tempel (<b>Ctrl+V</b>) di kotak berikut. Judul, rata tengah, rata kiri-kanan (justify), tebal, dan Heading 1/2 ikut terbaca.',
      'Copy text in Microsoft Word (<b>Ctrl+C</b>), then paste it (<b>Ctrl+V</b>) into the box below. Titles, centering, justify, bold and Heading 1/2 are all recognized.',
      'انسخ النص في Microsoft Word (<b>Ctrl+C</b>) ثم الصقه (<b>Ctrl+V</b>) في المربع التالي. تُقرأ العناوين والتوسيط والضبط والغامق والعنوان 1/2.'],
    ['Pilih file proyek <code>.ngaji</code> yang sudah kamu simpan', 'Choose a <code>.ngaji</code> project file you saved earlier', 'اختر ملف مشروع <code>.ngaji</code> الذي حفظته سابقًا'],
    ['Heading 1 menjadi <b>bab baru</b>', 'Heading 1 becomes a <b>new chapter</b>', 'العنوان 1 يصبح <b>بابًا جديدًا</b>'],
    ['Semua yang <b>rata tengah</b> menjadi sub bab', 'Everything <b>centered</b> becomes a sub-chapter', 'كل ما هو <b>موسَّط</b> يصبح بابًا فرعيًا'],
  ];

  const IDX = { en: 0, ar: 1 };
  const D = new Map(), H = new Map();
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  ROWS.forEach(r => D.set(norm(r[0]), r.slice(1)));
  HTML_ROWS.forEach(r => H.set(r[0], r.slice(1)));

  /* pola dinamis: [regex, [en, ar]] — tiap fungsi menerima hasil match */
  const PAT = [
    [/^Bab (\d+)$/, [m => `Chapter ${m[1]}`, m => `باب ${m[1]}`]],
    [/^(\d+\/\d+) dikaji$/, [m => `${m[1]} studied`, m => `${m[1]} مدروس`]],
    [/^Isi (\d+) kata sama yang masih kosong$/, [m => `Fill ${m[1]} identical empty word${m[1] == 1 ? '' : 's'}`, m => `املأ ${m[1]} كلمة مطابقة فارغة`]],
    [/^Isi (\d+) kata kosong dari Kamus$/, [m => `Fill ${m[1]} empty word${m[1] == 1 ? '' : 's'} from the dictionary`, m => `املأ ${m[1]} كلمة فارغة من القاموس`]],
    [/^Isi (\d+) kosong$/, [m => `Fill ${m[1]} empty`, m => `املأ ${m[1]} فارغة`]],
    [/^(\d+) entri$/, [m => `${m[1]} entr${m[1] == 1 ? 'y' : 'ies'}`, m => `${m[1]} مدخل`]],
    [/^(\d+) kata masih kosong dan bisa diisi$/, [m => `${m[1]} word${m[1] == 1 ? '' : 's'} still empty and fillable`, m => `${m[1]} كلمة فارغة يمكن ملؤها`]],
    [/^Menampilkan (\d+) dari (\d+)$/, [m => `Showing ${m[1]} of ${m[2]}`, m => `عرض ${m[1]} من ${m[2]}`]],
    [/^(\d+) kata diisi dari Kamus\.$/, [m => `${m[1]} word${m[1] == 1 ? '' : 's'} filled from the dictionary.`, m => `تم ملء ${m[1]} كلمة من القاموس.`]],
    [/^Buka bab (\d+)$/, [m => `Open chapter ${m[1]}`, m => `فتح الباب ${m[1]}`]],
    [/^Bab · (\d+\/\d+)$/, [m => `Chapter · ${m[1]}`, m => `باب · ${m[1]}`]],
    [/^(\d+) kalimat(?: · (\d+) sub bab)?$/, [
      m => `${m[1]} sentence${m[1] == 1 ? '' : 's'}` + (m[2] ? ` · ${m[2]} sub-chapter${m[2] == 1 ? '' : 's'}` : ''),
      m => `${m[1]} جملة` + (m[2] ? ` · ${m[2]} باب فرعي` : '')]],
    [/^Langkah (\d)\/2: klik kata (pertama|terakhir) kalimat\.$/, [
      m => `Step ${m[1]}/2: click the ${m[2] === 'pertama' ? 'first' : 'last'} word of the sentence.`,
      m => `الخطوة ${m[1]}/2: انقر ${m[2] === 'pertama' ? 'الكلمة الأولى' : 'الكلمة الأخيرة'} من الجملة.`]],
    [/^Font "(.*)" dipakai\. Bila tidak terpasang di komputer ini, tampilan memakai Amiri\.$/s, [
      m => `Font “${m[1]}” applied. If it is not installed on this computer, Amiri is used.`,
      m => `تم تطبيق الخط «${m[1]}». إن لم يكن مثبّتًا على هذا الحاسوب فسيُستخدم Amiri.`]],
    [/^Font ditambahkan: (.*)$/s, [m => `Font added: ${m[1]}`, m => `تمت إضافة الخط: ${m[1]}`]],
    [/^Hapus bab "(.*)" beserta (\d+) kalimatnya\?$/s, [
      m => `Delete chapter “${m[1]}” and its ${m[2]} sentence(s)?`,
      m => `حذف الباب «${m[1]}» مع ${m[2]} جملة؟`]],
    [/^Hapus sub bab "(.*)"\?$/s, [m => `Delete sub-chapter “${m[1]}”?`, m => `حذف الباب الفرعي «${m[1]}»؟`]],
    [/^Gagal menyimpan: (.*)$/s, [m => `Save failed: ${tr(m[1]) || m[1]}`, m => `فشل الحفظ: ${tr(m[1]) || m[1]}`]],
    [/^Autosave gagal: (.*)$/s, [m => `Autosave failed: ${m[1]}`, m => `فشل الحفظ التلقائي: ${m[1]}`]],
    [/^Gagal: (.*)$/s, [m => `Failed: ${m[1]}`, m => `فشل: ${m[1]}`]],
    [/^Data diekspor ke: (.*)$/s, [m => `Data exported to: ${m[1]}`, m => `تم تصدير البيانات إلى: ${m[1]}`]],
    [/^Gagal mengekspor file: (.*)$/s, [m => `Could not export the file: ${tr(m[1]) || m[1]}`, m => `تعذّر تصدير الملف: ${tr(m[1]) || m[1]}`]],
    [/^Gagal mengekspor: (.*)$/s, [m => `Export failed: ${m[1]}`, m => `فشل التصدير: ${m[1]}`]],
    [/^Gagal membaca \.docx: (.*)$/s, [m => `Could not read the .docx: ${tr(m[1]) || m[1]}`, m => `تعذّرت قراءة ملف .docx: ${tr(m[1]) || m[1]}`]],
    [/^(\d+) blok ditambahkan(?:, (\d+) bab baru)?\.$/, [
      m => `${m[1]} block(s) added` + (m[2] ? `, ${m[2]} new chapter(s).` : '.'),
      m => `تمت إضافة ${m[1]} كتلة` + (m[2] ? `، و${m[2]} باب جديد.` : '.')]],
    [/^(\d+) blok terbaca — (\d+) judul, (\d+) sub bab, (\d+) teks · rata tengah (\d+), justify (\d+), rata kiri (\d+)(?: · (\d+) bab baru)?$/, [
      m => `${m[1]} blocks read — ${m[2]} titles, ${m[3]} sub-chapters, ${m[4]} text · ${m[5]} centered, ${m[6]} justified, ${m[7]} left-aligned` + (m[8] ? ` · ${m[8]} new chapters` : ''),
      m => `تمت قراءة ${m[1]} كتلة — ${m[2]} عناوين، ${m[3]} أبواب فرعية، ${m[4]} نصوص · ${m[5]} موسَّطة، ${m[6]} مضبوطة، ${m[7]} لليسار` + (m[8] ? ` · ${m[8]} أبواب جديدة` : '')]],
    [/^… dan (\d+) blok lainnya$/, [m => `… and ${m[1]} more blocks`, m => `… و${m[1]} كتلة أخرى`]],
  ];

  let lang = 'id';

  function tr(src) {
    if (lang === 'id' || src == null) return null;
    const key = norm(src);
    if (!key) return null;
    const i = IDX[lang];
    const hit = D.get(key);
    if (hit) return hit[i];
    for (const [re, fns] of PAT) { const m = key.match(re); if (m) return fns[i](m); }
    return null;
  }

  /* ---------- node teks ---------- */
  const TXT = new WeakMap();
  function doText(n) {
    let rec = TXT.get(n);
    if (rec && n.data !== rec.t) rec = null; // teks ditimpa aplikasi -> anggap teks baru
    const orig = rec ? rec.o : n.data;
    if (lang === 'id') { if (rec) { n.data = orig; TXT.delete(n); } return; }
    const t = tr(orig);
    if (t == null) { if (rec) { n.data = orig; TXT.delete(n); } return; }
    const lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0], out = lead + t + trail;
    if (n.data !== out) n.data = out;
    TXT.set(n, { o: orig, t: out });
  }

  /* ---------- atribut ---------- */
  const ATTRS = ['title', 'placeholder', 'aria-label', 'data-ph'];
  const ATT = new WeakMap();
  function doAttr(el, a) {
    if (!el.hasAttribute(a)) return;
    const all = ATT.get(el) || {};
    let rec = all[a];
    const cur = el.getAttribute(a);
    if (rec && cur !== rec.t) rec = null;
    const orig = rec ? rec.o : cur;
    const t = lang === 'id' ? null : tr(orig);
    if (t == null) { if (rec) { el.setAttribute(a, orig); delete all[a]; } return; }
    if (cur !== t) el.setAttribute(a, t);
    all[a] = { o: orig, t }; ATT.set(el, all);
  }

  /* ---------- elemen bermarkup ---------- */
  function doHtml(el) {
    const key = el.getAttribute('data-i18n-h'), hit = H.get(key);
    const want = lang === 'id' || !hit ? key : hit[IDX[lang]];
    if (el.innerHTML !== want) el.innerHTML = want;
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'CODE']);
  function skipEl(el) {
    if (SKIP.has(el.tagName.toUpperCase())) return true;
    if (el.isContentEditable || el.id === 'devPanel' || el.id === 'devHi') return true;
    const c = el.classList;
    return c.contains('sentence') || c.contains('word') || c.contains('page-title') || c.contains('ar') || c.contains('hp-ar') || c.contains('hp-pg'); // .sentence: isi kitab tidak diterjemahkan -> lewati seluruh paragraf sekaligus (O(1), bukan O(jumlah kata))
  }
  function walk(node) {
    if (node.nodeType === 3) { doText(node); return; }
    if (node.nodeType !== 1) return;
    if (skipEl(node)) { if (node.tagName === 'TEXTAREA' && !node.isContentEditable) for (const a of ATTRS) doAttr(node, a); return; } // isi textarea = data pengguna, tooltipnya tetap diterjemahkan
    if (node.tagName === 'OPTION' && !node.hasAttribute('value')) node.setAttribute('value', node.textContent); // nilai tetap, teks boleh diterjemahkan
    for (const a of ATTRS) doAttr(node, a);
    if (node.hasAttribute('data-i18n-h')) { doHtml(node); return; }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  const mo = new MutationObserver(list => {
    if (lang === 'id') return;
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) walk(n); });
      else if (m.type === 'characterData') { const p = m.target.parentElement; if (!p || !skipEl(p)) doText(m.target); }
      else if (m.type === 'attributes' && (!skipEl(m.target) || m.target.tagName === 'TEXTAREA')) doAttr(m.target, m.attributeName);
    }
  });

  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr'; // tata letak aplikasi tetap; hanya isi panel yang di-RTL-kan lewat CSS untuk Arab
    ['id', 'en', 'ar'].forEach(l => document.body.classList.toggle('ui-' + l, l === lang));
    walk(document.body);
    document.dispatchEvent(new CustomEvent('ngaji-lang', { detail: lang })); // bilah menu atas (di luar <body>) ikut berganti bahasa
  }

  const api = {
    get: () => lang,
    t: s => { const r = tr(s); return r == null ? s : r; },
    set(l) {
      l = ['id', 'en', 'ar'].includes(l) ? l : 'id';
      if (l === lang && document.body.classList.contains('ui-' + l)) return;
      lang = l; apply();
      syncObserver();
    }
  };
  window.NGAJI_I18N = api;

  /* alert / confirm bawaan ikut diterjemahkan */
  ['alert', 'confirm'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig === 'function') window[fn] = function (m) { return orig.call(window, api.t(m == null ? '' : String(m).replace(/\n\n/g, ' '))); };
  });

  // Bahasa Indonesia = teks sumber, tidak ada yang perlu diterjemahkan -> observer dilepas total.
  // (Observer yang menyala tetap membuat MutationRecord untuk setiap simpul yang dirender ulang, walau callback-nya langsung return.)
  let observing = false;
  function syncObserver() {
    if (lang === 'id') { if (observing) { mo.disconnect(); observing = false; } return; }
    if (!observing) { mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); observing = true; }
  }
  const first = (window.NGAJI_DATA && window.NGAJI_DATA.settings && window.NGAJI_DATA.settings.lang) || 'id';
  api.set(first);
})();

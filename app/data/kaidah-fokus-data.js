/* Highlight "yang sedang dijelaskan" pada menu Nahwu (dipakai kaidah-nahwu.js).
   Struktur: KAIDAH_FOKUS[nomor bab][nomor kaidah] = { t: [...], ex: ... }   (nomor mulai dari 0; saat ini baru Bab 1 = 0)
   t  = daftar yang di-highlight pada TEKS PENJELASAN: RegExp, atau [RegExp, kelas], atau fungsi(teks) -> [[mulai, akhir, kelas]].
   ex = yang di-highlight pada CONTOH ARAB:
        'w'                  seluruh contoh
        'i' | 'f' | 'h'      kata berjenis isim / fi'il / huruf (dari data/kaidah-warna-data.js)
        'all'                semua kata, diwarnai menurut jenisnya
        RegExp               bagian yang cocok
        angka                kata ke-n (mulai 0)
        {w:n, l:k}           k huruf pertama kata ke-n      {w:n, e:k}  k huruf terakhir      {w:n, c:[dari, sampai]}  huruf ke-dari..sampai (boleh negatif)
        [spec, spec]         gabungan;  {cls:'g2'} pada spec = warna kedua
        {by:{0:spec, all:spec}}  spec khusus per contoh (urutan contoh dalam kaidah), 'all' = sisanya
   Kelas warna: g (kuning, umum), g2 (kuning kedua), i (isim, biru), f (fi'il, oranye), h (huruf, hijau). */
(function () {
  var D = '\\u064B-\\u0652\\u0670';                                   // harakat
  var ARAB = new RegExp('[\\u0621-\\u064A\\u0671][\\u0621-\\u064A\\u0671' + D + '\\u0640]*', 'g'); // tiap kata Arab di teks
  var HURUF_SENDIRI = /(?<![\u0621-\u064A\u064B-\u0652])[\u0621-\u064A](?: [\u0621-\u064A](?![\u0621-\u064A\u064B-\u0652]))+/g;       // deret huruf terpisah: ط ث ص ر ...
  var KURUNG_ARAB = /(?<=\()[\u0600-\u06FF\u064B-\u0652 ]+(?=\))/g;  // frasa Arab dalam tanda kurung
  var TANWIN = new RegExp('[\\u0621-\\u064A\\u0671](?=[' + D + ']*[\\u064B-\\u064D])[' + D + ']*', 'g'); // huruf bertanwin
  var AL = new RegExp('(?<=^|\\s)\\u0627\\u0644\\u0652?', 'g');        // ال di awal kata
  var HURUF_SESUDAH_AL = new RegExp('(?<=(?:^|\\s)\\u0627\\u0644[' + D + ']?)[\\u0621-\\u064A][' + D + ']*', 'g'); // huruf setelah ال
  var I = [/\bisim\b/gi, 'i'], F = [/fi['\u2019]il/gi, 'f'], H = [/\bhuruf\b/gi, 'h'];
  var all = function (spec) { return { by: { all: spec } }; };

  window.KAIDAH_FOKUS = { 0: {
    0: { t: [/musnad ilaih|musnad|murakkab|mufid|wadha'|lafazh|\bkalam\b/gi] },                       // Kalam
    1: { t: [/lafazh|murakkab|mufid|wadha'/gi] },                                                     // Syarat kalam (ringkasan)
    2: { t: [/lafazh|tidak bermakna|bermakna/gi, KURUNG_ARAB], ex: 'w' },                             // Syarat 1: Lafazh
    3: { t: [/murakkab/gi, I, F, /dhamir mustatir/gi], ex: 'all' },                                   // Syarat 2: Murakkab
    4: { t: [/isnadi|idhafi|mazji|washfi|mudhaf ilaih|mudhaf/gi], ex: 'w' },                          // Macam-macam murakkab
    5: { t: [/mufid/gi, KURUNG_ARAB], ex: 'w' },                                                      // Syarat 3: Mufid
    6: { t: [/wadha'/gi, KURUNG_ARAB], ex: 'w' },                                                     // Syarat 4: Wadha'
    7: { t: [/\b(?:qaul|kalimah|kalim|kalam)\b/gi], ex: 'w' },                                        // Qaul, kalimah, kalim, kalam
    8: { t: [I, F, H, /kalimah/gi], ex: 'all' },                                                      // Kalimah (3 macam)
    9: { t: [I], ex: 'i' },                                                                           // Isim
    10: { t: [/khafdh\/jar|tanwin|nida'|alif-lam|musnad ilaih/gi, /(?<=\()ال(?=\))/g],               // Tanda isim (5 tanda)
          ex: { by: { 0: 1, 1: TANWIN, 2: 1, 3: AL, 4: 1 } } },
    11: { t: [/khafdh|majrur|kasrah|huruf jar|idhafah|mudhaf ilaih|tabi'/gi],                         // Tanda isim 1: Khafdh (jar)
          ex: { by: { 0: 1, 1: 1, 2: [1, 2] } } },
    12: { t: [/huruf jar/gi, ARAB],                                                                   // Huruf jar (20 macam)
          ex: { by: { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 0, 12: { w: 1, l: 1 }, 13: 1,
                      14: { w: 0, l: 1 }, 15: { w: 0, l: 1 }, 16: { w: 1, l: 1 }, 17: { w: 1, l: 1 }, 18: 0, 19: 1 } } },
    13: { t: [/(?:satu|dua|tiga) huruf(?: atau lebih)?/gi, ARAB],                                     // Huruf jar menurut jumlah hurufnya
          ex: { by: { 0: { w: 0, l: 1 }, 1: { w: 0, l: 1 }, 2: { w: 0, l: 1 }, 3: { w: 0, l: 1 }, 4: { w: 0, l: 1 }, all: 0 } } },
    14: { t: [/dhamir(?: majrur)?|isim zhahir/gi, ARAB],                                              // Huruf jar: masuk dhamir atau isim zhahir saja
          ex: { by: { 0: { w: 0, e: 1 }, 1: { w: 0, e: 2 }, 2: { w: 0, e: 1 }, 3: { w: 0, e: 2 }, 4: { w: 0, e: 2 }, 5: { w: 0, e: 1 },
                      6: { w: 0, e: 2 }, 7: { w: 0, e: 1 }, 8: 1, 9: { w: 0, c: [1, null] } } } },
    15: { t: [/tanwin(?: dhammah| fathah| kasrah)?|nun sakinah|harakat ganda/gi, /\u0640[\u064B-\u064D]/g], ex: TANWIN },   // Tanda isim 2: Tanwin
    16: { t: [/tanwin|alif-lam|mudhaf|ghairu munsharif|mabni|munada mufrad 'alam/gi, ARAB],           // Kapan tanwin hilang dari isim
          ex: { by: { 0: AL, 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } } },
    17: { t: [/tanwin(?: tamkin| tankir| muqabalah| 'iwadh)?/gi], ex: TANWIN },                       // Macam tanwin (4)
    18: { t: [/alif-lam|hamzah washal/gi, /(?<=\()ال(?=\))/g], ex: AL },                              // Tanda isim 3: Alif-Lam
    19: { t: [/alif-lam syamsiyah|alif-lam|tasydid/gi, HURUF_SENDIRI], ex: HURUF_SESUDAH_AL },        // Alif-lam syamsiyah
    20: { t: [/alif-lam qamariyah|alif-lam|sukun/gi, HURUF_SENDIRI], ex: HURUF_SESUDAH_AL },          // Alif-lam qamariyah
    21: { t: [/alif-lam (?:ta'rif|maushul|zaidah)|'ahdiyyah|jinsiyyah|istighraqiyyah|'ahd (?:dzikri|dzihni|hudhuri)/gi, ARAB], ex: AL },   // Macam-macam alif-lam
    22: { t: [/huruf nida'|nida'|munada|nudbah/gi, ARAB],                                             // Tanda isim 4: Nida'
          ex: { by: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 6: 0, 7: 0 } } },
    23: { t: [/musnad ilaih|musnad|mubtada'|na'ibul fa'il|fa'il|isim kana|isim inna/gi],              // Tanda isim 5: Musnad ilaih
          ex: { by: { 0: 0, 1: 1, 2: 1, 3: 1, 4: 1 } } },
    24: { t: [F, /madhi|mudhari'|amr/gi], ex: 'f' },                                                  // Fi'il
    25: { t: [/\u0642\u064E\u062F\u0652|\u0633\u064E\u0648\u0652\u0641\u064E|\u0633\u0650\u064A\u0646/g, /ta' ta'nits sakinah|ta' fa'il|nun taukid|ya' mukhathabah/gi],   // Tanda fi'il (ringkasan)
          ex: { by: { 0: 0, 1: { w: 0, l: 1 }, 2: 0, 3: { w: 0, e: 1 }, 4: { w: 0, e: 1 }, 5: { w: 0, e: 1 }, 6: { w: 0, e: 1 } } } },
    26: { t: [/\u0642\u064E\u062F\u0652/g, /fi'il madhi|fi'il mudhari'|tahqiq|taqrib|taqlil/gi], ex: all(0) },   // Tanda fi'il 1: قَدْ
    27: { t: [/\u0633\u064E\u0648\u0652\u0641\u064E|(?<=\()\u0633\u064E(?=\))/g, /\bsin\b|saufa|fi'il mudhari'/gi],   // Tanda fi'il 2: Sin dan Saufa
          ex: { by: { 0: { w: 0, l: 1 }, 1: { w: 0, l: 1 }, 2: { w: 0, l: 1 }, 3: 0, 4: 0 } } },
    28: { t: [/ta' ta'nits sakinah|ta'/gi], ex: all({ w: 0, e: 1 }) },                                // Tanda fi'il 3: Ta' ta'nits sakinah
    29: { t: [/ta' fa'il|mutakallim|mukhathabah|mukhathab/gi, ARAB],                                  // Tanda fi'il 4: Ta' fa'il
          ex: { by: { 0: { w: 0, e: 1 }, 1: { w: 0, e: 1 }, 2: { w: 0, e: 1 }, 3: { w: 0, e: 3 }, 4: { w: 0, e: 2 }, 5: { w: 0, e: 2 }, 6: { w: 0, e: 2 } } } },
    30: { t: [/nun taukid|ya' mukhathabah|tsaqilah|khafifah/gi, /\u0640[\u0621-\u064A][\u064B-\u0652]*/g],   // Tanda fi'il 5: Nun taukid dan Ya' mukhathabah
          ex: { by: { 0: { w: 0, e: 1 }, 1: { w: 0, e: 1 }, 2: { w: 0, e: 2 }, 3: { w: 0, e: 1 }, 4: { w: 0, c: [-2, -1] } } } },
    31: { t: [/madhi|mudhari'|amr|ta' fa'il|ta' ta'nits sakinah|nun taukid|ya' mukhathabah/gi, HURUF_SENDIRI], ex: 'w' },   // Tiga macam fi'il
    32: { t: [/fi'il madhi|dhamir fa'il|dhamir/gi, ARAB], ex: all({ w: 0, c: [3, null] }) },          // Tasrif fi'il madhi
    33: { t: [/fi'il mudhari'|huruf awal|dhamir/gi, ARAB], ex: all([{ w: 0, l: 1 }, { w: 0, c: [4, null], cls: 'g2' }]) },   // Tasrif fi'il mudhari'
    34: { t: [/fi'il amr|mukhathab|huruf mudhara'ah/gi], ex: all({ w: 0, c: [4, null] }) },           // Tasrif fi'il amr
    35: { t: [/huruf mudhara'ah|fathah|dhammah|ruba'i/gi, ARAB], ex: all({ w: 0, l: 1 }) },           // Huruf mudhara'ah
    36: { t: [H], ex: 'h' },                                                                          // Huruf
    37: { t: [/huruf mabna|huruf ma'na/gi, HURUF_SENDIRI], ex: 'w' },                                 // Huruf mabna dan huruf ma'na
    38: { t: [/huruf ma'ani|\b(?:jar|'athaf|nashab|jazm|nasikh|istifham|nafi|istitsna'|nida'|qasam|tahqiq)\b/gi], ex: 'w' },   // Macam huruf ma'ani
    39: { t: [I, F, H, function (txt) {                                                                // Latihan membedakan isim, fi'il, huruf
            var out = [], re = /([\u0621-\u064A\u0671\u064B-\u0652\u0670]+) = (fi'il|isim|huruf)/g, m, c;
            while ((m = re.exec(txt))) { c = m[2].charAt(0); out.push([m.index, m.index + m[1].length, c]); out.push([m.index + m[0].length - m[2].length, m.index + m[0].length, c]); }
            return out; }], ex: 'all' }
  } };
})();

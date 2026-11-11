'use strict';
/*
 * Pembaca format Microsoft Word -> daftar "blok".
 *   WordImport.fromHtml(html)      teks yang ditempel (Ctrl+C di Word -> Ctrl+V)
 *   WordImport.fromDocx(arrayBuf)  file .docx
 *   WordImport.fromText(teks)      teks polos
 *
 * Setiap blok = satu paragraf Word:
 *   { type: 'text' | 'heading' | 'sub',   judul (Heading 1/Title) | sub bab (Heading 2 dst.)
 *     align: 'right' | 'center' | 'left' | 'justify' | null,   null = ikut bawaan
 *     bold: boolean,
 *     h1: boolean,        true bila gaya "Heading 1" (bukan Title) -> kandidat bab baru
 *     text: string }
 * Tanpa dependensi; .docx dibaca langsung (zip + DecompressionStream bawaan Chromium).
 */
(function (root) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const BIDI_CTRL = /[‎‏‪-‮⁦-⁩﻿]/g;
  // ZWNJ/ZWJ (U+200C/D) sengaja dipertahankan
  const clean = (t) => String(t == null ? '' : t).replace(BIDI_CTRL, '').replace(/[  -​ 　]/g, ' ').replace(/\s+/g, ' ').trim();

  function makeBlock(level, isTitle, align, bold, text) {
    return {
      type: level === 1 ? 'heading' : level >= 2 ? 'sub' : 'text',
      align: align || null,
      bold: level ? false : !!bold,
      h1: level === 1 && !isTitle,
      text
    };
  }

  /* ================= teks polos ================= */
  function fromText(txt) {
    return String(txt || '').split(/\r?\n/).map(clean).filter(Boolean).map((t) => makeBlock(0, false, null, false, t));
  }

  /* ================= HTML (clipboard Word) ================= */
  const SKIP = new Set(['STYLE', 'SCRIPT', 'HEAD', 'TITLE', 'META', 'LINK', 'XML', 'O:P', 'NOSCRIPT']);
  const BLOCK = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'TD', 'TH', 'BLOCKQUOTE', 'PRE', 'CENTER', 'UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TR', 'SECTION', 'ARTICLE', 'DT', 'DD']);

  function cssAlign(v) {
    v = String(v || '').toLowerCase().trim();
    if (v === 'center' || v === '-webkit-center' || v === '-moz-center') return 'center';
    if (v === 'justify' || v === 'justify-all' || v === 'distribute') return 'justify';
    if (v === 'right' || v === 'start' || v === '-webkit-right') return 'right'; // teks Arab = RTL: start = kanan
    if (v === 'left' || v === 'end' || v === '-webkit-left') return 'left';
    return null;
  }

  // aturan "text-align" dari blok <style> Word (mis. p.MsoNormal, h1, div.WordSection1)
  function collectRules(doc) {
    const out = [];
    doc.querySelectorAll('style').forEach((st) => {
      const css = st.textContent.replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      css.replace(/([^{}@]+)\{([^{}]*)\}/g, (_m, sel, body) => {
        const m = /(?:^|;)\s*text-align\s*:\s*([a-z-]+)/i.exec(body);
        if (m) sel.split(',').forEach((s) => { s = s.trim(); if (s) out.push([s, m[1]]); });
        return '';
      });
    });
    return out;
  }

  function fromHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const rules = collectRules(doc);
    // nomor/bullet daftar buatan Word
    doc.querySelectorAll('[style*="mso-list:Ignore" i], [style*="mso-list: Ignore" i]').forEach((n) => n.remove());

    const alignOf = (el) => {
      for (let e = el; e && e.nodeType === 1 && e.tagName !== 'BODY' && e.tagName !== 'HTML'; e = e.parentElement) {
        let a = cssAlign(e.style && e.style.textAlign);
        if (a) return a;
        a = cssAlign(e.getAttribute('align'));
        if (a) return a;
        for (const [sel, val] of rules) {
          let hit = false;
          try { hit = e.matches(sel); } catch (x) { /* selektor Word yang aneh */ }
          if (hit && (a = cssAlign(val))) return a;
        }
        if (e.tagName === 'CENTER') return 'center';
      }
      return null;
    };
    const levelOf = (el) => {
      const m = /^H([1-6])$/.exec(el.tagName);
      if (m) return +m[1];
      const c = el.getAttribute('class') || '';
      if (/\bMsoTitle\b/.test(c)) return 1;
      if (/\bMsoSubtitle\b/.test(c)) return 2;
      return 0;
    };
    const boldNode = (n, top) => {
      for (let e = n.parentElement; e; e = e.parentElement) {
        if (e.tagName === 'B' || e.tagName === 'STRONG') return true;
        const fw = e.style && e.style.fontWeight;
        if (fw && (fw === 'bold' || fw === 'bolder' || +fw >= 600)) return true;
        if (e === top) break;
      }
      return false;
    };
    const allBold = (top, nodes) => {
      let any = false;
      for (const n of nodes) {
        if (!clean(n.nodeValue)) continue;
        any = true;
        if (!boldNode(n, top)) return false;
      }
      return any;
    };
    const textNodes = (el) => {
      const arr = [];
      const w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) arr.push(n);
      return arr;
    };
    const hasBlockChild = (el) => !!el.querySelector('p,h1,h2,h3,h4,h5,h6,li,div,table,ul,ol,blockquote,pre,center,tr');

    const out = [];
    const emit = (el, nodes) => {
      const text = clean(nodes.map((n) => n.nodeValue).join(''));
      if (!text) return;
      const lv = el.nodeType === 1 ? levelOf(el) : 0;
      const isTitle = el.nodeType === 1 && /\bMsoTitle\b/.test(el.getAttribute('class') || '');
      out.push(makeBlock(lv, isTitle, alignOf(el), allBold(el, nodes), text));
    };
    const walk = (el) => {
      let buf = [];
      const flush = () => {
        if (buf.length) {
          const nodes = buf.flatMap((n) => (n.nodeType === 3 ? [n] : textNodes(n)));
          emit(el, nodes);
          buf = [];
        }
      };
      el.childNodes.forEach((c) => {
        if (c.nodeType === 3) { buf.push(c); return; }
        if (c.nodeType !== 1) return;
        const tag = c.tagName;
        if (SKIP.has(tag)) return;
        if (tag === 'BR') { flush(); return; }
        if (BLOCK.has(tag) || hasBlockChild(c)) {
          flush();
          if (hasBlockChild(c)) walk(c); else emit(c, textNodes(c));
        } else buf.push(c);
      });
      flush();
    };
    walk(doc.body);
    return out;
  }

  /* ================= .docx ================= */
  async function inflateRaw(u8) {
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function readZipIndex(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Bukan file .docx (zip tidak valid).');
    const n = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const td = new TextDecoder('utf-8'), files = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      files[td.decode(u8.subarray(p + 46, p + 46 + nlen))] = { method, csize, lho };
      p += 46 + nlen + elen + clen;
    }
    return { u8, dv, files };
  }

  async function zipText(z, name) {
    const f = z.files[name];
    if (!f) return null;
    const nlen = z.dv.getUint16(f.lho + 26, true), elen = z.dv.getUint16(f.lho + 28, true);
    const start = f.lho + 30 + nlen + elen;
    let data = z.u8.subarray(start, start + f.csize);
    if (f.method === 8) data = await inflateRaw(data);
    else if (f.method !== 0) throw new Error('Metode kompresi zip tidak didukung.');
    return new TextDecoder('utf-8').decode(data);
  }

  const parseXml = (s) => {
    const d = new DOMParser().parseFromString(s, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) throw new Error('XML .docx rusak.');
    return d;
  };
  const tags = (el, name) => Array.from(el.getElementsByTagNameNS(W, name));
  const child = (el, name) => (el ? Array.from(el.children).find((c) => c.namespaceURI === W && c.localName === name) || null : null);
  const wa = (el, name) => (el ? (el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name)) : null);
  const onoff = (el) => !!el && !/^(0|false|off)$/i.test(wa(el, 'val') || '');
  const hasAnc = (el, name, stop) => { for (let e = el.parentElement; e && e !== stop; e = e.parentElement) if (e.namespaceURI === W && e.localName === name) return true; return false; };

  function parseStyles(doc) {
    const map = {};
    let defJc = null, defBidi = false;
    const dd = tags(doc, 'docDefaults')[0];
    const dp = dd && child(child(dd, 'pPrDefault'), 'pPr');
    if (dp) { defJc = wa(child(dp, 'jc'), 'val'); defBidi = onoff(child(dp, 'bidi')); }
    tags(doc, 'style').forEach((st) => {
      if (wa(st, 'type') !== 'paragraph') return;
      const ppr = child(st, 'pPr'), rpr = child(st, 'rPr');
      map[wa(st, 'styleId')] = {
        name: wa(child(st, 'name'), 'val') || '',
        basedOn: wa(child(st, 'basedOn'), 'val'),
        jc: ppr && child(ppr, 'jc') ? wa(child(ppr, 'jc'), 'val') : undefined,
        bidi: ppr && child(ppr, 'bidi') ? onoff(child(ppr, 'bidi')) : undefined,
        outline: ppr && child(ppr, 'outlineLvl') ? +wa(child(ppr, 'outlineLvl'), 'val') : undefined,
        bold: rpr && child(rpr, 'b') ? onoff(child(rpr, 'b')) : undefined
      };
    });
    const resolve = (id, key) => {
      for (let i = 0; id && map[id] && i < 12; i++, id = map[id].basedOn) if (map[id][key] !== undefined) return map[id][key];
      return undefined;
    };
    return { map, resolve, defJc, defBidi };
  }

  function mapJc(jc, bidi) {
    switch (jc) {
      case 'center': return 'center';
      case 'both': case 'distribute': case 'thaiDistribute': case 'lowKashida': case 'mediumKashida': case 'highKashida': return 'justify';
      // pada paragraf RTL Word menulis left/right terbalik (left = awal = kanan)
      case 'left': case 'start': return bidi ? 'right' : 'left';
      case 'right': case 'end': return bidi ? 'left' : 'right';
      default: return null;
    }
  }

  async function fromDocx(buf) {
    const z = readZipIndex(buf);
    const docXml = await zipText(z, 'word/document.xml');
    if (!docXml) throw new Error('word/document.xml tidak ditemukan — bukan file .docx.');
    const stXml = await zipText(z, 'word/styles.xml');
    const st = stXml ? parseStyles(parseXml(stXml)) : { map: {}, resolve: () => undefined, defJc: null, defBidi: false };
    const doc = parseXml(docXml);
    const body = tags(doc, 'body')[0] || doc.documentElement;
    const out = [];

    tags(body, 'p').forEach((p) => {
      if (hasAnc(p, 'p', body)) return; // isi kotak teks
      const ppr = child(p, 'pPr');
      const sid = ppr && child(ppr, 'pStyle') ? wa(child(ppr, 'pStyle'), 'val') : null;
      const sname = (sid && st.map[sid] && st.map[sid].name) || sid || '';

      let level = 0, isTitle = false, m;
      if ((m = /^heading\s*(\d)$/i.exec(sname))) level = +m[1];
      else if (/^title$/i.test(sname)) { level = 1; isTitle = true; }
      else if (/^subtitle$/i.test(sname)) level = 2;
      else {
        const ol = ppr && child(ppr, 'outlineLvl') ? +wa(child(ppr, 'outlineLvl'), 'val') : st.resolve(sid, 'outline');
        if (Number.isInteger(ol) && ol >= 0 && ol < 9) level = ol + 1;
      }

      const bidi = ppr && child(ppr, 'bidi') ? onoff(child(ppr, 'bidi')) : (st.resolve(sid, 'bidi') ?? st.defBidi);
      const jc = ppr && child(ppr, 'jc') ? wa(child(ppr, 'jc'), 'val') : (st.resolve(sid, 'jc') ?? st.defJc);

      const runs = tags(p, 'r').filter((r) => !hasAnc(r, 'del', p));
      const parts = [], bolds = [];
      const styleBold = st.resolve(sid, 'bold');
      runs.forEach((r) => {
        let t = '';
        Array.from(r.children).forEach((c) => {
          if (c.namespaceURI !== W) return;
          if (c.localName === 't') t += c.textContent;
          else if (c.localName === 'tab' || c.localName === 'br' || c.localName === 'cr') t += ' ';
          else if (c.localName === 'noBreakHyphen') t += '-';
        });
        if (!clean(t)) { parts.push(t); return; }
        parts.push(t);
        const rpr = child(r, 'rPr');
        bolds.push(rpr && child(rpr, 'b') ? onoff(child(rpr, 'b')) : !!styleBold);
      });
      const text = clean(parts.join(''));
      if (!text) return;
      out.push(makeBlock(level, isTitle, mapJc(jc, bidi), bolds.length > 0 && bolds.every(Boolean), text));
    });
    return out;
  }

  root.WordImport = { fromHtml, fromText, fromDocx };
})(window);

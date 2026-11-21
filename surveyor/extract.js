/* Pull vehicle details out of an uploaded PDF (RC, policy, earlier report) or a photo of one.
   Text PDFs are read with pdf.js. Scanned PDFs and photos fall back to OCR (Tesseract, loaded on demand). */
(function () {
  const BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  let pdfjs;
  async function getPdfjs() {
    if (!pdfjs) {
      pdfjs = await import(BASE + 'vendor/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = BASE + 'vendor/pdf.worker.min.mjs';
    }
    return pdfjs;
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the text reader. Check the internet connection.'));
      document.head.appendChild(s);
    });
  }

  /* ---------- Read the file into positioned text items {x0, x1, top, h, str} ---------- */
  async function pdfItems(file, progress) {
    const lib = await getPdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    let chars = 0;
    for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const items = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const [, , , d, e, f] = it.transform;
        const h = Math.abs(d) || it.height || 8;
        items.push({ x0: e, x1: e + (it.width || it.str.length * h * 0.5), top: vp.height - f - h, h, str: it.str });
        chars += it.str.trim().length;
      }
      pages.push({ items, page, vp });
    }
    if (chars > 40) return pages.map((p) => p.items);
    // Scanned PDF: render pages and OCR them
    progress && progress('This PDF is a scan. Reading the text from the image…');
    const out = [];
    for (const [i, p] of pages.slice(0, 3).entries()) {
      const scale = 2.2;
      const vp = p.page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await p.page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      progress && progress(`Reading page ${i + 1} of ${Math.min(pages.length, 3)}…`);
      out.push(await ocr(c));
    }
    return out;
  }

  async function ocr(source) {
    if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    const { data } = await window.Tesseract.recognize(source, 'eng');
    const items = [];
    (data.words || []).forEach((w) => {
      if (!w.text || !w.text.trim()) return;
      items.push({ x0: w.bbox.x0, x1: w.bbox.x1, top: w.bbox.y0, h: w.bbox.y1 - w.bbox.y0, str: w.text });
    });
    return items;
  }

  async function imageItems(file, progress) {
    progress && progress('Reading the text from the photo…');
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That image could not be opened.')); i.src = URL.createObjectURL(file); });
    const s = Math.min(1, 2400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = img.width * s; c.height = img.height * s;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return [await ocr(c)];
  }

  /* ---------- Items -> lines -> segments ---------- */
  function toLines(items) {
    const sorted = items.slice().sort((a, b) => a.top - b.top || a.x0 - b.x0);
    const lines = [];
    for (const it of sorted) {
      const mid = it.top + it.h / 2;
      let line = lines.find((l) => Math.abs(l.mid - mid) < Math.max(3, Math.min(l.h, it.h) * 0.55));
      if (!line) { line = { mid, h: it.h, items: [] }; lines.push(line); }
      line.items.push(it);
    }
    lines.sort((a, b) => a.mid - b.mid);
    return lines.map((l) => {
      const its = l.items.sort((a, b) => a.x0 - b.x0);
      const segs = [];
      for (const it of its) {
        const last = segs[segs.length - 1];
        const gap = last ? it.x0 - last.x1 : Infinity;
        if (last && gap < Math.max(4, l.h * 1.3)) { last.text += (gap > l.h * 0.15 ? ' ' : '') + it.str; last.x1 = Math.max(last.x1, it.x1); }
        else segs.push({ x0: it.x0, x1: it.x1, text: it.str });
      }
      segs.forEach((s) => (s.text = s.text.replace(/\s+/g, ' ').trim()));
      return { mid: l.mid, h: l.h, segs: segs.filter((s) => s.text) };
    });
  }

  /* ---------- Labels ---------- */
  // Order matters only for ties; the longest match at a position wins.
  const LABELS = [
    ['ownerSerial', /owner\s*s(?:e)?r(?:ial)?\.?\s*(?:no\.?|number)?|ownership\s*(?:serial|sr\.?)\s*(?:no\.?)?|owner\s*serial(?:\s*no\.?)?/],
    ['regDate', /(?:date\s*of\s*)?reg(?:istration|n|d)?\.?\s*(?:date|dt\.?)|date\s*of\s*reg(?:istration|n)?\.?|registered\s*on|date\s*of\s*first\s*registration/],
    ['regNo', /(?:vehicle\s*)?reg(?:istration|n|d)?\.?\s*(?:no\.?|number|num)|registration\s*mark|vehicle\s*(?:no\.?|number)|veh\.?\s*no\.?/],
    ['chassisNo', /chass?is\s*(?:no\.?|number|num)?|vin(?:\s*no\.?)?/],
    ['engineNo', /engine\s*(?:\/\s*motor\s*)?(?:no\.?|number)|motor\s*(?:no\.?|number)/],
    ['ownerName', /registered\s*owner(?:'?s)?(?:\s*name)?(?:\s*(?:&|and)\s*address)?|owner(?:'?s)?\s*name|name\s*of\s*(?:the\s*)?(?:registered\s*)?owner|insured(?:'?s)?\s*name|name\s*of\s*(?:the\s*)?insured|name\s*(?:&|and)\s*address\s*of\s*registered\s*owner/],
    ['propOwner', /proposed\s*owner(?:\s*(?:&|and)\s*address)?|proposer(?:'?s)?(?:\s*name)?/],
    ['ignore', /s\s*\/\s*w\s*\/\s*d\s*o(?:f)?|son\s*\/\s*wife\s*\/\s*daughter\s*of|father(?:'?s)?\s*name|husband(?:'?s)?\s*name/],
    ['address', /(?:present|permanent|communication|owner(?:'?s)?|insured(?:'?s)?|correspondence)?\s*address/],
    ['makeModel', /make\s*\/\s*model(?:\s*\/\s*variant)?|maker\s*\/\s*model|vehicle\s*make\s*(?:&|and)\s*model|make\s*(?:&|and)\s*model/],
    ['maker', /maker(?:'?s)?(?:\s*name)?|manufacturer(?:'?s)?(?:\s*name)?|vehicle\s*make|make/],
    ['model', /maker(?:'?s)?\s*model|model(?:\s*name)?|vehicle\s*model|variant/],
    ['vehicleClass', /vehicle\s*class|class\s*of\s*vehicle|veh\.?\s*class|vehicle\s*category/],
    ['bodyType', /body\s*type|type\s*of\s*body|vehicle\s*description/],
    ['mfgYear', /(?:month\s*(?:&|and|\/)?\s*)?year\s*of\s*(?:manufactur\w*|mfg\.?)|mfg\.?\s*(?:date|month|yr\.?|year)(?:\s*\/\s*year)?|manufactur\w*\s*(?:date|month|year)(?:\s*(?:&|\/)\s*year)?|month\s*\/\s*year\s*of\s*mfg|yom/],
    ['ignore', /(?:fuel\s*|emission\s*)norms|bharat\s*stage/],
    ['fuel', /fuel(?:\s*(?:type|used))?|type\s*of\s*fuel/],
    ['colour', /colou?r/],
    ['odometer', /odometer(?:\s*reading)?|kms?\.?\s*reading/],
    ['hypothecation', /hypothecat\w*(?:\s*details)?(?:\s*\(\s*if\s*any\s*\))?|financ(?:er|ier)(?:'?s)?(?:\s*name)?|hp\s*with|financed\s*by|hypothecated\s*to/],
    ['fitnessUpto', /fitness\s*(?:valid\s*)?(?:up\s*to|upto|till|validity)|fitness\s*valid|fit\.?\s*upto/],
    ['permitUpto', /permit\s*(?:valid\s*)?(?:up\s*to|upto|till|validity)|permit\s*valid/],
    ['insUpto', /insurance\s*(?:valid\s*)?(?:up\s*to|upto|till|validity|expiry)|policy\s*(?:valid\s*)?(?:up\s*to|upto|expiry|end\s*date)|period\s*of\s*insurance/],
    ['policyNo', /policy\s*(?:no\.?|number)/],
    ['insurer', /insurer(?:'?s)?(?:\s*name)?|insurance\s*company(?:\s*name)?|insurance\s*details/],
    ['ignore', /seat(?:ing)?\s*capacity|cubic\s*capacity|engine\s*capacity|(?:gross|unladen|laden)\s*(?:vehicle\s*)?weight|gvw|ulw|rlw|wheel\s*base|no\.?\s*of\s*cyl(?:inders)?|tax\s*(?:valid\s*)?(?:up\s*to|upto|paid\s*upto)|registering\s*authority|issuing\s*authority|report\s*no\.?|inspection\s*date\s*(?:&|and)\s*time|inspected\s*at|standing\s*capacity|sleeper\s*capacity|horse\s*power|norms|mobile(?:\s*no\.?)?|phone|e-?mail|pin\s*code|state|rto|date|place|time|type\s*of\s*vehicle|validity|status|remarks?/],
  ];
  // Split each pattern into its top-level alternatives so the longest one can win.
  function alternatives(src) {
    const out = []; let depth = 0, cur = '', inClass = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '\\') { cur += ch + src[++i]; continue; }
      if (ch === '[') inClass = true; else if (ch === ']') inClass = false;
      else if (!inClass && ch === '(') depth++; else if (!inClass && ch === ')') depth--;
      if (ch === '|' && depth === 0 && !inClass) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }
  const STICKY = LABELS.flatMap(([key, r]) => alternatives(r.source).map((a) => [key, new RegExp(a, 'iy')]));

  // At each word start, try every label and keep the longest match.
  function findLabels(str) {
    const out = [];
    let i = 0;
    while (i < str.length) {
      if (!/[a-z]/i.test(str[i]) || (i > 0 && /[a-z0-9]/i.test(str[i - 1]))) { i++; continue; }
      let best = null;
      for (const [key, re] of STICKY) {
        re.lastIndex = i;
        const m = re.exec(str);
        if (m && m[0] && (!best || m[0].length > best.len)) best = { key, len: m[0].length };
      }
      if (best) {
        const start = i, end = i + best.len;
        const before = str.slice(0, start), after = str.slice(end);
        const wordEnd = /^($|[^a-z0-9])/i.test(after);
        const okBefore = /(^|[\s¦|:,(])$/.test(before);
        const okAfter = /^(\s*[:\-–=¦|]|\s*$)/.test(after) || /(^|¦\s*)$/.test(before);
        if (wordEnd && okBefore && okAfter) { out.push({ key: best.key, start, end }); i = end; continue; }
      }
      i++;
    }
    return out;
  }

  const clean = (s) => s.replace(/¦/g, ' ').replace(/^[\s:;\-–=.|]+/, '').replace(/[\s,;|:]+$/, '').replace(/\s+/g, ' ').trim();
  const empty = (v) => !v || /^(-+|na|n\.a\.?|nil|none|not\s*available|\.+|\*+)$/i.test(v);

  function extractPairs(lines) {
    const found = {};
    lines.forEach((line, li) => {
      // build the line string and remember where each segment sits
      let str = '';
      const map = [];
      line.segs.forEach((s, i) => { if (i) str += ' ¦ '; map.push({ from: str.length, to: str.length + s.text.length, seg: s }); str += s.text; });
      const labels = findLabels(str);
      labels.forEach((lab, i) => {
        const next = labels[i + 1];
        let val = clean(str.slice(lab.end, next ? next.start : str.length));
        if (empty(val)) {
          // value may sit on the next line, under the label
          const seg = (map.find((m) => lab.start >= m.from && lab.start <= m.to) || {}).seg;
          if (seg) {
            for (const nl of lines.slice(li + 1, li + 3)) {
              const under = nl.segs.find((s) => s.x0 < seg.x1 + 4 && s.x1 > seg.x0 - 4);
              if (under) {
                if (findLabels(under.text).some((l) => l.start === 0)) break;
                val = clean(under.text);
                break;
              }
            }
          }
        }
        if (lab.key === 'ignore' || empty(val)) return;
        if (!found[lab.key]) found[lab.key] = val;
      });
    });
    return found;
  }

  /* ---------- Normalise values ---------- */
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');
  function date(v) {
    if (!v) return '';
    let m = v.match(/(\d{1,2})[\s./-]+(\d{1,2})[\s./-]+(\d{4})/);
    if (m) return `${pad(m[1])}/${pad(m[2])}/${m[3]}`;
    m = v.match(/(\d{1,2})[\s./-]*([a-z]{3})[a-z]*[\s./,-]*(\d{4})/i);
    if (m && MONTHS[m[2].toLowerCase()]) return `${pad(m[1])}/${pad(MONTHS[m[2].toLowerCase()])}/${m[3]}`;
    m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return v.split(/\s{2,}/)[0];
  }
  function mfg(v) {
    if (!v) return '';
    let m = v.match(/\b(\d{1,2})[\s./-]+(\d{4})\b/);
    if (m && +m[1] <= 12 && !/\d{1,2}[\s./-]+\d{1,2}[\s./-]+\d{4}/.test(v)) return `${pad(m[1])}/${m[2]}`;
    m = v.match(/\b([a-z]{3})[a-z]*[\s./,-]*(\d{4})\b/i);
    if (m && MONTHS[m[1].toLowerCase()]) return `${pad(MONTHS[m[1].toLowerCase()])}/${m[2]}`;
    m = v.match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : v;
  }
  const REG = /\b([A-Z]{2})[\s-]?(\d{1,2})[\s-]?([A-Z]{0,3})[\s-]?(\d{1,4})\b|\b(\d{2})[\s-]?BH[\s-]?(\d{4})[\s-]?([A-Z]{1,2})\b/;
  function reg(v) {
    if (!v) return '';
    const m = v.toUpperCase().match(REG);
    return m ? m[0].replace(/[\s-]/g, '') : '';
  }
  const ident = (v) => (v || '').toUpperCase().replace(/[^A-Z0-9*]/g, '');
  function fuel(v) {
    const s = (v || '').toUpperCase();
    const parts = [];
    if (/PETROL|GASOLINE/.test(s)) parts.push('Petrol');
    if (/DIESEL/.test(s)) parts.push('Diesel');
    if (/CNG/.test(s)) parts.push('CNG');
    if (/LPG/.test(s)) parts.push('LPG');
    if (/ELECTRIC|BOV|\bEV\b|BATTERY/.test(s)) parts.push('Electric');
    if (/HYBRID/.test(s) && !parts.length) parts.push('Hybrid');
    return parts.length ? parts.join('/') : (v || '');
  }
  const title = (v) => (v || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  function cut(v, n = 120) { return (v || '').slice(0, n).trim(); }

  function normalise(raw, allText) {
    const x = {};
    x.regNo = reg(raw.regNo) || reg(allText.match(/(?:reg(?:istration|n)?\.?\s*(?:no|number)\.?|vehicle\s*no\.?)\s*[:\-]?\s*([A-Z0-9 -]{6,14})/i)?.[1] || '');
    if (!x.regNo) { const m = allText.toUpperCase().match(new RegExp(REG.source, 'g')); if (m) x.regNo = m.map((s) => s.replace(/[\s-]/g, '')).find((s) => /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/.test(s) || /BH/.test(s)) || ''; }
    x.chassisNo = ident(raw.chassisNo).slice(0, 25);
    if (!x.chassisNo || x.chassisNo.length < 6) { const m = allText.toUpperCase().match(/\bM[A-Z][A-HJ-NPR-Z0-9]{15}\b/); x.chassisNo = m ? m[0] : ''; }
    x.engineNo = ident(raw.engineNo).slice(0, 25);
    if (x.engineNo.length < 4) x.engineNo = '';
    let owner = cut(raw.ownerName || raw.propOwner || '');
    let address = cut(raw.address || '', 160);
    // "MR. NAME , Vill : Charama" style: name and address together
    if (!address && /\s,\s|,\s*(vill|village|ward|h\.?\s*no|at|post|po)\b/i.test(owner)) {
      const i = owner.indexOf(',');
      address = owner.slice(i + 1).trim(); owner = owner.slice(0, i).trim();
    }
    x.ownerName = owner.toUpperCase();
    x.address = address;
    x.makeModel = cut(raw.makeModel);
    x.maker = cut(raw.maker);
    x.model = cut(raw.model);
    if (x.maker && x.model && x.model.toUpperCase().startsWith(x.maker.toUpperCase())) x.model = x.model.slice(x.maker.length).trim();
    x.vehicleClass = cut(raw.vehicleClass);
    x.bodyType = cut(raw.bodyType);
    x.mfgYear = mfg(raw.mfgYear);
    x.regDate = date(raw.regDate);
    x.fuel = fuel(raw.fuel);
    x.colour = title(cut(raw.colour, 40));
    const odo = (raw.odometer || '').replace(/[^\d]/g, '');
    x.odometer = odo ? odo + ' km' : '';
    x.ownerSerial = (raw.ownerSerial || '').match(/\d+/)?.[0] || '';
    x.hypothecation = cut(raw.hypothecation);
    x.fitnessUpto = date(raw.fitnessUpto);
    x.permitUpto = date(raw.permitUpto);
    x.insUpto = date(raw.insUpto);
    x.policyNo = cut(raw.policyNo, 40);
    x.insurer = cut(raw.insurer);
    Object.keys(x).forEach((k) => { if (empty(x[k])) delete x[k]; });
    return x;
  }

  async function fromFile(file, progress) {
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    const pages = isPdf ? await pdfItems(file, progress) : await imageItems(file, progress);
    const lines = pages.flatMap(toLines);
    const raw = extractPairs(lines);
    const allText = lines.map((l) => l.segs.map((s) => s.text).join('  ')).join('\n');
    const x = normalise(raw, allText);
    x._raw = raw;
    window.SV_LAST_EXTRACT = { raw, x, text: allText };
    return x;
  }

  window.SV_EXTRACT = { fromFile, _test: { toLines, extractPairs, normalise } };
})();

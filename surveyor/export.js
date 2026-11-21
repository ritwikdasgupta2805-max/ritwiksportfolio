/* Export the current report as PDF (html2canvas + jsPDF) or Word (.docx built with docx.js). */
(function () {
  const BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  const loaded = {};
  function load(src) {
    if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = BASE + src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  function fileName(tpl, state, ext) {
    const d = state.data;
    const id = (d.vehicleNo || d.regNo || '').replace(/[^A-Za-z0-9]/g, '');
    const kind = tpl.style === 'val' ? 'Valuation' : 'PreInspection-' + tpl.name.replace(/\s+/g, '');
    const today = new Date();
    const dt = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    return `${kind}${id ? '-' + id : ''}-${dt}.${ext}`;
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------------- PDF ---------------- */
  async function pdf(tpl, state, api) {
    await Promise.all([load('vendor/html2canvas.min.js'), load('vendor/jspdf.umd.min.js')]);
    const host = document.createElement('div');
    host.className = 'print-host';
    host.innerHTML = api.sheetHTML(tpl, state);
    document.body.appendChild(host);
    try {
      await document.fonts.ready;
      await Promise.all([...host.querySelectorAll('img')].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
      const sheet = host.firstElementChild;
      const canvas = await window.html2canvas(sheet, { scale: 2.5, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 900 });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const pw = 210, ph = 297;
      const pxPerMm = canvas.width / pw;
      const pageH = Math.floor(ph * pxPerMm);
      if (canvas.height <= pageH * 1.12) {
        const hmm = canvas.height / pxPerMm, s = Math.min(1, ph / hmm);
        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pw - pw * s) / 2, 0, pw * s, hmm * s);
        download(doc.output('blob'), fileName(tpl, state, 'pdf'));
        return;
      }
      let y = 0;
      while (y < canvas.height - 4) {
        const h = Math.min(pageH, canvas.height - y);
        const part = document.createElement('canvas');
        part.width = canvas.width; part.height = h;
        const ctx = part.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, part.width, h);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (y > 0) doc.addPage();
        doc.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, h / pxPerMm);
        y += h;
      }
      doc.setProperties({ title: `${tpl.name} – ${state.data.vehicleNo || state.data.regNo || ''}`, author: 'Chhatrapal Sao' });
      download(doc.output('blob'), fileName(tpl, state, 'pdf'));
    } finally {
      host.remove();
    }
  }

  /* ---------------- Word ---------------- */
  const THEME = { khaki: 'EDE4C2', slate: 'D6DCE7', sage: 'DDE4CC', plain: 'FFFFFF' };
  const INK = '14206B';

  async function svgToPng(svg, w, h) {
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `));
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const c = document.createElement('canvas');
    c.width = w * 3; c.height = h * 3;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return dataUrlBytes(c.toDataURL('image/png'));
  }
  function dataUrlBytes(url) {
    const b64 = url.split(',')[1];
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function imgSize(url) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.width, h: i.height }); i.onerror = () => res({ w: 1, h: 1 }); i.src = url; });
  }

  async function docx(tpl, state, api) {
    await load('vendor/docx.min.js');
    const D = window.docx;
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
      AlignmentType, VerticalAlign, ImageRun, Footer, TableLayoutType } = D;
    const d = state.data;
    const PAGE_W = 11906, MARGIN = 640, CW = PAGE_W - MARGIN * 2;
    const SZ = tpl.style === 'val' ? 17 : 16; // 8–8.5pt, close to the on-screen sheet
    const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const LINE = { style: BorderStyle.SINGLE, size: 4, color: '333333' };
    const allBorders = (b) => ({ top: b, bottom: b, left: b, right: b });

    const run = (text, o = {}) => new TextRun({ text, font: 'Arial', size: o.size || SZ, bold: o.bold, italics: o.italics, underline: o.underline ? {} : undefined, color: o.color, break: o.break });

    // Turn template "parts" into runs. Returns { runs, areas } where areas are multi-line fields shown below.
    function partsRuns(parts, base = {}) {
      const list = Array.isArray(parts) ? parts : [parts];
      const runs = [], areas = [];
      for (const p of list) {
        if (p == null || p === '') continue;
        if (typeof p === 'string') { runs.push(run(p, base)); continue; }
        if (p.b != null) { runs.push(run(p.b, { ...base, bold: true })); continue; }
        if (p.f) {
          const v = d[p.f] || '';
          if (p.area) { areas.push(v); continue; }
          if (v) runs.push(run(v, { ...base, bold: base.bold || p.bold, color: INK }));
          else if (p.w || p.line) runs.push(run(' '.repeat(Math.max(6, Math.round((p.w || 200) / 6))), base));
          continue;
        }
        if (p.o) {
          const v = d[p.o] || '';
          p.opts.forEach((o, i) => {
            if (i) runs.push(run(p.sep || '/', base));
            if (o === v) runs.push(new TextRun({ text: o, font: 'Arial', size: base.size || SZ, bold: base.bold, color: INK, border: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 1 } }));
            else runs.push(run(o, base));
          });
          continue;
        }
        if (p.k) { runs.push(run(d[p.k] || '', { ...base, color: INK, bold: true })); continue; }
        if (p.p) { runs.push(run(d[p.p] || '', { ...base, color: INK })); continue; }
      }
      return { runs, areas };
    }

    function cellParas(content, cls = '', tcls = '') {
      const c = cls.split(' ');
      const base = {
        bold: c.includes('band') || c.includes('title') || c.includes('strong') || c.includes('big'),
        underline: c.includes('u'),
        size: c.includes('title') ? 22 : c.includes('big') ? 19 : c.includes('sm') ? 12 : c.includes('v13') ? 21 : tcls.includes('split') ? 15 : /\bv(t|acc)\b/.test(tcls) ? 20 : undefined,
      };
      const align = c.includes('c') || c.includes('title') ? AlignmentType.CENTER : c.includes('r') ? AlignmentType.RIGHT : AlignmentType.LEFT;
      const { runs, areas } = partsRuns(content, base);
      const paras = [new Paragraph({ children: runs.length ? runs : [run('')], alignment: align, spacing: { before: 0, after: 0 } })];
      areas.forEach((v) => {
        const lines = (v || '').split('\n');
        paras.push(new Paragraph({ children: lines.map((ln, i) => run(ln, { color: INK, break: i ? 1 : 0 })), spacing: { before: 20, after: 0 } }));
      });
      return paras;
    }

    function table(b) {
      const widths = b.cols.map((w) => Math.round((w / 100) * CW));
      const noBorder = b.border === 'none';
      const rows = b.rows.map((r) => {
        let col = 0;
        const cells = r.map((cell) => {
          const c = cell && typeof cell === 'object' && !Array.isArray(cell) && 'c' in cell ? cell : { c: cell };
          const span = c.span || 1;
          const w = widths.slice(col, col + span).reduce((a, x) => a + x, 0);
          col += span;
          const cls = c.cls || '';
          let borders = noBorder ? allBorders(NONE) : allBorders(LINE);
          if (cls.includes('gap')) borders = { top: NONE, bottom: NONE, left: LINE, right: LINE };
          if (noBorder && cls.includes('vr')) borders = { ...allBorders(NONE), right: LINE };
          const shaded = (cls.includes('band') || cls.includes('title')) && tpl.theme !== 'plain';
          const minH = cls.includes('impr') ? 2 : 0;
          const paras = cellParas(c.c, cls, b.cls || '');
          for (let i = 0; i < minH; i++) paras.push(new Paragraph({ children: [run('')] }));
          return new TableCell({
            children: paras,
            columnSpan: span > 1 ? span : undefined,
            rowSpan: c.rowspan || undefined,
            width: { size: w, type: WidthType.DXA },
            borders,
            verticalAlign: cls.includes('top') ? VerticalAlign.TOP : VerticalAlign.CENTER,
            shading: shaded ? { type: ShadingType.CLEAR, color: 'auto', fill: THEME[tpl.theme] } : undefined,
            margins: { top: noBorder ? 6 : 12, bottom: noBorder ? 6 : 12, left: noBorder ? 30 : 60, right: noBorder ? 30 : 60 },
          });
        });
        return new TableRow({ children: cells });
      });
      return new Table({ rows, width: { size: CW, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED });
    }

    const gap = (pt = 4) => new Paragraph({ children: [new TextRun({ text: '', size: pt * 2 })], spacing: { before: 0, after: 0, line: pt * 20, lineRule: D.LineRuleType.EXACT } });

    const stampUrl = api.getStamp();
    let stampImg = null;
    if (stampUrl) {
      const s = await imgSize(stampUrl);
      const w = tpl.style === 'val' ? 110 : 84, h = Math.round((w * s.h) / s.w);
      stampImg = new ImageRun({ type: 'png', data: dataUrlBytes(stampUrl), transformation: { width: w, height: Math.min(h, tpl.style === 'val' ? 120 : 90) } });
    }

    async function letterhead() {
      const L = api.LH[tpl.style];
      const leftParas = [
        new Paragraph({ children: [run(api.LH.name, { bold: true, size: 40 })], spacing: { after: 20 } }),
        ...L.left.map((t) => new Paragraph({ children: [run(t, { size: tpl.style === 'val' ? 22 : 17 })], spacing: { after: 0 } })),
      ];
      const rightParas = L.right.map((t) => new Paragraph({ children: [run(t, { size: tpl.style === 'val' ? 20 : 17 })], alignment: tpl.style === 'val' ? AlignmentType.LEFT : AlignmentType.RIGHT }));
      const cells = [];
      let colW = [];
      const bottom = tpl.style === 'val' ? { ...allBorders(NONE), bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' } } : allBorders(NONE);
      if (tpl.style === 'val') {
        colW = [Math.round(CW * 0.58), CW - Math.round(CW * 0.58)];
        cells.push(new TableCell({ children: leftParas, width: { size: Math.round(CW * 0.58), type: WidthType.DXA }, borders: bottom, verticalAlign: VerticalAlign.BOTTOM }));
        cells.push(new TableCell({ children: rightParas, width: { size: CW - Math.round(CW * 0.58), type: WidthType.DXA }, borders: bottom, verticalAlign: VerticalAlign.BOTTOM }));
      } else {
        const artW = tpl.art === 'commercial' ? 186 : tpl.art === 'bike' ? 120 : 150;
        const artH = tpl.art === 'commercial' ? 44 : 48;
        const png = await svgToPng(api.ART[tpl.art], artW, artH);
        const widths = [Math.round(CW * 0.4), Math.round(CW * 0.3)];
        widths.push(CW - widths[0] - widths[1]);
        colW = widths;
        cells.push(new TableCell({ children: leftParas, width: { size: widths[0], type: WidthType.DXA }, borders: bottom, verticalAlign: VerticalAlign.BOTTOM }));
        cells.push(new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: png, transformation: { width: artW, height: artH } })] })], width: { size: widths[1], type: WidthType.DXA }, borders: bottom, verticalAlign: VerticalAlign.CENTER }));
        cells.push(new TableCell({ children: rightParas, width: { size: widths[2], type: WidthType.DXA }, borders: bottom, verticalAlign: VerticalAlign.BOTTOM }));
      }
      return new Table({ rows: [new TableRow({ children: cells })], width: { size: CW, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: colW });
    }

    const children = [];
    for (const b of tpl.blocks) {
      if (b.t === 'letterhead') { children.push(await letterhead()); children.push(gap(6)); }
      else if (b.t === 'table') { children.push(table(b)); children.push(gap(tpl.style === 'val' ? 2 : 5)); }
      else if (b.t === 'text') {
        const cls = b.cls || '';
        if (cls.includes('vtitle')) {
          children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run('VALUATION  REPORT', { bold: true, underline: true, size: 26 })], spacing: { after: 60 } }));
          continue;
        }
        const isSec = /\bvsec\b/.test(cls);
        const base = {
          bold: isSec,
          italics: isSec,
          underline: isSec || /\bvsub\b/.test(cls),
          size: /v13|vsec/.test(cls) ? 21 : /v12|vsub|vmv/.test(cls) ? 20 : undefined,
        };
        const { runs, areas } = partsRuns(b.parts, base);
        children.push(new Paragraph({ children: runs, spacing: { before: /vsec|vgap/.test(cls) ? 140 : cls.includes('prej') ? 60 : tpl.style === 'val' ? 50 : 30, after: cls.includes('prej') ? 30 : 30 } }));
        areas.forEach((v) => children.push(new Paragraph({ children: [run(v, { color: INK })] })));
      } else if (b.t === 'sign') {
        children.push(new Table({
          width: { size: CW, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: [Math.round(CW * 0.6), CW - Math.round(CW * 0.6)],
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: Math.round(CW * 0.6), type: WidthType.DXA }, borders: { ...allBorders(NONE), bottom: LINE }, verticalAlign: VerticalAlign.BOTTOM, children: [new Paragraph({ children: [run(b.left, { size: 19 })] })] }),
            new TableCell({ width: { size: CW - Math.round(CW * 0.6), type: WidthType.DXA }, borders: { ...allBorders(NONE), bottom: LINE }, verticalAlign: VerticalAlign.BOTTOM, children: [
              new Paragraph({ alignment: AlignmentType.RIGHT, children: stampImg ? [stampImg] : [run('')] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(b.right, { size: 16 })] }),
            ] }),
          ] })],
        }));
      } else if (b.t === 'vsign') {
        children.push(new Paragraph({ children: stampImg ? [stampImg] : [run('')], spacing: { before: 200 } }));
        children.push(new Paragraph({ children: [run('Chhatrapal Sao', { bold: true, size: 21 })] }));
        children.push(new Paragraph({ children: [run('Valuer/Surveyor', { size: 21 })] }));
      }
    }

    const L = api.LH[tpl.style];
    const footer = new Footer({ children: L.footer.map((t, i) => new Paragraph({
      alignment: AlignmentType.CENTER,
      border: i === 0 ? { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } } : undefined,
      children: [run(t, { size: tpl.style === 'val' ? 20 : 16, bold: tpl.style === 'val' && i === 0 })],
    })) });

    const doc = new Document({
      creator: 'Chhatrapal Sao', title: tpl.name,
      styles: { default: { document: { run: { font: 'Arial', size: SZ } } } },
      sections: [{
        properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 460, bottom: 620, left: MARGIN, right: MARGIN, footer: 300 } } },
        footers: { default: footer },
        children,
      }],
    });
    const blob = await Packer.toBlob(doc);
    download(blob, fileName(tpl, state, 'docx'));
  }

  window.SV_EXPORT = { pdf, docx };
})();

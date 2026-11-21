/* Survey report portal: routing, form rendering, editing and autosave. */
(function () {
  const T = window.SV_TEMPLATES;
  const LISTS = window.SV_LISTS;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Letterhead text (shared with the Word export) ---------- */
  const LH = {
    name: 'Chhatrapal Sao',
    pre: {
      left: ['B.E.(Mech.), A.M.I.E.(India), IIISLA (F/E/07508)', 'SLA - 16269, Valid upto 31/03/2027', 'Pan No. : AKBPS4626F'],
      right: ['Chartered Engineer, Valuer', 'Surveyor & Loss Assessor', 'Engg, Motor, Fire, Marine & Misc'],
      footer: ['A-9, Khandelwal Colony, Kamala College Road, Rajnandgaon (C.G.), 491441 e-mail: cp.rashmi@gmail.com | Phone No.: 9406065999, 7000859593'],
    },
    val: {
      left: ['B.E.(Mech.),  A.M.I.E.(India),', 'SLA 16269, Valid upto 31/03/2027', 'Pan No.  :  AKBPS4626F'],
      right: ['Chartered  Engineer,  Valuer', 'Surveyor & Loss Assessor', 'Engineering,  Motor  &  Marine'],
      footer: ['A-9, khandelwal Colony, Kamala College Road, Rajnandgaon (C.G.),491441', 'Tele - 07744 - 355991, Mob No. 94060 65999, 70008 59593'],
    },
  };

  /* ---------- Line-art illustrations for the letterheads ---------- */
  const ART = {
    commercial: `<svg viewBox="0 0 300 70" fill="none" stroke="#777" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M8 18h56v34H8z"/><path d="M12 22h48M12 30h48M12 38h48M12 46h48"/><path d="M64 26h18l10 12v14H64"/><path d="M68 30h11l7 9H68z"/>
      <path d="M8 52h86"/><circle cx="24" cy="56" r="7"/><circle cx="24" cy="56" r="2.5"/><circle cx="80" cy="56" r="7"/><circle cx="80" cy="56" r="2.5"/>
      <path d="M150 14h132a10 10 0 0 1 10 10v28H150z"/><path d="M150 14l-6 20v18h6"/><path d="M144 34h6"/>
      <path d="M160 20h18v14h-18zM182 20h18v14h-18zM204 20h18v14h-18zM226 20h18v14h-18zM248 20h18v14h-18zM270 20h14v14h-14z"/>
      <path d="M150 40h142"/><circle cx="168" cy="56" r="7"/><circle cx="168" cy="56" r="2.5"/><circle cx="262" cy="56" r="7"/><circle cx="262" cy="56" r="2.5"/><circle cx="278" cy="56" r="7"/>
    </svg>`,
    bike: `<svg viewBox="0 0 200 80" fill="none" stroke="#777" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="42" cy="58" r="16"/><circle cx="42" cy="58" r="8"/><circle cx="160" cy="58" r="16"/><circle cx="160" cy="58" r="8"/>
      <path d="M42 58l46-8"/><path d="M160 58l-14-34"/>
      <path d="M26 30l36-4 30 4"/><path d="M26 30c4 6 10 10 18 12"/>
      <path d="M92 30c8-12 32-14 44-8l12-8 8 6c8 10 12 20 8 26l-26 6c-10 2-24 2-34-2z"/>
      <path d="M104 50l32 2"/><path d="M118 34h20"/><path d="M64 50l34-6"/><path d="M58 52h10"/>
    </svg>`,
    car: `<svg viewBox="0 0 240 80" fill="none" stroke="#777" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M10 54c0-8 8-11 20-13l36-5c18-12 44-18 70-18 22 0 40 8 56 18l28 4c8 2 12 7 12 14z"/>
      <path d="M82 36c16-9 34-14 52-14 16 0 28 5 38 14z"/><path d="M128 22l-3 14"/>
      <circle cx="58" cy="56" r="13"/><circle cx="58" cy="56" r="6"/><circle cx="190" cy="56" r="13"/><circle cx="190" cy="56" r="6"/>
      <path d="M14 47h16M214 45h12M96 46h30M136 46h22"/>
    </svg>`,
  };

  /* ---------- Indian number formatting ---------- */
  function parseMoney(s) {
    const n = parseFloat(String(s || '').replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : null;
  }
  function inr(n) {
    const [i, d] = n.toFixed(2).split('.');
    const last3 = i.slice(-3), rest = i.slice(0, -3);
    return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3 + '.' + d;
  }
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
  const three = (n) => (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n));
  function words(num) {
    let n = Math.floor(num);
    const paise = Math.round((num - n) * 100);
    if (n === 0 && !paise) return 'Zero';
    const out = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thou = Math.floor(n / 1e3); n %= 1e3;
    if (crore) out.push((crore > 999 ? words(crore) : three(crore)) + (crore > 1 ? ' Crores' : ' Crore'));
    if (lakh) out.push(two(lakh) + (lakh > 1 ? ' Lakhs' : ' Lakh'));
    if (thou) out.push(two(thou) + ' Thousand');
    if (n) out.push(three(n));
    let s = out.join(' ');
    if (paise) s += (s ? ' and ' : '') + two(paise) + ' Paise';
    return s;
  }

  /* ---------- State ---------- */
  const STORE = 'sv:v1:';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(STORE + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(STORE + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(STORE + k); } catch (e) {} },
  };
  let tpl = null;
  let state = null; // { data:{}, auto:{}, wordsManual:false }
  let stamp = store.get('stamp');

  function freshState(t) { return { data: { ...t.defaults }, auto: {}, wordsManual: false }; }
  function loadState(t) {
    const s = store.get('form:' + t.id);
    return s && s.data ? { auto: {}, wordsManual: false, ...s } : freshState(t);
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { store.set('form:' + tpl.id, state); setSaved(); }, 300);
  }
  function hasDraft(id) {
    const s = store.get('form:' + id);
    if (!s || !s.data) return false;
    const d = T[id].defaults;
    return Object.keys(s.data).some((k) => s.data[k] && s.data[k] !== d[k]);
  }

  /* ---------- Rendering ---------- */
  function isCell(x) { return x && typeof x === 'object' && !Array.isArray(x) && 'c' in x; }
  function hasArea(parts) { return Array.isArray(parts) ? parts.some((p) => p && p.area) : !!(parts && parts.area); }

  function partHTML(p, m) {
    if (p == null || p === '') return '';
    if (typeof p === 'string') return `<span class="st">${esc(p)}</span>`;
    const d = state.data;
    if (p.b != null) return `<b class="st">${esc(p.b)}</b>`;
    if (p.f) {
      const v = d[p.f] ?? '';
      const style = p.w ? `style="width:${p.w}px;flex:none"` : p.fit ? (m === 'print' ? 'style="flex:none"' : `style="width:${fitW(v, p.fit)}px;flex:none"`) : '';
      const cls = `${p.bold ? ' bold' : ''}${p.line ? ' line' : ''}`;
      if (p.area) {
        if (m === 'print') return `<div class="pv area${cls}" style="min-height:${(p.rows || 2) * 15}px">${esc(v).replace(/\n/g, '<br>')}</div>`;
        return `<textarea class="fi area${cls}${state.auto[p.f] ? ' auto' : ''}" data-k="${p.f}" rows="${p.rows || 2}">${esc(v)}</textarea>`;
      }
      if (m === 'print') return `<span class="pv${cls}" ${style}>${esc(v)}</span>`;
      return `<input class="fi${cls}${state.auto[p.f] ? ' auto' : ''}" data-k="${p.f}" value="${esc(v)}" ${style} autocomplete="off" spellcheck="false"${p.list ? ` list="dl-${p.list}"` : ''}${p.money ? ' inputmode="decimal"' : ''}${p.fit ? ` data-fit="${p.fit}"` : ''}>`;
    }
    if (p.o) {
      const v = d[p.o] ?? '';
      const items = p.opts.map((o) => m === 'print'
        ? `<span class="op${o === v ? ' on' : ''}">${esc(o)}</span>`
        : `<button type="button" class="op${o === v ? ' on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`);
      return `<span class="opts${state.auto[p.o] ? ' auto' : ''}" data-k="${p.o}">${items.join(`<span class="sl">${esc(p.sep || '/')}</span>`)}</span>`;
    }
    if (p.k) {
      const v = d[p.k] ?? '';
      return m === 'print' ? `<span class="tkv">${esc(v)}</span>` : `<button type="button" class="tk" data-k="${p.k}" aria-label="Tick">${esc(v) || '&nbsp;'}</button>`;
    }
    if (p.p) {
      const v = d[p.p] ?? '';
      return m === 'print' ? `<span class="pv" style="flex:none">${esc(v)}</span>`
        : `<button type="button" class="pk" data-k="${p.p}" data-opts="${esc(p.opts.join('|'))}">${v ? esc(v) : `<span class="ph">${esc(p.opts.join('/'))}</span>`}</button>`;
    }
    return '';
  }
  let measureCtx;
  function fitW(v, min) {
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    measureCtx.font = 'bold 13.5px Arial';
    return Math.max(min, Math.ceil(measureCtx.measureText(v || '').width) + 10);
  }
  function partsHTML(parts, m) {
    if (Array.isArray(parts)) {
      if (hasArea(parts)) {
        const inl = parts.filter((p) => !(p && p.area)).map((p) => partHTML(p, m)).join('');
        const ar = parts.filter((p) => p && p.area).map((p) => partHTML(p, m)).join('');
        return `<div class="ln">${inl}</div>${ar}`;
      }
      return `<div class="ln">${parts.map((p) => partHTML(p, m)).join('')}</div>`;
    }
    if (typeof parts === 'string') return esc(parts);
    if (parts && (parts.f || parts.o || parts.k || parts.p)) return `<div class="ln one">${partHTML(parts, m)}</div>`;
    return partHTML(parts, m);
  }

  function tableHTML(b, m) {
    const cols = `<colgroup>${b.cols.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>`;
    const rows = b.rows.map((r) => `<tr>${r.map((cell) => {
      const c = isCell(cell) ? cell : { c: cell };
      const attrs = `${c.span ? ` colspan="${c.span}"` : ''}${c.rowspan ? ` rowspan="${c.rowspan}"` : ''}`;
      return `<td class="${c.cls || ''}"${attrs}>${partsHTML(c.c, m)}</td>`;
    }).join('')}</tr>`).join('');
    return `<table class="tb ${b.border === 'none' ? 'nob' : ''} ${b.cls || ''}">${cols}${rows}</table>`;
  }

  function stampHTML(m) {
    if (stamp) return `<div class="stamp">${m === 'print' ? '' : '<button type="button" class="stamp-x" aria-label="Remove stamp">×</button>'}<img src="${stamp}" alt=""></div>`;
    return m === 'print' ? '<div class="stamp empty"></div>' : '<button type="button" class="stamp stamp-add">+ Add stamp &amp; signature</button>';
  }

  function letterheadHTML(t) {
    const L = LH[t.style];
    if (t.style === 'val') {
      return `<div class="lh val"><div class="lh-l"><div class="lh-name">${LH.name}</div>${L.left.map((x) => `<div>${esc(x)}</div>`).join('')}</div>
        <div class="lh-r">${L.right.map((x) => `<div>${esc(x)}</div>`).join('')}</div></div><div class="lh-rule"></div>`;
    }
    return `<div class="lh pre"><div class="lh-l"><div class="lh-name">${LH.name}</div>${L.left.map((x) => `<div>${esc(x)}</div>`).join('')}</div>
      <div class="lh-art">${ART[t.art] || ''}</div>
      <div class="lh-r">${L.right.map((x) => `<div>${esc(x)}</div>`).join('')}</div></div>`;
  }

  function blockHTML(b, t, m) {
    switch (b.t) {
      case 'letterhead': return letterheadHTML(t);
      case 'table': return tableHTML(b, m);
      case 'text': return `<div class="tx ${b.cls || ''}">${typeof b.parts === 'string' ? esc(b.parts) : partsHTML(b.parts, m)}</div>`;
      case 'sign': return `<div class="sign"><div class="sg-l">${esc(b.left)}</div><div class="sg-r">${stampHTML(m)}<div class="sg-t">${esc(b.right)}</div></div></div>`;
      case 'vsign': return `<div class="vsign">${stampHTML(m)}<div class="vs-n">Chhatrapal Sao</div><div class="vs-t">Valuer/Surveyor</div></div>`;
      case 'footer': return '';
      default: return '';
    }
  }

  function sheetHTML(t, m) {
    const body = t.blocks.map((b) => blockHTML(b, t, m)).join('');
    const ft = LH[t.style].footer;
    return `<div class="sheet theme-${t.theme} style-${t.style}${m === 'print' ? ' print' : ''}">
      <div class="sheet-body">${body}</div>
      <div class="sheet-foot ${t.style}">${ft.map((x, i) => `<div${t.style === 'val' && i === 0 ? ' class="b"' : ''}>${esc(x)}</div>`).join('')}</div>
    </div>`;
  }

  /* ---------- Views ---------- */
  const app = $('#app');
  function setViewport(form) {
    const meta = $('meta[name=viewport]');
    const small = Math.min(screen.width, window.innerWidth) < 860;
    meta.setAttribute('content', form && small ? 'width=860' : 'width=device-width, initial-scale=1');
    document.body.classList.toggle('zoomed', !!(form && small));
  }

  const ICON = {
    val: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h4"/><path d="M3.5 9.5h3M5 8v3"/></svg>',
    pre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6v3H9z"/><path d="M15 5h3v16H6V5h3"/><path d="M9 12l2 2 4-4"/><path d="M9 17h6"/></svg>',
  };

  function viewHome() {
    setViewport(false);
    document.title = 'Survey Reports · Chhatrapal Sao';
    const draft = (id) => hasDraft(id) ? '<span class="draft">Draft saved</span>' : '';
    const preDraft = ['commercial', 'twowheeler', 'car'].some(hasDraft) ? '<span class="draft">Draft saved</span>' : '';
    app.innerHTML = `<main class="home">
      <header class="h-head"><div class="h-kicker">Chhatrapal Sao · Surveyor &amp; Loss Assessor</div><h1>Which report do you need?</h1></header>
      <div class="choices">
        <a class="choice" href="#/form/valuation"><span class="ci">${ICON.val}</span><span class="ct"><b>Valuation report</b><small>Market value assessment for financing and the insurer's IDV</small></span>${draft('valuation')}<span class="chev">›</span></a>
        <a class="choice" href="#/pre"><span class="ci">${ICON.pre}</span><span class="ct"><b>Pre-inspection report</b><small>Commercial vehicle, two wheeler or motor car</small></span>${preDraft}<span class="chev">›</span></a>
      </div>
      <p class="h-note">Fill a report from an RC or policy PDF, then save it as Word or PDF. Drafts stay on this device.</p>
    </main>`;
  }

  function viewPre() {
    setViewport(false);
    const card = (id, title, sub) => `<a class="choice v" href="#/form/${id}"><span class="ci art">${ART[T[id].art]}</span><span class="ct"><b>${title}</b><small>${sub}</small></span>${hasDraft(id) ? '<span class="draft">Draft saved</span>' : ''}<span class="chev">›</span></a>`;
    app.innerHTML = `<main class="home">
      <header class="h-head"><a class="back" href="#/">‹ Reports</a><div class="h-kicker">Pre-inspection report</div><h1>Pick the vehicle type</h1></header>
      <div class="choices">
        ${card('commercial', 'Commercial vehicle', 'Truck, tanker, tipper, bus, excavator or crane')}
        ${card('twowheeler', 'Two wheeler', 'Motorcycle or scooter')}
        ${card('car', 'Motor car', 'Private car')}
      </div>
    </main>`;
  }

  function viewForm(id) {
    tpl = T[id];
    if (!tpl) { location.hash = '#/'; return; }
    state = loadState(tpl);
    setViewport(true);
    document.title = `${tpl.name} · Survey Reports`;
    const back = tpl.style === 'val' ? '#/' : '#/pre';
    app.innerHTML = `<div class="formview">
      <header class="bar">
        <a class="bar-back" href="${back}" aria-label="Back">‹</a>
        <div class="bar-t"><small>${esc(tpl.kind)}</small><b>${esc(tpl.style === 'val' ? 'Valuation report' : tpl.name)}</b></div>
        <span class="saved" id="saved"></span>
        <button type="button" class="btn ghost" id="clear">Clear</button>
        <button type="button" class="btn" id="dlWord">Word</button>
        <button type="button" class="btn dark" id="dlPdf">PDF</button>
      </header>
      <div class="stage"><div id="sheetWrap">${sheetHTML(tpl, 'edit')}</div></div>
      <button type="button" class="fab" id="fab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg><span>Upload PDF</span></button>
      <input type="file" id="pdfIn" accept="application/pdf,image/*" hidden>
      <input type="file" id="stampIn" accept="image/*" hidden>
      ${Object.entries(LISTS).map(([k, arr]) => `<datalist id="dl-${k}">${arr.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`).join('')}
    </div>`;
    bindForm();
    autosizeAll();
  }

  function rerenderSheet() {
    const y = window.scrollY;
    $('#sheetWrap').innerHTML = sheetHTML(tpl, 'edit');
    autosizeAll();
    window.scrollTo(0, y);
  }

  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  function autosizeAll() { document.querySelectorAll('textarea.fi').forEach(autosize); }

  function setSaved() {
    const el = $('#saved');
    if (el) { el.textContent = 'Saved'; el.classList.add('on'); clearTimeout(setSaved.t); setSaved.t = setTimeout(() => el.classList.remove('on'), 1400); }
  }

  function setField(k, v) {
    state.data[k] = v;
    delete state.auto[k];
  }

  function updateWords() {
    if (!tpl.blocks.some((b) => b.t === 'text' && Array.isArray(b.parts) && b.parts.some((p) => p && p.f === 'marketWords'))) return;
    if (state.wordsManual) return;
    const n = parseMoney(state.data.marketValue);
    state.data.marketWords = n ? words(n) : '';
    const el = document.querySelector('[data-k="marketWords"]');
    if (el) { el.value = state.data.marketWords; el.style.width = fitW(el.value, +el.dataset.fit || 140) + 'px'; }
  }

  function bindForm() {
    const wrap = $('#sheetWrap');
    wrap.addEventListener('input', (e) => {
      const el = e.target.closest('.fi');
      if (!el) return;
      setField(el.dataset.k, el.value);
      el.classList.remove('auto');
      if (el.tagName === 'TEXTAREA') autosize(el);
      if (el.dataset.fit) el.style.width = fitW(el.value, +el.dataset.fit) + 'px';
      if (el.dataset.k === 'marketValue') updateWords();
      if (el.dataset.k === 'marketWords') state.wordsManual = !!el.value.trim();
      save();
    });
    wrap.addEventListener('focusout', (e) => {
      const el = e.target.closest('.fi');
      if (el && el.dataset.k === 'marketValue') {
        const n = parseMoney(el.value);
        if (n != null) { el.value = inr(n); el.style.width = fitW(el.value, 90) + 'px'; setField('marketValue', el.value); updateWords(); save(); }
      }
    });
    wrap.addEventListener('click', (e) => {
      const op = e.target.closest('.op');
      if (op && op.tagName === 'BUTTON') {
        const g = op.closest('.opts');
        const k = g.dataset.k;
        const v = state.data[k] === op.dataset.v ? '' : op.dataset.v;
        setField(k, v);
        g.classList.remove('auto');
        g.querySelectorAll('.op').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
        save();
        return;
      }
      const tk = e.target.closest('.tk');
      if (tk) {
        const seq = ['', '✓', '—'];
        const v = seq[(seq.indexOf(state.data[tk.dataset.k] || '') + 1) % seq.length];
        setField(tk.dataset.k, v);
        tk.innerHTML = v || '&nbsp;';
        save();
        return;
      }
      const pk = e.target.closest('.pk');
      if (pk) {
        const seq = ['', ...pk.dataset.opts.split('|')];
        const v = seq[(seq.indexOf(state.data[pk.dataset.k] || '') + 1) % seq.length];
        setField(pk.dataset.k, v);
        pk.innerHTML = v ? esc(v) : `<span class="ph">${esc(seq.slice(1).join('/'))}</span>`;
        save();
        return;
      }
      if (e.target.closest('.stamp-x')) { stamp = null; store.del('stamp'); rerenderSheet(); return; }
      if (e.target.closest('.stamp-add')) { $('#stampIn').click(); }
    });

    $('#stampIn').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      stamp = await shrinkImage(f, 520);
      if (!store.set('stamp', stamp)) toast('Stamp added for now, but this browser could not keep it for next time.');
      rerenderSheet();
    });

    const clear = $('#clear');
    clear.addEventListener('click', () => {
      if (!clear.classList.contains('confirm')) {
        clear.classList.add('confirm'); clear.textContent = 'Tap to clear all';
        clearTimeout(clear.t); clear.t = setTimeout(() => { clear.classList.remove('confirm'); clear.textContent = 'Clear'; }, 3000);
        return;
      }
      clear.classList.remove('confirm'); clear.textContent = 'Clear';
      state = freshState(tpl); store.del('form:' + tpl.id); rerenderSheet(); toast('Form cleared');
    });

    $('#fab').addEventListener('click', () => $('#pdfIn').click());
    $('#pdfIn').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      busy(true, 'Reading ' + f.name + '…');
      try {
        const found = await window.SV_EXTRACT.fromFile(f, (msg) => busy(true, msg));
        const n = applyExtracted(found);
        busy(false);
        if (n) toast(`Filled ${n} field${n > 1 ? 's' : ''} from ${f.name}. Highlighted fields came from the file. Check them.`, 5200);
        else toast("Couldn't find vehicle details in this file. You can fill the form by hand.", 5200);
      } catch (err) {
        console.error(err);
        busy(false);
        toast("Couldn't read this file. " + (err && err.message ? err.message : ''), 5200);
      }
    });

    $('#dlWord').addEventListener('click', () => runExport('docx'));
    $('#dlPdf').addEventListener('click', () => runExport('pdf'));
  }

  async function runExport(kind) {
    busy(true, kind === 'pdf' ? 'Making PDF…' : 'Making Word file…');
    try {
      if (kind === 'pdf') await window.SV_EXPORT.pdf(tpl, state, api);
      else await window.SV_EXPORT.docx(tpl, state, api);
      busy(false);
    } catch (err) {
      console.error(err);
      busy(false);
      toast('Export failed. ' + (err && err.message ? err.message : ''), 5200);
    }
  }

  /* Map extracted values onto the fields this template has. */
  function applyExtracted(x) {
    const keys = new Set();
    const walk = (p) => {
      if (!p) return;
      if (Array.isArray(p)) return p.forEach(walk);
      if (typeof p === 'object') { if (p.f) keys.add(p.f); if (p.c !== undefined) walk(p.c); }
    };
    tpl.blocks.forEach((b) => { if (b.rows) b.rows.forEach((r) => r.forEach(walk)); if (b.parts) walk(b.parts); });

    const withMr = (name) => !name ? '' : /^(mr|mrs|ms|miss|smt|shri|sri|m\/s|dr)\b\.?/i.test(name) ? name : 'MR. ' + name;
    const ownerFull = [withMr(x.ownerName), x.address].filter(Boolean).join(' , ');
    const makeModel = x.makeModel || [x.maker, x.model].filter(Boolean).join(' / ');
    const ins = [x.insurer, x.policyNo ? 'Policy No. ' + x.policyNo : '', x.insUpto ? 'valid upto ' + x.insUpto : ''].filter(Boolean).join(', ');
    const map = {
      vehicleNo: x.regNo, regNo: x.regNo, chassisNo: x.chassisNo, engineNo: x.engineNo,
      makeModel, manufacturer: x.maker || (x.makeModel ? x.makeModel.split('/')[0].trim() : ''), model: x.model,
      bodyType: x.bodyType, vehicleClass: x.vehicleClass, mfgYear: x.mfgYear, regDate: x.regDate,
      colour: x.colour, fuel: x.fuel, odometer: x.odometer, ownerSerial: x.ownerSerial,
      permitUpto: x.permitUpto, fitnessUpto: x.fitnessUpto, hypothecation: x.hypothecation,
      insuranceDetails: ins,
      owner: ownerFull, regOwner: ownerFull, propOwner: ownerFull,
      proposer: withMr(x.ownerName), address: x.address,
    };
    let n = 0;
    for (const [k, v] of Object.entries(map)) {
      if (!v || !keys.has(k)) continue;
      const cur = (state.data[k] || '').trim();
      const def = (tpl.defaults[k] || '').trim();
      if (cur && cur !== def && !state.auto[k]) continue; // never overwrite what the user typed
      state.data[k] = v;
      state.auto[k] = true;
      n++;
    }
    store.set('form:' + tpl.id, state);
    rerenderSheet();
    return n;
  }

  /* ---------- Small helpers ---------- */
  function shrinkImage(file, max) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => rej(new Error('That image could not be opened.'));
      img.src = URL.createObjectURL(file);
    });
  }

  let toastEl;
  function toast(msg, ms = 2600) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), ms);
  }
  let busyEl;
  function busy(on, msg) {
    if (!busyEl) { busyEl = document.createElement('div'); busyEl.className = 'busy'; busyEl.innerHTML = '<div class="busy-card"><span class="spin"></span><span class="busy-t"></span></div>'; document.body.appendChild(busyEl); }
    busyEl.classList.toggle('on', on);
    if (msg) busyEl.querySelector('.busy-t').textContent = msg;
  }

  /* ---------- Router ---------- */
  function route() {
    const h = location.hash.replace(/^#/, '') || '/';
    const m = h.match(/^\/form\/(\w+)/);
    window.scrollTo(0, 0);
    if (m) viewForm(m[1]);
    else if (h.startsWith('/pre')) viewPre();
    else viewHome();
  }
  window.addEventListener('hashchange', route);

  const api = { sheetHTML: (t, s) => { const keep = state; state = s; const h = sheetHTML(t, 'print'); state = keep; return h; }, LH, ART, getStamp: () => stamp, words, inr };
  window.SV = api;
  route();
})();

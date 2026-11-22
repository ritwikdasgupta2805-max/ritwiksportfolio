/* AI reader: sends the photo or PDF to Google Gemini (free tier, the user's own key) and
   gets the vehicle details back as JSON. Reads blurry WhatsApp photos and handwriting far
   better than the offline reader. Used when a key is saved and the device is online;
   otherwise the app falls back to the offline reader. */
(function () {
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const KEY_STORE = 'sv:v1:geminiKey';
  const MODEL_STORE = 'sv:v1:geminiModel';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  const getKey = () => (ls.get(KEY_STORE) || '').trim();
  const setKey = (k) => { ls.del(MODEL_STORE); return k ? ls.set(KEY_STORE, k.trim()) : (ls.del(KEY_STORE), true); };
  const available = () => !!getKey() && navigator.onLine !== false;

  class AiError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }

  async function call(path, opts = {}) {
    let res;
    try {
      res = await fetch(`${API}/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(getKey())}`, opts);
    } catch (e) {
      throw new AiError('No internet connection.', 'network');
    }
    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
      const msg = (body && body.error && body.error.message) || `HTTP ${res.status}`;
      const kind = res.status === 429 ? 'quota' : (res.status === 400 && /api key/i.test(msg)) || res.status === 401 || res.status === 403 ? 'key' : res.status === 404 ? 'model' : 'other';
      throw new AiError(msg, kind);
    }
    return body;
  }

  /* Google renames models often. Ask which ones this key can use and prefer a current Flash model. */
  async function candidates() {
    const saved = ls.get(MODEL_STORE);
    let names = [];
    try {
      const out = await call('models?pageSize=200');
      names = (out.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((n) => /flash/i.test(n) && !/image|tts|audio|live|embed|robotics|computer|thinking|exp/i.test(n));
    } catch (e) {
      if (e.kind === 'key' || e.kind === 'network') throw e;
    }
    const ver = (n) => parseFloat((n.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1]);
    names.sort((a, b) => {
      const score = (n) => (/-latest$/.test(n) ? 1000 : 0) + ver(n) * 10 - (/preview/.test(n) ? 3 : 0) - (/lite/.test(n) ? 1 : 0);
      return score(b) - score(a);
    });
    if (!names.length) names = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    if (saved) names = [saved, ...names.filter((n) => n !== saved)];
    return names.slice(0, 6);
  }

  const VEHICLE = {
    regNo: 'Registration / vehicle number, e.g. CG04NG4188 (no spaces)',
    chassisNo: 'Chassis number (CH. NO.), exact characters',
    engineNo: 'Engine number (E. NO.), exact characters',
    ownerName: 'Registered owner name only (not father/husband name)',
    address: 'Owner address, all lines joined with commas',
    maker: 'Manufacturer. On Chhattisgarh smart-card RCs this is "REF. MFG" (e.g. HYUNDAI MOTOR INDIA LTD); "OTHERS" means unknown',
    model: 'Model/variant. On smart-card RCs this is the "MAKE" line (e.g. VENUE 1.0 TURBO GDI MT SX)',
    vehicleClass: 'Vehicle class, e.g. MOTOR CAR, GOODS CARRIER, M-CYCLE/SCOOTER',
    bodyType: 'Body type, e.g. SALOON, STATION WAGON, OPEN/TILT CABIN',
    mfgYear: 'Manufacturing month/year as MM/YYYY, or YYYY if only the year is shown',
    regDate: 'Registration date as DD/MM/YYYY',
    fuel: 'Fuel, e.g. Petrol, Diesel, CNG, Petrol/CNG, Electric',
    colour: 'Colour',
    odometer: 'Odometer reading in km (digits only)',
    ownerSerial: 'Owner serial number (OWNER SRL)',
    hypothecation: 'Financier / hypothecated to (Hyp By), bank or finance company name only',
    fitnessUpto: 'Fitness valid upto, DD/MM/YYYY',
    permitUpto: 'Permit valid upto, DD/MM/YYYY',
    insUpto: 'Insurance valid upto, DD/MM/YYYY',
    policyNo: 'Insurance policy number',
    insurer: 'Insurance company of the existing policy',
  };

  function schema(formFields) {
    const vprops = {};
    Object.keys(VEHICLE).forEach((k) => (vprops[k] = { type: 'STRING', description: VEHICLE[k] }));
    const fprops = {};
    formFields.forEach((f) => {
      fprops[f.key] = { type: 'STRING', description: f.opts ? `${f.label}. One of: ${f.opts.join(' | ')}. Empty if not marked.` : f.label };
    });
    const s = { type: 'OBJECT', properties: { documentType: { type: 'STRING' }, vehicle: { type: 'OBJECT', properties: vprops } }, required: ['documentType', 'vehicle'] };
    if (formFields.length) s.properties.form = { type: 'OBJECT', properties: fprops };
    return s;
  }

  function prompt(formFields) {
    return [
      'You are reading an Indian vehicle document for an insurance surveyor. It may be a photo forwarded on WhatsApp (blurry, tilted, low resolution), a scanned PDF, a registration certificate (RC, including Chhattisgarh smart-card RCs), an insurance policy, or a filled-in inspection or valuation form, possibly handwritten.',
      'Return what the document says, as JSON matching the schema.',
      'Rules:',
      '- Copy registration, chassis and engine numbers character by character. Use the shape of Indian numbers to resolve blurry letters (e.g. chassis numbers are usually 17 characters starting with MA/ME/MB).',
      '- Use an empty string for anything not on the document. Never guess or invent values.',
      '- Dates as DD/MM/YYYY.',
      '- Keep words in the case printed on the document.',
      formFields.length ? '- The "form" object holds the fields of the surveyor\'s report form. Fill it ONLY if this document is itself a filled-in inspection or valuation form (for example a handwritten one). For an RC or policy, leave every "form" value empty. For choice fields, return the option that is ticked, circled or written, exactly as listed.' : '',
      '- documentType: one short phrase, e.g. "smart-card RC", "RC", "insurance policy", "handwritten inspection form".',
      '',
      'Reply with JSON only, in exactly this shape (every value a string):',
      JSON.stringify({ documentType: '', vehicle: Object.fromEntries(Object.entries(VEHICLE).map(([k, d]) => [k, d])), ...(formFields.length ? { form: Object.fromEntries(formFields.map((f) => [f.key, f.opts ? `${f.label} (one of: ${f.opts.join(' | ')})` : f.label])) } : {}) }, null, 1),
      'The text inside quotes above describes each field; replace it with the value, or an empty string.',
    ].filter(Boolean).join('\n');
  }

  async function fileToPart(file) {
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    if (isPdf) {
      if (file.size > 18 * 1024 * 1024) throw new AiError('PDF is too large for the AI reader.', 'other');
      return { inline_data: { mime_type: 'application/pdf', data: await b64(file) } };
    }
    // shrink big photos: faster upload, same accuracy
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new AiError('That image could not be opened.', 'other')); i.src = URL.createObjectURL(file); }); }
    const s = Math.min(1, 2200 / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return { inline_data: { mime_type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.9).split(',')[1] } };
  }
  function b64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new AiError('Could not read the file.', 'other')); r.readAsDataURL(file); });
  }

  async function read(file, { formFields = [], progress } = {}) {
    if (!getKey()) throw new AiError('No AI key saved.', 'key');
    progress && progress('Sending to the AI reader…');
    const part = await fileToPart(file);
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt(formFields) }, part] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });
    let lastErr;
    for (const model of await candidates()) {
      try {
        progress && progress('AI is reading the document…');
        const out = await call(`models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        const text = (((out.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
        if (!text) throw new AiError('The AI returned nothing.', 'other');
        const json = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
        // drop any field where the model echoed the description back instead of a value
        const desc = new Set([...Object.values(VEHICLE), ...formFields.map((f) => f.label), ...formFields.map((f) => f.opts ? `${f.label} (one of: ${f.opts.join(' | ')})` : f.label)]);
        ['vehicle', 'form'].forEach((g) => Object.keys(json[g] || {}).forEach((k) => { if (desc.has(json[g][k])) json[g][k] = ''; }));
        ls.set(MODEL_STORE, model);
        return { json, model, text };
      } catch (e) {
        lastErr = e;
        e.message = `${model}: ${e.message}`;
        // try the next model when this one isn't available or is out of free quota
        if (e.kind === 'key' || e.kind === 'network') throw e;
      }
    }
    throw lastErr || new AiError('No AI model available.', 'other');
  }

  async function testKey(key) {
    const old = getKey();
    setKey(key);
    try { await call('models?pageSize=5'); return true; }
    catch (e) { setKey(old); throw e; }
  }

  window.SV_AI = { getKey, setKey, available, read, testKey, AiError };
})();

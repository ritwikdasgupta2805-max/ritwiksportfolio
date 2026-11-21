/* Report templates, described as data.
   The same description drives the on-screen form, the PDF export and the Word export,
   so a change here shows up everywhere.

   Cell content ("parts") is a string, a field object, or an array of both.
     F(key, o)       text field (o.w = width in px, o.area = multi-line, o.list = suggestions)
     O(key, 'A/B')   printed options; the chosen one is circled
     K(key)          tick cell: blank / ✓ / —
     P(key, 'A/B')   pick: only the chosen word is printed
*/
(function () {
  const F = (k, o = {}) => ({ f: k, ...o });
  const O = (k, opts) => ({ o: k, opts: opts.split(/\s*\/\s*/), sep: / \/ /.test(opts) ? ' / ' : '/' });
  const K = (k) => ({ k });
  const P = (k, opts) => ({ p: k, opts: opts.split('/') });
  const B = (t) => ({ b: t }); // bold static text

  function fy() {
    const d = new Date();
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    const p = (n) => String(n % 100).padStart(2, '0');
    return `${p(y)}-${p(y + 1)}`;
  }
  const FY = fy();

  const DECL = [
    'I have inspected the above vehicle with all the fittings and/or fitments of the vehicle in good condition.',
    'The performance of the vehicle was found good and is therefore recommended to cover under relevant insurance policy.',
  ];
  const PREJ = 'This report is issued without prejudice as per findings collected during the inspection of the vehicle.';

  // Header block shared by the three pre-inspection forms
  const head = (title, insurer) => ({
    t: 'table', cols: [52, 48], rows: [
      [{ c: title, span: 2, cls: 'title' }],
      [{ c: ['Report No.: ', F('reportNo', { w: 70 }), '/' + FY] }, { c: ['Date : ', F('reportDate')] }],
      [{ c: ['Insurer / Broker : ', F('insurer', { bold: true })] }, { c: ['Proposer : ', F('proposer')] }],
      [{ c: ['Req. by: ', F('reqBy')] }, { c: ['Address : ', F('address')] }],
    ],
  });

  const tail = (valueRow) => [
    { t: 'table', cols: [100], rows: [[{ c: DECL[0] }], [{ c: DECL[1] }]], cls: 'decl' },
    ...valueRow,
    { t: 'table', cols: [100], rows: [[{ c: ['Comments/Remarks:', F('remarks', { area: true, rows: 2 })] }]] },
    { t: 'text', parts: PREJ, cls: 'prej' },
    { t: 'table', cols: [100], rows: [[{ c: ['IMPRESSION OF CHASSIS NO.: ', B('Digital Photo attached')], cls: 'impr' }]] },
    { t: 'sign', left: 'Sign of Proposer/ Representative', right: 'Insu. Surveyor & Loss Assessor' },
  ];

  const defaultsPre = { reqBy: 'Mr. ', owner: 'MR. ' };

  /* ---------------- Commercial vehicle ---------------- */
  const commercial = {
    id: 'commercial', name: 'Commercial Vehicle', kind: 'Pre-inspection', theme: 'khaki', art: 'commercial', style: 'pre',
    defaults: { ...defaultsPre, insurer: 'The New India Assu. Co. Ltd. , RJN', recommended: 'YES', rcVerified: 'YES' },
    blocks: [
      { t: 'letterhead' },
      head('COMMERCIAL VEHICLE INSPECTION REPORT', ''),
      { t: 'table', cols: [52, 48], rows: [
        [{ c: 'INSPECTION', span: 2, cls: 'band c' }],
        [{ c: ['Date : ', F('inspDate', { w: 150 }), ' Time : ', F('inspTime')] }, { c: ['Place : ', F('inspPlace')] }],
      ] },
      { t: 'table', cols: [18.5, 32.5, 20.5, 28.5], rows: [
        [{ c: ['Name & address of registered owner: ', F('owner')], span: 4, cls: 'own' }],
        [{ c: 'VEHICLE DETAILS', span: 4, cls: 'band' }],
        ['Vehicle No.', F('vehicleNo'), 'Make/Model/Variant', F('makeModel')],
        ['Chassis No.', F('chassisNo'), 'Type of Body', F('bodyType')],
        ['Engine No.', F('engineNo'), 'Year of Manufacturing', F('mfgYear')],
        ['Date of Registration', F('regDate'), 'Colour', F('colour')],
        ['Fuel Used', F('fuel'), 'Odometer Reading', F('odometer')],
        [{ c: 'Body Parts', span: 4, cls: 'band u' }],
        ['Cowl/Dash Board', O('cowl', 'Intact/Damaged'), { c: 'Truck / Tanker / Tipper', span: 2, cls: 'band u' }],
        ['Bonnet/Front Grill', O('bonnet', 'Intact/Damaged'), { c: ['Cabin ( ', O('cabinMat', 'Steel/Wooden'), ')'] }, O('cabin', 'Good/Average/Poor')],
        ['W/S Glass/Glasses', O('wsGlass', 'Intact/Broken'), { c: ['Load Body ( ', O('loadMat', 'Steel/Wooden'), ')'] }, O('loadBody', 'Good/Average/Poor')],
        ['Bumper', O('bumper', 'Intact/Damaged'), { c: 'Bus Body', span: 2, cls: 'band u' }],
        ['Headlight', O('headlight', 'Intact/Broken'), 'Left Bus Body', O('busLeft', 'Intact/Scratch/Accidental')],
        ['Mud guards', O('mudguards', 'Intact/Damaged'), 'Left Window Glasses', O('busLeftGlass', 'Intact/Broken')],
        ['Chassis Frame', O('chassisFrame', 'Intact/Repaired/Rewelded'), 'Right Bus Body', O('busRight', 'Intact/Scratch/Accidental')],
        ['Fuel tank', O('fuelTank', 'Intact/Repaired/Leaked'), 'Right Window Glasses', O('busRightGlass', 'Intact/Broken')],
        ['Front Shock Absorber', O('frontShock', 'Intact/Broken/NF'), 'Qtr. Glasses (both side)', O('qtrGlass', 'Intact/Broken')],
        ['Rear Shock Absorber', O('rearShock', 'Intact/Broken/NF'), 'Rear Bus Body', O('busRear', 'Intact/Damaged')],
        ['Wheel Rims', O('wheelRims', 'Intact/Cracked/Repaired/Rusted'), 'Back Glasses', O('backGlass', 'Intact/Broken/NF')],
        ['Tyres', O('tyres', 'Good/Average/Poor'), { c: ['Seats (', O('seatLayout', '2x2 / 3x2'), ')'] }, O('seats', 'Good/Average/Poor')],
        ['Stepny', O('stepny', 'Good/Average/Poor/NF'), 'Interior', O('interior', 'Good/Average/Damaged')],
        ['FR & Rear Axle', O('axle', 'Intact/Cracked/Repaired/Rusted'), { c: 'Excavator / Crane', span: 2, cls: 'band u' }],
        ['Spring Assy', O('spring', 'Intact/Cracked/Repaired/Rusted'), 'Cabin', O('exCabin', 'Intact/Damaged')],
        [{ c: ['Any Other', F('anyOther', { area: true, rows: 3 })], span: 2, rowspan: 3, cls: 'top' }, 'Engine Outer Body', O('exEngine', 'Intact/Damaged')],
        ['Boom', O('exBoom', 'Intact/Damaged')],
        ['Bucket', O('exBucket', 'Intact/Damaged')],
      ] },
      ...tail([
        { t: 'table', cols: [100], rows: [[{ c: [B('Value as on date : '), F('value')] }]] },
        { t: 'table', cols: [50, 50], rows: [[
          { c: [{ b: 'Recommended for insurance' }, '   :   ', O('recommended', 'YES/NO')], cls: 'big' },
          { c: ['R/c Verified', '   :   ', O('rcVerified', 'YES/NO')] },
        ]] },
      ]),
      { t: 'footer' },
    ],
  };

  /* ---------------- Two wheeler ---------------- */
  const twowheeler = {
    id: 'twowheeler', name: 'Two Wheeler', kind: 'Pre-inspection', theme: 'slate', art: 'bike', style: 'pre',
    defaults: { ...defaultsPre, insurer: 'The Oriental Insu. Co. Ltd., Rajnandgaon', bodyType: 'Solo' },
    blocks: [
      { t: 'letterhead' },
      head('TWO WHEELER INSPECTION REPORT', ''),
      { t: 'table', cols: [37, 15, 48], rows: [
        [{ c: 'INSPECTION', span: 3, cls: 'band c' }],
        [{ c: ['Date : ', F('inspDate')] }, { c: ['Time : ', F('inspTime')] }, { c: ['Place : ', F('inspPlace')] }],
      ] },
      { t: 'text', parts: ['Name & address of registered owner: ', F('owner', { line: true })], cls: 'ownline' },
      { t: 'table', cols: [22, 26, 1, 17, 34], cls: 'split', rows: (() => {
        const L = [
          ['H. Lamp/Rim/Cover', 'hLamp', 'Intact/Broken/Dented/NA'],
          ['Front L/s Indicator', 'frontLInd', 'Intact/Broken'],
          ['Front R/s Indicator', 'frontRInd', 'Intact/Broken'],
          ['Front Mudguard/Fender', 'frontMud', 'Intact/Broken/Cracked/Dented'],
          ['Speedometer', 'speedo', 'Intact/Broken/Cracked'],
          ['Handle', 'handle', 'Intact/Bent'],
          ['Lever Clutch/hand Break', 'lever', 'Intact/Broken'],
          ['Front Hub/ Disc Drum', 'frontHub', 'Intact/Damaged/Rusted'],
          ['Front Wheel Rim', 'frontRim', 'Intact/Bent/Rusted'],
          ['Front Shock Up', 'frontShock', 'Intact/Damaged/Jammed'],
          ['Leg Guard', 'legGuard', 'Intact/Damaged/Rusted'],
          ['Cover Shield L/Cover Comp L FR', 'coverL', 'Intact/Cracked/Scratched/Dented'],
          ['Cover Shield R/Cover Comp R FR', 'coverR', 'Intact/Cracked/Scratched/Dented'],
          ['Chassis Frame', 'chassisFrame', 'Intact/Bent'],
          ['Kick Paddle', 'kick', 'Intact/Damaged'],
          ['Rear Wheel Rim', 'rearRim', 'Intact/Bent/Rusted'],
          ['Rear Mudguard', 'rearMud', 'Intact/Broken/Cracked/Dented'],
          ['Rear L Cowl/Cover Comp L Body', 'rearCowlL', 'Intact/Broken/Cracked/Dented/Scratched', 'sm'],
          ['Rear R Cowl/Cover Comp R Body', 'rearCowlR', 'Intact/Broken/Cracked/Dented/Scratched', 'sm'],
          ['Rear Shock up', 'rearShock', 'Intact/Damaged/Jammed'],
          ['Rear Drum/ Disc', 'rearDrum', 'Intact/Damaged/Rusted'],
          ['Tail Lamp', 'tailLamp', 'Intact/Broken'],
          ['Rear L/s Indicator', 'rearLInd', 'Intact/Broken'],
          ['Rear R/s Indicator', 'rearRInd', 'Intact/Broken'],
          ['Seat', 'seat', 'Intact/Damaged/Torn'],
          ['Mirror L/s', 'mirrorL', 'Intact/scratched/Not Fitted'],
          ['Mirror R/s', 'mirrorR', 'Intact/scratched/Not Fitted'],
          ['Tyre', 'tyre', 'Good/Average/Poor'],
        ].map(([l, k, o, sm]) => [{ c: l, cls: 'lab' }, { c: O(k, o), cls: sm || '' }]);
        const hdr = (t) => [{ c: t, span: 2, cls: 'band u' }];
        const opt = (l, k, o) => [{ c: l, cls: 'lab' }, O(k, o)];
        const R = [
          hdr('Vehicle Details'),
          [B('Vehicle No.'), F('vehicleNo')],
          ['Chassis No.', F('chassisNo')],
          ['Engine No.', F('engineNo')],
          ['Make/Model/Variant', F('makeModel')],
          ['Date of Reg.', F('regDate')],
          ['Year of Manufacturing', F('mfgYear')],
          ['Type of Body', F('bodyType', { bold: true })],
          ['Fuel Used', F('fuel')],
          ['Colour', F('colour')],
          ['Odometer Reading', F('odometer')],
          hdr('M-Cycle'),
          opt('Fuel Tank', 'mcFuelTank', 'Intact/Dented/Scratched'),
          opt('Silencer', 'mcSilencer', 'Intact/Dented/Rusted'),
          opt('Saree Guard', 'mcSaree', 'Intact/Bent/Scratched'),
          opt('Visor', 'mcVisor', 'Intact/Broken/Scratched'),
          opt('Wind Screen', 'mcWind', 'Intact/Broken/Scratched/NF'),
          opt('Spoiler', 'mcSpoiler', 'Intact/Broken/Scratched/NF'),
          hdr('Scooter'),
          opt('Stepny', 'scStepny', 'Intact/Not Fitted'),
          opt('Stepny Bracket', 'scBracket', 'Intact/Damaged/Not Fitted'),
          opt('Rear Footrest', 'scFootrest', 'Intact/Broken/Scratched'),
          opt('Floor Patti', 'scFloor', 'Intact/Dented/Scratched'),
          opt('Visor', 'scVisor', 'Intact/Broken/Scratched'),
          opt('Spoiler', 'scSpoiler', 'Intact/Broken/Scratched/NF'),
          hdr('Break in Insurance'),
          [{ c: O('breakIn', '<90 Days/>90 Days'), span: 2, cls: 'brk' }],
          [{ c: ['', F('breakNote')], span: 2 }],
          [B('R/c Verified:'), O('rcVerified', 'Yes/No')],
        ];
        // header row of the left table
        const left = [[{ c: 'Body Parts', span: 2, cls: 'band u' }], ...L];
        return left.map((row, i) => [...row, { c: '', cls: 'gap' }, ...R[i]]);
      })() },
      ...tail([
        { t: 'table', cols: [40, 60], rows: [[
          { c: [B('Recommended for insurance:'), '      ', O('recommended', 'YES/NO')], cls: 'big' },
          { c: ['VALUE AS ON DATE: ', F('value')] },
        ]] },
      ]),
      { t: 'footer' },
    ],
  };

  /* ---------------- Motor car ---------------- */
  const car = {
    id: 'car', name: 'Motor Car', kind: 'Pre-inspection', theme: 'sage', art: 'car', style: 'pre',
    defaults: { ...defaultsPre, insurer: 'The Oriental Insu. Co. Ltd. RJN', engineWorking: 'Yes', ac: 'Yes',
      stereo: '—', elecOther: '—', seatCovers: '✓', centralLock: '✓', nonElecOther: '—', recommended: 'YES', rcVerified: 'YES' },
    blocks: [
      { t: 'letterhead' },
      head('MOTOR CAR INSPECTION REPORT', ''),
      { t: 'table', cols: [100], rows: [
        [{ c: 'INSPECTION', cls: 'band c' }],
        [{ c: ['Date : ', F('inspDate', { w: 150 }), '   Time : ', F('inspTime', { w: 150 }), '   Place : ', F('inspPlace')] }],
        [{ c: ['Name & address of registered owner: ', F('owner')], cls: 'own' }],
      ] },
      { t: 'table', cols: [19.5, 33, 18.5, 29], rows: [
        [{ c: 'Vehicle Particulars', span: 4, cls: 'band c' }],
        [B('Vehicle No.'), F('vehicleNo'), 'Make/Model/Variant', F('makeModel')],
        ['Chassis No.', F('chassisNo'), 'Type of Body', F('bodyType')],
        ['Engine No.', F('engineNo'), 'Year of Manufacturing', F('mfgYear')],
        ['Fuel Used', F('fuel'), 'Colour', F('colour')],
        ['Date of Registration', F('regDate'), 'Odometer Reading', F('odometer')],
        [{ c: 'Body Parts', cls: 'band' }, { c: 'Description', cls: 'band' }, { c: 'Body Parts', cls: 'band' }, { c: 'Description', cls: 'band' }],
        ...(() => {
          const L = [
            ['Front Bumper', 'frontBumper', 'Intact/Crack/Broken/Scratch'],
            ['Grill', 'grill', 'Intact/Dented/Broken'],
            ['Head Lamp (LT/RT)', 'headLamp', 'Intact/Broken'],
            ['Side Turn Light (LT/RT)', 'sideTurn', 'Intact/Broken'],
            ['Fog Lamp (LT/RT)', 'fogLamp', 'Intact/Broken/N.F'],
            ['Front Grill', 'frontGrill', 'Intact/Pressed'],
            ['Bonnet', 'bonnet', 'Intact/Dented/Scratch'],
            ['Left Apron', 'leftApron', 'Intact/Dented'],
            ['Right Apron', 'rightApron', 'Intact/Dented'],
            ['LT. Front Frender', 'ltFrontFender', 'Intact/Dented/Scratch'],
            ['LT. Front Door', 'ltFrontDoor', 'Intact/Dented/Scratch'],
            ['LT. Rear Door', 'ltRearDoor', 'Intact/Dented/Scratch'],
            ['LT. Pillar', 'ltPillar', 'Intact/Dented/Scratch'],
            ['LT. Running Board', 'ltRunning', 'Intact/Scratch'],
            ['LT. Qtr. Panel', 'ltQtr', 'Intact/Dented/Scratch'],
            ['Dicky', 'dicky', 'Intact/Dented/Scratch'],
            ['Rear Bumper', 'rearBumper', 'Intact/Pressed/Scratch'],
            ['Tail Lamp (LT/RT)', 'tailLamp', 'Intact/Broken'],
            ['RT. Qtr. Panel', 'rtQtr', 'Intact/Dented/Scratch'],
            ['RT. Rear Door', 'rtRearDoor', 'Intact/Dented/Scratch'],
            ['RT. Front Door', 'rtFrontDoor', 'Intact/Dented/Scratch'],
            ['RT. Pillar', 'rtPillar', 'Intact/Dented/Scratch'],
            ['RT. Running Board', 'rtRunning', 'Intact/Scratch'],
            ['RT. Front Frender', 'rtFrontFender', 'Intact/Dented/Scratch'],
          ];
          const hdr = (t) => [{ c: t, span: 2, cls: 'band' }];
          const R = [
            ['Roof', O('roof', 'Intact/Dented/Scratch')],
            ['Floor/Silencer', O('floor', 'Intact/Pressed/Scratch')],
            ['Under Carriage', O('underCarriage', 'Intact/Dented/Scratch')],
            ['Rear View Mirror (L/R)', O('mirror', 'Intact/Broken/Missing')],
            ['Tyre', O('tyre', 'Good/Poor/Average')],
            ['Engine Working', O('engineWorking', 'Yes/No')],
            [{ c: '', span: 2 }],
            hdr('Accessories Electrical'),
            ['Stereo/CD changer', K('stereo')],
            ['A/c', O('ac', 'Yes/No')],
            ['Any other', K('elecOther')],
            hdr('Accessories Non Electrical'),
            ['Seat Covers', K('seatCovers')],
            ['Central Lock', K('centralLock')],
            ['Any other', K('nonElecOther')],
            hdr('Glass'),
            ['Front W.S. Glass', O('frontWs', 'Intact/Scratch/Broken')],
            ['Left Front Door Glass', O('lfGlass', 'Intact/Broken')],
            ['Left Rear Door Glass', O('lrGlass', 'Intact/Broken')],
            ['Right Front Door Glass', O('rfGlass', 'Intact/Broken')],
            ['Right Rear Door Glass', O('rrGlass', 'Intact/Broken')],
            ['Back Glass', O('backGlass', 'Intact/Broken')],
            ['Left Quarter Glass', O('lqGlass', 'Intact/Broken')],
            ['Right Quarter Glass', O('rqGlass', 'Intact/Broken')],
          ];
          return L.map(([l, k, o], i) => [l, O(k, o), ...R[i]]);
        })(),
      ] },
      ...tail([
        { t: 'table', cols: [100], rows: [[{ c: [B('Value as on date : '), F('value')] }]] },
        { t: 'table', cols: [56, 44], rows: [[
          { c: [{ b: 'Recommended for insurance' }, '   :   ', O('recommended', 'YES/NO')], cls: 'big' },
          { c: [B('R/c Verified'), '   :   ', O('rcVerified', 'YES/NO')] },
        ]] },
      ]),
      { t: 'footer' },
    ],
  };

  /* ---------------- Valuation report ---------------- */
  const cond = 'cond';
  const lbl = (t) => ({ c: t, cls: 'vl' });
  const colon = { c: ':', cls: 'vc' };
  const full = (label, field) => [lbl(label), colon, { c: field, span: 4, cls: 'vv strong' }];
  const pair = (l1, f1, l2, f2) => [lbl(l1), colon, { c: f1, cls: 'vv' }, lbl(l2), colon, { c: f2, cls: 'vv' }];
  const acc = (rows) => rows.map((r) => r.flatMap(([l, k], gi) => [
    { c: l, cls: 'al' }, { c: ':', cls: 'ac' }, { c: [P(k, 'Yes/No'), gi === 3 ? ',' : ''], cls: 'av' + (gi < 3 ? ' vr' : '') },
  ]));

  const valuation = {
    id: 'valuation', name: 'Valuation Report', kind: 'Valuation', theme: 'plain', art: null, style: 'val',
    defaults: { insurer: 'National Insurance Co. Ltd. , DURG', marketValueNote: '' },
    blocks: [
      { t: 'letterhead' },
      { t: 'text', parts: 'VALUATION  REPORT', cls: 'vtitle' },
      { t: 'table', border: 'none', cols: [60, 40], rows: [[
        { c: [B('Report No : '), { b: FY + '/' }, F('reportNo', { w: 60, bold: true })], cls: 'v13' },
        { c: ['Date : ', F('reportDate', { w: 110 })], cls: 'v13 r' },
      ]] },
      { t: 'text', parts: ['To,   ', F('insurer', { w: 380 })], cls: 'v13' },
      { t: 'text', parts: 'INSPECTION DETAILS:', cls: 'v13 vsec0' },
      { t: 'text', parts: ['Inspection Date & Time : ', F('inspDate', { w: 100 }), ' at ', F('inspTime', { w: 80 }), ', Inspected at : ', F('inspPlace')], cls: 'v13' },
      { t: 'text', parts: 'REGISTRATION DETAILS:', cls: 'vsec' },
      { t: 'table', border: 'none', cls: 'vt', cols: [30, 2, 27, 20, 2, 19], rows: [
        full('Registered Owner & Address', F('regOwner', { bold: true })),
        full('Proposed Owner & Address', F('propOwner', { bold: true })),
        full('Registration No.', F('regNo', { bold: true })),
        full('Engine No.', F('engineNo')),
        full('Chassis  no.', F('chassisNo')),
        pair('Manufacturer', F('manufacturer'), 'Model', F('model')),
        pair('Class of Vehicle', F('vehicleClass'), 'Owner Serial No.', F('ownerSerial')),
        pair('Date of Registration', F('regDate'), 'Colour', F('colour')),
        pair('Month & Year Of Manufacturing', F('mfgYear'), 'Type of Fuel', F('fuel')),
        pair('Type of Body', F('bodyType'), 'Odometer Reading', F('odometer')),
        pair('Permit Valid upto', F('permitUpto'), 'Fitness Valid upto', F('fitnessUpto')),
        full('Hypothecation Details ( if any)', F('hypothecation')),
      ] },
      { t: 'text', parts: 'CONDITION', cls: 'vsec' },
      { t: 'table', border: 'none', cls: 'vt', cols: [21, 2, 33, 23, 2, 19], rows: [
        pair('Cowl/Cabin  Assy', F('cCabin', { list: cond }), 'Load  Body', F('cLoad', { list: cond })),
        pair('Engine', F('cEngine', { list: cond }), 'Chassis', F('cChassis', { list: cond })),
        pair('Light & Electricals', F('cElec', { list: cond }), 'Suspension', F('cSusp', { list: cond })),
        pair('Battery', ['Make - ', F('cBattery')], 'Paint  ( internal/External)', F('cPaint', { list: cond })),
        pair('Tyres  Details', ['Front - ', F('cTyreF')], '', ['Rear - ', F('cTyreR')]),
      ] },
      { t: 'text', parts: ['Original Records Verified : ', F('origVerified', { w: 120, list: 'yn' })], cls: 'v12' },
      { t: 'text', parts: 'ACCESSORIES FOUND AT THE TIME OF INSPECTION', cls: 'vsub' },
      { t: 'table', border: 'none', cls: 'vacc', cols: [9, 2, 8, 11, 2, 8, 14, 2, 8, 12, 2, 22], rows: acc([
        [['Audio', 'aAudio'], ['Mist Lamp', 'aMist'], ['Power  Steering', 'aPowerSteering'], ['Crash  Guard', 'aCrash']],
        [['Horn', 'aHorn'], ['Upholstery', 'aUphol'], ['Central  locking', 'aCentral'], ['Rear  Wiper', 'aWiper']],
        [['Gas Kit', 'aGas'], ['Demister', 'aDemister'], ['Power  Window', 'aWindow'], ['Sun C/Film', 'aSunFilm']],
        [['Carrier', 'aCarrier'], ['Spioler', 'aSpoiler'], ['Air  Condition', 'aAC'], ['Alloy  Wheel', 'aAlloy']],
      ]) },
      { t: 'text', parts: ['General Overall Condition of the vehicle : ', F('overall', { w: 160, list: cond })], cls: 'v12 vgap' },
      { t: 'text', parts: 'REMARKS :', cls: 'vsub vgap' },
      { t: 'text', parts: ['Insurance Details : ', F('insuranceDetails')], cls: 'v13' },
      { t: 'text', parts: ['Accidents ( If any) : ', F('accidents', { list: 'yn' })], cls: 'v13' },
      { t: 'text', parts: ['Any major repairs undertaken : ', F('majorRepairs', { list: 'yn' })], cls: 'v13' },
      { t: 'text', parts: ['Estimated further life of vehicle : ', F('furtherLife')], cls: 'v13' },
      { t: 'text', parts: ['Estimated expanses involved to take the vehicle to road : ', F('expenses')], cls: 'v13' },
      { t: 'text', parts: ['MARKET VALUE AS ON DATED OF INSPECTION : ', B('Rs. '), F('marketValue', { fit: 90, bold: true, money: true }), B(' ( Rs. '), F('marketWords', { bold: true, fit: 140 }), B(' only)')], cls: 'vmv' },
      { t: 'text', parts: 'THIS MARKET VALUE ASSESSMENT ARE GIVEN FOR THE FINANCIAL PURPOSE AND FOR INSURER`S IDV', cls: 'vmv2' },
      { t: 'vsign' },
      { t: 'footer' },
    ],
  };

  const LISTS = {
    cond: ['Good', 'Average', 'Poor', 'Good working order', 'O.K.', 'Make - Exide', 'MRF', 'Not Provided', 'NA'],
    yn: ['Yes', 'No', 'Not Provided', 'NA'],
  };

  window.SV_TEMPLATES = { valuation, commercial, twowheeler, car };
  window.SV_LISTS = LISTS;
  window.SV_FY = FY;
})();

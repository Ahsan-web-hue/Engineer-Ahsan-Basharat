/* =========================================================
   3D PCB MOTHERBOARD BACKGROUND  (Three.js r128, fully procedural)
   No image downloads: board, traces, silkscreen and chip markings are
   painted to canvases at load time, components are instanced meshes.
   ========================================================= */
(() => {
'use strict';
const host = document.getElementById('pcb-bg'), cv = document.getElementById('pcb-canvas');
if (!host || !cv || !window.THREE) return;
const T = THREE, DOC = document.documentElement;
const mobile = matchMedia('(max-width:768px)').matches || /Mobi|Android/i.test(navigator.userAgent);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const R = (a, b) => a + rnd() * (b - a), lerp = (a, b, t) => a + (b - a) * t;

function start() {
  const W = 40, H = 30, PX = mobile ? 1280 : 2560, S = PX / W;   // board units, texture px, px per unit
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: !mobile, powerPreference: 'high-performance' }); }
  catch (e) { host.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new T.Scene(), FOG = 0x03070f;
  scene.background = new T.Color(FOG); scene.fog = new T.FogExp2(FOG, 0.034);
  const cam = new T.PerspectiveCamera(32, 1, 0.1, 120);

  /* ---------- studio environment (soft boxes for metal reflections) ---------- */
  const pmrem = new T.PMREMGenerator(renderer), es = new T.Scene(); es.background = new T.Color(0x02050b);
  [[8, 3, -6, 7, -3, 0xcfe8ff, 6], [5, 5, 7, 4, 3, 0x2dd4bf, 3], [10, 2, 0, 3, -8, 0x9fb8d8, 3]].forEach(([w, h, x, y, z, c, i]) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
  });
  scene.environment = pmrem.fromScene(es, 0.04).texture;

  /* ---------- lights ---------- */
  const hemi = new T.HemisphereLight(0x1b3552, 0x05080e, 0.7); scene.add(hemi);
  const key = new T.DirectionalLight(0xc4e6ff, 2.1); key.position.set(-10, 16, 8); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 60 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; scene.add(key);
  const rim = new T.DirectionalLight(0x2dd4bf, 0.9); rim.position.set(12, 6, -14); scene.add(rim);
  const spot = new T.SpotLight(0x2dd4bf, 1.4, 40, 0.55, 1); spot.position.set(7, 9, 3); spot.target.position.set(6, 0, -3);
  scene.add(spot, spot.target);

  /* ---------- board texture painting ---------- */
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(h); return c; };
  const col = mk(W * S, H * S), orm = mk(W * S, H * S), emi = mk(W * S / 2, H * S / 2);
  const cc = col.getContext('2d'), co = orm.getContext('2d'), ce = emi.getContext('2d');
  [cc, co, ce].forEach(c => { c.lineJoin = 'miter'; c.miterLimit = 4; c.lineCap = 'butt'; });
  const X = x => (x + W / 2) * S, Zc = z => (z + H / 2) * S;
  const COPPER = '#a06f49', ORM_CU = '#ff62ff';       // ORM: R=height, G=roughness, B=metalness
  cc.fillStyle = '#060b14'; cc.fillRect(0, 0, col.width, col.height);
  co.fillStyle = '#009900'; co.fillRect(0, 0, orm.width, orm.height);
  for (let i = 0; i < (mobile ? 4000 : 16000); i++) {
    cc.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.05)';
    cc.fillRect(rnd() * col.width, rnd() * col.height, R(1, 5) * S / 12, R(1, 5) * S / 12);
  }
  const both = fn => { fn(cc, COPPER); fn(co, ORM_CU); };
  const pad = (x, z, w, h, rot = 0) => both((c, st) => { c.save(); c.translate(X(x), Zc(z)); c.rotate(rot); c.fillStyle = st; c.fillRect(-w * S / 2, -h * S / 2, w * S, h * S); c.restore(); });
  const via = (x, z) => {
    both((c, st) => { c.fillStyle = st; c.beginPath(); c.arc(X(x), Zc(z), .13 * S, 0, 7); c.fill(); });
    cc.fillStyle = '#02040a'; cc.beginPath(); cc.arc(X(x), Zc(z), .05 * S, 0, 7); cc.fill();
    co.fillStyle = '#009900'; co.beginPath(); co.arc(X(x), Zc(z), .05 * S, 0, 7); co.fill();
  };
  const silk = (t, x, z, size, rot = 0, a = .5) => { cc.save(); cc.translate(X(x), Zc(z)); cc.rotate(rot); cc.fillStyle = `rgba(150,172,196,${a})`; cc.font = `${size * S}px "Fira Code",monospace`; cc.fillText(t, 0, 0); cc.restore(); };
  const silkRect = (x, z, w, h) => { cc.strokeStyle = 'rgba(150,172,196,.4)'; cc.lineWidth = .035 * S; cc.strokeRect(X(x - w / 2), Zc(z - h / 2), w * S, h * S); };

  function stroke(pts, w, glowA) {
    [[cc, 1, COPPER], [co, 1, ORM_CU]].forEach(([c, k, st]) => {
      c.strokeStyle = st; c.lineWidth = w * S; c.beginPath();
      pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](X(p[0]), Zc(p[1]))); c.stroke();
    });
    if (glowA) [[3, .16], [1, 1]].forEach(([m, a]) => {
      ce.strokeStyle = `rgba(255,255,255,${glowA * a})`; ce.lineWidth = w * S * .5 * m; ce.beginPath();
      pts.forEach((p, i) => ce[i ? 'lineTo' : 'moveTo'](X(p[0]) / 2, Zc(p[1]) / 2)); ce.stroke();
    });
  }
  function off(p, d) {   // parallel offset of a polyline with mitred corners
    const n = [];
    for (let i = 0; i < p.length - 1; i++) { const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], l = Math.hypot(dx, dz) || 1; n.push([-dz / l * d, dx / l * d]); }
    const o = [[p[0][0] + n[0][0], p[0][1] + n[0][1]]];
    for (let i = 1; i < p.length - 1; i++) {
      const a = n[i - 1], b = n[i];
      const x1 = p[i - 1][0] + a[0], y1 = p[i - 1][1] + a[1], x2 = p[i][0] + a[0], y2 = p[i][1] + a[1];
      const x3 = p[i][0] + b[0], y3 = p[i][1] + b[1], x4 = p[i + 1][0] + b[0], y4 = p[i + 1][1] + b[1];
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(den) < 1e-6) o.push([x2, y2]); else { const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den; o.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]); }
    }
    const L = p.length - 1; o.push([p[L][0] + n[L - 1][0], p[L][1] + n[L - 1][1]]); return o;
  }
  const glowPaths = [];
  function bus(a, b, n, sp, axis, glow, vias = '') {
    const h = axis === 'h', dx = b[0] - a[0], dz = b[1] - a[1]; let pts;
    if (h) { const xm = (a[0] + b[0]) / 2, j = Math.abs(dz) / 2 * Math.sign(dx); pts = Math.abs(dz) < .01 ? [a, b] : [a, [xm - j, a[1]], [xm + j, b[1]], b]; }
    else { const zm = (a[1] + b[1]) / 2, j = Math.abs(dx) / 2 * Math.sign(dz); pts = Math.abs(dx) < .01 ? [a, b] : [a, [a[0], zm - j], [b[0], zm + j], b]; }
    for (let i = 0; i < n; i++) {
      const o = off(pts, (i - (n - 1) / 2) * sp), g = glow && rnd() < .55 ? R(.35, .95) : 0;
      stroke(o, .085, g); if (g && glowPaths.length < 140) glowPaths.push(o);
      if (vias.includes('b')) via(...o[o.length - 1]); if (vias.includes('a')) via(...o[0]);
      if (rnd() < .12) via(...o[1]);
    }
  }

  /* ---------- materials & helpers ---------- */
  const blk = new T.MeshStandardMaterial({ color: 0x0b0e14, roughness: .5, metalness: .1 });
  const metal = new T.MeshStandardMaterial({ color: 0xc3cad4, metalness: 1, roughness: .32 });
  const anod = new T.MeshStandardMaterial({ color: 0x1d2633, metalness: .85, roughness: .5 });
  const gold = new T.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: .3 });
  const box = (w, h, d, x, y, z, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
  const tex = (c, enc = true) => { const t = new T.CanvasTexture(c); t.anisotropy = aniso; if (enc) t.encoding = T.sRGBEncoding; return t; };
  function marking(lines, bg, fg, brushed) {
    const c = mk(256, 256), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
    if (brushed) for (let i = 0; i < 300; i++) { g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.fillRect(0, rnd() * 256, 256, 1); }
    g.fillStyle = fg; g.font = 'bold 21px "Fira Code",monospace'; g.textAlign = 'center';
    lines.forEach((t, i) => g.fillText(t, 128, 98 + i * 30));
    g.fillStyle = brushed ? '#4a5260' : '#1b212b'; g.beginPath(); g.arc(28, 28, 9, 0, 7); g.fill();
    return new T.MeshStandardMaterial({ map: tex(c), roughness: brushed ? .4 : .55, metalness: brushed ? 1 : .1 });
  }
  const chips = [], leads = [];
  function qfp(x, z, s, n, lines, ref) {
    chips.push({ x, z, r: s / 2 + .5 });
    box(s, .5, s, x, .3, z, [blk, blk, marking(lines, '#0a0d13', '#aab4c2'), blk, blk, blk]);
    const p = s * .86 / n;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ux, uz]) => { for (let i = 0; i < n; i++) {
      const o = -s * .43 + p * (i + .5), lx = x + ux * (s / 2 + .17) + (uz ? o : 0), lz = z + uz * (s / 2 + .17) + (ux ? o : 0), r = ux ? 0 : Math.PI / 2;
      leads.push([lx, .12, lz, r]); pad(lx + ux * .1, lz + uz * .1, .55, p * .55, r);
    } });
    silkRect(x, z, s + 1.5, s + 1.5); silk(ref, x - s / 2 - .6, z - s / 2 - .8, .42);
  }
  function bga(x, z, s, lines, ref) {
    chips.push({ x, z, r: s / 2 + .5 });
    box(s, .14, s, x, .12, z, new T.MeshStandardMaterial({ color: 0x0d131c, roughness: .6, metalness: .2 }));
    box(s * .78, .26, s * .78, x, .32, z, [metal, metal, marking(lines, '#8f99a7', '#262d38', true), metal, metal, metal]);
    silkRect(x, z, s + 1, s + 1); silk(ref, x - s / 2 - .4, z - s / 2 - .6, .42);
  }
  function soic(x, z, lines, ref) {
    chips.push({ x, z, r: 1.4 });
    box(1.2, .3, 1.5, x, .2, z, [blk, blk, marking(lines, '#0a0d13', '#aab4c2'), blk, blk, blk]);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const lz = z - .57 + i * .38; leads.push([x + s * .74, .1, lz, 0]); pad(x + s * .82, lz, .5, .2); }
    silk(ref, x - .6, z - 1.1, .38);
  }
  const capTop = (() => { const c = mk(128, 128), g = c.getContext('2d'); g.fillStyle = '#aeb7c2'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#5d6672'; g.lineWidth = 4;
    g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke(); g.beginPath(); g.moveTo(40, 38); g.lineTo(88, 90); g.moveTo(88, 38); g.lineTo(40, 90); g.stroke();
    return new T.MeshStandardMaterial({ map: tex(c), metalness: .9, roughness: .4 }); })();
  const sleeve = new T.MeshStandardMaterial({ color: 0x101c2e, metalness: .3, roughness: .35 });
  function elco(x, z, r, h, ref) {
    chips.push({ x, z, r: r + .5 });
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 32), [sleeve, capTop, sleeve]); m.position.set(x, h / 2 + .05, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    pad(x - r - .2, z, .45, .5); pad(x + r + .2, z, .45, .5); silk(ref, x - r, z + r + .9, .38);
  }

  /* ---------- component layout ---------- */
  bga(-9, -6, 4.6, ['EDGE-NPU', 'AI ACCEL', '8 TOPS', 'ASB-A1'], 'U2');
  qfp(6, -3, 3.6, 16, ['AB-MCU7', 'ARM CORTEX-M7', '480MHZ', '2026 ASB'], 'U1');
  qfp(16, 2, 2.2, 10, ['WIFI-BT', '2.4GHZ', 'ASB-W2'], 'U4');
  soic(0, 0, ['25Q128', 'FLASH', 'B2631'], 'U3');
  elco(-3, 4, .55, 1.1, 'C21'); elco(-1.8, 5.5, .55, 1.1, 'C22'); elco(15, -8, .7, 1.3, 'C30'); elco(10, 8, .55, 1.1, 'C31'); elco(-15, 7, .7, 1.3, 'C32');
  // heatsink on stand-offs
  { const hx = -1, hz = -10.5; chips.push({ x: hx, z: hz, r: 3 });
    box(4.6, .22, 4.6, hx, .95, hz, anod);
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { const p = new T.Mesh(new T.CylinderGeometry(.12, .12, .95, 12), metal); p.position.set(hx + a, .48, hz + b); p.castShadow = true; scene.add(p); pad(hx + a, hz + b, .5, .5); }
    const fm = new T.InstancedMesh(new T.BoxGeometry(.16, 1.1, 4.3), anod, 14), mm = new T.Matrix4();
    for (let i = 0; i < 14; i++) { mm.setPosition(hx - 2 + i * .3, 1.61, hz); fm.setMatrixAt(i, mm); }
    fm.castShadow = fm.receiveShadow = true; fm.instanceMatrix.needsUpdate = true; scene.add(fm); silk('U5 PWR', hx - 2.2, hz + 3.1, .42); }
  // crystal, inductors
  box(1, .38, .5, 10.2, .25, -6, metal); pad(9.5, -6, .5, .5); pad(10.9, -6, .5, .5); chips.push({ x: 10.2, z: -6, r: 1 }); silk('Y1 25M', 9.5, -5.1, .38);
  [[3, 4], [5.2, 4], [-5, .5]].forEach(([x, z], i) => { box(1.1, .55, 1.1, x, .32, z, new T.MeshStandardMaterial({ color: 0x1a1e26, metalness: .6, roughness: .5 })); pad(x - .55, z, .35, .8); pad(x + .55, z, .35, .8); chips.push({ x, z, r: 1.1 }); silk('L' + (i + 1), x - .3, z + 1.2, .38); });
  // 16-pin header
  { const hx = 5, hz = 10, n = 16, hm = new T.InstancedMesh(new T.BoxGeometry(.1, .9, .1), gold, n), mm = new T.Matrix4();
    box(n * .36, .4, .42, hx, .25, hz, blk); chips.push({ x: hx, z: hz, r: 3.5 });
    for (let i = 0; i < n; i++) { const px = hx - (n - 1) * .18 + i * .36; mm.setPosition(px, .55, hz); hm.setMatrixAt(i, mm); pad(px, hz, .3, .3); via(px, hz); }
    hm.castShadow = true; hm.instanceMatrix.needsUpdate = true; scene.add(hm); silk('J1  GPIO', hx - 2.8, hz + 1, .42); }
  // status LEDs
  const leds = []; for (let i = 0; i < 4; i++) { const m = new T.MeshBasicMaterial({ color: 0x2dd4bf }); box(.3, .12, .2, 3 + i * 1.1, .15, 7.2, m); pad(3 + i * 1.1, 7.2, .5, .3); leds.push({ m, base: new T.Color(), ph: rnd() * 6 }); }
  silk('STATUS', 2.9, 6.4, .36);

  /* ---------- traces ---------- */
  const mp = 3.6 * .86 / 16;
  bus([-6.6, -6], [3.9, -3], 16, mp, 'h', true);                  // NPU <-> MCU
  bus([6, -.85], [3.5, 6], 16, mp, 'v', true, 'b');               // MCU south
  bus([6, -5.2], [9, -13], 16, mp, 'v', true, 'b');               // MCU north
  bus([8.55, -3], [14.5, 2], 10, .19, 'h', true);                 // MCU <-> radio
  bus([-11.6, -6], [-19, -3.5], 14, .16, 'h', true, 'b');
  bus([-9, -8.6], [-12, -14.5], 12, .16, 'v', false, 'b');
  bus([-9, -3.4], [-6, 3.4], 10, .16, 'v', true, 'b');
  bus([16, 3.4], [18, 12], 10, .19, 'v', false, 'b');
  bus([-19, 10], [-4, 12.5], 8, .15, 'h', true, 'ab');
  bus([19, 9], [8, 12], 6, .15, 'h', false, 'ab');
  bus([-17, -14], [-15, 0], 6, .15, 'v', false, 'ab');
  silk('ASB-EMB-CTRL  REV 3.2', -17, 13.4, .7, 0, .45); silk('ARM  |  FPGA  |  AI EDGE  |  RTOS', -17, 14.3, .4, 0, .35);
  for (const [x, z] of [[-19, -13.5], [19, -13.5], [-19, 13.5], [19, 13.5]]) { both((c, st) => { c.strokeStyle = st; c.lineWidth = .18 * S; c.beginPath(); c.arc(X(x), Zc(z), .55 * S, 0, 7); c.stroke(); }); }

  /* ---------- passives (instanced 0603-style R/C) ---------- */
  const pas = [], occ = new Set(); let tries = 0;
  const near = () => { const c = chips[(rnd() * chips.length) | 0], a = rnd() * 6.283, d = c.r + R(.8, 3); return [c.x + Math.cos(a) * d, c.z + Math.sin(a) * d]; };
  while (pas.length < (mobile ? 150 : 260) && tries++ < 5000) {
    const [x, z] = rnd() < .6 ? near() : [R(-19, 19), R(-13, 13)];
    if (Math.abs(x) > 19 || Math.abs(z) > 14 || chips.some(c => Math.abs(x - c.x) < c.r + .6 && Math.abs(z - c.z) < c.r + .6)) continue;
    const k = Math.round(x / 1.1) + ',' + Math.round(z / .9); if (occ.has(k)) continue; occ.add(k);
    pas.push([x, z, rnd() < .5 ? 0 : Math.PI / 2, rnd() < .7]);
  }
  { const bm = new T.InstancedMesh(new T.BoxGeometry(.5, .16, .26), new T.MeshStandardMaterial({ roughness: .6, metalness: .05 }), pas.length);
    const cm = new T.InstancedMesh(new T.BoxGeometry(.09, .18, .28), metal, pas.length * 2);
    const m = new T.Matrix4(), q = new T.Quaternion(), pos = new T.Vector3(), one = new T.Vector3(1, 1, 1), up = new T.Vector3(0, 1, 0);
    pas.forEach(([x, z, r, ceramic], i) => {
      q.setFromAxisAngle(up, r); bm.setMatrixAt(i, m.compose(pos.set(x, .1, z), q, one)); bm.setColorAt(i, new T.Color(ceramic ? 0x6b5a45 : 0x12161d));
      [-1, 1].forEach((s, j) => { cm.setMatrixAt(i * 2 + j, m.compose(pos.set(x + Math.cos(r) * s * .2, .1, z - Math.sin(r) * s * .2), q, one)); pad(x + Math.cos(r) * s * .25, z - Math.sin(r) * s * .25, .22, .34, -r); });
      if (i % 9 === 0) silk((ceramic ? 'C' : 'R') + (i + 1), x - .3, z + .6, .3, 0, .35);
    });
    [bm, cm].forEach(o => { o.castShadow = o.receiveShadow = true; o.instanceMatrix.needsUpdate = true; scene.add(o); }); bm.instanceColor.needsUpdate = true; }
  // IC leads (one draw call)
  { const lm = new T.InstancedMesh(new T.BoxGeometry(.4, .05, .1), metal, leads.length), m = new T.Matrix4(), q = new T.Quaternion(), one = new T.Vector3(1, 1, 1), up = new T.Vector3(0, 1, 0), pos = new T.Vector3();
    leads.forEach(([x, y, z, r], i) => { q.setFromAxisAngle(up, r); lm.setMatrixAt(i, m.compose(pos.set(x, y, z), q, one)); });
    lm.castShadow = true; lm.instanceMatrix.needsUpdate = true; scene.add(lm); }

  /* ---------- the board itself ---------- */
  const boardMat = new T.MeshStandardMaterial({ map: tex(col), bumpMap: tex(orm, false), bumpScale: 2.5, roughnessMap: tex(orm, false), metalnessMap: null, roughness: 1, metalness: 1,
    emissive: new T.Color(0x06b6d4), emissiveMap: tex(emi), emissiveIntensity: 1.15, envMapIntensity: .9 });
  boardMat.metalnessMap = boardMat.roughnessMap;
  // Light-mode look: same real board, but a pale solder mask (copper stays copper, silkscreen turns dark)
  const uL = { value: 0 };
  boardMat.onBeforeCompile = sh => {
    sh.uniforms.uLight = uL;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uLight;\nvoid main() {').replace('#include <map_fragment>',
      '#include <map_fragment>\n float cuM = texture2D(roughnessMap, vUv).b; vec3 dd = diffuseColor.rgb - vec3(.0018,.0033,.007);' +
      ' vec3 lb = clamp(vec3(.40,.45,.50) - dd * 3.0, 0.0, 1.0); diffuseColor.rgb = mix(diffuseColor.rgb, mix(lb, diffuseColor.rgb, cuM), uLight);');
  };
  const geo = new T.PlaneGeometry(W, H); geo.rotateX(-Math.PI / 2);
  const board = new T.Mesh(geo, boardMat); board.receiveShadow = true; scene.add(board);

  /* ---------- travelling data pulses ---------- */
  const paths = glowPaths.map(p => { const cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return { p, cum, len: cum[cum.length - 1] }; });
  const NP = mobile ? 26 : 60, pPos = new Float32Array(NP * 3), pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pPos, 3));
  const pu = Array.from({ length: NP }, () => ({ a: paths[(rnd() * paths.length) | 0], d: 0, v: R(1.5, 3.5) })); pu.forEach(o => o.d = rnd() * o.a.len);
  const sc = mk(64, 64), sg = sc.getContext('2d'), gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
  const pMat = new T.PointsMaterial({ map: tex(sc, false), size: .5, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0x2dd4bf });
  const pts = new T.Points(pg, pMat); pts.frustumCulled = false; scene.add(pts);
  function movePulses(dt) {
    pu.forEach((o, i) => {
      o.d += o.v * dt; if (o.d > o.a.len) { o.a = paths[(rnd() * paths.length) | 0]; o.d = 0; }
      const { p, cum } = o.a; let k = 0; while (k < cum.length - 2 && cum[k + 1] < o.d) k++;
      const t = (o.d - cum[k]) / ((cum[k + 1] - cum[k]) || 1);
      pPos[i * 3] = lerp(p[k][0], p[k + 1][0], t); pPos[i * 3 + 1] = .07; pPos[i * 3 + 2] = lerp(p[k][1], p[k + 1][1], t);
    }); pg.attributes.position.needsUpdate = true;
  }

  /* ---------- theme sync (follows your accent customizer) ---------- */
  function accent() {
    const L = DOC.classList.contains('light-mode'), bgc = L ? 0xdde4ec : FOG;
    uL.value = L ? 1 : 0; scene.background.setHex(bgc); scene.fog.color.setHex(bgc);
    renderer.toneMappingExposure = L ? .85 : 1.05; hemi.intensity = L ? 1.2 : .7; boardMat.emissiveIntensity = L ? .4 : 1.15;
    pMat.blending = L ? T.NormalBlending : T.AdditiveBlending; pMat.needsUpdate = true;
    const c = new T.Color((getComputedStyle(document.body).getPropertyValue('--brand-500') || '#06b6d4').trim());
    boardMat.emissive.copy(c); pMat.color.copy(c).multiplyScalar(L ? .65 : 1); spot.color.copy(c); rim.color.copy(c); leds.forEach(l => l.base.copy(c));
    if (reduce) draw(0);
  }
  new MutationObserver(accent).observe(DOC, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  new MutationObserver(accent).observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });

  /* ---------- camera: scroll parallax + gentle sway ---------- */
  let tgt = 0, cur = reduce ? .25 : 0, mx = 0, my = 0, tx = 0, ty = 0, zoom = 1, lw = 0, lh = 0;
  const prog = () => { const h = DOC.scrollHeight - innerHeight; return h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0; };
  function size() {
    const w = innerWidth, h = innerHeight; if (w === lw && Math.abs(h - lh) < 120) return; lw = w; lh = h;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    zoom = Math.min(2.4, Math.max(1, 1.2 / cam.aspect)); scene.fog.density = .034 / zoom; if (reduce) draw(0);
  }
  function draw(t) {
    const s = cur, lx = lerp(-4, 6, s), lz = lerp(-2, -4, s);
    cam.position.set(lx + (-1 + Math.sin(t * .12) * .6 - mx * 1.5) * zoom, (9.2 - s * 1.2 + my * .6) * zoom, lz + (11.5 - s * 3) * zoom);
    cam.lookAt(lx, 0, lz); renderer.render(scene, cam);
  }
  let last = 0, prev = 0;
  function frame(ms) {
    requestAnimationFrame(frame);
    if (document.hidden || (mobile && ms - last < 33)) return;
    last = ms; const t = ms / 1000, dt = Math.min(.1, t - prev); prev = t;
    cur += (tgt - cur) * .06; mx += (tx - mx) * .04; my += (ty - my) * .04;
    movePulses(dt); leds.forEach(l => l.m.color.copy(l.base).multiplyScalar(.15 + .9 * (Math.sin(t * 2 + l.ph) > 0 ? 1 : .2)));
    draw(t);
  }
  size(); accent(); renderer.shadowMap.needsUpdate = true;
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 120); });
  if (!reduce) {
    addEventListener('scroll', () => { tgt = prog(); }, { passive: true });
    if (!mobile) addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
    requestAnimationFrame(frame);
  } else draw(0);
  requestAnimationFrame(() => host.classList.add('ready'));
}

const boot = () => { try { start(); } catch (e) { console.warn('PCB background disabled:', e); host.classList.add('no-webgl'); } };
const go = () => (window.requestIdleCallback ? requestIdleCallback(boot, { timeout: 1500 }) : setTimeout(boot, 200));
document.readyState === 'complete' ? go() : addEventListener('load', go);
})();
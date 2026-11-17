import * as THREE from 'three';
import { MODELS, CLS } from './data.js';

// ---------- utilidades ----------
const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.72, metalness: o.m ?? 0.18, flatShading: !!o.flat, side: o.side || THREE.FrontSide, transparent: !!o.t, opacity: o.o ?? 1 }));
  return matCache.get(key);
}
const DARK = 0x262624, GLASS = { r: 0.15, m: 0.6 };
function box(w, h, d, m, x = 0, y = 0, z = 0) { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); return k; }
function cyl(rt, rb, h, m, seg = 12, x = 0, y = 0, z = 0) { const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); k.position.set(x, y, z); return k; }
function tube(r, len, m, seg = 8) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2); return new THREE.Mesh(g, m); }
function starShape(r) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.4 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); } return s; }
function crossShape(r, w) { const s = new THREE.Shape(); const a = r, b = w; [[-b, a], [b, a], [b, b], [a, b], [a, -b], [b, -b], [b, -a], [-b, -a], [-b, -b], [-a, -b], [-a, b], [-b, b]].forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; }
const flatMat = c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
// Insignia plana en el plano XY (normal +Z)
export function insignia(fac, r, kind = 'wing') {
  const g = new THREE.Group(); let z = 0;
  const add = (geo, c) => { const m = new THREE.Mesh(geo, flatMat(c)); m.position.z = (z += 0.01); g.add(m); };
  if (fac === 'us') { add(new THREE.CircleGeometry(r, 24), 0x1f3a6b); if (kind === 'wing44') { add(new THREE.PlaneGeometry(r * 3.2, r * 0.6), 0xf2f2ee); } add(new THREE.ShapeGeometry(starShape(r * 0.95)), 0xf2f2ee); }
  else if (fac === 'uk') { add(new THREE.CircleGeometry(r, 24), 0x2a3d6e); if (kind !== 'wing') add(new THREE.CircleGeometry(r * 0.68, 24), 0xeeeeea); add(new THREE.CircleGeometry(r * 0.38, 24), 0xa52a24); }
  else if (fac === 'jp') { if (kind !== 'wing') add(new THREE.CircleGeometry(r * 1.12, 24), 0xf0f0ec); add(new THREE.CircleGeometry(r, 24), 0xb3221f); }
  else if (fac === 'de') { add(new THREE.ShapeGeometry(crossShape(r, r * 0.42)), 0xf0f0ec); add(new THREE.ShapeGeometry(crossShape(r * 0.86, r * 0.24)), 0x161616); }
  else if (fac === 'it') { add(new THREE.CircleGeometry(r, 24), 0xf0f0ec); add(new THREE.CircleGeometry(r * 0.75, 24), 0x161616); add(new THREE.CircleGeometry(r * 0.3, 24), 0xf0f0ec); }
  return g;
}

// ---------- BARCOS ----------
function hullShape(L, B, bow = 0.3) {
  const pts = [], hb = B / 2, n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n, z = -L / 2 + t * L; let w;
    if (t < 0.07) w = hb * (0.72 + 0.28 * Math.sqrt(t / 0.07));
    else if (t > 1 - bow) { const k = (t - (1 - bow)) / bow; w = hb * Math.max(0.02, 1 - Math.pow(k, 1.7)); }
    else w = hb;
    pts.push([w, z]);
  }
  const s = new THREE.Shape();
  pts.forEach(([w, z], i) => i ? s.lineTo(w, -z) : s.moveTo(w, -z));
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(-pts[i][0], -pts[i][1]);
  return s;
}
function extrudeUp(shape, h) { const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); return g; }

function buildShip(m) {
  const c = CLS[m.cls], L = c.len, B = c.beam, F = c.fb, g = new THREE.Group();
  const hullM = mat(m.hull, { r: 0.6 }), supM = mat(m.sup, { r: 0.6 }), deckM = mat(m.deck, { r: 0.9, m: 0 }), dk = mat(DARK);
  const turrets = [];
  if (m.cls === 'sub') {
    const hg = new THREE.CapsuleGeometry(B / 2, L - B, 6, 14); hg.rotateX(Math.PI / 2); hg.scale(1, 0.72, 1);
    const hull = new THREE.Mesh(hg, hullM); hull.position.y = -0.4; g.add(hull);
    g.add(box(B * 0.45, 0.5, L * 0.78, deckM, 0, F - 0.1, -L * 0.02));
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 2.8, 14), supM); tw.scale.set(0.95, 1, 2.6); tw.position.set(0, F + 1.3, L * 0.06); g.add(tw);
    g.add(cyl(0.12, 0.12, 3.2, dk, 6, 0, F + 3.6, L * 0.08), cyl(0.1, 0.1, 2.4, dk, 6, 0, F + 3.2, L * 0.03));
    const gun = new THREE.Group(); gun.position.set(0, F + 0.4, L * 0.2); gun.add(box(0.7, 0.6, 0.8, supM)); const b = tube(0.1, 2.6, dk); b.position.y = 0.2; gun.add(b); g.add(gun); turrets.push(gun);
    g.userData = { turrets, hw: B / 2 + 0.6, hl: L / 2, top: F + 3 };
    return g;
  }
  const bow = m.cls === 'pt' ? 0.35 : 0.3;
  const shape = hullShape(L, B, bow);
  const hullG = extrudeUp(shape, F + 2.6); hullG.translate(0, -2.6, 0);
  g.add(new THREE.Mesh(hullG, hullM));
  const boot = new THREE.Mesh(extrudeUp(hullShape(L * 1.003, B * 1.02, bow), 0.5), mat(0x1c1c1c)); boot.position.y = -0.35; g.add(boot);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(hullShape(L * 0.985, B * 0.95, bow)), deckM); deck.rotation.x = -Math.PI / 2; deck.position.y = F + 0.02; g.add(deck);
  if (m.cls === 'pt') {
    g.add(box(B * 0.55, 1.2, L * 0.22, supM, 0, F + 0.6, L * 0.08), box(B * 0.5, 0.3, 0.3, mat(0x203040, GLASS), 0, F + 1.1, L * 0.19));
    for (const sx of [-1, 1]) for (const z of [0.22, -0.12]) { const t = tube(0.32, L * 0.28, mat(0x3d3f3a)); t.position.set(sx * B * 0.34, F + 0.35, z * L - L * 0.14); g.add(t); }
    const mg = new THREE.Group(); mg.position.set(0, F + 0.5, -L * 0.18); mg.add(cyl(0.45, 0.5, 0.6, supM, 10)); const b = tube(0.06, 1.6, dk); b.position.y = 0.3; mg.add(b); g.add(mg); turrets.push(mg);
    g.add(cyl(0.06, 0.06, 4, dk, 5, 0, F + 2.5, L * 0.05));
    g.userData = { turrets, hw: B / 2 + 0.4, hl: L / 2, top: F + 2 };
    return g;
  }
  const isCr = m.cls === 'cruiser';
  // Superestructura y puente
  const bz = (isCr ? 0.12 : 0.17) * L;
  g.add(box(B * 0.62, 2.4, L * 0.12, supM, 0, F + 1.2, bz));
  g.add(box(B * 0.5, 2.2, L * 0.07, supM, 0, F + 3.5, bz + L * 0.01));
  g.add(box(B * 0.52, 0.45, 0.2, mat(0x1d2730, GLASS), 0, F + 4.1, bz + L * 0.045));
  if (m.bigBridge) { g.add(box(B * 0.42, 5, L * 0.05, supM, 0, F + 6.5, bz)); g.add(box(B * 0.46, 0.5, 0.2, mat(0x1d2730, GLASS), 0, F + 8.6, bz + L * 0.025)); }
  if (isCr) g.add(box(B * 0.58, 2, L * 0.24, supM, 0, F + 1, -L * 0.05));
  else g.add(box(B * 0.46, 1.4, L * 0.22, supM, 0, F + 0.7, -L * 0.04));
  // Mástil
  const mz = bz - L * 0.04, mh = isCr ? 14 : 10;
  g.add(cyl(0.14, 0.2, mh, dk, 6, 0, F + mh / 2 + 2, mz), box(B * 0.7, 0.12, 0.12, dk, 0, F + mh * 0.85, mz));
  // Chimeneas
  for (const z of m.funnels) { const r = isCr ? B * 0.13 : B * 0.15, fh = isCr ? 6.5 : 4.4; const f = cyl(r, r * 1.08, fh, supM, 14, 0, F + fh / 2 + 1.2, z * L); f.scale.z = m.funnels.length === 1 ? 1.9 : 1.35; f.rotation.x = -0.1; g.add(f); const cap = cyl(r * 1.02, r * 1.02, 0.6, dk, 14, 0, F + fh + 1.2, z * L - 0.3); cap.scale.z = f.scale.z; g.add(cap); }
  // Tubos lanzatorpedos
  for (const z of (m.tubes || [])) { const tg = new THREE.Group(); tg.position.set(0, F + 0.6, z * L); for (let k = -1.5; k <= 1.5; k++) { const t = tube(0.28, 7, mat(0x4a4d48)); t.position.set(k * 0.62, 0, -3.5); tg.add(t); } g.add(tg); }
  // Torres principales
  const tw = m.tw || 1;
  const fwd = m.turrets.filter(z => z > 0).sort((a, b) => b - a), aft = m.turrets.filter(z => z < 0).sort((a, b) => a - b);
  for (const z of m.turrets) {
    const isF = z > 0, list = isF ? fwd : aft, rank = list.indexOf(z), raised = rank === 1 ? (isCr ? 1.6 : 1.1) : rank >= 2 ? 0.4 : 0;
    const t = new THREE.Group(); t.position.set(0, F + raised, z * L); t.userData.base = isF ? 0 : Math.PI; t.rotation.y = t.userData.base;
    const tWid = isCr ? B * 0.55 : B * 0.44, tLen = isCr ? 6 : 3.4, tH = isCr ? 2 : 1.6;
    if (raised > 0.5) g.add(cyl(tWid * 0.55, tWid * 0.6, raised, supM, 14, 0, F + raised / 2, z * L));
    const house = new THREE.Mesh(new THREE.CylinderGeometry(tWid * 0.5, tWid * 0.56, tH, 6), supM); house.scale.z = tLen / tWid; house.position.y = tH / 2 + 0.1; t.add(house);
    const bl = isCr ? 8.5 : 5, br = isCr ? 0.2 : 0.14;
    for (let k = 0; k < tw; k++) { const b = tube(br, bl, dk); b.position.set((k - (tw - 1) / 2) * tWid * 0.3, tH * 0.55, tLen * 0.35); t.add(b); }
    g.add(t); turrets.push(t);
  }
  // Antiaéreos y botes salvavidas
  for (const s of [-1, 1]) {
    for (const z of [0.0, -0.18]) { const a = cyl(0.6, 0.7, 0.6, supM, 8, s * B * 0.32, F + 0.3, z * L); g.add(a); }
    const bt = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(0xe8e6de)); bt.scale.set(0.7, 0.45, 2.6); bt.position.set(s * B * 0.42, F + 1.2, -L * 0.1); g.add(bt);
  }
  g.add(box(0.05, 0.05, 0.05, dk));
  g.userData = { turrets, hw: B / 2 + 0.6, hl: L / 2, top: F + (isCr ? 7 : 5) };
  return g;
}

// ---------- AVIONES ----------
function wingGeo(span, c0, c1, sweep = 0, th = 0.28) {
  const s = new THREE.Shape(), h = span / 2;
  s.moveTo(-h, -c1 * 0.4 + sweep); s.lineTo(0, -c0 * 0.45); s.lineTo(h, -c1 * 0.4 + sweep);
  s.quadraticCurveTo(h + c1 * 0.25, sweep + c1 * 0.1, h, c1 * 0.6 + sweep); s.lineTo(0, c0 * 0.55); s.lineTo(-h, c1 * 0.6 + sweep);
  s.quadraticCurveTo(-h - c1 * 0.25, sweep + c1 * 0.1, -h, -c1 * 0.4 + sweep);
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelSize: th * 0.4, bevelThickness: th * 0.4, bevelSegments: 1, curveSegments: 4 });
  g.rotateX(Math.PI / 2); g.translate(0, th / 2, 0); return g; // plano XZ, cuerda en -z..+z (shape y→ -z tras rotar... ajustado abajo)
}
function buildPlane(m) {
  const S = 1.6, L = m.len * S, SP = m.span * S, g = new THREE.Group();
  const body = mat(m.color, { r: m.metal ? 0.32 : 0.6, m: m.metal ? 0.75 : 0.2 }), dk = mat(DARK);
  const rN = m.radial ? 0.62 * S : 0.42 * S, rMax = 0.6 * S;
  const prof = [[0.01, -L / 2], [0.16 * S, -L / 2 + 0.2], [0.3 * S, -L * 0.3], [rMax * 0.85, -L * 0.05], [rMax, L * 0.12], [rMax, L * 0.25], [rN, L * 0.4], [rN * 0.95, L / 2 - 0.1], [0.01, L / 2]];
  const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14); lg.rotateX(Math.PI / 2); // eje y → z
  const fus = new THREE.Mesh(lg, body); fus.scale.set(0.9, 1, 1); g.add(fus);
  // alas
  const c0 = 2.2 * S, c1 = 1.1 * S;
  const wg = wingGeo(SP, c0, c1, 0, 0.25 * S); const w = new THREE.Mesh(wg, body); w.position.set(0, -0.35 * S, L * 0.08); g.add(w);
  const tp = new THREE.Mesh(wingGeo(SP * 0.36, 1.2 * S, 0.7 * S, 0, 0.14 * S), body); tp.position.set(0, 0.05, -L / 2 + 0.9 * S); g.add(tp);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(1.6 * S, 0); fs.lineTo(1.0 * S, 1.6 * S); fs.lineTo(0.2 * S, 1.6 * S); fs.lineTo(-0.2 * S, 0.6 * S);
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.12 * S, bevelEnabled: false }); fg.rotateY(Math.PI / 2);
  const fin = new THREE.Mesh(fg, body); fin.position.set(-0.06 * S, 0.25 * S, -L / 2 + 1.7 * S); g.add(fin);
  // cabina
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.5 * S, 12, 8), mat(0x22313d, GLASS)); can.scale.set(0.8, 0.85, 2.2); can.position.set(0, rMax * 0.75, L * 0.02); g.add(can);
  // morro / capó / hélice
  if (m.radial) { const cw = cyl(rN * 1.05, rN, 0.9 * S, mat(m.cowl ?? m.nose ?? m.color, { r: 0.5 }), 16); cw.rotation.x = Math.PI / 2; cw.position.z = L / 2 - 0.4 * S; g.add(cw); }
  else if (m.nose) { const nc = cyl(rN * 0.9, rN, 1.4 * S, mat(m.nose), 14); nc.rotation.x = Math.PI / 2; nc.position.z = L / 2 - 0.6 * S; g.add(nc); }
  const sp = new THREE.Mesh(new THREE.ConeGeometry(0.28 * S, 0.7 * S, 10), mat(m.nose ?? 0x2a2a2a)); sp.rotation.x = Math.PI / 2; sp.position.z = L / 2 + 0.3 * S; g.add(sp);
  const prop = new THREE.Group(); prop.position.z = L / 2 + 0.15 * S;
  for (let k = 0; k < 3; k++) { const b = box(0.18 * S, 1.6 * S, 0.06, dk, 0, 0.8 * S, 0); const pv = new THREE.Group(); pv.add(b); pv.rotation.z = k * Math.PI * 2 / 3; prop.add(pv); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.7 * S, 20), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); prop.add(disc);
  g.add(prop);
  if (m.fixedGear) for (const s of [-1, 1]) { const lg2 = box(0.35 * S, 1.3 * S, 0.9 * S, body, s * 1.5 * S, -1.1 * S, L * 0.18); g.add(lg2); }
  if (m.sharkMouth) { const sm = box(0.9 * S, 0.06, 0.8 * S, mat(0xb3221f), 0, -0.45 * S, L * 0.36); g.add(sm); }
  if (m.fac === 'it') g.add(box(1.3 * S, 1.3 * S, 0.4 * S, mat(0xf0f0ec), 0, 0, -L * 0.25));
  // franjas de invasión
  if (m.stripes) for (let k = 0; k < 5; k++) for (const s of [-1, 1]) g.add(box(SP * 0.12, 0.05, 0.28 * S, mat(k % 2 ? 0x161616 : 0xf0f0ee), s * SP * 0.22, -0.18 * S, L * 0.08 - 0.9 * S + k * 0.3 * S));
  // insignias en alas
  const mk = m.fac === 'us' && m.stripes ? 'wing44' : 'wing';
  for (const s of [-1, 1]) { const ins = insignia(m.fac, 0.75 * S, mk); ins.rotation.x = -Math.PI / 2; ins.position.set(s * SP * 0.36, -0.05 * S, L * 0.08); g.add(ins); }
  g.userData = { prop, r: CLS[m.cls].r };
  return g;
}

// ---------- TANQUES ----------
function buildTank(m) {
  const k = 1.55 * (m.scale || 1), L = m.L * k, W = m.W * k, H = m.H * k, g = new THREE.Group();
  const hullM = mat(m.color, { r: 0.85, m: 0.1 }), dk = mat(0x2b2925, { r: 0.95 }), wheelM = mat(new THREE.Color(m.color).multiplyScalar(0.7).getHex(), { r: 0.9 });
  const tw = W * 0.2, th = H * 0.42;
  for (const s of [-1, 1]) {
    g.add(box(tw, th, L, dk, s * (W / 2 - tw / 2), th / 2 + 0.05, 0));
    const n = m.wheels, wr = m.wr * k * (m.christie ? 1.1 : 1);
    for (let i = 0; i < n; i++) { const z = -L * 0.38 + i * (L * 0.76 / (n - 1)); const wh = cyl(wr, wr, tw * 0.95, wheelM, 12, s * (W / 2 - tw / 2) + s * 0.05, wr + 0.08, z); wh.rotation.z = Math.PI / 2; g.add(wh); if (m.overlap && i < n - 1) { const w2 = wh.clone(); w2.position.z += L * 0.38 / (n - 1); w2.position.x -= s * 0.12; g.add(w2); } }
    const spr = cyl(th * 0.38, th * 0.38, tw, wheelM, 10, s * (W / 2 - tw / 2), th * 0.6, L / 2 - th * 0.35); spr.rotation.z = Math.PI / 2; g.add(spr);
    if (m.skirts) g.add(box(0.08, th * 0.8, L * 0.8, hullM, s * (W / 2 + 0.12), th * 0.75, -L * 0.03));
  }
  // casco superior por perfil lateral
  const y0 = th * 0.75, y1 = H * 0.68, gl = (y1 - y0) * (0.7 + m.glacis * 1.6) + 0.2;
  const sh = new THREE.Shape(); sh.moveTo(-L / 2, y0); sh.lineTo(-L / 2, y1 - 0.15); sh.lineTo(-L / 2 + 0.3, y1); sh.lineTo(L / 2 - gl, y1); sh.lineTo(L / 2, y0 + (y1 - y0) * 0.22); sh.lineTo(L / 2 - 0.25, y0);
  const hg = new THREE.ExtrudeGeometry(sh, { depth: W * 0.98, bevelEnabled: false }); hg.rotateY(-Math.PI / 2); hg.translate(W * 0.49, 0, 0);
  g.add(new THREE.Mesh(hg, hullM));
  g.add(box(W * 0.5, 0.3, 0.5, dk, 0, y1 + 0.1, -L / 2 + 0.6)); // rejilla motor
  // torreta
  const tur = new THREE.Group(); tur.position.set(0, y1, m.tur === 'casemate' ? L * 0.05 : (m.tur === 'small' ? -L * 0.02 : L * 0.02)); g.add(tur);
  let tr = W * 0.36, th2 = H * 0.3, gunY = th2 * 0.5, gunZ = tr * 1.05;
  if (m.tur === 'cast') { const t = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.82, tr, th2, 18), hullM); t.scale.z = 1.25; t.position.set(0, th2 / 2, -tr * 0.1); tur.add(t); tur.add(box(tr * 0.9, th2 * 0.7, 0.4, hullM, 0, gunY, tr * 1.1)); gunZ = tr * 1.2; }
  else if (m.tur === 'small') { tr = W * 0.24; th2 = H * 0.2; const t = cyl(tr * 0.8, tr, th2, hullM, 16, 0, th2 / 2 + 0.3, 0); tur.add(t); gunY = th2 * 0.5 + 0.3; gunZ = tr; tur.add(cyl(tr * 0.5, tr * 0.6, 0.5, hullM, 12, 0, th2 + 0.5, -0.1));
    const sp = cyl(0.55 * k, 0.65 * k, 0.9 * k, hullM, 12, W * 0.32, y1 - 0.6, L * 0.3); g.add(sp); const sg = tube(0.08 * k, 2.4 * k, dk); sg.position.set(W * 0.32, y1 - 0.6, L * 0.33); g.add(sg); }
  else if (m.tur === 'open') { const t = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.85, tr * 1.05, th2, 5, 1, true), mat(m.color, { side: THREE.DoubleSide })); t.rotation.y = Math.PI / 5; t.position.y = th2 / 2; tur.add(t); }
  else if (m.tur === 'casemate') { const cs = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.36, W * 0.44, th2 * 0.9, 4), hullM); cs.rotation.y = Math.PI / 4; cs.scale.set(1, 1, 1.4); cs.position.y = th2 * 0.45; tur.add(cs); gunY = th2 * 0.35; gunZ = W * 0.55; }
  else {
    const sides = m.tur === 'angular' ? 6 : 4; const top = m.tur === 'panther' ? 0.72 : m.tur === 'tiger' ? 0.95 : 0.82;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(tr * top, tr, th2, sides), hullM); t.rotation.y = Math.PI / sides; t.scale.set(1, 1, m.tur === 'tiger' ? 1.15 : m.tur === 'panther' ? 1.35 : 1.2); t.position.y = th2 / 2; tur.add(t);
    if (m.tur === 'tiger' || m.tur === 'panther') { tur.add(box(tr * 0.8, th2 * 0.8, 0.5, hullM, 0, gunY, tr * 1.15)); gunZ = tr * 1.3; }
  }
  if (m.tur !== 'casemate' && m.tur !== 'open') tur.add(cyl(0.32 * k, 0.36 * k, 0.4 * k, hullM, 10, -tr * 0.35, th2 + 0.15, -tr * 0.25));
  const gun = tube(m.gr * k * 1.15, m.gun * k, dk, 8); gun.position.set(0, gunY, gunZ); tur.add(gun);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, gunY, gunZ + m.gun * k); tur.add(muzzle);
  if (m.brake) { const b = cyl(m.gr * k * 2.1, m.gr * k * 2.1, 0.45 * k, dk, 8, 0, gunY, gunZ + m.gun * k - 0.2); b.rotation.x = Math.PI / 2; tur.add(b); }
  // antena, cajas, bidones
  tur.add(cyl(0.02, 0.02, 2.4 * k, dk, 4, tr * 0.5, th2 + 1.1 * k, -tr * 0.5));
  g.add(box(W * 0.25, 0.4, 0.7, mat(0x4d4a3a), W * 0.3, y1 + 0.2, -L * 0.36));
  // insignias
  const ins = m.fac === 'us' ? 'star' : m.fac === 'de' ? 'cross' : null;
  if (ins) for (const s of [-1, 1]) { const mk = ins === 'star' ? new THREE.Mesh(new THREE.ShapeGeometry(starShape(0.55 * k)), flatMat(0xeeeeea)) : insignia('de', 0.45 * k, 'tank'); mk.rotation.y = s * Math.PI / 2; mk.position.set(s * (W / 2 + 0.02), (y0 + y1) / 2, -L * 0.05); g.add(mk); }
  if (m.fac === 'us') { const st = new THREE.Mesh(new THREE.ShapeGeometry(starShape(0.8 * k)), flatMat(0xeeeeea)); st.rotation.x = -Math.PI / 2; st.position.set(0, y1 + 0.02, -L * 0.28); g.add(st); }
  g.userData = { turret: tur, muzzle, hw: W / 2, hl: L / 2, top: H + 0.3 };
  return g;
}

// ---------- INSTALACIONES Y ANTIAÉREOS ----------
export function buildSite(idx, fac, theme) {
  const g = new THREE.Group(), con = mat(theme === 'desert' ? 0xb79a72 : 0x8e8b80, { r: 0.95 });
  const wall = mat(fac === 'de' || fac === 'it' ? 0x6f7563 : fac === 'jp' ? 0x7d775f : 0x6b6e5a, { r: 0.85 });
  const pad = cyl(42, 44, 0.6, con, 24, 0, 0.3, 0); g.add(pad);
  if (idx === 0) { // hangar
    const hg = new THREE.CylinderGeometry(11, 11, 26, 16, 1, false, 0, Math.PI); hg.rotateZ(Math.PI / 2); hg.rotateY(Math.PI / 2);
    const h = new THREE.Mesh(hg, wall); h.position.y = 0.5; h.rotation.y = Math.PI / 2; g.add(h);
    g.add(box(22, 9, 0.3, mat(0x3a3a36), 0, 4.8, 13));
    g.add(box(10, 0.2, 70, con, 26, 0.35, 0)); // pista
  } else if (idx === 1) { // depósito de combustible
    for (let i = 0; i < 4; i++) g.add(cyl(5, 5, 7, mat(0x8d8f84, { m: 0.4, r: 0.5 }), 18, (i % 2 ? 1 : -1) * 9, 4, (i < 2 ? 1 : -1) * 9));
    for (let i = 0; i < 20; i++) g.add(cyl(0.6, 0.6, 1.4, mat(0x5d5f4a), 8, 22 + (i % 5) * 1.4, 1.2, -10 + ((i / 5) | 0) * 1.4));
  } else { // radar / radio
    g.add(box(10, 5, 8, wall, -10, 3, 0));
    const tw = new THREE.Group(); tw.position.set(8, 0, 0);
    tw.add(cyl(0.6, 1.4, 24, mat(0x4a4a46, { m: 0.5 }), 6, 0, 12, 0));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xb0b0a8, { side: THREE.DoubleSide, m: 0.5 })); dish.rotation.x = -Math.PI / 2.4; dish.position.y = 24; tw.add(dish);
    g.add(tw); g.userData.spin = tw;
  }
  // sacos terreros
  for (let a = 0; a < 18; a++) { const ang = a / 18 * Math.PI * 2; if (a % 6 === 0) continue; const s = box(6, 1.6, 2, mat(0x9b8a68, { r: 1 }), Math.cos(ang) * 38, 1.1, Math.sin(ang) * 38); s.rotation.y = -ang + Math.PI / 2; g.add(s); }
  g.userData.hw = 30; g.userData.hl = 30; g.userData.top = 14;
  return g;
}
export function buildAA(fac) {
  const g = new THREE.Group(), m = mat(fac === 'de' || fac === 'it' ? 0x6b6f62 : 0x4b5320), dk = mat(DARK);
  g.add(box(6, 0.5, 1, m, 0, 0.6, 0), box(1, 0.5, 6, m, 0, 0.6, 0));
  const t = new THREE.Group(); t.position.y = 1.4; t.add(box(1.8, 1.2, 1.8, m)); const s = box(2.6, 1.6, 0.15, m, 0, 0.8, 1); t.add(s);
  const b = tube(0.16, fac === 'de' ? 6.5 : 4.5, dk); b.position.y = 0.8; b.rotation.x = -0.6; t.add(b); g.add(t);
  for (let a = 0; a < 10; a++) { const ang = a / 10 * Math.PI * 2; const sb = box(2.4, 1.2, 1.2, mat(0x9b8a68, { r: 1 }), Math.cos(ang) * 5, 0.6, Math.sin(ang) * 5); sb.rotation.y = -ang + Math.PI / 2; g.add(sb); }
  g.userData = { turrets: [t], hw: 4, hl: 4, top: 4 };
  return g;
}

// ---------- INFANTERÍA Y ANTITANQUE ----------
function soldier(uni, helm, k, kneel = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26 * k, (kneel ? 0.45 : 0.85) * k, 3, 8), uni); body.position.y = (kneel ? 0.6 : 0.85) * k; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2 * k, 8, 6), helm); head.scale.y = 0.8; head.position.y = (kneel ? 1.25 : 1.68) * k; g.add(head);
  const rifle = box(0.06 * k, 0.06 * k, 1.0 * k, mat(0x3a2e22), 0.22 * k, (kneel ? 0.85 : 1.15) * k, 0.25 * k); rifle.rotation.x = -0.4; g.add(rifle);
  return g;
}
function buildInfantry(m) {
  const k = 1.7, g = new THREE.Group(), uni = mat(m.color, { r: 0.95, m: 0 }), helm = mat(m.helmet, { r: 0.7 });
  const pos = [[0, 2.2], [-1.6, 0.6], [1.6, 0.6], [-2.4, -1.4], [0, -1.2], [2.4, -1.4]];
  const soldiers = pos.map(([x, z], i) => { const s = soldier(uni, helm, k); s.position.set(x, 0, z); s.rotation.y = (i - 2.5) * 0.08; g.add(s); return s; });
  const tube = box(0.12 * k, 0.12 * k, 1.4 * k, mat(0x30332a), 0.3 * k, 1.5 * k, 0); soldiers[0].add(tube); // bazuca
  g.userData = { soldiers, hw: 3.6, hl: 3.6, top: 3.2 };
  return g;
}
function buildATGun(m) {
  const k = 1.55, g = new THREE.Group(), gm = mat(m.color, { r: 0.85 }), dk = mat(DARK);
  for (const s of [-1, 1]) { const tr = box(0.18 * k, 0.18 * k, 3.2 * k, gm, s * 0.6 * k, 0.25 * k, -1.5 * k); tr.rotation.y = s * 0.28; g.add(tr); const w = cyl(0.45 * k, 0.45 * k, 0.22 * k, mat(0x2a2a26), 12, s * 0.85 * k, 0.45 * k, 0); w.rotation.z = Math.PI / 2; g.add(w); }
  const tur = new THREE.Group(); tur.position.y = 0.7 * k; g.add(tur);
  tur.add(box(1.9 * k, 1.1 * k, 0.08 * k, gm, 0, 0.35 * k, 0.35 * k));
  tur.add(box(0.5 * k, 0.4 * k, 1.2 * k, gm, 0, 0.1 * k, 0));
  const barrel = tube(0.07 * k, m.gun * k, dk); barrel.position.set(0, 0.15 * k, 0.4 * k); tur.add(barrel);
  if (m.brake) { const b = cyl(0.14 * k, 0.14 * k, 0.3 * k, dk, 8, 0, 0.15 * k, (0.4 + m.gun - 0.15) * k); b.rotation.x = Math.PI / 2; tur.add(b); }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.15 * k, (0.4 + m.gun) * k); tur.add(muzzle);
  const uni = mat(m.fac === 'de' ? 0x5d6253 : m.fac === 'uk' ? 0x8a7a55 : 0x5b5a3a, { r: 0.95, m: 0 }), helm = mat(0x4b4f40);
  [[-1.1, -1.4], [1.1, -1.6], [0.2, -2.6]].forEach(([x, z]) => { const s = soldier(uni, helm, 1.6, true); s.position.set(x, 0, z); g.add(s); });
  g.userData = { turret: tur, muzzle, hw: 1.8, hl: 2.6, top: 2.2 };
  return g;
}

function buildMerchant(m) {
  const c = CLS.merchant, L = c.len, B = c.beam, F = c.fb, g = new THREE.Group();
  const hullM = mat(m.hull, { r: 0.7 }), supM = mat(m.sup, { r: 0.6 }), deckM = mat(m.deck, { r: 0.9, m: 0 }), dk = mat(DARK);
  const hg = extrudeUp(hullShape(L, B, 0.22), F + 3); hg.translate(0, -3, 0); g.add(new THREE.Mesh(hg, hullM));
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(hullShape(L * 0.98, B * 0.95, 0.22)), deckM); deck.rotation.x = -Math.PI / 2; deck.position.y = F + 0.02; g.add(deck);
  g.add(box(B * 0.8, 4, L * 0.14, supM, 0, F + 2, -L * 0.22), box(B * 0.6, 2, L * 0.08, supM, 0, F + 5, -L * 0.22));
  const fn = cyl(1.1, 1.2, 5, mat(0x1a1a1a), 12, 0, F + 6, -L * 0.3); g.add(fn); g.add(cyl(1.15, 1.15, 1, mat(0xa52a24), 12, 0, F + 7.5, -L * 0.3));
  for (const z of [0.3, 0.12, -0.05]) g.add(box(B * 0.55, 1.2, L * 0.1, mat(0x5a4a38), 0, F + 0.6, z * L));
  for (const z of [0.2, -0.38]) { g.add(cyl(0.2, 0.25, 12, dk, 6, 0, F + 6, z * L)); const d = box(0.15, 0.15, 9, dk, 0, F + 3, z * L + 4); d.rotation.x = 0.5; g.add(d); }
  g.userData = { turrets: [], hw: B / 2 + 0.6, hl: L / 2, top: F + 7 };
  return g;
}
export function buildBattery(fac) {
  const g = new THREE.Group(), con = mat(0x8f8c82, { r: 0.95, m: 0 }), dk = mat(DARK);
  g.add(box(16, 6, 12, con, 0, 2.6, -1));
  const roof = box(18, 1.4, 14, con, 0, 6.2, -0.5); g.add(roof);
  g.add(box(9, 2, 0.6, mat(0x1a1a18), 0, 3.6, 5.1)); // tronera
  const t = new THREE.Group(); t.position.set(0, 3.6, 3.5); t.userData.base = 0;
  const b = tube(0.35, 9, dk); b.position.set(0, 0, 0.5); t.add(b); g.add(t);
  for (const s of [-1, 1]) { const w = box(3, 4, 10, con, s * 9.5, 1.6, -1); w.rotation.y = s * 0.25; g.add(w); }
  g.userData = { turrets: [t], hw: 9, hl: 7, top: 7 };
  return g;
}
export function buildModel(key) {
  const m = MODELS[key], dom = CLS[m.cls].dom;
  const g = m.cls === 'merchant' ? buildMerchant(m) : dom === 'sea' ? buildShip(m) : dom === 'air' ? buildPlane(m) : m.cls === 'inf' ? buildInfantry(m) : m.cls === 'atgun' ? buildATGun(m) : buildTank(m);
  g.traverse(o => { if (o.isMesh && !(o.material instanceof THREE.MeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

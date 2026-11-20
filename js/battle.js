import * as THREE from 'three';
import { diff } from './difficulty.js';
import { initMarks } from './marks.js';
import { initDamageFx } from './damagefx.js';
import { applyVeterans } from './campaign.js';
import { G } from './state.js';
import { coverNear } from './physics.js';
import { BATTLES, MODELS, CLS } from './data.js';
import { buildWorld } from './world.js';
import { applyEnv } from './env.js';
import { spawnUnit, spawnSite, spawnAA, spawnBattery, clearProjs, clearAnchors } from './units.js';
import { resetFx } from './fx.js';
import { updateVision, updateStrategy, resetStrategy } from './strategy.js';
import { formationOffset } from './units.js';
import { V3, clamp, canvasTex } from './util.js';

let markers = null, icons = new Map(), iconTex = {}, lines = null, selRings = new Map(), cmdT = { A: 0, E: 0 }, deadT = 0, lastMain = -1;
// mando aliado por IA: activo salvo que el jugador elija dar todas las órdenes; una orden manual manda sobre la IA durante este tiempo
export const MANUAL_S = 45;
const aiAllies = () => G.opts?.aiCmd !== false;

function findNear(x, z, test, r0 = 0) {
  if (test(x, z)) return [x, z];
  for (let r = 20 + r0; r < 900; r += 20) for (let a = 0; a < 6.28; a += 0.35) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (test(px, pz)) return [px, pz]; }
  return [x, z];
}
function clearBattle() {
  clearProjs();
  if (G.unitsGroup) { G.scene.remove(G.unitsGroup); }
  G.unitsGroup = new THREE.Group(); G.scene.add(G.unitsGroup);
  if (markers) { G.scene.remove(markers); }
  markers = new THREE.Group(); G.scene.add(markers); G.markersGroup = markers;
  icons = new Map(); selRings = new Map();
  G.ents = []; G.smokes = []; G.bases = null; G.objectives = []; G.sitesA = []; G.sitesE = []; G.player = null; G.selection = new Set();
  resetFx();
}

// ---------- texturas de iconos (vista estratégica) ----------
function icon(side, kind, me = false) {
  const k = side + kind + me; if (iconTex[k]) return iconTex[k];
  iconTex[k] = canvasTex(64, (g, s) => {
    const c = side === 'A' ? '#3d7fd6' : '#d6453d', f = side === 'A' ? 'rgba(20,40,80,0.85)' : 'rgba(80,20,20,0.85)';
    g.lineWidth = me ? 5 : 3; g.strokeStyle = me ? '#ffffff' : c; g.fillStyle = f;
    if (side === 'A') { g.beginPath(); g.roundRect(8, 16, 48, 32, 4); g.fill(); g.stroke(); }
    else { g.beginPath(); g.moveTo(32, 6); g.lineTo(58, 32); g.lineTo(32, 58); g.lineTo(6, 32); g.closePath(); g.fill(); g.stroke(); }
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 3;
    if (kind === 'land') { g.beginPath(); g.ellipse(32, 32, 14, 8, 0, 0, 7); g.stroke(); }
    else if (kind === 'sea') { g.beginPath(); g.moveTo(16, 30); g.lineTo(48, 30); g.lineTo(42, 38); g.lineTo(22, 38); g.closePath(); g.fill(); }
    else if (kind === 'sub') { g.beginPath(); g.ellipse(32, 34, 15, 4, 0, 0, 7); g.fill(); g.fillRect(29, 25, 6, 6); }
    else if (kind === 'air') { g.beginPath(); g.moveTo(32, 20); g.lineTo(34, 30); g.lineTo(46, 34); g.lineTo(34, 36); g.lineTo(33, 44); g.lineTo(31, 44); g.lineTo(30, 36); g.lineTo(18, 34); g.lineTo(30, 30); g.closePath(); g.fill(); }
    else if (kind === 'site') { g.fillRect(22, 24, 20, 16); }
    else { g.beginPath(); g.arc(32, 32, 6, 0, 7); g.fill(); }
  });
  return iconTex[k];
}
function labelTex(txt, color) {
  return canvasTex(64, (g, s) => { g.fillStyle = 'rgba(15,18,14,0.75)'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = color; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 32px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 34); });
}

// ---------- preparar batalla ----------
export function startBattle(key, demo = false, opts = {}) {
  clearBattle();
  const b = BATTLES[key]; G.battle = b; G.battleKey = key; G.demo = demo;
  G.roster = opts.roster || b.allies; G.fog = !demo && b.kind !== 'test' && opts.fog !== false;
  const map = buildWorld(b.map);
  initDamageFx(); initMarks();
  applyEnv(demo || b.kind === 'test' ? {} : opts.env || b.env || {});
  const naval = b.kind === 'naval', air = b.kind === 'air', mixed = b.kind === 'combined';
  clearAnchors();
  const wantSea = (x, z) => map.h(x, z) < -12 && map.h(x + 40, z) < -8 && map.h(x - 40, z) < -8 && map.h(x, z + 60) < -8 && map.h(x, z - 60) < -8;
  const wantLand = (x, z) => map.h(x, z) > 1.5;
  // objetivos
  if (!air && b.kind !== 'test') {
    map.zones.forEach((zn, k) => {
      const zdom = mixed ? (map.h(zn.x, zn.z) > 0 ? 'land' : 'sea') : naval ? 'sea' : 'land';
      const [x, z] = findNear(zn.x, zn.z, zdom === 'sea' ? wantSea : wantLand);
      const pos = V3(x, zdom === 'sea' ? 0 : map.gy(x, z), z), R = map.cfg.zoneR;
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 4, R, 64), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, pos.y + 1, z); ring.renderOrder = 9; markers.add(ring);
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('ABC'[k], '#bbbbbb'), sizeAttenuation: false, depthTest: false, transparent: true })); lab.scale.set(0.05, 0.05, 1); lab.position.set(x, pos.y + 30, z); lab.renderOrder = 10; markers.add(lab);
      G.objectives.push({ k, pos, owner: null, prog: 0, ring, lab, name: 'ABC'[k], dom: zdom });
    });
  } else if (air) {
    const [fa, fe] = b.sites;
    const mk = (arr, side, fac, list) => arr.forEach(([sx, sz], i) => {
      const [x, z] = findNear(sx, sz, (x, z) => map.h(x, z) > 3 && map.h(x + 45, z + 45) > 1 && map.h(x - 45, z - 45) > 1 && map.h(x + 45, z - 45) > 1 && map.h(x - 45, z + 45) > 1);
      const s = spawnSite(i, side, fac, x, z); s.label = 'ABC'[i]; list.push(s);
      for (const a of [0.8, 3.9]) { const ax = x + Math.cos(a + i) * 60, az = z + Math.sin(a + i) * 60; if (map.h(ax, az) > 0.8) spawnAA(side, fac, ax, az); }
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('ABC'[i], side === 'A' ? '#5b9cf0' : '#ef5a50'), sizeAttenuation: false, depthTest: false, transparent: true })); lab.scale.set(0.045, 0.045, 1); lab.position.set(x, map.gy(x, z) + 45, z); lab.renderOrder = 10; markers.add(lab); s.lab = lab;
    });
    mk(map.sitesA, 'A', fa, G.sitesA); mk(map.sitesE, 'E', fe, G.sitesE);
  }
  // unidades
  const sp = map.cfg.spawn;
  const SP = map.extra && map.extra.spawns;
  const place = (list, side) => {
    const flat = []; list.forEach(([k, n]) => { for (let i = 0; i < n; i++) flat.push(k); });
    const byDom = {}; flat.forEach(k => { const d = CLS[MODELS[k].cls].dom; (byDom[d] = byDom[d] || []).push(k); });
    const sgn = side === 'A' ? 1 : -1, out = [];
    for (const dom in byDom) {
      const ks = byDom[dom], n = ks.length, gap = dom === 'sea' ? 115 : dom === 'air' ? 55 : 42;
      ks.forEach((k, i) => {
        const row = dom === 'air' ? (i % 2) : 0, col = dom === 'air' ? Math.floor(i / 2) - (Math.ceil(n / 2) - 1) / 2 : i - (n - 1) / 2;
        let x, z, h = side === 'A' ? Math.PI : 0;
        const s = SP && SP[side][dom];
        if (s) {
          if (typeof s === 'function') [x, z] = s(col * gap * 1.6); else { x = s[0] + col * gap * (dom === 'air' ? 1.6 : 1); z = s[1] + row * 60 * sgn; }
          h = Math.atan2(-x, (map.extra.coast ? map.extra.coast(0) : 0) - z);
          if (dom === 'land' && side === 'A') h = Math.PI;
          if (SP[side].h !== undefined) h = SP[side].h;
        } else { x = col * gap * (dom === 'air' ? 1.6 : 1); z = sgn * (sp + row * 60 + (dom === 'land' ? (i % 2) * 30 : 0)); }
        if (dom === 'sea') [x, z] = findNear(x, z, wantSea);
        if (dom === 'land') [x, z] = findNear(x, z, wantLand);
        out.push(spawnUnit(k, side, x, z, h));
      });
    }
    return out;
  };
  const allies = place(G.roster, 'A'), enemies = place(b.enemy, 'E');
  if (!demo) applyVeterans();
  G.startCount = { A: allies.length, E: enemies.length };
  // cañones antitanque enemigos: ya emplazados junto a los objetivos de tierra
  // (los objetivos de tierra más cercanos al despliegue enemigo, y un poco hacia su lado)
  const eLand = enemies.filter(e => e.dom === 'land'), ec = V3(); eLand.forEach(e => ec.add(e.p)); if (eLand.length) ec.divideScalar(eLand.length);
  const landZones = G.objectives.filter(z => z.dom === 'land').sort((a, c) => a.pos.distanceTo(ec) - c.pos.distanceTo(ec)).slice(0, 2);
  enemies.filter(e => e.cls === 'atgun').forEach((e, i) => {
    if (!landZones.length) return;
    const z = landZones[i % landZones.length], d = V3(ec.x - z.pos.x, 0, ec.z - z.pos.z).normalize();
    const [x, zz] = findNear(z.pos.x + d.x * 70 + (i % 2 ? 50 : -50) * d.z, z.pos.z + d.z * 70 - (i % 2 ? 50 : -50) * d.x, wantLand);
    e.p.set(x, map.gy(x, zz), zz); e.h = 0; e.mesh.rotation.y = 0; e.order = { type: 'hold', x, z: zz };
  });
  // bases de reabastecimiento: donde despliega cada bando por tipo de unidad
  G.bases = { A: {}, E: {} };
  if (b.kind !== 'test') for (const side of ['A', 'E']) for (const dom of ['sea', 'land', 'air']) {
    const us = (side === 'A' ? allies : enemies).filter(e => e.dom === dom && e.cls !== 'atgun'); if (!us.length) continue;
    const c = V3(); us.forEach(e => c.add(e.p)); c.divideScalar(us.length); c.y = 0;
    G.bases[side][dom] = c;
    if (side === 'A' && !demo) {
      const R = { sea: 300, land: 180, air: 340 }[dom], y = dom === 'land' ? map.gy(c.x, c.z) + 1 : dom === 'sea' ? 0.8 : Math.max(map.gy(c.x, c.z), 0) + 1;
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 3, R, 64), new THREE.MeshBasicMaterial({ color: 0x7fd66b, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, y, c.z); ring.renderOrder = 9; markers.add(ring);
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('R', '#7fd66b'), sizeAttenuation: false, depthTest: false, transparent: true })); lab.scale.set(0.035, 0.035, 1); lab.position.set(c.x, y + 20, c.z); lab.renderOrder = 10; markers.add(lab);
    }
  }
  // defensas fijas (baterías costeras y antiaéreos)
  // convoy aliado y antiaéreos propios (Tobruk)
  if (b.convoy && map.extra && map.extra.convoy) {
    const [cx, cz] = map.extra.convoy, port = G.objectives.find(z => z.dom === 'sea');
    b.convoy.forEach(([k, n]) => { for (let i = 0; i < n; i++) { const [x, z] = findNear(cx + i * 140, cz, wantSea); const e = spawnUnit(k, 'A', x, z, -Math.PI / 2); e.convoy = true; if (port) e.order = { type: 'move', x: port.pos.x + i * 50, z: port.pos.z - 40 }; } });
  }
  if (map.extra && map.extra.staticsA) (map.extra.staticsA.aa || []).forEach(([x0, z0]) => { const [x, z] = findNear(x0, z0, wantLand); spawnAA('A', 'uk', x, z); });
  if (b.statics && map.extra && map.extra.statics) {
    const st = map.extra.statics;
    (st.battery || []).forEach(([x0, z0]) => { const [x, z] = findNear(x0, z0, wantLand); spawnBattery('E', b.staticFac || 'de', x, z, 0); });
    (st.aa || []).forEach(([x0, z0]) => { const [x, z] = findNear(x0, z0, wantLand); spawnAA('E', b.staticFac || 'de', x, z); });
  }
  // jugador
  const pref = naval ? 'destroyer' : air ? 'fighter' : 'tank';
  G.player = demo ? null : (allies.find(e => e.cls === pref) || allies[0]);
  let slot = 0; allies.forEach(e => { if (e !== G.player) { e.slot = slot++; e.order = { type: 'follow' }; G.selection.add(e); } });
  if (demo) { allies.forEach(e => e.order = { type: 'attack' }); G.selection.clear(); }
  G.tickets = { A: air ? 450 : mixed ? 800 : 600, E: air ? 450 : mixed ? 800 : 600 }; G.ticketsMax = G.tickets.A;
  if (!demo) { G.tickets.A = Math.round(G.tickets.A * diff().tickets); G.ticketsMax = Math.max(G.tickets.A, G.tickets.E); }
  G.time = 0; G.over = false; G.stats = { kills: 0, lost: 0, shots: 0, hits: 0, gShots: 0, gHits: 0, pk: [], pDeaths: 0, taken: 0, dealt: 0, rams: 0, ammo: 0, crits: 0, tl: [], tlT: 0 }; cmdT = { A: demo ? 0 : 3, E: 0 }; deadT = 0; lastMain = -1; DOC.A = { phase: 'approach', since: 0, cyc: 0 }; DOC.E = { phase: 'approach', since: 0, cyc: 0 };
  // líneas de órdenes
  lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55, depthTest: false }));
  lines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(240), 3)); lines.renderOrder = 11; lines.frustumCulled = false; markers.add(lines);
  resetStrategy();
  G.focus.copy(G.player ? G.player.p : V3(0, 0, sp));
  return { allies, enemies };
}

// ---------- quitar entidades (campo de pruebas) ----------
export function removeEntity(e) {
  G.unitsGroup.remove(e.mesh);
  G.ents = G.ents.filter(x => x !== e);
  G.selection.delete(e);
  const sp = icons.get(e); if (sp) { markers.remove(sp); icons.delete(e); }
  const r = selRings.get(e); if (r) { markers.remove(r); selRings.delete(e); }
}

// ---------- órdenes ----------
const ORDER_TXT = { form: 'Formación', overwatch: 'Vigilancia', bound: 'Cubre el avance', cover: 'Cobertura alta', follow: 'Seguirme', zone: 'Objetivo', attack: 'Ataque libre', hold: 'Mantener', defend: 'Defender', move: 'Mover', escort: 'Escolta', route: 'Ruta', strike: 'Ataque a tierra' };
export function orderLabel(o, q) { const t = (o.byAI && G.running && !G.demo ? 'IA · ' : '') + (o.type === 'zone' ? `Objetivo ${'ABC'[o.k]}` : o.type === 'route' ? `Ruta ${Math.min(o.i + 1, o.pts.length)}/${o.pts.length}` : ORDER_TXT[o.type] || o.type); return q && q.length ? t + ' → ' + q.map(x => x.type === 'zone' ? 'ABC'[x.k] : ORDER_TXT[x.type]).join(' → ') : t; }
export function issueOrder(type, arg = {}, queued = false) {
  const sel = [...G.selection].filter(e => e.alive && e !== G.player && !e.support);
  if (!sel.length) return 0;
  // desplazamientos de formación alrededor del destino, orientados según la marcha
  let offs = null;
  if ((type === 'move' || type === 'route') && sel.length > 1) {
    const c = V3(); sel.forEach(e => c.add(e.p)); c.divideScalar(sel.length);
    const dest = type === 'route' ? arg.pt : V3(arg.x, 0, arg.z), h = Math.atan2(dest.x - c.x, dest.z - c.z);
    const r = V3(Math.cos(h), 0, -Math.sin(h)), f = V3(Math.sin(h), 0, Math.cos(h));
    offs = sel.map((e, i) => { const sp = e.dom === 'sea' ? 90 : e.dom === 'air' ? 50 : 34; const [lx, lz] = i === 0 ? [0, 0] : formationOffset(i - 1, sp); return [r.x * lx + f.x * lz, r.z * lx + f.z * lz]; });
  }
  sel.forEach((e, i) => {
    let o;
    if (type === 'hold') o = { type, x: e.p.x, z: e.p.z };
    else if (type === 'route') {
      if (queued && e.order.type === 'route') { e.order.pts.push(arg.pt); e.ai.think = 0; return; }
      o = { type: 'route', pts: [arg.pt], i: 0 };
    } else o = { type, ...arg };
    if (offs) { o.ox = offs[i][0]; o.oz = offs[i][1]; }
    // en tierra, cada unidad busca el seto, bosque o casa más próximo a su puesto (si hay alguno cerca)
    if (type === 'move' && e.dom === 'land' && e.cls !== 'atgun') { const cp = coverNear(o.x + (o.ox || 0), o.z + (o.oz || 0), 40); if (cp) { o.cx = cp.x; o.cz = cp.z; } }
    e.manualT = G.time + MANUAL_S; // la IA aliada respeta esta orden un tiempo
    if (queued && type !== 'route') { e.queue = e.queue || []; e.queue.push(o); if (e.order.type === 'follow' || e.order.type === 'hold') e.order = e.queue.shift(); }
    else { e.order = o; e.queue = []; }
    e.ai.think = 0;
  });
  if (type === 'move' && sel.some(e => e.dom === 'land') && G.onCoverSpots) G.onCoverSpots(arg.x, arg.z);
  return sel.length;
}
export function setPlayer(e) {
  if (!e || !e.alive || e.side !== 'A') return;
  const old = G.player;
  if (old && old.alive) { old.order = { type: 'follow' }; old.slot = e.slot ?? 0; G.selection.add(old); }
  G.selection.delete(e);
  G.player = e;
}

// ---------- mando IA ----------
// ---------- doctrina de grupo (igual para los dos bandos; ver la Escuela de mando) ----------
const DOC = { A: { phase: 'approach', since: 0, cyc: 0 }, E: { phase: 'approach', since: 0, cyc: 0 } };
export const docPhase = side => DOC[side].phase;
// cazas de cobertura alta: vuelan más alto que el resto para atacar picando
function airCover(units) {
  for (const e of units) if (e.dom === 'air' && e.cls === 'fighter') {
    if (e.baseAlt0 === undefined) e.baseAlt0 = e.baseAlt;
    e.baseAlt = e.order.role === 'cover' ? e.baseAlt0 + 75 : e.baseAlt0;
  }
}
const SLOTS = {
  destroyer: [[0, 620], [-380, 540], [380, 540], [-640, 400], [640, 400], [-200, 700], [200, 700], [-820, 250], [820, 250]],
  cruiser: [[-230, 300], [230, 300], [-460, 160], [460, 160]],
  battleship: [[-320, -120], [320, -120]],
  sub: [[-540, 1300], [540, 1300], [0, 1450]],
  pt: [[-760, 260], [760, 260], [-900, 0], [900, 0]],
};
function doctrine(side, units, enemySide) {
  const D = DOC[side]; D.cyc++;
  const seen = o => o.alive && o.side === enemySide && o['vis' + side] !== false;
  // ---- flota: pantalla, línea de batalla y fases (exploración → duelo artillero → ataque con torpedos) ----
  const ships = units.filter(e => e.dom === 'sea' && e.cls !== 'carrier' && e.cls !== 'merchant');
  if (ships.length >= 3) {
    const rank = e => (e.cls === 'battleship' ? 3 : e.cls === 'cruiser' ? 2 : e.cls === 'destroyer' ? 1 : 0) * 1e5 + e.s.hp;
    const flag = ships.slice().sort((a, b) => rank(b) - rank(a))[0];
    const foes = G.ents.filter(o => seen(o) && o.dom === 'sea' && !o.submerged);
    const near = foes.length ? foes.reduce((m, o) => Math.min(m, o.p.distanceTo(flag.p)), 1e9) : 1e9;
    if (near > 1700) { D.phase = 'approach'; D.since = G.time; }
    else if (D.phase === 'approach') { D.phase = 'duel'; D.since = G.time; }
    else if (D.phase === 'duel' && (G.time - D.since > 25 || near < 750)) { D.phase = 'torpedo'; D.since = G.time; }
    // rumbo de la flota: hacia el enemigo más cercano si se le ve; si no, hacia el objetivo del buque insignia
    let tx, tz;
    if (foes.length) { const f = foes.reduce((a, b) => a.p.distanceTo(flag.p) < b.p.distanceTo(flag.p) ? a : b); tx = f.p.x; tz = f.p.z; }
    else { const z = flag.order.type === 'zone' ? G.objectives[flag.order.k] : null; tx = z ? z.pos.x : flag.p.x + Math.sin(flag.h) * 500; tz = z ? z.pos.z : flag.p.z + Math.cos(flag.h) * 500; }
    const axis = Math.atan2(tx - flag.p.x, tz - flag.p.z);
    const carrier = units.find(e => e.cls === 'carrier');
    const used = {};
    let escortDone = !carrier;
    for (const e of ships) {
      if (e === flag || e === G.player) continue;
      if (!escortDone && e.cls === 'destroyer') { e.order = { type: 'escort', lead: carrier.id }; escortDone = true; continue; }
      const free = D.phase === 'torpedo' ? ['destroyer', 'cruiser', 'pt', 'sub'] : D.phase === 'duel' ? ['sub'] : [];
      if (free.includes(e.cls)) { e.order = { type: 'attack' }; continue; }
      const list = SLOTS[e.cls] || SLOTS.cruiser, k = used[e.cls] = (used[e.cls] || 0) + 1, sl = list[(k - 1) % list.length];
      const ring = Math.floor((k - 1) / list.length);
      e.order = { type: 'form', lead: flag.id, ox: sl[0] * (1 + ring * 0.3), oz: sl[1] - ring * 120, axis };
    }
  }
  // ---- tierra: la infantería abre camino, los carros avanzan por saltos y los de cañón largo vigilan ----
  const land = units.filter(e => e.dom === 'land' && e !== G.player && e.order.type === 'zone');
  const tanks = land.filter(e => e.cls === 'tank');
  if (tanks.length >= 3) {
    const longGun = e => e.s.gun && e.s.gun.range >= 560;
    const over = tanks.filter(longGun);
    const keepOver = over.length && over.length < tanks.length ? over : [];
    for (const e of tanks) {
      const z = G.objectives[e.order.k]; if (!z) continue;
      const dz = e.p.distanceTo(z.pos);
      const contact = G.ents.some(o => seen(o) && o.dom === 'land' && o.p.distanceTo(e.p) < 650);
      if (keepOver.includes(e) && z.owner !== side) { e.order = { type: 'overwatch', k: e.order.k }; continue; }
      if (!contact && dz > G.map.cfg.zoneR * 2.5 && (e.id + D.cyc) % 2 === 0) e.order = { type: 'bound', x: e.p.x, z: e.p.z, k: e.order.k };
    }
  }
}
function command(side) {
  const enemySide = side === 'A' ? 'E' : 'A';
  const units = G.ents.filter(e => e.alive && e.side === side && e.dom !== 'static' && (side === 'E' || (e !== G.player && !e.support && !(e.manualT > G.time))));
  const before = side === 'A' ? new Map(units.map(e => [e, orderLabel(e.order)])) : null;
  if (G.battle.kind === 'air') {
    const targets = (side === 'E' ? G.sitesA : G.sitesE);
    const bombers = units.filter(e => e.cls === 'bomber'), fighters = units.filter(e => e.cls === 'fighter');
    if (before) setTimeout(() => announce(units, before, -1), 0);
    bombers.forEach((b, i) => { const alive = targets.map((s, k) => [s, k]).filter(([s]) => s.alive); if (!alive.length) { b.order = { type: 'attack' }; return; } const [s, k] = alive.sort((a, c) => a[0].p.distanceTo(b.p) - c[0].p.distanceTo(b.p))[i % Math.min(2, alive.length)]; b.order = { type: 'zone', k }; });
    fighters.forEach((f, i) => { const lead = bombers.filter(b => b.alive)[i % Math.max(1, bombers.length)]; f.order = lead && i % 5 < 2 ? { type: 'escort', lead: lead.id } : i % 5 === 4 ? { type: 'defend' } : { type: 'attack', role: 'cover' }; });
    airCover(units);
    return;
  }
  const zs = G.objectives, R = G.map.cfg.zoneR, mixed = G.battle.kind === 'combined';
  if (mixed) {
    units.filter(e => e.dom === 'air').forEach((e, i) => { e.order = e.cls === 'bomber' ? { type: 'attack' } : i % 3 === 2 ? { type: 'defend' } : { type: 'attack', role: 'cover' }; });
    airCover(units);
  }
  // el mando solo cuenta a los enemigos que ve
  const vk = 'vis' + side;
  const enemyNear = zs.map(z => G.ents.filter(e => e.alive && e.side === enemySide && e.dom !== 'static' && e[vk] !== false && e.p.distanceTo(z.pos) < R * 1.8).length);
  const mine = zs.map(z => G.ents.filter(e => e.alive && e.side === side && e.dom !== 'static' && e.p.distanceTo(z.pos) < R * 1.5).length);
  // esfuerzo principal: el objetivo que no es nuestro con menos defensa enemiga, o el nuestro amenazado
  let main = -1, ms = -1e9;
  zs.forEach((z, k) => { const threatened = z.owner === side && enemyNear[k] > 0; const sc = (z.owner !== side ? 2 : 0) + (threatened ? 2.5 : 0) - enemyNear[k] * 0.4 + (z.owner === enemySide ? 0.5 : 0); if (sc > ms) { ms = sc; main = k; } });
  const w = zs.map((z, k) => 1 + (z.owner !== side ? 1.2 : 0) + enemyNear[k] * 0.25 + (k === main ? 2.2 : 0) + (z.owner === side && enemyNear[k] > mine[k] ? 1.5 : 0));
  const cnt = [0, 0, 0];
  const sorted = units.slice().sort((a, b) => a.id - b.id);
  for (const e of sorted) {
    if (mixed && e.dom === 'air') continue;
    if (e.cls === 'carrier') { e.order = { type: 'hold', x: G.bases[side].sea ? G.bases[side].sea.x : e.p.x, z: G.bases[side].sea ? G.bases[side].sea.z : e.p.z }; continue; }
    if (e.cls === 'atgun') { if (e.order.type !== 'hold') e.order = { type: 'hold', x: e.p.x, z: e.p.z }; continue; }
    let best = -1, bs = -1e9;
    zs.forEach((z, k) => { if (mixed && z.dom !== e.dom) return; const sc = w[k] / (cnt[k] + 1) - e.p.distanceTo(z.pos) / 2500 + (e.order.type === 'zone' && e.order.k === k ? 0.25 : 0); if (sc > bs) { bs = sc; best = k; } });
    if (best < 0) { e.order = { type: 'attack' }; continue; }
    cnt[best]++; e.order = { type: 'zone', k: best };
    if (e.cls === 'sub' || (e.cls === 'pt' && Math.random() < 0.5)) e.order = { type: 'attack' };
  }
  doctrine(side, units, enemySide);
  if (before) announce(units, before, main);
}
// marca las órdenes de la IA aliada y avisa cuando cambia el plan
function announce(units, before, main) {
  let changed = 0;
  for (const e of units) { e.order.byAI = true; if (orderLabel(e.order) !== before.get(e)) { changed++; e.ai.think = 0; } }
  if (main >= 0 && main !== lastMain) { lastMain = main; G.onPlan && G.onPlan(main, units.length); }
  else if (changed >= 3) G.onPlan && G.onPlan(-1, changed);
}

// ---------- actualización ----------
export function updateBattle(dt) {
  G.time += dt;
  const b = G.battle;
  // mando IA
  if (b.kind !== 'test') for (const s of ['A', 'E']) { if (s === 'A' && !G.demo && !aiAllies()) continue; cmdT[s] -= dt; if (cmdT[s] <= 0) { command(s); cmdT[s] = s === 'E' ? diff().cmd : 7; } }
  updateVision(dt); updateStrategy(dt);
  // línea de tiempo para el resumen final: dueño de cada zona y puntos de batalla cada 3 s
  if (!G.demo && G.stats && (G.stats.tlT -= dt) <= 0) { G.stats.tlT = 3; G.stats.tl.push({ t: G.time, z: G.objectives.map(z => z.owner || 'N').join(''), A: Math.ceil(G.tickets.A), E: Math.ceil(G.tickets.E) }); }
  // zonas
  if (b.kind !== 'air') {
    const R = G.map.cfg.zoneR;
    let a = 0, e = 0;
    for (const z of G.objectives) {
      let na = 0, ne = 0;
      for (const u of G.ents) if (u.alive && u.dom !== 'static' && u.dom !== 'air' && (!z.dom || u.dom === z.dom || b.kind !== 'combined') && Math.hypot(u.p.x - z.pos.x, u.p.z - z.pos.z) < R) u.side === 'A' ? na++ : ne++;
      z.na = na; z.ne = ne;
      if (na && !ne) z.prog = Math.min(100, z.prog + 9 * dt * Math.min(na, 3));
      else if (ne && !na) z.prog = Math.max(-100, z.prog - 9 * dt * Math.min(ne, 3));
      const prev = z.owner;
      if (z.prog >= 100) z.owner = 'A'; else if (z.prog <= -100) z.owner = 'E'; else if ((z.owner === 'A' && z.prog <= 0) || (z.owner === 'E' && z.prog >= 0)) z.owner = null;
      if (prev !== z.owner && G.onZone) G.onZone(z, prev);
      if (z.owner === 'A') a++; if (z.owner === 'E') e++;
      const col = z.owner === 'A' ? 0x4a90e8 : z.owner === 'E' ? 0xe0503f : (na && ne ? 0xffc040 : 0xcccccc);
      const ordered = G.selection.size && [...G.selection].filter(u => u.alive && u.order.type === 'zone' && u.order.k === z.k).length * 2 > [...G.selection].filter(u => u.alive).length;
      z.ring.material.color.setHex(ordered ? 0xffd23a : col); z.ring.material.opacity = 0.35 + (na && ne ? Math.sin(G.time * 6) * 0.2 + 0.2 : 0.15);
      if (z.lastCol !== col) { z.lab.material.map = labelTex(z.name, '#' + col.toString(16).padStart(6, '0')); z.lastCol = col; }
    }
    if (a > e) G.tickets.E = Math.max(0, G.tickets.E - (a - e) * 1.3 * dt);
    if (e > a) G.tickets.A = Math.max(0, G.tickets.A - (e - a) * 1.3 * dt);
  }
  // convoy: cada mercante que llega al puerto da puntos de mando y de batalla
  for (const e of G.ents) if (e.convoy && e.alive && !e.arrived) {
    const port = G.objectives.find(z => z.dom === 'sea');
    if (port && Math.hypot(e.p.x - port.pos.x, e.p.z - port.pos.z) < 220) { e.arrived = true; if (G.cp) G.cp.A += 80; G.tickets.A = Math.min(G.ticketsMax, G.tickets.A + 60); G.onMsg && !G.demo && G.onMsg('¡Convoy en Tobruk!', 'Suministros: +80 puntos de mando y +60 puntos de batalla'); }
  }
  // final
  if (!G.over && !G.demo && b.kind !== 'test') {
    const mob = s => G.ents.some(u => u.alive && u.side === s && u.dom !== 'static');
    const sitesDead = s => b.kind === 'air' && (s === 'A' ? G.sitesA : G.sitesE).every(x => !x.alive);
    let res = null;
    if (G.tickets.E <= 0 || !mob('E') || sitesDead('E')) res = 'win';
    else if (G.tickets.A <= 0 || !mob('A') || sitesDead('A')) res = 'lose';
    if (res) { G.over = true; G.onEnd && G.onEnd(res); }
  }
  if (G.demo && (!G.ents.some(u => u.alive && u.side === 'E' && u.dom !== 'static') || !G.ents.some(u => u.alive && u.side === 'A' && u.dom !== 'static') || G.time > 240)) G.onDemoEnd && G.onDemoEnd();
  // jugador caído → siguiente unidad
  if (G.player && !G.player.alive && !G.over) {
    deadT += dt;
    if (deadT > 1.6) { deadT = 0; const next = G.ents.filter(e => e.alive && e.side === 'A' && e.dom !== 'static').sort((x, y) => x.p.distanceTo(G.player.p) - y.p.distanceTo(G.player.p))[0]; if (next) { setPlayer(next); G.onMsg && G.onMsg(`Tomas el mando: ${next.name}`, next.m.type); } }
  }
  updateMarkers();
}

// ---------- iconos, anillos de selección y líneas de órdenes ----------
const ringGeo = new THREE.RingGeometry(0.85, 1, 32);
export function updateMarkers() {
  const far = G.zoom > 650 || G.strategic;
  for (const e of G.ents) {
    let sp = icons.get(e);
    if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ sizeAttenuation: false, depthTest: false, transparent: true })); sp.renderOrder = 12; markers.add(sp); icons.set(e, sp); }
    const kind = e.cls === 'sub' ? 'sub' : e.dom === 'static' ? (e.cls === 'site' || e.cls === 'battery' ? 'site' : 'aa') : e.dom;
    const tex = icon(e.side, kind, e === G.player);
    if (sp.material.map !== tex) { sp.material.map = tex; sp.material.needsUpdate = true; }
    sp.visible = far && e.alive && (e.cls !== 'aa') && !e.gone;
    if (e.cls === 'battery') sp.visible = far && e.alive;
    sp.material.opacity = 1;
    if (e.side === 'E' && G.fog && e.alive && e.visA === false) {
      const t = e.seenA, lp = e.lastA; sp.visible = sp.visible && t !== undefined && G.time - t < 25;
      if (sp.visible) { sp.position.set(lp.x, Math.max(lp.y, 0) + 8, lp.z); sp.material.opacity = 0.35; }
      continue;
    }
    const sz = e === G.player ? 0.034 : e.cls === 'site' ? 0.032 : 0.026; sp.scale.set(sz, sz, 1);
    sp.position.set(e.p.x, Math.max(e.p.y, 0) + 8, e.p.z);
    if (e.submerged) sp.material.opacity = 0.55;
    // anillo de selección
    let r = selRings.get(e); const sel = G.selection.has(e) && e.alive && e.side === 'A';
    if (sel && !r) { r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.renderOrder = 8; markers.add(r); selRings.set(e, r); }
    if (r) { r.visible = sel && !far && G.showSel; const s = e.hl * 1.3 + 2; r.scale.set(s, s, s); r.position.set(e.p.x, Math.max(e.p.y, 0) + (e.dom === 'air' ? -1 : 0.8), e.p.z); }
  }
  // líneas de órdenes
  const arr = lines.geometry.attributes.position.array; let n = 0;
  if (far || G.showSel) for (const e of G.selection) {
    if (!e.alive || n >= 39) continue; const g = e.goal; if (!g || e.order.type === 'follow' || e.order.type === 'attack') continue;
    arr.set([e.p.x, 6, e.p.z, g.x, 6, g.z], n * 6); n += 1;
    if (e.order.type === 'route') { let a = g; for (let i = e.order.i + 1; i < e.order.pts.length && n < 39; i++) { const p = e.order.pts[i]; arr.set([a.x, 6, a.z, p.x + (e.order.ox || 0), 6, p.z + (e.order.oz || 0)], n * 6); a = V3(p.x + (e.order.ox || 0), 0, p.z + (e.order.oz || 0)); n++; } }
  }
  lines.geometry.setDrawRange(0, n * 2); lines.geometry.attributes.position.needsUpdate = true;
}

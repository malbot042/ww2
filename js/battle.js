import * as THREE from 'three';
import { G } from './state.js';
import { BATTLES, MODELS, CLS } from './data.js';
import { buildWorld } from './world.js';
import { spawnUnit, spawnSite, spawnAA, spawnBattery, clearProjs, clearAnchors } from './units.js';
import { resetFx } from './fx.js';
import { V3, clamp, canvasTex } from './util.js';

let markers = null, icons = new Map(), iconTex = {}, lines = null, selRings = new Map(), cmdT = { A: 0, E: 0 }, deadT = 0;

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
  markers = new THREE.Group(); G.scene.add(markers);
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
export function startBattle(key, demo = false) {
  clearBattle();
  const b = BATTLES[key]; G.battle = b; G.battleKey = key; G.demo = demo;
  const map = buildWorld(b.map);
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
        } else { x = col * gap * (dom === 'air' ? 1.6 : 1); z = sgn * (sp + row * 60 + (dom === 'land' ? (i % 2) * 30 : 0)); }
        if (dom === 'sea') [x, z] = findNear(x, z, wantSea);
        if (dom === 'land') [x, z] = findNear(x, z, wantLand);
        out.push(spawnUnit(k, side, x, z, h));
      });
    }
    return out;
  };
  const allies = place(b.allies, 'A'), enemies = place(b.enemy, 'E');
  // cañones antitanque enemigos: ya emplazados junto a los objetivos de tierra
  const landZones = G.objectives.filter(z => z.dom === 'land');
  enemies.filter(e => e.cls === 'atgun').forEach((e, i) => {
    if (!landZones.length) return;
    const z = landZones[i % landZones.length], [x, zz] = findNear(z.pos.x + (i % 2 ? 50 : -50), z.pos.z - 70, wantLand);
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
  if (b.statics && map.extra && map.extra.statics) {
    const st = map.extra.statics;
    (st.battery || []).forEach(([x0, z0]) => { const [x, z] = findNear(x0, z0, wantLand); spawnBattery('E', 'de', x, z, 0); });
    (st.aa || []).forEach(([x0, z0]) => { const [x, z] = findNear(x0, z0, wantLand); spawnAA('E', 'de', x, z); });
  }
  // jugador
  const pref = naval ? 'destroyer' : air ? 'fighter' : 'tank';
  G.player = demo ? null : (allies.find(e => e.cls === pref) || allies[0]);
  let slot = 0; allies.forEach(e => { if (e !== G.player) { e.slot = slot++; e.order = { type: 'follow' }; G.selection.add(e); } });
  if (demo) { allies.forEach(e => e.order = { type: 'attack' }); G.selection.clear(); }
  G.tickets = { A: air ? 450 : mixed ? 800 : 600, E: air ? 450 : mixed ? 800 : 600 }; G.ticketsMax = G.tickets.A;
  G.time = 0; G.over = false; G.stats = { kills: 0, lost: 0 }; cmdT = { A: demo ? 0 : 1e9, E: 0 }; deadT = 0;
  // líneas de órdenes
  lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55, depthTest: false }));
  lines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(240), 3)); lines.renderOrder = 11; lines.frustumCulled = false; markers.add(lines);
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
const ORDER_TXT = { follow: 'Seguirme', zone: 'Objetivo', attack: 'Ataque libre', hold: 'Mantener', defend: 'Defender', move: 'Mover', escort: 'Escolta' };
export function orderLabel(o) { return o.type === 'zone' ? `Objetivo ${'ABC'[o.k]}` : ORDER_TXT[o.type] || o.type; }
export function issueOrder(type, arg = {}) {
  const sel = [...G.selection].filter(e => e.alive && e !== G.player);
  if (!sel.length) return 0;
  for (const e of sel) {
    if (type === 'hold') e.order = { type, x: e.p.x, z: e.p.z };
    else e.order = { type, ...arg };
    e.ai.think = 0;
  }
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
function command(side) {
  const enemySide = side === 'A' ? 'E' : 'A';
  const units = G.ents.filter(e => e.alive && e.side === side && e.dom !== 'static' && (side === 'E' || e !== G.player));
  if (G.battle.kind === 'air') {
    const targets = (side === 'E' ? G.sitesA : G.sitesE);
    const bombers = units.filter(e => e.cls === 'bomber'), fighters = units.filter(e => e.cls === 'fighter');
    bombers.forEach((b, i) => { const alive = targets.map((s, k) => [s, k]).filter(([s]) => s.alive); if (!alive.length) { b.order = { type: 'attack' }; return; } const [s, k] = alive.sort((a, c) => a[0].p.distanceTo(b.p) - c[0].p.distanceTo(b.p))[i % Math.min(2, alive.length)]; b.order = { type: 'zone', k }; });
    fighters.forEach((f, i) => { const lead = bombers.filter(b => b.alive)[i % Math.max(1, bombers.length)]; f.order = lead && i % 2 === 0 ? { type: 'escort', lead: lead.id } : i % 3 === 1 ? { type: 'defend' } : { type: 'attack' }; });
    return;
  }
  const zs = G.objectives, R = G.map.cfg.zoneR, mixed = G.battle.kind === 'combined';
  if (mixed) {
    units.filter(e => e.dom === 'air').forEach((e, i) => { e.order = e.cls === 'bomber' ? { type: 'attack' } : i % 2 ? { type: 'defend' } : { type: 'attack' }; });
  }
  const enemyNear = zs.map(z => G.ents.filter(e => e.alive && e.side === enemySide && e.dom !== 'static' && e.p.distanceTo(z.pos) < R * 1.8).length);
  const w = zs.map((z, k) => 1 + (z.owner !== side ? 1.2 : 0) + enemyNear[k] * 0.25);
  const cnt = [0, 0, 0];
  const sorted = units.slice().sort((a, b) => a.id - b.id);
  for (const e of sorted) {
    if (mixed && e.dom === 'air') continue;
    if (e.cls === 'atgun') { if (e.order.type !== 'hold') e.order = { type: 'hold', x: e.p.x, z: e.p.z }; continue; }
    let best = -1, bs = -1e9;
    zs.forEach((z, k) => { if (mixed && z.dom !== e.dom) return; const sc = w[k] / (cnt[k] + 1) - e.p.distanceTo(z.pos) / 2500 + (e.order.type === 'zone' && e.order.k === k ? 0.25 : 0); if (sc > bs) { bs = sc; best = k; } });
    if (best < 0) { e.order = { type: 'attack' }; continue; }
    cnt[best]++; e.order = { type: 'zone', k: best };
    if (e.cls === 'sub' || (e.cls === 'pt' && Math.random() < 0.5)) e.order = { type: 'attack' };
  }
}

// ---------- actualización ----------
export function updateBattle(dt) {
  G.time += dt;
  const b = G.battle;
  // mando IA
  if (b.kind !== 'test') for (const s of ['A', 'E']) { cmdT[s] -= dt; if (cmdT[s] <= 0) { command(s); cmdT[s] = 12; } }
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
function updateMarkers() {
  const far = G.zoom > 650 || G.strategic;
  for (const e of G.ents) {
    let sp = icons.get(e);
    if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ sizeAttenuation: false, depthTest: false, transparent: true })); sp.renderOrder = 12; markers.add(sp); icons.set(e, sp); }
    const kind = e.cls === 'sub' ? 'sub' : e.dom === 'static' ? (e.cls === 'site' || e.cls === 'battery' ? 'site' : 'aa') : e.dom;
    const tex = icon(e.side, kind, e === G.player);
    if (sp.material.map !== tex) { sp.material.map = tex; sp.material.needsUpdate = true; }
    sp.visible = far && e.alive && (e.cls !== 'aa');
    if (e.cls === 'battery') sp.visible = far && e.alive;
    const sz = e === G.player ? 0.034 : e.cls === 'site' ? 0.032 : 0.026; sp.scale.set(sz, sz, 1);
    sp.position.set(e.p.x, Math.max(e.p.y, 0) + 8, e.p.z);
    sp.material.opacity = e.submerged ? 0.55 : 1;
    // anillo de selección
    let r = selRings.get(e); const sel = G.selection.has(e) && e.alive && e.side === 'A';
    if (sel && !r) { r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.renderOrder = 8; markers.add(r); selRings.set(e, r); }
    if (r) { r.visible = sel && !far && G.showSel; const s = e.hl * 1.3 + 2; r.scale.set(s, s, s); r.position.set(e.p.x, Math.max(e.p.y, 0) + (e.dom === 'air' ? -1 : 0.8), e.p.z); }
  }
  // líneas de órdenes
  const arr = lines.geometry.attributes.position.array; let n = 0;
  if (far || G.showSel) for (const e of G.selection) { if (!e.alive || n >= 39) continue; const g = e.goal; if (!g || e.order.type === 'follow' || e.order.type === 'attack') continue; arr.set([e.p.x, 6, e.p.z, g.x, 6, g.z], n * 6); n += 1; }
  lines.geometry.setDrawRange(0, n * 2); lines.geometry.attributes.position.needsUpdate = true;
}

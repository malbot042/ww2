import * as THREE from 'three';
import { losBlocked, coverOf, collisions, landImpact } from './physics.js';
import { diff } from './difficulty.js';
import { trackMark } from './marks.js';
import { updateDamageLook, onKillFx, crater } from './damagefx.js';
import { gainXp } from './campaign.js';
import { launchFlare } from './env.js';
import { G } from './state.js';
import { MODELS, specOf, CLS } from './data.js';
import { buildModel, buildSite, buildAA, buildBattery } from './models.js';
import * as FX from './fx.js';
import { clamp, rnd, angDiff, V3 } from './util.js';
const seen = (e, o) => !G.fog || o['vis' + e.side] !== false;

const GRAV = 60;
let uid = 1;
const tmp = V3(), tmp2 = V3();
const burnt = new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 1 });
export const K = c => !!G.keys[c];

// ---------- creación ----------
function mkEnt(o) {
  const ud = o.mesh.userData, tur = ud.turrets || (ud.turret ? [ud.turret] : []);
  const e = Object.assign({
    id: uid++, p: o.mesh.position, speed: 0, alive: true, vel: V3(),
    cd: { main: rnd(0.5, 2.5), sec: 0, torp: rnd(1, 5), dc: 0, aa: rnd(0, 1), smoke: 0, rear: 0, bomb: rnd(0, 3), mg: 0, rep: 0, coax: 0, rocket: rnd(0, 3) },
    mods: {}, repairing: 0, ammoSel: 'ap', vy: 0,
    tur, tYaw: tur.map(t => t.userData.base || 0), order: { type: 'follow' }, ai: { think: rnd(0, 0.4), esc: 0, dir: 1, evade: 0 },
    target: null, goal: null, submerged: false, battery: 1, detected: 0,
    hw: ud.hw || 4, hl: ud.hl || 4, top: ud.top || 4, bank: 0, thr: 0, steer: 0, blocked: 0,
  }, o);
  e.hp = e.s.hp; e.r = ud.r || e.s.r || 6;
  e.ammo = { ...(e.s.ammo || {}) }; e.ammoMax = { ...(e.s.ammo || {}) };
  if (e.s.hangar) { e.hangar = e.s.hangar; e.planeKey = o.m.plane; e.cd.launch = 2; }
  e.mesh.rotation.order = 'YXZ';
  return e;
}
export function spawnUnit(key, side, x, z, h) {
  const m = MODELS[key], s = specOf(key), mesh = buildModel(key);
  G.unitsGroup.add(mesh);
  const e = mkEnt({ key, m, s, cls: m.cls, dom: s.dom, side, fac: m.fac, mesh, h, name: m.name });
  e.p.set(x, 0, z);
  if (e.dom === 'air') { e.baseAlt = (s.heavy ? 215 : m.cls === 'bomber' ? 150 : 115) + rnd(-15, 15); e.alt = e.baseAlt; e.p.y = e.alt; e.speed = s.max * 0.8; }
  else if (e.dom === 'land') e.p.y = G.map.gy(x, z);
  mesh.rotation.y = h;
  G.ents.push(e);
  return e;
}
export function spawnSite(idx, side, fac, x, z) {
  const mesh = buildSite(idx, fac, G.map.theme); G.unitsGroup.add(mesh);
  const s = { ...CLS.site };
  const e = mkEnt({ key: 'site', m: { name: ['Aeródromo', 'Depósito de combustible', 'Estación de radar'][idx] }, s, cls: 'site', dom: 'static', side, fac, mesh, h: 0, name: ['Aeródromo', 'Depósito de combustible', 'Estación de radar'][idx] });
  e.p.set(x, G.map.gy(x, z), z); e.siteIdx = idx; G.ents.push(e); return e;
}
export function spawnAA(side, fac, x, z) {
  const mesh = buildAA(fac); G.unitsGroup.add(mesh);
  const e = mkEnt({ key: 'aa', m: { name: fac === 'de' ? 'Flak 36 (88 mm)' : 'Bofors 40 mm' }, s: { ...CLS.aa }, cls: 'aa', dom: 'static', side, fac, mesh, h: rnd(0, 6), name: fac === 'de' ? 'Flak 88' : 'Antiaéreo' });
  e.p.set(x, G.map.gy(x, z), z); G.ents.push(e); return e;
}

export function spawnBattery(side, fac, x, z, h) {
  const mesh = buildBattery(fac); G.unitsGroup.add(mesh);
  const e = mkEnt({ key: 'battery', m: { name: 'Batería costera', type: 'Casamata 105 mm' }, s: { ...CLS.battery }, cls: 'battery', dom: 'static', side, fac, mesh, h, name: 'Batería costera' });
  e.p.set(x, G.map.gy(x, z), z); mesh.rotation.y = h; G.ents.push(e); return e;
}

// ---------- utilidades de combate ----------
const fwdOf = e => tmp2.set(Math.sin(e.h), 0, Math.cos(e.h));
export const angTo = (e, p) => Math.atan2(p.x - e.p.x, p.z - e.p.z);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function inBox(e, p, pad = 0) {
  const dx = p.x - e.p.x, dz = p.z - e.p.z;
  if (Math.abs(dx) > e.hl + 30 || Math.abs(dz) > e.hl + 30) return false;
  const c = Math.cos(e.h), s = Math.sin(e.h), lz = dx * s + dz * c, lx = dx * c - dz * s;
  return Math.abs(lx) < e.hw + pad && Math.abs(lz) < e.hl + pad && p.y < e.p.y + e.top && p.y > e.p.y - 2.5;
}
function smokeBlocks(a, b) {
  for (const s of G.smokes) {
    const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz || 1;
    const t = clamp(((s.x - a.x) * abx + (s.z - a.z) * abz) / l2, 0, 1);
    if (Math.hypot(a.x + abx * t - s.x, a.z + abz * t - s.z) < s.r) return true;
  }
  return false;
}
const isShip = o => o.dom === 'sea';
const visibleShip = o => o.dom === 'sea' && !o.submerged;
const isPlane = o => o.dom === 'air';
const isGround = o => o.dom === 'static' || o.dom === 'land' || (o.dom === 'sea' && !o.submerged);
export function targetFilter(e) {
  const mixed = G.battle && G.battle.kind === 'combined';
  switch (e.cls) {
    case 'destroyer': case 'cruiser': case 'battleship': return mixed ? o => visibleShip(o) || o.dom === 'land' || (o.dom === 'static' && o.cls !== 'site') : visibleShip;
    case 'pt': case 'sub': return visibleShip;
    case 'tank': case 'atgun': return mixed ? o => o.dom === 'land' || o.dom === 'static' || visibleShip(o) : o => o.dom === 'land';
    case 'inf': return o => o.dom === 'land' || o.dom === 'static';
    case 'fighter': return isPlane;
    case 'bomber': return o => o.dom === 'static' || (o.dom === 'sea' && !o.submerged) || o.dom === 'land';
    case 'aa': return isPlane;
    case 'battery': return o => visibleShip(o) || o.dom === 'land';
  }
  return () => false;
}
// número de torres que pueden apuntar a un punto (arcos de tiro)
export function bearingCount(e, p) {
  if (!e.tur.length) return 0;
  const want = Math.atan2(p.x - e.p.x, p.z - e.p.z) - e.h;
  if (e.dom !== 'sea' || e.cls === 'pt' || e.cls === 'sub') return e.tur.length;
  return e.tur.filter(t => Math.abs(angDiff(want, t.userData.base || 0)) <= 2.55).length;
}
// blanco del jugador: fijado (T / clic) o automático con prioridades
function playerScore(e, o, d, range) {
  let sc = d / range;
  if (e.dom === 'sea' && e.tur.length > 1) sc += (1 - bearingCount(e, o.p) / e.tur.length) * 0.9;
  else sc += Math.abs(angDiff(angTo(e, o.p), e.h + (e.tYaw[0] || 0))) / Math.PI * 0.9;
  sc += (o.hp / o.s.hp) * 0.25;
  if (o.target === e) sc -= 0.2;
  if (o.dom === e.dom || (e.dom === 'land' && o.cls === 'battery')) sc -= 0.15;
  if (o === e.target) sc -= 0.25;
  return sc;
}
function candidates(e, filt, range) {
  return G.ents.filter(o => o.alive && o.side !== e.side && !o.falling && filt(o) && seen(e, o) && o.p.distanceTo(e.p) <= range && !(e.dom === 'land' && smokeBlocks(e.p, o.p)) && !losBlocked(e, o));
}
export function lockTarget(e, o) { e.lock = o; e.target = o; }
function playerTarget(e, filt, range) {
  if (e.lock && (!e.lock.alive || e.lock.falling || e.lock.submerged || e.lock.p.distanceTo(e.p) > range * 1.25)) e.lock = null;
  if (G.keysOnce.has('KeyT')) {
    const list = candidates(e, filt, range * 1.15).sort((a, b) => angDiff(angTo(e, a.p), e.h) - angDiff(angTo(e, b.p), e.h));
    if (list.length) { const i = list.indexOf(e.target); e.lock = list[(i + 1) % list.length]; G.onMsg && G.onMsg('Blanco fijado', `${e.lock.name} · ${Math.round(e.lock.p.distanceTo(e.p))} m`); }
  }
  if (G.keysOnce.has('KeyY') && e.lock) { e.lock = null; G.onMsg && G.onMsg('Blanco automático', ''); }
  if (e.lock) return e.lock;
  let best = null, bs = 1e9;
  for (const o of candidates(e, filt, range)) { const sc = playerScore(e, o, o.p.distanceTo(e.p), range); if (sc < bs) { bs = sc; best = o; } }
  return best;
}
export function weaponRange(e) {
  const s = e.s;
  return s.rifle?.range || s.main?.range || s.gun?.range || s.mg?.range || (e.cls === 'sub' ? 800 : 0) || s.flak?.range || s.guns?.range || 300;
}
export function pickTarget(e, filter, range, preferAim = false) {
  let best = null, bs = 1e9;
  for (const o of G.ents) {
    if (!o.alive || o.side === e.side || o.falling || !filter(o) || !seen(e, o)) continue;
    const d = o.p.distanceTo(e.p); if (d > range) continue;
    if (e.dom === 'land' && smokeBlocks(e.p, o.p)) continue;
    if (losBlocked(e, o)) continue; // islas, colinas, setos, bosques y casas tapan la vista
    let sc = d;
    if (preferAim) { const a = Math.abs(angDiff(angTo(e, o.p), e.h + (e.tYaw[0] || 0))); sc = d * (1 + a * 1.5); }
    if (o === e.target) sc *= 0.75;
    if (o.cls === 'bomber' && e.cls === 'fighter' && e.side === 'A') sc *= 0.85;
    if (sc < bs) { bs = sc; best = o; }
  }
  return best;
}
export function lead(from, t, speed) {
  const d = from.distanceTo(t.p), tt = d / speed;
  return t.p.clone().addScaledVector(t.vel, tt);
}

// ---------- daño ----------
export function damage(e, dmg, by, dir, kind) {
  if (by && by.side === 'E' && e.side === 'A') dmg *= diff().dmg; // dificultad
  if (!e.alive || dmg <= 0) return null;
  if (G.tally && kind) G.tally[e.side + kind] = (G.tally[e.side + kind] || 0) + dmg;
  let mult = 1, zone = null;
  if (e.s.armor && dir) {
    const f = fwdOf(e), l = Math.hypot(dir.x, dir.z) || 1, c = -(dir.x * f.x + dir.z * f.z) / l;
    zone = c > 0.62 ? 0 : c < -0.62 ? 2 : 1; mult = e.s.armor[zone];
  }
  if (e.cls === 'inf' && Math.abs(e.speed) < 1) mult *= 0.6; // cuerpo a tierra
  if (by === G.player && G.onHit) G.onHit(e, zone, mult, dmg * mult, kind);
  if (by === G.player && G.drillHook) G.drillHook(e, dmg * mult, kind, zone);
  if (e === G.player && G.godMode) { G.shake = Math.max(G.shake, 0.5); return zone; }
  e.hp -= dmg * mult;
  if (e === G.player) { G.shake = Math.max(G.shake, 0.8 + dmg / 40); G.onHurt && G.onHurt(); }
  if (e.hp <= 0) kill(e, by);
  return zone;
}
// multiplicador según munición y tipo de blanco
const isArmored = e => e.cls === 'tank';
const isSoft = e => e.cls === 'inf' || e.cls === 'atgun' || e.dom === 'static';
function ammoMult(q, e) {
  if (q.kind === 'bullet') return isArmored(e) ? 0.06 : e.dom === 'sea' && e.cls !== 'pt' ? 0.3 : e.cls === 'atgun' ? 0.7 : 1;
  if (q.ammo === 'he') return isArmored(e) ? 0.45 : e.dom === 'sea' ? 0.75 : isSoft(e) || e.dom === 'land' ? 1.6 : 1;
  if (q.ammo === 'ap' || q.ammo === 'rocket') return e.cls === 'inf' ? 0.35 : isSoft(e) ? 0.6 : 1;
  return 1;
}
// ---------- daño por partes ----------
export const MOD_NAME = { engine: 'Motor dañado', rudder: 'Timón dañado', fire: 'Incendio', tracks: 'Orugas rotas', turret: 'Torreta atascada', controls: 'Mandos dañados', gun: 'Torre destruida' };
export function applyCrit(e, m, by, idx) {
  if (!e.alive) return;
  if (m === 'gun') { const t = e.tur[idx]; if (!t || t.userData.dead) return; t.userData.dead = true; t.rotation.z = 0.12; t.rotation.x = 0.08; }
  else if (m === 'fire') { if (e.mods.fire > 0) return; e.mods.fire = 16 + rnd(0, 10); }
  else if (m === 'tracks') { e.mods.tracks = 9; }
  else { if (e.mods[m]) return; e.mods[m] = true; }
  G.onCrit && G.onCrit(e, m, by);
}
function rollCrit(e, q, dealt, hitP, zone) {
  if (!e.alive || e.cls === 'inf' || e.dom === 'static' || e.cls === 'atgun') return;
  const by = q.owner, big = dealt >= 15, r = Math.random;
  if (e.dom === 'sea') {
    if (!big && q.kind !== 'torp') return;
    const dx = hitP.x - e.p.x, dz = hitP.z - e.p.z, lz = (dx * Math.sin(e.h) + dz * Math.cos(e.h)) / e.hl;
    if (q.kind === 'naval' && e.tur.length > 1 && r() < 0.22) { let bi = 0, bd = 9; e.tur.forEach((t, i) => { const d = Math.abs(t.position.z / e.hl - lz); if (d < bd) { bd = d; bi = i; } }); applyCrit(e, 'gun', by, bi); }
    if (lz < -0.55 && r() < 0.35) applyCrit(e, r() < 0.5 ? 'rudder' : 'engine', by);
    else if (r() < (q.kind === 'torp' ? 0.5 : 0.07)) applyCrit(e, 'engine', by);
    if (r() < (q.ammo === 'he' ? 0.28 : 0.09) + (q.kind === 'torp' ? 0.35 : 0)) applyCrit(e, 'fire', by);
  } else if (e.cls === 'tank') {
    if (!big) return;
    if (zone === 1 && r() < 0.3) applyCrit(e, 'tracks', by);
    if (zone === 2 && r() < 0.35) applyCrit(e, 'engine', by);
    if ((zone === 2 && r() < 0.15) || (q.ammo === 'he' && r() < 0.06)) applyCrit(e, 'fire', by);
    if (zone === 0 && r() < 0.12) applyCrit(e, 'turret', by);
  } else if (e.dom === 'air') {
    if (r() < (big ? 0.3 : 0.025)) applyCrit(e, ['engine', 'controls', 'fire'][(r() * 3) | 0], by);
  }
}
export const hasCrit = e => Object.keys(e.mods).some(k => e.mods[k]);
export function startRepair(e) {
  if (e.cd.rep > 0 || e.repairing > 0 || !hasCrit(e)) return false;
  e.mods.fire = 0; e.repairing = e.dom === 'air' ? 3 : 5; e.cd.rep = 40;
  return true;
}
export function kill(e, by) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0;
  G.tickets[e.side] = Math.max(0, G.tickets[e.side] - e.s.value);
  if (G.cp && !e.support) G.cp[e.side === 'A' ? 'E' : 'A'] += e.s.value * 0.6;
  if (e.side === 'E') G.stats.kills++; else if (e.dom !== 'static' || e.cls === 'site') G.stats.lost++;
  gainXp(by, e); onKillFx(e);
  G.onKill && G.onKill(e, by);
  const p = e.p.clone();
  if (e.dom === 'air') { e.falling = 4; e.spin = rnd(-1, 1) > 0 ? 3 : -3; FX.explosion(p, 1); return; }
  if (e.dom === 'sea') { FX.explosion(p.clone().setY(2), e.cls === 'battleship' || e.cls === 'carrier' ? 3.6 : e.cls === 'cruiser' ? 2.8 : e.cls === 'pt' ? 1.2 : 2, {}); FX.splash(p, 2); e.sink = 0; e.burn = 30; }
  else if (e.cls === 'inf') { FX.dirt(p, 0.8); e.mesh.visible = false; e.gone = true; return; }
  else { FX.explosion(p.clone().setY(p.y + 1.5), e.cls === 'site' ? 3 : e.cls === 'atgun' ? 0.9 : 1.6, { debris: true, dust: true }); e.burn = e.cls === 'site' ? 90 : e.cls === 'atgun' ? 12 : 45; if (e.cls === 'tank' && Math.random() < 0.45 && e.tur[0]) e.popTurret = { v: V3(rnd(-4, 4), rnd(14, 22), rnd(-4, 4)), r: rnd(-4, 4) }; }
  e.mesh.traverse(o => { if (o.isMesh && !(o.material instanceof THREE.MeshBasicMaterial)) o.material = burnt; });
  if (e.cls === 'site') e.mesh.scale.y = 0.45;
}

// ---------- proyectiles ----------
const PG = { naval: new THREE.BoxGeometry(0.7, 0.7, 5), ap: new THREE.BoxGeometry(0.35, 0.35, 4), bullet: new THREE.BoxGeometry(0.2, 0.2, 3.4), flak: new THREE.BoxGeometry(0.4, 0.4, 2.2), bomb: new THREE.CapsuleGeometry(0.45, 1.6, 3, 6).rotateX(Math.PI / 2), torp: new THREE.CylinderGeometry(0.3, 0.3, 5, 6).rotateX(Math.PI / 2), dc: new THREE.CylinderGeometry(0.5, 0.5, 1, 8) };
const PM = {
  A: new THREE.MeshBasicMaterial({ color: 0xffe7a6, toneMapped: false }), E: new THREE.MeshBasicMaterial({ color: 0xffb08a, toneMapped: false }),
  naval: new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false }), dark: new THREE.MeshStandardMaterial({ color: 0x2c2d2a, roughness: 0.6 }),
};
function proj(kind, owner, from, v, o = {}) {
  const m = new THREE.Mesh(PG[kind], kind === 'bomb' || kind === 'torp' || kind === 'dc' ? PM.dark : kind === 'naval' ? PM.naval : PM[owner.side]);
  m.position.copy(from); G.unitsGroup.add(m);
  const q = Object.assign({ kind, side: owner.side, owner, m, p: m.position, v, dmg: 10, life: 3, grav: 0, age: 0 }, o);
  m.lookAt(tmp.copy(from).add(v)); G.projs.push(q);
  if (kind !== 'torp' && kind !== 'dc') owner.revealT = 2;
  return q;
}
function removeProj(i) { const q = G.projs[i]; G.unitsGroup.remove(q.m); G.projs.splice(i, 1); }
export function clearProjs() { for (let i = G.projs.length - 1; i >= 0; i--) removeProj(i); }

export function updateProjs(dt) {
  const map = G.map;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const q = G.projs[i], p = q.p;
    q.age += dt; q.life -= dt;
    q.v.y -= q.grav * dt; p.addScaledVector(q.v, dt);
    if (q.kind !== 'torp' && q.kind !== 'dc') q.m.lookAt(tmp.copy(p).add(q.v));
    if (q.trail && Math.random() < 0.8) FX.trailSmoke(p, false, 0.4);
    let done = false;
    const ground = map.h(p.x, p.z), surf = Math.max(ground, 0);
    if (q.kind === 'torp') {
      p.y = -0.5; if (Math.random() < 0.7) FX.bubbles(p);
      if (ground > -0.8) { FX.splash(p, 1.2); FX.dirt(p, 0.8); done = true; }
      else for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom === 'sea' && !e.submerged && inBox(e, tmp.copy(p).setY(e.p.y), 1)) { const z = damage(e, q.dmg, q.owner, q.v, 'torp'); rollCrit(e, q, q.dmg, p, z); FX.splash(p, 3.2); FX.explosion(p.clone().setY(1), 1.4); FX.sfx('torp', p); done = true; break; }
    } else if (q.kind === 'dc') {
      if (p.y < -6 || q.age > 1.6) {
        FX.splash(p.clone().setY(0), 2.6);
        for (const e of G.ents) if (e.alive && e.side !== q.side && e.cls === 'sub') { const d = dist2(e.p, p); if (d < 34) damage(e, 95 * (1 - d / 40), q.owner, null, 'dc'); }
        done = true;
      }
    } else if (q.kind === 'bomb') {
      if (p.y <= surf) {
        const w = ground < 0; if (w) FX.splash(p, 2.4); else crater(p.x, p.z, q.rad / 30); FX.explosion(V3(p.x, surf, p.z), w ? 1 : 1.8, { dust: !w, debris: !w });
        for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom !== 'air') { const d = dist2(e.p, p) - Math.min(e.hw, 25); if (d < q.rad) damage(e, q.dmg * (d < 4 ? 1 : 1 - d / q.rad * 0.6), q.owner, null, 'bomb'); }
        done = true;
      }
    } else if (q.kind === 'flak') {
      let burst = q.life <= 0;
      if (!burst) for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom === 'air' && !e.falling && e.p.distanceToSquared(p) < 110) { burst = true; break; }
      if (burst) { FX.flak(p); for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom === 'air') { const d = e.p.distanceTo(p); if (d < 20) damage(e, q.dmg * (1 - d / 22), q.owner); } done = true; }
    } else {
      // naval / ap / bullet
      for (const e of G.ents) {
        if (!e.alive || e.side === q.side || e.submerged) continue;
        let hit = false;
        if (e.dom === 'air') { if (q.kind === 'bullet' && e.p.distanceToSquared(p) < (e.r + 1.2) ** 2) hit = true; }
        else if (q.kind !== 'bullet' || q.surface) hit = inBox(e, p, q.kind === 'naval' ? 0.8 : 0.2);
        // la cobertura (setos, árboles, casas) se traga parte de los disparos contra unidades de tierra
        if (hit && q.owner && coverOf(e) > 0.25 && dist2(q.owner.p, e.p) > 60 && Math.random() < 0.4 * coverOf(e)) { FX.dirt(p.clone(), 0.6); if (q.owner === G.player && G.onMsg) G.onMsg('El disparo da en la cobertura', '', 0.8); done = true; break; }
        if (hit) {
          const mlt = ammoMult(q, e), zone = damage(e, q.dmg * mlt, q.owner, q.v, q.kind);
          rollCrit(e, q, q.dmg * mlt * (zone !== null && e.s.armor ? e.s.armor[zone] : 1), p, zone);
          if (q.ammo === 'he' || q.ammo === 'rocket') splashHE(q, p, e);
          if (q.kind === 'naval') FX.explosion(p.clone(), q.dmg > 80 ? 1.8 : q.dmg > 40 ? 1.1 : 0.8);
          else if (q.kind === 'ap') { FX.hitSpark(p); FX.explosion(p.clone(), 0.45); }
          else FX.hitSpark(p);
          done = true; break;
        }
      }
      if (!done && p.y <= surf) {
        if (q.kind === 'naval') { if (ground < 0) { FX.splash(V3(p.x, 0, p.z), q.dmg > 80 ? 2.8 : q.dmg > 40 ? 1.8 : 1.2); for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom === 'sea' && !e.submerged && dist2(e.p, p) < e.hl * 0.6 + 8) damage(e, q.dmg * 0.12, q.owner, null, 'near'); } else { FX.dirt(V3(p.x, surf, p.z), 1.2); crater(p.x, p.z, q.dmg > 80 ? 0.9 : 0.6); for (const e of G.ents) if (e.alive && e.side !== q.side && (e.dom === 'land' || e.dom === 'static')) { const d = dist2(e.p, p) - e.hw; if (d < 10) damage(e, q.dmg * 0.6 * (1 - Math.max(0, d) / 12), q.owner, null, 'he'); } } }
        else if (q.kind === 'ap') { FX.dirt(V3(p.x, surf, p.z), q.ammo === 'he' ? 0.9 : 0.6); if (q.ammo === 'he' || q.ammo === 'rocket') crater(p.x, p.z, 0.4); if (q.ammo === 'he' || q.ammo === 'rocket') splashHE(q, V3(p.x, surf, p.z), null); }
        else if (Math.random() < 0.25) { if (ground < 0) FX.splash(V3(p.x, 0, p.z), 0.25); }
        done = true;
      }
      if (q.life <= 0) done = true;
    }
    if (q.life <= -2) done = true;
    if (done) removeProj(i);
  }
}

function splashHE(q, p, except) {
  for (const o of G.ents) { if (!o.alive || o === except || o.side === q.side || o.dom === 'air' || o.dom === 'sea') continue; const d = dist2(o.p, p) - o.hw; if (d < 8) damage(o, q.dmg * 0.55 * ammoMult(q, o) * (1 - Math.max(0, d) / 9), q.owner, null, 'he'); }
}
// munición: elegir tipo (jugador: el seleccionado; IA: según el blanco)
function pickAmmo(e, t) {
  const a = e.ammo; if (a.ap === undefined) return 'x';
  const manual = e === G.player && !G.demo && (G.opts?.mode === 'veteran' || e.ammoManual);
  let want = manual ? e.ammoSel : (t && (isSoft(t) || (t.dom === 'land' && !isArmored(t)) || (e.dom === 'sea' && t.dom !== 'sea')) ? 'he' : 'ap');
  if (a[want] < 1) want = want === 'ap' ? 'he' : 'ap';
  if (e === G.player && !manual && a[want] >= 1) e.ammoSel = want; // el panel muestra la elegida
  return a[want] >= 1 ? want : null;
}
export function ammoFrac(e) {
  const a = e.ammo, m = e.ammoMax; let n = 0, d = 0;
  for (const k in m) { if (k === 'deck' || k === 'dc') continue; n += a[k]; d += m[k]; }
  return d ? n / d : 1;
}
function needsRearm(e) {
  const a = e.ammo; if (!e.ammoMax || !Object.keys(e.ammoMax).length) return false;
  if (a.ap !== undefined) return a.ap < 1 && a.he < 1;
  if (e.cls === 'sub') return a.torp < 1;
  if (e.cls === 'fighter') return a.guns < 1;
  if (e.cls === 'bomber') return a.bomb < 1 && a.guns < 60;
  return false;
}

// ---------- armas ----------

function turretWorld(e, i) { return e.tur[i].getWorldPosition(tmp.set(0, 0, 0)).clone(); }
function aimTurrets(e, tp, dt, rate = 0.9) {
  let ready = 0;
  for (let i = 0; i < e.tur.length; i++) {
    const t = e.tur[i], base = t.userData.base || 0;
    if (t.userData.dead) continue;
    let want = tp ? Math.atan2(tp.x - e.p.x, tp.z - e.p.z) - e.h : base;
    let ok = !!tp;
    if (e.dom === 'sea' && e.cls !== 'pt' && e.cls !== 'sub') { if (Math.abs(angDiff(want, base)) > 2.55) { want = base; ok = false; } }
    if (e.cls === 'battery') { const d = angDiff(want, 0); if (Math.abs(d) > 1.1) { want = Math.sign(d) * 1.1; ok = false; } }
    if (e.m.tur === 'casemate' || e.cls === 'atgun') { const lim = e.cls === 'atgun' ? 0.55 : 0.2; const d = angDiff(want, 0); if (Math.abs(d) > lim) { want = Math.sign(d) * lim; ok = false; } }
    const diff = angDiff(want, e.tYaw[i]);
    e.tYaw[i] += clamp(diff, -rate * dt, rate * dt);
    t.rotation.y = e.tYaw[i];
    if (ok && Math.abs(diff) < 0.05) ready++;
  }
  return ready;
}
function fireNaval(e, t) {
  const s = e.s.main; if (!s || e.cd.main > 0 || !t) return false;
  const am = pickAmmo(e, t); if (am === null) return false;
  let fired = 0;
  const d0 = dist2(e.p, t.p), tt = d0 / s.hs;
  const aimP = t.p.clone().addScaledVector(t.vel, tt);
  for (let i = 0; i < e.tur.length; i++) {
    const tr = e.tur[i], base = tr.userData.base || 0;
    if (tr.userData.dead) continue;
    const want = Math.atan2(aimP.x - e.p.x, aimP.z - e.p.z) - e.h;
    if (Math.abs(angDiff(want, base)) > 2.55 || Math.abs(angDiff(want, e.tYaw[i])) > 0.08) continue;
    const from = turretWorld(e, i); from.y += 1.2;
    for (let b = 0; b < (s.n || 1); b++) {
      const d = dist2(from, aimP), err = (d * (e === G.player ? 0.02 : 0.03) + 4) * (G.env ? G.env.errK * (e.dom === 'sea' ? 1 + 0.3 * G.env.seaState : 1) : 1) * (e.accK || 1) * (e.side === 'E' ? diff().err : 1);
      const tp = aimP.clone().add(V3(rnd(-1, 1) * err, 0, rnd(-1, 1) * err * 1.6));
      const dx = tp.x - from.x, dz = tp.z - from.z, dd = Math.hypot(dx, dz), T = dd / s.hs;
      const ty = t.dom === 'sea' ? 1.5 : t.p.y + 1.5, vy = (ty - from.y + 0.5 * GRAV * T * T) / T;
      proj('naval', e, from, V3(dx / dd * s.hs, vy, dz / dd * s.hs), { grav: GRAV, dmg: s.dmg, life: T + 1.5, ammo: am === 'x' ? 'he' : am });
    }
    FX.muzzle(from, fwdOf(e).clone().applyAxisAngle(V3(0, 1, 0), e.tYaw[i]), e.cls === 'battleship' ? 2.6 : e.cls === 'cruiser' ? 1.6 : 1);
    fired++;
  }
  if (fired) { e.cd.main = s.rof * rnd(0.92, 1.08); FX.sfx(e.cls === 'cruiser' || e.cls === 'battleship' || e.cls === 'battery' ? 'big' : 'cannon', e.p, e.cls === 'battleship' ? 1.6 : 1); if (am !== 'x') e.ammo[am]--; }
  return fired > 0;
}
function fireTank(e, t) {
  const s = e.s.gun; if (e.cd.main > 0 || !t) return false;
  const am = pickAmmo(e, t); if (am === null) return false;
  const from = e.mesh.userData.muzzle.getWorldPosition(V3());
  const tp = t.p.clone().add(V3(0, 1.4, 0));
  const d = from.distanceTo(tp), sp = 520;
  tp.addScaledVector(t.vel, d / sp);
  const moving = Math.abs(e.speed) / e.s.max;
  const err = ((e === G.player ? 0.004 : 0.008) + moving * 0.018 + d / 60000) * (G.env ? G.env.errK : 1) * (e.accK || 1) * (e.side === 'E' ? diff().err : 1);
  const dir = tp.sub(from).normalize().add(V3(rnd(-err, err), rnd(-err, err) * 0.4, rnd(-err, err))).normalize();
  proj('ap', e, from, dir.multiplyScalar(sp), { dmg: s.dmg, life: s.range / sp * 1.15, ammo: am });
  if (am !== 'x') e.ammo[am]--;
  FX.muzzle(from, dir.clone().normalize(), 1.1); FX.dust(V3(from.x, e.p.y, from.z));
  e.cd.main = s.rof * rnd(0.95, 1.05) * (e.mods.turret ? 1.4 : 1);
  FX.sfx('cannon', e.p, 0.9);
  return true;
}
function fireGuns(e, dir, aa = false) {
  const s = e.s.guns || e.s.mg; if (e.cd.mg > 0) return;
  if (e.ammo.guns !== undefined) { if (e.ammo.guns < 1) return; e.ammo.guns--; }
  const f = fwdOf(e).clone(), right = V3(Math.cos(e.h), 0, -Math.sin(e.h));
  const n = e.dom === 'air' ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const off = e.dom === 'air' ? (k ? 2.6 : -2.6) : 0;
    const from = e.p.clone().addScaledVector(right, off).addScaledVector(f, e.dom === 'air' ? 4 : 2); if (e.dom !== 'air') from.y += 2;
    const d = dir.clone().add(V3(rnd(-0.012, 0.012), rnd(-0.008, 0.008), rnd(-0.012, 0.012))).normalize().multiplyScalar(700);
    if (e.dom === 'air') d.add(e.vel);
    proj('bullet', e, from, d, { dmg: s.dmg, life: s.range / 700, surface: true });
  }
  e.cd.mg = s.rof; FX.sfx('gun', e.p, 0.5);
}
function fireAA(e) {
  const s = e.s.aa; if (!s || e.cd.aa > 0) return;
  const t = pickTarget(e, isPlane, s.range); if (!t) return;
  const from = e.p.clone(); from.y += 4;
  if ((e.cls === 'cruiser' || e.cls === 'battleship' || e.cls === 'carrier') && Math.random() < 0.4) {
    const tp = lead(from, t, 360); const dir = tp.sub(from).normalize();
    proj('flak', e, from, dir.multiplyScalar(360), { dmg: 10, life: from.distanceTo(t.p) / 360 + rnd(-0.1, 0.15) });
  } else {
    const dir = lead(from, t, 700).sub(from).normalize().add(V3(rnd(-0.03, 0.03), rnd(-0.03, 0.03), rnd(-0.03, 0.03)));
    proj('bullet', e, from, dir.normalize().multiplyScalar(700), { dmg: s.dmg, life: s.range / 700 });
  }
  e.cd.aa = s.rof * rnd(0.8, 1.3); FX.sfx('gun', from, 0.3);
}
function fireFlak(e) {
  const s = e.s.flak; if (e.cd.main > 0) return;
  const t = e.target; if (!t) return;
  const from = e.p.clone(); from.y += 3;
  const sp = 380, tp = lead(from, t, sp), dir = tp.sub(from).normalize();
  proj('flak', e, from, dir.multiplyScalar(sp), { dmg: s.dmg, life: from.distanceTo(t.p) / sp + rnd(-0.15, 0.2) });
  FX.muzzle(from, dir.clone().normalize(), 0.8);
  e.cd.main = s.rof * rnd(0.8, 1.2); FX.sfx('flak', e.p, 0.5);
}
function torpLead(e, t, sp = 55) {
  let tp = t.p.clone();
  for (let k = 0; k < 3; k++) { const d = dist2(e.p, tp); tp = t.p.clone().addScaledVector(t.vel, d / sp); }
  return Math.atan2(tp.x - e.p.x, tp.z - e.p.z);
}
export function fireTorps(e, ang) {
  const s = e.s.torp; if (!s || e.cd.torp > 0) return false;
  if (e.ammo.torp !== undefined) { if (e.ammo.torp < 1) return false; e.ammo.torp--; }
  const n = s.n, spread = e.cls === 'sub' ? 0.06 : 0.08;
  for (let k = 0; k < n; k++) {
    const a = ang + (k - (n - 1) / 2) * spread, d = V3(Math.sin(a), 0, Math.cos(a));
    const from = e.p.clone().addScaledVector(d, e.cls === 'sub' ? e.hl + 2 : 6).setY(-0.5);
    proj('torp', e, from, d.multiplyScalar(55), { dmg: s.dmg, life: 17 });
  }
  e.cd.torp = s.cd; FX.sfx('torp', e.p, 0.6);
  if (e.cls === 'sub') e.detected = Math.max(e.detected, 3);
  return true;
}
function dropDC(e) {
  if (e.cd.dc > 0) return;
  if (e.ammo.dc !== undefined) { if (e.ammo.dc < 1) return; e.ammo.dc--; }
  const back = fwdOf(e).clone().multiplyScalar(-(e.hl + 2));
  for (const sx of [-2.5, 0, 2.5]) { const from = e.p.clone().add(back).add(V3(Math.cos(e.h) * sx, 1, -Math.sin(e.h) * sx)); proj('dc', e, from, V3(0, -2, 0), { grav: 3, life: 3 }); }
  e.cd.dc = 4.5;
}
function dropBomb(e) {
  const b = e.s.bomb; if (!b || e.cd.bomb > 0) return false;
  if (e.ammo.bomb !== undefined) { if (e.ammo.bomb < 1) return false; e.ammo.bomb--; }
  const sp = Math.max(0, e.p.y - G.map.gy(e.p.x, e.p.z)) * 0.025; // más altura, más dispersión
  proj('bomb', e, e.p.clone().add(V3(0, -2, 0)), e.vel.clone().add(V3(rnd(-sp, sp), 0, rnd(-sp, sp))), { grav: GRAV, dmg: b.dmg, rad: b.rad, life: 20 });
  e.cd.bomb = b.cd; FX.sfx('bomb', e.p, 0.6);
  return true;
}
// bombarderos pesados: suelta una ráfaga de bombas en línea (stick)
function startStick(e) { if (!e.s.heavy || e.stick > 0 || e.ammo.bomb < 1 || e.cd.bomb > 0) return false; e.stick = Math.min(e.s.bomb.stick || 6, Math.floor(e.ammo.bomb)); return true; }
function stickStep(e) { if (e.stick > 0 && e.cd.bomb <= 0) { if (dropBomb(e)) e.stick--; else e.stick = 0; if (e.stick <= 0) e.cd.bomb = 3; else e.cd.bomb = e.s.bomb.cd; } }
function fallTime(e, ground) { const h = Math.max(3, e.p.y - 2 - ground), vy = e.vel.y; return (vy + Math.sqrt(vy * vy + 2 * GRAV * h)) / GRAV; }
export function bombImpact(e) { const ground = G.map.gy(e.p.x, e.p.z), T = fallTime(e, ground); return V3(e.p.x + e.vel.x * T, ground, e.p.z + e.vel.z * T); }
function rearGunner(e) {
  if (e.s.heavy) { // artilleros: cubren todo el horizonte, cada uno con su propio blanco
    const n = e.s.heavy.n;
    for (let i = 0; i < n; i++) {
      const k = 'gun' + i; if (e.cd[k] > 0) continue;
      const t = pickTarget(e, o => isPlane(o) && (i === 0 || Math.random() < 0.6), 300); if (!t) { e.cd[k] = 0.3; continue; }
      if (e.ammo.guns !== undefined) { if (e.ammo.guns < 1) return; e.ammo.guns--; }
      const from = e.p.clone().add(V3(rnd(-4, 4), (i % 2 ? -2 : 2), rnd(-6, 6)));
      const dir = lead(from, t, 700).sub(from).normalize().add(V3(rnd(-0.05, 0.05), rnd(-0.04, 0.04), rnd(-0.05, 0.05)));
      proj('bullet', e, from, dir.normalize().multiplyScalar(700).add(e.vel), { dmg: e.s.guns.dmg, life: 0.45 });
      e.cd[k] = 0.16 + Math.random() * 0.05;
    }
    return;
  }
  if (!e.s.rear || e.cd.rear > 0) return;
  const t = pickTarget(e, isPlane, 220); if (!t) return;
  const to = t.p.clone().sub(e.p); if (to.dot(fwdOf(e)) > 0) return;
  const dir = lead(e.p, t, 700).sub(e.p).normalize().add(V3(rnd(-0.04, 0.04), rnd(-0.03, 0.03), rnd(-0.04, 0.04)));
  proj('bullet', e, e.p.clone(), dir.normalize().multiplyScalar(700).add(e.vel), { dmg: 1, life: 0.35 });
  e.cd.rear = 0.16;
}
function fireCoax(e) {
  if (e.cd.coax > 0) return;
  const t = pickTarget(e, o => o.cls === 'inf' || o.cls === 'atgun', 230); if (!t) return;
  const from = e.p.clone(); from.y += e.top * 0.7;
  const dir = t.p.clone().add(V3(rnd(-2, 2), 1, rnd(-2, 2))).sub(from).normalize();
  proj('bullet', e, from, dir.multiplyScalar(650), { dmg: 1.8, life: 0.42, surface: true });
  e.cd.coax = 0.13; FX.sfx('gun', from, 0.25);
}
function fireRifles(e, t) {
  if (e.cd.mg > 0 || !t) return;
  const sol = e.mesh.userData.soldiers.filter(s => s.visible); if (!sol.length) return;
  const s = sol[(Math.random() * sol.length) | 0], from = s.getWorldPosition(V3()); from.y += 2.2;
  const dir = t.p.clone().add(V3(rnd(-2, 2), 1.2, rnd(-2, 2))).sub(from).normalize();
  proj('bullet', e, from, dir.multiplyScalar(600), { dmg: e.s.rifle.dmg, life: e.s.rifle.range / 600, surface: true });
  e.cd.mg = e.s.rifle.rof * (6 / sol.length) * rnd(0.7, 1.3); FX.sfx('gun', from, 0.2);
}
function fireRocket(e, t) {
  if (e.cd.rocket > 0 || !t || e.ammo.rocket < 1) return false;
  const from = e.p.clone(); from.y += 2.4;
  const tp = t.p.clone().add(V3(0, 1.2, 0)); const sp = 150; tp.addScaledVector(t.vel, from.distanceTo(tp) / sp);
  const dir = tp.sub(from).normalize().add(V3(rnd(-0.03, 0.03), rnd(-0.01, 0.01), rnd(-0.03, 0.03))).normalize();
  proj('ap', e, from, dir.multiplyScalar(sp), { dmg: e.s.rocket.dmg, life: e.s.rocket.range / sp * 1.2, ammo: 'rocket', trail: true });
  e.ammo.rocket--; e.cd.rocket = e.s.rocket.rof; FX.muzzle(from, dir.clone().normalize().negate(), 0.8); FX.sfx('cannon', from, 0.5);
  return true;
}
function smokeScreen(e) {
  if (e.cd.smoke > 0) return false;
  const f = fwdOf(e); G.smokes.push({ x: e.p.x + f.x * 14, z: e.p.z + f.z * 14, r: 34, t: 15 });
  e.cd.smoke = 28; return true;
}

// ---------- movimiento ----------
function okSurface(e, x, z) {
  const b = G.map.bounds;
  if (Math.abs(x) > b || Math.abs(z) > b) return false;
  if (e.dom === 'land') return G.map.h(x, z) > 0.6;
  return e.submerged ? G.map.h(x, z) < -7 : G.map.h(x, z) < -2.2;
}
function driveShip(e, thr, steer, dt) {
  const s = e.s, mx = (e.submerged ? s.max * 0.6 : s.max) * (e.mods.engine ? 0.5 : 1);
  if (thr) e.speed += thr * s.acc * dt; else e.speed -= Math.sign(e.speed) * Math.min(Math.abs(e.speed), s.acc * 0.15 * dt);
  e.speed = clamp(e.speed, -mx * 0.35, mx);
  const tf = clamp(Math.abs(e.speed) / (s.max * 0.45), 0.15, 1);
  e.h += steer * s.turn * tf * dt * Math.sign(e.speed || 1) * (e.mods.rudder ? 0.35 : 1);
  const f = fwdOf(e), nx = e.p.x + f.x * e.speed * dt, nz = e.p.z + f.z * e.speed * dt;
  const pr = (e.hl + 4) * Math.sign(e.speed || 1);
  if (okSurface(e, nx, nz) && okSurface(e, nx + f.x * pr, nz + f.z * pr)) { e.p.x = nx; e.p.z = nz; e.blocked = Math.max(0, e.blocked - dt); }
  else { e.speed *= Math.pow(0.2, dt); e.blocked += dt; if (!okSurface(e, e.p.x, e.p.z)) { e.p.x -= f.x * 2; e.p.z -= f.z * 2; } }
  const t = G.time;
  // estado de la mar: los barcos pequeños cabecean y balancean mucho más que los grandes
  const ss = G.env ? G.env.seaState : 0.6, sz = clamp(60 / (s.len || 60), 0.5, 2.5), sea = e.submerged ? 0 : ss;
  const ty = e.submerged ? -3.8 : Math.sin(t * 0.9 + e.id) * (0.18 + 0.35 * sea * sz) + (e.sinkY || 0);
  e.p.y += (ty - e.p.y) * Math.min(1, dt * (e.submerged ? 0.8 : 3));
  e.mesh.rotation.y = e.h;
  e.mesh.rotation.z = steer * 0.06 * Math.min(1, Math.abs(e.speed) / s.max) + Math.sin(t * 0.7 + e.id) * 0.012 + Math.sin(t * (0.8 + 0.3 * sz) + e.id) * 0.03 * sea * sz + (e.listA || 0);
  e.mesh.rotation.x = Math.sin(t * 0.55 + e.id * 2) * 0.008 - (e.speed / s.max) * 0.01 + Math.sin(t * (1.0 + 0.35 * sz) + e.id * 2) * 0.016 * sea * sz + (e.trimA || 0);
  // estela
  if (Math.abs(e.speed) > 3 && e.p.y > -2) {
    const back = V3(-f.x, 0, -f.z), side = V3(Math.cos(e.h), 0, -Math.sin(e.h));
    if (Math.random() < 0.8) FX.wake(e.p.clone().addScaledVector(back, e.hl * 0.85), back, side, Math.abs(e.speed), e.hw);
    if (Math.random() < 0.5) FX.bowWave(e.p.clone().addScaledVector(f, e.hl * 0.95), side, Math.abs(e.speed));
    if (sea > 1 && Math.abs(e.speed) > 6 && Math.random() < dt * 2.5 * sea) FX.splash(e.p.clone().addScaledVector(f, e.hl * 0.9).setY(1), 0.35 * sea * Math.min(1.6, sz)); // rociones de proa
  } else if (e.submerged && Math.abs(e.speed) > 3 && Math.random() < 0.4) FX.bubbles(e.p.clone().addScaledVector(f, -e.hl));
}
function driveTank(e, thr, steer, dt) {
  const s = e.s, map = G.map;
  if (e.mods.tracks > 0) { thr = 0; steer = 0; }
  const slope = (map.h(e.p.x + Math.sin(e.h) * 4, e.p.z + Math.cos(e.h) * 4) - map.h(e.p.x, e.p.z)) / 4;
  const mx = s.max * clamp(1 - slope * 2.2, 0.45, 1.15) * (e.mods.engine ? 0.5 : 1);
  if (thr) e.speed += thr * s.acc * dt; else e.speed -= Math.sign(e.speed) * Math.min(Math.abs(e.speed), s.acc * 1.6 * dt);
  e.speed = clamp(e.speed, -mx * 0.45, mx);
  e.h += steer * s.turn * dt;
  const f = fwdOf(e), nx = e.p.x + f.x * e.speed * dt, nz = e.p.z + f.z * e.speed * dt;
  const pr = (e.hl + 1) * Math.sign(e.speed || 1);
  let clear = okSurface(e, nx, nz) && okSurface(e, nx + f.x * pr, nz + f.z * pr);
  if (clear) for (const o of G.ents) if (o !== e && o.dom !== 'air' && (o.alive || o.dom === 'land') && Math.abs(o.p.x - nx) < 12 && Math.abs(o.p.z - nz) < 12 && Math.hypot(o.p.x - nx, o.p.z - nz) < o.hw + e.hw && Math.hypot(o.p.x - nx, o.p.z - nz) < Math.hypot(o.p.x - e.p.x, o.p.z - e.p.z)) { if (o.alive && landImpact(e, o, damage)) continue; clear = false; break; }
  if (clear) { e.p.x = nx; e.p.z = nz; e.blocked = Math.max(0, e.blocked - dt); } else { e.speed *= 0.3; e.blocked += dt; }
  const fx = f.x * e.hl * 0.8, fz = f.z * e.hl * 0.8;
  const yf = map.gy(e.p.x + fx, e.p.z + fz), yb = map.gy(e.p.x - fx, e.p.z - fz), yl = map.gy(e.p.x + fz * 0.5, e.p.z - fx * 0.5), yr = map.gy(e.p.x - fz * 0.5, e.p.z + fx * 0.5);
  e.p.y = Math.max((yf + yb) / 2, map.gy(e.p.x, e.p.z) - 0.2);
  e.mesh.rotation.y = e.h;
  if (e.cls === 'inf') { // soldados: de pie, con paso
    const mv = Math.abs(e.speed) > 0.8; e.mesh.userData.soldiers.forEach((so, i) => { so.position.y = mv ? Math.abs(Math.sin(G.time * 9 + i)) * 0.35 : 0; so.rotation.x = mv ? 0.15 : 0; });
    return;
  }
  e.mesh.rotation.x = -Math.atan2(yf - yb, e.hl * 1.6) + (e.thr ? -e.thr * 0.01 : 0);
  e.mesh.rotation.z = Math.atan2(yl - yr, e.hl * 0.8);
  if (Math.abs(e.speed) > 1) trackMark(e);
  if (Math.abs(e.speed) > 4 && Math.random() < (G.map.isDesert(e.p.x, e.p.z) ? 0.7 : 0.25)) FX.dust(e.p.clone().addScaledVector(f, -e.hl), G.map.isDesert(e.p.x, e.p.z) ? null : new THREE.Color(0x8d8166));
}
function flyPlane(e, thr, steer, dt) {
  const s = e.s, eng = e.mods.engine ? 0.72 : 1, ctl = e.mods.controls ? 0.6 : 1;
  const ground = G.map.gy(e.p.x, e.p.z);
  if (e.mods.engine) e.alt -= 2.5 * dt;
  e.alt = clamp(e.alt, ground + (e === G.player ? 8 : 28), 330);
  // altitud: velocidad vertical limitada; picar gana velocidad, subir la pierde
  const vyT = clamp((e.alt - e.p.y) * 0.9, -48, 26 * eng);
  e.vy += (vyT - e.vy) * Math.min(1, dt * 2.5);
  e.p.y += e.vy * dt;
  const cruise = s.max * 0.82 * eng;
  e.speed = clamp(e.speed + (thr * s.acc * 0.6 + (cruise - e.speed) * 0.35 - e.vy * 0.45) * dt, s.min * 0.9, s.max * 1.2 * eng);
  const tf = 0.75 + 0.35 * clamp((s.max - e.speed) / (s.max - s.min), 0, 1);
  e.h += steer * s.turn * tf * ctl * dt;
  e.bank += (steer * 0.85 - e.bank) * Math.min(1, dt * 4);
  const f = fwdOf(e);
  e.p.x += f.x * e.speed * dt; e.p.z += f.z * e.speed * dt;
  const b = G.map.bounds + 150;
  if (!e.leaving && (Math.abs(e.p.x) > b || Math.abs(e.p.z) > b)) { const back = Math.atan2(-e.p.x, -e.p.z); e.h += clamp(angDiff(back, e.h), -s.turn * dt * 1.2, s.turn * dt * 1.2); e.bank = 0.8 * Math.sign(angDiff(back, e.h)); }
  e.mesh.rotation.y = e.h; e.mesh.rotation.z = -e.bank; e.mesh.rotation.x = -Math.atan2(e.vy, e.speed);
  if (e.mesh.userData.props) for (const pr of e.mesh.userData.props) pr.rotation.z += dt * 50;
  // estelas de condensación por encima de 180 m (desde los motores exteriores o las puntas de ala)
  if (e.p.y - ground > 180 && !e.falling) {
    e.ctT = (e.ctT || 0) - dt;
    if (e.ctT <= 0) {
      e.ctT = 0.022;
      const span = e.m.span * 1.6, off = (e.m.engines > 1 ? 0.36 : 0.46) * span, rx = Math.cos(e.h), rz = -Math.sin(e.h);
      const k = clamp((e.p.y - ground - 180) / 40, 0.3, 1) * (e.s.heavy ? 1.4 : 1);
      for (const sgn of [-1, 1]) FX.contrail(V3(e.p.x + rx * off * sgn - f.x * 6, e.p.y, e.p.z + rz * off * sgn - f.z * 6), k);
    }
  }
  // choque contra el suelo o el agua
  if (e.p.y < G.map.gy(e.p.x, e.p.z) + 2.5) { kill(e, null); e.falling = 0.05; if (e === G.player && G.onMsg) G.onMsg('¡Te has estrellado!', 'Vigila la altitud al picar'); }
}

// ---------- control del jugador ----------
export function controlPlayer(e, dt) {
  const thr = K('ArrowUp') ? 1 : K('ArrowDown') ? -1 : 0;
  const steer = K('ArrowLeft') ? 1 : K('ArrowRight') ? -1 : 0;
  const f1 = K('Space') || K('ControlRight'), f2 = K('ShiftLeft') || K('ShiftRight'), once = c => G.keysOnce.has(c);
  e.thr = thr; e.steer = steer;
  if (once('KeyJ') && G.env && G.env.dark) {
    if (e.flares === undefined) e.flares = 4;
    if (e.flares > 0) { const t = e.lock && e.lock.alive ? e.lock.p : e.p.clone().add(fwdOf(e).clone().multiplyScalar(e.dom === 'air' ? 250 : 380)); launchFlare(e, t); e.flares--; G.onMsg && G.onMsg('Bengala lanzada', `Ilumina la zona unos 25 s · quedan ${e.flares}`); }
    else G.onMsg && G.onMsg('Sin bengalas', '');
  }
  if (once('KeyK')) { if (startRepair(e)) G.onMsg && G.onMsg('Control de daños', 'Fuego extinguido; reparando averías…'); else if (G.onMsg) G.onMsg(e.cd.rep > 0 ? `Control de daños en ${Math.ceil(e.cd.rep)} s` : 'Sin averías que reparar', ''); }
  if (once('KeyN') && e.ammo.ap !== undefined) { e.ammoManual = true; e.ammoSel = e.ammoSel === 'ap' ? 'he' : 'ap'; G.onMsg && G.onMsg(e.ammoSel === 'ap' ? 'Munición perforante (AP)' : 'Munición explosiva (HE)', e.ammoSel === 'ap' ? 'Contra blindados y barcos' : 'Contra infantería, cañones, defensas y costa'); }
  if (e.dom === 'air') {
    // ↑ picar (bajar y ganar velocidad) · ↓ subir
    if (thr > 0) e.alt -= 70 * dt; else if (thr < 0) e.alt += 45 * dt;
    flyPlane(e, 0, steer, dt);
    if (f1) {
      const f = fwdOf(e).clone(); f.y = e.vy / Math.max(1, e.speed); f.normalize(); let dir = f;
      const t = pickTarget(e, isPlane, e.s.guns.range * 1.1);
      if (t) { const ld = lead(e.p, t, 700); if (Math.abs(angDiff(angTo(e, ld), e.h)) < 0.18 && Math.abs(t.p.y - e.p.y) < 60) dir = ld.sub(e.p).normalize(); }
      fireGuns(e, dir);
    }
    if (f2) { if (e.s.heavy) startStick(e); else dropBomb(e); }
    stickStep(e);
    rearGunner(e);
    e.target = null;
    return;
  }
  if (e.dom === 'sea') {
    driveShip(e, thr, steer, dt);
    if (e.cls === 'carrier') { fireAA(e); if (f2) launchPlane(e); e.target = null; return; }
    if (once('KeyC')) { if (e.cls === 'sub') toggleDive(e); else if (e.s.dc) dropDC(e); }
    if (K('KeyC') && e.s.dc && e.cls !== 'sub') dropDC(e);
    const filt = targetFilter(e), rng = e.cls === 'sub' ? 900 : weaponRange(e);
    e.target = playerTarget(e, filt, rng);
    e.bear = e.target ? bearingCount(e, e.target.p) : 0;
    if (e.cls === 'destroyer' || e.cls === 'cruiser' || e.cls === 'battleship') { e.aimReady = aimTurrets(e, e.target?.p, dt, e.cls === 'battleship' ? 0.7 : e.cls === 'cruiser' ? 1.1 : 1.6); if (f1) fireNaval(e, e.target); fireAA(e); }
    else if (e.cls === 'pt') { aimTurrets(e, e.target?.p, dt, 3); if (f1 && e.target) fireGuns(e, lead(e.p, e.target, 700).sub(e.p).setY(-0.5).normalize()); fireAA(e); }
    else if (e.cls === 'sub') {
      aimTurrets(e, !e.submerged ? e.target?.p : null, dt, 1.2);
      if (f2 && !e.submerged && e.target && e.cd.main <= 0 && e.ammo.deck >= 1) { e.ammo.deck--; const t = e.target, from = e.p.clone().setY(2.5); const dx = t.p.x - from.x, dz = t.p.z - from.z, dd = Math.hypot(dx, dz), T = dd / 240; proj('naval', e, from, V3(dx / dd * 240, (0.5 * GRAV * T * T - 1) / T, dz / dd * 240), { grav: GRAV, dmg: e.s.deck.dmg, life: T + 1 }); e.cd.main = e.s.deck.rof; FX.muzzle(from, fwdOf(e), 0.7); FX.sfx('cannon', e.p, 0.6); }
    }
    if (f2 && e.cls !== 'sub' && e.s.torp) fireTorps(e, e.target && e.target.dom === 'sea' && e.cls !== 'pt' ? torpLead(e, e.target) : e.h);
    if (f1 && e.cls === 'sub') fireTorps(e, e.h);
    return;
  }
  if (e.cls === 'inf') {
    driveTank(e, thr, steer, dt);
    e.target = playerTarget(e, targetFilter(e), e.s.rifle.range);
    e.aimReady = e.target ? 1 : 0;
    if (f1 && e.target) fireRifles(e, e.target);
    if (f2) { const rt = e.target && e.target.cls === 'tank' && e.target.p.distanceTo(e.p) < e.s.rocket.range ? e.target : pickTarget(e, o => o.cls === 'tank' || o.cls === 'atgun', e.s.rocket.range); if (rt) fireRocket(e, rt); }
    return;
  }
  if (e.dom === 'land') {
    driveTank(e, thr, steer, dt);
    if (e.cls === 'tank') fireCoax(e);
    e.target = playerTarget(e, targetFilter(e), e.s.gun.range * 1.05);
    const ready = e.aimReady = aimTurrets(e, e.target?.p, dt, 1.6 * e.s.tsp * (e.mods.turret ? 0.3 : 1));
    if (f1 && ready) fireTank(e, e.target);
    if (f2 && smokeScreen(e)) G.onMsg && G.onMsg('Cortina de humo', '');
  }
}
export function toggleDive(e) {
  if (e.submerged) { e.submerged = false; G.onMsg && e === G.player && G.onMsg('Emersión', 'Batería recargando'); }
  else if (e.battery > 0.15 && G.map.h(e.p.x, e.p.z) < -7) { e.submerged = true; G.onMsg && e === G.player && G.onMsg('Inmersión', 'Invisible para los cañones; vigila la batería'); }
}

// ---------- IA ----------
function sepSteer(e, rad) {
  let sx = 0, sz = 0;
  for (const o of G.ents) { if (o === e || !o.alive || o.dom !== e.dom) continue; const dx = e.p.x - o.p.x, dz = e.p.z - o.p.z, d = Math.hypot(dx, dz); if (d < rad && d > 0.01) { const w = (rad - d) / rad; sx += dx / d * w; sz += dz / d * w; } }
  return [sx, sz];
}
function steerTo(e, ang, gain = 2.2) { return clamp(angDiff(ang, e.h) * gain, -1, 1); }
function avoid(e, ang) {
  // barcos: apartarse de otros buques que están delante y cerca (evita choques en formación)
  if (e.dom === 'sea' && !e.submerged) {
    for (const o of G.ents) {
      if (o === e || !o.alive || o.dom !== 'sea' || o.submerged) continue;
      const dx = o.p.x - e.p.x, dz = o.p.z - e.p.z, d = Math.hypot(dx, dz), lim = (e.hl + o.hl) * 1.6 + Math.abs(e.speed) * 2;
      if (d > lim) continue;
      const rel = angDiff(Math.atan2(dx, dz), ang);
      if (Math.abs(rel) < 0.7 && (o.side === e.side || e.cls !== 'destroyer' || o.cls !== 'sub')) { ang -= Math.sign(rel || 1) * 0.8 * (1 - d / lim + 0.3); break; }
    }
  }
  // sondeo de obstáculos (agua/tierra) en abanico
  const L = e.dom === 'sea' ? 70 + Math.abs(e.speed) * 3 : 20 + Math.abs(e.speed);
  const free = a => { for (const k of [0.5, 1]) { const x = e.p.x + Math.sin(a) * L * k, z = e.p.z + Math.cos(a) * L * k; if (!okSurface(e, x, z)) return false; } return true; };
  if (free(ang)) return ang;
  for (const d of [0.4, 0.8, 1.2, 1.7, 2.3, 3.0]) { if (free(ang + d * e.ai.dir)) return ang + d * e.ai.dir; if (free(ang - d * e.ai.dir)) { e.ai.dir *= -1; return ang + d * e.ai.dir; } }
  return ang + Math.PI;
}
export function formationOffset(i, sp, kind = G.formation) {
  const row = Math.floor(i / 2) + 1, side = i % 2 ? 1 : -1;
  if (kind === 'línea') return [side * row * sp * 0.9, -sp * 0.3];
  if (kind === 'columna') return [0, -(i + 1) * sp * 0.85];
  return [side * row * sp * 0.75, -row * sp * 0.6]; // cuña
}
function formationPoint(e, leader, sp) {
  const [lx, lz] = formationOffset(e.slot || 0, sp, leader === G.player ? G.formation : 'cuña');
  const r = V3(Math.cos(leader.h), 0, -Math.sin(leader.h)), f = V3(Math.sin(leader.h), 0, Math.cos(leader.h));
  return leader.p.clone().addScaledVector(r, lx).addScaledVector(f, lz);
}
function nearestEnemy(e, filt) {
  let b = null, bd = 1e9;
  for (const o of G.ents) {
    if (!o.alive || o.side === e.side || o.falling || !filt(o)) continue;
    let p = o.p;
    if (!seen(e, o)) { const t = o['seen' + e.side]; if (t === undefined || G.time - t > 30) continue; p = o['last' + e.side]; }
    const d = dist2(p, e.p); if (d < bd) { bd = d; b = { p, alive: true }; }
  }
  return b;
}
const anchorCache = new Map();
export function clearAnchors() { anchorCache.clear(); }
function domOK(e, x, z) { const h = G.map.h(x, z); return e.dom === 'land' ? h > 1 : h < -6; }
// punto válido más cercano para el dominio de la unidad (barcos en el agua, tanques en tierra)
export function anchorFor(e, x, z) {
  if (e.dom === 'air' || e.dom === 'static' || domOK(e, x, z)) return V3(x, 0, z);
  const key = e.dom + ((x / 60) | 0) + ',' + ((z / 60) | 0);
  if (!anchorCache.has(key)) {
    let best = null; const B = G.map.bounds - 20;
    for (let r = 40; r < 1800 && !best; r += 40) for (let a = 0; a < 6.28; a += 0.18) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (Math.abs(px) < B && Math.abs(pz) < B && domOK(e, px, pz)) { best = V3(px, 0, pz); break; } }
    anchorCache.set(key, best || V3(x, 0, z));
  }
  return anchorCache.get(key).clone();
}
export function orderPoint(e) {
  const o = e.order;
  const jit = (r) => V3(Math.sin(e.id * 2.39) * r, 0, Math.cos(e.id * 2.39) * r);
  const at = (x, z, r) => { const j = jit(r), p = anchorFor(e, x + j.x, z + j.z); return p; };
  switch (o.type) {
    case 'follow': {
      const L = e.side === 'A' ? G.player : null;
      if (!L || !L.alive || L === e) return null;
      if (L.dom === e.dom) return formationPoint(e, L, e.dom === 'sea' ? 95 : e.dom === 'air' ? 45 : 32);
      return at(L.p.x, L.p.z, e.dom === 'air' ? 140 : 80);
    }
    case 'zone': {
      if (G.battle.kind === 'air') { const s = (e.side === 'A' ? G.sitesE : G.sitesA)[o.k]; return s ? s.p.clone().add(jit(60)) : null; }
      const z = G.objectives[o.k]; return z ? at(z.pos.x, z.pos.z, G.map.cfg.zoneR * 0.5) : null;
    }
    case 'defend': {
      if (G.battle.kind === 'air') { const own = (e.side === 'A' ? G.sitesA : G.sitesE).filter(s => s.alive); const s = own.sort((a, b) => dist2(a.p, e.p) - dist2(b.p, e.p))[0]; return s ? s.p.clone().add(jit(150)) : null; }
      const z = G.objectives.filter(z => z.owner === e.side && (!z.dom || z.dom === e.dom || e.dom === 'air')).sort((a, b) => dist2(a.pos, e.p) - dist2(b.pos, e.p))[0] || G.objectives[1];
      return at(z.pos.x, z.pos.z, G.map.cfg.zoneR * 0.5);
    }
    case 'escort': { const L = G.ents.find(x => x.id === o.lead && x.alive); return L ? formationPoint(e, L, 50) : null; }
    case 'hold': return anchorFor(e, o.x, o.z);
    case 'bound': return anchorFor(e, o.x, o.z); // espera cubriendo mientras la otra mitad avanza
    case 'form': { // puesto en la formación de la flota, relativo al buque insignia y al rumbo de marcha
      const L = G.ents.find(x => x.id === o.lead && x.alive); if (!L) return null;
      const a = o.axis; return anchorFor(e, L.p.x + Math.sin(a) * o.oz + Math.cos(a) * o.ox, L.p.z + Math.cos(a) * o.oz - Math.sin(a) * o.ox);
    }
    case 'overwatch': { // a la distancia de su cañón del objetivo, por el lado propio
      const z = G.objectives[o.k]; if (!z) return null;
      const d = Math.hypot(e.p.x - z.pos.x, e.p.z - z.pos.z), r = Math.max(G.map.cfg.zoneR, Math.min(d, (e.s.gun ? e.s.gun.range : 500) * 0.8));
      return anchorFor(e, z.pos.x + (e.p.x - z.pos.x) / Math.max(1, d) * r, z.pos.z + (e.p.z - z.pos.z) / Math.max(1, d) * r);
    }
    case 'move': return anchorFor(e, o.x + (o.ox || 0), o.z + (o.oz || 0));
    case 'route': { const p = o.pts[Math.min(o.i, o.pts.length - 1)]; return anchorFor(e, p.x + (o.ox || 0), p.z + (o.oz || 0)); }
    case 'strike': return e.leaving ? V3(e.p.x + Math.sin(e.h) * 3000, 0, e.p.z + Math.cos(e.h) * 3000) : e.strike.clone();
    case 'attack': { const t = nearestEnemy(e, e.dom === 'air' ? (e.cls === 'bomber' ? o2 => o2.dom !== 'air' && !o2.submerged : isPlane) : targetFilter(e)); return t ? anchorFor(e, t.p.x, t.p.z) : null; }
  }
  return null;
}
const ARRIVE = { land: 30, sea: 90, air: 140, static: 10 };
function orderDone(e) {
  const o = e.order;
  if (o.type === 'route') return o.i >= o.pts.length;
  if (o.type === 'move') return e.goal && dist2(e.p, e.goal) < ARRIVE[e.dom];
  if (o.type === 'zone') {
    if (G.battle.kind === 'air') { const s = (e.side === 'A' ? G.sitesE : G.sitesA)[o.k]; return !s || !s.alive; }
    const z = G.objectives[o.k]; return z && z.owner === e.side && dist2(e.p, z.pos) < G.map.cfg.zoneR;
  }
  return false;
}
function think(e) {
  // rutas: avanzar al siguiente punto; colas: pasar a la siguiente orden
  if (e.order.type === 'route' && e.goal && dist2(e.p, e.goal) < ARRIVE[e.dom]) e.order.i++;
  if (e.queue && e.queue.length && orderDone(e)) { e.order = e.queue.shift(); }
  else if (e.order.type === 'route' && e.order.i >= e.order.pts.length) { const p = e.order.pts[e.order.pts.length - 1]; e.order = { type: 'hold', x: p.x + (e.order.ox || 0), z: p.z + (e.order.oz || 0) }; }
  const leash = e.order.type === 'move' ? 0 : e.order.type === 'hold' ? 0.9 : 1.6;
  e.goal = orderPoint(e);
  if (!e.goal) { if (e.order.type === 'follow') { e.order = { type: 'attack' }; e.goal = orderPoint(e); } }
  if (!e.goal) e.goal = e.p.clone();
  const r = weaponRange(e);
  const engageR = e.dom === 'air' ? (e.cls === 'bomber' ? 0 : 900) : r * (leash ? leash : 0.9);
  if (e.cls === 'bomber') {
    const tgt = e.order.type === 'zone' && G.battle.kind === 'air' ? (e.side === 'A' ? G.sitesE : G.sitesA)[e.order.k] : null;
    e.target = tgt && tgt.alive ? tgt : pickTarget(e, o => o.dom === 'static' || o.dom === 'land' || (o.dom === 'sea' && !o.submerged), e.order.type === 'attack' ? 6000 : 900);
    // si el objetivo de la orden cayó, buscar el siguiente
    if (!e.target && e.order.type === 'zone' && G.battle.kind === 'air') { e.order = { type: 'attack' }; }
  } else e.target = engageR ? pickTarget(e, targetFilter(e), engageR) : null;
  // apoyo aéreo: bombardear el punto marcado y marcharse
  if (e.support) {
    if (!e.leaving && e.ammo.bomb >= 1) e.target = { p: e.strike, vel: V3(), hw: 8, alive: true, dom: 'land', fake: true };
    else { e.leaving = true; e.target = null; }
  }
  // retirada para reparar cuando la unidad está muy dañada (solo IA)
  if (e !== G.player && G.bases && G.bases[e.side] && G.bases[e.side][e.dom] && e.dom !== 'static' && e.cls !== 'atgun' && !e.support) {
    if (e.hp < e.s.hp * 0.3) e.retreating = true; else if (e.hp > e.s.hp * 0.7) e.retreating = false;
    if (e.retreating) e.goal = G.bases[e.side][e.dom].clone();
  }
  // rearme: volver a la base cuando se acaba la munición
  if (needsRearm(e)) e.rearming = true; else if (e.rearming && ammoFrac(e) > 0.85) e.rearming = false;
  const home = e.home && G.ents.find(x => x.id === e.home && x.alive);
  if (home && (e.rearming || e.hp < e.s.hp * 0.4)) { e.goal = home.p.clone(); e.alt = home.top + 30; e.landing = home; } else e.landing = null;
  if (e.rearming && G.bases && G.bases[e.side] && G.bases[e.side][e.dom]) { e.goal = G.bases[e.side][e.dom].clone(); if (needsRearm(e) && e.cls !== 'bomber') e.target = null; if (e.cls === 'bomber' && e.ammo.bomb < 1) e.target = null; }
  // submarino: caza de submarinos con cargas de profundidad
  if (e.s.dc) {
    e.hunt = null;
    for (const o of G.ents) if (o.alive && o.side !== e.side && o.cls === 'sub' && o.submerged && dist2(o.p, e.p) < 280) { o.detected = 2.5; e.hunt = o; break; }
  }
}
export function aiUnit(e, dt) {
  if (hasCrit(e) && e.cd.rep <= 0 && Math.random() < 0.015) startRepair(e);
  if (e.passive) { // blanco de pruebas: se mueve en línea/círculo sin disparar
    if (e.dom === 'air') flyPlane(e, 0, e.passiveSteer ?? 0.35, dt);
    else if (e.dom === 'sea') driveShip(e, e.passiveMove ? 0.4 : 0, e.passiveMove ? (e.passiveSteer ?? 0.15) : 0, dt);
    else if (e.dom === 'land') driveTank(e, e.passiveMove ? 0.5 : 0, 0, dt);
    if (e.dom === 'land' && e.blocked > 0.5) { e.h += Math.PI; e.blocked = 0; }
    return;
  }
  e.ai.think -= dt; if (e.ai.think <= 0) { e.ai.think = 0.25 + rnd(0, 0.15); think(e); }
  if (e.ai.esc > 0) e.ai.esc -= dt;
  const t = e.target, goal = e.goal || e.p;
  if (e.dom === 'sea') aiShip(e, t, goal, dt);
  else if (e.dom === 'land') aiTank(e, t, goal, dt);
  else if (e.dom === 'air') aiPlane(e, t, goal, dt);
  else aiStatic(e, dt);
}
export function launchPlane(e) {
  if (!e.hangar || e.cd.launch > 0 || !e.alive) return null;
  const f = fwdOf(e), at = e.p.clone().addScaledVector(f, e.hl * 0.8);
  const p = spawnUnit(e.planeKey, e.side, at.x, at.z, e.h);
  p.p.y = e.top + 2; p.vy = 6; p.speed = p.s.max * 0.8; p.home = e.id;
  p.order = { type: 'escort', lead: e.id };
  if (e.side === 'A') { p.slot = G.ents.filter(x => x.side === 'A').length; G.selection.add(p); }
  e.hangar--; e.cd.launch = 5;
  G.onMsg && e === G.player && G.onMsg('Avión en el aire', `${p.name} · quedan ${e.hangar} en el hangar`);
  return p;
}
// aterrizaje: el avión vuelve al hangar (reparado y rearmado)
export function recoverPlane(p, c) {
  if (!p.alive || !c || !c.alive) return false;
  p.alive = false; p.gone = true; p.mesh.visible = false; c.hangar++;
  if (p === G.player) { G.player = c; G.onMsg && G.onMsg('Aterrizaje completado', 'Vuelves al mando del portaaviones'); }
  return true;
}
function aiShip(e, t, goal, dt) {
  let ang = angTo(e, goal), thr = 0.9;
  const dg = dist2(e.p, goal);
  if (e.cls === 'carrier') {
    const own = G.ents.filter(x => x.alive && x.home === e.id).length;
    if (own < 3 && e.hangar > 0) launchPlane(e);
    const foe = G.ents.find(o => o.alive && o.side !== e.side && o.dom === 'sea' && !o.submerged && o.cls !== 'carrier' && dist2(o.p, e.p) < 950);
    if (foe) { ang = angTo(e, foe.p) + Math.PI; thr = 1; } else if (dg < 150) { thr = 0.3; ang = angTo(e, goal) + Math.PI / 2; }
    ang = avoid(e, ang); driveShip(e, thr, steerTo(e, ang), dt); fireAA(e); return;
  }
  if (e.cls === 'sub') {
    if (!e.submerged && e.battery > 0.6 && (t || dg < 900)) toggleDive(e);
    if (e.submerged && e.battery < 0.12) { toggleDive(e); e.ai.esc = 8; }
  }
  if (e.hunt && e.hunt.alive) { ang = angTo(e, e.hunt.p); thr = 1; if (dist2(e.p, e.hunt.p) < 45) dropDC(e); }
  else if (t && e.ai.esc <= 0) {
    const d = dist2(e.p, t.p), at = angTo(e, t.p), r = weaponRange(e);
    if (e.cls === 'sub') {
      const la = torpLead(e, t); ang = d > 650 ? at : la; thr = d > 650 ? 1 : 0.6;
      if (d < 700 && Math.abs(angDiff(la, e.h)) < 0.07 && Math.random() < 0.08 && fireTorps(e, la)) e.ai.esc = 6;
    } else if (e.cls === 'pt') {
      ang = at; thr = 1;
      if (d < 420 && e.s.torp && e.cd.torp <= 0 && Math.random() < 0.06) { fireTorps(e, torpLead(e, t)); e.ai.esc = 5; e.ai.dir = Math.random() < 0.5 ? 1 : -1; }
    } else {
      if (d > r * 0.85) ang = at;
      else { const a1 = at + Math.PI / 2, a2 = at - Math.PI / 2; ang = Math.abs(angDiff(a1, e.h)) < Math.abs(angDiff(a2, e.h)) ? a1 : a2; if (d < r * 0.4) ang += (ang === a1 ? 0.5 : -0.5); }
      if (e.s.torp && t.dom === 'sea' && d < 650 && e.cd.torp <= 0 && Math.random() < 0.04) { const la = torpLead(e, t), rel = Math.abs(angDiff(la, e.h)); if (rel > 0.5 && rel < 2.6) fireTorps(e, la); }
    }
    // correa: no alejarse demasiado del objetivo de la orden
    if (e.order.type !== 'attack' && dg > 750) ang = angTo(e, goal);
  } else if (e.ai.esc > 0 && t) { ang = angTo(e, t.p) + Math.PI * 0.7 * e.ai.dir; thr = 1; }
  else if (dg < 120) { thr = 0.35; ang = angTo(e, goal) + Math.PI / 2; }
  const [sx, sz] = sepSteer(e, e.cls === 'pt' ? 45 : 90);
  if (sx || sz) ang = Math.atan2(Math.sin(ang) + sx * 1.5, Math.cos(ang) + sz * 1.5);
  ang = avoid(e, ang);
  driveShip(e, thr, steerTo(e, ang), dt);
  if (e.cls === 'sub') aimTurrets(e, null, dt);
  else if (e.cls === 'pt') { aimTurrets(e, t?.p, dt, 3); if (t && dist2(t.p, e.p) < e.s.mg.range) fireGuns(e, lead(e.p, t, 700).sub(e.p).setY(-0.5).normalize()); fireAA(e); }
  else { aimTurrets(e, t?.p, dt, e.cls === 'battleship' ? 0.6 : e.cls === 'cruiser' ? 1.0 : 1.4); if (t) fireNaval(e, t); fireAA(e); }
}
function aiTank(e, t, goal, dt) {
  let ang = angTo(e, goal), thr = 1;
  const dg = dist2(e.p, goal), r = e.cls === 'inf' ? e.s.rifle.range : e.s.gun.range;
  if (e.order.type === 'attack' || e.order.type === 'follow' && !G.player) {
    if (t) { const d = dist2(e.p, t.p); ang = angTo(e, t.p); thr = d > r * 0.8 ? 1 : 0; }
  } else if (dg > 35) { thr = 1; }
  else {
    thr = 0;
    if (t) { const d = dist2(e.p, t.p); if (d > r * 0.85 && dg < 160) { ang = angTo(e, t.p); thr = 0.5; } else ang = angTo(e, t.p); }
  }
  if (e.order.type === 'follow' && G.player && dg < 30) thr = 0;
  if (t && e.hp < e.s.hp * 0.35 && e.cd.smoke <= 0 && Math.random() < 0.02) smokeScreen(e);
  if (e.ai.esc > 0) { thr = -0.8; }
  const [sx, sz] = sepSteer(e, 24);
  if ((sx || sz) && thr) ang = Math.atan2(Math.sin(ang) + sx * 1.2, Math.cos(ang) + sz * 1.2);
  if (thr > 0) ang = avoid(e, ang);
  if (e.blocked > 1.5) { e.ai.esc = 1.2; e.blocked = 0; e.ai.dir *= -1; }
  // flanqueo: la mitad de los tanques busca el lateral del blanco si su frontal es más fuerte
  if (e.cls === 'tank' && t && t.cls === 'tank' && e.id % 2 && !e.retreating && e.order.type !== 'hold' && t.s.armor[0] < 0.8) {
    const d = dist2(e.p, t.p);
    if (d < r * 1.2) {
      const sx = Math.cos(t.h), sz = -Math.sin(t.h), side = ((e.p.x - t.p.x) * sx + (e.p.z - t.p.z) * sz) >= 0 ? 1 : -1;
      const fp = V3(t.p.x + sx * side * r * 0.55 - Math.sin(t.h) * r * 0.1, 0, t.p.z + sz * side * r * 0.55 - Math.cos(t.h) * r * 0.1);
      if (dist2(e.p, fp) > 40) { ang = angTo(e, fp); thr = 0.9; }
    }
  }
  if (e.cls === 'atgun') { // emplazado: solo gira para encarar al blanco
    if (dg > 40 && !t) thr = 0.6; else thr = 0;
    if (t) ang = angTo(e, t.p);
  }
  const st = e.ai.esc > 0 ? e.ai.dir : steerTo(e, ang, thr ? 2.2 : 3);
  driveTank(e, thr, st, dt);
  if (e.cls === 'inf') {
    const soft = pickTarget(e, o => o.cls === 'inf' || o.cls === 'atgun' || (o.dom === 'static' && o.cls !== 'site'), e.s.rifle.range);
    if (soft) fireRifles(e, soft);
    const tk = pickTarget(e, o => o.cls === 'tank', e.s.rocket.range); if (tk) fireRocket(e, tk);
    return;
  }
  if (e.cls === 'tank') fireCoax(e);
  const ready = aimTurrets(e, t?.p, dt, 1.3 * e.s.tsp * (e.mods.turret ? 0.3 : 1));
  if (t && ready) fireTank(e, t);
}
function aiPlane(e, t, goal, dt) {
  let ang, thr = 0.4;
  if (e.ai.evade > 0) e.ai.evade -= dt;
  else if (!e.s.heavy) { for (const o of G.ents) if (o.alive && o.side !== e.side && o.cls === 'fighter' && !o.falling) { const to = e.p.clone().sub(o.p); const d = to.length(); if (d < 160 && to.normalize().dot(V3(Math.sin(o.h), 0, Math.cos(o.h))) > 0.94 && Math.random() < 0.02) { e.ai.evade = 1.6; e.ai.dir = Math.random() < 0.5 ? 1 : -1; } } }
  if (e.ai.evade > 0) { flyPlane(e, 1, e.ai.dir, dt); rearGunner(e); return; }
  stickStep(e);
  if (e.s.heavy) {
    // formación en caja: los punteros eligen el blanco, el resto mantiene su puesto y suelta cuando suelta el guía
    const grp = G.ents.filter(o => o.alive && !o.falling && o.side === e.side && o.s.heavy && !o.support);
    const ld0 = grp[0], idx = grp.indexOf(e);
    e.alt = e.baseAlt;
    if (ld0 && idx > 0) {
      const SL = [[0, 0], [-45, -35], [45, -35], [0, -70], [-90, -70], [90, -70]][idx % 6];
      const c = Math.cos(ld0.h), s = Math.sin(ld0.h);
      const slot = V3(ld0.p.x + SL[0] * c + SL[1] * s, 0, ld0.p.z - SL[0] * s + SL[1] * c);
      e.alt = ld0.alt + (idx % 2 ? 12 : -8);
      const d = dist2(e.p, slot);
      ang = d > 30 ? angTo(e, slot) : ld0.h;
      thr = clamp(0.4 + (d - 30) / 120, 0.1, 1);
      if (ld0.stick > 0) startStick(e);
      flyPlane(e, thr, steerTo(e, ang, 2.5), dt); rearGunner(e); return;
    }
    if (t) {
      const imp = bombImpact(e), tt = fallTime(e, G.map.gy(t.p.x, t.p.z));
      const aim = t.p.clone().addScaledVector(t.vel, tt); aim.x -= e.vel.x * tt; aim.z -= e.vel.z * tt;
      // ajustar para que la ráfaga se centre en el blanco
      const half = ((e.s.bomb.stick || 6) - 1) / 2 * e.s.bomb.cd * e.speed;
      aim.x -= Math.sin(e.h) * half; aim.z -= Math.cos(e.h) * half;
      ang = e.stick > 0 ? e.h : angTo(e, aim);
      if (dist2(imp, t.p) < 20 + (t.hw || 4) && startStick(e)) { /* lanzando */ }
      flyPlane(e, 0.6, steerTo(e, ang, 2.5), dt); rearGunner(e); return;
    }
  }
  if (e.cls === 'bomber' && t) {
    const imp = bombImpact(e);
    const tt = fallTime(e, G.map.gy(t.p.x, t.p.z));
    const aim = t.p.clone().addScaledVector(t.vel, tt); aim.x -= e.vel.x * tt; aim.z -= e.vel.z * tt;
    if (e.ai.esc > 0) { ang = e.h + 0.3; e.alt = e.baseAlt; }
    else {
      ang = angTo(e, aim); const d = dist2(e.p, aim);
      e.alt = d < 450 ? G.map.gy(t.p.x, t.p.z) + 60 : e.baseAlt; // picado sobre el blanco
      if (dist2(imp, t.p) < 9 + (t.hw || 4) * 0.5 && dropBomb(e)) { e.ai.esc = 5; e.alt = e.baseAlt; }
    }
    thr = 0.6;
  } else if (t && t.alive) {
    const ld = lead(e.p, t, 700); ang = angTo(e, ld); thr = 1;
    e.alt = t.p.y + 6;
    const d = e.p.distanceTo(t.p);
    if (d < e.s.guns.range && Math.abs(angDiff(ang, e.h)) < 0.1 && Math.abs(t.p.y - e.p.y) < 30) fireGuns(e, ld.sub(e.p).normalize());
  } else {
    const dg = dist2(e.p, goal);
    ang = dg > 200 ? angTo(e, goal) : angTo(e, goal) + Math.PI / 2.2;
    thr = 0.3; e.alt = e.baseAlt;
  }
  const [sx, sz] = sepSteer(e, 28);
  if (sx || sz) ang = Math.atan2(Math.sin(ang) + sx, Math.cos(ang) + sz);
  flyPlane(e, thr, steerTo(e, ang, 2.5), dt);
  rearGunner(e);
}
function aiStatic(e, dt) {
  if (e.cls === 'aa') {
    e.ai.think2 = (e.ai.think2 || 0) - dt;
    if (e.ai.think2 <= 0) { e.target = pickTarget(e, isPlane, e.s.flak.range); e.ai.think2 = 0.4; }
    const tr = e.tur[0]; if (e.target) { const a = angTo(e, e.target.p) - e.h; tr.rotation.y += clamp(angDiff(a, tr.rotation.y), -2 * dt, 2 * dt); }
    if (e.target) fireFlak(e);
  } else if (e.cls === 'battery') {
    e.ai.think2 = (e.ai.think2 || 0) - dt;
    if (e.ai.think2 <= 0) { e.target = pickTarget(e, targetFilter(e), e.s.main.range); e.ai.think2 = 0.6; }
    aimTurrets(e, e.target?.p, dt, 0.5);
    if (e.target) fireNaval(e, e.target);
  } else if (e.mesh.userData.spin) e.mesh.userData.spin.rotation.y += dt * 0.8;
}

// ---------- bucle de unidades ----------
export function updateUnits(dt) {
  for (const e of G.ents) {
    if (!e.alive) { updateWreck(e, dt); continue; }
    updateDamageLook(e, dt);
    const rk = (e.rofK || 1) / (e.side === 'E' ? diff().rof : 1); for (const k in e.cd) e.cd[k] -= dt * rk;
    if (e.detected > 0) e.detected -= dt;
    if (e.cls === 'sub') { e.battery = clamp(e.battery + (e.submerged ? -dt / 50 : dt / 28), 0, 1); if (e.submerged && e.battery <= 0) toggleDive(e); }
    const px = e.p.x, py = e.p.y, pz = e.p.z;
    if (e === G.player && !G.demo && !G.autoPilot) controlPlayer(e, dt);
    else if (G.split && e === G.split.p2 && !G.demo) G.split.run(() => controlPlayer(e, dt));
    else aiUnit(e, dt);
    e.vel.set((e.p.x - px) / dt, (e.p.y - py) / dt, (e.p.z - pz) / dt);
    if (!e.alive) continue;
    updateMods(e, dt);
    if (!e.alive) continue;
    if (e.landing && e.landing.alive && dist2(e.p, e.landing.p) < 70) { recoverPlane(e, e.landing); continue; }
    if (e === G.player && e.dom === 'air' && G.keysOnce.has('KeyL')) { const c = G.ents.find(x => x.alive && x.cls === 'carrier' && x.side === e.side && dist2(x.p, e.p) < 120 && e.p.y - x.top < 60); if (c) recoverPlane(e, c); else G.onMsg && G.onMsg('No hay portaaviones debajo', 'Acércate a menos de 120 m y baja de 60 m'); }
    if (e.cls === 'inf') { const n = Math.ceil(e.hp / e.s.hp * 6); e.mesh.userData.soldiers.forEach((so, i) => so.visible = i < n); }
    if (e.dom !== 'static' && e.cls !== 'inf' && e.hp < e.s.hp * 0.5 && Math.random() < 0.35) FX.trailSmoke(e.p.clone().setY(e.p.y + (e.dom === 'air' ? 0 : e.top * 0.6)), e.hp < e.s.hp * 0.25, e.dom === 'sea' ? 1.6 : 1);
    if (e.dom === 'static' && e.hp < e.s.hp * 0.6 && Math.random() < 0.2) FX.fire(e.p.clone().setY(e.p.y + 3), 1.4);
  }
  collisions(dt, damage);
  for (let i = G.smokes.length - 1; i >= 0; i--) { const s = G.smokes[i]; s.t -= dt; if (Math.random() < 0.6) FX.smokeScreen(V3(s.x, G.map.gy(s.x, s.z), s.z)); if (s.t <= 0) G.smokes.splice(i, 1); }
}
// averías, incendios, reparación y reabastecimiento en base
const BASE_R = { sea: 300, land: 180, air: 340 };
function updateMods(e, dt) {
  const m = e.mods;
  if (m.fire > 0) {
    m.fire -= dt;
    if (!(e === G.player && G.godMode)) e.hp -= (e.dom === 'sea' ? 6 : e.dom === 'air' ? 7 : 5) * dt;
    if (Math.random() < 0.7) FX.fire(e.p.clone().setY(e.p.y + (e.dom === 'air' ? 0 : e.top * 0.5)), e.dom === 'sea' ? 1.3 : 0.8);
    if (e.hp <= 0) { kill(e, null); return; }
  }
  if (m.tracks > 0) { m.tracks -= dt; if (m.tracks <= 0) { m.tracks = 0; if (e === G.player && G.onMsg) G.onMsg('Orugas reparadas', ''); } }
  if (e.dom === 'air' && m.engine && Math.random() < 0.4) FX.trailSmoke(e.p, true, 0.8);
  if (e.repairing > 0) {
    e.repairing -= dt;
    if (e.repairing <= 0) { e.repairing = 0; m.engine = m.rudder = m.controls = m.turret = false; m.tracks = 0; if (e === G.player && G.onMsg) G.onMsg('Reparación completada', 'Motor, timón, mandos y orugas operativos'); }
  }
  const b = !e.support && G.bases && G.bases[e.side] && G.bases[e.side][e.dom];
  e.atBase = false;
  if (b && Math.hypot(e.p.x - b.x, e.p.z - b.z) < BASE_R[e.dom]) {
    e.atBase = true;
    for (const k in e.ammoMax) e.ammo[k] = Math.min(e.ammoMax[k], e.ammo[k] + Math.max(1, e.ammoMax[k] * 0.15) * dt);
    e.hp = Math.min(e.s.hp, e.hp + e.s.hp * 0.02 * dt);
    m.fire = 0; m.engine = m.rudder = m.controls = m.turret = false; m.tracks = 0;
    e.tur.forEach(t => { if (t.userData.dead) { t.userData.dead = false; t.rotation.x = t.rotation.z = 0; } });
    if (e.cls === 'sub') e.battery = Math.min(1, e.battery + dt * 0.2);
  }
}
function updateWreck(e, dt) {
  if (e.falling > 0) {
    e.falling -= dt; e.p.addScaledVector(e.vel, dt); e.vel.y -= 25 * dt; e.vel.multiplyScalar(1 - dt * 0.2);
    e.mesh.rotation.z += e.spin * dt; e.mesh.rotation.x += dt * 0.6;
    FX.trailSmoke(e.p, true, 1.2); if (Math.random() < 0.5) FX.fire(e.p, 0.7);
    const g = G.map.h(e.p.x, e.p.z);
    if (e.p.y <= Math.max(g, 0) + 1 || e.falling <= 0) { if (g < 0) FX.splash(e.p, 2); else FX.explosion(e.p.clone(), 1.2, { dust: true }); e.falling = 0; e.mesh.visible = false; e.gone = true; }
    return;
  }
  if (e.burn > 0) {
    e.burn -= dt;
    if (Math.random() < (e.dom === 'sea' ? 0.9 : 0.5)) FX.fire(e.p.clone().setY(e.p.y + (e.dom === 'sea' ? 2 : 2)), e.dom === 'sea' ? (e.cls === 'cruiser' ? 2.4 : 1.6) : e.cls === 'site' ? 2.5 : 1);
  }
  if (e.sink !== undefined && e.sink < 40) { e.sink += dt; e.p.y -= dt * 0.35; e.mesh.rotation.z += dt * 0.02 * (e.id % 2 ? 1 : -1); e.mesh.rotation.x += dt * 0.012; if (e.sink >= 40) { e.mesh.visible = false; e.gone = true; } }
  if (e.popTurret) { const t = e.tur[0]; t.position.addScaledVector(e.popTurret.v, dt); e.popTurret.v.y -= 30 * dt; t.rotation.x += e.popTurret.r * dt; if (t.position.y < 0) { t.position.y = 0; e.popTurret = null; } }
}

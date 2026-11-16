import * as THREE from 'three';
import { G } from './state.js';
import { MODELS, specOf, CLS } from './data.js';
import { buildModel, buildSite, buildAA } from './models.js';
import * as FX from './fx.js';
import { clamp, rnd, angDiff, V3 } from './util.js';

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
    cd: { main: rnd(0.5, 2.5), sec: 0, torp: rnd(1, 5), dc: 0, aa: rnd(0, 1), smoke: 0, rear: 0, bomb: rnd(0, 3), mg: 0 },
    tur, tYaw: tur.map(t => t.userData.base || 0), order: { type: 'follow' }, ai: { think: rnd(0, 0.4), esc: 0, dir: 1, evade: 0 },
    target: null, goal: null, submerged: false, battery: 1, detected: 0,
    hw: ud.hw || 4, hl: ud.hl || 4, top: ud.top || 4, bank: 0, thr: 0, steer: 0, blocked: 0,
  }, o);
  e.hp = e.s.hp; e.r = ud.r || e.s.r || 6;
  e.mesh.rotation.order = 'YXZ';
  return e;
}
export function spawnUnit(key, side, x, z, h) {
  const m = MODELS[key], s = specOf(key), mesh = buildModel(key);
  G.unitsGroup.add(mesh);
  const e = mkEnt({ key, m, s, cls: m.cls, dom: s.dom, side, fac: m.fac, mesh, h, name: m.name });
  e.p.set(x, 0, z);
  if (e.dom === 'air') { e.alt = s.alt + rnd(-10, 10); e.p.y = e.alt; e.speed = s.max * 0.8; }
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
  switch (e.cls) {
    case 'destroyer': case 'cruiser': case 'pt': return visibleShip;
    case 'sub': return visibleShip;
    case 'tank': return o => o.dom === 'land';
    case 'fighter': return isPlane;
    case 'bomber': return o => o.dom === 'static' || (o.dom === 'sea' && !o.submerged) || o.dom === 'land';
    case 'aa': return isPlane;
  }
  return () => false;
}
export function weaponRange(e) {
  const s = e.s;
  return s.main?.range || s.gun?.range || s.mg?.range || (e.cls === 'sub' ? 800 : 0) || s.flak?.range || s.guns?.range || 300;
}
export function pickTarget(e, filter, range, preferAim = false) {
  let best = null, bs = 1e9;
  for (const o of G.ents) {
    if (!o.alive || o.side === e.side || o.falling || !filter(o)) continue;
    const d = o.p.distanceTo(e.p); if (d > range) continue;
    if (e.dom === 'land' && smokeBlocks(e.p, o.p)) continue;
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
  if (!e.alive || dmg <= 0) return;
  if (G.tally && kind) G.tally[e.side + kind] = (G.tally[e.side + kind] || 0) + dmg;
  let mult = 1, zone = null;
  if (e.cls === 'tank' && dir) {
    const f = fwdOf(e), l = Math.hypot(dir.x, dir.z) || 1, c = -(dir.x * f.x + dir.z * f.z) / l;
    zone = c > 0.62 ? 0 : c < -0.62 ? 2 : 1; mult = e.s.armor[zone];
  }
  e.hp -= dmg * mult;
  if (by === G.player && G.onHit) G.onHit(e, zone, mult);
  if (e === G.player) { G.shake = Math.max(G.shake, 0.8 + dmg / 40); G.onHurt && G.onHurt(); }
  if (e.hp <= 0) kill(e, by);
}
export function kill(e, by) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0;
  G.tickets[e.side] = Math.max(0, G.tickets[e.side] - e.s.value);
  if (e.side === 'E') G.stats.kills++; else if (e.dom !== 'static' || e.cls === 'site') G.stats.lost++;
  G.onKill && G.onKill(e, by);
  const p = e.p.clone();
  if (e.dom === 'air') { e.falling = 4; e.spin = rnd(-1, 1) > 0 ? 3 : -3; FX.explosion(p, 1); return; }
  if (e.dom === 'sea') { FX.explosion(p.clone().setY(2), e.cls === 'cruiser' ? 2.8 : e.cls === 'pt' ? 1.2 : 2, {}); FX.splash(p, 2); e.sink = 0; e.burn = 30; }
  else { FX.explosion(p.clone().setY(p.y + 1.5), e.cls === 'site' ? 3 : 1.6, { debris: true, dust: true }); e.burn = e.cls === 'site' ? 90 : 45; if (e.cls === 'tank' && Math.random() < 0.45 && e.tur[0]) e.popTurret = { v: V3(rnd(-4, 4), rnd(14, 22), rnd(-4, 4)), r: rnd(-4, 4) }; }
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
  m.lookAt(tmp.copy(from).add(v)); G.projs.push(q); return q;
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
    let done = false;
    const ground = map.h(p.x, p.z), surf = Math.max(ground, 0);
    if (q.kind === 'torp') {
      p.y = -0.5; if (Math.random() < 0.7) FX.bubbles(p);
      if (ground > -0.8) { FX.splash(p, 1.2); FX.dirt(p, 0.8); done = true; }
      else for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom === 'sea' && !e.submerged && inBox(e, tmp.copy(p).setY(e.p.y), 1)) { damage(e, q.dmg, q.owner, q.v, 'torp'); FX.splash(p, 3.2); FX.explosion(p.clone().setY(1), 1.4); FX.sfx('torp', p); done = true; break; }
    } else if (q.kind === 'dc') {
      if (p.y < -6 || q.age > 1.6) {
        FX.splash(p.clone().setY(0), 2.6);
        for (const e of G.ents) if (e.alive && e.side !== q.side && e.cls === 'sub') { const d = dist2(e.p, p); if (d < 34) damage(e, 95 * (1 - d / 40), q.owner); }
        done = true;
      }
    } else if (q.kind === 'bomb') {
      if (p.y <= surf) {
        const w = ground < 0; if (w) FX.splash(p, 2.4); FX.explosion(V3(p.x, surf, p.z), w ? 1 : 1.8, { dust: !w, debris: !w });
        for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom !== 'air') { const d = dist2(e.p, p) - Math.min(e.hw, 25); if (d < q.rad) damage(e, q.dmg * (d < 4 ? 1 : 1 - d / q.rad * 0.6), q.owner); }
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
        if (hit) {
          damage(e, q.dmg, q.owner, q.v, q.kind);
          if (q.kind === 'naval') FX.explosion(p.clone(), q.dmg > 40 ? 1.1 : 0.8);
          else if (q.kind === 'ap') { FX.hitSpark(p); FX.explosion(p.clone(), 0.45); }
          else FX.hitSpark(p);
          done = true; break;
        }
      }
      if (!done && p.y <= surf) {
        if (q.kind === 'naval') { if (ground < 0) { FX.splash(V3(p.x, 0, p.z), q.dmg > 40 ? 1.8 : 1.2); for (const e of G.ents) if (e.alive && e.side !== q.side && e.dom === 'sea' && !e.submerged && dist2(e.p, p) < e.hl * 0.6 + 8) damage(e, q.dmg * 0.12, q.owner, null, 'near'); } else FX.dirt(V3(p.x, surf, p.z), 1.2); }
        else if (q.kind === 'ap') FX.dirt(V3(p.x, surf, p.z), 0.6);
        else if (Math.random() < 0.25) { if (ground < 0) FX.splash(V3(p.x, 0, p.z), 0.25); }
        done = true;
      }
      if (q.life <= 0) done = true;
    }
    if (q.life <= -2) done = true;
    if (done) removeProj(i);
  }
}

// ---------- armas ----------
function turretWorld(e, i) { return e.tur[i].getWorldPosition(tmp.set(0, 0, 0)).clone(); }
function aimTurrets(e, tp, dt, rate = 0.9) {
  let ready = 0;
  for (let i = 0; i < e.tur.length; i++) {
    const t = e.tur[i], base = t.userData.base || 0;
    let want = tp ? Math.atan2(tp.x - e.p.x, tp.z - e.p.z) - e.h : base;
    let ok = !!tp;
    if (e.dom === 'sea' && e.cls !== 'pt' && e.cls !== 'sub') { if (Math.abs(angDiff(want, base)) > 2.55) { want = base; ok = false; } }
    if (e.m.tur === 'casemate') { const lim = 0.2; const d = angDiff(want, 0); if (Math.abs(d) > lim) { want = Math.sign(d) * lim; ok = false; } }
    const diff = angDiff(want, e.tYaw[i]);
    e.tYaw[i] += clamp(diff, -rate * dt, rate * dt);
    t.rotation.y = e.tYaw[i];
    if (ok && Math.abs(diff) < 0.05) ready++;
  }
  return ready;
}
function fireNaval(e, t) {
  const s = e.s.main; if (!s || e.cd.main > 0 || !t) return false;
  let fired = 0;
  const d0 = dist2(e.p, t.p), tt = d0 / s.hs;
  const aimP = t.p.clone().addScaledVector(t.vel, tt);
  for (let i = 0; i < e.tur.length; i++) {
    const tr = e.tur[i], base = tr.userData.base || 0;
    const want = Math.atan2(aimP.x - e.p.x, aimP.z - e.p.z) - e.h;
    if (Math.abs(angDiff(want, base)) > 2.55 || Math.abs(angDiff(want, e.tYaw[i])) > 0.08) continue;
    const from = turretWorld(e, i); from.y += 1.2;
    for (let b = 0; b < (s.n || 1); b++) {
      const d = dist2(from, aimP), err = d * (e === G.player ? 0.02 : 0.03) + 4;
      const tp = aimP.clone().add(V3(rnd(-1, 1) * err, 0, rnd(-1, 1) * err * 1.6));
      const dx = tp.x - from.x, dz = tp.z - from.z, dd = Math.hypot(dx, dz), T = dd / s.hs;
      const vy = (1.5 - from.y + 0.5 * GRAV * T * T) / T;
      proj('naval', e, from, V3(dx / dd * s.hs, vy, dz / dd * s.hs), { grav: GRAV, dmg: s.dmg, life: T + 1.5 });
    }
    FX.muzzle(from, fwdOf(e).clone().applyAxisAngle(V3(0, 1, 0), e.tYaw[i]), e.cls === 'cruiser' ? 1.6 : 1);
    fired++;
  }
  if (fired) { e.cd.main = s.rof * rnd(0.92, 1.08); FX.sfx(e.cls === 'cruiser' ? 'big' : 'cannon', e.p, 1); }
  return fired > 0;
}
function fireTank(e, t) {
  const s = e.s.gun; if (e.cd.main > 0 || !t) return false;
  const from = e.mesh.userData.muzzle.getWorldPosition(V3());
  const tp = t.p.clone().add(V3(0, 1.4, 0));
  const d = from.distanceTo(tp), sp = 520;
  tp.addScaledVector(t.vel, d / sp);
  const moving = Math.abs(e.speed) / e.s.max;
  const err = (e === G.player ? 0.004 : 0.008) + moving * 0.018 + d / 60000;
  const dir = tp.sub(from).normalize().add(V3(rnd(-err, err), rnd(-err, err) * 0.4, rnd(-err, err))).normalize();
  proj('ap', e, from, dir.multiplyScalar(sp), { dmg: s.dmg, life: s.range / sp * 1.15 });
  FX.muzzle(from, dir.clone().normalize(), 1.1); FX.dust(V3(from.x, e.p.y, from.z));
  e.cd.main = s.rof * (e.side === 'E' ? rnd(1.0, 1.25) : 1);
  FX.sfx('cannon', e.p, 0.9);
  return true;
}
function fireGuns(e, dir, aa = false) {
  const s = e.s.guns || e.s.mg; if (e.cd.mg > 0) return;
  const f = fwdOf(e).clone(), right = V3(Math.cos(e.h), 0, -Math.sin(e.h));
  const n = e.dom === 'air' ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const off = e.dom === 'air' ? (k ? 2.6 : -2.6) : 0;
    const from = e.p.clone().addScaledVector(right, off).addScaledVector(f, e.dom === 'air' ? 4 : 2); if (e.dom !== 'air') from.y += 2;
    const d = dir.clone().add(V3(rnd(-0.012, 0.012), rnd(-0.008, 0.008), rnd(-0.012, 0.012))).normalize().multiplyScalar(700);
    if (e.dom === 'air') d.add(e.vel);
    proj('bullet', e, from, d, { dmg: s.dmg, life: s.range / 700, surface: e.dom !== 'air' });
  }
  e.cd.mg = s.rof; FX.sfx('gun', e.p, 0.5);
}
function fireAA(e) {
  const s = e.s.aa; if (!s || e.cd.aa > 0) return;
  const t = pickTarget(e, isPlane, s.range); if (!t) return;
  const from = e.p.clone(); from.y += 4;
  if (e.cls === 'cruiser' && Math.random() < 0.4) {
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
  const s = e.s.torp; if (!s || e.cd.torp > 0 || e.cls === 'sub' && !e.submerged && false) return false;
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
  const back = fwdOf(e).clone().multiplyScalar(-(e.hl + 2));
  for (const sx of [-2.5, 0, 2.5]) { const from = e.p.clone().add(back).add(V3(Math.cos(e.h) * sx, 1, -Math.sin(e.h) * sx)); proj('dc', e, from, V3(0, -2, 0), { grav: 3, life: 3 }); }
  e.cd.dc = 4.5;
}
function dropBomb(e) {
  const b = e.s.bomb; if (!b || e.cd.bomb > 0) return false;
  proj('bomb', e, e.p.clone().add(V3(0, -2, 0)), e.vel.clone(), { grav: GRAV, dmg: b.dmg, rad: b.rad, life: 12 });
  e.cd.bomb = b.cd; FX.sfx('bomb', e.p, 0.6);
  return true;
}
export function bombImpact(e) { const ground = G.map.gy(e.p.x, e.p.z), T = Math.sqrt(2 * Math.max(5, e.p.y - ground) / GRAV); return e.p.clone().addScaledVector(e.vel, T).setY(ground); }
function rearGunner(e) {
  if (!e.s.rear || e.cd.rear > 0) return;
  const t = pickTarget(e, isPlane, 220); if (!t) return;
  const to = t.p.clone().sub(e.p); if (to.dot(fwdOf(e)) > 0) return;
  const dir = lead(e.p, t, 700).sub(e.p).normalize().add(V3(rnd(-0.04, 0.04), rnd(-0.03, 0.03), rnd(-0.04, 0.04)));
  proj('bullet', e, e.p.clone(), dir.normalize().multiplyScalar(700).add(e.vel), { dmg: 1, life: 0.35 });
  e.cd.rear = 0.16;
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
  const s = e.s, mx = e.submerged ? s.max * 0.6 : s.max;
  if (thr) e.speed += thr * s.acc * dt; else e.speed -= Math.sign(e.speed) * Math.min(Math.abs(e.speed), s.acc * 0.15 * dt);
  e.speed = clamp(e.speed, -mx * 0.35, mx);
  const tf = clamp(Math.abs(e.speed) / (s.max * 0.45), 0.15, 1);
  e.h += steer * s.turn * tf * dt * Math.sign(e.speed || 1);
  const f = fwdOf(e), nx = e.p.x + f.x * e.speed * dt, nz = e.p.z + f.z * e.speed * dt;
  const pr = (e.hl + 4) * Math.sign(e.speed || 1);
  if (okSurface(e, nx, nz) && okSurface(e, nx + f.x * pr, nz + f.z * pr)) { e.p.x = nx; e.p.z = nz; e.blocked = Math.max(0, e.blocked - dt); }
  else { e.speed *= Math.pow(0.2, dt); e.blocked += dt; if (!okSurface(e, e.p.x, e.p.z)) { e.p.x -= f.x * 2; e.p.z -= f.z * 2; } }
  const t = G.time;
  const ty = e.submerged ? -3.8 : Math.sin(t * 0.9 + e.id) * 0.18;
  e.p.y += (ty - e.p.y) * Math.min(1, dt * (e.submerged ? 0.8 : 3));
  e.mesh.rotation.y = e.h;
  e.mesh.rotation.z = -steer * 0.06 * Math.min(1, Math.abs(e.speed) / s.max) + Math.sin(t * 0.7 + e.id) * 0.012;
  e.mesh.rotation.x = Math.sin(t * 0.55 + e.id * 2) * 0.008 - (e.speed / s.max) * 0.01;
  // estela
  if (Math.abs(e.speed) > 3 && e.p.y > -2) {
    const back = V3(-f.x, 0, -f.z), side = V3(Math.cos(e.h), 0, -Math.sin(e.h));
    if (Math.random() < 0.8) FX.wake(e.p.clone().addScaledVector(back, e.hl * 0.85), back, side, Math.abs(e.speed), e.hw);
    if (Math.random() < 0.5) FX.bowWave(e.p.clone().addScaledVector(f, e.hl * 0.95), side, Math.abs(e.speed));
  } else if (e.submerged && Math.abs(e.speed) > 3 && Math.random() < 0.4) FX.bubbles(e.p.clone().addScaledVector(f, -e.hl));
}
function driveTank(e, thr, steer, dt) {
  const s = e.s, map = G.map;
  const slope = (map.h(e.p.x + Math.sin(e.h) * 4, e.p.z + Math.cos(e.h) * 4) - map.h(e.p.x, e.p.z)) / 4;
  const mx = s.max * clamp(1 - slope * 2.2, 0.45, 1.15);
  if (thr) e.speed += thr * s.acc * dt; else e.speed -= Math.sign(e.speed) * Math.min(Math.abs(e.speed), s.acc * 1.6 * dt);
  e.speed = clamp(e.speed, -mx * 0.45, mx);
  e.h += steer * s.turn * dt;
  const f = fwdOf(e), nx = e.p.x + f.x * e.speed * dt, nz = e.p.z + f.z * e.speed * dt;
  const pr = (e.hl + 1) * Math.sign(e.speed || 1);
  let clear = okSurface(e, nx, nz) && okSurface(e, nx + f.x * pr, nz + f.z * pr);
  if (clear) for (const o of G.ents) if (o !== e && o.dom !== 'air' && (o.alive || o.dom === 'land') && Math.abs(o.p.x - nx) < 12 && Math.abs(o.p.z - nz) < 12 && Math.hypot(o.p.x - nx, o.p.z - nz) < o.hw + e.hw && Math.hypot(o.p.x - nx, o.p.z - nz) < Math.hypot(o.p.x - e.p.x, o.p.z - e.p.z)) { clear = false; break; }
  if (clear) { e.p.x = nx; e.p.z = nz; e.blocked = Math.max(0, e.blocked - dt); } else { e.speed *= 0.3; e.blocked += dt; }
  const fx = f.x * e.hl * 0.8, fz = f.z * e.hl * 0.8;
  const yf = map.gy(e.p.x + fx, e.p.z + fz), yb = map.gy(e.p.x - fx, e.p.z - fz), yl = map.gy(e.p.x + fz * 0.5, e.p.z - fx * 0.5), yr = map.gy(e.p.x - fz * 0.5, e.p.z + fx * 0.5);
  e.p.y = Math.max((yf + yb) / 2, map.gy(e.p.x, e.p.z) - 0.2);
  e.mesh.rotation.y = e.h;
  e.mesh.rotation.x = -Math.atan2(yf - yb, e.hl * 1.6) + (e.thr ? -e.thr * 0.01 : 0);
  e.mesh.rotation.z = -Math.atan2(yl - yr, e.hl * 0.8);
  if (Math.abs(e.speed) > 4 && Math.random() < (G.map.theme === 'desert' ? 0.7 : 0.25)) FX.dust(e.p.clone().addScaledVector(f, -e.hl), G.map.theme === 'desert' ? null : new THREE.Color(0x8d8166));
}
function flyPlane(e, thr, steer, dt) {
  const s = e.s;
  e.speed = clamp(e.speed + thr * s.acc * dt, s.min, s.max);
  const tf = 0.75 + 0.35 * (s.max - e.speed) / (s.max - s.min);
  e.h += steer * s.turn * tf * dt;
  e.bank += (steer * 0.85 - e.bank) * Math.min(1, dt * 4);
  const f = fwdOf(e);
  e.p.x += f.x * e.speed * dt; e.p.z += f.z * e.speed * dt;
  const b = G.map.bounds + 150;
  if (Math.abs(e.p.x) > b || Math.abs(e.p.z) > b) { const back = Math.atan2(-e.p.x, -e.p.z); e.h += clamp(angDiff(back, e.h), -s.turn * dt * 1.2, s.turn * dt * 1.2); e.bank = 0.8 * Math.sign(angDiff(back, e.h)); }
  const ground = G.map.gy(e.p.x, e.p.z), alt = Math.max(e.alt + (e.dive || 0), ground + 30);
  const vy = (alt - e.p.y) * Math.min(1, dt * 1.5); e.p.y += vy;
  e.mesh.rotation.y = e.h; e.mesh.rotation.z = e.bank; e.mesh.rotation.x = -vy / dt * 0.012;
  if (e.mesh.userData.prop) e.mesh.userData.prop.rotation.z += dt * 50;
}

// ---------- control del jugador ----------
export function controlPlayer(e, dt) {
  const thr = K('KeyW') || K('ArrowUp') ? 1 : K('KeyS') || K('ArrowDown') ? -1 : 0;
  const steer = K('KeyA') || K('ArrowLeft') ? 1 : K('KeyD') || K('ArrowRight') ? -1 : 0;
  const f1 = K('Space'), f2 = K('ShiftLeft') || K('ShiftRight') || K('KeyX'), once = c => G.keysOnce.has(c);
  e.thr = thr; e.steer = steer;
  if (e.dom === 'air') {
    flyPlane(e, thr, steer, dt);
    if (f1) {
      const f = fwdOf(e).clone(); let dir = f;
      const t = pickTarget(e, isPlane, e.s.guns.range * 1.1);
      if (t) { const a = lead(e.p, t, 700).sub(e.p).normalize(); if (a.dot(f) > 0.965) dir = a; }
      fireGuns(e, dir);
    }
    if (f2) dropBomb(e);
    rearGunner(e);
    e.target = null;
    return;
  }
  if (e.dom === 'sea') {
    driveShip(e, thr, steer, dt);
    if (once('KeyC')) { if (e.cls === 'sub') toggleDive(e); else if (e.s.dc) dropDC(e); }
    if (K('KeyC') && e.s.dc && e.cls !== 'sub') dropDC(e);
    const filt = visibleShip, rng = e.cls === 'sub' ? 900 : weaponRange(e) * 1.05;
    if (once('KeyT')) e.manualCycle = (e.manualCycle || 0) + 1;
    e.target = pickTarget(e, filt, rng, true);
    if (e.cls === 'destroyer' || e.cls === 'cruiser') { aimTurrets(e, e.target?.p, dt, e.cls === 'cruiser' ? 0.6 : 0.95); if (f1) fireNaval(e, e.target); fireAA(e); }
    else if (e.cls === 'pt') { aimTurrets(e, e.target?.p, dt, 3); if (f1 && e.target) fireGuns(e, lead(e.p, e.target, 700).sub(e.p).setY(-0.5).normalize()); fireAA(e); }
    else if (e.cls === 'sub') {
      aimTurrets(e, !e.submerged ? e.target?.p : null, dt, 1.2);
      if (f2 && !e.submerged && e.target && e.cd.main <= 0) { const t = e.target, from = e.p.clone().setY(2.5); const dx = t.p.x - from.x, dz = t.p.z - from.z, dd = Math.hypot(dx, dz), T = dd / 240; proj('naval', e, from, V3(dx / dd * 240, (0.5 * GRAV * T * T - 1) / T, dz / dd * 240), { grav: GRAV, dmg: e.s.deck.dmg, life: T + 1 }); e.cd.main = e.s.deck.rof; FX.muzzle(from, fwdOf(e), 0.7); FX.sfx('cannon', e.p, 0.6); }
    }
    if (f2 && e.cls !== 'sub' && e.s.torp) fireTorps(e, e.target && e.cls !== 'pt' ? torpLead(e, e.target) : e.h);
    if (f1 && e.cls === 'sub') fireTorps(e, e.h);
    return;
  }
  if (e.dom === 'land') {
    driveTank(e, thr, steer, dt);
    if (once('KeyT')) { const all = G.ents.filter(o => o.alive && o.side !== e.side && o.dom === 'land' && o.p.distanceTo(e.p) < e.s.gun.range * 1.1 && !smokeBlocks(e.p, o.p)).sort((a, b) => a.p.distanceTo(e.p) - b.p.distanceTo(e.p)); if (all.length) { const i = all.indexOf(e.target); e.lock = all[(i + 1) % all.length]; } }
    if (e.lock && (!e.lock.alive || e.lock.p.distanceTo(e.p) > e.s.gun.range * 1.15)) e.lock = null;
    e.target = e.lock || pickTarget(e, o => o.dom === 'land', e.s.gun.range * 1.05, true);
    const ready = aimTurrets(e, e.target?.p, dt, 0.9 * e.s.tsp);
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
  // sondeo de obstáculos (agua/tierra) en abanico
  const L = e.dom === 'sea' ? 70 + Math.abs(e.speed) * 3 : 20 + Math.abs(e.speed);
  const free = a => { for (const k of [0.5, 1]) { const x = e.p.x + Math.sin(a) * L * k, z = e.p.z + Math.cos(a) * L * k; if (!okSurface(e, x, z)) return false; } return true; };
  if (free(ang)) return ang;
  for (const d of [0.4, 0.8, 1.2, 1.7, 2.3, 3.0]) { if (free(ang + d * e.ai.dir)) return ang + d * e.ai.dir; if (free(ang - d * e.ai.dir)) { e.ai.dir *= -1; return ang + d * e.ai.dir; } }
  return ang + Math.PI;
}
function formationPoint(e, leader, sp) {
  const i = e.slot || 0, row = Math.floor(i / 2) + 1, side = i % 2 ? 1 : -1;
  const lx = side * row * sp * 0.75, lz = -row * sp * 0.6;
  const r = V3(Math.cos(leader.h), 0, -Math.sin(leader.h)), f = V3(Math.sin(leader.h), 0, Math.cos(leader.h));
  return leader.p.clone().addScaledVector(r, lx).addScaledVector(f, lz);
}
function nearestEnemy(e, filt) { let b = null, bd = 1e9; for (const o of G.ents) { if (!o.alive || o.side === e.side || o.falling || !filt(o)) continue; const d = dist2(o.p, e.p); if (d < bd) { bd = d; b = o; } } return b; }
export function orderPoint(e) {
  const o = e.order, mp = G.map;
  const jit = (r) => V3(Math.sin(e.id * 2.39) * r, 0, Math.cos(e.id * 2.39) * r);
  switch (o.type) {
    case 'follow': {
      const L = e.side === 'A' ? G.player : null;
      if (L && L.alive && L.dom === e.dom && L !== e) return formationPoint(e, L, e.dom === 'sea' ? 95 : e.dom === 'air' ? 45 : 32);
      return null;
    }
    case 'zone': {
      if (G.battle.kind === 'air') { const s = (e.side === 'A' ? G.sitesE : G.sitesA)[o.k]; return s ? s.p.clone().add(jit(60)) : null; }
      const z = G.objectives[o.k]; return z ? z.pos.clone().add(jit(G.map.cfg.zoneR * 0.5)) : null;
    }
    case 'defend': {
      if (G.battle.kind === 'air') { const own = (e.side === 'A' ? G.sitesA : G.sitesE).filter(s => s.alive); const s = own.sort((a, b) => dist2(a.p, e.p) - dist2(b.p, e.p))[0]; return s ? s.p.clone().add(jit(150)) : null; }
      const z = G.objectives.filter(z => z.owner === e.side).sort((a, b) => dist2(a.pos, e.p) - dist2(b.pos, e.p))[0] || G.objectives[1];
      return z.pos.clone().add(jit(G.map.cfg.zoneR * 0.5));
    }
    case 'escort': { const L = G.ents.find(x => x.id === o.lead && x.alive); return L ? formationPoint(e, L, 50) : null; }
    case 'hold': case 'move': return V3(o.x, 0, o.z);
    case 'attack': { const t = nearestEnemy(e, o2 => e.dom === 'air' ? (e.cls === 'bomber' ? o2.dom !== 'air' : o2.dom === 'air') : o2.dom === e.dom); return t ? t.p.clone() : null; }
  }
  return null;
}
function think(e) {
  const leash = e.order.type === 'move' ? 0 : e.order.type === 'hold' ? 0.9 : 1.6;
  e.goal = orderPoint(e);
  if (!e.goal) { if (e.order.type === 'follow') { e.order = { type: 'attack' }; e.goal = orderPoint(e); } }
  if (!e.goal) e.goal = e.p.clone();
  const r = weaponRange(e);
  const engageR = e.dom === 'air' ? (e.cls === 'bomber' ? 0 : 900) : r * (leash ? leash : 0.9);
  if (e.cls === 'bomber') {
    const tgt = e.order.type === 'zone' ? (e.side === 'A' ? G.sitesE : G.sitesA)[e.order.k] : null;
    e.target = tgt && tgt.alive ? tgt : pickTarget(e, o => o.dom === 'static' || o.dom === 'land' || (o.dom === 'sea' && !o.submerged), e.order.type === 'attack' ? 6000 : 900);
    // si el objetivo de la orden cayó, buscar el siguiente
    if (!e.target && e.order.type === 'zone') { e.order = { type: 'attack' }; }
  } else e.target = engageR ? pickTarget(e, targetFilter(e), engageR) : null;
  // submarino: caza de submarinos con cargas de profundidad
  if (e.s.dc) {
    e.hunt = null;
    for (const o of G.ents) if (o.alive && o.side !== e.side && o.cls === 'sub' && o.submerged && dist2(o.p, e.p) < 280) { o.detected = 2.5; e.hunt = o; break; }
  }
}
export function aiUnit(e, dt) {
  e.ai.think -= dt; if (e.ai.think <= 0) { e.ai.think = 0.25 + rnd(0, 0.15); think(e); }
  if (e.ai.esc > 0) e.ai.esc -= dt;
  const t = e.target, goal = e.goal || e.p;
  if (e.dom === 'sea') aiShip(e, t, goal, dt);
  else if (e.dom === 'land') aiTank(e, t, goal, dt);
  else if (e.dom === 'air') aiPlane(e, t, goal, dt);
  else aiStatic(e, dt);
}
function aiShip(e, t, goal, dt) {
  let ang = angTo(e, goal), thr = 0.9;
  const dg = dist2(e.p, goal);
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
      if (e.s.torp && d < 650 && e.cd.torp <= 0 && Math.random() < 0.04) { const la = torpLead(e, t), rel = Math.abs(angDiff(la, e.h)); if (rel > 0.5 && rel < 2.6) fireTorps(e, la); }
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
  else { aimTurrets(e, t?.p, dt, e.cls === 'cruiser' ? 0.6 : 0.95); if (t) fireNaval(e, t); fireAA(e); }
}
function aiTank(e, t, goal, dt) {
  let ang = angTo(e, goal), thr = 1;
  const dg = dist2(e.p, goal), r = e.s.gun.range;
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
  const st = e.ai.esc > 0 ? e.ai.dir : steerTo(e, ang, thr ? 2.2 : 3);
  driveTank(e, thr, st, dt);
  const ready = aimTurrets(e, t?.p, dt, 0.9 * e.s.tsp);
  if (t && ready) fireTank(e, t);
}
function aiPlane(e, t, goal, dt) {
  let ang, thr = 0.4;
  if (e.ai.evade > 0) e.ai.evade -= dt;
  else { for (const o of G.ents) if (o.alive && o.side !== e.side && o.cls === 'fighter' && !o.falling) { const to = e.p.clone().sub(o.p); const d = to.length(); if (d < 160 && to.normalize().dot(V3(Math.sin(o.h), 0, Math.cos(o.h))) > 0.94 && Math.random() < 0.02) { e.ai.evade = 1.6; e.ai.dir = Math.random() < 0.5 ? 1 : -1; } } }
  if (e.ai.evade > 0) { flyPlane(e, 1, e.ai.dir, dt); rearGunner(e); return; }
  if (e.cls === 'bomber' && t) {
    const imp = bombImpact(e);
    const tt = Math.sqrt(2 * Math.max(5, e.p.y - G.map.gy(t.p.x, t.p.z)) / GRAV);
    const aim = t.p.clone().addScaledVector(t.vel, tt).addScaledVector(e.vel, -tt);
    if (e.ai.esc > 0) { ang = e.h + 0.3; e.dive = 0; }
    else {
      ang = angTo(e, aim); const d = dist2(e.p, aim);
      e.dive = d < 260 ? -25 : 0;
      if (dist2(imp, t.p) < 9 + (t.hw || 4) * 0.5 && dropBomb(e)) { e.ai.esc = 5; e.dive = 0; }
    }
    thr = 0.6;
  } else if (t && t.alive) {
    const ld = lead(e.p, t, 700); ang = angTo(e, ld); thr = 1;
    const d = e.p.distanceTo(t.p);
    if (d < e.s.guns.range && Math.abs(angDiff(ang, e.h)) < 0.1) fireGuns(e, ld.sub(e.p).normalize());
  } else {
    const dg = dist2(e.p, goal);
    ang = dg > 200 ? angTo(e, goal) : angTo(e, goal) + Math.PI / 2.2;
    thr = 0.3;
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
  } else if (e.mesh.userData.spin) e.mesh.userData.spin.rotation.y += dt * 0.8;
}

// ---------- bucle de unidades ----------
export function updateUnits(dt) {
  for (const e of G.ents) {
    if (!e.alive) { updateWreck(e, dt); continue; }
    for (const k in e.cd) e.cd[k] -= dt;
    if (e.detected > 0) e.detected -= dt;
    if (e.cls === 'sub') { e.battery = clamp(e.battery + (e.submerged ? -dt / 50 : dt / 28), 0, 1); if (e.submerged && e.battery <= 0) toggleDive(e); }
    const px = e.p.x, py = e.p.y, pz = e.p.z;
    if (e === G.player && !G.demo) controlPlayer(e, dt); else aiUnit(e, dt);
    e.vel.set((e.p.x - px) / dt, (e.p.y - py) / dt, (e.p.z - pz) / dt);
    if (e.dom !== 'static' && e.hp < e.s.hp * 0.5 && Math.random() < 0.35) FX.trailSmoke(e.p.clone().setY(e.p.y + (e.dom === 'air' ? 0 : e.top * 0.6)), e.hp < e.s.hp * 0.25, e.dom === 'sea' ? 1.6 : 1);
    if (e.dom === 'static' && e.hp < e.s.hp * 0.6 && Math.random() < 0.2) FX.fire(e.p.clone().setY(e.p.y + 3), 1.4);
  }
  for (let i = G.smokes.length - 1; i >= 0; i--) { const s = G.smokes[i]; s.t -= dt; if (Math.random() < 0.6) FX.smokeScreen(V3(s.x, G.map.gy(s.x, s.z), s.z)); if (s.t <= 0) G.smokes.splice(i, 1); }
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

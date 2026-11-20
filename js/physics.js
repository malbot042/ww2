// Línea de visión (relieve y cobertura) y colisiones (barcos, aviones, vehículos)
import { G } from './state.js';
import * as FX from './fx.js';
import { V3 } from './util.js';

// ---------- LÍNEA DE VISIÓN ----------
const cache = new Map();
const surf = o => o.dom !== 'air';
const eye = o => (o.dom === 'sea' ? 0 : Math.max(o.p.y, G.map.gy(o.p.x, o.p.z))) + (o.cls === 'inf' ? 1.6 : o.cls === 'atgun' ? 1.4 : Math.max(2.5, (o.top || 4) * 0.85));
// ¿hay relieve o cobertura (setos, bosques, casas) entre a y b? Solo entre unidades de superficie
export function losBlocked(a, b) {
  if (!surf(a) || !surf(b) || !G.map) return false;
  const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z, d = Math.hypot(dx, dz);
  if (d < 80) return false; // a corta distancia siempre se ve
  const key = a.id < b.id ? a.id * 65536 + b.id : b.id * 65536 + a.id, c = cache.get(key);
  if (c && G.time - c.t < 0.5) return c.v > 0;
  const ha = eye(a), hb = b.dom === 'sea' ? 2 : Math.max(b.p.y, G.map.gy(b.p.x, b.p.z)) + Math.max(1, (b.top || 3) * 0.5);
  const n = Math.min(90, Math.ceil(d / 14)), cov = G.map.coverAt;
  let blocked = 0, acc = 0, lastCell = -1;
  for (let i = 1; i < n; i++) {
    const t = i / n, x = a.p.x + dx * t, z = a.p.z + dz * t, y = ha + (hb - ha) * t;
    if (G.map.h(x, z) > y - 0.3) { blocked = 1; break; }
    // cobertura: no cuenta la de los primeros 25 m (la del propio tirador)
    if (cov && t * d > 25 && (1 - t) * d > 6) { const k = G.map.coverCell(x, z); if (k !== lastCell) { lastCell = k; acc += cov(x, z); if (acc >= 1) { blocked = 2; break; } } }
  }
  if (cache.size > 6000) cache.clear();
  cache.set(key, { t: G.time, v: blocked });
  return blocked > 0;
}
// por qué está tapado: 'terrain' (islas, colinas), 'cover' (setos, bosques, casas) o null
export function losWhy(a, b) {
  if (!losBlocked(a, b)) return null;
  const key = a.id < b.id ? a.id * 65536 + b.id : b.id * 65536 + a.id, c = cache.get(key);
  return c && c.v === 2 ? 'cover' : 'terrain';
}
// cobertura en la posición de una unidad de tierra (0 = al descubierto, 1 = muy cubierta)
export const coverOf = o => (o.dom === 'land' || o.dom === 'static') && G.map && G.map.coverAt ? Math.min(1, G.map.coverAt(o.p.x, o.p.z) * 1.5) : 0;
export function resetLos() { cache.clear(); }

// ---------- COLISIONES ----------
const mass = e => e.s.hp * (e.cls === 'sub' ? 0.5 : 1);
// distancia entre los ejes longitudinales de dos barcos (segmentos)
function segDist(a, b) {
  const ax = Math.sin(a.h) * a.hl * 0.85, az = Math.cos(a.h) * a.hl * 0.85, bx = Math.sin(b.h) * b.hl * 0.85, bz = Math.cos(b.h) * b.hl * 0.85;
  const p1x = a.p.x - ax, p1z = a.p.z - az, d1x = 2 * ax, d1z = 2 * az, p2x = b.p.x - bx, p2z = b.p.z - bz, d2x = 2 * bx, d2z = 2 * bz;
  const rx = p1x - p2x, rz = p1z - p2z, A = d1x * d1x + d1z * d1z, E = d2x * d2x + d2z * d2z, F = d2x * rx + d2z * rz;
  let s, t;
  const C = d1x * rx + d1z * rz, B = d1x * d2x + d1z * d2z, den = A * E - B * B;
  s = den > 1e-6 ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0;
  t = (B * s + F) / E; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -C / A)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (B - C) / A)); }
  const cx = p1x + d1x * s, cz = p1z + d1z * s, ex = p2x + d2x * t, ez = p2z + d2z * t;
  return { d: Math.hypot(cx - ex, cz - ez), nx: cx - ex, nz: cz - ez, x: (cx + ex) / 2, z: (cz + ez) / 2 };
}
export function collisions(dt, damage) {
  const ships = [], planes = [];
  for (const e of G.ents) {
    if (e.colT > 0) e.colT -= dt;
    if (!e.alive || e.falling) continue;
    if (e.dom === 'sea' && !e.submerged) ships.push(e);
    else if (e.dom === 'air') planes.push(e);
  }
  // barcos: se separan y, si chocan con velocidad, se dañan según masa y velocidad relativa (embestida)
  for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) {
    const a = ships[i], b = ships[j];
    if (Math.abs(a.p.x - b.p.x) > a.hl + b.hl + 10 || Math.abs(a.p.z - b.p.z) > a.hl + b.hl + 10) continue;
    const c = segDist(a, b), R = a.hw + b.hw;
    if (c.d >= R) continue;
    let nx = c.nx, nz = c.nz, L = Math.hypot(nx, nz); if (L < 1e-3) { nx = a.p.x - b.p.x; nz = a.p.z - b.p.z; L = Math.hypot(nx, nz) || 1; }
    nx /= L; nz /= L;
    const ma = mass(a), mb = mass(b), pen = R - c.d + 0.2;
    a.p.x += nx * pen * mb / (ma + mb); a.p.z += nz * pen * mb / (ma + mb);
    b.p.x -= nx * pen * ma / (ma + mb); b.p.z -= nz * pen * ma / (ma + mb);
    const vax = Math.sin(a.h) * a.speed, vaz = Math.cos(a.h) * a.speed, vbx = Math.sin(b.h) * b.speed, vbz = Math.cos(b.h) * b.speed;
    const vrel = -((vax - vbx) * nx + (vaz - vbz) * nz); // > 0 si se acercan
    if (vrel > 3 && G.time > 5 && !(a.colT > 0) && !(b.colT > 0)) {
      // daño según la velocidad relativa (≈ 25 a 10 m/s, ≈ 600 a 50 m/s); los roces entre aliados hacen menos
      const k = vrel * vrel * 0.25 * (a.side === b.side ? 0.35 : 1);
      damage(a, k * mb / (ma + mb) * (a.cls === 'sub' ? 2 : 1), b, null, 'ram');
      damage(b, k * ma / (ma + mb) * (b.cls === 'sub' ? 2 : 1), a, null, 'ram');
      a.speed *= 0.35; b.speed *= 0.35; a.colT = b.colT = 1.5;
      FX.explosion(V3(c.x, 2, c.z), 0.7);
      FX.sfx('cannon', a.p, 0.7);
      if ((a === G.player || b === G.player) && G.onMsg) G.onMsg('¡Colisión!', `${a.name} y ${b.name} · ${Math.round(vrel * 1.9)} nudos de velocidad relativa`, 1.6);
    } else if (vrel > 0) { a.speed *= Math.pow(0.5, dt); b.speed *= Math.pow(0.5, dt); }
  }
  // aviones: un choque en el aire derriba a ambos
  for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) {
    const a = planes[i], b = planes[j], R = ((a.mesh.userData.r || 6) + (b.mesh.userData.r || 6)) * 0.22;
    if (Math.abs(a.p.x - b.p.x) > R || Math.abs(a.p.z - b.p.z) > R || Math.abs(a.p.y - b.p.y) > R) continue;
    if (a.p.distanceTo(b.p) > R) continue;
    // solo choques de frente o cruzados (en una persecución por la cola el perseguidor esquiva)
    // los pilotos del mismo bando vuelan separados; con el enemigo, un cruce muy cerrado acaba en choque una de cada cinco veces
    if (a.side === b.side || a.vel.clone().sub(b.vel).length() < 60 || a.colT > 0 || b.colT > 0) continue;
    a.colT = b.colT = 1.5; if (Math.random() > 0.2) continue;
    damage(a, a.s.hp * 1.2, b, null, 'ram'); damage(b, b.s.hp * 1.2, a, null, 'ram');
    FX.explosion(a.p.clone().lerp(b.p, 0.5), 1.2);
    if ((a === G.player || b === G.player) && G.onMsg) G.onMsg('¡Colisión en el aire!', '', 1.6);
  }
}
// tierra: un vehículo que embiste a otro (o atropella infantería enemiga)
export function landImpact(e, o, damage) {
  if (e.colT > 0) return false;
  const v = Math.abs(e.speed);
  if (o.cls === 'inf' && e.cls !== 'inf' && o.side !== e.side && v > 2) { damage(o, 60 + v * 12, e, null, 'ram'); e.colT = 0.6; return true; }
  if (o.cls !== 'inf' && e.cls !== 'inf' && v > 6) { const k = (v - 4) * (o.side === e.side ? 2 : 6); damage(o, k, e, null, 'ram'); damage(e, k * 0.6, o, null, 'ram'); e.colT = o.colT = 1.2; e.speed *= 0.2; if (e === G.player && G.onMsg) G.onMsg('¡Choque!', o.name, 1.2); }
  return false;
}

// ---------- cobertura cercana (órdenes de mover y «Sígueme») ----------
// mejor punto a cubierto en un radio: más cobertura y más cerca puntúan mejor; null si no hay nada que merezca la pena
export function coverNear(x, z, R = 40, min = 0.3) {
  const m = G.map; if (!m || !m.coverAt) return null;
  let best = null, bs = -1;
  const st = 8;
  for (let dx = -R; dx <= R; dx += st) for (let dz = -R; dz <= R; dz += st) {
    const d = Math.hypot(dx, dz); if (d > R) continue;
    const px = x + dx, pz = z + dz;
    if (m.h(px, pz) < 0.5) continue; // nada de agua
    const c = Math.min(1, m.coverAt(px, pz)); if (c < min) continue;
    const sc = c - d / R * 0.45;
    if (sc > bs) { bs = sc; best = V3(px, 0, pz); }
  }
  return best;
}
// varios puntos con cobertura alrededor de un punto (para marcarlos en el mapa)
export function coverSpots(x, z, R = 160, n = 10) {
  const m = G.map; if (!m || !m.coverAt) return [];
  const cand = [];
  for (let dx = -R; dx <= R; dx += 12) for (let dz = -R; dz <= R; dz += 12) {
    if (dx * dx + dz * dz > R * R) continue;
    const px = x + dx, pz = z + dz; if (m.h(px, pz) < 0.5) continue;
    const c = m.coverAt(px, pz); if (c >= 0.3) cand.push({ x: px, z: pz, c, house: c >= 0.75 });
  }
  cand.sort((a, b) => b.c - a.c);
  const out = [];
  for (const p of cand) { if (out.every(q => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 > 38 * 38)) out.push(p); if (out.length >= n) break; }
  return out;
}

// Capa estratégica: niebla de guerra, puntos de mando y apoyo (artillería, ataque aéreo, refuerzos)
import * as THREE from 'three';
import { losBlocked, coverOf } from './physics.js';
import { diff } from './difficulty.js';
import { G } from './state.js';
import { BATTLES, MODELS, CLS } from './data.js';
import { spawnUnit, damage, anchorFor } from './units.js';
import * as FX from './fx.js';
import { V3, rnd, clamp } from './util.js';
import { litByFlare } from './env.js';

// ---------- NIEBLA DE GUERRA ----------
export function sightOf(e) {
  switch (e.cls) {
    case 'destroyer': case 'cruiser': case 'battleship': case 'carrier': return 1400; // radar
    case 'pt': return 800;
    case 'sub': return e.submerged ? 600 : 750;
    case 'fighter': case 'bomber': return 950;
    case 'tank': return 560;
    case 'atgun': return 460;
    case 'inf': return 430;
    case 'site': return e.siteIdx === 2 ? 1800 : 600; // estación de radar
    case 'aa': return 900;
    case 'battery': return 1100;
  }
  return 500;
}
const smokeOn = (a, b) => G.smokes.some(s => {
  const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz || 1;
  const t = clamp(((s.x - a.x) * abx + (s.z - a.z) * abz) / l2, 0, 1);
  return Math.hypot(a.x + abx * t - s.x, a.z + abz * t - s.z) < s.r;
});
function canSee(e, o) {
  const d = Math.hypot(o.p.x - e.p.x, o.p.z - e.p.z);
  if (o.submerged) return (e.s.dc && d < 260) || d < 110;
  const E = G.env, radar = e.cls === 'destroyer' || e.cls === 'cruiser' || e.cls === 'battleship' || e.cls === 'carrier';
  const k = E ? (radar && o.dom === 'sea' ? Math.max(0.85, E.sightK) : E.sightK) : 1;
  // bengalas y reflectores delatan a quien está debajo (o al que enciende el reflector)
  if (E && E.dark && (o.lit || litByFlare(o)) && d < 1800) return true;
  let r = sightOf(e) * k;
  if (o.dom === 'air') r = Math.max(r, 1000 * k);
  else if (e.dom === 'air') r = Math.min(r, 750 + (e.p.y - G.map.gy(e.p.x, e.p.z)) * 1.5);
  if (coverOf(o) > 0.25 && e.dom !== 'air') r *= 1 - 0.45 * coverOf(o); // a cubierto se ve peor
  if (o.cls === 'inf') r *= Math.abs(o.speed) < 1 ? 0.55 : 0.75;
  else if (o.cls === 'atgun') r *= 0.65;
  else if (o.cls === 'sub' || o.cls === 'pt') r *= 0.75;
  if (d > r) return false;
  if (o.revealT > 0 && d < r * 1.4) return true;
  // relieve e islas (también entre barcos) y cobertura tapan la vista; el humo solo en tierra
  if (e.dom !== 'air' && o.dom !== 'air' && !o.lit && losBlocked(e, o)) return false;
  if (e.dom === 'land' && o.dom === 'land' && smokeOn(e.p, o.p)) return false;
  return true;
}
let visT = 0;
export function updateVision(dt) {
  visT -= dt; if (visT > 0) return; visT = 0.3;
  for (const o of G.ents) if (o.revealT > 0) o.revealT -= 0.3;
  for (const side of ['A', 'E']) {
    const key = 'vis' + side, obs = G.ents.filter(e => e.alive && e.side === side && !e.falling);
    for (const o of G.ents) {
      if (o.side === side) { o[key] = true; continue; }
      let v = !G.fog || G.demo || o.cls === 'site' || !o.alive;
      if (!v) for (const e of obs) if (canSee(e, o)) { v = true; break; }
      o[key] = v;
      if (v && o.alive) { o['seen' + side] = G.time; o['last' + side] = o.p.clone(); }
    }
  }
  // lo que no ve el jugador no se dibuja (los restos siguen visibles)
  for (const o of G.ents) if (o.side === 'E' && o.alive && !o.gone) o.mesh.visible = o.visA;
}
export const visibleTo = (side, o) => !G.fog || o['vis' + side] !== false;

// ---------- PUNTOS DE MANDO ----------
export const SUPPORT = {
  barrage: { key: 'Digit7', cost: 60, cd: 30, name: 'Artillería', nameSea: 'Salva naval' },
  air: { key: 'Digit8', cost: 90, cd: 40, name: 'Ataque aéreo' },
  reinf: { key: 'Digit9', cost: 110, cd: 30, name: 'Refuerzo' },
};
const STRIKER = { pacific: { A: 'sbd', E: 'val' }, africa: { A: 'hurricane', E: 'ju87' }, europe: { A: 'p47', E: 'fw190f' } };
let events = [], aiT = 0;
export function resetStrategy() {
  G.cp = { A: 40, E: 40 }; G.supCd = { A: {}, E: {} }; G.supCount = { A: 0, E: 0 }; events = []; aiT = 8; allyT = 15; visT = 0;
}
export function updateStrategy(dt) {
  if (!G.cp) return;
  // el portaaviones vivo es la base aérea móvil de su bando
  for (const c of G.ents) if (c.cls === 'carrier' && c.alive && G.bases && G.bases[c.side]) G.bases[c.side].air = c.p;
  const b = G.battle;
  // ingresos: base + objetivos controlados (o instalaciones vivas en batallas aéreas)
  for (const s of ['A', 'E']) {
    let inc = 0.35;
    if (b.kind === 'air') inc += (s === 'A' ? G.sitesA : G.sitesE).filter(x => x.alive).length * 0.25;
    else inc += G.objectives.filter(z => z.owner === s).length * 0.55;
    G.cp[s] = Math.min(400, G.cp[s] + inc * dt);
    for (const k in G.supCd[s]) G.supCd[s][k] -= dt;
  }
  if (b.kind === 'test') G.cp.A = 400;
  for (let i = events.length - 1; i >= 0; i--) { const ev = events[i]; ev.t -= dt; if (ev.t <= 0) { ev.fn(); events.splice(i, 1); } }
  // apoyos aéreos que ya han soltado la carga se marchan
  for (const e of G.ents) if (e.support && e.alive && e.leaving && (Math.abs(e.p.x) > G.map.bounds + 120 || Math.abs(e.p.z) > G.map.bounds + 120)) { e.alive = false; e.gone = true; e.mesh.visible = false; }
  if (!G.demo && b.kind !== 'test') { enemySupportAI(dt); if (G.opts?.aiCmd !== false) allySupportAI(dt); }
}
// modo sencillo: una sola tecla de apoyo, se elige el más útil según la situación
export function autoSupportKind(side = 'A') {
  const P = G.player, t = P && P.target && P.target.alive ? P.target : null;
  const own = G.ents.filter(e => e.alive && e.side === side && e.dom !== 'static' && !e.support).length;
  const order = [];
  if (own < 5) order.push('reinf');
  if (t && (t.dom === 'sea' || t.dom === 'air')) order.push('air', 'barrage'); else order.push('barrage', 'air');
  if (!order.includes('reinf')) order.push('reinf');
  return order.find(k => canUse(side, k)) || order[0];
}
export function canUse(side, kind) { const s = SUPPORT[kind]; return G.cp && G.cp[side] >= s.cost && !(G.supCd[side][kind] > 0); }
export function useSupport(side, kind, point) {
  if (!canUse(side, kind)) return false;
  const s = SUPPORT[kind];
  if (kind === 'reinf') { if (!reinforce(side)) return false; }
  else if (!point) return false;
  else if (kind === 'barrage') barrage(side, point);
  else airStrike(side, point);
  G.cp[side] -= s.cost; G.supCd[side][kind] = s.cd;
  return true;
}
// marca de humo rojo y lluvia de proyectiles
function barrage(side, p) {
  const P = V3(p.x, Math.max(G.map.gy(p.x, p.z), 0), p.z);
  for (let k = 0; k < 14; k++) events.push({ t: k * 0.6, fn: () => FX.trailSmoke(P.clone().add(V3(0, 1, 0)), false, 1.6) });
  G.onSupport && G.onSupport(side, 'barrage', P);
  for (let k = 0; k < 16; k++) events.push({ t: 5 + k * 0.28 + rnd(0, 0.2), fn: () => {
    const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * 60, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, g = G.map.h(x, z);
    const q = V3(x, Math.max(g, 0), z);
    if (g < 0) FX.splash(q, 1.6); else FX.explosion(q, 1.3, { dust: true });
    for (const e of G.ents) { if (!e.alive || e.dom === 'air') continue; const d = Math.hypot(e.p.x - x, e.p.z - z) - e.hw; if (d < 11) damage(e, 42 * (e.cls === 'tank' ? 0.55 : e.cls === 'inf' || e.cls === 'atgun' ? 1.5 : 1) * (1 - Math.max(0, d) / 13), null, null, 'arty'); }
  } });
}
function airStrike(side, p) {
  const key = STRIKER[G.battle.front][side], b = G.map.bounds;
  // entran desde el lado de su propia base
  const ab = G.bases && G.bases[side] && (G.bases[side].air || G.bases[side].land || G.bases[side].sea);
  let from = side === 'A' ? V3(p.x * 0.3, 0, b + 80) : V3(p.x * 0.3, 0, -b - 80);
  if (ab) { const d = V3(ab.x - p.x, 0, ab.z - p.z); if (d.length() > 1) { d.normalize(); from = V3(ab.x + d.x * 300, 0, ab.z + d.z * 300); } }
  const hd = Math.atan2(p.x - from.x, p.z - from.z);
  for (let k = 0; k < 2; k++) {
    const e = spawnUnit(key, side, from.x + (k ? 40 : -40), from.z + k * 30, hd);
    e.support = true; e.strike = V3(p.x + rnd(-15, 15), 0, p.z + rnd(-15, 15)); e.order = { type: 'strike' }; e.ammo.bomb = 2; e.speed = e.s.max;
  }
  G.onSupport && G.onSupport(side, 'air', p);
}
function reinforce(side) {
  const b = BATTLES[G.battleKey], roster = side === 'A' ? (G.roster || b.allies) : b.enemy;
  // dominio: el del jugador (aliados) o el más numeroso
  let dom = side === 'A' && G.player ? G.player.dom : null;
  const keys = roster.map(([k]) => k).filter(k => !dom || CLS[MODELS[k].cls].dom === dom);
  if (!keys.length) return false;
  const counts = {}; roster.forEach(([k, n]) => counts[k] = n);
  const key = keys.sort((x, y) => counts[y] - counts[x])[0]; dom = CLS[MODELS[key].cls].dom;
  const base = G.bases && G.bases[side] && G.bases[side][dom]; if (!base) return false;
  const at = anchorFor({ dom }, base.x + rnd(-40, 40), base.z + rnd(-40, 40));
  const e = spawnUnit(key, side, at.x, at.z, side === 'A' ? Math.PI : 0);
  e.order = side === 'A' ? { type: 'follow' } : { type: 'attack' };
  if (side === 'A') { e.slot = G.ents.filter(x => x.side === 'A').length; G.selection.add(e); }
  G.supCount[side]++;
  G.onSupport && G.onSupport(side, 'reinf', e.p, e);
  return true;
}
// la IA enemiga también gasta sus puntos
// el mando aliado pide apoyo por su cuenta, pero guarda una reserva para el jugador
let allyT = 15;
function allySupportAI(dt) {
  allyT -= dt; if (allyT > 0) return; allyT = 12;
  const RES = 160; if (!G.cp || G.cp.A < RES) return;
  const foes = G.ents.filter(e => e.alive && e.side === 'E' && e.dom !== 'air' && e.dom !== 'static' && e.visA !== false && !e.submerged);
  let best = null, bn = 1;
  for (const f of foes) { const n = foes.filter(o => o.p.distanceTo(f.p) < 70).length; if (n > bn) { bn = n; best = f; } }
  if (best && G.cp.A - SUPPORT.barrage.cost >= RES - 60 && useSupport('A', 'barrage', best.p.clone())) { G.onAllySupport && G.onAllySupport('barrage'); return; }
  const armor = foes.find(e => e.cls === 'tank' || e.dom === 'sea' || e.cls === 'battery');
  if (armor && G.battle.kind !== 'naval' && G.cp.A - SUPPORT.air.cost >= RES - 60 && useSupport('A', 'air', armor.p.clone())) { G.onAllySupport && G.onAllySupport('air'); return; }
  const mine = G.ents.filter(e => e.alive && e.side === 'A' && e.dom !== 'static').length;
  if (mine < G.startCount.A * 0.6 && G.supCount.A < 4 && useSupport('A', 'reinf')) G.onAllySupport && G.onAllySupport('reinf');
}
function enemySupportAI(dt) {
  aiT -= dt; if (aiT > 0) return; aiT = diff().sup;
  const foes = G.ents.filter(e => e.alive && e.side === 'A' && e.dom !== 'air' && e.dom !== 'static' && e.visE !== false && !e.submerged);
  let best = null, bn = 1;
  for (const f of foes) { const n = foes.filter(o => o.p.distanceTo(f.p) < 70).length; if (n > bn) { bn = n; best = f; } }
  if (best && Math.random() < 0.7 && useSupport('E', 'barrage', best.p.clone())) return;
  const armor = foes.filter(e => e.cls === 'tank' || e.dom === 'sea')[0];
  if (armor && G.battle.kind !== 'naval' && Math.random() < 0.5 && useSupport('E', 'air', armor.p.clone())) return;
  const mine = G.ents.filter(e => e.alive && e.side === 'E' && e.dom !== 'static').length;
  if (diff().reinf && mine < G.startCount.E * diff().reinfK && G.supCount.E < 4) useSupport('E', 'reinf');
}

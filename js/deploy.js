// Fase de despliegue: composición con presupuesto y colocación de unidades
import * as THREE from 'three';
import { vetCount } from './campaign.js';
import { G } from './state.js';
import { BATTLES, FRONTS, MODELS, CLS, specOf, KIND_NAME, FAC_NAME } from './data.js';
import { anchorFor } from './units.js';
import { V3 } from './util.js';

const $ = id => document.getElementById(id);
const DOM_NAME = { sea: 'Flota', air: 'Aviación', land: 'Fuerzas terrestres' };
export function costOf(key) { const s = specOf(key), c = CLS[MODELS[key].cls]; return Math.max(5, Math.round(s.value * (s.hp / c.hp) / 5) * 5); }

let state = null;
// unidades disponibles: las que usa el bando aliado en las batallas del mismo frente, de los tipos presentes
function poolFor(key) {
  const b = BATTLES[key], doms = new Set(b.allies.map(([k]) => CLS[MODELS[k].cls].dom)), set = new Set();
  for (const bk of FRONTS[b.front].battles) BATTLES[`${b.front}-${bk}`].allies.forEach(([k]) => set.add(k));
  b.allies.forEach(([k]) => set.add(k));
  if (G.campaign) G.campaign.unlocked.forEach(k => set.add(k));
  return [...set].filter(k => doms.has(CLS[MODELS[k].cls].dom) && MODELS[k].cls !== 'merchant');
}
export function openDeploy(key, onGo) {
  const b = BATTLES[key], counts = {};
  const pool = poolFor(key);
  pool.forEach(k => counts[k] = 0); b.allies.forEach(([k, n]) => counts[k] = n);
  const budget = b.allies.reduce((s, [k, n]) => s + costOf(k) * n, 0) + (G.campaign ? G.campaign.bonus : 0), maxN = b.allies.reduce((s, [, n]) => s + n, 0) + 3;
  state = { key, counts, budget, maxN, pool, onGo };
  $('dpTitle').textContent = `${b.title}, ${b.year}`;
  $('dpSub').textContent = `${KIND_NAME[b.kind]} · Elige tu fuerza dentro del presupuesto (máximo ${maxN} unidades)`;
  render();
}
function spent() { return Object.entries(state.counts).reduce((s, [k, n]) => s + costOf(k) * n, 0); }
function total() { return Object.values(state.counts).reduce((a, b) => a + b, 0); }
function render() {
  const { counts, budget, maxN, pool } = state, used = spent(), n = total();
  const byDom = {}; pool.forEach(k => (byDom[CLS[MODELS[k].cls].dom] = byDom[CLS[MODELS[k].cls].dom] || []).push(k));
  $('dpList').innerHTML = Object.entries(byDom).map(([d, ks]) => `<h4>${DOM_NAME[d]}</h4>` + ks.map(k => {
    const m = MODELS[k], c = costOf(k), s = specOf(k), canAdd = used + c <= budget && n < maxN;
    const stat = s.dom === 'sea' ? `${s.hp} pv · ${Math.round(s.max * s.dispK)} nudos` : s.dom === 'air' ? `${s.hp} pv · ${Math.round(s.max * 3.6)} km/h` : s.gun ? `${s.hp} pv · cañón ${s.gun.dmg}` : `${s.hp} pv`;
    return `<div class="dpu ${counts[k] ? 'on' : ''}"><div class="dpn"><b>${m.name}</b><span>${m.type} · ${FAC_NAME[m.fac]} · ${stat}${vetCount(k) ? ` · <em class="vet">★ ${vetCount(k)} veterano${vetCount(k) > 1 ? 's' : ''}</em>` : ''}${G.campaign && G.campaign.unlocked.includes(k) ? ' · <em class="vet">nueva</em>' : ''}</span></div><div class="dpc">${c}</div>
      <div class="dpq"><button data-k="${k}" data-d="-1" ${counts[k] ? '' : 'disabled'}>−</button><b>${counts[k]}</b><button data-k="${k}" data-d="1" ${canAdd ? '' : 'disabled'}>+</button></div></div>`;
  }).join('')).join('');
  $('dpBud').textContent = `${used} / ${budget}`; $('dpBar').style.width = Math.min(100, used / budget * 100) + '%';
  $('dpSum').innerHTML = `<div><span>Unidades</span><b>${n} / ${maxN}</b></div><div><span>Puntos libres</span><b>${budget - used}</b></div>`;
  $('dpGo').disabled = n < 1;
  $('dpList').querySelectorAll('button[data-k]').forEach(bt => bt.onclick = () => { state.counts[bt.dataset.k] = Math.max(0, state.counts[bt.dataset.k] + +bt.dataset.d); render(); });
}
export function initDeployUI() {
  $('dpReset').onclick = () => { const b = BATTLES[state.key]; for (const k in state.counts) state.counts[k] = 0; b.allies.forEach(([k, n]) => state.counts[k] = n); render(); };
  $('dpGo').onclick = () => { const roster = Object.entries(state.counts).filter(([, n]) => n > 0); state.onGo(roster, $('optFog').checked, $('optPlace').checked, { time: $('optTime').value, weather: $('optWeather').value }); };
}

// ---------- colocación en el mapa ----------
let rings = [];
const ZR = { land: 300, sea: 520 };
export function beginPlacement() {
  G.deploying = true;
  rings.forEach(r => G.scene.remove(r)); rings = [];
  for (const dom of ['land', 'sea']) {
    const c = G.bases.A[dom]; if (!c) continue;
    const r = new THREE.Mesh(new THREE.RingGeometry(ZR[dom] - 5, ZR[dom], 72), new THREE.MeshBasicMaterial({ color: 0x5aa2ff, transparent: true, opacity: 0.6, depthTest: false, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2; r.position.set(c.x, dom === 'land' ? G.map.gy(c.x, c.z) + 1 : 1, c.z); r.renderOrder = 9; G.scene.add(r); rings.push(r);
  }
  $('deployHud').classList.remove('hide');
  G.targetZoom = 720;
}
export function endPlacement() {
  G.deploying = false; rings.forEach(r => G.scene.remove(r)); rings = [];
  $('deployHud').classList.add('hide');
}
export function deployZone(dom) { const c = G.bases.A[dom]; return c ? { c, r: ZR[dom] } : null; }
// mover una unidad dentro de su zona de despliegue
export function placeUnit(e, x, z) {
  const zn = deployZone(e.dom); if (!zn) return;
  const dx = x - zn.c.x, dz = z - zn.c.z, d = Math.hypot(dx, dz), k = d > zn.r - 15 ? (zn.r - 15) / d : 1;
  let px = zn.c.x + dx * k, pz = zn.c.z + dz * k;
  const ok = e.dom === 'land' ? G.map.h(px, pz) > 1 : G.map.h(px, pz) < -8;
  if (!ok) { const a = anchorFor(e, px, pz); if (Math.hypot(a.x - zn.c.x, a.z - zn.c.z) > zn.r) return; px = a.x; pz = a.z; }
  e.p.x = px; e.p.z = pz; if (e.dom === 'land') e.p.y = G.map.gy(px, pz);
}
// disposiciones rápidas
export const PRESETS = ['Línea', 'Cuña', 'Columna', 'Flanco izquierdo', 'Flanco derecho'];
export function applyPreset(i) {
  for (const dom of ['land', 'sea']) {
    const zn = deployZone(dom); if (!zn) continue;
    const us = G.ents.filter(e => e.side === 'A' && e.alive && e.dom === dom && !e.support); const n = us.length; if (!n) continue;
    const gap = dom === 'sea' ? 95 : 34, R = zn.r * 0.75;
    us.forEach((e, k) => {
      let x = 0, z = 0; const c = k - (n - 1) / 2;
      if (i === 0) { x = c * gap; z = 0; }
      else if (i === 1) { x = c * gap * 0.9; z = Math.abs(c) * gap * 0.6 - gap; }
      else if (i === 2) { x = (k % 2 ? 1 : -1) * gap * 0.3; z = c * gap * 0.8; }
      else { const s = i === 3 ? -1 : 1; x = s * R * 0.6 + (k % 3 - 1) * gap * 0.8; z = (Math.floor(k / 3) - (n / 3 - 1) / 2) * gap * 0.8; }
      placeUnit(e, zn.c.x + x, zn.c.z + z); e.h = Math.PI; e.mesh.rotation.y = e.h;
    });
  }
}

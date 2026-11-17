// Multijugador local a pantalla partida: el jugador 2 maneja una unidad del Eje con un mando (o el teclado numérico)
import * as THREE from 'three';
import { G } from './state.js';
import { readPad } from './gamepad.js';
import { V3, clamp } from './util.js';

const $ = id => document.getElementById(id);
// teclado numérico para el jugador 2 cuando no hay mando
const NUMPAD = { Numpad8: 'ArrowUp', Numpad5: 'ArrowDown', Numpad4: 'ArrowLeft', Numpad6: 'ArrowRight', Numpad0: 'Space', NumpadDecimal: 'ShiftLeft', NumpadAdd: 'KeyT', NumpadSubtract: 'KeyK', NumpadMultiply: 'KeyN', NumpadDivide: 'Tab' };
const ZOOM = { land: 260, sea: 360, air: 400 };

function pickP2(near) {
  const list = G.ents.filter(e => e.alive && e.side === 'E' && e.dom !== 'static' && !e.support && e.cls !== 'merchant');
  const dom = G.player ? G.player.dom : 'land';
  list.sort((a, b) => (b.dom === dom) - (a.dom === dom) || (near ? a.p.distanceTo(near) - b.p.distanceTo(near) : b.s.value - a.s.value));
  return list[0] || null;
}
export function setupSplit() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const p1Pad = pads.length >= 2 ? pads[0].index : null, p2Pad = pads.length >= 2 ? pads[1].index : pads.length ? pads[0].index : null;
  const cam = new THREE.PerspectiveCamera(40, 1, 3, 9000);
  const p2 = pickP2();
  G.split = { p2, p1Pad, p2Pad, keys: {}, once: new Set(), prev: {}, cam, focus: p2 ? p2.p.clone() : V3(), zoom: ZOOM[p2 ? p2.dom : 'land'], run };
  $('p2hud').classList.remove('hide'); $('splitLine').classList.remove('hide'); document.body.classList.add('split');
  G.onMsg && G.onMsg('Pantalla partida', p2Pad !== null ? `Jugador 2: mando ${p2Pad + 1} · ${p2 ? p2.name : ''}` : 'Jugador 2: teclado numérico (8 5 4 6 mover · 0 fuego · . secundaria · + blanco)', 4);
}
export function stopSplit() { if (!G.split) return; G.split = null; document.body.classList.remove('split'); $('p2hud').classList.add('hide'); $('splitLine').classList.add('hide'); }

// ejecuta el control del jugador con la entrada y la unidad del jugador 2
function run(fn) {
  const S = G.split, k = G.keys, o = G.keysOnce, pl = G.player, msg = G.onMsg;
  G.keys = S.keys; G.keysOnce = S.once; G.player = S.p2; G.onMsg = (a, b) => { S.msg = a; S.msgT = 2; };
  try { fn(); } finally { G.keys = k; G.keysOnce = o; G.player = pl; G.onMsg = msg; }
}
function readInput() {
  const S = G.split; let now = {};
  const gp = S.p2Pad !== null && navigator.getGamepads ? navigator.getGamepads()[S.p2Pad] : null;
  if (gp) now = readPad(gp);
  else for (const c in NUMPAD) if (G.keys[c]) now[NUMPAD[c]] = true;
  S.once = new Set(Object.keys(now).filter(c => now[c] && !S.prev[c]));
  S.keys = now; S.prev = now;
  // Tab: cambiar a otra unidad del Eje
  if (S.once.has('Tab') && S.p2) { const list = G.ents.filter(e => e.alive && e.side === 'E' && e.dom !== 'static' && !e.support); const i = list.indexOf(S.p2); S.p2 = list[(i + 1) % list.length]; S.zoom = ZOOM[S.p2.dom]; }
}
export function updateSplit(dt) {
  const S = G.split; if (!S) return;
  readInput();
  if (!S.p2 || !S.p2.alive) { S.deadT = (S.deadT || 0) + dt; if (S.deadT > 1.6) { S.deadT = 0; S.p2 = pickP2(S.p2 ? S.p2.p : null); if (S.p2) S.zoom = ZOOM[S.p2.dom]; } }
  // cámara del jugador 2: cenital con algo de anticipación
  const p = S.p2;
  if (p) {
    if (S.keys.KeyW) S.zoom = clamp(S.zoom * (1 - dt), 110, 1200); if (S.keys.KeyS) S.zoom = clamp(S.zoom * (1 + dt), 110, 1200);
    if (S.once.has('KeyZ')) S.zoom = clamp(S.zoom / 1.25, 110, 1200); if (S.once.has('KeyX')) S.zoom = clamp(S.zoom * 1.25, 110, 1200);
    const look = S.zoom * 0.2, tgt = V3(p.p.x + Math.sin(p.h) * look, p.dom === 'air' ? p.p.y * 0.6 : Math.max(0, p.p.y), p.p.z + Math.cos(p.h) * look);
    S.focus.lerp(tgt, Math.min(1, dt * 3.5));
    S.cam.position.set(S.focus.x, S.focus.y + S.zoom * 1.05, S.focus.z - S.zoom * 0.42); S.cam.lookAt(S.focus);
  }
  // marcador del jugador 2
  if (S.msgT > 0) S.msgT -= dt;
  const hp = p ? Math.max(0, p.hp / p.s.hp) : 0, ready = p && (p.cd.main <= 0 || p.dom === 'air');
  $('p2hud').innerHTML = p ? `<div class="p2t">JUGADOR 2 · ${p.name}</div><div class="p2b"><i style="width:${(hp * 100).toFixed(0)}%"></i></div><div class="p2r">${p.alive ? (ready ? '<b>LISTO</b>' : 'Recargando…') : 'Destruido · cambiando de unidad'}${S.msgT > 0 ? ' · ' + S.msg : ''}</div>` : '<div class="p2t">JUGADOR 2 · sin unidades</div>';
}
// dos vistas: izquierda jugador 1, derecha jugador 2
export function renderSplit(renderer, scene, cam1, rt) {
  // se dibuja en el búfer de baja resolución (rt): viewport y tijera en sus píxeles
  const S = G.split, w = rt.width, h = rt.height, hw = Math.floor(w / 2);
  rt.scissorTest = true;
  cam1.aspect = hw / h; cam1.updateProjectionMatrix();
  rt.viewport.set(0, 0, hw, h); rt.scissor.set(0, 0, hw, h); renderer.setRenderTarget(rt); renderer.render(scene, cam1);
  S.cam.aspect = (w - hw) / h; S.cam.updateProjectionMatrix();
  rt.viewport.set(hw, 0, w - hw, h); rt.scissor.set(hw, 0, w - hw, h); renderer.setRenderTarget(rt); renderer.render(scene, S.cam);
  rt.scissorTest = false; rt.viewport.set(0, 0, w, h); rt.scissor.set(0, 0, w, h); renderer.setRenderTarget(rt);
}

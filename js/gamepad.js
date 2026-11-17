// Mando (Gamepad API, distribución estándar): se traduce a las mismas teclas que el teclado
import { G } from './state.js';

// botones → tecla
export const PAD_BUTTONS = {
  0: 'KeyT',        // A: siguiente blanco
  1: 'KeyK',        // B: control de daños
  2: 'KeyQ',        // X: escuadra, sígueme
  3: 'KeyV',        // Y: cambiar vista
  4: 'Tab',         // LB: cambiar de unidad
  5: 'KeyM',        // RB: mapa táctico
  6: 'ShiftLeft',   // LT: arma secundaria
  7: 'Space',       // RT: disparar
  8: 'KeyP',        // Select: pausa
  9: 'Enter',       // Start: empezar / pausa
  10: 'KeyZ',       // L3: acercar
  11: 'KeyX',       // R3: alejar
  12: 'Digit2',     // cruceta ↑: objetivo B
  13: 'KeyR',       // cruceta ↓: mantener
  14: 'Digit1',     // cruceta ←: objetivo A
  15: 'Digit3',     // cruceta →: objetivo C
};
export const PAD_HELP = 'Stick izq.: mover · Stick der.: cámara · RT disparar · LT secundaria · A blanco · B reparar · X sígueme · Y vista · LB cambiar unidad · RB mapa · Cruceta: objetivos A/B/C y mantener · L3/R3 zoom · Select pausa';
const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
const state = new Map(); // índice de mando → {botones, ejes}
let announced = new Set();
export function padIndexForP1() { return G.split ? (G.split.p1Pad ?? 0) : null; }

// lee un mando y devuelve un estado "teclas" (para el modo a pantalla partida)
export function readPad(gp) {
  const k = {}, ax = gp.axes, dz = 0.35;
  k.ArrowLeft = ax[0] < -dz; k.ArrowRight = ax[0] > dz; k.ArrowUp = ax[1] < -dz; k.ArrowDown = ax[1] > dz;
  k.KeyA = (ax[2] ?? 0) < -dz; k.KeyD = (ax[2] ?? 0) > dz; k.KeyW = (ax[3] ?? 0) < -dz; k.KeyS = (ax[3] ?? 0) > dz;
  gp.buttons.forEach((b, i) => { const c = PAD_BUTTONS[i]; if (c) k[c] = k[c] || b.pressed || b.value > 0.5; });
  if (gp.buttons[12]?.pressed) k.ArrowUp = k.ArrowUp; // la cruceta queda para órdenes
  return k;
}
export function updateGamepads() {
  if (!navigator.getGamepads) return;
  const pads = [...navigator.getGamepads()].filter(Boolean);
  for (const gp of pads) if (!announced.has(gp.index)) { announced.add(gp.index); G.onMsg && G.onMsg('Mando conectado', gp.id.slice(0, 40)); }
  // el jugador 1 usa el primer mando (o el que diga la pantalla partida); el resto lo gestiona el multijugador local
  const p1 = G.split ? pads.find(p => p.index === G.split.p1Pad) : pads[0];
  if (!p1) { for (const [, st] of state) for (const c in st) if (st[c]) send('keyup', c); state.clear(); return; }
  const prev = state.get(p1.index) || {}, now = readPad(p1);
  // Start funciona como pausa durante la batalla (Enter solo durante el despliegue)
  if (now.Enter && !prev.Enter && G.running && !G.deploying) { send('keydown', 'KeyP'); send('keyup', 'KeyP'); }
  for (const code in now) {
    if (code === 'Enter' && G.running && !G.deploying) continue;
    if (now[code] && !prev[code]) send('keydown', code);
    else if (!now[code] && prev[code]) send('keyup', code);
  }
  state.set(p1.index, now);
}

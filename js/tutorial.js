// Tutorial guiado: pasos con comprobación automática sobre el campo de pruebas
import { G } from './state.js';
import { spawnUnit, anchorFor, applyCrit } from './units.js';
import { V3 } from './util.js';

const $ = id => document.getElementById(id);
let steps = [], i = 0, st = {}, onExit = null, doneT = 0, cfg = {};
export function spot(dist, ang = 0) { const p = G.player, a = p.h + ang; return anchorFor({ dom: 'land' }, p.p.x + Math.sin(a) * dist, p.p.z + Math.cos(a) * dist); }
export function enemy(key, dist, ang, hp) {
  const q = spot(dist, ang), e = spawnUnit(key, 'E', q.x, q.z, Math.atan2(G.player.p.x - q.x, G.player.p.z - q.z));
  e.passive = true; e.order = { type: 'hold', x: q.x, z: q.z }; if (hp) e.hp = hp; return e;
}
function wingman(dx) {
  const p = G.player, q = anchorFor({ dom: 'land' }, p.p.x + Math.cos(p.h) * dx - Math.sin(p.h) * 30, p.p.z - Math.sin(p.h) * dx - Math.cos(p.h) * 30);
  const e = spawnUnit('sherman', 'A', q.x, q.z, p.h); e.order = { type: 'follow' }; e.slot = G.ents.filter(x => x.side === 'A').length; G.selection.add(e); return e;
}
const STEPS = [
  { t: 'Movimiento', d: 'Usa <kbd>↑</kbd> <kbd>↓</kbd> para acelerar y frenar y <kbd>←</kbd> <kbd>→</kbd> para girar. Avanza unos 60 metros.', init: () => { st.p0 = G.player.p.clone(); }, ok: () => G.player.p.distanceTo(st.p0) > 60 },
  { t: 'Cámara', d: 'Pulsa <kbd>V</kbd> para cambiar de vista (cenital, desde atrás, lateral…) y <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> para girarla e inclinarla. Pulsa <kbd>B</kbd> para volver a la cenital.', init: () => { st.c0 = { ...G.cam }; }, ok: () => G.cam.preset !== st.c0.preset || Math.abs(G.cam.yaw - st.c0.yaw) > 0.5 || Math.abs(G.cam.pitch - st.c0.pitch) > 0.3 },
  { t: 'Zoom', d: 'Acerca o aleja la vista con <kbd>Z</kbd> / <kbd>X</kbd> o con la rueda del ratón.', init: () => { st.z0 = G.targetZoom; }, ok: () => Math.abs(G.targetZoom / st.z0 - 1) > 0.15 },
  { t: 'Fijar un blanco', d: 'Ha aparecido un Panzer IV delante. Pulsa <kbd>T</kbd> para fijarlo como blanco (o haz clic sobre él). Se marca en <b style="color:#f2c94c">amarillo</b> en el mapa y en el panel.', init: () => { st.tg = enemy('pz4h', 260, 0.2, 140); }, ok: () => G.player.lock === st.tg },
  { t: 'Disparar', d: 'Pulsa <kbd>Espacio</kbd> para disparar. La torreta apunta sola: espera a que el panel diga LISTO. Destruye el Panzer.', ok: () => !st.tg.alive },
  { t: 'Munición', d: 'Contra cañones y soldados va mejor la munición explosiva. Pulsa <kbd>N</kbd> para cambiar a HE y destruye el cañón antitanque.', init: () => { st.at = enemy('pak40', 230, -0.3, 60); }, ok: () => G.player.ammoSel === 'he' && !st.at.alive },
  { t: 'Daños', d: '¡Te han incendiado el motor! Pulsa <kbd>K</kbd> para el control de daños: apaga el fuego y repara las averías.', init: () => { applyCrit(G.player, 'fire'); }, ok: () => G.player.repairing > 0 || !G.player.mods.fire },
  { t: 'Tu escuadra', d: 'Se han unido dos carros. Pulsa <kbd>R</kbd> para que mantengan su posición y luego <kbd>Q</kbd> para que te sigan en formación.', init: () => { st.w = [wingman(-25), wingman(25)]; st.held = false; }, ok: () => { if (st.w.every(w => w.order.type === 'hold')) st.held = true; return st.held && st.w.every(w => w.order.type === 'follow'); } },
  { t: 'Cambiar de unidad', d: 'Pulsa <kbd>Tab</kbd> para tomar el mando de otro carro de la escuadra (o doble clic sobre él).', init: () => { st.pl = G.player; }, ok: () => G.player !== st.pl },
  { t: 'Mapa táctico', d: 'Pulsa <kbd>M</kbd> para ver el mapa completo y planificar; vuelve a pulsarla para salir. En una batalla, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> envían la escuadra a los objetivos A, B y C.', init: () => { st.m = false; }, ok: () => { if (G.strategic) st.m = true; return st.m && !G.strategic; } },
];
// cfg: { steps, title, done, doneTitle, exitLabel, god } — sirve también para las maniobras (drills.js)
export function startTutorial(exit, c = {}) {
  cfg = c; onExit = exit; steps = c.steps || STEPS; i = 0; st = {}; doneT = 0; G.tutorial = true; G.godMode = c.god !== false;
  $('tut').classList.remove('hide');
  $('tutSkip').onclick = () => next();
  $('tutExit').onclick = () => stopTutorial(true);
  begin();
}
function begin() { const s = steps[i]; st.ok = false; s.init && s.init(); render(); }
function render(done = false) {
  const s = steps[i];
  const pre = cfg.title ? cfg.title + ' · ' : '';
  $('tutN').textContent = done ? pre + 'Completado' : `${pre}Paso ${i + 1} de ${steps.length}`;
  $('tutT').textContent = done ? (cfg.doneTitle || '¡Listo para el frente!') : s.t;
  $('tutD').innerHTML = done ? (cfg.done || 'Ya conoces lo básico. Elige un frente en el menú; en la pausa (<kbd>P</kbd>) tienes todos los controles.') : s.d;
  $('tutBar').style.width = ((done ? steps.length : i) / steps.length * 100) + '%';
  $('tutSkip').classList.toggle('hide', done); $('tutSkip').textContent = cfg.skipLabel || 'Saltar paso';
  $('tutExit').textContent = done ? (cfg.exitLabel || 'Volver al menú') : 'Salir';
}
function next() { i++; if (i >= steps.length) { render(true); G.onMsg && G.onMsg(cfg.title ? 'Maniobra completada' : 'Tutorial completado', ''); return; } begin(); }
export function updateTutorial(dt) {
  if (!G.tutorial || i >= steps.length || !G.player) return;
  if (doneT > 0) { doneT -= dt; if (doneT <= 0) next(); return; }
  if (steps[i].ok(dt)) { doneT = 1.2; $('tutT').textContent = '✔ ' + steps[i].t; G.onMsg && G.onMsg('¡Bien hecho!', '', 0.9); }
}
export function stopTutorial(exit) { G.tutorial = false; G.godMode = false; $('tut').classList.add('hide'); if (exit && onExit) onExit(); }

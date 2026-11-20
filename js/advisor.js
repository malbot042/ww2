// Sugerencias de la IA aliada por radio: avisos cortos cuando ve algo útil para el jugador
import { G } from './state.js';
import { angDiff } from './util.js';
import { radio, zoneName } from './sound.js';

let t = 0, gap = 0;
const last = {};
const $ = id => document.getElementById(id);
let tipT = 0;

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const seen = o => !G.fog || o.visA !== false;
function where(P, p) {
  const a = angDiff(Math.atan2(p.x - P.p.x, p.z - P.p.z), P.h);
  return Math.abs(a) < 0.6 ? 'delante de ti' : Math.abs(a) > 2.4 ? 'detrás de ti' : a > 0 ? 'a tu izquierda' : 'a tu derecha';
}
function say(key, text, sub, cool = 50) {
  if (last[key] && G.time - last[key] < cool) return false;
  last[key] = G.time; gap = 14;
  radio(text, 'adv' + key, 10);
  const el = $('advTip'); if (el) { el.innerHTML = `<b>Mando</b> ${text}${sub ? `<small>${sub}</small>` : ''}`; el.classList.add('on'); tipT = 7; }
  return true;
}

export function resetAdvisor() { t = 3; gap = 8; for (const k in last) delete last[k]; tipT = 0; const el = $('advTip'); if (el) el.classList.remove('on'); }

export function updateAdvisor(dt) {
  if (tipT > 0) { tipT -= dt; if (tipT <= 0) $('advTip')?.classList.remove('on'); }
  const P = G.player, b = G.battle;
  if (!G.running || G.demo || !P || !P.alive || !b || b.kind === 'test' || G.tutorial || G.opts?.advisor === false) return;
  gap -= dt; t -= dt; if (t > 0 || gap > 0) return; t = 3;
  const foes = G.ents.filter(o => o.alive && !o.falling && o.side !== P.side && o.cls !== 'site' && seen(o));
  const mates = G.ents.filter(o => o.alive && o.side === P.side && o.dom !== 'static');

  // 1) un blindado o barco enemigo aislado cerca de ti
  if (P.dom === 'land' || P.dom === 'sea') {
    let best = null, bd = P.dom === 'sea' ? 1400 : 800;
    for (const o of foes) {
      if (o.dom !== P.dom || o.cls === 'inf' || o.submerged) continue;
      const d = dist(o.p, P.p); if (d > bd) continue;
      const alone = !foes.some(q => q !== o && q.dom !== 'air' && dist(q.p, o.p) < (P.dom === 'sea' ? 450 : 220));
      if (alone && o.s.hp >= (P.dom === 'sea' ? 300 : 260)) { best = o; bd = d; }
    }
    if (best && say('lone' + best.id, `El ${best.name} está solo, ${where(P, best.p)}.`, P.dom === 'sea' ? (P.s.torp ? 'Buen momento para torpedearlo: acércate por el través.' : 'Concentra el fuego en él.') : 'Atácalo por el lateral o por detrás: su frente es lo más duro.', 70)) return;
  }
  // 2) submarino detectado y tienes cargas de profundidad
  if (P.dom === 'sea' && P.s.dc) {
    const sub = foes.find(o => o.cls === 'sub' && dist(o.p, P.p) < 900);
    if (sub && say('sub', `Submarino detectado ${where(P, sub.p)}.`, 'Pasa por encima y suelta cargas de profundidad (C).', 60)) return;
  }
  // 3) bombarderos enemigos hacia nuestras posiciones
  if (P.dom === 'air' && P.s.guns) {
    const bomb = foes.find(o => o.dom === 'air' && o.cls === 'bomber' && dist(o.p, P.p) < 2200);
    if (bomb && say('bombers', `Bombarderos enemigos ${where(P, bomb.p)}.`, 'Intercéptalos antes de que suelten las bombas.', 60)) return;
  }
  // 4) zonas: una nuestra sin defensa con el enemigo cerca, o una libre que se puede tomar
  if (b.kind !== 'air' && G.objectives?.length) {
    const R = G.map.cfg.zoneR;
    for (const z of G.objectives) {
      const ours = mates.some(m => m.dom !== 'air' && dist(m.p, z.pos) < R * 1.6);
      const foeNear = foes.some(o => o.dom !== 'air' && dist(o.p, z.pos) < R * 3);
      if (z.owner === 'A' && !ours && foeNear && say('def' + z.k, `Zona ${zoneName(z.name)} sin defender y el enemigo se acerca.`, `Selecciona unidades y pulsa ${z.k + 1} para mandarlas allí.`, 80)) return;
      if (z.owner !== 'A' && !foes.some(o => o.dom !== 'air' && dist(o.p, z.pos) < R * 2.5) && !mates.some(m => dist(m.p, z.pos) < R * 1.2) && say('free' + z.k, `La zona ${zoneName(z.name)} está libre.`, `Buen momento para tomarla: pulsa ${z.k + 1} con unidades seleccionadas.`, 90)) return;
    }
  }
  // 5) llevas rato lejos del combate
  const near = foes.some(o => dist(o.p, P.p) < (P.dom === 'air' ? 1500 : P.dom === 'sea' ? 1600 : 900));
  P.idleT = near ? 0 : (P.idleT || 0) + 3;
  if (P.idleT >= 30) {
    const z = b.kind !== 'air' && G.objectives?.find(z => z.owner !== 'A');
    if (say('idle', 'Estás lejos del combate.', z ? `El frente está en la zona ${zoneName(z.name)}: pulsa M para ver el mapa.` : 'Pulsa M para ver dónde están los enemigos.', 60)) P.idleT = 0;
  }
}

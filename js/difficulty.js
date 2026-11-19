// Dificultad: solo modifica al enemigo (y los puntos de batalla aliados en «Fácil»)
import { G } from './state.js';

export const DIFFS = {
  easy: { n: 'Fácil', d: 'El enemigo hace un 25 % menos de daño, apunta peor, recarga más despacio, pide menos apoyo y no recibe refuerzos. +25 % de puntos de batalla aliados.', dmg: 0.75, err: 1.5, rof: 1.3, sup: 18, reinf: false, reinfK: 0, cmd: 14, tickets: 1.25, score: 0.75 },
  normal: { n: 'Medio', d: 'Equilibrado: el enemigo recarga un 10 % más despacio que tus unidades.', dmg: 1, err: 1, rof: 1.1, sup: 9, reinf: true, reinfK: 0.75, cmd: 7, tickets: 1, score: 1 },
  hard: { n: 'Difícil', d: 'El enemigo hace un 15 % más de daño, apunta mejor, recarga como tú, pide apoyo más a menudo, recibe refuerzos antes y reorganiza su plan más rápido. +25 % de puntuación.', dmg: 1.15, err: 0.85, rof: 1, sup: 7, reinf: true, reinfK: 0.85, cmd: 5, tickets: 1, score: 1.25 },
};
const NEUTRAL = { dmg: 1, err: 1, rof: 1, sup: 9, reinf: true, reinfK: 0.75, cmd: 7, tickets: 1, score: 1 };
// valores en vigor (neutros en el menú de fondo y en el campo de pruebas)
export function diff() {
  if (G.demo || (G.battle && G.battle.kind === 'test')) return NEUTRAL;
  return DIFFS[G.opts && G.opts.diff] || DIFFS.normal;
}
export const diffName = () => (DIFFS[G.opts && G.opts.diff] || DIFFS.normal).n;

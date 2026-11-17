// Campaña con progresión: veteranía de las unidades, puntos extra de despliegue y unidades desbloqueadas
import { G } from './state.js';
import { MODELS } from './data.js';

export const RANKS = [
  { n: 'Recluta', xp: 0, s: '' },
  { n: 'Regular', xp: 60, s: '★' },
  { n: 'Veterano', xp: 160, s: '★★' },
  { n: 'Élite', xp: 320, s: '★★★' },
];
export const rankOf = xp => RANKS.reduce((r, R, i) => (xp >= R.xp ? i : r), 0);
export const rankStars = e => (e && e.rank ? RANKS[e.rank].s : '');
// unidades que se desbloquean al ganar la batalla i de cada frente
export const UNLOCKS = {
  pacific: ['iowa', 'b17'],
  africa: ['sherman', 'b17'],
  europe: ['lancaster', 'washington'],
};

export function newCampaign(front, list) { return { front, list, i: 0, score: 0, vets: {}, bonus: 0, unlocked: [], snap: null }; }

function setRank(e, r) { e.rank = r; e.rofK = 1 + 0.06 * r; e.accK = 1 - 0.1 * r; }
// al empezar cada batalla: los veteranos de cada modelo ocupan las primeras unidades de ese modelo
export function applyVeterans() {
  const c = G.campaign; if (!c) return;
  c.snap = JSON.stringify({ vets: c.vets, bonus: c.bonus, unlocked: c.unlocked });
  const pools = {}; for (const k in c.vets) pools[k] = [...c.vets[k]].sort((a, b) => b - a);
  for (const e of G.ents) {
    if (e.side !== 'A' || e.support || e.dom === 'static' || e.cls === 'merchant') continue;
    const xp = (pools[e.key] || []).shift() || 0, r = rankOf(xp);
    e.xp = e.xp0 = xp; setRank(e, r);
    if (r) { e.s.hp = Math.round(e.s.hp * (1 + 0.06 * r)); e.hp = e.s.hp; }
  }
}
export function restoreSnapshot() { const c = G.campaign; if (c && c.snap) Object.assign(c, JSON.parse(c.snap)); }

// experiencia por derribos (la llama kill())
export function gainXp(by, victim) {
  if (!G.campaign || !by || by.side !== 'A' || by.support || by.xp === undefined) return;
  by.xp += victim.s.value;
  const r = rankOf(by.xp);
  if (r > by.rank) { setRank(by, r); if (G.onMsg && by === G.player) G.onMsg(`Ascenso: ${RANKS[r].n} ${RANKS[r].s}`, 'Más precisión y cadencia de fuego'); }
}

// al terminar: supervivientes guardan su experiencia, se reparten premios y desbloqueos
export function endCampaignBattle(win) {
  const c = G.campaign; if (!c) return null;
  const vets = {}, promos = [];
  for (const e of G.ents) {
    if (e.side !== 'A' || e.support || e.xp === undefined || !e.alive || e.falling) continue;
    const xp = e.xp + (win ? 20 : 10);
    (vets[e.key] = vets[e.key] || []).push(xp);
    if (rankOf(xp) > rankOf(e.xp0)) promos.push(`${e.name}: ${RANKS[rankOf(xp)].n} ${RANKS[rankOf(xp)].s}`);
  }
  c.vets = vets;
  let bonus = 0, unlocked = null;
  if (win) {
    bonus = 40 + G.stats.kills * 4; c.bonus += bonus;
    const u = UNLOCKS[c.front] && UNLOCKS[c.front][c.i];
    if (u && !c.unlocked.includes(u)) { c.unlocked.push(u); unlocked = MODELS[u].name; }
  }
  const nVet = Object.values(vets).flat().filter(x => rankOf(x) > 0).length;
  return { promos, bonus, unlocked, nVet };
}
export const vetCount = key => { const c = G.campaign; return c && c.vets[key] ? c.vets[key].filter(x => rankOf(x) > 0).length : 0; };

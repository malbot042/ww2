// Medallas, estrellas y resumen final de la batalla
import { G } from './state.js';
import { MODELS } from './data.js';
import { awardMedal, medalsSaved, setStars, starsOf } from './save.js';

const cnt = (st, f) => st.pk.filter(f).length;
// icono: forma sencilla dibujada en SVG; c = color de la cinta
export const MEDALS = [
  { id: 'first', n: 'Bautismo de fuego', d: 'Destruye tu primer enemigo.', c: '#9a8a5a', t: st => st.pk.length >= 1 },
  { id: 'ace', n: 'As del aire', d: 'Derriba 5 aviones en una misma batalla.', c: '#4f7fbf', t: st => cnt(st, k => k.dom === 'air') >= 5 },
  { id: 'subhunter', n: 'Cazador de submarinos', d: 'Hunde un submarino.', c: '#2f6f7a', t: st => cnt(st, k => k.cls === 'sub') >= 1 },
  { id: 'torpedo', n: 'Pez de acero', d: 'Hunde un barco con un torpedo.', c: '#3c5a8c', t: st => cnt(st, k => k.dom === 'sea' && k.kind === 'torp') >= 1 },
  { id: 'giant', n: 'Matagigantes', d: 'Hunde un acorazado o un portaaviones.', c: '#7a3c3c', t: st => cnt(st, k => k.cls === 'battleship' || k.cls === 'carrier') >= 1 },
  { id: 'tanks', n: 'Cazacarros', d: 'Destruye 5 carros en una misma batalla.', c: '#6b6b3a', t: st => cnt(st, k => k.cls === 'tank') >= 5 },
  { id: 'ram', n: 'Embestida', d: 'Daña a un enemigo embistiéndolo.', c: '#8c5a2f', t: st => st.rams >= 1 },
  { id: 'ammo', n: 'Santabárbara', d: 'Alcanza la munición de un enemigo.', c: '#b5452f', t: st => st.ammo >= 1 },
  { id: 'sharp', n: 'Buen tirador', d: 'Acierta al menos la mitad de 15 disparos o más (sin contar ametralladoras).', c: '#5a7a3c', t: st => st.gShots >= 15 && st.gHits / st.gShots >= 0.5 },
  { id: 'survivor', n: 'Superviviente', d: 'Gana sin que caiga ninguna unidad que manejes.', c: '#3c7a5a', t: (st, x) => x.win && st.pDeaths === 0 },
  { id: 'flawless', n: 'Victoria impecable', d: 'Gana perdiendo menos del 10 % de tus fuerzas.', c: '#c9a43a', t: (st, x) => x.win && x.loss < 0.1 },
  { id: 'hard', n: 'Veterano', d: 'Gana una batalla en dificultad difícil.', c: '#5a3c7a', t: (st, x) => x.win && x.diff === 'hard' },
  { id: 'stars3', n: 'Perfeccionista', d: 'Consigue 3 estrellas en una batalla.', c: '#d9a441', t: (st, x) => x.stars >= 3 },
  { id: 'campaign', n: 'Campaña completada', d: 'Gana todas las batallas de una campaña.', c: '#8c2f2f', t: (st, x) => x.campDone },
];
export function medalSvg(m, on = true) {
  return `<svg viewBox="0 0 40 52" class="mdl${on ? '' : ' off'}"><path d="M8 0h24l-6 18H14z" fill="${on ? m.c : '#777'}"/><path d="M14 0h4l-2 18h-2zM22 0h4l-2 18h-2z" fill="rgba(255,255,255,.35)"/><circle cx="20" cy="33" r="15" fill="${on ? '#d9b24a' : '#8a8a8a'}" stroke="${on ? '#8a6421' : '#555'}" stroke-width="2.5"/><path d="M20 23l3 6.5 7 .7-5.3 4.7 1.6 7L20 38.3l-6.3 3.6 1.6-7L10 30.2l7-.7z" fill="${on ? '#8a6421' : '#5a5a5a'}"/></svg>`;
}
export const starsHtml = (n, max = 3) => `<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(max - n)}</i></span>`;

// ★ ganar · ★★ ganar con menos del 30 % de bajas · ★★★ ganar con menos del 15 % en dificultad media o difícil
export function starsFor(win, loss, diffKey) { return !win ? 0 : loss < 0.15 && diffKey !== 'easy' ? 3 : loss < 0.3 ? 2 : 1; }
export const STAR_RULES = ['Ganar', 'Ganar con menos del 30 % de bajas', 'Ganar con menos del 15 % de bajas (dificultad media o difícil)'];

// fin de batalla: calcula todo y guarda estrellas y medallas
export function battleSummary(win, key, kind, campDone) {
  const st = G.stats;
  const aliveA = G.ents.filter(e => e.side === 'A' && e.alive && !e.support && e.dom !== 'static').length;
  const loss = st.lost / Math.max(1, aliveA + st.lost);
  const diffKey = G.opts.diff || 'medium';
  const stars = kind === 'test' ? 0 : starsFor(win, loss, diffKey);
  const starUp = kind !== 'test' && stars > 0 && setStars(key, stars);
  const x = { win, loss, diff: diffKey, stars, campDone };
  const fresh = kind === 'test' || G.demo ? [] : MEDALS.filter(m => { try { return m.t(st, x); } catch (e) { return false; } }).filter(m => awardMedal(m.id, { b: key }));
  return { loss, stars, starUp, best: starsOf(key), fresh };
}

// resumen: tus bajas por tipo, aciertos, daño y línea de tiempo de las zonas
const CLS_NAME = { tank: 'carros', inf: 'pelotones', atgun: 'cañones', fighter: 'cazas', bomber: 'bombarderos', destroyer: 'destructores', cruiser: 'cruceros', battleship: 'acorazados', carrier: 'portaaviones', sub: 'submarinos', pt: 'lanchas', aa: 'antiaéreos', site: 'instalaciones', battery: 'baterías' };
export function summaryHtml(sum) {
  const st = G.stats, by = {};
  st.pk.forEach(k => { const n = CLS_NAME[k.cls] || MODELS[k.key]?.type || k.cls; by[n] = (by[n] || 0) + 1; });
  const kills = Object.entries(by).map(([n, c]) => `${c} ${n}`).join(' · ') || 'ninguna';
  const acc = st.shots ? Math.round(Math.min(1, st.hits / st.shots) * 100) : null;
  const gacc = st.gShots ? Math.round(Math.min(1, st.gHits / st.gShots) * 100) : null;
  const rows = [
    ['Tus bajas', `${st.pk.length}`, kills],
    ['Aciertos', `${st.hits} de ${st.shots}`, acc === null ? 'sin disparos' : `precisión ${acc} %${gacc !== null && st.gShots !== st.shots ? ` · cañones ${gacc} %` : ''}`],
    ['Daño causado', `${Math.round(st.dealt)}`, `recibido ${Math.round(st.taken)}${st.pDeaths ? ` · caíste ${st.pDeaths} ${st.pDeaths === 1 ? 'vez' : 'veces'}` : ''}`],
    ['Bajas de tu bando', `${Math.round(sum.loss * 100)} %`, `${st.lost} unidades`],
  ];
  return `<div class="sumRows">${rows.map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><small>${c}</small></div>`).join('')}</div>${timelineSvg()}`;
}
function timelineSvg() {
  const tl = G.stats.tl; if (tl.length < 2) return '';
  const W = 600, nz = tl[0].z.length, T = tl[tl.length - 1].t || 1, zh = 14, top = 6;
  const max = Math.max(...tl.map(s => Math.max(s.A, s.E)), 1), ch = 60, cy = top + nz * (zh + 4) + 10;
  const col = { A: '#4f86c6', E: '#c8553d', N: '#9a9a8a' }, x = t => (t / T * W).toFixed(1);
  let strips = '';
  for (let k = 0; k < nz; k++) {
    for (let i = 0; i < tl.length - 1; i++) strips += `<rect x="${x(tl[i].t)}" y="${top + k * (zh + 4)}" width="${(x(tl[i + 1].t) - x(tl[i].t) + 0.6).toFixed(1)}" height="${zh}" fill="${col[tl[i].z[k]] || col.N}"/>`;
    strips += `<text x="-6" y="${top + k * (zh + 4) + 11}" text-anchor="end">${String.fromCharCode(65 + k)}</text>`;
  }
  const line = s => tl.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${(cy + ch - p[s] / max * ch).toFixed(1)}`).join('');
  const mins = Math.floor(T / 60), ticks = Array.from({ length: mins + 1 }, (_, m) => m).filter(m => m % Math.max(1, Math.ceil(mins / 6)) === 0).map(m => `<text x="${x(m * 60)}" y="${cy + ch + 14}" text-anchor="middle">${m} min</text>`).join('');
  return `<div class="tl"><div class="tlh"><b>Desarrollo de la batalla</b><span><i style="background:${col.A}"></i>Aliados <i style="background:${col.E}"></i>Enemigo <i style="background:${col.N}"></i>Neutral</span></div>
  <svg viewBox="-24 0 ${W + 30} ${cy + ch + 20}" class="tlsvg">${nz ? strips : ''}<text x="-6" y="${cy + 8}" text-anchor="end">pts</text><line x1="0" x2="${W}" y1="${cy + ch}" y2="${cy + ch}" stroke="currentColor" opacity=".25"/><path d="${line('A')}" fill="none" stroke="${col.A}" stroke-width="2.2"/><path d="${line('E')}" fill="none" stroke="${col.E}" stroke-width="2.2"/>${ticks}</svg>
  <p class="tln">${nz ? 'Arriba, quién controlaba cada zona; abajo, los puntos de batalla de cada bando.' : 'Puntos de batalla de cada bando.'}</p></div>`;
}
export function medalsListHtml() {
  const got = medalsSaved();
  return `<div class="mdls">${MEDALS.map(m => `<div class="md${got[m.id] ? '' : ' no'}">${medalSvg(m, !!got[m.id])}<div><b>${m.n}</b><span>${m.d}</span>${got[m.id] ? `<small>Conseguida el ${got[m.id].d}${got[m.id].n > 1 ? ` · ${got[m.id].n} veces` : ''}</small>` : ''}</div></div>`).join('')}</div>`;
}

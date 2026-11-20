// Escaramuza a medida: frente (mapa), tipo de batalla, tus unidades, las del enemigo y duración
import { G } from './state.js';
import { FRONTS, BATTLES, MODELS, KIND_NAME, specOf } from './data.js';
import { UNLOCKS } from './campaign.js';

const $ = id => document.getElementById(id);
const MAXU = 16, DOMS = { naval: ['sea'], air: ['air'], land: ['land'], combined: ['sea', 'air', 'land'] };
const DUR = [[300, '5 min'], [600, '10 min'], [900, '15 min'], [0, 'Sin límite']];
const st = { front: 'europe', kind: 'land', dur: 600, A: {}, E: {} };

// unidades que pueden salir en ese frente y tipo (las de sus batallas, más las que se desbloquean en su campaña)
function pool(front, kind, side) {
  const set = new Set();
  for (const [k, b] of Object.entries(BATTLES)) {
    if (b.front !== front || b.kind === 'test') continue;
    (side === 'A' ? b.allies : b.enemy).forEach(([u]) => set.add(u));
  }
  if (side === 'A') (UNLOCKS[front] || []).forEach(u => set.add(u));
  return [...set].filter(u => MODELS[u] && DOMS[kind].includes(specOf(u).dom) && MODELS[u].cls !== 'merchant');
}
const kindsOf = front => FRONTS[front].battles.filter(k => BATTLES[`${front}-${k}`]);
function defaults() {
  const b = BATTLES[`${st.front}-${st.kind}`];
  const keep = (list, side) => { const ok = new Set(pool(st.front, st.kind, side)); const o = {}; list.forEach(([u, n]) => { if (ok.has(u)) o[u] = n; }); return o; };
  st.A = keep(b.allies, 'A'); st.E = keep(b.enemy, 'E');
}
const total = side => Object.values(st[side]).reduce((a, b) => a + b, 0);

function unitRow(side, u) {
  const m = MODELS[u], n = st[side][u] || 0;
  return `<div class="skU${n ? ' on' : ''}"><span><b>${m.name}</b><i>${m.type}</i></span><span class="skN"><button data-s="${side}" data-u="${u}" data-d="-1">−</button><em>${n}</em><button data-s="${side}" data-u="${u}" data-d="1">+</button></span></div>`;
}
function render() {
  const f = FRONTS[st.front];
  $('skFront').innerHTML = Object.entries(FRONTS).map(([k, x]) => `<button class="${k === st.front ? 'on' : ''}" data-front="${k}">${x.name}</button>`).join('');
  $('skKind').innerHTML = kindsOf(st.front).map(k => `<button class="${k === st.kind ? 'on' : ''}" data-kind="${k}">${KIND_NAME[k]}</button>`).join('');
  $('skDur').innerHTML = DUR.map(([s, n]) => `<button class="${s === st.dur ? 'on' : ''}" data-dur="${s}">${n}</button>`).join('');
  const b = BATTLES[`${st.front}-${st.kind}`];
  $('skMap').textContent = `Mapa de ${b.title} (${b.year})${b.kind === 'air' ? ' · gana quien destruya las instalaciones del otro' : ' · gana quien controle las zonas o acabe con el otro'}`;
  for (const side of ['A', 'E']) {
    $('sk' + side).innerHTML = pool(st.front, st.kind, side).map(u => unitRow(side, u)).join('');
    $('sk' + side + 'n').textContent = `${total(side)} / ${MAXU}`;
  }
  $('skEname').textContent = f.enemyName;
  $('skGo').disabled = !total('A') || !total('E');
}
export function initSkirmish(launch) {
  $('skirm').addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.front) { st.front = t.dataset.front; if (!kindsOf(st.front).includes(st.kind)) st.kind = kindsOf(st.front)[0]; defaults(); }
    else if (t.dataset.kind) { st.kind = t.dataset.kind; defaults(); }
    else if (t.dataset.dur !== undefined) st.dur = +t.dataset.dur;
    else if (t.dataset.u) { const s = t.dataset.s, u = t.dataset.u, d = +t.dataset.d, n = (st[s][u] || 0) + d; if (d > 0 && total(s) >= MAXU) return; st[s][u] = Math.max(0, n); if (!st[s][u]) delete st[s][u]; }
    else if (t.id === 'skReset') defaults();
    else if (t.id === 'skGo') return start(launch);
    else return;
    render();
  });
}
export function openSkirmish() { if (!Object.keys(st.A).length) defaults(); render(); }
function start(launch) {
  const base = BATTLES[`${st.front}-${st.kind}`];
  const allies = Object.entries(st.A).filter(([, n]) => n > 0), enemy = Object.entries(st.E).filter(([, n]) => n > 0);
  if (!allies.length || !enemy.length) return;
  BATTLES.skirmish = { ...base, title: 'Escaramuza', year: base.title, allies, enemy, skirmish: true, timeLimit: st.dur || 0, convoy: undefined,
    brief: `Escaramuza en el mapa de ${base.title}. ${st.dur ? `Dura ${st.dur / 60} minutos: al final gana quien tenga más puntos de batalla.` : 'Sin límite de tiempo.'}` };
  launch('skirmish', false, { roster: allies, fog: $('skFog').checked });
}

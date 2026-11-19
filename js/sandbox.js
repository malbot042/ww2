// Campo de pruebas: elegir cualquier unidad, añadir blancos y enemigos, invulnerabilidad
import { G } from './state.js';
import { drillsFor, runDrill, DOM_NAME as DRILL_DOM } from './drills.js';
import { MODELS, CLS, FAC_NAME } from './data.js';
import { spawnUnit, spawnAA, spawnBattery, anchorFor, lockTarget } from './units.js';
import { setPlayer, removeEntity } from './battle.js';
import { V3, rnd } from './util.js';

const $ = id => document.getElementById(id);
const DOM_NAME = { sea: 'Naval', air: 'Aérea', land: 'Tanques' };
let wired = false, flash = () => {}, onPlayerChange = () => {};

function options(withStatics) {
  const groups = { sea: [], air: [], land: [] };
  for (const [k, m] of Object.entries(MODELS)) groups[CLS[m.cls].dom].push(`<option value="${k}">${m.name} · ${FAC_NAME[m.fac]}</option>`);
  let html = Object.entries(groups).map(([d, l]) => `<optgroup label="${DOM_NAME[d]}">${l.join('')}</optgroup>`).join('');
  if (withStatics) html += `<optgroup label="Defensas"><option value="battery">Batería costera</option><option value="aa">Antiaéreo</option></optgroup>`;
  return html;
}
const domOf = k => k === 'battery' || k === 'aa' ? 'static' : CLS[MODELS[k].cls].dom;

// posición válida delante del jugador para una unidad de un dominio dado
function spotAhead(dom, dist, side = 0) {
  const p = G.player || { p: V3(0, 0, 0), h: Math.PI };
  const a = p.h + side;
  const x = p.p.x + Math.sin(a) * dist, z = p.p.z + Math.cos(a) * dist;
  if (dom === 'air' || dom === 'static' && false) return V3(x, 0, z);
  const q = anchorFor({ dom: dom === 'static' ? 'land' : dom }, x, z);
  const B = G.map.bounds - 60; q.x = Math.max(-B, Math.min(B, q.x)); q.z = Math.max(-B, Math.min(B, q.z));
  return q;
}
function addUnit(key, side, passive, pos) {
  const dom = domOf(key);
  const at = pos || spotAhead(dom, dom === 'sea' ? 520 : dom === 'air' ? 420 : 280, rnd(-0.5, 0.5));
  let e;
  if (key === 'battery') e = spawnBattery(side, 'de', at.x, at.z, G.player ? Math.atan2(G.player.p.x - at.x, G.player.p.z - at.z) : 0);
  else if (key === 'aa') e = spawnAA(side, 'de', at.x, at.z);
  else {
    const h = G.player ? Math.atan2(G.player.p.x - at.x, G.player.p.z - at.z) + rnd(-1.2, 1.2) : 0;
    e = spawnUnit(key, side, at.x, at.z, h);
    e.order = side === 'A' ? { type: 'follow' } : { type: 'attack' };
    if (side === 'A') { e.slot = G.ents.filter(x => x.side === 'A').length; G.selection.add(e); }
  }
  if (passive && side === 'E' && e.dom !== 'static') { e.passive = true; e.passiveMove = $('sbMove').checked; }
  if (passive && e.dom === 'static') e.passive = true;
  return e;
}

export function initSandbox(opts) {
  // maniobras básicas guiadas
  $('sbDrill').innerHTML = ['sea', 'air', 'land'].map(d => `<optgroup label="${DRILL_DOM[d]}">${drillsFor(d).map(x => `<option value="${x.id}">${x.t}</option>`).join('')}</optgroup>`).join('');
  $('sbDrillGo').onclick = ev => { runDrill($('sbDrill').value, G.player && G.player.key, { clear: sandboxClear, quickTest }); ev.target.blur(); };
  $('sbDrill').addEventListener('change', () => $('sbDrill').blur());
  flash = opts.flash; onPlayerChange = opts.onPlayerChange;
  if (wired) return; wired = true;
  $('sbMe').innerHTML = options(false); $('sbUnit').innerHTML = options(true);
  const blur = ev => ev.target.blur();
  for (const id of ['sbMe', 'sbUnit', 'sbPassive', 'sbGod', 'sbMove']) $(id).addEventListener('change', blur);
  $('sbMe').addEventListener('change', () => changePlayer($('sbMe').value));
  $('sbEnemy').onclick = ev => { const e = addUnit($('sbUnit').value, 'E', $('sbPassive').checked); flash(`Enemigo: ${e.name}`, e.passive ? 'Pasivo' : 'Con IA', 1.2); ev.target.blur(); };
  $('sbAlly').onclick = ev => { const k = $('sbUnit').value; if (domOf(k) === 'static') { flash('Las defensas solo pueden ser enemigas', '', 1.4); return; } const e = addUnit(k, 'A', false); flash(`Aliado: ${e.name}`, 'Te sigue en formación', 1.2); ev.target.blur(); };
  $('sbTargets').onclick = ev => { targetSet(); ev.target.blur(); };
  $('sbClear').onclick = ev => { for (const e of G.ents.filter(x => x !== G.player && (x.side === 'E' || x.side === 'A'))) removeEntity(e); G.smokes.length = 0; flash('Campo despejado', '', 1); ev.target.blur(); };
  $('sbRepair').onclick = ev => { const p = G.player; if (p) { p.hp = p.s.hp; p.battery = 1; for (const k in p.cd) p.cd[k] = 0; p.ammo = { ...p.ammoMax }; p.mods = {}; p.repairing = 0; p.tur.forEach(t => { t.userData.dead = false; t.rotation.x = t.rotation.z = 0; }); } flash('Unidad reparada y rearmada', 'Vida, munición, averías y batería', 1.2); ev.target.blur(); };
  $('sbGod').addEventListener('change', () => { G.godMode = $('sbGod').checked; });
  // saltar a otro terreno del mapa mixto (al punto adecuado para la unidad: tierra, mar o aire)
  document.querySelectorAll('#sandbox [data-go]').forEach(b => b.onclick = ev => {
    const sp = G.map.extra.spots && G.map.extra.spots[b.dataset.go], p = G.player; if (!sp || !p) return;
    const [x, z] = sp[p.dom] || sp.land, at = anchorFor(p, x, z);
    p.p.x = at.x; p.p.z = at.z; if (p.dom === 'land') p.p.y = G.map.gy(at.x, at.z); p.speed = 0;
    G.focus.copy(p.p); flash(b.textContent, p.dom === 'sea' ? 'En el agua más cercana' : p.dom === 'air' ? 'Sobrevolando la zona' : 'En tierra firme', 1.2); ev.target.blur();
  });
}
export function sandboxStart() {
  $('sandbox').classList.remove('hide');
  $('sbMe').value = G.player.key; G.godMode = $('sbGod').checked;
  $('sbInfo').innerHTML = 'Dispara a un blanco para ver el daño.';
}
// prueba rápida desde el hangar: cambia a la unidad, la lleva a su terreno y pone blancos delante
export function quickTest(key, targets = true) {
  changePlayer(key);
  const e = G.player, m = MODELS[key], sp = G.map.extra.spots;
  if (sp) {
    const reg = e.dom === 'sea' ? 'trop' : m.fac === 'jp' ? 'trop' : m.fac === 'it' || (m.fac === 'uk' && /Crusader|Matilda|Grant|Valentine|6 libras|australiana/i.test(m.name)) ? 'des' : 'eur';
    const [x, z] = sp[reg][e.dom] || sp[reg].land, at = anchorFor(e, x, z);
    e.p.x = at.x; e.p.z = at.z; if (e.dom === 'land') e.p.y = G.map.gy(at.x, at.z);
    G.focus.copy(e.p);
  }
  $('sbMe').value = key;
  if (targets) targetSet();
}
export function sandboxClear() { for (const e of G.ents.filter(x => x !== G.player && (x.side === 'E' || x.side === 'A'))) removeEntity(e); G.smokes.length = 0; }
export function sandboxHide() { $('sandbox').classList.add('hide'); G.godMode = false; }
export function sandboxHit(e, zone, mult, dmg) {
  const side = zone === null || zone === undefined ? '' : ` · ${['frontal', 'lateral', 'trasero'][zone]} ×${mult.toFixed(2)}`;
  $('sbInfo').innerHTML = `Último impacto: <b>${Math.round(dmg)}</b> de daño${side}<br>${e.name}: ${Math.max(0, Math.round(e.hp))}/${e.s.hp}`;
}

function changePlayer(key) {
  const old = G.player, dom = domOf(key);
  let at;
  if (dom === old.dom) at = old.p.clone();
  else if (dom === 'air') at = V3(old.p.x, 0, old.p.z);
  else at = anchorFor({ dom }, old.p.x, old.p.z);
  const e = spawnUnit(key, 'A', at.x, at.z, old.h);
  setPlayer(e); removeEntity(old);
  if (dom === 'air') e.p.y = e.alt;
  onPlayerChange(e);
  flash(e.name, `${e.m.type} · ${FAC_NAME[e.fac]}`, 1.4);
}
// blancos pasivos alrededor, adecuados al dominio del jugador
function targetSet() {
  const p = G.player, dom = p.dom, passive = true;
  const list = dom === 'sea' ? ['kagero', 'hipper', 'sboot', 'u7c'] : dom === 'air' ? ['zero', 'bf109g', 'ju87', 'val', 'aa'] : ['pz4h', 'panther', 'tiger', 'stug', 'inf_de', 'pak40'];
  list.forEach((k, i) => {
    const kd = domOf(k);
    const dist = kd === 'sea' ? 450 + i * 120 : kd === 'air' ? 350 + i * 60 : kd === 'static' ? 300 : 180 + i * 50;
    const pos = spotAhead(kd, dist, (i - (list.length - 1) / 2) * 0.45);
    const e = addUnit(k, 'E', passive, pos);
    if (kd === 'land') e.h = rnd(0, 6.28), e.mesh.rotation.y = e.h; // orientaciones variadas para probar el blindaje
  });
  const first = G.ents.find(x => x.side === 'E' && x.alive);
  if (first && dom !== 'air') lockTarget(p, first);
  flash('Blancos fijos colocados', dom === 'land' ? 'Prueba a darles por delante, de lado y por detrás' : dom === 'sea' ? 'Ponte de costado para usar todas las torres' : 'Practica la puntería y el bombardeo', 2);
}

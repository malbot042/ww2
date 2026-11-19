import * as THREE from 'three';
import { rankStars } from './campaign.js';
import { envLabel } from './env.js';
import { G } from './state.js';
import { FRONTS } from './data.js';
import { orderLabel } from './battle.js';
import { bombImpact, lead } from './units.js';
import { canvasTex, V3, angDiff } from './util.js';
import { sightOf, SUPPORT, canUse , autoSupportKind } from './strategy.js';
import { losWhy, coverOf } from './physics.js';
import { torpLead } from './units.js';

const $ = id => document.getElementById(id);
let msgT = 0, hitT = 0, hurtT = 0, mmBg = null, squadT = 0, feed = [];

export function hudInit() {
  $('hud').classList.remove('hide');
  buildMinimap();
  feed = []; $('feed').innerHTML = '';
  const b = G.battle;
  $('tkNameE').textContent = FRONTS[b.front].enemyName;
  $('envTag').textContent = envLabel();
  $('zones').innerHTML = b.kind === 'air' ? '<span class="zl">Instalaciones</span>' : G.objectives.map(z => `<span class="z" id="z${z.k}">${z.name}</span>`).join('');
  renderSquad(true);
}
export function hudHide() { $('hud').classList.add('hide'); }
export function flash(a, b = '', t = 2.4) { $('msg').innerHTML = `${a}<small>${b}</small>`; $('msg').style.opacity = 1; msgT = t; }
// marca de impacto: cls = hit | armor | crit | ammo | cover | saved · las más importantes no se pisan con un impacto normal
const HIT_ICO = {
  hit: '<svg viewBox="0 0 24 24"><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  armor: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 7l10 10" stroke="currentColor" stroke-width="2.2"/></svg>',
  crit: '<svg viewBox="0 0 24 24"><path d="M12 1l2.8 6.5 7 .6-5.3 4.6 1.6 6.9L12 16l-6.1 3.6 1.6-6.9L2.2 8.1l7-.6z" fill="currentColor"/></svg>',
  ammo: '<svg viewBox="0 0 24 24"><path d="M12 1c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 0-6 1-8z" fill="currentColor"/></svg>',
  cover: '<svg viewBox="0 0 24 24"><path d="M12 2C7 6 5 10 5 14a7 7 0 0014 0c0-4-2-8-7-12zM12 9v13" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  saved: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="currentColor"/></svg>',
};
let hitPri = 0;
export function hitMark(txt, cls = 'hit', pri = 1, sub = '') {
  if (typeof cls === 'boolean') cls = cls ? 'armor' : 'hit';
  if (hitT > 0.35 && pri < hitPri) return;
  const h = $('hit'); h.innerHTML = `<span class="hi">${HIT_ICO[cls] || HIT_ICO.hit}</span><b>${txt}</b>${sub ? `<small>${sub}</small>` : ''}`;
  h.className = 'h-' + cls; h.style.opacity = 1; hitT = pri >= 3 ? 1.6 : pri >= 2 ? 1.2 : 0.8; hitPri = pri;
  h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop');
}
export function hurt() { $('vig').style.opacity = 1; hurtT = 0.3; }
export function addFeed(txt, side) { feed.unshift({ txt, side, t: 6 }); feed = feed.slice(0, 6); renderFeed(); }
function renderFeed() { $('feed').innerHTML = feed.map(f => `<div class="f ${f.side}">${f.txt}</div>`).join(''); }

function weaponLines(e) {
  const s = e.s, A = e.ammo, n = k => Math.floor(A[k] ?? 0);
  const cd = (v, k) => k !== undefined && n(k) < 1 ? '<b class="bad">AGOTADO</b>' : v <= 0 ? '<b class="ok">LISTO</b>' : `<b>${v.toFixed(1)} s</b>`;
  const cnt = k => A[k] !== undefined ? ` <i class="am">${n(k)}</i>` : '';
  const L = [];
  const main = A.ap !== undefined ? n(A.ap !== undefined ? e.ammoSel : 'ap') : 1;
  const aim = v => A.ap !== undefined && n('ap') + n('he') < 1 ? '<b class="bad">SIN MUNICIÓN</b>' : v > 0 ? '<b>' + v.toFixed(1) + ' s</b>' : !e.target ? '<b>SIN BLANCO</b>' : e.aimReady ? '<b class="ok">LISTO</b>' : '<b class="warn">APUNTANDO</b>';
  const ammoLine = () => A.ap !== undefined ? [G.opts?.mode !== 'veteran' && !e.ammoManual ? 'Munición (auto)' : `N · Munición`, `<b class="sel ${e.ammoSel === 'ap' ? 'on' : ''}">AP ${n('ap')}</b> <b class="sel ${e.ammoSel === 'he' ? 'on' : ''}">HE ${n('he')}</b>`] : null;
  if (e.cls === 'destroyer' || e.cls === 'cruiser' || e.cls === 'battleship') { L.push(['Espacio · Artillería', aim(e.cd.main)], ammoLine()); if (s.torp) L.push(['Shift · Torpedos' + cnt('torp'), cd(e.cd.torp, 'torp')]); if (s.dc) L.push(['C · Cargas de profundidad' + cnt('dc'), cd(e.cd.dc, 'dc')]); }
  else if (e.cls === 'carrier') { L.push(['Shift · Lanzar avión', `<b class="${e.hangar ? 'ok' : 'bad'}">${e.hangar} en hangar${e.cd.launch > 0 ? ' · ' + e.cd.launch.toFixed(0) + ' s' : ''}</b>`], ['Antiaéreos', '<b class="ok">AUTO</b>']); }
  else if (e.cls === 'pt') { L.push(['Espacio · Ametralladoras', '<b class="ok">AUTO</b>']); L.push(['Shift · Torpedos' + cnt('torp'), cd(e.cd.torp, 'torp')]); }
  else if (e.cls === 'sub') { L.push(['Espacio · Torpedos (proa)' + cnt('torp'), cd(e.cd.torp, 'torp')]); L.push(['Shift · Cañón de cubierta' + cnt('deck'), e.submerged ? '<b>—</b>' : cd(e.cd.main, 'deck')]); L.push(['C · ' + (e.submerged ? 'Emerger' : 'Sumergirse'), `<b class="${e.battery < 0.25 ? 'bad' : ''}">Batería ${Math.round(e.battery * 100)}%</b>`]); }
  else if (e.dom === 'air') {
    L.push(['Espacio · Ametralladoras' + cnt('guns'), n('guns') < 1 ? '<b class="bad">AGOTADO</b>' : '<b class="ok">AUTO</b>'], [s.heavy ? 'Shift · Ráfaga de bombas' + cnt('bomb') : 'Shift · Bomba' + cnt('bomb'), e.stick > 0 ? '<b class="ok">SOLTANDO</b>' : cd(e.cd.bomb, 'bomb')]); if (s.heavy) L.push(['Artilleros', `<b class="ok">${s.heavy.n} · AUTO</b>`]);
    const agl = Math.round(e.p.y - G.map.gy(e.p.x, e.p.z));
    if (G.ents.some(c => c.alive && c.cls === 'carrier' && c.side === e.side)) L.push(['L · Aterrizar en el portaaviones', '<b>baja de 60 m sobre él</b>']);
    L.push(['↑ picar · ↓ subir', `<b class="${agl < 30 ? 'bad blink' : ''}">Altitud ${agl} m${agl < 30 ? ' ¡BAJO!' : ''}</b>`]);
  }
  else if (e.cls === 'inf') { L.push(['Espacio · Fusiles', '<b class="ok">AUTO</b>'], [`Shift · ${e.fac === 'de' ? 'Panzerschreck' : e.fac === 'uk' ? 'PIAT' : e.fac === 'jp' ? 'Carga antitanque' : 'Bazuca'}` + cnt('rocket'), cd(e.cd.rocket, 'rocket')]); L.push(['Soldados', `<b>${Math.ceil(e.hp / e.s.hp * 6)}/6</b>`]); }
  else if (e.dom === 'land') { L.push(['Espacio · Cañón', aim(e.cd.main)], ammoLine()); if (e.cls === 'tank') L.push(['Shift · Humo', cd(e.cd.smoke)]); }
  if (G.env && G.env.dark && e.dom !== 'static') L.push(['J · Bengala', `<b class="${e.flares === 0 ? 'bad' : 'ok'}">${e.flares ?? 4} restantes</b>`]);
  // averías y control de daños
  const m = e.mods, chips = [];
  if (m.fire > 0) chips.push(`<span class="mod fire">Incendio ${Math.ceil(m.fire)} s</span>`);
  if (m.engine) chips.push('<span class="mod">Motor</span>'); if (m.rudder) chips.push('<span class="mod">Timón</span>');
  if (m.tracks > 0) chips.push(`<span class="mod">Orugas ${Math.ceil(m.tracks)} s</span>`); if (m.turret) chips.push('<span class="mod">Torreta</span>'); if (m.controls) chips.push('<span class="mod">Mandos</span>');
  const dead = e.tur.filter(t => t.userData.dead).length; if (dead && e.dom === 'sea') chips.push(`<span class="mod">${dead} torre${dead > 1 ? 's' : ''} fuera</span>`);
  let html = L.filter(Boolean).map(([a, b]) => `<div class="wp"><span>${a}</span>${b}</div>`).join('');
  if (e.cls !== 'inf') html += `<div class="wp"><span>K · Control de daños</span>${e.repairing > 0 ? `<b class="warn">REPARANDO ${e.repairing.toFixed(0)} s</b>` : e.cd.rep > 0 ? `<b>${Math.ceil(e.cd.rep)} s</b>` : chips.length ? '<b class="ok">LISTO</b>' : '<b>—</b>'}</div>`;
  if (chips.length) html += `<div class="mods">${chips.join('')}</div>`;
  if (e.atBase) html += '<div class="mods"><span class="mod base">En base: rearmando y reparando</span></div>';
  else if (e.rearming || (A.ap !== undefined && n('ap') + n('he') < 1)) html += '<div class="mods"><span class="mod">Sin munición: vuelve a la base (R verde)</span></div>';
  return html;
}
// a cubierto / te ven / oculto
const ICO = {
  tree: '<svg viewBox="0 0 24 24"><path d="M12 2l6 8h-3l4 6H5l4-6H6zM11 16h2v6h-2z" fill="currentColor"/></svg>',
  house: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z" fill="currentColor"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M3 21L21 3" stroke="currentColor" stroke-width="2.4"/></svg>',
};
function statusLine(e) {
  const b = [];
  const c = coverOf(e);
  if (c > 0.25) { const house = G.map.coverAt(e.p.x, e.p.z) >= 0.75; b.push(`<span class="st cov" title="Se te ve peor y parte de los disparos dan en la cobertura">${house ? ICO.house : ICO.tree}A cubierto${house ? ' (edificios)' : ''}</span>`); }
  else if (e.dom === 'land') b.push('<span class="st open">Al descubierto</span>');
  if (G.playerSeen === false) b.push(`<span class="st hid">${ICO.eyeOff}El enemigo no te ve</span>`);
  else if (G.playerSeen) b.push(`<span class="st seen">${ICO.eye}Te están viendo</span>`);
  return b.length ? `<div class="sts">${b.join('')}</div>` : '';
}
function targetPanel(e) {
  const t = e.target;
  if (e.dom === 'air') return '';
  if (!t || !t.alive) return `<div class="tg empty"><div class="tgh"><span>Sin blanco a tiro</span></div><div class="tgk"><kbd>T</kbd> buscar blanco · clic sobre un enemigo para fijarlo</div></div>`;
  const d = Math.round(t.p.distanceTo(e.p)), hp = Math.max(0, t.hp / t.s.hp);
  const why = losWhy(e, t);
  if (why) return `<div class="tg nolos"><div class="tgh"><span>Sin línea de tiro</span><b>${d} m</b></div>
    <div class="tgn">${t.name}<i>${t.m.type || ''}</i></div>
    <div class="tgk">${why === 'cover' ? 'Lo tapan setos, árboles o casas. Acércate o busca un hueco.' : 'Lo tapa el relieve (isla o colina). Rodéalo o sube a una loma.'}</div>
    <div class="tgk"><kbd>T</kbd> otro blanco · <kbd>Y</kbd> automático</div></div>`;
  let extra = '';
  if ((e.cls === 'destroyer' || e.cls === 'cruiser' || e.cls === 'battleship') && e.tur.length) { const b = e.bear || 0; extra = `<div class="wp"><span>Torres que apuntan</span><b class="${b === e.tur.length ? 'ok' : b ? '' : 'bad'}">${b}/${e.tur.length}</b></div>` + (b < e.tur.length ? '<div class="tgk">Ponte de costado para disparar con todas</div>' : ''); }
  if (e.dom === 'land' && t.cls === 'tank') {
    const fx = Math.sin(t.h), fz = Math.cos(t.h), dx = e.p.x - t.p.x, dz = e.p.z - t.p.z, l = Math.hypot(dx, dz) || 1, c = (dx * fx + dz * fz) / l;
    const zi = c > 0.62 ? 0 : c < -0.62 ? 2 : 1, m = t.s.armor[zi];
    extra = `<div class="wp"><span>Le das por ${['delante', 'el lateral', 'detrás'][zi]}</span><b class="${m < 0.8 ? 'bad' : m > 1.3 ? 'ok' : ''}">daño ×${m.toFixed(2)}</b></div>`;
  }
  return `<div class="tg ${e.lock ? 'lock' : ''}"><div class="tgh"><span>${e.lock ? 'Blanco fijado' : 'Blanco automático'}</span><b>${d} m</b></div>
    <div class="tgn">${t.name}<i>${t.m.type || ''}</i></div><div class="bar"><i style="width:${hp * 100}%;background:${hp < 0.35 ? 'var(--red)' : '#d9a441'}"></i></div>${extra}
    <div class="tgk"><kbd>T</kbd> siguiente · <kbd>Y</kbd> automático · clic para fijar</div></div>`;
}
// objetivo A/B/C al que va la mayor parte de la selección
export function orderedZone() {
  const c = [0, 0, 0]; for (const e of G.selection) if (e.alive && e.order.type === 'zone') c[e.order.k]++;
  const m = Math.max(...c); return m ? c.indexOf(m) : -1;
}
function renderSquad(force) {
  const allies = G.ents.filter(e => e.side === 'A' && e.dom !== 'static' && !e.support);
  $('squad').innerHTML = allies.map(e => {
    const hp = Math.max(0, e.hp / e.s.hp), me = e === G.player, sel = G.selection.has(e);
    return `<div class="sq ${me ? 'me' : ''} ${sel ? 'sel' : ''} ${e.alive ? '' : 'dead'}" data-id="${e.id}"><div class="sqn">${me ? '▶ ' : ''}${e.name}${e.rank ? ` <i class="rk">${rankStars(e)}</i>` : ''}</div><div class="sqo">${e.alive ? (me ? 'Bajo tu mando' : orderLabel(e.order, e.queue)) + (e.retreating ? ' · retirada' : '') + (e.submerged ? ' · sumergido' : '') : 'Destruido'}</div><div class="bar"><i style="width:${hp * 100}%;background:${hp < 0.35 ? 'var(--red)' : 'var(--hp)'}"></i></div></div>`;
  }).join('');
}
export function updateHud(dt) {
  const e = G.player;
  if (e) {
    $('uName').textContent = e.name + (e.rank ? ' ' + rankStars(e) : ''); $('uType').textContent = `${e.m.type} · ${e.fac === 'us' ? 'EE. UU.' : e.fac === 'uk' ? 'Reino Unido' : ''}`;
    const hp = Math.max(0, e.hp / e.s.hp); $('uHp').style.width = hp * 100 + '%'; $('uHp').style.background = hp < 0.35 ? 'var(--red)' : 'var(--hp)';
    const k = e.s.dispK || 1, kmh = e.dom === 'sea' ? `${Math.round(Math.abs(e.speed) * 0.95 * k)} nudos` : `${Math.round(Math.abs(e.speed) * (e.dom === 'air' ? 3.6 : 1.5) * k)} km/h`;
    $('uW').innerHTML = statusLine(e) + weaponLines(e) + `<div class="wp"><span>Velocidad</span><b>${kmh}</b></div>` + targetPanel(e);
  }
  { const u = $('unit'), sq = $('squad'), sp = $('support'), top = u.offsetTop + u.offsetHeight + 8, bot = (sp.offsetHeight ? sp.offsetHeight + 96 : 70); const key = top + ':' + bot; if (sq.dataset.k !== key) { sq.style.top = top + 'px'; sq.style.maxHeight = `calc(100vh - ${top + bot}px)`; sq.dataset.k = key; } }
  // tickets
  const t = G.tickets, mx = G.ticketsMax;
  $('tkA').textContent = Math.ceil(t.A); $('tkE').textContent = Math.ceil(t.E);
  $('barA').style.width = (t.A / mx * 100) + '%'; $('barE').style.width = (t.E / mx * 100) + '%';
  const ordK = orderedZone();
  for (const z of G.objectives) { const el = $('z' + z.k); if (el) el.className = 'z ' + (z.owner === 'A' ? 'a' : z.owner === 'E' ? 'e' : '') + (z.na && z.ne ? ' c' : '') + (z.k === ordK ? ' ord' : ''); }
  if (G.battle.kind === 'air') $('zones').innerHTML = `<span class="zl a">${G.sitesA.filter(s => s.alive).length}/3</span><span class="zl">Instalaciones</span><span class="zl e">${G.sitesE.filter(s => s.alive).length}/3</span>`;
  $('clock').textContent = `${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')}`;
  squadT -= dt; if (squadT <= 0) { renderSquad(); renderSupport(); squadT = 0.3; }
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
  if (hitT > 0) { hitT -= dt; if (hitT <= 0) $('hit').style.opacity = 0; }
  if (hurtT > 0) { hurtT -= dt; if (hurtT <= 0) $('vig').style.opacity = 0; }
  for (const f of feed) f.t -= dt; if (feed.length && feed[feed.length - 1].t <= 0) { feed.pop(); renderFeed(); }
  drawMinimap();
}

// ---------- minimapa ----------
function buildMinimap() {
  const m = G.map, S = 220, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), B = m.bounds + 100;
  const theme = m.theme;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -B + i / S * 2 * B, z = -B + j / S * 2 * B, h = m.h(x, z), k = (j * S + i) * 4;
    let r, gg, b;
    const th = theme === 'mixed' ? ({ des: 'desert', eur: 'bocage', trop: 'tropical' })[m.region(x, z)] : theme;
    if (h < 0) { const d = Math.min(1, -h / 30); r = 60 - 35 * d; gg = 125 - 55 * d; b = 140 - 40 * d; }
    else if (th === 'desert') { r = 200 - h * 1.5; gg = 168 - h * 1.5; b = 112 - h; }
    else if (th === 'tropical' || h < 2.4) { r = h < 2 ? 220 : 60; gg = h < 2 ? 205 : 105 + h; b = h < 2 ? 160 : 50; }
    else { r = 105 + h; gg = 128 + h; b = 72; }
    img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0); mmBg = c;
}
let fogCv = null;
function fogCanvas(S) { if (!fogCv || fogCv.width !== S) { fogCv = document.createElement('canvas'); fogCv.width = fogCv.height = S; } return fogCv; }
// panel de apoyo (puntos de mando)
// barra de teclas del modo sencillo: solo lo útil en este momento
function renderSimpleBar() {
  if (G.opts?.mode === 'veteran') return;
  const e = G.player; if (!e) return;
  const kb = (ks, t) => `<span>${ks.map(k => `<kbd>${k}</kbd>`).join('')} ${t}</span>`;
  const sec = e.dom === 'air' ? (e.s.bomb ? 'Bombas' : e.s.rocket ? 'Cohetes' : '') : e.s.torp ? 'Torpedos' : e.cls === 'carrier' ? 'Lanzar avión' : e.dom === 'land' && e.cls !== 'inf' && e.cls !== 'atgun' ? 'Humo' : '';
  const L = [kb(['↑', '↓', '←', '→'], 'Mover'), kb(['Espacio'], 'Fuego')];
  if (sec) L.push(kb(['Shift'], sec));
  if (e.mods && Object.keys(e.mods).length || e.hp < e.s.hp * 0.5) L.push(kb(['K'], 'Reparar'));
  if (G.objectives && G.objectives.length) L.push(kb(['1', '2', '3'], G.battle.kind === 'air' ? 'Atacar A·B·C' : 'Objetivo A·B·C'));
  L.push(kb(['Q'], 'Seguidme'), kb(['E'], 'Ataque libre'));
  if (G.cp && canUse('A', autoSupportKind())) L.push(kb(['7'], 'Apoyo'));
  L.push(kb(['Tab'], 'Unidad'), kb(['M'], 'Mapa'), kb(['Intro'], 'Pausa táctica'), kb(['P'], 'Ayuda'));
  const h = L.join(''); if ($('ordSim').dataset.h !== h) { $('ordSim').innerHTML = h; $('ordSim').dataset.h = h; }
}
function renderSupport() {
  renderSimpleBar();
  if (!G.cp) return;
  const sea = G.battle.kind === 'naval';
  const btn = (k, i) => { const s = SUPPORT[k], ok = canUse('A', k), cd = G.supCd.A[k] > 0 ? ` ${Math.ceil(G.supCd.A[k])} s` : ''; return `<button class="sup ${ok ? '' : 'off'}" data-sup="${k}"><kbd>${7 + i}</kbd>${k === 'barrage' && sea ? s.nameSea : s.name}<i>${s.cost}${cd}</i></button>`; };
  if (G.opts?.mode !== 'veteran') {
    const k = autoSupportKind(), s = SUPPORT[k], ok = canUse('A', k), cd = G.supCd.A[k] > 0 ? ` ${Math.ceil(G.supCd.A[k])} s` : '';
    $('support').innerHTML = `<div class="cp"><span>Puntos de mando</span><b>${Math.floor(G.cp.A)}</b></div><button class="sup ${ok ? '' : 'off'}" data-sup="${k}"><kbd>7</kbd>Apoyo: ${k === 'barrage' && sea ? s.nameSea : s.name}<i>${s.cost}${cd}</i></button>`;
  } else $('support').innerHTML = `<div class="cp"><span>Puntos de mando</span><b>${Math.floor(G.cp.A)}</b></div>${['barrage', 'air', 'reinf'].map(btn).join('')}`;
}
export function worldToMM(x, z) { const B = G.map.bounds + 100, S = $('mm').width; return [(x + B) / (2 * B) * S, (z + B) / (2 * B) * S]; }
function drawMinimap() {
  const cv = $('mm'), g = cv.getContext('2d'), S = cv.width;
  g.drawImage(mmBg, 0, 0, S, S);
  if (G.fog) { // zonas fuera de la vista de tus unidades, en sombra
    const fc = fogCanvas(S), f = fc.getContext('2d');
    f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, S, S); f.fillStyle = 'rgba(8,10,12,0.55)'; f.fillRect(0, 0, S, S);
    f.globalCompositeOperation = 'destination-out';
    for (const e of G.ents) { if (!e.alive || e.side !== 'A') continue; const [x, y] = worldToMM(e.p.x, e.p.z), r = sightOf(e) / (2 * (G.map.bounds + 100)) * S; const gr = f.createRadialGradient(x, y, r * 0.7, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gr; f.beginPath(); f.arc(x, y, r, 0, 7); f.fill(); }
    g.drawImage(fc, 0, 0);
  }
  g.font = 'bold 12px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const z of G.objectives) { const [x, y] = worldToMM(z.pos.x, z.pos.z), r = G.map.cfg.zoneR / (2 * (G.map.bounds + 100)) * S; g.strokeStyle = z.owner === 'A' ? '#4a90e8' : z.owner === 'E' ? '#e0503f' : '#ddd'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.fillText(z.name, x, y); }
  for (const e of G.ents) {
    if (!e.alive || e.cls === 'aa' || e.gone) continue;
    if (e.side === 'E' && G.fog && e.visA === false) { // última posición conocida
      if (e.seenA !== undefined && G.time - e.seenA < 25) { const [x, y] = worldToMM(e.lastA.x, e.lastA.z); g.strokeStyle = 'rgba(255,82,70,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke(); }
      continue;
    }
    const [x, y] = worldToMM(e.p.x, e.p.z);
    g.fillStyle = e === G.player ? '#ffffff' : e.side === 'A' ? '#5aa2ff' : '#ff5246';
    g.globalAlpha = e.submerged ? 0.5 : 1;
    if (e.cls === 'site') { g.fillRect(x - 5, y - 5, 10, 10); g.fillStyle = '#000'; g.fillText(e.label, x, y + 1); }
    else if (e.dom === 'air') { g.beginPath(); g.moveTo(x + Math.sin(e.h) * 5, y + Math.cos(e.h) * 5); g.lineTo(x + Math.sin(e.h + 2.5) * 4, y + Math.cos(e.h + 2.5) * 4); g.lineTo(x + Math.sin(e.h - 2.5) * 4, y + Math.cos(e.h - 2.5) * 4); g.fill(); }
    else { g.save(); g.translate(x, y); g.rotate(-e.h); g.fillRect(-1.8, -4, 3.6, 8); g.restore(); }
    g.globalAlpha = 1;
  }
  // bases de reabastecimiento aliadas
  if (G.bases && G.bases.A) for (const dom in G.bases.A) { const b = G.bases.A[dom], [x, y] = worldToMM(b.x, b.z); g.strokeStyle = '#7fd66b'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke(); g.fillStyle = '#7fd66b'; g.fillText('R', x, y + 1); }
  // objetivo ordenado en amarillo
  const ok = orderedZone();
  if (ok >= 0) {
    if (G.battle.kind === 'air') { const s = G.sitesE[ok]; if (s) { const [x, y] = worldToMM(s.p.x, s.p.z); g.strokeStyle = '#ffd23a'; g.lineWidth = 2.5; g.strokeRect(x - 8, y - 8, 16, 16); } }
    else { const z = G.objectives[ok]; if (z) { const [x, y] = worldToMM(z.pos.x, z.pos.z), r = G.map.cfg.zoneR / (2 * (G.map.bounds + 100)) * S + 3; g.strokeStyle = '#ffd23a'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); } }
  }
  // blanco seleccionado en amarillo
  const P = G.player, T = P && P.alive && P.target && P.target.alive && P.dom !== 'air' ? P.target : null;
  if (T) {
    const [px, py] = worldToMM(P.p.x, P.p.z), [tx, ty] = worldToMM(T.p.x, T.p.z);
    g.strokeStyle = '#ffd23a'; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, py); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
    g.lineWidth = 2.5; g.beginPath(); g.arc(tx, ty, 7, 0, 7); g.stroke();
  }
  // encuadre de la cámara
  const [cx, cy] = worldToMM(G.focus.x, G.focus.z), w = G.zoom * 1.1 / (2 * (G.map.bounds + 100)) * S;
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.strokeRect(cx - w, cy - w * 0.75, w * 2, w * 1.5);
}

// ---------- indicadores 3D: mira de bombas y guía de torpedos ----------
let bombRing, torpLine, tgtRing, tgtMark, altLine, pip, pipLine, noLosTag;
const YEL = 0xffd23a;
export function initAimMarkers() {
  bombRing = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide }));
  bombRing.rotation.x = -Math.PI / 2; bombRing.renderOrder = 13; G.scene.add(bombRing);
  tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 4), new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  tgtRing.rotation.x = -Math.PI / 2; tgtRing.renderOrder = 13; G.scene.add(tgtRing);
  // marcador amarillo sobre el blanco (visible con cualquier cámara y zoom)
  const tex = canvasTex(64, g => { g.fillStyle = '#ffd23a'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, 10); g.lineTo(56, 10); g.lineTo(32, 50); g.closePath(); g.stroke(); g.fill(); });
  tgtMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  altLine = new THREE.Line(ag, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthTest: false })); altLine.frustumCulled = false; altLine.renderOrder = 12; G.scene.add(altLine);
  tgtMark.scale.set(0.028, 0.028, 1); tgtMark.renderOrder = 14; tgtMark.center.set(0.5, 0); G.scene.add(tgtMark);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  torpLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 12, gapSize: 10, transparent: true, opacity: 0.6, depthTest: false }));
  torpLine.renderOrder = 13; torpLine.frustumCulled = false; G.scene.add(torpLine);
  // punto de anticipación: dónde apuntar para acertar a un blanco en movimiento
  const ptex = canvasTex(64, g => { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 9; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 5, 0, 7); g.fill(); });
  pip = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex, sizeAttenuation: false, depthTest: false, transparent: true }));
  pip.scale.set(0.046, 0.046, 1); pip.renderOrder = 15; G.scene.add(pip);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  pipLine = new THREE.Line(pg, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 6, gapSize: 4, transparent: true, opacity: 0.8, depthTest: false }));
  pipLine.frustumCulled = false; pipLine.renderOrder = 15; G.scene.add(pipLine);
  // aviso sobre el blanco tapado
  const ntex = canvasTex(256, g => { g.clearRect(0, 0, 256, 256); g.font = 'bold 34px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText('SIN LÍNEA DE TIRO', 128, 140); g.fillStyle = '#d6d6d6'; g.fillText('SIN LÍNEA DE TIRO', 128, 140); });
  noLosTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, sizeAttenuation: false, depthTest: false, transparent: true }));
  noLosTag.scale.set(0.16, 0.16, 1); noLosTag.center.set(0.5, 0.3); noLosTag.renderOrder = 15; G.scene.add(noLosTag);
}
const GREEN = 0x6dff7a, WHITE = 0xffffff, GREY = 0x9a9a9a;
function setPip(p, from, ok) {
  pip.visible = pipLine.visible = true; pip.position.copy(p); pip.material.color.setHex(ok ? GREEN : WHITE);
  const a = pipLine.geometry.attributes.position.array; a[0] = from.x; a[1] = from.y; a[2] = from.z; a[3] = p.x; a[4] = p.y; a[5] = p.z;
  pipLine.geometry.attributes.position.needsUpdate = true; pipLine.computeLineDistances(); pipLine.material.color.setHex(ok ? GREEN : WHITE);
}
function updatePip(e) {
  pip.visible = pipLine.visible = false;
  if (!e || G.opts?.lead === false) return;
  // cazas: el enemigo más centrado delante del morro
  if (e.dom === 'air' && e.s.guns) {
    let best = null, ba = 0.9;
    for (const o of G.ents) {
      if (!o.alive || o.falling || o.side === e.side || o.dom !== 'air' || (G.fog && o.visA === false)) continue;
      const d = o.p.distanceTo(e.p); if (d > e.s.guns.range * 2.2) continue;
      const a = Math.abs(angDiff(Math.atan2(o.p.x - e.p.x, o.p.z - e.p.z), e.h)); if (a < ba) { ba = a; best = o; }
    }
    if (!best) return;
    const ld = lead(e.p, best, 700), d = best.p.distanceTo(e.p);
    const ok = Math.abs(angDiff(Math.atan2(ld.x - e.p.x, ld.z - e.p.z), e.h)) < 0.18 && Math.abs(best.p.y - e.p.y) < 60 && d < e.s.guns.range * 1.1;
    setPip(ld, best.p, ok); return;
  }
  const t = e.target; if (!t || !t.alive || e.noLos || t.dom !== 'sea' && e.dom === 'sea' && e.cls === 'sub') return;
  // submarino y lancha: los torpedos salen por la proa; el círculo marca dónde se cruzarán con el blanco
  if ((e.cls === 'sub' || e.cls === 'pt') && e.s.torp && t.dom === 'sea' && t.vel.lengthSq() > 1) {
    const ang = torpLead(e, t); let tp = t.p.clone();
    for (let k = 0; k < 3; k++) { const d = Math.hypot(tp.x - e.p.x, tp.z - e.p.z); tp = t.p.clone().addScaledVector(t.vel, d / 55); }
    tp.y = 1; const ok = Math.abs(angDiff(ang, e.h)) < 0.04;
    setPip(tp, V3(t.p.x, 1, t.p.z), ok); torpLine.material.color.setHex(ok ? GREEN : WHITE); return;
  }
  // artillería naval: dónde caerán los proyectiles (la torre ya apunta ahí)
  if (e.s.main && e.s.main.hs && (e.cls === 'destroyer' || e.cls === 'cruiser' || e.cls === 'battleship') && t.vel.lengthSq() > 4) {
    const d = Math.hypot(t.p.x - e.p.x, t.p.z - e.p.z), tt = d / e.s.main.hs, tp = t.p.clone().addScaledVector(t.vel, tt); tp.y = Math.max(t.p.y, 0) + 1;
    setPip(tp, V3(t.p.x, Math.max(t.p.y, 0) + 1, t.p.z), e.aimReady && e.cd.main <= 0);
  }
}
export function updateAimMarkers() {
  const e = G.player, ok = e && e.alive && !G.demo && !G.replayCam;
  bombRing.visible = altLine.visible = ok && e.dom === 'air';
  if (altLine.visible) { const a = altLine.geometry.attributes.position.array; a[0] = a[3] = e.p.x; a[2] = a[5] = e.p.z; a[1] = e.p.y - 1.5; a[4] = G.map.gy(e.p.x, e.p.z) + 0.5; altLine.geometry.attributes.position.needsUpdate = true; altLine.material.color.setHex(e.p.y - a[4] < 30 ? 0xff5040 : 0xffffff); }
  if (bombRing.visible) { const ip = bombImpact(e); const sc = 1 + Math.max(0, e.p.y - ip.y) / 110; bombRing.scale.set(sc, sc, sc); bombRing.position.set(ip.x, ip.y + 0.5, ip.z); bombRing.material.opacity = e.cd.bomb <= 0 && e.ammo.bomb >= 1 ? 0.85 : 0.25; }
  const t = ok && e.target && e.target.alive ? e.target : null;
  tgtRing.visible = tgtMark.visible = !!t && e.dom !== 'air';
  if (t) {
    tgtRing.material.opacity = e.aimReady && e.cd.main <= 0 ? 0.6 + 0.4 * Math.sin(performance.now() / 90) : e.lock ? 0.95 : 0.7;
    tgtMark.position.set(t.p.x, Math.max(t.p.y, 0) + (t.top || 6) + 4 + Math.sin(performance.now() / 200) * 1.5, t.p.z);
    tgtMark.material.opacity = e.lock ? 1 : 0.8;
  }
  if (t) { const s = Math.max(t.hl, t.hw) * 1.5 + 4; tgtRing.scale.set(s, s, s); tgtRing.rotation.z += 0.02; tgtRing.position.set(t.p.x, Math.max(t.p.y, 0) + 1, t.p.z); }
  if (t) { const nl = !!e.noLos; const c = nl ? GREY : YEL; tgtRing.material.color.setHex(c); tgtMark.material.color.setHex(nl ? GREY : WHITE); noLosTag.visible = nl; if (nl) noLosTag.position.copy(tgtMark.position); } else noLosTag.visible = false;
  torpLine.material.color.setHex(WHITE);
  updatePip(ok ? e : null);
  torpLine.visible = ok && e.dom === 'sea' && !!e.s.torp && (e.cls === 'sub' || !e.target || e.cls === 'pt');
  if (torpLine.visible) { const a = torpLine.geometry.attributes.position.array; a[0] = e.p.x + Math.sin(e.h) * e.hl; a[1] = 0.5; a[2] = e.p.z + Math.cos(e.h) * e.hl; a[3] = e.p.x + Math.sin(e.h) * 800; a[4] = 0.5; a[5] = e.p.z + Math.cos(e.h) * 800; torpLine.geometry.attributes.position.needsUpdate = true; torpLine.computeLineDistances(); }
}

import * as THREE from 'three';
import { G } from './state.js';
import { FRONTS } from './data.js';
import { orderLabel } from './battle.js';
import { bombImpact } from './units.js';

const $ = id => document.getElementById(id);
let msgT = 0, hitT = 0, hurtT = 0, mmBg = null, squadT = 0, feed = [];

export function hudInit() {
  $('hud').classList.remove('hide');
  buildMinimap();
  feed = []; $('feed').innerHTML = '';
  const b = G.battle;
  $('tkNameE').textContent = FRONTS[b.front].enemyName;
  $('zones').innerHTML = b.kind === 'air' ? '<span class="zl">Instalaciones</span>' : G.objectives.map(z => `<span class="z" id="z${z.k}">${z.name}</span>`).join('');
  renderSquad(true);
}
export function hudHide() { $('hud').classList.add('hide'); }
export function flash(a, b = '', t = 2.4) { $('msg').innerHTML = `${a}<small>${b}</small>`; $('msg').style.opacity = 1; msgT = t; }
export function hitMark(txt, bad = false) { const h = $('hit'); h.textContent = txt; h.className = bad ? 'bad' : ''; h.style.opacity = 1; hitT = 0.9; }
export function hurt() { $('vig').style.opacity = 1; hurtT = 0.3; }
export function addFeed(txt, side) { feed.unshift({ txt, side, t: 6 }); feed = feed.slice(0, 6); renderFeed(); }
function renderFeed() { $('feed').innerHTML = feed.map(f => `<div class="f ${f.side}">${f.txt}</div>`).join(''); }

function weaponLines(e) {
  const s = e.s, cd = v => v <= 0 ? '<b class="ok">LISTO</b>' : `<b>${v.toFixed(1)} s</b>`;
  const L = [];
  if (e.cls === 'destroyer' || e.cls === 'cruiser') { L.push(['Espacio · Artillería', cd(e.cd.main)]); if (s.torp) L.push(['Shift · Torpedos', cd(e.cd.torp)]); if (s.dc) L.push(['C · Cargas de profundidad', cd(e.cd.dc)]); }
  else if (e.cls === 'pt') { L.push(['Espacio · Ametralladoras', '<b class="ok">AUTO</b>']); L.push(['Shift · Torpedos', cd(e.cd.torp)]); }
  else if (e.cls === 'sub') { L.push(['Espacio · Torpedos (proa)', cd(e.cd.torp)]); L.push(['Shift · Cañón de cubierta', e.submerged ? '<b>—</b>' : cd(e.cd.main)]); L.push(['C · ' + (e.submerged ? 'Emerger' : 'Sumergirse'), `<b class="${e.battery < 0.25 ? 'bad' : ''}">Batería ${Math.round(e.battery * 100)}%</b>`]); }
  else if (e.dom === 'air') { L.push(['Espacio · Ametralladoras', '<b class="ok">AUTO</b>']); L.push(['Shift · Bomba', cd(e.cd.bomb)]); }
  else if (e.dom === 'land') { L.push(['Espacio · Cañón', cd(e.cd.main)]); L.push(['Shift · Humo', cd(e.cd.smoke)]); L.push(['T · Cambiar blanco', '']); }
  return L.map(([a, b]) => `<div class="wp"><span>${a}</span>${b}</div>`).join('');
}
function renderSquad(force) {
  const allies = G.ents.filter(e => e.side === 'A' && e.dom !== 'static');
  $('squad').innerHTML = allies.map(e => {
    const hp = Math.max(0, e.hp / e.s.hp), me = e === G.player, sel = G.selection.has(e);
    return `<div class="sq ${me ? 'me' : ''} ${sel ? 'sel' : ''} ${e.alive ? '' : 'dead'}" data-id="${e.id}"><div class="sqn">${me ? '▶ ' : ''}${e.name}</div><div class="sqo">${e.alive ? (me ? 'Bajo tu mando' : orderLabel(e.order)) + (e.submerged ? ' · sumergido' : '') : 'Destruido'}</div><div class="bar"><i style="width:${hp * 100}%;background:${hp < 0.35 ? 'var(--red)' : 'var(--hp)'}"></i></div></div>`;
  }).join('');
}
export function updateHud(dt) {
  const e = G.player;
  if (e) {
    $('uName').textContent = e.name; $('uType').textContent = `${e.m.type} · ${e.fac === 'us' ? 'EE. UU.' : e.fac === 'uk' ? 'Reino Unido' : ''}`;
    const hp = Math.max(0, e.hp / e.s.hp); $('uHp').style.width = hp * 100 + '%'; $('uHp').style.background = hp < 0.35 ? 'var(--red)' : 'var(--hp)';
    const kmh = e.dom === 'sea' ? `${Math.round(Math.abs(e.speed) * 0.95)} nudos` : `${Math.round(Math.abs(e.speed) * (e.dom === 'air' ? 3.6 : 1.9))} km/h`;
    $('uW').innerHTML = weaponLines(e) + `<div class="wp"><span>Velocidad</span><b>${kmh}</b></div>` + (e.target && e.target.alive ? `<div class="wp tgt"><span>Blanco</span><b>${e.target.name} · ${Math.round(e.target.p.distanceTo(e.p))} m</b></div>` : '');
  }
  // tickets
  const t = G.tickets, mx = G.ticketsMax;
  $('tkA').textContent = Math.ceil(t.A); $('tkE').textContent = Math.ceil(t.E);
  $('barA').style.width = (t.A / mx * 100) + '%'; $('barE').style.width = (t.E / mx * 100) + '%';
  for (const z of G.objectives) { const el = $('z' + z.k); if (el) el.className = 'z ' + (z.owner === 'A' ? 'a' : z.owner === 'E' ? 'e' : '') + (z.na && z.ne ? ' c' : ''); }
  if (G.battle.kind === 'air') $('zones').innerHTML = `<span class="zl a">${G.sitesA.filter(s => s.alive).length}/3</span><span class="zl">Instalaciones</span><span class="zl e">${G.sitesE.filter(s => s.alive).length}/3</span>`;
  $('clock').textContent = `${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')}`;
  squadT -= dt; if (squadT <= 0) { renderSquad(); squadT = 0.3; }
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
    if (h < 0) { const d = Math.min(1, -h / 30); r = 60 - 35 * d; gg = 125 - 55 * d; b = 140 - 40 * d; }
    else if (theme === 'desert') { r = 200 - h * 1.5; gg = 168 - h * 1.5; b = 112 - h; }
    else if (theme === 'tropical') { r = h < 2 ? 220 : 60; gg = h < 2 ? 205 : 105 + h; b = h < 2 ? 160 : 50; }
    else { r = 105 + h; gg = 128 + h; b = 72; }
    img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0); mmBg = c;
}
export function worldToMM(x, z) { const B = G.map.bounds + 100, S = $('mm').width; return [(x + B) / (2 * B) * S, (z + B) / (2 * B) * S]; }
function drawMinimap() {
  const cv = $('mm'), g = cv.getContext('2d'), S = cv.width;
  g.drawImage(mmBg, 0, 0, S, S);
  g.font = 'bold 12px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const z of G.objectives) { const [x, y] = worldToMM(z.pos.x, z.pos.z), r = G.map.cfg.zoneR / (2 * (G.map.bounds + 100)) * S; g.strokeStyle = z.owner === 'A' ? '#4a90e8' : z.owner === 'E' ? '#e0503f' : '#ddd'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.fillText(z.name, x, y); }
  for (const e of G.ents) {
    if (!e.alive || e.cls === 'aa') continue;
    const [x, y] = worldToMM(e.p.x, e.p.z);
    g.fillStyle = e === G.player ? '#ffffff' : e.side === 'A' ? '#5aa2ff' : '#ff5246';
    g.globalAlpha = e.submerged ? 0.5 : 1;
    if (e.cls === 'site') { g.fillRect(x - 5, y - 5, 10, 10); g.fillStyle = '#000'; g.fillText(e.label, x, y + 1); }
    else if (e.dom === 'air') { g.beginPath(); g.moveTo(x + Math.sin(e.h) * 5, y + Math.cos(e.h) * 5); g.lineTo(x + Math.sin(e.h + 2.5) * 4, y + Math.cos(e.h + 2.5) * 4); g.lineTo(x + Math.sin(e.h - 2.5) * 4, y + Math.cos(e.h - 2.5) * 4); g.fill(); }
    else { g.save(); g.translate(x, y); g.rotate(-e.h); g.fillRect(-1.8, -4, 3.6, 8); g.restore(); }
    g.globalAlpha = 1;
  }
  // encuadre de la cámara
  const [cx, cy] = worldToMM(G.focus.x, G.focus.z), w = G.zoom * 1.1 / (2 * (G.map.bounds + 100)) * S;
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.strokeRect(cx - w, cy - w * 0.75, w * 2, w * 1.5);
}

// ---------- indicadores 3D: mira de bombas y guía de torpedos ----------
let bombRing, torpLine, tgtRing;
export function initAimMarkers() {
  bombRing = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide }));
  bombRing.rotation.x = -Math.PI / 2; bombRing.renderOrder = 13; G.scene.add(bombRing);
  tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 4), new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  tgtRing.rotation.x = -Math.PI / 2; tgtRing.renderOrder = 13; G.scene.add(tgtRing);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  torpLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 12, gapSize: 10, transparent: true, opacity: 0.6, depthTest: false }));
  torpLine.renderOrder = 13; torpLine.frustumCulled = false; G.scene.add(torpLine);
}
export function updateAimMarkers() {
  const e = G.player, ok = e && e.alive && !G.demo;
  bombRing.visible = ok && e.dom === 'air';
  if (bombRing.visible) { const ip = bombImpact(e); bombRing.position.set(ip.x, ip.y + 0.5, ip.z); bombRing.material.opacity = e.cd.bomb <= 0 ? 0.85 : 0.25; }
  const t = ok && e.target && e.target.alive ? e.target : null;
  tgtRing.visible = !!t && e.dom !== 'air';
  if (t) { const s = Math.max(t.hl, t.hw) * 1.5 + 4; tgtRing.scale.set(s, s, s); tgtRing.rotation.z += 0.02; tgtRing.position.set(t.p.x, Math.max(t.p.y, 0) + 1, t.p.z); }
  torpLine.visible = ok && e.dom === 'sea' && !!e.s.torp && (e.cls === 'sub' || !e.target || e.cls === 'pt');
  if (torpLine.visible) { const a = torpLine.geometry.attributes.position.array; a[0] = e.p.x + Math.sin(e.h) * e.hl; a[1] = 0.5; a[2] = e.p.z + Math.cos(e.h) * e.hl; a[3] = e.p.x + Math.sin(e.h) * 800; a[4] = 0.5; a[5] = e.p.z + Math.cos(e.h) * 800; torpLine.geometry.attributes.position.needsUpdate = true; torpLine.computeLineDistances(); }
}

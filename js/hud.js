import * as THREE from 'three';
import { G } from './state.js';
import { FRONTS } from './data.js';
import { orderLabel } from './battle.js';
import { bombImpact } from './units.js';
import { canvasTex } from './util.js';

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
  const aim = v => v > 0 ? '<b>' + v.toFixed(1) + ' s</b>' : !e.target ? '<b>SIN BLANCO</b>' : e.aimReady ? '<b class="ok">LISTO</b>' : '<b class="warn">APUNTANDO</b>';
  if (e.cls === 'destroyer' || e.cls === 'cruiser') { L.push(['Espacio · Artillería', aim(e.cd.main)]); if (s.torp) L.push(['Shift · Torpedos', cd(e.cd.torp)]); if (s.dc) L.push(['C · Cargas de profundidad', cd(e.cd.dc)]); }
  else if (e.cls === 'pt') { L.push(['Espacio · Ametralladoras', '<b class="ok">AUTO</b>']); L.push(['Shift · Torpedos', cd(e.cd.torp)]); }
  else if (e.cls === 'sub') { L.push(['Espacio · Torpedos (proa)', cd(e.cd.torp)]); L.push(['Shift · Cañón de cubierta', e.submerged ? '<b>—</b>' : cd(e.cd.main)]); L.push(['C · ' + (e.submerged ? 'Emerger' : 'Sumergirse'), `<b class="${e.battery < 0.25 ? 'bad' : ''}">Batería ${Math.round(e.battery * 100)}%</b>`]); }
  else if (e.dom === 'air') { L.push(['Espacio · Ametralladoras', '<b class="ok">AUTO</b>']); L.push(['Shift · Bomba', cd(e.cd.bomb)]); }
  else if (e.dom === 'land') { L.push(['Espacio · Cañón', aim(e.cd.main)]); L.push(['Shift · Humo', cd(e.cd.smoke)]); }
  return L.map(([a, b]) => `<div class="wp"><span>${a}</span>${b}</div>`).join('');
}
function targetPanel(e) {
  const t = e.target;
  if (e.dom === 'air') return '';
  if (!t || !t.alive) return `<div class="tg empty"><div class="tgh"><span>Sin blanco a tiro</span></div><div class="tgk"><kbd>T</kbd> buscar blanco · clic sobre un enemigo para fijarlo</div></div>`;
  const d = Math.round(t.p.distanceTo(e.p)), hp = Math.max(0, t.hp / t.s.hp);
  let extra = '';
  if ((e.cls === 'destroyer' || e.cls === 'cruiser') && e.tur.length) { const b = e.bear || 0; extra = `<div class="wp"><span>Torres que apuntan</span><b class="${b === e.tur.length ? 'ok' : b ? '' : 'bad'}">${b}/${e.tur.length}</b></div>` + (b < e.tur.length ? '<div class="tgk">Ponte de costado para disparar con todas</div>' : ''); }
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
    const k = e.s.dispK || 1, kmh = e.dom === 'sea' ? `${Math.round(Math.abs(e.speed) * 0.95 * k)} nudos` : `${Math.round(Math.abs(e.speed) * (e.dom === 'air' ? 3.6 : 1.5) * k)} km/h`;
    $('uW').innerHTML = weaponLines(e) + `<div class="wp"><span>Velocidad</span><b>${kmh}</b></div>` + targetPanel(e);
  }
  { const u = $('unit'), sq = $('squad'), top = u.offsetTop + u.offsetHeight + 8; if (sq.dataset.top != top) { sq.style.top = top + 'px'; sq.style.maxHeight = `calc(100vh - ${top + 70}px)`; sq.dataset.top = top; } }
  // tickets
  const t = G.tickets, mx = G.ticketsMax;
  $('tkA').textContent = Math.ceil(t.A); $('tkE').textContent = Math.ceil(t.E);
  $('barA').style.width = (t.A / mx * 100) + '%'; $('barE').style.width = (t.E / mx * 100) + '%';
  const ordK = orderedZone();
  for (const z of G.objectives) { const el = $('z' + z.k); if (el) el.className = 'z ' + (z.owner === 'A' ? 'a' : z.owner === 'E' ? 'e' : '') + (z.na && z.ne ? ' c' : '') + (z.k === ordK ? ' ord' : ''); }
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
let bombRing, torpLine, tgtRing, tgtMark;
const YEL = 0xffd23a;
export function initAimMarkers() {
  bombRing = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide }));
  bombRing.rotation.x = -Math.PI / 2; bombRing.renderOrder = 13; G.scene.add(bombRing);
  tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 4), new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  tgtRing.rotation.x = -Math.PI / 2; tgtRing.renderOrder = 13; G.scene.add(tgtRing);
  // marcador amarillo sobre el blanco (visible con cualquier cámara y zoom)
  const tex = canvasTex(64, g => { g.fillStyle = '#ffd23a'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, 10); g.lineTo(56, 10); g.lineTo(32, 50); g.closePath(); g.stroke(); g.fill(); });
  tgtMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
  tgtMark.scale.set(0.028, 0.028, 1); tgtMark.renderOrder = 14; tgtMark.center.set(0.5, 0); G.scene.add(tgtMark);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  torpLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 12, gapSize: 10, transparent: true, opacity: 0.6, depthTest: false }));
  torpLine.renderOrder = 13; torpLine.frustumCulled = false; G.scene.add(torpLine);
}
export function updateAimMarkers() {
  const e = G.player, ok = e && e.alive && !G.demo;
  bombRing.visible = ok && e.dom === 'air';
  if (bombRing.visible) { const ip = bombImpact(e); bombRing.position.set(ip.x, ip.y + 0.5, ip.z); bombRing.material.opacity = e.cd.bomb <= 0 ? 0.85 : 0.25; }
  const t = ok && e.target && e.target.alive ? e.target : null;
  tgtRing.visible = tgtMark.visible = !!t && e.dom !== 'air';
  if (t) {
    tgtRing.material.color.setHex(YEL); tgtRing.material.opacity = e.aimReady && e.cd.main <= 0 ? 0.6 + 0.4 * Math.sin(performance.now() / 90) : e.lock ? 0.95 : 0.7;
    tgtMark.position.set(t.p.x, Math.max(t.p.y, 0) + (t.top || 6) + 4 + Math.sin(performance.now() / 200) * 1.5, t.p.z);
    tgtMark.material.opacity = e.lock ? 1 : 0.8;
  }
  if (t) { const s = Math.max(t.hl, t.hw) * 1.5 + 4; tgtRing.scale.set(s, s, s); tgtRing.rotation.z += 0.02; tgtRing.position.set(t.p.x, Math.max(t.p.y, 0) + 1, t.p.z); }
  torpLine.visible = ok && e.dom === 'sea' && !!e.s.torp && (e.cls === 'sub' || !e.target || e.cls === 'pt');
  if (torpLine.visible) { const a = torpLine.geometry.attributes.position.array; a[0] = e.p.x + Math.sin(e.h) * e.hl; a[1] = 0.5; a[2] = e.p.z + Math.cos(e.h) * e.hl; a[3] = e.p.x + Math.sin(e.h) * 800; a[4] = 0.5; a[5] = e.p.z + Math.cos(e.h) * 800; torpLine.geometry.attributes.position.needsUpdate = true; torpLine.computeLineDistances(); }
}

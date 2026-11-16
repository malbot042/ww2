import * as THREE from 'three';
import { G } from './state.js';
import { FRONTS, BATTLES, KIND_NAME, MODELS } from './data.js';
import { updateWorld } from './world.js';
import { startBattle, updateBattle, issueOrder, setPlayer, orderLabel } from './battle.js';
import { updateUnits, updateProjs } from './units.js';
import { initFx, updateFx, initAudio, setEngine } from './fx.js';
import { hudInit, hudHide, updateHud, flash, hitMark, hurt, addFeed, initAimMarkers, updateAimMarkers } from './hud.js';
import { clamp, V3, rnd } from './util.js';

const $ = id => document.getElementById(id);

// ---------- render ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 3, 9000);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2), sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { near: 10, far: 4000 });
scene.add(hemi, sun, sun.target);
Object.assign(G, { renderer, scene, camera, sun, hemi, keys: {}, keysOnce: new Set(), showSel: false });
const SUN_DIR = new THREE.Vector3(-0.45, 0.8, 0.35).normalize();
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
initFx(); initAimMarkers();

// ---------- callbacks del juego ----------
G.onMsg = (a, b) => flash(a, b);
G.onHurt = () => hurt();
G.onHit = (e, zone, mult) => { if (zone === null) return hitMark('Impacto'); hitMark(['Impacto frontal', 'Impacto lateral', 'Impacto trasero'][zone] + (mult < 0.8 ? ' · blindaje resiste' : mult > 1.3 ? ' · ¡crítico!' : ''), mult < 0.8); };
G.onKill = (e, by) => {
  if (G.demo) return;
  const who = by ? (by === G.player ? 'Tú' : by.name) : '';
  if (e.cls === 'aa') return;
  addFeed(`${e.side === 'E' ? '✕' : '✕'} ${e.name}${who ? ` <i>(${who})</i>` : ''}`, e.side === 'E' ? 'good' : 'bad');
  if (e.cls === 'site') flash(`${e.name} ${e.label} destruido`, e.side === 'E' ? 'Instalación enemiga eliminada' : 'Hemos perdido una instalación');
};
G.onZone = (z, prev) => { if (G.demo) return; if (z.owner === 'A') flash(`Objetivo ${z.name} tomado`, 'El enemigo pierde puntos cada segundo'); else if (z.owner === 'E') flash(`Objetivo ${z.name} perdido`, 'Recupéralo cuanto antes'); };
G.onEnd = res => setTimeout(() => showResults(res), 2200);
G.onDemoEnd = () => startDemo();

// ---------- cámara ----------
const camTarget = V3();
function updateCamera(dt) {
  const p = G.player;
  let tgt;
  if (G.demo) { const t = G.time * 0.05; tgt = V3(Math.sin(t) * 500, 0, Math.cos(t * 0.7) * 400); G.targetZoom = 950; }
  else if (G.strategic) tgt = V3(0, 0, 0);
  else if (p) { const look = G.zoom * 0.18 * (p.dom === 'air' ? 1.3 : 1); tgt = V3(p.p.x + Math.sin(p.h) * look, p.dom === 'air' ? p.p.y * 0.5 : Math.max(p.p.y, 0), p.p.z + Math.cos(p.h) * look); }
  else tgt = G.focus.clone();
  const zt = G.strategic ? (G.map.bounds * 3.1) : G.targetZoom;
  G.zoom += (zt - G.zoom) * Math.min(1, dt * 3);
  G.focus.lerp(tgt, Math.min(1, dt * (G.strategic ? 4 : 3.2)));
  const tilt = G.strategic ? 0.12 : G.demo ? 0.6 : 0.5;
  const sh = G.shake; G.shake *= Math.pow(0.03, dt);
  camera.position.set(G.focus.x + rnd(-sh, sh), G.focus.y + G.zoom, G.focus.z + G.zoom * tilt + rnd(-sh, sh));
  camera.lookAt(camTarget.copy(G.focus));
  if (scene.fog) { scene.fog.near = G.zoom * 1.4; scene.fog.far = G.zoom * (G.strategic ? 5 : 3.6) + 800; }
  // sombras alrededor del foco
  const half = clamp(G.zoom * 0.95, 140, 1400);
  const sc = sun.shadow.camera;
  if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
  sun.position.copy(G.focus).addScaledVector(SUN_DIR, 1800); sun.target.position.copy(G.focus);
}

// ---------- bucle ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (G.map) {
    const sim = G.running && !G.paused;
    if (sim || G.demo) { updateUnits(dt); updateProjs(dt); updateBattle(dt); updateFx(dt); }
    updateWorld(dt); updateCamera(dt);
    if (G.running) { updateHud(dt); updateAimMarkers(); const p = G.player; if (p && p.alive) setEngine(p.dom, Math.abs(p.speed) / p.s.max, !G.paused); }
    else { updateAimMarkers(); setEngine('sea', 0, false); }
  }
  G.keysOnce.clear();
  renderer.render(scene, camera);
}

// ---------- menús ----------
function show(id) { for (const s of ['scrFront', 'scrBattle', 'results', 'pause', 'loading']) $(s).classList.toggle('hide', s !== id); $('menu').classList.toggle('hide', !['scrFront', 'scrBattle', 'loading'].includes(id)); }
function rosterHtml(list) { return list.map(([k, n]) => `<li><b>${n}×</b> ${MODELS[k].name} <span>${MODELS[k].type}</span></li>`).join(''); }
function buildFrontMenu() {
  $('fronts').innerHTML = Object.entries(FRONTS).map(([k, f]) => `
    <button class="front f-${k}" data-front="${k}">
      <span class="fy">${f.years}</span><span class="fn">${f.name}</span><span class="fv">${f.vs}</span>
      <span class="fd">${f.desc}</span>
      <span class="fb">${f.battles.map(b => `<i>${KIND_NAME[b]}</i>`).join('')}</span>
    </button>`).join('');
  $('fronts').querySelectorAll('.front').forEach(b => b.onclick = () => { initAudio(); buildBattleMenu(b.dataset.front); });
}
function buildBattleMenu(fk) {
  const f = FRONTS[fk];
  $('bfName').textContent = f.name; $('bfVs').textContent = `${f.years} · ${f.vs}`;
  $('battles').innerHTML = f.battles.map((k, i) => { const key = `${fk}-${k}`, b = BATTLES[key]; return `
    <div class="battle">
      <div class="bh"><span class="bk">${i + 1}. ${KIND_NAME[k]}</span><span class="bt">${b.title}, ${b.year}</span></div>
      <p>${b.brief}</p>
      <div class="ros"><div><h4>Aliados (10)</h4><ul>${rosterHtml(b.allies)}</ul></div><div><h4>${f.enemyName} (10)</h4><ul>${rosterHtml(b.enemy)}</ul></div></div>
      <button class="btn" data-key="${key}">Desplegar</button>
    </div>`; }).join('') + (f.battles.length > 1 ? `<div class="battle camp"><div class="bh"><span class="bk">Campaña</span><span class="bt">Las ${f.battles.length} batallas seguidas</span></div><p>${f.battles.map(k => KIND_NAME[k]).join(' → ')}. La puntuación se acumula; si pierdes una batalla, la campaña termina.</p><button class="btn" data-camp="${fk}">Empezar campaña</button></div>` : '');
  $('battles').querySelectorAll('[data-key]').forEach(b => b.onclick = () => launch(b.dataset.key));
  $('battles').querySelectorAll('[data-camp]').forEach(b => b.onclick = () => { G.campaign = { front: fk, list: f.battles.map(k => `${fk}-${k}`), i: 0, score: 0 }; launch(G.campaign.list[0], true); });
  show('scrBattle');
}
function launch(key, keepCampaign = false) {
  if (!keepCampaign) G.campaign = null;
  show('loading'); $('loadTxt').textContent = `${BATTLES[key].title}, ${BATTLES[key].year}`;
  setTimeout(() => {
    G.running = false; G.paused = false; G.strategic = false;
    startBattle(key, false);
    const p = G.player; G.targetZoom = G.zoom = p.dom === 'land' ? 240 : p.dom === 'sea' ? 330 : 380;
    hudInit(); show(null); $('menu').classList.add('hide');
    G.running = true;
    flash(`${BATTLES[key].title}, ${BATTLES[key].year}`, G.battle.kind === 'air' ? 'Pulsa 1, 2 o 3 para enviar tu escuadrilla contra las instalaciones A, B o C' : 'Pulsa 1, 2 o 3 para enviar tu escuadra a los objetivos A, B o C', 5);
  }, 60);
}
function startDemo() {
  const keys = Object.keys(BATTLES); const key = keys[(Math.random() * keys.length) | 0];
  G.running = false; startBattle(key, true); G.zoom = G.targetZoom = 950;
}
function showResults(res) {
  G.running = false; hudHide();
  const b = G.battle, win = res === 'win';
  const score = Math.round(G.tickets.A + G.stats.kills * 50 - G.stats.lost * 20 + (win ? 500 : 0));
  if (G.campaign) G.campaign.score += score;
  $('resTitle').textContent = win ? 'Victoria' : 'Derrota';
  $('resTitle').className = win ? 'win' : 'lose';
  $('resSub').textContent = `${KIND_NAME[b.kind]} · ${b.title}, ${b.year}`;
  $('resStats').innerHTML = [
    ['Duración', `${Math.floor(G.time / 60)} min ${Math.floor(G.time % 60)} s`],
    ['Enemigos destruidos', `${G.stats.kills}`], ['Unidades perdidas', `${G.stats.lost}`],
    ['Puntos de batalla', `${Math.ceil(G.tickets.A)} contra ${Math.ceil(G.tickets.E)}`], ['Puntuación', `${score}`],
    ...(G.campaign ? [['Campaña acumulada', `${G.campaign.score}`]] : []),
  ].map(([a, v]) => `<div><span>${a}</span><b>${v}</b></div>`).join('');
  const c = G.campaign, next = c && win && c.i + 1 < c.list.length ? c.list[c.i + 1] : null;
  $('resNext').classList.toggle('hide', !next);
  if (next) { $('resNext').textContent = `Siguiente: ${KIND_NAME[BATTLES[next].kind]}`; $('resNext').onclick = () => { c.i++; launch(next, true); }; }
  if (c && (!win || !next)) { $('resSub').textContent += win ? ' · Campaña completada' : ' · Campaña terminada'; }
  $('resRetry').onclick = () => { if (c) { c.score -= score; } launch(G.battleKey, !!c); };
  $('resMenu').onclick = () => { G.campaign = null; toMenu(); };
  show('results');
}
function toMenu() { hudHide(); G.running = false; show('scrFront'); startDemo(); }
$('backFront').onclick = () => show('scrFront');

// ---------- entrada ----------
const ZONE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2 };
addEventListener('keydown', ev => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
  if (!G.keys[ev.code]) G.keysOnce.add(ev.code);
  G.keys[ev.code] = true;
  if (!G.running) { if (ev.code === 'Escape' && !$('pause').classList.contains('hide')) togglePause(); return; }
  const c = ev.code;
  if (c in ZONE_KEYS) { const n = issueOrder('zone', { k: ZONE_KEYS[c] }); if (n) flash(G.battle.kind === 'air' ? `Atacar instalación ${'ABC'[ZONE_KEYS[c]]}` : `Objetivo ${'ABC'[ZONE_KEYS[c]]}`, `${n} unidades en camino`); }
  else if (c === 'KeyQ') { const n = issueOrder('follow'); if (n) flash('Seguidme', `${n} unidades en formación`); }
  else if (c === 'KeyE') { const n = issueOrder('attack'); if (n) flash('Ataque libre', `${n} unidades buscan al enemigo`); }
  else if (c === 'KeyR') { const n = issueOrder('hold'); if (n) flash('Mantener posición', `${n} unidades`); }
  else if (c === 'KeyF') { const n = issueOrder('defend'); if (n) flash('Defender', G.battle.kind === 'air' ? 'Patrulla sobre nuestras instalaciones' : 'A nuestros objetivos'); }
  else if (c === 'Tab') cycleUnit(ev.shiftKey ? -1 : 1);
  else if (c === 'KeyZ') G.targetZoom = clamp(G.targetZoom / 1.25, 110, 2600);
  else if (c === 'KeyX') G.targetZoom = clamp(G.targetZoom * 1.25, 110, 2600);
  else if (c === 'KeyM') { G.strategic = !G.strategic; }
  else if (c === 'KeyP' || c === 'Escape') { if (c === 'Escape' && G.selection.size < allWingmen().length && !G.paused) { selectAll(); flash('Toda la escuadra seleccionada'); } else togglePause(); }
  else if (c === 'KeyH') togglePause();
});
addEventListener('keyup', ev => { G.keys[ev.code] = false; });
addEventListener('blur', () => { G.keys = {}; });
function allWingmen() { return G.ents.filter(e => e.alive && e.side === 'A' && e.dom !== 'static' && e !== G.player); }
function selectAll() { G.selection = new Set(allWingmen()); G.showSel = false; }
function cycleUnit(dir) {
  const list = G.ents.filter(e => e.alive && e.side === 'A' && e.dom !== 'static'); if (list.length < 2) return;
  const i = list.indexOf(G.player); const next = list[(i + dir + list.length) % list.length];
  setPlayer(next); flash(next.name, next.m.type, 1.4);
}
function togglePause() {
  if (!G.running && $('pause').classList.contains('hide')) return;
  G.paused = !G.paused; $('pause').classList.toggle('hide', !G.paused);
  if (G.paused) G.running = true;
}
$('resume').onclick = () => togglePause();
$('quit').onclick = () => { G.paused = false; $('pause').classList.add('hide'); G.campaign = null; toMenu(); };

// ---------- ratón (opcional) ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); const p = V3(); return ray.ray.intersectPlane(plane, p) ? p : null; }
function screenOf(e) { const v = e.p.clone(); v.y = Math.max(v.y, 0); v.project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }
let drag = null;
canvas.addEventListener('contextmenu', ev => ev.preventDefault());
canvas.addEventListener('wheel', ev => { if (!G.running) return; G.targetZoom = clamp(G.targetZoom * (ev.deltaY > 0 ? 1.15 : 1 / 1.15), 110, 2600); ev.preventDefault(); }, { passive: false });
canvas.addEventListener('mousedown', ev => { if (!G.running) return; if (ev.button === 0) drag = { x: ev.clientX, y: ev.clientY }; });
addEventListener('mousemove', ev => { if (!drag) return; const b = $('selbox'); const x0 = Math.min(drag.x, ev.clientX), y0 = Math.min(drag.y, ev.clientY); Object.assign(b.style, { display: 'block', left: x0 + 'px', top: y0 + 'px', width: Math.abs(ev.clientX - drag.x) + 'px', height: Math.abs(ev.clientY - drag.y) + 'px' }); });
addEventListener('mouseup', ev => {
  if (!drag || ev.button !== 0) return;
  const b = $('selbox'); b.style.display = 'none';
  const dx = Math.abs(ev.clientX - drag.x), dy = Math.abs(ev.clientY - drag.y);
  const mine = allWingmen();
  if (dx < 6 && dy < 6) {
    let best = null, bd = 28; for (const e of [...mine, G.player]) { if (!e) continue; const [sx, sy] = screenOf(e); const d = Math.hypot(sx - ev.clientX, sy - ev.clientY); if (d < bd) { bd = d; best = e; } }
    if (best && best !== G.player) { if (ev.shiftKey) { G.selection.has(best) ? G.selection.delete(best) : G.selection.add(best); } else G.selection = new Set([best]); G.showSel = true; flash(best.name, `Seleccionado · ${orderLabel(best.order)}`, 1.4); }
  } else {
    const x0 = Math.min(drag.x, ev.clientX), x1 = Math.max(drag.x, ev.clientX), y0 = Math.min(drag.y, ev.clientY), y1 = Math.max(drag.y, ev.clientY);
    const sel = mine.filter(e => { const [sx, sy] = screenOf(e); return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; });
    if (sel.length) { G.selection = new Set(sel); G.showSel = true; flash(`${sel.length} unidades seleccionadas`, 'Clic derecho para dar una orden', 1.6); }
  }
  drag = null;
});
canvas.addEventListener('dblclick', ev => { if (!G.running) return; for (const e of allWingmen()) { const [sx, sy] = screenOf(e); if (Math.hypot(sx - ev.clientX, sy - ev.clientY) < 28) { setPlayer(e); flash(e.name, 'Bajo tu mando', 1.4); return; } } });
canvas.addEventListener('mouseup', ev => {
  if (ev.button !== 2 || !G.running) return;
  const p = groundAt(ev.clientX, ev.clientY); if (!p) return;
  // ¿clic en un objetivo?
  if (G.battle.kind !== 'air') { const z = G.objectives.find(z => z.pos.distanceTo(V3(p.x, z.pos.y, p.z)) < G.map.cfg.zoneR); if (z) { const n = issueOrder('zone', { k: z.k }); if (n) flash(`Objetivo ${z.name}`, `${n} unidades en camino`); return; } }
  else { const k = G.sitesE.findIndex(s => s.alive && Math.hypot(s.p.x - p.x, s.p.z - p.z) < 80); if (k >= 0) { const n = issueOrder('zone', { k }); if (n) flash(`Atacar instalación ${'ABC'[k]}`, `${n} aviones`); return; } }
  const n = issueOrder('move', { x: p.x, z: p.z }); if (n) flash('Mover', `${n} unidades`, 1.2);
});
$('squad').addEventListener('click', ev => { const el = ev.target.closest('.sq'); if (!el) return; const e = G.ents.find(x => x.id === +el.dataset.id); if (!e || !e.alive || e === G.player) return; if (ev.shiftKey) { G.selection.has(e) ? G.selection.delete(e) : G.selection.add(e); } else G.selection = new Set([e]); G.showSel = true; });
$('squad').addEventListener('dblclick', ev => { const el = ev.target.closest('.sq'); if (!el) return; const e = G.ents.find(x => x.id === +el.dataset.id); if (e && e.alive) setPlayer(e); });

// ---------- arranque ----------
buildFrontMenu(); show('scrFront'); startDemo();
requestAnimationFrame(frame);
if (location.hash === '#debug') window.__ww2 = { G, launch, startBattle, step(dt) { updateUnits(dt); updateProjs(dt); updateBattle(dt); updateFx(dt); }, issueOrder, setPlayer };

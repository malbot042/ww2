import * as THREE from 'three';
import { DIFFS, diff } from './difficulty.js';
import { initSchool, openSchool, closeSchool, runDoctrineDemo, updateDoctrine, stopDoctrineDemo } from './doctrine.js';
import { initHangar, openHangar, closeHangar, updateHangar, renderHangar } from './hangar.js';
import { autoSupportKind } from './strategy.js';
import { initPost, resizePost, renderPost } from './post.js';
import { setupSplit, stopSplit, updateSplit, renderSplit } from './split.js';
import { startTutorial, updateTutorial, stopTutorial } from './tutorial.js';
import { loadSave, saveOptions, savedCampaign, saveCampaign, record, recordOf, clearSave, starsOf } from './save.js';
import { initTouch, updateTouch } from './touch.js';
import { updateGamepads, PAD_HELP } from './gamepad.js';
import { applyQuality, autoQuality, updateFps, QUALITY } from './quality.js';
import { recordReplay, updateReplay, startReplay, stopReplay, replaying, hasReplay, resetReplay, replayProgress } from './replay.js';
import { applyVolumes, updateMusic, musicHeat, RADIO, initSoundUI, radioStop } from './sound.js';
import { updateDamageFx } from './damagefx.js';
import { newCampaign, endCampaignBattle, restoreSnapshot, UNLOCKS } from './campaign.js';
import { G } from './state.js';
import { updateAdvisor, resetAdvisor } from './advisor.js';
import { initSkirmish, openSkirmish } from './skirmish.js';
import { initThreats, updateThreats, threatHurt, clearThreats } from './threats.js';
import { battleSummary, summaryHtml, starsHtml, medalSvg, STAR_RULES, medalsListHtml } from './medals.js';
import { FRONTS, BATTLES, KIND_NAME, MODELS, testKeyFor, specOf } from './data.js';
import { updateWorld } from './world.js';
import { updateEnv, launchFlare, envLabel } from './env.js';
import { startBattle, updateBattle, issueOrder, setPlayer, orderLabel } from './battle.js';
import { lockTarget, targetFilter, MOD_NAME } from './units.js';
import { initSandbox, sandboxStart, sandboxHide, sandboxHit, quickTest, sandboxClear } from './sandbox.js';
import { runDrill, DRILLS } from './drills.js';
import { openDeploy, initDeployUI, beginPlacement, endPlacement, placeUnit, applyPreset, PRESETS } from './deploy.js';
import { useSupport, updateVision, SUPPORT } from './strategy.js';
import { updateMarkers } from './battle.js';
import { updateUnits, updateProjs, spawnUnit } from './units.js';
import { initFx, updateFx, initAudio, setEngine, engineProfile } from './fx.js';
import { hudInit, hudHide, updateHud, flash, hitMark, hurt, addFeed, initAimMarkers, updateAimMarkers } from './hud.js';
import { clamp, V3, rnd, angDiff } from './util.js';

const $ = id => document.getElementById(id);

// ---------- render ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // solo el pase CRT final; la escena se dibuja a ~360 líneas (post.js)
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 3, 9000);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2), sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { near: 10, far: 4000 });
scene.add(hemi, sun, sun.target);
Object.assign(G, { renderer, scene, camera, sun, hemi, keys: {}, keysOnce: new Set(), showSel: false });
const SUN_DIR = new THREE.Vector3(-0.45, 0.8, 0.35).normalize();
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); resizePost(); }
initPost(renderer);
addEventListener('resize', resize); resize();
initFx(); initAimMarkers(); initThreats();

// ---------- callbacks del juego ----------
G.onMsg = (a, b) => flash(a, b);
const CRIT_MARK = { engine: ['¡Motor!', 'Irá más lento'], rudder: ['¡Timón!', 'Le cuesta girar'], fire: ['¡Incendio!', 'Pierde vida poco a poco'], tracks: ['¡Orugas rotas!', 'Inmovilizado unos segundos'], turret: ['¡Torreta atascada!', 'Apunta mucho más lento'], controls: ['¡Mandos!', 'Vuela peor'], gun: ['¡Torre destruida!', 'Dispara con menos cañones'] };
G.onCrit = (e, m, by) => {
  if (G.demo) return;
  if (by && by === G.player && G.stats && e.side !== by.side) { G.stats.crits++; if (m === 'ammo') G.stats.ammo++; }
  if (by && by === G.player) { if (m === 'ammo') hitMark('¡SANTABÁRBARA!', 'ammo', 3, 'Impacto en su munición'); else hitMark(...(CRIT_MARK[m] ? [CRIT_MARK[m][0], 'crit', 2, CRIT_MARK[m][1]] : [`¡${MOD_NAME[m]}!`, 'crit', 2])); }
  if (e === G.player) flash(m === 'fire' ? '¡Incendio!' : `¡${MOD_NAME[m]}!`, m === 'tracks' ? 'Se reparan solas en unos segundos' : m === 'ammo' ? 'Gran daño e incendio · pulsa K para apagarlo' : 'Pulsa K para control de daños', 2);
};
G.onCover = (e, by) => {
  if (G.demo) return;
  if (by && by === G.player) hitMark('Da en la cobertura', 'cover', 1, 'Setos, árboles o casas protegen al blanco');
  else if (e === G.player) hitMark('La cobertura te protege', 'saved', 1);
};
G.onHurt = (dir, by) => { threatHurt(dir, by); hurt(); musicHeat(0.06); const p = G.player; if (p && p.hp < p.s.hp * 0.3) RADIO.hurt(); };
G.onHit = (e, zone, mult, dmg, kind) => {
  if (G.battle && G.battle.kind === 'test') sandboxHit(e, zone, mult, dmg);
  if (kind === 'ammo') return;
  if (kind === 'ram') return hitMark('¡Embestida!', 'crit', 2);
  if (zone === null) return hitMark('Impacto', 'hit', 1);
  const where = ['frontal', 'lateral', 'trasero'][zone];
  if (mult < 0.8) return hitMark('Rebota en el blindaje', 'armor', 1, zone === 0 ? 'El frente es lo más duro: busca el lateral o la espalda' : `Impacto ${where} · daño ×${mult.toFixed(1)}`);
  if (mult > 1.3) return hitMark(`¡Punto débil! Impacto ${where}`, 'hit', 1.5, `daño ×${mult.toFixed(1)}`);
  hitMark(`Impacto ${where}`, 'hit', 1);
};
G.onKill = (e, by) => {
  if (G.demo) return;
  if (G.opts.cine && !G.over && (e.s.value >= 60 || (by === G.player && e.s.value >= 40)) && e.p.distanceTo(G.focus) < G.zoom * 2.5) { G.slowT = 1.4; G.shake = Math.max(G.shake || 0, 1.5); }
  musicHeat(0.12);
  if (e.side === 'E' && by === G.player) RADIO.kill(); else if (e.side === 'A' && !e.support && e !== G.player && e.dom !== 'static') RADIO.lost(e);
  const who = by ? (by === G.player ? 'Tú' : by.name) : '';
  if (e.cls === 'aa') return;
  addFeed(`${e.side === 'E' ? '✕' : '✕'} ${e.name}${who ? ` <i>(${who})</i>` : ''}`, e.side === 'E' ? 'good' : 'bad');
  if (e.cls === 'site') flash(`${e.name} ${e.label} destruido`, e.side === 'E' ? 'Instalación enemiga eliminada' : 'Hemos perdido una instalación');
};
G.onZone = (z, prev) => { if (G.demo) return; if (z.owner) RADIO.zone(z, z.owner === 'A'); if (z.owner === 'A') flash(`Objetivo ${z.name} tomado`, 'El enemigo pierde puntos cada segundo'); else if (z.owner === 'E') flash(`Objetivo ${z.name} perdido`, 'Recupéralo cuanto antes'); };
G.onEnd = res => { RADIO.end(res === 'win'); setTimeout(() => showResults(res), 2200); };
G.onDemoEnd = () => startDemo();

// ---------- cámara ----------
// pitch: 1.1 ≈ cenital (63°), valores bajos = vista de persecución. yaw: relativo a la unidad en vistas bajas (0 = desde atrás).
const CAM_PRESETS = [
  { n: 'Cenital', pitch: 1.1, yaw: 0 }, { n: 'Desde atrás', pitch: 0.3, yaw: 0 },
  { n: 'Lateral izquierdo', pitch: 0.26, yaw: -Math.PI / 2 }, { n: 'Lateral derecho', pitch: 0.26, yaw: Math.PI / 2 },
  { n: 'Mirando hacia atrás', pitch: 0.28, yaw: Math.PI },
  { n: 'Hacia el blanco', pitch: 0.32, yaw: 0, aim: true },
];
// vista «hacia el blanco»: la cámara se pone detrás de tu unidad en la línea que va al blanco, así lo tienes siempre delante
function camAimTarget(p) {
  const c = G.cam, ok = o => o && o.alive && !o.falling && !o.submerged && o.side !== p.side && (!G.fog || o['vis' + p.side] !== false);
  const t = p.lock || p.target;
  if (ok(t)) return (c.aimT = t);
  if (ok(c.aimT) && c.aimT.p.distanceTo(p.p) < 3200 && (G.time - (c.aimChk || 0)) < 1.5) return c.aimT;
  c.aimChk = G.time;
  let best = null, bd = 2600;
  for (const o of G.ents) {
    if (!ok(o) || o.cls === 'site') continue;
    const d = o.p.distanceTo(p.p) * (p.dom === 'air' && o.dom !== 'air' ? 1.8 : 1);
    if (d < bd) { bd = d; best = o; }
  }
  return (c.aimT = best);
}
G.cam = { pitch: 1.1, yaw: 0, ang: 0, rel: false, preset: 0 };
const AIM_PRESET = 5;
export function setCamPreset(i, auto = false) {
  if (!auto && (G.cam.autoOn || G.cam.combatT > 0)) G.cam.autoSupp = true; // elección manual en pleno combate: no se pisa hasta que acabe
  const c = G.cam, p = CAM_PRESETS[i]; c.preset = i;
  const rel = p.pitch < 0.95;
  if (rel !== c.rel) c.rel = rel;
  c.pitch = p.pitch; c.yaw = p.yaw;
  $('camName').textContent = p.n; c.label = null; c.aimT = null;
  flash(`Cámara: ${p.n}`, auto ? (p.aim ? 'Automática: combate cerca' : 'Automática: sin combate cerca') : p.aim ? 'Tu unidad delante y el blanco al fondo (T cambia de blanco)' : '', auto ? 1 : 1.4);
}
const camTarget = V3();
// cámara automática: con combate cerca pasa sola a «Hacia el blanco» y vuelve a la vista que tenías al terminar
const AUTO_R = { land: 520, sea: 1500, air: 1000, static: 600 };
function autoCam(dt) {
  const c = G.cam, P = G.player;
  if (G.opts.autoCam === false || !P || !P.alive || G.strategic || G.split) { c.autoOn = false; return; }
  if (c.autoOn && c.preset !== AIM_PRESET) c.autoOn = false; // la cambiaste a mano: se respeta
  const R = AUTO_R[P.dom] || 600;
  const near = G.ents.some(o => o.alive && !o.falling && o.side !== P.side && o.cls !== 'site' && (!G.fog || o['vis' + P.side] !== false) && o.p.distanceTo(P.p) < (c.autoOn ? R * 1.3 : R) && (o.dom !== 'static' || o.target === P));
  c.combatT = near ? 4 : Math.max(0, (c.combatT || 0) - dt);
  if (c.autoSupp && c.combatT <= 0) c.autoSupp = false;
  if (!c.autoOn && near && c.preset === 0 && !c.autoSupp) { c.autoPrev = c.preset; setCamPreset(AIM_PRESET, true); c.autoOn = true; }
  else if (c.autoOn && c.combatT <= 0) { c.autoOn = false; setCamPreset(c.autoPrev || 0, true); }
}
function updateCamera(dt) {
  const p = G.replayCam || G.player, c = G.cam;
  if (G.replayCam) { c.yaw += 0.12 * dt; c.pitch += (0.55 - c.pitch) * Math.min(1, dt); }
  // WASD: inclinación y giro de la cámara
  if (G.running && !G.strategic) {
    if (G.keys.KeyW) c.pitch = Math.max(0.1, c.pitch - 0.9 * dt);
    if (G.keys.KeyS) c.pitch = Math.min(1.45, c.pitch + 0.9 * dt);
    if (G.keys.KeyA) c.yaw += 1.6 * dt;
    if (G.keys.KeyD) c.yaw -= 1.6 * dt;
    const rel = c.pitch < 0.95;
    if (rel !== c.rel && p) { c.yaw = rel ? angDiff(c.ang, p.h + Math.PI) : c.ang; c.rel = rel; }
  }
  let pitch = c.pitch, angT = c.rel && p ? p.h + Math.PI + c.yaw : c.yaw;
  const preset = CAM_PRESETS[c.preset] || {};
  const aimT = preset.aim && c.rel && p && !G.replayCam && !G.strategic && !G.demo ? camAimTarget(p) : null;
  let aimDir = null;
  if (aimT) {
    const dx = aimT.p.x - p.p.x, dz = aimT.p.z - p.p.z, dd = Math.hypot(dx, dz);
    if (dd > 25) { aimDir = Math.atan2(dx, dz); c.aimDir = aimDir; } else aimDir = c.aimDir ?? p.h;
    angT = aimDir + Math.PI + c.yaw;
  }
  const label = preset.aim ? (aimT ? `Hacia el blanco: ${aimT.name}` : 'Hacia el blanco (sin blanco)') : null;
  if (label && label !== c.label) { c.label = label; $('camName').textContent = label; }
  if (G.strategic || G.demo || !p) { pitch = G.strategic ? 1.42 : 1.03; angT = 0; }
  const t = clamp((pitch - 0.12) / (1.1 - 0.12), 0, 1.4);
  c.ang += angDiff(angT, c.ang) * Math.min(1, dt * (aimT ? 2.6 : c.rel ? 5 : 3));
  c.curPitch = (c.curPitch ?? pitch) + (pitch - (c.curPitch ?? pitch)) * Math.min(1, dt * 4);
  const cp = c.curPitch, ct = clamp((cp - 0.12) / (1.1 - 0.12), 0, 1.4);
  let tgt;
  if (G.demo) { const tt = G.time * 0.05; tgt = V3(Math.sin(tt) * 500, 0, Math.cos(tt * 0.7) * 400); G.targetZoom = 950; }
  else if (G.strategic) tgt = V3(0, 0, 0);
  else if (p) {
    const look = G.zoom * 0.18 * (p.dom === 'air' ? 1.3 : 1) * Math.min(1, ct);
    // aviones: en cenital el foco queda entre el avión y el suelo; en las vistas bajas (desde atrás, laterales) va a la altura
    // del avión, para que no se salga de pantalla al subir (antes el foco acababa por encima: hasta un 30 % de la altitud)
    let fy = Math.max(p.p.y, 0);
    if (p.dom === 'air') { const base = 0.5 + 0.3 * clamp((p.p.y - 120) / 120, 0, 1), low = clamp((0.75 - ct) / 0.5, 0, 1); fy = p.p.y * (base + (1 - base) * low); }
    const hd = aimDir ?? p.h;
    tgt = V3(p.p.x + Math.sin(hd) * look, fy, p.p.z + Math.cos(hd) * look);
  } else tgt = G.focus.clone();
  const zt = G.strategic ? (G.map.bounds * 3.1) : G.targetZoom;
  G.zoom += (zt - G.zoom) * Math.min(1, dt * 3);
  G.focus.lerp(tgt, Math.min(1, dt * (G.strategic ? 4 : 3.2 + (1 - Math.min(1, ct)) * 9)));
  const D = G.zoom * (0.32 + 0.8 * ct);
  const sh = G.shake; G.shake *= Math.pow(0.03, dt);
  camera.position.set(G.focus.x + Math.sin(c.ang) * Math.cos(cp) * D + rnd(-sh, sh), G.focus.y + Math.sin(cp) * D, G.focus.z + Math.cos(c.ang) * Math.cos(cp) * D + rnd(-sh, sh));
  const gmin = Math.max(G.map.gy(camera.position.x, camera.position.z), 0) + 4;
  if (camera.position.y < gmin) camera.position.y = gmin;
  camTarget.copy(G.focus);
  if (ct < 1 && p && !G.strategic && !G.demo) { const k = 1 - ct, hd = aimDir ?? p.h; camTarget.x += Math.sin(hd) * D * 0.25 * k * Math.cos(c.yaw); camTarget.z += Math.cos(hd) * D * 0.25 * k * Math.cos(c.yaw); camTarget.y += (p.dom === 'air' ? 4 : p.top || 4) * k; }
  // con blanco: la mirada se inclina un poco hacia él (en altura también) para que no quede pegado al borde de arriba
  if (aimT && ct < 1) { const k = (1 - ct) * 0.3; camTarget.x += (aimT.p.x - camTarget.x) * k * 0.4; camTarget.z += (aimT.p.z - camTarget.z) * k * 0.4; camTarget.y += clamp(aimT.p.y - camTarget.y, -300, 300) * k; }
  camera.lookAt(camTarget);
  // plano lejano según la distancia: con los mapas ampliados, en el modo mapa la cámara queda a más de 9 km y lo recortaba todo
  const far = Math.max(9000, camera.position.distanceTo(camTarget) + G.map.bounds * 2.2);
  if (Math.abs(far - camera.far) > 200) { camera.far = far; camera.updateProjectionMatrix(); }
  if (scene.fog) { const low = 1 - Math.min(1, ct); scene.fog.near = G.zoom * (1.4 - low * 0.6) + low * 150; scene.fog.far = G.zoom * (G.strategic ? 5 : 3.6) + 800 + low * 900; const fk = G.strategic ? Math.max(0.6, G.env?.fogK ?? 1) : (G.env?.fogK ?? 1); scene.fog.near *= fk * fk; scene.fog.far *= fk; }
  // sombras alrededor del foco
  const half = clamp(G.zoom * 0.95, 140, 1400);
  const sc = sun.shadow.camera;
  if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
  sun.position.copy(G.focus).addScaledVector(G.env?.sunDir || SUN_DIR, 1800); sun.target.position.copy(G.focus);
}

// ---------- bucle ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min((now - last) / 1000, 0.05); last = now;
  updateGamepads();
  if (G.hangar) { updateHangar(rdt); updateMusic(rdt); updateFps(rdt); renderPost(renderer, () => renderHangar(renderer)); G.keysOnce.clear(); return; }
  if (G.map && replaying()) {
    updateReplay(rdt); updateWorld(rdt); updateCamera(rdt); updateMusic(rdt); updateAimMarkers();
    $('rpBar').style.width = (replayProgress() * 100).toFixed(1) + '%';
    renderPost(renderer, () => renderer.render(scene, camera)); G.keysOnce.clear(); return;
  }
  // cámara lenta en los grandes derribos
  const dt = G.slowT > 0 ? rdt * 0.3 : rdt; if (G.slowT > 0) G.slowT -= rdt;
  if (G.map) {
    const sim = G.running && !G.paused && !G.tactical && !G.deploying;
    if (sim) { recordReplay(dt); updateTutorial(dt); updateSplit(dt); updateDoctrine(dt); updateAdvisor(dt); }
    if (sim || G.demo) { updateUnits(dt); updateProjs(dt); updateBattle(dt); updateFx(dt); updateDamageFx(dt); }
    else if (G.deploying) { updateVision(dt); updateMarkers(); }
    updateWorld(dt); if (sim || G.demo) updateEnv(dt); if (sim) autoCam(dt); updateCamera(dt);
    updateThreats(sim ? dt : 0, camera);
    if (G.running) { updateHud(dt); updateAimMarkers(); const p = G.player; if (p && p.alive) setEngine(engineProfile(p), Math.abs(p.speed) / p.s.max, !G.paused && !G.tactical); }
    else { updateAimMarkers(); setEngine('ship', 0, false); }
    updateMusic(dt);
  }
  updateFps(rdt); updateTouch();
  G.keysOnce.clear();
  renderPost(renderer, rt => { if (G.split && G.running) renderSplit(renderer, scene, camera, rt); else renderer.render(scene, camera); });
}

// ---------- menús ----------
function show(id) { for (const s of ['scrFront', 'scrBattle', 'scrDeploy', 'scrSkirm', 'results', 'pause', 'loading']) $(s).classList.toggle('hide', s !== id); $('menu').classList.toggle('hide', !['scrFront', 'scrBattle', 'scrDeploy', 'scrSkirm', 'loading'].includes(id)); }
initSkirmish((k, keep, o) => { initAudio(); applyVolumes(); launch(k, keep, o); });
$('backSkirm').onclick = () => show('scrFront');
function rosterHtml(list) { return list.map(([k, n]) => `<li><b>${n}×</b> ${MODELS[k].name} <span>${MODELS[k].type}</span></li>`).join(''); }
// ---------- portada: «Jugar» lleva a la siguiente batalla recomendada ----------
// orden pensado para aprender: de lo más sencillo a lo más exigente
const RECO = ['africa-land', 'europe-naval', 'pacific-air', 'africa-air', 'europe-land', 'pacific-naval', 'europe-air', 'africa-combined', 'pacific-combined', 'europe-combined'];
let menuTab = null;
function recommended() {
  const keys = RECO.filter(k => BATTLES[k]);
  const next = keys.find(k => !(recordOf(k) && recordOf(k).wins)); if (next) return { key: next, all: false };
  return { key: keys.slice().sort((a, b) => (recordOf(a).wins - recordOf(b).wins) || (recordOf(a).best - recordOf(b).best))[0], all: true };
}
function showTab(t) {
  menuTab = t;
  $('more').querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('fronts').classList.toggle('hide', !t);
  $('fronts').querySelectorAll('[data-grp]').forEach(c => c.classList.toggle('hide', c.dataset.grp !== t));
}
function buildHero(sc) {
  const go = () => { initAudio(); applyVolumes(); };
  if (sc) {
    const k = sc.list[sc.i], b = BATTLES[k];
    $('hero').innerHTML = `<button id="playBtn">JUGAR</button><div class="hinfo"><span class="hk">Continuar campaña · ${FRONTS[sc.front].name}</span><span class="ht">${b.title}, ${b.year}</span><span class="hs">Batalla ${sc.i + 1} de ${sc.list.length} · ${KIND_NAME[b.kind]} · ${sc.score} pts</span><div class="hl"><a id="hDrop">Descartar la campaña</a><a id="hOther">Elegir otra batalla</a></div></div>`;
    $('playBtn').onclick = () => { go(); G.campaign = JSON.parse(JSON.stringify(sc)); toDeploy(G.campaign.list[G.campaign.i], true); };
    $('hDrop').onclick = () => { saveCampaign(null); buildFrontMenu(); };
  } else {
    const { key, all } = recommended(), b = BATTLES[key], r = recordOf(key), front = key.split('-')[0];
    const first = !RECO.some(k => recordOf(k));
    const tip = r && r.plays - r.wins >= 2 && G.opts.diff !== 'easy' ? 'Se te resiste: prueba en dificultad Fácil (abajo).' : first ? 'Una batalla corta para empezar. Las teclas útiles salen abajo en pantalla; P abre la ayuda.' : b.brief;
    $('hero').innerHTML = `<button id="playBtn">JUGAR</button><div class="hinfo"><span class="hk">${all ? 'Todas ganadas · a por un récord mejor' : first ? 'Tu primera batalla' : 'Siguiente batalla recomendada'}</span><span class="ht">${b.title}, ${b.year}</span><span class="hs">${FRONTS[front].name} · ${KIND_NAME[b.kind]}${r ? ` · ${starsHtml(starsOf(key))}` : ''}${r ? ` · ${r.wins} victoria${r.wins === 1 ? '' : 's'} en ${r.plays}` : ''}</span><span class="hs">${tip}</span><div class="hl">${first ? '<a id="hTut" class="first">¿Primera vez? Tutorial de 5 minutos</a>' : ''}<a id="hOther">Elegir otra batalla</a></div></div>`;
    $('playBtn').onclick = () => { go(); launch(key, false, { fog: true }); };
    if (first) $('hTut').onclick = () => { go(); launch('test-land', false, { tutorial: true }); };
  }
  $('hOther').onclick = () => showTab('fronts');
}
function buildFrontMenu() {
  $('fronts').innerHTML = Object.entries(FRONTS).map(([k, f]) => `
    <button class="front f-${k}" data-front="${k}" data-grp="fronts">
      <span class="fy">${f.years} · <b class="fst">★ ${f.battles.reduce((n, b) => n + starsOf(`${k}-${b}`), 0)}/${f.battles.length * 3}</b></span><span class="fn">${f.name}</span><span class="fv">${f.vs}</span>
      <span class="fd">${f.desc}</span>
      <span class="fb">${f.battles.map(b => `<i>${KIND_NAME[b]}</i>`).join('')}</span>
    </button>`).join('') + `
    <button class="front f-tut" data-tut="1" data-grp="learn">
      <span class="fy">10 pasos · 5 minutos</span><span class="fn">Tutorial</span><span class="fv">Primeros pasos</span>
      <span class="fd">Aprende a moverte, manejar la cámara, fijar blancos, disparar, cambiar de munición, reparar y dar órdenes a tu escuadra.</span>
      <span class="fb"><i>Guiado</i></span>
    </button>
    <button class="front f-school" data-school="1" data-grp="learn">
      <span class="fy">Naval · Aérea · Terrestre · Combinada</span><span class="fn">Escuela de mando</span><span class="fv">Estrategia de grupo</span>
      <span class="fd">Qué misión tiene cada tipo de unidad en el grupo, a qué distancia debe estar, quién entra primero en combate y los errores típicos, con demostraciones en 3D.</span>
      <span class="fb"><i>Manual</i><i>Demostraciones</i></span>
    </button>
    <button class="front f-hangar" data-hangar="1" data-grp="hangar">
      <span class="fy">${Object.keys(MODELS).length} modelos en 3D</span><span class="fn">Hangar</span><span class="fv">Todas las unidades</span>
      <span class="fd">Gira cada barco, avión y carro en 3D, compara sus características, aprende su papel en combate y salta a una prueba rápida o a la batalla donde aparece.</span>
      <span class="fb"><i>Naval</i><i>Aérea</i><i>Terrestre</i><i>Defensas</i></span>
    </button>
    <div class="front f-test" data-test="pick" data-grp="test">
      <span class="fy">Sin puntos ni derrota</span><span class="fn">Campos de pruebas</span><span class="fv">Un escenario por modo</span>
      <span class="fd">Elige unidad, coloca blancos fijos o enemigos con IA y prueba armas, blindajes, cámaras y controles en un escenario hecho para cada modo.</span>
      <span class="fb tsel"><button data-testdom="sea">Naval</button><button data-testdom="air">Aéreo</button><button data-testdom="land">Terrestre</button></span>
    </div>
    <div class="front f-medals" data-grp="medals"><span class="fn">Medallas</span><span class="fd">Se ganan jugando batallas y campañas (no en los campos de pruebas). Las estrellas de cada batalla: ★ ganar · ★★ con menos del 30 % de bajas · ★★★ con menos del 15 % en dificultad media o difícil.</span>${medalsListHtml()}</div>`;
  const sc = savedCampaign();
  $('contCamp').innerHTML = ''; // la campaña en curso se continúa con «Jugar»
  $('fronts').querySelectorAll('.front:not(.f-medals)').forEach(b => b.onclick = () => { initAudio(); applyVolumes(); if (b.dataset.school) { $('menu').classList.add('hide'); openSchool(); } else if (b.dataset.hangar) { $('menu').classList.add('hide'); openHangar(); } else if (b.dataset.tut) launch('test-land', false, { tutorial: true }); else if (b.dataset.test) launch('test-land'); else buildBattleMenu(b.dataset.front); });
  buildHero(sc);
  $('more').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { if (b.dataset.tab === 'hangar') { initAudio(); applyVolumes(); $('menu').classList.add('hide'); openHangar(); return; } if (b.dataset.tab === 'skirm') { openSkirmish(); show('scrSkirm'); return; } showTab(menuTab === b.dataset.tab ? null : b.dataset.tab); });
  showTab(menuTab);
  $('fronts').querySelectorAll('[data-testdom]').forEach(t => t.onclick = ev => { ev.stopPropagation(); initAudio(); applyVolumes(); launch(testKeyFor(t.dataset.testdom)); });
}
function buildBattleMenu(fk) {
  const f = FRONTS[fk];
  $('bfName').textContent = f.name; $('bfVs').textContent = `${f.years} · ${f.vs}`;
  $('battles').innerHTML = f.battles.map((k, i) => { const key = `${fk}-${k}`, b = BATTLES[key]; return `
    <div class="battle">
      <div class="bh"><span class="bk">${i + 1}. ${KIND_NAME[k]} ${starsHtml(starsOf(key))}</span><span class="bt">${b.title}, ${b.year}</span></div>
      <p>${b.brief}</p>
      <div class="ros"><div><h4>Aliados (10)</h4><ul>${rosterHtml(b.allies)}</ul></div><div><h4>${f.enemyName} (10)</h4><ul>${rosterHtml(b.enemy)}</ul></div></div>
      ${recordOf(key) ? `<p class="rec">Récord: <b>${recordOf(key).best}</b> pts · ${recordOf(key).wins} victoria${recordOf(key).wins === 1 ? '' : 's'} en ${recordOf(key).plays} partida${recordOf(key).plays === 1 ? '' : 's'}</p>` : ''}
      <button class="btn" data-key="${key}">Desplegar</button>
    </div>`; }).join('') + (f.battles.length > 1 ? `<div class="battle camp"><div class="bh"><span class="bk">Campaña</span><span class="bt">Las ${f.battles.length} batallas seguidas</span></div><p>${f.battles.map(k => KIND_NAME[k]).join(' → ')}. Las unidades que sobreviven ganan veteranía (★ Regular, ★★ Veterano, ★★★ Élite: más blindaje, precisión y cadencia), cada victoria da puntos extra de despliegue y desbloquea ${UNLOCKS[fk].map(k => MODELS[k].name).join(' y ')}. Si pierdes una batalla, la campaña termina.</p><button class="btn" data-camp="${fk}">Empezar campaña</button></div>` : '');
  $('battles').querySelectorAll('[data-key]').forEach(b => b.onclick = () => toDeploy(b.dataset.key));
  $('battles').querySelectorAll('[data-camp]').forEach(b => b.onclick = () => { G.campaign = newCampaign(fk, f.battles.map(k => `${fk}-${k}`)); saveCampaign(G.campaign); toDeploy(G.campaign.list[0], true); });
  show('scrBattle');
}
let lastOpts = {};
function toDeploy(key, keepCampaign = false) {
  if (!keepCampaign) G.campaign = null;
  openDeploy(key, (roster, fog, place, env, split) => launch(key, true, { roster, fog: split ? false : fog, place, env, split }));
  show('scrDeploy');
}
function launch(key, keepCampaign = false, opts = {}) {
  lastOpts = opts;
  if (!keepCampaign) G.campaign = null;
  show('loading'); $('loadTxt').textContent = `${BATTLES[key].title}, ${BATTLES[key].year}`;
  setTimeout(() => {
    G.running = false; G.paused = false; G.strategic = false; G.slowT = 0; toggleTactical(false);
    stopDoctrineDemo(); resetReplay(); stopSplit(); resize(); resetAdvisor(); startBattle(key, false, opts);
    if (opts.split) setupSplit();
    const p = G.player; G.targetZoom = G.zoom = ZOOM_DEF[p.dom];
    G.cam.preset = 0; G.cam.pitch = 1.1; G.cam.yaw = 0; G.cam.ang = 0; G.cam.rel = false; G.cam.autoOn = G.cam.autoSupp = false; G.cam.combatT = 0; $('camName').textContent = 'Cenital';
    hudInit(); show(null); $('menu').classList.add('hide');
    const test = G.battle.kind === 'test';
    $('top').classList.toggle('hide', test);
    stopTutorial(false);
    if (test && opts.tutorial) { sandboxHide(); startTutorial(() => toMenu()); }
    else if (test) { initSandbox({ flash, onPlayerChange: e => { G.targetZoom = ZOOM_DEF[e.dom]; }, onMode: m => launch(testKeyFor(m)) }); sandboxStart(); if (opts.testUnit) { quickTest(opts.testUnit); G.targetZoom = ZOOM_DEF[G.player.dom]; } if (opts.drill) { runDrill(opts.drill, opts.drillUnit, { clear: sandboxClear, quickTest }); G.targetZoom = ZOOM_DEF[G.player.dom]; } if (opts.doctrine) runDoctrineDemo(opts.doctrine, { clear: sandboxClear, quickTest }); } else sandboxHide();
    G.running = true;
    radioStop(); if (G.battle.kind !== 'test') setTimeout(() => RADIO.start(), opts.place ? 0 : 1200);
    if (opts.place && G.battle.kind !== 'test') { beginPlacement(); flash('Fase de despliegue', 'Coloca tus unidades y pulsa Enter para comenzar', 4); return; }
    if (opts.tutorial) { flash('Tutorial', 'Sigue las instrucciones del panel', 3); return; }
    if (opts.drill || opts.doctrine) return; // el panel ya explica qué hacer
    flash(G.battle.kind === 'test' ? G.battle.title : `${BATTLES[key].title}, ${BATTLES[key].year}`, G.battle.kind === 'test' ? 'Elige unidad y blancos en el panel de la derecha' : G.battle.kind === 'combined' ? G.battle.hint : G.battle.kind === 'air' ? 'Pulsa 1, 2 o 3 para enviar tu escuadrilla contra las instalaciones A, B o C' : 'Pulsa 1, 2 o 3 para enviar tu escuadra a los objetivos A, B o C', 5);
  }, 60);
}
function startDemo() {
  const keys = Object.keys(BATTLES).filter(k => BATTLES[k].kind !== 'test'); const key = keys[(Math.random() * keys.length) | 0];
  G.running = false; startBattle(key, true); G.zoom = G.targetZoom = 950;
}
function showResults(res) {
  toggleTactical(false); clearThreats(); G.running = false; hudHide();
  const b = G.battle, win = res === 'win';
  const score = Math.round((G.tickets.A + G.stats.kills * 50 - G.stats.lost * 20 + (win ? 500 : 0)) * diff().score);
  if (G.campaign) G.campaign.score += score;
  const camp = endCampaignBattle(win);
  const newRec = b.kind !== 'test' && !b.skirmish && record(G.battleKey, score, win);
  const campDone = !!(G.campaign && win && G.campaign.i + 1 >= G.campaign.list.length);
  const sum = battleSummary(win, G.battleKey, b.skirmish ? 'test' : b.kind, campDone);
  $('resTitle').textContent = win ? 'Victoria' : 'Derrota';
  $('resTitle').className = win ? 'win' : 'lose';
  $('resSub').textContent = `${KIND_NAME[b.kind]} · ${b.title}, ${b.year}`;
  $('resStats').innerHTML = [
    ['Duración', `${Math.floor(G.time / 60)} min ${Math.floor(G.time % 60)} s`],
    ['Enemigos destruidos', `${G.stats.kills}`], ['Unidades perdidas', `${G.stats.lost}`],
    ['Puntos de batalla', `${Math.ceil(G.tickets.A)} contra ${Math.ceil(G.tickets.E)}`], ['Puntuación', `${score}${newRec ? ' · ¡nuevo récord!' : ''}`],
    ...(G.campaign ? [['Campaña acumulada', `${G.campaign.score}`]] : []),
    ...(camp ? [['Veteranos en la fuerza', `${camp.nVet}`], ...(camp.bonus ? [['Puntos extra de despliegue', `+${camp.bonus}`]] : []), ...(camp.unlocked ? [['Nueva unidad disponible', camp.unlocked]] : []), ...camp.promos.slice(0, 6).map(p => ['Ascenso', p])] : []),
  ].map(([a, v]) => `<div><span>${a}</span><b>${v}</b></div>`).join('');
  $('resStars').innerHTML = b.kind === 'test' || b.skirmish ? '' : `${starsHtml(sum.stars)}<span>${sum.stars ? STAR_RULES[sum.stars - 1] : 'Gana la batalla para conseguir estrellas'}${sum.starUp && sum.stars ? ' · ¡mejor resultado!' : sum.best > sum.stars ? ` · tu mejor: ${sum.best} ★` : ''}</span>${sum.stars < 3 ? `<small>Siguiente estrella: ${STAR_RULES[sum.stars]}</small>` : ''}`;
  $('resMedals').innerHTML = sum.fresh.length ? `<h4>¡Nueva${sum.fresh.length > 1 ? 's' : ''} medalla${sum.fresh.length > 1 ? 's' : ''}!</h4><div class="mdls new">${sum.fresh.map(m => `<div class="md">${medalSvg(m)}<div><b>${m.n}</b><span>${m.d}</span></div></div>`).join('')}</div>` : '';
  $('resSum').innerHTML = summaryHtml(sum);
  const c = G.campaign, next = c && win && c.i + 1 < c.list.length ? c.list[c.i + 1] : null;
  $('resNext').classList.toggle('hide', !next);
  if (next) { $('resNext').textContent = `Siguiente: ${KIND_NAME[BATTLES[next].kind]}`; $('resNext').onclick = () => { c.i++; toDeploy(next, true); }; }
  if (c) saveCampaign(next ? { ...c, i: c.i + 1 } : null);
  if (c && (!win || !next)) { $('resSub').textContent += win ? ' · Campaña completada' : ' · Campaña terminada'; }
  $('resRetry').onclick = () => { if (c) { c.score -= score; restoreSnapshot(); } launch(G.battleKey, !!c, lastOpts); };
  $('resMenu').onclick = () => { G.campaign = null; toMenu(); };
  $('resReplay').classList.toggle('hide', !hasReplay());
  $('resReplay').onclick = () => { $('results').classList.add('hide'); $('replayTag').classList.remove('hide'); startReplay(() => { $('replayTag').classList.add('hide'); show('results'); }); };
  show('results');
}
function toMenu() { toggleTactical(false); clearThreats(); stopDoctrineDemo(); stopTutorial(false); if (G.split) { stopSplit(); resize(); } endPlacement(); sandboxHide(); hudHide(); G.running = false; buildFrontMenu(); show('scrFront'); startDemo(); }
$('backFront').onclick = () => show('scrFront');
$('backBattle').onclick = () => show('scrBattle');
initDeployUI();
function startFromDeploy() {
  if (!G.deploying) return;
  endPlacement();
  const b = G.battle; flash(`${b.title}, ${b.year}`, b.kind === 'air' ? '1, 2, 3 instalaciones · 7 8 9 apoyo con puntos de mando' : '1, 2, 3 objetivos · Shift+número para encadenar · 7 8 9 apoyo', 4);
}
$('dpStart').onclick = ev => { startFromDeploy(); ev.target.blur(); };
document.querySelectorAll('#deployHud [data-pre]').forEach(bt => bt.onclick = ev => { applyPreset(+bt.dataset.pre); flash(PRESETS[+bt.dataset.pre], '', 0.8); ev.currentTarget.blur(); });
$('support').addEventListener('click', ev => { const bt = ev.target.closest('[data-sup]'); if (bt) doSupport(bt.dataset.sup); });
// punto de apoyo: bajo el ratón, tu blanco, el objetivo ordenado o el foco de la cámara
let mouseXY = null, mouseT = 0;
addEventListener('mousemove', ev => { mouseXY = [ev.clientX, ev.clientY]; mouseT = performance.now(); });
function supportPoint() {
  if (mouseXY && performance.now() - mouseT < 4000 && ev0(mouseXY)) { const p = groundAt(mouseXY[0], mouseXY[1]); if (p) return p; }
  const P = G.player; if (P && P.target && P.target.alive) return P.target.p.clone();
  const ord = [...G.selection].find(e => e.alive && e.order.type === 'zone'); if (ord && G.objectives[ord.order.k]) return G.objectives[ord.order.k].pos.clone();
  const z = G.objectives.find(z => z.owner !== 'A'); if (z) return z.pos.clone();
  return G.focus.clone();
}
const ev0 = ([x, y]) => { const el = document.elementFromPoint(x, y); return el === canvas; };
function doSupport(kind) {
  if (!G.running || G.deploying || G.battle.kind === 'test' && kind === 'reinf' && false) return;
  const s = SUPPORT[kind], pt = kind === 'reinf' ? null : supportPoint();
  if (useSupport('A', kind, pt)) flash(kind === 'barrage' ? (G.battle.kind === 'naval' ? s.nameSea : s.name) : s.name, kind === 'reinf' ? 'Una unidad nueva llega a la base' : kind === 'barrage' ? 'Impacto en 5 s: aléjate de la marca de humo' : 'Dos aviones en camino', 2);
  else flash(`${s.name} no disponible`, G.cp && G.cp.A < s.cost ? `Necesitas ${s.cost} puntos de mando` : 'En espera', 1.4);
}
G.onSupport = (side, kind, p) => { if (!G.demo) { if (side === 'E') RADIO.incoming(kind); else RADIO.support(kind); } if (side === 'E' && !G.demo) { if (kind === 'barrage') flash('¡Artillería enemiga!', 'Busca la marca de humo y apártate', 2); else if (kind === 'air') flash('¡Ataque aéreo enemigo!', '', 1.6); } };
initSoundUI();
G.opts = G.opts || { cine: true, fps: false, quality: autoQuality(), crt: true };
loadSave(); G.onOptions = saveOptions; initSoundUI();
$('optCine').checked = G.opts.cine;
applyQuality(G.opts.quality);
function qualUI() { for (const id of ['optQual', 'optQual2']) { const el = $(id); el.innerHTML = Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${k === G.opts.quality ? 'selected' : ''}>${q.n}</option>`).join(''); el.onchange = () => { G.opts.quality = el.value; applyQuality(el.value); qualUI(); G.onOptions && G.onOptions(); }; } $('optFps').checked = G.opts.fps; }
qualUI();
initTouch(canvas);
// mando aliado por IA (por defecto) o todas las órdenes para el jugador
G.onPlan = (main, n) => {
  if (G.demo || !G.running) return;
  if (main >= 0) { const zn = ['Alfa', 'Bravo', 'Charlie'][main]; flash(`Mando aliado: esfuerzo en ${'ABC'[main]}`, `${n} unidades coordinadas por la IA · tus órdenes tienen prioridad`, 2); RADIO_plan(zn); }
  else flash('Mando aliado: nuevo plan', `${n} unidades cambian de orden`, 1.6);
};
G.onAllySupport = kind => { if (!G.demo) flash('Mando aliado pide apoyo', kind === 'barrage' ? 'Artillería sobre una concentración enemiga' : kind === 'air' ? 'Ataque aéreo contra blindados o barcos' : 'Refuerzos en camino', 1.8); };
function RADIO_plan(zn) { RADIO.plan && RADIO.plan(zn); }
function applyCmd() { G.opts.aiCmd = G.opts.aiCmd !== false; for (const id of ['optCmd', 'optCmd2']) $(id).value = G.opts.aiCmd ? 'ai' : 'me'; }
for (const id of ['optCmd', 'optCmd2']) $(id).onchange = ev => { G.opts.aiCmd = ev.target.value === 'ai'; applyCmd(); G.onOptions && G.onOptions(); flash(G.opts.aiCmd ? 'Mando aliado: IA' : 'Mando aliado: tú', G.opts.aiCmd ? 'La IA coordina la escuadra; tus órdenes mandan durante 45 s' : 'La escuadra solo obedece tus órdenes', 1.8); };
applyCmd();
function applyDiff() { if (!DIFFS[G.opts.diff]) G.opts.diff = 'normal'; for (const id of ['optDiff', 'optDiff2']) { $(id).value = G.opts.diff; $(id).title = DIFFS[G.opts.diff].d; } }
for (const id of ['optDiff', 'optDiff2']) $(id).onchange = ev => { G.opts.diff = ev.target.value; applyDiff(); G.onOptions && G.onOptions(); flash(`Dificultad: ${DIFFS[G.opts.diff].n}`, DIFFS[G.opts.diff].d + (G.running ? ' (en vigor desde ya; los puntos de batalla se aplican en la próxima batalla)' : ''), 2.4); };
applyDiff();
initSchool({
  onBack: () => { closeSchool(); show('scrFront'); },
  onDemo: dom => { closeSchool(); launch(testKeyFor(dom), false, { doctrine: dom }); },
});
initHangar({
  onBack: () => { closeHangar(); show('scrFront'); },
  onTest: key => { closeHangar(); launch(testKeyFor(specOf(key).dom), false, { testUnit: key }); },
  onBattle: key => { closeHangar(); toDeploy(key); },
  onDrill: (id, key) => { closeHangar(); launch(testKeyFor(DRILLS.find(d => d.id === id).dom), false, { drill: id, drillUnit: key }); },
  onSchool: dom => { closeHangar(); openSchool(dom); },
});
$('padHelp').textContent = PAD_HELP;
function applyMode() { G.opts.mode = G.opts.mode === 'veteran' ? 'veteran' : 'simple'; document.body.classList.toggle('simple', G.opts.mode === 'simple'); for (const id of ['optMode', 'optMode2']) $(id).value = G.opts.mode; }
for (const id of ['optMode', 'optMode2']) $(id).onchange = ev => { G.opts.mode = ev.target.value; applyMode(); G.onOptions && G.onOptions(); flash(G.opts.mode === 'simple' ? 'Modo sencillo' : 'Modo veterano', G.opts.mode === 'simple' ? 'Órdenes básicas, munición y apoyo automáticos' : 'Todas las órdenes, formaciones y apoyos', 1.6); };
applyMode();
globalThis.ARCADE_TURNS = G.opts.turns === 'arcade';
$('optTurns').value = G.opts.turns || 'real'; $('optTurns').onchange = ev => { G.opts.turns = ev.target.value; globalThis.ARCADE_TURNS = G.opts.turns === 'arcade'; G.onOptions && G.onOptions(); flash('Giros: ' + (G.opts.turns === 'arcade' ? 'arcade' : 'realistas'), 'Se aplica desde la próxima batalla', 1.6); };
$('optAutoCam').checked = G.opts.autoCam !== false; $('optAutoCam').onchange = ev => { G.opts.autoCam = ev.target.checked; G.onOptions && G.onOptions(); };
$('optAdvisor').checked = G.opts.advisor !== false; $('optAdvisor').onchange = ev => { G.opts.advisor = ev.target.checked; G.onOptions && G.onOptions(); };
$('optRange').checked = G.opts.range !== false; $('optRange').onchange = ev => { G.opts.range = ev.target.checked; G.onOptions && G.onOptions(); };
$('optThreats').checked = G.opts.threats !== false; $('optThreats').onchange = ev => { G.opts.threats = ev.target.checked; G.onOptions && G.onOptions(); };
$('optCrt').checked = G.opts.crt !== false; $('optCrt').onchange = ev => { G.opts.crt = ev.target.checked; G.onOptions && G.onOptions(); };
$('optFps').onchange = ev => { G.opts.fps = ev.target.checked; G.onOptions && G.onOptions(); };
$('optCine').checked = G.opts.cine; $('optCine').onchange = ev => { G.opts.cine = ev.target.checked; G.onOptions && G.onOptions(); };
const FORMS = ['cuña', 'línea', 'columna']; G.formation = 'cuña';

// ---------- entrada ----------
const ZONE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2 };
addEventListener('keydown', ev => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
  if (!G.keys[ev.code]) G.keysOnce.add(ev.code);
  G.keys[ev.code] = true;
  if (replaying()) { if (ev.code === 'Escape' || ev.code === 'Space') stopReplay(); return; }
  if (!G.running) { if (ev.code === 'Escape' && !$('pause').classList.contains('hide')) togglePause(); return; }
  if (G.deploying) {
    const pre = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[ev.code];
    if (pre !== undefined) { applyPreset(pre); flash(PRESETS[pre], '', 0.8); }
    if (ev.code === 'Enter' || ev.code === 'NumpadEnter') startFromDeploy();
    if (ev.code === 'KeyZ') G.targetZoom = clamp(G.targetZoom / 1.25, 110, 3600); if (ev.code === 'KeyX') G.targetZoom = clamp(G.targetZoom * 1.25, 110, 3600);
    return;
  }
  const c = ev.code, simple = G.opts.mode !== 'veteran';
  if (c === 'Enter' || c === 'NumpadEnter' || c === 'Pause') { toggleTactical(); return; }
  if (simple && ['KeyO', 'KeyR', 'KeyF', 'KeyG', 'Digit8', 'Digit9'].includes(c)) return; // solo en modo veterano
  if (c in ZONE_KEYS) { const q = ev.shiftKey && !simple, n = issueOrder('zone', { k: ZONE_KEYS[c] }, q); if (n) flash((q ? 'Encadenado: ' : '') + (G.battle.kind === 'air' ? `Atacar instalación ${'ABC'[ZONE_KEYS[c]]}` : `Objetivo ${'ABC'[ZONE_KEYS[c]]}`), q ? 'Irán cuando completen la orden actual' : `${n} unidades en camino`); }
  else if (c === 'Digit7') doSupport(simple ? autoSupportKind() : 'barrage');
  else if (c === 'Digit8') doSupport('air');
  else if (c === 'Digit9') doSupport('reinf');
  else if (c === 'KeyO') { G.formation = FORMS[(FORMS.indexOf(G.formation) + 1) % FORMS.length]; flash(`Formación: ${G.formation}`, 'Al seguirte y al mover la escuadra', 1.4); }
  else if (c === 'KeyQ') { const n = issueOrder('follow'); if (n) flash('Seguidme', `${n} unidades en formación`); }
  else if (c === 'KeyE') { const n = issueOrder('attack'); if (n) flash('Ataque libre', `${n} unidades buscan al enemigo`); }
  else if (c === 'KeyR') { const n = issueOrder('hold'); if (n) flash('Mantener posición', `${n} unidades`); }
  else if (c === 'KeyG') cycleGroup();
  else if (c === 'KeyF') { const n = issueOrder('defend'); if (n) flash('Defender', G.battle.kind === 'air' ? 'Patrulla sobre nuestras instalaciones' : 'A nuestros objetivos'); }
  else if (c === 'Tab') cycleUnit(ev.shiftKey ? -1 : 1);
  else if (c === 'KeyZ' || c === 'Equal' || c === 'NumpadAdd') G.targetZoom = clamp(G.targetZoom / 1.25, 110, 3600);
  else if (c === 'KeyX' || c === 'Minus' || c === 'NumpadSubtract') G.targetZoom = clamp(G.targetZoom * 1.25, 110, 3600);
  else if (c === 'KeyV') setCamPreset((G.cam.preset + 1) % CAM_PRESETS.length);
  else if (c === 'KeyB') setCamPreset(0);
  else if (c === 'KeyM') { G.strategic = !G.strategic; }
  else if (c === 'KeyP' || c === 'Escape') { if (c === 'Escape' && G.selection.size < allWingmen().length && !G.paused) { selectAll(); flash('Toda la escuadra seleccionada'); } else togglePause(); }
  else if (c === 'KeyH') togglePause();
});
addEventListener('keyup', ev => { G.keys[ev.code] = false; });
addEventListener('blur', () => { G.keys = {}; });
function allWingmen() { return G.ents.filter(e => e.alive && e.side === 'A' && e.dom !== 'static' && e !== G.player && !e.support); }
function selectAll() { G.selection = new Set(allWingmen()); G.showSel = false; }
const ZOOM_DEF = { land: 240, sea: 330, air: 380 };
function takeControl(next) {
  const prevDom = G.player && G.player.dom;
  setPlayer(next); flash(next.name, next.m.type, 1.4);
  if (prevDom !== next.dom) G.targetZoom = ZOOM_DEF[next.dom];
}
function cycleUnit(dir) {
  const list = G.ents.filter(e => e.alive && e.side === 'A' && e.dom !== 'static' && !e.support); if (list.length < 2) return;
  const i = list.indexOf(G.player); takeControl(list[(i + dir + list.length) % list.length]);
}
// selección por tipo (G): todas → barcos → aviones → tanques
const GROUPS = [['all', 'Toda la escuadra'], ['sea', 'Barcos'], ['air', 'Aviones'], ['land', 'Tanques']];
let groupIdx = 0;
function cycleGroup() {
  const doms = new Set(allWingmen().map(e => e.dom));
  for (let k = 0; k < GROUPS.length; k++) {
    groupIdx = (groupIdx + 1) % GROUPS.length; const [g, n] = GROUPS[groupIdx];
    if (g !== 'all' && !doms.has(g)) continue;
    const sel = allWingmen().filter(e => g === 'all' || e.dom === g); G.selection = new Set(sel); G.showSel = g !== 'all';
    flash(`Selección: ${n}`, `${sel.length} unidades · ahora da una orden (1 2 3 Q E R F)`, 1.6); return;
  }
}
// pausa táctica: congela la acción sin tapar el campo de batalla; las órdenes, la selección y la cámara siguen funcionando
let tacSel = false;
export function toggleTactical(on = !G.tactical) {
  if (on && (!G.running || G.deploying || G.paused || G.over || G.demo)) return;
  if (on === !!G.tactical) return;
  G.tactical = on; document.body.classList.toggle('tac', on); $('tacBar').classList.toggle('hide', !on);
  if (on) { tacSel = G.showSel; G.showSel = true; flash('Pausa táctica', 'Da órdenes con calma · Intro para seguir', 1.4); }
  else { G.showSel = tacSel; flash('¡Adelante!', '', 0.8); }
}
$('tacGo').onclick = () => toggleTactical(false);
function togglePause() {
  if (G.tactical) toggleTactical(false);
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
canvas.addEventListener('wheel', ev => { if (!G.running) return; G.targetZoom = clamp(G.targetZoom * (ev.deltaY > 0 ? 1.15 : 1 / 1.15), 110, 3600); ev.preventDefault(); }, { passive: false });
let dragUnit = null;
canvas.addEventListener('mousedown', ev => {
  if (!G.running) return;
  if (G.deploying && ev.button === 0) { let best = null, bd = 30; for (const e of G.ents) { if (!e.alive || e.side !== 'A' || e.dom === 'air' || e.dom === 'static') continue; const [sx, sy] = screenOf(e); const d = Math.hypot(sx - ev.clientX, sy - ev.clientY); if (d < bd) { bd = d; best = e; } } dragUnit = best; return; }
  if (ev.button === 0) drag = { x: ev.clientX, y: ev.clientY };
});
addEventListener('mousemove', ev => { if (dragUnit) { const p = groundAt(ev.clientX, ev.clientY); if (p) placeUnit(dragUnit, p.x, p.z); } });
addEventListener('mouseup', () => { dragUnit = null; });
addEventListener('mousemove', ev => { if (!drag) return; const b = $('selbox'); const x0 = Math.min(drag.x, ev.clientX), y0 = Math.min(drag.y, ev.clientY); Object.assign(b.style, { display: 'block', left: x0 + 'px', top: y0 + 'px', width: Math.abs(ev.clientX - drag.x) + 'px', height: Math.abs(ev.clientY - drag.y) + 'px' }); });
addEventListener('mouseup', ev => {
  if (!drag || ev.button !== 0) return;
  const b = $('selbox'); b.style.display = 'none';
  const dx = Math.abs(ev.clientX - drag.x), dy = Math.abs(ev.clientY - drag.y);
  const mine = allWingmen();
  if (dx < 6 && dy < 6) {
    // clic sobre un enemigo: fijar blanco
    const P = G.player;
    if (P && P.alive && P.dom !== 'air') { let en = null, ed = 30; const f = targetFilter(P); for (const e of G.ents) { if (!e.alive || e.side === 'A' || !f(e)) continue; const [sx, sy] = screenOf(e); const d = Math.hypot(sx - ev.clientX, sy - ev.clientY); if (d < ed) { ed = d; en = e; } } if (en) { lockTarget(P, en); flash('Blanco fijado', `${en.name} · ${Math.round(en.p.distanceTo(P.p))} m`, 1.4); drag = null; return; } }
    let best = null, bd = 28; for (const e of [...mine, G.player]) { if (!e) continue; const [sx, sy] = screenOf(e); const d = Math.hypot(sx - ev.clientX, sy - ev.clientY); if (d < bd) { bd = d; best = e; } }
    if (best && best !== G.player) { if (ev.shiftKey) { G.selection.has(best) ? G.selection.delete(best) : G.selection.add(best); } else G.selection = new Set([best]); G.showSel = true; flash(best.name, `Seleccionado · ${orderLabel(best.order)}`, 1.4); }
  } else {
    const x0 = Math.min(drag.x, ev.clientX), x1 = Math.max(drag.x, ev.clientX), y0 = Math.min(drag.y, ev.clientY), y1 = Math.max(drag.y, ev.clientY);
    const sel = mine.filter(e => { const [sx, sy] = screenOf(e); return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; });
    if (sel.length) { G.selection = new Set(sel); G.showSel = true; flash(`${sel.length} unidades seleccionadas`, 'Clic derecho para dar una orden', 1.6); }
  }
  drag = null;
});
canvas.addEventListener('dblclick', ev => { if (!G.running) return; for (const e of allWingmen()) { const [sx, sy] = screenOf(e); if (Math.hypot(sx - ev.clientX, sy - ev.clientY) < 28) { takeControl(e); return; } } });
canvas.addEventListener('mouseup', ev => {
  if (ev.button !== 2 || !G.running) return;
  const p = groundAt(ev.clientX, ev.clientY); if (!p) return;
  orderAt(p, ev.shiftKey);
});
// orden en un punto del mapa (clic derecho en el campo o clic en el minimapa)
function orderAt(p, shift) {
  if (!G.running || G.deploying) return;
  // ¿clic en un objetivo?
  if (G.battle.kind !== 'air') { const z = G.objectives.find(z => z.pos.distanceTo(V3(p.x, z.pos.y, p.z)) < G.map.cfg.zoneR); if (z) { const n = issueOrder('zone', { k: z.k }); if (n) flash(`Objetivo ${z.name}`, `${n} unidades en camino`); return; } }
  else { const k = G.sitesE.findIndex(s => s.alive && Math.hypot(s.p.x - p.x, s.p.z - p.z) < 80); if (k >= 0) { const n = issueOrder('zone', { k }); if (n) flash(`Atacar instalación ${'ABC'[k]}`, `${n} aviones`); return; } }
  if (shift) { const n = issueOrder('route', { pt: V3(p.x, 0, p.z) }, true); if (n) flash('Punto de ruta añadido', 'Shift+clic para más puntos', 1.2); return; }
  const n = issueOrder('move', { x: p.x, z: p.z }); if (n) flash('Mover', `${n} unidades en formación ${G.formation}`, 1.2); else flash('Nadie seleccionado', 'Selecciona unidades (clic, recuadro o G) antes de dar la orden', 1.6);
}
// minimapa: clic (o clic derecho) manda a la selección a ese punto; sobre una zona, a tomarla; Shift añade puntos de ruta
function mmPoint(ev) { const r = $('mm').getBoundingClientRect(), B = G.map.bounds + 100; return V3(((ev.clientX - r.left) / r.width) * 2 * B - B, 0, ((ev.clientY - r.top) / r.height) * 2 * B - B); }
$('mm').addEventListener('contextmenu', ev => ev.preventDefault());
$('mm').addEventListener('mouseup', ev => {
  if (!G.running || !G.map || (ev.button !== 0 && ev.button !== 2)) return;
  ev.preventDefault(); ev.stopPropagation();
  const p = mmPoint(ev); G.mmPing = { x: p.x, z: p.z, t: 1.4 };
  orderAt(p, ev.shiftKey);
});
$('squad').addEventListener('click', ev => { const el = ev.target.closest('.sq'); if (!el) return; const e = G.ents.find(x => x.id === +el.dataset.id); if (!e || !e.alive || e === G.player) return; if (ev.shiftKey) { G.selection.has(e) ? G.selection.delete(e) : G.selection.add(e); } else G.selection = new Set([e]); G.showSel = true; });
$('squad').addEventListener('dblclick', ev => { const el = ev.target.closest('.sq'); if (!el) return; const e = G.ents.find(x => x.id === +el.dataset.id); if (e && e.alive) setPlayer(e); });

// ---------- arranque ----------
buildFrontMenu(); show('scrFront'); startDemo();
requestAnimationFrame(frame);
if (location.hash === '#debug') window.__ww2 = { G, launch, startBattle, spawn: spawnUnit, step(dt) { updateUnits(dt); updateProjs(dt); updateBattle(dt); updateFx(dt); updateDamageFx(dt); recordReplay(dt); updateTutorial(dt); updateDoctrine(dt); updateAdvisor(dt); }, startReplay, showResults: r => showResults(r), issueOrder, setPlayer, toggleTactical, cam: dt => updateCamera(dt), camPreset: i => setCamPreset(i), hud: () => { updateHud(0.03); updateAimMarkers(); } };

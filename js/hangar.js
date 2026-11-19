// Hangar: todas las unidades en 3D con sus características, su papel en combate y accesos a prueba rápida o escenario
import * as THREE from 'three';
import { G } from './state.js';
import { MODELS, CLS, FAC_NAME, BATTLES, FRONTS, KIND_NAME, specOf } from './data.js';
import { buildModel, buildAA, buildBattery, buildSite } from './models.js';
import { costOf } from './deploy.js';
import { UNLOCKS } from './campaign.js';
import { drillsFor } from './drills.js';
import { roleOfUnit, DOCTRINE } from './doctrine.js';

const $ = id => document.getElementById(id);
let scene = null, cam = null, turntable = null, current = null, sel = null, opts = {};
let yaw = 0.7, pitch = 0.35, dist = 60, distT = 60, auto = true, drag = null, filt = { dom: 'all', fac: 'all' };

// ---------- texto por clase: qué es, cómo se usa y qué teclas tiene ----------
const ROLE = {
  destroyer: ['Escolta rápida y polivalente', 'Rápido y maniobrable. Caza submarinos con cargas de profundidad, lanza torpedos contra buques grandes y su radar descubre barcos a 1400 m. Frágil frente a cruceros y acorazados: aprovecha la velocidad.', 'Espacio cañones · Shift torpedos · C cargas de profundidad · N munición'],
  cruiser: ['Buque de línea medio', 'Varias torres de artillería con buen alcance y defensa antiaérea fuerte. Aguanta castigo y es la columna vertebral de la flota de superficie.', 'Espacio artillería · Shift torpedos (si los lleva) · N munición'],
  battleship: ['Gran calibre y blindaje', 'Las torres giran despacio pero cada salva hace un daño enorme desde muy lejos. Lento al virar: mantenlo escoltado contra torpedos y aviones.', 'Espacio salvas · N munición AP o HE'],
  carrier: ['Base aérea flotante', 'No tiene artillería principal: su fuerza son los aviones. Lanza aparatos que atacan por su cuenta y recupera los que vuelven para rearmarlos. Es un blanco prioritario para el enemigo.', 'Shift lanzar avión · L (desde un avión) aterrizar'],
  pt: ['Lancha torpedera', 'Muy rápida y pequeña, difícil de acertar. Se acerca a toda velocidad, suelta sus dos torpedos y se retira. Muy vulnerable a cualquier impacto.', 'Espacio ametralladoras · Shift torpedos'],
  sub: ['Ataque oculto', 'Sumergido es casi invisible y solo pueden alcanzarlo las cargas de profundidad. En superficie es lento y frágil. Sus torpedos hacen el mayor daño del juego.', 'C sumergirse/emerger · Shift torpedos · Espacio cañón de cubierta'],
  merchant: ['Transporte', 'Sin capacidad ofensiva. En Tobruk hay que escoltar el convoy hasta el puerto para ganar puntos de mando y refuerzos.', '—'],
  fighter: ['Superioridad aérea', 'Rápido y ágil: derriba aviones enemigos y protege a tus bombarderos. Puede llevar una bomba ligera para apoyo a tierra. Vuela bajo para atacar y sube para ganar energía.', 'Espacio ametralladoras · Shift bomba · ↑↓ altitud'],
  bomber: ['Ataque a superficie', 'Lleva bombas o torpedos contra barcos, carros e instalaciones. Más lento y con artillero trasero: necesita escolta de cazas.', 'Shift soltar bombas · Espacio ametralladoras'],
  heavy: ['Bombardeo estratégico', 'Vuela muy alto en formación en caja, con varios artilleros que se defienden solos. Suelta una ráfaga de bombas en línea sobre instalaciones y concentraciones.', 'Shift ráfaga de bombas · los artilleros disparan solos'],
  tank: ['Carro de combate', 'La punta de lanza terrestre. El blindaje frontal es el más fuerte: da la cara al enemigo y busca sus flancos. AP contra blindados, HE contra infantería y cañones.', 'Espacio cañón · N munición · Shift humo · K reparar'],
  inf: ['Infantería', 'Lenta y frágil, pero barata y difícil de ver. Captura objetivos y sus armas antitanque a corta distancia son peligrosas para los carros.', 'Espacio fusiles · Shift arma antitanque'],
  atgun: ['Cañón antitanque', 'Casi inmóvil pero con un cañón potente y perfil bajo. Colócalo cubriendo un objetivo y deja que los carros vengan a él.', 'Espacio cañón · N munición'],
  aa: ['Defensa antiaérea', 'Llena el cielo de explosiones de flak sobre los aviones que se acercan. No se mueve.', '—'],
  battery: ['Batería costera', 'Artillería pesada en casamata que bate la playa y el mar. Hay que destruirla para que el desembarco avance.', '—'],
  site: ['Instalación', 'Objetivo de las batallas aéreas: aeródromo, depósito o radar. Destruirlas resta muchos puntos al enemigo.', '—'],
};
// defensas fijas (no están en MODELS)
const STATICS = {
  '#aa_de': { cls: 'aa', fac: 'de', name: 'Flak 36 (88 mm)', type: 'Antiaéreo pesado', build: () => buildAA('de') },
  '#aa_us': { cls: 'aa', fac: 'us', name: 'Bofors 40 mm', type: 'Antiaéreo ligero', build: () => buildAA('us') },
  '#bat_jp': { cls: 'battery', fac: 'jp', name: 'Casamata costera', type: 'Batería costera', build: () => buildBattery('jp') },
  '#bat_de': { cls: 'battery', fac: 'de', name: 'Casamata del Muro Atlántico', type: 'Batería costera', build: () => buildBattery('de') },
  '#site0': { cls: 'site', fac: 'de', name: 'Aeródromo', type: 'Instalación', build: () => buildSite(0, 'de', 'bocage') },
  '#site1': { cls: 'site', fac: 'de', name: 'Depósito de combustible', type: 'Instalación', build: () => buildSite(1, 'de', 'bocage') },
  '#site2': { cls: 'site', fac: 'de', name: 'Estación de radar', type: 'Instalación', build: () => buildSite(2, 'de', 'bocage') },
};
const DOMS = [['all', 'Todas'], ['sea', 'Mar'], ['air', 'Aire'], ['land', 'Tierra'], ['static', 'Defensas']];
const info = k => STATICS[k] || MODELS[k];
const domOf = k => CLS[info(k).cls].dom;
const roleOf = k => { const m = info(k); return ROLE[m.stats && m.stats.heavy ? 'heavy' : m.cls]; };

// ---------- escena ----------
function makeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1f23); scene.fog = new THREE.Fog(0x1a1f23, 260, 900);
  cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.5, 3000);
  scene.add(new THREE.HemisphereLight(0xcfd8e0, 0x2a2622, 1.1));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(-80, 140, 90); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 500 }); key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 1.2); rim.position.set(90, 60, -120); scene.add(rim);
  // suelo de hormigón con cuadrícula de 10 m
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#3a3d3e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
  g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(80, 80); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // plataforma giratoria con anillo de luz
  turntable = new THREE.Group(); scene.add(turntable);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64), new THREE.MeshStandardMaterial({ color: 0x4a4f52, roughness: 0.6, metalness: 0.3 }));
  plat.receiveShadow = true; plat.name = 'plat'; scene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0xf2c94c })); ring.rotation.x = Math.PI / 2; ring.name = 'ring'; scene.add(ring);
  // nave: costillas de la cubierta del hangar
  const rib = new THREE.MeshStandardMaterial({ color: 0x2b3034, roughness: 0.8, metalness: 0.4 });
  for (let i = -4; i <= 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(260, 2.2, 6, 48, Math.PI), rib); a.position.set(0, 0, i * 70 - 40); scene.add(a); }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 1 })); back.position.set(0, 120, -330); scene.add(back);
}
function show3D(key) {
  if (current) { turntable.remove(current); current.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const st = STATICS[key];
  current = st ? st.build() : buildModel(key);
  current.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // apoyar el modelo en la plataforma y encuadrarlo
  current.position.set(0, 0, 0); current.rotation.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(current), size = box.getSize(new THREE.Vector3()), r = Math.max(size.x, size.z) * 0.5;
  const air = domOf(key) === 'air', lift = air ? Math.max(1.2, size.y * 0.25) : 0;
  const platH = Math.max(0.4, r * 0.03), PR = Math.max(4, r * 1.25);
  current.position.y = platH - box.min.y + lift;
  turntable.add(current);
  const plat = scene.getObjectByName('plat'), ring = scene.getObjectByName('ring');
  plat.scale.set(PR, platH, PR); plat.position.y = platH / 2; ring.scale.setScalar(PR); ring.position.y = platH + 0.02;
  const R = Math.max(r, size.y * 0.8);
  distT = R * 3.1 + 6; dist = Math.max(dist, distT * 0.6);
  cam.userData.target = new THREE.Vector3(0, platH + size.y * 0.45 + lift, 0);
  cam.near = Math.max(0.1, R * 0.02); cam.far = Math.max(1500, R * 40); cam.updateProjectionMatrix();
  $('hgScale').textContent = `Eslora/longitud: ${size.z.toFixed(0)} m · manga/envergadura: ${size.x.toFixed(0)} m · cuadrícula del suelo de 10 m`;
}

// ---------- interfaz ----------
const bar = (v, label, txt) => `<div class="hb"><span>${label}</span><i><b style="width:${Math.round(Math.max(0.03, Math.min(1, v)) * 100)}%"></b></i><em>${txt}</em></div>`;
function statsHtml(key) {
  const m = info(key), st = STATICS[key], s = st ? { ...CLS[m.cls] } : specOf(key), dom = CLS[m.cls].dom, k = s.dispK || 1;
  const L = [];
  // barras comparables dentro de su dominio
  const maxHp = { sea: 4200, air: 900, land: 400, static: 1000 }[dom];
  L.push(bar(s.hp / maxHp, 'Resistencia', `${s.hp} pv`));
  if (dom === 'sea') L.push(bar(s.max * 0.95 * k / 45, 'Velocidad', `${Math.round(s.max * 0.95 * k)} nudos`));
  else if (dom === 'air') L.push(bar(s.max * 3.6 / 600, 'Velocidad', `${Math.round(s.max * 3.6)} km/h`));
  else if (dom === 'land') L.push(bar(s.max * 1.5 * k / 60, 'Velocidad', `${Math.round(s.max * 1.5 * k)} km/h`));
  const w = s.main || s.gun || s.deck || s.flak || s.guns || s.rifle || s.mg;
  if (w) {
    const dps = w.dmg * (w.n || 1) / Math.max(0.05, w.rof);
    L.push(bar(dps / (dom === 'sea' ? 45 : dom === 'air' ? 25 : 28), 'Potencia de fuego', `${(dps).toFixed(dps < 10 ? 1 : 0)} daño/s`));
    L.push(bar(w.range / (dom === 'sea' ? 1500 : 600), 'Alcance', `${w.range} m`));
  }
  if (s.armor) L.push(bar(1.1 / s.armor[0] - 0.4, 'Blindaje frontal', `recibe ×${s.armor[0].toFixed(2)}`));
  // armamento en detalle
  const A = [];
  if (s.main) A.push(`<b>Artillería principal</b> ${s.main.n > 1 ? s.main.n + ' torres · ' : ''}${s.main.dmg} de daño · recarga ${s.main.rof} s · ${s.main.range} m`);
  if (s.gun) A.push(`<b>Cañón</b> ${s.gun.dmg} de daño · recarga ${s.gun.rof} s · ${s.gun.range} m`);
  if (s.guns) A.push(`<b>Ametralladoras</b> ${s.guns.range} m · ${(s.guns.dmg / s.guns.rof).toFixed(0)} daño/s`);
  if (s.mg) A.push(`<b>Ametralladoras</b> ${s.mg.range} m`);
  if (s.rifle) A.push(`<b>Fusiles</b> ${s.rifle.range} m`);
  if (s.rocket) A.push(`<b>Arma antitanque</b> ${s.rocket.dmg} de daño · ${s.rocket.range} m`);
  if (s.torp) A.push(`<b>Torpedos</b> ${s.torp.dmg} de daño · ${s.ammo && s.ammo.torp ? s.ammo.torp + ' salvas' : ''}`);
  if (s.dc) A.push('<b>Cargas de profundidad</b> contra submarinos');
  if (s.deck) A.push(`<b>Cañón de cubierta</b> ${s.deck.dmg} de daño · ${s.deck.range} m`);
  if (s.bomb) A.push(`<b>Bombas</b> ${s.bomb.dmg} de daño · radio ${s.bomb.rad} m${s.bomb.stick ? ' · ráfagas de ' + s.bomb.stick : ''} · ${s.ammo && s.ammo.bomb ? s.ammo.bomb + ' a bordo' : ''}`);
  if (s.heavy) A.push(`<b>Artilleros</b> ${s.heavy.n} puestos automáticos`);
  else if (s.rear) A.push('<b>Artillero trasero</b> automático');
  if (s.aa) A.push(`<b>Antiaérea</b> ${s.aa.range} m`);
  if (s.flak) A.push(`<b>Flak</b> ${s.flak.dmg} de daño · ${s.flak.range} m`);
  if (s.hangar) A.push(`<b>Hangar</b> ${s.hangar} aviones`);
  if (s.armor) A.push(`<b>Blindaje</b> daño recibido ×${s.armor.map(a => a.toFixed(2)).join(' / ×')} (frente / lado / trasera)`);
  if (s.sub) A.push('<b>Inmersión</b> invisible y a salvo de los cañones bajo el agua');
  return { bars: L.join(''), arms: A.map(a => `<li>${a}</li>`).join('') };
}
function whereHtml(key) {
  const out = [];
  for (const [bk, b] of Object.entries(BATTLES)) {
    if (b.kind === 'test') continue;
    const ally = b.allies.some(([k]) => k === key), enemy = b.enemy.some(([k]) => k === key);
    const st = STATICS[key];
    const statMatch = st && ((st.cls === 'site' && b.kind === 'air') || (st.cls === 'aa' && (b.kind === 'air' || b.kind === 'combined') && FRONTS[b.front] && (st.fac === 'de') === (b.front !== 'pacific')) || (st.cls === 'battery' && b.kind === 'combined' && (st.fac === 'jp') === (b.front === 'pacific') && b.front !== 'africa'));
    if (ally || enemy || statMatch) out.push(`<button class="hgb" data-battle="${bk}"><b>${b.title}, ${b.year}</b><span>${FRONTS[b.front].name} · ${KIND_NAME[b.kind]}${ally ? ' · en tu bando' : ' · en el bando enemigo'}</span></button>`);
  }
  for (const [f, list] of Object.entries(UNLOCKS)) { const i = list.indexOf(key); if (i >= 0) out.push(`<p class="hgn">Se desbloquea en la campaña de ${FRONTS[f].name} al ganar la batalla ${i + 1}.</p>`); }
  return out.join('') || '<p class="hgn">No aparece en ninguna batalla: pruébalo en el campo de pruebas.</p>';
}
function listKeys() {
  return [...Object.keys(MODELS).filter(k => MODELS[k].cls !== 'merchant' || true), ...Object.keys(STATICS)]
    .filter(k => (filt.dom === 'all' || domOf(k) === filt.dom) && (filt.fac === 'all' || info(k).fac === filt.fac));
}
function renderList() {
  const keys = listKeys();
  $('hgList').innerHTML = keys.map(k => `<button class="hgi ${k === sel ? 'on' : ''}" data-k="${k}"><b>${info(k).name}</b><span>${info(k).type} · ${FAC_NAME[info(k).fac]}</span></button>`).join('') || '<p class="hgn">Sin unidades con este filtro.</p>';
  $('hgList').querySelectorAll('[data-k]').forEach(b => b.onclick = () => select(b.dataset.k));
  if (!keys.includes(sel) && keys.length) select(keys[0]);
}
function select(key) {
  sel = key; show3D(key);
  const m = info(key), r = roleOf(key) || ['', '', '—'], st = STATICS[key];
  const { bars, arms } = statsHtml(key);
  $('hgInfo').innerHTML = `<div class="hgf">${FAC_NAME[m.fac]} · ${m.type}</div><h2>${m.name}</h2><p class="hgr"><b>${r[0]}</b> — ${r[1]}</p>
    ${bars}<h4>Armamento y capacidades</h4><ul class="hga">${arms}</ul>
    ${r[2] !== '—' ? `<h4>Controles</h4><p class="hgk">${r[2]}</p>` : ''}
    ${st ? '' : `<p class="hgk">Coste de despliegue: <b>${costOf(key)}</b> puntos</p>`}
    ${(() => { const r = !st && roleOfUnit(key); return r ? `<h4>Papel en el grupo</h4><div class="hgrole"><b>${r.n}</b><p>${r.m}</p><p><em>Posición:</em> ${r.p}</p><p><em>Cuándo entra:</em> ${r.w}</p>${r.extra ? `<p><em>También como ${r.extra.n.toLowerCase()}:</em> ${r.extra.p}; ${r.extra.w.toLowerCase()}</p>` : ''}<button class="hgb" data-school="${r.dom}"><b>Escuela de mando: ${DOCTRINE[r.dom].n.toLowerCase()}</b><span>Misiones, distancias y fases del enfrentamiento de todo el grupo</span></button></div>` : ''; })()}
    ${!st && drillsFor(domOf(key)).length ? `<h4>Maniobras básicas</h4><div class="hgw">${drillsFor(domOf(key)).filter(dr => MODELS[key].cls !== 'inf' && MODELS[key].cls !== 'atgun').map(dr => `<button class="hgb" data-drill="${dr.id}"><b>${dr.t}</b><span>${dr.d}</span></button>`).join('')}</div>` : ''}
    <h4>Dónde combatir con él</h4><div class="hgw">${whereHtml(key)}</div>
    ${st ? '' : '<button class="btn" id="hgTest">Prueba rápida con esta unidad</button>'}`;
  if (!st) $('hgTest').onclick = () => opts.onTest && opts.onTest(key);
  $('hgInfo').querySelectorAll('[data-school]').forEach(b => b.onclick = () => opts.onSchool && opts.onSchool(b.dataset.school));
  $('hgInfo').querySelectorAll('[data-drill]').forEach(b => b.onclick = () => opts.onDrill && opts.onDrill(b.dataset.drill, key));
  $('hgInfo').querySelectorAll('[data-battle]').forEach(b => b.onclick = () => opts.onBattle && opts.onBattle(b.dataset.battle));
  $('hgList').querySelectorAll('.hgi').forEach(b => b.classList.toggle('on', b.dataset.k === key));
  const on = $('hgList').querySelector('.hgi.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  auto = true;
}

export function initHangar(o) {
  opts = o;
  $('hgDoms').innerHTML = DOMS.map(([k, n]) => `<button data-d="${k}" class="${k === filt.dom ? 'on' : ''}">${n}</button>`).join('');
  $('hgDoms').querySelectorAll('[data-d]').forEach(b => b.onclick = () => { filt.dom = b.dataset.d; $('hgDoms').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderList(); });
  $('hgFac').innerHTML = `<option value="all">Todos los países</option>` + Object.entries(FAC_NAME).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  $('hgFac').onchange = () => { filt.fac = $('hgFac').value; renderList(); };
  $('hgBack').onclick = () => opts.onBack && opts.onBack();
  // órbita con ratón o dedo, zoom con la rueda
  const cv = G.renderer.domElement;
  cv.addEventListener('pointerdown', ev => { if (!G.hangar) return; drag = { x: ev.clientX, y: ev.clientY, yaw, pitch }; auto = false; });
  addEventListener('pointermove', ev => { if (!G.hangar || !drag) return; yaw = drag.yaw - (ev.clientX - drag.x) * 0.008; pitch = Math.max(0.02, Math.min(1.35, drag.pitch + (ev.clientY - drag.y) * 0.006)); });
  addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', ev => { if (!G.hangar) return; distT = Math.max(4, Math.min(900, distT * (ev.deltaY > 0 ? 1.12 : 0.89))); ev.preventDefault(); }, { passive: false });
  addEventListener('keydown', ev => {
    if (!G.hangar) return;
    const keys = listKeys(), i = keys.indexOf(sel);
    if (ev.code === 'ArrowDown' || ev.code === 'ArrowRight') { select(keys[(i + 1) % keys.length]); ev.preventDefault(); }
    if (ev.code === 'ArrowUp' || ev.code === 'ArrowLeft') { select(keys[(i - 1 + keys.length) % keys.length]); ev.preventDefault(); }
    if (ev.code === 'Escape') opts.onBack && opts.onBack();
    if (ev.code === 'Enter' && !STATICS[sel]) opts.onTest && opts.onTest(sel);
  });
}
export function openHangar(key) {
  if (!scene) makeScene();
  G.hangar = true; $('hangar').classList.remove('hide');
  renderList(); if (key) select(key); else if (!sel) select(listKeys()[0]); else select(sel);
}
export function closeHangar() { G.hangar = false; $('hangar').classList.add('hide'); }
export function updateHangar(dt) {
  if (auto) yaw += dt * 0.25;
  dist += (distT - dist) * Math.min(1, dt * 4);
  const t = cam.userData.target || new THREE.Vector3();
  cam.position.set(t.x + Math.sin(yaw) * Math.cos(pitch) * dist, t.y + Math.sin(pitch) * dist, t.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.lookAt(t);
  if (current && sel && domOf(sel) === 'air') current.children.forEach(o => { if (o.userData && o.userData.props) o.userData.props.forEach(p => p.rotation.z += dt * 30); });
  if (current && current.userData.props) current.userData.props.forEach(p => p.rotation.z += dt * 30);
}
export function renderHangar(renderer) {
  cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  renderer.render(scene, cam);
}

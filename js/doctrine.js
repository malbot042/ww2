// Escuela de mando: doctrina de cada tipo de unidad dentro del grupo (manual) y demostraciones en 3D
import * as THREE from 'three';
import { G } from './state.js';
import { MODELS, specOf } from './data.js';
import { spawnUnit, anchorFor } from './units.js';
import { startTutorial, stopTutorial } from './tutorial.js';

const $ = id => document.getElementById(id);
// Las distancias son las del juego (el mapa está a escala reducida); entre paréntesis, la referencia real aproximada.
export const DOCTRINE = {
  sea: {
    n: 'Naval', intro: 'Una flota combate como un todo: cada tipo de buque protege a los demás de la amenaza que mejor contrarresta. Quien ve primero y dispara desde más lejos suele ganar.',
    roles: [
      { k: 'sub', n: 'Submarinos', m: 'Exploración y emboscada. Se adelantan para descubrir al enemigo y atacar con torpedos sus buques grandes.', p: '1200–1500 m por delante, en los flancos', w: 'Antes que nadie, sumergidos; se retiran si aparecen destructores.' },
      { k: 'destroyer', n: 'Destructores', m: 'Pantalla de la flota: cazan submarinos, protegen de lanchas y torpedos y, llegado el momento, lanzan su propio ataque con torpedos.', p: '500–700 m por delante en arco; uno pegado al portaaviones', w: 'Primeros en contacto de superficie; su ataque con torpedos se lanza cuando el enemigo ya está ocupado en el duelo artillero.' },
      { k: 'cruiser', n: 'Cruceros', m: 'Apoyo de la pantalla y defensa antiaérea. Su artillería media destroza destructores enemigos.', p: '250–350 m por delante del acorazado, a ambos lados', w: 'Abren fuego a unos 900 m; cubren a sus destructores cuando se lanzan.' },
      { k: 'battleship', n: 'Acorazados', m: 'Línea de batalla. Gran calibre a máxima distancia contra los buques más grandes del enemigo.', p: 'En el centro; a 1000–1300 m del enemigo, nunca más cerca', w: 'Disparan los primeros en cuanto el enemigo entra en alcance (1250–1500 m) y mantienen la distancia: de cerca son blanco fácil para torpedos.' },
      { k: 'carrier', n: 'Portaaviones', m: 'Ataque a gran distancia con sus aviones. Es el buque más valioso y el más vulnerable.', p: '800–1000 m detrás del acorazado, fuera del alcance enemigo', w: 'Lanza aviones desde el principio; nunca entra en el duelo de superficie.' },
      { k: 'pt', n: 'Lanchas torpederas', m: 'Golpe rápido por los flancos. Muy frágiles: solo sirven por sorpresa o de noche.', p: 'En los flancos, separadas de la flota', w: 'Cuando el enemigo está trabado con la línea de batalla; entran, lanzan y huyen.' },
    ],
    phases: ['Exploración: submarinos y aviones localizan al enemigo.', 'Duelo artillero: acorazados y luego cruceros abren fuego a máxima distancia.', 'Ataque de destructores: con el enemigo ocupado, la pantalla se lanza a 650 m, suelta torpedos y se retira tras humo.', 'Persecución: se rematan los buques dañados; el portaaviones sigue atrás.'],
    errors: ['Mandar el acorazado de cabeza: los torpedos lo hunden.', 'Dejar el portaaviones sin escolta antiaérea.', 'Lanzar los torpedos de frente y de lejos: hay que cortar la proa del blanco.', 'Destructores alejados de la flota cuando hay submarinos.'],
    layout: [['sub', -500, 1400], ['sub', 500, 1400], ['destroyer', -420, 600], ['destroyer', 0, 680], ['destroyer', 420, 600], ['cruiser', -220, 300], ['cruiser', 220, 300], ['battleship', 0, 0], ['carrier', 0, -900], ['destroyer', 120, -900], ['pt', -700, 250], ['pt', 700, 250]],
  },
  air: {
    n: 'Aérea', intro: 'En el aire manda la altura y la velocidad. La misión casi siempre es que los bombarderos lleguen al objetivo; los cazas existen para que eso ocurra.',
    roles: [
      { k: 'cover', n: 'Cazas de cobertura alta', m: 'Ganar la superioridad aérea: interceptan a los cazas enemigos antes de que lleguen a los bombarderos.', p: '300–400 m por delante y 60–100 m por encima de la formación', w: 'Los primeros en entrar en combate: atacan picando desde arriba.' },
      { k: 'escort', n: 'Escolta cercana', m: 'Pegados a los bombarderos; solo atacan a quien se acerque a ellos.', p: '100–200 m a los lados de los bombarderos, a su altura', w: 'Nunca persiguen lejos: si se van, los bombarderos quedan solos.' },
      { k: 'heavy', n: 'Bombarderos pesados', m: 'Destruir el objetivo. Vuelan en formación en caja para cruzar el fuego de sus artilleros.', p: 'En el centro, a gran altura (≈ 200 m en el juego), juntos', w: 'Mantienen el rumbo pase lo que pase; sueltan en ráfaga sobre el objetivo.' },
      { k: 'bomber', n: 'Bombarderos en picado / torpederos', m: 'Atacar barcos, carros y baterías con precisión.', p: 'Detrás de la cobertura; esperan a que el cielo esté despejado', w: 'Después de que los cazas hayan trabado a la caza enemiga.' },
      { k: 'aa', n: 'Antiaérea enemiga', m: 'Es la mayor amenaza para los bombarderos sobre el objetivo.', p: 'Alrededor de instalaciones y flotas (alcance 300–350 m)', w: 'Cruza su zona lo más rápido posible y desde altura.' },
    ],
    phases: ['Reunión: cazas y bombarderos forman antes de cruzar la línea.', 'Contacto: la cobertura alta sale al encuentro de los cazas enemigos.', 'Penetración: los bombarderos siguen su rumbo con la escolta cercana.', 'Ataque y regreso: tras soltar, todos regresan juntos; los dañados primero.'],
    errors: ['Toda la escolta persiguiendo al mismo caza.', 'Bombarderos que rompen la formación al ser atacados.', 'Entrar bajo y lento en la zona antiaérea.', 'Combatir girando contra un caza más ágil en vez de picar y subir.'],
    layout: [['heavy', 0, 0], ['heavy', -45, -35], ['heavy', 45, -35], ['escort', -160, 0], ['escort', 160, 0], ['cover', -120, 350], ['cover', 120, 350]],
  },
  land: {
    n: 'Terrestre', intro: 'En tierra se avanza por saltos: unos se mueven mientras otros vigilan, y cada arma se usa contra lo que mejor destruye.',
    roles: [
      { k: 'inf', n: 'Infantería', m: 'Ojos del grupo en terreno cerrado: limpia pueblos, setos y bosques y caza cañones antitanque y carros a corta distancia.', p: '80–150 m por delante de los carros en terreno cerrado', w: 'Primera en entrar en pueblos y setos; los carros no entran sin ella.' },
      { k: 'tank', n: 'Carros medios', m: 'Fuerza principal de choque: avanzan, toman objetivos y destruyen blindados. Mejor de frente y por parejas.', p: 'Detrás de la infantería; 30–50 m entre carros', w: 'Avanzan por saltos de 150–200 m mientras otros cubren.' },
      { k: 'overwatch', n: 'Cazacarros / carros de cañón largo', m: 'Vigilancia (overwatch): cubren el avance desde una posición elevada y destruyen blindados enemigos a gran distancia.', p: '150–250 m detrás y a un flanco, con buena vista', w: 'Disparan los primeros contra blindados, a 500–600 m.' },
      { k: 'atgun', n: 'Cañones antitanque', m: 'Defensa: casi inmóviles pero letales. Se colocan cubriendo un objetivo.', p: 'Junto al objetivo, a cubierto, mirando a la ruta enemiga', w: 'Esperan a que el enemigo entre en 400–500 m.' },
      { k: 'support', n: 'Apoyo (artillería y aviación)', m: 'Ablandar posiciones y romper concentraciones antes del asalto.', p: 'Fuera del mapa: se pide con 7', w: 'Justo antes del asalto, sobre el objetivo o los cañones enemigos.' },
    ],
    phases: ['Reconocimiento: la infantería avanza y descubre al enemigo.', 'Fijar: los carros de cañón largo y la artillería ocupan al enemigo desde lejos.', 'Maniobra: los carros medios flanquean por saltos, cubiertos por la vigilancia.', 'Asalto y consolidación: se toma el objetivo y se colocan cañones antitanque mirando al contraataque.'],
    errors: ['Carros solos dentro de un pueblo: la infantería enemiga los destruye.', 'Atacar de frente a un Panther o un Tiger.', 'Mover todo el grupo a la vez sin nadie que cubra.', 'Enseñar el costado al enemigo al girar.'],
    layout: [['tank', 0, 0], ['inf', -60, 140], ['inf', 60, 140], ['tank', -90, 30], ['tank', 60, 0], ['tank', 150, 30], ['overwatch', 200, -180], ['atgun', -150, -150]],
  },
  combined: {
    n: 'Combinada', intro: 'En un desembarco o una batalla combinada, cada dominio prepara el terreno al siguiente.',
    roles: [
      { k: 'air', n: 'Aviación', m: 'Primero, superioridad aérea: sin ella, barcos y carros quedan expuestos.', p: 'Sobre la playa y por delante de la flota', w: 'Desde el primer minuto.' },
      { k: 'sea', n: 'Flota', m: 'Bombardea las baterías costeras y protege el desembarco de buques enemigos.', p: '900–1300 m de la costa, fuera del alcance de las baterías más pesadas', w: 'Antes y durante el desembarco.' },
      { k: 'land', n: 'Tropas de tierra', m: 'Toman la playa y los objetivos de tierra; los carros desembarcan tras la infantería.', p: 'En la playa y hacia el interior', w: 'Cuando las baterías están calladas o dañadas.' },
    ],
    phases: ['Superioridad aérea.', 'Bombardeo naval de baterías y defensas.', 'Desembarco: infantería primero, carros después.', 'Avance hacia el interior con apoyo aéreo.'],
    errors: ['Desembarcar con las baterías intactas.', 'Barcos demasiado cerca de la costa.', 'Olvidar la defensa antiaérea de la flota.'],
    layout: null,
  },
};
const ROLE_OF = { cover: 'fighter', escort: 'fighter', overwatch: 'tank', support: null, air: null, sea: null, land: null, aa: null };
// papel de una unidad del juego dentro del grupo
export function roleOfUnit(key) {
  const m = MODELS[key]; if (!m) return null;
  const s = specOf(key), dom = s.dom;
  const D = DOCTRINE[dom]; if (!D) return null;
  let k = m.cls;
  if (dom === 'air') k = s.heavy ? 'heavy' : m.cls === 'fighter' ? 'cover' : 'bomber';
  if (dom === 'land' && m.cls === 'tank' && s.gun && s.gun.range >= 560) k = 'overwatch';
  const r = D.roles.find(x => x.k === k);
  return r ? { dom, ...r, extra: dom === 'air' && m.cls === 'fighter' ? D.roles.find(x => x.k === 'escort') : null } : null;
}

// ---------- diagrama de formación (SVG) ----------
const COL = { sub: '#7fb0ff', destroyer: '#9be29b', cruiser: '#f2c94c', battleship: '#ff9a6a', carrier: '#c99bff', pt: '#7fe0d8', heavy: '#ff9a6a', escort: '#9be29b', cover: '#7fb0ff', inf: '#9be29b', tank: '#f2c94c', overwatch: '#ff9a6a', atgun: '#c99bff' };
function diagram(dom) {
  const D = DOCTRINE[dom]; if (!D.layout) return '';
  const xs = D.layout.map(l => l[1]), zs = D.layout.map(l => l[2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = 420, H = 300, pad = 34, sx = (W - pad * 2) / Math.max(1, maxX - minX), sz = (H - pad * 2) / Math.max(1, maxZ - minZ), k = Math.min(sx, sz);
  const X = x => W / 2 + (x - (minX + maxX) / 2) * k, Y = z => H / 2 - (z - (minZ + maxZ) / 2) * k;
  const dots = D.layout.map(([r, x, z]) => `<circle cx="${X(x).toFixed(1)}" cy="${Y(z).toFixed(1)}" r="7" fill="${COL[r]}" stroke="#0e1216" stroke-width="2"/>`).join('');
  const names = Object.fromEntries(D.roles.map(r => [r.k, r.n]));
  const legend = [...new Set(D.layout.map(l => l[0]))].map((r, i) => `<g transform="translate(${8 + (i % 3) * 140},${H + 10 + Math.floor(i / 3) * 18})"><circle r="5" cx="5" cy="-4" fill="${COL[r]}"/><text x="15" y="0">${names[r] || r}</text></g>`).join('');
  const rows = Math.ceil(new Set(D.layout.map(l => l[0])).size / 3);
  return `<svg class="dgm" viewBox="0 0 ${W} ${H + 14 + rows * 18}"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.12)"/>
    <text x="${W / 2}" y="18" text-anchor="middle" class="dgt">▲ hacia el enemigo</text>${dots}${legend}</svg>`;
}

// ---------- pantalla del manual ----------
let cur = 'sea', opts = {};
export function initSchool(o) {
  opts = o;
  $('scTabs').innerHTML = Object.entries(DOCTRINE).map(([k, d]) => `<button data-d="${k}">${d.n}</button>`).join('');
  $('scTabs').querySelectorAll('[data-d]').forEach(b => b.onclick = () => renderSchool(b.dataset.d));
  $('scBack').onclick = () => opts.onBack && opts.onBack();
}
export function openSchool(dom) { $('school').classList.remove('hide'); renderSchool(dom || cur); }
export function closeSchool() { $('school').classList.add('hide'); }
function renderSchool(dom) {
  cur = dom; const D = DOCTRINE[dom];
  $('scTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.d === dom));
  $('scBody').innerHTML = `<p class="sci">${D.intro}</p>
    <div class="scg"><div>${diagram(dom)}${D.layout ? '<p class="scn">Formación de partida vista desde arriba. Las distancias son las del juego.</p>' : ''}</div>
    <div><h4>Fases del enfrentamiento</h4><ol class="scp">${D.phases.map(p => `<li>${p}</li>`).join('')}</ol>
    <h4>Errores típicos</h4><ul class="sce">${D.errors.map(p => `<li>${p}</li>`).join('')}</ul>
    ${DEMOS[dom] ? `<button class="btn" id="scDemo">Ver la demostración en 3D</button>` : ''}</div></div>
    <h4>Misión de cada unidad en el grupo</h4>
    <table class="sct"><tr><th>Unidad</th><th>Misión</th><th>Posición y distancia</th><th>Cuándo entra en combate</th></tr>
    ${D.roles.map(r => `<tr><td><b style="color:${COL[r.k] || '#e9eef2'}">${r.n}</b></td><td>${r.m}</td><td>${r.p}</td><td>${r.w}</td></tr>`).join('')}</table>`;
  const b = $('scDemo'); if (b) b.onclick = () => opts.onDemo && opts.onDemo(dom);
}

// ---------- demostración en el campo de pruebas ----------
let demo = null;
const MARK = new Map();
function label(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d');
  g.font = 'bold 22px system-ui, sans-serif'; const w = Math.min(250, g.measureText(text).width + 18);
  g.fillStyle = 'rgba(10,14,18,.75)'; g.fillRect((256 - w) / 2, 6, w, 34); g.fillStyle = color; g.textAlign = 'center'; g.fillText(text, 128, 31);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false })); s.renderOrder = 20; return s;
}
function ring(r, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - 3, r, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 5; return m;
}
function mark(e, text, role) {
  const col = COL[role] || '#ffffff', g = new THREE.Group(), lb = label(text, col);
  const s = e.s, r = s.main ? s.main.range : s.gun ? s.gun.range : s.torp ? 650 : s.guns ? s.guns.range : s.aa ? s.aa.range : 0;
  if (r) g.add(ring(r, new THREE.Color(col)));
  G.scene.add(g); G.scene.add(lb); MARK.set(e, { g, lb, role });
}
function clearMarks() { for (const [, m] of MARK) { G.scene.remove(m.g); G.scene.remove(m.lb); } MARK.clear(); }
function updateMarks() {
  for (const [e, m] of MARK) {
    if (!e.alive) { m.g.visible = m.lb.visible = false; continue; }
    m.g.position.set(e.p.x, Math.max(0.6, e.dom === 'land' ? e.p.y + 0.6 : 0.6), e.p.z);
    const k = G.zoom / 900; m.lb.scale.set(110 * k, 21 * k, 1); m.lb.position.set(e.p.x, (e.p.y || 0) + 30 * k + 10, e.p.z);
  }
}
// rumbo libre: busca una dirección con el terreno adecuado durante d metros
function freeHeading(x, z, dom, d) {
  let best = 0, bs = -1;
  for (let a = 0; a < 16; a++) {
    const h = a / 16 * Math.PI * 2; let ok = 0;
    for (let r = 200; r <= d; r += 150) { const px = x + Math.sin(h) * r, pz = z + Math.cos(h) * r, y = G.map.h(px, pz); if (Math.abs(px) > G.map.bounds || Math.abs(pz) > G.map.bounds) break; if (dom === 'sea' ? y < -6 : y > 3) ok++; else break; }
    if (ok > bs) { bs = ok; best = h; }
  }
  return best;
}
const rel = (o, h, x, z) => [o.x + Math.sin(h) * z + Math.cos(h) * x, o.z + Math.cos(h) * z - Math.sin(h) * x];
const UNIT = { sea: { sub: 'gato', destroyer: 'fletcher', cruiser: 'baltimore', battleship: 'washington', carrier: 'yorktown', pt: 'pt109' }, air: { heavy: 'b17', escort: 'p51', cover: 'p47' }, land: { inf: 'inf_us', tank: 'sherman', overwatch: 'firefly', atgun: 'at_us' } };
const ENEMY = { sea: [['kirishima', 0, 0], ['takao', -250, -150], ['kagero', 300, 250], ['kagero', -300, 250]], air: [['bf109g', -80, 0], ['bf109g', 80, 0], ['fw190f', 0, 60], ['bf109g', 0, -60]], land: [['pz4h', -80, 0], ['pz4h', 80, 30], ['pak40', 0, 60], ['inf_de', 40, 90]] };
const DIST = { sea: 2700, air: 1500, land: 950 };
function setup(dom, ctx) {
  ctx.clear();
  const D = DOCTRINE[dom], spots = G.map.extra.spots || {}, reg = dom === 'sea' ? 'trop' : 'eur';
  const sp = spots[reg] ? spots[reg][dom === 'air' ? 'land' : dom] : [0, 0];
  const o0 = anchorFor({ dom: dom === 'air' ? 'air' : dom }, sp[0], sp[1]);
  const h = freeHeading(o0.x, o0.z, dom === 'air' ? 'land' : dom, DIST[dom] + 600);
  // la unidad del jugador pasa a ser el buque/avión/carro guía (pilotado por la IA durante la demostración)
  const lead = D.layout.find(l => l[1] === 0 && l[2] === 0) || D.layout[0];
  ctx.quickTest(UNIT[dom][lead[0]], false);
  const P = G.player; P.p.x = o0.x; P.p.z = o0.z; if (dom === 'land') P.p.y = G.map.gy(o0.x, o0.z); P.h = h; P.speed = 0;
  const units = [{ e: P, role: lead[0], x: 0, z: 0 }];
  for (const [role, x, z] of D.layout) {
    if (role === lead[0] && x === 0 && z === 0) continue;
    const [px, pz] = rel(o0, h, x, z), a = anchorFor({ dom: dom === 'air' ? 'air' : dom }, px, pz);
    const e = spawnUnit(UNIT[dom][role], 'A', a.x, a.z, h); units.push({ e, role, x, z });
    if (dom === 'air') { e.alt = e.baseAlt = role === 'cover' ? 260 : role === 'escort' ? 210 : 205; e.p.y = e.alt; }
  }
  if (dom === 'air') { P.alt = P.baseAlt = 205; P.p.y = P.alt; }
  const names = Object.fromEntries(D.roles.map(r => [r.k, r.n]));
  units.forEach(u => mark(u.e, names[u.role] || u.role, u.role));
  // enemigo de la demostración
  const [ex, ez] = rel(o0, h, 0, DIST[dom]);
  const foes = ENEMY[dom].map(([k, x, z]) => {
    const [px, pz] = rel({ x: ex, z: ez }, h + Math.PI, x, z), a = anchorFor({ dom: specOf(k).dom }, px, pz);
    const e = spawnUnit(k, 'E', a.x, a.z, h + Math.PI);
    // enemigo real pero debilitado: avanza hacia el grupo (en tierra defiende su posición)
    e.order = { type: 'hold', x: a.x, z: a.z }; // espera hasta que empiece la acción (paso 2)
    e.goOrder = dom === 'land' ? null : dom === 'air' ? { type: 'attack' } : { type: 'move', x: o0.x, z: o0.z };
    e.s.hp = Math.round(e.s.hp * 0.55); e.hp = e.s.hp; e.demoFoe = true;
    if (dom === 'air') { e.alt = e.baseAlt = 230; e.p.y = 230; }
    return e;
  });
  demo = { dom, h, units, foes, o0, t: 0, phase: 'form', keep: true };
  G.autoPilot = true; G.targetZoom = G.zoom = dom === 'sea' ? 1400 : dom === 'air' ? 900 : 600;
}
// mantener cada unidad en su puesto respecto al guía (o dejarla actuar según la fase)
function station(dt) {
  if (!demo) return;
  demo.t += dt; updateMarks();
  const P = G.player; if (!P || !P.alive) return;
  const goal = rel(demo.o0, demo.h, 0, DIST[demo.dom] + 400);
  // el guía mantiene la distancia de su arma principal; el enemigo de la demostración se detiene a media distancia
  if (demo.go && !demo.foesGo) { demo.foesGo = true; for (const f of demo.foes) if (f.alive && f.goOrder) { f.order = f.goOrder; f.ai.think = 0; } }
  const nd = near();
  if (demo.dom === 'sea' && nd < 1250) demo.leadStop = true;
  if (demo.dom === 'land' && nd < 600) demo.leadStop = true;
  if (demo.leadStop || !demo.go) { if (!demo.holdPt || (demo.go && !demo.holdGo)) { demo.holdPt = [P.p.x, P.p.z]; demo.holdGo = demo.go; } P.order = { type: 'hold', x: demo.holdPt[0], z: demo.holdPt[1] }; }
  else P.order = { type: 'move', x: goal[0], z: goal[1] };
  for (const u of demo.units) {
    if (u.e === P || !u.e.alive) continue;
    const free = demo.free && demo.free(u);
    if (free) { if (u.e.order.type !== free.type || free.force) { u.e.order = free; u.e.ai.think = 0; } continue; }
    if (demo.dom === 'air') { if (u.role === 'escort' && u.e.order.type !== 'escort') u.e.order = { type: 'escort', lead: P.id }; if (u.role !== 'cover') continue; }
    const [x, z] = rel(P.p, demo.h, u.x, u.z);
    u.e.order = { type: 'move', x, z };
  }
}
const near = () => { const P = G.player; return Math.min(...demo.foes.filter(f => f.alive).map(f => Math.hypot(f.p.x - P.p.x, f.p.z - P.p.z)), 1e9); };
const foeMain = () => demo.foes.find(f => f.alive) || null;
const S = (t, d, o = {}) => ({ t, d, ...o, ok: o.ok || (() => false) });
export const DEMOS = {
  sea: [
    S('La flota en formación', 'Tu buque es el <b>acorazado</b> del centro (lo pilota la IA). Cada anillo es el alcance de las armas de esa unidad. Los <b>submarinos</b> van muy adelantados, la <b>pantalla de destructores</b> en arco por delante, los <b>cruceros</b> a los lados y el <b>portaaviones</b> atrás con su escolta. Pulsa <b>Siguiente</b>.'),
    S('Exploración', 'La flota se pone en marcha. Los submarinos y los aviones del portaaviones son los primeros en ver al enemigo: una flota (debilitada para la demostración) que viene hacia nosotros. La formación sigue su rumbo sin cambiar de puesto.', { init: () => { demo.go = true; }, ok: () => near() < 2000 }),
    S('Duelo artillero', 'En cuanto el enemigo entra en su alcance (el anillo naranja), el acorazado abre fuego desde la máxima distancia. Los cruceros dispararán al llegar a unos 900 m. La pantalla sigue en su puesto. Pulsa <b>Siguiente</b> cuando lo veas disparar.', { init: () => { demo.free = u => u.role === 'cruiser' && near() < 1000 ? { type: 'attack' } : null; } }),
    S('Ataque de destructores', 'Con el enemigo ocupado en el duelo, los destructores salen de la pantalla, se acercan a unos 650 m cortando su proa y lanzan torpedos. El acorazado <b>se detiene y mantiene la distancia</b>: de cerca sería blanco fácil.', { init: () => { demo.leadStop = true; demo.free = u => u.role === 'destroyer' && u.z > 0 ? { type: 'attack' } : u.role === 'cruiser' ? { type: 'attack' } : u.role === 'pt' ? { type: 'attack' } : null; } }),
    S('Portaaviones y antiaérea', 'El portaaviones nunca entra en el duelo: se queda atrás con su destructor de escolta y sigue lanzando aviones. Los cruceros, con la mejor antiaérea, cubren a la flota. Fin de la demostración: pulsa <b>Siguiente</b>.'),
  ],
  air: [
    S('La formación', 'Vuelas en el <b>B-17 guía</b> (lo pilota la IA). Los bombarderos van en caja, la <b>escolta cercana</b> a sus lados y la <b>cobertura alta</b> por delante y más arriba. Pulsa <b>Siguiente</b>.'),
    S('Contacto', 'Cazas enemigos vienen a por los bombarderos. La cobertura alta sale a su encuentro antes de que lleguen a los bombarderos, atacando desde arriba.', { init: () => { demo.go = true; demo.free = u => u.role === 'cover' ? { type: 'attack' } : null; }, ok: () => near() < 500 }),
    S('La escolta no persigue', 'Los cazas de escolta cercana se quedan junto a los bombarderos y solo disparan a quien se acerque. Si se fueran a perseguir, la caja quedaría sola. Los bombarderos <b>no cambian el rumbo</b> y se defienden con sus artilleros. Pulsa <b>Siguiente</b>.'),
    S('Resumen', 'Superioridad primero, rumbo constante y formación cerrada. Fin de la demostración: pulsa <b>Siguiente</b>.'),
  ],
  land: [
    S('El grupo de combate', 'Mandas el <b>Sherman</b> central (lo conduce la IA). La <b>infantería</b> va por delante explorando, los <b>carros</b> detrás separados 30–50 m, el <b>Firefly</b> vigila desde atrás y a un flanco y el <b>cañón antitanque</b> cubre la retaguardia. Pulsa <b>Siguiente</b>.'),
    S('Avance por saltos', 'El grupo avanza: la mitad de los carros se mueve mientras la otra mitad vigila, y luego se cambian. Así siempre hay alguien listo para disparar.', { init: () => { demo.go = true; demo.t = 0; demo.free = u => { if (u.role !== 'tank') return null; const ph = Math.floor(demo.t / 6) % 2; return (u.x < 0) === (ph === 0) ? { type: 'hold', x: u.e.p.x, z: u.e.p.z } : null; }; }, ok: () => near() < 650 }),
    S('Fijar y vigilar', 'Al aparecer el enemigo, el <b>Firefly</b> abre fuego desde lejos (≈ 580 m) para fijarlo, mientras la infantería se ocupa del cañón antitanque. El guía se detiene.', { init: () => { demo.leadStop = true; demo.free = u => u.role === 'overwatch' || u.role === 'inf' ? { type: 'attack' } : u.role === 'tank' ? { type: 'hold', x: u.e.p.x, z: u.e.p.z } : null; } }),
    S('Flanqueo y asalto', 'Con el enemigo fijado, los carros medios salen por los flancos para disparar a sus costados. Fin de la demostración: pulsa <b>Siguiente</b>.', { init: () => { demo.free = u => u.role === 'atgun' ? null : { type: 'attack' }; } }),
  ],
};
export function runDoctrineDemo(dom, ctx) {
  setup(dom, ctx);
  startTutorial(() => endDemo(ctx), {
    steps: DEMOS[dom], title: `Escuela de mando · ${DOCTRINE[dom].n}`, god: true, exitLabel: 'Cerrar', skipLabel: 'Siguiente',
    doneTitle: 'Demostración terminada', done: 'Tienes la explicación completa (misiones, distancias y errores típicos) en la <b>Escuela de mando</b> del menú principal y en la ficha de cada unidad del hangar.',
  });
}
function endDemo(ctx) { clearMarks(); demo = null; G.autoPilot = false; ctx && ctx.onEnd && ctx.onEnd(); }
export function updateDoctrine(dt) { if (demo) station(dt); }
export function stopDoctrineDemo() { if (demo) { stopTutorial(false); endDemo(); } }

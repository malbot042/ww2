// Maniobras básicas: lecciones cortas y guiadas de combate naval, aéreo y con carros.
// Se juegan en el campo de pruebas con el panel del tutorial (pasos que se comprueban solos).
import { G } from './state.js';
import { MODELS, specOf } from './data.js';
import { spawnUnit, anchorFor } from './units.js';
import { startTutorial, stopTutorial } from './tutorial.js';

const TAU = Math.PI * 2;
const ad = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const bearing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const P = () => G.player;
let st = {};

// coloca una unidad enemiga respecto a la proa del jugador (dist en m, ang en rad, rumbo relativo opcional)
function foe(key, d, ang, o = {}) {
  const p = P(), a = p.h + ang, dom = specOf(key).dom || 'land';
  const q = anchorFor({ dom }, p.p.x + Math.sin(a) * d, p.p.z + Math.cos(a) * d);
  const h = o.face === 'away' ? bearing(p.p, q) : o.heading !== undefined ? p.h + o.heading : bearing(q, p.p);
  const e = spawnUnit(key, 'E', q.x, q.z, h);
  if (o.passive !== false) { e.passive = true; e.passiveMove = !!o.move; if (o.steer !== undefined) e.passiveSteer = o.steer; }
  e.order = { type: 'hold', x: q.x, z: q.z };
  if (dom === 'air') { e.alt = o.alt ?? p.p.y; e.p.y = e.alt; e.baseAlt = e.alt; }
  if (o.hp) { e.s.hp = o.hp; e.hp = o.hp; }
  return e;
}
// temporizador de "mantén esta condición N segundos"
const hold = (k, cond, dt, secs) => { st[k] = cond ? (st[k] || 0) + dt : 0; return st[k] >= secs; };
const kb = k => `<kbd>${k}</kbd>`;

export const DRILLS = [
  // ---------------- NAVAL ----------------
  {
    id: 'broadside', dom: 'sea', unit: 'fletcher', t: 'Andanada: ponte de costado', req: s => !!s.main,
    d: 'Con el barco de costado disparan todas las torres; de proa, solo las delanteras.',
    steps: [
      { t: 'Fija el blanco', d: `Delante tienes un crucero enemigo inmóvil. Pulsa ${kb('T')} para fijarlo.`, init: () => { st.tg = foe('takao', 900, 0.15, { hp: 900 }); }, ok: () => P().lock === st.tg },
      { t: 'Acércate a tiro', d: 'Avanza con ↑ hasta que el panel deje de decir «fuera de alcance» (unos 600 m).', ok: () => dist(P().p, st.tg.p) < Math.min(640, P().s.main.range * 0.95) },
      { t: 'Ponte de costado', d: 'Gira con ← → hasta que el enemigo quede <b>a tu través</b> (90° a babor o estribor). Así todas tus torres pueden apuntarle. Aguanta 3 s.', ok: dt => hold('bs', Math.abs(Math.abs(ad(bearing(P().p, st.tg.p), P().h)) - Math.PI / 2) < 0.45, dt, 3) },
      { t: 'Fuego de andanada', d: `Dispara con ${kb('Espacio')} manteniéndote de costado. Haz 200 puntos de daño.`, init: () => { st.dmg = 0; G.drillHook = (e, d, k) => { if (e === st.tg && k !== 'torp') st.dmg += d; }; }, ok: () => st.dmg >= 200 || !st.tg.alive },
    ],
  },
  {
    id: 'torpedo', dom: 'sea', unit: 'fletcher', t: 'Ataque con torpedos', req: s => !!s.torp,
    d: 'Los torpedos tardan en llegar: se apuntan donde estará el blanco, no donde está.',
    steps: [
      { t: 'Aproximación', d: 'Un destructor enemigo cruza por delante en línea recta. Fíjalo con <kbd>T</kbd> y acércate a menos de 650 m.', init: () => { st.tg = foe('kagero', 1000, 0.35, { move: true, steer: 0, heading: -Math.PI / 2 }); }, ok: () => dist(P().p, st.tg.p) < 650 },
      { t: 'Lanza con ventaja', d: `La línea discontinua marca la dirección de lanzamiento con la ventaja ya calculada. Cuando apunte por delante del blanco, pulsa ${kb('Shift')}.`, init: () => { st.l = P().ammo.torp; P().ammo.torp = Math.max(P().ammo.torp || 0, 6); st.l = P().ammo.torp; }, ok: () => P().ammo.torp < st.l },
      { t: 'Impacto', d: 'Espera a que lleguen. Si fallan, la recarga es rápida en esta práctica: corrige el ángulo y vuelve a lanzar.', init: () => { st.hit = false; G.drillHook = (e, d, k) => { if (e === st.tg && k === 'torp') st.hit = true; }; }, ok: () => { if (P().cd.torp > 6) P().cd.torp = 6; return st.hit || !st.tg.alive; } },
    ],
  },
  {
    id: 'asw', dom: 'sea', unit: 'fletcher', t: 'Caza de submarinos', req: s => !!s.dc,
    d: 'Sumergido, un submarino solo se puede hundir con cargas de profundidad lanzadas justo encima.',
    steps: [
      { t: 'Localízalo', d: 'Hay un submarino sumergido unos 500 m justo por delante; los destructores lo detectan con el sonar (aparece en el minimapa). Navega hacia él hasta estar a menos de 120 m.', init: () => { st.tg = foe('u7c', 500, 0.1, { hp: 260 }); st.tg.submerged = true; st.tg.detected = 999; }, ok: () => dist(P().p, st.tg.p) < 120 },
      { t: 'Cargas de profundidad', d: `Pasa por encima a toda máquina y pulsa (o mantén) ${kb('C')}: las cargas caen por la popa y estallan bajo el agua.`, init: () => { st.hit = false; G.drillHook = (e, d, k) => { if (e === st.tg && k === 'dc') st.hit = true; }; }, ok: () => st.hit || !st.tg.alive },
      { t: 'Remátalo', d: 'Da otra pasada hasta hundirlo. Consejo: gira amplio y vuelve a pasar en línea recta sobre él.', ok: () => { st.tg.detected = 999; return !st.tg.alive; } },
    ],
  },
  // ---------------- AÉREA ----------------
  {
    id: 'energy', dom: 'air', unit: 'p51', t: 'Altitud y energía', req: () => true,
    d: 'Subir cuesta velocidad; picar la devuelve. Quien tiene altura elige cuándo combatir.',
    steps: [
      { t: 'Sube', d: 'Mantén ↓ para tirar de la palanca y subir por encima de 200 m. Fíjate cómo baja la velocidad.', ok: () => P().p.y - G.map.gy(P().p.x, P().p.z) > 200 },
      { t: 'Pica', d: 'Ahora mantén ↑ para picar hasta bajar de 90 m. Ganarás velocidad: es la energía que usarás para alcanzar o escapar.', init: () => { st.v0 = P().speed; }, ok: () => P().p.y - G.map.gy(P().p.x, P().p.z) < 90 && P().speed > st.v0 * 1.05 },
      { t: 'Viraje cerrado', d: 'Da una vuelta completa con ← o →. Un viraje cerrado pierde velocidad: no lo alargues si te persiguen.', init: () => { st.turn = 0; st.h = P().h; }, ok: () => { st.turn += Math.abs(ad(P().h, st.h)); st.h = P().h; return st.turn > TAU; } },
    ],
  },
  {
    id: 'six', dom: 'air', unit: 'p51', t: 'Ponte a sus seis', req: s => !!s.guns,
    d: 'La posición ganadora es detrás del enemigo (sus «seis»): él no te ve y tú tienes tiro fácil.',
    steps: [
      { t: 'Fija el bombardero', d: `Un bombardero enemigo vuela por delante. Pulsa ${kb('T')} para fijarlo.`, init: () => { st.tg = foe('ju87', 500, 0.5, { steer: 0.06, heading: 0.4, hp: 200 }); }, ok: () => P().lock === st.tg },
      { t: 'Colócate detrás', d: 'Persíguelo hasta quedar <b>justo detrás</b>, a menos de 300 m y con su cola apuntándote. Aguanta 2 s.', ok: dt => hold('six', dist(P().p, st.tg.p) < 300 && Math.abs(ad(bearing(st.tg.p, P().p), st.tg.h + Math.PI)) < 0.6, dt, 2) },
      { t: 'Derríbalo', d: `Dispara con ${kb('Espacio')}: las ametralladoras corrigen un poco solas si el blanco está en el cono de tiro.`, ok: () => !st.tg.alive },
    ],
  },
  {
    id: 'divebomb', dom: 'air', unit: 'sbd', t: 'Bombardeo en picado', req: s => !!s.bomb,
    d: 'Las bombas caen con la inercia del avión: el anillo amarillo del suelo marca dónde impactarán.',
    steps: [
      { t: 'Busca el blanco', d: 'Hay tres carros enemigos por delante. Vuela hacia ellos.', init: () => { st.tg = [foe('pz4h', 800, 0, { hp: 120 }), foe('pz4h', 830, 0.06, { hp: 120 }), foe('pz4h', 780, -0.06, { hp: 120 })]; }, ok: () => dist(P().p, st.tg[0].p) < 450 },
      { t: 'Pica y apunta', d: `Pica con ↑ para bajar y corrige con ← → hasta que el anillo de impacto cubra un carro. Entonces pulsa ${kb('Shift')}.`, init: () => { st.hit = false; P().ammo.bomb = Math.max(P().ammo.bomb || 0, 6); G.drillHook = (e, d, k) => { if (st.tg.includes(e) && k === 'bomb') st.hit = true; }; }, ok: () => st.hit },
      { t: 'Destruye uno', d: 'Recupera altura con ↓, da la vuelta y repite hasta destruir al menos un carro.', ok: () => st.tg.some(e => !e.alive) },
    ],
  },
  // ---------------- CARROS ----------------
  {
    id: 'front', dom: 'land', unit: 'sherman', t: 'Blindaje: da el frente', req: s => !!s.armor,
    d: 'El blindaje frontal es el más grueso. Gira el casco hacia la amenaza y no enseñes el costado.',
    steps: [
      { t: 'Gira hacia la amenaza', d: 'Un Panzer IV dispara desde tu flanco. Gira con ← → hasta que <b>el casco</b> (no solo la torreta) le apunte, y aguanta 4 s. En esta práctica eres invulnerable.', init: () => { st.tg = foe('pz4h', 420, 1.35, { passive: false, hp: 160 }); }, ok: dt => hold('fr', Math.abs(ad(bearing(P().p, st.tg.p), P().h)) < 0.4, dt, 4) },
      { t: 'Destrúyelo de frente', d: `Sin dejar de encararlo, dispara con ${kb('Espacio')} hasta destruirlo.`, ok: () => !st.tg.alive },
    ],
  },
  {
    id: 'flank', dom: 'land', unit: 'sherman', t: 'Flanqueo', req: s => !!s.gun,
    d: 'Contra un carro con blindaje frontal muy grueso, rodéalo y dispara al costado o a la trasera.',
    steps: [
      { t: 'Prueba de frente', d: `Un Panther te encara. Fíjalo con ${kb('T')} y dispárale de frente: verás que el daño es muy bajo (rebota).`, init: () => { st.tg = foe('panther', 330, 0.1); st.zone = null; st.ft = 0; G.drillHook = (e, d, k, z) => { if (e === st.tg) { st.zone = z; st.dmgF = d; } }; }, ok: dt => { if (G.keys.Space) st.ft += dt; return st.zone === 0 || st.ft > 14; } },
      { t: 'Rodéalo', d: 'Muévete en arco (el Panther no dispara en esta práctica) hasta quedar <b>a su costado</b> (más de 70° respecto a su proa), a menos de 500 m. Aguanta 2 s.', ok: dt => hold('fl', dist(P().p, st.tg.p) < 500 && Math.abs(ad(bearing(st.tg.p, P().p), st.tg.h)) > 1.25, dt, 2) },
      { t: 'Dispara al flanco', d: 'Ahora dispara: el costado recibe más del doble de daño. Destrúyelo.', ok: () => !st.tg.alive },
    ],
  },
  {
    id: 'ammo', dom: 'land', unit: 'sherman', t: 'Munición y humo', req: s => s.ammo && s.ammo.he !== undefined,
    d: 'AP (perforante) contra blindados, HE (explosiva) contra cañones e infantería; el humo te oculta para retirarte.',
    steps: [
      { t: 'HE contra el cañón', d: `Pulsa ${kb('N')} hasta tener <b>HE</b> y destruye el cañón antitanque.`, init: () => { st.at = foe('pak40', 380, -0.25, { hp: 70 }); st.tk = foe('pz4h', 470, 0.3, { hp: 150 }); }, ok: () => !st.at.alive && P().ammoSel === 'he' },
      { t: 'AP contra el carro', d: `Cambia a <b>AP</b> con ${kb('N')} y destruye el Panzer.`, ok: () => !st.tk.alive && P().ammoSel === 'ap' },
      { t: 'Cortina de humo', d: `Pulsa ${kb('Shift')} para lanzar humo: los enemigos pierden la línea de tiro mientras dura.`, ok: () => P().cd.smoke > 0 },
    ],
  },
];
export const DOM_NAME = { sea: 'Naval', air: 'Aérea', land: 'Carros' };
export const drillsFor = dom => DRILLS.filter(d => d.dom === dom);

// arranca una maniobra (ya en el campo de pruebas). Usa la unidad indicada si sirve para la lección
export function runDrill(id, unitKey, ctx) {
  const d = DRILLS.find(x => x.id === id); if (!d) return;
  const s = unitKey && MODELS[unitKey] ? specOf(unitKey) : null;
  const key = s && s.dom === d.dom && d.req(s) && !(d.dom === 'land' && MODELS[unitKey].cls === 'inf') ? unitKey : d.unit;
  ctx.clear(); ctx.quickTest(key, false);
  st = {}; G.drillHook = null;
  startTutorial(() => { G.drillHook = null; ctx.onEnd && ctx.onEnd(); }, {
    steps: d.steps, title: `Maniobra: ${d.t}`, god: true, exitLabel: 'Cerrar',
    doneTitle: '¡Maniobra dominada!', done: `${d.d} Puedes repetirla o probar otra desde el panel <b>Maniobras</b> del campo de pruebas o desde el hangar.`,
  });
}
export function stopDrill() { G.drillHook = null; stopTutorial(false); }

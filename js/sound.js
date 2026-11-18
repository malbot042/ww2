// Música procedural, voces de radio (síntesis de voz del navegador) y volúmenes
import { G } from './state.js';
import { audio, setVolumes } from './fx.js';

G.vol = G.vol || { master: 0.9, sfx: 1, music: 0.5, voice: 0.8, radio: true };
export function applyVolumes() { setVolumes(G.vol); }

// ---------- música ----------
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
// progresiones: menú (melancólica) y batalla (marcial, en menor)
const PROG = {
  menu: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  battle: [[50, 53, 57], [46, 50, 53], [45, 49, 52], [50, 53, 57], [43, 46, 50], [45, 49, 52]],
};
let nextBar = 0, bar = 0, heat = 0, mode = 'menu';
export function musicHeat(k) { heat = Math.min(1, heat + k); }
function note(AC, out, f, t, dur, type, vol, att = 0.4) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setTargetAtTime(0.0001, t + dur - 0.3, 0.25);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 1.2);
}
function drum(AC, out, buf, t, vol, f, len) {
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = buf; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random(), len + 0.05);
}
function timpani(AC, out, t, f, vol) {
  const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.2);
}
export function updateMusic(dt) {
  const { AC, noiseBuf, musicBus } = audio(); if (!AC || AC.state !== 'running') return;
  mode = G.running && !G.demo ? 'battle' : 'menu';
  heat = Math.max(0, heat - dt * 0.04);
  const BAR = mode === 'battle' ? 2.4 : 4;
  if (nextBar < AC.currentTime) nextBar = AC.currentTime + 0.1;
  if (nextBar - AC.currentTime > 0.5) return;
  const t = nextBar, prog = PROG[mode], ch = prog[bar % prog.length];
  // colchón de cuerdas
  ch.forEach((n, i) => note(AC, musicBus, midi(n), t, BAR + 0.4, 'triangle', 0.05 - i * 0.008, BAR * 0.3));
  note(AC, musicBus, midi(ch[0] - 12), t, BAR + 0.3, 'sine', 0.07, 0.2);
  if (mode === 'battle') {
    // tambor militar y timbales: más presentes cuanto más intenso es el combate
    const beat = BAR / 4, k = 0.25 + heat * 0.75;
    for (let b = 0; b < 4; b++) {
      drum(AC, musicBus, noiseBuf, t + b * beat, 0.05 * k, 1800, 0.12);
      if (heat > 0.35) drum(AC, musicBus, noiseBuf, t + b * beat + beat / 2, 0.03 * k, 2000, 0.08);
      if (heat > 0.6 && b === 3) for (let r = 1; r < 4; r++) drum(AC, musicBus, noiseBuf, t + b * beat + r * beat / 4, 0.025 * k, 2200, 0.06);
    }
    if (bar % 2 === 0 || heat > 0.5) timpani(AC, musicBus, t, midi(ch[0] - 24), 0.12 * k);
    // trompeta lejana en los compases fuertes
    if (heat > 0.45 && bar % 4 === 0) [0, 3, 7, 12].forEach((iv, i) => note(AC, musicBus, midi(ch[0] + 12 + iv), t + i * beat * 0.5, beat * 0.6, 'square', 0.012, 0.03));
  }
  bar++; nextBar = t + BAR;
}

// ---------- radio ----------
let queue = [], busy = false, lastSaid = {}, voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices(); return vs.find(v => /^es(-|_)ES/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
const ZN = { A: 'Alfa', B: 'Bravo', C: 'Charlie' };
export const zoneName = n => ZN[n] || n;
export function radio(text, key = text, gap = 8) {
  if (!G.vol.radio || G.demo || !('speechSynthesis' in window)) return;
  const now = performance.now() / 1000;
  if (lastSaid[key] && now - lastSaid[key] < gap) return;
  lastSaid[key] = now;
  if (queue.length > 2) queue.shift();
  queue.push(text); pump();
}
function pump() {
  if (busy || !queue.length) return;
  const u = new SpeechSynthesisUtterance(queue.shift());
  if (!voice) voice = pickVoice();
  if (voice) u.voice = voice; u.lang = voice ? voice.lang : 'es-ES';
  u.rate = 1.12; u.pitch = 0.85; u.volume = G.vol.voice * G.vol.master;
  busy = true; u.onend = u.onerror = () => { busy = false; setTimeout(pump, 250); };
  try { speechSynthesis.speak(u); } catch (e) { busy = false; }
}
export function radioStop() { queue = []; busy = false; try { speechSynthesis.cancel(); } catch (e) { } }
const pick = a => a[(Math.random() * a.length) | 0];
export const RADIO = {
  start: () => radio(pick(['Todas las unidades, adelante.', 'A todas las unidades: comienza la operación.', 'Aquí mando. Avancen hacia los objetivos.'])),
  zone: (z, mine) => radio(mine ? pick([`Objetivo ${zoneName(z.name)} asegurado.`, `Tenemos ${zoneName(z.name)}.`]) : pick([`Hemos perdido ${zoneName(z.name)}.`, `El enemigo ha tomado ${zoneName(z.name)}.`]), 'zone' + z.name, 4),
  kill: () => Math.random() < 0.45 && radio(pick(['¡Blanco destruido!', '¡Lo tenemos!', '¡Uno menos!', '¡Impacto confirmado!']), 'kill', 6),
  lost: e => Math.random() < 0.4 && radio(`Hemos perdido el ${e.name}.`, 'lost', 10),
  hurt: () => radio(pick(['¡Nos han dado fuerte!', '¡Daños graves a bordo!', '¡Estamos muy tocados!']), 'hurt', 25),
  incoming: kind => radio(kind === 'barrage' ? '¡Artillería entrante!' : '¡Aviones enemigos a la vista!', 'inc' + kind, 12),
  support: kind => radio(kind === 'barrage' ? 'Fuego de apoyo en camino.' : kind === 'air' ? 'Apoyo aéreo en camino.' : 'Refuerzos en camino.', 'sup' + kind, 6),
  plan: zn => radio(`A todas las unidades: esfuerzo principal en ${zn}.`, 'plan', 20),
  end: win => radio(win ? 'Victoria. Buen trabajo, comandante.' : 'Retirada. Todas las unidades, repliéguense.', 'end', 1),
};

// ---------- panel de volumen (en la pausa) ----------
export function initSoundUI() {
  const box = document.getElementById('vols'); if (!box) return;
  const rows = [['master', 'General'], ['sfx', 'Efectos'], ['music', 'Música'], ['voice', 'Radio']];
  box.innerHTML = rows.map(([k, n]) => `<label><span>${n}</span><input type="range" min="0" max="1" step="0.05" data-v="${k}" value="${G.vol[k]}"></label>`).join('') +
    `<label class="chk"><input type="checkbox" id="optRadio" ${G.vol.radio ? 'checked' : ''}> Mensajes de radio con voz</label>`;
  box.querySelectorAll('input[data-v]').forEach(i => i.oninput = () => { G.vol[i.dataset.v] = +i.value; applyVolumes(); G.onOptions && G.onOptions(); });
  document.getElementById('optRadio').onchange = ev => { G.vol.radio = ev.target.checked; if (!G.vol.radio) radioStop(); G.onOptions && G.onOptions(); };
}

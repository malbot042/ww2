// Repetición de los últimos 20 s: transformaciones de todas las unidades a 10 Hz + efectos visuales
import * as THREE from 'three';
import { G } from './state.js';
import * as FX from './fx.js';

const HZ = 10, KEEP = 20 * HZ;
let frames = [], acc = 0, pendingFx = [], meshes = new Map(), play = null;
export function resetReplay() { frames = []; acc = 0; pendingFx = []; meshes.clear(); play = null; }
FX.setFxHook((kind, p, s, o) => { if (G.running && !G.demo && !play) pendingFx.push([kind, p.x, p.y, p.z, s, o]); });

export function recordReplay(dt) {
  if (play || G.demo) return;
  acc += dt; if (acc < 1 / HZ) return; acc = 0;
  const ents = [];
  for (const e of G.ents) {
    if (!e.mesh) continue; meshes.set(e.id, e.mesh);
    const m = e.mesh;
    ents.push([e.id, m.position.x, m.position.y, m.position.z, m.rotation.x, m.rotation.y, m.rotation.z, m.visible && !!m.parent ? 1 : 0]);
  }
  const pl = G.player;
  frames.push({ t: G.time, ents, fx: pendingFx, pl: pl ? pl.id : -1 });
  pendingFx = [];
  if (frames.length > KEEP) frames.shift();
}
export const hasReplay = () => frames.length > 20;
export const replaying = () => !!play;

export function startReplay(onEnd) {
  if (!hasReplay()) return false;
  const saved = new Map();
  for (const [id, m] of meshes) saved.set(id, { pos: m.position.clone(), rot: m.rotation.clone(), vis: m.visible, parent: m.parent });
  play = { t: frames[0].t, i: 0, onEnd, saved, cam: { p: new THREE.Vector3(), h: 0, dom: 'sea', top: 6, s: { max: 1 }, speed: 0, alive: true } };
  G.replayCam = play.cam;
  if (G.markersGroup) G.markersGroup.visible = false;
  return true;
}
export function stopReplay() {
  if (!play) return;
  for (const [id, m] of meshes) {
    const s = play.saved.get(id); if (!s) continue;
    m.position.copy(s.pos); m.rotation.copy(s.rot); m.visible = s.vis;
    if (!s.parent && m.parent) m.parent.remove(m);
  }
  if (G.markersGroup) G.markersGroup.visible = true;
  const cb = play.onEnd; play = null; G.replayCam = null; cb && cb();
}
const lerp = (a, b, k) => a + (b - a) * k;
const lerpA = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
export function updateReplay(dt) {
  if (!play) return;
  const t0 = play.t; play.t += dt;
  while (play.i < frames.length - 2 && frames[play.i + 1].t <= play.t) {
    play.i++;
    // efectos del tramo recién cruzado
    for (const [k, x, y, z, s, o] of frames[play.i].fx) { const p = new THREE.Vector3(x, y, z); if (FX[k]) FX[k](p, s, o); }
  }
  const A = frames[play.i], B = frames[play.i + 1] || A, k = B.t > A.t ? Math.min(1, (play.t - A.t) / (B.t - A.t)) : 0;
  const bm = new Map(B.ents.map(r => [r[0], r]));
  const seen = new Set();
  for (const a of A.ents) {
    const m = meshes.get(a[0]); if (!m) continue; seen.add(a[0]);
    const b = bm.get(a[0]) || a;
    if (!m.parent) G.unitsGroup.add(m);
    m.visible = !!a[7];
    m.position.set(lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k));
    m.rotation.set(lerpA(a[4], b[4], k), lerpA(a[5], b[5], k), lerpA(a[6], b[6], k));
    if (a[0] === A.pl) { play.cam.p.copy(m.position); play.cam.h = m.rotation.y; }
  }
  for (const [id, m] of meshes) if (!seen.has(id)) m.visible = false;
  FX.updateFx(dt);
  if (play.i >= frames.length - 2 && play.t >= frames[frames.length - 1].t) stopReplay();
  return t0;
}
export const replayProgress = () => play ? (play.t - frames[0].t) / Math.max(0.1, frames[frames.length - 1].t - frames[0].t) : 0;

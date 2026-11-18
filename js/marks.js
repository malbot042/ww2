// Marcas de orugas en el terreno: decalcomanías instanciadas en un búfer circular
import * as THREE from 'three';
import { G } from './state.js';

const N = 4000, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
let marks = null, mi = 0, tex = null;
function makeTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
  for (const x of [2, 44]) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x, 0, 18, 32); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 32; y += 6) g.fillRect(x, y, 18, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function initMarks() {
  if (!tex) tex = makeTex();
  if (marks) marks.parent && marks.parent.remove(marks);
  const desert = G.map.theme === 'desert' || G.map.theme === 'mixed';
  marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex, color: desert ? 0x8a6a44 : 0x4a3e2e, transparent: true, opacity: desert ? 0.5 : 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N);
  marks.count = 0; marks.frustumCulled = false; marks.renderOrder = 1; mi = 0;
  G.scene.add(marks);
}
export function trackMark(e) {
  if (!marks || e.cls === 'inf' || e.cls === 'atgun') return;
  const lm = e.lastMark;
  if (lm && Math.hypot(e.p.x - lm.x, e.p.z - lm.z) < 3.2) return;
  e.lastMark = { x: e.p.x, z: e.p.z };
  if (G.map.h(e.p.x, e.p.z) < 0.3) return; // nada en la playa mojada ni en el agua
  Q.setFromAxisAngle(UP, e.h); S.set(e.hw * 1.9, 1, 2.6); P.set(e.p.x, G.map.gy(e.p.x, e.p.z) + 0.18, e.p.z);
  M.compose(P, Q, S); marks.setMatrixAt(mi, M); marks.instanceMatrix.needsUpdate = true;
  mi = (mi + 1) % N; marks.count = Math.max(marks.count, mi === 0 ? N : mi);
}

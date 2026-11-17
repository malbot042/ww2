// Daño visible: quemaduras sobre el casco, escora y hundimiento de proa, restos, cráteres y manchas de petróleo
import * as THREE from 'three';
import { G } from './state.js';
import { rnd } from './util.js';
import * as FX from './fx.js';

const ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1);
let scorchTex = null, craterTex = null, oilTex = null;
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  // borde irregular
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = 50 + Math.random() * 14; g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 6 + Math.random() * 9, 0, 6.28); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// ---------- pools instanciados ----------
class DecalPool {
  constructor(n, tex, opacity, y) {
    this.n = n; this.i = 0; this.y = y;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), n);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.count = 0;
    this.items = [];
  }
  add(x, y, z, s, rot = Math.random() * 6.28, extra = {}) {
    const k = this.i; this.i = (this.i + 1) % this.n; this.mesh.count = Math.max(this.mesh.count, k + 1);
    this.items[k] = { x, y, z, s, rot, ...extra }; this.set(k, s); return k;
  }
  set(k, s) { const it = this.items[k]; tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot); tmpS.set(s, 1, s); tmpM.compose(tmpV.set(it.x, it.y, it.z), tmpQ, tmpS); this.mesh.setMatrixAt(k, tmpM); this.mesh.instanceMatrix.needsUpdate = true; }
}
let craters = null, oil = null, debris = null, dbs = [];
export function initDamageFx() {
  if (!scorchTex) {
    scorchTex = radialTex([[0, 'rgba(12,10,8,0.95)'], [0.55, 'rgba(25,20,16,0.7)'], [1, 'rgba(30,25,20,0)']]);
    craterTex = radialTex([[0, 'rgba(30,26,20,0.95)'], [0.45, 'rgba(48,40,30,0.85)'], [0.7, 'rgba(80,66,48,0.55)'], [1, 'rgba(90,75,55,0)']]);
    oilTex = radialTex([[0, 'rgba(8,8,10,0.85)'], [0.6, 'rgba(20,18,26,0.55)'], [0.85, 'rgba(60,40,70,0.25)'], [1, 'rgba(40,60,60,0)']]);
  }
  for (const p of [craters, oil]) if (p) p.mesh.parent && p.mesh.parent.remove(p.mesh);
  if (debris) debris.parent && debris.parent.remove(debris);
  craters = new DecalPool(160, craterTex, 0.9, 0); oil = new DecalPool(40, oilTex, 0.8, 0.35);
  debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.4, 0.7), new THREE.MeshStandardMaterial({ color: 0x2b2a27, roughness: 0.9 }), 240);
  debris.count = 0; debris.frustumCulled = false; debris.castShadow = true; dbs = [];
  G.scene.add(craters.mesh, oil.mesh, debris);
}

export function crater(x, z, s = 1) {
  if (!craters) return; const y = G.map.gy(x, z); if (G.map.h(x, z) < 0.2) return;
  craters.add(x, y + 0.25, z, rnd(5, 8) * s);
}
export function oilSlick(x, z, s = 1) { if (!oil) return; oil.add(x, 0.35, z, 4, Math.random() * 6.28, { t: 0, grow: rnd(26, 40) * s, life: rnd(80, 120) }); }

export function spawnDebris(p, n = 10, s = 1) {
  if (!debris) return;
  for (let i = 0; i < n; i++) {
    const k = dbs.length < 240 ? dbs.length : (Math.random() * 240) | 0;
    dbs[k] = { p: p.clone().add(new THREE.Vector3(rnd(-2, 2), rnd(0, 2), rnd(-2, 2))), v: new THREE.Vector3(rnd(-14, 14), rnd(10, 24), rnd(-14, 14)).multiplyScalar(s), r: new THREE.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: rnd(-8, 8), sc: rnd(0.5, 1.6) * s, rest: false, t: 0 };
  }
  debris.count = dbs.length;
}

// quemaduras sobre la superficie del modelo cuando la vida cruza 75 %, 50 % y 25 %
function scorch(e) {
  const m = e.mesh; m.updateMatrixWorld(true);
  for (let a = 0; a < 4; a++) {
    const lx = rnd(-e.hw * 0.6, e.hw * 0.6), lz = rnd(-e.hl * 0.75, e.hl * 0.75);
    const from = new THREE.Vector3(lx, 40, lz).applyMatrix4(m.matrixWorld);
    ray.set(from, DOWN); const hit = ray.intersectObject(m, true).find(h => h.object.isMesh && h.object.visible && !h.object.userData.decal);
    if (!hit) continue;
    const s = (e.dom === 'sea' ? rnd(3, 6) : rnd(1.4, 2.4)) * (e.cls === 'battleship' || e.cls === 'carrier' ? 1.6 : 1);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, opacity: 0.85 }));
    d.userData.decal = true;
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    d.position.copy(m.worldToLocal(hit.point.clone().addScaledVector(n, 0.05)));
    d.lookAt(d.position.clone().add(n.applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()).invert())));
    d.rotateZ(Math.random() * 6.28); m.add(d); return;
  }
}

export function updateDamageLook(e, dt) {
  if (e.dom === 'static' && e.cls !== 'site' || e.cls === 'inf') return;
  const f = e.hp / e.s.hp, lvl = f < 0.25 ? 3 : f < 0.5 ? 2 : f < 0.75 ? 1 : 0;
  if (lvl > (e.scorchLvl || 0) && e.dom !== 'air') { for (let i = e.scorchLvl || 0; i < lvl; i++) scorch(e); e.scorchLvl = lvl; }
  if (e.dom === 'sea') {
    // escora y proa hundida por debajo del 40 %
    const k = f < 0.4 ? 1 - f / 0.4 : 0;
    if (e.listSide === undefined) e.listSide = Math.random() < 0.5 ? -1 : 1;
    e.listA = (e.listA || 0) + (e.listSide * 0.09 * k - (e.listA || 0)) * Math.min(1, dt * 0.5);
    e.trimA = (e.trimA || 0) + (0.025 * k - (e.trimA || 0)) * Math.min(1, dt * 0.5);
    e.sinkY = -1.2 * k;
    if (f < 0.5 && !e.submerged) { e.oilT = (e.oilT || 0) - dt; if (e.oilT <= 0) { e.oilT = rnd(5, 9) / (1.2 - f); oilSlick(e.p.x, e.p.z, 0.5); } }
  }
  if (e.dom === 'land' && f < 0.5 && Math.random() < dt * (1 - f) * 2) FX.trailSmoke(e.p.clone().setY(e.p.y + e.top), true, 0.5);
}

export function onKillFx(e) {
  if (e.dom === 'sea') { oilSlick(e.p.x, e.p.z, e.cls === 'battleship' || e.cls === 'carrier' ? 2 : 1.3); spawnDebris(e.p.clone().setY(2), 8, 1.3); }
  else if (e.dom === 'land' || e.dom === 'static') { spawnDebris(e.p.clone().setY(e.p.y + 1.5), e.cls === 'site' ? 18 : 10, e.cls === 'site' ? 1.6 : 1); crater(e.p.x, e.p.z, 1.3); }
}

export function updateDamageFx(dt) {
  if (debris && dbs.length) {
    for (let k = 0; k < dbs.length; k++) {
      const d = dbs[k]; if (!d) continue;
      if (!d.rest) {
        d.v.y -= 30 * dt; d.p.addScaledVector(d.v, dt); d.r.x += d.w * dt; d.r.z += d.w * 0.7 * dt;
        const gy = G.map.h(d.p.x, d.p.z);
        if (gy < 0 && d.p.y < 0) { d.rest = true; d.sinking = true; if (Math.random() < 0.3) FX.splash(d.p.clone().setY(0), 0.3); }
        else if (d.p.y < Math.max(gy, 0) + 0.2) { d.p.y = Math.max(gy, 0) + 0.2; if (Math.abs(d.v.y) < 4) d.rest = true; d.v.multiplyScalar(0.35); d.v.y = Math.abs(d.v.y); }
      } else if (d.sinking) { d.p.y -= dt * 0.8; if (d.p.y < -6) { dbs[k] = null; } }
      d.t += dt;
      const sc = d ? d.sc : 0;
      tmpQ.setFromEuler(d.r); tmpS.setScalar(sc); tmpM.compose(d.p, tmpQ, tmpS); debris.setMatrixAt(k, tmpM);
    }
    for (let k = 0; k < dbs.length; k++) if (!dbs[k]) { tmpM.makeScale(0, 0, 0); debris.setMatrixAt(k, tmpM); }
    debris.instanceMatrix.needsUpdate = true;
  }
  if (oil) {
    for (let k = 0; k < oil.items.length; k++) {
      const it = oil.items[k]; if (!it || it.dead) continue;
      it.t += dt; it.x += 0.6 * dt;
      const s = it.t > it.life ? 0 : Math.min(it.grow, 4 + it.t * 2.2) * (it.t > it.life - 10 ? (it.life - it.t) / 10 : 1);
      if (s <= 0) it.dead = true;
      oil.set(k, s);
    }
  }
}

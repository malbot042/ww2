// Hora del día y clima: iluminación, visibilidad, lluvia, rayos, bengalas y reflectores
import * as THREE from 'three';
import { G } from './state.js';
import { rnd, V3 } from './util.js';
import { worldRefs } from './world.js';
import * as FX from './fx.js';

export const TIMES = { day: 'Día', dusk: 'Atardecer', night: 'Noche' };
export const WEATHER = { clear: 'Despejado', fog: 'Niebla', storm: 'Tormenta' };
const C = c => new THREE.Color(c);

let rain = null, flareLights = [], flareGroup = null, beams = new Map(), boltT = 0, flashT = 0, aiFlareT = 20, thunderAt = -1;

export function applyEnv(env = {}) {
  const time = env.time || 'day', weather = env.weather || 'clear';
  const E = G.env = { time, weather, flares: [], dark: time === 'night' ? 1 : time === 'dusk' ? 0.35 : 0 };
  E.sightK = (time === 'dusk' ? 0.82 : time === 'night' ? 0.5 : 1) * (weather === 'fog' ? 0.55 : weather === 'storm' ? 0.75 : 1);
  E.errK = (time === 'night' ? 1.4 : time === 'dusk' ? 1.1 : 1) * (weather === 'storm' ? 1.3 : weather === 'fog' ? 1.1 : 1);
  E.fogK = weather === 'fog' ? 0.32 : weather === 'storm' ? 0.6 : time === 'night' ? 0.85 : 1;
  E.seaState = weather === 'storm' ? 2 : weather === 'fog' ? 0.3 : 0.6;
  E.sunDir = time === 'dusk' ? V3(-0.85, 0.28, 0.45).normalize() : time === 'night' ? V3(0.3, 0.7, -0.4).normalize() : V3(-0.45, 0.8, 0.35).normalize();

  const { sky, water, clouds } = worldRefs();
  const sun = G.sun, hemi = G.hemi, scene = G.scene;
  let fogC = scene.fog.color.clone(), skyZ = sky ? sky.material.uniforms.zc.value.clone() : C(0x6f9cc8);
  // hora del día
  if (time === 'dusk') {
    sun.color.lerp(C(0xff8a4a), 0.75); sun.intensity *= 0.62;
    hemi.color.lerp(C(0xd29a80), 0.5); hemi.groundColor.lerp(C(0x302628), 0.4); hemi.intensity *= 0.72;
    fogC.lerp(C(0xd88a5e), 0.55); skyZ.lerp(C(0x3c4c80), 0.7);
  } else if (time === 'night') {
    sun.color.set(0x9db4e6); sun.intensity = 0.6;
    hemi.color.set(0x5a70a0); hemi.groundColor.set(0x1a2028); hemi.intensity = 1.05;
    fogC.set(0x0c1424); skyZ.set(0x03060f);
  }
  // clima
  if (weather === 'fog') { fogC.lerp(time === 'night' ? C(0x1a2230) : C(0xb9bfc2), 0.7); sun.intensity *= 0.55; hemi.intensity *= 0.95; skyZ.lerp(fogC, 0.7); }
  if (weather === 'storm') { fogC.lerp(time === 'night' ? C(0x0a0f16) : C(0x5c646a), 0.65); sun.intensity *= 0.32; hemi.intensity *= 0.72; skyZ.lerp(C(0x2c3238), 0.8); }
  scene.fog.color.copy(fogC); scene.background = fogC.clone();
  E.base = { sunI: sun.intensity, hemiI: hemi.intensity };
  G.renderer.toneMappingExposure = time === 'night' ? 1.25 : 0.95;
  if (sky) { const u = sky.material.uniforms; u.hc.value.copy(fogC); u.zc.value.copy(skyZ); u.sd.value.copy(E.sunDir); u.sc.value.copy(sun.color).multiplyScalar(weather === 'clear' ? 1 : 0.2); }
  if (water) {
    const u = water.material.uniforms, dk = E.dark * 0.7 + (weather === 'storm' ? 0.3 : 0);
    u.skyH.value.copy(fogC); u.skyZ.value.copy(skyZ); u.fogC.value.copy(fogC); u.sunDir.value.copy(E.sunDir);
    u.sunCol.value.copy(sun.color).multiplyScalar(weather === 'clear' ? (time === 'night' ? 0.35 : 1) : 0.25);
    u.shallow.value.lerp(C(0x000000), dk); u.deep.value.lerp(C(0x000000), dk * 0.8);
  }
  for (const c of clouds) { c.material.color.setScalar(time === 'night' ? 0.18 : weather === 'storm' ? 0.45 : 1); if (time === 'dusk') c.material.color.set(0xffc6a0); if (weather === 'storm') c.material.opacity = 0.85; }

  // lluvia
  if (rain) { rain.geometry.dispose(); rain.parent && rain.parent.remove(rain); rain = null; }
  if (weather === 'storm') {
    const N = 1800, pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = rnd(-300, 300), y = rnd(0, 320), z = rnd(-300, 300); pos.set([x, y, z, x - 1.2, y - 9, z + 0.6], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: time === 'night' ? 0x58687a : 0xa8b6c4, transparent: true, opacity: 0.38, depthWrite: false }));
    rain.frustumCulled = false; scene.add(rain);
  }
  // luces para bengalas: número fijo para no recompilar sombreadores
  if (flareGroup) { scene.remove(flareGroup); flareGroup = null; }
  flareLights = [];
  for (const [, b] of beams) b.parent && b.parent.remove(b); beams.clear();
  if (E.dark > 0) {
    flareGroup = new THREE.Group(); scene.add(flareGroup);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffe8b8, 0, 900, 1.3); flareGroup.add(l);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.glowTex(), color: 0xfff4d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.scale.setScalar(26); s.visible = false; flareGroup.add(s);
      flareLights.push({ l, s, f: null });
    }
  }
  boltT = rnd(4, 10); flashT = 0; aiFlareT = rnd(15, 25); thunderAt = -1;
}

// ---------- bengalas ----------
export function launchFlare(by, at) {
  const E = G.env; if (!E || !E.dark) return false;
  const p = at.clone(); p.y = 160;
  const f = { p, t: 26, side: by.side };
  E.flares.push(f); if (E.flares.length > 3) E.flares.shift();
  FX.sfx('flak', by.p, 0.6);
  return true;
}
export const litByFlare = o => G.env && G.env.flares.some(f => Math.hypot(o.p.x - f.p.x, o.p.z - f.p.z) < 520);

// ---------- actualización ----------
export function updateEnv(dt) {
  const E = G.env; if (!E) return;
  // lluvia que sigue a la cámara
  if (rain) {
    const a = rain.geometry.attributes.position, arr = a.array, fy = 520 * dt;
    for (let i = 0; i < arr.length; i += 6) { arr[i + 1] -= fy; arr[i + 4] -= fy; if (arr[i + 4] < -20) { arr[i + 1] += 340; arr[i + 4] += 340; } }
    a.needsUpdate = true; rain.position.set(G.focus.x, Math.max(0, G.focus.y - 40), G.focus.z);
  }
  // rayos
  if (E.weather === 'storm') {
    boltT -= dt;
    if (boltT <= 0) { boltT = rnd(6, 16); flashT = 0.32; thunderAt = G.time + rnd(0.5, 2.5); }
    if (thunderAt > 0 && G.time > thunderAt) { thunderAt = -1; FX.sfx('thunder', null, 1); }
    if (flashT > 0) { flashT -= dt; const k = flashT > 0.2 || (flashT > 0.06 && flashT < 0.12) ? 1 : 0; G.hemi.intensity = E.base.hemiI + k * 2.6; G.sun.intensity = E.base.sunI + k * 1.4; }
    else { G.hemi.intensity = E.base.hemiI; G.sun.intensity = E.base.sunI; }
  }
  // bengalas
  for (const f of E.flares) { f.t -= dt; f.p.y = Math.max(20, f.p.y - 5 * dt); f.p.x += 3 * dt; }
  E.flares = E.flares.filter(f => f.t > 0);
  flareLights.forEach((s, i) => {
    const f = E.flares[i];
    if (f) { const k = Math.min(1, f.t / 3) * (0.85 + Math.random() * 0.3); s.l.position.copy(f.p); s.l.intensity = 650 * k; s.s.position.copy(f.p); s.s.visible = true; s.s.material.opacity = k; if (Math.random() < 0.3) FX.trailSmoke(f.p, false, 0.6); }
    else { s.l.intensity = 0; s.s.visible = false; }
  });
  // la IA lanza bengalas sobre el objetivo más disputado
  if (E.dark > 0.5 && G.objectives && G.objectives.length) {
    aiFlareT -= dt;
    if (aiFlareT <= 0) {
      aiFlareT = rnd(22, 34);
      const side = Math.random() < 0.6 ? 'E' : 'A';
      const z = G.objectives[(Math.random() * G.objectives.length) | 0];
      const by = G.ents.find(e => e.alive && e.side === side && e !== G.player && e.dom !== 'static');
      if (by && z) launchFlare(by, V3(z.x + rnd(-120, 120), 0, z.z + rnd(-120, 120)));
    }
  }
  // reflectores: barcos y antiaéreos de noche iluminan su blanco (y se delatan)
  if (E.dark > 0.5) {
    for (const e of G.ents) {
      const can = e.alive && !e.falling && (e.cls === 'destroyer' || e.cls === 'cruiser' || e.cls === 'battleship' || e.cls === 'aa');
      let b = beams.get(e);
      const t = can && e.target && e.target.alive && !e.target.fake ? e.target : null, d = t ? e.p.distanceTo(t.p) : 0;
      const on = t && d < (e.cls === 'aa' ? 700 : 1100);
      e.lit = !!on;
      if (!on) { if (b) b.visible = false; continue; }
      if (!b) {
        const geo = new THREE.ConeGeometry(1, 1, 18, 1, true); geo.translate(0, -0.5, 0); geo.rotateX(-Math.PI / 2);
        b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        b.renderOrder = 6; G.scene.add(b); beams.set(e, b);
      }
      const from = e.p.clone(); from.y = (e.p.y || 0) + (e.mesh.userData.top || 6);
      b.visible = true; b.position.copy(from); b.lookAt(t.p); b.scale.set(d * 0.06, d * 0.06, d);
      t.revealT = Math.max(t.revealT || 0, 0.6);
    }
    for (const [e, b] of beams) if (!e.alive) { b.parent && b.parent.remove(b); beams.delete(e); }
  }
}
export function envLabel() { const E = G.env; if (!E) return ''; return `${TIMES[E.time]}${E.weather !== 'clear' ? ' · ' + WEATHER[E.weather] : ''}`; }

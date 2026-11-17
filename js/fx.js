import * as THREE from 'three';
import { G } from './state.js';
import { rnd, canvasTex } from './util.js';

// ---------- Sistema de partículas (Points con textura suave) ----------
class PSys {
  constructor(n, additive, tex) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.age = new Float32Array(n); this.life = new Float32Array(n);
    this.s0 = new Float32Array(n); this.grow = new Float32Array(n); this.a0 = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, scale: { value: 600 }, fogC: { value: new THREE.Color() }, fogN: { value: 500 }, fogF: { value: 2000 } },
      vertexShader: `attribute float size; attribute vec4 col; varying vec4 vC; varying float vD; uniform float scale;
        void main(){ vC = col; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_PointSize = size * scale / max(-mv.z, 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogC; uniform float fogN, fogF; varying vec4 vC; varying float vD;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); float f = smoothstep(fogN, fogF, vD);
          ${additive ? 'gl_FragColor = vec4(vC.rgb * (1.0 - f), vC.a * t.a);' : 'gl_FragColor = vec4(mix(vC.rgb * t.rgb, fogC, f), vC.a * t.a);'}
          if (gl_FragColor.a < 0.004) discard;
          #include <colorspace_fragment>
        }`,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.geo = g;
    this.pts.renderOrder = additive ? 4 : 3;
  }
  spawn(x, y, z, vx, vy, vz, size, grow, life, c, a, grav = 0, drag = 0) {
    const i = this.i = (this.i + 1) % this.n, i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i4] = c.r; this.col[i4 + 1] = c.g; this.col[i4 + 2] = c.b; this.col[i4 + 3] = a;
    this.s0[i] = size; this.grow[i] = grow; this.life[i] = life; this.age[i] = 0; this.a0[i] = a; this.grav[i] = grav; this.drag[i] = drag; this.size[i] = size;
  }
  update(dt) {
    const { pos, vel, age, life, size, col } = this;
    for (let i = 0; i < this.n; i++) {
      if (age[i] >= life[i]) { if (size[i] !== 0) size[i] = 0; continue; }
      age[i] += dt; const k = age[i] / life[i], i3 = i * 3;
      const dr = 1 - this.drag[i] * dt;
      vel[i3] *= dr; vel[i3 + 2] *= dr; vel[i3 + 1] = vel[i3 + 1] * dr - this.grav[i] * dt;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      size[i] = k >= 1 ? 0 : this.s0[i] + this.grow[i] * Math.sqrt(k);
      col[i * 4 + 3] = this.a0[i] * (1 - k) * Math.min(1, k * 12 + 0.2);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.size.needsUpdate = true; this.geo.attributes.col.needsUpdate = true;
  }
}

let smoke, glow, trails;
const C = h => new THREE.Color(h);
const COL = { fire: C(0xff9a3a), fire2: C(0xffd27a), flash: C(0xfff2c4), smoke: C(0x3a3836), smokeL: C(0x8d8a84), white: C(0xf4f7f8), foam: C(0xe8f0f0), dust: C(0xb9a27c), flak: C(0x1e1e1e), smokeW: C(0xdedcd6), red: C(0xff5030), wood: C(0x4a3a2a) };

let softTex = null;
export const glowTex = () => softTex;
export function initFx() {
  const soft = canvasTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  softTex = soft;
  const puff = canvasTex(128, (g, s) => {
    for (let k = 0; k < 22; k++) { const x = s / 2 + (Math.random() - 0.5) * s * 0.42, y = s / 2 + (Math.random() - 0.5) * s * 0.42, r = s * (0.1 + Math.random() * 0.2); const sh = 190 + Math.random() * 65; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${sh},${sh},${sh},0.5)`); gr.addColorStop(1, `rgba(${sh},${sh},${sh},0)`); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
  });
  smoke = new PSys(5000, false, puff); glow = new PSys(2500, true, soft); trails = new PSys(3000, false, soft);
  G.scene.add(smoke.pts, glow.pts, trails.pts);
}
export function resetFx() { for (const s of [smoke, glow, trails]) { s.life.fill(0); s.age.fill(1); s.size.fill(0); } }
export function updateFx(dt) {
  const sc = G.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(G.camera.fov / 2)));
  for (const s of [smoke, glow, trails]) {
    s.mat.uniforms.scale.value = sc;
    if (G.scene.fog) { s.mat.uniforms.fogC.value.copy(G.scene.fog.color); s.mat.uniforms.fogN.value = G.scene.fog.near; s.mat.uniforms.fogF.value = G.scene.fog.far; }
    s.update(dt);
  }
}

// ---------- Efectos ----------
export function muzzle(p, dir, s = 1) {
  glow.spawn(p.x, p.y, p.z, dir.x * 8, 0, dir.z * 8, 4 * s, 6 * s, 0.12, COL.flash, 1);
  for (let i = 0; i < 4; i++) smoke.spawn(p.x, p.y, p.z, dir.x * rnd(6, 16) + rnd(-2, 2), rnd(1, 4), dir.z * rnd(6, 16) + rnd(-2, 2), 3 * s, 14 * s, rnd(1.2, 2.2), COL.smokeL, 0.5, -1, 1.2);
}
export function explosion(p, s = 1, opts = {}) {
  glow.spawn(p.x, p.y + 1, p.z, 0, 0, 0, 10 * s, 26 * s, 0.22, COL.flash, 1);
  for (let i = 0; i < 10 * s; i++) glow.spawn(p.x, p.y + 1, p.z, rnd(-14, 14) * s, rnd(4, 22) * s, rnd(-14, 14) * s, 5 * s, 9 * s, rnd(0.35, 0.8), i % 2 ? COL.fire : COL.fire2, 0.9, 8, 1.5);
  for (let i = 0; i < 9 * s; i++) smoke.spawn(p.x + rnd(-2, 2) * s, p.y + 2, p.z + rnd(-2, 2) * s, rnd(-5, 5) * s, rnd(5, 14) * s, rnd(-5, 5) * s, 6 * s, 22 * s, rnd(2, 4.5), COL.smoke, 0.75, -1.5, 1.2);
  if (opts.debris) for (let i = 0; i < 12; i++) smoke.spawn(p.x, p.y + 2, p.z, rnd(-20, 20), rnd(15, 35), rnd(-20, 20), 1.2, 0.5, rnd(1, 1.8), COL.wood, 1, 40, 0.2);
  if (opts.dust) for (let i = 0; i < 6 * s; i++) smoke.spawn(p.x, p.y + 1, p.z, rnd(-10, 10) * s, rnd(2, 6), rnd(-10, 10) * s, 6 * s, 18 * s, rnd(1.5, 3), COL.dust, 0.6, 0, 1.4);
  sfx('boom', p, s);
  const d = p.distanceTo(G.focus); G.shake = Math.max(G.shake, Math.max(0, s * 2.5 - d / 140));
}
export function hitSpark(p) { glow.spawn(p.x, p.y, p.z, 0, 2, 0, 3, 6, 0.15, COL.fire2, 1); smoke.spawn(p.x, p.y, p.z, 0, 3, 0, 2, 6, 0.8, COL.smokeL, 0.5); }
export function splash(p, s = 1) {
  for (let i = 0; i < 16 * s; i++) { const r = rnd(0, 1.8) * s; const a = rnd(0, 6.28); smoke.spawn(p.x + Math.cos(a) * r, 0.3, p.z + Math.sin(a) * r, Math.cos(a) * rnd(1, 4) * s, rnd(18, 34) * Math.sqrt(s), Math.sin(a) * rnd(1, 4) * s, 2.2 * s, 5 * s, rnd(1.2, 2), COL.white, 0.85, 26, 0.5); }
  smoke.spawn(p.x, 0.4, p.z, 0, 0, 0, 8 * s, 22 * s, 1.6, COL.foam, 0.6);
  sfx('splash', p, s);
}
export function dirt(p, s = 1) {
  for (let i = 0; i < 10 * s; i++) smoke.spawn(p.x, p.y + 0.5, p.z, rnd(-6, 6) * s, rnd(8, 20) * s, rnd(-6, 6) * s, 2.5 * s, 8 * s, rnd(1, 2.2), COL.dust, 0.8, 18, 0.8);
  glow.spawn(p.x, p.y + 1, p.z, 0, 0, 0, 4 * s, 8 * s, 0.15, COL.fire2, 0.8);
  sfx('thud', p, s);
}
export function flak(p) {
  glow.spawn(p.x, p.y, p.z, 0, 0, 0, 6, 10, 0.15, COL.fire2, 1);
  for (let i = 0; i < 4; i++) smoke.spawn(p.x + rnd(-1, 1), p.y, p.z + rnd(-1, 1), rnd(-2, 2), rnd(-1, 1), rnd(-2, 2), 6, 12, rnd(2.5, 4), COL.flak, 0.8, 0, 0.8);
  sfx('flak', p, 0.6);
}
export function trailSmoke(p, dark = true, s = 1) { smoke.spawn(p.x + rnd(-0.5, 0.5), p.y, p.z + rnd(-0.5, 0.5), rnd(-0.8, 0.8), rnd(2, 5), rnd(-0.8, 0.8), 2.5 * s, 10 * s, rnd(1.6, 3), dark ? COL.smoke : COL.smokeL, 0.55, -1, 0.4); }
export function fire(p, s = 1) {
  glow.spawn(p.x + rnd(-1.5, 1.5) * s, p.y, p.z + rnd(-1.5, 1.5) * s, rnd(-1, 1), rnd(3, 7), rnd(-1, 1), 3 * s, 4 * s, rnd(0.4, 0.8), Math.random() < 0.5 ? COL.fire : COL.fire2, 0.8, -2);
  if (Math.random() < 0.6) smoke.spawn(p.x, p.y + 2, p.z, rnd(-1, 1) + 1.5, rnd(5, 9), rnd(-1, 1), 4 * s, 22 * s, rnd(3, 6), COL.smoke, 0.6, -0.6, 0.15);
}
export function wake(p, back, side, speed, beam) {
  const k = Math.min(1, speed / 30);
  for (const s of [-1, 1]) smoke.spawn(p.x + side.x * s * beam * 0.35, 0.25, p.z + side.z * s * beam * 0.35, side.x * s * (0.8 + speed * 0.07) + back.x * 2, 0, side.z * s * (0.8 + speed * 0.07) + back.z * 2, 1.4 + k * 1.6, 5 + k * 7, 3.2, COL.foam, 0.42 * k + 0.08);
}
export function bowWave(p, side, speed) { if (speed < 8) return; for (const s of [-1, 1]) smoke.spawn(p.x, 0.4, p.z, side.x * s * speed * 0.3, rnd(0.5, 2), side.z * s * speed * 0.3, 1.5, 5, 0.8, COL.white, 0.6, 3, 1); }
export function bubbles(p) { smoke.spawn(p.x + rnd(-0.6, 0.6), 0.25, p.z + rnd(-0.6, 0.6), 0, 0, 0, 1.4, 4, 2.4, COL.foam, 0.5); }
export function dust(p, c) { smoke.spawn(p.x + rnd(-1, 1), p.y + 0.6, p.z + rnd(-1, 1), rnd(-1.5, 1.5), rnd(1, 3), rnd(-1.5, 1.5), 3, 10, rnd(1.5, 2.5), c || COL.dust, 0.35, 0, 1); }
export function smokeScreen(p) { smoke.spawn(p.x + rnd(-10, 10), p.y + rnd(1, 5), p.z + rnd(-10, 10), rnd(-2, 2) + 1, rnd(0.5, 2), rnd(-2, 2), 10, 26, rnd(5, 8), COL.smokeW, 0.75, 0, 0.3); }
// estelas de condensación: partículas propias, largas y que se ensanchan
export function contrail(p, k = 1) { trails.spawn(p.x, p.y, p.z, rnd(-0.3, 0.3), rnd(-0.2, 0.2), rnd(-0.3, 0.3), 3.2 * k, 2.6 * k, rnd(7, 10), COL.white, 0.26); }

// ---------- Audio sintetizado ----------
let AC = null, noiseBuf = null, master = null, engine = null;
export function initAudio() {
  if (AC) { AC.resume?.(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    // motor de la unidad controlada
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = 40; f.type = 'lowpass'; f.frequency.value = 220; g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(master); o.start(); engine = { o, f, g };
  } catch (e) { AC = null; }
}
export function setEngine(kind, speedK, on) {
  if (!engine) return;
  const base = kind === 'air' ? 70 : kind === 'sea' ? 32 : 45;
  engine.o.frequency.setTargetAtTime(base + speedK * base * 0.8, AC.currentTime, 0.2);
  engine.g.gain.setTargetAtTime(on ? (kind === 'air' ? 0.05 : 0.04) : 0, AC.currentTime, 0.3);
}
let lastGun = 0;
export function sfx(kind, p, s = 1) {
  if (!AC || G.demo) return;
  const dist = p ? p.distanceTo(G.focus) : 0, range = G.zoom * 2.2 + 300, vol = Math.max(0, 1 - dist / range);
  if (vol < 0.03) return;
  const t = AC.currentTime;
  if (kind === 'gun') { if (t - lastGun < 0.04) return; lastGun = t; }
  const cfg = { boom: [520, 0.7, 1.4, 55], cannon: [900, 0.5, 0.6, 70], big: [500, 0.8, 1.2, 40], gun: [2600, 0.12, 0.07, 0], splash: [1400, 0.25, 0.7, 0], thud: [600, 0.35, 0.5, 60], flak: [1100, 0.3, 0.35, 0], torp: [400, 0.3, 0.6, 50], bomb: [350, 0.2, 0.6, 0], thunder: [160, 0.9, 3.2, 28] }[kind];
  if (!cfg) return;
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = 'lowpass'; f.frequency.value = cfg[0];
  const v = Math.min(1, cfg[1] * Math.min(s, 2)) * vol;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + cfg[2] * Math.min(1.5, 0.6 + s * 0.4));
  src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random(), cfg[2] * 1.6);
  if (cfg[3]) { const o = AC.createOscillator(), og = AC.createGain(); o.frequency.setValueAtTime(cfg[3] * 1.6, t); o.frequency.exponentialRampToValueAtTime(cfg[3] * 0.5, t + 0.4); og.gain.setValueAtTime(v * 0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.55); }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { clamp, lerp, smooth, makeNoise, rng, canvasTex } from './util.js';

// ---------- Configuración por mapa ----------
const THEMES = {
  tropical: { sky: 0x9fc8de, fog: 0xa8cde0, sun: 0xfff1d8, sunI: 3.0, hemiS: 0xd2e8f6, hemiG: 0x3e4c3a, hemiI: 1.25, shallow: 0x35c2b8, deep: 0x0a3558, skyZ: 0x6fa8d6 },
  channel: { sky: 0xaebcc6, fog: 0xb2bfc8, sun: 0xf6f0e4, sunI: 2.5, hemiS: 0xd4dde4, hemiG: 0x4a4c3e, hemiI: 1.35, shallow: 0x5a8f88, deep: 0x163644, skyZ: 0x8ea4b6 },
  bocage: { sky: 0xb4c4ca, fog: 0xbac8cc, sun: 0xfbf2e0, sunI: 2.7, hemiS: 0xd8e2e6, hemiG: 0x4c4a38, hemiI: 1.3, shallow: 0x5a8f88, deep: 0x163644, skyZ: 0x8ea4b6 },
  desert: { sky: 0xd9ccb0, fog: 0xdccfb4, sun: 0xffe8c2, sunI: 3.2, hemiS: 0xeee4d0, hemiG: 0x8a7050, hemiI: 1.1, shallow: 0x43b4ba, deep: 0x0d3d62, skyZ: 0x86acc8 },
};
export const MAPCFG = {
  pacific_sea: { theme: 'tropical', gen: 'tropical', ext: 4800, N: 320, bounds: 1550, zoneS: 760, zoneR: 260, spawn: 1080 },
  pacific_air: { theme: 'tropical', gen: 'tropical', ext: 4800, N: 320, bounds: 1650, zoneS: 720, zoneR: 0, spawn: 1380, sites: true },
  europe_sea: { theme: 'channel', gen: 'channelSea', ext: 4800, N: 320, bounds: 1500, zoneS: 760, zoneR: 260, spawn: 1050 },
  europe_air: { theme: 'channel', gen: 'channelAir', ext: 4800, N: 320, bounds: 1650, zoneS: 720, zoneR: 0, spawn: 1380, sites: true },
  europe_land: { theme: 'bocage', gen: 'bocage', ext: 3600, N: 360, bounds: 1150, zoneS: 520, zoneR: 175, spawn: 780 },
  africa_land: { theme: 'desert', gen: 'desert', ext: 3600, N: 300, bounds: 1150, zoneS: 540, zoneR: 175, spawn: 780 },
  africa_air: { theme: 'desert', gen: 'desertAir', ext: 4800, N: 320, bounds: 1650, zoneS: 720, zoneR: 0, spawn: 1380, sites: true },
};

let worldGroup = null, water = null, clouds = [], sky = null;

function dispose(o) {
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
}

// ---------- Generación de alturas ----------
function makeHeightFn(cfg, seed) {
  const N = makeNoise(seed), R = rng(seed + 7), gen = cfg.gen;
  const zs = cfg.zoneS, zones = [[-zs, 0], [0, 0], [zs, 0]];
  const sitesA = [[-700, 1060], [0, 1180], [700, 1060]], sitesE = sitesA.map(([x, z]) => [x, -z]);
  const keep = [];
  let fn;
  if (gen === 'tropical') {
    const isl = [];
    const ok = (x, z, r) => keep.every(k => Math.hypot(x - k[0], z - k[1]) > r + k[2]) && isl.every(i => Math.hypot(x - i.x, z - i.z) > r + i.r + 40);
    if (cfg.sites) { [...sitesA, ...sitesE].forEach(([x, z]) => isl.push({ x, z, r: 240 + R() * 50, h: 14 + R() * 10, at: false })); }
    if (cfg.zoneR) zones.forEach(([x, z]) => keep.push([x, z, cfg.zoneR + 60]));
    if (!cfg.sites) { for (const s of [-1, 1]) keep.push([0, s * cfg.spawn, 330], [-520, s * cfg.spawn, 260], [520, s * cfg.spawn, 260]); }
    let tries = 0;
    while (isl.length < (cfg.sites ? 16 : 12) && tries++ < 600) {
      const r = 90 + R() * 230, x = (R() * 2 - 1) * 2000, z = (R() * 2 - 1) * 2000;
      if (ok(x, z, r)) isl.push({ x, z, r, h: 8 + R() * 34, at: R() < 0.2 && r > 150 });
    }
    fn = (x, z) => {
      let h = -40 + N.fbm(x * 0.0009, z * 0.0009, 3) * 8;
      for (const i of isl) {
        const dx = x - i.x, dz = z - i.z; if (Math.abs(dx) > i.r * 1.9 || Math.abs(dz) > i.r * 1.9) continue;
        const d = Math.hypot(dx, dz) * (1 + N.fbm(x * 0.004 + i.x, z * 0.004, 3) * 0.45);
        let v = i.at ? 1 - Math.abs(d - i.r * 0.8) / (i.r * 0.22) : 1 - d / i.r;
        let f;
        if (v < -0.7) continue;
        if (v < 0) f = lerp(-40, -2.5, Math.pow((v + 0.7) / 0.7, 2));
        else if (v < 0.12) f = lerp(-2.5, 1.6, v / 0.12);
        else f = 1.6 + (i.at ? 1.5 : i.h) * Math.pow(smooth(0.12, 1, v), 1.3) * (0.75 + 0.5 * N.fbm(x * 0.01, z * 0.01, 3)) + (i.at ? 0 : N.fbm(x * 0.02, z * 0.02, 2) * 2);
        if (i.at && v > 0) { /* laguna interior */ }
        if (f > h) h = f;
      }
      return h;
    };
  } else if (gen === 'channelSea') {
    const rocks = [];
    while (rocks.length < 4) { const x = (R() * 2 - 1) * 1300, z = (R() * 2 - 1) * 700; if (zones.every(([a, b]) => Math.hypot(x - a, z - b) > 340)) rocks.push([x, z, 70 + R() * 90]); }
    fn = (x, z) => {
      let h = -30 + N.fbm(x * 0.001, z * 0.001, 3) * 5;
      const cn = -1500 + N.fbm(x * 0.0012, 3.3, 4) * 260, s1 = cn - z; // costa francesa
      const cs = 1560 + N.fbm(x * 0.0011, 8.1, 4) * 220, s2 = z - cs;   // costa inglesa
      for (const s of [s1, s2]) {
        if (s > -160) h = Math.max(h, s < 0 ? -2 + s * 0.18 : Math.min(26, 3 + s * 0.55) + N.fbm(x * 0.006, z * 0.006, 3) * 5);
      }
      for (const [rx, rz, rr] of rocks) {
        const d = Math.hypot(x - rx, z - rz) * (1 + N.fbm(x * 0.01, z * 0.01, 2) * 0.5), v = 1 - d / rr;
        if (v > -0.6) h = Math.max(h, v < 0 ? lerp(-30, -2, Math.pow((v + 0.6) / 0.6, 2)) : 1 + v * 14);
      }
      return h;
    };
  } else if (gen === 'channelAir') {
    fn = (x, z) => {
      const zc = 60 + N.fbm(x * 0.0008, 1.7, 4) * 260, s = Math.abs(z - zc) - 420;
      if (s < 0) return Math.max(-30 + N.fbm(x * 0.001, z * 0.001, 3) * 4, -2 + s * 0.2);
      return 2 + Math.min(s * 0.35, 14) + N.fbm(x * 0.0008, z * 0.0008, 4) * 14 + N.fbm(x * 0.004, z * 0.004, 2) * 2;
    };
  } else if (gen === 'bocage') {
    fn = (x, z) => Math.max(2.5, 10 + N.fbm(x * 0.0007, z * 0.0007, 4) * 20 + N.fbm(x * 0.003, z * 0.003, 3) * 3);
  } else if (gen === 'desert' || gen === 'desertAir') {
    fn = (x, z) => {
      let h = 8 + N.fbm(x * 0.0006, z * 0.0006, 4) * 14;
      h += Math.pow(N.ridge(x * 0.0022 + z * 0.0012, z * 0.0016 - x * 0.0004, 3), 3) * 6;
      const zr = 20 + N.fbm(x * 0.001, 5.5, 3) * 160; // cresta central
      h += 8 * Math.exp(-Math.pow((z - zr) / 140, 2));
      h += N.fbm(x * 0.02, z * 0.02, 2) * 0.6;
      if (gen === 'desertAir') { const s = z - (-1550 + N.fbm(x * 0.001, 2.2, 3) * 150); if (s < 160) h = s < 0 ? Math.max(-30, -1 + s * 0.15) : Math.min(h, lerp(1, h, s / 160)); }
      return h;
    };
  }
  return { fn, N, R, zones, sitesA, sitesE };
}

// ---------- Construcción del mundo ----------
export function buildWorld(mapKey, seed = (Math.random() * 1e9) | 0) {
  if (worldGroup) { G.scene.remove(worldGroup); dispose(worldGroup); }
  worldGroup = new THREE.Group(); G.scene.add(worldGroup); clouds = [];
  const cfg = MAPCFG[mapKey], th = THEMES[cfg.theme];
  const { fn, N, R, zones, sitesA, sitesE } = makeHeightFn(cfg, seed);
  const ext = cfg.ext, n = cfg.N, cell = ext / n, half = ext / 2;
  const H = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = -half + i * cell, z = -half + j * cell;
    let h = fn(x, z);
    const edge = Math.max(Math.abs(x), Math.abs(z)); // relleno lejos del área de juego
    if (edge > cfg.bounds + 500) h = lerp(h, h > 0 ? h * 0.6 : h, smooth(cfg.bounds + 500, half, edge));
    H[j * (n + 1) + i] = h;
  }
  const h = (x, z) => {
    const fx = clamp((x + half) / cell, 0, n - 0.001), fz = clamp((z + half) / cell, 0, n - 0.001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * (n + 1) + i;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + n + 1] * (1 - u) + H[k + n + 2] * u) * v;
  };
  // Caminos
  const roads = [];
  if (cfg.theme === 'bocage' || cfg.theme === 'desert') {
    const zz = 0, amp = 60;
    roads.push({ t: 'h', f: x => zz + amp * Math.sin(x * 0.0025 + 1) });
    for (const [zx] of zones) roads.push({ t: 'v', f: z => zx + 35 * Math.sin(z * 0.004 + zx) });
    if (cfg.gen === 'bocage') roads.push({ t: 'h', f: x => 420 + 80 * Math.sin(x * 0.002) }, { t: 'h', f: x => -430 + 70 * Math.sin(x * 0.0023 + 2) });
    zones.forEach(zn => { zn[1] = zz + amp * Math.sin(zn[0] * 0.0025 + 1); });
  }
  const roadDist = (x, z) => { let d = 1e9; for (const r of roads) d = Math.min(d, r.t === 'h' ? Math.abs(z - r.f(x)) : Math.abs(x - r.f(z))); return d; };

  // Ajustar zonas navales al agua
  const isLand = (x, z) => h(x, z) > 0.6, isSea = (x, z) => h(x, z) < -2.5, isDeep = (x, z) => h(x, z) < -9;

  // ----- Terreno -----
  const geo = new THREE.PlaneGeometry(ext, ext, n, n); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setY(k, H[k]);
  geo.computeVertexNormals();
  const c = new THREE.Color();
  const C = hex => new THREE.Color(hex);
  const P = {
    sandW: C(0xe3d6ae), sandWet: C(0xc9bb92), reef: C(0xc8c29a), seabed: C(0x56635c),
    jungle: C(0x2f5a2a), jungle2: C(0x46703a), rock: C(0x6c6558), chalk: C(0xdcdace), shingle: C(0xa8a190),
    dsand: C(0xd2ae78), dsand2: C(0xbf955f), drock: C(0x9a7a55), dgravel: C(0xc5a985), road: C(0xb3a27e), droad: C(0xd9c49c), hedge: C(0x3c5527), track: C(0xa58a62),
  };
  const fields = [0x6f8f3e, 0x86a04a, 0x5b7c34, 0xb9ac63, 0x9d8752, 0x6d5c41, 0x7a9a46].map(C);
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const colorAt = (x, z) => {
    const y = h(x, z), e2 = 3;
    const slope = Math.hypot(h(x + e2, z) - h(x - e2, z), h(x, z + e2) - h(x, z - e2)) / (2 * e2);
    const nz = N.fbm(x * 0.02, z * 0.02, 3), nz2 = N.fbm(x * 0.004, z * 0.004, 3);
    if (y < -0.5) { c.copy(cfg.theme === 'tropical' || cfg.theme === 'desert' ? P.reef : P.shingle).lerp(P.seabed, smooth(1, 30, -y)); }
    else if (cfg.theme === 'tropical') {
      if (y < 2.2) c.copy(P.sandW).lerp(P.sandWet, smooth(1.2, -0.5, y) * 0.8);
      else { c.copy(P.jungle).lerp(P.jungle2, (nz + 1) / 2); c.lerp(P.rock, smooth(0.35, 0.8, slope)); if (y < 3) c.lerp(P.sandW, smooth(3, 2.2, y)); }
    } else if (cfg.theme === 'desert') {
      c.copy(P.dsand).lerp(P.dsand2, clamp((nz2 + 0.5), 0, 1) * 0.7); c.lerp(P.dgravel, clamp(nz * 1.5, 0, 1) * 0.5);
      c.lerp(P.drock, smooth(0.12, 0.35, slope));
      if (y < 1.5) c.lerp(P.sandW, 0.5);
      const rd = roadDist(x, z); if (rd < 7) c.lerp(P.droad, smooth(7, 3, rd) * 0.7);
      const tk = Math.abs(N.n2(x * 0.004 + 50, z * 0.004)); if (tk < 0.012) c.lerp(P.track, 0.35);
    } else {
      if (y < 2.5 && cfg.theme === 'channel') { c.copy(slope > 0.5 ? P.chalk : P.sandWet).lerp(P.shingle, 0.3); }
      else {
        const wx = x + N.fbm(x * 0.01, z * 0.01, 2) * 18, wz = z + N.fbm(z * 0.01, x * 0.01, 2) * 18;
        const cx = Math.floor(wx / 135), cz = Math.floor(wz / 105), fh = hash(cx, cz);
        c.copy(fields[(fh * fields.length) | 0]); c.offsetHSL(0, 0, nz * 0.03);
        if (fh > 0.42 && fh < 0.72) { const fur = Math.sin((fh > 0.57 ? wx : wz) * 1.6); c.offsetHSL(0, 0, fur * 0.012); }
        const ex = Math.min(wx - cx * 135, (cx + 1) * 135 - wx), ez = Math.min(wz - cz * 105, (cz + 1) * 105 - wz);
        if (Math.min(ex, ez) < 3.2 && cfg.gen !== 'channelSea') c.lerp(P.hedge, 0.75);
        if (cfg.theme === 'channel') c.lerp(P.chalk, smooth(0.6, 1.0, slope));
        if (y < 3 && cfg.theme === 'channel') c.lerp(P.sandWet, smooth(3, 2, y));
        const rd = roadDist(x, z); if (rd < 5) c.lerp(P.road, smooth(5, 2.5, rd));
      }
    }
    c.offsetHSL(0, 0, nz * 0.02 + (Math.random() - 0.5) * 0.025);
    return c;
  };
  const T = ext > 4000 ? 1536 : 2048, cv = document.createElement('canvas'); cv.width = cv.height = T;
  const cx2 = cv.getContext('2d'), img = cx2.createImageData(T, T);
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const x = -half + (i + 0.5) / T * ext, z = -half + (j + 0.5) / T * ext;
    const col = colorAt(x, z).convertLinearToSRGB(), o = (j * T + i) * 4;
    img.data[o] = col.r * 255; img.data[o + 1] = col.g * 255; img.data[o + 2] = col.b * 255; img.data[o + 3] = 255;
  }
  cx2.putImageData(img, 0, 0);
  const colorTex = new THREE.CanvasTexture(cv); colorTex.colorSpace = THREE.SRGBColorSpace; colorTex.anisotropy = 8;
  G.mapImage = cv;
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, map: colorTex }));
  terrain.receiveShadow = true; worldGroup.add(terrain);

  // ----- Agua (shader) -----
  const dn = n + 1, dd = new Uint8Array(dn * dn * 4);
  for (let k = 0; k < dn * dn; k++) { const v = clamp(-H[k] * 6, 0, 255); dd[k * 4] = v; dd[k * 4 + 3] = 255; }
  const depthTex = new THREE.DataTexture(dd, dn, dn, THREE.RGBAFormat); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
  const wmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      t: { value: 0 }, depthTex: { value: depthTex }, ext: { value: ext },
      sunDir: { value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize() }, sunCol: { value: new THREE.Color(th.sun) },
      shallow: { value: new THREE.Color(th.shallow) }, deep: { value: new THREE.Color(th.deep) },
      skyH: { value: new THREE.Color(th.sky) }, skyZ: { value: new THREE.Color(th.skyZ) },
      fogC: { value: new THREE.Color(th.fog) }, fogN: { value: 600 }, fogF: { value: 2000 },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float t, ext, fogN, fogF; uniform sampler2D depthTex; uniform vec3 sunDir, sunCol, shallow, deep, skyH, skyZ, fogC; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float waves(vec2 p){ float h=0.0;
        h += sin(dot(p, vec2(0.031,0.019)) + t*1.2)*0.5; h += sin(dot(p, vec2(-0.022,0.035)) + t*1.5)*0.4;
        h += sin(dot(p, vec2(0.07,-0.043)) + t*2.3)*0.18; h += noise(p*0.09 + t*0.18)*0.7 + noise(p*0.27 - t*0.25)*0.35 + noise(p*0.8 + t*0.6)*0.12; return h; }
      void main(){
        vec2 p = vW.xz; float e = 0.6; float h0 = waves(p);
        vec3 n = normalize(vec3(-(waves(p+vec2(e,0.0))-h0)/e*0.55, 1.0, -(waves(p+vec2(0.0,e))-h0)/e*0.55));
        vec3 V = normalize(cameraPosition - vW);
        vec2 uv = (p + ext*0.5) / ext; float depth = texture2D(depthTex, clamp(uv, 0.0, 1.0)).r * 42.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) depth = 40.0;
        vec3 base = mix(shallow, deep, smoothstep(0.0, 24.0, depth));
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 R = reflect(-V, n); vec3 sky = mix(skyH, skyZ, clamp(R.y, 0.0, 1.0));
        vec3 col = mix(base, sky, 0.10 + 0.55*fres);
        col *= 0.78 + 0.32*max(dot(n, sunDir), 0.0);
        col += sunCol * pow(max(dot(R, sunDir), 0.0), 220.0) * 2.2;
        float fz = smoothstep(2.0, 0.15, depth); float fn = noise(p*0.32 + vec2(t*0.35, -t*0.28)) * 0.6 + noise(p*1.1 - t*0.5)*0.4;
        col = mix(col, vec3(0.93,0.96,0.96), fz * smoothstep(0.35, 0.7, fn + fz*0.35) * 0.95);
        float a = mix(0.42, 0.97, smoothstep(0.0, 7.0, depth));
        float d = length(cameraPosition - vW); col = mix(col, fogC, smoothstep(fogN, fogF, d));
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), wmat);
  water.rotation.x = -Math.PI / 2; water.position.y = 0; water.renderOrder = 1;
  worldGroup.add(water);

  // ----- Vegetación y construcciones -----
  const d = new THREE.Object3D();
  function inst(geo, color, list, opts = {}) {
    if (!list.length) return;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.92, flatShading: !!opts.flat });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => { d.position.set(p.x, h(p.x, p.z) + (opts.yo || 0) * p.s - (opts.sink || 0), p.z); d.rotation.set(p.rx || 0, p.r, 0); d.scale.set(p.s * (p.sx || 1), p.s * (p.sy || 1), p.s * (p.sz || 1)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.castShadow = opts.shadow !== false; im.receiveShadow = true; worldGroup.add(im);
  }
  const scatter = (count, test, extra = () => ({})) => { const out = []; for (let i = 0; i < count; i++) { const x = (R() * 2 - 1) * (cfg.bounds + 450), z = (R() * 2 - 1) * (cfg.bounds + 450); const y = h(x, z); if (test(x, z, y)) out.push({ x, z, r: R() * 6.28, s: 0.75 + R() * 0.6, ...extra(x, z) }); } return out; };
  const inZone = (x, z, r = 40) => roadDist(x, z) < 10 || zones.some(([a, b]) => Math.hypot(x - a, z - b) < r);

  if (cfg.theme === 'tropical') {
    const palm = scatter(9000, (x, z, y) => y > 1.4 && y < 5 && R() < 0.35);
    const jungle = scatter(14000, (x, z, y) => y > 3.5 && N.fbm(x * 0.01, z * 0.01, 2) > -0.15);
    const trunk = new THREE.CylinderGeometry(0.22, 0.38, 9, 6); trunk.translate(0, 4.5, 0); trunk.rotateZ(0.12);
    const fr = []; for (let k = 0; k < 8; k++) { const f = new THREE.BoxGeometry(0.5, 0.12, 4.2); f.translate(0, 0, 2.1); f.rotateX(0.45); f.rotateY(k / 8 * Math.PI * 2); fr.push(f); }
    const crown = mergeGeometries(fr); crown.translate(1.1, 9, 0);
    inst(trunk, 0x7d6a50, palm); inst(crown, 0x4f7f34, palm, { flat: true });
    const jt = mergeGeometries([new THREE.IcosahedronGeometry(3.4, 0).translate(0, 7, 0), new THREE.IcosahedronGeometry(2.6, 0).translate(2.2, 6, 1), new THREE.IcosahedronGeometry(2.4, 0).translate(-1.8, 6.5, -1.2), new THREE.IcosahedronGeometry(2.2, 0).translate(0.4, 8.8, 0.3)]);
    inst(jt, 0x2e5427, jungle, { flat: true });
    const huts = scatter(1200, (x, z, y) => y > 1.8 && y < 4 && R() < 0.06);
    inst(new THREE.BoxGeometry(5, 3, 6).translate(0, 1.5, 0), 0x8a7558, huts);
    inst(new THREE.ConeGeometry(4.6, 3, 4).rotateY(Math.PI / 4).translate(0, 4.4, 0), 0x9b8a5e, huts, { flat: true });
  } else if (cfg.theme === 'desert') {
    const scrub = scatter(5000, (x, z, y) => y > 1.5 && R() < 0.4 && !inZone(x, z, 20), () => ({ sy: 0.5 }));
    inst(new THREE.IcosahedronGeometry(1.4, 0).translate(0, 0.6, 0), 0x6f6a3e, scrub, { flat: true });
    const rocks = scatter(2500, (x, z, y) => y > 1 && N.fbm(x * 0.004, z * 0.004, 2) > 0.15 && R() < 0.5, () => ({ sy: 0.55, sx: 1 + Math.random() }));
    inst(new THREE.DodecahedronGeometry(2.2, 0), 0x8c7454, rocks, { flat: true, sink: 0.6 });
    // Oasis con palmeras
    const oasis = []; for (let k = 0; k < 3; k++) { const ox = (R() * 2 - 1) * 900, oz = (R() * 2 - 1) * 900; for (let q = 0; q < 26; q++) oasis.push({ x: ox + (R() - 0.5) * 90, z: oz + (R() - 0.5) * 90, r: R() * 6, s: 0.8 + R() * 0.4 }); }
    const trunk = new THREE.CylinderGeometry(0.22, 0.38, 9, 6).translate(0, 4.5, 0).rotateZ(0.1);
    const fr = []; for (let k = 0; k < 8; k++) { const f = new THREE.BoxGeometry(0.5, 0.12, 4); f.translate(0, 0, 2); f.rotateX(0.45); f.rotateY(k / 8 * Math.PI * 2); fr.push(f); }
    inst(trunk, 0x7d6a50, oasis); inst(mergeGeometries(fr).translate(0.9, 9, 0), 0x5b7f39, oasis, { flat: true });
    // Casas blancas y postes de telégrafo
    const houses = []; for (let k = 0; k < 6; k++) { const vx = (R() * 2 - 1) * 1000, vz = (R() * 2 - 1) * 1000; if (inZone(vx, vz, 120)) continue; for (let q = 0; q < 8; q++) houses.push({ x: vx + (R() - 0.5) * 70, z: vz + (R() - 0.5) * 70, r: R() * 0.3, s: 0.8 + R() * 0.5 }); }
    inst(new THREE.BoxGeometry(8, 4, 8).translate(0, 2, 0), 0xe4d8bf, houses);
  } else { // channel / bocage
    const isB = cfg.theme === 'bocage';
    const trees = scatter(isB ? 9000 : 6000, (x, z, y) => y > 3 && N.fbm(x * 0.0035, z * 0.0035, 3) > 0.12 && !inZone(x, z, 60));
    const tg = mergeGeometries([new THREE.IcosahedronGeometry(3.6, 0).translate(0, 7.5, 0), new THREE.IcosahedronGeometry(2.8, 0).translate(2, 6.6, 1.4), new THREE.IcosahedronGeometry(2.6, 0).translate(-2, 7, -1), new THREE.IcosahedronGeometry(2.4, 0).translate(0.5, 9.4, 0.6)]);
    inst(tg, 0x3b5a2c, trees, { flat: true });
    inst(new THREE.CylinderGeometry(0.3, 0.45, 5, 5).translate(0, 2.5, 0), 0x5a4a38, trees);
    // Setos (bocage) en los bordes de los campos
    const hedges = [], htrees = [];
    if (isB || cfg.gen === 'channelAir') {
      const B = cfg.bounds + 250;
      for (let cx = Math.floor(-B / 135); cx <= Math.ceil(B / 135); cx++) for (let cz = Math.floor(-B / 105); cz <= Math.ceil(B / 105); cz++) {
        for (const vert of [0, 1]) {
          if (hash(cx * 3 + 1 + vert * 7, cz) < 0.22) continue;
          const len = vert ? 105 : 135;
          for (let t = 0; t < len; t += 6.5) {
            const wx = vert ? cx * 135 : cx * 135 + t, wz = vert ? cz * 105 + t : cz * 105;
            const x = wx - N.fbm(wx * 0.01, wz * 0.01, 2) * 18, z = wz - N.fbm(wz * 0.01, wx * 0.01, 2) * 18;
            if (Math.abs(x) > B || Math.abs(z) > B || h(x, z) < 2.5 || inZone(x, z, 16)) continue;
            if (R() < 0.07) htrees.push({ x, z, r: R() * 6.28, s: 0.8 + R() * 0.5 });
            else hedges.push({ x, z, r: (vert ? 0 : Math.PI / 2) + (R() - 0.5) * 0.3, s: 0.9 + R() * 0.35, sy: 0.8 + R() * 0.5 });
          }
        }
      }
    }
    inst(tg, 0x34522a, htrees, { flat: true });
    inst(new THREE.IcosahedronGeometry(1.7, 0).scale(1.5, 1.2, 2.6).translate(0, 1.5, 0), 0x3a5428, hedges, { flat: true });
    // Pueblos normandos
    const houses = [], roofs = [];
    const vill = isB ? zones.map(([x, z]) => [x + 70, z + 60]).concat([[-900, -500], [880, 520], [-300, 650]]) : [];
    if (!isB) for (let k = 0; k < 10; k++) { const x = (R() * 2 - 1) * 1300, z = (R() * 2 - 1) * 1300; if (h(x, z) > 4) vill.push([x, z]); }
    for (const [vx, vz] of vill) for (let q = 0; q < 12; q++) { const x = vx + (R() - 0.5) * 110, z = vz + (R() - 0.5) * 110; if (h(x, z) < 2 || roadDist(x, z) < 8 || inZone(x, z, 25)) continue; const p = { x, z, r: (R() < 0.5 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.2, s: 0.85 + R() * 0.4 }; houses.push(p); roofs.push(p); }
    inst(new THREE.BoxGeometry(7, 5, 10).translate(0, 2.5, 0), 0xcfc4ad, houses);
    inst(new THREE.CylinderGeometry(4.6, 4.6, 10.4, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.75, 1).translate(0, 6.4, 0).rotateY(Math.PI / 2), 0x6b4a3a, roofs, { flat: true });
  }

  // ----- Nubes -----
  const ctex = canvasTex(128, (g, s) => {
    for (let k = 0; k < 18; k++) { const x = s * (0.25 + Math.random() * 0.5), y = s * (0.3 + Math.random() * 0.4), r = s * (0.12 + Math.random() * 0.15); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
  });
  for (let k = 0; k < 34; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, opacity: cfg.theme === 'desert' ? 0.35 : 0.7, depthWrite: false, fog: false }));
    sp.scale.set(420 + R() * 380, 240 + R() * 160, 1); sp.position.set((R() * 2 - 1) * 2400, 520 + R() * 80, (R() * 2 - 1) * 2400);
    worldGroup.add(sp); clouds.push(sp);
  }

  // ----- Cúpula de cielo (para vistas bajas) -----
  sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { hc: { value: new THREE.Color(th.fog) }, zc: { value: new THREE.Color(th.skyZ) }, sd: { value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize() }, sc: { value: new THREE.Color(th.sun) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 hc, zc, sd, sc; varying vec3 vP;
      void main(){ float t = clamp(vP.y * 2.4, 0.0, 1.0); vec3 c = mix(hc, zc, pow(t, 0.65));
        c += sc * pow(max(dot(vP, sd), 0.0), 64.0) * 0.6;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; worldGroup.add(sky);

  // ----- Atmósfera y luz -----
  G.scene.background = new THREE.Color(th.sky);
  G.scene.fog = new THREE.Fog(th.fog, 600, 2400);
  G.sun.color.set(th.sun); G.sun.intensity = th.sunI;
  G.hemi.color.set(th.hemiS); G.hemi.groundColor.set(th.hemiG); G.hemi.intensity = th.hemiI;

  // Zonas: asegurar que caen en agua (naval) o tierra (terrestre)
  const zonePts = zones.map(([x, z]) => ({ x, z }));
  G.map = {
    key: mapKey, cfg, theme: cfg.theme, ext, n, H, h, isLand, isSea, isDeep, bounds: cfg.bounds, zones: zonePts, sitesA, sitesE, roadDist,
    gy: (x, z) => Math.max(h(x, z), 0),
    waterMat: wmat, water,
  };
  return G.map;
}

export function updateWorld(dt) {
  if (!water) return;
  const u = water.material.uniforms;
  u.t.value += dt;
  u.fogN.value = G.scene.fog.near; u.fogF.value = G.scene.fog.far;
  for (const c of clouds) { c.position.x += 6 * dt; if (c.position.x > 2600) c.position.x = -2600; }
  if (sky && G.camera) sky.position.copy(G.camera.position);
}

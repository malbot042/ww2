import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { clamp, lerp, smooth, makeNoise, rng, canvasTex } from './util.js';

// ---------- Configuración por mapa ----------
const THEMES = {
  tropical: { sky: 0x9fc8de, fog: 0xa8cde0, sun: 0xfff1d8, sunI: 3.0, hemiS: 0xd2e8f6, hemiG: 0x3e4c3a, hemiI: 1.25, shallow: 0x35c2b8, deep: 0x0a3558, skyZ: 0x6fa8d6 },
  channel: { sky: 0xaebcc6, fog: 0xb2bfc8, sun: 0xf6f0e4, sunI: 2.5, hemiS: 0xd4dde4, hemiG: 0x4a4c3e, hemiI: 1.35, shallow: 0x5a8f88, deep: 0x163644, skyZ: 0x8ea4b6 },
  bocage: { sky: 0xb4c4ca, fog: 0xbac8cc, sun: 0xfbf2e0, sunI: 2.7, hemiS: 0xd8e2e6, hemiG: 0x4c4a38, hemiI: 1.3, shallow: 0x5a8f88, deep: 0x163644, skyZ: 0x8ea4b6 },
  mixed: { sky: 0xbccad2, fog: 0xc2ccd0, sun: 0xfff0dc, sunI: 2.9, hemiS: 0xdde6ea, hemiG: 0x5c5440, hemiI: 1.25, shallow: 0x3dbab6, deep: 0x0c3a5c, skyZ: 0x7fa8cc },
  desert: { sky: 0xd9ccb0, fog: 0xdccfb4, sun: 0xffe8c2, sunI: 3.2, hemiS: 0xeee4d0, hemiG: 0x8a7050, hemiI: 1.1, shallow: 0x43b4ba, deep: 0x0d3d62, skyZ: 0x86acc8 },
};
export const MAPCFG = {
  pacific_sea: { scale: 1.4, theme: 'tropical', gen: 'tropical', ext: 4800, N: 320, bounds: 1550, zoneS: 760, zoneR: 260, spawn: 1080 },
  pacific_air: { scale: 1.4, theme: 'tropical', gen: 'tropical', ext: 4800, N: 320, bounds: 1650, zoneS: 720, zoneR: 0, spawn: 1380, sites: true },
  europe_sea: { scale: 1.4, theme: 'channel', gen: 'channelSea', ext: 4800, N: 320, bounds: 1500, zoneS: 760, zoneR: 260, spawn: 1050 },
  europe_air: { scale: 1.4, theme: 'channel', gen: 'channelAir', ext: 4800, N: 320, bounds: 1650, zoneS: 720, zoneR: 0, spawn: 1380, sites: true },
  atoll: { scale: 1.4, theme: 'tropical', gen: 'atoll', ext: 4800, N: 360, bounds: 1550, zoneS: 0, zoneR: 200, spawn: 1000, combined: true },
  normandy: { scale: 1.4, theme: 'channel', gen: 'normandy', ext: 4800, N: 360, bounds: 1550, zoneS: 0, zoneR: 210, spawn: 1000, combined: true },
  europe_land: { scale: 1.4, theme: 'bocage', gen: 'bocage', ext: 3600, N: 360, bounds: 1150, zoneS: 520, zoneR: 175, spawn: 780 },
  africa_land: { scale: 1.4, theme: 'desert', gen: 'desert', ext: 3600, N: 300, bounds: 1150, zoneS: 540, zoneR: 175, spawn: 780 },
  tobruk: { scale: 1.4, theme: 'desert', gen: 'tobruk', ext: 4800, N: 360, bounds: 1550, zoneS: 0, zoneR: 200, spawn: 1000, combined: true },
  // campo de pruebas: desierto al oeste, campiña europea al este, Pacífico con islas al sur
  proving: { theme: 'mixed', gen: 'mixed', ext: 7200, N: 480, bounds: 2600, zoneS: 0, zoneR: 0, spawn: 1000, combined: true },
  africa_air: { scale: 1.4, theme: 'desert', gen: 'desertAir', ext: 4800, N: 320, bounds: 1650, zoneS: 720, zoneR: 0, spawn: 1380, sites: true },
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
  } else if (gen === 'desert' || gen === 'desertAir' || gen === 'tobruk') {
    fn = (x, z) => {
      let h = 8 + N.fbm(x * 0.0006, z * 0.0006, 4) * 14;
      h += Math.pow(N.ridge(x * 0.0022 + z * 0.0012, z * 0.0016 - x * 0.0004, 3), 3) * 6;
      const zr = 20 + N.fbm(x * 0.001, 5.5, 3) * 160; // cresta central
      h += 8 * Math.exp(-Math.pow((z - zr) / 140, 2));
      h += N.fbm(x * 0.02, z * 0.02, 2) * 0.6;
      h = Math.max(h, 2); // sin charcos en el desierto
      if (gen === 'tobruk') { // costa norte con el puerto de Tobruk en una ensenada
        const s = z - (-720 + N.fbm(x * 0.0012, 7.7, 3) * 110), inlet = Math.abs(x - 150);
        if (inlet < 150 && z < -470) h = Math.min(h, Math.max(-14, -1 - (150 - inlet) * 0.12 - (-470 - z) * 0.05));
        if (s < 140) h = s < 0 ? Math.min(h, Math.max(-30, -1 + s * 0.12)) : Math.min(h, lerp(1.2, h, s / 140));
      }
      if (gen === 'desertAir') { const s = z - (-1550 + N.fbm(x * 0.001, 2.2, 3) * 150); if (s < 160) h = s < 0 ? Math.max(-30, -1 + s * 0.15) : Math.min(h, lerp(1, h, s / 160)); }
      return h;
    };
  }
  let extra = {};
  if (gen === 'mixed') {
    // rumbos desde el centro (0° = norte, 90° = este): Pacífico al suroeste y oeste, África al sur, Europa al este y norte
    const deg = (x, z) => (Math.atan2(x, -z) * 180 / Math.PI + 360) % 360;
    const polar = (th, r) => [Math.sin(th * Math.PI / 180) * r, -Math.cos(th * Math.PI / 180) * r];
    const adiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
    const PAC = 245, PHALF = 56;                                        // sector del océano: de ~189° (sur-suroeste) a ~301° (oeste-noroeste)
    // distancia firmada a la costa (m): > 0 tierra, < 0 mar; cerca del centro siempre hay tierra
    const coastD = (x, z) => { const r = Math.hypot(x, z), th = deg(x, z) + N.fbm(r * 0.0012, 4.4, 3) * 16; return (adiff(th, PAC) - PHALF) * Math.PI / 180 * Math.max(r, 1) + Math.max(0, 520 - r) * 1.4; };
    // peso del desierto: 1 en el sur (≈110°–200°), 0 en Europa (este y norte)
    const wD = (x, z) => { const th = deg(x, z) + N.fbm(Math.hypot(x, z) * 0.0011, 6.6, 3) * 18; return smooth(-20, 20, 50 - adiff(th, 160)); };
    const desH = (x, z) => 8 + N.fbm(x * 0.0006, z * 0.0006, 4) * 14 + Math.pow(N.ridge(x * 0.0022 + z * 0.0012, z * 0.0016 - x * 0.0004, 3), 3) * 6 + N.fbm(x * 0.02, z * 0.02, 2) * 0.6;
    const eurH = (x, z) => 10 + N.fbm(x * 0.0007, z * 0.0007, 4) * 20 + N.fbm(x * 0.003, z * 0.003, 3) * 3;
    const isl = [];
    for (let t = 0; isl.length < 10 && t < 1500; t++) {
      const r0 = 110 + R() * 230, [x, z] = polar(PAC + (R() * 2 - 1) * 48, 1000 + R() * 1800);
      if (Math.abs(x) + r0 > 2900 || Math.abs(z) + r0 > 2900 || coastD(x, z) > -r0 - 300) continue;
      if (isl.every(i => Math.hypot(x - i.x, z - i.z) > r0 + i.r + 160)) isl.push({ x, z, r: r0, h: 8 + R() * 30, at: R() < 0.2 && r0 > 160 });
    }
    fn = (x, z) => {
      const s = coastD(x, z);
      let h;
      if (s > 0) {
        const w = wD(x, z), land = Math.max(2.6, lerp(eurH(x, z), desH(x, z), w));
        h = s < 50 ? 0.6 + s * 0.035 : lerp(2.4, land, smooth(50, 260, s));
      } else h = Math.max(-36 + N.fbm(x * 0.0009, z * 0.0009, 3) * 6, -0.6 + s * 0.055);
      for (const i of isl) {
        const dx = x - i.x, dz = z - i.z; if (Math.abs(dx) > i.r * 1.9 || Math.abs(dz) > i.r * 1.9) continue;
        const d = Math.hypot(dx, dz) * (1 + N.fbm(x * 0.004 + i.x, z * 0.004, 3) * 0.45);
        const v = i.at ? 1 - Math.abs(d - i.r * 0.8) / (i.r * 0.22) : 1 - d / i.r;
        if (v < -0.7) continue;
        const f = v < 0 ? lerp(-36, -2.5, Math.pow((v + 0.7) / 0.7, 2)) : v < 0.12 ? lerp(-2.5, 1.6, v / 0.12) : 1.6 + (i.at ? 1.5 : i.h) * Math.pow(smooth(0.12, 1, v), 1.3) * (0.75 + 0.5 * N.fbm(x * 0.01, z * 0.01, 3));
        if (f > h) h = f;
      }
      return h;
    };
    zones.length = 0; zones.push(polar(150, 1300), [0, 0], polar(55, 1300));
    const big = isl.slice().sort((a, b) => b.r - a.r)[0];
    // primer punto de agua en un rumbo, saliendo desde el centro
    const seaAt = th => { for (let r = 400; r < 2800; r += 50) { const [x, z] = polar(th, r); if (coastD(x, z) < -250) return [x, z]; } return polar(th, 2400); };
    extra = {
      islands: isl, polar,
      region: (x, z) => coastD(x, z) < 40 ? 'trop' : wD(x, z) > 0.5 ? 'des' : 'eur',
      desertW: wD,
      spawns: { A: { land: x => [x * 1.4, 150], sea: seaAt(PAC), air: [0, 300] }, E: { land: polar(60, 2200), sea: seaAt(PAC + 40), air: polar(20, 2300) } },
      spots: {
        des: { land: polar(160, 1500), sea: seaAt(190), air: polar(160, 1500) },
        eur: { land: polar(55, 1500), sea: seaAt(298), air: polar(55, 1500) },
        trop: { land: big ? [big.x, big.z] : polar(PAC, 1800), sea: big ? [big.x + big.r + 260, big.z] : polar(PAC, 1800), air: big ? [big.x, big.z] : polar(PAC, 1800) },
      },
    };
  }
  if (gen === 'tobruk') {
    zones.length = 0; zones.push([150, -640], [-380, -260], [460, 280]);
    extra = {
      spawns: { A: { sea: [150, -1250], land: x => [x * 1.1, -380], air: [0, -1450], h: 0 }, E: { land: [0, 950], sea: [-1250, -1150], air: [0, 1450] } },
      staticsA: { aa: [[60, -560], [260, -540]] },
      convoy: [1300, -1250],
    };
  }
  if (gen === 'atoll') { // atolón alargado (Betio): playa sur, aeródromo en el centro, arrecife alrededor
    const RX = 950, RZ = 330, CZ = -220;
    const v = (x, z) => 1 - Math.hypot(x / RX, (z - CZ) / RZ) * (1 + N.fbm(x * 0.003, z * 0.003, 3) * 0.16);
    fn = (x, z) => {
      const s = v(x, z); let h = -38 + N.fbm(x * 0.001, z * 0.001, 3) * 5;
      if (s > -0.45) h = Math.max(h, s < 0 ? lerp(-38, -1.2, Math.pow((s + 0.45) / 0.45, 1.6)) : s < 0.07 ? lerp(-1.2, 1.4, s / 0.07) : 1.4 + smooth(0.07, 0.6, s) * 5 + N.fbm(x * 0.01, z * 0.01, 2) * 0.8);
      return h;
    };
    const shoreS = x => CZ + RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)) * 0.95;
    zones.length = 0; zones.push([-380, shoreS(-380) - 110], [380, CZ - 40], [0, shoreS(0) + 560]);
    extra = {
      coast: shoreS,
      spawns: { A: { sea: [0, shoreS(0) + 1050], air: [0, 1450], land: x => [x * 0.8, shoreS(x * 0.8) - 12] }, E: { land: [150, CZ - 60], sea: [1350, CZ + 250], air: [0, -1500] } },
      statics: { battery: [-700, -150, 500].map(x => [x, shoreS(x) - 150]), aa: [[-300, CZ - 80], [520, CZ - 120]] },
    };
  }
  if (gen === 'normandy') {
    const cz = x => 300 + N.fbm(x * 0.0011, 4.4, 3) * 110;
    fn = (x, z) => {
      const s = cz(x) - z;
      if (s < 0) return Math.max(-34, -0.6 + s * 0.045) + N.fbm(x * 0.01, z * 0.01, 2) * 0.4;
      if (s < 80) return 0.6 + s * 0.02;
      const bl = 2.2 + smooth(80, 150, s) * 13 + N.fbm(x * 0.02, z * 0.02, 2) * 1.5;
      return s < 150 ? bl : bl + N.fbm(x * 0.0008, z * 0.0008, 4) * 12 + N.fbm(x * 0.004, z * 0.004, 2) * 2.5;
    };
    zones.length = 0; zones.push([-420, cz(-420) - 190], [380, -420], [60, cz(60) + 560]);
    extra = {
      coast: cz,
      spawns: {
        A: { sea: [0, cz(0) + 1050], air: [0, 1450], land: x => [x, cz(x) - 40] },
        E: { land: [100, -1000], sea: [1250, cz(1250) + 640], air: [0, -1500] },
      },
      statics: { battery: [-820, 40, 700].map(x => [x, cz(x) - 210]), aa: [[-500, -250], [600, -300]] },
    };
  }
  // campo de batalla ampliado: todo el mapa (relieve, objetivos, salidas, costas) se escala por S
  const S = cfg.scale || 1;
  if (S !== 1) {
    const f0 = fn; fn = (x, z) => f0(x / S, z / S);
    for (const a of [zones, sitesA, sitesE]) a.forEach(p => { p[0] *= S; p[1] *= S; });
    const scl = (v, k) => {
      if (k === 'h') return v;
      if (typeof v === 'number') return v * S;
      if (typeof v === 'function') return k === 'coast' ? (x => S * v(x / S)) : (x => v(x / S).map(q => q * S));
      if (Array.isArray(v)) return v.map(q => scl(q));
      if (v && typeof v === 'object') { const o = {}; for (const kk in v) o[kk] = scl(v[kk], kk); return o; }
      return v;
    };
    extra = scl(extra);
  }
  return { fn, N, R, zones, sitesA, sitesE, extra };
}

// ---------- Construcción del mundo ----------
export function buildWorld(mapKey, seed = (Math.random() * 1e9) | 0) {
  if (worldGroup) { G.scene.remove(worldGroup); dispose(worldGroup); }
  worldGroup = new THREE.Group(); G.scene.add(worldGroup); clouds = [];
  const base = MAPCFG[mapKey], S = base.scale || 1, th = THEMES[base.theme];
  const { fn, N, R, zones, sitesA, sitesE, extra } = makeHeightFn(base, seed);
  // medidas del mapa ampliado (la generación usa las de base)
  const cfg = S === 1 ? base : { ...base, ext: Math.round(base.ext * S), N: Math.round(base.N * Math.min(S, 1.3)), bounds: Math.round(base.bounds * S), spawn: Math.round(base.spawn * S), zoneS: Math.round(base.zoneS * S) };
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
  if ((cfg.theme === 'bocage' || cfg.theme === 'desert') && cfg.gen !== 'tobruk') {
    const zz = 0, amp = 60;
    roads.push({ t: 'h', f: x => zz + amp * Math.sin(x * 0.0025 + 1) });
    for (const [zx] of zones) roads.push({ t: 'v', f: z => zx + 35 * Math.sin(z * 0.004 + zx) });
    if (cfg.gen === 'bocage') roads.push({ t: 'h', f: x => 420 + 80 * Math.sin(x * 0.002) }, { t: 'h', f: x => -430 + 70 * Math.sin(x * 0.0023 + 2) });
    zones.forEach(zn => { zn[1] = zz + amp * Math.sin(zn[0] * 0.0025 + 1); });
  }
  if (cfg.gen === 'mixed') roads.push({ t: 'h', f: x => 1450 + 70 * Math.sin(x * 0.0018) }, { t: 'v', f: z => 1250 + 35 * Math.sin(z * 0.004) }, { t: 'h', f: x => -1100 + 50 * Math.sin(x * 0.002 + 1) });
  if (cfg.gen === 'normandy') {
    const [ax] = zones[0], [, bz] = zones[1];
    roads.push({ t: 'v', f: z => ax + 30 * Math.sin(z * 0.004) }, { t: 'h', f: x => bz + 50 * Math.sin(x * 0.002) }, { t: 'v', f: z => zones[1][0] + 25 * Math.sin(z * 0.005 + 1) });
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
  const paint = (theme, x, z) => {
    const y = h(x, z), e2 = 3;
    const slope = Math.hypot(h(x + e2, z) - h(x - e2, z), h(x, z + e2) - h(x, z - e2)) / (2 * e2);
    const nz = N.fbm(x * 0.02, z * 0.02, 3), nz2 = N.fbm(x * 0.004, z * 0.004, 3);
    if (y < -0.5) { c.copy(theme === 'tropical' || theme === 'desert' ? P.reef : P.shingle).lerp(P.seabed, smooth(1, 30, -y)); }
    else if (theme === 'tropical') {
      if (y < 2.2) c.copy(P.sandW).lerp(P.sandWet, smooth(1.2, -0.5, y) * 0.8);
      else { c.copy(P.jungle).lerp(P.jungle2, (nz + 1) / 2); c.lerp(P.rock, smooth(0.35, 0.8, slope)); if (y < 3) c.lerp(P.sandW, smooth(3, 2.2, y)); }
    } else if (theme === 'desert') {
      c.copy(P.dsand).lerp(P.dsand2, clamp((nz2 + 0.5), 0, 1) * 0.7); c.lerp(P.dgravel, clamp(nz * 1.5, 0, 1) * 0.5);
      c.lerp(P.drock, smooth(0.12, 0.35, slope));
      if (y < 1.5) c.lerp(P.sandW, 0.5);
      const rd = roadDist(x, z); if (rd < 7) c.lerp(P.droad, smooth(7, 3, rd) * 0.7);
      const tk = Math.abs(N.n2(x * 0.004 + 50, z * 0.004)); if (tk < 0.012) c.lerp(P.track, 0.35);
    } else {
      if (y < 2.5 && theme === 'channel') { c.copy(slope > 0.5 ? P.chalk : P.sandWet).lerp(P.shingle, 0.3); }
      else {
        const wx = x + N.fbm(x * 0.01, z * 0.01, 2) * 18, wz = z + N.fbm(z * 0.01, x * 0.01, 2) * 18;
        const cx = Math.floor(wx / 135), cz = Math.floor(wz / 105), fh = hash(cx, cz);
        c.copy(fields[(fh * fields.length) | 0]); c.offsetHSL(0, 0, nz * 0.03);
        if (fh > 0.42 && fh < 0.72) { const fur = Math.sin((fh > 0.57 ? wx : wz) * 1.6); c.offsetHSL(0, 0, fur * 0.012); }
        const ex = Math.min(wx - cx * 135, (cx + 1) * 135 - wx), ez = Math.min(wz - cz * 105, (cz + 1) * 105 - wz);
        if (Math.min(ex, ez) < 3.2 && cfg.gen !== 'channelSea') c.lerp(P.hedge, 0.75);
        if (theme === 'channel') c.lerp(P.chalk, smooth(0.6, 1.0, slope));
        if (y < 3 && theme === 'channel') c.lerp(P.sandWet, smooth(3, 2, y));
        const rd = roadDist(x, z); if (rd < 5) c.lerp(P.road, smooth(5, 2.5, rd));
      }
    }
    c.offsetHSL(0, 0, nz * 0.02 + (Math.random() - 0.5) * 0.025);
    return c;
  };
  const c2 = new THREE.Color();
  const colorAt = (x, z) => {
    if (cfg.theme !== 'mixed') return paint(cfg.theme, x, z);
    const y = h(x, z), ex = extra;
    if (y < -0.5 || ex.region(x, z) === 'trop') return paint('tropical', x, z);
    if (y < 2.4) return paint('tropical', x, z); // playas de arena
    const w = ex.desertW(x, z);
    if (w > 0.98) return paint('desert', x, z);
    if (w < 0.02) return paint('bocage', x, z);
    c2.copy(paint('bocage', x, z)); paint('desert', x, z); return c.lerp(c2, 1 - w); // estepa de transición
  };
  const T = ext > 6000 ? 1792 : ext > 4000 ? 1536 : 2048, cv = document.createElement('canvas'); cv.width = cv.height = T;
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
      t: { value: 0 }, amp: { value: 1 }, depthTex: { value: depthTex }, ext: { value: ext },
      sunDir: { value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize() }, sunCol: { value: new THREE.Color(th.sun) },
      shallow: { value: new THREE.Color(th.shallow) }, deep: { value: new THREE.Color(th.deep) },
      skyH: { value: new THREE.Color(th.sky) }, skyZ: { value: new THREE.Color(th.skyZ) },
      fogC: { value: new THREE.Color(th.fog) }, fogN: { value: 600 }, fogF: { value: 2000 },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float t, amp, ext, fogN, fogF; uniform sampler2D depthTex; uniform vec3 sunDir, sunCol, shallow, deep, skyH, skyZ, fogC; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float waves(vec2 p){ float h=0.0;
        h += sin(dot(p, vec2(0.031,0.019)) + t*1.2)*0.5; h += sin(dot(p, vec2(-0.022,0.035)) + t*1.5)*0.4;
        h += sin(dot(p, vec2(0.07,-0.043)) + t*2.3)*0.18; h += noise(p*0.09 + t*0.18)*0.7 + noise(p*0.27 - t*0.25)*0.35 + noise(p*0.8 + t*0.6)*0.12; return h; }
      void main(){
        vec2 p = vW.xz; float e = 0.6; float h0 = waves(p);
        vec3 n = normalize(vec3(-(waves(p+vec2(e,0.0))-h0)/e*0.55*amp, 1.0, -(waves(p+vec2(0.0,e))-h0)/e*0.55*amp));
        vec3 V = normalize(cameraPosition - vW);
        vec2 uv = (p + ext*0.5) / ext; float depth = texture2D(depthTex, clamp(uv, 0.0, 1.0)).r * 42.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) depth = 40.0;
        vec3 base = mix(shallow, deep, smoothstep(0.0, 24.0, depth));
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 R = reflect(-V, n); vec3 sky = mix(skyH, skyZ, clamp(R.y, 0.0, 1.0));
        vec3 col = mix(base, sky, 0.10 + 0.55*fres);
        col = mix(col, vec3(0.86, 0.9, 0.92), smoothstep(1.5, 2.0, h0) * clamp(amp - 1.1, 0.0, 1.0) * 0.55); // borregos con mar gruesa
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
  // rejilla de cobertura (setos, árboles, casas...) para la línea de visión y los impactos
  const CS = 12, CN = Math.ceil(ext / CS), COVER = new Float32Array(CN * CN), half2 = ext / 2;
  const cellOf = (x, z) => { const i = ((x + half2) / CS) | 0, j = ((z + half2) / CS) | 0; return i < 0 || j < 0 || i >= CN || j >= CN ? -1 : j * CN + i; };
  const addCover = (list, w) => { for (const p of list) { const k = cellOf(p.x, p.z); if (k >= 0) COVER[k] = Math.min(1.2, COVER[k] + w); } };
  function inst(geo, color, list, opts = {}) {
    if (!list.length) return;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.92, flatShading: !!opts.flat });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => { d.position.set(p.x, h(p.x, p.z) + (opts.yo || 0) * p.s - (opts.sink || 0), p.z); d.rotation.set(p.rx || 0, p.r, 0); d.scale.set(p.s * (p.sx || 1), p.s * (p.sy || 1), p.s * (p.sz || 1)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.castShadow = opts.shadow !== false; im.receiveShadow = true; worldGroup.add(im);
  }
  const isMix = cfg.theme === 'mixed', inR = (k, x, z) => !isMix || extra.region(x, z) === k;
  const scatter = (count, test, extra = () => ({}), full = false) => { const out = []; if (!full) count = Math.round(count * (G.qual ? G.qual.veg : 1)); if (isMix) count = Math.round(count * 5.5); /* cada terreno ocupa solo una parte del mapa */ else if (S !== 1) count = Math.round(count * S * S); for (let i = 0; i < count; i++) { const x = (R() * 2 - 1) * (cfg.bounds + 450), z = (R() * 2 - 1) * (cfg.bounds + 450); const y = h(x, z); if (test(x, z, y)) out.push({ x, z, r: R() * 6.28, s: 0.75 + R() * 0.6, ...extra(x, z) }); } return out; };
  const inZone = (x, z, r = 40) => roadDist(x, z) < 10 || zones.some(([a, b]) => Math.hypot(x - a, z - b) < r);

  if (cfg.theme === 'tropical' || isMix) {
    const palm = scatter(9000, (x, z, y) => y > 1.4 && y < 5 && R() < 0.35 && inR('trop', x, z));
    const jungle = scatter(14000, (x, z, y) => y > 3.5 && N.fbm(x * 0.01, z * 0.01, 2) > -0.15 && inR('trop', x, z));
    const trunk = new THREE.CylinderGeometry(0.22, 0.38, 9, 6); trunk.translate(0, 4.5, 0); trunk.rotateZ(0.12);
    const fr = []; for (let k = 0; k < 8; k++) { const f = new THREE.BoxGeometry(0.5, 0.12, 4.2); f.translate(0, 0, 2.1); f.rotateX(0.45); f.rotateY(k / 8 * Math.PI * 2); fr.push(f); }
    const crown = mergeGeometries(fr); crown.translate(1.1, 9, 0);
    inst(trunk, 0x7d6a50, palm); inst(crown, 0x4f7f34, palm, { flat: true }); addCover(palm, 0.12);
    const jt = mergeGeometries([new THREE.IcosahedronGeometry(3.4, 0).translate(0, 7, 0), new THREE.IcosahedronGeometry(2.6, 0).translate(2.2, 6, 1), new THREE.IcosahedronGeometry(2.4, 0).translate(-1.8, 6.5, -1.2), new THREE.IcosahedronGeometry(2.2, 0).translate(0.4, 8.8, 0.3)]);
    inst(jt, 0x2e5427, jungle, { flat: true }); addCover(jungle, 0.3);
    const huts = scatter(1200, (x, z, y) => y > 1.8 && y < 4 && R() < 0.06 && inR('trop', x, z));
    inst(new THREE.BoxGeometry(5, 3, 6).translate(0, 1.5, 0), 0x8a7558, huts); addCover(huts, 0.8);
    inst(new THREE.ConeGeometry(4.6, 3, 4).rotateY(Math.PI / 4).translate(0, 4.4, 0), 0x9b8a5e, huts, { flat: true });
  } if (cfg.theme === 'desert' || isMix) {
    const scrub = scatter(5000, (x, z, y) => y > 1.5 && R() < 0.4 && !inZone(x, z, 20) && inR('des', x, z), () => ({ sy: 0.5 }));
    inst(new THREE.IcosahedronGeometry(1.4, 0).translate(0, 0.6, 0), 0x6f6a3e, scrub, { flat: true });
    const rocks = scatter(2500, (x, z, y) => y > 1 && N.fbm(x * 0.004, z * 0.004, 2) > 0.15 && R() < 0.5 && inR('des', x, z), () => ({ sy: 0.55, sx: 1 + Math.random() }));
    inst(new THREE.DodecahedronGeometry(2.2, 0), 0x8c7454, rocks, { flat: true, sink: 0.6 }); addCover(rocks, 0.2);
    // Oasis con palmeras
    const oasis = []; for (let k = 0; k < 3; k++) { const [mox, moz] = isMix ? extra.polar(125 + R() * 60, 900 + R() * 1500) : [0, 0], ox = isMix ? mox : (R() * 2 - 1) * 900 * S, oz = isMix ? moz : (R() * 2 - 1) * 900 * S; for (let q = 0; q < 26; q++) oasis.push({ x: ox + (R() - 0.5) * 90, z: oz + (R() - 0.5) * 90, r: R() * 6, s: 0.8 + R() * 0.4 }); }
    const trunk = new THREE.CylinderGeometry(0.22, 0.38, 9, 6).translate(0, 4.5, 0).rotateZ(0.1);
    const fr = []; for (let k = 0; k < 8; k++) { const f = new THREE.BoxGeometry(0.5, 0.12, 4); f.translate(0, 0, 2); f.rotateX(0.45); f.rotateY(k / 8 * Math.PI * 2); fr.push(f); }
    inst(trunk, 0x7d6a50, oasis); inst(mergeGeometries(fr).translate(0.9, 9, 0), 0x5b7f39, oasis, { flat: true }); addCover(oasis, 0.2);
    // Casas blancas y postes de telégrafo
    const houses = []; for (let k = 0; k < 6; k++) { const [mvx, mvz] = isMix ? extra.polar(120 + R() * 60, 800 + R() * 1500) : [0, 0], vx = isMix ? mvx : (R() * 2 - 1) * 1000 * S, vz = isMix ? mvz : (R() * 2 - 1) * 1000 * S; if (inZone(vx, vz, 120)) continue; for (let q = 0; q < 8; q++) houses.push({ x: vx + (R() - 0.5) * 70, z: vz + (R() - 0.5) * 70, r: R() * 0.3, s: 0.8 + R() * 0.5 }); }
    inst(new THREE.BoxGeometry(8, 4, 8).translate(0, 2, 0), 0xe4d8bf, houses.filter(p => inR('des', p.x, p.z))); addCover(houses.filter(p => inR('des', p.x, p.z)), 1);
  } if (cfg.theme === 'channel' || cfg.theme === 'bocage' || isMix) { // channel / bocage
    const isB = cfg.theme === 'bocage' || isMix;
    const trees = scatter(isB ? 9000 : 6000, (x, z, y) => y > 3 && N.fbm(x * 0.0035, z * 0.0035, 3) > 0.12 && !inZone(x, z, 60) && inR('eur', x, z));
    const tg = mergeGeometries([new THREE.IcosahedronGeometry(3.6, 0).translate(0, 7.5, 0), new THREE.IcosahedronGeometry(2.8, 0).translate(2, 6.6, 1.4), new THREE.IcosahedronGeometry(2.6, 0).translate(-2, 7, -1), new THREE.IcosahedronGeometry(2.4, 0).translate(0.5, 9.4, 0.6)]);
    inst(tg, 0x3b5a2c, trees, { flat: true });
    inst(new THREE.CylinderGeometry(0.3, 0.45, 5, 5).translate(0, 2.5, 0), 0x5a4a38, trees); addCover(trees, 0.2);
    // Setos (bocage) en los bordes de los campos
    const hedges = [], htrees = [];
    if (isB || cfg.gen === 'channelAir' || cfg.gen === 'normandy') {
      // (en el mapa mixto solo en la parte europea)
      const B = cfg.bounds + 250;
      for (let cx = Math.floor(-B / 135); cx <= Math.ceil(B / 135); cx++) for (let cz = Math.floor(-B / 105); cz <= Math.ceil(B / 105); cz++) {
        for (const vert of [0, 1]) {
          if (hash(cx * 3 + 1 + vert * 7, cz) < 0.22) continue;
          const len = vert ? 105 : 135;
          for (let t = 0; t < len; t += 6.5) {
            const wx = vert ? cx * 135 : cx * 135 + t, wz = vert ? cz * 105 + t : cz * 105;
            const x = wx - N.fbm(wx * 0.01, wz * 0.01, 2) * 18, z = wz - N.fbm(wz * 0.01, wx * 0.01, 2) * 18;
            if (Math.abs(x) > B || Math.abs(z) > B || h(x, z) < 2.5 || inZone(x, z, 16) || !inR('eur', x, z)) continue;
            if (R() < 0.07) htrees.push({ x, z, r: R() * 6.28, s: 0.8 + R() * 0.5 });
            else hedges.push({ x, z, r: (vert ? 0 : Math.PI / 2) + (R() - 0.5) * 0.3, s: 0.9 + R() * 0.35, sy: 0.8 + R() * 0.5 });
          }
        }
      }
    }
    inst(tg, 0x34522a, htrees, { flat: true }); addCover(htrees, 0.2);
    inst(new THREE.IcosahedronGeometry(1.7, 0).scale(1.5, 1.2, 2.6).translate(0, 1.5, 0), 0x3a5428, hedges, { flat: true }); addCover(hedges, 0.17);
    // Pueblos normandos
    const houses = [], roofs = [];
    const vill = isMix ? [[55, 1350], [20, 1800], [85, 2000], [100, 900], [345, 1500], [35, 700]].map(([a, r]) => extra.polar(a, r)) : isB ? zones.map(([x, z]) => [x + 70, z + 60]).concat([[-900, -500], [880, 520], [-300, 650], [1300, -900], [-1350, 800]].map(([x, z]) => [x * S, z * S])) : cfg.gen === 'normandy' ? [[zones[1][0] + 60, zones[1][1] + 50], [zones[1][0] - 70, zones[1][1] - 40], [-900 * S, -700 * S], [900 * S, -800 * S]] : [];
    if (!isB) for (let k = 0; k < 10; k++) { const x = (R() * 2 - 1) * 1300 * S, z = (R() * 2 - 1) * 1300 * S; if (h(x, z) > 4) vill.push([x, z]); }
    for (const [vx, vz] of vill) for (let q = 0; q < 12; q++) { const x = vx + (R() - 0.5) * 110, z = vz + (R() - 0.5) * 110; if (h(x, z) < 2 || roadDist(x, z) < 8 || inZone(x, z, 25)) continue; const p = { x, z, r: (R() < 0.5 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.2, s: 0.85 + R() * 0.4 }; houses.push(p); roofs.push(p); }
    inst(new THREE.BoxGeometry(7, 5, 10).translate(0, 2.5, 0), 0xcfc4ad, houses); addCover(houses, 1);
    if (cfg.gen === 'normandy') { // erizos checos en la playa
      const hog = mergeGeometries([new THREE.BoxGeometry(0.35, 0.35, 3.4).rotateX(0.6), new THREE.BoxGeometry(0.35, 0.35, 3.4).rotateX(-0.6).rotateY(Math.PI / 2), new THREE.BoxGeometry(3.4, 0.35, 0.35).rotateZ(0.6)]).translate(0, 1, 0);
      const hogs = scatter(9000, (x, z, y) => y > -1.2 && y < 1.3 && R() < 0.5 && !inZone(x, z, 12), undefined, true);
      inst(hog, 0x3b3833, hogs, { rough: 0.6 });
    }
    inst(new THREE.CylinderGeometry(4.6, 4.6, 10.4, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.75, 1).translate(0, 6.4, 0).rotateY(Math.PI / 2), 0x6b4a3a, roofs, { flat: true });
  }

  // ----- Nubes -----
  const ctex = canvasTex(128, (g, s) => {
    for (let k = 0; k < 18; k++) { const x = s * (0.25 + Math.random() * 0.5), y = s * (0.3 + Math.random() * 0.4), r = s * (0.12 + Math.random() * 0.15); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
  });
  for (let k = 0; k < Math.round(34 * ((cfg.bounds + 600) / 2400) ** 2); k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, opacity: cfg.theme === 'desert' ? 0.35 : 0.7, depthWrite: false, fog: false }));
    sp.scale.set(420 + R() * 380, 240 + R() * 160, 1); sp.position.set((R() * 2 - 1) * (cfg.bounds + 600), 520 + R() * 80, (R() * 2 - 1) * (cfg.bounds + 600));
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
    extra, key: mapKey, cfg, theme: cfg.theme, ext, n, H, h, isLand, isSea, isDeep, bounds: cfg.bounds, zones: zonePts, sitesA, sitesE, roadDist,
    gy: (x, z) => Math.max(h(x, z), 0),
    coverAt: (x, z) => { const k = cellOf(x, z); return k < 0 ? 0 : COVER[k]; },
    coverCell: cellOf,
    region: extra.region || null,
    isDesert: (x, z) => cfg.theme === 'desert' || (cfg.theme === 'mixed' && extra.region(x, z) === 'des'),
    waterMat: wmat, water,
  };
  return G.map;
}

export const worldRefs = () => ({ sky, water, clouds });
export function updateWorld(dt) {
  if (!water) return;
  const u = water.material.uniforms;
  u.t.value += dt;
  u.fogN.value = G.scene.fog.near; u.fogF.value = G.scene.fog.far;
  for (const c of clouds) { c.position.x += 6 * dt; if (c.position.x > 3300) c.position.x = -3300; }
  if (sky && G.camera) sky.position.copy(G.camera.position);
}

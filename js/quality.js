// Calidad gráfica (Baja / Media / Alta) y contador de FPS
import * as THREE from 'three';
import { G } from './state.js';

export const QUALITY = {
  low: { n: 'Baja', shadows: 0, ratio: 1, veg: 0.4, part: 0.5 },
  mid: { n: 'Media', shadows: 1024, ratio: 1.25, veg: 0.7, part: 0.75 },
  high: { n: 'Alta', shadows: 2048, ratio: 1.75, veg: 1, part: 1 },
};
export function applyQuality(level) {
  const Q = QUALITY[level] || QUALITY.high, r = G.renderer, sun = G.sun;
  G.qual = { level, ...Q };
  r.setPixelRatio(Math.min(devicePixelRatio, Q.ratio));
  r.shadowMap.enabled = Q.shadows > 0; r.shadowMap.type = Q.shadows >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  sun.castShadow = Q.shadows > 0;
  if (Q.shadows) { sun.shadow.mapSize.set(Q.shadows, Q.shadows); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  // los materiales deben recompilarse al cambiar las sombras
  G.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  r.setSize(innerWidth, innerHeight, false);
}
// por defecto: baja en móviles y equipos modestos
export function autoQuality() {
  const mobile = matchMedia('(pointer: coarse)').matches, cores = navigator.hardwareConcurrency || 4;
  return mobile ? 'low' : cores <= 4 ? 'mid' : 'high';
}

let fpsEl = null, t0 = 0, n = 0;
export function updateFps(dt) {
  if (!G.opts || !G.opts.fps) { if (fpsEl) fpsEl.style.display = 'none'; return; }
  if (!fpsEl) fpsEl = document.getElementById('fps');
  fpsEl.style.display = 'block'; n++; const now = performance.now(); if (!t0) t0 = now;
  if (now - t0 >= 500) { const f = n * 1000 / (now - t0); fpsEl.textContent = `${f.toFixed(0)} FPS · ${G.qual ? G.qual.n : ''}`; fpsEl.className = f < 25 ? 'bad' : f < 45 ? 'mid' : ''; t0 = now; n = 0; }
}

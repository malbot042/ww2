// Avisos de peligro: flechas en los bordes de la pantalla, dirección del daño, aviso de torpedo
// y marcas de cobertura cercana al dar una orden de mover.
import * as THREE from 'three';
import { G } from './state.js';
import { V3, angDiff, canvasTex } from './util.js';
import { flash } from './hud.js';
import { audio } from './fx.js';
import { coverSpots } from './physics.js';

let cv = null, cx = null, lines = [], spots = [], hurts = [], alarmT = 0;
const tmp = V3();

export function initThreats() {
  if (cv) return;
  cv = document.createElement('canvas'); cv.id = 'thr'; document.body.appendChild(cv);
  cx = cv.getContext('2d');
  // trayectorias de torpedo
  for (let i = 0; i < 6; i++) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xff3b30, dashSize: 9, gapSize: 6, transparent: true, opacity: 0.9, depthTest: false }));
    l.renderOrder = 14; l.frustumCulled = false; l.visible = false; G.scene.add(l); lines.push(l);
  }
  // marcas de cobertura (árbol o casa)
  const icon = house => canvasTex(64, g => {
    g.fillStyle = 'rgba(20,40,16,.55)'; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.fill();
    g.strokeStyle = '#9be07f'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.stroke();
    g.fillStyle = '#9be07f'; g.beginPath();
    if (house) { g.moveTo(14, 32); g.lineTo(32, 16); g.lineTo(50, 32); g.lineTo(45, 32); g.lineTo(45, 48); g.lineTo(19, 48); g.lineTo(19, 32); }
    else { g.moveTo(32, 12); g.lineTo(46, 34); g.lineTo(38, 34); g.lineTo(48, 48); g.lineTo(16, 48); g.lineTo(26, 34); g.lineTo(18, 34); }
    g.closePath(); g.fill();
  });
  const tex = [icon(false), icon(true)];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex[0], depthTest: false, transparent: true }));
    s.userData.tex = tex; s.scale.set(16, 16, 1); s.renderOrder = 14; s.visible = false; G.scene.add(s); spots.push(s);
  }
  addEventListener('resize', size); size();
  // eventos del juego
  G.onCoverSpots = showCoverSpots;
}
function size() { if (!cv) return; cv.width = innerWidth; cv.height = innerHeight; }

// el daño que recibe tu unidad: guarda de dónde vino
export function threatHurt(dir, by) {
  const P = G.player; if (!P) return;
  let src = null;
  if (by && by.p && by !== P) src = by.p.clone();
  else if (dir && (dir.x || dir.z)) src = P.p.clone().addScaledVector(V3(-dir.x, 0, -dir.z).normalize(), 120);
  if (!src) return;
  const h = hurts.find(x => x.src.distanceTo(src) < 30); if (h) { h.t = 1.6; h.src.copy(src); } else hurts.push({ src, t: 1.6 });
  if (hurts.length > 5) hurts.shift();
}

// marcas de cobertura alrededor del destino de una orden de mover
function showCoverSpots(x, z) {
  const list = coverSpots(x, z, 150, spots.length);
  spots.forEach((s, i) => {
    const p = list[i]; s.visible = !!p; if (!p) return;
    s.material.map = s.userData.tex[p.house ? 1 : 0]; s.position.set(p.x, G.map.gy(p.x, p.z) + 9, p.z); s.userData.t = 7; s.material.opacity = 1;
  });
}

function alarm() {
  const { AC, master } = audio(); if (!AC || !master) return;
  const t = AC.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square';
    o.frequency.setValueAtTime(i % 2 ? 660 : 880, t + i * 0.22);
    g.gain.setValueAtTime(0.0001, t + i * 0.22); g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.22 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.18);
    o.connect(g); g.connect(master); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.2);
  }
}

// lado de tu unidad: proa, popa, babor (izquierda) o estribor (derecha)
function sideOf(P, x, z) {
  const a = angDiff(Math.atan2(x - P.p.x, z - P.p.z), P.h);
  return Math.abs(a) < 0.6 ? 'proa' : Math.abs(a) > 2.5 ? 'popa' : a > 0 ? 'babor' : 'estribor';
}

export function updateThreats(dt, camera) {
  if (!cv) return;
  cx.clearRect(0, 0, cv.width, cv.height);
  // marcas de cobertura
  for (const s of spots) if (s.visible) { s.userData.t -= dt; s.material.opacity = Math.min(1, s.userData.t / 1.5); if (s.userData.t <= 0) s.visible = false; }
  const P = G.player;
  lines.forEach(l => l.visible = false);
  if (!G.running || !P || !P.alive || G.strategic || G.demo || G.opts?.threats === false) { hurts.length = 0; return; }
  alarmT -= dt;
  const W = cv.width, H = cv.height, list = [];
  // 1) torpedos que van hacia tu barco
  if (P.dom === 'sea' && !P.submerged) {
    let li = 0;
    for (const q of G.projs) {
      if (q.kind !== 'torp' || q.side === P.side) continue;
      const rx = P.p.x - q.p.x, rz = P.p.z - q.p.z, vv = q.v.x * q.v.x + q.v.z * q.v.z; if (vv < 1) continue;
      const t = (rx * q.v.x + rz * q.v.z) / vv; if (t < 0 || t > Math.min(30, q.life)) continue;
      // distancia de paso, contando que tu barco también se mueve
      const px = P.p.x + P.vel.x * t, pz = P.p.z + P.vel.z * t, mx = q.p.x + q.v.x * t - px, mz = q.p.z + q.v.z * t - pz;
      const miss = Math.hypot(mx, mz), danger = miss < (P.hl || 40) + 25;
      if (!danger && Math.hypot(rx, rz) > 500) continue;
      if (li < lines.length) {
        const l = lines[li++], a = l.geometry.attributes.position.array, run = Math.min(q.life, t + 4);
        a[0] = q.p.x; a[1] = 1.2; a[2] = q.p.z; a[3] = q.p.x + q.v.x * run; a[4] = 1.2; a[5] = q.p.z + q.v.z * run;
        l.geometry.attributes.position.needsUpdate = true; l.computeLineDistances(); l.visible = true;
        l.material.color.setHex(danger ? 0xff3b30 : 0xffa64d);
      }
      if (danger) {
        list.push({ p: q.p, col: '#ff4b3a', txt: `Torpedo ${Math.max(1, Math.round(t))} s`, big: true });
        if (!q.warned) {
          q.warned = true;
          if (alarmT <= 0) { alarm(); alarmT = 2.5; }
          const side = sideOf(P, q.p.x, q.p.z);
          flash(`¡Torpedo por ${side}!`, `Impacto en ${Math.max(1, Math.round(t))} s · gira para ponerte paralelo a su estela (proa o popa hacia él)`, 2.6);
        }
      }
    }
  }
  // 2) enemigos que te apuntan y aviones a tus seis
  for (const o of G.ents) {
    if (!o.alive || o.falling || o.side === P.side || o.cls === 'site') continue;
    if (G.fog && o['vis' + P.side] === false) continue;
    const d = o.p.distanceTo(P.p);
    let six = false;
    if (P.dom === 'air' && o.dom === 'air' && d < 750) {
      const behind = Math.abs(angDiff(Math.atan2(o.p.x - P.p.x, o.p.z - P.p.z), P.h)) > 2.1;
      const towards = Math.abs(angDiff(Math.atan2(P.p.x - o.p.x, P.p.z - o.p.z), o.h)) < 0.5;
      six = behind && towards;
    }
    if (six) list.push({ p: o.p, col: '#ffd23a', txt: `A tus seis · ${Math.round(d)} m`, big: true, onlyOff: false });
    else if (o.target === P && d < 2600) list.push({ p: o.p, col: '#ff6a4d', txt: `${Math.round(d)} m`, onlyOff: true });
  }
  // dibujo: flecha en el borde si está fuera de la pantalla (o siempre, si es «big» y queda detrás)
  const m = 54;
  for (const t of list) {
    tmp.copy(t.p); tmp.project(camera);
    let x = tmp.x, y = tmp.y; const behind = tmp.z > 1;
    if (behind) { x = -x; y = -y; }
    const on = !behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.9;
    if (on && (t.onlyOff !== false)) continue;
    if (on) { // a la vista: marco alrededor
      const sx = (x + 1) / 2 * W, sy = (1 - y) / 2 * H;
      cx.strokeStyle = t.col; cx.lineWidth = 2.5; cx.strokeRect(sx - 18, sy - 18, 36, 36);
      label(t.txt, sx, sy + 34, t.col); continue;
    }
    const ang = Math.atan2(-y, x), cxp = W / 2, cyp = H / 2;
    const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
    const ax = cxp + Math.cos(ang) * k, ay = cyp + Math.sin(ang) * k;
    const s = t.big ? 16 : 12;
    cx.save(); cx.translate(ax, ay); cx.rotate(ang);
    cx.fillStyle = t.col; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(s, 0); cx.lineTo(-s * 0.7, s * 0.75); cx.lineTo(-s * 0.35, 0); cx.lineTo(-s * 0.7, -s * 0.75); cx.closePath(); cx.stroke(); cx.fill();
    cx.restore();
    label(t.txt, ax - Math.cos(ang) * 30, ay - Math.sin(ang) * 22, t.col);
  }
  // 3) dirección del daño: arco rojo alrededor de tu unidad
  if (hurts.length) {
    tmp.copy(P.p); tmp.project(camera);
    const px = (tmp.x + 1) / 2 * W, py = (1 - tmp.y) / 2 * H, R = Math.min(W, H) * 0.12;
    for (let i = hurts.length - 1; i >= 0; i--) {
      const h = hurts[i]; h.t -= dt; if (h.t <= 0) { hurts.splice(i, 1); continue; }
      tmp.copy(h.src); tmp.project(camera);
      let x = tmp.x, y = tmp.y; if (tmp.z > 1) { x = -x; y = -y; }
      const sx = (x + 1) / 2 * W, sy = (1 - y) / 2 * H, a = Math.atan2(sy - py, sx - px), al = Math.min(1, h.t / 0.8);
      cx.strokeStyle = `rgba(255,40,30,${0.85 * al})`; cx.lineWidth = 9; cx.lineCap = 'round';
      cx.beginPath(); cx.arc(px, py, R, a - 0.38, a + 0.38); cx.stroke();
      cx.strokeStyle = `rgba(255,190,170,${0.7 * al})`; cx.lineWidth = 2.5;
      cx.beginPath(); cx.arc(px, py, R + 9, a - 0.2, a + 0.2); cx.stroke();
    }
  }
}
function label(txt, x, y, col) {
  cx.font = '600 14px Barlow, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.lineWidth = 4; cx.strokeStyle = 'rgba(0,0,0,.75)'; cx.strokeText(txt, x, y); cx.fillStyle = col; cx.fillText(txt, x, y);
}
export function clearThreats() { if (cx) cx.clearRect(0, 0, cv.width, cv.height); lines.forEach(l => l.visible = false); spots.forEach(s => s.visible = false); hurts.length = 0; }

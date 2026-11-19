// Controles táctiles: joystick virtual, botones de acción y pellizco para el zoom
import { G } from './state.js';
import { clamp } from './util.js';

const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
const BTN = [
  ['Space', 'Fuego', 'fire'], ['ShiftLeft', 'Secund.', 'sec'], ['KeyT', 'Blanco', ''], ['KeyK', 'Reparar', ''],
  ['Tab', 'Unidad', ''], ['KeyV', 'Vista', ''], ['KeyM', 'Mapa', ''],
];
const ORD = [['Digit1', 'A'], ['Digit2', 'B'], ['Digit3', 'C'], ['KeyQ', 'Sígueme'], ['KeyR', 'Mantener'], ['Enter', 'Táctica'], ['KeyP', 'Ⅱ']];
let root = null, active = false, held = {};
export function initTouch(canvas) {
  root = document.createElement('div'); root.id = 'touch'; root.className = 'hide';
  root.innerHTML = `<div class="joy" id="joy"><div class="knob" id="knob"></div></div>
    <div class="tbtns">${BTN.map(([c, n, k]) => `<button data-c="${c}" class="${k}">${n}</button>`).join('')}</div>
    <div class="tord">${ORD.map(([c, n]) => `<button data-c="${c}">${n}</button>`).join('')}</div>`;
  document.body.appendChild(root);
  // botones: pulsar = tecla abajo, soltar = tecla arriba
  root.querySelectorAll('button[data-c]').forEach(b => {
    const c = b.dataset.c;
    b.addEventListener('touchstart', ev => { ev.preventDefault(); b.classList.add('on'); send('keydown', c); }, { passive: false });
    const up = ev => { ev.preventDefault(); b.classList.remove('on'); send('keyup', c); };
    b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
  });
  // joystick
  const joy = root.querySelector('#joy'), knob = root.querySelector('#knob'); let jid = null, cx = 0, cy = 0;
  const setDir = (dx, dy) => {
    const dz = 0.3, want = { ArrowLeft: dx < -dz, ArrowRight: dx > dz, ArrowUp: dy < -dz, ArrowDown: dy > dz };
    for (const c in want) if (want[c] !== !!held[c]) { held[c] = want[c]; send(want[c] ? 'keydown' : 'keyup', c); }
  };
  joy.addEventListener('touchstart', ev => { ev.preventDefault(); const t = ev.changedTouches[0]; jid = t.identifier; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(t); }, { passive: false });
  const move = t => { const R = joy.clientWidth / 2, dx = clamp((t.clientX - cx) / R, -1, 1), dy = clamp((t.clientY - cy) / R, -1, 1); knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`; setDir(dx, dy); };
  joy.addEventListener('touchmove', ev => { ev.preventDefault(); for (const t of ev.changedTouches) if (t.identifier === jid) move(t); }, { passive: false });
  const end = ev => { for (const t of ev.changedTouches) if (t.identifier === jid) { jid = null; knob.style.transform = ''; setDir(0, 0); } };
  joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
  // sobre el mapa: un dedo gira la cámara, dos dedos pellizcan para el zoom
  let pinch = null, drag = null;
  canvas.addEventListener('touchstart', ev => {
    activate();
    if (ev.touches.length === 2) { const [a, b] = ev.touches; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: G.targetZoom }; drag = null; ev.preventDefault(); }
    else if (ev.touches.length === 1) drag = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, yaw: G.cam.yaw, pitch: G.cam.pitch, moved: false };
  }, { passive: false });
  canvas.addEventListener('touchmove', ev => {
    if (pinch && ev.touches.length === 2) { const [a, b] = ev.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); G.targetZoom = clamp(pinch.z * pinch.d / Math.max(20, d), 110, 3600); ev.preventDefault(); }
    else if (drag && ev.touches.length === 1 && G.running && !G.deploying) {
      const t = ev.touches[0], dx = t.clientX - drag.x, dy = t.clientY - drag.y;
      if (Math.hypot(dx, dy) > 12) drag.moved = true;
      if (drag.moved) { G.cam.yaw = drag.yaw - dx * 0.006; G.cam.pitch = clamp(drag.pitch + dy * 0.004, 0.1, 1.45); ev.preventDefault(); }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', ev => { if (ev.touches.length < 2) pinch = null; if (!ev.touches.length) drag = null; });
  addEventListener('touchstart', activate, { once: true });
}
function activate() { if (active) return; active = true; G.touch = true; document.body.classList.add('touchui'); }
export function updateTouch() { if (root) root.classList.toggle('hide', !active || !G.running || G.paused || !!G.replayCam); }

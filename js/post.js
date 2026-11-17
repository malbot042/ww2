// Render a baja resolución fija + pase final de monitor CRT (sin curvatura)
// La escena se dibuja en un búfer de ~360 líneas y se escala a pantalla con líneas de barrido,
// máscara de rejilla RGB, resplandor, ligera aberración cromática, viñeta y parpadeo.
import * as THREE from 'three';
import { G } from './state.js';

export const LINES = 360; // resolución vertical fija del render
let rt = null, quad = null, pscene = null, pcam = null, mat = null;

export function initPost(renderer) {
  rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  mat = new THREE.ShaderMaterial({
    uniforms: { src: { value: rt.texture }, srcSize: { value: new THREE.Vector2(4, 4) }, crt: { value: 1 }, time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D src; uniform vec2 srcSize; uniform float crt, time; varying vec2 vUv;
      vec3 tap(vec2 uv){ return texture2D(src, uv).rgb; }
      // muestreo "píxel nítido": bordes de píxel duros en vertical, suaves en horizontal
      vec3 pix(vec2 uv){ vec2 p = uv * srcSize; vec2 c = floor(p) + 0.5; vec2 f = p - c; c.x += clamp(f.x * 2.2, -0.5, 0.5); return tap(c / srcSize); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        if (crt < 0.5) { gl_FragColor = vec4(tap((floor(uv * srcSize) + 0.5) / srcSize), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return; }
        vec2 px = 1.0 / srcSize;
        // aberración cromática leve y desenfoque horizontal del haz
        vec3 col;
        col.r = pix(uv + vec2(px.x * 0.35, 0.0)).r;
        col.g = pix(uv).g;
        col.b = pix(uv - vec2(px.x * 0.35, 0.0)).b;
        col = col * 0.7 + (pix(uv + vec2(px.x, 0.0)) + pix(uv - vec2(px.x, 0.0))) * 0.15;
        // resplandor (halo de fósforo)
        vec3 glow = (tap(uv + vec2(px.x * 2.5, 0.0)) + tap(uv - vec2(px.x * 2.5, 0.0)) + tap(uv + vec2(0.0, px.y * 2.0)) + tap(uv - vec2(0.0, px.y * 2.0))) * 0.25;
        col += glow * 0.12;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 c = gl_FragColor.rgb;
        // líneas de barrido: el haz es más ancho en las zonas brillantes
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        float f = fract(uv.y * srcSize.y) - 0.5;
        float w = mix(7.0, 3.2, clamp(l, 0.0, 1.0));
        float scan = exp(-f * f * w * 4.0);
        c *= mix(0.42, 1.0, scan);
        // máscara de rejilla de apertura (franjas RGB verticales por píxel de pantalla)
        float m = mod(floor(gl_FragCoord.x), 3.0);
        vec3 mask = m < 1.0 ? vec3(1.0, 0.72, 0.72) : m < 2.0 ? vec3(0.72, 1.0, 0.72) : vec3(0.72, 0.72, 1.0);
        c *= mask;
        // compensar el brillo perdido, viñeta suave (sin curvatura), parpadeo y grano
        c *= 1.3;
        vec2 d = uv - 0.5; c *= 1.0 - dot(d, d) * 0.55;
        c *= 0.985 + 0.015 * sin(time * 120.0);
        c += (hash(uv * srcSize + time) - 0.5) * 0.025;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  pscene = new THREE.Scene(); pscene.add(quad); pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  resizePost();
}
// tamaño del búfer: siempre ~360 líneas, ancho según la proporción de la ventana
export function resizePost() {
  if (!rt) return;
  const h = Math.min(LINES, innerHeight), w = Math.max(1, Math.round(h * innerWidth / innerHeight));
  rt.setSize(w, h); mat.uniforms.srcSize.value.set(w, h);
}
export const postTarget = () => rt;
// dibuja la escena (o las dos vistas de la pantalla partida) en el búfer y luego el pase final
export function renderPost(renderer, draw) {
  renderer.setRenderTarget(rt); renderer.clear(); draw(rt); renderer.setRenderTarget(null);
  mat.uniforms.crt.value = G.opts && G.opts.crt === false ? 0 : 1;
  mat.uniforms.time.value = performance.now() / 1000;
  renderer.render(pscene, pcam);
}

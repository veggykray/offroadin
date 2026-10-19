import * as THREE from 'three';
import { basaltTexture, contactShadowTexture, copperTexture, furTexture, glowTexture, mossTexture, pavingTexture, porcelainTexture, toonGradient } from './Textures';

export const PALETTE = {
  cyan: new THREE.Color('#5ff2ff'),
  magenta: new THREE.Color('#ff4fd8'),
  amber: new THREE.Color('#ffb24a'),
  skyTop: new THREE.Color('#d8a6e6'),
  skyMid: new THREE.Color('#f5a8b6'),
  skyLow: new THREE.Color('#f6b39b'),
  fog: new THREE.Color('#efa4bc'),
  shadow: new THREE.Color('#4a3a96'),
};

/** Shared material set. Everything in the world uses one of these (plus liquid shaders). */
export class Materials {
  readonly gradient = toonGradient();
  readonly glowTex = glowTexture();
  readonly basalt: THREE.MeshToonMaterial;
  readonly basaltDark: THREE.MeshToonMaterial;
  readonly paving: THREE.MeshToonMaterial;
  readonly porcelain: THREE.MeshToonMaterial;
  readonly porcelainWarm: THREE.MeshToonMaterial;
  readonly copper: THREE.MeshToonMaterial;
  readonly moss: THREE.MeshToonMaterial;
  readonly root: THREE.MeshToonMaterial;
  readonly dogFur: THREE.MeshToonMaterial;
  readonly catBlack: THREE.MeshToonMaterial;
  readonly catWhite: THREE.MeshToonMaterial;
  readonly whiteBody: THREE.MeshToonMaterial;
  readonly dark: THREE.MeshToonMaterial;
  readonly eye: THREE.MeshBasicMaterial;
  readonly plantPink: THREE.MeshToonMaterial;
  readonly plantViolet: THREE.MeshToonMaterial;
  readonly glassReed: THREE.MeshToonMaterial;
  readonly lantern: THREE.MeshBasicMaterial;
  readonly distant: THREE.MeshToonMaterial;
  readonly contact: THREE.MeshBasicMaterial;
  readonly cloud: THREE.MeshBasicMaterial;
  readonly plain: THREE.MeshLambertMaterial;
  readonly plainFloor: THREE.MeshLambertMaterial;
  readonly plainEdge: THREE.LineBasicMaterial;

  constructor() {
    const toon = (opts: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial => new THREE.MeshToonMaterial({ gradientMap: this.gradient, ...opts });
    const basaltTex = basaltTexture();
    this.basalt = toon({ map: basaltTex, color: '#e2d6ea' });
    this.basaltDark = toon({ map: basaltTexture(13), color: '#8d7f9a' });
    this.paving = toon({ map: pavingTexture(), color: '#fff2ec' });
    this.porcelain = toon({ map: porcelainTexture(), color: '#ffffff' });
    this.porcelainWarm = toon({ map: porcelainTexture(6), color: '#d9c9bf' });
    this.copper = toon({ map: copperTexture(), color: '#ffffff' });
    this.moss = toon({ map: mossTexture(), color: '#ffffff' });
    this.root = toon({ color: '#6e5664' });
    this.dogFur = toon({ map: furTexture('#262430', '#4a4658', 21), color: '#ffffff' });
    this.catBlack = toon({ map: furTexture('#1d1b24', '#3a3744', 22), color: '#ffffff' });
    this.catWhite = toon({ map: furTexture('#f2eee8', '#d9d2cc', 23), color: '#ffffff' });
    this.whiteBody = toon({ map: porcelainTexture(8), color: '#fbf7f2' });
    this.dark = toon({ color: '#17121c' });
    this.eye = new THREE.MeshBasicMaterial({ color: '#dffbff' });
    this.plantPink = toon({ color: '#ff6fa8' });
    this.plantViolet = toon({ color: '#8f6ff0' });
    this.glassReed = toon({ color: '#9ad7d0', transparent: true, opacity: 0.85 });
    this.lantern = new THREE.MeshBasicMaterial({ color: '#ffc46a' });
    this.distant = toon({ color: '#4d3f66' });
    this.contact = new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, opacity: 0.3, depthWrite: false });
    this.cloud = new THREE.MeshBasicMaterial({ map: this.glowTex, color: '#f9c2d2', transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    this.plain = new THREE.MeshLambertMaterial({ color: '#9a9aa4' });
    this.plainFloor = new THREE.MeshLambertMaterial({ color: '#c8c8d0' });
    this.plainEdge = new THREE.LineBasicMaterial({ color: '#202030' });
  }
}

/** Unlit flowing-liquid shader: fill along U (or V), scrolling stripes, bright core. */
export function liquidMaterial(color: THREE.Color, opts: { axis?: 'u' | 'v'; flow?: number; opacity?: number; side?: THREE.Side } = {}): THREE.ShaderMaterial {
  const axis = opts.axis ?? 'u';
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: opts.side ?? THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uFill: { value: 0 }, uColor: { value: color.clone() }, uIntensity: { value: 1 },
      uFlow: { value: opts.flow ?? 1 }, uOpacity: { value: opts.opacity ?? 0.92 }, uWidth: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime, uFill, uIntensity, uFlow, uOpacity, uWidth; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float a = ${axis === 'u' ? 'vUv.x' : 'vUv.y'}; float b = ${axis === 'u' ? 'vUv.y' : 'vUv.x'};
        if (a > uFill) discard;
        if (abs(b - 0.5) > uWidth * 0.5) discard;
        b = (b - 0.5) / uWidth + 0.5;
        float front = smoothstep(uFill, uFill - 0.05, a);
        float stripes = 0.5 + 0.5 * sin((a * 22.0 - uTime * 2.4 * uFlow) * 6.2831);
        float ripple = 0.5 + 0.5 * sin(b * 9.0 + uTime * 3.1 + a * 14.0);
        float lum = 0.72 + 0.28 * stripes * ripple;
        float core = 1.0 - smoothstep(0.0, 0.5, abs(b - 0.5));
        vec3 col = uColor * (lum * uIntensity) + uColor * core * 0.45 * uIntensity + vec3(0.35) * core * core * uIntensity * 0.6;
        gl_FragColor = vec4(col, uOpacity * front);
      }`,
  });
}

/** Vertical gradient sky dome (unlit, unfogged). */
export function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: PALETTE.skyTop }, mid: { value: PALETTE.skyMid }, low: { value: PALETTE.skyLow } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, low; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.7, h)) : mix(mid, low, smoothstep(0.0, -0.5, h)); float band = 0.04 * sin(h * 40.0 + vP.x * 0.02); gl_FragColor = vec4(c + band, 1.0); }`,
  });
}

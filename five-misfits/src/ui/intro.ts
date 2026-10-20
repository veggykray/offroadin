import * as THREE from 'three';
import type { SceneRenderer } from '../render/SceneRenderer';
import { Rig } from '../render/Rig';
import { RIGS } from '../art/characters';
import { HERO_ORDER } from '../game/units';
import { makeCanvas, ctx2d, rr } from '../art/paint';
import { Rng } from '../core/rng';

interface Beat { speaker?: string; text: string; caption?: boolean; auto: number; effect?: 'bell' | 'stranger' | 'impact' }
const BEATS: Beat[] = [
  { text: 'The Rusty Lantern. Last Thursday of the month: the card game nobody has missed in eleven years.', caption: true, auto: 5 },
  { speaker: 'Castellan', text: 'Three queens. Pay up, you magnificent frauds.', auto: 4.5 },
  { speaker: 'Brennagh', text: 'You dealt. You always deal when you win.', auto: 4.5 },
  { speaker: 'Orrin', text: '...did anyone else hear a bell?', auto: 4 },
  { speaker: 'Pim', text: "Nobody rang anything. That tower's been a ruin since before any of us were born.", auto: 5 },
  { speaker: 'Vesk', text: "No. He's right. Listen.", auto: 3.5, effect: 'bell' },
  { text: 'A bell tolls from the ruined tower. Outside, the rain stops — mid-fall. Drops hang in the doorway like beads.', caption: true, auto: 6 },
  { speaker: 'Stranger', text: "Oh, gods. You haven't done it yet.", auto: 5, effect: 'stranger' },
  { text: 'Something tears through the tavern wall.', caption: true, auto: 2.5, effect: 'impact' },
];

/**
 * Staged prologue inside the tavern: painted interior, the five regulars at the card table (the
 * same rigs as in play), rain in the doorway that freezes at the bell, the stranger, the impact.
 */
export class Intro {
  active = false; step = 0; timer = 0; time = 0;
  readonly group = new THREE.Group();
  private el = document.getElementById('intro')!;
  private rigs: Rig[] = [];
  private stranger: THREE.Mesh; private rainGeo: THREE.BufferGeometry; private rain: THREE.Points; private flash: THREE.Mesh; private crack: THREE.Mesh;
  private bellAt = -1; private strangerAt = -1; private impactAt = -1;
  private rainBase: Float32Array;
  onDone: () => void = () => {};

  constructor(private r: SceneRenderer) {
    this.group.visible = false;
    // interior backdrop 40 x 22.5 units centred on the level middle
    const c = makeCanvas(1600, 900), g = ctx2d(c); const rng = new Rng(3);
    g.fillStyle = '#2a211c'; g.fillRect(0, 0, 1600, 900);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 12; i++) g.fillRect(0, i * 75, 1600, 6); // ceiling planks
    g.fillStyle = '#4a3a2c'; g.fillRect(0, 780, 1600, 120); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 30; i++) g.fillRect(i * 56, 780, 3, 120);
    // wall texture & plaster
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${60 + rng.range(0, 30)},${45 + rng.range(0, 20)},${35},${rng.range(0.1, 0.3)})`; g.fillRect(rng.range(0, 1600), rng.range(0, 780), rng.range(10, 60), rng.range(4, 14)); }
    g.fillStyle = '#5a3d22'; for (const x of [120, 560, 1000]) g.fillRect(x, 0, 18, 780);
    // doorway (night, rain) on the right
    g.fillStyle = '#0e1320'; rr(g, 1310, 220, 170, 560, 20); g.fill(); g.lineWidth = 10; g.strokeStyle = '#5a3d22'; g.stroke();
    // lantern + glow, shelf with bottles
    const gl = g.createRadialGradient(760, 300, 10, 760, 300, 420); gl.addColorStop(0, 'rgba(255,190,110,0.35)'); gl.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gl; g.fillRect(0, 0, 1600, 900);
    g.fillStyle = '#2a2420'; rr(g, 745, 230, 30, 60, 4); g.fill(); g.fillStyle = '#ffb347'; rr(g, 752, 240, 16, 40, 2); g.fill(); g.fillStyle = '#5a3d22'; g.fillRect(758, 0, 4, 230);
    g.fillStyle = '#5a3d22'; g.fillRect(200, 300, 300, 12); for (let i = 0; i < 6; i++) { g.fillStyle = ['#3a6a4a', '#6a3a2a', '#2a3a6a'][i % 3]; rr(g, 215 + i * 46, 250, 22, 50, 6); g.fill(); }
    // table with cards and coins
    g.fillStyle = '#5a4030'; rr(g, 420, 560, 760, 26, 6); g.fill(); g.fillRect(470, 586, 28, 200); g.fillRect(1100, 586, 28, 200);
    for (let i = 0; i < 9; i++) { g.fillStyle = i === 4 ? '#ffe9a8' : '#f4f0e6'; rr(g, 500 + i * 72, 540, 40, 22, 3); g.fill(); g.lineWidth = 2; g.strokeStyle = '#2a2020'; g.stroke(); g.fillStyle = i % 2 ? '#b8303a' : '#1a1a1a'; g.fillRect(512 + i * 72, 546, 8, 8); }
    g.fillStyle = '#d9b35a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(1000 + (i % 3) * 18, 548 + Math.floor(i / 3) * 6, 9, 0, Math.PI * 2); g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#7a5a1a'; g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(40, 22.5), new THREE.MeshBasicMaterial({ map: tex }));
    bg.position.set(0, 0, -5); this.group.add(bg);
    // rigs around the table: floor at y = -11.25 + 3
    const floorY = -11.25 + 22.5 * (120 / 900);
    const xs = [-14.5, -11.2, -6.5, 7.0, 11.5]; const faces: (1 | -1)[] = [1, 1, 1, -1, -1];
    HERO_ORDER.forEach((k, i) => { const rig = new Rig(RIGS[k]); rig.group.position.set(xs[i], floorY, i * 0.1); rig.group.scale.x = faces[i]; this.group.add(rig.group); this.rigs.push(rig); });
    // stranger silhouette
    const sc = makeCanvas(80, 200), sg = ctx2d(sc); sg.fillStyle = '#0b0d14'; rr(sg, 20, 40, 40, 160, 10); sg.fill(); sg.beginPath(); sg.arc(40, 30, 22, 0, Math.PI * 2); sg.fill(); sg.beginPath(); sg.moveTo(6, 70); sg.lineTo(74, 70); sg.lineTo(66, 170); sg.lineTo(14, 170); sg.closePath(); sg.fill();
    const stex = new THREE.CanvasTexture(sc); this.stranger = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), new THREE.MeshBasicMaterial({ map: stex, transparent: true, depthWrite: false })); this.stranger.renderOrder = 30; this.stranger.visible = false; this.stranger.position.set(16, floorY + 2, 0.5); this.group.add(this.stranger);
    // rain in the doorway
    const n = 90; const pos = new Float32Array(n * 3); const rr2 = new Rng(8);
    for (let i = 0; i < n; i++) { pos[i * 3] = 13.2 + rr2.range(0, 3.6); pos[i * 3 + 1] = rr2.range(-5, 8); pos[i * 3 + 2] = -4; }
    this.rainBase = pos.slice(); this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(this.rainGeo, new THREE.PointsMaterial({ color: 0xa8c0e8, size: 0.12, transparent: true, opacity: 0.8, sizeAttenuation: true, depthWrite: false })); this.group.add(this.rain);
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(40, 22.5), new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); this.flash.position.z = 2; this.flash.renderOrder = 100; this.group.add(this.flash);
    const cc = makeCanvas(400, 900), cg = ctx2d(cc); cg.fillStyle = '#efe4d0'; cg.beginPath(); cg.moveTo(0, 120); cg.lineTo(230, 200); cg.lineTo(150, 380); cg.lineTo(280, 520); cg.lineTo(90, 700); cg.lineTo(0, 800); cg.closePath(); cg.fill();
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(10, 22.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false })); this.crack.renderOrder = 99; this.crack.position.set(-15, 0, 1); this.crack.visible = false; this.group.add(this.crack);
    this.r.scene.add(this.group);
    this.el.addEventListener('click', (ev) => { const t = ev.target as HTMLElement; if (t.closest('.skip')) this.skip(); else this.advance(); });
  }

  start(): void { this.active = true; this.step = 0; this.timer = 0; this.time = 0; this.bellAt = this.strangerAt = this.impactAt = -1; this.el.hidden = false; this.group.visible = true; this.r.world.visible = false; this.applyEffect(); this.renderDialog(); }
  skip(): void { if (!this.active) return; this.active = false; this.el.hidden = true; this.group.visible = false; this.r.world.visible = true; this.onDone(); }
  advance(): void { if (!this.active) return; this.step++; this.timer = 0; if (this.step >= BEATS.length) { this.skip(); return; } this.applyEffect(); this.renderDialog(); }
  private applyEffect(): void { const e = BEATS[this.step].effect; if (e === 'bell') this.bellAt = this.time; if (e === 'stranger') this.strangerAt = this.time; if (e === 'impact') this.impactAt = this.time; }
  private renderDialog(): void {
    const b = BEATS[this.step];
    this.el.innerHTML = `<button class="skip">Skip prologue <kbd>Esc</kbd></button><div class="panel dialog">${b.speaker ? `<div class="speaker">${b.speaker}</div>` : ''}<div class="${b.caption ? 'caption' : ''}">${b.text}</div><div class="controls"><span>${this.step + 1} / ${BEATS.length}</span><span>Click, <kbd>Space</kbd> or <kbd>Enter</kbd> to continue</span></div></div>`;
  }

  /** Advance and render the staged scene (uses the renderer's camera framed on the room). */
  update(dt: number): void {
    if (!this.active) return;
    this.time += dt; this.timer += dt;
    if (this.timer >= BEATS[this.step].auto) this.advance();
    if (!this.active) return;
    const frozen = this.bellAt >= 0;
    const pos = this.rainGeo.getAttribute('position') as THREE.BufferAttribute;
    const t = frozen ? this.bellAt : this.time;
    for (let i = 0; i < pos.count; i++) { const by = this.rainBase[i * 3 + 1]; let y = by - ((t * 9 + i * 0.37) % 13); pos.setY(i, y); }
    pos.needsUpdate = true;
    (this.rain.material as THREE.PointsMaterial).size = frozen ? 0.16 : 0.1;
    this.rigs.forEach((rig, i) => rig.update({ kind: rig.spec.kind, facing: i < 3 ? 1 : -1, walkPhase: 0, moving: false, grounded: true, swing: 0, swingDur: 0, aimAngle: null, aimArm: 'front', hitFlash: 0, alive: true, time: this.time + i, x: rig.group.position.x, y: rig.group.position.y, spearHeld: true, groundAt: () => rig.group.position.y }, dt));
    if (this.strangerAt >= 0) { const k = Math.min(1, (this.time - this.strangerAt) / 2.2); this.stranger.visible = true; this.stranger.position.x = 16 - k * 4.2 + Math.sin(k * 12) * 0.25 * (1 - k); }
    if (this.impactAt >= 0) { const k = Math.min(1, (this.time - this.impactAt) / 0.5); (this.flash.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9; this.crack.visible = true; this.crack.scale.x = k; this.group.position.x = (Math.random() - 0.5) * (1 - k) * 0.8; this.group.position.y = (Math.random() - 0.5) * (1 - k) * 0.8; }
    // camera: frame the room
    const r = this.r; const zoom = Math.min(r.vw / 40, r.vh / 22.5);
    r.camera.left = -r.vw / (2 * zoom); r.camera.right = r.vw / (2 * zoom); r.camera.top = r.vh / (2 * zoom); r.camera.bottom = -r.vh / (2 * zoom);
    r.camera.position.x = 0; r.camera.position.y = 0; r.camera.updateProjectionMatrix();
    r.renderer.render(r.scene, r.camera);
  }
}

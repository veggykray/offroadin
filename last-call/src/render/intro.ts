import type { Game } from '../game/game';
import type { Camera } from './camera';
import { drawByKind } from './renderer';
import { HERO_ORDER, makeUnit } from '../game/units';

interface Beat { speaker?: string; text: string; caption?: boolean; auto: number; effect?: 'bell' | 'stranger' | 'impact' }

const BEATS: Beat[] = [
  { text: 'The Rusty Lantern. Last Thursday of the month: the card game nobody has missed in eleven years.', caption: true, auto: 5 },
  { speaker: 'Castellan', text: 'Three queens. Pay up, you magnificent frauds.', auto: 4.5 },
  { speaker: 'Brennagh', text: 'You dealt. You always deal when you win.', auto: 4.5 },
  { speaker: 'Orrin', text: '...did anyone else hear a bell?', auto: 4 },
  { speaker: 'Pim', text: "Nobody rang anything. That tower's been a ruin since before any of us were born.", auto: 5 },
  { speaker: 'Vesk', text: 'No. He\'s right. Listen.', auto: 3.5, effect: 'bell' },
  { text: 'A bell tolls from the ruined tower. Outside, the rain stops — mid-fall. Drops hang in the doorway like beads.', caption: true, auto: 6 },
  { speaker: 'Stranger', text: 'Oh, gods. You haven\'t done it yet.', auto: 5, effect: 'stranger' },
  { text: 'Something tears through the tavern wall.', caption: true, auto: 2.5, effect: 'impact' },
];

/** Short, skippable prologue: silhouette staging on the canvas, dialogue in a DOM box. */
export class Intro {
  active = false;
  step = 0;
  timer = 0;
  time = 0;
  private el = document.getElementById('intro')!;
  private units = HERO_ORDER.map((k, i) => makeUnit(k, 0, 0));
  private shake = 0;
  onDone: () => void = () => {};
  private bellAt = -1; private strangerAt = -1; private impactAt = -1;

  constructor() {
    this.el.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('.skip')) this.skip(); else this.advance();
    });
  }

  start(): void { this.active = true; this.step = 0; this.timer = 0; this.time = 0; this.bellAt = this.strangerAt = this.impactAt = -1; this.el.hidden = false; this.applyEffect(); this.renderDialog(); }
  skip(): void { if (!this.active) return; this.active = false; this.el.hidden = true; this.onDone(); }
  advance(): void {
    if (!this.active) return;
    this.step++; this.timer = 0;
    if (this.step >= BEATS.length) { this.skip(); return; }
    this.applyEffect(); this.renderDialog();
  }
  private applyEffect(): void {
    const e = BEATS[this.step].effect;
    if (e === 'bell') this.bellAt = this.time;
    if (e === 'stranger') this.strangerAt = this.time;
    if (e === 'impact') { this.impactAt = this.time; this.shake = 1; }
  }
  private renderDialog(): void {
    const b = BEATS[this.step];
    this.el.innerHTML = `<button class="skip">Skip prologue <kbd>Esc</kbd></button>
      <div class="panel dialog">${b.speaker ? `<div class="speaker">${b.speaker}</div>` : ''}<div class="${b.caption ? 'caption' : ''}">${b.text}</div>
      <div class="controls"><span>${this.step + 1} / ${BEATS.length}</span><span>Click, <kbd>Space</kbd> or <kbd>Enter</kbd> to continue</span></div></div>`;
  }
  update(dt: number): void {
    if (!this.active) return;
    this.time += dt; this.timer += dt; this.shake = Math.max(0, this.shake - dt * 1.5);
    if (this.timer >= BEATS[this.step].auto) this.advance();
  }

  render(ctx: CanvasRenderingContext2D, cam: Camera, _g: Game): void {
    const W = cam.vw, H = cam.vh;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    // Scene in world units: a 40 x 22.5 room, floor at y=3.
    const zoom = Math.min(W / 40, H / 22.5);
    const sx = (Math.random() - 0.5) * this.shake * 18, sy = (Math.random() - 0.5) * this.shake * 18;
    ctx.setTransform(zoom, 0, 0, -zoom, W / 2 - 20 * zoom + sx, H / 2 + 11.25 * zoom + sy);
    const frozen = this.bellAt >= 0;
    // walls, floor, window, door
    ctx.fillStyle = '#2a2320'; ctx.fillRect(0, 0, 40, 22.5);
    ctx.fillStyle = '#4a3b2e'; ctx.fillRect(0, 0, 40, 3);
    ctx.fillStyle = '#1a1f2e'; ctx.fillRect(33, 3, 4, 12);                               // open doorway
    ctx.fillStyle = `rgba(255,190,110,${0.5 + 0.1 * Math.sin(this.time * 5)})`; ctx.fillRect(19, 15, 1.2, 1.2); // lantern
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(19.6, 16.2); ctx.lineTo(19.6, 22.5); ctx.stroke();
    // rain outside the doorway (freezes after the bell)
    ctx.strokeStyle = 'rgba(160,190,230,0.6)'; ctx.lineWidth = 0.06;
    for (let i = 0; i < 26; i++) {
      const x = 33.3 + ((i * 37) % 34) / 10;
      const phase = frozen ? (this.bellAt * 9 + i * 1.7) : (this.time * 9 + i * 1.7);
      const y = 15 - ((phase % 12) + 0);
      if (y > 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + (frozen ? 0.25 : 0.9)); ctx.stroke(); if (frozen) { ctx.fillStyle = 'rgba(200,220,255,0.8)'; ctx.beginPath(); ctx.arc(x, y, 0.09, 0, Math.PI * 2); ctx.fill(); } }
    }
    // table and cards
    ctx.fillStyle = '#5a4030'; ctx.fillRect(9, 5.6, 16, 0.5); ctx.fillRect(10, 3, 0.6, 2.6); ctx.fillRect(23.4, 3, 0.6, 2.6);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i === 4 ? '#ffe9a8' : '#f4f0e6'; ctx.fillRect(11 + i * 1.5, 6.1, 0.9, 0.08 + 0.5 * (i % 3 === 1 ? 1 : 0.3)); }
    ctx.fillStyle = '#c9a24a'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(21 + (i % 3) * 0.5, 6.4 + Math.floor(i / 3) * 0.3, 0.2, 0, Math.PI * 2); ctx.fill(); }
    // five regulars around the table (silhouettes; same shapes as in play)
    const xs = [6.5, 9.2, 13.5, 26.5, 29.5];
    const faces: (1 | -1)[] = [1, 1, 1, -1, -1];
    this.units.forEach((u, i) => {
      u.facing = faces[i]; u.anim.walkPhase = 0.6;
      ctx.save(); ctx.translate(xs[i], 3); ctx.scale(u.facing, 1);
      if (frozen && this.impactAt < 0 && i === 4) ctx.translate(0, 0.08 * Math.sin(this.time * 7)); // Vesk's ears twitch (whole body nudge)
      drawByKind(ctx, u.kind, u, this.time);
      ctx.restore();
    });
    // the stranger staggers in from the doorway
    if (this.strangerAt >= 0) {
      const k = Math.min(1, (this.time - this.strangerAt) / 2.2);
      const x = 36 - k * 4 + Math.sin(k * 12) * 0.25 * (1 - k);
      ctx.save(); ctx.translate(x, 3); ctx.scale(-1, 1);
      ctx.fillStyle = '#101218'; ctx.fillRect(-0.5, 0, 1, 2.8); ctx.beginPath(); ctx.arc(0, 3.1, 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-0.9, 0.5, 1.8, 1.6); // ragged cloak
      ctx.restore();
    }
    // impact: the wall tears open
    if (this.impactAt >= 0) {
      const k = Math.min(1, (this.time - this.impactAt) / 0.4);
      ctx.fillStyle = '#e8d8c0'; ctx.globalAlpha = 0.9 * k;
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(7 * k, 5); ctx.lineTo(5 * k, 9); ctx.lineTo(8 * k, 12); ctx.lineTo(3 * k, 15); ctx.lineTo(0, 17); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(255,220,160,${(1 - k) * 0.8})`; ctx.fillRect(0, 0, 40, 22.5);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.textAlign = 'left';
    ctx.fillText('PROLOGUE — greybox staging', 14, H - 14);
  }
}

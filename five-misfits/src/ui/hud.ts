import type { Game } from '../game/game';
import { HERO_ORDER, type Unit } from '../game/units';
import { RIGS } from '../art/characters';
import { PPU } from '../art/characters';
import { makeCanvas, ctx2d } from '../art/paint';

export interface HudState { debug: boolean; help: boolean; shake: boolean; muted: boolean; fps: number }
export type HudAction = 'select' | 'basic' | 'signature' | 'cancel' | 'endTurn' | 'restart' | 'help' | 'debug' | 'shake' | 'mute' | 'overview' | 'center';

/** Portrait: the rig's head part painted into a small square. */
function portrait(kind: string): HTMLCanvasElement {
  const spec = RIGS[kind]; const head = spec.parts.find((p) => p.id === 'head')!;
  const c = makeCanvas(128, 128), g = ctx2d(c);
  const W = head.w * PPU, H = head.h * PPU; const s = 100 / Math.max(W, H);
  g.translate(64 - W * s / 2, 70 - H * s / 2); g.scale(s, s); head.paint(g, W, H);
  return c;
}
function icon(kind: 'basic' | 'signature' | 'cancel' | 'end', unitKind?: string): HTMLCanvasElement {
  const c = makeCanvas(80, 80), g = ctx2d(c); g.lineWidth = 6; g.strokeStyle = '#e8c66a'; g.fillStyle = '#e8c66a'; g.lineCap = 'round';
  const cx = 40, cy = 40;
  if (kind === 'basic') { g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx - 32, cy); g.lineTo(cx - 12, cy); g.moveTo(cx + 12, cy); g.lineTo(cx + 32, cy); g.moveTo(cx, cy - 32); g.lineTo(cx, cy - 12); g.moveTo(cx, cy + 12); g.lineTo(cx, cy + 32); g.stroke(); g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'cancel') { g.beginPath(); g.moveTo(16, 16); g.lineTo(64, 64); g.moveTo(64, 16); g.lineTo(16, 64); g.stroke(); }
  else if (kind === 'end') { g.beginPath(); g.moveTo(20, 14); g.lineTo(62, 40); g.lineTo(20, 66); g.closePath(); g.fill(); g.fillRect(60, 14, 8, 52); }
  else {
    switch (unitKind) {
      case 'beast': g.beginPath(); g.moveTo(6, 50); g.lineTo(30, 30); g.lineTo(50, 40); g.lineTo(74, 28); g.lineTo(66, 48); g.lineTo(40, 58); g.closePath(); g.fill(); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(26 + i * 10, 34 - i); g.lineTo(30 + i * 10, 20 - i * 2); g.lineTo(36 + i * 10, 34 - i); g.fill(); } break;
      case 'giant': g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx - 14, cy); g.lineTo(cx + 22, cy); g.lineTo(cx + 12, cy - 10); g.moveTo(cx + 22, cy); g.lineTo(cx + 12, cy + 10); g.stroke(); break;
      case 'inventor': g.beginPath(); g.arc(cx - 8, cy + 8, 14, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(cx - 8, cy + 8); g.lineTo(cx + 30, cy - 22); g.lineWidth = 12; g.stroke(); break;
      case 'spear': g.beginPath(); g.moveTo(14, 66); g.lineTo(60, 20); g.stroke(); g.beginPath(); g.moveTo(60, 20); g.lineTo(70, 8); g.lineTo(72, 24); g.lineTo(56, 26); g.closePath(); g.fill(); break;
      case 'duelist': g.beginPath(); g.moveTo(12, 68); g.lineTo(60, 20); g.stroke(); g.beginPath(); g.arc(28, 50, 12, Math.PI * 0.8, Math.PI * 2.1); g.stroke(); g.fillRect(50, 44, 22, 8); g.fillRect(50, 44, 8, 20); break;
      default: g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.stroke();
    }
  }
  return c;
}

/** DOM overlay styled like the approved HUD mock: portrait row with pips, ability panel, action label. */
export class Hud {
  private squad = document.getElementById('squad')!;
  private topbar = document.getElementById('topbar')!;
  private log = document.getElementById('log')!;
  private actionbar = document.getElementById('actionbar')!;
  private actionlabel = document.getElementById('actionlabel')!;
  private debug = document.getElementById('debug')!;
  private help = document.getElementById('help')!;
  private overlay = document.getElementById('overlay')!;
  private sig: Record<string, string> = {};
  private portraits = new Map<string, string>();
  private icons = new Map<string, string>();
  onAction: (a: HudAction, arg?: number) => void = () => {};

  constructor() {
    this.help.innerHTML = HELP_HTML; this.help.className = 'panel';
    for (const k of Object.keys(RIGS)) if (k !== 'jackal') this.portraits.set(k, portrait(k).toDataURL());
    for (const k of ['beast', 'giant', 'inventor', 'spear', 'duelist']) this.icons.set(`sig/${k}`, icon('signature', k).toDataURL());
    this.icons.set('basic', icon('basic').toDataURL()); this.icons.set('cancel', icon('cancel').toDataURL()); this.icons.set('end', icon('end').toDataURL());
    for (const el of [this.squad, this.topbar, this.actionbar, this.overlay, this.help, this.actionlabel]) {
      el.addEventListener('click', (ev) => {
        const t = (ev.target as HTMLElement).closest('[data-action]') as HTMLElement | null; if (!t) return;
        this.onAction(t.dataset.action as HudAction, t.dataset.arg !== undefined ? Number(t.dataset.arg) : undefined);
      });
    }
  }
  private set(el: HTMLElement, key: string, html: string): void { if (this.sig[key] === html) return; this.sig[key] = html; el.innerHTML = html; }

  private pips(u: Unit): string { const n = Math.ceil((u.hp / u.maxHp) * 5 - 1e-6); let s = ''; for (let i = 0; i < 5; i++) s += `<span class="pip ${i < n ? 'on' : ''}"></span>`; return s; }

  update(g: Game, s: HudState): void {
    let cards = '';
    HERO_ORDER.forEach((kind, i) => {
      const u = g.hero(kind)!;
      cards += `<div class="card${u.id === g.selectedId ? ' selected' : ''}${u.alive ? '' : ' down'}" data-action="select" data-arg="${u.id}" title="${u.def.title} · HP ${u.hp}/${u.maxHp}">
        <img src="${this.portraits.get(kind)}" width="64" height="64" style="border-radius:4px;border:1px solid rgba(0,0,0,.6);background:radial-gradient(circle at 50% 35%,#4a3a52,#1a1420)" draggable="false">
        <div class="nm">${i + 1} ${u.def.name}</div><div class="pips">${this.pips(u)}</div>
        <div class="st"><span class="${u.moveLeft > 0 && u.alive ? 'on' : ''}" title="movement">MOVE</span><span class="${!u.acted && u.alive ? 'on' : ''}" title="action">ACT</span></div></div>`;
    });
    cards += `<div class="sep">▶</div>`;
    for (const e of g.enemies) cards += `<div class="card enemy${e.alive ? '' : ' down'}" title="${e.def.title}"><img src="${this.portraits.get(e.kind)}" width="50" height="50" style="border-radius:4px;border:1px solid rgba(0,0,0,.6);background:radial-gradient(circle at 50% 35%,#3a1a1a,#140a0a)" draggable="false"><div class="pips">${this.pips(e)}</div></div>`;
    this.set(this.squad, 'squad', cards);

    const phaseLabel = g.phase === 'player' ? `Squad phase · turn ${g.turn}` : g.phase === 'enemy' ? `Enemy phase · turn ${g.turn}` : g.phase;
    this.set(this.topbar, 'top', `<div class="panel" style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
      <span class="phase ${g.phase}">${phaseLabel}</span><div class="objective">${g.objective()}</div>
      <div class="row"><button data-action="help" class="${s.help ? 'active' : ''}">Help <kbd>H</kbd></button><button data-action="overview">Overview <kbd>Z</kbd></button><button data-action="center">Center <kbd>C</kbd></button><button data-action="debug" class="${s.debug ? 'active' : ''}">Debug <kbd>F3</kbd></button><button data-action="shake" class="${s.shake ? 'active' : ''}">Shake <kbd>K</kbd></button><button data-action="mute" class="${s.muted ? '' : 'active'}">Sound <kbd>M</kbd></button><button data-action="restart">Restart <kbd>R</kbd></button></div></div>`);

    this.set(this.log, 'log', g.messages.slice(-3).map((m) => `<div class="msg ${m.kind}">${m.text}</div>`).join(''));

    const u = g.selected;
    let bar = '', label = '';
    if (u && g.phase === 'player') {
      const basic = g.ability(u, 'basic')!, sigAb = g.ability(u, 'signature')!;
      const busy = g.isBusy(); const canB = basic.canUse(g, u), canS = sigAb.canUse(g, u); const pv = g.preview;
      const hint = g.mode === 'none'
        ? `<kbd>A</kbd><kbd>D</kbd> move · <kbd>W</kbd> jump · <kbd>Q</kbd> basic · <kbd>E</kbd> signature · <kbd>T</kbd> end turn · wheel zoom · right-drag pan`
        : g.ability(u, g.mode)!.mode === 'aim' ? `Mouse aims (angle + power), <kbd>↑↓←→</kbd> fine-tune · click / <kbd>Enter</kbd> fire · <kbd>Esc</kbd> cancel`
        : g.ability(u, g.mode)!.mode === 'target' ? `Hover an enemy (<kbd>Tab</kbd> cycles) · click / <kbd>Enter</kbd> commit · <kbd>Esc</kbd> cancel`
        : `Point the mouse left or right of ${u.def.name} · click / <kbd>Enter</kbd> commit · <kbd>Esc</kbd> cancel`;
      bar = `<div class="panel"><div class="title">${u.def.title}<span class="sub">${u.def.name} · move ${u.moveLeft.toFixed(0)}/${u.def.moveBudget} · ${u.acted ? 'acted' : 'action ready'}</span></div>
        <div class="abil">
          <button data-action="basic" class="${g.mode === 'basic' ? 'active' : ''}" ${u.acted || busy || !canB.ok ? 'disabled' : ''} title="${basic.blurb}"><img src="${this.icons.get('basic')}" width="40" height="40" draggable="false">${basic.name}<kbd>Q</kbd></button>
          <button data-action="signature" class="${g.mode === 'signature' ? 'active' : ''}" ${u.acted || busy || !canS.ok ? 'disabled' : ''} title="${canS.ok ? sigAb.blurb : canS.reason}"><img src="${this.icons.get(`sig/${u.kind}`)}" width="40" height="40" draggable="false">${sigAb.name}<kbd>E</kbd></button>
          <button data-action="cancel" ${g.mode === 'none' ? 'disabled' : ''}><img src="${this.icons.get('cancel')}" width="40" height="40" draggable="false">Cancel<kbd>Esc</kbd></button>
          <button data-action="endTurn" class="primary" ${busy ? 'disabled' : ''}><img src="${this.icons.get('end')}" width="40" height="40" draggable="false">End Turn<kbd>T</kbd></button>
        </div><div class="hint">${busy ? 'Resolving…' : hint}<br><span class="small">${u.def.moveNote}</span></div></div>`;
      const text = pv ? (pv.ok ? pv.label ?? '' : pv.reason ?? '') : (!canS.ok ? canS.reason ?? '' : '');
      if (text) label = `<div class="lbl ${pv && !pv.ok ? 'bad' : ''}">${text}</div>`;
      else if (g.mode === 'none') label = `<div class="panel stats"><span>HP ${u.hp}/${u.maxHp}</span><span>Basic: ${basic.name}</span><span>Signature: ${sigAb.name}</span></div>`;
    } else if (g.phase === 'enemy') bar = `<div class="panel"><div class="title">Enemy phase<span class="sub">raiders act one at a time</span></div></div>`;
    this.set(this.actionbar, 'bar', bar); this.set(this.actionlabel, 'label', label);

    this.debug.hidden = !s.debug;
    if (s.debug) {
      const sel = g.selected;
      this.set(this.debug, 'debug', [
        `FPS ${s.fps.toFixed(0)}  frame ${g.frame}  t ${g.time.toFixed(1)}s  seed ${g.seed}`,
        `phase ${g.phase}  turn ${g.turn}  busy ${g.isBusy()}  mode ${g.mode}`,
        sel ? `active ${sel.def.name}#${sel.id}  x ${sel.body.x.toFixed(2)} y ${sel.body.y.toFixed(2)}  grounded ${sel.body.grounded}  v(${sel.body.vx.toFixed(1)},${sel.body.vy.toFixed(1)})` : 'active -',
        `projectiles ${g.projectiles.length}  fx ${g.fx.length}  shots ${g.stats.shots}  explosions ${g.stats.explosions}`,
        `terrain ${g.terrain.cols}x${g.terrain.rows}  version ${g.terrain.version}  removed ${g.terrain.removedCells}  stable ${g.terrain.countMat(1)} soil ${g.terrain.countMat(2)} timber ${g.terrain.countMat(3)}`,
        `spear ${g.spear.state} @ ${g.spear.body.x.toFixed(1)},${g.spear.body.y.toFixed(1)}  jackal ${g.jackal.state} @ ${g.jackal.body.x.toFixed(1)},${g.jackal.body.y.toFixed(1)}`,
        `enemies: ${g.enemies.map((e) => `${e.def.name}#${e.id} hp${e.hp} ${e.alive ? e.intent || 'idle' : 'down'}`).join(' | ')}`,
      ].join('\n')); this.debug.className = 'panel';
    }
    this.help.hidden = !s.help;
    if (g.phase === 'victory' || g.phase === 'defeat') {
      this.overlay.hidden = false; const win = g.phase === 'victory';
      this.set(this.overlay, 'overlay', `<div class="panel box"><h1>${win ? 'The crossing is yours' : 'The five are down'}</h1><p>${win ? `The village outskirts are clear after ${g.turn} squad turn${g.turn === 1 ? '' : 's'}. Whatever rang that bell is still out there.` : 'Everyone is down for this mission. Try a different mix: break the timber, blow the barrel, use the riverbed.'}</p><button class="primary" data-action="restart">Restart mission <kbd>R</kbd></button></div>`);
    } else this.overlay.hidden = true;
  }
}

const HELP_HTML = `<h2>Five Misfits — controls</h2>
<h3>Squad phase</h3><table>
<tr><td><kbd>1</kbd>–<kbd>5</kbd> / click hero</td><td>Select Orrin, Brennagh, Pim, Vesk or Castellan</td></tr>
<tr><td><kbd>A</kbd> <kbd>D</kbd></td><td>Walk (spends the hero's movement budget)</td></tr>
<tr><td><kbd>W</kbd> / <kbd>Space</kbd></td><td>Jump — Pim's six-legged walker cannot; it climbs 2-unit ledges and steps over small gaps</td></tr>
<tr><td><kbd>Q</kbd> / <kbd>E</kbd></td><td>Basic attack / signature ability mode</td></tr>
<tr><td>Mouse</td><td>Aim: angle and power from the cursor. Target abilities: hover an enemy. Direction abilities: cursor side</td></tr>
<tr><td><kbd>↑↓←→</kbd></td><td>Fine-tune angle / power while aiming; pan the camera otherwise</td></tr>
<tr><td><kbd>Tab</kbd></td><td>Cycle targets</td></tr>
<tr><td>Click / <kbd>Enter</kbd></td><td>Commit (fire, charge, send the jackal, show off)</td></tr>
<tr><td><kbd>Esc</kbd> / right-click</td><td>Cancel — nothing is spent</td></tr>
<tr><td><kbd>T</kbd></td><td>End squad turn → the raiders act once each</td></tr></table>
<h3>Camera &amp; misc</h3><table>
<tr><td>Wheel / right-drag</td><td>Zoom around the cursor / pan (default shows the whole battlefield)</td></tr>
<tr><td><kbd>Z</kbd> / <kbd>C</kbd></td><td>Overview / center on the selected hero</td></tr>
<tr><td><kbd>H</kbd> <kbd>F3</kbd> <kbd>K</kbd> <kbd>M</kbd></td><td>Help · debug overlay · camera shake · sound</td></tr>
<tr><td><kbd>R</kbd> (twice)</td><td>Restart the mission (skips the prologue)</td></tr></table>
<h3>Rules</h3><p class="small">Every surviving hero may move and take one action per squad turn, in any order. Heroes at 0 HP are out for the mission. Win: defeat the three raiders and stand a hero at the shrine on the far right. Soil and timber break; grey stone never does. Vesk has one spear: throw it, then walk over it to pick it up.</p><p class="small">Press <kbd>H</kbd> or click outside to close.</p>`;

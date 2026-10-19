import type { Game } from '../game/game';
import { HERO_ORDER } from '../game/units';

export interface HudState { debug: boolean; help: boolean; shake: boolean; muted: boolean; fps: number }
export type HudAction = 'select' | 'basic' | 'signature' | 'cancel' | 'endTurn' | 'restart' | 'help' | 'debug' | 'shake' | 'mute' | 'overview' | 'center';

/** DOM overlay. Rebuilds only when its text signature changes, so it is cheap per frame. */
export class Hud {
  private squad = document.getElementById('squad')!;
  private topbar = document.getElementById('topbar')!;
  private log = document.getElementById('log')!;
  private actionbar = document.getElementById('actionbar')!;
  private debug = document.getElementById('debug')!;
  private help = document.getElementById('help')!;
  private overlay = document.getElementById('overlay')!;
  private sig: Record<string, string> = {};
  onAction: (a: HudAction, arg?: number) => void = () => {};

  constructor() {
    this.help.innerHTML = HELP_HTML;
    this.help.className = 'panel';
    for (const el of [this.squad, this.topbar, this.actionbar, this.overlay, this.help]) {
      el.addEventListener('click', (ev) => {
        const t = (ev.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
        if (!t) return;
        const arg = t.dataset.arg !== undefined ? Number(t.dataset.arg) : undefined;
        this.onAction(t.dataset.action as HudAction, arg);
      });
    }
  }

  private set(el: HTMLElement, key: string, html: string): void {
    if (this.sig[key] === html) return;
    this.sig[key] = html; el.innerHTML = html;
  }

  update(g: Game, s: HudState): void {
    // Squad cards
    let cards = '';
    HERO_ORDER.forEach((kind, i) => {
      const u = g.hero(kind)!;
      const cls = `card${u.id === g.selectedId ? ' selected' : ''}${u.alive ? '' : ' down'}`;
      const hp = Math.round((u.hp / u.maxHp) * 100);
      cards += `<div class="${cls}" data-action="select" data-arg="${u.id}">
        <span class="num">${i + 1}</span><span class="name">${u.def.name}</span>
        <span class="pips"><span class="pip move ${u.moveLeft > 0 && u.alive ? 'on' : ''}" title="Movement left: ${u.moveLeft.toFixed(1)}">M</span><span class="pip act ${!u.acted && u.alive ? 'on' : ''}" title="Action available">A</span></span>
        <span class="title">${u.def.title}${u.alive ? ` · HP ${u.hp}/${u.maxHp}` : ' · DOWN'}</span>
        <div class="hp"><div style="width:${hp}%"></div></div></div>`;
    });
    this.set(this.squad, 'squad', cards);

    // Top bar
    const phaseLabel = g.phase === 'player' ? `SQUAD PHASE — turn ${g.turn}` : g.phase === 'enemy' ? `ENEMY PHASE — turn ${g.turn}` : g.phase.toUpperCase();
    const top = `<div class="panel">
      <div class="row"><span class="phase ${g.phase}">${phaseLabel}</span><span style="flex:1"></span><span class="small">Raiders left: ${g.livingEnemies().length}</span></div>
      <div class="objective">${g.objective()}</div>
      <div class="row" style="margin-top:6px">
        <button data-action="help" class="${s.help ? 'active' : ''}">Help <kbd>H</kbd></button>
        <button data-action="overview">Overview <kbd>Z</kbd></button>
        <button data-action="center">Center <kbd>C</kbd></button>
        <button data-action="debug" class="${s.debug ? 'active' : ''}">Debug <kbd>F3</kbd></button>
        <button data-action="shake" class="${s.shake ? 'active' : ''}" title="Camera shake (reduce motion: off)">Shake <kbd>K</kbd></button>
        <button data-action="mute" class="${s.muted ? '' : 'active'}">Sound <kbd>M</kbd></button>
        <button data-action="restart">Restart <kbd>R</kbd></button>
      </div></div>`;
    this.set(this.topbar, 'top', top);

    // Log (last 5)
    const msgs = g.messages.slice(-5).map((m) => `<div class="msg ${m.kind}">${m.text}</div>`).join('');
    this.set(this.log, 'log', msgs);

    // Action bar
    const u = g.selected;
    let bar = '';
    if (u && g.phase === 'player') {
      const basic = g.ability(u, 'basic')!, sig = g.ability(u, 'signature')!;
      const busy = g.isBusy();
      const canBasic = basic.canUse(g, u), canSig = sig.canUse(g, u);
      const pv = g.preview;
      const modeHint = g.mode === 'none'
        ? `<kbd>A</kbd>/<kbd>D</kbd> move · <kbd>W</kbd> jump · <kbd>Q</kbd> basic · <kbd>E</kbd> signature · <kbd>T</kbd> end squad turn · wheel zoom · right-drag pan`
        : g.ability(u, g.mode)!.mode === 'aim'
          ? `Move the mouse to aim (angle + power), <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> fine-tune · click or <kbd>Enter</kbd> to fire · <kbd>Esc</kbd> cancel`
          : g.ability(u, g.mode)!.mode === 'target'
            ? `Hover an enemy (or <kbd>Tab</kbd> to cycle) · click or <kbd>Enter</kbd> to commit · <kbd>Esc</kbd> cancel`
            : `Point the mouse left or right of ${u.def.name} to choose the direction · click or <kbd>Enter</kbd> to commit · <kbd>Esc</kbd> cancel`;
      bar = `<div class="panel" style="width:100%">
        <div class="row"><span class="hero">${u.def.name}</span><span class="small">${u.def.title} · move ${u.moveLeft.toFixed(1)}/${u.def.moveBudget} · ${u.acted ? 'action spent' : 'action ready'}</span></div>
        <div class="small" style="text-align:center;margin:2px 0 6px">${u.def.moveNote}</div>
        <div class="row">
          <button data-action="basic" class="${g.mode === 'basic' ? 'active' : ''}" ${u.acted || busy || !canBasic.ok ? 'disabled' : ''} title="${basic.blurb}">${basic.name} <kbd>Q</kbd></button>
          <button data-action="signature" class="${g.mode === 'signature' ? 'active' : ''}" ${u.acted || busy || !canSig.ok ? 'disabled' : ''} title="${canSig.ok ? sig.blurb : canSig.reason}">${sig.name} <kbd>E</kbd></button>
          <button data-action="cancel" ${g.mode === 'none' ? 'disabled' : ''}>Cancel <kbd>Esc</kbd></button>
          <button data-action="endTurn" class="primary" ${busy ? 'disabled' : ''}>End Squad Turn <kbd>T</kbd></button>
        </div>
        <div class="preview ${pv && !pv.ok ? 'bad' : ''}">${pv ? (pv.ok ? pv.label ?? '' : pv.reason ?? '') : (!canSig.ok ? canSig.reason : '')}</div>
        <div class="hint">${busy ? 'Resolving…' : modeHint}</div></div>`;
    } else if (g.phase === 'enemy') {
      bar = `<div class="panel"><span class="hero">Enemy phase</span> <span class="small">— raiders act one at a time; watch the red telegraph lines.</span></div>`;
    }
    this.set(this.actionbar, 'bar', bar);

    // Debug
    this.debug.hidden = !s.debug;
    if (s.debug) {
      const sel = g.selected;
      const txt = [
        `FPS ${s.fps.toFixed(0)}  frame ${g.frame}  t ${g.time.toFixed(1)}s  seed ${g.seed}`,
        `phase ${g.phase}  turn ${g.turn}  busy ${g.isBusy()}  mode ${g.mode}`,
        sel ? `active ${sel.def.name} #${sel.id}  x ${sel.body.x.toFixed(2)} y ${sel.body.y.toFixed(2)}  grounded ${sel.body.grounded}  v(${sel.body.vx.toFixed(1)},${sel.body.vy.toFixed(1)})` : 'active -',
        `projectiles ${g.projectiles.length}  fx ${g.fx.length}  shots ${g.stats.shots}  explosions ${g.stats.explosions}`,
        `terrain ${g.terrain.cols}x${g.terrain.rows} cells  version ${g.terrain.version}  removed ${g.terrain.removedCells}`,
        `  stable ${g.terrain.countMat(1)}  soil ${g.terrain.countMat(2)}  timber ${g.terrain.countMat(3)}`,
        `spear ${g.spear.state} @ ${g.spear.body.x.toFixed(1)},${g.spear.body.y.toFixed(1)}  jackal ${g.jackal.state} @ ${g.jackal.body.x.toFixed(1)},${g.jackal.body.y.toFixed(1)}`,
        `enemies: ${g.enemies.map((e) => `${e.def.name}#${e.id} hp${e.hp} ${e.alive ? e.intent || 'idle' : 'down'}`).join(' | ')}`,
        `aim angle ${(g.aim.angle * 180 / Math.PI).toFixed(1)}° power ${g.aim.power.toFixed(2)} dir ${g.aim.dir} target ${g.aim.targetId}`,
      ].join('\n');
      this.set(this.debug, 'debug', txt);
      this.debug.className = 'panel';
    }

    this.help.hidden = !s.help;

    // Victory / defeat / restart overlay
    if (g.phase === 'victory' || g.phase === 'defeat') {
      this.overlay.hidden = false;
      const win = g.phase === 'victory';
      this.set(this.overlay, 'overlay', `<div class="panel box"><h1>${win ? 'The crossing is yours' : 'The squad is down'}</h1>
        <p>${win ? `Raiders cleared and a hero stands on the far platform after ${g.turn} squad turn${g.turn === 1 ? '' : 's'}. The eastern gate — and the bell — come later.` : 'Everyone is down for this mission. Try a different mix: break the timber, blow the barrel, use the riverbed.'}</p>
        <button class="primary" data-action="restart">Restart mission <kbd>R</kbd></button></div>`);
    } else this.overlay.hidden = true;
  }
}

const HELP_HTML = `
<h2>Last Call — controls</h2>
<h3>Squad phase</h3>
<table>
<tr><td><kbd>1</kbd>–<kbd>5</kbd> / click hero</td><td>Select a hero (Orrin, Brennagh, Pim, Vesk, Castellan)</td></tr>
<tr><td><kbd>A</kbd> <kbd>D</kbd></td><td>Walk left / right (spends the hero's movement budget)</td></tr>
<tr><td><kbd>W</kbd> / <kbd>Space</kbd></td><td>Jump (Pim's six-legged walker cannot jump; it climbs 2-unit ledges and steps over small gaps)</td></tr>
<tr><td><kbd>Q</kbd></td><td>Basic attack mode</td></tr>
<tr><td><kbd>E</kbd></td><td>Signature ability mode</td></tr>
<tr><td>Mouse</td><td>Aim: angle and power come from the cursor position. Target abilities: hover an enemy. Direction abilities: cursor side.</td></tr>
<tr><td><kbd>↑</kbd><kbd>↓</kbd> / <kbd>←</kbd><kbd>→</kbd></td><td>While aiming: fine-tune angle / power. Otherwise: pan the camera.</td></tr>
<tr><td><kbd>Tab</kbd></td><td>Cycle targets (target abilities)</td></tr>
<tr><td>Click / <kbd>Enter</kbd></td><td>Commit the ability (fire / charge / send the jackal …)</td></tr>
<tr><td><kbd>Esc</kbd> / right-click</td><td>Cancel the current ability (nothing is spent)</td></tr>
<tr><td><kbd>T</kbd></td><td>End squad turn → enemy phase</td></tr>
</table>
<h3>Camera &amp; misc</h3>
<table>
<tr><td>Wheel</td><td>Zoom in/out around the cursor (default shows the whole battlefield)</td></tr>
<tr><td>Right / middle drag</td><td>Pan</td></tr>
<tr><td><kbd>Z</kbd></td><td>Tactical overview (fit the whole level)</td></tr>
<tr><td><kbd>C</kbd></td><td>Center on the selected hero</td></tr>
<tr><td><kbd>H</kbd> <kbd>F3</kbd> <kbd>K</kbd> <kbd>M</kbd></td><td>Help · Debug overlay · Camera shake on/off · Sound on/off</td></tr>
<tr><td><kbd>R</kbd> (twice)</td><td>Restart the mission (skips the prologue)</td></tr>
</table>
<h3>Rules</h3>
<p class="small">Each squad turn every surviving hero may move (budget shown as M) and take one action (A), in any order and any hero order. Then the raiders act once each. Heroes at 0 HP are out for the mission. Win: defeat all three raiders and stand a hero on the gold platform at the far right. Soil and timber break; grey stone never does. One spear: throw it, then walk Vesk over it to pick it up.</p>
<p class="small">Press <kbd>H</kbd> or click outside to close.</p>`;

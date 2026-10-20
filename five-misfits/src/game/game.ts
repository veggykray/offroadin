import { buildLevel, type LevelData } from '../world/level';
import { Mat, type Terrain } from '../world/terrain';
import { type Body, makeBody, integrate, moveX, jump, atRest, onGround, collides, unstick } from '../world/physics';
import { simulateTrajectory, launchVelocity, type ProjectileSpec, type Trajectory, type Target } from '../world/projectile';
import { type Unit, makeUnit, type UnitKind, HERO_ORDER, resetIds, unitCenter } from './units';
import { ABILITIES, type Ability, type AimState, type Preview } from './abilities';
import { enemyPhase } from './enemyAI';
import { CoroutineRunner, type Routine, waitSeconds } from '../core/coroutine';
import { Rng } from '../core/rng';
import { clamp, type Vec2 } from '../core/math';
import { walkStep, JACKAL_WALK } from './walk';

export type Phase = 'intro' | 'player' | 'enemy' | 'victory' | 'defeat';
export type Mode = 'none' | 'basic' | 'signature';

export interface LiveProjectile {
  id: number; spec: ProjectileSpec; traj: Trajectory; t: number; ownerId: number; color: string;
  fired: number; x: number; y: number; angle: number;
}
export interface Fx {
  kind: 'debris' | 'ring' | 'flash' | 'spark' | 'text' | 'line' | 'smoke';
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number;
  text?: string; x2?: number; y2?: number;
}
export interface Jackal { body: Body; state: 'heel' | 'running' | 'idle'; facing: 1 | -1; stuck: number; idleFromX: number }
export interface Spear { state: 'held' | 'flying' | 'resting'; body: Body; angle: number }
export interface Barrel { x: number; y: number; w: number; h: number; hp: number; alive: boolean }
export interface Message { id: number; text: string; kind: 'info' | 'warn' | 'good' | 'bad'; time: number }

export const FIXED_DT = 1 / 60;
export const AIM_FULL_DIST = 16;

export interface GameOptions { seed?: number; skipIntro?: boolean; shake?: boolean }

export class Game {
  level!: LevelData;
  terrain!: Terrain;
  units: Unit[] = [];
  jackal!: Jackal;
  spear!: Spear;
  barrels: Barrel[] = [];
  projectiles: LiveProjectile[] = [];
  fx: Fx[] = [];
  messages: Message[] = [];
  phase: Phase = 'intro';
  turn = 1;
  selectedId = 0;
  mode: Mode = 'none';
  aim: AimState = { angle: Math.PI / 4, power: 0.6, dir: 1, targetId: null, cursor: null };
  preview: Preview | null = null;
  runner = new CoroutineRunner();
  rng: Rng;
  readonly seed: number;
  time = 0;
  frame = 0;
  shake = 0;
  /** Where the camera should look while something scripted happens (null = selected unit). */
  focus: Vec2 | null = null;
  input = { moveDir: 0, jump: false };
  settings = { shake: true };
  stats = { shots: 0, explosions: 0, damageDealt: 0 };
  restartArmedUntil = 0;
  private accumulator = 0;
  private msgId = 0;
  private projId = 0;
  private previewKey = '';

  constructor(opts: GameOptions = {}) {
    this.seed = opts.seed ?? 1234;
    this.rng = new Rng(this.seed);
    this.settings.shake = opts.shake ?? true;
    this.reset(opts.skipIntro ? 'player' : 'intro');
  }

  /** Rebuild the level and squad. Used by first start and by Restart (which skips the prologue). */
  reset(phase: Phase = 'player'): void {
    resetIds();
    this.rng = new Rng(this.seed);
    this.level = buildLevel();
    this.terrain = this.level.terrain;
    this.units = [];
    for (const s of this.level.heroes) this.units.push(makeUnit(s.kind as UnitKind, s.x, s.y));
    for (const s of this.level.enemies) this.units.push(makeUnit(s.kind as UnitKind, s.x, s.y));
    for (const u of this.units) { unstick(this.terrain, u.body); u.body.grounded = onGround(this.terrain, u.body); }
    const beast = this.hero('beast')!;
    this.jackal = { body: makeBody(beast.body.x - 2, beast.body.y, 1.6, 0.9, 1.0, 0), state: 'heel', facing: 1, stuck: 0, idleFromX: 0 };
    this.jackal.body.grounded = onGround(this.terrain, this.jackal.body);
    const spearman = this.hero('spear')!;
    this.spear = { state: 'held', body: makeBody(spearman.body.x, spearman.body.y, 0.5, 0.5, 0, 0), angle: 0 };
    this.barrels = this.level.barrels.map((b) => ({ x: b.x, y: b.y, w: 1, h: 1.5, hp: 10, alive: true }));
    this.projectiles = []; this.fx = []; this.messages = [];
    this.turn = 1; this.mode = 'none'; this.preview = null; this.focus = null; this.shake = 0;
    this.runner.cancel();
    this.selectedId = beast.id;
    this.stats = { shots: 0, explosions: 0, damageDealt: 0 };
    this.phase = phase;
    if (phase === 'player') this.log('Squad turn 1. Each hero may move and take one action. Press T when done.', 'info');
  }

  // ---- queries -------------------------------------------------------------------------
  get heroes(): Unit[] { return this.units.filter((u) => u.team === 'hero'); }
  get enemies(): Unit[] { return this.units.filter((u) => u.team === 'enemy'); }
  get selected(): Unit | undefined { return this.units.find((u) => u.id === this.selectedId); }
  hero(kind: UnitKind): Unit | undefined { return this.units.find((u) => u.kind === kind); }
  unit(id: number): Unit | undefined { return this.units.find((u) => u.id === id); }
  livingEnemies(): Unit[] { return this.enemies.filter((u) => u.alive); }
  livingHeroes(): Unit[] { return this.heroes.filter((u) => u.alive); }

  /** Everything settled: no projectiles, no scripted sequence, every live body at rest. */
  settled(): boolean {
    if (this.runner.busy || this.projectiles.length > 0) return false;
    for (const u of this.units) if (u.alive && !atRest(this.terrain, u.body)) return false;
    if (this.jackal.state === 'running') return false;
    if (this.spear.state === 'flying' || (this.spear.state === 'resting' && !this.spear.body.grounded)) return false;
    return true;
  }
  isBusy(): boolean { return !this.settled(); }

  unitAt(wx: number, wy: number): Unit | undefined {
    for (const u of this.units) {
      if (!u.alive) continue;
      const b = u.body; const pad = 0.4;
      if (wx >= b.x - b.w / 2 - pad && wx <= b.x + b.w / 2 + pad && wy >= b.y - pad && wy <= b.y + b.h + pad) return u;
    }
    return undefined;
  }

  heroInGoal(): Unit | undefined {
    const gz = this.level.goal;
    return this.livingHeroes().find((u) => u.body.x >= gz.x0 && u.body.x <= gz.x1 && u.body.y >= gz.y0 - 0.01 && u.body.y <= gz.y1);
  }

  targets(): Target[] { return this.units.map((u) => ({ id: u.id, x: u.body.x, y: u.body.y, w: u.body.w, h: u.body.h, alive: u.alive, team: u.team })); }

  ability(u: Unit, mode: Mode): Ability | undefined {
    if (mode === 'none') return undefined;
    const id = mode === 'basic' ? u.def.basic : u.def.signature;
    return ABILITIES[id];
  }

  muzzle(u: Unit): Vec2 { return { x: u.body.x + u.facing * u.body.w * 0.3, y: u.body.y + u.body.h * 0.62 }; }

  log(text: string, kind: Message['kind'] = 'info'): void {
    this.messages.push({ id: ++this.msgId, text, kind, time: this.time });
    if (this.messages.length > 60) this.messages.shift();
  }

  // ---- main loop ------------------------------------------------------------------------
  update(dtReal: number): void {
    this.accumulator += Math.min(dtReal, 0.1);
    while (this.accumulator >= FIXED_DT) { this.fixedStep(FIXED_DT); this.accumulator -= FIXED_DT; }
  }

  /** Advance exactly n fixed frames (tests). */
  step(n = 1): void { for (let i = 0; i < n; i++) this.fixedStep(FIXED_DT); }

  /** Advance until settled or the frame cap is hit (tests). Returns frames used. */
  settle(maxFrames = 1200): number {
    let n = 0;
    while (!this.settled() && n < maxFrames) { this.fixedStep(FIXED_DT); n++; }
    return n;
  }

  private fixedStep(dt: number): void {
    this.time += dt; this.frame++;
    if (this.phase === 'intro') return;
    this.runner.step(dt);
    this.playerMovement(dt);
    for (const u of this.units) {
      if (!u.alive) continue;
      integrate(this.terrain, u.body, dt);
      if (u.body.y < -5) { u.body.y = 2; }
      u.anim.hitFlash = Math.max(0, u.anim.hitFlash - dt);
      u.anim.swing = Math.max(0, u.anim.swing - dt);
      const dx = u.body.x - u.anim.lastX; u.anim.lastX = u.body.x;
      if (Math.abs(dx) > 1e-6) u.anim.walkPhase += Math.abs(dx) * (u.kind === 'inventor' ? 2.4 : 4);
    }
    this.updateJackal(dt);
    this.updateSpear();
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.updatePreview();
    this.checkOutcome();
  }

  private playerMovement(dt: number): void {
    const u = this.selected;
    if (this.phase !== 'player' || !u || !u.alive || this.runner.busy) { this.input.jump = false; return; }
    if (this.projectiles.length > 0) { this.input.jump = false; return; }
    const dir = this.input.moveDir;
    if (dir !== 0 && u.moveLeft > 0) {
      u.facing = dir > 0 ? 1 : -1;
      const want = dir * Math.min(u.def.walkSpeed * dt, u.moveLeft);
      const got = moveX(this.terrain, u.body, want);
      if (got !== 0) { u.moveLeft = Math.max(0, u.moveLeft - Math.abs(got)); u.moved = true; }
    } else if (dir !== 0 && u.moveLeft <= 0) {
      this.throttled('nomove' + u.id, () => this.log(`${u.def.name} has no movement left this turn.`, 'warn'));
    }
    if (this.input.jump) {
      this.input.jump = false;
      if (u.def.jumpHeight <= 0) this.throttled('nojump' + u.id, () => this.log(`${u.def.name}'s walker cannot jump. Its six legs climb ledges up to 2 units and step over small gaps.`, 'warn'));
      else if (u.moveLeft < 1) this.throttled('nojumpbudget' + u.id, () => this.log(`${u.def.name} needs at least 1 movement to jump.`, 'warn'));
      else if (jump(u.body, u.def.jumpHeight)) { u.moveLeft -= 1; u.moved = true; }
    }
  }
  private throttle: Record<string, number> = {};
  private throttled(key: string, fn: () => void): void {
    if ((this.throttle[key] ?? -10) + 1.5 < this.time) { this.throttle[key] = this.time; fn(); }
  }

  private updateJackal(dt: number): void {
    const j = this.jackal;
    if (j.state === 'running') return; // controlled by the ability routine
    const master = this.hero('beast');
    if (!master || !master.alive) { integrate(this.terrain, j.body, dt); return; }
    const targetX = master.body.x - master.facing * 1.8;
    const dx = targetX - j.body.x;
    if (j.state === 'idle') {
      if (Math.abs(master.body.x - j.idleFromX) > 2.5) j.state = 'heel';
      integrate(this.terrain, j.body, dt);
      return;
    }
    if (Math.abs(dx) > 0.5) {
      const before = j.body.x;
      walkStep(this.terrain, j.body, Math.sign(dx), JACKAL_WALK, dt);
      j.facing = dx > 0 ? 1 : -1;
      if (Math.abs(j.body.x - before) < 1e-6 && j.body.grounded) j.stuck += dt; else j.stuck = 0;
      if (j.stuck > 0.8) { j.state = 'idle'; j.idleFromX = master.body.x; j.stuck = 0; }
    } else integrate(this.terrain, j.body, dt);
  }

  private updateSpear(): void {
    const s = this.spear;
    const owner = this.hero('spear');
    if (s.state === 'held') { if (owner) { s.body.x = owner.body.x; s.body.y = owner.body.y; } return; }
    if (s.state === 'resting') {
      integrate(this.terrain, s.body, FIXED_DT);
      if (s.body.y < 0) s.body.y = 2;
      if (owner && owner.alive && s.body.grounded) {
        const b = owner.body, pad = 0.7;
        if (s.body.x > b.x - b.w / 2 - pad && s.body.x < b.x + b.w / 2 + pad && s.body.y > b.y - pad && s.body.y < b.y + b.h + pad) {
          s.state = 'held';
          this.log(`${owner.def.name} picks up the spear. Piercing Throw is ready again.`, 'good');
          this.addFx({ kind: 'text', x: b.x, y: b.y + b.h + 1, vx: 0, vy: 2, life: 1.2, max: 1.2, color: '#9fe3ff', size: 1, text: 'Spear retrieved' });
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const pts = p.traj.points;
      const idx = Math.min(pts.length - 1, Math.floor(p.t * 240));
      const cur = pts[idx], prev = pts[Math.max(0, idx - 1)];
      p.x = cur.x; p.y = cur.y; p.angle = Math.atan2(cur.y - prev.y, cur.x - prev.x);
      if (this.spear.state === 'flying' && p.spec.kind === 'spear') { this.spear.body.x = p.x; this.spear.body.y = p.y; this.spear.angle = p.angle; }
      while (p.fired < p.traj.events.length && p.traj.events[p.fired].t <= p.t) {
        this.resolveEvent(p, p.traj.events[p.fired]); p.fired++;
      }
      if (p.t >= p.traj.end.t) {
        while (p.fired < p.traj.events.length) { this.resolveEvent(p, p.traj.events[p.fired]); p.fired++; }
        this.projectiles.splice(i, 1);
      }
      if (this.projectiles.includes(p)) this.focus = { x: p.x, y: p.y };
    }
  }

  private resolveEvent(p: LiveProjectile, ev: Trajectory['events'][number]): void {
    const spec = p.spec;
    if (ev.type === 'unit') {
      const u = this.unit(ev.targetId!);
      if (spec.splash) { this.explode(ev.x, ev.y, spec.splash, p.ownerId); }
      else if (u && u.alive) {
        const vx = Math.cos(p.angle), vy = Math.sin(p.angle);
        this.damageUnit(u, spec.damage, vx * spec.hitKnock, Math.max(2, vy * spec.hitKnock + 2), spec.kind);
        this.addFx({ kind: 'spark', x: ev.x, y: ev.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#fff2a0', size: 0.8 });
      }
    } else {
      if (spec.splash) this.explode(ev.x, ev.y, spec.splash, p.ownerId);
      else this.burst(ev.x, ev.y, '#d9d2b8', 6, 4, 0.4);
      if (spec.kind === 'spear') this.landSpear(ev.x, ev.y, p.angle);
    }
  }

  private landSpear(x: number, y: number, angle: number): void {
    const s = this.spear;
    s.state = 'resting';
    s.body.x = clamp(x, 0.5, this.terrain.width - 0.5); s.body.y = Math.max(2, y); s.body.vx = 0; s.body.vy = 0; s.body.yAcc = 0;
    s.body.grounded = false; s.angle = angle;
    unstick(this.terrain, s.body);
    this.log(`The spear lands at x=${s.body.x.toFixed(0)}. Walk Vesk over it to pick it up.`, 'info');
  }

  // ---- combat ---------------------------------------------------------------------------
  spawnProjectile(owner: Unit, spec: ProjectileSpec, angle: number, speed: number, color: string): LiveProjectile {
    const m = this.muzzle(owner);
    const v = launchVelocity(angle, speed);
    const team = owner.team === 'hero' ? 'enemy' : 'hero';
    const traj = simulateTrajectory(this.terrain, m.x, m.y, v.vx, v.vy, spec, this.targets(), owner.id, team);
    const p: LiveProjectile = { id: ++this.projId, spec, traj, t: 0, ownerId: owner.id, color, fired: 0, x: m.x, y: m.y, angle };
    this.projectiles.push(p);
    this.stats.shots++;
    this.addFx({ kind: 'flash', x: m.x, y: m.y, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#ffe9a8', size: spec.kind === 'shell' ? 1.6 : 0.8 });
    return p;
  }

  /** Preview trajectory for the aim UI (same simulation as a live shot). */
  previewTrajectory(owner: Unit, spec: ProjectileSpec, angle: number, speed: number): Trajectory {
    const m = this.muzzle(owner);
    const v = launchVelocity(angle, speed);
    const team = owner.team === 'hero' ? 'enemy' : 'hero';
    return simulateTrajectory(this.terrain, m.x, m.y, v.vx, v.vy, spec, this.targets(), owner.id, team);
  }

  explode(x: number, y: number, splash: NonNullable<ProjectileSpec['splash']>, sourceId: number, depth = 0): void {
    this.stats.explosions++;
    const removed = splash.carve > 0 ? this.terrain.carveCircle(x, y, splash.carve) : [];
    for (let i = 0; i < Math.min(removed.length, 40); i++) {
      const c = removed[Math.floor((i / Math.min(removed.length, 40)) * removed.length)];
      const col = c.mat === Mat.Timber ? '#a9773c' : '#6b4b2a';
      const ang = this.rng.range(0, Math.PI * 2), sp = this.rng.range(3, 10);
      this.addFx({ kind: 'debris', x: c.x, y: c.y, vx: Math.cos(ang) * sp, vy: Math.abs(Math.sin(ang)) * sp + 3, life: 1.1, max: 1.1, color: col, size: 0.3 });
    }
    this.addFx({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, color: '#ffd27a', size: splash.radius });
    this.addFx({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.15, max: 0.15, color: '#fff3c4', size: splash.radius * 0.7 });
    for (let i = 0; i < 6; i++) this.addFx({ kind: 'smoke', x: x + this.rng.range(-0.5, 0.5), y: y + this.rng.range(-0.3, 0.3), vx: this.rng.range(-1, 1), vy: this.rng.range(1, 3), life: 1.4, max: 1.4, color: '#8a8378', size: splash.radius * 0.35 });
    this.shake = Math.max(this.shake, Math.min(1, splash.radius / 4));
    for (const u of this.units) {
      if (!u.alive) continue;
      const c = unitCenter(u);
      const d = Math.hypot(c.x - x, c.y - y) - Math.min(u.body.w, u.body.h) * 0.25;
      if (d > splash.radius) continue;
      const f = clamp(d / splash.radius, 0, 1);
      const dmg = Math.round(splash.damage + (splash.minDamage - splash.damage) * f);
      let nx = c.x - x, ny = c.y - y; const len = Math.hypot(nx, ny);
      if (len < 0.3) { nx = 0; ny = 1; } else { nx /= len; ny /= len; }
      const sp = splash.knockback * (1 - 0.5 * f);
      this.damageUnit(u, dmg, nx * sp, Math.max(ny * sp, sp * 0.45), 'blast');
    }
    for (const b of this.barrels) {
      if (!b.alive) continue;
      const d = Math.hypot(b.x - x, b.y + b.h / 2 - y);
      if (d <= splash.radius + 0.5) this.damageBarrel(b, 99, depth + 1);
    }
  }

  damageBarrel(b: Barrel, amount: number, depth = 0): void {
    if (!b.alive) return;
    b.hp -= amount;
    if (b.hp <= 0) {
      b.alive = false;
      this.log('A powder barrel detonates!', 'warn');
      if (depth < 4) this.explode(b.x, b.y + b.h / 2, { radius: 4.5, damage: 40, minDamage: 10, carve: 4.0, knockback: 11 }, -1, depth);
    }
  }

  damageUnit(u: Unit, amount: number, kvx: number, kvy: number, source: string): void {
    if (!u.alive) return;
    u.hp = Math.max(0, u.hp - amount);
    u.anim.hitFlash = 0.35;
    this.stats.damageDealt += u.team === 'enemy' ? amount : 0;
    const c = unitCenter(u);
    this.addFx({ kind: 'text', x: c.x, y: u.body.y + u.body.h + 0.6, vx: 0, vy: 3, life: 1.1, max: 1.1, color: u.team === 'enemy' ? '#ffd0d0' : '#ffb0b0', size: 1, text: `-${amount}` });
    this.burst(c.x, c.y, u.team === 'enemy' ? '#ff7b7b' : '#ffd1d1', 5, 3, 0.35);
    if (kvx !== 0 || kvy !== 0) {
      u.body.vx += kvx; u.body.vy = Math.max(u.body.vy, kvy); u.body.grounded = false; u.body.yAcc = 0;
    }
    if (u.hp <= 0) {
      u.alive = false;
      this.log(`${u.def.name} ${u.team === 'hero' ? 'is down for the rest of the mission' : 'is defeated'} (${source}).`, u.team === 'hero' ? 'bad' : 'good');
      if (u.team === 'hero' && this.selectedId === u.id) { const next = this.livingHeroes()[0]; if (next) this.selectedId = next.id; }
      if (u.kind === 'spear' && this.spear.state === 'held') { this.spear.state = 'resting'; this.spear.body.x = u.body.x; this.spear.body.y = u.body.y; }
    }
  }

  // ---- fx -------------------------------------------------------------------------------
  addFx(f: Fx): void { if (this.fx.length < 400) this.fx.push(f); }
  burst(x: number, y: number, color: string, n: number, speed: number, life: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), s = this.rng.range(speed * 0.4, speed);
      this.addFx({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1, life, max: life, color, size: 0.25 });
    }
  }
  private updateFx(dt: number): void {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      if (f.life <= 0) { this.fx.splice(i, 1); continue; }
      if (f.kind === 'debris' || f.kind === 'spark') { f.vy -= 24 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
      else if (f.kind === 'smoke' || f.kind === 'text') { f.x += f.vx * dt; f.y += f.vy * dt; }
    }
  }

  // ---- player commands ------------------------------------------------------------------
  startBattle(): void { if (this.phase === 'intro') { this.phase = 'player'; this.log('Squad turn 1. Each hero may move and take one action. Press T when done.', 'info'); } }

  restart(): void { this.reset('player'); this.log('Mission restarted.', 'info'); }

  selectHero(id: number): boolean {
    const u = this.unit(id);
    if (!u || u.team !== 'hero') return false;
    if (!u.alive) { this.log(`${u.def.name} is down and cannot act this mission.`, 'warn'); return false; }
    if (this.runner.busy) return false;
    this.selectedId = id; this.mode = 'none'; this.preview = null; this.aim.targetId = null;
    return true;
  }
  selectByIndex(i: number): boolean { const kind = HERO_ORDER[i]; const u = kind ? this.hero(kind) : undefined; return u ? this.selectHero(u.id) : false; }

  /** Enter an ability mode. Refuses (with a reason) when the ability cannot be used; nothing is spent. */
  setMode(mode: Mode): { ok: boolean; reason?: string } {
    const u = this.selected;
    if (this.phase !== 'player' || !u || !u.alive) return { ok: false, reason: 'Not the squad phase.' };
    if (this.isBusy()) return { ok: false, reason: 'Wait for the action to finish.' };
    if (mode === 'none') { this.mode = 'none'; this.preview = null; return { ok: true }; }
    if (u.acted) { const r = `${u.def.name} has already acted this turn.`; this.log(r, 'warn'); return { ok: false, reason: r }; }
    const ab = this.ability(u, mode);
    if (!ab) return { ok: false, reason: 'No such ability.' };
    const can = ab.canUse(this, u);
    if (!can.ok) { this.log(can.reason ?? 'Cannot use that now.', 'warn'); return { ok: false, reason: can.reason }; }
    this.mode = mode; this.aim.dir = u.facing; this.aim.targetId = null; this.previewKey = '';
    return { ok: true };
  }
  cancel(): void { this.mode = 'none'; this.preview = null; this.aim.targetId = null; }

  /** Mouse aiming: angle & power from the cursor relative to the muzzle; facing follows the cursor side. */
  aimAt(wx: number, wy: number): void {
    const u = this.selected;
    if (!u || this.mode === 'none') return;
    this.aim.cursor = { x: wx, y: wy };
    const ab = this.ability(u, this.mode)!;
    const dir: 1 | -1 = wx >= u.body.x ? 1 : -1;
    if (this.input.moveDir === 0 && !this.runner.busy) u.facing = dir;
    this.aim.dir = dir;
    if (ab.mode === 'aim') {
      const m = this.muzzle(u);
      this.aim.angle = Math.atan2(wy - m.y, wx - m.x);
      this.aim.power = clamp(Math.hypot(wx - m.x, wy - m.y) / AIM_FULL_DIST, 0.08, 1);
    } else if (ab.mode === 'target') {
      const t = this.unitAt(wx, wy);
      this.aim.targetId = t && t.team === 'enemy' && t.alive ? t.id : null;
    }
  }
  nudgeAim(dAngle: number, dPower: number): void {
    this.aim.angle += dAngle; this.aim.power = clamp(this.aim.power + dPower, 0.08, 1);
    const u = this.selected; if (u && Math.cos(this.aim.angle) !== 0) { const d: 1 | -1 = Math.cos(this.aim.angle) >= 0 ? 1 : -1; this.aim.dir = d; u.facing = d; }
  }
  cycleTarget(): void {
    const u = this.selected; if (!u) return;
    const list = this.livingEnemies().sort((a, b) => Math.abs(a.body.x - u.body.x) - Math.abs(b.body.x - u.body.x));
    if (!list.length) return;
    const i = list.findIndex((e) => e.id === this.aim.targetId);
    this.aim.targetId = list[(i + 1) % list.length].id;
  }

  private updatePreview(): void {
    const u = this.selected;
    if (this.phase !== 'player' || !u || this.mode === 'none') { this.preview = null; return; }
    const ab = this.ability(u, this.mode)!;
    const key = `${u.id}|${u.body.x.toFixed(3)}|${u.body.y.toFixed(3)}|${this.aim.angle.toFixed(4)}|${this.aim.power.toFixed(3)}|${this.aim.dir}|${this.aim.targetId}|${this.terrain.version}`;
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.preview = ab.preview(this, u, this.aim);
  }

  /** Commit the current ability. Returns false with a reason when it cannot be executed (action not spent). */
  confirm(): { ok: boolean; reason?: string } {
    const u = this.selected;
    if (this.phase !== 'player' || !u || !u.alive || this.mode === 'none') return { ok: false, reason: 'Nothing to confirm.' };
    if (this.isBusy()) return { ok: false, reason: 'Wait for the action to finish.' };
    if (u.acted) return { ok: false, reason: `${u.def.name} has already acted.` };
    const ab = this.ability(u, this.mode)!;
    const can = ab.canUse(this, u);
    if (!can.ok) { this.log(can.reason ?? 'Cannot use that.', 'warn'); return can; }
    const res = ab.execute(this, u, this.aim);
    if (!res.ok) { this.log(res.reason ?? 'That cannot be done from here.', 'warn'); return res; }
    u.acted = true;
    this.mode = 'none'; this.preview = null; this.aim.targetId = null;
    return { ok: true };
  }

  endSquadTurn(): boolean {
    if (this.phase !== 'player' || this.isBusy()) return false;
    this.phase = 'enemy'; this.mode = 'none'; this.preview = null;
    this.log(`Enemy phase (turn ${this.turn}).`, 'info');
    const g = this;
    this.runner.start((function* (): Routine {
      yield* enemyPhase(g);
      yield* waitSeconds(0.3);
      g.beginPlayerPhase();
    })());
    return true;
  }

  beginPlayerPhase(): void {
    if (this.phase === 'defeat' || this.phase === 'victory') return;
    this.turn++;
    for (const h of this.heroes) { h.moveLeft = h.def.moveBudget; h.moved = false; h.acted = false; }
    this.phase = 'player'; this.focus = null;
    const sel = this.selected; if (!sel || !sel.alive) { const n = this.livingHeroes()[0]; if (n) this.selectedId = n.id; }
    this.log(`Squad turn ${this.turn}. Heroes refreshed.`, 'info');
  }

  private checkOutcome(): void {
    if (this.phase !== 'player' && this.phase !== 'enemy') return;
    if (!this.settled()) return;
    if (this.livingHeroes().length === 0) { this.phase = 'defeat'; this.runner.cancel(); this.log('The whole squad is down. Press R to restart.', 'bad'); return; }
    if (this.phase === 'player' && this.livingEnemies().length === 0 && this.heroInGoal()) {
      this.phase = 'victory'; this.log('The crossing is clear. Victory!', 'good');
    }
  }

  /** Objective text for the HUD. */
  objective(): string {
    const left = this.livingEnemies().length;
    if (left > 0) return `Defeat the raiders (${3 - left}/3) then reach the stone platform on the far right.`;
    return this.heroInGoal() ? 'Objective complete.' : 'Raiders defeated. Get any hero onto the GOAL platform (far right).';
  }

  /** Run a scripted routine (abilities use this). */
  run(r: Routine): void { this.runner.start(r); }

  collidesBody(b: Body, x: number, y: number): boolean { return collides(this.terrain, b, x, y); }
}

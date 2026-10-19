import type { Game } from './game';
import { type Unit, unitCenter } from './units';
import { DEG, type Vec2 } from '../core/math';
import type { ProjectileSpec } from '../world/projectile';
import { Mat } from '../world/terrain';
import { makeBody, onGround, collides, snap, moveX } from '../world/physics';
import { simulateWalk, JACKAL_WALK } from './walk';
import { waitSeconds, type Routine } from '../core/coroutine';

export interface AimState { angle: number; power: number; dir: 1 | -1; targetId: number | null; cursor: Vec2 | null }

export interface Preview {
  ok: boolean;
  reason?: string;
  /** Sampled trajectory for aimed projectiles. */
  points?: Vec2[];
  impact?: Vec2;
  splash?: number;
  /** Movement path for charges, lunges and the jackal run. */
  path?: Vec2[];
  end?: Vec2;
  hitRect?: [number, number, number, number];
  landing?: Vec2;
  targetId?: number | null;
  label?: string;
}

export interface Ability {
  id: string;
  name: string;
  mode: 'aim' | 'target' | 'direction';
  blurb: string;
  canUse(g: Game, u: Unit): { ok: boolean; reason?: string };
  preview(g: Game, u: Unit, aim: AimState): Preview;
  execute(g: Game, u: Unit, aim: AimState): { ok: boolean; reason?: string };
}

export const SPECS: Record<string, ProjectileSpec> = {
  hatchet: { kind: 'hatchet', radius: 0.25, gravityScale: 1, damage: 15, hitKnock: 3, maxTime: 6 },
  gadget: { kind: 'gadget', radius: 0.25, gravityScale: 1, damage: 0, splash: { radius: 1.4, damage: 16, minDamage: 8, carve: 0.7, knockback: 5 }, hitKnock: 0, maxTime: 6 },
  shell: { kind: 'shell', radius: 0.3, gravityScale: 1, damage: 0, splash: { radius: 4.0, damage: 45, minDamage: 12, carve: 3.5, knockback: 11 }, hitKnock: 0, maxTime: 8 },
  stone: { kind: 'stone', radius: 0.2, gravityScale: 1, damage: 12, hitKnock: 3, maxTime: 6 },
  spear: { kind: 'spear', radius: 0.3, gravityScale: 1, damage: 35, hitKnock: 4, pierce: true, maxTime: 10 },
  bullet: { kind: 'bullet', radius: 0.15, gravityScale: 0.12, damage: 18, hitKnock: 4, maxTime: 1.2 },
  arrow: { kind: 'arrow', radius: 0.2, gravityScale: 1, damage: 14, hitKnock: 3, maxTime: 6 },
};
export const SPEEDS: Record<string, [number, number]> = {
  hatchet: [10, 20], gadget: [10, 18], shell: [14, 30], stone: [12, 26], spear: [16, 30], bullet: [45, 45], arrow: [32, 32],
};
export const speedFor = (spec: ProjectileSpec, power: number): number => { const [lo, hi] = SPEEDS[spec.kind]; return lo + (hi - lo) * power; };

const ok = { ok: true };

function samplePoints(points: { x: number; y: number }[], every = 8): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < points.length; i += every) out.push({ x: points[i].x, y: points[i].y });
  out.push(points[points.length - 1]);
  return out;
}

function aimAbility(id: string, name: string, blurb: string, spec: ProjectileSpec, color: string,
  extra: { canUse?: Ability['canUse']; onFire?: (g: Game, u: Unit, aim: AimState) => void } = {}): Ability {
  return {
    id, name, mode: 'aim', blurb,
    canUse: extra.canUse ?? (() => ok),
    preview(g, u, aim) {
      const speed = speedFor(spec, aim.power);
      const traj = g.previewTrajectory(u, spec, aim.angle, speed);
      const hitUnit = traj.events.find((e) => e.type === 'unit');
      const target = hitUnit ? g.unit(hitUnit.targetId!) : undefined;
      const fixed = SPEEDS[spec.kind][0] === SPEEDS[spec.kind][1];
      const label = `${name} · angle ${Math.round(aim.angle / DEG)}°${fixed ? '' : ` · power ${Math.round(aim.power * 100)}%`}${target ? ` · on course for ${target.def.name}` : ''}`;
      return { ok: true, points: samplePoints(traj.points), impact: { x: traj.end.x, y: traj.end.y }, splash: spec.splash?.radius, label };
    },
    execute(g, u, aim) {
      const speed = speedFor(spec, aim.power);
      u.facing = aim.dir;
      g.spawnProjectile(u, spec, aim.angle, speed, color);
      g.log(`${u.def.name} uses ${name}.`, 'info');
      extra.onFire?.(g, u, aim);
      return ok;
    },
  };
}

// ---- Giant: heavy strike ---------------------------------------------------------------------
function strikeRect(u: Unit, dir: number): [number, number, number, number] {
  const front = u.body.x + dir * u.body.w / 2;
  const far = front + dir * 2.6;
  return [Math.min(front, far), u.body.y + 0.1, Math.max(front, far), u.body.y + u.body.h];
}
function overlaps(r: [number, number, number, number], b: { x: number; y: number; w: number; h: number }): boolean {
  return b.x - b.w / 2 < r[2] && b.x + b.w / 2 > r[0] && b.y < r[3] && b.y + b.h > r[1];
}

const strike: Ability = {
  id: 'strike', name: 'Heavy Strike', mode: 'direction', blurb: 'Short-range armored fist: hits everything in front, breaks timber.',
  canUse: () => ok,
  preview(g, u, aim) {
    const r = strikeRect(u, aim.dir);
    const hits = g.livingEnemies().filter((e) => overlaps(r, e.body)).map((e) => e.def.name);
    return { ok: true, hitRect: r, label: hits.length ? `Heavy Strike hits ${hits.join(', ')}` : 'Heavy Strike — nothing in reach (breaks timber)' };
  },
  execute(g, u, aim) {
    const r = strikeRect(u, aim.dir);
    u.facing = aim.dir; u.anim.swing = 0.4;
    for (const e of g.livingEnemies()) if (overlaps(r, e.body)) g.damageUnit(e, 30, aim.dir * 8, 5, 'armored fist');
    for (const b of g.barrels) if (b.alive && overlaps(r, b)) g.damageBarrel(b, 99);
    const removed = g.terrain.carveRect(r[0], r[1], r[2], r[3], [Mat.Timber]);
    for (const c of removed.slice(0, 30)) g.addFx({ kind: 'debris', x: c.x, y: c.y, vx: aim.dir * g.rng.range(3, 9), vy: g.rng.range(2, 8), life: 1, max: 1, color: '#a9773c', size: 0.3 });
    if (removed.length) g.log(`${u.def.name} smashes the timber apart.`, 'info'); else g.log(`${u.def.name} swings her armored fist.`, 'info');
    g.shake = Math.max(g.shake, 0.35);
    g.run(waitSeconds(0.45));
    return ok;
  },
};

// ---- Giant: shield charge --------------------------------------------------------------------
type ChargeEvent = { frame: number; type: 'hit'; unitId: number } | { frame: number; type: 'carve'; rect: [number, number, number, number] } | { frame: number; type: 'barrel'; index: number };
interface ChargeSim { path: Vec2[]; end: Vec2; events: ChargeEvent[]; reason: string }

function simulateCharge(g: Game, u: Unit, dir: number): ChargeSim {
  const t = g.terrain.clone();
  const b = makeBody(u.body.x, u.body.y, u.body.w, u.body.h, u.body.stepUp, u.body.footSpan);
  b.grounded = true;
  const path: Vec2[] = [], events: ChargeEvent[] = [];
  const hit = new Set<number>(), barrels = new Set<number>();
  const dt = 1 / 60, speed = 13, maxDist = 15;
  let dist = 0, reason = 'full distance';
  for (let frame = 0; frame < 240; frame++) {
    const want = dir * speed * dt;
    const front = b.x + dir * b.w / 2;
    const ax0 = Math.min(front, front + dir * 0.45), ax1 = Math.max(front, front + dir * 0.45);
    if (t.rectSolid(ax0, b.y + 0.05, ax1, b.y + b.h - 0.05) && !t.rectSolidExcept(ax0, b.y + 0.05, ax1, b.y + b.h - 0.05, [Mat.Timber])) {
      const cx0 = Math.min(front, front + dir * 0.75), cx1 = Math.max(front, front + dir * 0.75);
      const rect: [number, number, number, number] = [cx0, b.y - 0.01, cx1, b.y + b.h];
      t.carveRect(rect[0], rect[1], rect[2], rect[3], [Mat.Timber]);
      events.push({ frame, type: 'carve', rect });
    }
    const moved = moveX(t, b, want);
    if (Math.abs(moved) < Math.abs(want) * 0.5) { reason = 'stopped by stone'; break; }
    // Ground-following with cliff safety: the leading foot must find ground within 1.6 units.
    const footX = b.x + dir * (b.w / 2 - 0.15);
    const s = t.surfaceBelow(footX, b.y + 0.01, 1.6);
    if (s === null) { b.x -= moved; reason = 'stops at the edge'; break; }
    if (!onGround(t, b, b.x, b.y, false)) b.y = snap(s);
    dist += Math.abs(moved);
    path.push({ x: b.x, y: b.y });
    for (const e of g.livingEnemies()) {
      if (hit.has(e.id)) continue;
      const r: [number, number, number, number] = [b.x - b.w / 2 - 0.3, b.y, b.x + b.w / 2 + 0.3, b.y + b.h];
      if (overlaps(r, e.body)) { hit.add(e.id); events.push({ frame, type: 'hit', unitId: e.id }); }
    }
    g.barrels.forEach((bar, i) => {
      if (!bar.alive || barrels.has(i)) return;
      if (overlaps([b.x - b.w / 2 - 0.3, b.y, b.x + b.w / 2 + 0.3, b.y + b.h], bar)) { barrels.add(i); events.push({ frame, type: 'barrel', index: i }); }
    });
    if (dist >= maxDist) break;
  }
  return { path, end: { x: b.x, y: b.y }, events, reason };
}

const charge: Ability = {
  id: 'charge', name: 'Shield Charge', mode: 'direction', blurb: 'Telegraphed ground-following charge. Breaks timber, shoves enemies, stops at stone and at cliff edges.',
  canUse: () => ok,
  preview(g, u, aim) {
    const sim = simulateCharge(g, u, aim.dir);
    const hits = sim.events.filter((e) => e.type === 'hit').length;
    const timber = sim.events.some((e) => e.type === 'carve');
    if (sim.path.length === 0) return { ok: false, reason: `Shield Charge: blocked immediately (${sim.reason}).`, end: sim.end };
    return { ok: true, path: sim.path, end: sim.end, label: `Shield Charge ${aim.dir > 0 ? 'right' : 'left'} · ${sim.reason}${hits ? ` · hits ${hits}` : ''}${timber ? ' · breaks timber' : ''}` };
  },
  execute(g, u, aim) {
    const sim = simulateCharge(g, u, aim.dir);
    if (sim.path.length === 0) return { ok: false, reason: `Shield Charge is blocked immediately (${sim.reason}).` };
    u.facing = aim.dir;
    g.log(`${u.def.name} charges ${aim.dir > 0 ? 'right' : 'left'} (${sim.reason}).`, 'info');
    g.run((function* (): Routine {
      let frame = 0;
      for (const p of sim.path) {
        for (const ev of sim.events) {
          if (ev.frame !== frame) continue;
          if (ev.type === 'hit') { const e = g.unit(ev.unitId); if (e) { g.damageUnit(e, 25, aim.dir * 14, 6, 'shield charge'); g.shake = Math.max(g.shake, 0.4); } }
          else if (ev.type === 'carve') {
            const removed = g.terrain.carveRect(ev.rect[0], ev.rect[1], ev.rect[2], ev.rect[3], [Mat.Timber]);
            for (const c of removed.slice(0, 20)) g.addFx({ kind: 'debris', x: c.x, y: c.y, vx: aim.dir * g.rng.range(4, 10), vy: g.rng.range(2, 8), life: 1, max: 1, color: '#a9773c', size: 0.3 });
            g.shake = Math.max(g.shake, 0.25);
          } else if (ev.type === 'barrel') g.damageBarrel(g.barrels[ev.index], 99);
        }
        u.body.x = p.x; u.body.y = p.y; u.body.vx = 0; u.body.vy = 0; u.body.grounded = true;
        u.anim.walkPhase += 0.3;
        if (frame % 4 === 0) g.addFx({ kind: 'smoke', x: u.body.x - aim.dir * 0.8, y: u.body.y + 0.3, vx: -aim.dir * 2, vy: 1.5, life: 0.5, max: 0.5, color: '#9a8f7c', size: 0.6 });
        frame++;
        yield;
      }
      u.body.grounded = onGround(g.terrain, u.body);
      yield* waitSeconds(0.2);
    })());
    return ok;
  },
};

// ---- Beast master: jackal attack -------------------------------------------------------------
const jackal: Ability = {
  id: 'jackal', name: 'Jackal Attack', mode: 'target', blurb: 'Send the spined jackal along a real path to bite an enemy, then it returns.',
  canUse: (g) => (g.jackal.state === 'running' ? { ok: false, reason: 'The jackal is already running.' } : ok),
  preview(g, u, aim) {
    if (aim.targetId === null) return { ok: false, reason: 'Hover an enemy (or press Tab) to pick the jackal\'s target.' };
    const e = g.unit(aim.targetId)!;
    if (Math.abs(e.body.x - g.jackal.body.x) > 26) return { ok: false, reason: `${e.def.name} is too far from the jackal.`, targetId: e.id };
    const sim = simulateWalk(g.terrain, g.jackal.body, { x: e.body.x, y: e.body.y, reachDx: 1.4, reachDy: 2.6 }, JACKAL_WALK, 6);
    const path = sim.path.map((p) => ({ x: p.x, y: p.y }));
    if (!sim.reached) return { ok: false, reason: `The jackal can't reach ${e.def.name}: ${sim.reason}.`, path, targetId: e.id };
    return { ok: true, path, end: { x: sim.end.x, y: sim.end.y }, targetId: e.id, label: `Jackal Attack on ${e.def.name} (${sim.path.length / 60 | 0}s run)` };
  },
  execute(g, u, aim) {
    if (aim.targetId === null) return { ok: false, reason: 'Pick a target for the jackal first.' };
    const e = g.unit(aim.targetId)!;
    const sim = simulateWalk(g.terrain, g.jackal.body, { x: e.body.x, y: e.body.y, reachDx: 1.4, reachDy: 2.6 }, JACKAL_WALK, 6);
    if (!sim.reached) return { ok: false, reason: `The jackal can't reach ${e.def.name}: ${sim.reason}.` };
    const j = g.jackal;
    j.state = 'running';
    g.log(`${u.def.name} whistles — the jackal goes for ${e.def.name}.`, 'info');
    g.run((function* (): Routine {
      for (const p of sim.path) { j.facing = p.x >= j.body.x ? 1 : -1; j.body.x = p.x; j.body.y = p.y; j.body.grounded = p.grounded; g.focus = { x: p.x, y: p.y }; yield; }
      const dir = Math.sign(e.body.x - j.body.x) || j.facing;
      g.damageUnit(e, 20, dir * 5, 4, 'jackal bite');
      g.addFx({ kind: 'text', x: j.body.x, y: j.body.y + 1.5, vx: 0, vy: 2, life: 0.8, max: 0.8, color: '#ffe', size: 0.9, text: 'BITE' });
      yield* waitSeconds(0.35);
      const back = simulateWalk(g.terrain, j.body, { x: u.body.x - u.facing * 1.8, y: u.body.y, reachDx: 2.0, reachDy: 3 }, JACKAL_WALK, 6);
      for (const p of back.path) { j.facing = p.x >= j.body.x ? 1 : -1; j.body.x = p.x; j.body.y = p.y; j.body.grounded = p.grounded; yield; }
      j.body.vx = 0; j.body.vy = 0; j.body.yAcc = 0;
      j.body.grounded = onGround(g.terrain, j.body);
      j.state = 'heel';
      if (!back.reached) g.log('The jackal settles where it is — it can\'t get back to Orrin from there.', 'info');
    })());
    return ok;
  },
};

// ---- Duelist: show-off ------------------------------------------------------------------------
interface Lunge { landing: Vec2; dir: 1 | -1 }
function planLunge(g: Game, u: Unit, e: Unit): { ok: boolean; reason?: string; lunge?: Lunge } {
  const dx = e.body.x - u.body.x, dy = e.body.y - u.body.y;
  if (Math.abs(dx) > 9) return { ok: false, reason: `${e.def.name} is too far for the lunge (9 units max).` };
  if (Math.abs(dy) > 3.5) return { ok: false, reason: `${e.def.name} stands too far above or below.` };
  const dir: 1 | -1 = dx >= 0 ? 1 : -1;
  let lx = e.body.x - dir * 1.5;
  if ((dir > 0 && lx < u.body.x) || (dir < 0 && lx > u.body.x)) lx = u.body.x;
  const surface = g.terrain.surfaceBelow(lx, e.body.y + 2.6, 6.5);
  if (surface === null) return { ok: false, reason: 'No footing beside the target to land on.' };
  const ly = snap(surface);
  if (Math.abs(ly - e.body.y) > 2.6) return { ok: false, reason: 'No safe landing spot level with the target.' };
  if (collides(g.terrain, u.body, lx, ly)) return { ok: false, reason: 'No room to land beside the target.' };
  const n = Math.ceil(Math.hypot(lx - u.body.x, ly - u.body.y) / 0.2) + 1;
  for (let i = 1; i < n; i++) { const t = i / n; if (collides(g.terrain, u.body, u.body.x + (lx - u.body.x) * t, u.body.y + (ly - u.body.y) * t)) return { ok: false, reason: 'The lunge path is blocked by terrain.' }; }
  const m = g.muzzle(u), c = unitCenter(e);
  if (g.terrain.segmentHit(m.x, m.y, c.x, c.y)) return { ok: false, reason: 'No line of fire for the pistol.' };
  return { ok: true, lunge: { landing: { x: lx, y: ly }, dir } };
}

const showoff: Ability = {
  id: 'showoff', name: 'Show-Off', mode: 'target', blurb: 'Pistol shot, then an acrobatic lunge to stab. Needs a clear path and footing.',
  canUse: () => ok,
  preview(g, u, aim) {
    if (aim.targetId === null) return { ok: false, reason: 'Hover an enemy within 9 units (or press Tab) for the Show-Off.' };
    const e = g.unit(aim.targetId)!;
    const plan = planLunge(g, u, e);
    if (!plan.ok) return { ok: false, reason: `Show-Off: ${plan.reason}`, targetId: e.id };
    return { ok: true, landing: plan.lunge!.landing, path: [{ x: u.body.x, y: u.body.y }, plan.lunge!.landing], targetId: e.id, label: `Show-Off on ${e.def.name}: shoot, lunge, stab` };
  },
  execute(g, u, aim) {
    if (aim.targetId === null) return { ok: false, reason: 'Pick a target for the Show-Off first.' };
    const e = g.unit(aim.targetId)!;
    const plan = planLunge(g, u, e);
    if (!plan.ok) return { ok: false, reason: `Show-Off: ${plan.reason}` };
    const { landing, dir } = plan.lunge!;
    u.facing = dir;
    g.log(`${u.def.name} shows off: shot, lunge, stab on ${e.def.name}.`, 'info');
    g.run((function* (): Routine {
      const m = g.muzzle(u);
      g.addFx({ kind: 'flash', x: m.x, y: m.y, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#ffe9a8', size: 0.9 });
      g.addFx({ kind: 'line', x: m.x, y: m.y, x2: e.body.x, y2: e.body.y + e.body.h * 0.6, vx: 0, vy: 0, life: 0.15, max: 0.15, color: '#fff7d0', size: 0.1 });
      g.damageUnit(e, 15, dir * 2, 2, 'pistol');
      yield* waitSeconds(0.25);
      const sx = u.body.x, sy = u.body.y; let t = 0;
      while (t < 0.3) {
        const dt: number = yield; t += dt; const k = Math.min(1, t / 0.3);
        u.body.x = sx + (landing.x - sx) * k; u.body.y = sy + (landing.y - sy) * k + Math.sin(k * Math.PI) * 1.2;
        u.body.vx = 0; u.body.vy = 0; u.body.grounded = false; u.body.yAcc = 0;
      }
      u.body.x = landing.x; u.body.y = landing.y; u.body.grounded = onGround(g.terrain, u.body);
      u.anim.swing = 0.35;
      g.damageUnit(e, 25, dir * 6, 4, 'rapier');
      yield* waitSeconds(0.3);
    })());
    return ok;
  },
};

// ---- registry --------------------------------------------------------------------------------
export const ABILITIES: Record<string, Ability> = {
  hatchet: aimAbility('hatchet', 'Hatchet Throw', 'Short-range thrown hatchet.', SPECS.hatchet, '#d8d8d8'),
  jackal,
  strike,
  charge,
  gadget: aimAbility('gadget', 'Sparkbolt Gadget', 'Modest fake-magic gadget shot with a small blast.', SPECS.gadget, '#c9a7ff'),
  cannon: aimAbility('cannon', 'Cannon', 'One explosive shell: big splash, terrain damage, recoil.', SPECS.shell, '#333', {
    onFire(g, u, aim) { u.body.vx -= aim.dir * 6; g.shake = Math.max(g.shake, 0.5); },
  }),
  sling: aimAbility('sling', 'Slingshot', 'Quick stone.', SPECS.stone, '#bbb'),
  spearThrow: aimAbility('spearThrow', 'Piercing Throw', 'The one spear: pierces, then embeds or falls where it lands. Walk over it to retrieve.', SPECS.spear, '#9fe3ff', {
    canUse(g) {
      if (g.spear.state === 'held') return ok;
      if (g.spear.state === 'flying') return { ok: false, reason: 'The spear is still in the air.' };
      return { ok: false, reason: `The spear is lying at x=${g.spear.body.x.toFixed(0)} — Vesk must walk over it to pick it up (free). Use the Slingshot meanwhile.` };
    },
    onFire(g) { g.spear.state = 'flying'; },
  }),
  pistol: aimAbility('pistol', 'Pistol', 'Fast, nearly flat shot.', SPECS.bullet, '#fff2a0'),
  showoff,
};

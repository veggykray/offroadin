/* ALIEN STRIKE — AI behaviour archetypes.
 * Each archetype: { init?(e, g, opts), update(e, dt, g), drawHidden?, forceSurface? }.
 * Shared states: idle (guard / wander near home), patrol (follow waypoints),
 * investigate (move to a heard noise), engage (archetype-specific), retreat,
 * return (leash back to home). Different archetypes deliberately avoid the
 * "everything charges the player" pattern: tanks hold range and seek cover,
 * artillery stays back, interceptors make attack runs, packs surround then leap,
 * burrowers vanish and resurface, repair units tend the wounded. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  /* ---------- shared helpers ---------- */
  function idle(e, dt, g, wanderR) {
    if (e.patrol && e.patrol.length) {
      const p = e.patrol[e.pi % e.patrol.length];
      if (e.moveToward(p[0], p[1], 0.5, dt) < 24) e.pi++;
      e.faceMove(dt);
      return;
    }
    if (e.state === 'investigate' && e.mem.heard) {
      if (e.moveToward(e.mem.heard.x, e.mem.heard.y, 0.7, dt) < 30) { e.mem.heard = null; e.state = 'idle'; }
      e.faceMove(dt);
      return;
    }
    // return home if wandered off (leash)
    if (U.dist(e.x, e.y, e.home.x, e.home.y) > (wanderR || 140) * 1.8) {
      e.moveToward(e.home.x, e.home.y, 0.6, dt); e.faceMove(dt); return;
    }
    e.mem.wT = (e.mem.wT || 0) - dt;
    if (e.mem.wT <= 0) {
      e.mem.wT = U.range(2, 5);
      const a = Math.random() * TAU, r = Math.random() * (wanderR || 140);
      e.mem.wx = e.home.x + Math.cos(a) * r; e.mem.wy = e.home.y + Math.sin(a) * r;
      e.mem.rest = Math.random() < 0.4;
    }
    if (e.mem.rest || wanderR === 0) e.brake(dt);
    else e.moveToward(e.mem.wx, e.mem.wy, 0.35, dt);
    e.faceMove(dt);
  }
  function leashed(e, g) {
    return e.team === 'enemy' && !e.alwaysActive && U.dist(e.x, e.y, e.home.x, e.home.y) > e.leash && (!e.target || U.dist(e.target.x, e.target.y, e.home.x, e.home.y) > e.leash);
  }
  function separate(e, g, dt) {
    const near = g.enemyUnitsNear(e.x, e.y, e.r * 2.5 + 8);
    for (const o of near) {
      if (o === e || o.air !== e.air) continue;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 1, rr = e.r + o.r;
      if (d < rr) { e.vx += dx / d * (rr - d) * 8; e.vy += dy / d * (rr - d) * 8; }
    }
  }
  function findCover(e, g, t) {
    let best = null, bd = 220;
    for (const s of g.solids) {
      if (s.alive === false) continue;
      const d = U.dist(e.x, e.y, s.x, s.y);
      if (d < bd && d > 10) { bd = d; best = s; }
    }
    if (!best) return null;
    const a = Math.atan2(best.y - t.y, best.x - t.x);
    return { x: best.x + Math.cos(a) * (best.r + e.r + 8), y: best.y + Math.sin(a) * (best.r + e.r + 8) };
  }

  const AI = {};

  /* PACK HUNTER: surround the prey, then leap in. Flee when badly hurt. */
  AI.pack = {
    update(e, dt, g) {
      const t = e.target, w = e.def.weapon;
      if (e.leapT > 0) return;
      if (!t) { if (leashed(e, g)) e.moveToward(e.home.x, e.home.y, 0.8, dt); else idle(e, dt, g, 120); separate(e, g, dt); return; }
      if (e.hp < e.maxHp * 0.3 && !e.mem.fled) { e.mem.fled = true; e.mem.fleeT = 2.5; }
      if (e.mem.fleeT > 0) {
        e.mem.fleeT -= dt;
        const a = Math.atan2(e.y - t.y, e.x - t.x);
        e.moveToward(e.x + Math.cos(a) * 100, e.y + Math.sin(a) * 100, 1, dt); e.faceMove(dt); return;
      }
      if (e.mem.orbit === undefined) { e.mem.orbit = Math.random() * TAU; e.mem.dir = Math.random() < 0.5 ? 1 : -1; }
      e.mem.orbit += dt * e.mem.dir * 1.1;
      const d = U.dist(e.x, e.y, t.x, t.y);
      const R = d > 220 ? 0 : 70 + (e.uid % 3) * 14;
      const tx = t.x + Math.cos(e.mem.orbit) * R, ty = t.y + Math.sin(e.mem.orbit) * R;
      e.moveToward(tx, ty, 1, dt);
      e.faceMove(dt);
      separate(e, g, dt);
      if (w.k === 'leap' || w.k === 'melee') {
        e.cd -= dt;
        if (e.cd <= 0 && d < (w.range || 70) + 10) { e.cd = 1 / w.rate * U.range(0.8, 1.4); e.faceTo(t.x, t.y, 1, 10); e.fire(w, t); }
      } else e.tryFire(w, t, dt);
      if (e.def.weapon2) e.tryFire(e.def.weapon2, t, dt, 2);
    },
  };

  /* BURROWER: travels underground (untargetable), surfaces near the prey to spit, then dives. */
  AI.burrower = {
    init(e) { e.burrowed = true; e.targetable = false; e.mem.phase = 'under'; e.mem.pt = 0; },
    surface(e) {
      e.burrowed = false; e.targetable = true; e.mem.phase = 'up'; e.mem.pt = U.range(4, 6);
      AS.FX.dust(e.x, e.y, 14, e.g.world.terrain.ramp[2], 90);
      AS.FX.shockwave(e.x, e.y, 30);
      AS.Audio.sfx('burrow', { x: e.x, y: e.y });
      if (e.g.player && U.dist(e.x, e.y, e.g.player.x, e.g.player.y) < 500) e.g.player.warnOnce('lifeform', 'unknown_lifeform', 40);
    },
    forceSurface(e) { if (e.burrowed) AI.burrower.surface(e); },
    update(e, dt, g) {
      const t = e.target;
      e.mem.pt -= dt;
      if (e.mem.phase === 'under') {
        if (t) {
          const d = e.moveToward(t.x + Math.cos(e.uid) * 40, t.y + Math.sin(e.uid) * 40, 1.2, dt);
          e.faceMove(dt);
          if (Math.random() < 0.35) AS.FX.dust(e.x, e.y, 1, g.world.terrain.ramp[1], 20);
          if (d < 150 && e.mem.pt <= 0) AI.burrower.surface(e);
        } else { e.brake(dt); }
      } else {
        e.brake(dt);
        if (t) { e.faceTo(t.x, t.y, dt); e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x); e.tryFire(e.def.weapon, t, dt); }
        if (e.mem.pt <= 0) {
          e.burrowed = true; e.targetable = false; e.mem.phase = 'under'; e.mem.pt = U.range(1.5, 3);
          AS.FX.dust(e.x, e.y, 10, g.world.terrain.ramp[2], 70);
          AS.Audio.sfx('burrow', { x: e.x, y: e.y, vol: 0.6 });
        }
      }
    },
    drawHidden(e, ctx, ox, oy) {
      if (!e.target && Math.hypot(e.vx, e.vy) < 10) return;
      ctx.fillStyle = 'rgba(40,26,16,0.55)';
      ctx.beginPath(); ctx.ellipse(Math.round(e.x - ox), Math.round(e.y - oy), e.r * 0.8, e.r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,170,120,0.5)';
      ctx.fillRect(Math.round(e.x - ox) - 2, Math.round(e.y - oy) - 2, 3, 2);
    },
  };

  /* SUBMERGER: burrower variant that hides in water. */
  AI.submerger = {
    init(e) { e.mem.phase = 'up'; e.mem.pt = 1; },
    update(e, dt, g) {
      const inWater = g.terrain.isWater(e.x, e.y);
      const t = e.target;
      e.mem.pt -= dt;
      if (e.submerged) {
        if (t) { const d = e.moveToward(t.x, t.y, 1.1, dt); e.faceMove(dt); if (d < 170 || !inWater) { e.submerged = false; e.targetable = true; e.mem.pt = U.range(3, 5); AS.FX.dust(e.x, e.y, 8, '#cfeee8', 60); AS.Audio.sfx('splash', { x: e.x, y: e.y }); } }
        else e.brake(dt);
        return;
      }
      AI.skirmish.update(e, dt, g);
      if (inWater && e.mem.pt <= 0 && t) { e.submerged = true; e.targetable = false; e.mem.pt = 2; AS.FX.dust(e.x, e.y, 8, '#cfeee8', 50); AS.Audio.sfx('splash', { x: e.x, y: e.y, vol: 0.5 }); }
    },
    drawHidden(e, ctx, ox, oy) {
      ctx.strokeStyle = 'rgba(220,250,245,0.5)';
      const r = 4 + (e.t * 8) % 8;
      ctx.beginPath(); ctx.ellipse(Math.round(e.x - ox), Math.round(e.y - oy), r, r * 0.6, 0, 0, TAU); ctx.stroke();
    },
  };

  /* TANK: hold preferred range, circle-strafe, use cover when hurt, retreat to repair. */
  AI.tank = {
    update(e, dt, g) {
      const t = e.target, w = e.def.weapon;
      if (!t) {
        if (leashed(e, g)) e.moveToward(e.home.x, e.home.y, 0.7, dt);
        else idle(e, dt, g, e.patrol ? 0 : 90);
        e.faceMove(dt); e.gunAngle = U.turnToward(e.gunAngle, e.angle, dt * 2);
        separate(e, g, dt);
        return;
      }
      const d = U.dist(e.x, e.y, t.x, t.y);
      const keep = e.def.keepDist || 220;
      // retreat to a repair unit when badly damaged
      if (e.hp < e.maxHp * 0.3 && e.team === 'enemy') {
        const m = g.nearestOfKind(e.x, e.y, 'mender', 900);
        const tgt = m || e.home;
        if (U.dist(e.x, e.y, tgt.x, tgt.y) > 50) { e.moveToward(tgt.x, tgt.y, 1, dt); e.faceMove(dt); e.aimGun(t, dt); if (d < (w.range || 300)) e.tryFire(w, t, dt); separate(e, g, dt); return; }
      }
      // take cover after being hit
      if (g.time - e.lastHurt < 2.5 && e.hp < e.maxHp * 0.7 && !e.mem.cover && e.team === 'enemy') { e.mem.cover = findCover(e, g, t); e.mem.coverT = 3.5; }
      if (e.mem.cover) {
        e.mem.coverT -= dt;
        if (e.moveToward(e.mem.cover.x, e.mem.cover.y, 1, dt) < 10) e.brake(dt);
        if (e.mem.coverT <= 0) e.mem.cover = null;
      } else {
        e.mem.sT = (e.mem.sT || 0) - dt;
        if (e.mem.sT <= 0) { e.mem.sT = U.range(2, 4); e.mem.sDir = Math.random() < 0.5 ? 1 : -1; }
        const a = Math.atan2(e.y - t.y, e.x - t.x) + e.mem.sDir * 0.5;
        const want = d > keep + 50 ? keep * 0.8 : d < keep - 60 ? keep + 40 : keep;
        e.moveToward(t.x + Math.cos(a) * want, t.y + Math.sin(a) * want, d > keep + 50 ? 1 : 0.6, dt);
      }
      e.faceMove(dt);
      const off = e.aimGun(t, dt);
      if (off < 0.4) e.tryFire(w, t, dt);
      if (e.def.weapon2) e.tryFire(e.def.weapon2, t, dt, 2);
      separate(e, g, dt);
    },
  };

  /* SKIRMISHER: lighter ranged unit, keeps distance and shifts constantly. */
  AI.skirmish = {
    update(e, dt, g) {
      const t = e.target, w = e.def.weapon;
      if (!t) { idle(e, dt, g, 120); separate(e, g, dt); return; }
      const d = U.dist(e.x, e.y, t.x, t.y), keep = e.def.keepDist || 200;
      e.mem.sT = (e.mem.sT || 0) - dt;
      if (e.mem.sT <= 0) { e.mem.sT = U.range(1, 2.5); e.mem.sDir = Math.random() < 0.5 ? 1 : -1; }
      const a = Math.atan2(e.y - t.y, e.x - t.x) + e.mem.sDir * 0.8;
      const want = d < keep - 40 ? keep + 30 : keep;
      e.moveToward(t.x + Math.cos(a) * want, t.y + Math.sin(a) * want, 0.9, dt);
      e.faceMove(dt);
      e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x);
      e.tryFire(w, t, dt);
      separate(e, g, dt);
    },
  };

  /* INFANTRY: dash between cover, fire short bursts. */
  AI.infantry = {
    update(e, dt, g) {
      const t = e.target, w = e.def.weapon;
      if (!t) { idle(e, dt, g, 80); separate(e, g, dt); return; }
      e.mem.cT = (e.mem.cT || 0) - dt;
      if (e.mem.cT <= 0 || !e.mem.c) { e.mem.cT = U.range(2.5, 4.5); e.mem.c = findCover(e, g, t) || { x: t.x + U.range(-200, 200), y: t.y + U.range(-200, 200) }; }
      const d = U.dist(e.x, e.y, t.x, t.y);
      if (e.hp < e.maxHp * 0.4 && d < 140) { const a = Math.atan2(e.y - t.y, e.x - t.x); e.moveToward(e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80, 1, dt); }
      else if (e.moveToward(e.mem.c.x, e.mem.c.y, 1, dt) < 12) e.brake(dt);
      e.faceMove(dt);
      e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x);
      if (Math.hypot(e.vx, e.vy) < 30) e.tryFire(w, t, dt);
      separate(e, g, dt);
    },
  };

  /* ARTILLERY: hang back, shell predicted positions (telegraphed), relocate if approached. */
  AI.artillery = {
    update(e, dt, g) {
      const t = e.target, w = e.def.weapon;
      if (!t) { idle(e, dt, g, e.def.speed ? 60 : 0); return; }
      const d = U.dist(e.x, e.y, t.x, t.y);
      if (d < 200 && e.def.speed) { const a = Math.atan2(e.y - t.y, e.x - t.x); e.moveToward(e.x + Math.cos(a) * 120, e.y + Math.sin(a) * 120, 1, dt); }
      else e.brake(dt);
      e.faceMove(dt);
      e.aimGun(t, dt);
      if (d > 140) e.tryFire(w, t, dt);
    },
  };

  /* SAM: radar-dependent lock-on; long range only while a radar covers it. */
  AI.sam = {
    update(e, dt, g) {
      const t = e.target, w = e.def.weapon;
      if (!t) { e.mem.lock = 0; idle(e, dt, g, e.def.speed ? 50 : 0); return; }
      const covered = g.radarCovers(e.x, e.y);
      const range = covered ? w.range : w.range * 0.4;
      const d = U.dist(e.x, e.y, t.x, t.y);
      e.brake(dt);
      e.aimGun(t, dt);
      e.cd -= dt;
      if (d < range && e.cd <= 0) {
        e.mem.lock = (e.mem.lock || 0) + dt;
        if (t === g.player) g.lockWarn = Math.max(g.lockWarn, 0.2);
        if (Math.floor(e.mem.lock * 4) !== Math.floor((e.mem.lock - dt) * 4) && t === g.player) AS.Audio.sfx('lock_warn', { vol: 0.35 });
        if (e.mem.lock > 1.4) { e.mem.lock = 0; e.cd = 1 / w.rate; e.fire(w, t); }
      } else e.mem.lock = Math.max(0, (e.mem.lock || 0) - dt);
    },
  };

  /* REPAIR UNIT: tends damaged allies, keeps away from the player. */
  AI.repair = {
    update(e, dt, g) {
      const pl = g.player;
      if (pl && pl.alive && U.dist(e.x, e.y, pl.x, pl.y) < 170) {
        const a = Math.atan2(e.y - pl.y, e.x - pl.x);
        e.moveToward(e.x + Math.cos(a) * 100, e.y + Math.sin(a) * 100, 1, dt); e.faceMove(dt); e.mem.healing = null; return;
      }
      e.mem.sT = (e.mem.sT || 0) - dt;
      if (e.mem.sT <= 0) {
        e.mem.sT = 1;
        let best = null, bd = 600;
        for (const o of g.enemyUnitsNear(e.x, e.y, 600)) { if (o === e || o.hp >= o.maxHp * 0.95 || o.air) continue; const d = U.dist(e.x, e.y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
        e.mem.healing = best;
      }
      const h = e.mem.healing;
      if (h && h.alive) {
        if (e.moveToward(h.x, h.y, 1, dt) < 46) {
          e.brake(dt);
          h.hp = Math.min(h.maxHp, h.hp + (e.def.heal || 8) * dt);
          if (Math.random() < 0.3) AS.Proj.zap(e.x, e.py, h.x, h.py, '#7dff9a', 0.5);
        }
      } else idle(e, dt, g, 100);
      e.faceMove(dt);
    },
  };

  /* DRONE: orbit the target in loose squads, firing as it circles. */
  AI.drone = {
    update(e, dt, g) {
      const t = e.target;
      if (e.mem.o === undefined) { e.mem.o = Math.random() * TAU; e.mem.dir = Math.random() < 0.5 ? 1 : -1; e.mem.R = U.range(120, 180); }
      const cx = t ? t.x : e.home.x, cy = t ? t.y : e.home.y;
      e.mem.o += dt * e.mem.dir * (t ? 0.9 : 0.4);
      const R = t ? e.mem.R : 90;
      e.moveToward(cx + Math.cos(e.mem.o) * R, cy + Math.sin(e.mem.o) * R, t ? 1 : 0.5, dt);
      if (t) { e.faceTo(t.x, t.y, dt, 2); e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x); e.tryFire(e.def.weapon, t, dt); }
      else e.faceMove(dt);
      separate(e, g, dt);
    },
  };

  /* FLOATER: hovering turret creature/machine, slow drift, rotating weapon. */
  AI.floater = {
    update(e, dt, g) {
      const t = e.target;
      const a = e.t * 0.3 + e.uid;
      e.moveToward(e.home.x + Math.cos(a) * 40, e.home.y + Math.sin(a * 1.3) * 30, 1, dt);
      if (t) { e.angle = U.turnToward(e.angle, Math.atan2(t.y - e.y, t.x - e.x), dt * 2); e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x); e.tryFire(e.def.weapon, t, dt); }
    },
  };

  /* INTERCEPTOR: high-speed attack runs — approach, strafe, overshoot, wheel around. */
  AI.interceptor = {
    update(e, dt, g) {
      const t = e.target, sp = e.def.speed;
      if (!e.mem.phase) e.mem.phase = 'run';
      let want;
      if (!t) { want = Math.atan2(e.home.y + Math.sin(e.t * 0.5) * 200 - e.y, e.home.x + Math.cos(e.t * 0.5) * 200 - e.x); }
      else {
        const d = U.dist(e.x, e.y, t.x, t.y);
        const toT = Math.atan2(t.y - e.y, t.x - e.x);
        if (e.mem.phase === 'run') {
          want = toT;
          if (d < 260 && Math.abs(U.wrapAngle(toT - e.angle)) < 0.35) { e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x); e.tryFire(e.def.weapon, t, dt); }
          if (d < 70) { e.mem.phase = 'pass'; e.mem.pt = U.range(0.9, 1.4); }
        } else if (e.mem.phase === 'pass') {
          want = e.angle; e.mem.pt -= dt;
          if (e.mem.pt <= 0) e.mem.phase = 'turn';
        } else {
          want = toT;
          if (Math.abs(U.wrapAngle(toT - e.angle)) < 0.3 && d > 220) e.mem.phase = 'run';
        }
        if (e.def.weapon2 && d < 500) e.tryFire(e.def.weapon2, t, dt, 2);
      }
      e.angle = U.turnToward(e.angle, want, e.def.turn * dt);
      const k = 1 - Math.exp(-3 * dt);
      e.vx += (Math.cos(e.angle) * sp - e.vx) * k; e.vy += (Math.sin(e.angle) * sp - e.vy) * k;
      if (Math.random() < 0.3) AS.Particles.spawn({ x: e.x - Math.cos(e.angle) * 10, y: e.y - Math.sin(e.angle) * 10, z: e.z, shape: AS.Particles.GLOW, col: e.organic ? '#9ff' : '#c58aff', size: 3, size2: 0.5, life: 0.2, add: true });
    },
  };

  /* STRAFER: ground version of attack runs (dune raiders). */
  AI.strafer = {
    update(e, dt, g) {
      const t = e.target;
      if (!t) { idle(e, dt, g, 160); return; }
      if (!e.mem.phase) e.mem.phase = 'run';
      const d = U.dist(e.x, e.y, t.x, t.y);
      if (e.mem.phase === 'run') {
        const side = (e.uid % 2 ? 1 : -1) * 60;
        const a = Math.atan2(t.y - e.y, t.x - e.x);
        e.moveToward(t.x - Math.sin(a) * side, t.y + Math.cos(a) * side, 1, dt);
        e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x);
        if (d < 280) e.tryFire(e.def.weapon, t, dt);
        if (d < 80) { e.mem.phase = 'out'; e.mem.pt = 1.4; e.mem.oa = Math.atan2(e.vy, e.vx); }
      } else {
        e.mem.pt -= dt;
        e.moveToward(e.x + Math.cos(e.mem.oa) * 100, e.y + Math.sin(e.mem.oa) * 100, 1, dt);
        if (e.mem.pt <= 0) e.mem.phase = 'run';
      }
      e.faceMove(dt);
    },
  };

  /* BOMBER: fly over the target and drop payloads, then loop back. */
  AI.bomber = {
    update(e, dt, g) {
      const t = e.target, sp = e.def.speed;
      let want;
      if (!t) want = Math.atan2(e.home.y + Math.sin(e.t * 0.4) * 160 - e.y, e.home.x + Math.cos(e.t * 0.4) * 160 - e.x);
      else {
        want = Math.atan2(t.y - e.y, t.x - e.x);
        const d = U.dist(e.x, e.y, t.x, t.y);
        if (d < 50) { e.cd -= dt; if (e.cd <= 0) { e.cd = 1 / e.def.weapon.rate; e.fire(e.def.weapon, t); } e.mem.over = 1.2; }
        if (e.mem.over > 0) { e.mem.over -= dt; want = e.angle; }
      }
      e.angle = U.turnToward(e.angle, want, e.def.turn * dt);
      const k = 1 - Math.exp(-2 * dt);
      e.vx += (Math.cos(e.angle) * sp - e.vx) * k; e.vy += (Math.sin(e.angle) * sp - e.vy) * k;
    },
  };

  /* SWARM: boid-like flock that harasses with contact stings. */
  AI.swarm = {
    update(e, dt, g) {
      const t = e.target;
      let ax = 0, ay = 0;
      if (t) { const a = Math.atan2(t.y - e.y, t.x - e.x); ax += Math.cos(a) * 1; ay += Math.sin(a) * 1; }
      else { const a = Math.atan2(e.home.y - e.y, e.home.x - e.x) + Math.sin(e.t + e.uid) * 1.5; ax += Math.cos(a) * 0.5; ay += Math.sin(a) * 0.5; }
      ax += Math.sin(e.t * 3 + e.uid) * 0.8; ay += Math.cos(e.t * 2.6 + e.uid * 2) * 0.8;
      for (const o of g.enemyUnitsNear(e.x, e.y, 30)) { if (o === e) continue; const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 1; ax += dx / d * 0.8; ay += dy / d * 0.8; }
      const sp = e.def.speed;
      const k = 1 - Math.exp(-3 * dt);
      e.vx += (ax * sp * 0.7 - e.vx) * k; e.vy += (ay * sp * 0.7 - e.vy) * k;
      e.faceMove(dt);
      if (t) {
        e.cd -= dt;
        if (e.cd <= 0 && U.dist(e.x, e.y, t.x, t.y) < (t.r || 10) + 14) { e.cd = 1 / e.def.weapon.rate; e.fire(e.def.weapon, t); }
      }
    },
  };

  /* AMBUSH: hidden until prey is close, then lunges from its lair. */
  AI.ambush = {
    init(e) { e.hidden = true; },
    update(e, dt, g) {
      const t = e.target;
      e.brake(dt);
      if (e.hidden) {
        e.anim = 0;
        if (t && U.dist(e.x, e.y, t.x, t.y) < 150) {
          e.hidden = false;
          AS.FX.dust(e.x, e.y, 14, g.world.terrain.ramp[2], 90);
          AS.Audio.sfx('roar', { x: e.x, y: e.y });
          if (t === g.player) g.player.warnOnce('ambush', 'unknown_lifeform', 30);
        }
        return;
      }
      if (!t) { e.anim = 0; return; }
      const d = U.dist(e.x, e.y, t.x, t.y), w = e.def.weapon;
      e.anim = 1 + Math.abs(Math.sin(e.t * 3)) * 2;
      e.cd -= dt;
      if (e.cd <= 0 && d < (w.range || 110) + 20) {
        e.cd = 1 / w.rate;
        if (t.takeDamage) t.takeDamage(w.dmg * (g.diffMul || 1), 'bio', e, Math.atan2(e.y - t.y, e.x - t.x));
        AS.Proj.zap(e.x, e.py, t.x, t.py !== undefined ? t.py : t.y, '#ff4a6a', 1.2);
        AS.Audio.sfx('bite', { x: e.x, y: e.y });
      }
    },
    hiddenAlpha() { return 0.18; },
  };

  /* WALKER: heavy, unhurried advance; never retreats; layered weapons. */
  AI.walker = {
    update(e, dt, g) {
      const t = e.target;
      if (!t) { if (leashed(e, g)) e.moveToward(e.home.x, e.home.y, 0.6, dt); else idle(e, dt, g, e.patrol ? 0 : 70); e.faceMove(dt); return; }
      const d = U.dist(e.x, e.y, t.x, t.y);
      if (d > 200) e.moveToward(t.x, t.y, 1, dt); else e.brake(dt);
      e.faceMove(dt);
      if (d <= 200) e.faceTo(t.x, t.y, dt);
      e.aimGun(t, dt);
      e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x);
      e.tryFire(e.def.weapon, t, dt);
      if (e.def.weapon2) {
        if (e.def.weapon2.k === 'leap' || e.def.weapon2.k === 'melee') { e.cd2 -= dt; if (e.cd2 <= 0 && d < (e.def.weapon2.range || 40) + 10) { e.cd2 = 1 / e.def.weapon2.rate; e.fire(e.def.weapon2, t); } }
        else e.tryFire(e.def.weapon2, t, dt, 2);
      }
      if (Math.hypot(e.vx, e.vy) > 10 && Math.floor(e.anim * 2) !== Math.floor((e.anim - dt * 2) * 2) && e.r > 13) { AS.FX.dust(e.x, e.y, 2, g.world.terrain.ramp[2], 30); if (e.r > 18) g.shakeNear(e.x, e.y, 0.06); }
      separate(e, g, dt);
    },
  };

  /* CONVOY: follows a path at its own pace (used for escort and intercept objectives). */
  AI.convoy = {
    update(e, dt, g) {
      if (!e.path || e.pi >= e.path.length) { e.brake(dt); if (!e.mem.arrived && e.path) { e.mem.arrived = true; g.emit('convoyArrived', e); } }
      else {
        if (e.mem.wait > 0) { e.mem.wait -= dt; e.brake(dt); }
        else if (!g.convoyGo(e)) e.brake(dt);
        else {
          const p = e.path[e.pi];
          if (e.moveToward(p[0], p[1], 1, dt) < 30) e.pi++;
          e.faceMove(dt);
        }
      }
      const t = e.target, w = e.def.weapon;
      if (t && w) { e.aimGun(t, dt); e.tryFire(w, t, dt); }
      if (e.def.model.anims > 1) e.anim += dt * 3;
    },
  };

  /* MINE: drifts toward prey and detonates. */
  AI.mine = {
    update(e, dt, g) {
      const t = e.target;
      if (!t) { idle(e, dt, g, 40); return; }
      const d = e.moveToward(t.x, t.y, 1, dt);
      if (d < (e.def.weapon.range || 34) + 6) e.fire(e.def.weapon, t);
    },
  };

  /* TURRET CREATURE: rooted organism with a rotating weapon. */
  AI.turretcreature = {
    update(e, dt, g) {
      e.brake(dt);
      const t = e.target;
      if (!t) return;
      const off = e.aimGun(t, dt);
      if (off < 0.3) e.tryFire(e.def.weapon, t, dt);
    },
  };

  /* GUNSHIP: holds station at standoff range, sliding sideways, heavy fire. */
  AI.gunship = {
    update(e, dt, g) {
      const t = e.target;
      if (!t) { AI.drone.update(e, dt, g); return; }
      if (e.mem.side === undefined) e.mem.side = 1;
      e.mem.sT = (e.mem.sT || 0) - dt;
      if (e.mem.sT <= 0) { e.mem.sT = U.range(3, 5); e.mem.side *= -1; }
      const a = Math.atan2(e.y - t.y, e.x - t.x) + e.mem.side * 0.6;
      e.moveToward(t.x + Math.cos(a) * 260, t.y + Math.sin(a) * 260, 0.8, dt);
      e.faceTo(t.x, t.y, dt);
      e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x);
      e.tryFire(e.def.weapon, t, dt);
      if (e.def.weapon2) e.tryFire(e.def.weapon2, t, dt, 2);
    },
  };

  /* ALLIED GROUND: advance along a route, engage hostiles in reach. */
  AI.allytank = {
    update(e, dt, g) {
      const t = e.target, w = e.def.weapon;
      if (t) {
        const d = U.dist(e.x, e.y, t.x, t.y);
        if (d > (e.def.keepDist || 240)) e.moveToward(t.x, t.y, 0.8, dt); else e.brake(dt);
        const off = e.aimGun(t, dt);
        if (off < 0.5) e.tryFire(w, t, dt);
      } else if (e.path && e.pi < e.path.length && g.convoyGo(e)) {
        const p = e.path[e.pi];
        if (e.moveToward(p[0], p[1], 0.8, dt) < 40) e.pi++;
        e.gunAngle = U.turnToward(e.gunAngle, e.angle, dt * 2);
      } else e.brake(dt);
      e.faceMove(dt);
      separate(e, g, dt);
    },
  };
  /* ALLIED AIR: escort the player and engage hostiles near it. */
  AI.allyair = {
    update(e, dt, g) {
      const pl = g.player;
      const t = e.target;
      if (e.mem.o === undefined) e.mem.o = Math.random() * TAU;
      e.mem.o += dt * 0.6;
      const cx = t ? t.x : (pl ? pl.x : e.home.x), cy = t ? t.y : (pl ? pl.y : e.home.y);
      e.moveToward(cx + Math.cos(e.mem.o) * 160, cy + Math.sin(e.mem.o) * 120, 1, dt);
      e.faceMove(dt);
      if (t) { e.gunAngle = Math.atan2(t.py - e.py, t.x - e.x); e.tryFire(e.def.weapon, t, dt); }
    },
  };

  AS.AI = AI;
})(window.AS);

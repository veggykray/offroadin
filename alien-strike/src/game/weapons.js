/* ALIEN STRIKE — player weapon behaviours (primary / secondary / special) and
 * the Hornet escort drones. Stats come from AS.Stats (weapon data × upgrades). */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  function podPos(p, side) {
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const ox = 3, oy = side ? -9 : 9;
    const x = p.x + ox * ca - oy * sa, y = p.y + ox * sa + oy * ca;
    // muzzle tip in projected space
    const a = p.aimAngle;
    return { x: x + Math.cos(a) * 9, y: y - p.z - 9 + Math.sin(a) * 9 };
  }

  function muzzle(p, pos, col) {
    AS.Particles.spawn({ x: pos.x, y: pos.y + 20, z: 20, shape: AS.Particles.GLOW, col, size: 4, size2: 9, life: 0.06, add: true });
    AS.Renderer.light(pos.x, pos.y, 22, col, 0.6);
  }

  // first target hit along a ray in projected space
  function rayHit(g, x1, y1, a, range, exclude) {
    const x2 = x1 + Math.cos(a) * range, y2 = y1 + Math.sin(a) * range;
    const cands = g.queryEnemies((x1 + x2) / 2, (y1 + y2) / 2, range / 2 + 40);
    let best = null, bestT = 1e9;
    const dx = Math.cos(a), dy = Math.sin(a);
    for (const e of cands) {
      if (!e.alive || !e.targetable || (exclude && exclude.has(e.uid))) continue;
      const ex = e.x - x1, ey = e.py - y1;
      const t = ex * dx + ey * dy;
      if (t < 0 || t > range) continue;
      const perp = Math.abs(ex * dy - ey * dx);
      if (perp < e.r + 3 && t < bestT) { bestT = t; best = e; }
    }
    return best ? { e: best, t: bestT } : null;
  }

  const Weapons = {
    update(p, dt) {
      const I = AS.Input, s = p.s, g = p.g;
      p.fireCd -= dt; p.secCd -= dt; p.specialCd -= dt;
      const P = s.primary;
      if (p.overheated > 0) { p.overheated -= dt; p.heat = Math.max(0, p.heat - P.cool * P.coolMul * 1.3 * dt); if (p.overheated <= 0) p.heat = Math.min(p.heat, 40); }
      else p.heat = Math.max(0, p.heat - P.cool * P.coolMul * dt * (p.firingPrimary ? 0.35 : 1));
      const busy = g.uiBlocking;
      const fireP = !busy && (I.mouse.l || I.padDown('firePrimary'));
      p.firingPrimary = false;
      this.primary(p, dt, fireP);
      const rHeld = !busy && (I.mouse.r || I.padDown('fireSecondary'));
      const rPressed = !busy && (I.mouse.rPressed || I.padHit('fireSecondary'));
      const rReleased = I.mouse.rReleased || (I.padPrev.fireSecondary && !I.padState.fireSecondary);
      this.secondary(p, dt, rHeld, rPressed, rReleased);
      if (!busy && I.hit('special')) this.special(p);
      // drones
      for (let i = p.drones.length - 1; i >= 0; i--) { const d = p.drones[i]; d.update(dt); if (d.dead) p.drones.splice(i, 1); }
      if (!fireP && p.beamOn) { p.beamOn = false; AS.Audio.stopLoop('beam'); }
    },

    /* ---------------- PRIMARY ---------------- */
    primary(p, dt, firing) {
      const P = p.s.primary, g = p.g;
      if (!firing) return;
      if (p.overheated > 0) { if (p.fireCd <= 0) { p.fireCd = 0.4; AS.Audio.sfx('dry', { vol: 0.4 }); } return; }
      if (p.ammo.primary <= 0) { if (p.fireCd <= 0) { p.fireCd = 0.35; AS.Audio.sfx('dry'); p.warnOnce('noammo', 'ammo_empty', 10); } return; }
      p.firingPrimary = true;
      if (P.kind === 'beam') return this.beam(p, dt, P);
      if (p.fireCd > 0) return;
      const rate = (P.rate || 1) * P.rateMul;
      p.fireCd = 1 / rate;
      const dmg = P.dmg * P.dmgMul;
      if (P.kind === 'bolt') {
        const pos = podPos(p, p.pod); p.pod ^= 1;
        const n = P.barrels;
        for (let i = 0; i < n; i++) {
          const off = n === 1 ? 0 : (i - (n - 1) / 2);
          const a = p.aimAngle + off * 0.05 + U.range(-P.spread, P.spread);
          const px = pos.x - Math.sin(p.aimAngle) * off * 3, py = pos.y + Math.cos(p.aimAngle) * off * 3;
          AS.Proj.bolt({ team: 'player', x: px, y: py, a, speed: P.speed, range: P.range, dmg, dtype: P.dtype, col: P.col, size: P.size, splash: P.splash, r: P.size + 1 });
        }
        muzzle(p, pos, P.col);
        p.ammo.primary -= 1;
        p.recoil = Math.min(2, p.recoil + 0.6);
        AS.Audio.sfx(P.sfx, { vol: 0.5, rate: U.range(0.94, 1.06) });
      } else if (P.kind === 'rail') {
        const pos = podPos(p, p.pod); p.pod ^= 1;
        const hits = new Set();
        let left = P.pierce, endT = P.range;
        for (let k = 0; k <= P.pierce && left >= 0; k++) {
          const h = rayHit(p.g, pos.x, pos.y, p.aimAngle, P.range, hits);
          if (!h) break;
          hits.add(h.e.uid);
          const dealt = h.e.takeDamage(dmg * (1 - k * 0.1), 'ap', p);
          g.onPlayerHit(h.e, dealt, null);
          AS.FX.impact(h.e.x, h.e.py, 0, P.col);
          left--; endT = h.t;
        }
        if (hits.size < 2) endT = P.range;
        const x2 = pos.x + Math.cos(p.aimAngle) * endT, y2 = pos.y + Math.sin(p.aimAngle) * endT;
        AS.Proj.zap(pos.x, pos.y, x2, y2, P.col, 1.4);
        for (let i = 0; i < 26; i++) { const t = Math.random(); AS.Particles.spawn({ x: U.lerp(pos.x, x2, t), y: U.lerp(pos.y, y2, t) + 20, z: 20, vx: U.range(-10, 10), vy: U.range(-10, 10), shape: AS.Particles.DOT, col: '#ffffff', col2: P.col, size: 1, life: 0.5, add: true }); }
        muzzle(p, pos, P.col);
        p.ammo.primary -= 1;
        p.recoil = 4; p.vx -= Math.cos(p.aimAngle) * 30; p.vy -= Math.sin(p.aimAngle) * 30;
        g.camera.shake(0.15);
        AS.Audio.sfx('rail', { vol: 0.8 });
      } else if (P.kind === 'arc') {
        const pos = podPos(p, p.pod); p.pod ^= 1;
        let src = { x: pos.x, py: pos.y };
        const hit = new Set();
        // first target: closest to aim line within range
        const cands = g.queryEnemies(pos.x, pos.y, P.range + 20);
        let first = null, best = 1e9;
        for (const e of cands) {
          if (!e.alive || !e.targetable) continue;
          const d = U.dist(pos.x, pos.y, e.x, e.py);
          if (d > P.range) continue;
          const da = Math.abs(U.wrapAngle(Math.atan2(e.py - pos.y, e.x - pos.x) - p.aimAngle));
          if (da > 0.55) continue;
          const score = da * 200 + d;
          if (score < best) { best = score; first = e; }
        }
        if (!first) {
          AS.Proj.zap(pos.x, pos.y, pos.x + Math.cos(p.aimAngle) * P.range * 0.6, pos.y + Math.sin(p.aimAngle) * P.range * 0.6, P.col, 0.8);
        } else {
          let cur = first, k = 0;
          while (cur && k <= P.chains) {
            hit.add(cur.uid);
            AS.Proj.zap(src.x, src.py, cur.x, cur.py, P.col, 1);
            const dealt = cur.takeDamage(dmg * Math.pow(0.8, k), 'energy', p);
            g.onPlayerHit(cur, dealt, null);
            if (cur.mech) cur.stun = Math.max(cur.stun, P.stun);
            src = cur; k++;
            let nxt = null, nb = P.chainRange;
            for (const e of g.queryEnemies(cur.x, cur.py, P.chainRange)) {
              if (!e.alive || !e.targetable || hit.has(e.uid)) continue;
              const d = U.dist(cur.x, cur.py, e.x, e.py);
              if (d < nb) { nb = d; nxt = e; }
            }
            cur = nxt;
          }
        }
        muzzle(p, pos, P.col);
        p.ammo.primary -= 1;
        AS.Audio.sfx('arc', { vol: 0.7, rate: U.range(0.9, 1.1) });
      }
      p.heat += (P.heat || 5) * P.heatMul;
      if (p.heat >= 100) { p.heat = 100; p.overheated = 1.6; AS.Audio.sfx('overheat'); p.warnOnce('overheat', 'overheat', 20); }
      g.noise(p.x, p.y, 420);
      if (p.ammo.primary <= P.ammoMax * 0.15 && p.ammo.primary + 1 > P.ammoMax * 0.15) p.g.say('ammo_low');
    },

    beam(p, dt, P) {
      const g = p.g;
      const pos = podPos(p, 0);
      if (!p.beamOn) { p.beamOn = true; AS.Audio.startLoop('beam', 'beam_loop', 0.5); }
      const h = rayHit(g, pos.x, pos.y, p.aimAngle, P.range);
      const L = h ? h.t : P.range;
      p.beam = { x1: pos.x, y1: pos.y, x2: pos.x + Math.cos(p.aimAngle) * L, y2: pos.y + Math.sin(p.aimAngle) * L, t: 0.05 };
      if (h) {
        const dealt = h.e.takeDamage(P.dps * P.dmgMul * dt, 'energy', p);
        p.beamAcc = (p.beamAcc || 0) + dealt;
        if (p.beamAcc > 6) { g.onPlayerHit(h.e, p.beamAcc, null); p.beamAcc = 0; }
        if (Math.random() < 0.5) AS.FX.impact(p.beam.x2, p.beam.y2, 0, P.col);
      }
      p.ammo.primary = Math.max(0, p.ammo.primary - P.drain * dt);
      p.heat += P.heat * P.heatMul * dt;
      if (p.heat >= 100) { p.heat = 100; p.overheated = 1.8; AS.Audio.sfx('overheat'); p.beamOn = false; AS.Audio.stopLoop('beam'); p.warnOnce('overheat', 'overheat', 20); }
      AS.Renderer.light(pos.x, pos.y, 20, P.col, 0.6);
      AS.Renderer.light(p.beam.x2, p.beam.y2, 26, P.col, 0.5);
      g.noise(p.x, p.y, 380);
    },

    /* ---------------- SECONDARY ---------------- */
    secondary(p, dt, held, pressed, released) {
      const S = p.s.secondary, g = p.g;
      // prune dead locks
      p.locks = p.locks.filter((e) => e.alive && !e.burrowed && U.dist(p.x, p.y, e.x, e.y) < S.range * 1.15);
      if (S.kind === 'missile') {
        if (held && p.ammo.secondary > 0) {
          p.rDown += dt;
          if (p.locks.length < Math.min(S.multi, p.ammo.secondary)) {
            const c = this.lockCandidate(p, S);
            if (c && c === p.lockCand) {
              p.lockT += dt;
              if (p.lockT >= S.lockTime * S.lockMul) { p.locks.push(c); p.lockT = 0; p.lockCand = null; AS.Audio.sfx('lock'); }
              else if (Math.floor(p.lockT * 10) !== Math.floor((p.lockT - dt) * 10)) AS.Audio.sfx('lock_tick', { vol: 0.3 });
            } else { p.lockCand = c; p.lockT = 0; }
          } else { p.lockCand = null; p.lockT = 0; }
        }
        if (released) {
          if (p.ammo.secondary <= 0) { AS.Audio.sfx('dry'); p.warnOnce('nomissiles', 'missiles_empty', 15); }
          else if (p.locks.length) {
            p.locks.forEach((t, i) => { if (p.ammo.secondary > 0) this.launchMissile(p, S, t, i); });
          } else if (p.secCd <= 0) this.launchMissile(p, S, null, 0);
          p.locks = []; p.lockT = 0; p.lockCand = null; p.rDown = 0;
        }
        if (!held && !released) { p.rDown = 0; p.lockCand = null; p.lockT = 0; }
      } else if (S.kind === 'swarm') {
        if (pressed && p.secCd <= 0) {
          if (p.ammo.secondary <= 0) { AS.Audio.sfx('dry'); return; }
          p.ammo.secondary--; p.secCd = 0.8;
          const targets = g.queryEnemies(p.aimX, p.aimY, 260).filter((e) => e.alive && e.targetable && !e.burrowed && U.dist(p.x, p.y, e.x, e.y) < S.range)
            .sort((a, b) => U.dist(a.x, a.py, p.aimX, p.aimY) - U.dist(b.x, b.py, p.aimX, p.aimY));
          for (let i = 0; i < S.count; i++) {
            const t = targets.length ? targets[i % targets.length] : null;
            const pos = podPos(p, i % 2);
            AS.Proj.missile({ type: 'swarmlet', team: 'player', x: pos.x, y: pos.y, a: p.aimAngle + (i - S.count / 2) * 0.35, speed0: 200, speed: S.speed, turn: S.turn, life: 2.6,
              dmg: S.dmg * S.dmgMul, splash: S.splash * S.splashMul, target: t, tx: p.aimX + U.range(-30, 30), ty: p.aimY + U.range(-30, 30), col: S.col, r: 4 });
          }
          AS.Audio.sfx('swarm');
          g.noise(p.x, p.y, 500);
        }
      } else if (S.kind === 'emp') {
        if (pressed && p.secCd <= 0) {
          if (p.ammo.secondary <= 0) { AS.Audio.sfx('dry'); return; }
          p.ammo.secondary--; p.secCd = 1;
          const pos = podPos(p, 0);
          const d = Math.min(S.range, U.dist(pos.x, pos.y, p.aimX, p.aimY));
          const b = AS.Proj.bolt({ type: 'emp', team: 'player', x: pos.x, y: pos.y, a: p.aimAngle, speed: S.speed, range: Math.max(40, d), dmg: S.dmg * S.dmgMul, dtype: 'energy', col: S.col, size: 4, r: 6 });
          b.radius = S.radius * S.splashMul; b.stun = S.stun;
          AS.Audio.sfx('emp_fire');
        }
      }
    },
    lockCandidate(p, S) {
      const g = p.g;
      let best = null, bd = 64;
      for (const e of g.queryEnemies(p.aimX, p.aimY, 90)) {
        if (!e.alive || !e.targetable || e.burrowed || p.locks.includes(e)) continue;
        if (U.dist(p.x, p.y, e.x, e.y) > S.range) continue;
        const d = U.dist(e.x, e.py, p.aimX, p.aimY) - e.r;
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    },
    launchMissile(p, S, target, i) {
      const pos = podPos(p, i % 2);
      p.ammo.secondary--; p.secCd = 0.25;
      AS.Proj.missile({ team: 'player', x: pos.x, y: pos.y, a: p.aimAngle + (i % 2 ? 0.5 : -0.5) * (i ? 1 : 0.3), speed0: 160, speed: S.speed, turn: S.turn, life: 3.2,
        dmg: S.dmg * S.dmgMul, splash: S.splash * S.splashMul, target, tx: p.aimX, ty: p.aimY, col: S.col, r: 5 });
      AS.Audio.sfx('missile', { rate: U.range(0.95, 1.05) });
      p.g.noise(p.x, p.y, 520);
      if (p.ammo.secondary === 0) p.warnOnce('nomissiles', 'missiles_empty', 15);
    },

    /* ---------------- SPECIAL ---------------- */
    special(p) {
      const X = p.s.special, g = p.g;
      if (p.specialCd > 0) { AS.Audio.sfx('denied', { vol: 0.4 }); return; }
      if (p.ammo.special <= 0) { AS.Audio.sfx('dry'); p.warnOnce('nospecial', 'special_empty', 15); return; }
      const R = (X.radius || 100) * X.radiusMul;
      const dmg = (X.dmg || 0) * X.dmgMul;
      // aim ground point (clamped to range)
      let gx = p.aimX, gy = p.aimY + 8;
      const d = U.dist(p.x, p.y, gx, gy);
      const maxR = X.range || 380;
      if (d > maxR) { gx = p.x + (gx - p.x) / d * maxR; gy = p.y + (gy - p.y) / d * maxR; }
      const T = 0.35 + Math.min(1, d / maxR) * (X.flight || 0.6);
      switch (X.kind) {
        case 'bomb': AS.Proj.lob({ team: 'player', sx: p.x, sy: p.y, sz: p.z, gx, gy, T, arc: 50, land: 'plasma', dmg, radius: R, col: X.col, size: 4, owner: p }); break;
        case 'gravitic': AS.Proj.lob({ team: 'player', sx: p.x, sy: p.y, sz: p.z, gx, gy, T, arc: 50, land: 'gravitic', dmg, radius: R, col: X.col, size: 4, owner: p, extra: { pull: X.pull } }); break;
        case 'orbital': AS.Proj.lob({ team: 'player', sx: p.x, sy: p.y, sz: p.z, gx, gy, T, arc: 40, land: 'beacon', dmg, radius: R, col: '#ff4a4a', size: 2, owner: p, extra: { delay: X.delay } }); g.say('orbital_inbound'); break;
        case 'bloom': AS.Proj.lob({ team: 'player', sx: p.x, sy: p.y, sz: p.z, gx, gy, T, arc: 50, land: 'bloom', dmg: X.dps * X.dmgMul, radius: R, col: X.col, size: 4, owner: p, extra: { life: X.life } }); break;
        case 'mine': {
          const bx = p.x - Math.cos(p.angle) * 18, by = p.y - Math.sin(p.angle) * 18;
          AS.Proj.lob({ team: 'player', sx: bx, sy: by, sz: p.z, gx: bx, gy: by, T: 0.35, arc: 0, land: 'mine', dmg, radius: (X.radius || 70) * X.radiusMul, col: X.col, size: 2, owner: p });
          break;
        }
        case 'drones':
          for (let i = 0; i < X.count; i++) p.drones.push(new Drone(p, i, X));
          g.msg('HORNET DRONES DEPLOYED', '#9fe8ff', 1.5);
          break;
        case 'disruptor': {
          AS.Particles.spawn({ x: p.x, y: p.y, z: p.z, shape: AS.Particles.RING, col: '#7af0ff', size: 10, size2: R, life: 0.5, add: true, keep: true });
          AS.Particles.spawn({ x: p.x, y: p.y, z: p.z, shape: AS.Particles.GLOW, col: '#7af0ff', size: 30, size2: R * 0.7, life: 0.4, add: true, keep: true });
          for (const e of g.queryEnemies(p.x, p.py, R + 60)) {
            if (!e.alive || U.dist(e.x, e.y, p.x, p.y) > R) continue;
            e.shield = 0;
            if (e.mech) e.stun = Math.max(e.stun, X.stun);
            if (e.def.role === 'shieldgen') e.domeDown = Math.max(e.domeDown || 0, 8);
            if (e.boss && e.bossShieldDown) e.bossShieldDown(4);
          }
          for (const m of AS.Proj.pool.active) if (m.team !== 'player' && U.dist(m.x, m.y, p.x, p.py) < R) m.life = 0;
          g.camera.shake(0.3); g.camera.flash(0.15, '#a0f8ff');
          break;
        }
      }
      p.ammo.special--;
      p.specialCd = (X.cooldown || 1) * X.cdMul;
      AS.Audio.sfx(X.kind === 'drones' ? 'drones' : X.kind === 'disruptor' ? 'disruptor' : 'launch_special');
      g.noise(p.x, p.y, 500);
    },
  };

  /* Hornet escort drone */
  class Drone {
    constructor(p, i, X) {
      this.p = p; this.i = i; this.X = X; this.life = X.life; this.hp = 30; this.dead = false;
      this.a = i * Math.PI; this.x = p.x; this.y = p.y; this.z = p.z + 6; this.cd = 0.5; this.target = null;
      this.sheet = AS.Forge.sheet('hornet', () => AS.Models.drone({ a: '#5a6470', b: '#b0bcc8', g: '#7fe8ff', d: '#262c34' }, { fins: 3, size: 0.6 }), 16, 1);
    }
    update(dt) {
      const p = this.p, g = p.g;
      this.life -= dt;
      if (this.life <= 0 || this.hp <= 0 || !p.alive) { this.dead = true; AS.FX.smallBoom(this.x, this.y, this.z, '#9fe8ff'); return; }
      this.a += dt * 2.2;
      const tx = p.x + Math.cos(this.a) * 34, ty = p.y + Math.sin(this.a) * 26;
      this.x = U.damp(this.x, tx, 6, dt); this.y = U.damp(this.y, ty, 6, dt); this.z = p.z + 8;
      this.cd -= dt;
      if (!this.target || !this.target.alive || U.dist(this.x, this.y, this.target.x, this.target.y) > 320) {
        this.target = null; let bd = 320;
        for (const e of g.queryEnemies(this.x, this.y - this.z, 320)) { if (!e.alive || !e.targetable || e.burrowed) continue; const d = U.dist(this.x, this.y, e.x, e.y); if (d < bd) { bd = d; this.target = e; } }
      }
      if (this.target && this.cd <= 0) {
        this.cd = 1 / this.X.rate;
        const sx = this.x, sy = this.y - this.z;
        const a = Math.atan2(this.target.py - sy, this.target.x - sx);
        AS.Proj.bolt({ team: 'player', x: sx, y: sy, a: a + U.range(-0.05, 0.05), speed: 700, range: 340, dmg: this.X.dmg * p.s.special.dmgMul, col: '#9fe8ff', size: 1.5 });
        AS.Audio.sfx('pulse', { vol: 0.2, rate: 1.4 });
      }
      AS.Renderer.light(this.x, this.y - this.z, 10, '#7fe8ff', 0.4);
    }
    draw(ctx, ox, oy, R) {
      const a = this.target ? Math.atan2(this.target.y - this.y, this.target.x - this.x) : this.a;
      R.sprite(ctx, this.sheet, a, 0, this.x, this.y, this.z, ox, oy);
    }
  }
  AS.Weapons = Weapons;
})(window.AS);

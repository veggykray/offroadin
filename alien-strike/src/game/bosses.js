/* ALIEN STRIKE — world bosses. Every encounter is built around an objective or
 * environmental mechanic rather than a bare health bar:
 *  W1 Basalt Maw ........ armoured burrower; seismic thumpers lure it up stunned
 *  W2 Kharad Worm ....... breaching sand-serpent; seismic charges in its vents stun it
 *  W3 Hive Queen ........ invulnerable while pheromone nodes live; spawns swarms
 *  W4 Prism Colossus .... resonator spires feed its lattice shield; sweeping beams
 *  W5 Abyssal Refinery .. mobile platform; destroy pump turrets, scan the core
 *  W6 Foundry Engine .... walking factory heading for the colony; kill coolant pumps
 *  W7 Mycelial Mind ..... spore roots shield it; scrambling spore pulses
 *  W8 Tempest Leviathan . sky serpent; lure it through charged lightning rods
 *  W9 The Warden ........ ancient machine; power couplings / rerouted grid drop shields
 *  W10 Heart of the Choir planetary lance core; pylons, lance strikes, waves */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const W = (k, o) => Object.assign({ k }, o);
  /* extra boss sheets (body segments, exposed cores): redesigned when the art map provides them */
  const segSheet = (slot, pal, fallback) => {
    const alt = AS.ArtMap && AS.ArtMap.gen(slot);
    return alt ? AS.Forge.sheet(slot + '2', () => AS.Models[alt.gen](alt.pal || pal, alt.opt || {}), alt.dirs || 1, alt.anims || 1)
      : AS.Forge.sheet(slot, fallback, 1, 1);
  };

  const DEFS = {
    maw: { name: 'THE BASALT MAW', cls: 'creature', ai: 'none', hp: 950, r: 30, hc: 12, speed: 120, turn: 2, organic: true, boss: true, sight: 2000,
      weapon: W('acid', { dmg: 7, range: 420, rate: 1, speed: 240, col: '#b6ff4a', dtype: 'bio' }), model: { gen: 'worm', pal: { a: '#3a3034', b: '#6a5a5a', t: '#d0a060', g: '#ff8a3a', d: '#1a1214' }, opt: { segs: 5, rad: 14, plates: 1 }, anims: 4, dirs: 16 }, salvage: 400, splat: '#c08040' },
    kharad: { name: 'KHARAD, THE DEEP MOUTH', cls: 'creature', ai: 'none', hp: 2000, r: 26, hc: 10, speed: 170, turn: 1.6, organic: true, boss: true, sight: 3000,
      weapon: W('acid', { dmg: 12, range: 400, rate: 1, speed: 280, col: '#ff9a4a', dtype: 'bio' }), model: { gen: 'worm', pal: { a: '#6a3a24', b: '#a8603a', t: '#e8c890', g: '#ffcf4a', d: '#2a140c' }, opt: { segs: 2, rad: 14, plates: 1 }, anims: 4, dirs: 16 }, salvage: 600, splat: '#d07030' },
    queen: { name: 'THE HIVE QUEEN', cls: 'air', ai: 'none', hp: 1900, r: 32, hc: 6, alt: 54, speed: 120, turn: 1.4, organic: true, boss: true, sight: 3000,
      weapon: W('acid', { dmg: 10, range: 420, rate: 1.4, speed: 260, col: '#d8ff4a', dtype: 'bio' }), model: { gen: 'insect', pal: { a: '#4a3a5a', b: '#8a6aa0', t: '#e0c0ff', g: '#ffef4a', d: '#1a1020' }, opt: { len: 22, wings: 1, wingCol: '#d8c8f0', glowSac: 1 }, anims: 4, dirs: 16 }, salvage: 700, splat: '#ffef4a' },
    prism: { name: 'THE PRISM COLOSSUS', cls: 'creature', ai: 'none', hp: 2200, r: 34, hc: 20, speed: 40, turn: 1, organic: true, boss: true, sight: 3000,
      weapon: W('plasma', { dmg: 9, range: 500, rate: 1, speed: 300, col: '#9ff6ff', dtype: 'energy' }), model: { gen: 'crystal', pal: { a: '#5a8ab0', b: '#cfeeff', t: '#ffffff', g: '#7ff', d: '#1a2a3a' }, opt: { len: 28 }, anims: 4, dirs: 16 }, salvage: 800, splat: '#bfe4ff' },
    refinery: { name: 'THE ABYSSAL REFINERY', cls: 'vehicle', ai: 'none', hp: 2000, r: 46, hc: 10, speed: 34, turn: 0.5, mech: true, boss: true, amphibious: true, sight: 3000,
      weapon: W('missile', { dmg: 14, range: 600, rate: 0.3, speed: 260, turn: 2.5, col: '#ff8af0' }), model: { gen: 'platform', pal: { a: '#3a4a4a', b: '#7a9090', t: '#e8a02a', g: '#ffd36b', d: '#141c1c' }, opt: { r: 50 }, dirs: 1 }, salvage: 900 },
    foundry: { name: 'THE FOUNDRY ENGINE', cls: 'vehicle', ai: 'none', hp: 2600, r: 60, hc: 24, speed: 22, turn: 0.4, mech: true, boss: true, sight: 3000,
      weapon: W('shell', { dmg: 24, range: 700, rate: 0.35, radius: 60, flight: 1.8, col: '#ff7a2a', burn: true }), model: { gen: 'crawler', pal: { a: '#3a3230', b: '#6a5a50', t: '#ff7a2a', g: '#ff9a3a', d: '#120c0a' }, opt: {}, anims: 4, dirs: 32 }, salvage: 1000 },
    mind: { name: 'THE MYCELIAL MIND', cls: 'creature', ai: 'none', hp: 2200, r: 40, hc: 30, speed: 0, turn: 0, organic: true, boss: true, sight: 3000,
      weapon: W('spore', { dmg: 6, range: 700, rate: 0.6, radius: 70, speed: 220, col: '#c58aff', dtype: 'bio', lob: true }), model: { gen: 'bigShroom', pal: { a: '#6a3a7a', b: '#b06ac8', t: '#e0a0f0', g: '#9ffff0' }, opt: { h: 70, r: 44, seed: 5 }, dirs: 1 }, salvage: 1100, splat: '#9ffff0' },
    tempest: { name: 'THE TEMPEST LEVIATHAN', cls: 'air', ai: 'none', hp: 2400, r: 30, hc: 4, alt: 60, speed: 200, turn: 1.1, organic: true, boss: true, sight: 4000,
      weapon: W('lightning', { dmg: 14, range: 240, rate: 0.8, col: '#cfe8ff', dtype: 'energy' }), model: { gen: 'ray', pal: { a: '#2a3a6a', b: '#5a7ac0', t: '#c0d8ff', g: '#9ff', d: '#10182a' }, opt: { span: 30 }, anims: 4, dirs: 16 }, salvage: 1200, splat: '#9ff' },
    warden: { name: 'THE WARDEN', cls: 'vehicle', ai: 'none', hp: 2800, r: 34, hc: 34, speed: 40, turn: 0.8, mech: true, boss: true, sight: 3000,
      weapon: W('beam', { dmg: 26, range: 520, rate: 0.35, charge: 1.0, col: '#ff6a3a', dtype: 'energy' }), weapon2: W('shell', { dmg: 20, range: 700, rate: 0.3, radius: 54, flight: 1.6, col: '#ff9a3a' }),
      model: { gen: 'walker', pal: { a: '#6a6458', b: '#a89c84', t: '#ff6a3a', g: '#ff6a3a', d: '#2a2620' }, opt: { legs: 4, lift: 20, size: 2.4, channels: 1 }, anims: 4, dirs: 16 }, salvage: 1300 },
    heart: { name: 'THE HEART OF THE CHOIR', cls: 'vehicle', ai: 'none', hp: 3200, r: 46, hc: 26, speed: 0, turn: 0, mech: true, boss: true, sight: 4000,
      weapon: W('plasma', { dmg: 10, range: 600, rate: 1.6, burst: 3, speed: 320, col: '#e0c8ff', dtype: 'energy' }), model: { gen: 'core', pal: { a: '#b8ae9a', b: '#e6dcc6', t: '#5a4f7a', g: '#c09aff', d: '#3a3446' }, opt: { r: 48 }, anims: 4, dirs: 1 }, salvage: 2000 },
  };

  class Boss extends AS.Unit {
    constructor(g, kind, def, x, y, o) {
      super(g, kind, def, x, y, Object.assign({ active: false }, o));
      this.boss = true; this.bossName = def.name;
      this.active = !!o.active; this.alwaysActive = true;
      this.shieldedBy = o.shieldedBy || [];
      this.vulnT = 0; this.phase = 0; this.st = 'idle'; this.stT = 0;
      this.o = o; this.parts = [];
      this.enraged = false;
      g.bossList = g.bossList || []; g.bossList.push(this);
      this.B = BEH[kind];
      if (this.B.init) this.B.init(this, g, o);
    }
    get py() { return this.y - this.z - this.leapZ - this.hc - (this.emergeOff || 0); }
    isShielded() {
      for (const id of this.shieldedBy) { const s = this.g.byId.get(id); if (s && s.alive) return true; }
      return false;
    }
    dmgMul() { return this.B.dmgMul ? this.B.dmgMul(this) : 1; }
    takeDamage(amount, dtype, src, opts) {
      if (!this.active && this.alive) this.bossAct('activate');
      if (this.isShielded()) { AS.FX.impact(this.x, this.py, 0, '#c8a0ff'); this.shieldHit = 0.2; return 0; }
      return super.takeDamage(amount * this.dmgMul(), dtype, src, opts);
    }
    onHurt(d) { this.lastHurt = this.g.time; if (!this.enraged && this.hp < this.maxHp * 0.5) { this.enraged = true; AS.Audio.sfx('roar', { x: this.x, y: this.y }); this.g.camera.shake(0.4); } }
    bossAct(act, a) {
      const g = this.g;
      if (act === 'activate' && !this.active) {
        this.active = true; g.bossActive = this; g.musicOverride = 'boss';
        AS.Music.stinger && AS.Music.setIntensity(3);
        g.say(this.o.introLine || 'boss_warning');
        g.camera.pulseZoom(-0.08, 2.5); g.camera.shake(0.5);
        AS.Audio.sfx('roar', { vol: 0.9 });
        if (this.B.onActivate) this.B.onActivate(this, g);
      } else if (this.B.act) this.B.act(this, act, a || {}, g);
    }
    update(dt) {
      const g = this.g;
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.shieldHit > 0) this.shieldHit -= dt;
      if (this.vulnT > 0) this.vulnT -= dt;
      if (this.stun > 0) this.stun -= dt;
      const p = g.player;
      if (!this.active) {
        if (p && p.alive && U.dist(p.x, p.y, this.x, this.y) < (this.o.wake || 520) && !this.o.manual) this.bossAct('activate');
        if (this.B.idle) this.B.idle(this, dt, g);
        this.anim += dt * 2;
        return;
      }
      this.target = p && p.alive && p.dying <= 0 ? p : null;
      this.B.update(this, dt, g);
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.x = U.clamp(this.x, 30, g.map.w - 30); this.y = U.clamp(this.y, 30, g.map.h - 30);
      this.anim += dt * 4;
      for (const pt of this.parts) { if (pt.alive || pt.ruin) { const a = this.angle * (this.B.rotParts ? 1 : 0); pt.x = this.x + pt.ox * Math.cos(a) - pt.oy * Math.sin(a); pt.y = this.y + pt.ox * Math.sin(a) + pt.oy * Math.cos(a); } }
      if (this.isShielded() && Math.random() < 0.3) AS.Renderer.light(this.x, this.py, this.r * 1.6, '#9a6aff', 0.25);
    }
    die(src) {
      const g = this.g;
      this.removed = true;
      g.bossActive = null; g.musicOverride = null;
      for (let i = 0; i < 8; i++) g.later(i * 0.18, () => { AS.FX.explosion(this.x + U.range(-this.r, this.r), this.y + U.range(-this.r, this.r) * 0.6, this.hc * Math.random() + this.z, this.r * 0.6, { col2: this.def.splat || undefined }); AS.Audio.sfx('explode_big', { x: this.x, y: this.y, rate: U.range(0.8, 1.1) }); });
      g.later(1.5, () => { AS.FX.explosion(this.x, this.y, this.z + 4, this.r * 2, { col2: this.def.splat || '#ff7a2a' }); AS.FX.shockwave(this.x, this.y, this.r * 6); g.camera.flash(0.5, '#fff0d8'); g.camera.shake(1); g.terrain.addDecal('crater', this.x, this.y, this.r * 1.6); });
      if (this.organic) g.terrain.addDecal('splat', this.x, this.y, this.r * 2, this.def.splat);
      g.camera.pulseZoom(-0.1, 3);
      g.stats.salvage += this.def.salvage || 0;
      g.spawnPickup('tech', this.x, this.y, { dropped: true }); g.spawnPickup('tech', this.x, this.y, { dropped: true });
      for (let i = 0; i < 4; i++) g.spawnPickup('salvage', this.x, this.y, { dropped: true, value: 60 });
      g.say(this.o.deathLine || 'objective_destroyed');
      g.onUnitKilled(this, src);
      if (this.B.onDeath) this.B.onDeath(this, g);
    }
    statusText() { return this.B.status ? this.B.status(this) : ''; }
    extraDrawables(list) { if (this.alive && this.B.overlay) list.push({ sortY: 1e9, draw: (ctx, ox, oy, R) => this.B.overlay(this, ctx, ox, oy, R) }); }
    drawShadow(ctx, ox, oy) { if (this.B.drawShadow) return this.B.drawShadow(this, ctx, ox, oy); if (this.st === 'under') return; super.drawShadow(ctx, ox, oy); }
    draw(ctx, ox, oy, R) {
      if (this.B.draw) this.B.draw(this, ctx, ox, oy, R);
      else super.draw(ctx, ox, oy, R);
      if (this.isShielded()) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + Math.sin(this.t * 3) * 0.05 + (this.shieldHit > 0 ? 0.25 : 0);
        ctx.fillStyle = '#9a6aff'; ctx.beginPath(); ctx.ellipse(this.x - ox, this.py - oy, this.r + 14, this.r + 10, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      if (this.vulnT > 0) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(this.t * 12) * 0.3; ctx.strokeStyle = '#ff4a3a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(this.x - ox, this.py - oy, this.r + 10, this.r + 7, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    }
  }

  /* helper: emerge-from-ground draw (sprite sinks below the ground line) */
  function drawEmerging(b, ctx, ox, oy, R, k) {
    const sh = b.sheet;
    const di = AS.Forge.frameIndex(sh, b.angle), ai = Math.floor(b.anim) % sh.anims;
    const img = sh.frames[ai][di];
    const sink = (1 - k) * (sh.h - 4);
    ctx.save();
    ctx.beginPath(); ctx.rect(Math.round(b.x - ox - sh.ax - 4), Math.round(b.y - oy - sh.ay - 60), sh.w + 8, sh.ay + 60 + 4); ctx.clip();
    ctx.drawImage(img, b.x - ox - sh.ax, b.y - oy - sh.ay + sink, sh.w, sh.h);
    if (b.flash > 0) R.flashSprite(ctx, sh, b.angle, b.anim, b.x, b.y, -sink, ox, oy);
    ctx.restore();
    // churned ground ring
    ctx.fillStyle = 'rgba(30,20,14,0.5)';
    ctx.beginPath(); ctx.ellipse(Math.round(b.x - ox), Math.round(b.y - oy + 2), b.r * 1.3, b.r * 0.8, 0, 0, TAU); ctx.fill();
  }
  function fan(b, w, n, spread) {
    const t = b.target; if (!t) return;
    const base = Math.atan2(t.py - b.py, t.x - b.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      AS.Proj.bolt({ team: 'enemy', x: b.x, y: b.py, a, speed: w.speed || 260, range: (w.range || 400) * 1.3, dmg: w.dmg * (b.g.diffMul || 1), dtype: w.dtype || 'bio', col: w.col, size: 4, r: 5, owner: b, arc: 16 });
    }
    AS.Audio.sfx('spit', { x: b.x, y: b.y, vol: 0.8, rate: 0.7 });
  }
  function moveTo(b, tx, ty, sp, dt) {
    const a = Math.atan2(ty - b.y, tx - b.x), d = U.dist(b.x, b.y, tx, ty);
    const k = 1 - Math.exp(-3 * dt);
    const v = Math.min(sp, d * 2);
    b.vx += (Math.cos(a) * v - b.vx) * k; b.vy += (Math.sin(a) * v - b.vy) * k;
    return d;
  }

  const BEH = {
    /* ---------------- W1: THE BASALT MAW ---------------- */
    maw: {
      init(b) { b.st = 'under'; b.stT = 2; b.targetable = false; b.burrowed = true; b.emerge = 0; },
      // the campaign's first boss: a forgiving damage curve and a long stun window
      dmgMul(b) { return b.vulnT > 0 ? 2.2 : 0.5; },
      surface(b, g, stunned) {
        b.st = 'up'; b.stT = stunned ? 10 : 5; b.targetable = true; b.burrowed = false;
        if (stunned) { b.vulnT = 10; g.msg('THE MAW IS STUNNED — ATTACK NOW', '#ff8a5a', 3); g.say('maw_stunned'); }
        AS.FX.dust(b.x, b.y, 30, '#8a6a4a', 140); AS.FX.shockwave(b.x, b.y, 110);
        AS.Audio.sfx('roar', { x: b.x, y: b.y }); AS.Audio.sfx('burrow', { x: b.x, y: b.y });
        g.camera.shake(0.6);
        const p = g.player;
        if (p && U.dist(p.x, p.y, b.x, b.y) < 90 && !stunned) p.takeDamage(10, 'impact', b);
        // surfacing on its own: remind the player how to break the armour (throttled)
        if (!stunned && g.time - (b.hintT || -99) > 14) { b.hintT = g.time; g.msg('ARMOURED — HOLD E AT A SEISMIC THUMPER TO STUN THE MAW', '#ffc35a', 4); }
        g.terrain.addDecal('crater', b.x, b.y, 40);
      },
      update(b, dt, g) {
        b.stT -= dt;
        const t = b.target;
        if (b.st === 'under') {
          b.emerge = Math.max(0, b.emerge - dt * 2);
          const goal = b.lure || (t ? { x: t.x + Math.cos(b.t) * 60, y: t.y + Math.sin(b.t) * 60 } : null);
          if (goal) { const d = moveTo(b, goal.x, goal.y, b.lure ? 220 : (b.enraged ? 150 : 115), dt); b.angle = Math.atan2(b.vy, b.vx);
            if (Math.random() < 0.6) AS.FX.dust(b.x + U.range(-12, 12), b.y + U.range(-8, 8), 2, '#8a6a4a', 50);
            if (Math.random() < 0.05) g.shakeNear(b.x, b.y, 0.15);
            if (b.lure && d < 30) { b.lure = null; b.vx = b.vy = 0; BEH.maw.surface(b, g, true); }
            else if (!b.lure && b.stT <= 0 && d < 120) { b.vx = b.vy = 0; BEH.maw.surface(b, g, false); } }
        } else if (b.st === 'up') {
          b.emerge = Math.min(1, b.emerge + dt * 2.5);
          b.vx *= 0.9; b.vy *= 0.9;
          if (t && b.vulnT <= 0) {
            b.angle = U.turnToward(b.angle, Math.atan2(t.y - b.y, t.x - b.x), dt * 1.5);
            b.cd -= dt;
            if (b.cd <= 0) { b.cd = b.enraged ? 1.2 : 1.7; fan(b, b.def.weapon, b.enraged ? 5 : 4, 0.17); }
          } else if (b.vulnT > 0 && Math.random() < 0.2) AS.FX.sparks(b.x, b.py, 0, 2, '#ffd27a');
          if (b.stT <= 0) { b.st = 'under'; b.stT = U.range(3, 5); b.targetable = false; b.burrowed = true; AS.FX.dust(b.x, b.y, 20, '#8a6a4a', 100); AS.Audio.sfx('burrow', { x: b.x, y: b.y }); }
        }
        b.emergeOff = (1 - b.emerge) * 30;
      },
      act(b, act, a, g) { if (act === 'lure') { b.lure = { x: a.x, y: a.y }; if (b.st === 'up') { b.stT = 0.3; } g.msg('SEISMIC LURE ACTIVE — THE MAW IS COMING', '#ffc35a', 3); } },
      status(b) { return b.isShielded() ? 'SHIELDED' : b.vulnT > 0 ? 'STUNNED — ATTACK NOW  ' + Math.ceil(b.vulnT) + 's' : b.st === 'under' ? 'BURIED — HOLD E AT A SEISMIC THUMPER TO STUN IT' : 'ARMOURED — FIRE A THUMPER TO STUN IT'; },
      /* make the stun mechanic impossible to miss: a pulsing beacon and a HOLD E label on
         every ready thumper while the Maw is not already stunned */
      overlay(b, ctx, ox, oy, R) {
        if (b.vulnT > 0) return;
        const g = b.g, t = g.time;
        for (const id of ['th1', 'th2', 'th3']) {
          const c = g.byId.get(id);
          if (!c || c.locked) continue;
          const ready = !c.activated, x = c.x - ox, y = c.y - oy;
          const k = 0.5 + Math.sin(t * 4 + c.x) * 0.5;
          ctx.save();
          ctx.globalAlpha = ready ? 0.55 + k * 0.35 : 0.25;
          ctx.strokeStyle = ready ? '#ffc35a' : '#8a7a5a'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(x, y, 26 + k * 6, (26 + k * 6) * 0.72, 0, 0, U.TAU); ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.font = '700 8px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
          const txt = ready ? 'THUMPER · HOLD E TO STUN' : 'THUMPER RECHARGING';
          const w = ctx.measureText(txt).width + 10;
          ctx.fillStyle = 'rgba(6,12,18,0.82)'; ctx.fillRect(x - w / 2, y - 52, w, 12);
          ctx.fillStyle = ready ? '#ffc35a' : '#a89a7a'; ctx.fillText(txt, x, y - 43);
          ctx.restore();
          if (ready) R.light(c.x, c.y - 10, 40, '#ffc35a', 0.25 + k * 0.2);
        }
      },
      draw(b, ctx, ox, oy, R) {
        if (b.st === 'under' && b.emerge <= 0.01) { ctx.fillStyle = 'rgba(40,26,16,0.55)'; ctx.beginPath(); ctx.ellipse(Math.round(b.x - ox), Math.round(b.y - oy), 26, 14, 0, 0, TAU); ctx.fill(); return; }
        drawEmerging(b, ctx, ox, oy, R, b.emerge);
      },
      drawShadow() {},
    },

    /* ---------------- W2: KHARAD, THE DEEP MOUTH ---------------- */
    kharad: {
      init(b) {
        b.st = 'under'; b.stT = 3; b.targetable = false; b.burrowed = true; b.trail = []; b.segs = 9;
        b.segSheet = segSheet('kharad_seg', b.def.model.pal, () => AS.Models.puff({ a: '#6a3a24', b: '#a8603a', g: '#e8c890' }, { rad: 11 }));
      },
      dmgMul(b) { return b.vulnT > 0 ? 1.5 : b.st === 'breach' ? 0.45 : 0.2; },
      update(b, dt, g) {
        b.stT -= dt;
        const t = b.target;
        b.trail.unshift({ x: b.x, y: b.y, z: b.z }); if (b.trail.length > 90) b.trail.pop();
        if (b.st === 'under') {
          b.z = U.damp(b.z, -30, 4, dt);
          const goal = b.lure || (t ? { x: t.x + t.vx * 0.8, y: t.y + t.vy * 0.8 } : null);
          if (goal) {
            const d = moveTo(b, goal.x, goal.y, b.lure ? 260 : 190, dt);
            b.angle = Math.atan2(b.vy, b.vx);
            if (Math.random() < 0.8) AS.FX.dust(b.x, b.y, 2, '#c4703a', 60);
            if (b.lure && d < 40) { b.lure = null; b.vx = b.vy = 0; b.st = 'stunned'; b.stT = 8; b.vulnT = 8; b.targetable = true; b.burrowed = false; b.z = 0; AS.FX.explosion(b.x, b.y, 2, 40, { col2: '#c4703a' }); g.msg('KHARAD IS STUNNED — HIT THE HEAD', '#ff8a5a', 3); g.say('kharad_stunned'); g.camera.shake(0.8); }
            else if (!b.lure && b.stT <= 0 && d < 260) { b.st = 'breach'; b.stT = 2.4; b.targetable = true; b.burrowed = false; b.bA = Math.atan2(t.y - b.y, t.x - b.x); AS.Audio.sfx('roar', { x: b.x, y: b.y }); AS.FX.dust(b.x, b.y, 24, '#c4703a', 120); g.shakeNear(b.x, b.y, 0.5); }
          }
        } else if (b.st === 'breach') {
          const k = 1 - b.stT / 2.4;
          b.z = Math.sin(k * Math.PI) * 70 - 6;
          b.vx = Math.cos(b.bA) * 260; b.vy = Math.sin(b.bA) * 260; b.angle = b.bA;
          if (k > 0.3 && k < 0.7) { b.cd -= dt; if (b.cd <= 0) { b.cd = 0.25; fan(b, b.def.weapon, 3, 0.25); } }
          // crushing body: any segment overlapping the craft
          const p = g.player;
          if (p && p.alive) for (let i = 0; i < b.trail.length; i += 9) { const s = b.trail[i]; if (s.z > -5 && U.dist(s.x, s.y - s.z, p.x, p.py) < 22) { if (!b.hitT || g.time - b.hitT > 0.8) { b.hitT = g.time; p.takeDamage(14, 'impact', b); } break; } }
          if (b.stT <= 0) { b.st = 'under'; b.stT = U.range(2.5, 4); b.targetable = false; b.burrowed = true; AS.FX.dust(b.x, b.y, 24, '#c4703a', 120); }
        } else if (b.st === 'stunned') {
          b.vx *= 0.9; b.vy *= 0.9; b.z = U.damp(b.z, 6, 3, dt);
          if (Math.random() < 0.2) AS.FX.sparks(b.x, b.py, 0, 2, '#ffd27a');
          if (b.stT <= 0) { b.st = 'under'; b.stT = 3; b.targetable = false; b.burrowed = true; }
        }
      },
      act(b, act, a, g) { if (act === 'lure') { b.lure = { x: a.x, y: a.y }; b.st = 'under'; b.targetable = false; b.burrowed = true; g.msg('THE CHARGE DETONATED — KHARAD IS DRAWN TO THE VENT', '#ffc35a', 3); } },
      status(b) { return b.vulnT > 0 ? 'STUNNED — HIT THE HEAD' : b.st === 'breach' ? 'BREACHING — PLATED HIDE' : 'UNDERGROUND — DROP SEISMIC CHARGES INTO THE VENTS'; },
      draw(b, ctx, ox, oy, R) {
        // segments from the path history (only those above ground)
        for (let i = b.trail.length - 1; i > 0; i -= 9) {
          const s = b.trail[i]; if (s.z < -4) continue;
          const sh = b.segSheet, sc = 1 - i / 140;
          ctx.drawImage(sh.frames[0][0], s.x - ox - sh.ax * sc, s.y - s.z - oy - sh.ay * sc, sh.w * sc, sh.h * sc);
        }
        if (b.z > -8) R.sprite(ctx, b.sheet, b.angle, b.anim, b.x, b.y, Math.max(0, b.z), ox, oy);
        else { ctx.fillStyle = 'rgba(60,24,12,0.5)'; ctx.beginPath(); ctx.ellipse(b.x - ox, b.y - oy, 22, 12, 0, 0, TAU); ctx.fill(); }
        if (b.flash > 0 && b.z > -8) R.flashSprite(ctx, b.sheet, b.angle, b.anim, b.x, b.y, Math.max(0, b.z), ox, oy);
      },
      drawShadow(b, ctx, ox, oy) { if (b.z > 0) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(b.x - ox + b.z * 0.15, b.y - oy, 20, 10, 0, 0, TAU); ctx.fill(); } },
    },

    /* ---------------- W3: THE HIVE QUEEN ---------------- */
    queen: {
      dmgMul(b) { return b.dive ? 1.3 : 1; },
      update(b, dt, g) {
        const t = b.target;
        b.o2 = (b.o2 || 0) + dt * 0.35;
        const cx = b.home.x, cy = b.home.y;
        if (b.dive) {
          b.dive -= dt; b.z = U.damp(b.z, 18, 4, dt);
          if (t) { moveTo(b, t.x, t.y, 260, dt); if (U.dist(b.x, b.y, t.x, t.y) < 34 && (!b.hitT || g.time - b.hitT > 1)) { b.hitT = g.time; t.takeDamage(16, 'bio', b); } }
          if (b.dive <= 0) b.dive = 0;
        } else {
          b.z = U.damp(b.z, b.baseZ, 2, dt);
          moveTo(b, cx + Math.cos(b.o2) * 260, cy + Math.sin(b.o2) * 180, 140, dt);
        }
        b.angle = U.turnToward(b.angle, Math.atan2(b.vy, b.vx), dt * 2);
        b.cd -= dt; b.cd2 -= dt;
        if (t && b.cd <= 0) { b.cd = b.enraged ? 2.6 : 3.6; for (let i = 0; i < (b.enraged ? 8 : 6); i++) { const a = Math.random() * TAU, r = U.range(10, 140); AS.Proj.lob({ team: 'enemy', sx: b.x, sy: b.y, sz: b.z, gx: t.x + Math.cos(a) * r, gy: t.y + Math.sin(a) * r, T: U.range(1, 1.6), arc: 50, land: 'acid', dmg: 9, radius: 36, col: '#d8ff4a', size: 3, owner: b, warn: true, warnCol: '#d8ff4a' }); } AS.Audio.sfx('spore_launch', { x: b.x, y: b.y }); }
        if (b.cd2 <= 0) {
          b.cd2 = 7;
          const alive = g.units.filter((u) => u.kind === 'hivedrone' && u.alive).length;
          if (alive < 10) for (let i = 0; i < 4; i++) { const u = g.spawnUnit('hivedrone', b.x + U.range(-30, 30), b.y + U.range(-30, 30), { active: true }); if (u) { u.alerted = true; u.alertT = 30; } }
          if (!b.isShielded() && t && Math.random() < 0.6) { b.dive = 2.2; AS.Audio.sfx('screech', { x: b.x, y: b.y, rate: 0.6, vol: 1 }); }
        }
      },
      status(b) { return b.isShielded() ? 'PROTECTED BY PHEROMONE NODES' : b.dive ? 'DIVING — EXPOSED' : 'VULNERABLE'; },
    },

    /* ---------------- W4: THE PRISM COLOSSUS ---------------- */
    prism: {
      update(b, dt, g) {
        const t = b.target;
        if (t) moveTo(b, b.home.x + Math.cos(b.t * 0.2) * 120, b.home.y + Math.sin(b.t * 0.2) * 90, 40, dt);
        b.angle += dt * 0.3;
        b.cd -= dt; b.cd2 -= dt;
        // radial shard volleys
        if (b.cd <= 0) { b.cd = b.enraged ? 2.2 : 3.2; const n = b.enraged ? 14 : 10; for (let i = 0; i < n; i++) AS.Proj.bolt({ team: 'enemy', x: b.x, y: b.py, a: i / n * TAU + b.t, speed: 230, range: 600, dmg: 8, dtype: 'energy', col: '#9ff6ff', size: 3, r: 4, owner: b }); AS.Audio.sfx('glass_die', { x: b.x, y: b.y, vol: 0.5, rate: 1.5 }); }
        // sweeping beam
        if (b.cd2 <= 0 && t) { b.cd2 = b.enraged ? 4 : 6; b.sweep = { a0: Math.atan2(t.py - b.py, t.x - b.x) - 1.1, t: 0, dur: 2.6 }; AS.Audio.sfx('beam_charge', { x: b.x, y: b.y, vol: 1 }); }
        if (b.sweep) {
          const s = b.sweep; s.t += dt;
          const a = s.a0 + (s.t / s.dur) * 2.2, L = 520;
          b.beamLine = { x1: b.x, y1: b.py, x2: b.x + Math.cos(a) * L, y2: b.py + Math.sin(a) * L, live: s.t > 0.6 };
          const p = g.player;
          if (s.t > 0.6 && p && p.alive && U.segDist(p.x, p.py, b.x, b.py, b.beamLine.x2, b.beamLine.y2) < p.r + 5) { b.bh = (b.bh || 0) - dt; if (b.bh <= 0) { b.bh = 0.12; p.takeDamage(6, 'energy', b, a + Math.PI); } }
          if (s.t > 0.6) AS.Renderer.light(b.beamLine.x2, b.beamLine.y2, 30, '#9ff6ff', 0.5);
          if (s.t > s.dur) { b.sweep = null; b.beamLine = null; }
        }
        if (Math.random() < 0.02 && g.units.filter((u) => u.kind === 'stalker' && u.alive).length < 6) { const u = g.spawnUnit('stalker', b.x + U.range(-60, 60), b.y + U.range(-60, 60), { active: true }); if (u) u.alerted = true; }
      },
      status(b) { return b.isShielded() ? 'LATTICE SHIELD — DESTROY THE RESONATORS' : 'LATTICE BROKEN — VULNERABLE'; },
      draw(b, ctx, ox, oy, R) {
        AS.Unit.prototype.draw.call(b, ctx, ox, oy, R);
        AS.Renderer.light(b.x, b.py, 60, '#9ff6ff', 0.4);
        const l = b.beamLine;
        if (l) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = l.live ? 0.9 : 0.4; ctx.strokeStyle = '#9ff6ff'; ctx.lineWidth = l.live ? 6 : 1; if (!l.live) ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(l.x1 - ox, l.y1 - oy); ctx.lineTo(l.x2 - ox, l.y2 - oy); ctx.stroke(); if (l.live) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } ctx.restore(); }
      },
    },

    /* ---------------- W5: THE ABYSSAL REFINERY ---------------- */
    refinery: {
      rotParts: false,
      init(b, g, o) {
        b.path = o.path || null; b.pi = 0; b.submerged = false;
        const offs = [[-46, -30], [46, -30], [-46, 34], [46, 34]];
        offs.forEach((of, i) => {
          const s = g.spawnStructure('turret_heavy', b.x + of[0], b.y + of[1], { id: (o.id || 'boss') + '_pump' + i, noFlat: true });
          s.ox = of[0]; s.oy = of[1]; s.label = 'Pump Turret'; b.parts.push(s); b.shieldedBy.push(s.id);
        });
        b.coreSheet = segSheet('refcore', b.def.model.pal, () => AS.Models.refinery({ a: '#3a4a4a', b: '#7a9090', t: '#e8a02a', g: '#ffd36b', d: '#141c1c' }));
      },
      update(b, dt, g) {
        if (b.path && b.path.length) { const p = b.path[b.pi % b.path.length]; if (moveTo(b, p[0], p[1], b.def.speed, dt) < 40) b.pi++; }
        const t = b.target;
        b.cd -= dt; b.cd2 -= dt;
        if (t && b.cd <= 0) { b.cd = b.enraged ? 2.5 : 3.5; b.gunAngle = Math.atan2(t.py - b.py, t.x - b.x); b.fire(b.def.weapon, t); }
        if (t && b.cd2 <= 0) { b.cd2 = 1.6; b.gunAngle = Math.atan2(t.py - b.py, t.x - b.x); b.fire({ k: 'flak', dmg: 8, range: 450, radius: 32, speed: 340, col: '#ffe0a0' }, t); }
        AS.Renderer.light(b.x, b.y - 30, 50, '#ffd36b', 0.25);
        if (Math.random() < 0.3) AS.FX.smoke(b.x + 20, b.y - 4, 40, 8, true);
      },
      status(b) { return b.isShielded() ? 'CORE SEALED — DESTROY THE PUMP TURRETS' : 'CORE EXPOSED'; },
      draw(b, ctx, ox, oy, R) {
        const sh = b.sheet; ctx.drawImage(sh.frames[0][0], b.x - ox - sh.ax, b.y - oy - sh.ay, sh.w, sh.h);
        const c = b.coreSheet; ctx.drawImage(c.frames[0][0], b.x - ox - c.ax, b.y - oy - c.ay - 8, c.w, c.h);
        if (b.flash > 0) R.flashSprite(ctx, c, 0, 0, b.x, b.y, 8, ox, oy);
      },
      drawShadow() {},
    },

    /* ---------------- W6: THE FOUNDRY ENGINE ---------------- */
    foundry: {
      rotParts: true,
      init(b, g, o) {
        b.path = o.path || []; b.pi = 0;
        const offs = [[-30, -40], [-30, 40], [20, -40], [20, 40]];
        offs.forEach((of, i) => {
          const s = g.spawnStructure('coolant', b.x + of[0], b.y + of[1], { id: (o.id || 'boss') + '_cool' + i, noFlat: true });
          s.ox = of[0]; s.oy = of[1]; b.parts.push(s); b.shieldedBy.push(s.id);
        });
      },
      update(b, dt, g) {
        if (b.path.length && b.pi < b.path.length) {
          const p = b.path[b.pi];
          if (moveTo(b, p[0], p[1], b.def.speed * (b.enraged ? 1.3 : 1), dt) < 40) b.pi++;
          b.angle = U.turnToward(b.angle, Math.atan2(b.vy, b.vx), dt * 0.5);
        } else if (b.path.length && !b.arrived) { b.arrived = true; b.vx = b.vy = 0; g.emit('foundryArrived', b); }
        const t = b.target;
        b.cd -= dt; b.cd2 -= dt;
        if (t && b.cd <= 0) { b.cd = b.enraged ? 2 : 3; b.fire(b.def.weapon, t); }
        if (b.cd2 <= 0) { b.cd2 = 1.2; AS.Proj.field({ type: 'fire', x: b.x - Math.cos(b.angle) * 70, y: b.y - Math.sin(b.angle) * 70, r: 30, life: 6, team: 'enemy', dmg: 6 }); }
        if (Math.random() < 0.02 && g.units.filter((u) => u.kind === 'golem' && u.alive).length < 4) { const u = g.spawnUnit('golem', b.x - Math.cos(b.angle) * 60, b.y - Math.sin(b.angle) * 60, { active: true }); if (u) u.alerted = true; }
        if (Math.random() < 0.5) AS.FX.smoke(b.x - Math.cos(b.angle) * 30, b.y - Math.sin(b.angle) * 30, 44, 10, true);
        AS.Renderer.light(b.x, b.y - 30, 70, '#ff7a2a', 0.3);
        // crushing treads
        const p = g.player; if (p && p.alive && U.dist(p.x, p.y, b.x, b.y) < b.r && p.z < 30) p.takeDamage(20 * dt, 'impact', b);
      },
      status(b) { return b.isShielded() ? 'COOLANT PUMPS ACTIVE — CORE PROTECTED' : 'CORE OVERHEATING — VULNERABLE'; },
    },

    /* ---------------- W7: THE MYCELIAL MIND ---------------- */
    mind: {
      update(b, dt, g) {
        const t = b.target;
        b.cd -= dt; b.cd2 -= dt;
        if (t && b.cd <= 0) { b.cd = b.enraged ? 1.4 : 2; b.fire(b.def.weapon, t); if (b.enraged) b.fire(b.def.weapon, t); }
        if (b.cd2 <= 0) {
          b.cd2 = 9;
          b.pulse = 1.2;
          AS.Particles.spawn({ x: b.x, y: b.y, z: 10, shape: AS.Particles.RING, col: '#e0a0ff', size: 20, size2: 340, life: 1.2, add: true, keep: true });
          AS.Audio.sfx('gravitic', { x: b.x, y: b.y, rate: 0.7 });
          const p = g.player; if (p && U.dist(p.x, p.y, b.x, b.y) < 340) { g.hazards && (g.hazards.sporeHit(3.5)); p.takeDamage(6, 'bio', b); }
          if (g.units.filter((u) => u.kind === 'sporeling' && u.alive).length < 8) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; const u = g.spawnUnit('sporeling', b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 60, { active: true }); if (u) u.alerted = true; }
        }
        AS.Renderer.light(b.x, b.y - 50, 90, '#9ffff0', 0.3 + Math.sin(b.t * 2) * 0.1);
      },
      status(b) { return b.isShielded() ? 'ROOT-SHIELDED — BURN THE SPORE ROOTS' : 'EXPOSED'; },
      draw(b, ctx, ox, oy, R) { const sh = b.sheet, ai = Math.floor(b.anim) % sh.anims; ctx.drawImage(sh.frames[ai][0], b.x - ox - sh.ax, b.y - oy - sh.ay, sh.w, sh.h); if (b.flash > 0) R.flashSprite(ctx, sh, 0, ai, b.x, b.y, 0, ox, oy); },
      drawShadow() {},
    },

    /* ---------------- W8: THE TEMPEST LEVIATHAN ---------------- */
    tempest: {
      init(b) { b.trail = []; b.segSheet = segSheet('tempest_seg', b.def.model.pal, () => AS.Models.puff({ a: '#2a3a6a', b: '#5a7ac0', g: '#9ff' }, { rad: 9 })); b.charged = []; },
      dmgMul(b) { return b.vulnT > 0 ? 1.6 : 0.3; },
      update(b, dt, g) {
        const t = b.target;
        b.trail.unshift({ x: b.x, y: b.y, z: b.z }); if (b.trail.length > 100) b.trail.pop();
        if (b.vulnT > 0) { b.vx *= 0.95; b.vy *= 0.95; b.z = U.damp(b.z, 18, 2, dt); if (Math.random() < 0.4) AS.FX.sparks(b.x, b.py, 0, 3, '#cfe8ff'); return; }
        b.z = U.damp(b.z, b.baseZ, 1, dt);
        b.o2 = (b.o2 || 0) + dt * 0.5;
        const cx = t ? t.x : b.home.x, cy = t ? t.y : b.home.y;
        const want = Math.atan2(cy + Math.sin(b.o2) * 260 - b.y, cx + Math.cos(b.o2) * 300 - b.x);
        b.angle = U.turnToward(b.angle, want, b.def.turn * dt);
        const sp = b.def.speed * (b.enraged ? 1.25 : 1);
        b.vx = Math.cos(b.angle) * sp; b.vy = Math.sin(b.angle) * sp;
        b.cd -= dt;
        if (t && b.cd <= 0 && U.dist(b.x, b.y, t.x, t.y) < 260) { b.cd = 1.4; b.fire(b.def.weapon, t); }
        // charged rods shock it as it passes
        for (const r of g.structures) {
          if (r.kind !== 'rod' || !r.chargeT || r.chargeT < g.time) continue;
          if (U.dist(b.x, b.y, r.x, r.y) < 150) {
            r.chargeT = 0; b.vulnT = 7;
            AS.Proj.zap(r.x, r.y - 52, b.x, b.py, '#ffffff', 3); AS.Audio.sfx('thunder', { x: b.x, y: b.y }); g.camera.flash(0.3, '#e8f0ff');
            g.msg('THE LEVIATHAN IS SHOCKED — OPEN FIRE', '#ff8a5a', 3); g.say('tempest_shocked');
          }
        }
      },
      status(b) { return b.vulnT > 0 ? 'SHOCKED — VULNERABLE' : 'STORM-HIDE — LURE IT THROUGH A CHARGED LIGHTNING ROD'; },
      draw(b, ctx, ox, oy, R) {
        for (let i = b.trail.length - 1; i > 6; i -= 7) { const s = b.trail[i]; const sh = b.segSheet, sc = 1 - i / 160; ctx.drawImage(sh.frames[0][0], s.x - ox - sh.ax * sc, s.y - s.z - oy - sh.ay * sc, sh.w * sc, sh.h * sc); }
        R.sprite(ctx, b.sheet, b.angle, b.anim, b.x, b.y, b.z, ox, oy);
        if (b.flash > 0) R.flashSprite(ctx, b.sheet, b.angle, b.anim, b.x, b.y, b.z, ox, oy);
        AS.Renderer.light(b.x, b.py, 50, '#9ff', 0.3);
      },
      drawShadow(b, ctx, ox, oy) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(b.x - ox + b.z * 0.15, b.y - oy, 26, 12, 0, 0, TAU); ctx.fill(); },
    },

    /* ---------------- W9: THE WARDEN ---------------- */
    warden: {
      update(b, dt, g) {
        const t = b.target;
        if (t) { const d = U.dist(b.x, b.y, t.x, t.y); if (d > 260) moveTo(b, t.x, t.y, b.def.speed, dt); else { b.vx *= 0.9; b.vy *= 0.9; } b.angle = U.turnToward(b.angle, Math.atan2(t.y - b.y, t.x - b.x), dt * 0.8); b.gunAngle = Math.atan2(t.py - b.py, t.x - b.x); }
        b.tryFire(b.def.weapon, t, dt); b.tryFire(b.def.weapon2, t, dt, 2);
        b.sp = (b.sp || 0) - dt;
        if (b.sp <= 0) { b.sp = 10; if (g.units.filter((u) => u.kind === 'sentinel' && u.alive).length < 4) { const u = g.spawnUnit('sentinel', b.x, b.y - 40, { active: true }); if (u) { u.alerted = true; u.home = { x: b.x, y: b.y }; } } }
        if (Math.hypot(b.vx, b.vy) > 5 && Math.floor(b.anim * 2) !== Math.floor((b.anim - dt * 4) * 2)) { g.shakeNear(b.x, b.y, 0.15); AS.FX.dust(b.x, b.y, 4, '#6a6458', 50); }
        AS.Renderer.light(b.x, b.py, 60, '#ff6a3a', 0.3);
      },
      status(b) { return b.isShielded() ? 'GRID-SHIELDED — CUT ITS POWER COUPLINGS' : 'POWER LOST — VULNERABLE'; },
    },

    /* ---------------- W10: THE HEART OF THE CHOIR ---------------- */
    heart: {
      update(b, dt, g) {
        const t = b.target;
        b.tryFire(b.def.weapon, t, dt);
        b.lanceT = (b.lanceT === undefined ? 6 : b.lanceT) - dt;
        if (t && b.lanceT <= 0) {
          b.lanceT = b.enraged ? 7 : 10;
          AS.Proj.field({ type: 'hazard', kind: 'lightning', x: t.x + t.vx * 1.2, y: t.y + t.vy * 1.2, r: 90, delay: 2.2, life: 2.4, dmg: 40, dtype: 'energy', col: '#c09aff' });
          g.say('lance_charging');
          AS.Audio.sfx('beam_charge', { vol: 1, rate: 0.5 });
        }
        b.wv = (b.wv === undefined ? 20 : b.wv) - dt;
        if (b.wv <= 0) { b.wv = 24; const a = Math.random() * TAU; g.spawnWave({ k: Math.random() < 0.5 ? 'seraph' : 'choirlancer', x: b.x + Math.cos(a) * 700, y: b.y + Math.sin(a) * 700, n: 3, say: false }); }
        AS.Renderer.light(b.x, b.py, 120, '#c09aff', 0.35 + Math.sin(b.t * 3) * 0.1);
      },
      status(b) { return b.isShielded() ? 'SANCTUM PYLONS ACTIVE — CORE SEALED' : 'CORE EXPOSED — DESTROY IT'; },
      draw(b, ctx, ox, oy, R) { const sh = b.sheet; const ai = Math.floor(b.anim) % sh.anims; ctx.drawImage(sh.frames[ai][0], b.x - ox - sh.ax, b.y - oy - sh.ay, sh.w, sh.h); if (b.flash > 0) R.flashSprite(ctx, sh, 0, ai, b.x, b.y, 0, ox, oy); },
      drawShadow() {},
    },
  };

  const Bosses = {
    DEFS,
    spawn(g, s) {
      const def = DEFS[s.k];
      if (!def) { console.warn('unknown boss', s.k); return null; }
      const b = new Boss(g, s.k, def, s.x, s.y, s);
      g.units.push(b);
      if (s.id) g.byId.set(s.id, b);
      return b;
    },
    // custom script calls usable from level data: { call: 'name', ... }
    calls: {
      lureBoss(g, a) { const b = g.byId.get(a.boss); if (b && b.alive) b.bossAct('lure', { x: a.x, y: a.y }); },
      chargeRod(g, a) { const r = g.byId.get(a.rod); if (r) { r.chargeT = g.time + 14; r.activated = false; g.msg('LIGHTNING ROD CHARGED (14s) — LURE THE LEVIATHAN THROUGH IT', '#9ff6ff', 3); AS.Proj.zap(r.x, r.y - 300, r.x, r.y - 52, '#ffffff', 2); AS.Audio.sfx('thunder', { x: r.x, y: r.y }); } },
      rearmConsole(g, a) { g.script.count.interacted[a.id] = 0; g.later(a.t || 10, () => { const c = g.byId.get(a.id); if (c) c.activated = false; }); },
    },
  };
  // let the Unit drawing helper know about boss defs for sprites (pal resolution)
  AS.Data.enemies = Object.assign(AS.Data.enemies || {}, {});
  AS.Bosses = Bosses;
})(window.AS);

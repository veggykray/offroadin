/* WYRMCROWN — pickups and magical power-ups.
 *  - Gold: spilled from broken carts and treasure; fly low over it to scoop it.
 *  - Power-ups: glowing orbs that rise from the realm's rune circles every so
 *    often. Fly through one (low) to claim it — a burst of light, a chime, and
 *    its effect: a timed blessing on the dragon, an instant restore, or a spell
 *    stored in the rider's spell slot (cast with Q).
 * They are the main comeback tool: anyone can grab them, wherever they rise. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C;

  const POWER = {
    shield: { name: 'Aegis Ward', col: '#9fd8ff', dur: 16, kind: 'buff', desc: 'Damage greatly reduced' },
    power: { name: 'Empowered Staff', col: '#d8a8ff', dur: 16, kind: 'buff', desc: 'Stronger, splitting bolts' },
    rapid: { name: 'Quickcast', col: '#7affd8', dur: 16, kind: 'buff', desc: 'Rapid, cheap spellfire' },
    haste: { name: 'Gale Wings', col: '#e8f8ff', dur: 13, kind: 'buff', desc: 'Faster flight' },
    invuln: { name: 'Dragon\'s Grace', col: '#ffe88a', dur: 8, kind: 'buff', desc: 'Invulnerable' },
    inferno: { name: 'Inferno', col: '#ff8a3a', dur: 16, kind: 'buff', desc: 'Endless, stronger breath' },
    heal: { name: 'Elixir of Life', col: '#7aff8a', kind: 'instant', desc: 'Restores health' },
    mana: { name: 'Wellspring', col: '#5ab8ff', dur: 15, kind: 'buff', desc: 'Mana surges back' },
    feast: { name: 'Feast', col: '#ffb85a', dur: 30, kind: 'buff', desc: 'Energy restored, no hunger' },
    storm: { name: 'Lightning Storm', col: '#c8e0ff', kind: 'spell', desc: 'Spell: lightning strikes all foes around you (Q)' },
    nova: { name: 'Frost Nova', col: '#bff4ff', kind: 'spell', desc: 'Spell: freeze and slow every foe nearby (Q)' },
    summon: { name: 'Call the Host', col: '#f0d890', kind: 'spell', desc: 'Spell: summon spectral warriors to fight for you (Q)' },
  };
  const POOL = ['shield', 'power', 'rapid', 'haste', 'inferno', 'heal', 'mana', 'feast', 'storm', 'nova', 'summon', 'invuln', 'power', 'heal', 'feast', 'storm'];

  class Pickup {
    constructor(g, kind, x, y, o) {
      o = o || {};
      this.g = g; this.kind = kind; this.x = x; this.y = y; this.z = kind === 'gold' ? 0 : 22;
      this.alive = true; this.t = Math.random() * 6; this.value = o.value || 0;
      this.life = o.life || (kind === 'gold' ? 60 : 1e9);
      this.rune = o.rune || null;
      this.vx = o.vx || 0; this.vy = o.vy || 0;
      this.def = POWER[kind] || null;
    }
    get sortY() { return this.y; }
    update(dt) {
      const g = this.g;
      this.t += dt; this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
      if (this.vx || this.vy) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= Math.exp(-3 * dt); this.vy *= Math.exp(-3 * dt); if (Math.abs(this.vx) + Math.abs(this.vy) < 2) this.vx = this.vy = 0; }
      for (const d of g.dragons) {
        if (!d.targetable) continue;
        const dx = d.x - this.x, dy = d.y - this.y, dd = Math.hypot(dx, dy);
        const reach = (this.kind === 'gold' ? 60 : 46) * d.scale;
        if (dd < reach && d.z < (this.kind === 'gold' ? 50 : 62)) { this.collect(d); return; }
        // gold drifts toward a dragon skimming nearby
        if (this.kind === 'gold' && dd < 140 && d.z < 50) { this.x += dx / dd * 120 * dt; this.y += dy / dd * 120 * dt; }
      }
      if (this.def && Math.random() < 0.3 * AS.Particles.density) AS.Particles.spawn({ x: this.x + U.range(-10, 10), y: this.y + U.range(-6, 6), z: this.z + U.range(-6, 6), vz: 18, shape: AS.Particles.GLOW, col: this.def.col, size: 2.2, size2: 0.3, life: 0.8, add: true });
    }
    collect(d) {
      const g = this.g;
      this.alive = false;
      if (this.rune) this.rune.orb = null;
      if (this.kind === 'gold') {
        d.faction.addGold(this.value, this.x, this.y, 'loot');
        return;
      }
      const P = this.def;
      if (P.kind === 'buff') {
        d.buffs[this.kind] = P.dur;
        if (this.kind === 'feast') d.energy = d.maxEnergy;
        if (this.kind === 'mana') d.mana = d.maxMana;
      } else if (P.kind === 'instant') d.heal(d.maxHp * 0.45);
      else if (P.kind === 'spell') { d.spell = this.kind; d.spellCharges = Math.min(3, (d.spell === this.kind ? (d.spellCharges || 0) : 0) + 1); }
      // a satisfying claim: light pillar, ring, sparks, chime
      const Pp = AS.Particles;
      Pp.spawn({ x: this.x, y: this.y, z: this.z, shape: Pp.GLOW, col: '#ffffff', size: 10, size2: 60, life: 0.35, add: true, keep: true });
      Pp.spawn({ x: this.x, y: this.y, z: 0, shape: Pp.RING, col: P.col, size: 8, size2: 90, life: 0.7, add: true, layer: 0, keep: true });
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; Pp.spawn({ x: this.x, y: this.y, z: this.z, vx: Math.cos(a) * 160, vy: Math.sin(a) * 110, vz: 40 + Math.random() * 60, shape: Pp.GLOW, col: Math.random() < 0.5 ? '#ffffff' : P.col, size: 3, size2: 0.4, life: 0.7, add: true, drag: 2 }); }
      AS.Renderer.flare(this.x, this.y - this.z, 140, P.col, 0.8, 0.5);
      AS.Audio.sfx('powerup', { x: this.x, y: this.y, vol: d.isPlayer ? 1 : 0.5 });
      if (d.isPlayer && AS.Voices && AS.Voices.g === g) AS.Voices.event('powerup_collected', { cooldown: 25 });
      if (d.isPlayer) { g.msg(P.name.toUpperCase() + ' — ' + P.desc.toUpperCase(), P.col, 3.2); g.camera.pulseZoom(0.04, 0.6); AS.HUD && AS.HUD.flashBuff && AS.HUD.flashBuff(this.kind); }
      else if (d.faction && Math.random() < 0.5) g.news(d.name + ' claims ' + P.name, d.fk);
    }
    drawShadow(ctx, ox, oy) {
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(this.x - ox + 3, this.y - oy + 1, 6, 3, 0, 0, TAU); ctx.fill();
    }
    draw(ctx, ox, oy, R) {
      const x = this.x - ox, y = this.y - oy;
      if (this.kind === 'gold') {
        const fade = this.life < 8 ? (Math.sin(this.t * 12) > 0 ? 1 : 0.4) : 1;
        ctx.globalAlpha = fade;
        for (let i = 0; i < 5; i++) { const a = i * 1.3, r = 2 + i; ctx.fillStyle = '#8a6a1a'; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 3, 1.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r - 0.4, y + Math.sin(a) * r * 0.6 - 0.8, 2.6, 1.5, 0, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (Math.sin(this.t * 5) > 0.92) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 3, 2, 2); }
        R.light(this.x, this.y, 16, '#ffd24a', 0.25);
        return;
      }
      const P = this.def, bob = Math.sin(this.t * 2.2) * 3, z = this.z + bob;
      // light pillar
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, y - z - 70, 0, y);
      gr.addColorStop(0, C.str(P.col, 0)); gr.addColorStop(0.7, C.str(P.col, 0.22)); gr.addColorStop(1, C.str(P.col, 0.05));
      ctx.fillStyle = gr; ctx.fillRect(x - 7, y - z - 70, 14, z + 70);
      const s = 13 + Math.sin(this.t * 6) * 1.5;
      ctx.drawImage(AS.Forge.glow(P.col, 64), x - s * 1.8, y - z - s * 1.8, s * 3.6, s * 3.6);
      ctx.restore();
      // the orb: dark rim, coloured sphere, highlight, glyph
      ctx.fillStyle = 'rgba(10,8,20,0.6)'; ctx.beginPath(); ctx.arc(x, y - z, 8.5, 0, TAU); ctx.fill();
      const og = ctx.createRadialGradient(x - 2.5, y - z - 2.5, 1, x, y - z, 8);
      og.addColorStop(0, '#ffffff'); og.addColorStop(0.35, P.col); og.addColorStop(1, C.str(C.shade(P.col, -0.45)));
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(x, y - z, 7.5, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(x, y - z); ctx.rotate(this.t * 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 4, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      if (AS.HUD && AS.HUD.icon) AS.HUD.icon(ctx, 'pw_' + this.kind, x, y - z, 7, 'rgba(20,14,30,0.85)');
      R.light(this.x, this.y - z, 50, P.col, 0.5);
    }
  }

  const Powerups = {
    POWER,
    init(g) {
      g.runes = (g.map.runes || []).map((r) => ({ x: r[0], y: r[1], orb: null, t: 10 + Math.random() * 40 }));
      for (const r of g.runes) g.terrain.addDecal('runecircle', r.x, r.y, 34, null, { static: true, seed: (r.x + r.y) | 0 });
    },
    update(g, dt) {
      let active = 0;
      for (const r of g.runes) if (r.orb && r.orb.alive) active++;
      for (const r of g.runes) {
        if (r.orb && r.orb.alive) continue;
        r.t -= dt;
        if (r.t <= 0 && active < Math.max(3, g.runes.length * 0.35)) {
          r.t = 50 + Math.random() * 50;
          const kind = POOL[(Math.random() * POOL.length) | 0];
          r.orb = new Pickup(g, kind, r.x, r.y, { rune: r });
          g.pickups.push(r.orb); active++;
          AS.Particles.spawn({ x: r.x, y: r.y, z: 0, shape: AS.Particles.RING, col: POWER[kind].col, size: 6, size2: 50, life: 0.8, add: true, layer: 0 });
        }
      }
    },
    drawGround(ctx, ox, oy, g) {
      // rune circles glow softly when they hold an orb
      for (const r of g.runes) {
        if (!r.orb || !r.orb.alive) continue;
        const x = r.x - ox, y = r.y - oy;
        if (x < -60 || y < -60 || x > g.camera.w + 60 || y > g.camera.h + 60) continue;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + Math.sin(g.time * 3) * 0.1;
        ctx.strokeStyle = r.orb.def.col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x, y, 30, 22, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    },
    /* cast the stored spell */
    cast(d) {
      const g = d.g;
      if (!d.spell || !(d.spellCharges > 0)) { if (d.isPlayer) { g.msg('NO SPELL STORED — CLAIM SPELL ORBS AT RUNE CIRCLES', '#ffe7a8', 2); AS.Audio.sfx('denied'); if (AS.Voices && AS.Voices.g === g) AS.Voices.event('spell_failure', { cooldown: 30 }); } return false; }
      const kind = d.spell;
      d.spellCharges--; if (d.spellCharges <= 0) d.spell = null;
      if (kind === 'storm') {
        AS.Audio.sfx('spell_lightning', { x: d.x, y: d.y });
        g.camera.flash(0.25, '#e0f0ff');
        let n = 0;
        const foes = g.foesNear(d.team, d.x, d.y, 520).slice(0, 14);
        for (const e of foes) {
          const delay = n++ * 0.12;
          g.later(delay, () => {
            if (!e.alive) return;
            AS.Proj.zap(e.x + U.range(-20, 20), e.y - e.z - 260, e.x, e.y - (e.z || 0) - (e.hc || 6), '#d8ecff', 2);
            e.takeDamage(e.isDragon ? 60 : 85, 'magic', d);
            AS.FX.impact(e.x, e.y, (e.z || 0) + 4, '#d8ecff');
            AS.Renderer.flare(e.x, e.y - (e.z || 0), 90, '#d8ecff', 0.8, 0.25);
            if (!e.isDragon) g.terrain.addDecal('scorch', e.x, e.y, 10);
          });
        }
        if (!foes.length && d.isPlayer) g.msg('THE STORM FINDS NO FOES', '#c8e0ff', 1.5);
      } else if (kind === 'nova') {
        AS.Audio.sfx('frost_nova', { x: d.x, y: d.y });
        AS.Particles.spawn({ x: d.x, y: d.y, z: 2, shape: AS.Particles.RING, col: '#dff6ff', size: 10, size2: 340, life: 0.7, add: true, layer: 0, keep: true });
        for (const e of g.foesNear(d.team, d.x, d.y, 340)) { e.slow = Math.max(e.slow || 0, 6); if (!e.isDragon && !e.isBuilding) e.root = Math.max(e.root || 0, 3); e.takeDamage(30, 'frost', d); if (e.isDragon) e.speed *= 0.5; }
        g.camera.flash(0.2, '#e8f8ff');
      } else if (kind === 'summon') {
        AS.Audio.sfx('summon', { x: d.x, y: d.y });
        const F = d.faction, role = 'elite';
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU, x = d.x + Math.cos(a) * 50, y = d.y + Math.sin(a) * 40;
          if (!g.terrain.groundPassable(x, y)) continue;
          const u = new AS.Troop(g, role, F.key, x, y, { gen: F.def.troops.elite.gen });
          u.spectral = 40; u.home = { x: d.x, y: d.y, r: 200 }; u.state = 'guard';
          u.onDeath = null;
          g.troops.push(u); F.troops.push(u);
          g.later(40, () => { if (u.alive) { u.alive = false; u.removed = true; AS.Particles.spawn({ x: u.x, y: u.y, z: 6, shape: AS.Particles.GLOW, col: '#f0d890', size: 6, size2: 20, life: 0.5, add: true }); } });
          AS.Particles.spawn({ x, y, z: 2, shape: AS.Particles.RING, col: '#f0d890', size: 4, size2: 30, life: 0.6, add: true, layer: 0 });
        }
      }
      if (d.isPlayer) g.msg(POWER[kind].name.toUpperCase() + '!', POWER[kind].col, 2);
      return true;
    },
  };

  const Pickups = {
    coins(g, x, y, value) {
      const n = Math.min(6, Math.max(1, Math.round(value / 25)));
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU; g.pickups.push(new Pickup(g, 'gold', x, y, { value: value / n, vx: Math.cos(a) * 80, vy: Math.sin(a) * 60 })); }
    },
  };

  /* rune circle decal under each power-up spawn point */
  AS.Decals.painters.runecircle = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.74);
    ctx.fillStyle = 'rgba(30,26,40,0.28)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(210,220,255,0.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.92, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62); ctx.lineTo(Math.cos(a + 0.2) * R * 0.92, Math.sin(a + 0.2) * R * 0.92); ctx.stroke(); }
    // standing stones around the circle
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; ctx.fillStyle = 'rgba(40,36,48,0.6)'; ctx.fillRect(Math.cos(a) * R * 1.05 - 2, Math.sin(a) * R * 1.05 - 2, 4, 5); ctx.fillStyle = 'rgba(200,196,210,0.7)'; ctx.fillRect(Math.cos(a) * R * 1.05 - 2, Math.sin(a) * R * 1.05 - 3, 4, 2); }
    ctx.restore();
  };

  AS.Pickup = Pickup;
  AS.Powerups = Powerups;
  AS.Pickups = Pickups;
})(window.AS);

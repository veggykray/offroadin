/* ALIEN STRIKE — pickups, survivors, cargo, destructible props and obstacles. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  const PICKUP_INFO = {
    fuel: { label: 'FUEL CELL', col: '#ffb04a' }, ammo: { label: 'AMMO CRATE', col: '#b8e86a' },
    missiles: { label: 'MISSILE PACK', col: '#ff8a6a' }, repair: { label: 'REPAIR KIT', col: '#ffffff' },
    shield: { label: 'SHIELD CELL', col: '#6ab8ff' }, special: { label: 'SPECIAL CHARGE', col: '#c58aff' },
    tech: { label: 'ALIEN TECH', col: '#b07cff' }, salvage: { label: 'SALVAGE', col: '#e8c24a' }, intel: { label: 'MISSION INTEL', col: '#5fffe0' },
  };

  /* ---------------- Pickup ---------------- */
  class Pickup {
    constructor(g, kind, x, y, o) {
      o = o || {};
      this.g = g; this.kind = kind; this.x = x; this.y = y; this.z = 0; this.id = o.id || null;
      this.life = o.life || Infinity; this.t = Math.random() * 10; this.alive = true;
      this.value = o.value || (kind === 'salvage' ? U.irange(25, 55) : 1);
      this.sheet = AS.Art.pickup(kind); this.info = PICKUP_INFO[kind] || PICKUP_INFO.salvage;
      this.hidden = !!o.hidden; this.reveals = o.reveals || null; this.dropped = !!o.dropped;
      this.vx = o.vx || 0; this.vy = o.vy || 0; this.r = 8;
    }
    get sortY() { return this.y; }
    update(dt) {
      const g = this.g, p = g.player;
      this.t += dt;
      if (this.life !== Infinity) { this.life -= dt; if (this.life <= 0) { this.alive = false; return; } }
      if (this.vx || this.vy) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= Math.exp(-4 * dt); this.vy *= Math.exp(-4 * dt); if (Math.abs(this.vx) + Math.abs(this.vy) < 2) this.vx = this.vy = 0; }
      if (!p || !p.alive || p.dying > 0) return;
      const d = U.dist(this.x, this.y, p.x, p.y);
      if (d < 54) { const k = (1 - d / 54) * 260 * dt; this.x += (p.x - this.x) / (d || 1) * k; this.y += (p.y - this.y) / (d || 1) * k; this.z = U.lerp(this.z, p.z * 0.6, 0.1); }
      if (d < 20) this.collect(p);
    }
    collect(p) {
      const g = this.g, s = p.s;
      let txt = this.info.label;
      switch (this.kind) {
        case 'fuel': p.fuel = Math.min(s.fuelMax, p.fuel + s.fuelMax * 0.35); if (p.fuel / s.fuelMax > 0.5) p.fuelWarned = {}; else if (p.fuel / s.fuelMax > 0.25) { delete p.fuelWarned[25]; delete p.fuelWarned[10]; } else delete p.fuelWarned[10]; if (p.emergency >= 0) { p.emergency = -1; g.say('fuel_restored'); } txt = '+FUEL'; break;
        case 'ammo': p.ammo.primary = Math.min(s.primary.ammoMax, p.ammo.primary + s.primary.ammoMax * 0.4); p.ammo.secondary = Math.min(s.secondary.ammoMax, p.ammo.secondary + Math.max(2, Math.round(s.secondary.ammoMax * 0.2))); txt = '+AMMO'; break;
        case 'missiles': p.ammo.secondary = Math.min(s.secondary.ammoMax, p.ammo.secondary + Math.max(4, Math.round(s.secondary.ammoMax * 0.5))); txt = '+MISSILES'; break;
        case 'repair': if (p.kits < s.kitCap) { p.kits++; txt = '+REPAIR KIT'; } else { p.heal(s.hullMax * 0.25); txt = '+HULL'; } break;
        case 'shield': p.shield = s.shieldMax * 1.3; txt = 'SHIELD OVERCHARGE'; AS.Audio.sfx('shield_up'); break;
        case 'special': p.ammo.special = Math.min(s.special.ammoMax, p.ammo.special + 1); txt = '+SPECIAL'; break;
        case 'tech': g.stats.tech += 1; txt = '+ALIEN TECH'; g.say('tech_recovered'); break;
        case 'salvage': g.stats.salvage += this.value; txt = '+' + this.value + ' SALVAGE'; break;
        case 'intel': g.stats.intel++; txt = 'INTEL ACQUIRED'; g.say('intel_acquired'); break;
      }
      AS.Audio.sfx(this.kind === 'salvage' ? 'pickup_salvage' : 'pickup', { rate: U.range(0.95, 1.05) });
      AS.FX.text(this.x, this.y, 18, txt, this.info.col);
      AS.Particles.spawn({ x: this.x, y: this.y, z: 6, shape: AS.Particles.RING, col: this.info.col, size: 3, size2: 18, life: 0.3, add: true });
      this.alive = false;
      g.stats.pickups++;
      g.emit('pickup', this);
    }
    drawShadow(ctx, ox, oy) { if (!this.hidden || this.g.revealHidden) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.round(this.x - ox), Math.round(this.y - oy + 1), 6, 3, 0, 0, TAU); ctx.fill(); } }
    draw(ctx, ox, oy, R) {
      const bob = 3 + Math.sin(this.t * 3) * 2 + this.z;
      if (this.life < 5 && Math.sin(this.t * 20) > 0) return;
      R.sprite(ctx, this.sheet, 0, 0, this.x, this.y, bob, ox, oy);
      R.light(this.x, this.y - bob - 4, 14 + Math.sin(this.t * 4) * 3, this.info.col, 0.35);
    }
  }
  Pickup.INFO = PICKUP_INFO;

  /* ---------------- Survivors ---------------- */
  const SUIT = { crew: '#e8742a', scientist: '#e8e8e0', colonist: '#5a8ad8', prisoner: '#9a9a8a', explorer: '#6aa04a', researcher: '#e8e8e0', engineer: '#e8c24a' };
  const SKIN = ['#e8c8a8', '#c89a74', '#8a5e40', '#f0d4b8'];
  const LABEL = { crew: 'CREW', scientist: 'SCIENTIST', colonist: 'COLONIST', prisoner: 'PRISONER', explorer: 'EXPLORER', researcher: 'RESEARCHER', engineer: 'ENGINEER' };
  class Person {
    constructor(group, x, y, i) {
      this.group = group; this.x = x; this.y = y; this.z = 0; this.r = 4; this.hc = 5; this.alive = true; this.aboard = false;
      this.vx = 0; this.vy = 0; this.anim = Math.random() * 4; this.i = i; this.wave = Math.random() * 6; this.face = 1;
      this.homeX = x; this.homeY = y; this.beam = 0; this.team = 'player'; this.hp = 22; this.hurtT = 0;
      this.retrieving = false; this.lift = 0; this.notice = 0; this.skin = SKIN[(i * 7 + (group.id || '').length) % SKIN.length];
    }
    get py() { return this.y - this.hc - this.z; }
    get sortY() { return this.y; }
    get kind() { return 'person'; }
    takeDamage(d) {
      if (!this.alive || this.aboard || this.ascending) return 0;
      this.hp -= (d === undefined ? 100 : d); this.hurtT = 0.3;
      const g = this.group.g;
      if (g.player && g.player.warnOnce) g.player.warnOnce('survattack_' + this.group.id, 'survivors_attacked', 25);
      if (this.hp > 0) { AS.FX.splat(this.x, this.y, 3, '#8a1a1a', 2); return d; }
      this.alive = false;
      AS.FX.splat(this.x, this.y, 3, '#8a1a1a', 6);
      this.group.g.onSurvivorLost(this);
      return 1;
    }
    hazard(x, y, r) { if (U.dist(this.x, this.y, x, y) < r) this.takeDamage(8); }
    /* retrieval-beam contract (see src/game/retrieval.js) */
    canRetrieve(pl) { return this.alive && !this.aboard && this.group.canInteract(pl); }
    retrieveBlocked(pl) { return pl.passengers.length >= pl.s.rescueCap ? 'BAY FULL — DROP OFF AT A PAD' : null; }
    retrievePos() { return { x: this.x, y: this.y, z: this.z }; }
    get retrieveTime() { return 1.7; }
    get retrieveCol() { return '#8ff4ff'; }
    get retrieveLabel() { return 'RETRIEVE ' + (LABEL[this.group.type] || 'SURVIVOR'); }
    onBeamStart(pl) { this.retrieving = true; this.group.onBeamStart(pl); }
    onBeamProgress(pl, k, stab) { this.lift = k; this.z = Math.pow(k, 1.6) * 6 + (k > 0.3 ? Math.sin(this.anim * 2) * 0.4 * k : 0); }
    onBeamBreak(pl) { this.retrieving = false; this.ascending = false; }
    retrieveLift(f, gp, pl) {
      if (!this.ascending) { this.ascending = true; this.sx = this.x; this.sy = this.y; this.sz = this.z; }
      const e = f * f;
      this.x = U.lerp(this.sx, gp.x, e); this.y = U.lerp(this.sy, gp.y, e); this.z = U.lerp(this.sz, pl.z, e);
    }
    onRetrieved(pl) { this.retrieving = false; this.ascending = false; this.group.board(this, pl); }
  }
  class SurvivorGroup {
    constructor(g, o) {
      this.g = g; this.id = o.id; this.kind = 'survivors'; this.type = o.kind || 'crew';
      this.x = o.x; this.y = o.y; this.label = o.label || 'SURVIVORS';
      this.caged = o.caged || null; // id of pen / ice block holding them
      this.people = [];
      for (let i = 0; i < (o.n || 3); i++) {
        const a = (i / (o.n || 3)) * TAU, r = 8 + Math.random() * 10;
        const p = new Person(this, o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 0.7, i);
        this.people.push(p); g.survivors.push(p);
      }
      this.called = false; this.seen = false; this.voice = o.voice || null;
      this.interactTime = 0; this.t = Math.random() * 3; this.noticed = false;
    }
    get alive() { return this.people.some((p) => p.alive && !p.aboard); }
    get remaining() { return this.people.filter((p) => p.alive && !p.aboard).length; }
    canInteract(pl) {
      if (this.caged) { const c = this.g.byId.get(this.caged); if (c && c.alive) return false; this.caged = null; }
      return this.remaining > 0;
    }
    get interactRange() { return 120; }
    interactLabel(pl) {
      const free = pl.s.rescueCap - pl.passengers.length;
      if (free <= 0) return 'PASSENGER BAY FULL — DROP OFF AT A PAD';
      return 'HOLD E — RETRIEVE ' + this.label + ' (' + this.remaining + ')';
    }
    // first lock on anyone in this group: they thank the pilot
    onBeamStart(pl) {
      if (!this.called) { this.called = true; if (this.voice !== false) this.g.say(U.pick(['survivor_thanks1', 'survivor_thanks2', 'survivor_thanks3'])); }
    }
    call(pl) { this.onBeamStart(pl); }
    update(dt) {
      const g = this.g, pl = g.player;
      this.t += dt;
      if (!this.seen && pl && U.dist(pl.x, pl.y, this.x, this.y) < 420 && this.remaining > 0 && !this.caged) { this.seen = true; g.say('survivors_located'); g.emit('survivorsSeen', this); }
      const cagedNow = this.caged && (() => { const c = g.byId.get(this.caged); return c && c.alive; })();
      const plOk = pl && pl.alive && pl.dying <= 0;
      const dGroup = plOk ? U.dist(pl.x, pl.y, this.x, this.y) : 1e9;
      if (!this.noticed && dGroup < 260 && !cagedNow) this.noticed = true;
      const bayFree = plOk && pl.passengers.length < pl.s.rescueCap;
      // gather a little in front of the emitter so the beam slants into view
      const gp0 = plOk && pl.retrieval ? pl.retrieval.groundPoint() : null;
      const gp = gp0 ? { x: gp0.x, y: gp0.y + 18 } : null;
      for (const p of this.people) {
        if (!p.alive || p.aboard) { if (p.beam > 0) p.beam -= dt; continue; }
        p.anim += dt * 6;
        p.hurtT = Math.max(0, p.hurtT - dt);
        if (p.retrieving || p.ascending) { p.vx = p.vy = 0; p.wave += dt * 9; continue; }
        if (p.z > 0) p.z = Math.max(0, p.z - dt * 30); // dropped by a broken beam
        p.notice = U.damp(p.notice, dGroup < 260 && !cagedNow ? 1 : 0, 4, dt);
        let moving = false;
        // when the craft hovers close and slow, people gather under the beam emitter
        if (gp && !cagedNow && bayFree && dGroup < 220 && pl.speed < 150) {
          const d = U.dist(p.x, p.y, gp.x, gp.y);
          const home = U.dist(gp.x, gp.y, this.x, this.y);
          if (d > 11 && d < 170 && home < 150) {
            let ax = (gp.x - p.x) / d, ay = (gp.y - p.y) / d;
            // keep a little personal space
            for (const o of this.people) if (o !== p && o.alive && !o.aboard) { const dx = p.x - o.x, dy = p.y - o.y, dd = dx * dx + dy * dy; if (dd < 49 && dd > 0.01) { const k = 1 / Math.sqrt(dd); ax += dx * k * 0.8; ay += dy * k * 0.8; } }
            const n = Math.hypot(ax, ay) || 1;
            p.vx = ax / n * 32; p.vy = ay / n * 32;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.face = p.vx < 0 ? -1 : 1;
            moving = true;
          }
        }
        if (!moving) {
          p.vx = p.vy = 0;
          if (plOk && dGroup < 400) p.face = pl.x < p.x ? -1 : 1;
          p.wave += dt * (p.notice > 0.5 ? 9 : 2);
        }
      }
      if (this.called && this.remaining === 0) this.called = false;
    }
    board(p, pl) {
      p.aboard = true; p.beam = 0.35; p.z = pl.z;
      pl.passengers.push({ group: this.id, type: this.type });
      AS.Audio.sfx('beam_up', { vol: 0.5 });
      this.g.emit('boarded', this);
      if (pl.passengers.length >= pl.s.rescueCap) pl.warnOnce('bayfull', 'rescue_full', 6);
      this.g.stats.boarded++;
    }
    collectDraw(list, x0, y0, x1, y1) {
      for (const p of this.people) if (p.alive && (!p.aboard || p.beam > 0) && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) list.push(personDrawable(p, this));
      // a small beacon over the group while anyone is waiting (not while caged)
      if (this.remaining > 0 && !(this.caged && (() => { const c = this.g.byId.get(this.caged); return c && c.alive; })()) && this.x > x0 && this.x < x1 && this.y > y0 && this.y < y1) list.push(beaconDrawable(this));
    }
  }
  const PD = {
    sortY: 0, p: null, gp: null,
    drawShadow(ctx, ox, oy) {
      const p = this.p;
      if (p.aboard) return;
      const k = 1 - Math.min(0.6, p.z / 20);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(p.x - ox + 0.6, p.y - oy + 0.5, 4.2 * k, 2 * k, 0, 0, TAU); ctx.fill();
    },
    draw(ctx, ox, oy) {
      const p = this.p, gp = this.gp;
      const col = SUIT[gp.type] || '#e8742a';
      const dark = U.C.css(col, -0.35);
      ctx.save();
      // people are drawn a little larger than true scale so they read next to the craft
      ctx.translate(p.x - ox, p.y - oy - p.z); ctx.scale(1.35, 1.35);
      const x = 0, y = 0;
      if (p.aboard) ctx.globalAlpha = Math.max(0, p.beam * 2.8);
      const moving = Math.abs(p.vx) + Math.abs(p.vy) > 1;
      const step = moving ? Math.sin(p.anim * 2.2) : 0;
      const f = p.face;
      // legs
      ctx.strokeStyle = '#2a2c32'; ctx.lineWidth = 1.15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 0.8, y - 3.6); ctx.lineTo(x - 0.8 + step * 1.1, y - 0.2); ctx.moveTo(x + 0.8, y - 3.6); ctx.lineTo(x + 0.8 - step * 1.1, y - 0.2); ctx.stroke();
      // torso: suit with a darker side for volume
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 1.9, y - 3.4); ctx.lineTo(x - 1.6, y - 7.6); ctx.quadraticCurveTo(x, y - 8.6, x + 1.6, y - 7.6); ctx.lineTo(x + 1.9, y - 3.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(x + 0.3 * f, y - 3.4); ctx.lineTo(x + 1.9 * f, y - 3.4); ctx.lineTo(x + 1.6 * f, y - 7.6); ctx.lineTo(x + 0.5 * f, y - 8.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x - 1.5, y - 6.2, 3, 0.55);
      // arms: waving at the craft, raised in the beam, swinging when walking
      ctx.strokeStyle = col; ctx.lineWidth = 1.05;
      ctx.beginPath();
      if (p.retrieving || p.ascending) { ctx.moveTo(x - 1.6, y - 7.2); ctx.lineTo(x - 2.6, y - 10.6); ctx.moveTo(x + 1.6, y - 7.2); ctx.lineTo(x + 2.6, y - 10.6); }
      else if (!moving && p.notice > 0.5) { const w = Math.sin(p.wave) * 0.9; ctx.moveTo(x + 1.6 * f, y - 7.2); ctx.lineTo(x + (2.4 + w) * f, y - 10.6); ctx.moveTo(x - 1.6 * f, y - 7); ctx.lineTo(x - 2 * f, y - 4.4); }
      else { ctx.moveTo(x - 1.7, y - 7); ctx.lineTo(x - 2.1 - step * 0.6, y - 4.2); ctx.moveTo(x + 1.7, y - 7); ctx.lineTo(x + 2.1 + step * 0.6, y - 4.2); }
      ctx.stroke();
      // head + visor
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(x, y - 9.7, 1.45, 0, TAU); ctx.fill();
      ctx.fillStyle = U.C.css(col, -0.15); ctx.beginPath(); ctx.arc(x, y - 10.2, 1.5, Math.PI, TAU); ctx.fill();
      if (p.hurtT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,40,0.6)'; ctx.fillRect(x - 2.2, y - 11.4, 4.4, 11.4); }
      if (p.retrieving || p.ascending) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + p.lift * 0.5;
        ctx.drawImage(AS.Forge.glow('#8ff4ff', 32), x - 8, y - 15, 16, 18);
      }
      ctx.restore();
    },
  };
  function personDrawable(p, gp) { const o = Object.create(PD); o.p = p; o.gp = gp; o.sortY = p.y; return o; }
  // beacon: a soft light post above the group, blinking slowly; brighter until noticed
  const BD = {
    sortY: 0, gr: null,
    draw(ctx, ox, oy) {
      const gr = this.gr;
      const blink = (Math.sin(gr.t * 3) + 1) * 0.5;
      const x = gr.x - ox, y = gr.y - oy - 18 - Math.sin(gr.t * 2) * 1.2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (gr.noticed ? 0.35 : 0.65) * (0.5 + blink * 0.5);
      ctx.drawImage(AS.Forge.glow('#8ff4ff', 32), x - 9, y - 9, 18, 18);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.moveTo(x, y - 2.4); ctx.lineTo(x + 1.8, y); ctx.lineTo(x, y + 2.4); ctx.lineTo(x - 1.8, y); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (blink > 0.6) AS.Renderer.light(gr.x, gr.y - 18, 22, '#8ff4ff', 0.25);
    },
  };
  function beaconDrawable(gr) { const o = Object.create(BD); o.gr = gr; o.sortY = gr.y - 1; return o; }

  /* ---------------- Cargo ---------------- */
  const CARGO_LABEL = { blackbox: 'FLIGHT RECORDER', datacore: 'DATA CORE', artifact: 'ALIEN ARTEFACT', fuelcore: 'FUEL CORE', sample: 'BIO SAMPLE', charge: 'SEISMIC CHARGE', powercell: 'POWER CELL' };
  class Cargo {
    constructor(g, o) {
      this.g = g; this.kind = 'cargo'; this.type = o.k; this.id = o.id; this.x = o.x; this.y = o.y; this.z = 0;
      this.label = o.label || CARGO_LABEL[o.k] || 'CARGO'; this.deliver = o.deliver || 'pad';
      this.sheet = AS.Art.cargo(o.k); this.alive = true; this.aboard = false; this.delivered = false; this.t = Math.random() * 5;
      this.interactTime = o.time || 1.1; this.locked = o.locked || null; this.hidden = !!o.hidden; this.r = 10;
      this.respawn = o.respawn || 0; this.ox = o.x; this.oy = o.y; this.baseId = (o.id || '').replace(/_r\d+$/, '');
    }
    get sortY() { return this.y; }
    canInteract(pl) {
      if (this.aboard || this.delivered) return false;
      if (this.locked) { const b = this.g.byId.get(this.locked); if (b && b.locked) return false; }
      return true;
    }
    get interactRange() { return 70; }
    interactLabel(pl) {
      if (pl.cargo.length >= pl.s.cargoCap) return 'CARGO HOLD FULL — DELIVER FIRST';
      return 'HOLD E — RECOVER ' + this.label;
    }
    onInteractStart(pl) { if (pl.cargo.length >= pl.s.cargoCap) { pl.warnOnce('cargofull', 'cargo_full', 6); AS.Audio.sfx('denied'); } }
    complete(pl) {
      if (pl.cargo.length >= pl.s.cargoCap) { pl.warnOnce('cargofull', 'cargo_full', 6); return; }
      this.aboard = true; pl.cargo.push(this);
      AS.Audio.sfx('cargo_up');
      this.g.msg(this.label + ' SECURED', '#9ff6ff');
      this.g.emit('cargoPicked', this);
      if (pl.cargo.length >= pl.s.cargoCap) pl.warnOnce('cargofull', 'cargo_full', 6);
    }
    /* retrieval-beam contract (see src/game/retrieval.js) */
    canRetrieve(pl) { return this.canInteract(pl); }
    retrieveBlocked(pl) { return pl.cargo.length >= pl.s.cargoCap ? 'CARGO HOLD FULL — DELIVER FIRST' : null; }
    retrievePos() { return { x: this.x, y: this.y, z: this.z }; }
    get retrieveTime() { return Math.max(1.3, this.interactTime); }
    get retrieveCol() { return '#b8f8ff'; }
    get retrieveLabel() { return 'RECOVER ' + this.label; }
    onBeamStart(pl) { this.beamed = true; }
    onBeamProgress(pl, k) { this.z = Math.pow(k, 1.5) * 5; }
    onBeamBreak(pl) { this.beamed = false; this.ascending = false; }
    retrieveLift(f, gp, pl) {
      if (!this.ascending) { this.ascending = true; this.sx = this.x; this.sy = this.y; this.sz = this.z; }
      const e = f * f;
      this.x = U.lerp(this.sx, gp.x, e); this.y = U.lerp(this.sy, gp.y, e); this.z = U.lerp(this.sz, pl.z, e);
    }
    onRetrieved(pl) {
      this.beamed = false; this.ascending = false;
      this.x = this.sx; this.y = this.sy; this.z = 0; // a drop elsewhere re-places it
      this.complete(pl);
    }
    update(dt) { this.t += dt; if (!this.beamed && this.z > 0) this.z = Math.max(0, this.z - dt * 30); }
    drawShadow(ctx, ox, oy) { if (this.aboard) return; const k = 1 - Math.min(0.6, this.z / 20); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(this.x - ox, this.y - oy + 1, 6 * k, 3 * k, 0, 0, TAU); ctx.fill(); }
    draw(ctx, ox, oy, R) {
      if (this.aboard || this.delivered) return;
      R.sprite(ctx, this.sheet, 0, 0, this.x, this.y, this.z, ox, oy);
      R.light(this.x, this.y - 6 - this.z, 14, '#9ff6ff', 0.3 + Math.sin(this.t * 3) * 0.1);
    }
  }

  /* ---------------- Destructible props ---------------- */
  const PROP_HP = { crate: 12, barrel: 8, container: 40, fence: 14, mast: 18, pipe: 30, wreck: 50, lamp: 8, plant: 10, crystals: 16, shroom: 10, gearbit: 30, coral: 12 };
  class Prop extends AS.Entity {
    constructor(g, kind, x, y, o) {
      super(g, { hp: PROP_HP[kind] || 15, r: kind === 'container' || kind === 'pipe' || kind === 'fence' ? 10 : 6, hc: 3 }, x, y);
      this.kind = kind; this.isProp = true; this.team = 'enemy';
      this.angle = (o && o.angle !== undefined) ? o.angle : Math.random() * TAU;
      this.sheet = AS.Art.prop(kind, g.world, (x * 7 + y * 3) | 0);
      this.organic = kind === 'plant' || kind === 'shroom' || kind === 'coral';
    }
    get py() { return this.y - 3; }
    die() {
      const g = this.g;
      this.removed = true;
      if (this.kind === 'barrel') {
        g.damageArea(this.x, this.y, 46, 22, 'explosive', 'neutral', null, { hitsAll: true });
        AS.FX.explosion(this.x, this.y, 2, 16); AS.Audio.sfx('explode_small', { x: this.x, y: this.y });
        g.terrain.addDecal('scorch', this.x, this.y, 18);
      } else {
        const col = this.organic ? g.world.propPal.b : '#6a5e54';
        for (let i = 0; i < 8; i++) AS.Particles.spawn({ x: this.x, y: this.y, z: 3, vx: U.range(-60, 60), vy: U.range(-60, 60), vz: U.range(40, 100), grav: 260, bounce: 0.3, shape: AS.Particles.SHARD, col, size: 2 + Math.random() * 2, life: 0.9, vr: 10 });
        AS.FX.dust(this.x, this.y, 3, '#8a7a6a', 30);
        AS.Audio.sfx(this.organic ? 'squelch' : 'crate_break', { x: this.x, y: this.y, vol: 0.5 });
      }
      if (Math.random() < 0.18) g.spawnPickup(Math.random() < 0.6 ? 'salvage' : U.pick(['ammo', 'fuel', 'missiles']), this.x, this.y, { dropped: true, life: 40 });
      g.stats.props++;
    }
    drawShadow(ctx, ox, oy) { AS.Renderer.shadow(ctx, this.sheet, this.angle, this.x, this.y, 0, ox, oy); }
    draw(ctx, ox, oy, R) {
      R.sprite(ctx, this.sheet, this.angle, 0, this.x, this.y, 0, ox, oy);
      if (this.flash > 0) { this.flash -= 0.016; }
      if (this.kind === 'lamp') R.light(this.x, this.y - 16, 30, '#ffe08a', 0.4);
      if (this.kind === 'crystals') R.light(this.x, this.y - 6, 18, this.g.world.propPal.g, 0.25);
    }
  }

  /* ---------------- Static obstacles (major terrain features) ---------------- */
  class Obstacle {
    constructor(g, kind, x, y, o) {
      o = o || {};
      this.g = g; this.kind = kind; this.x = x; this.y = y;
      const h = o.h || U.irange(60, 110), r = o.r || U.irange(12, 20);
      this.r = Math.round(r * 0.8); this.h = h; this.isObstacle = true; this.alive = true;
      this.sheet = AS.Art.obstacle(kind, g.world, { h, r, seed: o.seed || ((x * 13 + y * 7) % 97) });
      this.t = Math.random() * 4;
    }
    get sortY() { return this.y; }
    drawShadow(ctx, ox, oy) {
      // long cast shadow down-right
      ctx.save(); ctx.globalAlpha *= 0.8;
      ctx.translate(this.x - ox, this.y - oy);
      // height (up the sprite) is cast toward the bottom-right, matching every other shadow
      ctx.transform(1, 0, -0.5, -0.32, 0, 0);
      ctx.drawImage(this.sheet.shadows[0], -this.sheet.ax, -this.sheet.ay, this.sheet.w, this.sheet.h);
      ctx.restore();
    }
    draw(ctx, ox, oy, R) {
      const sh = this.sheet;
      const ai = sh.anims > 1 ? Math.floor(this.g.time * 2) % sh.anims : 0;
      // fade when the craft is behind it
      const p = this.g.player;
      let a = 1;
      if (p && p.alive && p.y < this.y && p.y > this.y - this.h - 30 && Math.abs(p.x - this.x) < this.r + 26) a = 0.45;
      ctx.globalAlpha = a;
      ctx.drawImage(sh.frames[ai][0], this.x - ox - sh.ax, this.y - oy - sh.ay, sh.w, sh.h);
      ctx.globalAlpha = 1;
      if (this.g.world.obstacle.glowVein || this.kind === 'bigShroom') R.light(this.x, this.y - this.h * 0.6, 26, this.g.world.obstacle.pal.g, 0.18);
    }
  }

  AS.Pickup = Pickup; AS.SurvivorGroup = SurvivorGroup; AS.Cargo = Cargo; AS.Prop = Prop; AS.Obstacle = Obstacle;
})(window.AS);

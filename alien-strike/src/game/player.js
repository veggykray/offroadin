/* ALIEN STRIKE — the player's gunship ("Vesper").
 * Momentum flight with drift, fuel/ammo/heat/shield/hull management, emergency
 * reserve when fuel runs dry, interaction (rescue, cargo, consoles), repair kits,
 * and the catastrophic-failure death sequence. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const HOVER = 26;

  class Player {
    constructor(g, stats, profile) {
      this.g = g; this.s = stats; this.profile = profile;
      this.team = 'player';
      this.x = 0; this.y = 0; this.z = HOVER; this.vx = 0; this.vy = 0;
      this.angle = -Math.PI / 2; this.angVel = 0;
      this.r = 13; this.hc = 4;
      this.hull = stats.hullMax; this.shield = stats.shieldMax; this.fuel = stats.fuelMax;
      this.ammo = { primary: stats.primary.ammoMax, secondary: stats.secondary.ammoMax, special: stats.special.ammoMax };
      this.heat = 0; this.overheated = 0; this.fireCd = 0; this.pod = 0; this.specialCd = 0; this.secCd = 0;
      this.kits = Math.min(profile.repairKits || 0, stats.kitCap);
      this.passengers = []; // survivor records aboard
      this.cargo = [];      // cargo entities aboard
      this.shieldT = 0; this.alive = true; this.dying = 0; this.deathSpin = 0;
      this.emergency = -1; this.fuelWarned = {};
      this.locks = []; this.lockT = 0; this.lockCand = null; this.rDown = 0;
      this.interactTarget = null; this.interactT = 0; this.interactLabel = '';
      this.kitT = 0; this.boosting = false; this.thrust = 0; this.turnIn = 0; this.strafeIn = 0;
      this.aimX = 0; this.aimY = 0; this.aimAngle = 0;
      this.ripples = []; this.hurtFlash = 0; this.dmgTaken = 0;
      this.beamOn = false; this.beamLen = 0;
      this.onPad = null; this.padT = 0;
      this.warnT = {}; this.recoil = 0; this.bob = 0;
      this.tractor = 0; this.tractorTarget = null;
      this.sheet = AS.Forge.sheet('craft:' + JSON.stringify(profile.upgrades), () => AS.Models.craft(profile.upgrades), 48, 1);
      this.model = this.sheet.model;
      this.podSheet = AS.Forge.sheet('pod:' + (profile.upgrades.pSpread || 0) + ':' + stats.primary.id, () => AS.Models.pod(profile.upgrades, stats.primary.id), 32, 1);
      this.drones = [];
    }
    get py() { return this.y - this.z - this.hc; }
    get speed() { return Math.hypot(this.vx, this.vy); }
    get sortY() { return this.y + 2; }

    warnOnce(key, line, cd) {
      const t = this.g.time;
      if (this.warnT[key] && t - this.warnT[key] < (cd || 12)) return false;
      this.warnT[key] = t;
      if (line) this.g.say(line);
      return true;
    }

    update(dt) {
      const g = this.g, I = AS.Input, s = this.s;
      this.bob += dt;
      if (this.dying > 0) return this.updateDying(dt);
      if (!this.alive) return;

      /* ---------- controls ---------- */
      const mode = AS.Settings.controlMode;
      let thrust = (I.down('forward') ? 1 : 0) - (I.down('back') ? 1 : 0);
      let turn = 0, strafe = 0;
      if (I.usingPad && I.pad) {
        const mx = I.padState.moveX || 0, my = I.padState.moveY || 0;
        if (Math.abs(mx) + Math.abs(my) > 0.2) {
          // left stick = desired direction; steer nose toward it
          const want = Math.atan2(my, mx);
          const d = U.wrapAngle(want - this.angle);
          turn = U.clamp(d * 2.5, -1, 1);
          thrust = Math.min(1, Math.hypot(mx, my)) * (Math.abs(d) < 1.6 ? 1 : 0.3);
        }
      } else if (mode === 'assault') {
        strafe = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
        const want = Math.atan2(this.aimY - this.py, this.aimX - this.x);
        const d = U.wrapAngle(want - this.angle);
        turn = U.clamp(d * 3, -1, 1);
      } else {
        turn = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
        strafe = (I.down('strafeRight') ? 1 : 0) - (I.down('strafeLeft') ? 1 : 0);
      }
      const hz = g.hazards;
      if (hz && hz.scramble > 0) {
        // spore contamination: controls drift and invert intermittently
        const k = Math.sin(g.time * 3.1) > 0.2 ? -1 : 1;
        turn = turn * k + Math.sin(g.time * 7.3) * 0.5;
        strafe += Math.cos(g.time * 5.1) * 0.6;
      }
      let boost = I.down('boost') && thrust > 0 && this.fuel > 0;
      this.thrust = thrust; this.turnIn = turn; this.strafeIn = strafe; this.boosting = boost;

      /* ---------- fuel ---------- */
      const lowG = hz && hz.lowGrav;
      let burn = 0.085 + 0.36 * Math.abs(thrust) + 0.18 * Math.abs(strafe) + (boost ? 0.95 : 0);
      if (lowG) burn *= 0.85;
      if (hz && hz.heat > 0) burn *= 1 + hz.heat * 1.2;
      burn *= s.fuelBurn;
      if (this.onPad && this.onPad.def.refuel) burn = 0;
      if (this.fuel > 0) {
        this.fuel = Math.max(0, this.fuel - burn * dt);
        const pct = this.fuel / s.fuelMax;
        if (pct <= 0.5 && !this.fuelWarned[50]) { this.fuelWarned[50] = 1; g.say('fuel_50'); }
        if (pct <= 0.25 && !this.fuelWarned[25]) { this.fuelWarned[25] = 1; g.say('fuel_25'); AS.Audio.sfx('warning'); }
        if (pct <= 0.1 && !this.fuelWarned[10]) { this.fuelWarned[10] = 1; g.say('fuel_critical'); AS.Audio.sfx('alarm'); }
        if (this.fuel <= 0) { this.emergency = 30; g.say('fuel_empty'); AS.Audio.sfx('alarm'); g.msg('FUEL DEPLETED — EMERGENCY RESERVE', '#ff5a3a'); }
      } else if (this.emergency > 0) {
        this.emergency -= dt;
        if (Math.floor(this.emergency) !== Math.floor(this.emergency + dt) && this.emergency < 10) AS.Audio.sfx('warning');
        if (this.emergency <= 0) { this.emergency = 0; this.startDying('Emergency reserve exhausted. The craft went down.'); return; }
      }
      if (this.fuel > 0 && this.emergency >= 0) { this.emergency = -1; }
      const noFuel = this.fuel <= 0;

      /* ---------- flight model ---------- */
      const maxSp = s.maxSpeed * (boost ? 1.45 : 1) * (noFuel ? 0.38 : 1) * (this.kitT > 0 ? 0.6 : 1);
      const acc = s.accel * (boost ? 1.5 : 1) * (noFuel ? 0.45 : 1);
      // rotation with a little angular inertia
      const turnRate = s.turnRate * (mode === 'assault' ? 1.3 : 1);
      this.angVel = U.approach(this.angVel, turn * turnRate, 16 * dt);
      this.angle = U.wrapAngle(this.angle + this.angVel * dt);
      const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
      const rx = -fy, ry = fx;
      const tAcc = thrust > 0 ? acc : acc * 0.7;
      this.vx += (fx * thrust * tAcc + rx * strafe * acc * s.strafe) * dt;
      this.vy += (fy * thrust * tAcc + ry * strafe * acc * s.strafe) * dt;
      if (hz && hz.windX !== undefined) {
        // landing clamps: pads and the LZ shelter the craft from the worst of the wind
        const ex = g.extraction, sheltered = g.padAt(this.x, this.y) || (ex && Math.hypot(this.x - ex.x, this.y - ex.y) < ex.r + 20);
        const wk = sheltered && !thrust && !strafe ? 0.15 : 1;
        this.vx += hz.windX * dt * wk; this.vy += hz.windY * dt * wk;
      }
      // anisotropic drag: forward bleeds slowly, lateral faster (mild drift)
      let vf = this.vx * fx + this.vy * fy, vl = this.vx * rx + this.vy * ry;
      const kf = thrust !== 0 ? 0.55 : 1.5, kl = strafe !== 0 ? 0.8 : 2.4;
      const dragMul = lowG ? 0.45 : 1;
      vf *= Math.exp(-kf * dragMul * dt); vl *= Math.exp(-kl * dragMul * dt);
      this.vx = fx * vf + rx * vl; this.vy = fy * vf + ry * vl;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > maxSp) { const k = U.lerp(maxSp / sp, 1, Math.exp(-6 * dt)); this.vx *= k; this.vy *= k; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      // recoil
      this.recoil = Math.max(0, this.recoil - dt * 8);
      // hover height bob (and sag when out of fuel)
      const targetZ = (noFuel ? 14 + Math.sin(g.time * 9) * 2 : HOVER) + Math.sin(this.bob * 2.3) * 1.4;
      this.z = U.damp(this.z, targetZ, 3, dt);

      this.collide(dt);

      /* ---------- aim ---------- */
      this.updateAim();

      /* ---------- weapons ---------- */
      AS.Weapons.update(this, dt);

      /* ---------- shields ---------- */
      this.shieldT -= dt;
      if (this.shieldT <= 0 && this.shield < s.shieldMax) {
        const was = this.shield;
        this.shield = Math.min(s.shieldMax, this.shield + s.shieldRegen * dt);
        if (was <= 0 && this.shield > 0) AS.Audio.sfx('shield_up');
      }
      if (this.shield > s.shieldMax) this.shield = Math.max(s.shieldMax, this.shield - 6 * dt); // overcharge bleeds off

      /* ---------- repair kit ---------- */
      if (I.hit('repair')) this.useKit();
      if (this.kitT > 0) {
        this.kitT -= dt;
        this.hull = Math.min(s.hullMax, this.hull + (s.hullMax * 0.4 / 1.4) * dt);
        if (Math.random() < 0.5) AS.FX.sparks(this.x + U.range(-10, 10), this.y + U.range(-8, 8), this.z + 4, 1, '#9fffcf');
        if (this.kitT <= 0) g.say('repair_complete');
      }

      /* ---------- interaction ---------- */
      this.updateInteract(dt);
      this.updatePad(dt);

      /* ---------- effects ---------- */
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      for (let i = this.ripples.length - 1; i >= 0; i--) { this.ripples[i].t -= dt; if (this.ripples[i].t <= 0) this.ripples.splice(i, 1); }
      this.fx(dt);
    }

    updateAim() {
      const g = this.g, I = AS.Input, cam = g.camera;
      if (I.usingPad && I.padAim.active) {
        const a = Math.atan2(I.padAim.y, I.padAim.x);
        this.aimX = this.x + Math.cos(a) * 200; this.aimY = this.py + Math.sin(a) * 200;
      } else {
        const b = AS.Renderer.screenToBuf(I.mouse.x, I.mouse.y);
        this.aimX = cam.x + b.x / cam.zoom; this.aimY = cam.y + b.y / cam.zoom;
      }
      this.aimAngle = Math.atan2(this.aimY - this.py, this.aimX - this.x);
    }

    collide(dt) {
      const g = this.g;
      // major obstacles (spires, tall structures)
      for (const o of g.solids) {
        if (!o.alive && o.alive !== undefined) continue;
        const dx = this.x - o.x, dy = this.y - o.y;
        const rr = this.r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          this.x = o.x + nx * rr; this.y = o.y + ny * rr;
          const vn = this.vx * nx + this.vy * ny;
          if (vn < 0) {
            this.vx -= nx * vn * 1.4; this.vy -= ny * vn * 1.4;
            if (-vn > 140) {
              this.takeDamage((-vn - 120) * 0.08, 'impact', null);
              AS.FX.sparks(this.x - nx * this.r, this.y - ny * this.r, this.z, 10, '#ffd27a');
              AS.Audio.sfx('scrape', { x: this.x, y: this.y });
              g.camera.shake(0.25);
            }
          }
        }
      }
      // operational area
      const m = 40;
      const W = g.map.w, H = g.map.h;
      let out = false;
      if (this.x < m) { this.vx += (m - this.x) * 6 * dt; out = true; }
      if (this.y < m) { this.vy += (m - this.y) * 6 * dt; out = true; }
      if (this.x > W - m) { this.vx -= (this.x - (W - m)) * 6 * dt; out = true; }
      if (this.y > H - m) { this.vy -= (this.y - (H - m)) * 6 * dt; out = true; }
      this.x = U.clamp(this.x, -80, W + 80); this.y = U.clamp(this.y, -80, H + 80);
      if (out) { this.warnOnce('bounds', 'leaving_area', 10); g.msg('LEAVING OPERATIONAL AREA', '#ffb04a', 0.5); }
    }

    useKit() {
      const s = this.s;
      if (this.kitT > 0) return;
      if (this.kits <= 0) { this.g.msg('NO REPAIR KITS', '#ff8a6a', 1.2); AS.Audio.sfx('denied'); return; }
      if (this.hull >= s.hullMax - 0.5) { this.g.msg('HULL INTACT', '#9fe8ff', 1); AS.Audio.sfx('denied'); return; }
      this.kits--; this.kitT = 1.4;
      AS.Audio.sfx('repair');
      this.g.msg('NANITE REPAIR IN PROGRESS', '#7dff9a', 1.4);
    }

    /* ---------- interaction: survivors, cargo, consoles ---------- */
    updateInteract(dt) {
      const g = this.g, I = AS.Input;
      const cand = g.findInteractable(this);
      this.interactTarget = cand;
      this.interactLabel = cand ? cand.interactLabel(this) : '';
      if (!cand) { this.interactT = 0; this.tractor = Math.max(0, this.tractor - dt * 3); return; }
      const holding = I.down('interact');
      if (cand.kind === 'survivors') {
        if (I.hit('interact')) cand.call(this);
        this.interactT = 0;
      } else if (holding && this.speed < 140) {
        const need = cand.interactTime || 1;
        if (this.interactT === 0) cand.onInteractStart && cand.onInteractStart(this);
        this.interactT += dt;
        this.tractor = Math.min(1, this.tractor + dt * 4);
        this.tractorTarget = cand;
        if (Math.random() < 0.4) AS.FX.beamUp(cand.x, cand.y, 2, this.z, cand.kind === 'cargo' ? '#9ff6ff' : '#ffd27a');
        if (this.interactT >= need) { this.interactT = 0; cand.complete(this); }
      } else {
        this.interactT = Math.max(0, this.interactT - dt * 2);
        this.tractor = Math.max(0, this.tractor - dt * 3);
      }
    }

    updatePad(dt) {
      const g = this.g, s = this.s;
      const pad = g.padAt(this.x, this.y);
      this.onPad = pad && this.speed < 120 ? pad : null;
      if (!this.onPad) { this.padT = 0; return; }
      const d = pad.def;
      this.padT += dt;
      let serviced = false;
      if (d.repair && this.hull < s.hullMax) { this.hull = Math.min(s.hullMax, this.hull + s.hullMax * 0.06 * dt); serviced = true; }
      if (d.refuel && this.fuel < s.fuelMax) { this.fuel = Math.min(s.fuelMax, this.fuel + s.fuelMax * 0.1 * dt); this.fuelWarned = {}; serviced = true; }
      if (d.rearm) {
        const P = s.primary, S2 = s.secondary;
        if (this.ammo.primary < P.ammoMax) { this.ammo.primary = Math.min(P.ammoMax, this.ammo.primary + P.ammoMax * 0.1 * dt); serviced = true; }
        if (this.ammo.secondary < S2.ammoMax) { this.rearmAcc = (this.rearmAcc || 0) + dt; if (this.rearmAcc > 0.8) { this.rearmAcc = 0; this.ammo.secondary++; } serviced = true; }
      }
      if (serviced && Math.random() < 0.3) AS.FX.beamUp(this.x + U.range(-14, 14), this.y + U.range(-10, 10), 0, this.z, '#7dff9a');
      if (serviced) { this.pad_service = true; } else this.pad_service = false;
      // drop-off of passengers and cargo
      if (d.dropoff && this.padT > 0.6) g.dropOff(this, pad, dt);
    }

    /* ---------- damage ---------- */
    takeDamage(amount, dtype, src, hitAngle) {
      if (!this.alive || this.dying > 0) return 0;
      const g = this.g;
      if (g.godMode) return 0;
      let toShield = amount, bypass = 0;
      if (dtype === 'explosive') bypass = 0.25;
      else if (dtype === 'bio') bypass = 0.45;
      else if (dtype === 'impact') bypass = 0.5;
      bypass *= amount; toShield = amount - bypass;
      if (dtype === 'energy') toShield *= 1.3;
      let hullDmg = bypass;
      if (this.shield > 0) {
        const took = Math.min(this.shield, toShield);
        this.shield -= took;
        const rest = toShield - took;
        hullDmg += dtype === 'energy' ? rest / 1.3 * 0.8 : rest;
        this.ripples.push({ a: hitAngle !== undefined ? hitAngle : Math.random() * TAU, t: 0.35 });
        AS.Audio.sfx('shield_hit', { vol: 0.6 });
        if (this.shield <= 0) { this.shield = 0; AS.Audio.sfx('shield_down'); this.warnOnce('shieldfail', 'shield_failure', 9); g.camera.shake(0.2); }
      } else hullDmg += dtype === 'energy' ? toShield / 1.3 : toShield;
      this.shieldT = this.s.shieldDelay;
      if (hullDmg > 0) {
        const before = this.hull / this.s.hullMax;
        this.hull -= hullDmg;
        this.dmgTaken += hullDmg;
        this.hurtFlash = 0.25;
        g.camera.shake(Math.min(0.5, 0.08 + hullDmg * 0.025));
        AS.Audio.sfx('hull_hit', { vol: 0.8 });
        AS.FX.sparks(this.x, this.y, this.z + 3, 4 + Math.min(10, hullDmg | 0), '#ffb060');
        const after = this.hull / this.s.hullMax;
        if (before > 0.5 && after <= 0.5) g.say('hull_50');
        if (before > 0.25 && after <= 0.25) { g.say('hull_critical'); AS.Audio.sfx('alarm'); }
        if (after < 0.35 && g.engagedCount() >= 3) this.warnOnce('retreat', 'retreat_advice', 60);
        if (this.hull <= 0) { this.hull = 0; this.startDying('Hull integrity lost.'); }
      }
      this.dmgTotal = (this.dmgTotal || 0) + amount;
      return amount;
    }
    heal(hp) { this.hull = Math.min(this.s.hullMax, this.hull + hp); }

    startDying(reason) {
      if (this.dying > 0) return;
      this.dying = 2.4; this.deathReason = reason; this.deathSpin = (Math.random() < 0.5 ? -1 : 1) * 6;
      this.g.camera.shake(0.6); this.g.camera.pulseZoom(0.12, 2.4);
      AS.Audio.sfx('alarm'); AS.Audio.sfx('explode_med', { x: this.x, y: this.y });
      AS.FX.explosion(this.x, this.y, this.z, 14);
      this.g.say('mission_fail_signal');
    }
    updateDying(dt) {
      this.dying -= dt;
      this.angle += this.deathSpin * dt;
      this.vx *= Math.exp(-0.8 * dt); this.vy *= Math.exp(-0.8 * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.z = Math.max(0, this.z - (8 + (2.4 - this.dying) * 14) * dt);
      AS.FX.smoke(this.x, this.y, this.z + 4, 10, true);
      AS.FX.fire(this.x, this.y, this.z + 4, 10);
      if (Math.random() < 0.15) { AS.FX.smallBoom(this.x + U.range(-12, 12), this.y + U.range(-8, 8), this.z + 4); AS.Audio.sfx('explode_small', { x: this.x, y: this.y }); }
      if (this.dying <= 0) {
        this.alive = false;
        AS.FX.explosion(this.x, this.y, 2, 40, { debrisCol: '#4a5058' });
        AS.FX.shockwave(this.x, this.y, 120);
        this.g.terrain.addDecal('crater', this.x, this.y, 36);
        this.g.camera.shake(1); this.g.camera.flash(0.5, '#ffd8a0');
        AS.Audio.sfx('explode_big', { x: this.x, y: this.y });
        this.g.fail(this.deathReason || 'Craft destroyed.', 2.2);
      }
    }

    /* ---------- visual effects ---------- */
    fx(dt) {
      const m = this.model, g = this.g;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      const thrustK = Math.max(Math.abs(this.thrust), Math.abs(this.strafeIn) * 0.6);
      const noFuel = this.fuel <= 0;
      for (const rp of m.ringPts) {
        const wx = this.x + rp[0] * ca - rp[1] * sa, wy = this.y + rp[0] * sa + rp[1] * ca;
        const flick = noFuel ? (Math.random() < 0.4 ? 0.2 : 0.8) : 1;
        AS.Renderer.light(wx, wy - this.z - 4, (16 + thrustK * 8 + (this.boosting ? 10 : 0)) * flick, m.glow, 0.5 * flick);
        if (Math.random() < 0.25 + thrustK * 0.5) {
          AS.Particles.spawn({ x: wx - ca * 3, y: wy - sa * 3, z: this.z + 2, vx: -ca * 40 + this.vx * 0.3, vy: -sa * 40 + this.vy * 0.3, vz: -10, shape: AS.Particles.CIRCLE, col: this.boosting ? '#ffffff' : m.glow, col2: '#2a6aff', size: this.boosting ? 2.4 : 1.6, size2: 0.3, life: 0.25, add: true });
        }
      }
      // downwash dust when low / over ground
      if (Math.random() < 0.08 + this.speed / 1600) {
        const k = g.terrain.kindFast(this.x, this.y);
        const col = k === 1 ? '#cfeee8' : k === 3 ? '#c0c8e8' : g.world.terrain.ramp[2];
        const a = Math.random() * TAU;
        AS.Particles.spawn({ x: this.x + Math.cos(a) * 10, y: this.y + Math.sin(a) * 7 + 3, z: 1, vx: Math.cos(a) * 60, vy: Math.sin(a) * 40, shape: AS.Particles.SMOKE, col, size: 2, size2: 7, life: 0.55, alpha: 0.22, drag: 3, layer: 0 });
      }
      // lateral thrusters when turning / strafing
      const lat = this.angVel * 0.3 + this.strafeIn;
      if (Math.abs(lat) > 0.3 && Math.random() < 0.7) {
        const side = lat > 0 ? -1 : 1;
        const px = this.x + (-4) * ca - (side * 15) * sa, py = this.y + (-4) * sa + (side * 15) * ca;
        AS.Particles.spawn({ x: px, y: py, z: this.z + 4, vx: -sa * side * 70 + this.vx * 0.5, vy: ca * side * 70 + this.vy * 0.5, shape: AS.Particles.SMOKE, col: '#d8e8ff', col2: '#8090a0', size: 1, size2: 4, life: 0.25, alpha: 0.6 });
      }
      // damage smoke / fire
      const hp = this.hull / this.s.hullMax;
      if (hp < 0.5 && Math.random() < (0.5 - hp) * 1.6) AS.FX.smoke(this.x - ca * 10, this.y - sa * 10, this.z + 6, 4, hp < 0.25);
      if (hp < 0.25 && Math.random() < 0.3) AS.FX.fire(this.x - ca * 8, this.y - sa * 8, this.z + 6, 5);
      if (hp < 0.15 && Math.random() < 0.05) AS.FX.sparks(this.x, this.y, this.z + 4, 4, '#ffd27a');
    }

    drawShadow(ctx, ox, oy) {
      if (!this.alive && this.dying <= 0) return;
      const R = AS.Renderer;
      ctx.globalAlpha *= 0.85;
      R.shadow(ctx, this.sheet, this.angle, this.x, this.y, this.z, ox, oy);
    }
    draw(ctx, ox, oy, R) {
      if (!this.alive && this.dying <= 0) return;
      const m = this.model;
      const rec = this.recoil;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      const x = this.x - ca * rec, y = this.y - sa * rec;
      // tractor beam
      if (this.tractor > 0.05 && this.tractorTarget) {
        const t = this.tractorTarget;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * this.tractor;
        const grd = ctx.createLinearGradient(0, y - this.z - oy, 0, t.y - oy);
        grd.addColorStop(0, '#9ff6ff'); grd.addColorStop(1, 'rgba(159,246,255,0.1)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(x - ox - 4, y - this.z - oy); ctx.lineTo(x - ox + 4, y - this.z - oy); ctx.lineTo(t.x - ox + 12, t.y - oy); ctx.lineTo(t.x - ox - 12, t.y - oy); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      R.sprite(ctx, this.sheet, this.angle, 0, x, y, this.z, ox, oy);
      if (this.hurtFlash > 0) R.flashSprite(ctx, this.sheet, this.angle, 0, x, y, this.z, ox, oy, '#ff6a4a');
      // weapon pods (articulated, aim independently)
      const podOff = [[3, 9], [3, -9]];
      for (let i = 0; i < 2; i++) {
        const p = podOff[i];
        const px = x + p[0] * ca - p[1] * sa, py = y + p[0] * sa + p[1] * ca;
        R.sprite(ctx, this.podSheet, this.aimAngle, 0, px, py, this.z + 7, ox, oy);
      }
      // engine ring glow
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const noFuel = this.fuel <= 0;
      for (const rp of m.ringPts) {
        const wx = x + rp[0] * ca - rp[1] * sa, wy = y + rp[0] * sa + rp[1] * ca;
        const pulse = 0.7 + Math.sin(this.bob * 12 + rp[1]) * 0.15 + Math.abs(this.thrust) * 0.2;
        ctx.globalAlpha = (noFuel ? (Math.random() < 0.5 ? 0.2 : 0.6) : 0.85) * pulse;
        const gl = AS.Forge.glow(m.glow, 32);
        const rr = m.ringR * 2.2 + (this.boosting ? 4 : 0);
        ctx.drawImage(gl, wx - ox - rr, wy - this.z - 4 - oy - rr, rr * 2, rr * 2);
      }
      // shield ripples
      for (const r of this.ripples) {
        ctx.globalAlpha = r.t / 0.35 * 0.9;
        ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x - ox, y - this.z - 3 - oy, 22, 17, 0, r.a - 0.9, r.a + 0.9); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x - ox, y - this.z - 3 - oy, 21, 16, 0, r.a - 0.4, r.a + 0.4); ctx.stroke();
      }
      if (this.kitT > 0) {
        ctx.globalAlpha = 0.4 + Math.sin(this.bob * 20) * 0.2; ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x - ox, y - this.z - 3 - oy, 24, 18, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      // drones
      for (const d of this.drones) d.draw(ctx, ox, oy, R);
    }
  }
  Player.HOVER = HOVER;
  AS.Player = Player;
})(window.AS);

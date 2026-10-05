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
      const ukey = JSON.stringify(profile.upgrades || {});
      this.sheet = AS.Forge.sheet('craft2:' + ukey, () => AS.Models.craft(profile.upgrades), 64, 1);
      this.sheetDamaged = AS.Forge.sheet('craft2d:' + ukey, () => AS.Models.craft(profile.upgrades, { damage: 1 }), 64, 1);
      this.model = this.sheet.model;
      this.podSheet = AS.Forge.sheet('pod2:' + (profile.upgrades.pSpread || 0) + ':' + stats.primary.id, () => AS.Models.pod(profile.upgrades, stats.primary.id), 32, 1);
      this.drones = [];
      this.retrieval = new AS.Retrieval(this);
      // flight feel: smoothed body attitude from acceleration (bank = roll, pitch = nose)
      this.bank = 0; this.pitch = 0; this.accF = 0; this.accL = 0; this.moveX = 0; this.moveY = 0; this.navT = Math.random() * 2;
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
      this.updateAim();
      const mode = AS.Settings.controlMode || 'twinstick';
      let thrust = (I.down('forward') ? 1 : 0) - (I.down('back') ? 1 : 0);
      let turn = 0, strafe = 0;
      // twin-stick: a screen-space movement vector, the body turns to face the aim
      let twin = mode === 'twinstick' || (I.usingPad && I.pad);
      let mvx = 0, mvy = 0;
      if (I.usingPad && I.pad) {
        const mx = I.padState.moveX || 0, my = I.padState.moveY || 0;
        if (Math.abs(mx) + Math.abs(my) > 0.2) { mvx = mx; mvy = my; }
      } else if (twin) {
        mvx = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
        mvy = (I.down('back') ? 1 : 0) - (I.down('forward') ? 1 : 0);
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
      let mlen = Math.hypot(mvx, mvy);
      if (mlen > 1) { mvx /= mlen; mvy /= mlen; mlen = 1; }
      if (hz && hz.scramble > 0) {
        // spore contamination: controls drift and invert intermittently
        const k = Math.sin(g.time * 3.1) > 0.2 ? -1 : 1;
        turn = turn * k + Math.sin(g.time * 7.3) * 0.5;
        strafe += Math.cos(g.time * 5.1) * 0.6;
        if (twin) { mvx = mvx * k + Math.cos(g.time * 5.1) * 0.5; mvy = mvy * k + Math.sin(g.time * 6.3) * 0.5; mlen = Math.min(1, Math.hypot(mvx, mvy)); }
      }
      if (twin) {
        // express the movement vector in the craft frame for fuel, FX and attitude
        const fx0 = Math.cos(this.angle), fy0 = Math.sin(this.angle);
        thrust = mvx * fx0 + mvy * fy0; strafe = -mvx * fy0 + mvy * fx0;
      }
      let boost = I.down('boost') && (twin ? mlen > 0.2 : thrust > 0) && this.fuel > 0;
      this.thrust = thrust; this.turnIn = turn; this.strafeIn = strafe; this.boosting = boost;
      this.moveX = mvx; this.moveY = mvy;

      /* ---------- fuel ---------- */
      const lowG = hz && hz.lowGrav;
      let burn = 0.085 + (twin ? 0.4 * mlen : 0.36 * Math.abs(thrust) + 0.18 * Math.abs(strafe)) + (boost ? 0.95 : 0);
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
      const vx0 = this.vx, vy0 = this.vy;
      if (twin) {
        // the body swings to face the aim point (or the stick direction on a pad)
        let want = this.aimAngle;
        if (I.usingPad && I.pad && !I.padAim.active && mlen > 0.2) want = Math.atan2(mvy, mvx);
        const d = U.wrapAngle(want - this.angle);
        const tr = Math.max(5.5, s.turnRate * 2.1);
        this.angVel = U.approach(this.angVel, U.clamp(d * 10, -tr, tr), 40 * dt);
        if (Math.abs(d) < 0.002 && Math.abs(this.angVel) < 0.05) this.angVel = 0;
        this.angle = U.wrapAngle(this.angle + this.angVel * dt);
      } else {
        // rotation with a little angular inertia
        const turnRate = s.turnRate * (mode === 'assault' ? 1.3 : 1);
        this.angVel = U.approach(this.angVel, turn * turnRate, 16 * dt);
        this.angle = U.wrapAngle(this.angle + this.angVel * dt);
      }
      const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
      const rx = -fy, ry = fx;
      let twinMax = 1;
      if (twin) {
        if (mlen > 0.01) {
          // full authority ahead, a little less sideways (strafe) and backwards
          const along = (mvx * fx + mvy * fy) / mlen;
          const authority = along >= 0 ? U.lerp(0.86 + 0.14 * Math.min(1, s.strafe / 0.72), 1, along) : U.lerp(0.86, 0.72, -along);
          twinMax = along >= 0 ? U.lerp(0.93, 1, along) : U.lerp(0.93, 0.8, -along);
          this.vx += mvx * acc * authority * dt;
          this.vy += mvy * acc * authority * dt;
        }
      } else {
        const tAcc = thrust > 0 ? acc : acc * 0.7;
        this.vx += (fx * thrust * tAcc + rx * strafe * acc * s.strafe) * dt;
        this.vy += (fy * thrust * tAcc + ry * strafe * acc * s.strafe) * dt;
      }
      if (hz && hz.windX !== undefined) {
        // landing clamps: pads and the LZ shelter the craft from the worst of the wind
        const ex = g.extraction, sheltered = g.padAt(this.x, this.y) || (ex && Math.hypot(this.x - ex.x, this.y - ex.y) < ex.r + 20);
        const wk = sheltered && !thrust && !strafe ? 0.15 : 1;
        this.vx += hz.windX * dt * wk; this.vy += hz.windY * dt * wk;
      }
      const dragMul = lowG ? 0.45 : 1;
      if (twin) {
        // drift that still turns crisply: velocity across the stick bleeds fast,
        // velocity along it slowly; with no input the craft glides to a halt
        if (mlen > 0.01) {
          const ux = mvx / mlen, uy = mvy / mlen;
          let va = this.vx * ux + this.vy * uy, vc = -this.vx * uy + this.vy * ux;
          va *= Math.exp(-0.5 * dragMul * dt); vc *= Math.exp(-3.2 * dragMul * dt);
          this.vx = ux * va - uy * vc; this.vy = uy * va + ux * vc;
        } else {
          const k = Math.exp(-1.9 * dragMul * dt); this.vx *= k; this.vy *= k;
        }
      } else {
        // anisotropic drag: forward bleeds slowly, lateral faster (mild drift)
        let vf = this.vx * fx + this.vy * fy, vl = this.vx * rx + this.vy * ry;
        const kf = thrust !== 0 ? 0.55 : 1.5, kl = strafe !== 0 ? 0.8 : 2.4;
        vf *= Math.exp(-kf * dragMul * dt); vl *= Math.exp(-kl * dragMul * dt);
        this.vx = fx * vf + rx * vl; this.vy = fy * vf + ry * vl;
      }
      const sp = Math.hypot(this.vx, this.vy), cap = maxSp * twinMax;
      if (sp > cap) { const k = U.lerp(cap / sp, 1, Math.exp(-6 * dt)); this.vx *= k; this.vy *= k; }
      // body attitude follows the acceleration actually felt, in the craft frame
      const ax = (this.vx - vx0) / Math.max(dt, 1e-4), ay = (this.vy - vy0) / Math.max(dt, 1e-4);
      this.accF = U.damp(this.accF, ax * fx + ay * fy, 10, dt);
      this.accL = U.damp(this.accL, ax * rx + ay * ry, 10, dt);
      this.bank = U.damp(this.bank, U.clamp(this.accL / 520, -1, 1) * 0.42 + U.clamp(this.angVel / 9, -1, 1) * 0.12, 7, dt);
      this.pitch = U.damp(this.pitch, U.clamp(this.accF / 520, -1, 1) * 0.3, 7, dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      // recoil
      this.recoil = Math.max(0, this.recoil - dt * 8);
      // hover height bob (and sag when out of fuel)
      const targetZ = (noFuel ? 14 + Math.sin(g.time * 9) * 2 : HOVER) + Math.sin(this.bob * 2.3) * 1.4;
      this.z = U.damp(this.z, targetZ, 3, dt);

      this.collide(dt);

      /* ---------- aim (re-evaluated after moving) ---------- */
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

      /* ---------- retrieval beam + interaction ---------- */
      this.retrieval.update(dt);
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
      } else if (I.usingPad) {
        // no right-stick input: aim where the nose points
        this.aimX = this.x + Math.cos(this.angle) * 200; this.aimY = this.py + Math.sin(this.angle) * 200;
      } else {
        const w = AS.Renderer.screenToWorld(I.mouse.x, I.mouse.y, cam);
        this.aimX = w.x; this.aimY = w.y;
      }
      this.aimAngle = Math.atan2(this.aimY - this.py, this.aimX - this.x);
    }

    collide(dt) {
      const g = this.g;
      // major obstacles (spires, tall structures)
      for (const o of g.solids) {
        if ((!o.alive && o.alive !== undefined) || o.groundOnly) continue;
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
      // the retrieval beam owns the interact key while it has something to lift
      const R = this.retrieval;
      const cand = R && (R.active || R.candidate) ? null : g.findInteractable(this);
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
    // object-space point (ox along the nose, oy to starboard) → world ground position
    local(px, py) {
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      return { x: this.x + px * ca - py * sa, y: this.y + px * sa + py * ca };
    }
    fx(dt) {
      const m = this.model, g = this.g, P = AS.Particles;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      const noFuel = this.fuel <= 0;
      const sp = this.speed;
      const drive = Math.min(1, Math.hypot(this.thrust, this.strafeIn) + sp / 600);
      // propulsion rings: light the ground under them
      for (const rp of m.ringPts) {
        const q = this.local(rp[0], rp[1]);
        const flick = noFuel ? (Math.random() < 0.4 ? 0.2 : 0.8) : 1;
        AS.Renderer.light(q.x, q.y - this.z - 4, (15 + drive * 9 + (this.boosting ? 10 : 0)) * flick, m.glow, 0.45 * flick);
      }
      // main engines: exhaust plume streams behind, longer and hotter with speed / boost
      const fwdPush = Math.max(0, this.accF) / 520 + (this.boosting ? 1 : 0) + Math.max(0, this.thrust) * 0.6;
      for (const e of m.exhaust) {
        const q = this.local(e[0], e[1]);
        const z = this.z + e[2];
        AS.Renderer.light(q.x, q.y - z, 10 + fwdPush * 8, this.boosting ? '#cfe8ff' : m.glow, 0.35 + fwdPush * 0.2);
        if (Math.random() < 0.35 + fwdPush * 0.6 && !noFuel) {
          const v = 50 + fwdPush * 140;
          P.spawn({ x: q.x - ca * 2, y: q.y - sa * 2, z, vx: -ca * v + this.vx * 0.4, vy: -sa * v + this.vy * 0.4, vz: 0, shape: P.CIRCLE, col: this.boosting ? '#ffffff' : '#bff4ff', col2: this.boosting ? '#5a8aff' : '#2a7aff', size: 1.3 + fwdPush * 0.8, size2: 0.25, life: 0.16 + fwdPush * 0.08, add: true });
        }
      }
      // retro thrusters fire forward when braking hard / reversing
      if (this.accF < -260 && sp > 40 && !noFuel) {
        for (const r of m.retro) if (Math.random() < 0.55) {
          const q = this.local(r[0], r[1]);
          P.spawn({ x: q.x, y: q.y, z: this.z + r[2], vx: ca * 90 + this.vx * 0.5, vy: sa * 90 + this.vy * 0.5, shape: P.SMOKE, col: '#e8f4ff', col2: '#8aa0b0', size: 1, size2: 4, life: 0.22, alpha: 0.65 });
        }
      }
      // lateral thrusters puff opposite to the sideways acceleration
      if (Math.abs(this.accL) > 160 && !noFuel) {
        const side = this.accL > 0 ? -1 : 1;
        for (const l of m.lateral) if (Math.random() < 0.5) {
          const q = this.local(l[0], l[1] * side);
          P.spawn({ x: q.x, y: q.y, z: this.z + l[2], vx: -sa * side * 80 + this.vx * 0.5, vy: ca * side * 80 + this.vy * 0.5, shape: P.SMOKE, col: '#d8e8ff', col2: '#8090a0', size: 0.9, size2: 3.6, life: 0.22, alpha: 0.6 });
        }
      }
      // downwash: dust and grit kicked up under the craft, stronger when moving
      const k = g.terrain.kindFast(this.x, this.y);
      if (Math.random() < 0.1 + sp / 900) {
        const col = k === 1 ? '#cfeee8' : k === 3 ? '#c0c8e8' : k === 2 ? '#ffb070' : g.world.terrain.ramp[2];
        const a = Math.random() * TAU;
        P.spawn({ x: this.x + Math.cos(a) * 12, y: this.y + Math.sin(a) * 8 + 3, z: 1, vx: Math.cos(a) * (50 + sp * 0.2) - this.vx * 0.15, vy: Math.sin(a) * (34 + sp * 0.15) - this.vy * 0.15, shape: P.SMOKE, col, size: 2, size2: 8, life: 0.6, alpha: k === 1 ? 0.3 : 0.2, drag: 3, layer: 0 });
      }
      if (k === 1 && Math.random() < 0.25) P.spawn({ x: this.x + U.range(-14, 14), y: this.y + U.range(-9, 9), z: 0, shape: P.RING, col: '#e8fffa', size: 2, size2: 11, life: 0.5, alpha: 0.35, layer: 0 });
      // damage smoke / fire / sparks
      const hp = this.hull / this.s.hullMax;
      if (hp < 0.5 && Math.random() < (0.5 - hp) * 1.6) { const q = this.local(-16, 4); AS.FX.smoke(q.x, q.y, this.z + 6, 4, hp < 0.25); }
      if (hp < 0.25 && Math.random() < 0.3) { const q = this.local(-6, -10); AS.FX.fire(q.x, q.y, this.z + 5, 5); }
      if (hp < 0.15 && Math.random() < 0.05) AS.FX.sparks(this.x, this.y, this.z + 4, 4, '#ffd27a');
      this.navT += dt;
    }

    drawShadow(ctx, ox, oy) {
      if (!this.alive && this.dying <= 0) return;
      const R = AS.Renderer, sh = this.sheet;
      const di = AS.Forge.frameIndex(sh, this.angle);
      const off = 2 + this.z * 0.12;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      // the shadow slides sideways a touch as the craft banks
      const bx = -sa * this.bank * 5, by = ca * this.bank * 5;
      ctx.save();
      ctx.globalAlpha *= 0.8;
      ctx.translate(this.x - ox + off + this.z * 0.15 + bx, this.y - oy + off * 0.5 + by);
      ctx.rotate(this.angle); ctx.scale(1 - Math.abs(this.pitch) * 0.1, Math.cos(this.bank)); ctx.rotate(-this.angle);
      ctx.drawImage(sh.shadows[di], -sh.ax, -sh.ay, sh.w, sh.h);
      ctx.restore();
    }
    // draw a sheet frame with the craft's bank / pitch attitude applied about its body centre
    drawBody(ctx, img, sh, x, y, ox, oy) {
      const pivot = 6;
      ctx.save();
      ctx.translate(x - ox, y - this.z - pivot - oy);
      ctx.rotate(this.angle);
      ctx.scale(1 - Math.abs(this.pitch) * 0.1, Math.cos(this.bank));
      ctx.rotate(-this.angle);
      ctx.drawImage(img, -sh.ax, -sh.ay + pivot, sh.w, sh.h);
      ctx.restore();
    }
    draw(ctx, ox, oy, R) {
      if (!this.alive && this.dying <= 0) return;
      const m = this.model;
      const rec = this.recoil;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      const x = this.x - ca * rec, y = this.y - sa * rec;
      const sh = this.hull / this.s.hullMax < 0.45 ? this.sheetDamaged : this.sheet;
      const di = AS.Forge.frameIndex(sh, this.angle);
      // legacy tractor quad (consoles / cargo use the retrieval beam visuals when present)
      if (this.tractor > 0.05 && this.tractorTarget && !(this.retrieval && this.retrieval.active)) {
        const t = this.tractorTarget;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * this.tractor;
        const grd = ctx.createLinearGradient(0, y - this.z - oy, 0, t.y - oy);
        grd.addColorStop(0, '#9ff6ff'); grd.addColorStop(1, 'rgba(159,246,255,0.08)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(x - ox - 3, y - this.z - oy); ctx.lineTo(x - ox + 3, y - this.z - oy); ctx.lineTo(t.x - ox + 10, t.y - oy); ctx.lineTo(t.x - ox - 10, t.y - oy); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      if (this.retrieval && this.retrieval.drawBeam) this.retrieval.drawBeam(ctx, ox, oy, 'under');
      this.drawBody(ctx, sh.frames[0][di], sh, x, y, ox, oy);
      if (this.hurtFlash > 0) {
        if (!sh.__flash) R.flashSprite(ctx, sh, this.angle, 0, -1e5, -1e5, 0, 0, 0, '#ff6a4a');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * Math.min(1, this.hurtFlash * 4);
        this.drawBody(ctx, sh.__flash[di], sh, x, y, ox, oy);
        ctx.restore();
      }
      // weapon pods (articulated, aim independently); the raised side rides a little higher
      for (let i = 0; i < m.pods.length; i++) {
        const p = m.pods[i];
        const px = x + p[0] * ca - p[1] * sa, py = y + p[0] * sa + p[1] * ca;
        const lift = -Math.sign(p[1]) * this.bank * 4;
        R.sprite(ctx, this.podSheet, this.aimAngle, 0, px, py, this.z + m.podZ + lift, ox, oy);
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const noFuel = this.fuel <= 0;
      // propulsion ring glow
      const gl = AS.Forge.glow(m.glow, 32);
      for (const rp of m.ringPts) {
        const wx = x + rp[0] * ca - rp[1] * sa, wy = y + rp[0] * sa + rp[1] * ca;
        const lift = -Math.sign(rp[1]) * this.bank * 4;
        const pulse = 0.72 + Math.sin(this.bob * 12 + rp[1]) * 0.12 + Math.min(0.25, this.speed / 900);
        ctx.globalAlpha = (noFuel ? (Math.random() < 0.5 ? 0.2 : 0.6) : 0.8) * pulse;
        const rr = m.ringR * 2 + (this.boosting ? 4 : 0);
        ctx.drawImage(gl, wx - ox - rr, wy - this.z - 3.4 - oy - rr + lift, rr * 2, rr * 2);
      }
      // engine nozzles
      const push = Math.min(1.6, Math.max(0, this.accF) / 520 + (this.boosting ? 1 : 0) + Math.max(0, this.thrust) * 0.5);
      for (const e of m.exhaust) {
        const wx = x + e[0] * ca - e[1] * sa, wy = y + e[0] * sa + e[1] * ca;
        const rr = 3.2 + push * 2.4;
        ctx.globalAlpha = noFuel ? 0.15 : 0.55 + push * 0.25;
        ctx.drawImage(AS.Forge.glow(this.boosting ? '#e8f4ff' : m.glow, 32), wx - ox - rr - ca * push * 3, wy - this.z - e[2] - oy - rr - sa * push * 3, rr * 2, rr * 2);
      }
      // nav lights: steady port / starboard, white tail strobe
      for (const L of m.lights) {
        const wx = x + L.x * ca - L.y * sa, wy = y + L.x * sa + L.y * ca;
        const lift = -Math.sign(L.y) * this.bank * 4;
        const on = L.strobe ? (this.navT % 1.3) < 0.08 : 0.75 + Math.sin(this.navT * 3 + L.y) * 0.15;
        if (!on) continue;
        const rr = L.strobe ? 7 : 3.4;
        ctx.globalAlpha = L.strobe ? 0.95 : on * 0.85;
        ctx.drawImage(AS.Forge.glow(L.col, 32), wx - ox - rr, wy - this.z - L.z - oy - rr + lift, rr * 2, rr * 2);
      }
      // shield ripples
      for (const r of this.ripples) {
        ctx.globalAlpha = r.t / 0.35 * 0.9;
        ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x - ox, y - this.z - 5 - oy, 27, 21, 0, r.a - 0.9, r.a + 0.9); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x - ox, y - this.z - 5 - oy, 26, 20, 0, r.a - 0.4, r.a + 0.4); ctx.stroke();
      }
      if (this.kitT > 0) {
        ctx.globalAlpha = 0.4 + Math.sin(this.bob * 20) * 0.2; ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x - ox, y - this.z - 5 - oy, 29, 22, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      if (this.retrieval && this.retrieval.drawBeam) this.retrieval.drawBeam(ctx, ox, oy, 'over');
      // drones
      for (const d of this.drones) d.draw(ctx, ox, oy, R);
    }
  }
  Player.HOVER = HOVER;
  AS.Player = Player;
})(window.AS);

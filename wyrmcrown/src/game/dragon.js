/* WYRMCROWN — the wizard-and-dragon pair.
 * One class flies every dragon, human or AI: each frame a pilot fills the same
 * input record (throttle, turn, dive, sprint, aim, fire, breath, eat), so the
 * player's dragon and the three rivals share one flight model — the basis for
 * a later four-player mode.
 *
 * Flight model (arcade, not a simulator):
 *  - the dragon always flies forward; with no input it glides and slowly bleeds
 *    speed toward cruise, giving the occasional lazy wing beat to hold it;
 *  - W beats the wings: thrust arrives in surges on each downstroke, so speed
 *    visibly builds with the stroke; Shift sprints (faster, deeper beats, costs
 *    energy); S flares the wings to brake, down to a heavy hovering beat;
 *  - turn rate falls with speed: slow = tight circles, fast = broad sweeping
 *    turns; the body banks into every turn and the velocity lags the heading a
 *    little, so hard turns carry momentum;
 *  - Space dives: the dragon drops to skimming height and gains speed; on
 *    release it pulls up, trading speed back for height;
 *  - a double-tap of Space loops the loop: up, over on its back and down again
 *    behind its own line, slipping every bolt, arrow and breath in the air
 *    (a short cooldown and a little energy).
 * Altitude matters: skimming is needed to eat, capture sites and breathe fire
 * at full strength, and exposes the dragon to spears and ground fire. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  const LOOP = { dur: 1.35, cd: 3.5, cost: 6, evade: [0.08, 0.86] }; // seconds, seconds, energy, fraction of the loop that dodges
  const FLIGHT = {
    cruise: 185, flapMax: 300, sprintMax: 415, diveMax: 480, hover: 34,
    flapAcc: 300,      // peak downstroke thrust (u/s²); averaged ≈ 95
    sprintAcc: 480,
    glideDrag: 0.16,   // per second, above cruise
    brakeDec: 260,
    diveAcc: 300,
    zCruise: 62, zHigh: 82, zLow: 13, zHover: 40,
    turn: [[0, 3.6], [60, 3.4], [185, 2.05], [300, 1.38], [415, 0.95], [480, 0.8]], // speed → max turn rate (rad/s)
    turnAcc: 7.5,
    // how much ground a unit of flight speed covers: every speed above (cruise, beats, sprint,
    // dive, hover) and every rule built on them stays the same, the dragon just travels 20% less far
    pace: 0.8,
  };
  function turnRate(v) {
    const T = FLIGHT.turn;
    for (let i = 1; i < T.length; i++) if (v <= T[i][0]) return U.lerp(T[i - 1][1], T[i][1], (v - T[i - 1][0]) / (T[i][0] - T[i - 1][0]));
    return T[T.length - 1][1];
  }

  function blankInput() { return { throttle: 0, turn: 0, dive: false, loop: false, sprint: false, fire: false, breath: false, breathTarget: null, eat: false, eatHit: false, aimX: 0, aimY: 0, steer: null, spell: false }; }

  class Dragon {
    constructor(g, faction, opts) {
      opts = opts || {};
      this.g = g; this.faction = faction; this.fk = faction.key; this.team = faction.key;
      this.fdef = AS.Data.factions[this.fk];
      this.isDragon = true;
      const D = faction.dragon;
      this.def = D;
      this.name = D.name;
      this.x = opts.x || 0; this.y = opts.y || 0; this.z = FLIGHT.zCruise;
      this.angle = opts.angle !== undefined ? opts.angle : -Math.PI / 2;
      this.velA = this.angle; this.speed = FLIGHT.cruise * 0.8;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.angVel = 0; this.bank = 0; this.pitch = 0;
      this.phase = 0.25; this.freq = 0; this.amp = 0.5; this.wing = { elev: 0.1, fold: 0, sweep: 0, cup: 0, span: 1 };
      this.input = blankInput();
      this.pilot = opts.pilot || null;
      this.r = 22; this.hc = 6;
      this.alive = true; this.down = 0; // down > 0: driven off, recovering at the roost
      this.t = Math.random() * 10;
      this.recompute();
      this.hp = this.maxHp; this.energy = this.maxEnergy * 0.85; this.mana = this.maxMana; this.fireCharge = this.maxFire;
      this.fireCd = 0; this.fireDelay = 0; this.breathing = false; this.breathT = 0; this.breathTick = 0;
      this.cast = 0; this.hurt = 0; this.lastHurt = -10; this.lastHitBy = null;
      this.carry = null; this.carryT = 0; this.eatT = 0; this.eating = null; this.grabCd = 0;
      this.loop = null; this.loopCd = 0;
      this.buffs = {}; // power-ups: key → seconds left
      this.stats = { kills: 0, eaten: 0, gold: 0, captures: 0 };
      this.nodes = AS.DragonArt.CHAIN.map(() => ({ x: this.x, y: this.y, z: this.z, a: this.angle }));
      this.layoutRig(0, true);
      this.riderSheet = AS.DragonArt.riderSheet(this.fk, faction.rider);
      this.drawState = { fk: this.fk, scale: this.scale, nodes: this.nodes, wing: this.wing, bank: 0, open: false, hurt: 0, rider: true, riderSheet: this.riderSheet, aim: this.angle, t: 0, orb: faction.rider.orb };
    }
    get py() { return this.y - this.z - this.hc; }
    get sortY() { return this.y + 4; }
    get targetable() { return this.alive && this.down <= 0 && !this.evading; }
    // mid-loop the dragon is out of the line of fire
    get evading() { const L = this.loop; return !!L && L.t > L.dur * LOOP.evade[0] && L.t < L.dur * LOOP.evade[1]; }

    /* stats from faction base + upgrades (dragon upgrades live on the faction) */
    recompute() {
      const D = this.def, L = (k) => (this.faction.upgrades && this.faction.upgrades[k]) || 0;
      this.scale = (D.scale || 1) * (1 + L('dragonSize') * 0.06);
      this.maxHp = Math.round(D.hp * (1 + L('scales') * 0.22) * (this.faction.ai ? this.faction.aiHp || 1 : 1));
      this.armor = (D.armor || 0) + L('scales') * 1.5;
      this.speedMul = (D.speed || 1) * (1 + L('wings') * 0.07);
      this.turnMul = (D.turn || 1) * (1 + L('wings') * 0.06);
      this.maxEnergy = 100 * (1 + L('stomach') * 0.25);
      this.drainMul = Math.pow(0.85, L('stomach'));
      this.maxFire = 100 * (1 + L('lungs') * 0.25);
      this.fireDmg = (D.breathDmg || 1) * (1 + L('lungs') * 0.2);
      this.maxMana = 100 * (1 + L('staffMana') * 0.25);
      this.boltDmg = (D.boltDmg || 1) * (1 + L('staffPower') * 0.2);
      this.boltRate = 1 + L('staffRate') * 0.18; // (a multiplier on the rider's own spell rate: combat.js BOLT)
      this.boltMulti = 1 + (L('staffPower') >= 3 ? 1 : 0);
      this.r = 22 * this.scale;
    }

    /* ================= update ================= */
    update(dt) {
      const g = this.g;
      this.t += dt;
      for (const k in this.buffs) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) { delete this.buffs[k]; if (this.onBuffEnd) this.onBuffEnd(k); } }
      if (this.down > 0) { this.loop = null; this.updateDown(dt); return; }
      if (this.pilot) this.pilot.read(this, this.input, dt);
      this.loopCd -= dt;
      if (this.input.loop) { this.input.loop = false; this.startLoop(); }
      // waygate travel and stored spells
      if (this.input.eatHit && !this.carry && !this.loop && AS.Sites) {
        const gate = AS.Sites.gateAt(this.g, this);
        if (gate && AS.Sites.gatesOf(this.g, this.team).length > 1) {
          if (this.isPlayer && AS.WarMap) { AS.WarMap.openTravel(this.g, gate); this.input.eatHit = false; }
          else if (this.ai && this.ai.travelTo) { AS.Sites.travel(this.g, this, this.ai.travelTo); this.ai.travelTo = null; this.input.eatHit = false; }
        }
      }
      if (this.input.spellHit && AS.Powerups) { AS.Powerups.cast(this); this.input.spellHit = false; }
      this.flight(dt);
      this.vitals(dt);
      if (AS.Combat) AS.Combat.dragonWeapons(this, dt);
      if (AS.Life) AS.Life.dragonFeeding(this, dt);
      this.hurt = Math.max(0, this.hurt - dt);
      this.cast = Math.max(0, this.cast - dt * 4);
      this.layoutRig(dt);
      if (this.loop) this.layoutLoop();
      this.fx(dt);
    }

    flight(dt) {
      const F = FLIGHT, I = this.input, g = this.g;
      const exhausted = this.energy <= 0.01, tired = this.energy < this.maxEnergy * 0.2;
      const haste = this.buffs.haste ? 1.3 : 1;
      const sm = this.speedMul * haste * (exhausted ? 0.62 : tired ? 0.85 : 1);
      let thr = U.clamp(I.throttle, -1, 1);
      let turn = U.clamp(I.turn, -1, 1);
      // mouse flight: steer toward a world point
      if (I.steer) {
        const want = Math.atan2(I.steer.y - this.y, I.steer.x - this.x);
        const d = U.wrapAngle(want - this.angle);
        const dist = Math.hypot(I.steer.x - this.x, I.steer.y - this.y);
        turn = dist < 30 ? 0 : U.clamp(d * 2.6, -1, 1);
      }
      if (this.loop) return this.loopTime(dt);
      // ---- landing: flare low and slow over open ground and the dragon settles;
      // W (or a dive) launches it again with a hard beat of the wings
      if (this.landed) return this.groundTime(dt, thr, turn);
      this.brakeT = thr < -0.1 && !I.dive ? (this.brakeT || 0) + dt : 0;
      if (this.landing || (this.brakeT > 0.7 && this.speed < F.hover + 24 && this.z < F.zHover + 8 && !this.carry && this.canLand())) {
        if (thr > 0.3 || I.dive || !this.canLand()) this.landing = false;
        else return this.touchDown(dt, turn);
      }
      const sprint = I.sprint && thr >= 0 && !tired && !I.dive;
      // SPACE takes the dragon low; on its own it holds its speed, with S it
      // slows into a low glide, with W it becomes a full power dive
      const dive = I.dive && !this.carryHeavy;
      const braking = thr < -0.1;
      const power = dive && thr > 0.1;
      const tucked = dive && !braking;
      this.diving = dive; this.powerDive = power; this.braking = braking; this.sprinting = sprint && (thr > 0 || this.speed < F.sprintMax * sm);
      // ---- wing stroke: frequency, amplitude and thrust on the downstroke
      let freq = 0, amp = 0.5;
      const cruise = F.cruise * sm;
      if (tucked) { freq = power ? 0 : this.speed < cruise - 20 ? 1.1 : 0; amp = 0.4; }
      else if (this.sprinting) { freq = 2.9; amp = 0.62; }
      else if (thr > 0.1) { freq = 2.15; amp = 0.55; }
      else if (braking) { freq = this.speed < 90 ? 1.7 : 0.9; amp = 0.72; }
      else if (this.speed < cruise - 18) { freq = 1.25; amp = 0.42; } // lazy beats to hold cruise
      else freq = 0; // glide
      this.freq = U.damp(this.freq, freq, 6, dt);
      this.amp = U.damp(this.amp, amp, 4, dt);
      const flapping = this.freq > 0.25;
      if (flapping) this.phase = (this.phase + this.freq * dt) % 1;
      else {
        // ease toward the glide pose (wings level, just past the top of the downstroke)
        const tgt = 0.3, d = ((tgt - this.phase + 1.5) % 1) - 0.5;
        this.phase = (this.phase + d * Math.min(1, dt * 3) + 1) % 1;
      }
      const stroke = Math.sin(this.phase * TAU); // > 0 during the downstroke
      const down = flapping ? Math.max(0, stroke) : 0;
      // beat sound and dust on each downstroke
      if (flapping && this.prevStroke <= 0 && stroke > 0) this.onBeat();
      this.prevStroke = stroke;
      // ---- speed
      let sp = this.speed;
      if (tucked && power) {
        sp = Math.min(F.diveMax * Math.max(0.8, sm), sp + F.diveAcc * dt * (this.z > F.zLow + 4 ? 1 : 0.35));
      } else if (tucked) {
        // a plain descent: only a little speed from the drop, settling back to cruise down low
        const cap = cruise * 1.08;
        if (sp > cap) sp = U.damp(sp, cap, 1.4, dt);
        else if (this.z > F.zLow + 6) sp = Math.min(cap, sp + F.diveAcc * 0.25 * dt);
        else sp += F.flapAcc * 0.55 * down * dt * 1.25;
      } else if (this.sprinting) {
        sp += F.sprintAcc * down * dt * 1.25;
        if (sp > F.sprintMax * sm) sp = U.damp(sp, F.sprintMax * sm, 2.5, dt);
      } else if (thr > 0.1) {
        sp += F.flapAcc * down * thr * dt * 1.25;
        if (sp > F.flapMax * sm) sp = U.damp(sp, F.flapMax * sm, 1.2, dt);
      } else if (braking) {
        sp = U.approach(sp, F.hover * (exhausted ? 1.5 : 1), F.brakeDec * -thr * dt);
      } else {
        if (sp > cruise) sp = cruise + (sp - cruise) * Math.exp(-F.glideDrag * dt);
        else sp += F.flapAcc * 0.55 * down * dt * 1.25;
      }
      // turning costs a little speed (induced drag)
      sp -= Math.abs(this.angVel) * sp * 0.05 * dt;
      // pulling out of a dive trades speed for height
      if (this.vz > 0 && !dive) sp -= this.vz * 1.1 * dt;
      if (exhausted) sp = Math.min(sp, 170);
      this.speed = Math.max(F.hover * 0.6, sp);
      // ---- turning: rate limited by speed, rolled in smoothly
      const wmax = turnRate(this.speed) * this.turnMul * (braking ? 1.18 : 1) * (power ? 0.85 : 1);
      this.angVel = U.approach(this.angVel, turn * wmax, F.turnAcc * dt * (Math.abs(turn) > 0.05 ? 1 : 1.4));
      this.angle = U.wrapAngle(this.angle + this.angVel * dt);
      // velocity direction lags the heading (momentum through hard turns)
      const grip = 4.5 + 5 * (1 - Math.min(1, this.speed / F.diveMax));
      this.velA += U.wrapAngle(this.angle - this.velA) * Math.min(1, grip * dt);
      // visual bank from the turn and roll-in
      const wantBank = U.clamp(this.angVel * this.speed / 300, -1, 1) * 0.9;
      this.bank = U.damp(this.bank, wantBank, 5, dt);
      // ---- altitude
      let tz = F.zCruise;
      if (dive) tz = F.zLow;
      else if (this.sprinting || (thr > 0.5 && this.speed > 250)) tz = F.zHigh;
      else if (braking) tz = this.speed < 90 ? F.zHover : F.zCruise - 8;
      if (I.skim) tz = F.zLow + 6;
      if (this.carry) tz = Math.max(tz, 26);
      if (exhausted) tz = Math.min(tz, 40);
      const dz = tz - this.z;
      const vzT = dive ? U.clamp(dz * 3, -150, 40) : U.clamp(dz * 1.6, -70, 75);
      this.vz = U.damp(this.vz, vzT, 3.5, dt);
      this.z = Math.max(4, this.z + this.vz * dt);
      if (this.takeoffT > 0) this.takeoffT -= dt;
      // body pitch: nose down when diving, up when climbing hard
      this.pitch = U.damp(this.pitch, U.clamp(-this.vz / 140, -0.7, 0.7) + (braking ? -0.18 : 0), 4, dt);
      // ---- integrate
      this.vx = Math.cos(this.velA) * this.speed * F.pace; this.vy = Math.sin(this.velA) * this.speed * F.pace;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.bounds(dt);
      if (this.z < 34) this.collideLow(dt);
      // ---- wing pose for the renderer
      const W = this.wing;
      let elev, fold = 0, sweep = 0, cup = 0;
      if (tucked && !flapping) { elev = 0.18; fold = power ? 0.55 : 0.3; sweep = power ? -0.65 : -0.35; }
      else if (flapping) {
        elev = 0.22 + Math.cos(this.phase * TAU) * this.amp;
        if (stroke < 0) fold = -stroke * 0.42;
        if (braking) { sweep = 0.35; cup = 0.55; }
        if (this.sprinting) sweep = -0.12;
      } else { elev = 0.06 + Math.sin(this.t * 1.3) * 0.03; sweep = -0.05; }
      W.elev = U.damp(W.elev, elev, flapping ? 30 : 6, dt);
      W.fold = U.damp(W.fold, fold, 14, dt);
      W.sweep = U.damp(W.sweep, sweep, 6, dt);
      W.cup = U.damp(W.cup, cup, 5, dt);
      this.wingsDown = down;
    }

    /* ---- loop the loop: a vertical circle along the heading. The dragon climbs,
     * goes over on its back (drifting back along its own line, so a chaser
     * overshoots) and dives out where it began, heading the same way */
    startLoop() {
      if (this.loop || this.landed || this.landing || this.down > 0) return false;
      if (this.loopCd > 0 || this.energy < LOOP.cost) {
        if (this.isPlayer) this.g.msg(this.loopCd > 0 ? 'NOT YET — YOUR WINGS NEED A MOMENT' : 'TOO HUNGRY TO LOOP', '#ffe7a8', 1.2);
        return false;
      }
      const v = U.clamp(this.speed, 170, 360);
      this.loop = { t: 0, dur: LOOP.dur, a: this.angle, x0: this.x, y0: this.y, z0: Math.max(this.z, 26), R: U.clamp(v * LOOP.dur / TAU, 50, 74), drift: v * 0.22, v, th: 0, k: 0 };
      this.energy -= LOOP.cost; this.loopCd = LOOP.cd;
      this.landing = false; this.angVel = 0;
      this.phase = 0.05; this.freq = 2.6; this.onBeat();
      AS.Audio.sfx('air_rush', { x: this.x, y: this.y, vol: this.isPlayer ? 0.9 : 0.5, rate: 1.1 });
      AS.Audio.sfx('wing_beat', { x: this.x, y: this.y, vol: this.isPlayer ? 0.9 : 0.5, rate: 0.8 });
      if (this.isPlayer && this.g.camera) this.g.camera.pulseZoom(-0.03, 0.9);
      return true;
    }
    loopTime(dt) {
      const L = this.loop, W = this.wing;
      L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      // eased: quick pull-up and pull-out, a hang over the top so the inversion reads
      const th = TAU * (k + 0.075 * Math.sin(TAU * k));
      L.th = th; L.k = k;
      const f = L.R * Math.sin(th) + L.drift * L.t, h = L.R * (1 - Math.cos(th));
      // the body travels round the loop on the ground plane; most of the height is
      // visual (layoutLoop), so the camera does not chase the climb and swallow it
      this.x = L.x0 + Math.cos(L.a) * f; this.y = L.y0 + Math.sin(L.a) * f; this.z = L.z0 + h * 0.3;
      this.vx = Math.cos(L.a) * L.v; this.vy = Math.sin(L.a) * L.v; this.vz = 0;
      this.angle = this.velA = L.a; this.angVel = 0; this.pitch = 0;
      this.bank = U.damp(this.bank, 0, 8, dt);
      this.speed = L.v;
      this.diving = this.powerDive = this.braking = this.sprinting = false;
      this.brakeT = 0;
      // wings: hard beats up the climb, swept back and wide over the top, cupped to pull out
      let elev, fold = 0, sweep = 0, cup = 0;
      if (k < 0.3) {
        this.freq = 2.6; this.amp = 0.7;
        const prev = Math.sin(this.phase * TAU);
        this.phase = (this.phase + this.freq * dt) % 1;
        const stroke = Math.sin(this.phase * TAU);
        if (prev <= 0 && stroke > 0) this.onBeat();
        elev = 0.22 + Math.cos(this.phase * TAU) * 0.7; if (stroke < 0) fold = -stroke * 0.4;
      } else if (k < 0.72) { this.freq = 0; elev = 0.14 + Math.sin(this.t * 9) * 0.04; sweep = -0.2; }
      else { this.freq = 0; elev = 0.1; sweep = 0.2; cup = 0.45; }
      W.elev = U.damp(W.elev, elev, k < 0.3 ? 30 : 8, dt);
      W.fold = U.damp(W.fold, fold, 12, dt);
      W.sweep = U.damp(W.sweep, sweep, 7, dt);
      W.cup = U.damp(W.cup, cup, 6, dt);
      this.wingsDown = 0;
      this.bounds(dt);
      if (k >= 1) {
        this.loop = null; this.loopPose = null; this.z = L.z0; this.speed = L.v * 1.04;
        this.layoutRig(0, true);
      }
    }
    /* the loop as the camera sees it: every spine node sits at its own point on
     * a vertical ellipse along the heading (the neck a little ahead, the tail
     * trailing behind, so the body curves round the arc). Each node's sprite
     * heading is the screen direction of its travel: up the screen on the climb,
     * reversed over the top, down the screen on the dive. When the heading runs
     * up or down the screen the loop would flatten to a line, so it leans
     * sideways by up to half its height. Length is never foreshortened below
     * 0.55, the dragon grows a little as it rises toward the camera, and the
     * inverted stretch shows its belly. */
    layoutLoop() {
      const L = this.loop;
      if (!L) { this.loopPose = null; return; }
      const C = AS.DragonArt.chainFor ? AS.DragonArt.chainFor(this.fk) : AS.DragonArt.CHAIN, CH = AS.DragonArt.CHEST, n = this.nodes.length, s = this.scale;
      const a = L.a, ca = Math.cos(a), sa = Math.sin(a), lean = -sa * 0.5;
      const P = this.loopPose || (this.loopPose = { nodes: [], spanK: [1, 1] });
      const out = P.nodes;
      // arc length from the chest to each node (ahead positive)
      const dist = this._loopDist || (this._loopDist = new Float32Array(n));
      dist[CH] = 0;
      for (let i = CH - 1; i >= 0; i--) dist[i] = dist[i + 1] + C[i + 1].d * s;
      for (let i = CH + 1; i < n; i++) dist[i] = dist[i - 1] - C[i].d * s;
      for (let i = 0; i < n; i++) {
        const th = L.th + dist[i] / L.R * 0.6;
        const ct = Math.cos(th), st = Math.sin(th);
        const f = L.R * st + L.drift * L.t, h = L.R * (1 - ct);
        const nd = out[i] || (out[i] = {});
        nd.x = L.x0 + ca * f + lean * h; nd.y = L.y0 + sa * f; nd.z = L.z0 + h;
        const dx = ca * ct + lean * st, dy = sa * ct - st;
        nd.a = Math.atan2(dy, dx);
        nd.len = U.clamp(Math.hypot(dx, dy), 0.55, 1);
        nd.inv = U.smoothstep(0.42, 0.92, (1 - ct) / 2);
        nd.sc = 1 + 0.12 * h / (2 * L.R);
      }
      const ch = out[CH];
      P.inv = ch.inv; P.sc = ch.sc;
      // the wing nearer the camera (lower on screen) looks larger mid-loop
      const mid = Math.sin(L.th) * Math.sin(L.th), q = Math.cos(ch.a) * mid * 0.14;
      P.spanK[0] = 1 - q; P.spanK[1] = 1 + q;
      P.rise = (ch.z - L.z0) / (2 * L.R);
    }

    canLand() {
      const g = this.g;
      if (g.terrain.kindFast(this.x, this.y) !== 0 || g.terrain.onBridge && g.terrain.onBridge(this.x, this.y)) return false;
      for (const o of g.solidsNear ? g.solidsNear(this.x, this.y) : []) if (o.alive !== false && Math.hypot(o.x - this.x, o.y - this.y) < o.r + this.r * 0.7) return false;
      return true;
    }
    // the last metres down: wings cupped and beating hard, speed bleeding away
    touchDown(dt, turn) {
      const W = this.wing;
      if (!this.landing) { this.landing = true; this.phase = 0.75; }
      this.speed = U.damp(this.speed, 0, 3, dt);
      this.vz = -38; this.z = Math.max(0, this.z + this.vz * dt);
      this.angle = U.wrapAngle(this.angle + turn * 1.2 * dt); this.velA = this.angle;
      this.vx = Math.cos(this.angle) * this.speed * FLIGHT.pace; this.vy = Math.sin(this.angle) * this.speed * FLIGHT.pace;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.freq = U.damp(this.freq, 2.2, 8, dt); this.amp = 0.8;
      const prev = Math.sin(this.phase * TAU);
      this.phase = (this.phase + this.freq * dt) % 1;
      const stroke = Math.sin(this.phase * TAU);
      if (prev <= 0 && stroke > 0) this.onBeat();
      W.elev = U.damp(W.elev, 0.3 + Math.cos(this.phase * TAU) * 0.75, 30, dt); W.cup = U.damp(W.cup, 0.8, 6, dt); W.sweep = U.damp(W.sweep, 0.45, 6, dt);
      W.fold = U.damp(W.fold, stroke < 0 ? -stroke * 0.35 : 0, 14, dt);
      this.pitch = U.damp(this.pitch, -0.35, 5, dt); this.bank = U.damp(this.bank, 0, 5, dt);
      if (this.z <= 0.5) {
        this.landing = false; this.landed = true; this.z = 0; this.speed = 0; this.vz = 0;
        AS.FX.dust(this.x, this.y, 14, this.g.groundDust ? this.g.groundDust(this.x, this.y) : '#9a8a6a', 90);
        AS.Particles.spawn({ x: this.x, y: this.y, z: 0, shape: AS.Particles.RING, col: '#e8dcc0', size: 8, size2: 60 * this.scale, life: 0.6, alpha: 0.35, layer: 0 });
        AS.Audio.sfx('thud', { x: this.x, y: this.y, vol: this.isPlayer ? 0.7 : 0.4, rate: 0.7 });
        if (this.isPlayer && this.g.camera) this.g.camera.shake(0.15);
      }
    }
    // on the ground: wings folded, turning on the spot; W launches
    groundTime(dt, thr, turn) {
      const W = this.wing, I = this.input;
      this.speed = 0; this.vx = this.vy = 0; this.vz = 0; this.z = 0; this.diving = false; this.braking = false; this.sprinting = false;
      this.angle = U.wrapAngle(this.angle + turn * 1.5 * dt); this.velA = this.angle; this.angVel = turn * 1.5;
      this.freq = U.damp(this.freq, 0, 6, dt);
      W.elev = U.damp(W.elev, 0.04 + Math.sin(this.t * 1.1) * 0.02, 5, dt); W.fold = U.damp(W.fold, 0.88, 4, dt);
      W.sweep = U.damp(W.sweep, 0.25, 4, dt); W.cup = U.damp(W.cup, 0.2, 4, dt);
      this.pitch = U.damp(this.pitch, 0.05, 4, dt); this.bank = U.damp(this.bank, 0, 5, dt);
      this.wingsDown = 0;
      if (thr > 0.3 || I.dive || I.sprint || this.hurt > 0.5) {
        // launch: a hard downstroke and a leap into the air
        this.landed = false; this.takeoffT = 0.8;
        this.speed = 110; this.vz = 95; this.z = 6; this.phase = 0.05; this.freq = 2.6; this.amp = 0.75;
        this.onBeat();
        AS.Audio.sfx('wing_beat', { x: this.x, y: this.y, vol: this.isPlayer ? 0.9 : 0.5, rate: 0.85 });
      }
    }

    bounds(dt) {
      const g = this.g, m = 160, W = g.map.w, H = g.map.h;
      let push = 0;
      if (this.x < m || this.y < m || this.x > W - m || this.y > H - m) {
        // the edge of the realm turns the dragon back gently
        const want = Math.atan2(H / 2 - this.y, W / 2 - this.x);
        push = U.clamp(U.wrapAngle(want - this.angle), -1, 1);
        this.angle = U.wrapAngle(this.angle + push * 1.4 * dt);
        if (this.isPlayer) g.msg && g.msg('THE EDGE OF THE REALM', '#e8d8a8', 0.6);
      }
      this.x = U.clamp(this.x, 20, W - 20); this.y = U.clamp(this.y, 20, H - 20);
    }
    collideLow(dt) {
      const g = this.g;
      if (!g.solids) return;
      for (const o of g.solids) {
        if (o.alive === false || !o.tall || o.tall < this.z) continue;
        const dx = this.x - o.x, dy = this.y - o.y, rr = o.r + this.r * 0.5, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          this.x = o.x + nx * rr; this.y = o.y + ny * rr;
          const vn = this.vx * nx + this.vy * ny;
          if (vn < -60) {
            this.speed *= 0.6; this.vz = 60;
            this.takeDamage(Math.min(30, -vn * 0.06), 'impact', null);
            AS.FX.dust(this.x, this.y, 8, '#8a7a6a', 60);
            g.camera && this.isPlayer && g.camera.shake(0.3);
            AS.Audio.sfx('thud', { x: this.x, y: this.y });
          }
          this.velA = Math.atan2(this.vy + ny * 80, this.vx + nx * 80);
        }
      }
    }

    onBeat() {
      const s = this.sprinting ? 1.2 : this.braking ? 1.1 : 0.9;
      AS.Audio.sfx('wing_beat', { x: this.x, y: this.y, vol: (this.isPlayer ? 0.75 : 0.6) * s, rate: (this.sprinting ? 1.15 : 1) * (1 - (this.scale - 1) * 0.3) });
      // downwash raises dust or spray when low
      if (this.z < 30) {
        const k = this.g.terrain.kindFast(this.x, this.y);
        const col = k === 1 ? '#d8f0f0' : (this.g.groundDust ? this.g.groundDust(this.x, this.y) : '#9a8a6a');
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU;
          AS.Particles.spawn({ x: this.x + Math.cos(a) * 10, y: this.y + Math.sin(a) * 7, z: 1, vx: Math.cos(a) * 90, vy: Math.sin(a) * 60, vz: 6, shape: AS.Particles.SMOKE, col, size: 3, size2: 11, life: 0.7, alpha: k === 1 ? 0.35 : 0.3, drag: 3.2, layer: 0 });
        }
        if (k === 1) AS.Particles.spawn({ x: this.x, y: this.y, z: 0, shape: AS.Particles.RING, col: '#ffffff', size: 6, size2: 34, life: 0.6, alpha: 0.4, layer: 0 });
      }
    }

    /* energy (hunger), health regen, mana, breath charge */
    vitals(dt) {
      const g = this.g;
      let drain = this.landed ? 0.04 + (this.breathing ? 2.2 : 0) : 0.2 + (this.freq > 0.3 ? 0.14 : 0) + (this.sprinting ? 1.25 : 0) + (this.braking && this.speed < 90 ? 0.4 : 0) + (this.breathing ? 2.2 : 0);
      if (this.buffs.feast) drain = 0;
      this.energy = Math.max(0, this.energy - drain * this.drainMul * dt * (g.energyMul || 1));
      if (this.energy <= 0) {
        this.starveT = (this.starveT || 0) + dt;
        if (this.starveT > 1) { this.starveT = 0; this.takeDamage(this.maxHp * 0.006, 'starve', null, { silent: true }); }
      }
      // slow natural healing out of combat; fast at the home roost
      const calm = g.time - this.lastHurt > 8;
      const home = g.atRoost && g.atRoost(this);
      let regen = calm ? this.maxHp * (this.landed ? 0.012 : 0.004) : 0; // resting on the ground heals faster
      if (home) regen = this.maxHp * 0.05;
      if (this.buffs.regen) regen += this.maxHp * 0.04;
      this.hp = Math.min(this.maxHp, this.hp + regen * dt);
      if (home) this.energy = Math.min(this.maxEnergy, this.energy + 2 * dt); // roost feeding trough
      this.mana = Math.min(this.maxMana, this.mana + (14 + (this.buffs.mana ? 30 : 0) + (this.g.manaBonus ? this.g.manaBonus(this.faction) : 0)) * dt);
      if (this.fireDelay > 0) this.fireDelay -= dt;
      else if (!this.breathing) {
        const ek = this.energy <= 0 ? 0.15 : this.energy < this.maxEnergy * 0.2 ? 0.55 : 1;
        this.fireCharge = Math.min(this.maxFire, this.fireCharge + 24 * ek * (this.buffs.inferno ? 2.5 : 1) * dt);
      }
    }

    takeDamage(amount, dtype, src, opts) {
      if (!this.alive || this.down > 0) return 0;
      const g = this.g;
      if (this.isPlayer && g.godMode) return 0;
      if (this.buffs.invuln) return 0;
      if (this.evading && dtype !== 'starve') return 0; // mid-loop: everything flies past
      if (this.buffs.shield) { amount *= 0.35; AS.FX.impact(this.x, this.y, this.z + 8, '#bfe8ff'); }
      let dmg = amount;
      // difficulty: how hard rival dragons (their bolts and breath) hit the player's dragon
      if (this.isPlayer && src) { const s = src.isDragon ? src : src.owner && src.owner.isDragon ? src.owner : null; if (s && s !== this && g.diff && g.diff.dragonDmg) dmg *= g.diff.dragonDmg; }
      // (poison seeps past scales; an attack may weigh armour in proportion to the size of its blows)
      if (dtype !== 'starve' && dtype !== 'pierce' && dtype !== 'poison' && this.armor) { const arm = this.armor * (opts && opts.armorMul !== undefined ? opts.armorMul : 1); dmg = Math.max(dmg * 0.5, dmg - arm); }
      if (dtype === 'pierce') dmg *= 1; // ballista bolts ignore scales
      this.hp -= dmg;
      if (!(opts && opts.silent)) {
        this.hurt = 0.18; this.lastHurt = g.time;
        if (src && src !== this) this.lastHitBy = src;
        if (src && !this.isPlayer && (src.isPlayer || (src.owner && src.owner.isPlayer)) && AS.Diplomacy) AS.Diplomacy.hurt(g, this.fk);
        if (src && src.isDragon && src !== this && AS.Voices && g === AS.Voices.g) AS.Voices.onHit(src, this, dmg);
        if (this.isPlayer) { g.camera.shake(Math.min(0.45, 0.06 + dmg * 0.012)); AS.Audio.sfx('dragon_hurt', { vol: Math.min(1, 0.35 + dmg / 40) }); }
        else if (Math.random() < 0.25) AS.Audio.sfx('dragon_hurt', { x: this.x, y: this.y, vol: 0.5 });
      }
      if (this.onHurt) this.onHurt(dmg, dtype, src);
      if (this.hp <= 0) { this.hp = 0; this.knockDown(src); }
      return dmg;
    }
    heal(v) { this.hp = Math.min(this.maxHp, this.hp + v); }
    dropCarry() { if (AS.Life) AS.Life.dropCarry(this); }

    /* defeated dragons are driven off: they crash, then recover at their roost */
    knockDown(src) {
      this.landed = false; this.landing = false;
      const g = this.g;
      this.down = this.def.recover || 22;
      this.downMax = this.down;
      this.fall = 1.6; this.fallSpin = (Math.random() < 0.5 ? -1 : 1) * 2.2;
      if (this.carry) this.dropCarry(false);
      AS.Audio.sfx('dragon_roar_pain', { x: this.x, y: this.y });
      AS.FX.explosion(this.x, this.y, this.z, 10, { col: '#fff0d0', col2: '#c04020', debris: false });
      if (g.onDragonDown) g.onDragonDown(this, src);
    }
    updateDown(dt) {
      const g = this.g;
      if (this.fall > 0) {
        // tumbling out of the sky
        this.fall -= dt;
        this.angle += this.fallSpin * dt;
        this.speed *= Math.exp(-0.8 * dt);
        this.x += Math.cos(this.angle) * this.speed * dt * 0.5 * FLIGHT.pace; this.y += Math.sin(this.angle) * this.speed * dt * 0.5 * FLIGHT.pace;
        this.z = Math.max(0, this.z - (30 + (1.6 - this.fall) * 60) * dt);
        this.wing.elev = 0.6 + Math.sin(this.t * 14) * 0.4; this.wing.fold = 0.3;
        this.bank = Math.sin(this.t * 5) * 0.8;
        this.layoutRig(dt);
        AS.FX.smoke(this.x, this.y, this.z + 6, 8, true);
        if (this.fall <= 0) {
          AS.FX.explosion(this.x, this.y, 2, 22, { col: '#fff0d0', col2: '#b06030', debris: true, dustCol: '#8a7a5a' });
          AS.FX.shockwave(this.x, this.y, 90);
          g.terrain.addDecal('crater', this.x, this.y, 26);
          AS.Audio.sfx('crash_heavy', { x: this.x, y: this.y });
          g.shakeNear && g.shakeNear(this.x, this.y, 0.8);
          this.hidden = true;
        }
        return;
      }
      this.down -= dt;
      if (this.down <= 0) this.respawn();
    }
    respawn() {
      const g = this.g, home = g.roostOf ? g.roostOf(this.faction) : { x: this.x, y: this.y };
      this.down = 0; this.hidden = false; this.landed = false; this.landing = false;
      this.x = home.x; this.y = home.y + 10; this.z = 20; this.speed = 90; this.velA = this.angle = -Math.PI / 2;
      this.hp = this.maxHp * 0.7; this.energy = Math.max(this.energy, this.maxEnergy * 0.6); this.fireCharge = this.maxFire;
      this.buffs.shield = Math.max(this.buffs.shield || 0, 10); // back in the air with a brief ward of scales
      for (const n of this.nodes) { n.x = this.x; n.y = this.y; n.z = this.z; }
      this.layoutRig(0, true);
      AS.Audio.sfx('dragon_roar', { x: this.x, y: this.y });
      if (g.onDragonRespawn) g.onDragonRespawn(this);
    }

    /* ================= rig: place the body chain ================= */
    layoutRig(dt, snap) {
      const C = AS.DragonArt.chainFor ? AS.DragonArt.chainFor(this.fk) : AS.DragonArt.CHAIN, n = this.nodes, s = this.scale, ch = n[AS.DragonArt.CHEST];
      const a = this.angle, ca = Math.cos(a), sa = Math.sin(a);
      const bob = this.down > 0 ? 0 : (this.freq > 0.25 ? -Math.sin(this.phase * TAU) * 1.6 * this.amp : Math.sin(this.t * 1.3) * 0.6);
      // chest sits slightly ahead of the body centre
      ch.x = this.x + ca * 3 * s; ch.y = this.y + sa * 3 * s; ch.z = this.z + bob; ch.a = a;
      // neck and head arc toward the turn (and the target when breathing)
      let bend = U.clamp(this.angVel * 0.24, -0.6, 0.6);
      // the head swings toward what the dragon breathes at
      bend = U.clamp(bend * (this.breathing ? 0.3 : 1) + (this.headYaw || 0), -1.35, 1.35);
      if (this.lookBend) bend = U.clamp(bend + this.lookBend, -0.8, 0.8);
      const headDip = this.eatT > 0 ? 8 : 0;
      let px = ch.x, py = ch.y, pa = a;
      for (let i = AS.DragonArt.CHEST - 1; i >= 0; i--) {
        const k = (AS.DragonArt.CHEST - i) / AS.DragonArt.CHEST;
        pa = a + bend * k;
        const d = C[i + 1].d * s;
        px += Math.cos(pa) * d; py += Math.sin(pa) * d;
        const nd = n[i];
        nd.x = px; nd.y = py; nd.a = pa;
        nd.z = ch.z + (2 + k * 3) * s - this.pitch * k * 14 * s - headDip * k + (this.eatT > 0 ? Math.sin(this.t * 18) * 1.5 * k : 0);
      }
      // hips and tail follow like a rope, with a gentle sway
      const sway = this.down > 0 ? 3 : (this.freq > 0.25 ? 1.4 : 2.6);
      for (let i = AS.DragonArt.CHEST + 1; i < n.length; i++) {
        const prev = n[i - 1], nd = n[i], d = C[i].d * s;
        if (snap || this.loop) { nd.x = prev.x - Math.cos(prev.a) * d; nd.y = prev.y - Math.sin(prev.a) * d; }
        let dx = nd.x - prev.x, dy = nd.y - prev.y;
        let L = Math.hypot(dx, dy) || 1;
        // stiffness: the hips stay aligned with the chest, the tail is looser
        const stiff = i === AS.DragonArt.HIPS ? 0.75 : i < AS.DragonArt.HIPS + 3 ? 0.22 : 0.08;
        const ax = -Math.cos(prev.a), ay = -Math.sin(prev.a);
        dx = U.lerp(dx / L, ax, stiff); dy = U.lerp(dy / L, ay, stiff);
        L = Math.hypot(dx, dy) || 1;
        const j = i - AS.DragonArt.HIPS;
        const sw = j > 0 ? Math.sin(this.t * 2.4 - j * 0.7) * sway * j * 0.1 * s : 0;
        nd.x = prev.x + dx / L * d + (-dy / L) * sw * (dt ? Math.min(1, dt * 8) : 1);
        nd.y = prev.y + dy / L * d + (dx / L) * sw * (dt ? Math.min(1, dt * 8) : 1);
        nd.a = Math.atan2(prev.y - nd.y, prev.x - nd.x);
        const back = (i - AS.DragonArt.CHEST);
        nd.z = ch.z - back * 0.5 * s + this.pitch * Math.min(back, 4) * 3.5 * s - (this.down > 0 && this.fall <= 0 ? 0 : 0);
        if (this.carry && i === AS.DragonArt.HIPS) this.carryPos = { x: nd.x, y: nd.y, z: nd.z - 6 * s };
      }
    }

    fx(dt) {
      const g = this.g, P = AS.Particles;
      // wingtip vortices at speed and in hard turns
      if (this.speed > 330 || Math.abs(this.bank) > 0.7) {
        if (Math.random() < 0.5) {
          const ch = this.nodes[AS.DragonArt.CHEST];
          for (const side of [-1, 1]) {
            const a = ch.a + side * 1.75;
            const x = ch.x + Math.cos(a) * 42 * this.scale, y = ch.y + Math.sin(a) * 42 * this.scale;
            P.spawn({ x, y: y + this.z, z: this.z + 6, vx: -this.vx * 0.1, vy: -this.vy * 0.1, shape: P.DOT, col: '#ffffff', size: 1.2, life: 0.35, alpha: 0.5 });
          }
        }
      }
      // low health: smoke trails from the wounds
      const hp = this.hp / this.maxHp;
      if (hp < 0.35 && Math.random() < (0.35 - hp) * 2) AS.FX.smoke(this.x, this.y, this.z + 6, 5, hp < 0.15);
      // each kind of dragon trails its own nature
      if (!this.hidden && this.down <= 0) this.kindFx(dt, P);
      // faction aura motes
      if (this.buffs.shield && Math.random() < 0.5) P.spawn({ x: this.x + U.range(-30, 30), y: this.y + U.range(-20, 20) + this.z, z: this.z + U.range(0, 16), vz: 10, shape: P.GLOW, col: '#9fd8ff', size: 3, size2: 0.5, life: 0.6, add: true });
      AS.Renderer.light(this.x, this.y - this.z, 30 * this.scale, this.fdef.color, 0.08);
    }

    kindFx(dt, P) {
      const n = this.nodes, s = this.scale, hd = n[0], ch = n[AS.DragonArt.CHEST], tip = n[n.length - 1];
      const near = this.isPlayer || (this.g.player && Math.hypot(this.x - this.g.player.x, this.y - this.g.player.y) < 900);
      if (!near) return;
      const r = Math.random, dens = AS.Particles.density;
      if (this.fk === 'undead') {
        // ghost-fire licking up out of the ribcage and the eye sockets, a trail of grave-smoke
        if (r() < 7 * dt * dens) P.spawn({ x: ch.x + U.range(-5, 5) * s, y: ch.y + U.range(-4, 4) * s, z: ch.z + 7 * s, vx: this.vx * 0.6, vy: this.vy * 0.6, vz: 26, shape: P.GLOW, col: '#b8ff7a', col2: '#3a8a2a', size: 3 * s, size2: 0.5, life: 0.55, add: true });
        if (r() < 3 * dt * dens) P.spawn({ x: hd.x, y: hd.y, z: hd.z + 6 * s, vx: this.vx * 0.7, vy: this.vy * 0.7, vz: 18, shape: P.GLOW, col: '#c8ff9a', col2: '#2a6a1a', size: 2.2 * s, size2: 0.4, life: 0.4, add: true });
        if (r() < 4 * dt * dens) P.spawn({ x: tip.x, y: tip.y, z: tip.z + 2, vx: -this.vx * 0.05, vy: -this.vy * 0.05, vz: 6, shape: P.SMOKE, col: '#3a2a44', col2: '#1a1420', size: 3, size2: 10, life: 1.1, alpha: 0.35, drag: 1.5 });
      } else if (this.fk === 'ice') {
        // cold vapour off the crystals and from the jaws
        if (r() < 5 * dt * dens) P.spawn({ x: ch.x + U.range(-8, 8) * s, y: ch.y + U.range(-6, 6) * s, z: ch.z + 10 * s, vx: -this.vx * 0.08, vy: -this.vy * 0.08, vz: -6, shape: P.SMOKE, col: '#f0faff', col2: '#c8e4f4', size: 2.5, size2: 9, life: 1, alpha: 0.32, drag: 1.2 });
        if (r() < 2.5 * dt * dens) P.spawn({ x: hd.x + Math.cos(hd.a) * 14 * s, y: hd.y + Math.sin(hd.a) * 14 * s, z: hd.z + 3, vx: this.vx * 0.5, vy: this.vy * 0.5, vz: -4, shape: P.SMOKE, col: '#ffffff', col2: '#d8eefc', size: 1.5, size2: 6, life: 0.7, alpha: 0.4, drag: 2 });
      } else if (this.fk === 'elf') {
        // motes of light shed from the leaf-feathers
        if (r() < 6 * dt * dens) { const sd = r() < 0.5 ? 1 : -1, a = ch.a + sd * 1.6, d = U.range(14, 44) * s; P.spawn({ x: ch.x + Math.cos(a) * d, y: ch.y + Math.sin(a) * d, z: ch.z + 8, vx: -this.vx * 0.04, vy: -this.vy * 0.04, vz: U.range(-4, 6), shape: P.GLOW, col: r() < 0.5 ? '#c8ffb0' : '#fff0a0', col2: '#3a9a5a', size: 2.2, size2: 0.4, life: U.range(0.8, 1.4), add: true }); }
      } else {
        // embers curling from the nostrils
        if (r() < 3 * dt * dens) P.spawn({ x: hd.x + Math.cos(hd.a) * 16 * s, y: hd.y + Math.sin(hd.a) * 16 * s, z: hd.z + 5 * s, vx: this.vx * 0.7 + U.range(-10, 10), vy: this.vy * 0.7 + U.range(-10, 10), vz: 14, shape: P.GLOW, col: '#ffd070', col2: '#ff4a10', size: 1.6, size2: 0.3, life: 0.5, add: true });
        if (r() < 1.5 * dt * dens) P.spawn({ x: hd.x + Math.cos(hd.a) * 15 * s, y: hd.y + Math.sin(hd.a) * 15 * s, z: hd.z + 5 * s, vx: this.vx * 0.6, vy: this.vy * 0.6, vz: 10, shape: P.SMOKE, col: '#5a4a40', col2: '#2a2420', size: 1.5, size2: 6, life: 0.8, alpha: 0.3, drag: 1.5 });
      }
    }

    /* ================= draw ================= */
    syncDraw() {
      const st = this.drawState;
      st.scale = this.scale; st.bank = this.bank; st.open = this.breathing || this.roarT > 0 || this.eatT > 0;
      st.hurt = this.hurt; st.aim = Math.atan2(this.input.aimY - (this.y - this.z), this.input.aimX - this.x);
      if (!isFinite(st.aim)) st.aim = this.angle;
      st.t = this.t; st.cast = this.cast; st.alpha = this.buffs.invuln ? 0.55 + Math.sin(this.t * 20) * 0.25 : 1;
      return st;
    }
    drawShadow(ctx, ox, oy) {
      if (this.hidden) return;
      if (this.loop && this.loopPose) {
        // the shadow stays on the ground under the body and fades as the dragon climbs away from it
        ctx.save(); ctx.globalAlpha *= 1 - 0.55 * this.loopPose.rise;
        AS.DragonArt.drawShadow(ctx, this.syncDraw(), ox, oy);
        ctx.restore();
        return;
      }
      AS.DragonArt.drawShadow(ctx, this.syncDraw(), ox, oy);
    }
    draw(ctx, ox, oy, R) {
      if (this.hidden) {
        // the crash site smoulders while the dragon recovers
        return;
      }
      const st = this.syncDraw();
      if (this.loop && this.loopPose) AS.DragonArt.drawLoop(ctx, st, ox, oy, R, this.loopPose);
      else AS.DragonArt.draw(ctx, st, ox, oy, R);
      if (this.carry && this.carryPos && !this.loop) AS.Life.drawCarried(this.carry, ctx, this.carryPos.x, this.carryPos.y, this.carryPos.z, ox, oy, R, this.angle);
      if (this.buffs.shield) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + Math.sin(this.t * 6) * 0.08;
        ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(this.x - ox, this.y - this.z - 6 - oy, 46 * this.scale, 34 * this.scale, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      if (this.drawExtra) this.drawExtra(ctx, ox, oy, R);
    }
  }

  Dragon.FLIGHT = FLIGHT;
  Dragon.LOOP = LOOP;
  Dragon.turnRate = turnRate;
  Dragon.blankInput = blankInput;
  AS.Dragon = Dragon;
})(window.AS);

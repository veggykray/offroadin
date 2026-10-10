/* WYRMCROWN — MOUNTAIN TEST: elevation in play (maps/mountaintest.js).
 *
 * Only active on a map flagged `mountain`; every other map is untouched.
 *
 *  - the terrain: AS.MountainGen builds the heightfield, AS.MountainTerrain draws it
 *    (src/gfx/mountain_terrain.js). Everything standing on the ground — sites,
 *    troops, wildlife, decals, projectiles — lives in projected coordinates
 *    (x, y_ground − E), so the engine draws and hit-tests it unchanged.
 *  - the dragon flies in ground space with a true ALTITUDE above sea level. Its
 *    flight model (dragon.js) runs as before for speed, turning, wings and loops;
 *    this module owns the vertical: terrain following, a held altitude (Z climbs,
 *    X descends, SPACE dives), a hard CEILING (map.relief.ceiling), and terrain
 *    collision — ground too high to clear stops the dragon softly and slides it
 *    along the slope ("find a pass"), never through it.
 *  - the camera frames the ground below a high-flying dragon; the HUD has an
 *    altitude gauge; shots at the dragon need range in 3D and a clear line of
 *    sight; the dragon's bolts burst on rock between it and the aim point.
 *  - the test scenarios A–J (` then keys 1–0), the army crossing (G) and the encounters.
 */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const sstep = U.smoothstep;
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
  const TESTS = 'ABCDEFGHIJ';

  const MT = {
    // the vertical flight tuning (units, units per second)
    MIN_CLR: 10,      // closest the dragon's body comes to the ground in flight
    CLIMB: 82,        // climb rate when following the terrain
    SCRAMBLE: 150,    // emergency climb when ground ahead is close
    KEY_CLIMB: 95,    // Z: raise the held altitude
    KEY_DESCEND: 125, // X: lower it
    DIVE_DESCEND: 210,// SPACE with a held altitude
    _cache: null,

    /* ---------------- the terrain (called from Realm.makeTerrain) ---------------- */
    relief(m) {
      const key = m.id + ':' + (m.seed || 0);
      if (this._cache && this._cache.key === key) return this._cache.R;
      const R = AS.MountainGen.build(m);
      this._cache = { key, R };
      return R;
    },
    makeTerrain(world, m) {
      const R = this.relief(m);
      // the authored (ground) positions are kept; what the game reads is projected
      if (!m._ground) m._ground = { sites: m.sites.map((s) => [s.x, s.y]), towns: {}, bridges: (m.bridges || []).map((b) => [b.x, b.y]), wild: (m.wild || []).map((w) => [w.x, w.y]), runes: (m.runes || []).map((r) => r.slice()) };
      const G = m._ground, P = (x, y) => [x, y - R.h(x, y)];
      for (const fk in m.factions) { const t = m.factions[fk].town; if (!G.towns[fk]) G.towns[fk] = [t.x, t.y]; const q = P(G.towns[fk][0], G.towns[fk][1]); t.x = q[0]; t.y = q[1]; }
      m.sites.forEach((s, i) => { const g = G.sites[i], q = P(g[0], g[1]); s.x = q[0]; s.y = q[1]; s.gx = g[0]; s.gy = g[1]; });
      (m.bridges || []).forEach((b, i) => { const q = P(G.bridges[i][0], G.bridges[i][1]); b.x = q[0]; b.y = q[1]; });
      (m.wild || []).forEach((w, i) => { const q = P(G.wild[i][0], G.wild[i][1]); w.x = q[0]; w.y = q[1]; });
      if (m.runes) m.runes = G.runes.map((r) => P(r[0], r[1]));
      // levelled ground and clearings (as Realm.makeTerrain): zones in projected space (where trees are kept off),
      // farmland and clearings in ground space (they feed the ground lookups)
      const zones = [], fields = [], clearings = [];
      for (const fk in m.factions) {
        const t = m.factions[fk].town, g = G.towns[fk];
        zones.push({ x: t.x, y: t.y, r: 470, soft: 1.6, treeR: 1 });
        fields.push({ x: g[0], y: g[1], r: 900 });
      }
      const SZ = AS.Realm.SITE_ZONE || {};
      m.sites.forEach((s) => {
        const r = SZ[s.k];
        if (r) zones.push({ x: s.x, y: s.y, r, soft: 1.5 });
        if (s.k === 'village') fields.push({ x: s.gx, y: s.gy, r: 300 });
        else clearings.push({ x: s.gx, y: s.gy, r: (r || 60) * 1.15 });
      });
      for (let i = 0; i < (m.bridges || []).length; i++) clearings.push({ x: G.bridges[i][0], y: G.bridges[i][1], r: 120 });
      const rd = R.data(); delete rd.UP; delete rd.RD; delete rd.RW; delete rd.stats;
      const targ = Object.assign({}, m, { zones, fields: fields.concat(m.fields || []), clearings: clearings.concat(m.clearings || []), reliefData: rd });
      delete targ._ground;
      const T = new AS.MountainTerrain(world, targ, R);
      T._args = { world, map: targ };
      // bridges: the corridor over the water, projected end to end
      (m.bridges || []).forEach((b, i) => {
        const a = b.a || 0, L = 150, gx = G.bridges[i][0], gy = G.bridges[i][1];
        const p0 = P(gx - Math.cos(a) * L, gy - Math.sin(a) * L), p1 = P(gx + Math.cos(a) * L, gy + Math.sin(a) * L);
        T.bridges.push({ x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], w: 24, a: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), site: b.site });
      });
      return T;
    },
    // ground (x, y) → projected [x, Y]
    proj(g, x, y) { return [x, y - g.mtn.R.h(x, y)]; },

    /* ---------------- set-up, once the realm is loaded ---------------- */
    setup(g) {
      const m = g.map, R = g.terrain.R;
      g.mtn = { R, ceil: R.ceiling, test: null, army: null, holds: [], caves: [], t: 0, falls: null, lift: 0, zoom: 1, msgT: 0, picker: 0 };
      g.camLift = 0; g.camZoom = 1;
      // the hold and the cave: a way in for armies, not for a dragon
      for (const s of g.sites) {
        const spec = m.sites.find((q) => q.id === s.id) || {};
        if (s.kind === 'dwarfhold') g.mtn.holds.push({ site: s, gate: { x: s.x, y: s.y - 110 }, interior: { name: s.name + ' — the deep halls', capacity: 400, battle: 'underground: armies only (auto-resolve, future)' }, spec: spec.mountain });
        if (s.kind === 'cave') g.mtn.caves.push({ site: s, mouth: { x: s.x, y: s.y - 40 } });
      }
      // the waterfall: where the river leaves the shelf and where it lands
      const rv = m.rivers && m.rivers[0];
      if (rv) {
        let lip = null, foot = null;
        for (let i = 0; i < rv.pts.length - 1; i++) { const a = rv.pts[i], b = rv.pts[i + 1]; const da = R.h(a[0], a[1]), db = R.h(b[0], b[1]); if (da - db > 120) { lip = a; foot = b; break; } }
        if (lip) g.mtn.falls = { lip: this.proj(g, lip[0], lip[1]), foot: this.proj(g, foot[0], foot[1]), gx: (lip[0] + foot[0]) / 2, w: 26 };
      }
      // the forces in the mountains (spawned as they are: a small region)
      g.mtn.groups = [];
      for (const e of m.encounters || []) this.spawnGroup(g, e);
      // the player's dragon starts low over the lowlands, by the castle
      const p = g.player;
      if (p) { p._m = null; }
      // hooks the realm reads
      g.perfLines = () => this.perfLines(g);
      if (!g.opts.demo) g.msg('MOUNTAIN TEST — press ` then 1–0 for test scenarios A–J · Z climbs · X descends', '#ffe7a8', 7);
      // (a page that wants to drive the tests: window.__mtn)
      if (typeof window !== 'undefined') window.__mtn = { g, test: (k) => this.startTest(g, k), state: () => this.state(g), M: this };
    },
    spawnGroup(g, e) {
      const G = { def: e, troops: [] };
      let n = 0;
      for (const [role, c] of e.troops) for (let i = 0; i < c; i++) {
        const a = (n++) * 2.399, r = 30 + Math.sqrt(n) * 26;
        const q = this.proj(g, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.8);
        if (!g.terrain.groundPassable(q[0], q[1])) continue;
        const u = new AS.Troop(g, role, 'wild', q[0], q[1], { state: 'guard' });
        u.home = { x: q[0], y: q[1], r: 240 };
        g.troops.push(u); G.troops.push(u);
      }
      g.mtn.groups.push(G);
      return G;
    },

    /* ---------------- per frame (from Realm.update, before the camera) ---------------- */
    update(g, dt) {
      const M = g.mtn, p = g.player, I = AS.Input;
      M.t += dt;
      // scenario keys: ` (the key left of 1) opens the test picker, then 1–0 picks A–J.
      // While the picker is open the number row does not cast spells (see the Input.hit hook).
      if (!g.opts.demo && !g.uiBlocking && I.pressed) {
        if (I.pressed.has('Backquote')) { M.picker = M.picker > 0 ? 0 : 6; if (M.picker) g.msg('TEST PICKER — press 1–0 for scenarios A–J (` to close)', '#ffe7a8', 6); }
        else if (M.picker > 0) for (let i = 0; i < KEYS.length; i++) if (I.pressed.has(KEYS[i])) { M.picker = 0; this.startTest(g, TESTS[i]); break; }
      }
      if (M.picker > 0) M.picker -= dt;
      // camera: frame the ground below a high dragon (the view slides down toward its shadow,
      // and widens a little — the dragon stays in the upper part of the screen)
      const S = p && p._m;
      if (S && p.down <= 0) {
        const clr = S.alt - S.e;
        M.lift = U.damp(M.lift, U.clamp((clr - 70) * 0.36, 0, 190), 2.2, dt);
        M.zoom = U.damp(M.zoom, 1 - 0.12 * sstep(120, 460, clr), 1.5, dt);
      } else { M.lift = U.damp(M.lift, 0, 3, dt); M.zoom = U.damp(M.zoom, 1, 2, dt); }
      g.camLift = M.lift; g.camZoom = M.zoom;
      // the hold and the cave turn a dragon away; troops can walk in
      if (S && p.down <= 0) {
        const clr = S.alt - S.e;
        for (const h of M.holds) if (clr < 90 && Math.hypot(p.x - h.gate.x, (p.y - h.gate.y)) < 150) this.note(g, h.site.name.toUpperCase() + ' — THE GATE IS FOR ARMIES: TOO NARROW FOR A DRAGON', '#d8e4ff');
        for (const c of M.caves) if (clr < 80 && Math.hypot(p.x - c.mouth.x, p.y - c.mouth.y) < 110) this.note(g, 'A CAVE — TOO NARROW FOR A DRAGON', '#d8e4ff');
      }
      // troops reaching the hold's gate (the way into the halls under the mountain)
      for (const h of M.holds) {
        h.inside = 0;
        for (const t of g.troops) if (t.alive && t.team === g.playerKey && Math.hypot(t.x - h.gate.x, t.y - h.gate.y) < 70) h.inside++;
        if (h.inside && !h.told) { h.told = true; g.msg('YOUR TROOPS REACH THE GATE OF ' + h.site.name.toUpperCase() + ' (the deep halls: armies only — battles there to come)', '#d8e4ff', 5); }
      }
      // waterfall spray
      if (M.falls && p) {
        const f = M.falls;
        if (Math.abs(p.x - f.foot[0]) < 1400 && Math.abs(p.y - f.foot[1]) < 1400 && Math.random() < dt * 14) {
          AS.Particles.spawn({ x: f.foot[0] + U.range(-24, 24), y: f.foot[1] + U.range(-6, 10), z: U.range(0, 8), vx: U.range(-20, 20), vy: U.range(-6, 6), vz: U.range(14, 34), shape: AS.Particles.SMOKE, col: '#eef6ff', size: 6, size2: 22, life: 1.6, alpha: 0.28, drag: 1.2 });
        }
      }
      this.updateTest(g, dt);
      M.msgT -= dt;
    },
    note(g, text, col) { const M = g.mtn; if (M.msgT > 0 && M.lastNote === text) return; M.msgT = 2.5; M.lastNote = text; g.msg(text, col || '#ffe7a8', 2.2); },

    /* ---------------- the dragon's vertical flight ---------------- */
    flight(d, dt, base) {
      const g = d.g, M = g.mtn, R = M.R, F = AS.Dragon.FLIGHT, I = d.input, CEIL = M.ceil;
      let S = d._m;
      // moved by something else (spawned, respawned, teleported, pushed off a tower): find the ground again
      if (!S || d.y !== S.Y || d.x !== S.X) {
        let gy = R.unproj(d.x, d.y);
        if (gy !== gy) gy = U.clamp(d.y + 300, 0, g.map.h);
        const e = R.h(d.x, gy);
        const keep = S && S.Y !== undefined && Math.abs(d.y - S.Y) < 30 && Math.abs(d.x - S.X) < 30;
        S = d._m = keep ? Object.assign(S, { gy: S.gy + (d.y - S.Y) }) : { gy, alt: Math.min(CEIL, e + Math.max(4, d.z)), level: null, vz: 0, e, msgT: 0, hitT: 0, vis: true, occ: false, blocked: 0, auto: null };
      }
      const x0 = d.x, gy0 = S.gy, e0 = R.h(x0, gy0);
      // ---- the dragon's own controls for height (player: Z / X; a scenario's autopilot)
      const human = d.isPlayer && d.pilot && d.pilot.human;
      if (S.auto) this.autopilot(d, S, dt);
      const climbK = human && AS.Input.down('climb'), descK = human && AS.Input.down('descend');
      // mouse flight steers toward a projected point: carry it into ground space at this altitude
      if (I.steer && !I.steer.ground) { I.steer.y += S.e; I.steer.ground = true; }
      // ---- the horizontal flight: the dragon's own model, run on the ground plane
      const zClr = Math.max(0, S.alt - e0), pitch0 = d.pitch;
      if (d.loop && !d.loop._g) { d.loop._g = true; d.loop.y0 = gy0; d.loop._alt0 = S.alt; }
      d.y = gy0; d.z = zClr; d.vz = S.vz * 0.35;
      d.collideLow = noop;
      try { base.call(d, dt); } finally { delete d.collideLow; }
      let x1 = d.x, gy1 = d.y;
      const landed = d.landed || d.landing;
      // ---- the vertical
      let alt = S.alt;
      const e1 = R.h(x1, gy1);
      if (landed) {
        alt = e1 + d.z; S.vz = 0; S.level = null;
      } else if (d.loop) {
        alt = Math.max(e1 + 4, d.loop._alt0 + (d.z - d.loop.z0));
        S.vz = 0;
      } else {
        // the height the flight model wants above the ground (cruise, low for a dive, high at a sprint)
        let tz = F.zCruise;
        if (d.diving) tz = F.zLow;
        else if (d.sprinting || (I.throttle > 0.5 && d.speed > 250)) tz = F.zHigh;
        else if (d.braking) tz = d.speed < 90 ? F.zHover : F.zCruise - 8;
        if (d.carry) tz = Math.max(tz, 26);
        if (d.energy <= 0.01) tz = Math.min(tz, 40);
        // held altitude: Z raises it, X lowers it, a dive drops it; near the ground it hands back to terrain following
        if (climbK) S.level = Math.min(CEIL, (S.level === null ? alt : S.level) + this.KEY_CLIMB * dt);
        if (S.level !== null) {
          if (descK) S.level -= this.KEY_DESCEND * dt;
          if (d.diving) S.level -= this.DIVE_DESCEND * dt;
          if (S.level < e1 + tz + 6 && !climbK) S.level = null;
        } else if (descK) tz = Math.max(F.zLow + 6, tz - 30);
        // look ahead along the track: clear what is coming, at the rate the dragon can climb
        const vx = Math.cos(d.velA) * d.speed * F.pace, vy = Math.sin(d.velA) * d.speed * F.pace;
        const clr = S.level === null ? tz : this.MIN_CLR + 22;
        let want = e1 + clr, soon = e1;
        for (const tau of [0.2, 0.45, 0.75, 1.1, 1.6]) {
          const eh = R.h(x1 + vx * tau, gy1 + vy * tau);
          want = Math.max(want, eh + clr - this.CLIMB * tau * 0.85);
          if (tau < 0.8) soon = Math.max(soon, eh);
        }
        if (S.level !== null) want = Math.max(want, S.level);
        want = Math.min(want, CEIL);
        const danger = soon + this.MIN_CLR > alt;
        const up = danger ? this.SCRAMBLE : climbK ? Math.max(this.CLIMB, this.KEY_CLIMB) : this.CLIMB;
        const down = d.diving ? 230 : descK ? 140 : 110;
        const vzT = U.clamp((want - alt) * 1.8, -down, up);
        S.vz = U.damp(S.vz, vzT, danger ? 7 : 3.5, dt);
        alt += S.vz * dt;
        if (alt > CEIL) { alt = CEIL; if (S.vz > 0) S.vz = 0; if (climbK) this.note(g, 'THE AIR IS TOO THIN — THE CEILING IS ' + Math.round(CEIL), '#cfe8ff'); }
      }
      // ---- terrain collision: the body cannot enter the ground
      const nose = 16 * d.scale, ca = Math.cos(d.angle), sa = Math.sin(d.angle);
      const eAt = (x, y) => Math.max(R.h(x, y), R.h(x + ca * nose, y + sa * nose));
      let floor = eAt(x1, gy1);
      // (a dragon that finds itself in ground too high — put there by a teleport — may always move downhill)
      if (!landed && floor + this.MIN_CLR > alt && !(floor > CEIL - this.MIN_CLR && eAt(x0, gy0) > floor + 0.01)) {
        const need = floor + this.MIN_CLR;
        if (need <= CEIL && need - alt < this.SCRAMBLE * dt * 1.6 + 4) { alt = need; S.vz = Math.max(S.vz, 20); }
        else {
          // too high to clear: no further in; slide along the slope, turn away, lose speed
          const gr = R.grad(x1, gy1, this._g || (this._g = [0, 0])), gl = Math.hypot(gr[0], gr[1]) || 1, nx = gr[0] / gl, ny = gr[1] / gl;
          let mx = x1 - x0, my = gy1 - gy0;
          const into = mx * nx + my * ny;
          if (into > 0) { mx -= nx * into; my -= ny * into; }
          // and a little back out
          mx -= nx * 6 * dt * 10; my -= ny * 6 * dt * 10;
          let sx = x0 + mx * 0.9, sy = gy0 + my * 0.9;
          if (eAt(sx, sy) + this.MIN_CLR > alt + 2) { sx = x0 - nx * 2; sy = gy0 - ny * 2; }
          if (eAt(sx, sy) + this.MIN_CLR > alt + 2) { sx = x0; sy = gy0; }
          x1 = sx; gy1 = sy;
          const away = Math.atan2(my, mx), slideOK = Math.hypot(mx, my) > 0.5;
          const wantA = slideOK ? away : Math.atan2(-ny, -nx);
          const turnA = U.clamp(U.wrapAngle(wantA - d.angle), -1, 1) * 2.4 * dt;
          d.angle = U.wrapAngle(d.angle + turnA); d.velA = U.wrapAngle(d.velA + turnA * 1.2);
          d.speed = Math.max(F.hover, d.speed * Math.exp(-2.2 * dt));
          S.blocked = 0.4;
          if (S.hitT <= 0) {
            S.hitT = 0.6;
            if (d.isPlayer && g.camera) g.camera.shake(0.06);
            const q = this.proj(g, x0 + ca * nose, gy0 + sa * nose);
            AS.FX.dust(q[0], q[1], 6, floor > R.snow ? '#eef4fa' : '#8a8070', 50);
          }
          if (d.isPlayer) this.note(g, need > CEIL ? 'TOO HIGH TO FLY OVER — FIND A PASS OR GO ROUND' : 'TOO STEEP — CLIMB (Z) OR TURN AWAY', need > CEIL ? '#ffb08a' : '#ffe7a8');
          floor = eAt(x1, gy1);
          if (floor + this.MIN_CLR > alt) alt = Math.min(CEIL, floor + this.MIN_CLR);
        }
      }
      S.hitT -= dt; S.blocked = Math.max(0, S.blocked - dt);
      const e = R.h(x1, gy1);
      if (alt > CEIL && !landed) alt = CEIL;
      if (!landed && alt < e + 4) { alt = e + 4; if (S.vz < 0) S.vz = 0; }
      // ---- back to the game's projected frame
      S.gy = gy1; S.alt = alt; S.e = e;
      d.x = x1; d.y = gy1 - e; d.z = alt - e; d.vz = S.vz;
      d.vy = Math.sin(d.velA) * d.speed * F.pace - S.vz; // the drawn body's motion on screen
      if (!landed && !d.loop) d.pitch = U.damp(pitch0, U.clamp(-S.vz / 140, -0.7, 0.7) + (d.braking ? -0.18 : 0), 4, dt);
      if (d.z < 34 && !landed) {
        const bx = d.x, by = d.y;
        d.collideLow(dt);
        if (d.x !== bx || d.y !== by) { S.gy += d.y - by; }
      }
      // what the camera and the HUD need: is the ground under the dragon in view, is the dragon behind a ridge?
      S.vis = R.visible(d.x, S.gy, 22);
      const gv = R.unproj(d.x, S.gy - alt);
      S.occ = gv === gv && gv > S.gy + 26 && R.h(d.x, gv) > alt - 30;
      S.X = d.x; S.Y = d.y;
    },
    // a test's autopilot: fly the waypoints flat out (any flight key takes back control)
    autopilot(d, S, dt) {
      const A = S.auto, I = d.input, K = AS.Input;
      if (['forward', 'back', 'left', 'right', 'dive'].some((k) => K.down(k))) { S.auto = null; d.g.msg('AUTOPILOT OFF', '#ffe7a8', 1.5); return; }
      const p = A.pts[A.i];
      if (!p) { S.auto = null; if (A.done) A.done(); return; }
      if (Math.hypot(p[0] - d.x, p[1] - S.gy) < 220) { A.i++; return; }
      I.throttle = 1; I.sprint = !!A.sprint; I.dive = false; I.turn = 0;
      I.steer = { x: p[0], y: p[1], ground: true };
      if (p[2] !== undefined) S.level = Math.min(d.g.mtn.ceil, p[2]);
    },

    /* ---------------- combat at height ---------------- */
    groundOf(g, e) {
      // a thing on the ground (projected x, y) → ground x, y and the height of its centre
      const R = g.mtn.R, gy = R.unproj(e.x, e.y), y = gy === gy ? gy : e.y;
      return [e.x, y, R.h(e.x, y) + (e.hc || 8)];
    },
    // can this shot reach the dragon (range in 3D, and no mountain in the way)?
    shotOK(g, src, target, kind) {
      const S = target._m;
      if (!S) return true;
      const R = g.mtn.R, a = this.groundOf(g, src);
      const rng = { arrow: 380, spear: 260, ballista: 640, magic: 520, crossbow: 360, stone: 520, rock: 300 }[kind] || 400;
      const d3 = Math.hypot(target.x - a[0], S.gy - a[1], S.alt - a[2]);
      if (d3 > rng * 1.12) return false;
      return R.los(a[0], a[1], a[2], target.x, S.gy, S.alt, 16, 3) >= 1;
    },
    // after the dragon casts: a bolt whose line to the aim point runs into rock bursts there
    boltLOS(g, d, before) {
      const R = g.mtn.R, S = d._m, I = d.input, act = AS.Proj.pool.active;
      if (!S) return;
      const gyA = R.unproj(I.aimX, I.aimY);
      if (gyA !== gyA) return;
      const eA = R.h(I.aimX, gyA) + 6;
      const t = R.los(d.x, S.gy, S.alt - 10, I.aimX, gyA, eA, 14, 2);
      if (t >= 1) return;
      for (const p of act) {
        if (before.has(p) || p.owner !== d) continue;
        const L = Math.hypot(I.aimX - p.x, I.aimY - p.y);
        p.life = Math.min(p.life, (L * t) / Math.max(120, p.speed * 0.9) + 0.03);
        p.target = null;
        if (p.extra) p.extra.mBlocked = true;
      }
      if (d.isPlayer) this.note(g, 'THE MOUNTAIN IS IN THE WAY', '#d8d0c0');
    },

    /* ---------------- drawables: the falling water ---------------- */
    collect(g, list, x0, y0, x1, y1) {
      const f = g.mtn.falls;
      if (f && f.lip[0] > x0 - 80 && f.lip[0] < x1 + 80 && f.foot[1] > y0 - 40 && f.lip[1] < y1 + 40) list.push(f.draw || (f.draw = this.fallsDrawable(g, f)));
    },
    fallsDrawable(g, f) {
      const o = { x: f.foot[0], y: f.foot[1] - 2, sortY: f.foot[1] - 2 };
      o.draw = (ctx, ox, oy) => {
        const t = g.mtn.t, top = f.lip[1], bot = f.foot[1], x = f.lip[0], xb = f.foot[0], w = f.w;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
          const k = (i + 0.5) / 9, sx = U.lerp(x, xb, 0.5) + (k - 0.5) * w * 1.1;
          const ph = (t * 1.4 + i * 0.37) % 1;
          const y0s = U.lerp(top, bot, ph * 0.8), len = (bot - top) * 0.22;
          const gr = ctx.createLinearGradient(0, y0s - oy, 0, y0s + len - oy);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(220,236,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr; ctx.fillRect(sx - ox - 1.5, y0s - oy, 3, len);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#f4faff';
        ctx.beginPath(); ctx.ellipse(xb - ox, bot - oy, w * 1.2, 8, 0, 0, TAU); ctx.fill();
        ctx.restore();
      };
      return o;
    },

    /* ---------------- the test scenarios ---------------- */
    startTest(g, k) {
      const m = g.map, T = m.tests && m.tests[k], p = g.player, M = g.mtn;
      if (!T || !p) return;
      if (p.down > 0) return;
      p.landed = p.landing = false; p.loop = null; p.carry && p.dropCarry && p.dropCarry(false);
      const R = M.R, e = R.h(T.x, T.y), alt = Math.min(M.ceil, Math.max(e + 30, T.alt));
      p.x = T.x; p.y = T.y - e; p.z = alt - e; p.angle = p.velA = T.a; p.speed = AS.Dragon.FLIGHT.cruise; p.vz = 0; p.angVel = 0;
      p._m = { gy: T.y, alt, level: alt > e + 90 ? alt : null, vz: 0, e, msgT: 0, hitT: 0, vis: true, occ: false, blocked: 0, auto: null, X: p.x, Y: p.y };
      for (const n of p.nodes) { n.x = p.x; n.y = p.y; n.z = p.z; }
      p.layoutRig(0, true);
      g.camera.snap(p.x, p.y - p.z + (g.camLift || 0));
      if (g.terrain.warmAt) g.terrain.warmAt([{ x: p.x, y: p.y - p.z }], g.camera.w * 1.6, g.camera.h * 1.6);
      M.test = { k, name: T.name, t: 0, log: [], start: { x: T.x, y: T.y, alt } };
      g.msg('TEST ' + k + ' — ' + T.name.toUpperCase(), '#ffe7a8', 4);
      const say = (s) => g.msg(s, '#cfe8ff', 7);
      if (k === 'A') say('Fly north (W) over farmland and forest toward the mountains: the land rises under you');
      if (k === 'B') say('Fly north at the Wall: the dragon climbs to clear it, then on up toward the Great Peak');
      if (k === 'C') say('Fly north into Mount Hrothgar: it rises far above your ceiling — you will be stopped and turned');
      if (k === 'D') say('Follow the gorge north between the walls — or climb (Z) out over the Front Range');
      if (k === 'E') say('The High Pass is ahead (saddle ~400): fly north through it to the moors beyond');
      if (k === 'F') say('Khaz Durn, the dwarf hold: its gate is cut into the Wall. Fly low to the gate');
      if (k === 'G') this.armyTest(g);
      if (k === 'H') say('Raiders hold the pass road and the fort: fire (left mouse) and breathe (F) from above, then dive and climb away');
      if (k === 'I') { say('Streaming stress: the autopilot sprints across the region and over the ranges (any flight key takes over)'); p._m.auto = { i: 0, sprint: true, pts: [[3000, 8200, 470], [6000, 5200, 480], [8000, 3000, 495], [10500, 1500, 495], [10500, 3200, 495], [9000, 5000, 470], [5000, 6400, 470], [1500, 7000, 470], [1500, 10500, 300], [6000, 11500, 200]] }; }
      if (k === 'J') say('Altitude descent: you start at the ceiling over the Wall — hold X (or SPACE) to come down into the valley');
    },
    armyTest(g) {
      const m = g.map, A = m.armyRoute, M = g.mtn;
      // clear the raiders off the route so the march is unhindered (test H fights them)
      for (const t of g.troops) if (t.alive && t.team === 'wild') { const gr = this.groundOf(g, t); if (Math.hypot(gr[0] - 8000, gr[1] - 3500) < 900) { t.alive = false; t.removed = true; } }
      for (const s of g.sites) if (s.id === 'passwatch') for (const u of s.guards || []) { u.alive = false; u.removed = true; }
      if (M.army) for (const t of M.army.troops) { t.alive = false; t.removed = true; }
      const a = this.proj(g, A.from[0], A.from[1]), b = this.proj(g, A.to[0], A.to[1]);
      const roles = ['elite', 'elite', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'archer', 'archer', 'archer', 'archer'];
      const troops = [];
      roles.forEach((r, i) => {
        const ang = i * 2.399, rr = 14 + Math.sqrt(i) * 14;
        let x = a[0] + Math.cos(ang) * rr, y = a[1] + Math.sin(ang) * rr * 0.8;
        if (!g.terrain.groundPassable(x, y)) { x = a[0]; y = a[1]; }
        const u = new AS.Troop(g, r, g.playerKey, x, y, {});
        g.troops.push(u); troops.push(u);
        u.marchTo(b[0] + U.range(-40, 40), b[1] + U.range(-40, 40), { r: 120 });
      });
      const path = AS.Nav.path(g, a[0], a[1], b[0], b[1]);
      let len = 0; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      M.army = { troops, from: a, to: b, path, len, t: 0, maxE: 0, offRoad: 0, samples: 0, arrived: 0, stuck: 0, reach: !path.unreachable, prog: 0 };
      g.msg('TEST G — AN ARMY MARCHES FROM THE VALLEY UP THE SWITCHBACKS AND THROUGH THE HIGH PASS', '#ffe7a8', 6);
      if (path.unreachable) g.msg('THE ROUTE IS BLOCKED — NO WAY THROUGH (a fault)', '#ff8a6a', 6);
    },
    updateTest(g, dt) {
      const M = g.mtn;
      if (M.test) M.test.t += dt;
      const A = M.army;
      if (A) {
        A.t += dt;
        const R = M.R, T = g.terrain;
        let best = 0, n = 0, arrived = 0;
        for (const u of A.troops) {
          if (!u.alive) continue;
          n++;
          const gr = this.groundOf(g, u);
          A.maxE = Math.max(A.maxE, gr[2] - (u.hc || 8));
          A.samples++;
          if (T.roadDist(u.x, u.y) > 70) A.offRoad++;
          const d = Math.hypot(u.x - A.to[0], u.y - A.to[1]);
          if (d < 180) arrived++;
          best = Math.max(best, 1 - d / Math.max(1, Math.hypot(A.from[0] - A.to[0], A.from[1] - A.to[1])));
          if (u.state !== 'march' && d > 200 && !u.target) u.marchTo(A.to[0] + U.range(-40, 40), A.to[1] + U.range(-40, 40), { r: 120 });
        }
        A.alive = n; A.arrived = arrived; A.prog = best;
        if (arrived >= Math.max(1, n * 0.6) && !A.done) { A.done = A.t; g.msg('TEST G — THE ARMY HAS CROSSED THE HIGH PASS (' + Math.round(A.t) + ' s, highest ground ' + Math.round(A.maxE) + ')', '#a8f0a8', 8); }
        void R;
      }
    },
    state(g) {
      const p = g.player, S = p && p._m, M = g.mtn, A = M.army;
      return {
        x: p.x, y: p.y, gy: S ? S.gy : null, alt: S ? S.alt : null, ground: S ? S.e : null, clear: S ? S.alt - S.e : null, level: S ? S.level : null, vz: S ? S.vz : null,
        blocked: S ? S.blocked > 0 : false, speed: p.speed, angle: p.angle, ceil: M.ceil, test: M.test && M.test.k,
        army: A ? { alive: A.alive, arrived: A.arrived, prog: A.prog, maxE: A.maxE, offRoad: A.samples ? A.offRoad / A.samples : 0, t: A.t, done: A.done || 0, reach: A.reach, len: A.len } : null,
      };
    },
    perfLines(g) {
      const p = g.player, S = p && p._m, M = g.mtn, R = M.R, L = [];
      if (S) L.push(['mountain: altitude ' + Math.round(S.alt) + ' / ceiling ' + Math.round(M.ceil) + ' · ground ' + Math.round(S.e) + ' · clearance ' + Math.round(S.alt - S.e) + (S.level !== null ? ' · holding ' + Math.round(S.level) : ' · following terrain') + (S.blocked > 0 ? ' · BLOCKED' : ''), '#cfe8ff']);
      L.push(['relief: ' + R.gw + '×' + R.gh + ' heights (' + R.HG + ' u) · built in ' + (R.stats ? R.stats.totalMs : '?') + ' ms · highest ' + Math.round(R.stats ? R.stats.max : 0) + (M.test ? ' · test ' + M.test.k + ' ' + Math.round(M.test.t) + ' s' : '')]);
      return L;
    },

    /* ---------------- the altitude gauge ---------------- */
    drawHUD(ctx, g) {
      const p = g.player, S = p && p._m, M = g.mtn;
      if (!S || p.down > 0) return;
      const Rn = AS.Renderer, W = Rn.canvas.width, H = Rn.canvas.height, s = AS.HUD && AS.HUD.s || 1;
      const top = 1050, gx = W - 64 * s, gy0 = H * 0.26, gh = H * 0.42, Y = (v) => gy0 + gh * (1 - U.clamp(v / top, 0, 1));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(14,16,22,0.55)'; ctx.fillRect(gx - 22 * s, gy0 - 26 * s, 74 * s, gh + 64 * s);
      // the land ahead (the highest ground within ~1.5 s) and under the dragon
      const R = M.R, F = AS.Dragon.FLIGHT, vx = Math.cos(p.velA) * p.speed * F.pace, vy = Math.sin(p.velA) * p.speed * F.pace;
      let ahead = S.e; for (const t of [0.4, 0.8, 1.2, 1.6, 2.2]) ahead = Math.max(ahead, R.h(p.x + vx * t, S.gy + vy * t));
      ctx.fillStyle = '#4a4034'; ctx.fillRect(gx - 8 * s, Y(S.e), 16 * s, gy0 + gh - Y(S.e));
      ctx.fillStyle = ahead > M.ceil - this.MIN_CLR ? 'rgba(255,120,90,0.65)' : 'rgba(200,190,160,0.5)';
      ctx.fillRect(gx - 8 * s, Y(ahead) - 1.5 * s, 16 * s, 3 * s);
      // the ceiling
      ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(gx - 14 * s, Y(M.ceil)); ctx.lineTo(gx + 14 * s, Y(M.ceil)); ctx.stroke();
      // the held altitude and the dragon
      if (S.level !== null) { ctx.strokeStyle = '#9fd8ff'; ctx.setLineDash([3 * s, 3 * s]); ctx.beginPath(); ctx.moveTo(gx - 12 * s, Y(S.level)); ctx.lineTo(gx + 12 * s, Y(S.level)); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = S.blocked > 0 ? '#ff8a6a' : '#ffe08a';
      ctx.beginPath(); ctx.moveTo(gx + 12 * s, Y(S.alt)); ctx.lineTo(gx + 22 * s, Y(S.alt) - 6 * s); ctx.lineTo(gx + 22 * s, Y(S.alt) + 6 * s); ctx.fill();
      ctx.fillStyle = '#e8e0c8'; ctx.font = (10 * s).toFixed(0) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ALT ' + Math.round(S.alt), gx + 4 * s, gy0 - 14 * s);
      ctx.fillStyle = '#ff9a7a'; ctx.fillText('ceiling ' + Math.round(M.ceil), gx + 4 * s, Y(M.ceil) - 9 * s);
      ctx.fillStyle = '#c8c0a8';
      ctx.fillText('clear ' + Math.round(S.alt - S.e), gx + 4 * s, gy0 + gh + 12 * s);
      ctx.fillText(S.level !== null ? 'hold' : 'follow', gx + 4 * s, gy0 + gh + 26 * s);
      // the test, and the keys
      ctx.textAlign = 'left'; ctx.fillStyle = '#e8dcb8'; ctx.font = (11 * s).toFixed(0) + 'px Georgia, serif';
      const lines = ['MOUNTAIN TEST · Z climb · X descend · SPACE dive · ` then 1–0: tests A–J'];
      if (M.test) lines.push('TEST ' + M.test.k + ' — ' + M.test.name + ' (' + Math.round(M.test.t) + ' s)');
      const A = M.army;
      if (A) lines.push('ARMY: ' + A.alive + ' marching · ' + Math.round(A.prog * 100) + '% of the way · ' + A.arrived + ' through · highest ground ' + Math.round(A.maxE) + (A.done ? ' · CROSSED in ' + Math.round(A.done) + ' s' : '') + (A.reach ? '' : ' · NO ROUTE'));
      lines.forEach((l, i) => ctx.fillText(l, 16 * s, H - (70 + (lines.length - 1 - i) * 15) * s));
      ctx.restore();
    },
  };
  function noop() {}

  /* ---------------- hooks into the game (active only with g.mtn) ---------------- */
  if (AS.Dragon) {
    const P = AS.Dragon.prototype, baseFlight = P.flight, baseShadow = P.drawShadow, baseDraw = P.draw, baseCanLand = P.canLand;
    P.flight = function (dt) { return this.g.mtn ? MT.flight(this, dt, baseFlight) : baseFlight.call(this, dt); };
    // the shadow only shows on ground that is in view
    P.drawShadow = function (ctx, ox, oy) { if (this.g.mtn && this._m && !this._m.vis) return; return baseShadow.call(this, ctx, ox, oy); };
    // a dragon behind a ridge is drawn faintly (the ridge is in front of it)
    P.draw = function (ctx, ox, oy, R) {
      if (!(this.g.mtn && this._m && this._m.occ)) return baseDraw.call(this, ctx, ox, oy, R);
      ctx.save(); ctx.globalAlpha *= 0.5; try { baseDraw.call(this, ctx, ox, oy, R); } finally { ctx.restore(); }
    };
    // landing: open, gentle ground (during the flight step the dragon's y is its ground y)
    P.canLand = function () {
      const g = this.g;
      if (!g.mtn) return baseCanLand.call(this);
      const R = g.mtn.R, e = R.h(this.x, this.y), Y = this.y - e;
      if (R.slope(this.x, this.y) > 0.35 || !R.visible(this.x, this.y, 16)) return false;
      const y = this.y; this.y = Y;
      try { return baseCanLand.call(this); } finally { this.y = y; }
    };
  }
  if (AS.Combat) {
    const C = AS.Combat, shoot = C.shoot, cast = C.castBolt;
    C.shoot = function (src, target, kind, o) {
      const g = src && src.g;
      if (g && g.mtn && target && target.isDragon && !MT.shotOK(g, src, target, kind)) return;
      return shoot.call(this, src, target, kind, o);
    };
    C.castBolt = function (d, bk) {
      const g = d.g;
      if (!g.mtn) return cast.call(this, d, bk);
      const before = new Set(AS.Proj.pool.active);
      const r = cast.call(this, d, bk);
      MT.boltLOS(g, d, before);
      return r;
    };
  }
  if (AS.HUD) {
    const draw = AS.HUD.draw;
    AS.HUD.draw = function (ctx, g, dt) { const r = draw.call(this, ctx, g, dt); if (g && g.mtn) MT.drawHUD(ctx, g); return r; };
  }
  if (AS.Input) {
    // while the test picker is open, 1–3 pick a scenario instead of casting a spell slot
    const hit = AS.Input.hit;
    AS.Input.hit = function (action) {
      const g = AS.game;
      if (g && g.mtn && g.mtn.picker > 0 && /^spell\d$/.test(action)) return false;
      return hit.call(this, action);
    };
  }
  AS.Mountain = MT;
})(window.AS);

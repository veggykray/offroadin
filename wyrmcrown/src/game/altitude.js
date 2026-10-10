/* WYRMCROWN — ALTITUDE in every world: a held height above the ground.
 *
 * On its own a dragon keeps to the low band the flight model gives it (dragon.js:
 * skimming, cruise, a little higher at a sprint). Z lifts it out of that band and
 * holds the height reached, up to a CEILING; X lowers the held height, SPACE drops it
 * fast, and once it comes back down into the low band the automatic height takes
 * over again. The ground is flat here, so the height is simply the dragon's z.
 *
 * What height changes (the rules live where the weapons are):
 *  - shots at a dragon need range in 3D (combat.js shoot): bows and spears cannot
 *    reach a dragon high overhead, ballistae, catapults and magic reach further
 *  - the breath burns out before it reaches the ground from high up (combat.js
 *    breathInfo); against a dragon at its own height it still works
 *  - eating, carrying, landing and claiming places already need a low dragon
 *  - an AI dragon fighting one that is high climbs to meet it (ai.js duel)
 *  - the camera slides down toward the ground and widens as the dragon climbs,
 *    and the shadow grows, fades and softens with the height
 *
 * The Mountain Test (game/mountain.js) has its own vertical flight over real
 * terrain, with the same keys, ceiling and shadow; this module stands aside there.
 */
'use strict';
(function (AS) {
  const U = AS.U, sstep = U.smoothstep;

  const AL = {
    CEIL: 500,          // the flight ceiling above the ground (map.ceiling overrides)
    KEY_CLIMB: 95,      // Z: raise the held altitude (units per second)
    KEY_DESCEND: 125,   // X: lower it
    DIVE_DESCEND: 210,  // SPACE with a held altitude
    CARRY_MAX: 200,     // a dragon carrying something cannot hold more than this
    BREATH_REACH: 140,  // above this the breath burns out before it reaches the ground
    /* the dragon's shadow against its height above the ground under it (h0 → h1 units):
     * size (×), darkness (× the scene's shadow strength), blur (world units); curve < 1
     * makes the first few hundred units count most. Shared with the Mountain Test.
     * Live-tunable in the browser console: AS.Altitude.SHADOW */
    SHADOW: { h0: 6, h1: 520, scaleMin: 0.9, scaleMax: 1.95, alphaMax: 1.55, alphaMin: 0.2, softMax: 10, curve: 0.85 },

    ceil(g) { return (g && g.map && g.map.ceiling) || this.CEIL; },

    /* called from the flight model each frame with the automatic target height tz.
     * Returns null (fly as usual) or the held target and the climb/descent rates. */
    hold(d, I, dt, tz, dive, exhausted) {
      const g = d.g, CEIL = this.ceil(g);
      const human = d.isPlayer && d.pilot && d.pilot.human;
      const K = AS.Input;
      const climbK = human && K.down('climb'), descK = human && K.down('descend');
      // an AI pilot asks for a height (to meet a high foe); otherwise its hold lapses
      if (!human) {
        if (I.holdZ > tz + 10) d.altHold = Math.min(CEIL, I.holdZ);
        else if (d.altHold != null) d.altHold -= this.KEY_DESCEND * dt;
      }
      if (climbK) d.altHold = Math.min(CEIL, (d.altHold == null ? Math.max(d.z, tz) : d.altHold) + this.KEY_CLIMB * dt);
      if (d.altHold == null) return null;
      if (descK) d.altHold -= this.KEY_DESCEND * dt;
      if (dive) d.altHold -= this.DIVE_DESCEND * dt;
      if (d.carry) d.altHold = Math.min(d.altHold, this.CARRY_MAX);
      if (exhausted) d.altHold -= this.KEY_DESCEND * dt; // too tired to stay up: it sinks back
      if (d.isPlayer && climbK && d.altHold >= CEIL - 0.5 && g.msg) g.msg('THE AIR IS TOO THIN — THE CEILING IS ' + Math.round(CEIL), '#cfe8ff', 1.5);
      // back down in the low band: the automatic height takes over again
      if (d.altHold < tz + 6 && !climbK) { d.altHold = null; return null; }
      return { tz: d.altHold, up: climbK ? 110 : 80, down: dive ? 230 : descK ? 140 : 110 };
    },

    // the shadow's size, darkness and blur for a height c above the ground
    shadowLook(d, c) {
      const T = this.SHADOW, f = Math.pow(U.clamp((c - T.h0) / (T.h1 - T.h0), 0, 1), T.curve);
      return { scale: U.lerp(T.scaleMin, T.scaleMax, f), alpha: U.lerp(T.alphaMax, T.alphaMin, f), soft: T.softMax * f, ax: d.x + 2 + d.z * 0.27, ay: d.y + 1 + d.z * 0.06 };
    },

    /* each frame (realm.update): the camera frames the ground below a high dragon —
     * the view slides down toward its shadow and widens a little */
    update(g, dt) {
      const p = g.player, A = g.alt || (g.alt = { lift: 0, zoom: 1, show: 0 });
      if (p && p.down <= 0) {
        const c = p.z;
        A.lift = U.damp(A.lift, U.clamp((c - 70) * 0.5, 0, 250), 2.2, dt);
        A.zoom = U.damp(A.zoom, 1 - 0.15 * sstep(120, 460, c), 1.5, dt);
        A.show = U.damp(A.show, p.altHold != null || c > AS.Dragon.FLIGHT.zHigh + 12 ? 1 : 0, 3, dt);
      } else { A.lift = U.damp(A.lift, 0, 3, dt); A.zoom = U.damp(A.zoom, 1, 2, dt); A.show = U.damp(A.show, 0, 3, dt); }
      g.camLift = A.lift; g.camZoom = A.zoom;
    },

    /* the altitude gauge (right edge), shown while the dragon is above its usual height */
    drawHUD(ctx, g) {
      const p = g.player, A = g.alt;
      if (!p || !A || A.show < 0.02 || p.down > 0) return;
      const Rn = AS.Renderer, W = Rn.canvas.width, H = Rn.canvas.height, s = (AS.HUD && AS.HUD.s) || 1;
      const CEIL = this.ceil(g), top = CEIL * 1.1, gx = W - 64 * s, gy0 = H * 0.42, gh = H * 0.3, Y = (v) => gy0 + gh * (1 - U.clamp(v / top, 0, 1));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.85 * A.show;
      ctx.fillStyle = 'rgba(14,16,22,0.55)'; ctx.fillRect(gx - 22 * s, gy0 - 26 * s, 74 * s, gh + 52 * s);
      // the usual flying band, the ceiling, the held height and the dragon
      ctx.fillStyle = 'rgba(200,190,160,0.25)'; ctx.fillRect(gx - 8 * s, Y(AS.Dragon.FLIGHT.zHigh), 16 * s, gy0 + gh - Y(AS.Dragon.FLIGHT.zHigh));
      ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(gx - 14 * s, Y(CEIL)); ctx.lineTo(gx + 14 * s, Y(CEIL)); ctx.stroke();
      if (p.altHold != null) { ctx.strokeStyle = '#9fd8ff'; ctx.setLineDash([3 * s, 3 * s]); ctx.beginPath(); ctx.moveTo(gx - 12 * s, Y(p.altHold)); ctx.lineTo(gx + 12 * s, Y(p.altHold)); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.moveTo(gx + 12 * s, Y(p.z)); ctx.lineTo(gx + 22 * s, Y(p.z) - 6 * s); ctx.lineTo(gx + 22 * s, Y(p.z) + 6 * s); ctx.fill();
      ctx.fillStyle = '#e8e0c8'; ctx.font = (10 * s).toFixed(0) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ALT ' + Math.round(p.z), gx + 4 * s, gy0 - 14 * s);
      ctx.fillStyle = '#ff9a7a'; ctx.fillText('ceiling ' + Math.round(CEIL), gx + 4 * s, Y(CEIL) - 9 * s);
      ctx.fillStyle = '#c8c0a8';
      ctx.fillText(p.altHold != null ? 'Z up · X down' : 'Z to climb', gx + 4 * s, gy0 + gh + 14 * s);
      ctx.restore();
    },
  };

  /* ---------------- hooks (stand aside on the Mountain Test, which has its own) ---------------- */
  if (AS.Dragon) {
    const P = AS.Dragon.prototype, baseShadow = P.drawShadow;
    // the shadow tells the height: close down small, dark and sharp; high up spread, faint and soft
    P.drawShadow = function (ctx, ox, oy) {
      if (this.g.mtn || this.hidden || (this.loop && this.loopPose) || this.landed) return baseShadow.call(this, ctx, ox, oy);
      AS.DragonArt.drawShadow(ctx, this.syncDraw(), ox, oy, AL.shadowLook(this, this.z));
    };
  }
  if (AS.HUD) {
    const draw = AS.HUD.draw;
    AS.HUD.draw = function (ctx, g, dt) { const r = draw.call(this, ctx, g, dt); if (g && !g.mtn && g.alt) AL.drawHUD(ctx, g); return r; };
  }
  AS.Altitude = AL;
})(window.AS);

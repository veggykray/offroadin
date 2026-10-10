/* WYRMCROWN — the human pilot: turns keyboard, mouse and gamepad into the same
 * input record the AI pilots fill (see Dragon.blankInput). Two control modes:
 *  keys  — A/D bank, W beats the wings, S flares; the mouse aims the wizard's
 *          staff independently, so you can circle a tower while blasting it;
 *  mouse — the dragon flies toward the cursor (W/S still set the pace) and the
 *          staff fires at the cursor too: point where you want to go.
 * A gamepad flies with the left stick and aims with the right.
 * Two shortcuts: double-click an animal and the dragon swoops down, snatches
 * and eats it (any flight key breaks off); double-tap SPACE to loop the loop. */
'use strict';
(function (AS) {
  const U = AS.U;
  const DOUBLE = 0.4; // seconds between the taps of a double-tap; also how long a click on an animal holds the staff
  // eating by double-click is forgiving: the second click may come a little later than the
  // system double-click allows, and anywhere near the first (the cursor drifts while flying)
  const DBL_TIME = 0.75, DBL_PX = 56, PICK_R = 70, PICK_R2 = 100;
  // the browser's own double-click (it honours the system setting, and two
  // clicks that land in one slow frame still count)
  let dblClicked = false, hooked = false;
  function hookDoubleClick() {
    const cv = document.getElementById('game');
    if (!cv) return;
    hooked = true;
    cv.addEventListener('dblclick', (e) => { if (e.button === 0) dblClicked = true; });
  }
  class HumanPilot {
    constructor() { this.human = true; this.quarry = null; this.holdFire = -9; this.diveTapT = -9; this.clickT = -9; this.clickPrey = null; dblClicked = false; }
    read(d, inp, dt) {
      if (!hooked) hookDoubleClick();
      const I = AS.Input, g = d.g;
      const pad = I.usingPad && I.pad;
      const mode = AS.Settings.controlMode || 'keys';
      inp.throttle = (I.down('forward') ? 1 : 0) - (I.down('back') ? 1 : 0);
      inp.turn = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
      inp.steer = null;
      if (pad) {
        const s = I.padState;
        if (Math.abs(s.moveX) > 0.15) inp.turn = s.moveX;
        if (Math.abs(s.moveY) > 0.25) inp.throttle = -s.moveY;
      }
      inp.dive = I.down('dive');
      inp.skim = false;
      // a double-tap of SPACE loops the loop
      inp.loop = false;
      if (I.hit('dive')) {
        if (g.time - this.diveTapT < DOUBLE) { inp.loop = true; this.diveTapT = -9; } else this.diveTapT = g.time;
      }
      inp.sprint = I.down('sprint');
      inp.eatHit = I.hit('eat');
      inp.eat = I.down('eat');
      // Q casts the first filled spell slot; 1, 2, 3 cast that slot
      inp.spellSlot = I.hit('spell1') ? 0 : I.hit('spell2') ? 1 : I.hit('spell3') ? 2 : -1;
      inp.spellHit = I.hit('spell') || inp.spellSlot >= 0;
      // aim: mouse in world (projected) space, or the right stick, or straight ahead
      if (pad && I.padAim.active && Math.abs(I.padState.aimX) + Math.abs(I.padState.aimY) > 0.2) {
        const a = Math.atan2(I.padAim.y, I.padAim.x);
        inp.aimX = d.x + Math.cos(a) * 260; inp.aimY = d.y - d.z + Math.sin(a) * 260;
      } else if (pad) {
        inp.aimX = d.x + Math.cos(d.angle) * 260; inp.aimY = d.y - d.z + Math.sin(d.angle) * 260;
      } else {
        const w = AS.Renderer.screenToWorld(I.mouse.x, I.mouse.y, g.camera);
        inp.aimX = w.x; inp.aimY = w.y;
        if (mode === 'mouse' && I.mouse.inside) inp.steer = { x: w.x, y: w.y + d.z };
      }
      const m = I.mouse;
      // Command Mode (src/game/command.js): the mouse commands the soldiers and the dragon
      // hangs in the air where it is unless W beats the wings
      if (g.cmd && g.cmd.on) {
        dblClicked = false; inp.steer = null;
        if (!I.down('forward') && !(pad && I.padState.moveY < -0.25)) inp.throttle = -1;
        inp.fire = false; inp.breath = I.down('breath');
        if (this.quarry) this.stopHunt(d);
        return;
      }
      if (m.lPressed && !g.uiBlocking && !pad) this.click(d, inp);
      if (dblClicked) { dblClicked = false; if (!g.uiBlocking && !pad && g.time - (this.dblT || -9) > DBL_TIME) this.doubleClick(d, inp); }
      inp.fire = (m.l && !g.uiBlocking && g.time >= this.holdFire) || (pad && !!I.padState.firePrimary);
      inp.breath = (m.r && !g.uiBlocking) || I.down('breath') || (pad && !!I.padState.breath);
      if (g.uiBlocking) { inp.fire = false; inp.breath = false; }
      if (this.quarry) this.chase(d, inp, dt);
    }
    /* a click on an animal holds the staff for a moment (so the first click of
     * a double-click doesn't blast dinner); the second click starts the hunt */
    click(d, inp) {
      const g = d.g, prey = AS.Life.preyAt(g, inp.aimX, inp.aimY, PICK_R), m = AS.Input.mouse;
      // our own double-click: a second click soon after the first and near it on screen
      const now = performance.now() / 1000;
      if (this.lastClick && now - this.lastClick.t < DBL_TIME && Math.hypot(m.x - this.lastClick.x, m.y - this.lastClick.y) < DBL_PX) {
        this.lastClick = null; this.dblT = g.time;
        this.doubleClick(d, inp);
        return;
      }
      this.lastClick = { t: now, x: m.x, y: m.y };
      // remember what the first click landed on: a running deer is gone from under
      // the cursor by the second
      if (prey || g.time - this.clickT > DOUBLE + 0.3) { this.clickPrey = prey; this.clickT = g.time; }
      if (!prey) return;
      // a foe near the cursor means the click is a shot, not the start of a double-click
      if (!g.nearestFoe(d.team, inp.aimX, inp.aimY + 20, 70)) this.holdFire = g.time + DBL_TIME;
    }
    doubleClick(d, inp) {
      const g = d.g, c = this.clickPrey;
      const prey = c && c.alive && !c.carried && g.time - this.clickT < 1.2 ? c : AS.Life.preyAt(g, inp.aimX, inp.aimY, PICK_R2);
      this.clickPrey = null;
      if (prey) { this.startHunt(d, prey); this.holdFire = g.time + 0.3; }
    }
    startHunt(d, o) {
      this.quarry = { o, t: 0, lx: o.x, ly: o.y, vx: 0, vy: 0 };
      d.preyWant = o;
      if (d.carry) return;
      d.g.msg('HUNTING THE ' + o.kind.toUpperCase() + ' — ANY FLIGHT KEY BREAKS OFF', '#ffd27a', 2.2);
      AS.Audio.sfx('dragon_growl', { vol: 0.55, rate: 1.15 });
    }
    stopHunt(d, why) {
      this.quarry = null; d.preyWant = null;
      if (why) d.g.msg(why, '#ffe7a8', 1.6);
    }
    /* the hunt autopilot: line up on the animal, skim in low a little faster
     * than it can run (but slow enough for the long snatch reach), snatch it
     * when it is in reach; a tap-snatch eats at once */
    chase(d, inp, dt) {
      const h = this.quarry, o = h.o, g = d.g, I = AS.Input;
      h.t += dt;
      const pad = I.usingPad && I.pad;
      const broke = I.hit('forward') || I.hit('back') || I.hit('left') || I.hit('right') || I.hit('dive') || I.hit('sprint') ||
        (pad && (Math.abs(I.padState.moveX) > 0.5 || Math.abs(I.padState.moveY) > 0.5));
      if (d.carry || d.eatT > 0 || d.down > 0) return this.stopHunt(d);
      if (broke) return this.stopHunt(d, 'HUNT BROKEN OFF');
      if (!o.alive || o.carried) return this.stopHunt(d, 'THE PREY IS GONE');
      if (h.t > 20) return this.stopHunt(d, 'THE PREY GOT AWAY');
      // aim a little ahead of a running animal (its pace measured from how it moves)
      if (dt > 0) { h.vx = U.damp(h.vx, (o.x - h.lx) / dt, 6, dt); h.vy = U.damp(h.vy, (o.y - h.ly) / dt, 6, dt); }
      h.lx = o.x; h.ly = o.y;
      const tx = o.x + h.vx * 0.35, ty = o.y + h.vy * 0.35;
      const dist = Math.hypot(tx - d.x, ty - d.y);
      const off = U.wrapAngle(Math.atan2(ty - d.y, tx - d.x) - d.angle);
      inp.steer = null; inp.sprint = false; inp.loop = false;
      inp.turn = U.clamp(off * 2.6, -1, 1);
      inp.dive = false;
      if (d.landed) { inp.throttle = 1; return; }
      inp.skim = dist < 560;
      const run = Math.hypot(h.vx, h.vy);
      // stay under snatch speed on the run-in, then lunge at a fleeing horse or deer
      // (flight speed covers FLIGHT.pace of its value in ground: closing on the animal needs that much more)
      const pace = (AS.Dragon && AS.Dragon.FLIGHT && AS.Dragon.FLIGHT.pace) || 1;
      let want = dist > 520 ? 270 : U.clamp((run + 85) / pace, 115, dist < 170 ? 300 : 230 / pace);
      if (Math.abs(off) > 1.2) want = Math.min(want, 150); // slow for a tight turn back onto it
      inp.throttle = d.speed < want - 12 ? 1 : d.speed > want + 18 ? -0.6 : 0;
      if (AS.Life.preyInReach(g, d) === o) inp.eatHit = true;
    }
  }
  AS.HumanPilot = HumanPilot;
})(window.AS);

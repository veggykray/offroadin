/* WYRMCROWN — the human pilot: turns keyboard, mouse and gamepad into the same
 * input record the AI pilots fill (see Dragon.blankInput). Two control modes:
 *  keys  — A/D bank, W beats the wings, S flares; the mouse aims the wizard's
 *          staff independently, so you can circle a tower while blasting it;
 *  mouse — the dragon flies toward the cursor (W/S still set the pace) and the
 *          staff fires at the cursor too: point where you want to go.
 * A gamepad flies with the left stick and aims with the right. */
'use strict';
(function (AS) {
  const U = AS.U;
  class HumanPilot {
    constructor() { this.human = true; }
    read(d, inp, dt) {
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
      inp.sprint = I.down('sprint');
      inp.eatHit = I.hit('eat');
      inp.eat = I.down('eat');
      inp.spellHit = I.hit('spell');
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
      inp.fire = (m.l && !g.uiBlocking) || (pad && !!I.padState.firePrimary);
      inp.breath = (m.r && !g.uiBlocking) || I.down('breath') || (pad && !!I.padState.breath);
      if (g.uiBlocking) { inp.fire = false; inp.breath = false; }
    }
  }
  AS.HumanPilot = HumanPilot;
})(window.AS);

/* ALIEN STRIKE — input layer.
 * Game code reads *actions* (thrust, fire, interact…) rather than raw keys so key
 * rebinding and controllers plug in without touching gameplay. */
'use strict';
(function (AS) {
  const DEFAULT_BINDINGS = {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    strafeLeft: ['KeyQ'],
    strafeRight: ['KeyF'],
    boost: ['ShiftLeft', 'ShiftRight'],
    special: ['Space'],
    interact: ['KeyE'],
    map: ['KeyM'],
    objectives: ['Tab'],
    repair: ['KeyR'],
    pause: ['Escape', 'KeyP'],
    controlMode: ['KeyC'],
  };
  const ACTION_LABELS = {
    forward: 'Move up / thrust', back: 'Move down / brake', left: 'Move left / rotate',
    right: 'Move right / rotate', strafeLeft: 'Strafe left (Classic mode)', strafeRight: 'Strafe right (Classic mode)',
    boost: 'Boost (extra fuel burn)', special: 'Special weapon', interact: 'Interact / rescue / pick up',
    map: 'Tactical map', objectives: 'Objectives', repair: 'Use repair kit', pause: 'Pause menu',
    controlMode: 'Toggle control mode',
  };

  const Input = {
    DEFAULT_BINDINGS, ACTION_LABELS,
    /* Another game on this engine supplies its own actions, labels and gamepad map:
     *   AS.Input.configure({ bindings, labels, pad: (state, axes, button) => {...} })
     * `pad` fills the per-frame pad state (action → bool, plus moveX / moveY). */
    configure(o) {
      if (o.bindings) this.DEFAULT_BINDINGS = o.bindings;
      if (o.labels) this.ACTION_LABELS = o.labels;
      if (o.pad) this.padMap = o.pad;
      if (o.preventKeys) this.preventKeys = o.preventKeys;
      this.bindings = JSON.parse(JSON.stringify(this.DEFAULT_BINDINGS));
    },
    padMap: null, preventKeys: null,
    bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
    keys: new Set(),
    pressed: new Set(),
    released: new Set(),
    mouse: { x: 0, y: 0, l: false, r: false, m: false, lPressed: false, rPressed: false, lReleased: false, rReleased: false, wheel: 0, inside: true },
    pad: null, padAim: { x: 0, y: 0, active: false },
    usingPad: false,
    captureHandler: null, // used by the rebinding UI
    init(target) {
      window.addEventListener('keydown', (e) => {
        if (this.captureHandler) { e.preventDefault(); this.captureHandler(e.code); return; }
        if (e.code === 'Tab' || e.code === 'Space' || e.code === 'F9' || e.code.startsWith('Arrow') || (this.preventKeys && this.preventKeys.includes(e.code))) {
          if (!(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT'))) e.preventDefault();
        }
        if (!this.keys.has(e.code)) this.pressed.add(e.code);
        this.keys.add(e.code);
        this.usingPad = false;
      });
      window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
      window.addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
      window.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.usingPad = false; });
      target.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this.mouse.l = true; this.mouse.lPressed = true; }
        if (e.button === 2) { this.mouse.r = true; this.mouse.rPressed = true; }
        if (e.button === 1) { this.mouse.m = true; e.preventDefault(); }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) { if (this.mouse.l) this.mouse.lReleased = true; this.mouse.l = false; }
        if (e.button === 2) { if (this.mouse.r) this.mouse.rReleased = true; this.mouse.r = false; }
        if (e.button === 1) this.mouse.m = false;
      });
      target.addEventListener('contextmenu', (e) => e.preventDefault());
      target.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
      document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
      document.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    },
    setBindings(b) {
      this.bindings = JSON.parse(JSON.stringify(this.DEFAULT_BINDINGS));
      if (b) for (const k in b) if (this.bindings[k] && Array.isArray(b[k])) this.bindings[k] = b[k].slice(0, 2);
    },
    down(action) {
      const b = this.bindings[action];
      if (b) for (let i = 0; i < b.length; i++) if (this.keys.has(b[i])) return true;
      return this.padDown(action);
    },
    hit(action) {
      const b = this.bindings[action];
      if (b) for (let i = 0; i < b.length; i++) if (this.pressed.has(b[i])) return true;
      return this.padHit(action);
    },
    keyName(code) {
      if (!code) return '—';
      return code.replace('Key', '').replace('Digit', '').replace('Left', ' L').replace('Right', ' R')
        .replace('Arrow', '↑↓←→'.includes(code) ? '' : 'Arrow ');
    },
    /* ---- Gamepad (standard mapping). Left stick = move, right stick = aim. ---- */
    padPrev: {},
    padState: {},
    pollPad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let p = null;
      for (const g of pads) if (g && g.connected) { p = g; break; }
      this.pad = p;
      this.padPrev = this.padState;
      this.padState = {};
      if (!p) { this.padAim.active = false; return; }
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const s = this.padState;
      s.moveX = lx; s.moveY = ly; s.aimX = rx; s.aimY = ry;
      if (this.padMap) {
        this.padMap(s, p.axes, (i) => (p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0));
        if (Object.values(s).some((v) => v === true) || Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0) this.usingPad = true;
        if (Math.abs(rx) + Math.abs(ry) > 0) { this.padAim.x = rx; this.padAim.y = ry; this.padAim.active = true; }
        return;
      }
      s.forward = ly < -0.3; s.back = ly > 0.3; s.left = lx < -0.3; s.right = lx > 0.3;
      s.firePrimary = (p.buttons[7] && p.buttons[7].value > 0.3) || false;
      s.fireSecondary = (p.buttons[6] && p.buttons[6].value > 0.3) || false;
      s.special = b(5); s.interact = b(0); s.boost = b(10) || b(4); s.repair = b(3);
      s.map = b(8); s.objectives = b(2); s.pause = b(9);
      if (Object.values(s).some((v) => v === true) || Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0) this.usingPad = true;
      if (Math.abs(rx) + Math.abs(ry) > 0) { this.padAim.x = rx; this.padAim.y = ry; this.padAim.active = true; }
    },
    padDown(a) { return !!this.padState[a]; },
    padHit(a) { return !!this.padState[a] && !this.padPrev[a]; },
    endFrame() {
      this.pressed.clear();
      this.released.clear();
      const m = this.mouse;
      m.lPressed = m.rPressed = m.lReleased = m.rReleased = false;
      m.wheel = 0;
    },
  };
  AS.Input = Input;
})(window.AS);

import type { DriveInput } from '../vehicle/VehicleController';

/**
 * Keyboard first, gamepad if connected (standard mapping: left stick steer,
 * RT accelerate, LT brake/reverse, A nitro, Y reset, Start restart).
 */
export class InputManager {
  private keys = new Set<string>();
  private pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backquote', 'F3'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  /** True once per key press. */
  consume(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame(): void {
    this.pressed.clear();
  }

  private gamepad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  private padPrev: boolean[] = [];
  /** Gamepad button edge (for reset / restart). */
  padButton(i: number): boolean {
    const p = this.gamepad();
    const now = !!p?.buttons[i]?.pressed;
    const was = this.padPrev[i] ?? false;
    this.padPrev[i] = now;
    return now && !was;
  }

  getDriveInput(): DriveInput {
    const k = (c: string) => this.keys.has(c);
    let throttle = k('KeyW') || k('ArrowUp') ? 1 : 0;
    let brake = k('KeyS') || k('ArrowDown') ? 1 : 0;
    let steer = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    let nitro = k('Space');
    const pad = this.gamepad();
    if (pad) {
      const sx = pad.axes[0] ?? 0;
      if (Math.abs(sx) > 0.15) steer = Math.sign(sx) * ((Math.abs(sx) - 0.15) / 0.85);
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      if (rt > 0.05) throttle = Math.max(throttle, rt);
      if (lt > 0.05) brake = Math.max(brake, lt);
      if (pad.buttons[0]?.pressed) nitro = true;
    }
    return { throttle, brake, steer, nitro };
  }
}

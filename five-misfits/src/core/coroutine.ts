/**
 * Frame-stepped coroutines. A routine is a generator; each `yield` waits one fixed frame
 * and receives the frame's dt. Used for scripted sequences (charges, lunges, enemy turns)
 * so timing stays deterministic and readable.
 */
export type Routine = Generator<void, void, number>;

export function* waitSeconds(seconds: number): Routine {
  let t = 0;
  while (t < seconds) { const dt: number = yield; t += dt; }
}

export function* waitUntil(pred: () => boolean, maxSeconds = 10): Routine {
  let t = 0;
  while (!pred() && t < maxSeconds) { const dt: number = yield; t += dt; }
}

export class CoroutineRunner {
  private active: Routine | null = null;
  get busy(): boolean { return this.active !== null; }
  start(r: Routine): void { this.active = r; this.step(0); }
  step(dt: number): void {
    if (!this.active) return;
    const res = this.active.next(dt);
    if (res.done) this.active = null;
  }
  cancel(): void { this.active = null; }
}

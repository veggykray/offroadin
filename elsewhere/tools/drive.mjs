// Shared "player" driver for the browser harnesses: every action is a real tap/click on screen.
// Off-screen targets are reached the way a player would — walking in stages toward them (each tap lands
// inside the viewport) — never by teleporting or by poking the simulation.
export function makeDriver(page, { mobile = false, W, H } = {}) {
  const screenOf = (kind, id) => page.evaluate(([k, i]) => window.__elsewhere.screenOf(k, i), [kind, id]);
  const snap = () => page.evaluate(() => window.__elsewhere.snapshot());
  // Inside the canvas and clear of the HUD (top pills, bottom-left portraits, bottom hint strip).
  const inView = (p, m = 14) => p.x > m && p.x < W - m && p.y > 56 + m && p.y < H - m && !(p.x < 190 && p.y > H - 100) && !(p.y > H - 48 && p.x > W * 0.3 && p.x < W * 0.7);
  const clickAt = async (p) => { if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); };
  const waitFor = async (fn, ms = 60000, label = '') => { try { await page.waitForFunction(fn, null, { timeout: ms, polling: 100 }); return true; } catch { console.log('  timeout waiting: ' + label); return false; } };
  const current = async () => { const s = await snap(); return s[s.selected]; };
  const idle = (ms = 40000) => waitFor(() => { const s = window.__elsewhere.snapshot(); const a = s[s.selected]; return a.motion !== 'walk' && a.motion !== 'turn'; }, ms, 'idle');
  /** Furthest on-screen point along the selected animal's actual route to (x,z) — read-only nav query. */
  const stagePoint = async (x, z, floor) => {
    const pts = await page.evaluate(([tx, tz, f]) => {
      const g = window.__elsewhere.game; const a = g.current; const path = g.nav[f].findPath(a.pos, { x: tx, z: tz }, a.radius);
      if (!path) return null; const out = [];
      for (let i = 0; i < path.length - 1; i++) { const p = path[i], q = path[i + 1]; const d = Math.hypot(q.x - p.x, q.z - p.z); const n = Math.max(1, Math.ceil(d / 0.5)); for (let k = 1; k <= n; k++) out.push({ x: p.x + (q.x - p.x) * k / n, z: p.z + (q.z - p.z) * k / n }); }
      return out;
    }, [x, z, floor]);
    if (!pts) return null;
    const y = floor ? 8 : 0;
    for (let i = pts.length - 1; i >= 0; i--) { const sp = await screenOf('world', [pts[i].x, y, pts[i].z]); if (inView(sp, 36)) return sp; }
    return null;
  };
  /** Walk the selected animal to (x,z) on `floor` in on-screen stages along its route. */
  const tapWorld = async (x, z, floor = 0) => {
    const y = floor ? 8 : 0;
    for (let step = 0; step < 10; step++) {
      const p = await screenOf('world', [x, y, z]);
      if (inView(p)) { await clickAt(p); return true; }
      const best = await stagePoint(x, z, floor); if (!best) return false;
      await clickAt(best); await idle(); await page.waitForTimeout(150);
    }
    return false;
  };
  /** Approach an interactable along the route until it is on screen, then tap it. */
  const tapThing = async (id) => {
    for (let step = 0; step < 10; step++) {
      await settleCamera(); const p = await screenOf('interactable', id);
      if (inView(p)) { await clickAt(p); return true; }
      const def = await page.evaluate((i) => window.__elsewhere.interactables[i], id); if (!def) return false;
      const best = await stagePoint(def.standPoint.x, def.standPoint.z, def.floor); if (!best) return false;
      await clickAt(best); await idle(); await page.waitForTimeout(150);
    }
    return false;
  };
  const tapActor = async (id) => { await settleCamera(); await clickAt(await screenOf('actor', id)); };
  /** Switch portrait, then let the camera finish its jump to the other animal (slow headless frames can snap it). */
  const portrait = async (id) => { await page.click('#p-' + id); await page.waitForTimeout(1400); };
  const settleCamera = () => page.waitForTimeout(700);
  return { screenOf, snap, clickAt, waitFor, tapWorld, tapThing, tapActor, portrait, idle };
}

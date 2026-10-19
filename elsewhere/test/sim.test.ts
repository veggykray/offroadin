import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/Game';
import { BRIDGE, INTERACTABLES, LIFT, WHITE } from '../src/config/p2Slice';
import { dist } from '../src/sim/vec';

const DT = 1 / 60;
function run(g: Game, seconds: number, until?: () => boolean): number {
  let t = 0;
  while (t < seconds) { g.update(DT); t += DT; if (until && until()) return t; }
  return t;
}
function settle(g: Game, seconds = 20): void {
  run(g, seconds, () => !g.dog.moving && !g.cat.moving && !g.dog.busy && !g.cat.busy && !g.lift.busy);
}

test('nav: dog needs more clearance than the cat; no path across the dry gap', () => {
  const g = new Game();
  const across = g.nav[0].findPath({ x: -8, z: 2 }, { x: 8, z: 2 }, g.dog.radius);
  assert.equal(across, null, 'no bridge yet');
  // narrow slot between the arch pier and the cistern row: cat fits, dog does not
  const catPath = g.nav[0].findPath({ x: -14, z: 0 }, { x: -4, z: 3 }, g.cat.radius);
  const dogPath = g.nav[0].findPath({ x: -14, z: 0 }, { x: -4, z: 3 }, g.dog.radius);
  assert.ok(catPath && dogPath, 'both can reach the east side of 0B');
  // the dog never walks through the diverter body
  for (const p of dogPath!) assert.ok(dist(p, { x: -8, z: -1 }) > 0.95 + g.dog.radius - 0.3, 'dog path keeps clear of CV-01');
});

test('full P2 sequence through user-facing orders, then reset and replay', () => {
  const g = new Game();
  for (let round = 0; round < 2; round++) {
    // A. Investigate
    g.select('dog');
    g.tapActor('dog');
    run(g, 0.1);
    assert.ok(g.scentTrail.length > 2, 'scent trail revealed');
    g.tapInteractable('seep'); settle(g);
    assert.equal(g.cyan.seepOpen, true, 'seep scraped open');
    // B. Redirect
    g.tapInteractable('CV-01'); settle(g);
    assert.equal(g.cyan.diverter, 'bridge');
    run(g, 12, () => g.cyan.bridgeSolid);
    assert.ok(g.cyan.bridgeSolid, 'bridge formed'); assert.ok(g.has('P2_BRIDGE_READY'));
    // Toggle away while the dog stands on the bridge: closure must wait.
    g.tapGround(0, { x: 0, z: -1 }); settle(g);
    assert.ok(Math.abs(g.dog.x) < 2, 'dog on the bridge');
    g.select('cat'); g.tapInteractable('CV-01'); settle(g);
    run(g, 3);
    assert.equal(g.cyan.diverter, 'spill'); assert.ok(g.cyan.closePending, 'closure deferred while occupied'); assert.ok(g.cyan.bridgeSolid, 'bridge still solid under the dog');
    g.tapInteractable('CV-01'); settle(g); run(g, 1);
    assert.equal(g.cyan.diverter, 'bridge'); assert.equal(g.cyan.closePending, false);
    // Dog completes the crossing -> safety latch
    g.select('dog'); g.tapGround(0, { x: 6, z: -1 }); settle(g);
    assert.ok(g.dog.x > 3.5, 'dog on 0D'); assert.ok(g.cyan.bridgeSafe && g.has('P2_BRIDGE_SAFE'), 'latched');
    // Redirecting now keeps a solid return path
    g.select('cat'); g.tapInteractable('CV-01'); settle(g); run(g, 6);
    assert.equal(g.cyan.bridgeSolid, false, 'liquid construct drained'); assert.ok(g.cyan.bridgeWalkable, 'slats keep E02 walkable');
    assert.ok(g.nav[0].findPath({ x: -8, z: 2 }, { x: 8, z: 2 }, g.dog.radius), 'dog route across persists');
    g.tapInteractable('CV-01'); settle(g); run(g, 8, () => g.cyan.bridgeSolid);
    // White followed the dog over and balks at the lift
    g.select('dog'); g.tapGround(0, { x: 8.5, z: 1 }); settle(g); run(g, 6, () => g.whiteBalked && !g.white.moving);
    assert.ok(g.whiteBalked, 'White balked once'); assert.equal(g.white.floor, 0);
    assert.ok(dist(g.white.pos, WHITE.balkPoint) < 1.0, 'White waits at the balk point');
    // C. Reassure
    g.tapActor('white'); run(g, 12, () => g.whiteReassured);
    assert.ok(g.whiteReassured, 'reassured'); assert.equal(g.dog.motion, 'sit');
    // D. Separate: cat crosses, rides the weak lift alone
    g.select('cat'); g.tapGround(0, { x: 6, z: 0 }); settle(g);
    g.tapInteractable('liftBase'); run(g, 20, () => g.cat.floor === 1 && !g.lift.busy);
    assert.equal(g.cat.floor, 1, 'cat at 1A'); assert.equal(g.dog.floor, 0); assert.equal(g.white.floor, 0);
    const dogBefore = { ...g.dog.pos }, whiteBefore = { ...g.white.pos };
    // Switching portraits never moves the others
    g.select('dog'); run(g, 1); g.select('cat'); run(g, 1);
    assert.deepEqual(g.dog.pos, dogBefore); assert.ok(dist(g.white.pos, whiteBefore) < 0.01);
    // Cat can come back down before solving anything, then go up again
    g.tapInteractable('liftTop'); run(g, 20, () => g.cat.floor === 0 && !g.lift.busy);
    assert.equal(g.cat.floor, 0, 'cat returned');
    // Dog tries the weak lift: rejected safely
    g.select('dog'); g.tapInteractable('liftBase'); run(g, 20, () => g.lift.events.length === 0 && g.lift.state === 'docked0' && g.dog.motion === 'idle' && !g.lift.busy && g.time > 0);
    run(g, 6, () => !g.dog.moving);
    assert.equal(g.dog.floor, 0, 'dog stays on floor 0'); assert.equal(g.lift.state, 'docked0'); assert.ok(dist(g.dog.pos, LIFT.centre) > 1.6, 'dog stepped off the float');
    // E. Strengthen
    g.select('cat'); g.tapInteractable('liftBase'); run(g, 20, () => g.cat.floor === 1 && !g.lift.busy);
    g.tapInteractable('indicator'); settle(g);
    g.tapInteractable('MR-01'); settle(g); run(g, 1);
    assert.equal(g.lift.strength, 'strong'); assert.ok(g.has('P2_LIFT_STRONG'));
    // F. Reunite: dog boards, White joins automatically
    g.select('dog'); g.tapInteractable('liftBase'); run(g, 30, () => g.dog.floor === 1 && g.white.floor === 1 && !g.lift.busy);
    assert.equal(g.dog.floor, 1); assert.equal(g.white.floor, 1);
    run(g, 2);
    assert.ok(g.completed && g.has('P2_ASCENDED'), 'P2_ASCENDED awarded');
    // Reset
    g.reset();
    assert.equal(g.dog.floor, 0); assert.equal(g.cat.floor, 0); assert.equal(g.white.floor, 0);
    assert.equal(g.cyan.seepOpen, false); assert.equal(g.cyan.bridgeWalkable, false); assert.equal(g.lift.strength, 'weak');
    assert.equal(g.whiteBalked, false); assert.equal(g.completed, false); assert.ok(!g.has('P2_BRIDGE_READY'));
    assert.equal(g.nav[0].findPath({ x: -8, z: 2 }, { x: 8, z: 2 }, g.dog.radius), null, 'nav reset');
  }
});

test('P2_ASCENDED is not required for the transport that earns it', () => {
  const g = new Game();
  assert.ok(!g.has('P2_ASCENDED'));
  g.cyan.openSeep(); g.cyan.toggleDiverter(); run(g, 12, () => g.cyan.bridgeSolid);
  g.cat.setPos({ x: 6, z: 0 }, 0); g.select('cat'); g.tapInteractable('liftBase');
  run(g, 20, () => g.cat.floor === 1 && !g.lift.busy);
  assert.equal(g.cat.floor, 1);
});

test('bridge rect matches the config gap and interactables stand on free ground', () => {
  const g = new Game();
  assert.ok(BRIDGE.rect.x0 < -3 && BRIDGE.rect.x1 > 3);
  for (const def of Object.values(INTERACTABLES)) {
    const r = def.actors.includes('dog') ? g.dog.radius : g.cat.radius;
    if (def.id === 'liftBase' || def.id === 'liftTop') continue;
    assert.ok(g.nav[def.floor].isFree(def.standPoint, r), `${def.id} stand point free for radius ${r}`);
  }
  assert.ok(g.nav[0].isFree(LIFT.boardStand, g.dog.radius));
  assert.ok(g.nav[0].isFree(WHITE.shelter, g.white.radius));
  assert.ok(g.nav[0].isFree(WHITE.balkPoint, g.white.radius));
});

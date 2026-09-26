// Phase 2/3 headless test: one vehicle on flat ground, scripted inputs, logged response.
import * as THREE from 'three';
import { initPhysics, PhysicsWorld, RAPIER, TERRAIN_GROUPS } from '../src/physics/PhysicsWorld';
import { Vehicle } from '../src/vehicle/Vehicle';
import { VEHICLES } from '../src/vehicle/VehicleConfig';
import { stepVehicle, type DriveInput } from '../src/vehicle/VehicleController';

await initPhysics();
const pw = new PhysicsWorld();
const ground = pw.world.createCollider(RAPIER.ColliderDesc.cuboid(2000, 1, 2000).setTranslation(0, -1, 0).setCollisionGroups(TERRAIN_GROUPS));
pw.tag(ground, { kind: 'terrain' });
const v = new Vehicle(0, VEHICLES.cindercrest, pw, new THREE.Vector3(0, 1.2, 0), new THREE.Quaternion());
const resolve = () => 'dirt' as const;
let t = 0;
function run(sec: number, input: DriveInput, label: string, every = 0.5) {
  const steps = Math.round(sec * 60);
  for (let i = 0; i < steps; i++) {
    v.storePrevious(); v.senseGround(resolve); stepVehicle(v, input); v.tickTimers(); pw.step(); v.readState(); t += 1 / 60;
    if ((i + 1) % Math.round(every * 60) === 0) {
      const yaw = Math.atan2(v.fwd.x, v.fwd.z) * 180 / Math.PI;
      console.log(`${label.padEnd(10)} t=${t.toFixed(1)} spd=${v.forwardSpeed.toFixed(1)} slip=${v.slipSpeed.toFixed(1)} y=${v.pos.y.toFixed(2)} yaw=${yaw.toFixed(0)} upY=${v.up.y.toFixed(3)} wheels=${v.groundedWheels} pos=(${v.pos.x.toFixed(0)},${v.pos.z.toFixed(0)})`);
    }
  }
}
run(1, { throttle: 0, brake: 0, steer: 0, nitro: false }, 'settle');
run(6, { throttle: 1, brake: 0, steer: 0, nitro: false }, 'accel');
run(2, { throttle: 0, brake: 1, steer: 0, nitro: false }, 'brake', 0.25);
run(3, { throttle: 0, brake: 1, steer: 0, nitro: false }, 'reverse');
run(1.5, { throttle: 0, brake: 0, steer: 0, nitro: false }, 'coast');
run(3, { throttle: 1, brake: 0, steer: 1, nitro: false }, 'lowTurnR');
run(4, { throttle: 1, brake: 0, steer: 0, nitro: false }, 'accel2');
run(2, { throttle: 1, brake: 0, steer: -1, nitro: false }, 'hiTurnL', 0.25);
run(1.5, { throttle: 1, brake: 0, steer: 0, nitro: false }, 'recover', 0.25);
run(2, { throttle: 1, brake: 0, steer: 0, nitro: true }, 'nitro', 0.25);

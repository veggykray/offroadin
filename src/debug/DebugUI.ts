import * as THREE from 'three';
import type { Simulation } from '../game/Simulation';
import { SURFACES } from '../track/SurfaceManager';

export interface DebugFlags {
  colliders: boolean;
  aiLines: boolean;
  slowMo: boolean;
  freeCam: boolean;
  autopilot: boolean;
}

/**
 * Toggleable developer overlay (` or F3). Shows live physics/race state and has
 * switches for collider view, AI lines/waypoints, slow motion, free camera,
 * reset and restart. Each switch also has a number key while the panel is open.
 */
export class DebugUI {
  visible = false;
  readonly flags: DebugFlags = { colliders: false, aiLines: false, slowMo: false, freeCam: false, autopilot: false };
  /** Render cost of the last frame (ms), set by Game. */
  renderMs = 0;
  private panel: HTMLElement;
  private stats: HTMLElement;
  readonly group = new THREE.Group();
  private colliderGroup = new THREE.Group();
  private aiGroup = new THREE.Group();
  private vehicleBoxes: THREE.LineSegments[] = [];
  private wheelRays: THREE.LineSegments;
  private aiTargets: THREE.Mesh[] = [];
  private fps = 60;
  onReset: () => void = () => {};
  onRestart: () => void = () => {};
  onFlag: (name: keyof DebugFlags) => void = () => {};

  constructor(private sim: Simulation, terrainMesh: THREE.Mesh | undefined) {
    this.panel = document.createElement('div');
    this.panel.className = 'debug-panel';
    this.panel.innerHTML = `
      <div class="dbg-title">DEBUG <small>(\` to close)</small></div>
      <pre class="dbg-stats"></pre>
      <div class="dbg-buttons">
        <button data-k="colliders">1 Colliders</button>
        <button data-k="aiLines">2 AI lines</button>
        <button data-k="slowMo">3 Slow-mo</button>
        <button data-k="freeCam">4 Free cam</button>
        <button data-k="reset">5 Reset car</button>
        <button data-k="restart">6 Restart race</button>
        <button data-k="autopilot">7 Autopilot</button>
      </div>`;
    document.body.appendChild(this.panel);
    this.stats = this.panel.querySelector('.dbg-stats')!;
    this.panel.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k!;
        if (k === 'reset') this.onReset();
        else if (k === 'restart') this.onRestart();
        else this.toggle(k as keyof DebugFlags);
        b.blur();
      }),
    );
    this.setVisible(false);

    // ---- Collider view: terrain wireframe (identical to the heightfield), deck, props, chassis boxes, wheel rays ----
    if (terrainMesh) {
      const wire = new THREE.Mesh(terrainMesh.geometry, new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true, transparent: true, opacity: 0.12 }));
      wire.position.y = 0.03;
      this.colliderGroup.add(wire);
    }
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff00ff });
    for (const d of sim.built.deck) {
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(d.halfWidth * 2, d.thickness, d.halfLength * 2)), lineMat);
      box.position.copy(d.center);
      box.rotation.set(d.pitch, d.yaw, 0, 'YXZ');
      this.colliderGroup.add(box);
    }
    for (const v of sim.vehicles) {
      const he = v.cfg.halfExtents;
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2)), new THREE.LineBasicMaterial({ color: 0xffff00 }));
      this.vehicleBoxes.push(box);
      this.colliderGroup.add(box);
    }
    this.wheelRays = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x00ffff }));
    this.wheelRays.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sim.vehicles.length * 4 * 2 * 3), 3));
    this.wheelRays.frustumCulled = false;
    this.colliderGroup.add(this.wheelRays);
    this.colliderGroup.visible = false;

    // ---- AI lines: racing lines per route, checkpoints, current targets ----
    const colors = { safe: 0x00ff88, shortcut: 0xffaa00 } as const;
    for (const [id, line] of sim.lines) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < line.n; i += 2) {
        const p = line.route.points[i];
        pts.push(new THREE.Vector3(line.x[i], p.y + 0.4, line.z[i]));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.aiGroup.add(new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: colors[id] })));
      // Speed profile ticks.
      const ticks: number[] = [];
      for (let i = 0; i < line.n; i += 6) {
        const p = line.route.points[i];
        const h = Math.min(8, line.speed[i] / 4);
        ticks.push(line.x[i], p.y + 0.4, line.z[i], line.x[i], p.y + 0.4 + h, line.z[i]);
      }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
      this.aiGroup.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: colors[id], transparent: true, opacity: 0.5 })));
    }
    for (const g of sim.track.gates) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), new THREE.MeshBasicMaterial({ color: g.index === 0 ? 0xffffff : 0xff3355 }));
      for (const side of [-1, 1]) {
        const p = post.clone();
        p.position.set(g.x + g.tz * side * (g.halfWidth - 8), g.y + 3, g.z - g.tx * side * (g.halfWidth - 8));
        this.aiGroup.add(p);
      }
    }
    for (let i = 0; i < sim.vehicles.length; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
      this.aiTargets.push(m);
      this.aiGroup.add(m);
    }
    this.aiGroup.visible = false;
    this.group.add(this.colliderGroup, this.aiGroup);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.panel.style.display = v ? '' : 'none';
  }

  toggle(k: keyof DebugFlags): void {
    this.flags[k] = !this.flags[k];
    this.colliderGroup.visible = this.flags.colliders;
    this.aiGroup.visible = this.flags.aiLines;
    this.panel.querySelectorAll('button').forEach((b) => {
      const key = b.dataset.k as keyof DebugFlags;
      if (key in this.flags) b.classList.toggle('on', this.flags[key]);
    });
    this.onFlag(k);
  }

  update(dt: number, alpha: number): void {
    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05;
    const sim = this.sim;
    if (this.colliderGroup.visible) {
      const arr = this.wheelRays.geometry.getAttribute('position') as THREE.BufferAttribute;
      const tmp = new THREE.Vector3();
      let k = 0;
      sim.vehicles.forEach((v, i) => {
        const box = this.vehicleBoxes[i];
        box.position.lerpVectors(v.prevPos, v.pos, alpha);
        box.quaternion.copy(v.quat);
        box.visible = v.respawnTimer <= 0;
        for (const w of v.wheels) {
          v.localToWorld(w.local, tmp);
          arr.setXYZ(k++, tmp.x, tmp.y, tmp.z);
          if (w.hit) arr.setXYZ(k++, w.point.x, w.point.y, w.point.z);
          else {
            tmp.addScaledVector(v.up, -(v.cfg.suspRest + v.cfg.wheelRadius));
            arr.setXYZ(k++, tmp.x, tmp.y, tmp.z);
          }
        }
      });
      arr.needsUpdate = true;
    }
    if (this.aiGroup.visible) {
      sim.ais.forEach((ai, i) => {
        const t = ai.debugTarget;
        this.aiTargets[i].position.set(t.x, sim.track.groundHeight(t.x, t.z) + 1, t.z);
        this.aiTargets[i].visible = i !== sim.playerIndex;
      });
    }
    if (!this.visible) return;
    const pi = sim.playerIndex ?? 0;
    const v = sim.vehicles[pi];
    const r = sim.race.racers[pi];
    const lv = v.body.linvel();
    const av = v.body.angvel();
    const f = (n: number, d = 1) => n.toFixed(d).padStart(6);
    this.stats.textContent = [
      `FPS        ${this.fps.toFixed(0)}   physics+AI ${sim.lastStepMs.toFixed(2)} ms/step   render ${this.renderMs.toFixed(1)} ms`,
      `speed      ${f(v.forwardSpeed * 3.6, 0)} km/h (${v.forwardSpeed.toFixed(1)} m/s)  slip ${v.slipSpeed.toFixed(1)}`,
      `grounded   ${v.groundedWheels}/4 wheels   air ${v.airTime.toFixed(2)}s`,
      `surface    ${SURFACES[v.surface].label}  [${v.wheels.map((w) => (w.hit ? w.surface[0] : '-')).join('')}]`,
      `lap        ${r.lap}/${sim.race.laps}   next gate ${r.nextGate} (${sim.track.gates[r.nextGate].name})`,
      `position   ${r.position}   progress ${r.tracker.progress.toFixed(0)}m  path ${r.tracker.path.def.id} s=${r.tracker.s.toFixed(0)} lat=${r.tracker.lateral.toFixed(1)}`,
      `body pos   ${f(v.pos.x)} ${f(v.pos.y)} ${f(v.pos.z)}`,
      `body vel   ${f(lv.x)} ${f(lv.y)} ${f(lv.z)}`,
      `body angv  ${f(av.x, 2)} ${f(av.y, 2)} ${f(av.z, 2)}`,
      `up.y       ${v.up.y.toFixed(2)}  stagger ${v.staggerTime.toFixed(2)}  ghost ${v.ghostTime.toFixed(1)}`,
      `nitro      ${v.nitroCharges} charges  active ${v.nitroTime.toFixed(2)}s  catch-up x${v.catchUp.toFixed(3)}`,
      `susp comp  ${v.wheels.map((w) => w.compression.toFixed(2)).join(' ')}`,
      `AI routes  ${sim.ais.map((a, i) => (i === sim.playerIndex ? '(you)' : `${a.personality.name[0]}:${a.routeId}`)).join(' ')}`,
      `time scale ${this.flags.slowMo ? '0.25x' : '1x'}`,
    ].join('\n');
  }
}

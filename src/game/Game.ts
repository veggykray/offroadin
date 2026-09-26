import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Simulation, DEFAULT_ROSTER, type SimEvent, type RosterEntry } from './Simulation';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { buildTrackVisuals } from '../track/TrackVisuals';
import { VehicleVisual } from '../vehicle/VehicleVisual';
import { VEHICLES } from '../vehicle/VehicleConfig';
import { RaceCamera } from '../camera/RaceCamera';
import { InputManager } from './InputManager';
import { HUD } from './HUD';
import { Audio } from './Audio';
import { Particles } from '../fx/Particles';
import { DebugUI } from '../debug/DebugUI';
import type { SurfaceId } from '../track/SurfaceManager';

export interface GameOptions {
  playerVehicle?: string;
  playerSlot?: number;
  demo?: boolean;
  reverse?: boolean;
  laps?: number;
  catchUp?: boolean;
}

/** Identification colours for AI racers (player is always cyan). Shared with the minimap. */
export const RACER_COLORS = [0xe74c3c, 0xf1c40f, 0xe67e22, 0xb07cff];

const PARTICLE_COLOR: Partial<Record<SurfaceId, number>> = {
  dirt: 0xd8b98e,
  berm: 0xc49a6c,
  grass: 0x9aa56a,
  rough: 0x9d948a,
  rock: 0x9d948a,
  mud: 0x4a3220,
  water: 0xdff3ff,
};

/**
 * Browser shell around the Simulation: rendering, input, camera, HUD, audio, FX.
 * Physics runs at a fixed 60 Hz; rendering interpolates between steps.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly sim: Simulation;
  readonly raceCam: RaceCamera;
  private visuals: VehicleVisual[] = [];
  private pickupMeshes: THREE.Object3D[] = [];
  private particles = new Particles();
  private input = new InputManager();
  private hud: HUD;
  private audio = new Audio();
  private debug: DebugUI;
  private sun: THREE.DirectionalLight;
  private freeCam: THREE.PerspectiveCamera;
  private orbit: OrbitControls;
  private accumulator = 0;
  private last = performance.now();
  private elapsed = 0;
  private paused = false;
  private lastCountdownBeep = 99;
  private emitAcc: number[] = [];
  /** Exposed for automated tests (Playwright). */
  stats = { frames: 0, steps: 0 };

  static async create(container: HTMLElement, hudRoot: HTMLElement, opts: GameOptions = {}): Promise<Game> {
    const roster: RosterEntry[] = DEFAULT_ROSTER.map((r) => ({ ...r }));
    const slot = Math.max(0, Math.min(roster.length - 1, opts.playerSlot ?? 1));
    if (opts.playerVehicle && VEHICLES[opts.playerVehicle]) {
      // Swap so the chosen vehicle sits in the player's slot.
      const other = roster.findIndex((r) => r.vehicle === opts.playerVehicle);
      if (other >= 0) [roster[other].vehicle, roster[slot].vehicle] = [roster[slot].vehicle, roster[other].vehicle];
    }
    const sim = await Simulation.create({
      playerIndex: opts.demo ? null : slot,
      roster,
      reverse: opts.reverse,
      laps: opts.laps,
      catchUp: opts.catchUp ?? true,
    });
    return new Game(container, hudRoot, sim);
  }

  private constructor(container: HTMLElement, hudRoot: HTMLElement, sim: Simulation) {
    this.sim = sim;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    // ---- Scene: warm prehistoric haze ----
    this.scene.background = new THREE.Color(0xc9d3cf);
    this.scene.fog = new THREE.Fog(0xc9d3cf, 260, 620);
    this.scene.add(new THREE.HemisphereLight(0xdfe9f0, 0x6b5436, 1.35));
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -150; sc.right = 150; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 500;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);

    // ---- Track ----
    const trackGroup = buildTrackVisuals(sim.built);
    this.scene.add(trackGroup);
    const terrainMesh = trackGroup.getObjectByName('terrain') as THREE.Mesh | undefined;

    // ---- Vehicles ----
    sim.vehicles.forEach((v, i) => {
      const isPlayer = i === sim.playerIndex;
      const vis = new VehicleVisual(v.cfg, isPlayer, isPlayer ? 0x3cf0ff : RACER_COLORS[i % RACER_COLORS.length]);
      this.visuals.push(vis);
      this.scene.add(vis.root, vis.ring);
      void vis.loadModel();
      this.emitAcc.push(0);
    });

    // ---- Pickups ----
    const canMat = new THREE.MeshLambertMaterial({ color: 0xff7a18, emissive: 0x802a00 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.8 });
    for (const p of sim.pickups.pickups) {
      const g = new THREE.Group();
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10), canMat);
      can.castShadow = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.6, 10), canMat);
      cap.position.y = 0.95;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.09, 6, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.8;
      g.add(can, cap, ring);
      g.position.copy(p.position);
      this.pickupMeshes.push(g);
      this.scene.add(g);
    }

    this.scene.add(this.particles.group);

    // ---- Cameras ----
    this.raceCam = new RaceCamera(sim.track, window.innerWidth / window.innerHeight);
    this.freeCam = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 2000);
    this.freeCam.position.set(0, 120, 160);
    this.orbit = new OrbitControls(this.freeCam, this.renderer.domElement);
    this.orbit.enabled = false;

    // ---- UI ----
    this.hud = new HUD(hudRoot, sim);
    this.debug = new DebugUI(sim, terrainMesh);
    this.scene.add(this.debug.group);
    this.debug.onReset = () => this.resetPlayer();
    this.debug.onRestart = () => this.restart();
    this.debug.onFlag = (k) => {
      if (k === 'autopilot') this.sim.autopilot = this.debug.flags.autopilot;
      if (k === 'freeCam') {
        this.orbit.enabled = this.debug.flags.freeCam;
        if (this.orbit.enabled) {
          this.freeCam.position.copy(this.raceCam.camera.position);
          this.orbit.target.copy(this.raceCam.focusPoint);
          this.orbit.update();
        }
      }
    };

    window.addEventListener('resize', () => this.onResize());
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    requestAnimationFrame((t) => this.frame(t));
  }

  private onResize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.raceCam.setAspect(w / h);
    this.freeCam.aspect = w / h;
    this.freeCam.updateProjectionMatrix();
  }

  restart(): void {
    this.sim.restart();
    this.particles.clear();
    this.raceCam.snap();
    this.lastCountdownBeep = 99;
    this.hud.flash('', '', 0.01);
  }

  resetPlayer(): void {
    const i = this.sim.playerIndex;
    if (i === null) return;
    const e = this.sim.requestReset(i, 'manual');
    if (e) this.handleEvents([e]);
  }

  // ------------------------------------------------------------------ loop

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1; // tab was hidden etc.
    this.handleKeys();

    const scale = this.debug.flags.slowMo ? 0.25 : 1;
    if (!this.paused) {
      this.accumulator += dt * scale;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 6) {
        this.fixedStep();
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === 6) this.accumulator = 0;
    }
    const alpha = this.accumulator / FIXED_DT;
    this.elapsed += dt;
    this.renderFrame(dt, alpha);
    this.input.endFrame();
    this.stats.frames++;
  }

  private handleKeys(): void {
    const inp = this.input;
    if (inp.consume('KeyR') || inp.padButton(3)) this.resetPlayer();
    if (inp.consume('Enter') || inp.padButton(9)) this.restart();
    if (inp.consume('KeyC')) this.raceCam.toggleMode();
    if (inp.consume('KeyM')) this.audio.toggleMute();
    if (inp.consume('KeyP')) {
      this.paused = !this.paused;
      this.hud.setPaused(this.paused);
    }
    if (this.debug.visible) {
      if (inp.consume('Digit1')) this.debug.toggle('colliders');
      if (inp.consume('Digit2')) this.debug.toggle('aiLines');
      if (inp.consume('Digit3')) this.debug.toggle('slowMo');
      if (inp.consume('Digit4')) this.debug.toggle('freeCam');
      if (inp.consume('Digit5')) this.resetPlayer();
      if (inp.consume('Digit6')) this.restart();
      if (inp.consume('Digit7')) this.debug.toggle('autopilot');
    }
    // Toggle the panel last so switches pressed in the same frame still register.
    if (inp.consume('Backquote') || inp.consume('F3')) this.debug.setVisible(!this.debug.visible);
  }

  private fixedStep(): void {
    const sim = this.sim;
    sim.playerInput = this.input.getDriveInput();
    const events = sim.step(FIXED_DT);
    this.stats.steps++;
    this.handleEvents(events);

    // Countdown beeps.
    if (sim.race.phase === 'countdown') {
      const c = Math.ceil(sim.race.countdown - 0.2);
      if (c !== this.lastCountdownBeep && c >= 1 && c <= 3) this.audio.beep(false);
      this.lastCountdownBeep = c;
    }
  }

  private handleEvents(events: SimEvent[]): void {
    const sim = this.sim;
    const pi = sim.playerIndex;
    for (const e of events) {
      switch (e.type) {
        case 'vehicle': {
          const v = sim.vehicles[e.racer];
          const ev = e.event;
          if (ev.type === 'landing') {
            const n = ev.quality === 'hard' ? 26 : ev.quality === 'rough' ? 14 : 8;
            const col = PARTICLE_COLOR[v.surface] ?? 0xd8b98e;
            this.particles.burst(v.pos.x, v.pos.y - 0.8, v.pos.z, n, ev.quality === 'hard' ? 7 : 4, col, 0.9);
            if (e.racer === pi) {
              this.audio.landing(ev.quality);
              this.raceCam.addShake(ev.quality === 'hard' ? 0.9 : ev.quality === 'rough' ? 0.4 : 0.15);
              if (ev.quality === 'clean' && v.lastLanding) this.hud.flash('CLEAN LANDING', 'good', 1.1);
              if (ev.quality === 'hard') this.hud.flash('HARD LANDING', 'bad', 1.3);
            }
          } else if (ev.type === 'nitro') {
            if (e.racer === pi) {
              this.audio.nitro();
              this.raceCam.addShake(0.25);
            }
          }
          break;
        }
        case 'collision': {
          if (e.a >= 0 && e.b >= 0) {
            this.particles.burst(e.x, e.y, e.z, Math.min(20, 4 + e.strength * 2), 6, 0xffd070, 0.25, true, 0.35);
          }
          if (e.a === pi || e.b === pi) {
            this.audio.impact(e.strength);
            this.raceCam.addShake(Math.min(0.8, e.strength * 0.08));
          }
          break;
        }
        case 'pickup':
          if (e.event.racer === pi) {
            this.audio.pickup();
            this.hud.flash('NITRO +1', 'good', 1.1);
          }
          this.particles.burst(sim.pickups.pickups[e.event.pickup].position.x, sim.pickups.pickups[e.event.pickup].position.y, sim.pickups.pickups[e.event.pickup].position.z, 14, 5, 0xffb040, 0.35, true, 0.5);
          break;
        case 'respawnStart': {
          const inWater = sim.track.waterLevelAt(e.x, e.z) !== null;
          if (inWater) this.particles.burst(e.x, e.y, e.z, 30, 8, 0xdff3ff, 0.8, false, 0.9);
          this.particles.burst(e.x, e.y + 0.5, e.z, 18, 5, 0xffffff, 0.7, true, 0.5);
          if (e.racer === pi) {
            if (e.reason === 'offmap') {
              this.audio.boing();
              this.hud.flash('BOING!', 'bad', 1.4);
            } else if (e.reason === 'fell') {
              if (inWater) this.audio.splash();
              else this.audio.boing();
              this.hud.flash(inWater ? 'SPLASH!' : 'OOPS!', 'bad', 1.2);
            } else {
              this.audio.poof();
            }
          }
          break;
        }
        case 'respawnEnd':
          this.particles.burst(e.x, e.y, e.z, 16, 4, 0xbff6ff, 0.6, true, 0.6);
          if (e.racer === pi) this.audio.poof();
          break;
        case 'race': {
          const ev = e.event;
          if (ev.type === 'go') this.audio.beep(true);
          if (ev.type === 'lap' && ev.racer === pi) {
            this.audio.lap();
            this.hud.flash(ev.lap === sim.race.laps ? 'FINAL LAP!' : `LAP ${ev.lap}`, 'lap', 1.6);
          }
          if (ev.type === 'finish' && ev.racer === pi) this.audio.lap();
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ render

  private renderFrame(dt: number, alpha: number): void {
    const sim = this.sim;
    const time = this.elapsed;
    sim.vehicles.forEach((v, i) => {
      this.visuals[i].update(v, alpha, dt, time);
      this.emitVehicleFx(i, dt);
    });
    sim.pickups.pickups.forEach((p, i) => {
      const m = this.pickupMeshes[i];
      m.visible = p.active;
      m.rotation.y = time * 2;
      m.position.y = p.position.y + Math.sin(time * 3 + i) * 0.25;
    });
    this.particles.update(dt);

    // Camera follows the player (or the leader in demo mode).
    const pi = sim.playerIndex ?? sim.race.racers.find((r) => r.position === 1)!.index;
    const pv = sim.vehicles[pi];
    const pos = new THREE.Vector3().lerpVectors(pv.prevPos, pv.pos, alpha);
    this.raceCam.update(dt, pos, pv.vel, Math.max(0, pv.forwardSpeed) / pv.cfg.topSpeed, pv.nitroActive);

    // Shadow camera follows the view.
    const f = this.raceCam.focusPoint;
    this.sun.position.set(f.x - 120, 115, f.z + 35);
    this.sun.target.position.copy(f);

    // Audio.
    if (sim.playerIndex !== null && sim.race.phase !== 'finished') {
      this.audio.engine(Math.max(0, pv.forwardSpeed) / pv.cfg.topSpeed, sim.playerInput.throttle, pv.nitroActive, !pv.grounded);
    } else this.audio.silenceEngine();

    this.hud.update(dt);
    this.debug.update(dt, alpha);
    const r0 = performance.now();
    if (this.debug.flags.freeCam) {
      this.orbit.update();
      this.renderer.render(this.scene, this.freeCam);
    } else {
      this.renderer.render(this.scene, this.raceCam.camera);
    }
    this.debug.renderMs = performance.now() - r0;
  }

  /** Dust / splash / mud / nitro flame emitters. */
  private emitVehicleFx(i: number, dt: number): void {
    const v = this.sim.vehicles[i];
    if (v.respawnTimer > 0) return;
    const p = this.particles;
    const speed = Math.abs(v.forwardSpeed);
    const slip = Math.abs(v.slipSpeed);
    this.emitAcc[i] += dt * Math.min(40, speed * 1.1 + slip * 4);
    const tmp = new THREE.Vector3();
    while (this.emitAcc[i] >= 1) {
      this.emitAcc[i] -= 1;
      const w = v.wheels[2 + Math.floor(Math.random() * 2)]; // rear wheels
      if (!w.hit || (speed < 4 && slip < 2)) continue;
      const col = PARTICLE_COLOR[w.surface] ?? 0xd8b98e;
      const jitter = () => (Math.random() - 0.5) * 1.5;
      if (w.surface === 'water') {
        p.lit.emit(w.point.x, w.point.y + 0.2, w.point.z, -v.vel.x * 0.2 + jitter() * 2, 3 + Math.random() * 3, -v.vel.z * 0.2 + jitter() * 2, 0.7, 0.55, col, { gravity: 12, drag: 1, grow: 0.5 });
      } else if (w.surface === 'mud') {
        p.lit.emit(w.point.x, w.point.y + 0.2, w.point.z, -v.vel.x * 0.15 + jitter(), 2 + Math.random() * 2.5, -v.vel.z * 0.15 + jitter(), 0.7, 0.35, col, { gravity: 14, drag: 0.5, grow: 0.2 });
      } else if (w.surface === 'rough' || w.surface === 'rock') {
        p.lit.emit(w.point.x, w.point.y + 0.1, w.point.z, jitter() * 2, 2 + Math.random() * 2, jitter() * 2, 0.5, 0.18, col, { gravity: 16, drag: 0.5, grow: 0 });
      } else if (w.surface !== 'wood') {
        p.lit.emit(w.point.x, w.point.y + 0.3, w.point.z, -v.vel.x * 0.1 + jitter(), 0.8 + Math.random(), -v.vel.z * 0.1 + jitter(), 1.1, 0.5, col, { gravity: -0.3, drag: 2, grow: 2.2 });
      }
    }
    if (v.nitroActive) {
      for (let k = 0; k < 3; k++) {
        for (const side of [-0.55, 0.55]) {
          tmp.set(side, 0.4, -2.5);
          v.localToWorld(tmp, tmp);
          const back = v.fwd.clone().multiplyScalar(-8 - Math.random() * 6);
          p.bright.emit(tmp.x, tmp.y, tmp.z, v.vel.x * 0.6 + back.x, v.vel.y * 0.6 + back.y + Math.random(), v.vel.z * 0.6 + back.z, 0.22, 0.45, Math.random() < 0.5 ? 0xffb020 : 0xff5a10, { drag: 3, grow: -0.6 });
        }
      }
    }
  }
}

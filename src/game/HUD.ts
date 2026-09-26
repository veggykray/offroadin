import type { Simulation } from './Simulation';

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const COLORS = ['#e74c3c', '#3cf0ff', '#c8894b', '#b5a36a'];

/** Minimal HTML HUD: position, lap, times, speed, nitro, minimap, messages, results. */
export class HUD {
  private el: HTMLElement;
  private pos: HTMLElement;
  private lap: HTMLElement;
  private time: HTMLElement;
  private speed: HTMLElement;
  private nitro: HTMLElement;
  private center: HTMLElement;
  private message: HTMLElement;
  private results: HTMLElement;
  private help: HTMLElement;
  private mapCanvas: HTMLCanvasElement;
  private mapBg: HTMLCanvasElement;
  private msgTimer = 0;
  private mapXform = { sx: 1, ox: 0, oz: 0 };

  constructor(root: HTMLElement, private sim: Simulation) {
    this.el = root;
    root.innerHTML = `
      <div class="hud-tl">
        <div class="hud-pos"><span id="h-pos">1st</span><small>/ ${sim.vehicles.length}</small></div>
        <div class="hud-lap" id="h-lap">LAP 1/4</div>
        <div class="hud-time" id="h-time">0:00.0</div>
      </div>
      <canvas class="hud-map" id="h-map" width="260" height="200"></canvas>
      <div class="hud-bl">
        <div class="hud-speed"><span id="h-speed">0</span><small>km/h</small></div>
        <div class="hud-nitro" id="h-nitro"></div>
      </div>
      <div class="hud-center" id="h-center"></div>
      <div class="hud-msg" id="h-msg"></div>
      <div class="hud-results" id="h-results"></div>
      <div class="hud-help" id="h-help">
        <b>W/↑</b> accelerate · <b>S/↓</b> brake/reverse · <b>A D/← →</b> steer · <b>Space</b> nitro<br/>
        <b>R</b> reset car · <b>Enter</b> restart · <b>C</b> near/overview camera · <b>M</b> mute · <b>\`</b> debug
      </div>`;
    const q = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
    this.pos = q('h-pos');
    this.lap = q('h-lap');
    this.time = q('h-time');
    this.speed = q('h-speed');
    this.nitro = q('h-nitro');
    this.center = q('h-center');
    this.message = q('h-msg');
    this.results = q('h-results');
    this.help = q('h-help');
    this.mapCanvas = q('h-map') as HTMLCanvasElement;
    this.mapBg = document.createElement('canvas');
    this.mapBg.width = this.mapCanvas.width;
    this.mapBg.height = this.mapCanvas.height;
    this.drawMapBackground();
    setTimeout(() => this.help.classList.add('fade'), 14000);
  }

  private drawMapBackground(): void {
    const t = this.sim.track;
    const b = t.def.bounds;
    const W = this.mapBg.width, H = this.mapBg.height;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of t.paths.values()) for (const s of p.samples) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
    }
    void b;
    const pad = 14;
    const sx = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    this.mapXform = { sx, ox: W / 2 - ((minX + maxX) / 2) * sx, oz: H / 2 - ((minZ + maxZ) / 2) * sx };
    const ctx = this.mapBg.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // River.
    ctx.strokeStyle = 'rgba(60,140,210,0.7)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    t.riverPoints.forEach((r, i) => (i ? ctx.lineTo(...this.m(r.x, r.z)) : ctx.moveTo(...this.m(r.x, r.z))));
    ctx.stroke();
    for (const l of t.def.lakes) {
      ctx.fillStyle = 'rgba(60,140,210,0.7)';
      ctx.beginPath();
      const [cx, cz] = this.m(l.x, l.z);
      ctx.ellipse(cx, cz, l.radiusX * sx, l.radiusZ * sx, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of t.paths.values()) {
      const shortcut = p !== t.main;
      ctx.strokeStyle = 'rgba(20,14,8,0.8)';
      ctx.lineWidth = shortcut ? 5 : 9;
      ctx.beginPath();
      p.samples.forEach((s, i) => (i ? ctx.lineTo(...this.m(s.x, s.z)) : ctx.moveTo(...this.m(s.x, s.z))));
      if (p.closed) ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = shortcut ? '#e8b85c' : '#d9b07a';
      ctx.lineWidth = shortcut ? 2.5 : 6;
      ctx.stroke();
    }
    // Finish line.
    const g = t.gates[0];
    const [fx, fz] = this.m(g.x, g.z);
    ctx.fillStyle = '#fff';
    ctx.fillRect(fx - 1.5, fz - 6, 3, 12);
  }

  private m(x: number, z: number): [number, number] {
    return [this.mapXform.ox + x * this.mapXform.sx, this.mapXform.oz + z * this.mapXform.sx];
  }

  flash(text: string, cls = '', seconds = 1.6): void {
    this.message.textContent = text;
    this.message.className = `hud-msg show ${cls}`;
    this.msgTimer = seconds;
  }

  update(dt: number): void {
    const sim = this.sim;
    const race = sim.race;
    const pi = sim.playerIndex ?? 0;
    const me = race.racers[pi];
    const v = sim.vehicles[pi];

    this.pos.textContent = ORD[me.position - 1];
    this.lap.textContent = `LAP ${Math.min(me.lap, race.laps)}/${race.laps}`;
    const lapT = me.finished ? me.finishTime : race.raceTime;
    this.time.innerHTML = `${fmt(lapT)}${me.bestLap < Infinity ? `<small> best ${fmt(me.bestLap)}</small>` : ''}`;
    this.speed.textContent = String(Math.round(Math.max(0, v.forwardSpeed) * 3.6));
    let n = '';
    for (let i = 0; i < v.cfg.nitroMaxCharges; i++) n += `<span class="flame ${i < v.nitroCharges ? 'on' : ''}"></span>`;
    if (v.nitroActive) n += `<div class="nbar"><div style="width:${(v.nitroTime / v.cfg.nitroDuration) * 100}%"></div></div>`;
    this.nitro.innerHTML = n;

    // Countdown / wrong way.
    if (race.phase === 'countdown') {
      const c = Math.ceil(race.countdown - 0.2);
      this.center.textContent = c > 0 && c <= 3 ? String(c) : c > 3 ? '' : 'GO!';
      this.center.className = 'hud-center show';
    } else if (race.raceTime < 1) {
      this.center.textContent = 'GO!';
      this.center.className = 'hud-center show go';
    } else if (me.wrongWayTime > 1.2) {
      this.center.textContent = 'WRONG WAY';
      this.center.className = 'hud-center show warn';
    } else {
      this.center.className = 'hud-center';
    }

    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) this.message.className = 'hud-msg';
    }

    // Results.
    if (me.finished || race.phase === 'finished') {
      const rows = [...race.racers].sort((a, b) => a.position - b.position).map((r) => {
        const t = r.finished ? fmt(r.finishTime) : '—';
        const best = r.bestLap < Infinity ? fmt(r.bestLap) : '—';
        return `<tr class="${r.isPlayer ? 'me' : ''}"><td>${ORD[r.position - 1]}</td><td>${r.name}</td><td>${t}</td><td>${best}</td></tr>`;
      });
      this.results.innerHTML = `<h2>${me.finished ? `You finished ${ORD[me.position - 1]}!` : 'Race over'}</h2>
        <table><tr><th></th><th>Racer</th><th>Time</th><th>Best lap</th></tr>${rows.join('')}</table>
        <p>Press <b>Enter</b> to race again</p>`;
      this.results.className = 'hud-results show';
    } else {
      this.results.className = 'hud-results';
    }
    this.drawMap();
  }

  private drawMap(): void {
    const ctx = this.mapCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    ctx.drawImage(this.mapBg, 0, 0);
    const sim = this.sim;
    for (const p of sim.pickups.pickups) {
      if (!p.active) continue;
      const [x, z] = this.m(p.position.x, p.position.z);
      ctx.fillStyle = '#ff8a1e';
      ctx.fillRect(x - 2, z - 2, 4, 4);
    }
    sim.vehicles.forEach((v, i) => {
      if (v.respawnTimer > 0) return;
      const [x, z] = this.m(v.pos.x, v.pos.z);
      const me = i === sim.playerIndex;
      ctx.fillStyle = me ? '#3cf0ff' : COLORS[i % COLORS.length];
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, z, me ? 5 : 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  show(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
  }
}

export function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

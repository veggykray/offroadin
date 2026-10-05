/* ALIEN STRIKE — mission script: objectives and triggers.
 * Objectives and triggers are pure data in levels/*.js. Objective progress is
 * derived from world state and events; triggers are condition → action lists, so
 * missions can make objectives affect each other (destroy the comm relay → no
 * more reinforcements, free the engineer → the bunker opens, etc.). */
'use strict';
(function (AS) {
  const U = AS.U;

  class Script {
    constructor(g, mission) {
      this.g = g;
      this.flags = {}; this.timers = {};
      this.count = { delivered: {}, deliveredTotal: 0, cargo: {}, scanned: {}, interacted: {}, killed: {}, arrived: {}, convoyLost: {}, lostSurvivors: {} };
      this.objs = (mission.objectives || []).map((o) => this.makeObj(o));
      this.triggers = (mission.triggers || []).map((t, i) => Object.assign({ fired: false, i }, t));
      this.primaryDone = false;
      this.enteredZones = {};
    }
    makeObj(o) {
      const ob = Object.assign({ cat: 'primary', state: 'active', progress: 0, required: 1, t: 0, revealed: true }, o);
      if (o.cat === 'hidden') { ob.revealed = false; }
      if (o.locked) ob.state = 'locked';
      if (o.targets && o.required === undefined) ob.required = o.targets.length;
      if (o.items && o.required === undefined) ob.required = o.items.length;
      if (o.type === 'defend' || o.type === 'survive') ob.required = o.duration;
      return ob;
    }
    obj(id) { return this.objs.find((o) => o.id === id); }
    visibleObjectives() { return this.objs.filter((o) => o.state !== 'locked' && (o.revealed || o.state === 'done')); }
    hiddenCount() { return this.objs.filter((o) => o.cat === 'hidden' && !o.revealed && o.state !== 'done').length; }

    text(o) {
      let t = o.text || o.id;
      if (o.required > 1 && o.type !== 'defend' && o.type !== 'survive') t += ' (' + Math.min(o.progress, o.required) + '/' + o.required + ')';
      if ((o.type === 'defend' || o.type === 'survive') && o.state === 'active' && o.running) t += ' — ' + U.fmtTime(Math.max(0, o.required - o.progress));
      return t;
    }

    /* ---------- events ---------- */
    onEvent(name, a, b) {
      const c = this.count;
      this.flags['ev_' + name] = true;
      switch (name) {
        case 'delivered':
          if (a.kind === 'person') { c.delivered[a.group] = (c.delivered[a.group] || 0) + 1; c.deliveredTotal++; }
          else if (a.kind === 'cargo') { c.cargo[a.id] = b || 'pad'; }
          break;
        case 'scanned': if (a.id) c.scanned[a.id] = 1; break;
        case 'interacted': if (a.id) c.interacted[a.id] = 1; this.onInteracted(a); break;
        case 'killed': case 'destroyed': if (a.id) c.killed[a.id] = 1; break;
        case 'convoyArrived': if (a.convoy) c.arrived[a.convoy] = (c.arrived[a.convoy] || 0) + 1; break;
        case 'convoyLost': if (a.convoy) c.convoyLost[a.convoy] = (c.convoyLost[a.convoy] || 0) + 1; break;
        case 'survivorLost': c.lostSurvivors[a.group.id] = (c.lostSurvivors[a.group.id] || 0) + 1; break;
      }
      this.evaluate();
    }
    onInteracted(ent) {
      // ordered interaction objectives unlock their next console
      for (const o of this.objs) {
        if (o.type !== 'interact' || !o.ordered || o.state !== 'active') continue;
        const idx = o.targets.indexOf(ent.id);
        if (idx >= 0 && idx + 1 < o.targets.length) { const n = this.g.byId.get(o.targets[idx + 1]); if (n) { n.locked = false; this.g.msg('NEXT: ' + (n.label || '').toUpperCase(), '#7fe8ff'); } }
      }
    }

    /* ---------- objective progress ---------- */
    measure(o) {
      const g = this.g, c = this.count;
      switch (o.type) {
        case 'destroy': case 'kill': case 'boss': {
          let n = 0;
          for (const id of o.targets) { const e = g.byId.get(id); if (!e || !e.alive || c.killed[id]) n++; }
          return n;
        }
        case 'rescue': { let n = 0; for (const gid of o.groups) n += c.delivered[gid] || 0; return n; }
        case 'collect': case 'deliver': { let n = 0; for (const id of o.items) { const v = c.cargo[id]; if (v && (!o.to || v === o.to || (o.to === 'pad' && v !== undefined))) n++; } return n; }
        case 'scan': { let n = 0; for (const id of o.targets) if (c.scanned[id]) n++; return n; }
        case 'interact': { let n = 0; for (const id of o.targets) if (c.interacted[id]) n++; return n; }
        case 'escort': return c.arrived[o.convoy] || 0;
        case 'intercept': { let n = 0; for (const u of g.convoyUnits(o.convoy)) if (!u.alive) n++; return n; }
        case 'reach': case 'discover': return this.enteredZones[o.zone] ? 1 : 0;
        case 'flag': return this.flags[o.flag] ? 1 : 0;
        case 'defend': case 'survive': return o.progress;
        default: return 0;
      }
    }
    failed(o) {
      const g = this.g, c = this.count;
      if (o.type === 'rescue') {
        let possible = 0;
        for (const gid of o.groups) { const gr = g.groupById(gid); if (gr) possible += gr.people.filter((p) => p.alive).length; }
        // survivors aboard still count as possible
        return possible < o.required;
      }
      if (o.type === 'defend' && o.target) { const t = g.byId.get(o.target); return !t || !t.alive; }
      if (o.type === 'escort') { const lost = c.convoyLost[o.convoy] || 0; return g.convoySize(o.convoy) - lost < o.required; }
      if (o.type === 'intercept') { return (c.arrived[o.convoy] || 0) > (o.allowArrive || 0); }
      if (o.protect) { for (const id of o.protect) { const e = g.byId.get(id); if (!e || !e.alive) return true; } }
      return false;
    }
    evaluate() {
      const g = this.g;
      for (const o of this.objs) {
        if (o.state !== 'active') continue;
        if (o.type !== 'defend' && o.type !== 'survive') o.progress = this.measure(o);
        if (this.failed(o)) { this.setFailed(o); continue; }
        if (o.progress >= o.required) this.setDone(o);
      }
      if (!this.primaryDone) {
        const prim = this.objs.filter((o) => o.cat === 'primary');
        if (prim.length && prim.every((o) => o.state === 'done')) { this.primaryDone = true; g.onPrimariesDone(); }
      }
    }
    setDone(o, silent) {
      if (o.state === 'done') return;
      o.state = 'done'; o.revealed = true;
      const g = this.g;
      if (!silent) {
        const hidden = o.cat === 'hidden';
        g.msg((hidden ? 'HIDDEN OBJECTIVE: ' : o.cat === 'secondary' ? 'OPTIONAL OBJECTIVE COMPLETE: ' : 'OBJECTIVE COMPLETE: ') + (o.short || o.text).toUpperCase(), hidden ? '#ffd36b' : '#7dff9a', 3.5);
        AS.Audio.sfx('objective');
        g.say(o.doneLine || (o.type === 'destroy' || o.type === 'kill' ? 'objective_destroyed' : 'objective_complete'));
      }
      if (o.reward) g.stats.bonusSalvage += o.reward;
      if (o.onComplete) this.run(o.onComplete);
      g.emit('objectiveComplete', o);
    }
    setFailed(o) {
      if (o.state === 'failed' || o.state === 'done') return;
      o.state = 'failed';
      const g = this.g;
      g.msg('OBJECTIVE FAILED: ' + (o.short || o.text).toUpperCase(), '#ff5a3a', 4);
      AS.Audio.sfx('fail_cue');
      if (o.onFail) this.run(o.onFail);
      if (o.cat === 'primary') g.fail('Primary objective failed: ' + (o.short || o.text), 3.5);
    }
    activate(id) {
      const o = this.obj(id); if (!o) return;
      if (o.state === 'locked') { o.state = 'active'; o.revealed = true; this.g.msg('NEW OBJECTIVE: ' + (o.short || o.text).toUpperCase(), '#7fe8ff', 3.5); this.g.say('objective_updated'); AS.Audio.sfx('objective_new'); }
      else if (!o.revealed) { o.revealed = true; this.g.msg('HIDDEN OBJECTIVE REVEALED: ' + (o.short || o.text).toUpperCase(), '#ffd36b', 3.5); AS.Audio.sfx('objective_new'); }
    }

    /* ---------- per-frame ---------- */
    update(dt) {
      const g = this.g, pl = g.player;
      for (const k in this.timers) { this.timers[k] -= dt; }
      // zones entered
      if (pl && pl.alive) for (const [id, z] of g.zones) {
        if (!this.enteredZones[id] && U.dist(pl.x, pl.y, z.x, z.y) < z.r) { this.enteredZones[id] = true; g.emit('enter', z); }
      }
      // timed objectives
      for (const o of this.objs) {
        if (o.state !== 'active') continue;
        if (o.type === 'defend' || o.type === 'survive') {
          if (!o.running && (!o.startOn || this.cond(o.startOn))) { o.running = true; if (o.startLine) g.say(o.startLine); }
          if (o.running) o.progress += dt;
        }
      }
      for (const t of this.triggers) {
        if (t.fired && t.once !== false) continue;
        if (t.cool > 0) { t.cool -= dt; continue; }
        if (this.cond(t.when)) {
          t.fired = true;
          if (t.once === false) t.cool = t.every || 5;
          if (t.delay) g.later(t.delay, () => this.run(t.do)); else this.run(t.do);
        }
      }
      this.evaluate();
    }

    cond(c) {
      if (!c) return true;
      const g = this.g, k = this.count;
      if (c.all) return c.all.every((x) => this.cond(x));
      if (c.any) return c.any.some((x) => this.cond(x));
      if (c.not) return !this.cond(c.not);
      if (c.objective) { const o = this.obj(c.objective); return o && o.state === 'done'; }
      if (c.objectiveActive) { const o = this.obj(c.objectiveActive); return o && o.state === 'active'; }
      if (c.objectiveFailed) { const o = this.obj(c.objectiveFailed); return o && o.state === 'failed'; }
      if (c.destroyed || c.killed) { const id = c.destroyed || c.killed; const e = g.byId.get(id); return (!e && !!k.killed[id]) || (e && !e.alive) || !!k.killed[id]; }
      if (c.event) return !!this.flags['ev_' + c.event];
      if (c.destroyedAll) return c.destroyedAll.every((id) => { const e = g.byId.get(id); return !e || !e.alive; });
      if (c.destroyedAny) return c.destroyedAny.some((id) => { const e = g.byId.get(id); return !e || !e.alive; });
      if (c.enter) return !!this.enteredZones[c.enter];
      if (c.near) { const p = g.player; return p && p.alive && U.dist(p.x, p.y, c.near.x, c.near.y) < c.near.r; }
      if (c.interacted) return !!k.interacted[c.interacted];
      if (c.scanned) return !!k.scanned[c.scanned];
      if (c.pickup) return !!g.pickedIds[c.pickup];
      if (c.cargoPicked) return !!g.cargoPicked[c.cargoPicked];
      if (c.delivered) return !!k.cargo[c.delivered];
      if (c.rescued !== undefined) return k.deliveredTotal >= c.rescued;
      if (c.groupRescued) return (k.delivered[c.groupRescued] || 0) > 0;
      if (c.boarded) return g.boardedGroups[c.boarded];
      if (c.time !== undefined) return g.time >= c.time;
      if (c.alert) return g.alertedOnce;
      if (c.flag) return !!this.flags[c.flag];
      if (c.timer) return this.timers[c.timer] !== undefined && this.timers[c.timer] <= 0;
      if (c.primariesDone) return this.primaryDone;
      if (c.convoyArrived) return (k.arrived[c.convoyArrived] || 0) >= (c.n || 1);
      if (c.bossHp) { const b = g.byId.get(c.bossHp.id); return !b || !b.alive || b.hp / b.maxHp <= c.bossHp.below; }
      if (c.killedGroup) return g.units.filter((u) => u.group === c.killedGroup && u.alive).length === 0 && g.groupSpawned[c.killedGroup];
      if (c.seen) { const e = g.byId.get(c.seen); return e && e.seen; }
      return false;
    }

    run(actions) {
      const g = this.g;
      for (const a of actions || []) {
        if (a.say) g.say(a.say);
        if (a.msg) g.msg(a.msg, a.col || '#7fe8ff', a.dur || 3.5);
        if (a.activate) [].concat(a.activate).forEach((id) => this.activate(id));
        if (a.reveal) [].concat(a.reveal).forEach((id) => this.activate(id));
        if (a.complete) [].concat(a.complete).forEach((id) => { const o = this.obj(id); if (o) this.setDone(o); });
        if (a.fail) [].concat(a.fail).forEach((id) => { const o = this.obj(id); if (o) this.setFailed(o); });
        if (a.flag) this.flags[a.flag] = true;
        if (a.unflag) delete this.flags[a.unflag];
        if (a.timer) this.timers[a.timer.id] = a.timer.t;
        if (a.spawn) { g.spawnSpecs(a.spawn); }
        if (a.unlock) [].concat(a.unlock).forEach((id) => { const e = g.byId.get(id); if (e) { e.locked = false; if (e.role === 'bunker') g.msg((e.label || 'BUNKER').toUpperCase() + ' OPEN', '#7dff9a'); } });
        if (a.unpower) [].concat(a.unpower).forEach((id) => { const e = g.byId.get(id); if (e) { e.powered = false; e.poweredBy = ['__none']; } });
        if (a.destroy) [].concat(a.destroy).forEach((id) => { const e = g.byId.get(id); if (e && e.alive) { e.invuln = false; e.takeDamage(1e6, 'ap', null); } });
        if (a.markMap) g.addMarker(a.markMap);
        if (a.revealArea) g.revealArea(a.revealArea.x, a.revealArea.y, a.revealArea.r);
        if (a.extraction) { g.extraction.x = a.extraction.x; g.extraction.y = a.extraction.y; }
        if (a.reinforce !== undefined) g.reinforce.enabled = a.reinforce;
        if (a.music) g.musicOverride = a.music === 'none' ? null : a.music;
        if (a.boss) { const b = g.byId.get(a.boss); if (b && b.bossAct) b.bossAct(a.act, a); }
        if (a.convoy) g.convoyState[a.convoy] = a.act !== 'stop';
        if (a.shake) g.camera.shake(a.shake);
        if (a.zoom) g.camera.pulseZoom(a.zoom, a.zoomDur || 1.5);
        if (a.flash) g.camera.flash(a.flash, a.flashCol);
        if (a.pickup) g.spawnPickup(a.pickup.k, a.pickup.x, a.pickup.y, { id: a.pickup.id });
        if (a.wave) g.spawnWave(a.wave);
        if (a.alertAll) for (const u of g.units) if (u.team === 'enemy') { u.alerted = true; u.alertT = 20; u.alwaysActive = true; }
        if (a.give) { if (a.give.salvage) g.stats.bonusSalvage += a.give.salvage; if (a.give.tech) g.stats.tech += a.give.tech; }
        if (a.weather) g.hazards && g.hazards.force(a.weather);
        if (a.hazard) g.hazards && g.hazards.set(a.hazard);
        if (a.power) [].concat(a.power).forEach((id) => { const e = g.byId.get(id); if (e) { e.poweredBy = []; e.powered = true; } });
        if (a.reveal_structs) [].concat(a.reveal_structs).forEach((id) => { const e = g.byId.get(id); if (e) e.hidden = false; });
        if (a.call) g.customCall(a.call, a);
        if (a.padOn) { const e = g.byId.get(a.padOn); if (e && e.def) { e.def = Object.assign({}, e.def, { repair: true, refuel: true, rearm: true, dropoff: true }); e.pad = Object.assign(e.pad || {}, { repair: true, refuel: true, rearm: true }); g.msg('FORWARD PAD ONLINE — REPAIR · REFUEL · REARM', '#7dff9a', 4); } }
        if (a.set) { const e = g.byId.get(a.set.id); if (e) Object.assign(e, a.set.props); }
        if (a.cargo) { const c = g.spawnSpec(Object.assign({ t: 'cargo' }, a.cargo)); if (c && a.cargo.at) { const e = g.byId.get(a.cargo.at); if (e) { c.x = e.x; c.y = e.y; } } }
        if (a.known) [].concat(a.known).forEach((id) => { const e = g.byId.get(id); if (e) { e.known = true; e.seen = true; } });
      }
    }
  }
  AS.Script = Script;
})(window.AS);

/* ALIEN STRIKE — level registry and composition helpers.
 * Missions are plain data objects registered with AS.Levels.add(). Helpers in AS.L
 * build common compositions (outposts, patrols, supply caches) so new missions can
 * be added through data alone. */
'use strict';
(function (AS) {
  const Levels = {
    list: [], byId: {},
    add(m) {
      m.map = m.map || { w: 6000, h: 6000 };
      m.map.zones = m.map.zones || [];
      // flatten ground under structures so bases sit on level terrain
      const flat = (e) => {
        if (e.t !== 'struct' || e.noFlat) return;
        const d = AS.Data.structures[e.k];
        if (!d) return;
        m.map.zones.push({ x: e.x, y: e.y, r: d.r * 1.5 + 24, h: e.h !== undefined ? e.h : null });
      };
      (m.entities || []).forEach(flat);
      m.map.zones.push({ x: m.extraction.x, y: m.extraction.y, r: 130 });
      m.map.zones.push({ x: m.start.x, y: m.start.y, r: 90 });
      // mission-specific voice lines + briefing narration
      if (m.lines) for (const id in m.lines) { const L = m.lines[id]; AS.Data.voice[id] = Object.assign({ s: 'command', p: 3, cd: 2 }, typeof L === 'string' ? { t: L } : L); }
      if (m.briefing && m.briefing.narration) AS.Data.voice['brief_' + m.id] = { t: m.briefing.narration, s: 'command', p: 4, cd: 0, name: 'HALCYON ACTUAL — BRIEFING' };
      this.list.push(m); this.byId[m.id] = m;
    },
    ordered() { return this.list.filter((m) => m.id !== 'test').sort((a, b) => a.world - b.world || a.index - b.index); },
    worldMissions(w) { return this.ordered().filter((m) => m.world === w); },
  };
  if (AS.Levels && AS.Levels.list) for (const m of AS.Levels.list) Levels.add(m);
  AS.Levels = Levels;

  /* ---------------- composition helpers ---------------- */
  const L = {
    /* Enemy outpost: power node feeding turrets, optional radar / comms / shield gen / garrison */
    outpost(id, x, y, o) {
      o = o || {};
      const out = [];
      const n = o.turrets || 3, R = o.radius || 120;
      const powered = o.power !== false;
      if (powered) out.push({ t: 'struct', k: o.powerKind || 'power', id: id + '_pw', x: x + (o.powerAt ? o.powerAt[0] : 0), y: y + (o.powerAt ? o.powerAt[1] : 0) });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (o.rot || 0.4);
        out.push({ t: 'struct', k: o.turret || 'turret', id: id + '_t' + i, x: Math.round(x + Math.cos(a) * R), y: Math.round(y + Math.sin(a) * R * 0.85), poweredBy: powered ? [id + '_pw'] : [], shieldedBy: o.shield ? [id + '_sg'] : [] });
      }
      if (o.shield) out.push({ t: 'struct', k: 'shieldgen', id: id + '_sg', x: x + (o.shieldAt ? o.shieldAt[0] : -R * 0.5), y: y + (o.shieldAt ? o.shieldAt[1] : R * 0.45), poweredBy: powered ? [id + '_pw'] : [] });
      if (o.radar) out.push({ t: 'struct', k: 'radar', id: id + '_radar', x: x + R * 0.6, y: y - R * 0.5, poweredBy: powered ? [id + '_pw'] : [] });
      if (o.comms) out.push({ t: 'struct', k: 'comms', id: id + '_comms', x: x - R * 0.6, y: y - R * 0.55 });
      if (o.sam) for (let i = 0; i < o.sam; i++) out.push({ t: 'struct', k: 'sam', id: id + '_sam' + i, x: x + (i ? -1 : 1) * R * 0.3, y: y + R * 0.2, poweredBy: powered ? [id + '_pw'] : [] });
      if (o.garrison) for (const gq of o.garrison) out.push({ t: 'unit', k: gq[0], n: gq[1] || 1, x: x + (gq[2] || 0), y: y + (gq[3] || 0), spread: 60, leash: 500 });
      if (o.spawner) out.push({ t: 'struct', k: o.spawner, id: id + '_sp', x: x + (o.spawnerAt ? o.spawnerAt[0] : 0), y: y + (o.spawnerAt ? o.spawnerAt[1] : -R * 0.3), poweredBy: powered && o.spawner !== 'nest' && o.spawner !== 'hive' ? [id + '_pw'] : [] });
      if (o.props !== false) out.push({ t: 'prop', k: o.prop || 'crate', x, y: y + R * 0.3, n: 4, spread: R * 0.6 });
      if (o.supplies) for (const s of o.supplies) out.push({ t: 'pickup', k: s, x: x + (Math.random() - 0.5) * R * 0.5, y: y + (Math.random() - 0.5) * R * 0.5 });
      return out;
    },
    /* Friendly forward operating base pad (repair / refuel / rearm / drop-off) */
    fob(id, x, y, o) {
      o = o || {};
      return [{ t: 'struct', k: 'pad', id, x, y, pad: { repair: o.repair !== false, refuel: o.refuel !== false, rearm: o.rearm !== false, dropoff: true } }, { t: 'prop', k: 'container', x: x + 60, y: y - 20 }, { t: 'prop', k: 'lamp', x: x - 54, y: y + 30 }, { t: 'prop', k: 'lamp', x: x + 54, y: y + 30 }];
    },
    /* A supply cache: a few pickups near a landmark */
    cache(x, y, kinds, o) {
      o = o || {};
      return kinds.map((k, i) => ({ t: 'pickup', k, x: x + Math.cos(i * 2.1) * 22, y: y + Math.sin(i * 2.1) * 18, hidden: o.hidden, id: o.id ? o.id + '_' + i : undefined }));
    },
    /* Standard scatter fill: fuel, supplies, scenery, obstacles and roaming units.
     * units: [[kind, groups, [minSize, maxSize], { burrowed, water }]] */
    fill(seed, o) {
      o = o || {};
      const out = [];
      const area = o.area || [300, 300, (o.w || 6000) - 300, (o.h || 6000) - 300];
      out.push({ t: 'scatter', what: 'pickup', k: 'fuel', n: o.fuel || 10, area, seed: seed + 1 });
      out.push({ t: 'scatter', what: 'pickup', ks: o.supplies || ['ammo', 'missiles', 'salvage', 'repair', 'shield', 'salvage', 'special'], n: o.misc || 13, area, seed: seed + 2 });
      if (o.obstacles !== 0) out.push({ t: 'scatter', what: 'obstacle', n: o.obstacles || 26, h: o.oh || [60, 120], seed: seed + 3 });
      if (o.props !== 0) out.push({ t: 'scatter', what: 'prop', n: o.props || 32, cluster: 2, seed: seed + 4 });
      (o.units || []).forEach((u, i) => out.push(Object.assign({ t: 'scatter', what: 'unit', k: u[0], n: u[1], size: u[2] || [1, 1], area, seed: seed + 10 + i }, u[3] || {})));
      return out;
    },
    patrol(k, n, pts, o) { return [Object.assign({ t: 'unit', k, n, x: pts[0][0], y: pts[0][1], spread: 40, patrol: pts }, o || {})]; },
    ring(k, n, x, y, r, o) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push(Object.assign({ t: 'struct', k, x: Math.round(x + Math.cos(a) * r), y: Math.round(y + Math.sin(a) * r * 0.85) }, o || {})); } return out; },
  };
  AS.L = L;
})(window.AS);

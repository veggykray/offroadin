'use strict';
(function (AS) {
  AS.Levels = AS.Levels || { list: [], byId: {}, add(m) { this.list.push(m); this.byId[m.id] = m; } };
  AS.Levels.add({
    id: 'test', world: 1, index: 1, name: 'TEST RANGE', region: 'Test',
    map: { w: 3000, h: 3000, seed: 5, zones: [{ x: 1500, y: 2600, r: 200 }] },
    start: { x: 1500, y: 2550, angle: -Math.PI / 2 },
    extraction: { x: 1500, y: 2700, r: 70 },
    briefing: { situation: 'test', threats: [], intel: [], danger: 1 },
    entities: [
      { t: 'unit', k: 'skitter', x: 1300, y: 2000, n: 5, spread: 60 },
      { t: 'unit', k: 'shardback', x: 1700, y: 1900 },
      { t: 'unit', k: 'sentry', x: 1500, y: 1800, n: 2 },
      { t: 'struct', k: 'turret', x: 1900, y: 2100, id: 't1', poweredBy: ['pw'] },
      { t: 'struct', k: 'power', x: 2100, y: 1900, id: 'pw' },
      { t: 'struct', k: 'radar', x: 1000, y: 1800, id: 'rad' },
      { t: 'struct', k: 'pad', x: 1250, y: 2450, id: 'fob', pad: { repair: true, refuel: true, rearm: true, dropoff: true } },
      { t: 'survivors', id: 'crew', x: 1100, y: 2200, n: 3 },
      { t: 'cargo', k: 'blackbox', id: 'bb', x: 1800, y: 2350 },
      { t: 'pickup', k: 'fuel', x: 1550, y: 2350 }, { t: 'pickup', k: 'ammo', x: 1600, y: 2350 }, { t: 'pickup', k: 'repair', x: 1650, y: 2350 },
      { t: 'scatter', what: 'obstacle', n: 12 }, { t: 'scatter', what: 'prop', n: 30, cluster: 2 },
    ],
    objectives: [
      { id: 'o1', type: 'destroy', targets: ['t1'], text: 'Destroy the turret' },
      { id: 'o2', type: 'rescue', groups: ['crew'], required: 3, text: 'Rescue the crew' },
      { id: 'o3', type: 'collect', items: ['bb'], text: 'Recover the black box', cat: 'secondary' },
    ],
    triggers: [],
  });
})(window.AS);

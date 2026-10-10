/* WYRMCROWN — GROUND ARMIES: the Tunnel Test scenario.
 * A separate, self-contained test ground (3 584 × 1 920 units, 64-unit cells).
 * It is NOT part of the campaign map and changes nothing outside armies/.
 *
 *   west       Oakhollow, a friendly settlement, and the army's muster field
 *   middle     the Greyteeth, a mountain barrier from the northern plain down to
 *              the sea; nothing walks over it
 *              · Deepdelve, a ground-only TUNNEL straight through it (T)
 *              · a troll CAVE in its western face, with defenders (C)
 *              · the Old Mine, a second tunnel, collapsed (O, blocked)
 *   east       a river (deep water) crossed by the Fortress Bridge (K), the North
 *              Bridge (N) and a ford in the south; Blackspire, a hostile fortress on
 *              a hill; Millbrook, a friendly village by the north road
 *   routes     short: through Deepdelve · long: the north road round the range and
 *              over the North Bridge · east of the range: the ford, or either bridge
 *   south      the sea
 *
 * Legend (armies/core/ground.js KINDS): . plain  = road  f forest  h hills
 * M mountains  ~ deep water  , ford  S settlement  F fortress; letters below are
 * passages (each takes its passage's terrain kind). */
'use strict';
(function (AS) {
  const CELL = 64;
  const ROWS = [
    '..........................................~~............',
    '..........................................~~............',
    '..........................................~~............',
    '......====================================NN=====.......',
    '......=..ffffff...........................~~....=.......',
    '......=..ffffff............MMMM...........~~....=.......',
    '......=..ffffff..........hMMMMMMM.........~~....=.......',
    '......=..ffffff.........hMMMMMMMh.........~~....=.......',
    '......=.................hMMMCCMM..fffff...~~....=.......',
    '......=..................hCCCCMM..fffff...~~....=.......',
    '......=...................MMCMMMMhfffff...~~....=.......',
    '......=.................hMMMMMMMMhfffff...~~.hhh=hh.....',
    '......=.................hMMMMMMM..........~~.hhhhhh.....',
    '.....SSS..................MMMMMM..........~~.hFFFhh.....',
    '.....SSS==================TTTTTT==========KK==FFFhh.....',
    '.....SSS..................MMMMMM..........~~.hFFFhh.....',
    '..........................MMMMMMMh........~~.hhhhhh.....',
    '........................hMMMMMMM..........~~.hhhhhh.....',
    '.......................hhMMMMMMM..........~~............',
    '................ffffff...MMMMMMM..........~~............',
    '................ffffff...hMMMMMMMh........~~.....fffff..',
    '................ffffff...OOOOOOOO.........~~.....fffff..',
    '................ffffff....MMMMMM..........,,.....fffff..',
    '................ffffff...MMMMMMM..........~~.....fffff..',
    '~~~~~~~~~~................MMMMMMM.........~~............',
    '~~~~~~~~~~................MMMMMM....~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ];
  const at = (i, j) => ({ x: (i + 0.5) * CELL, y: (j + 0.5) * CELL });
  const P = (i, j, extra) => Object.assign(at(i, j), extra);
  const Tunnel = {
    id: 'tunnel',
    name: 'The Tunnel Test',
    CELL, ROWS,
    passages: [
      { id: 'deepdelve', ch: 'T', kind: 'tunnel', name: 'Deepdelve Tunnel' },
      { id: 'trollcave', ch: 'C', kind: 'cave', name: 'Troll Cave', location: 'troll_cave' },
      { id: 'oldmine', ch: 'O', kind: 'tunnel', name: 'Old Mine', blocked: true },
      { id: 'northbridge', ch: 'N', kind: 'bridge', name: 'North Bridge', groundOnly: false },
      { id: 'fortbridge', ch: 'K', kind: 'bridge', name: 'Fortress Bridge', groundOnly: false },
    ],
    locations: [
      P(6, 14, { id: 'oakhollow', name: 'Oakhollow', kind: 'settlement', owner: 'human', r: 150, fort: 1.2, terrain: 'town', garrison: [{ troop: 'h_soldier', count: 8 }] }),
      P(36, 4, { id: 'millbrook', name: 'Millbrook', kind: 'village', owner: 'human', r: 120, fort: 1.05, garrison: [] }),
      P(47, 14, { id: 'blackspire', name: 'Blackspire', kind: 'fortress', owner: 'undead', r: 170, fort: 2, breach: 6, terrain: 'fort',
        garrison: [{ troop: 'u_skeleton', count: 24 }, { troop: 'u_ghoul', count: 3 }] }),
      // the cave's defenders are listed by battle role, as the realm lists wild guardians
      P(28, 9, { id: 'troll_cave', name: 'Troll Cave', kind: 'cave', owner: 'wild', r: 80, fort: 1, groundOnly: true, noRetreat: true, terrain: 'cave',
        garrison: [{ troop: 'troll', count: 1 }, { troop: 'bandit', count: 6 }] }),
    ],
    // named points for orders and tests
    points: {
      muster: at(9, 14), tunnelWest: at(25, 14), tunnelEast: at(32, 14), caveMouth: at(25, 9),
      northRoad: at(20, 3), eastBank: at(44, 18), fordEast: at(45, 22), peak: at(28, 16), sea: at(20, 28), behindMine: at(34, 21), southField: at(12, 22),
    },
    army: { id: 'host', side: 'human', name: 'Host of Oakhollow',
      stacks: [{ troop: 'h_soldier', count: 24 }, { troop: 'h_archer', count: 14 }, { troop: 'h_knight', count: 5 }, { troop: 'h_siege', count: 2 }] },
    hostile: (a, b) => a !== b,
    // build the ground and a simulation for this scenario (o: { seed, tick, onTactical, ... })
    create(o) {
      o = o || {};
      const A = AS.Armies;
      const ground = A.Ground.GroundMap.fromAscii(ROWS, { cell: CELL, passages: this.passages });
      const sim = new A.Sim.ArmySim(Object.assign({ ground, locations: this.locations, seed: 20261010, hostile: this.hostile }, o));
      const host = sim.addArmy(Object.assign({}, this.army, at(9, 14), { stacks: this.army.stacks.map((s) => Object.assign({}, s)) }));
      sim.setDragon({ side: 'human', x: host.x, y: host.y - 200 });
      return { ground, sim, host, points: this.points };
    },
  };
  AS.Armies.Scenarios.tunnel = Tunnel;
})(window.AS);

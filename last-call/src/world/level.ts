import { Mat, Terrain } from './terrain';

/**
 * The single authored greybox level: tavern courtyard -> market terraces -> broken stone
 * crossing (with a lower riverbed route through an arch) -> east field -> stone destination
 * platform. World is 100 x 56.25 units (exactly 16:9) so the default camera frames it all.
 * y is UP (0 = bedrock). Coordinates are multiples of 0.25 (one terrain cell).
 */
export const LEVEL_W = 100;
export const LEVEL_H = 56.25;

export interface Spawn { kind: string; x: number; y: number }
export interface LevelData {
  terrain: Terrain;
  heroes: Spawn[];
  enemies: Spawn[];
  barrels: { x: number; y: number }[];
  goal: { x0: number; y0: number; x1: number; y1: number };
  labels: { x: number; y: number; text: string }[];
  /** Named regions for tests / debugging. */
  regions: Record<string, { x0: number; y0: number; x1: number; y1: number }>;
}

export function buildLevel(): LevelData {
  const t = new Terrain(LEVEL_W, LEVEL_H, 0.25);
  const S = Mat.Stable, D = Mat.Soil, T = Mat.Timber;
  const r = (x0: number, y0: number, x1: number, y1: number, m: number) => t.fillRect(x0, y0, x1, y1, m);

  // Bedrock floor (riverbed level) and world walls.
  r(0, 0, LEVEL_W, 2, S);
  r(0, 0, 1.5, 26, S);          // ruined bell tower / west boundary
  r(0, 26, 5, 27, S);           // tower top (visual: the bell hangs here)
  r(99.5, 0, LEVEL_W, 30, S);   // east boundary wall

  // Tavern: stone floor at y=10 under a cantilevered stone roof; the torn wall is a soil rubble lip.
  r(1.5, 2, 12, 10, S);
  r(0, 17, 10, 18, S);          // roof slab
  r(10.5, 10, 12, 11, D);       // torn wall rubble (1 unit, steppable)

  // Courtyard (player start). Stable base with a soil cap, timber cover, a floating ruin ledge.
  r(12, 2, 26, 8, S);
  r(12, 8, 26, 10, D);
  r(20, 10, 22, 12, T);         // timber cover (2 tall: humans hop over, the giant must break it)
  r(22, 10, 23.5, 14, T);       // tall timber stack flush with the cover (route to P1: cover -> stack -> ledge)
  r(26.5, 16, 30.5, 16.75, S);  // ledge P1 (sniper perch): jump from the stack top. Giant and walker pass beneath.

  // Steps down to the market (soil over stone): 10 -> 9 -> 8 -> 7
  r(26, 2, 30, 6, S);
  r(26, 6, 27.5, 9, D); r(27.5, 6, 29, 8, D); r(29, 6, 30, 7, D);

  // Market terrace 1 (ground y=7, stone paving): crate + timber stall + powder barrel at the terrace-2 wall.
  r(30, 2, 40, 7, S);
  r(31, 7, 34, 8.5, T);         // crate (1.5 tall), flush with the stall: hop crate -> stall roof -> terrace 2
  r(34, 7, 38.5, 10, T);        // market stall (3 tall) - roof is a route up

  // Terrace 2 (ground y=11). Hidden stone steps under the soil wall: blow the barrel to expose them.
  r(40, 2, 42, 8.5, S);         // hidden step
  r(42, 2, 60, 10, S);          // terrace core / west bank
  r(40, 8.5, 42, 11, D);        // soil wall above the hidden step
  r(42, 10, 56, 11, D);         // soil cap
  r(43, 11, 45, 13, T);         // timber barricade (route to P2)
  r(45.5, 15, 49, 15.75, S);    // ledge P2
  r(50, 11, 52, 13.5, T);       // timber cover near the bridgehead

  // Broken stone crossing: a ruined stone arch seen from the side. The deck is stone, the broken
  // middle is patched with timber planks. The arch opening below is the dry riverbed (lower route,
  // y=2) running east to the stairs. The arch itself is drawn, not collidable.
  r(56, 10, 60, 12, S);         // bridgehead step (deck top y=12)
  r(60, 11, 64, 12, S);         // west deck
  r(64, 11, 67.5, 12, T);       // planks (destructible gap, 3.5 wide)
  r(67.5, 11, 80, 12, S);       // east deck (arch crown)
  r(66, 2, 68, 3, D);           // rubble in the riverbed

  // East side: stairs out of the riverbed, soil field, step to the stone destination platform.
  r(80, 2, 82, 3.5, S);         // stairs out of the riverbed (1.5 steps: everyone can climb)
  r(82, 2, 84, 5, S);
  r(84, 2, 99.5, 5, S);
  r(84, 5, 91, 6, D);           // field soil (ground y=6)
  r(91, 2, 93, 7.5, S);         // step
  r(93, 2, 99.5, 9, S);         // destination platform (ground y=9)
  r(83, 12.5, 86.5, 13, S);     // balcony P3 (jump from the deck end over the stairs)
  r(96, 15, 99.5, 15.75, S);    // archer perch (shoot-only)

  return {
    terrain: t,
    heroes: [
      { kind: 'beast', x: 4.5, y: 10 },
      { kind: 'giant', x: 7.5, y: 10 },
      { kind: 'inventor', x: 14, y: 10 },
      { kind: 'spear', x: 17, y: 10 },
      { kind: 'duelist', x: 19, y: 10 },
    ],
    enemies: [
      { kind: 'raider', x: 47.5, y: 11 },
      { kind: 'raider', x: 87.5, y: 6 },
      { kind: 'archer', x: 97.75, y: 15.75 },
    ],
    barrels: [{ x: 39, y: 7 }],
    goal: { x0: 93, y0: 9, x1: 99.5, y1: 14 },
    labels: [
      { x: 6, y: 19.5, text: 'TAVERN' },
      { x: 16, y: 18.5, text: 'COURTYARD' },
      { x: 36, y: 13.5, text: 'MARKET' },
      { x: 66, y: 14, text: 'BROKEN CROSSING' },
      { x: 70, y: 4.5, text: 'RIVERBED (lower route)' },
      { x: 96, y: 11, text: 'GOAL' },
    ],
    regions: {
      planks: { x0: 64, y0: 11, x1: 67.5, y1: 12 },
      soilWall: { x0: 40, y0: 8.5, x1: 42, y1: 11 },
      riverbed: { x0: 60, y0: 2, x1: 74, y1: 11 },
      stairs: { x0: 80, y0: 2, x1: 84, y1: 6 },
    },
  };
}

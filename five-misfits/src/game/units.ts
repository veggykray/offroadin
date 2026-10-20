import { makeBody, type Body } from '../world/physics';

export type Team = 'hero' | 'enemy';
export type HeroKind = 'beast' | 'giant' | 'inventor' | 'spear' | 'duelist';
export type EnemyKind = 'raider' | 'archer';
export type UnitKind = HeroKind | EnemyKind;

export interface UnitDef {
  kind: UnitKind;
  name: string;
  title: string;
  team: Team;
  w: number; h: number; hp: number;
  moveBudget: number;
  walkSpeed: number;
  /** 0 = cannot jump (the six-legged walker steps instead). */
  jumpHeight: number;
  stepUp: number;
  footSpan: number;
  color: string;
  basic: string;
  signature: string;
  /** Movement notes shown in the HUD. */
  moveNote: string;
}

export const HERO_ORDER: HeroKind[] = ['beast', 'giant', 'inventor', 'spear', 'duelist'];

export const UNIT_DEFS: Record<UnitKind, UnitDef> = {
  beast: {
    kind: 'beast', name: 'Orrin', title: 'Beast Master', team: 'hero',
    w: 1.1, h: 3.0, hp: 80, moveBudget: 12, walkSpeed: 6, jumpHeight: 2.8, stepUp: 1.0, footSpan: 0,
    color: '#6f8f3a', basic: 'hatchet', signature: 'jackal', moveNote: 'Jumps. The jackal heels and needs a real path.',
  },
  giant: {
    kind: 'giant', name: 'Brennagh', title: 'Giant Woman', team: 'hero',
    w: 2.2, h: 5.5, hp: 140, moveBudget: 9, walkSpeed: 5, jumpHeight: 1.8, stepUp: 1.2, footSpan: 0,
    color: '#b8742c', basic: 'strike', signature: 'charge', moveNote: 'Low jump (1.5 ledges). Charge breaks timber.',
  },
  inventor: {
    kind: 'inventor', name: 'Pim', title: 'Fake Wizard / Inventor', team: 'hero',
    w: 2.4, h: 3.4, hp: 70, moveBudget: 8, walkSpeed: 3.5, jumpHeight: 0, stepUp: 2.0, footSpan: 3.2,
    color: '#7c5cc4', basic: 'gadget', signature: 'cannon', moveNote: 'Six-legged walker: no jump, climbs 2-unit ledges, steps over gaps under 3 units.',
  },
  spear: {
    kind: 'spear', name: 'Vesk', title: 'Bat-eared Spearman', team: 'hero',
    w: 0.9, h: 3.3, hp: 80, moveBudget: 13, walkSpeed: 6.5, jumpHeight: 2.8, stepUp: 1.0, footSpan: 0,
    color: '#3f8fa8', basic: 'sling', signature: 'spearThrow', moveNote: 'Jumps. One spear: throw, then walk over it to pick it up.',
  },
  duelist: {
    kind: 'duelist', name: 'Castellan', title: 'Handsome Duelist', team: 'hero',
    w: 1.0, h: 3.0, hp: 90, moveBudget: 14, walkSpeed: 7, jumpHeight: 2.8, stepUp: 1.0, footSpan: 0,
    color: '#c43f6a', basic: 'pistol', signature: 'showoff', moveNote: 'Fast. Jumps.',
  },
  raider: {
    kind: 'raider', name: 'Raider', title: 'Ground Raider', team: 'enemy',
    w: 1.1, h: 3.0, hp: 50, moveBudget: 9, walkSpeed: 5, jumpHeight: 3.2, stepUp: 1.0, footSpan: 0,
    color: '#a83232', basic: 'melee', signature: '', moveNote: 'Closes in and strikes.',
  },
  archer: {
    kind: 'archer', name: 'Archer', title: 'Elevated Ranged Raider', team: 'enemy',
    w: 1.0, h: 3.0, hp: 40, moveBudget: 0, walkSpeed: 0, jumpHeight: 0, stepUp: 1.0, footSpan: 0,
    color: '#8c2f6e', basic: 'arrow', signature: '', moveNote: 'Holds the perch and shoots.',
  },
};

export interface Unit {
  id: number;
  kind: UnitKind;
  def: UnitDef;
  team: Team;
  body: Body;
  hp: number;
  maxHp: number;
  alive: boolean;
  facing: 1 | -1;
  moveLeft: number;
  moved: boolean;
  acted: boolean;
  /** Visual-only animation state. */
  anim: { walkPhase: number; hitFlash: number; swing: number; lastX: number };
  /** Enemy: last decided intent (for telegraphing / explainability). */
  intent: string;
}

let nextId = 1;
export function resetIds(): void { nextId = 1; }

export function makeUnit(kind: UnitKind, x: number, y: number): Unit {
  const def = UNIT_DEFS[kind];
  return {
    id: nextId++, kind, def, team: def.team,
    body: makeBody(x, y, def.w, def.h, def.stepUp, def.footSpan),
    hp: def.hp, maxHp: def.hp, alive: true, facing: def.team === 'hero' ? 1 : -1,
    moveLeft: def.moveBudget, moved: false, acted: false,
    anim: { walkPhase: 0, hitFlash: 0, swing: 0, lastX: x },
    intent: '',
  };
}

export const unitCenter = (u: Unit) => ({ x: u.body.x, y: u.body.y + u.body.h / 2 });

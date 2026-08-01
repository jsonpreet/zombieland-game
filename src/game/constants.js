export const WORLD = 8000
export const CENTER = WORLD / 2
export const CORE = 1000
export const CORE_END = WORLD - CORE

export const ZONES = {
  residential: { name: 'RESIDENTIAL', x: CORE, y: CORE, w: 3000, h: 3000 },
  factory: { name: 'FACTORY', x: CORE + 3000, y: CORE, w: 3000, h: 3000 },
  railway: { name: 'RAILWAY', x: CORE, y: CORE + 3000, w: 3000, h: 3000 },
  airport: { name: 'AIRPORT', x: CORE + 3000, y: CORE + 3000, w: 3000, h: 3000 }
}

export const AVENUE_X = [2000, 6000]
export const AVENUE_Y = [2000, 6000]
export const ROAD_W = 100
export const RES_STREETS = [1500, 2500, 3500]

export const PLAYER = {
  SPEED: 250,
  SPRINT: 1.45,
  R: 15
}

export const MELEE = {
  DMG: 30,
  RANGE: 80,
  ARC: 2.1,
  CD: 0.55,
  KB: 300
}

export const TURRET = {
  DMG: 8,
  ROF: 2.4,
  RANGE: 340,
  HP: 60,
  AMMO: 30,
  BSPEED: 760
}

export const NIGHT = {
  BASE: 0.28,
  MAX: 0.4,
  LIGHT: 560
}

export const DOOR = 60
export const DOOR_HP = 120
export const DOOR_HIT = 10
export const INFESTED_CHANCE = 0.3

export const ITEMS = {
  can: { name: 'CAN', heal: 15 },
  ration: { name: 'RATION', heal: 30 },
  medkit: { name: 'MEDKIT', heal: 50 },
  stim: { name: 'STIM', heal: 12, speed: 5 }
}

export const ITEM_ORDER = ['can', 'ration', 'medkit', 'stim']

export const LOOT = {
  crate: [
    ['scrap', 40, 4, 8],
    ['can', 25],
    ['ammo', 25],
    ['empty', 10]
  ],
  cabinet: [
    ['ration', 28],
    ['medkit', 15],
    ['stim', 22],
    ['ammo', 25],
    ['empty', 10]
  ],
  fridge: [
    ['can', 55],
    ['ration', 20],
    ['empty', 25]
  ],
  trunk: [
    ['weapon', 22],
    ['ammo', 30],
    ['medkit', 20],
    ['scrap', 28, 5, 9]
  ],
  plane: [
    ['weapon', 25],
    ['medkit', 25],
    ['ammo', 30],
    ['scrap', 20, 6, 10]
  ],
  crate_rare: [
    ['weapon', 18],
    ['scrap', 30, 6, 10],
    ['can', 15],
    ['ammo', 25],
    ['empty', 12]
  ],
  cabinet_rare: [
    ['weapon', 20],
    ['medkit', 30],
    ['ration', 18],
    ['stim', 20],
    ['ammo', 22]
  ],
  fridge_rare: [
    ['ration', 35],
    ['can', 35],
    ['medkit', 15],
    ['empty', 15]
  ]
}

export const MODULES = [
  { id: 'dmg', name: 'DAMAGE', desc: '+15% weapon damage', base: 25, step: 15, max: 5 },
  { id: 'rof', name: 'FIRE RATE', desc: '+10% fire rate', base: 25, step: 15, max: 5 },
  { id: 'hp', name: 'ENDURANCE', desc: '+25 max health', base: 20, step: 10, max: 5 },
  { id: 'spd', name: 'MOTION', desc: '+6% move speed', base: 20, step: 15, max: 4 },
  { id: 'reload', name: 'RELOAD', desc: '-12% reload time', base: 25, step: 15, max: 3 }
]

export const CRAFTS = [
  { id: 'smg', name: 'SMG', desc: 'Full-auto 9mm, 30 round mag', cost: 35 },
  { id: 'shotgun', name: 'SHOTGUN', desc: '6 pellets, close range', cost: 50 },
  { id: 'rifle', name: 'RIFLE', desc: 'Piercing rounds, long range', cost: 70 },
  { id: 'lmg', name: 'LMG', desc: 'Full-auto heavy 7.62, 60 round mag', cost: 90 },
  { id: 'ammo', name: 'AMMO PACK', desc: 'Refills current weapon reserve', cost: 8 },
  { id: 'medkit', name: 'MEDKIT', desc: 'Adds a medkit to your inventory', cost: 14 },
  { id: 'turret', name: 'SENTRY TURRET', desc: 'Auto-fires at zombies. Press T to place', cost: 30 }
]

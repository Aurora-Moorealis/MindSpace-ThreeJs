/**
 * Economy and simulation constants.
 *
 * The Godot design stores these rows in `economy.tres`. Here they are plain
 * data so designers can edit one file without touching the simulation. Units:
 * resource bars are 0-100 "outpost units" (normalised from NASA per-crew-day
 * rates), energy is in kWh-equivalents per game hour, time is in ticks
 * (1 tick = 1 game hour = 60 real seconds at x1).
 */

export const ECONOMY = {
  id: 'economy',
  version: 1,

  time: {
    realSecondsPerTick: 60,
    missionTicks: 300,
    solTicks: 24,
    firstHour: 8,
    dayStartHour: 6,
    dayEndHour: 18,
    speeds: [1, 5, 10],
    defaultSpeed: 1,
  },

  resources: {
    o2: {
      id: 'o2',
      nameKey: 'resource.o2',
      capacity: 100,
      start: 82,
      crewPerTick: 1.1,
      warning: 30,
      critical: 12,
      source: 'bvad',
      scaleNote:
        'Derived from the 0.84 kg O2 per crew member per day reference rate, scaled into 0-100 outpost units.',
    },
    water: {
      id: 'water',
      nameKey: 'resource.water',
      capacity: 100,
      start: 74,
      crewPerTick: 0.75,
      warning: 30,
      critical: 12,
      source: 'bvad',
      scaleNote:
        'Drinking and food-preparation water from the 2.0 kg per crew member per day reference rate, scaled into 0-100 outpost units.',
    },
    food: {
      id: 'food',
      nameKey: 'resource.food',
      capacity: 100,
      start: 68,
      crewPerTick: 0.55,
      warning: 30,
      critical: 12,
      source: 'bvad',
      scaleNote:
        'Food solids from the 0.62 kg per crew member per day reference rate, scaled into 0-100 outpost units.',
    },
    energy: {
      id: 'energy',
      nameKey: 'resource.energy',
      capacity: 100,
      start: 58,
      crewPerTick: 0,
      warning: 30,
      critical: 12,
      source: 'ogs',
      scaleNote:
        'Outpost power bus, in kWh-equivalent per game hour. Solar and load values are normalised from ISS ECLSS power references.',
    },
  },

  // Nutrition and hydration are the short-term meters, separate from pantry stock.
  satiety: {
    start: 88,
    drainPerTick: 0.9,
    mealThreshold: 22,
    mealRestore: 30,
    mealCost: { food: 4, water: 4 },
    damagePerTick: 1.1,
    regenPerTick: 0.2,
    regenAbove: 60,
    regenHealthCap: 100,
  },

  radiation: {
    start: 2,
    outsidePerTick: 0.45,
    insideStormPerTick: 0.08,
    shelterPerTick: 0.02,
    safeDose: 30,
    maxHealthPenaltyPerPoint: 1.35,
    damageAbove: 70,
    damagePerTick: 0.45,
    deathDose: 100,
    suitMk2Factor: 0.55,
    lowSuitExtra: 0.8,
    lowSuitBelow: 65,
    cleanPanelDose: 1.1,
    scanDose: 0.4,
    shelterUpgradeFactor: 0.5,
    shelterBaseShield: 0.7,
    source: 'crater',
    scaleNote:
      'A 300-hour mission is mapped onto a 0-100 dose budget. The 30-point threshold references the 30-day radiation limit concept; 100 is a game-over abstraction, not a clinical value.',
  },

  suit: {
    start: 100,
    evaDecayPerTick: 0.35,
    actionDecay: 0.7,
    repairCost: 8,
    repairTicks: 1,
    repairAmount: 60,
  },

  emergencyO2: {
    ticks: 6,
    healthDamagePerTick: 1.4,
  },

  repair: {
    energyCost: 4,
    ticks: 2,
    conditionRestore: 60,
    maxCondition: 100,
  },

  upgrade: {
    defaultTicks: 2,
    energyScale: 1,
  },

  condition: {
    // Output multiplier at a given condition: 1.0 at 100, 0.5 at 0.
    outputFloor: 0.5,
  },

  supply: {
    cost: 14,
    delayTicks: 2,
    cooldownTicks: 24,
    give: { o2: 6, water: 8, food: 8 },
    source: 'gameplay',
  },

  power: {
    lightsPower: 0.9,
    lightsOnlyAtNight: true,
    ladder: ['lights', 'hydroponics', 'water_recycler', 'o2_system'],
    shedOrderLabel: 'Lights → Hydroponics → Water recycler → O2 system',
    commsBackup: true,
  },

  // Grade thresholds for the evaluation screen. Score = reports + submissions
  // + resource health + radiation discipline. Purely cosmetic.
  grading: [
    { grade: 'S', min: 92 },
    { grade: 'A', min: 80 },
    { grade: 'B', min: 66 },
    { grade: 'C', min: 50 },
    { grade: 'D', min: 0 },
  ],
};

export const DAY_NAMES = ['Sol'];

export function getHourOfDay(tick) {
  return (tick + ECONOMY.time.firstHour) % ECONOMY.time.solTicks;
}

export function getSol(tick) {
  return Math.floor(tick / ECONOMY.time.solTicks) + 1;
}

export function getClockLabel(tick) {
  const totalMinutes = Math.floor(Math.max(0, tick) * 60 + 1e-6);
  const hour = (Math.floor(totalMinutes / 60) + ECONOMY.time.firstHour) % ECONOMY.time.solTicks;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isDaylight(tick) {
  const hour = getHourOfDay(tick);
  return hour >= ECONOMY.time.dayStartHour && hour < ECONOMY.time.dayEndHour;
}

export function formatMissionTime(tick) {
  return `Sol ${getSol(tick)} · ${getClockLabel(tick)}`;
}

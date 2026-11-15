/**
 * Machine definitions.
 *
 * Coordinates are world-space metres on the outpost floor (y = 0). Machines are
 * data rows: the simulation reads power/inputs/outputs/upgrades from here and
 * the 3D layer only builds meshes from the same rows.
 *
 * `real_data` is intentionally false for reliability and tuning numbers; the
 * sourceRefs point to NASA documents that anchor the physical rates. The UI
 * renders the SIMULATED badge next to those values.
 */

const UPGRADE = (id, nameKey, descriptionKey, effect, cost, ticks = 2) => ({
  id,
  nameKey,
  descriptionKey,
  effect,
  cost,
  ticks,
});

export const MACHINES = {
  o2_system: {
    id: 'o2_system',
    nameKey: 'machine.o2_system.name',
    shortKey: 'machine.o2_system.short',
    roomKey: 'room.workshop',
    descriptionKey: 'machine.o2_system.desc',
    hintKey: 'hint.o2_system',
    position: [10, 0, 11.5],
    rotationY: -Math.PI / 2,
    kind: 'production',
    power: 2.2,
    inputs: { water: 0.55 },
    outputs: { o2: 1.25 },
    throttle: { resource: 'o2', above: 97 },
    conditionDecay: 0.18,
    dustAffected: false,
    sourceRefs: ['ogs', 'bvad'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'o2_efficiency',
        'upgrade.o2_efficiency.name',
        'upgrade.o2_efficiency.desc',
        { stat: 'o2_output', mult: 1.25 },
        14
      ),
      UPGRADE(
        'o2_water_loop',
        'upgrade.o2_water_loop.name',
        'upgrade.o2_water_loop.desc',
        { stat: 'water_input', mult: 0.75 },
        12
      ),
    ],
  },

  water_recycler: {
    id: 'water_recycler',
    nameKey: 'machine.water_recycler.name',
    shortKey: 'machine.water_recycler.short',
    roomKey: 'room.workshop',
    descriptionKey: 'machine.water_recycler.desc',
    hintKey: 'hint.water_recycler',
    position: [24, 0, 12.5],
    rotationY: -Math.PI / 2,
    kind: 'production',
    power: 1.7,
    inputs: {},
    outputs: { water: 1.55 },
    throttle: { resource: 'water', above: 97 },
    conditionDecay: 0.2,
    dustAffected: false,
    sourceRefs: ['bvad', 'eclss'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'water_recovery',
        'upgrade.water_recovery.name',
        'upgrade.water_recovery.desc',
        { stat: 'water_output', mult: 1.2 },
        14
      ),
      UPGRADE(
        'water_power',
        'upgrade.water_power.name',
        'upgrade.water_power.desc',
        { stat: 'power_draw', mult: 0.8 },
        12
      ),
    ],
  },

  hydroponics: {
    id: 'hydroponics',
    nameKey: 'machine.hydroponics.name',
    shortKey: 'machine.hydroponics.short',
    roomKey: 'room.greenhouse',
    descriptionKey: 'machine.hydroponics.desc',
    hintKey: 'hint.hydroponics',
    position: [-4, 0, -10],
    rotationY: 0,
    kind: 'production',
    power: 2.6,
    inputs: { water: 0.2 },
    outputs: { food: 0.95, o2: 0.35 },
    throttle: { resource: 'food', above: 97 },
    conditionDecay: 0.16,
    dustAffected: false,
    sourceRefs: ['bvad'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'hydro_yield',
        'upgrade.hydro_yield.name',
        'upgrade.hydro_yield.desc',
        { stat: 'food_output', mult: 1.25 },
        14
      ),
      UPGRADE(
        'hydro_led',
        'upgrade.hydro_led.name',
        'upgrade.hydro_led.desc',
        { stat: 'hydro_power', mult: 0.8 },
        12
      ),
    ],
  },

  solar_array: {
    id: 'solar_array',
    nameKey: 'machine.solar_array.name',
    shortKey: 'machine.solar_array.short',
    roomKey: 'room.exterior',
    descriptionKey: 'machine.solar_array.desc',
    hintKey: 'hint.solar_array',
    position: [13, 0, 25],
    rotationY: Math.PI / 2,
    kind: 'solar',
    power: 0,
    inputs: {},
    outputs: { energy: 11.5 },
    dayOnly: true,
    conditionDecay: 0.05,
    dustAffected: true,
    sourceRefs: ['ogs'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'solar_tracking',
        'upgrade.solar_tracking.name',
        'upgrade.solar_tracking.desc',
        { stat: 'solar_output', mult: 1.2 },
        16
      ),
      UPGRADE(
        'solar_coating',
        'upgrade.solar_coating.name',
        'upgrade.solar_coating.desc',
        { stat: 'dust_rate', mult: 0.55 },
        14
      ),
    ],
  },

  battery: {
    id: 'battery',
    nameKey: 'machine.battery.name',
    shortKey: 'machine.battery.short',
    roomKey: 'room.energy',
    descriptionKey: 'machine.battery.desc',
    hintKey: 'hint.battery',
    position: [22, 0, -12],
    rotationY: 0,
    kind: 'storage',
    power: 0,
    inputs: {},
    outputs: {},
    conditionDecay: 0.04,
    dustAffected: false,
    sourceRefs: ['ogs'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'battery_cells',
        'upgrade.battery_cells.name',
        'upgrade.battery_cells.desc',
        { stat: 'battery_capacity', add: 50 },
        16
      ),
      UPGRADE(
        'battery_reserve',
        'upgrade.battery_reserve.name',
        'upgrade.battery_reserve.desc',
        { stat: 'battery_capacity', add: 30 },
        12
      ),
    ],
  },

  power_distributor: {
    id: 'power_distributor',
    nameKey: 'machine.power_distributor.name',
    shortKey: 'machine.power_distributor.short',
    roomKey: 'room.energy',
    descriptionKey: 'machine.power_distributor.desc',
    hintKey: 'hint.power_distributor',
    position: [9, 0, -12],
    rotationY: 0,
    kind: 'distributor',
    power: 0,
    inputs: {},
    outputs: {},
    conditionDecay: 0.06,
    dustAffected: false,
    sourceRefs: ['gameplay'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'dist_efficiency',
        'upgrade.dist_efficiency.name',
        'upgrade.dist_efficiency.desc',
        { stat: 'power_draw', mult: 0.9 },
        14
      ),
      UPGRADE(
        'dist_cooling',
        'upgrade.dist_cooling.name',
        'upgrade.dist_cooling.desc',
        { stat: 'machine_wear', mult: 0.8 },
        12
      ),
    ],
  },

  repair_bench: {
    id: 'repair_bench',
    nameKey: 'machine.repair_bench.name',
    shortKey: 'machine.repair_bench.short',
    roomKey: 'room.workshop',
    descriptionKey: 'machine.repair_bench.desc',
    hintKey: 'hint.repair_bench',
    position: [20, 0, 6.5],
    rotationY: Math.PI,
    kind: 'bench',
    power: 0,
    inputs: {},
    outputs: {},
    conditionDecay: 0.04,
    dustAffected: false,
    sourceRefs: ['gameplay'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'bench_repair_speed',
        'upgrade.bench_repair_speed.name',
        'upgrade.bench_repair_speed.desc',
        { stat: 'repair_time', mult: 0.5 },
        12
      ),
      UPGRADE(
        'suit_servo',
        'upgrade.suit_servo.name',
        'upgrade.suit_servo.desc',
        { stat: 'movement_speed', mult: 1.15 },
        12
      ),
      UPGRADE(
        'suit_mk2',
        'upgrade.suit_mk2.name',
        'upgrade.suit_mk2.desc',
        { stat: 'suit_shield', mult: 0.55 },
        16
      ),
    ],
  },

  comms_console: {
    id: 'comms_console',
    nameKey: 'machine.comms_console.name',
    shortKey: 'machine.comms_console.short',
    roomKey: 'room.comms',
    descriptionKey: 'machine.comms_console.desc',
    hintKey: 'hint.comms_console',
    position: [-24, 0, 10],
    rotationY: 0,
    kind: 'comms',
    power: 0,
    inputs: {},
    outputs: {},
    conditionDecay: 0.03,
    dustAffected: false,
    sourceRefs: ['gameplay'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'comms_forecast',
        'upgrade.comms_forecast.name',
        'upgrade.comms_forecast.desc',
        { stat: 'forecast_depth', add: 2 },
        12
      ),
      UPGRADE(
        'comms_analysis',
        'upgrade.comms_analysis.name',
        'upgrade.comms_analysis.desc',
        { stat: 'submission_reward', mult: 1.5 },
        14
      ),
    ],
  },

  storm_shelter: {
    id: 'storm_shelter',
    nameKey: 'machine.storm_shelter.name',
    shortKey: 'machine.storm_shelter.short',
    roomKey: 'room.dormitory',
    descriptionKey: 'machine.storm_shelter.desc',
    hintKey: 'hint.storm_shelter',
    position: [-26, 0, -12],
    rotationY: 0,
    kind: 'shelter',
    power: 0,
    inputs: {},
    outputs: {},
    conditionDecay: 0.02,
    dustAffected: false,
    sourceRefs: ['crater'],
    real_data: false,
    upgrades: [
      UPGRADE(
        'shelter_shield',
        'upgrade.shelter_shield.name',
        'upgrade.shelter_shield.desc',
        { stat: 'shelter_shield', mult: 0.5 },
        14
      ),
      UPGRADE(
        'shelter_base',
        'upgrade.shelter_base.name',
        'upgrade.shelter_base.desc',
        { stat: 'shelter_base', mult: 0.7 },
        16
      ),
    ],
  },
};

/** Decorative interactive station that opens the mission checklist anywhere. */
export const MISSION_BOARD = {
  id: 'mission_board',
  nameKey: 'station.mission_board.name',
  shortKey: 'station.mission_board.short',
  roomKey: 'room.hub',
  descriptionKey: 'station.mission_board.desc',
  hintKey: 'hint.mission_board',
  position: [-4.5, 0, 4.5],
  rotationY: Math.PI,
  kind: 'info',
  sourceRefs: ['mission'],
  real_data: false,
  upgrades: [],
};

export const MACHINE_LIST = Object.values(MACHINES);

export const PRODUCTION_MACHINES = MACHINE_LIST.filter((m) =>
  ['production', 'solar'].includes(m.kind)
);

export const UPGRADE_BY_ID = Object.fromEntries(
  MACHINE_LIST.flatMap((machine) => machine.upgrades.map((u) => [`${machine.id}:${u.id}`, u]))
);

export function getMachine(id) {
  return MACHINES[id] ?? MISSION_BOARD;
}

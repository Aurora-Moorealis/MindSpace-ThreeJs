/**
 * GameSim — deterministic tick-based simulation core.
 *
 * One tick is one game hour. At x1 a tick takes 60 real seconds; speed
 * multipliers change the tick rate, never the browser's time scale. The
 * simulation is pure data + fixed rules: no Math.random, no DOM, no Three.js.
 * That makes it testable in Node and lets captured demo presets replay exactly.
 *
 * Tick pipeline (fixed order):
 *   1. Fire scheduled events that start this hour.
 *   2. Apply radiation dose from the crew's current zone.
 *   3. Machine wear and solar-panel dust.
 *   4. Power routing, load shedding, production.
 *   5. Crew consumption, meals, suit wear.
 *   6. Consequences: radiation cap, starvation, O2 emergency, death.
 *   7. Submission contract evaluation, supply drops, victory/defeat checks.
 *   8. Notification and ledger updates.
 */

import { ECONOMY, getHourOfDay, isDaylight } from '../data/economy.js';
import { EVENTS, eventIntensityAt } from '../data/events.js';
import { MACHINES } from '../data/machines.js';
import { POIS } from '../data/pois.js';
import { MINERALS } from '../data/minerals.js';
import { SUBMISSIONS } from '../data/submissions.js';
import { EventLog, LOG_TYPES } from './event-log.js';

const RESOURCE_IDS = ['o2', 'water', 'food', 'energy'];
const HOTBAR_SIZE = 5;
const HOTBAR_MAX_STACK = 5;

const DEFAULT_STATS = () => ({
  o2_output: 1,
  water_output: 1,
  food_output: 1,
  solar_output: 1,
  battery_capacity: 0,
  power_draw: 1,
  water_input: 1,
  hydro_power: 1,
  dust_rate: 1,
  repair_time: 1,
  suit_shield: 1,
  movement_speed: 1,
  machine_wear: 1,
  solar_wear: 1,
  suit_decay: 1,
  submission_reward: 1,
  forecast_depth: 0,
  shelter_shield: 1,
  shelter_base: 1,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class GameSim {
  constructor({ economy = ECONOMY, machines = MACHINES, events = EVENTS, submissions = SUBMISSIONS, pois = POIS, log = new EventLog() } = {}) {
    this.economy = economy;
    this.machinesData = machines;
    this.eventsData = events;
    this.submissionsData = submissions;
    this.poisData = pois;
    this.log = log;
    this.presence = { outside: false, inShelter: false };
    this.notifications = [];
    this.reset();
  }

  reset() {
    const eco = this.economy;
    const resources = {};
    for (const id of RESOURCE_IDS) resources[id] = eco.resources[id].start;

    const machines = {};
    for (const row of Object.values(this.machinesData)) {
      machines[row.id] = {
        condition: 100,
        enabled: true,
        upgrades: [],
        job: null,
        repairCount: 0,
        wasBroken: false,
      };
    }

    const submissions = {};
    for (const row of this.submissionsData) {
      submissions[row.id] = { status: 'active', readyTick: null, claimedTick: null };
    }

    this.state = {
      tick: 0,
      speed: eco.time.defaultSpeed ?? 5,
      resources,
      health: 100,
      radiation: eco.radiation.start,
      nutrition: eco.satiety.start,
      hydration: eco.satiety.start,
      suit: eco.suit.start,
      suitJob: null,
      machines,
      dust: 0,
      toggles: { lights: true },
      shelterLocked: false,
      shelterCountedStorm: null,
      emergencyO2: eco.emergencyO2.ticks,
      scans: [],
      samples: [],
      reports: [],
      scanLog: [],
      minerals: { water_ice: 0, ilmenite: 0, anorthite: 0, olivine: 0 },
      hotbar: [{ type: 'tool', id: 'pickaxe', count: 1 }, null, null, null, null],
      submissions,
      supply: { cooldown: 0, pending: null },
      firedEvents: [],
      shedThisTick: [],
      stats: {
        peakDose: eco.radiation.start,
        evas: 0,
        shelterUses: 0,
        repairs: 0,
        upgrades: 0,
        reportsSent: 0,
        submissionsClaimed: 0,
        scans: 0,
        mined: 0,
        stormsSurvived: 0,
        energyWasted: 0,
      },
      lastDelta: { o2: 0, water: 0, food: 0, energy: 0 },
      lastPower: { demand: 0, solar: 0, shed: [], capacity: eco.resources.energy.capacity },
      flags: {},
      over: null,
      cause: null,
      freeplay: false,
      started: false,
      lastAwards: [],
    };

    this.stats = DEFAULT_STATS();
    this.log.reset();
    this.notifications.length = 0;
    this._notify('reset', {}, 'info');
    this.notifications.length = 0;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  get hour() {
    return getHourOfDay(this.state.tick);
  }

  get sol() {
    return Math.floor(this.state.tick / this.economy.time.solTicks) + 1;
  }

  get isDay() {
    return isDaylight(this.state.tick);
  }

  get maxHealth() {
    const rad = this.state.radiation;
    const safe = this.economy.radiation.safeDose;
    const penalty = Math.max(0, rad - safe) * this.economy.radiation.maxHealthPenaltyPerPoint;
    return clamp(100 - penalty, 20, 100);
  }

  get energyCapacity() {
    const eco = this.economy;
    const battery = this.state.machines.battery;
    const base = eco.resources.energy.capacity + this.stats.battery_capacity;
    if (!battery || battery.condition <= 0) return 30;
    const factor = 0.5 + 0.5 * (battery.condition / 100);
    return Math.round(30 + (base - 30) * factor);
  }

  getResourceCapacity(id) {
    if (id === 'energy') return this.energyCapacity;
    return this.economy.resources[id]?.capacity ?? 100;
  }

  getResourcePercent(id) {
    const cap = this.getResourceCapacity(id);
    return cap > 0 ? (this.state.resources[id] / cap) * 100 : 0;
  }

  /** Raw values for tests and the debug overlay. */
  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  activeEvents() {
    const tick = this.state.tick;
    return this.eventsData
      .filter((row) => tick >= row.onset && tick < row.onset + row.duration)
      .map((row) => {
        const progress = (tick - row.onset) / row.duration;
        return {
          ...row,
          progress,
          remaining: row.onset + row.duration - tick,
          intensityNow: eventIntensityAt(row, progress),
        };
      });
  }

  getStorm() {
    const storms = this.activeEvents().filter((row) => row.archetype === 'radiation_window');
    if (!storms.length) return null;
    return storms.reduce((a, b) => (a.intensityNow >= b.intensityNow ? a : b));
  }

  isCommsOutage() {
    return this.activeEvents().some((row) => row.archetype === 'comms_outage');
  }

  _consumptionMult(resourceId) {
    let mult = 1;
    for (const row of this.activeEvents()) {
      if (row.archetype === 'consumption_spike' && row.targetId === resourceId) {
        mult *= row.intensityNow;
      }
    }
    return mult;
  }

  _productionMult(machineId) {
    let mult = 1;
    for (const row of this.activeEvents()) {
      if (row.archetype === 'production_drop' && row.targetType === 'machine' && row.targetId === machineId) {
        mult *= row.intensityNow;
      }
    }
    return mult;
  }

  suitDoseFactor() {
    const rad = this.economy.radiation;
    if (this.state.suit >= rad.lowSuitBelow) return 1;
    return 1 + ((rad.lowSuitBelow - this.state.suit) / rad.lowSuitBelow) * rad.lowSuitExtra;
  }

  /** Expected radiation dose for the crew's current zone, in points per tick. */
  getDoseRate() {
    const rad = this.economy.radiation;
    const storm = this.getStorm();
    const stormMult = storm ? Math.max(1, storm.intensityNow) : 1;
    const suitFactor = this.suitDoseFactor() * this.stats.suit_shield;
    if (this.presence.outside) {
      return rad.outsidePerTick * stormMult * suitFactor;
    }
    if (storm) {
      if (this.state.shelterLocked && this.presence.inShelter) {
        return rad.shelterPerTick * stormMult * this.stats.shelter_shield;
      }
      if (this.state.shelterLocked) {
        return rad.insideStormPerTick * stormMult * this.stats.shelter_base;
      }
      return rad.insideStormPerTick * stormMult;
    }
    return 0;
  }

  getConditionFactor(machineId) {
    const machine = this.state.machines[machineId];
    if (!machine || machine.condition <= 0) return 0;
    return this.economy.condition.outputFloor + (1 - this.economy.condition.outputFloor) * (machine.condition / 100);
  }

  /** Effective condition loss per game hour, including upgrade wear modifiers. */
  getWearRate(machineId) {
    const row = this.machinesData[machineId];
    if (!row) return 0;
    const solarWear = machineId === 'solar_array' ? this.stats.solar_wear : 1;
    return (row.conditionDecay ?? 0) * this.stats.machine_wear * solarWear;
  }

  machinePower(machineId) {
    const row = this.machinesData[machineId];
    if (!row) return 0;
    let power = row.power * this.stats.power_draw;
    if (machineId === 'hydroponics') power *= this.stats.hydro_power;
    power *= this._consumptionMult('energy');
    if (this.state.machines.power_distributor?.condition <= 0) power *= 1.1;
    return power;
  }

  /** Full read-only view of a machine for panels and tests. */
  machineView(machineId) {
    const row = this.machinesData[machineId];
    const machine = this.state.machines[machineId];
    if (!row || !machine) return null;
    const plan = this._planMachine(machineId);
    let status = 'online';
    if (machine.condition <= 0) status = 'broken';
    else if (machine.job) status = 'repairing';
    else if (row.kind === 'solar' && !this.isDay) status = 'night';
    else if (row.kind === 'production' && !machine.enabled) status = 'off';
    else if (plan.reason === 'standby') status = 'standby';
    else if (plan.reason === 'starved') status = 'starved';
    else if (row.kind === 'solar' && !this.isDay) status = 'night';

    return {
      ...row,
      machine,
      plan,
      status,
      condition: machine.condition,
      conditionFactor: this.getConditionFactor(machineId),
      installed: [...machine.upgrades],
      availableUpgrades: row.upgrades.map((upgrade) => ({
        ...upgrade,
        installed: machine.upgrades.includes(upgrade.id),
      })),
      dust: machineId === 'solar_array' ? this.state.dust : 0,
      power: plan.power,
      powerNow: plan.power,
      outputs: plan.outputs,
      inputs: plan.inputs,
      job: machine.job,
    };
  }

  // -------------------------------------------------------------------------
  // Main tick
  // -------------------------------------------------------------------------

  tick() {
    const s = this.state;
    if (s.over) return s.over;
    s.started = true;
    const startResources = { ...s.resources };
    s.tick += 1;

    this._fireEvents();
    const active = this.activeEvents();

    this._applyRadiation(active);
    this._updateWear(active);
    this._runPowerAndProduction(active);
    this._runCrew(active);
    this._tickJobs();
    this._consequences(active);
    this._updateSubmissions();
    this._updateSupply();
    this._warnLowResources();

    for (const id of RESOURCE_IDS) {
      const cap = this.getResourceCapacity(id);
      s.resources[id] = clamp(s.resources[id], 0, cap);
      s.lastDelta[id] = Number((s.resources[id] - startResources[id]).toFixed(2));
    }
    s.nutrition = clamp(s.nutrition, 0, 100);
    s.hydration = clamp(s.hydration, 0, 100);
    s.suit = clamp(s.suit, 0, 100);
    s.health = clamp(s.health, 0, this.maxHealth);
    s.radiation = clamp(s.radiation, 0, 100);
    s.dust = clamp(s.dust, 0, 100);
    s.stats.peakDose = Math.max(s.stats.peakDose, s.radiation);

    if (!s.over && s.tick >= this.economy.time.missionTicks) {
      this._endMission('defeat', 'mission_clock');
    }

    return s.over;
  }

  _fireEvents() {
    const tick = this.state.tick;
    for (const row of this.eventsData) {
      if (row.onset === tick) {
        if (!this.state.firedEvents.includes(row.id)) this.state.firedEvents.push(row.id);
        if (row.archetype === 'machine_failure' && row.targetId) {
          const machine = this.state.machines[row.targetId];
          if (machine) {
            machine.condition = 0;
            machine.wasBroken = true;
            machine.job = null;
            this._notify('machine_broken', { machineId: row.targetId, eventId: row.id }, 'critical');
          }
        }
        if (row.archetype === 'radiation_window') {
          this._notify('storm_start', { eventId: row.id, source: row.source }, 'critical');
          this.log.add(tick, LOG_TYPES.STORM_START, { eventId: row.id, source: row.source });
        } else {
          this._notify('event_start', { eventId: row.id, source: row.source }, row.archetype === 'comms_outage' ? 'warn' : 'warn');
        }
      }
      if (row.onset + row.duration === tick) {
        if (row.archetype === 'radiation_window') {
          this._notify('storm_end', { eventId: row.id, source: row.source }, 'good');
          this.log.add(tick, LOG_TYPES.STORM_END, { eventId: row.id, source: row.source });
          this.state.stats.stormsSurvived += 1;
        } else {
          this._notify('event_end', { eventId: row.id }, 'info');
        }
      }
    }
  }

  _applyRadiation(active) {
    const rad = this.economy.radiation;
    const storm = this.getStorm();
    const rate = this.getDoseRate();
    if (rate > 0) {
      this.state.radiation = clamp(this.state.radiation + rate, 0, rad.deathDose);
      this.state.stats.peakDose = Math.max(this.state.stats.peakDose, this.state.radiation);
    }

    if (storm && this.state.shelterLocked && this.presence.inShelter) {
      if (this.state.shelterCountedStorm !== storm.id) {
        this.state.shelterCountedStorm = storm.id;
        this.state.stats.shelterUses += 1;
        this.log.add(this.state.tick, LOG_TYPES.SHELTER, { eventId: storm.id, source: storm.source });
        this._notify('shelter_used', { eventId: storm.id }, 'good');
      }
    }
    if (!storm) this.state.shelterCountedStorm = null;

    if (this.presence.outside) {
      this.state.suit = clamp(this.state.suit - this.economy.suit.evaDecayPerTick * this.stats.suit_decay, 0, 100);
    }

    const radFlags = this.state.flags;
    if (this.state.radiation >= rad.safeDose && !radFlags.dose30) {
      radFlags.dose30 = true;
      this._notify('dose_threshold', { threshold: rad.safeDose }, 'warn');
      this.log.add(this.state.tick, LOG_TYPES.NOTE, {
        note: 'radiation_threshold',
        threshold: rad.safeDose,
        source: rad.source,
      });
    }
    if (this.state.radiation >= rad.damageAbove && !radFlags.dose70) {
      radFlags.dose70 = true;
      this._notify('dose_danger', { threshold: rad.damageAbove }, 'critical');
    }
  }

  _updateWear() {
    const s = this.state;
    const dustRate = 1.1 * this.stats.dust_rate;
    if (s.machines.solar_array && s.machines.solar_array.condition > 0) {
      s.dust = clamp(s.dust + dustRate, 0, 100);
    }
    for (const [id, machine] of Object.entries(s.machines)) {
      const row = this.machinesData[id];
      if (!row || machine.condition <= 0) continue;
      if (machine.job) continue;
      const decay = this.getWearRate(id);
      if (decay <= 0) continue;
      // Switched-off production machines wear more slowly.
      const activity = row.kind === 'production' && !machine.enabled ? 0.35 : 1;
      machine.condition = clamp(machine.condition - decay * activity, 0, 100);
      if (machine.condition <= 0 && !machine.wasBroken) {
        machine.wasBroken = true;
        machine.job = null;
        this._notify('machine_broken', { machineId: id }, 'critical');
        this.log.add(s.tick, LOG_TYPES.NOTE, { note: 'machine_worn_out', machineId: id });
      }
    }
  }

  _planMachine(machineId) {
    const row = this.machinesData[machineId];
    const machine = this.state.machines[machineId];
    const empty = { active: false, reason: 'idle', power: 0, inputs: {}, outputs: {}, conditionFactor: 0, eventMult: 1 };
    if (!row || !machine) return empty;
    if (machine.condition <= 0) return { ...empty, reason: 'broken' };
    const conditionFactor = this.getConditionFactor(machineId);
    const eventMult = this._productionMult(machineId);
    const result = {
      active: false,
      reason: 'idle',
      power: 0,
      inputs: {},
      outputs: {},
      conditionFactor,
      eventMult,
    };

    if (row.kind === 'solar') {
      if (!this.isDay) return { ...result, reason: 'night' };
      const dustFactor = 1 - this.state.dust / 100;
      result.active = true;
      result.outputs = {
        energy: row.outputs.energy * this.stats.solar_output * conditionFactor * dustFactor * eventMult,
      };
      return result;
    }

    if (row.kind !== 'production') return result;
    if (!machine.enabled) return { ...result, reason: 'off' };
    if (row.throttle && this.state.resources[row.throttle.resource] >= row.throttle.above) {
      return { ...result, reason: 'standby' };
    }
    if (machine.job) return { ...result, reason: 'job' };

    const inputs = {};
    for (const [res, amount] of Object.entries(row.inputs ?? {})) {
      let value = amount;
      if (machineId === 'o2_system' && res === 'water') value *= this.stats.water_input;
      inputs[res] = value;
    }
    for (const [res, amount] of Object.entries(inputs)) {
      if (this.state.resources[res] < amount) return { ...result, reason: 'starved', inputs };
    }

    const outputs = {};
    for (const [res, amount] of Object.entries(row.outputs ?? {})) {
      let mult = 1;
      if (machineId === 'o2_system' && res === 'o2') mult = this.stats.o2_output;
      if (machineId === 'water_recycler' && res === 'water') mult = this.stats.water_output;
      if (machineId === 'hydroponics' && res === 'food') mult = this.stats.food_output;
      outputs[res] = amount * mult * conditionFactor * eventMult;
    }

    result.active = true;
    result.reason = 'online';
    result.inputs = inputs;
    result.outputs = outputs;
    result.power = this.machinePower(machineId);
    return result;
  }

  _runPowerAndProduction() {
    const s = this.state;
    const eco = this.economy;
    const plans = {
      o2_system: this._planMachine('o2_system'),
      hydroponics: this._planMachine('hydroponics'),
      water_recycler: this._planMachine('water_recycler'),
      solar_array: this._planMachine('solar_array'),
    };

    const capacity = this.energyCapacity;
    const solar = plans.solar_array.active ? plans.solar_array.outputs.energy ?? 0 : 0;
    s.resources.energy = clamp(s.resources.energy + solar, 0, capacity);

    const lightsOn = s.toggles.lights && (!eco.power.lightsOnlyAtNight || !this.isDay);
    const lightsPower = lightsOn ? eco.power.lightsPower * this.stats.power_draw : 0;
    const powerById = {
      o2_system: plans.o2_system.active ? plans.o2_system.power : 0,
      hydroponics: plans.hydroponics.active ? plans.hydroponics.power : 0,
      water_recycler: plans.water_recycler.active ? plans.water_recycler.power : 0,
      lights: lightsPower,
    };
    let demand = Object.values(powerById).reduce((a, b) => a + b, 0);
    if (s.machines.power_distributor?.condition <= 0) demand *= 1.1;

    const shed = [];
    const activeById = {
      lights: lightsOn,
      hydroponics: plans.hydroponics.active,
      water_recycler: plans.water_recycler.active,
      o2_system: plans.o2_system.active,
    };

    if (s.resources.energy < demand) {
      for (const key of eco.power.ladder) {
        if (s.resources.energy >= demand) break;
        if (!activeById[key]) continue;
        const saved = key === 'lights' ? lightsPower : plans[key]?.power ?? 0;
        if (saved <= 0) continue;
        demand -= saved;
        activeById[key] = false;
        if (key === 'lights') activeById.lights = false;
        if (key !== 'lights' && plans[key]) plans[key].active = false;
        shed.push(key);
      }
    }

    demand = Math.max(0, demand);
    if (demand > s.resources.energy) demand = s.resources.energy;
    s.resources.energy = clamp(s.resources.energy - demand, 0, capacity);

    const applyProduction = (id, plan) => {
      if (!plan.active) return;
      for (const [res, amount] of Object.entries(plan.inputs)) {
        s.resources[res] = Math.max(0, s.resources[res] - amount);
      }
      for (const [res, amount] of Object.entries(plan.outputs)) {
        const cap = this.getResourceCapacity(res);
        s.resources[res] = clamp(s.resources[res] + amount, 0, cap);
      }
    };
    applyProduction('o2_system', plans.o2_system);
    applyProduction('hydroponics', plans.hydroponics);
    applyProduction('water_recycler', plans.water_recycler);

    s.lastPower = {
      demand: Number(demand.toFixed(2)),
      solar: Number(solar.toFixed(2)),
      shed,
      capacity,
      lightsOn: activeById.lights,
    };

    if (shed.length) {
      const key = shed.join(',');
      if (s.flags.lastShed !== key) {
        s.flags.lastShed = key;
        this._notify('power_shed', { systems: shed }, 'warn');
        this.log.add(s.tick, LOG_TYPES.POWER_SHED, { systems: [...shed] });
      }
    } else if (s.flags.lastShed) {
      s.flags.lastShed = null;
    }

    const totalEnergyCap = this.energyCapacity;
    if (s.resources.energy > totalEnergyCap) {
      s.stats.energyWasted += s.resources.energy - totalEnergyCap;
      s.resources.energy = totalEnergyCap;
    }
  }

  _runCrew() {
    const s = this.state;
    const eco = this.economy;
    const sat = eco.satiety;

    const o2Mult = this._consumptionMult('o2');
    const waterMult = this._consumptionMult('water');
    const foodMult = this._consumptionMult('food');
    const evaExtra = this.presence.outside ? 0.2 : 0;

    s.resources.o2 = clamp(s.resources.o2 - (eco.resources.o2.crewPerTick * o2Mult + evaExtra), 0, this.getResourceCapacity('o2'));
    s.resources.water = clamp(s.resources.water - eco.resources.water.crewPerTick * waterMult, 0, this.getResourceCapacity('water'));
    s.resources.food = clamp(s.resources.food - eco.resources.food.crewPerTick * foodMult, 0, this.getResourceCapacity('food'));

    s.nutrition = clamp(s.nutrition - sat.drainPerTick, 0, 100);
    s.hydration = clamp(s.hydration - sat.drainPerTick, 0, 100);

    if (s.nutrition < sat.mealThreshold && s.resources.food >= sat.mealCost.food) {
      s.resources.food -= sat.mealCost.food;
      s.nutrition = clamp(s.nutrition + sat.mealRestore, 0, 100);
      this.state.flags.lastMealTick = s.tick;
    }
    if (s.hydration < sat.mealThreshold && s.resources.water >= sat.mealCost.water) {
      s.resources.water -= sat.mealCost.water;
      s.hydration = clamp(s.hydration + sat.mealRestore, 0, 100);
    }

    if (
      s.nutrition >= sat.regenAbove &&
      s.hydration >= sat.regenAbove &&
      s.health < this.maxHealth
    ) {
      s.health = clamp(s.health + sat.regenPerTick, 0, this.maxHealth);
    }
  }

  _consequences() {
    const s = this.state;
    const rad = this.economy.radiation;

    const max = this.maxHealth;
    if (s.health > max) s.health = max;

    if (s.radiation > rad.damageAbove) {
      s.health -= rad.damagePerTick;
      if (!s.flags.radDamage) {
        s.flags.radDamage = true;
        this._notify('crew_damage', { cause: 'radiation' }, 'critical');
        this.log.add(s.tick, LOG_TYPES.DAMAGE, { cause: 'radiation', source: rad.source });
      }
    } else {
      s.flags.radDamage = false;
    }

    if (s.nutrition <= 0 || s.hydration <= 0) {
      const damage = (s.nutrition <= 0 ? 0.9 : 0) + (s.hydration <= 0 ? 0.9 : 0);
      s.health -= damage;
      if (!s.flags.starving) {
        s.flags.starving = true;
        this._notify('crew_damage', { cause: s.hydration <= 0 ? 'dehydration' : 'starvation' }, 'critical');
        this.log.add(s.tick, LOG_TYPES.DAMAGE, {
          cause: s.hydration <= 0 ? 'dehydration' : 'starvation',
        });
      }
    } else {
      s.flags.starving = false;
    }

    if (s.resources.o2 <= 0) {
      s.emergencyO2 = Math.max(0, s.emergencyO2 - 1);
      s.health -= this.economy.emergencyO2.healthDamagePerTick;
      if (!s.flags.o2Emergency) {
        s.flags.o2Emergency = true;
        this._notify('o2_emergency', { ticks: s.emergencyO2 }, 'critical');
        this.log.add(s.tick, LOG_TYPES.DAMAGE, { cause: 'oxygen', source: 'bvad' });
      }
      if (s.emergencyO2 <= 0 && !s.over) {
        this._endMission('defeat', 'oxygen');
      }
    } else {
      s.emergencyO2 = this.economy.emergencyO2.ticks;
      s.flags.o2Emergency = false;
    }

    if (s.radiation >= rad.deathDose && !s.over) {
      this._endMission('defeat', 'radiation');
    }
    if (s.health <= 0 && !s.over) {
      let cause = 'life_support';
      if (s.radiation >= rad.damageAbove) cause = 'radiation';
      else if (s.nutrition <= 0) cause = 'starvation';
      else if (s.hydration <= 0) cause = 'dehydration';
      this._endMission('defeat', cause);
    }

    const healthPct = s.health / Math.max(1, max);
    if (healthPct < 0.25 && !s.flags.lowHealth) {
      s.flags.lowHealth = true;
      this._notify('low_health', { health: Math.round(s.health) }, 'critical');
    } else if (healthPct > 0.5) {
      s.flags.lowHealth = false;
    }
  }

  _tickJobs() {
    const s = this.state;
    for (const [id, machine] of Object.entries(s.machines)) {
      const job = machine.job;
      if (!job) continue;
      job.remainingTicks -= 1;
      if (job.remainingTicks > 0) continue;
      if (job.type === 'repair') {
        machine.condition = clamp(machine.condition + this.economy.repair.conditionRestore, 0, 100);
        machine.repairCount += 1;
        machine.wasBroken = false;
        machine.job = null;
        s.stats.repairs += 1;
        this.log.add(s.tick, LOG_TYPES.REPAIR, { machineId: id, condition: Math.round(machine.condition) });
        this._notify('machine_repaired', { machineId: id }, 'good');
      } else if (job.type === 'upgrade') {
        if (!machine.upgrades.includes(job.upgradeId)) machine.upgrades.push(job.upgradeId);
        machine.job = null;
        s.stats.upgrades += 1;
        this.recomputeStats();
        this.log.add(s.tick, LOG_TYPES.UPGRADE, { machineId: id, upgradeId: job.upgradeId });
        this._notify('upgrade_installed', { machineId: id, upgradeId: job.upgradeId }, 'good');
      }
    }

    if (s.suitJob) {
      s.suitJob.remainingTicks -= 1;
      if (s.suitJob.remainingTicks <= 0) {
        s.suit = clamp(s.suit + this.economy.suit.repairAmount, 0, 100);
        s.suitJob = null;
        this.log.add(s.tick, LOG_TYPES.SUIT_REPAIR, { suit: Math.round(s.suit) });
        this._notify('suit_repaired', { suit: Math.round(s.suit) }, 'good');
      }
    }
  }

  _updateSubmissions() {
    const s = this.state;
    const tick = s.tick;
    for (const row of this.submissionsData) {
      const sub = s.submissions[row.id];
      if (!sub || sub.status !== 'active') continue;
      let ready = false;
      let missed = false;

      if (row.condition === 'reading_before_event') {
        const event = this.eventsData.find((e) => e.id === row.params.eventId);
        if (event) {
          const readings = s.scanLog.filter((scan) => scan.tick <= event.onset);
          if (readings.length > 0) ready = true;
          else if (tick > event.onset) missed = true;
        }
      } else if (row.condition === 'counter_reached') {
        if (row.params.counter === 'scans' && s.scans.length >= row.params.target) ready = true;
        if (row.params.counter === 'reports' && s.reports.length >= row.params.target) ready = true;
      } else if (row.condition === 'resource_below_and_repaired') {
        const machine = s.machines[row.params.machineId];
        if (
          s.resources[row.params.resource] < row.params.threshold &&
          machine &&
          machine.condition >= row.params.minCondition &&
          machine.repairCount > 0
        ) {
          ready = true;
        }
      } else if (row.condition === 'total_reports_sent') {
        if (s.reports.length >= row.params.target) ready = true;
      }

      if (ready) {
        sub.status = 'ready';
        sub.readyTick = tick;
        this.log.add(tick, LOG_TYPES.SUBMISSION_READY, { submissionId: row.id });
        this._notify('submission_ready', { submissionId: row.id }, 'good');
      } else if (missed) {
        sub.status = 'missed';
        this._notify('submission_missed', { submissionId: row.id }, 'warn');
      }
    }
  }

  _updateSupply() {
    const s = this.state;
    if (s.supply.cooldown > 0) s.supply.cooldown -= 1;
    const pending = s.supply.pending;
    if (pending && s.tick >= pending.arriveTick) {
      for (const [res, amount] of Object.entries(pending.give)) {
        s.resources[res] = clamp(s.resources[res] + amount, 0, this.getResourceCapacity(res));
      }
      s.supply.pending = null;
      this.log.add(s.tick, LOG_TYPES.SUPPLY_ARRIVAL, { give: pending.give });
      this._notify('supply_arrived', { give: pending.give }, 'good');
    }
  }

  _warnLowResources() {
    const s = this.state;
    for (const id of RESOURCE_IDS) {
      const cfg = this.economy.resources[id];
      const value = s.resources[id];
      const key = `low_${id}`;
      if (value <= cfg.critical && !s.flags[key]) {
        s.flags[key] = true;
        this._notify('low_resource', { resource: id, value }, 'critical');
        this.log.add(s.tick, LOG_TYPES.RESOURCE_LOW, { resource: id, value: Number(value.toFixed(1)) });
      } else if (value > cfg.warning) {
        s.flags[key] = false;
      }
    }
  }

  _endMission(result, cause) {
    const s = this.state;
    if (s.over) return;
    s.over = result;
    s.cause = cause;
    if (result === 'defeat') {
      this.log.add(s.tick, LOG_TYPES.DEATH, { cause });
      this._notify('defeat', { cause }, 'critical');
    } else {
      this.log.add(s.tick, LOG_TYPES.VICTORY, { reports: s.reports.length });
      this._notify('victory', { reports: s.reports.length }, 'good');
    }
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

  setPresence(presence) {
    const prev = this.presence;
    const next = { ...prev, ...presence };
    if (!prev.outside && next.outside) this.state.stats.evas += 1;
    this.presence = next;
  }

  toggleSystem(key) {
    const s = this.state;
    if (key === 'lights') {
      s.toggles.lights = !s.toggles.lights;
      this._notify('power_toggle', { system: key, on: s.toggles.lights }, 'info');
      return { ok: true, on: s.toggles.lights };
    }
    const machine = s.machines[key];
    if (!machine) return { ok: false, reason: 'unknown_system' };
    if (machine.condition <= 0) return { ok: false, reason: 'broken' };
    machine.enabled = !machine.enabled;
    this._notify('power_toggle', { system: key, on: machine.enabled }, 'info');
    return { ok: true, on: machine.enabled };
  }

  startRepair(machineId) {
    const machine = this.state.machines[machineId];
    const row = this.machinesData[machineId];
    if (!machine || !row) return { ok: false, reason: 'unknown_machine' };
    if (machine.job) return { ok: false, reason: 'busy' };
    if (machine.condition >= 99.5) return { ok: false, reason: 'healthy' };
    const cost = this.economy.repair.energyCost;
    if (this.state.resources.energy < cost) return { ok: false, reason: 'no_energy' };
    this.state.resources.energy -= cost;
    const total = Math.max(1, Math.round(this.economy.repair.ticks * this.stats.repair_time));
    machine.job = { type: 'repair', remainingTicks: total, totalTicks: total };
    this._notify('repair_started', { machineId, ticks: total }, 'info');
    return { ok: true, ticks: total };
  }

  startUpgrade(machineId, upgradeId) {
    const machine = this.state.machines[machineId];
    const row = this.machinesData[machineId];
    if (!machine || !row) return { ok: false, reason: 'unknown_machine' };
    const upgrade = row.upgrades.find((u) => u.id === upgradeId);
    if (!upgrade) return { ok: false, reason: 'unknown_upgrade' };
    if (machine.upgrades.includes(upgradeId)) return { ok: false, reason: 'installed' };
    if (machine.job) return { ok: false, reason: 'busy' };
    if (machine.condition <= 0) return { ok: false, reason: 'broken' };
    if (this.state.resources.energy < upgrade.cost) return { ok: false, reason: 'no_energy' };
    this.state.resources.energy -= upgrade.cost;
    machine.job = {
      type: 'upgrade',
      upgradeId,
      remainingTicks: upgrade.ticks,
      totalTicks: upgrade.ticks,
    };
    this._notify('upgrade_started', { machineId, upgradeId, ticks: upgrade.ticks }, 'info');
    return { ok: true, ticks: upgrade.ticks };
  }

  repairSuit() {
    const s = this.state;
    const bench = s.machines.repair_bench;
    if (!bench || bench.condition <= 0) return { ok: false, reason: 'bench_broken' };
    if (s.suit >= 99.5) return { ok: false, reason: 'healthy' };
    if (s.suitJob) return { ok: false, reason: 'busy' };
    if (s.resources.energy < this.economy.suit.repairCost) return { ok: false, reason: 'no_energy' };
    s.resources.energy -= this.economy.suit.repairCost;
    const total = Math.max(1, Math.round(this.economy.suit.repairTicks * this.stats.repair_time));
    s.suitJob = { remainingTicks: total, totalTicks: total };
    this._notify('suit_repair_started', { ticks: total }, 'info');
    return { ok: true, ticks: total };
  }

  toggleShelter() {
    const s = this.state;
    s.shelterLocked = !s.shelterLocked;
    this._notify('shelter_toggle', { locked: s.shelterLocked }, s.shelterLocked ? 'good' : 'info');
    return { ok: true, locked: s.shelterLocked };
  }

  cleanSolarArray() {
    const s = this.state;
    const row = this.machinesData.solar_array;
    const machine = s.machines.solar_array;
    if (!machine || machine.condition <= 0) return { ok: false, reason: 'broken' };
    if (s.dust < 1) return { ok: false, reason: 'clean' };
    s.dust = 0;
    const dose = this.economy.radiation.cleanPanelDose * this.suitDoseFactor() * this.stats.suit_shield;
    s.radiation = clamp(s.radiation + dose, 0, 100);
    s.stats.peakDose = Math.max(s.stats.peakDose, s.radiation);
    s.suit = clamp(s.suit - this.economy.suit.actionDecay * this.stats.suit_decay, 0, 100);
    this.log.add(s.tick, LOG_TYPES.NOTE, {
      note: 'solar_cleaned',
      dose: Number(dose.toFixed(2)),
      source: row.sourceRefs?.[0],
    });
    this._notify('solar_cleaned', { dose: Number(dose.toFixed(2)) }, 'good');
    return { ok: true, dose };
  }

  completeScan(poiId) {
    const poi = this.poisData.find((p) => p.id === poiId);
    if (!poi) return { ok: false, reason: 'unknown_poi' };
    if (this.state.scans.includes(poiId)) return { ok: false, reason: 'already_scanned' };
    const dose = poi.dose * this.suitDoseFactor() * this.stats.suit_shield;
    this.state.scans.push(poiId);
    this.state.samples.push(poiId);
    this.state.scanLog.push({ poiId, tick: this.state.tick });
    this.state.stats.scans += 1;
    this.state.radiation = clamp(this.state.radiation + dose, 0, 100);
    this.state.stats.peakDose = Math.max(this.state.stats.peakDose, this.state.radiation);
    this.state.suit = clamp(this.state.suit - this.economy.suit.actionDecay * this.stats.suit_decay, 0, 100);
    this.log.add(this.state.tick, LOG_TYPES.SCAN, { poiId, source: poi.source, dose: Number(dose.toFixed(2)) });
    this._notify('scan_complete', { poiId }, 'good');
    this._updateSubmissions();
    return { ok: true, dose };
  }

  _recountMinerals() {
    const counts = { water_ice: 0, ilmenite: 0, anorthite: 0, olivine: 0 };
    for (const slot of this.state.hotbar ?? []) {
      if (slot?.type === 'mineral' && counts[slot.id] !== undefined) {
        counts[slot.id] += slot.count;
      }
    }
    this.state.minerals = counts;
  }

  mineMineral(mineralId) {
    const mineral = MINERALS[mineralId];
    if (!mineral) return { ok: false, reason: 'unknown_mineral' };
    if (!Array.isArray(this.state.hotbar)) {
      this.state.hotbar = [{ type: 'tool', id: 'pickaxe', count: 1 }, null, null, null, null];
    }
    const hotbar = this.state.hotbar;
    let targetIdx = hotbar.findIndex(
      (slot) => slot?.type === 'mineral' && slot.id === mineralId && slot.count < HOTBAR_MAX_STACK
    );
    if (targetIdx === -1) {
      targetIdx = hotbar.findIndex((slot) => slot === null);
    }
    if (targetIdx === -1) {
      return { ok: false, reason: 'hotbar_full' };
    }
    if (hotbar[targetIdx]) {
      hotbar[targetIdx].count += 1;
    } else {
      hotbar[targetIdx] = { type: 'mineral', id: mineralId, count: 1 };
    }
    this._recountMinerals();
    this.state.stats.mined = (this.state.stats.mined ?? 0) + 1;
    this.state.suit = clamp(this.state.suit - 0.35 * this.stats.suit_decay, 0, 100);
    return {
      ok: true,
      slotIndex: targetIdx,
      count: this.state.minerals[mineralId],
      mineral,
    };
  }

  dropHotbarSlot(slotIndex) {
    const hotbar = this.state.hotbar;
    if (!Array.isArray(hotbar) || slotIndex < 0 || slotIndex >= HOTBAR_SIZE) {
      return { ok: false, reason: 'invalid_slot' };
    }
    const slot = hotbar[slotIndex];
    if (!slot) return { ok: false, reason: 'empty' };
    if (slot.type === 'tool') return { ok: false, reason: 'locked_tool' };
    const mineral = MINERALS[slot.id] ?? null;
    slot.count -= 1;
    if (slot.count <= 0) hotbar[slotIndex] = null;
    this._recountMinerals();
    return { ok: true, droppedId: slot.id, remainingInSlot: Math.max(0, slot.count), mineral };
  }

  refineHotbarSlot(slotIndex) {
    const hotbar = this.state.hotbar;
    if (!Array.isArray(hotbar) || slotIndex < 0 || slotIndex >= HOTBAR_SIZE) {
      return { ok: false, reason: 'invalid_slot' };
    }
    const slot = hotbar[slotIndex];
    if (!slot || slot.type !== 'mineral') return { ok: false, reason: 'empty' };
    const mineral = MINERALS[slot.id];
    if (!mineral) return { ok: false, reason: 'unknown_mineral' };
    slot.count -= 1;
    if (slot.count <= 0) hotbar[slotIndex] = null;
    this._recountMinerals();
    const { resource, amount } = mineral.bonus;
    if (resource === 'suit') {
      this.state.suit = clamp(this.state.suit + amount, 0, 100);
    } else if (RESOURCE_IDS.includes(resource)) {
      this.state.resources[resource] = clamp(
        this.state.resources[resource] + amount,
        0,
        this.getResourceCapacity(resource)
      );
    }
    return { ok: true, remaining: this.state.minerals[mineral.id] ?? 0, mineral };
  }

  refineMineral(mineralId) {
    const hotbar = this.state.hotbar ?? [];
    const idx = hotbar.findIndex((slot) => slot?.type === 'mineral' && slot.id === mineralId && slot.count > 0);
    if (idx === -1) return { ok: false, reason: 'empty' };
    return this.refineHotbarSlot(idx);
  }

  meltIce() {
    const hotbar = this.state.hotbar ?? [];
    const idx = hotbar.findIndex((slot) => slot?.type === 'mineral' && slot.id === 'water_ice' && slot.count > 0);
    if (idx === -1) return { ok: false, reason: 'no_ice' };
    hotbar[idx].count -= 1;
    if (hotbar[idx].count <= 0) hotbar[idx] = null;
    this._recountMinerals();
    this.state.resources.water = clamp(
      this.state.resources.water + 12,
      0,
      this.getResourceCapacity('water')
    );
    this.state.resources.food = clamp(
      this.state.resources.food + 4,
      0,
      this.getResourceCapacity('food')
    );
    this.state.iceMeltBoostUntil = this.state.tick + 2;
    return { ok: true, remaining: this.state.minerals.water_ice ?? 0 };
  }

  sendReport(poiId) {
    const poi = this.poisData.find((p) => p.id === poiId);
    if (!poi) return { ok: false, reason: 'unknown_poi' };
    if (!this.state.samples.includes(poiId)) return { ok: false, reason: 'no_sample' };
    if (this.state.reports.includes(poiId)) return { ok: false, reason: 'already_sent' };
    this.state.samples = this.state.samples.filter((id) => id !== poiId);
    this.state.reports.push(poiId);
    this.state.stats.reportsSent += 1;
    this.log.add(this.state.tick, LOG_TYPES.REPORT, {
      poiId,
      count: this.state.reports.length,
      source: poi.source,
    });
    this._notify('report_sent', { poiId, count: this.state.reports.length }, 'good');

    if (this.state.reports.length >= 3 && !this.state.over) {
      this._updateSubmissions();
      // The final contract is part of the victory beat; claim everything ready.
      for (const row of this.submissionsData) {
        if (this.state.submissions[row.id].status === 'ready') {
          this.claimSubmission(row.id, { silent: true });
        }
      }
      this._endMission('victory', 'mission_complete');
    }
    return { ok: true };
  }

  claimSubmission(submissionId, { silent = false } = {}) {
    const row = this.submissionsData.find((s) => s.id === submissionId);
    const sub = this.state.submissions[submissionId];
    if (!row || !sub) return { ok: false, reason: 'unknown_submission' };
    if (sub.status === 'claimed') return { ok: false, reason: 'claimed' };
    if (sub.status !== 'ready') return { ok: false, reason: 'not_ready' };
    const gained = {};
    for (const [res, amount] of Object.entries(row.reward)) {
      const scaled = Math.max(1, Math.round(amount * this.stats.submission_reward));
      gained[res] = scaled;
      this.state.resources[res] = clamp(this.state.resources[res] + scaled, 0, this.getResourceCapacity(res));
    }
    sub.status = 'claimed';
    sub.claimedTick = this.state.tick;
    this.state.stats.submissionsClaimed += 1;
    this.state.lastAwards.push({ submissionId, gained });
    this.log.add(this.state.tick, LOG_TYPES.SUBMISSION_CLAIMED, {
      submissionId,
      reward: gained,
      source: row.source,
    });
    if (!silent) this._notify('submission_claimed', { submissionId, reward: gained }, 'good');
    return { ok: true, reward: gained };
  }

  requestSupply() {
    const s = this.state;
    const cfg = this.economy.supply;
    if (this.isCommsOutage()) return { ok: false, reason: 'outage' };
    if (s.supply.pending) return { ok: false, reason: 'in_transit' };
    if (s.supply.cooldown > 0) return { ok: false, reason: 'cooldown', ticks: s.supply.cooldown };
    if (s.resources.energy < cfg.cost) return { ok: false, reason: 'no_energy' };
    s.resources.energy -= cfg.cost;
    s.supply.pending = { arriveTick: s.tick + cfg.delayTicks, give: { ...cfg.give } };
    s.supply.cooldown = cfg.cooldownTicks;
    this.log.add(s.tick, LOG_TYPES.SUPPLY_REQUEST, { cost: cfg.cost, source: cfg.source });
    this._notify('supply_requested', { cost: cfg.cost, ticks: cfg.delayTicks }, 'info');
    return { ok: true };
  }

  continueFreeplay() {
    if (this.state.over !== 'victory') return { ok: false };
    this.state.over = null;
    this.state.cause = null;
    this.state.freeplay = true;
    this.log.add(this.state.tick, LOG_TYPES.NOTE, { note: 'freeplay_started' });
    return { ok: true };
  }

  recomputeStats() {
    const stats = DEFAULT_STATS();
    const apply = (effect) => {
      if (!effect) return;
      const { stat, mult, add } = effect;
      if (!(stat in stats)) return;
      if (typeof add === 'number') stats[stat] += add;
      if (typeof mult === 'number') stats[stat] *= mult;
    };
    for (const [machineId, machine] of Object.entries(this.state.machines)) {
      const row = this.machinesData[machineId];
      if (!row) continue;
      for (const upgradeId of machine.upgrades) {
        const upgrade = row.upgrades.find((u) => u.id === upgradeId);
        if (!upgrade) continue;
        apply(upgrade.effect);
        apply(upgrade.drawback);
      }
    }
    this.stats = stats;
  }

  getForecast() {
    if (this.isCommsOutage()) return [];
    const depth = 2 + this.stats.forecast_depth;
    return this.eventsData
      .filter((row) => row.onset > this.state.tick)
      .slice(0, depth)
      .map((row) => ({ ...row, inTicks: row.onset - this.state.tick }));
  }

  getNextRadiationWindow() {
    return this.eventsData.find((row) => row.archetype === 'radiation_window' && row.onset > this.state.tick) ?? null;
  }

  getSubmissionRows() {
    return this.submissionsData.map((row) => ({ ...row, state: this.state.submissions[row.id] }));
  }

  getPoiRows() {
    return this.poisData.map((poi) => ({
      ...poi,
      scanned: this.state.scans.includes(poi.id),
      sampled: this.state.samples.includes(poi.id),
      reported: this.state.reports.includes(poi.id),
    }));
  }

  getMachineRows() {
    return Object.keys(this.machinesData).map((id) => this.machineView(id));
  }

  // -------------------------------------------------------------------------
  // Presets and debug
  // -------------------------------------------------------------------------

  capturePreset(name, player = null) {
    const s = this.state;
    return {
      id: name,
      name,
      capturedAt: new Date().toISOString(),
      tick: s.tick,
      speed: s.speed,
      player,
      resources: { ...s.resources },
      health: s.health,
      radiation: s.radiation,
      nutrition: s.nutrition,
      hydration: s.hydration,
      suit: s.suit,
      dust: s.dust,
      shelterLocked: s.shelterLocked,
      toggles: { ...s.toggles },
      machines: Object.fromEntries(
        Object.entries(s.machines).map(([id, m]) => [
          id,
          {
            condition: m.condition,
            enabled: m.enabled,
            upgrades: [...m.upgrades],
            repairCount: m.repairCount,
          },
        ])
      ),
      scans: [...s.scans],
      samples: [...s.samples],
      reports: [...s.reports],
      scanLog: s.scanLog.map((x) => ({ ...x })),
      minerals: { ...(s.minerals ?? { water_ice: 0, ilmenite: 0, anorthite: 0, olivine: 0 }) },
      hotbar: (s.hotbar ?? []).map((slot) => (slot ? { ...slot } : null)),
      submissions: Object.fromEntries(
        Object.entries(s.submissions).map(([id, sub]) => [id, { status: sub.status, readyTick: sub.readyTick, claimedTick: sub.claimedTick }])
      ),
      supply: { ...s.supply },
      stats: { ...s.stats },
      firedEvents: [...s.firedEvents],
      log: this.log.serialize(),
    };
  }

  loadPreset(preset) {
    this.reset();
    const s = this.state;
    s.tick = preset.tick ?? 0;
    s.speed = preset.speed ?? this.economy.time.defaultSpeed;
    for (const id of RESOURCE_IDS) {
      const value = preset.resources?.[id];
      if (typeof value === 'number') s.resources[id] = value;
    }
    s.health = preset.health ?? s.health;
    s.radiation = preset.radiation ?? s.radiation;
    s.nutrition = preset.nutrition ?? s.nutrition;
    s.hydration = preset.hydration ?? s.hydration;
    s.suit = preset.suit ?? s.suit;
    s.dust = preset.dust ?? s.dust;
    s.shelterLocked = Boolean(preset.shelterLocked);
    if (preset.toggles) Object.assign(s.toggles, preset.toggles);

    for (const [id, data] of Object.entries(preset.machines ?? {})) {
      const machine = s.machines[id];
      if (!machine) continue;
      if (typeof data.condition === 'number') machine.condition = clamp(data.condition, 0, 100);
      if (typeof data.enabled === 'boolean') machine.enabled = data.enabled;
      if (Array.isArray(data.upgrades)) machine.upgrades = [...data.upgrades];
      if (typeof data.repairCount === 'number') machine.repairCount = data.repairCount;
      machine.wasBroken = machine.condition <= 0;
    }

    s.scans = [...(preset.scans ?? [])];
    s.samples = [...(preset.samples ?? [])];
    s.reports = [...(preset.reports ?? [])];
    s.scanLog = (preset.scanLog ?? []).map((x) => ({ ...x }));
    s.hotbar = Array.isArray(preset.hotbar)
      ? preset.hotbar.slice(0, HOTBAR_SIZE).map((slot) => (slot ? { ...slot } : null))
      : [{ type: 'tool', id: 'pickaxe', count: 1 }, null, null, null, null];
    while (s.hotbar.length < HOTBAR_SIZE) s.hotbar.push(null);
    this._recountMinerals();
    s.firedEvents = [...(preset.firedEvents ?? [])];
    if (!s.firedEvents.length) {
      s.firedEvents = this.eventsData.filter((row) => row.onset <= s.tick).map((row) => row.id);
    }
    for (const [id, sub] of Object.entries(preset.submissions ?? {})) {
      if (s.submissions[id]) Object.assign(s.submissions[id], sub);
    }
    if (preset.stats) Object.assign(s.stats, preset.stats);
    if (preset.supply) {
      s.supply.cooldown = preset.supply.cooldown ?? 0;
      s.supply.pending = preset.supply.pending ? { ...preset.supply.pending } : null;
    }

    this.recomputeStats();
    this.log.reset();
    this.log.seed(preset.log ?? []);
    this.notifications.length = 0;
    s.over = null;
    s.cause = null;
    s.freeplay = false;
    s.started = true;
    for (const id of RESOURCE_IDS) {
      s.resources[id] = clamp(s.resources[id], 0, this.getResourceCapacity(id));
    }
    s.health = clamp(s.health, 0, this.maxHealth);
    s.radiation = clamp(s.radiation, 0, 100);
    s.stats.peakDose = Math.max(s.stats.peakDose ?? 0, s.radiation);
    return s;
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  _notify(type, payload = {}, severity = 'info') {
    this.notifications.push({
      type,
      payload,
      severity,
      tick: this.state?.tick ?? 0,
    });
  }

  drainNotifications() {
    const out = this.notifications.slice();
    this.notifications.length = 0;
    return out;
  }
}

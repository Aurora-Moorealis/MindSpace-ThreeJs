/**
 * Append-only mission ledger.
 *
 * The evaluation screen derives its counters from this log, and the presets
 * seed it with the history a demo state would have accumulated. It is also the
 * debug overlay's source of truth.
 */

export const LOG_TYPES = {
  SCAN: 'scan_complete',
  REPORT: 'report_sent',
  SUBMISSION_READY: 'submission_ready',
  SUBMISSION_CLAIMED: 'submission_claimed',
  REPAIR: 'machine_repaired',
  UPGRADE: 'upgrade_installed',
  SUIT_REPAIR: 'suit_repaired',
  STORM_START: 'storm_started',
  STORM_END: 'storm_ended',
  SHELTER: 'shelter_used',
  SUPPLY_REQUEST: 'supply_requested',
  SUPPLY_ARRIVAL: 'supply_arrived',
  POWER_SHED: 'power_shed',
  RESOURCE_LOW: 'resource_low',
  DAMAGE: 'crew_damage',
  DEATH: 'crew_death',
  VICTORY: 'victory',
  MISSION_END: 'mission_end',
  NOTE: 'note',
};

export class EventLog {
  constructor() {
    /** @type {Array<{tick:number,type:string,payload:Record<string, unknown>}>} */
    this.entries = [];
  }

  reset() {
    this.entries.length = 0;
  }

  add(tick, type, payload = {}) {
    this.entries.push({ tick, type, payload });
    return this.entries[this.entries.length - 1];
  }

  seed(entries = []) {
    for (const entry of entries) {
      this.entries.push({
        tick: entry.tick ?? 0,
        type: entry.type,
        payload: { ...(entry.payload ?? {}) },
      });
    }
    this.entries.sort((a, b) => a.tick - b.tick);
  }

  count(type) {
    let total = 0;
    for (const entry of this.entries) {
      if (entry.type === type) total += 1;
    }
    return total;
  }

  countPayload(type, predicate) {
    let total = 0;
    for (const entry of this.entries) {
      if (entry.type === type && predicate(entry.payload, entry)) total += 1;
    }
    return total;
  }

  reportsSent() {
    return this.count(LOG_TYPES.REPORT);
  }

  submissionsClaimed() {
    return this.count(LOG_TYPES.SUBMISSION_CLAIMED);
  }

  shelterUses() {
    return this.count(LOG_TYPES.SHELTER);
  }

  timeline(limit = 12) {
    return this.entries.slice(-limit);
  }

  relevantSources() {
    const ids = new Set();
    for (const entry of this.entries) {
      if (entry.payload?.source) ids.add(entry.payload.source);
    }
    return [...ids];
  }

  serialize() {
    return this.entries.map((entry) => ({
      tick: entry.tick,
      type: entry.type,
      payload: { ...entry.payload },
    }));
  }
}

/**
 * End-of-run evaluation. Pure logic (no DOM) so it can be unit-tested and reused
 * by the evaluation screen. The five required counters are always present.
 */

import { ECONOMY } from '../data/economy.js';
import { STRINGS } from '../data/strings.js';
import { MACHINES } from '../data/machines.js';
import { POIS } from '../data/pois.js';
import { SUBMISSIONS } from '../data/submissions.js';
import { EVENTS } from '../data/events.js';
import { LOG_TYPES } from './event-log.js';

const RESOURCE_IDS = ['o2', 'water', 'food', 'energy'];

function nameOfPoi(id) {
  const poi = POIS.find((row) => row.id === id);
  return poi ? STRINGS[poi.nameKey] : id;
}

function nameOfMachine(id) {
  return STRINGS[MACHINES[id]?.nameKey] ?? id?.replaceAll('_', ' ') ?? '';
}

function nameOfSubmission(id) {
  return STRINGS[SUBMISSIONS.find((row) => row.id === id)?.nameKey] ?? id;
}

function nameOfEvent(id) {
  return STRINGS[EVENTS.find((row) => row.id === id)?.nameKey] ?? id;
}

function reportTitle(id) {
  const poi = POIS.find((row) => row.id === id);
  return poi ? STRINGS[poi.reportKey] : STRINGS['report.generic'];
}

function gradeFor(score) {
  return ECONOMY.grading.find((row) => score >= row.min)?.grade ?? 'D';
}

export function timelineLabel(entry) {
  const p = entry.payload ?? {};
  switch (entry.type) {
    case LOG_TYPES.SCAN:
      return { icon: 'sample', text: `Surveyed ${nameOfPoi(p.poiId)}` };
    case LOG_TYPES.REPORT:
      return { icon: 'report', text: `Report ${p.count ?? ''} sent — ${reportTitle(p.poiId)}` };
    case LOG_TYPES.SUBMISSION_READY:
      return { icon: 'contract', text: `Contract ready — ${nameOfSubmission(p.submissionId)}` };
    case LOG_TYPES.SUBMISSION_CLAIMED:
      return { icon: 'check', text: `Contract claimed — ${nameOfSubmission(p.submissionId)}` };
    case LOG_TYPES.REPAIR:
      return { icon: 'wrench', text: `Repaired ${nameOfMachine(p.machineId)}` };
    case LOG_TYPES.UPGRADE:
      return { icon: 'wrench', text: `Installed an upgrade on ${nameOfMachine(p.machineId)}` };
    case LOG_TYPES.SUIT_REPAIR:
      return { icon: 'suit', text: `Suit repaired to ${p.suit ?? '—'}%` };
    case LOG_TYPES.STORM_START:
      return { icon: 'storm', text: `Radiation window began — ${nameOfEvent(p.eventId).replace(/^Radiation window — /, '')}` };
    case LOG_TYPES.STORM_END:
      return { icon: 'check', text: `Radiation window ended — ${nameOfEvent(p.eventId).replace(/^Radiation window — /, '')}` };
    case LOG_TYPES.SHELTER:
      return { icon: 'lock', text: 'Sheltered inside the storm pod through a radiation window' };
    case LOG_TYPES.SUPPLY_REQUEST:
      return { icon: 'supply', text: 'Requested an emergency supply drop' };
    case LOG_TYPES.SUPPLY_ARRIVAL:
      return { icon: 'supply', text: 'Supply drop received at the airlock' };
    case LOG_TYPES.POWER_SHED:
      return { icon: 'power', text: `Load shedding — ${(p.systems ?? []).join(', ')}` };
    case LOG_TYPES.RESOURCE_LOW:
      return { icon: 'alert', text: `${STRINGS[`resource.${p.resource}`] ?? p.resource} ran critical` };
    case LOG_TYPES.DAMAGE:
      return { icon: 'radiation', text: `Crew damage — ${p.cause ?? 'life support'}` };
    case LOG_TYPES.DEATH:
      return { icon: 'alert', text: `Mission ended — ${p.cause ?? 'life support failure'}` };
    case LOG_TYPES.VICTORY:
      return { icon: 'check', text: 'All three science reports delivered — mission complete' };
    case LOG_TYPES.NOTE:
      if (p.note === 'solar_cleaned') return { icon: 'energy', text: 'Cleaned the solar array outside' };
      if (p.note === 'machine_worn_out') return { icon: 'alert', text: `${nameOfMachine(p.machineId)} wore out` };
      if (p.note === 'radiation_threshold') return { icon: 'radiation', text: 'Crossed the 30-point dose threshold' };
      if (p.note === 'freeplay_started') return { icon: 'play', text: 'Continued in freeplay after victory' };
      return { icon: 'target', text: p.note?.replaceAll('_', ' ') ?? 'Note' };
    default:
      return { icon: 'target', text: entry.type.replaceAll('_', ' ') };
  }
}

export function buildEvaluation(sim) {
  const state = sim.state;
  const reports = state.reports.length;
  const scans = state.scans.length;
  const submitted = SUBMISSIONS.filter((row) => state.submissions[row.id]?.status === 'claimed').length;
  const ready = SUBMISSIONS.filter((row) => state.submissions[row.id]?.status === 'ready').length;
  const percentages = RESOURCE_IDS.map((id) => sim.getResourcePercent(id));
  const avgResources = percentages.reduce((a, b) => a + b, 0) / percentages.length;
  const peakDose = Math.max(state.stats.peakDose ?? 0, state.radiation);
  const shelterUses = state.stats.shelterUses ?? 0;
  const sols = sim.sol;
  const ticks = state.tick;
  const victory = state.over === 'victory';
  const timeout = state.cause === 'mission_clock';
  const broken = Object.values(state.machines).filter((machine) => machine.condition <= 0).length;

  let score =
    (reports / 3) * 60 +
    (submitted / 4) * 20 +
    avgResources * 0.1 +
    Math.max(0, 100 - peakDose) * 0.08;
  if (victory) score = Math.min(100, score);
  else score = Math.min(49, score);
  score = Math.max(0, Math.round(score));
  const grade = gradeFor(score);

  const wentWell = [];
  const improve = [];
  if (reports === 3) wentWell.push('All three science reports reached Mission Control.');
  else improve.push(`Only ${reports} of 3 reports were sent. The primary mission is not complete.`);
  if (scans === 3) wentWell.push('All three survey sites were sampled.');
  else improve.push(`${3 - scans} survey site${3 - scans === 1 ? '' : 's'} were never sampled.`);
  if (submitted >= 2) wentWell.push(`${submitted} of 4 optional contracts were claimed, adding resources when they mattered.`);
  if (submitted < 2) improve.push('Most contracts went unclaimed. They are free resources when completed.');
  if (avgResources >= 55) wentWell.push(`The outpost ended with an average resource level of ${Math.round(avgResources)}%.`);
  else if (avgResources < 35) improve.push(`Average resources finished at ${Math.round(avgResources)}%. The pantry and tanks were running on fumes.`);
  if (peakDose < ECONOMY.radiation.safeDose) wentWell.push(`Peak radiation stayed at ${peakDose.toFixed(1)}, below the 30-point health threshold.`);
  else improve.push(`Peak radiation reached ${peakDose.toFixed(1)}. Above 30, maximum health is permanently capped.`);
  if (shelterUses > 0) wentWell.push(`The storm shelter was used ${shelterUses} time${shelterUses === 1 ? '' : 's'} during radiation windows.`);
  else if (state.stats.stormsSurvived > 0) improve.push('The storm shelter was never used. A locked shelter cuts dose dramatically.');
  if (shelterUses === 0 && state.stats.stormsSurvived === 0) improve.push('No radiation windows were survived; check the forecast and shelter earlier.');
  if (broken > 0) improve.push(`${broken} machine${broken === 1 ? ' is' : 's are'} still broken. Repairs cost power but stop a cascade.`);
  if (state.stats.repairs >= 3) wentWell.push(`You completed ${state.stats.repairs} repairs, keeping machines online.`);
  if (victory) wentWell.push(`Victory in ${ticks} game hours (${sols} sol${sols === 1 ? '' : 's'}).`);
  else if (timeout) improve.push('The 300-hour mission clock expired before the third report.');
  else if (state.cause === 'oxygen') improve.push('Oxygen hit zero and the suit reserve ran out. Repair the O2 system first.');
  else if (state.cause === 'radiation') improve.push('Accumulated radiation reached 100. Dose never decays; shelter earlier.');
  else if (state.cause === 'starvation') improve.push('The crew starved. Hydroponics and pantry stock are life support, not optional.');
  else if (state.cause === 'dehydration') improve.push('The crew dehydrated. The water recycler is the only source.');
  else if (state.cause === 'life_support') improve.push('Life support failed. Watch the cascade from energy to O2 to the crew.');
  if (!improve.length) improve.push('Nothing major. This is a clean run — try the final-hour demo for a harder start.');
  if (!wentWell.length) wentWell.push('You kept trying. Use the mission board and the forecast earlier next run.');

  const timeline = sim.log.entries.slice(-14).map((entry) => {
    const described = timelineLabel(entry);
    return { tick: entry.tick, icon: described.icon, text: described.text };
  });

  const sourceIds = new Set(['bvad', 'crater']);
  for (const entry of sim.log.entries) {
    if (entry.payload?.source && entry.payload.source !== 'gameplay') sourceIds.add(entry.payload.source);
  }
  if (reports > 0) sourceIds.add('mission');
  if (state.resources.energy !== undefined) sourceIds.add('ogs');

  const title = victory ? 'MISSION COMPLETE' : timeout ? 'MISSION INCOMPLETE' : 'MISSION FAILED';
  const subtitle = victory
    ? 'Three reports delivered. The science mission is complete and the outpost is still standing.'
    : timeout
      ? 'The 300-hour clock expired with the science mission unfinished.'
      : state.cause === 'oxygen'
        ? 'The oxygen reserve ran out before the outpost could recover.'
        : state.cause === 'radiation'
          ? 'Accumulated radiation reached the fatal dose.'
          : state.cause === 'starvation'
            ? 'The crew ran out of food.'
            : state.cause === 'dehydration'
              ? 'The crew ran out of water.'
              : 'Life support failed before the mission could be completed.';

  return {
    result: victory ? 'victory' : 'defeat',
    victory,
    cause: state.cause,
    timeout,
    title,
    subtitle,
    grade,
    score,
    reports,
    scans,
    contracts: submitted,
    contractsReady: ready,
    avgResources,
    peakDose,
    shelterUses,
    sols,
    ticks,
    broken,
    cards: [
      {
        id: 'reports',
        icon: 'report',
        label: 'REPORTS SENT',
        value: `${reports} / 3`,
        detail: victory ? 'Primary mission complete' : 'Primary mission incomplete',
        tone: reports >= 3 ? 'good' : 'bad',
      },
      {
        id: 'contracts',
        icon: 'contract',
        label: 'CONTRACTS COMPLETED',
        value: `${submitted} / 4`,
        detail: ready ? `${ready} still ready but unclaimed` : 'Optional objectives',
        tone: submitted >= 2 ? 'good' : 'warn',
      },
      {
        id: 'resources',
        icon: 'gauge',
        label: 'AVERAGE RESOURCES',
        value: `${Math.round(avgResources)}%`,
        detail: `O2 ${Math.round(percentages[0])} · Water ${Math.round(percentages[1])} · Food ${Math.round(
          percentages[2]
        )} · Power ${Math.round(percentages[3])}`,
        tone: avgResources >= 50 ? 'good' : avgResources >= 30 ? 'warn' : 'bad',
      },
      {
        id: 'radiation',
        icon: 'radiation',
        label: 'PEAK DOSE / SHELTER USES',
        value: `${peakDose.toFixed(1)} · ${shelterUses}`,
        detail: peakDose < 30 ? 'Stayed below the health cap' : 'Maximum health was capped',
        tone: peakDose < 30 ? 'good' : peakDose < 70 ? 'warn' : 'bad',
      },
      {
        id: 'time',
        icon: 'clock',
        label: 'SOLS ELAPSED',
        value: `${sols}`,
        detail: `${ticks} game hours · limit ${ECONOMY.time.missionTicks} h`,
        tone: 'neutral',
      },
    ],
    wentWell: wentWell.slice(0, 5),
    improve: improve.slice(0, 5),
    timeline,
    sources: [...sourceIds],
  };
}

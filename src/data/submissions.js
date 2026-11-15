/**
 * Submission rows.
 *
 * Exactly four fixed condition enums, never free-form expressions. A submission
 * is evaluated against live state every tick. When ready it can be claimed from
 * the communications console; claiming converts the reward directly into
 * resources (no second currency).
 */

export const SUBMISSIONS = [
  {
    id: 'storm_watch',
    nameKey: 'submission.storm_watch.name',
    descriptionKey: 'submission.storm_watch.desc',
    condition: 'reading_before_event',
    params: { eventId: 'storm_sep_may10', counter: 'scans' },
    reward: { energy: 12 },
    source: 'gameplay',
  },
  {
    id: 'field_survey',
    nameKey: 'submission.field_survey.name',
    descriptionKey: 'submission.field_survey.desc',
    condition: 'counter_reached',
    params: { counter: 'scans', target: 2 },
    reward: { food: 10, water: 10 },
    source: 'gameplay',
  },
  {
    id: 'water_watch',
    nameKey: 'submission.water_watch.name',
    descriptionKey: 'submission.water_watch.desc',
    condition: 'resource_below_and_repaired',
    params: { resource: 'water', threshold: 45, machineId: 'water_recycler', minCondition: 50 },
    reward: { water: 16, energy: 6 },
    source: 'gameplay',
  },
  {
    id: 'science_delivery',
    nameKey: 'submission.science_delivery.name',
    descriptionKey: 'submission.science_delivery.desc',
    condition: 'total_reports_sent',
    params: { target: 3 },
    reward: { energy: 20 },
    source: 'gameplay',
  },
];

export const SUBMISSION_BY_ID = Object.fromEntries(SUBMISSIONS.map((row) => [row.id, row]));

export const CONDITION_TYPES = [
  'reading_before_event',
  'counter_reached',
  'resource_below_and_repaired',
  'total_reports_sent',
];

export function getSubmission(id) {
  return SUBMISSION_BY_ID[id] ?? null;
}

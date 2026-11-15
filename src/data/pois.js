/**
 * Exterior survey sites. Three POIs, one tool: hold position while the in-world
 * scanner fills, then carry the sample back to the communications console.
 */

export const POIS = [
  {
    id: 'site_a',
    code: 'A',
    nameKey: 'poi.site_a.name',
    descriptionKey: 'poi.site_a.desc',
    scienceKey: 'poi.site_a.science',
    sampleKey: 'sample.site_a',
    reportKey: 'report.site_a',
    position: [-16, 0, 31],
    scanSeconds: 3,
    dose: 0.4,
    source: 'mission',
  },
  {
    id: 'site_b',
    code: 'B',
    nameKey: 'poi.site_b.name',
    descriptionKey: 'poi.site_b.desc',
    scienceKey: 'poi.site_b.science',
    sampleKey: 'sample.site_b',
    reportKey: 'report.site_b',
    position: [2, 0, 41],
    scanSeconds: 3,
    dose: 0.4,
    source: 'mission',
  },
  {
    id: 'site_c',
    code: 'C',
    nameKey: 'poi.site_c.name',
    descriptionKey: 'poi.site_c.desc',
    scienceKey: 'poi.site_c.science',
    sampleKey: 'sample.site_c',
    reportKey: 'report.site_c',
    position: [18, 0, 49],
    scanSeconds: 3,
    dose: 0.4,
    source: 'mission',
  },
];

export const POI_BY_ID = Object.fromEntries(POIS.map((poi) => [poi.id, poi]));

export function getPoi(id) {
  return POI_BY_ID[id] ?? null;
}

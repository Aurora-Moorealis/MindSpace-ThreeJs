/**
 * Provenance registry.
 *
 * Every gameplay row that shows a number points at one of these entries. Rows
 * backed by archived NASA data carry `real_data: true`; anything tuned only for
 * the game carries `real_data: false` and is rendered with a SIMULATED badge.
 *
 * No network requests are made at runtime. Links are only opened when the user
 * explicitly clicks them in the Data Sources panel.
 */

export const SOURCES = {
  bvad: {
    id: 'bvad',
    label: 'NASA Life Support Baseline Values and Assumptions Document',
    short: 'NASA BVAD · life support',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
    secondaryUrl:
      'https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Reference crew metabolic rates: oxygen 0.84 kg/day, food solids 0.62 kg/day, drinking water 2.0 kg/day. The game normalises these rates into 0-100 resource units, so bar movement is compressed for playability; ratios between resources are preserved.',
  },
  eclss: {
    id: 'eclss',
    label: 'NASA ECLSS life support presentation (Space Portal 2021)',
    short: 'NASA ECLSS · consumables',
    url: 'https://ntrs.nasa.gov/citations/20210013975',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Regenerative life support masses: oxygen 0.84 kg, food solids 0.62 kg, drinking water 2.0 kg per crew member per day. Used to anchor the resource consumption rows.',
  },
  ogs: {
    id: 'ogs',
    label: 'ISS Oxygen Generation System parameters',
    short: 'ISS OGS · oxygen generation',
    url: 'https://ntrs.nasa.gov/citations/20180002051',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'ISS Oxygen Generation System: up to 20.4 lb/day oxygen, 23 lb/day water consumption, 3955 W peak power. The in-game O2 system uses a scaled power/water ratio inspired by these figures.',
  },
  crater: {
    id: 'crater',
    label: 'LRO CRaTER — lunar radiation environment',
    short: 'LRO CRaTER · lunar dose',
    url: 'https://doi.org/10.1002/2013SW000995',
    secondaryUrl: 'https://doi.org/10.1038/s41526-021-00143-x',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Lunar surface total absorbed dose ~0.318 mGy/day (LND), lunar orbit CRaTER average ~0.197 mGy/day (2010-2020). The game converts these rates into a cumulative 0-100 dose budget over the 300-hour mission; it is an educational abstraction, not a clinical radiation model.',
  },
  donki_cme: {
    id: 'donki_cme',
    label: 'NASA DONKI — CME 2024-05-08T22:24:00-CME-001',
    short: 'DONKI M2M · 2024-05-08',
    url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/CME/30640/3',
    date_archived: '2026-11-15',
    event_date: '2024-05-08T22:24:00Z',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Full-halo CME from AR 13664, X1.0 flare source. Estimated bulk speed 1130 km/s, half-angle 40 deg, direction LON 12 / LAT -16. WSA-ENLIL modelled an Earth shock arrival at 2024-05-10T23:46Z. The in-game radiation window is scaled from this archived event.',
  },
  donki_sep: {
    id: 'donki_sep',
    label: 'NASA DONKI — SEP 2024-05-10T14:50:00-SEP-001',
    short: 'DONKI SEP · 2024-05-10',
    url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/SEP/30684/1',
    date_archived: '2026-11-15',
    event_date: '2024-05-10T14:50:00Z',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Solar energetic particle event detected by STEREO A (IMPACT 13-100 MeV). Flux exceeded 0.1 pfu/MeV at 2024-05-10T14:50Z. Used as the basis for the second radiation window.',
  },
  donki_cme_may9: {
    id: 'donki_cme_may9',
    label: 'NASA DONKI — CME 2024-05-09T09:24:00-CME-001',
    short: 'DONKI CME · 2024-05-09',
    url: 'https://ccmc.gsfc.nasa.gov/TP/2024-05-TP-02/',
    date_archived: '2026-11-15',
    event_date: '2024-05-09T09:24:00Z',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'CME associated with the X2.2 flare from AR 13664. Estimated speed 1330 km/s, half-angle 45 deg. The May 2024 DONKI time-period page collects all five linked CMEs from the Gannon storm. Used as the basis for the third radiation window.',
  },
  donki_gst: {
    id: 'donki_gst',
    label: 'NASA DONKI — Geomagnetic storm 2024-05-10T15:00:00-GST-001',
    short: 'DONKI GST · 2024-05-10 · Kp 9',
    url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/GST/30693/1',
    date_archived: '2026-11-15',
    event_date: '2024-05-10T15:00:00Z',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Severe-to-extreme geomagnetic storm (Gannon event) linked to five CMEs. NOAA Kp reached 9.0 during the 2024-05-11T00:00Z synoptic period. Used as the basis for the peak radiation window.',
  },
  gameplay: {
    id: 'gameplay',
    label: 'Outpost Lunar gameplay balance',
    short: 'Simulated for this game',
    url: '',
    date_archived: '2026-11-15',
    archived: true,
    real_data: false,
    kind: 'simulated',
    note: 'Values tuned for a short, readable game session. Machine reliability, repair costs, event timing and crew health response are simulated, not measured.',
  },
  mission: {
    id: 'mission',
    label: 'Outpost Lunar mission script',
    short: 'Simulated for this game',
    url: '',
    date_archived: '2026-11-15',
    archived: true,
    real_data: false,
    kind: 'simulated',
    note: 'Survey sites, report titles and the Artemis Ridge outpost layout are fictional content created for the game.',
  },
};

export const SOURCE_LIST = Object.values(SOURCES);

export function getSource(id) {
  return SOURCES[id] ?? SOURCES.gameplay;
}

export function sourceBadgeLabel(source) {
  return source?.real_data ? 'NASA ARCHIVE' : 'SIMULATED';
}

export function isRealSource(source) {
  return Boolean(source?.real_data && source?.url);
}

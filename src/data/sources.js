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
  lcross_ice: {
    id: 'lcross_ice',
    label: 'NASA LCROSS / LRO — Lunar South Pole Water Ice',
    short: 'NASA LCROSS · H₂O ice',
    url: 'https://www.nasa.gov/mission-pages/lcross/',
    secondaryUrl: 'https://doi.org/10.1126/science.1189526',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'LCROSS impact in Cabeus crater (2009) measured ~5.6 ± 2.9% water ice by mass in permanently shadowed lunar south pole regolith. Primary Artemis ISRU feedstock for drinking water, oxygen electrolysis and propellant.',
  },
  ilmenite_isru: {
    id: 'ilmenite_isru',
    label: 'NASA Lunar Sourcebook — Ilmenite (FeTiO₃) Oxygen Extraction',
    short: 'NASA Lunar Sourcebook · FeTiO₃',
    url: 'https://ntrs.nasa.gov/citations/19910018026',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Ilmenite (FeTiO₃, Mohs 5.0–6.0) reaches 10–15 vol% in high-Ti Apollo 11/17 mare basalts and is NASA’s benchmark ore for hydrogen-reduction oxygen extraction (FeTiO₃ + H₂ → Fe + TiO₂ + H₂O → O₂).',
  },
  apollo_anorthite: {
    id: 'apollo_anorthite',
    label: 'NASA Apollo 16 / Artemis ISRU — Highland Anorthite (CaAl₂Si₂O₈)',
    short: 'NASA Apollo 16 · Anorthite',
    url: 'https://ntrs.nasa.gov/citations/20190025372',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Anorthite plagioclase (CaAl₂Si₂O₈, Mohs 6.0–6.5) comprises >70% of lunar highland crust sampled by Apollo 16. Contains ~46% oxygen by mass plus Al, Ca and Si for molten regolith electrolysis and habitat shielding.',
  },
  apollo_olivine: {
    id: 'apollo_olivine',
    label: 'NASA Lunar Sourcebook — Lunar Olivine ((Mg,Fe)₂SiO₄)',
    short: 'NASA Lunar Sourcebook · Olivine',
    url: 'https://ntrs.nasa.gov/citations/19910018026',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'Magnesium-iron silicate ((Mg,Fe)₂SiO₄, Mohs 6.5–7.0) abundant in lunar mare basalts and South Pole-Aitken ejecta (Apollo 12/15/17). High-hardness refractory mineral used for thermal shielding and silicate metallurgy.',
  },
  sev_chariot: {
    id: 'sev_chariot',
    label: 'NASA Space Exploration Vehicle (SEV) / Lunar Electric Rover (Chariot)',
    short: 'NASA JSC · SEV / Chariot',
    url: 'https://ntrs.nasa.gov/citations/20100024417',
    secondaryUrl: 'https://www.nasa.gov/directorates/somd/space-exploration-vehicle/',
    date_archived: '2026-11-15',
    archived: true,
    real_data: true,
    kind: 'nasa',
    note: 'NASA Johnson Space Center 12-wheel (6-bogie) pressurized truck-like lunar prototype: ~3,000–4,000 kg class, 10 km/h top speed, 360° crab steering, forward-angled panoramic cab, rear suitports and 14-day crew range.',
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

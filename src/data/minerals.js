/**
 * Lunar ISRU minerals (max 4), infinite exterior ore veins, and the NASA
 * Space Exploration Vehicle (SEV / Chariot) truck-like prototype.
 */

export const MINERAL_ORDER = ['water_ice', 'ilmenite', 'anorthite', 'olivine'];

export const MINERALS = {
  water_ice: {
    id: 'water_ice',
    name: 'Water Ice',
    short: 'H₂O ICE',
    formula: 'H₂O (regolith ice)',
    mohs: '1.5–2.0',
    mineSeconds: 2.5,
    color: 0x7ce8ff,
    hex: '#7ce8ff',
    emissive: 0x1a6a88,
    bonus: { resource: 'water', amount: 8, label: '+8% Water' },
    nasaFact:
      'LCROSS detected ~5.6% water ice by mass in permanently shadowed south pole regolith; key Artemis feedstock for drinking water and O₂ electrolysis.',
    source: 'lcross_ice',
  },
  ilmenite: {
    id: 'ilmenite',
    name: 'Ilmenite',
    short: 'ILMENITE',
    formula: 'FeTiO₃',
    mohs: '5.0–6.0',
    mineSeconds: 4.0,
    color: 0x7480a8,
    hex: '#8ea2ff',
    emissive: 0x22294a,
    bonus: { resource: 'o2', amount: 8, label: '+8% Oxygen' },
    nasaFact:
      'High-Ti mare basalt ore (10–15 vol% in Apollo 11/17 samples). NASA’s benchmark mineral for hydrogen-reduction O₂ extraction (FeTiO₃ + H₂ → Fe + TiO₂ + H₂O).',
    source: 'ilmenite_isru',
  },
  anorthite: {
    id: 'anorthite',
    name: 'Anorthite',
    short: 'ANORTHITE',
    formula: 'CaAl₂Si₂O₈',
    mohs: '6.0–6.5',
    mineSeconds: 5.0,
    color: 0xd9e2ec,
    hex: '#dce8f5',
    emissive: 0x3b4859,
    bonus: { resource: 'energy', amount: 10, label: '+10% Energy' },
    nasaFact:
      'Makes up >70% of lunar highland crust (Apollo 16). Contains ~46% oxygen by mass plus Al, Ca and Si for molten regolith electrolysis and shielding.',
    source: 'apollo_anorthite',
  },
  olivine: {
    id: 'olivine',
    name: 'Olivine',
    short: 'OLIVINE',
    formula: '(Mg,Fe)₂SiO₄',
    mohs: '6.5–7.0',
    mineSeconds: 6.0,
    color: 0x7ee081,
    hex: '#7ee081',
    emissive: 0x1c4a24,
    bonus: { resource: 'suit', amount: 8, label: '+8% Suit Integrity' },
    nasaFact:
      'Dense magnesium-iron silicate (Mohs 6.5–7) found in Apollo 12/15/17 mare basalts and South Pole-Aitken ejecta; valued for refractory thermal shielding.',
    source: 'apollo_olivine',
  },
};

export const MINERAL_VEINS = [
  // Water Ice (2.5s — softest)
  { id: 'vein_ice_1', mineralId: 'water_ice', position: [-22, 0, 22] },
  { id: 'vein_ice_2', mineralId: 'water_ice', position: [-10, 0, 38] },
  { id: 'vein_ice_3', mineralId: 'water_ice', position: [10, 0, 54] },

  // Ilmenite (4.0s — medium)
  { id: 'vein_ilm_1', mineralId: 'ilmenite', position: [-32, 0, 35] },
  { id: 'vein_ilm_2', mineralId: 'ilmenite', position: [8, 0, 31] },
  { id: 'vein_ilm_3', mineralId: 'ilmenite', position: [-4, 0, 52] },

  // Anorthite (5.0s — hard)
  { id: 'vein_ano_1', mineralId: 'anorthite', position: [24, 0, 40] },
  { id: 'vein_ano_2', mineralId: 'anorthite', position: [-26, 0, 48] },
  { id: 'vein_ano_3', mineralId: 'anorthite', position: [36, 0, 52] },

  // Olivine (6.0s — hardest)
  { id: 'vein_oli_1', mineralId: 'olivine', position: [-18, 0, 56] },
  { id: 'vein_oli_2', mineralId: 'olivine', position: [34, 0, 23] },
  { id: 'vein_oli_3', mineralId: 'olivine', position: [14, 0, 38] },
];

export const NASA_PROTOTYPE_TRUCK = {
  id: 'sev_chariot',
  name: 'NASA SEV / Chariot Prototype',
  subtitle: 'Lunar Electric Rover · 12-Wheel Pressurized Truck',
  position: [28, 0, 29],
  rotationY: -0.55,
  specs: [
    'Chassis: 12-wheel (6-bogie) 360° crab-steering Chariot platform',
    'Cab: Forward-angled panoramic cockpit, 2 crew, rear suitports',
    'Performance: ~3,000–4,000 kg class · 10 km/h · 14-day excursion range',
  ],
  nasaFact:
    'Built at NASA Johnson Space Center, the Space Exploration Vehicle (SEV / LER) pairs a truck-like pressurized cab with a 12-wheel omnidirectional chassis for Artemis surface traverses.',
  source: 'sev_chariot',
};

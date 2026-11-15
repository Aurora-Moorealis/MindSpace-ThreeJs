# Evaluator Guide — Outpost Lunar

This guide is for **NASA Space Apps Challenge 2026** evaluators reviewing
*Outpost Lunar — Junior Astronaut Mission Trainer* (challenge: *Junior Astronaut
Mission Trainer*). It covers what to run, what to look at, how the project uses
NASA data, and what is deliberately simplified so you can separate the real data
from the game design.

The code, interfaces and this guide are in English; the design and research
notes in `docs/` are in Spanish (the team's working language) and are not needed
to evaluate the experience.

---

## 1. What the project is

A single-player browser game built with **Three.js** and **Vite**, adapted from a
Godot 4.7 design document. The player is a lone astronaut in a five-room lunar
base who must:

- keep **oxygen, water, food and power** above zero;
- manage **radiation dose** across 300 game hours;
- scan **3 exterior sites**, carry the samples back and transmit **3 scientific
  reports** over a delayed Earth–Moon link;
- survive five event archetypes, including solar radiation windows taken from
  archived NASA DONKI events.

Every run ends on an evaluation screen with counters, a timeline and the fate of
the mission save.

---

## 2. Run it in two minutes

Requirements: Node.js 22+, a desktop browser with WebGL.

```bash
npm install
npm run dev
# open http://127.0.0.1:5173/
```

Production check (audit + tests + build):

```bash
npm run check
```

Optional headless browser tour (Playwright):

```bash
npx playwright install chromium
node scripts/smoke.mjs
```

No API keys, accounts, network access or GPU are required. It runs offline.

---

## 3. Suggested review path (about 10 minutes)

1. **Title screen** → `CONTINUE FREEPLAY` or start a mission.
2. **Demo presets** — from the title, load *Mid-mission* or *Final hour* to see
   the full arc without a 300-hour run (each is a few minutes).
3. **Base** — open a machine with `E`. Check the panel: current level, upgrade
   benefit **and** its trade-off, energy cost and installation time.
4. **Exterior** — scan a site by standing still for 3 seconds, then return to the
   comms console.
5. **Comms console** — send a report and watch it stay queued until the next
   4-hour relay pass; check the countdown, the contracts tab and the Data Sources
   tab.
6. **Radiation** — check the HUD dose in points and mSv, and the glossary entry
   that states the conversion and its limits.
7. **Pause** (`P`) — controls, glossary, data sources.
8. **Evaluation** — finish or fail a run (or use a preset) to see the counters and
   timeline.

No install is needed to judge the concept: `dist/` is a static build that can be
served with any static file server.

---

## 4. How the project maps to the challenge

| Challenge intent | What the game does | Where to check |
| --- | --- | --- |
| Train junior astronauts (ages 7–12) | Single-session mission, readable HUD, contextual help, glossary of 10 terms | `src/ui/`, `src/data/glossary.js` |
| Teach life support | Four resources, hourly consumption, O₂ system, recycler, hydroponics | `src/core/sim.js`, `src/data/` |
| Teach radiation | Dose never decreases, thresholds at 30/70/100 points, medical abort at 250 mSv | HUD, dose detail, `docs/DATA-SOURCES.md` |
| Use real NASA data | Archived DONKI events drive radiation windows; CRaTER, BVAD, ECLSS inform rates and budgets | `src/data/sources.js`, `src/data/events.js` |
| Show lunar operations | EVA scanning, sample handling, DSN relay passes, 2.56 s round-trip delay | `src/world/`, comms console |
| Be honest about simulation | Every row is labelled `NASA ARCHIVE` or `SIMULATED`; simplifications documented | Data Sources panel, `docs/DATA-SOURCES.md` |

---

## 5. NASA data provenance

**Official challenge resource used:** DONKI (CCMC), with four archived events:

- CME `2024-05-08T22:24:00-CME-001` — 1130 km/s, AR 13664, X1.0
- SEP `2024-05-10T14:50:00-SEP-001` — STEREO A, 13–100 MeV
- CME `2024-05-09T09:24:00-CME-001` — 1330 km/s
- GST `2024-05-10T15:00:00-GST-001` — Kp 9 (Gannon storm)

**Additional NASA sources used** (not in the challenge's resource tab):
LRO CRaTER/LND for lunar dose references, NASA BVAD (NASA/TP-2015-218570/REV2)
for consumables per crew member per day, and ECLSS/ISS OGS for O₂ generation and
water/power consumption references.

Each source row carries its URL and an ISO date. The in-game **Data Sources**
panel is the authoritative list of what is used; the repository deliberately does
not enumerate unused resources.

---

## 6. Scientific accuracy: what is real and what is compressed

The design keeps a documented boundary between data and game design:

| Item | Real reference | In-game treatment |
| --- | --- | --- |
| Dose budget | LRO CRaTER/LND rates; NASA-STD-3001 limit | Normalised to 0–100 points; 1 point = 2.5 mSv; 250 mSv limit |
| Consumables | BVAD: 0.84 kg O₂, 0.62 kg food solids, 2.0 kg water per person/day | Same daily orders of magnitude, tuned for a 300-hour run |
| Light delay | 1.28 s each way, 2.56 s round trip | Shown as real; reports are queued |
| Relay passes | Real DSN scheduling takes days | Fixed 4-game-hour pass so waiting fits a session |
| Hydroponics | Leafy greens around 28 days | 30 game-hour cycle across 3 trays, declared in the panel |
| Day/night | Lunar day is 29.53 Earth days | 24 game hours (12 light / 12 dark), labelled MISSION DAY |

The game states the compression in the HUD, the pause menu, the glossary and the
panels. It is an educational abstraction, not an operational or clinical model.

---

## 7. Engineering and verification

- **Deterministic simulation:** `src/core/sim.js` advances on fixed ticks,
  independent of rendering; the ×5/×10 multipliers change tick rate, not physics.
- **Data audit:** `npm run audit` validates unique ids, references, ranges,
  provenance (`real_data` rows need URL + ISO date) and that presets do not start
  in a death cascade.
- **Tests:** `npm test` runs the simulation, data, save and evaluation suites with
  `node:test`.
- **Build:** `npm run build` produces a static site in `dist/`.
- **No runtime network calls:** models, fonts and NASA data are bundled; external
  links open only on click.
- **Graceful degradation:** missing or corrupt GLBs fall back to procedural
  geometry.
- **Local save:** `localStorage` key `outpost-lunar.save.v1`, including report
  queue and crop state.

---

## 8. Known limitations

- The final S/A/B/C/D grade is cosmetic and does **not** reproduce an official
  NASA Space Apps rubric.
- The README still lists `1`/`2`/`3` for clock speed, but the current build uses
  `1`–`5` to select inventory and changes speed from the HUD buttons.
- Browser-only: a Windows build would require packaging the web build.
- Software rendering (SwiftShader) is slow and is not representative of GPU
  performance.
- Two open tabs share the same save key; the last write wins. Single-tab use is
  intended.

---

## 9. Repository map

| Path | Contents |
| --- | --- |
| `src/core/` | Simulation, event ledger, evaluation, audit, audio |
| `src/data/` | Economy, machines, events, contracts, POIs, strings, sources, glossary, presets |
| `src/world/` | Scene, base, exterior, astronaut and 3D model loading |
| `src/ui/` | HUD, panels, comms console, glossary, screens, debug overlay |
| `tests/` | Simulation, data and evaluation tests (`node:test`) |
| `scripts/` | Data audit, balance simulation, Playwright smoke test, Blender model build |
| `docs/` | Original design, adaptation notes, data sources, playtest checklist, screenshots |

---

## 10. Submission links

- Repository: <https://github.com/Aurora-Moorealis/MindSpace-ThreeJs>
- Playable build: `npm run dev` locally, or serve `dist/` statically

> Independent educational game inspired by the *Junior Astronaut Mission
> Trainer* challenge. Not an official NASA product and not endorsed by NASA.

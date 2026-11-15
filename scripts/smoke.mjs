import { chromium } from 'playwright';
import fs from 'node:fs';

const outDir = '/tmp/opencode/outpost';
fs.mkdirSync(outDir, { recursive: true });

const executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
const nextFrames = async (count = 2) => {
  await page.evaluate(
    (frames) =>
      new Promise((resolve) => {
        let left = frames;
        const step = () => {
          left -= 1;
          if (left <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    count
  );
};
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('favicon')) errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
await page.screenshot({ path: `${outDir}/01-title.png` });
console.log('title', await page.evaluate(() => window.__outpost?.app?.phase));

await page.locator('[data-action="new"]').click();
await page.waitForTimeout(1100);
await page.screenshot({ path: `${outDir}/02-intro.png` });

await page.locator('[data-action="skip"]').click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/03-tutorial.png` });

for (let i = 0; i < 5; i += 1) {
  const next = page.locator('#dialogue-next');
  if (await next.isVisible().catch(() => false)) {
    await next.click();
    await page.waitForTimeout(300);
  }
}
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/04-game.png` });
console.log('phase', await page.evaluate(() => window.__outpost.app.phase));

// Force several simulation ticks to reach the first storm and show the HUD at work.
await page.evaluate(() => {
  const sim = window.__outpost.sim;
  for (let i = 0; i < 8; i += 1) sim.tick();
  sim.drainNotifications();
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/05-game-storm.png` });
console.log('state', await page.evaluate(() => {
  const s = window.__outpost.sim.state;
  return { tick: s.tick, o2: +s.resources.o2.toFixed(1), water: +s.resources.water.toFixed(1), energy: +s.resources.energy.toFixed(1), dose: +s.radiation.toFixed(1) };
}));

// Teleport around the base for visual checks.
async function teleport(x, z) {
  await page.evaluate(({ x, z }) => {
    const app = window.__outpost.app;
    app.player.x = x;
    app.player.z = z;
    window.__outpost.world.astronaut.setPosition(x, z);
  }, { x, z });
  await page.waitForTimeout(600);
}

await teleport(-26, -8);
await page.screenshot({ path: `${outDir}/06-dormitory.png` });
await teleport(-4, -6);
await page.screenshot({ path: `${outDir}/07-greenhouse.png` });
await teleport(15, -5);
await page.screenshot({ path: `${outDir}/08-power.png` });
await teleport(17, 8);
await page.screenshot({ path: `${outDir}/09-workshop.png` });
await teleport(-21, 7.5);
await page.screenshot({ path: `${outDir}/10-comms-room.png` });

// Open the comms console and send a report? There are no samples yet. Show the panel.
await teleport(-24, 8.5);
await page.keyboard.press('KeyE');
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/11-comms-panel.png` });
console.log('panel', await page.evaluate(() => window.__outpost.app.panel));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Machine panel at the O2 system.
await teleport(10, 9.2);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/12-machine-panel.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Shelter panel.
await teleport(-24, -12);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/13-shelter-panel.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Outside: solar array and POI.
await teleport(13, 21);
await page.screenshot({ path: `${outDir}/14-solar-outside.png` });
await teleport(-16, 31);
await page.screenshot({ path: `${outDir}/15-poi.png` });

// Debug overlay.
await page.keyboard.press('F1');
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/16-debug.png` });
await page.keyboard.press('F1');
await page.waitForTimeout(300);

// Pause menu and sources.
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/17-pause.png` });
await page.locator('.pause-actions [data-action="sources"]').click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/18-sources.png` });
await page.locator('.sources-panel .modal-close').click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Autosave and resume. Force one tick without waiting a full minute.
await page.evaluate(() => {
  window.__outpost.app.tickAccum = 60;
});
await page.waitForTimeout(800);
const saved = await page.evaluate(() => localStorage.getItem('outpost-lunar.save.v1'));
if (!saved) errors.push('save: no autosave key after a tick');
const savedTick = await page.evaluate(() => {
  const raw = localStorage.getItem('outpost-lunar.save.v1');
  return raw ? JSON.parse(raw).missions.artemis_ridge.tick : -1;
});
console.log('save tick', savedTick, 'bytes', saved?.length ?? 0);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const titleState = await page.evaluate(() => ({
  saveInfo: window.__outpost?.app?.saveInfo,
  saveError: window.__outpost?.app?.saveError,
  actions: [...document.querySelectorAll('.title-actions [data-action]')].map((node) => node.dataset.action),
  status: document.querySelector('.mission-save-status')?.textContent ?? '',
}));
console.log('title state', titleState);
const continueVisible = await page.locator('[data-action="continue"]').isVisible().catch(() => false);
if (!continueVisible) errors.push('save: continue button missing after reload');
await page.locator('[data-action="continue"]').click();
await page.waitForTimeout(1500);
const resumed = await page.evaluate(() => ({
  phase: window.__outpost.app.phase,
  tick: window.__outpost.sim.state.tick,
}));
if (resumed.phase !== 'game' || resumed.tick < savedTick) {
  errors.push(`save: resume mismatch ${JSON.stringify({ resumed, savedTick })}`);
}
await page.screenshot({ path: `${outDir}/19-resumed.png` });

// Mission markers: scanning A must move the current target to comms, and
// sending its report must mark A as reported and point at B.
const markersStart = await page.evaluate(() => ({
  current: window.__outpost.world.currentMissionTarget,
  states: Object.fromEntries(window.__outpost.world.missionStates),
}));
await page.evaluate(() => window.__outpost.sim.completeScan('site_a'));
await page.waitForTimeout(400);
await nextFrames(2);
const markersAfterScan = await page.evaluate(() => ({
  current: window.__outpost.world.currentMissionTarget,
  states: Object.fromEntries(window.__outpost.world.missionStates),
  samples: window.__outpost.sim.state.samples,
  reports: window.__outpost.sim.state.reports,
}));
const reportResult = await page.evaluate(() => window.__outpost.sim.sendReport('site_a'));
await page.waitForTimeout(400);
await nextFrames(2);
const markersAfterReport = await page.evaluate(() => ({
  current: window.__outpost.world.currentMissionTarget,
  states: Object.fromEntries(window.__outpost.world.missionStates),
  samples: window.__outpost.sim.state.samples,
  reports: window.__outpost.sim.state.reports,
}));
console.log('marker scan', markersAfterScan, 'report', reportResult, 'after', markersAfterReport);
if (markersStart.current !== 'site_a' || markersStart.states.site_a !== 'pending') {
  errors.push(`markers: bad start state ${JSON.stringify(markersStart)}`);
}
if (markersAfterScan.current !== 'comms_console' || markersAfterScan.states.site_a !== 'sampled') {
  errors.push(`markers: bad state after scan ${JSON.stringify(markersAfterScan)}`);
}
if (markersAfterReport.current !== 'site_b' || markersAfterReport.states.site_a !== 'reported') {
  errors.push(`markers: bad state after report ${JSON.stringify(markersAfterReport)}`);
}

// Reload the run with A reported and confirm the markers are restored at once.
await page.evaluate(() => window.__outpost.goToTitle());
await page.waitForTimeout(900);
await page.locator('[data-action="continue"]').click();
await page.waitForTimeout(1500);
await nextFrames(2);
const markersRestored = await page.evaluate(() => ({
  current: window.__outpost.world.currentMissionTarget,
  states: Object.fromEntries(window.__outpost.world.missionStates),
  reports: window.__outpost.sim.state.reports,
}));
if (markersRestored.current !== 'site_b' || markersRestored.states.site_a !== 'reported') {
  errors.push(`markers: bad restored state ${JSON.stringify(markersRestored)}`);
}

// Sprint: Shift while moving must cover more ground than walking, and Shift
// alone must not cancel a scan.
async function resetPlayer(x, z) {
  await page.evaluate(({ x, z }) => {
    const app = window.__outpost.app;
    app.player.x = x;
    app.player.z = z;
    app.keys.clear();
    app.scan = null;
    app.paused = false;
    app.panel = null;
    window.__outpost.world.astronaut.setPosition(x, z);
  }, { x, z });
  await page.waitForTimeout(150);
}

await resetPlayer(0, 25);
const walkStart = await page.evaluate(() => window.__outpost.app.player.z);
await page.keyboard.down('KeyS');
await nextFrames(3);
await page.keyboard.up('KeyS');
await nextFrames(1);
const walkEnd = await page.evaluate(() => window.__outpost.app.player.z);

await resetPlayer(0, 25);
await page.keyboard.down('Shift');
await page.keyboard.down('KeyS');
await nextFrames(3);
await page.keyboard.up('KeyS');
await page.keyboard.up('Shift');
await nextFrames(1);
const sprintEnd = await page.evaluate(() => window.__outpost.app.player.z);
const walkDistance = Math.abs(walkEnd - walkStart);
const sprintDistance = Math.abs(sprintEnd - 25);
if (!(sprintDistance > walkDistance * 1.25)) {
  errors.push(`sprint: walk=${walkDistance.toFixed(2)} sprint=${sprintDistance.toFixed(2)}`);
}

await resetPlayer(2, 41);
await page.keyboard.press('KeyE');
await page.waitForTimeout(300);
await nextFrames(2);
await page.evaluate(() => {
  if (window.__outpost.app.scan) window.__outpost.app.scan.duration = 60;
});
const scanStarted = await page.evaluate(() => Boolean(window.__outpost.app.scan));
await page.keyboard.down('Shift');
await nextFrames(2);
const scanAfterShift = await page.evaluate(() => Boolean(window.__outpost.app.scan));
await page.keyboard.down('KeyW');
await nextFrames(2);
await page.keyboard.up('KeyW');
await page.keyboard.up('Shift');
const scanAfterMove = await page.evaluate(() => Boolean(window.__outpost.app.scan));
if (!scanStarted) errors.push('sprint: scan did not start at site A');
if (!scanAfterShift) errors.push('sprint: Shift alone cancelled the scan');
if (scanAfterMove) errors.push('sprint: movement did not cancel the scan');

// Corrupt save: the title must warn and keep booting instead of resuming.
await page.evaluate(() => window.__outpost.goToTitle());
await page.waitForTimeout(700);
await page.evaluate(() => localStorage.setItem('outpost-lunar.save.v1', '{broken'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
const saveStatus = await page.locator('.mission-save-status').textContent().catch(() => '');
if (!saveStatus.toUpperCase().includes('UNREADABLE')) {
  errors.push(`save: corrupt save did not show a warning (got "${saveStatus}")`);
}
await page.screenshot({ path: `${outDir}/20-corrupt-save.png` });

// Demo preset from the title. A demo must not touch the real save key.
await page.locator('[data-action="demo-final"]').click();
await page.waitForTimeout(1700);
await page.screenshot({ path: `${outDir}/21-demo-final.png` });
console.log('demo state', await page.evaluate(() => {
  const s = window.__outpost.sim.state;
  return { tick: s.tick, reports: s.reports.length, samples: s.samples, phase: window.__outpost.app.phase };
}));

console.log('\nERRORS:', errors.length);
for (const error of errors) console.log(' -', error);
await browser.close();

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
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('favicon')) errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
await page.screenshot({ path: `${outDir}/01-title.png` });
console.log('title', await page.evaluate(() => window.__outpost?.app?.phase));

await page.locator('[data-action="start"]').click();
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

// Demo preset from the title.
await page.evaluate(() => window.__outpost.goToTitle());
await page.waitForTimeout(700);
await page.locator('[data-action="demo-final"]').click();
await page.waitForTimeout(1700);
await page.screenshot({ path: `${outDir}/19-demo-final.png` });
console.log('demo state', await page.evaluate(() => {
  const s = window.__outpost.sim.state;
  return { tick: s.tick, reports: s.reports.length, samples: s.samples, phase: window.__outpost.app.phase };
}));

console.log('\nERRORS:', errors.length);
for (const error of errors) console.log(' -', error);
await browser.close();

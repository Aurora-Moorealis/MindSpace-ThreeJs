/**
 * Outpost Lunar — bootstrap, state machine and game loop.
 *
 * Flow: title -> intro stills -> Mission Control tutorial -> game -> evaluation.
 * The simulation is tick-based and independent of the render loop; the player
 * moves in real time and can pause or change the tick rate at any moment.
 */

import '@fontsource/orbitron/latin-400.css';
import '@fontsource/orbitron/latin-500.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/rajdhani/latin-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import './ui/styles.css';

import * as THREE from 'three';
import { Stage } from './world/scene.js';
import { World } from './world/world.js';
import { ROOMS } from './world/base.js';
import { GameSim } from './core/sim.js';
import { AudioManager } from './core/audio.js';
import { HUD } from './ui/hud.js';
import { NotificationCenter } from './ui/notifications.js';
import { MachinePanel } from './ui/machine-panel.js';
import { CommsPanel } from './ui/comms-panel.js';
import { PauseMenu, ControlsModal, MissionBoardPanel } from './ui/menus.js';
import { SourcesModal } from './ui/sources-view.js';
import { TitleScreen, IntroScreen, EvaluationScreen } from './ui/screens.js';
import { DialogueBox } from './ui/dialogue.js';
import { DebugOverlay } from './ui/debug.js';
import { loadDemoPreset } from './data/demo-states.js';
import { MACHINES } from './data/machines.js';
import { POIS } from './data/pois.js';
import { MINERALS, NASA_PROTOTYPE_TRUCK } from './data/minerals.js';
import { STRINGS } from './data/strings.js';
import { ECONOMY } from './data/economy.js';

const app = {
  phase: 'boot',
  session: 0,
  paused: false,
  autoPaused: false,
  transitioning: false,
  speed: 1,
  tickAccum: 0,
  time: 0,
  player: { x: 0, z: 2.5 },
  facing: 0,
  outside: false,
  inShelter: false,
  wasOutside: false,
  nearest: null,
  interaction: null,
  objective: null,
  objectiveId: null,
  scan: null,
  panel: null,
  demo: false,
  presetId: null,
  freeplay: false,
  muted: false,
  intro: { step: 0, elapsed: 0 },
  endingTimer: 0,
  fps: 60,
  keys: new Set(),
  uiTimer: 0,
  panelTimer: 0,
  debugVisible: false,
  selectedSlot: 0,
};

let stage;
let sim;
let world;
let audio;
let hud;
let notifications;
let machinePanel;
let commsPanel;
let missionBoard;
let pauseMenu;
let controlsModal;
let sourcesModal;
let titleScreen;
let introScreen;
let evaluationScreen;
let dialogue;
let debugOverlay;
let fadeEl;
let stormOverlay;
let appEl;

const cameraTarget = new THREE.Vector3();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createLoadingScreen() {
  const node = document.createElement('div');
  node.className = 'loading-screen';
  node.innerHTML = `
    <div class="loading-mark">OL</div>
    <div class="loading-title">OUTPOST LUNAR</div>
    <div class="loading-bar"><div></div></div>
    <div class="loading-detail">INITIALISING ARTEMIS RIDGE · LOADING NASA DATA ARCHIVE</div>
  `;
  return node;
}

function showFatalError(error) {
  const node = document.createElement('div');
  node.className = 'loading-screen';
  node.innerHTML = `
    <div class="loading-mark">!</div>
    <div class="loading-title">OUTPOST LUNAR COULD NOT START</div>
    <div class="loading-detail" style="max-width:560px;text-align:center;line-height:1.5">
      ${String(error?.message ?? error).replaceAll('<', '&lt;')}<br><br>
      This game needs a WebGL-capable desktop browser with JavaScript enabled.
    </div>
  `;
  document.getElementById('app')?.append(node);
}

async function boot() {
  appEl = document.getElementById('app');
  fadeEl = document.getElementById('fade');
  const loading = createLoadingScreen();
  appEl.append(loading);

  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('600 40px Rajdhani'),
        document.fonts.load('700 40px Orbitron'),
        document.fonts.load('500 20px Rajdhani'),
      ]),
      wait(1600),
    ]);
    await Promise.race([document.fonts.ready, wait(800)]);

    const canvas = document.getElementById('scene');
    stage = new Stage(canvas);
    sim = new GameSim();
    audio = new AudioManager();

    const screenLayer = document.createElement('div');
    screenLayer.id = 'screen-layer';
    appEl.append(screenLayer);

    const drawerLayer = document.createElement('div');
    drawerLayer.id = 'drawer-layer';
    appEl.append(drawerLayer);

    stormOverlay = document.createElement('div');
    stormOverlay.className = 'storm-vignette';
    appEl.append(stormOverlay);

    world = new World(stage.scene, sim);
    for (const light of world.base.lights ?? []) stage.registerInteriorLight(light);
    world.astronaut.setPosition(app.player.x, app.player.z);

    setupUI(screenLayer, drawerLayer);
    setupInput();
    goToTitle(true);

    // Initial visible frame.
    stage.setEnvironment({ time: 0, storm: 0, outside: false, lightsOn: true });
    world.update(0.016, sim, { nearest: null, moving: false, outside: false, time: 0, storm: 0 });
    stage.setMode('title');
    stage.updateCamera(0.016, {});

    requestAnimationFrame(loop);
    loading.classList.add('fade-out');
    setTimeout(() => loading.remove(), 550);

    // Test / debug hook. Deliberately read-only entry points for automated smoke tests.
    window.__outpost = {
      app,
      sim,
      world,
      stage,
      startNewGame,
      goToTitle,
      beginGameplay,
      openComms,
      openMachinePanel,
      sourcesModal,
      audio,
    };
  } catch (error) {
    console.error(error);
    loading.remove();
    showFatalError(error);
  }
}

function setupUI(screenLayer, drawerLayer) {
  const overlayLayer = document.getElementById('overlay-layer');
  const bannerLayer = document.getElementById('banner-layer');
  const toastLayer = document.getElementById('toast-layer');
  const hudRoot = document.getElementById('hud');
  const debugRoot = document.getElementById('debug');

  hud = new HUD(hudRoot, {
    onSpeed: setSpeed,
    onPause: togglePause,
    onMenu: () => openPauseMenu(false),
    onSound: toggleMute,
    onSource: openSources,
    onSlot: selectInventorySlot,
  });

  notifications = new NotificationCenter({
    bannerLayer,
    toastLayer,
    onSource: openSources,
  });

  sourcesModal = new SourcesModal(overlayLayer);
  controlsModal = new ControlsModal(overlayLayer);

  machinePanel = new MachinePanel(drawerLayer, {
    onClose: () => {
      if (app.panel === 'machine') app.panel = null;
    },
    onRepair: (id) => {
      const result = sim.startRepair(id);
      if (!result.ok) actionError(result);
      flushNotifications();
      machinePanel.refresh(sim);
      refreshHud();
      audio.play('click');
    },
    onUpgrade: (id, upgradeId) => {
      const result = sim.startUpgrade(id, upgradeId);
      if (!result.ok) actionError(result);
      flushNotifications();
      machinePanel.refresh(sim);
      refreshHud();
      audio.play('click');
    },
    onToggle: (id) => {
      sim.toggleSystem(id);
      flushNotifications();
      machinePanel.refresh(sim);
      refreshHud();
      audio.play('click');
    },
    onPowerToggle: (system) => {
      sim.toggleSystem(system);
      flushNotifications();
      machinePanel.refresh(sim);
      refreshHud();
      audio.play('click');
    },
    onClean: () => {
      startCleanTask();
    },
    onShelter: () => {
      if (!sim.state.shelterLocked && !app.inShelter) {
        notifications.toast({
          kind: 'warn',
          title: 'Get inside first',
          body: 'The storm pod only protects you if you are inside it when it seals.',
          icon: 'lock',
        });
        audio.play('error');
        return;
      }
      sim.toggleShelter();
      flushNotifications();
      machinePanel.refresh(sim);
      refreshHud();
      audio.play('click');
    },
    onSuitRepair: () => {
      const result = sim.repairSuit();
      if (!result.ok) actionError(result);
      flushNotifications();
      machinePanel.refresh(sim);
      refreshHud();
      audio.play('click');
    },
    onOpenComms: () => {
      machinePanel.close();
      openComms();
    },
    onSource: openSources,
    onSources: () => openSources(),
  });

  commsPanel = new CommsPanel(overlayLayer, {
    onClose: () => {
      if (app.panel === 'comms') app.panel = null;
      refreshHud();
    },
    onSendReport: (poiId) => {
      const result = sim.sendReport(poiId);
      if (!result.ok) actionError(result);
      flushNotifications();
      commsPanel.refresh(sim, true);
      refreshHud();
      audio.play('report');
      if (sim.state.over) triggerEnding();
    },
    onClaim: (submissionId) => {
      const result = sim.claimSubmission(submissionId);
      if (!result.ok) actionError(result);
      flushNotifications();
      commsPanel.refresh(sim, true);
      refreshHud();
      audio.play('click');
    },
    onSupply: () => {
      const result = sim.requestSupply();
      if (!result.ok) actionError(result);
      flushNotifications();
      commsPanel.refresh(sim, true);
      refreshHud();
      audio.play('click');
    },
    onSource: openSources,
  });

  missionBoard = new MissionBoardPanel(drawerLayer, {
    onClose: () => {
      if (app.panel === 'mission') app.panel = null;
    },
    onSources: () => openSources(),
  });

  pauseMenu = new PauseMenu(overlayLayer, {
    onResume: closePauseMenu,
    onRestart: () => {
      pauseMenu.close();
      app.paused = false;
      startNewGame({ skipIntro: true, skipTutorial: true });
    },
    onMenu: () => {
      pauseMenu.close();
      app.paused = false;
      goToTitle();
    },
    onSources: () => openSources(),
    onSound: toggleMute,
  });

  titleScreen = new TitleScreen(screenLayer, {
    onStart: () => {
      audio.unlock();
      startNewGame();
    },
    onDemo: (id) => {
      audio.unlock();
      startNewGame({ presetId: id });
    },
    onSources: () => openSources(),
    onControls: () => controlsModal.open(),
  });

  introScreen = new IntroScreen(screenLayer, {
    onNext: () => advanceIntro(),
    onSkip: () => finishIntro(),
  });

  evaluationScreen = new EvaluationScreen(screenLayer, {
    onFreeplay: () => enterFreeplay(),
    onRetry: () => {
      evaluationScreen.close();
      startNewGame({ skipIntro: true, skipTutorial: true });
    },
    onMenu: () => {
      evaluationScreen.close();
      goToTitle();
    },
    onSources: () => openSources(),
  });

  dialogue = new DialogueBox(document.getElementById('overlay-layer'));

  debugOverlay = new DebugOverlay(debugRoot, {
    onLoadPreset: (id) => startNewGame({ presetId: id }),
  });
}

function setupInput() {
  const movementCodes = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ]);

  const unlock = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'F1') {
      event.preventDefault();
      app.debugVisible = debugOverlay.toggle(sim, buildDebugCtx());
      return;
    }
    if (event.code === 'KeyM') {
      event.preventDefault();
      toggleMute();
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      handleEscape();
      return;
    }
    if (event.code === 'KeyP') {
      if (app.phase === 'game') {
        event.preventDefault();
        togglePause();
      }
      return;
    }
    if (
      ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'].includes(
        event.code
      ) &&
      app.phase === 'game' &&
      !app.panel &&
      !hasBlockingModal()
    ) {
      event.preventDefault();
      selectInventorySlot(Number(event.code.slice(-1)) - 1);
      return;
    }
    if (event.code === 'Enter' || event.code === 'Space') {
      if (event.repeat) return;
      if (app.phase === 'title' && !hasBlockingModal()) {
        event.preventDefault();
        startNewGame();
        return;
      }
      if (app.phase === 'intro') {
        event.preventDefault();
        advanceIntro();
        return;
      }
      if (app.phase === 'tutorial' && dialogue?.isOpen()) {
        event.preventDefault();
        dialogue.advance();
        return;
      }
    }
    if (event.code === 'KeyE') {
      if (event.repeat) return;
      if (app.phase === 'game') {
        event.preventDefault();
        handleInteract();
      }
      return;
    }
    if (event.code === 'KeyF') {
      if (event.repeat) return;
      if (app.phase === 'game' && !app.paused && !app.panel && !hasBlockingModal()) {
        event.preventDefault();
        handleRefineSelected();
      }
      return;
    }
    if (event.code === 'KeyQ') {
      if (event.repeat) return;
      if (app.phase === 'game' && !app.paused && !app.panel && !hasBlockingModal()) {
        event.preventDefault();
        handleDropSelected();
      }
      return;
    }
    if (movementCodes.has(event.code)) {
      if (app.phase === 'game' && !app.paused && !app.panel) {
        event.preventDefault();
        app.keys.add(event.code);
      }
    }
  });

  window.addEventListener('keyup', (event) => {
    app.keys.delete(event.code);
  });

  window.addEventListener(
    'wheel',
    (event) => {
      if (app.phase === 'game' && !app.paused && !app.panel && !hasBlockingModal()) {
        if (event.shiftKey) {
          stage?.adjustZoom(event.deltaY > 0 ? 2 : -2);
        } else if (event.deltaY !== 0) {
          const step = event.deltaY > 0 ? 1 : 4;
          selectInventorySlot((app.selectedSlot + step) % 5);
        }
      }
    },
    { passive: true }
  );

  window.addEventListener('blur', () => {
    app.keys.clear();
    if (app.phase === 'game' && !app.paused && !app.panel && !evaluationScreen?.isOpen() && !sourcesModal?.isOpen() && !controlsModal?.isOpen()) {
      openPauseMenu(true);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.phase === 'game' && !app.paused && !app.panel) {
      openPauseMenu(true);
    }
  });
}

function hasBlockingModal() {
  return Boolean(
    pauseMenu?.isOpen() ||
      sourcesModal?.isOpen() ||
      controlsModal?.isOpen?.() ||
      evaluationScreen?.isOpen() ||
      app.transitioning
  );
}

function selectInventorySlot(index) {
  const clamped = ((index % 5) + 5) % 5;
  if (clamped === app.selectedSlot) return;
  app.selectedSlot = clamped;
  hud?.setSelectedSlot(clamped);
  audio?.play('click');
}

function setSpeed(value) {
  const allowed = ECONOMY.time.speeds;
  if (!allowed.includes(value)) return;
  app.speed = value;
  if (sim) sim.state.speed = value;
  audio?.play('click');
  refreshHud();
}

function toggleMute() {
  app.muted = !app.muted;
  audio.setMuted(app.muted);
  hud.setSoundMuted(app.muted);
  if (app.muted) {
    notifications.toast({ kind: 'info', title: 'Sound muted', body: 'Press M or use the pause menu to unmute.', icon: 'mute', duration: 2600 });
  } else {
    notifications.toast({ kind: 'info', title: 'Sound on', body: 'Five synthesised cues and a lunar wind bed.', icon: 'sound', duration: 2600 });
  }
}

function handleEscape() {
  if (sourcesModal?.isOpen()) {
    sourcesModal.close();
    return;
  }
  if (controlsModal?.isOpen?.()) {
    controlsModal.close();
    return;
  }
  if (pauseMenu?.isOpen()) {
    closePauseMenu();
    return;
  }
  if (app.panel) {
    closePanels();
    return;
  }
  if (app.phase === 'game') openPauseMenu(false);
}

function openPauseMenu(auto) {
  if (app.phase !== 'game') return;
  closePanels();
  if (app.scan && app.scan.pausedAt == null) app.scan.pausedAt = performance.now();
  app.paused = true;
  app.autoPaused = auto;
  app.panel = 'pause';
  pauseMenu.open(sim, { autoPaused: auto, muted: app.muted });
  audio.play('click');
}

function closePauseMenu() {
  pauseMenu.close();
  if (app.scan?.pausedAt != null) {
    app.scan.pausedMs += performance.now() - app.scan.pausedAt;
    app.scan.pausedAt = null;
  }
  app.paused = false;
  app.panel = null;
  app.autoPaused = false;
  app.keys.clear();
}

function togglePause() {
  if (app.phase !== 'game') return;
  if (app.paused) closePauseMenu();
  else openPauseMenu(false);
}

function closePanels() {
  machinePanel?.close();
  commsPanel?.close();
  missionBoard?.close();
  if (app.panel && app.panel !== 'pause') app.panel = null;
}

function openSources(sourceId = null) {
  sourcesModal.open(sourceId);
  audio.play('click');
}

function openComms() {
  closePanels();
  app.panel = 'comms';
  commsPanel.open(sim, world);
  audio.play('click');
}

function openMachinePanel(id) {
  closePanels();
  app.panel = 'machine';
  machinePanel.open(sim, id, world);
  audio.play('click');
}

function openMissionBoard() {
  closePanels();
  app.panel = 'mission';
  missionBoard.open(sim, world, { objectiveLabel: app.objective?.label ?? '' });
  audio.play('click');
}

function handleInteract() {
  if (app.phase !== 'game' || app.paused || app.panel) return;
  if (app.scan) {
    cancelScan('manual');
    return;
  }
  const nearest = world.getNearestInteractable(app.player, 3.6);
  if (!nearest) return;
  if (nearest.type === 'poi') {
    const poi = world.getPoi(nearest.poiId);
    if (sim.state.scans.includes(poi.id)) {
      notifications.toast({
        kind: 'info',
        title: 'Sample already collected',
        body: 'Take it to the comms console and send the report.',
        icon: 'sample',
        duration: 3200,
      });
      audio.play('click');
      return;
    }
    startScan(poi);
    return;
  }
  if (nearest.type === 'mineral') {
    const equipped = sim.state.hotbar?.[app.selectedSlot]?.id === 'pickaxe';
    if (!equipped) {
      notifications.toast({
        kind: 'warn',
        title: 'Equip Lunar Pickaxe',
        body: 'Select Slot 1 (key 1 or scroll wheel) to equip the pickaxe before mining.',
        icon: 'pickaxe',
        duration: 3200,
      });
      audio.play('error');
      return;
    }
    startMining(nearest);
    return;
  }
  if (nearest.type === 'prototype') {
    notifications.toast({
      kind: 'info',
      title: NASA_PROTOTYPE_TRUCK.name,
      body: `${NASA_PROTOTYPE_TRUCK.nasaFact} (${NASA_PROTOTYPE_TRUCK.specs[2]})`,
      sourceId: NASA_PROTOTYPE_TRUCK.source,
      icon: 'truck',
      duration: 7000,
    });
    audio.play('click');
    return;
  }
  if (nearest.id === 'ice_melter') {
    const result = sim.meltIce();
    if (!result.ok) {
      notifications.toast({
        kind: 'warn',
        title: 'No Water Ice in inventory',
        body: 'Equip the Pickaxe (1) and mine Water Ice veins outside to feed the greenhouse.',
        icon: 'water',
        duration: 3600,
      });
      audio.play('error');
      return;
    }
    notifications.toast({
      kind: 'good',
      title: 'Ice Melter active → Plants irrigated',
      body: 'Melted 1 × Water Ice into liquid H₂O (+12% Water, +4% Food to Hydroponics).',
      sourceId: 'lcross_ice',
      icon: 'water',
      duration: 4800,
    });
    audio.play('success');
    refreshHud();
    return;
  }
  if (nearest.id === 'comms_console') {
    openComms();
    return;
  }
  if (nearest.id === 'mission_board') {
    openMissionBoard();
    return;
  }
  openMachinePanel(nearest.id);
}

function startMining(vein) {
  const mineral = MINERALS[vein.mineralId];
  if (!mineral) return;
  app.scan = {
    type: 'mine',
    targetId: vein.id,
    mineralId: mineral.id,
    progress: 0,
    duration: mineral.mineSeconds,
    startedAt: performance.now(),
    pausedMs: 0,
    pausedAt: null,
    label: `MINING ${mineral.name.toUpperCase()} (${mineral.formula}) · MOHS ${mineral.mohs}`,
  };
  audio.play('scan');
}

function handleRefineSelected() {
  const result = sim.refineHotbarSlot(app.selectedSlot);
  if (!result.ok) {
    notifications.toast({
      kind: 'info',
      title: 'No mineral in selected slot',
      body: 'Select a slot with mined ore (2–5) to refine it for ISRU resources.',
      icon: 'mineral',
      duration: 2800,
    });
    audio.play('error');
    return;
  }
  notifications.toast({
    kind: 'good',
    title: `Refined ${result.mineral.name} (${result.mineral.formula})`,
    body: `ISRU yield applied: ${result.mineral.bonus.label}.`,
    sourceId: result.mineral.source,
    icon: result.mineral.id === 'water_ice' ? 'water' : 'mineral',
    duration: 4200,
  });
  audio.play('success');
  refreshHud();
}

function handleDropSelected() {
  const result = sim.dropHotbarSlot(app.selectedSlot);
  if (!result.ok) {
    if (result.reason === 'locked_tool') {
      notifications.toast({
        kind: 'warn',
        title: 'Cannot drop Lunar Pickaxe',
        body: 'Select an item in slots 2–5 to drop it with Q.',
        icon: 'pickaxe',
        duration: 2600,
      });
      audio.play('error');
    }
    return;
  }
  notifications.toast({
    kind: 'info',
    title: `Dropped ${result.mineral?.name ?? result.droppedId}`,
    body: result.remainingInSlot > 0 ? `${result.remainingInSlot} left in slot.` : 'Hotbar slot freed.',
    icon: 'mineral',
    duration: 2400,
  });
  audio.play('click');
  refreshHud();
}

function startScan(poi) {
  app.scan = {
    type: 'scan',
    targetId: poi.id,
    progress: 0,
    duration: poi.scanSeconds,
    startedAt: performance.now(),
    pausedMs: 0,
    pausedAt: null,
    label: `SCANNING SITE ${poi.code} · ${STRINGS[poi.nameKey].toUpperCase()}`,
  };
  audio.play('scan');
}

function startCleanTask() {
  const solar = world.getMachineWorldPosition('solar_array');
  const distance = Math.hypot(app.player.x - solar.x, app.player.z - solar.z);
  if (distance > 5.4) {
    notifications.toast({
      kind: 'warn',
      title: 'Too far from the array',
      body: 'Walk out to the solar array, then clean the panels from the machine panel or with E.',
      icon: 'energy',
    });
    audio.play('error');
    return;
  }
  machinePanel.close();
  app.panel = null;
  app.scan = {
    type: 'clean',
    targetId: 'solar_array',
    progress: 0,
    duration: 4,
    startedAt: performance.now(),
    pausedMs: 0,
    pausedAt: null,
    label: 'CLEANING SOLAR ARRAY · DOSE ACCRUES OUTSIDE',
  };
  audio.play('scan');
}

function cancelScan(reason) {
  if (!app.scan) return;
  const wasClean = app.scan.type === 'clean';
  const wasMine = app.scan.type === 'mine';
  app.scan = null;
  if (reason !== 'completed') {
    notifications.toast({
      kind: 'info',
      title: wasMine ? 'Mining interrupted' : wasClean ? 'Cleaning interrupted' : 'Scan cancelled',
      body: 'Stay still and keep the target in range while the progress bar fills.',
      icon: wasMine ? 'pickaxe' : 'scan',
      duration: 3000,
    });
  }
}

function completeScanTask() {
  if (!app.scan) return;
  const task = app.scan;
  app.scan = null;
  if (task.type === 'scan') {
    const result = sim.completeScan(task.targetId);
    if (!result.ok) actionError(result);
  } else if (task.type === 'mine') {
    const result = sim.mineMineral(task.mineralId);
    if (result.ok) {
      notifications.toast({
        kind: 'good',
        title: `+1 ${result.mineral.name} (${result.mineral.formula})`,
        body: `${result.mineral.nasaFact} Stored in slot ${result.slotIndex + 1} (×${result.count} total).`,
        sourceId: result.mineral.source,
        icon: result.mineral.id === 'water_ice' ? 'water' : 'mineral',
        duration: 5500,
      });
      audio.play('success');
    } else if (result.reason === 'hotbar_full') {
      notifications.toast({
        kind: 'warn',
        title: 'Hotbar full',
        body: 'All 5 slots are full. Press Q on a mineral slot to drop an item (or F to refine).',
        icon: 'alert',
        duration: 4500,
      });
      audio.play('error');
    }
  } else {
    const result = sim.cleanSolarArray();
    if (!result.ok) actionError(result);
  }
  flushNotifications();
  refreshHud();
  updateObjective(true);
  const poi = POIS.find((p) => p.id === task.targetId);
  if (task.type === 'scan' && poi) {
    transitionsStoryForFirstScan(poi);
  }
}

let firstScanStoryShown = false;
function transitionsStoryForFirstScan(poi) {
  if (firstScanStoryShown) return;
  firstScanStoryShown = true;
  const session = app.session;
  setTimeout(() => {
    if (app.phase !== 'game' || app.session !== session) return;
    notifications.story(
      'MISSION CONTROL',
      `${STRINGS[poi.scienceKey]} Your sample is aboard. Bring it to the comms console for the report.`,
      'sample'
    );
  }, 1400);
}

function actionError(result) {
  const messages = {
    no_energy: 'Not enough power. Shed a non-critical system or let the battery charge.',
    busy: 'A job is already running on this machine.',
    healthy: 'This is already in good condition.',
    broken: 'Repair the machine before installing an upgrade.',
    installed: 'That upgrade is already installed.',
    in_transit: 'A supply drop is already on the way.',
    cooldown: 'The supply request channel is still cooling down.',
    outage: 'The Deep Space Network is down. Try again after the outage.',
    no_sample: 'No sample aboard for that site.',
    already_sent: 'That report has already been sent.',
    not_ready: 'That contract is not ready to claim yet.',
    claimed: 'That contract has already been claimed.',
    clean: 'The panels are already clean.',
    unknown: 'Action unavailable.',
  };
  notifications.toast({
    kind: 'warn',
    title: 'Action blocked',
    body: messages[result.reason] ?? messages.unknown,
    icon: 'alert',
    duration: 3600,
  });
  audio.play('error');
}

function flushNotifications() {
  if (!sim) return;
  const notes = sim.drainNotifications();
  if (notes.length) {
    notifications.handle(notes, sim, { onSound: (name) => audio.play(name) });
  }
}

function triggerEnding() {
  if (app.phase === 'ending' || app.phase === 'evaluation') return;
  if (!sim.state.over) return;
  closePanels();
  machinePanel?.close();
  commsPanel?.close();
  missionBoard?.close();
  pauseMenu?.close();
  app.panel = null;
  app.paused = false;
  app.scan = null;
  app.phase = 'ending';
  app.endingTimer = 0;
  app.endingStartedAt = performance.now();
  app.objective = null;
  app.objectiveId = null;
  world.setObjective(null);
  refreshHud();
  notifications.clearBanner();
  audio.play(sim.state.over === 'victory' ? 'report' : 'alarm');
}

function showEvaluation() {
  app.phase = 'evaluation';
  hud.show(false);
  notifications.clear();
  stormOverlay.style.opacity = '0';
  stage.setMode('overview');
  stage.titleTime = 0;
  evaluationScreen.open(sim);
  audio.play(sim.state.over === 'victory' ? 'report' : 'event');
}

function enterFreeplay() {
  const result = sim.continueFreeplay();
  if (!result.ok) return;
  evaluationScreen.close();
  app.phase = 'game';
  app.freeplay = true;
  app.paused = false;
  app.panel = null;
  app.tickAccum = 0;
  hud.show(true);
  stage.setMode('follow');
  stage.snapFollow(cameraTarget.set(app.player.x, 0.9, app.player.z));
  notifications.story('FREEPLAY', 'The primary mission is complete. The outpost keeps running; no further objectives will trigger.', 'target');
  audio.play('click');
}

function goToTitle(initial = false) {
  app.session += 1;
  app.phase = 'title';
  app.paused = false;
  app.autoPaused = false;
  app.transitioning = false;
  app.demo = false;
  app.presetId = null;
  app.freeplay = false;
  app.speed = 1;
  app.tickAccum = 0;
  app.scan = null;
  app.nearest = null;
  app.interaction = null;
  app.objective = null;
  app.objectiveId = null;
  app.wasOutside = false;
  app.keys.clear();
  firstScanStoryShown = false;

  machinePanel?.close();
  commsPanel?.close();
  missionBoard?.close();
  pauseMenu?.close();
  sourcesModal?.close();
  controlsModal?.close();
  evaluationScreen?.close();
  introScreen?.destroy();
  dialogue?.close();
  notifications?.clear();

  sim.reset();
  sim.state.speed = 1;
  const spawn = world.getSpawn();
  app.player = { x: spawn.x, z: spawn.z };
  app.facing = 0;
  world.astronaut.setPosition(app.player.x, app.player.z);
  world.astronaut.setFacing(0);
  world.astronaut.group.rotation.y = 0;
  world.setObjective(null);
  hud.show(false);
  titleScreen.show();
  stage.setMode('title');
  stage.titleTime = 0;
  stage.setEnvironment({ time: 2, storm: 0, outside: false, lightsOn: true });
  world.update(0.016, sim, { nearest: null, moving: false, outside: false, time: 2, storm: 0 });
  stormOverlay.style.opacity = '0';
  if (!initial) audio.play('click');
}

function startNewGame({ presetId = null, skipIntro = false, skipTutorial = false } = {}) {
  if (app.transitioning) return;
  app.transitioning = true;
  app.session += 1;
  app.keys.clear();
  fadeEl.classList.add('visible');
  audio.play('click');

  setTimeout(() => {
    try {
  machinePanel?.close();
  commsPanel?.close();
  missionBoard?.close();
  pauseMenu?.close();
  sourcesModal?.close();
  controlsModal?.close();
  evaluationScreen?.close();
  introScreen?.destroy();
  dialogue?.close();
  notifications?.clear();
  if (debugOverlay?.visible) debugOverlay.toggle();

  sim.reset();
  app.paused = false;
  app.speed = 1;
  sim.state.speed = 1;
  app.tickAccum = 0;
  app.scan = null;
  app.nearest = null;
  app.interaction = null;
  app.demo = false;
  app.presetId = null;
  app.freeplay = false;
  app.wasOutside = false;
  app.objectiveId = null;
  app.panel = null;
  firstScanStoryShown = false;
  const spawn = world.getSpawn();
  app.player = { x: spawn.x, z: spawn.z };
  app.facing = 0;
  world.astronaut.setPosition(app.player.x, app.player.z);
  world.astronaut.setFacing(0);
  world.astronaut.group.rotation.y = 0;
  world.setObjective(null);
  hud.show(false);
  titleScreen.hide();

  if (presetId) {
    try {
      const preset = loadDemoPreset(sim, presetId);
      app.demo = true;
      app.presetId = presetId;
      app.speed = preset.speed;
      sim.state.speed = preset.speed;
      app.player = { x: preset.player.x, z: preset.player.z };
      app.facing = preset.player.facing ?? 0;
      world.astronaut.setPosition(app.player.x, app.player.z);
      world.astronaut.setFacing(app.facing);
      world.astronaut.group.rotation.y = app.facing;
      sim.setPresence({ outside: false, inShelter: false });
      beginGameplay({ silent: true });
      const storm = sim.getNextRadiationWindow();
      notifications.story(
        'DEMO STATE',
        `${preset.description}${storm ? ` Next radiation window in ${storm.onset - sim.state.tick} game hours.` : ''}`,
        'storm'
      );
    } catch (error) {
      console.error(error);
      goToTitle();
      notifications.toast({
        kind: 'critical',
        title: 'DEMO PRESET REJECTED',
        body: error.message,
        icon: 'alert',
        duration: 7000,
      });
    }
  } else if (skipIntro) {
    beginGameplay({ silent: skipTutorial });
    notifications.story(
      'MISSION CONTROL',
      'Fresh outpost, clock running. Check the mission board in the hub if you need a refresher.',
      'comms'
    );
  } else {
    app.phase = 'intro';
    app.intro = { step: 0, elapsed: 0, startedAt: performance.now() };
    stage.setMode('cinematic');
    stage.setCinematicShot(0, 0);
    introScreen.show();
    introScreen.showStep(0);
    hud.show(false);
    app.tickAccum = 0;
  }
    } finally {
      app.transitioning = false;
      fadeEl.classList.remove('visible');
    }
  }, 380);
}

function advanceIntro() {
  if (app.phase !== 'intro') return;
  const now = performance.now();
  if (app.intro.lastAdvance && now - app.intro.lastAdvance < 420) return;
  app.intro.lastAdvance = now;
  app.intro.step += 1;
  app.intro.elapsed = 0;
  app.intro.startedAt = performance.now();
  if (app.intro.step >= 3) {
    finishIntro();
    return;
  }
  introScreen.showStep(app.intro.step);
  stage.setCinematicShot(app.intro.step, 0);
  audio.play('click');
}

function finishIntro() {
  if (app.phase !== 'intro') return;
  introScreen.destroy();
  app.phase = 'tutorial';
  app.tickAccum = 0;
  stage.setMode('follow');
  stage.snapFollow(cameraTarget.set(app.player.x, 0.9, app.player.z));
  hud.show(true);
  updateObjective(true);
  refreshHud();
  const lines = [
    "Aurora here, your ground link. Scan three surface sites, then send three reports from the comms console. WASD to move, E to interact, and 1 / 2 / 3 to change time speed.",
    STRINGS['tutorial.1'],
    STRINGS['tutorial.2'],
    STRINGS['tutorial.3'],
  ];
  dialogue.open({
    lines,
    onComplete: () => beginGameplay({ silent: false }),
    onSkip: () => beginGameplay({ silent: true }),
  });
  audio.play('event');
}

function beginGameplay({ silent = false } = {}) {
  app.phase = 'game';
  app.paused = false;
  app.panel = null;
  app.autoPaused = false;
  app.tickAccum = 0;
  introScreen.destroy();
  dialogue.close();
  titleScreen.hide();
  evaluationScreen.close();
  hud.show(true);
  hud.setSoundMuted(app.muted);
  stage.setMode('follow');
  stage.snapFollow(cameraTarget.set(app.player.x, 0.9, app.player.z));
  updatePresence(true);
  updateObjective(true);
  refreshHud();
  if (!silent) {
    audio.play('event');
  }
}

function updatePresence(silent = false) {
  const outside = app.player.z > 16.4;
  const shelter = MACHINES.storm_shelter.position;
  const inShelter = !outside && Math.hypot(app.player.x - shelter[0], app.player.z - shelter[2]) < 2.7;
  app.outside = outside;
  app.inShelter = inShelter;
  sim.setPresence({ outside, inShelter });
  if (!silent && outside !== app.wasOutside && app.phase === 'game') {
    if (outside) {
      notifications.toast({
        kind: 'warn',
        title: 'EVA started',
        body: 'Dose accumulates outside the habitat. Watch the forecast and the suit integrity.',
        sourceId: 'crater',
        icon: 'radiation',
        duration: 4600,
      });
    } else {
      notifications.toast({
        kind: 'info',
        title: 'Habitat shielding restored',
        body: 'Inside the outpost, normal radiation gain stops.',
        icon: 'target',
        duration: 3000,
      });
    }
  }
  app.wasOutside = outside;
}

function computeObjective() {
  const s = sim.state;
  if (s.reports.length >= 3) return null;
  let targetId = null;
  let label = '';
  if (s.samples.length > 0) {
    targetId = 'comms_console';
    label = 'Deliver the sample — comms console';
  } else {
    const next = POIS.find((poi) => !s.scans.includes(poi.id));
    if (next) {
      targetId = next.id;
      label = `Survey Site ${next.code} — ${STRINGS[next.nameKey]}`;
    } else {
      targetId = 'comms_console';
      label = 'Send the remaining reports — comms console';
    }
  }
  const item = world.getInteractable(targetId);
  const distance = item
    ? Math.hypot(app.player.x - item.position.x, app.player.z - item.position.z)
    : null;
  return { id: targetId, label, distance };
}

function updateObjective(force = false) {
  const objective = computeObjective();
  app.objective = objective;
  if (objective?.id !== app.objectiveId || force) {
    app.objectiveId = objective?.id ?? null;
    world.setObjective(objective?.id ?? null);
  }
}

function refreshHud(cachedNearest = undefined) {
  if (!hud || !sim) return;
  const roomId = world.getRoomAt(app.player.x, app.player.z);
  let zoneLabel = 'HABITAT';
  if (app.outside) zoneLabel = 'LUNAR SURFACE';
  else if (app.inShelter && sim.state.shelterLocked) zoneLabel = 'STORM SHELTER';
  else zoneLabel = STRINGS[ROOMS[roomId]?.key] ?? 'HABITAT';
  const suppress = app.phase !== 'game' || app.paused || app.panel;
  const nearest = suppress
    ? null
    : cachedNearest !== undefined
      ? cachedNearest
      : world.getNearestInteractable(app.player, 3.6);
  const pickaxeEquipped = sim.state.hotbar?.[app.selectedSlot]?.id === 'pickaxe';
  app.nearest = nearest;
  app.interaction = nearest ? world.describeInteraction(nearest, { pickaxeEquipped }) : null;
  hud.update(sim, {
    speed: app.speed,
    presence: sim.presence,
    zone: { label: zoneLabel },
    interaction: app.scan ? null : app.interaction,
    scan: app.scan
      ? { label: app.scan.label, progress: app.scan.progress }
      : null,
    demo: app.demo,
    objective: app.objective,
    selectedSlot: app.selectedSlot,
  });
}

function updateScanAndInteractions(dt) {
  if (app.scan) {
    if (app.paused) return;
    if (app.panel) {
      cancelScan('panel');
    } else {
      const targetPos =
        app.scan.type === 'scan' || app.scan.type === 'mine'
          ? world.getInteractable(app.scan.targetId)?.position
          : world.getMachineWorldPosition('solar_array');
      const distance = targetPos
        ? Math.hypot(app.player.x - targetPos.x, app.player.z - targetPos.z)
        : 999;
      const limit = app.scan.type === 'scan' || app.scan.type === 'mine' ? 4.3 : 5.4;
      const moving = app.keys.size > 0;
      if (moving) {
        cancelScan('moved');
      } else if (distance > limit) {
        cancelScan('range');
      } else {
        const now = performance.now();
        if (app.scan.pausedAt != null) {
          app.scan.pausedMs += now - app.scan.pausedAt;
          app.scan.pausedAt = null;
        }
        const elapsed = (now - app.scan.startedAt - app.scan.pausedMs) / 1000;
        app.scan.progress = Math.min(1, elapsed / app.scan.duration);
        if (app.scan.progress >= 1) completeScanTask();
      }
    }
  }
}

function updateGameplay(dt, rawDt) {
  updatePresence();
  const blocking = app.paused || app.panel;
  let moving = false;

  if (!blocking) {
    const keys = app.keys;
    let dx = 0;
    let dz = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      const speed = 5.0 * sim.stats.movement_speed;
      const total = speed * dt;
      const steps = Math.max(1, Math.ceil(dt / 0.05));
      for (let i = 0; i < steps; i += 1) {
        world.move(app.player, (dx * total) / steps, (dz * total) / steps, 0.55);
      }
      app.facing = Math.atan2(dx, dz);
      world.astronaut.setFacing(app.facing);
      moving = true;
      if (app.scan) cancelScan('moved');
    }
  }

  world.astronaut.setPosition(app.player.x, app.player.z);
  updateScanAndInteractions(dt);
  if (app.scan) hud?.updateScan?.({ label: app.scan.label, progress: app.scan.progress });

  if (!app.paused) {
    app.tickAccum += rawDt * app.speed;
    const tickSeconds = ECONOMY.time.realSecondsPerTick;
    let guard = 0;
    while (app.tickAccum >= tickSeconds && guard < 4) {
      app.tickAccum -= tickSeconds;
      guard += 1;
      sim.tick();
      flushNotifications();
      if (sim.state.over) {
        triggerEnding();
        break;
      }
    }
  }

  app.time = sim.state.tick + app.tickAccum / ECONOMY.time.realSecondsPerTick;
  updateObjective();
  const storm = sim.getStorm();
  const stormVisual = storm ? Math.min(1, Math.max(0, storm.intensityNow / 18)) : 0;
  const stormOpacity = (stormVisual * 0.85).toFixed(2);
  if (app.lastStormOpacity !== stormOpacity) {
    app.lastStormOpacity = stormOpacity;
    stormOverlay.style.opacity = stormOpacity;
  }
  stage.setEnvironment({
    time: app.time,
    storm: stormVisual,
    outside: app.outside,
    lightsOn: sim.state.toggles.lights,
  });
  audio.setEnvironment({ outside: app.outside, storm: stormVisual });

  const suppress = app.phase !== 'game' || app.paused || app.panel;
  const nearest = suppress ? null : world.getNearestInteractable(app.player, 3.6);
  app.nearest = nearest;
  world.update(dt, sim, {
    nearest,
    scanProgress: app.scan?.progress ?? 0,
    scanTarget: app.scan?.type === 'scan' ? app.scan.targetId : null,
    mineProgress: app.scan?.progress ?? 0,
    mineTarget: app.scan?.type === 'mine' ? app.scan.targetId : null,
    pickaxeEquipped: sim.state.hotbar?.[app.selectedSlot]?.id === 'pickaxe',
    moving,
    outside: app.outside,
    time: app.time,
    storm: stormVisual,
  });

  stage.updateCamera(dt, {
    target: cameraTarget.set(app.player.x, 0.9, app.player.z),
    outside: app.outside,
  });

  app.uiTimer += rawDt;
  if (app.uiTimer >= 0.1) {
    app.uiTimer = 0;
    refreshHud(nearest);
  }
  app.panelTimer += rawDt;
  if (app.panelTimer >= 0.5) {
    app.panelTimer = 0;
    if (machinePanel?.isOpen()) machinePanel.refresh(sim);
    if (commsPanel?.isOpen()) commsPanel.refresh(sim);
    if (missionBoard?.isOpen()) missionBoard.refresh(sim, app.objective?.label ?? '');
  }

}

function buildDebugCtx() {
  return {
    phase: app.phase,
    speed: app.speed,
    presence: sim.presence,
    player: app.player,
    fps: Math.round(app.fps),
  };
}

function loop(now) {
  const rawDt = Math.min(0.5, Math.max(0, (now - (loop.last ?? now)) / 1000));
  const dt = Math.min(0.1, rawDt);
  loop.last = now;
  if (!stage || !world || !sim) {
    requestAnimationFrame(loop);
    return;
  }
  if (rawDt > 0) app.fps = app.fps * 0.9 + (1 / rawDt) * 0.1;

  if (app.phase === 'title') {
    stage.setEnvironment({ time: 2, storm: 0, outside: false, lightsOn: true });
    world.update(dt, sim, { nearest: null, moving: false, outside: false, time: 2, storm: 0 });
    stage.updateCamera(rawDt, {});
    stormOverlay.style.opacity = '0';
  } else if (app.phase === 'intro') {
    const elapsed = (performance.now() - (app.intro.startedAt ?? performance.now())) / 1000;
    const progress = Math.min(1, elapsed / 6.5);
    introScreen.setProgress(progress);
    stage.intro.progress = progress;
    stage.setEnvironment({ time: 2, storm: 0, outside: false, lightsOn: true });
    world.update(dt, sim, { nearest: null, moving: false, outside: false, time: 2, storm: 0 });
    stage.updateCamera(rawDt, {});
    if (progress >= 1) advanceIntro();
    stormOverlay.style.opacity = '0';
  } else if (app.phase === 'tutorial') {
    updatePresence(true);
    stage.setEnvironment({ time: 0, storm: 0, outside: false, lightsOn: sim.state.toggles.lights });
    world.update(dt, sim, {
      nearest: null,
      moving: false,
      outside: app.outside,
      time: 2,
      storm: 0,
    });
    stage.updateCamera(rawDt, {
      target: cameraTarget.set(app.player.x, 0.9, app.player.z),
      outside: app.outside,
    });
    app.uiTimer += rawDt;
    if (app.uiTimer >= 0.1) {
      app.uiTimer = 0;
      refreshHud();
    }
    stormOverlay.style.opacity = '0';
  } else if (app.phase === 'game') {
    updateGameplay(dt, rawDt);
  } else if (app.phase === 'ending') {
    stage.setEnvironment({
      time: app.time,
      storm: sim.getStorm() ? Math.min(1, sim.getStorm().intensityNow / 18) : 0,
      outside: app.outside,
      lightsOn: sim.state.toggles.lights,
    });
    world.update(dt, sim, {
      nearest: null,
      moving: false,
      outside: app.outside,
      time: app.time,
      storm: 0,
    });
    stage.updateCamera(dt, {
      target: cameraTarget.set(app.player.x, 0.9, app.player.z),
      outside: app.outside,
    });
    if (performance.now() - (app.endingStartedAt ?? performance.now()) >= 2100) showEvaluation();
  } else if (app.phase === 'evaluation') {
    stage.setEnvironment({ time: 2, storm: 0, outside: false, lightsOn: true });
    world.update(rawDt, sim, { nearest: null, moving: false, outside: false, time: 2, storm: 0 });
    stage.updateCamera(rawDt, {});
    stormOverlay.style.opacity = '0';
  }

  if (debugOverlay?.visible) {
    debugOverlay.update(sim, buildDebugCtx(), dt);
  }

  stage.render();
  requestAnimationFrame(loop);
}

boot();

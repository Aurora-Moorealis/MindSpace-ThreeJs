# Design

## Context

La aplicación es una build estática de Vite + Three.js sin backend. `GameSim`
(`src/core/sim.js`) es determinista y su estado es un objeto plano serializable;
`EventLog` ya expone `serialize()` y `seed()`. El flujo de juego vive en
`src/main.js`, la UI de título y evaluación en `src/ui/screens.js`, y el mundo 3D
en `src/world/world.js`.

Hoy el progreso no se conserva: `README.md`, `docs/ADAPTATION.md` y la nota de la
evaluación lo dicen explícitamente. Los tres POIs ya tienen balizas y etiquetas
de estado, y `World.setObjective()` mueve una baliza genérica al objetivo actual.
El movimiento se resuelve en `updateGameplay()` con una velocidad base de 5.0
multiplicada por `sim.stats.movement_speed`.

Restricciones que condicionan el diseño: sin red en runtime, sin dependencias
nuevas, UI en inglés centralizada en `src/data/strings.js`, y simulación
independiente del render.

## Goals / Non-Goals

**Goals:**

- Guardado local versionado, reanudable y validado, con una única escritura por
  tick como máximo.
- Semántica clara de victoria (conserva) y derrota (elimina), sin que una derrota
  en freeplay borre una misión ya completada.
- Título que distingue misión nueva, en curso y completada, con confirmación al
  sobrescribir.
- Sprint perceptible que no toque la simulación ni rompa los escaneos.
- Marcadores de misión persistentes, coherentes con el HUD y visibles desde el
  hábitat.
- Pruebas automatizadas del snapshot y de la validación del guardado.

**Non-Goals:**

- Guardado en la nube, cuentas, varios slots manuales o exportar/importar.
- Guardar presets de demo o el progreso posterior a la victoria en freeplay.
- Estamina, coste de recursos o penalización por sprint.
- Minimapa, pantalla de mapa o brújula en el HUD.
- Controles táctiles.

## Decisions

### 1. Formato y almacenamiento del guardado

Se usa una sola clave de `localStorage`, `outpost-lunar.save.v1`, con un JSON:

```json
{
  "version": 1,
  "missions": {
    "artemis_ridge": {
      "version": 1,
      "missionId": "artemis_ridge",
      "status": "in_progress",
      "savedAt": "2026-11-15T12:00:00.000Z",
      "tick": 42,
      "speed": 1,
      "tickAccum": 0.35,
      "player": { "x": 0, "z": 2.5, "facing": 0 },
      "sim": { "state": {}, "log": [], "presence": {} }
    }
  }
}
```

- **Una clave con un mapa de misiones** en lugar de una clave por misión: permite
  listar y validar todas las misiones de una vez, y una única escritura mantiene
  el archivo coherente. Con una sola misión jugable hoy, el mapa queda preparado
  para las tarjetas futuras.
- **`localStorage` en lugar de IndexedDB**: el estado cabe de sobra, la escritura
  es síncrona (necesaria en `pagehide`) y no añade dependencias. IndexedDB sería
  asíncrona y complicaría el guardado al cerrar; un archivo descargable sería
  manual y no cumple “reanudar donde se quedó”.
- **`GameSim.snapshot()` / `GameSim.restore()`** encapsulan el estado puro:
  `snapshot()` devuelve una copia profunda de `state`, `presence` y
  `log.serialize()`; `restore()` valida, asigna, llama a `log.seed()` y a
  `recomputeStats()`. No se guarda `stats` porque es derivado de las mejoras, ni
  `notifications` porque es transitorio.
- **`src/core/save-game.js`** concentra la persistencia: `readSave(storage)`,
  `writeSave(record, storage)`, `clearSave(storage)`, `buildRecord({ sim, app })`,
  `applyRecord(record, { sim, app })` y `describeSave(record)`. Acepta un
  `storage` inyectable para poder probarlo en Node sin navegador. `readSave()`
  devuelve `{ record, error }` con errores distinguibles (`unavailable`,
  `corrupt`, `version`, `empty`) para que el título avise correctamente.
  `writeSave()` devuelve `false` y no lanza si el almacenamiento falla.
- **Cuarentena de archivos inválidos**: si el JSON no parsea o no valida, se
  intenta copiar el texto crudo a `outpost-lunar.save.v1.broken` y se elimina la
  clave principal; si la copia falla, se elimina igualmente. `readSave()` devuelve
  `{ record: null, error }` y el título muestra el aviso. No se reanuda nunca un
  archivo inválido.

### 2. Ciclo de autoguardado

`src/main.js` llama a `autosave()`:

- después de cada `sim.tick()` que no termine la misión;
- al abrir la pausa (`openPauseMenu`);
- en `visibilitychange` cuando la pestaña se oculta y en `pagehide`;
- antes de `sim.reset()` en `goToTitle()` si la partida estaba en curso.

`autosave()` no hace nada si `app.phase !== 'game'`, `app.demo`, `app.freeplay` o
`sim.state.over`. Guarda `app.tickAccum` para no perder la fracción de hora en
curso. La frecuencia máxima es un tick cada 60 s a ×1 y cada 6 s a ×10, así que
serializar el estado es despreciable. Si una escritura falla, se muestra un aviso
una sola vez (“Progress could not be saved”) y se sigue jugando; el aviso se
reactiva si una escritura posterior vuelve a fallar tras una exitosa.

La victoria y la derrota se resuelven en `triggerEnding()`, que ya es el punto
único al que llegan el tick y `sendReport()`:

- victoria → `writeSave()` con `status: "victory"`;
- derrota → `clearSave()` solo si el guardado existente está `in_progress`.

Así, una derrota en freeplay (misión ya completada) no borra el guardado. El
freeplay no autoguarda: la instantánea de victoria queda congelada y sirve para
reanudar el freeplay desde ese momento.

**Alternativa descartada:** guardar dentro de `GameSim`. Acoplaría el núcleo puro
a `localStorage` y rompería las pruebas headless; la persistencia se queda en la
capa de aplicación.

### 3. Reanudación

`continueMission()` en `src/main.js`:

1. `readSave()`; si hay error, vuelve al título con el aviso.
2. `sim.restore(record.sim)`; si falla, descarta el guardado.
3. Restaura `app.player`, `app.facing`, `app.speed` y `app.tickAccum`; coloca a la
   astronauta y limpia `app.scan`, `app.panel`, `app.paused`, `app.nearest`.
4. Si el registro es `victory`, llama a `sim.continueFreeplay()` cuando
   `state.over === 'victory'` y marca `app.freeplay = true`.
5. `beginGameplay({ silent: true })`, que ya recalcula presencia, objetivo y HUD.
   Se fija `firstScanStoryShown = sim.state.scans.length > 0` para no repetir la
   historia del primer escaneo.

No se reproduce intro ni tutorial. No se guardan paneles, escaneos a medias,
teclas pulsadas ni el estado de sprint; al reanudar se empieza sin paneles, sin
escaneo y caminando.

**Validación adicional:** `restore()` comprueba que los ids de máquinas, POIs,
muestras e informes existen en los datos actuales. Si el contenido cambió y un id
desapareció, el guardado se considera inválido y se descarta con aviso, en lugar
de restaurar un estado incoherente. La posición de la astronauta debe ser finita
y estar dentro de `world.bounds`; si no, se usa el spawn.

### 4. Título: continuar, nueva misión y avisos

`TitleScreen` (`src/ui/screens.js`) recibe el estado del guardado y cambia sus
acciones:

- **Sin guardado**: `START MISSION`, como ahora.
- **En curso**: `CONTINUE MISSION` como acción primaria y `NEW MISSION` como
  secundaria; la tarjeta de Artemis Ridge muestra `IN PROGRESS · SOL N · HH:MM`.
- **Completada**: `CONTINUE FREEPLAY` como primaria y `NEW MISSION` como
  secundaria; la tarjeta muestra `MISSION COMPLETE`.
- **Ilegible**: la tarjeta muestra `SAVE UNREADABLE` y solo se ofrece empezar una
  misión nueva.
- **Almacenamiento no disponible**: la tarjeta muestra `SAVE UNAVAILABLE` y se
  avisa de que el progreso no se guardará; el resto del título funciona igual.

`NEW MISSION` con guardado existente usa una confirmación en dos pasos dentro del
propio botón (“NEW MISSION” → “OVERWRITE SAVE?” durante 4 s), sin `window.confirm`,
que bloquea el canvas y el audio. Confirmar llama a `clearSave()` y arranca la
partida; cancelar no toca nada. Reiniciar desde la pausa y “Run it again” en la
evaluación son acciones explícitas sobre la partida actual: reemplazan el
guardado sin confirmación. Los botones de demo siguen intactos y no escriben ni
borran el guardado.

Los textos nuevos viven en `src/data/strings.js` en inglés:
`ui.continueMission`, `ui.continueFreeplay`, `ui.newMission`, `ui.overwriteSave`,
`ui.saveInProgress`, `ui.saveComplete`, `ui.saveUnreadable`,
`ui.saveUnavailable`, `ui.saveKept`, `ui.saveDeleted`, `ui.sprint`, etc.

### 5. Evaluación y pausa

`EvaluationScreen.open(sim, { saveOutcome })` recibe el resultado del guardado y
sustituye la nota fija “No save file”. `saveOutcome` usa cuatro valores:
`kept` (victoria), `deleted` (derrota), `completed_kept` (derrota en freeplay) y
`unavailable` (no se pudo escribir). La nota resultante es:

- victoria → “Mission complete. Your progress is saved.”
- derrota → “Mission failed. The saved run was deleted.”
- derrota en freeplay → “The completed mission save is kept.”
- almacenamiento no disponible → “Progress could not be saved in this browser.”

La nota del menú de pausa (`src/ui/menus.js`) se actualiza para explicar que el
progreso se guarda solo y que perder la misión borra el guardado. No se añade un
botón de guardado manual: el autoguardado es la única vía.

### 6. Sprint

- `SPRINT_MULTIPLIER = 1.6` como constante en `src/main.js`. Es perceptible sin
  romper la escala del diorama; el valor exacto se puede ajustar en playtest sin
  cambiar los requisitos.
- `ShiftLeft` y `ShiftRight` se siguen en `app.keys` solo durante la partida.
  Se añade `isMovementKey()` / `hasMovementInput()` para distinguir “hay una
  dirección pulsada” de “hay alguna tecla pulsada”.
- **Corrección necesaria:** `updateScanAndInteractions()` usa hoy
  `app.keys.size > 0` para cancelar escaneos. Con Shift en `app.keys`, mantener
  Shift cancelaría el escaneo. Se cambia a `hasMovementInput()`.
- Movimiento: `speed = 5.0 * sim.stats.movement_speed * (sprinting ? 1.6 : 1)`,
  con la misma normalización diagonal y las mismas colisiones de `world.move()`.
- Animación: `Astronaut.update(dt, moving, speedFactor = 1)` acelera `walkPhase`
  con `speedFactor` (1.5 al sprintar) sin cambiar el modelo ni la orientación.
- El sprint no consume recursos ni altera el tick; la dosis depende de ticks, no
  del tiempo real, así que correr no cambia el balance de radiación.
- Se documenta en `controlsMarkup()` (`src/ui/menus.js`), en el README y en la
  primera línea del tutorial. El estado de sprint no se guarda.

**Alternativas descartadas:** sprint en modo toggle (peor para ráfagas cortas),
estamina (fuera de alcance) y multiplicador ligado a una mejora (el usuario lo
pidió como extra disponible desde el principio).

### 7. Marcadores de misión

Se extiende el sistema existente, no se duplica:

- `World.setMissionMarkers({ currentId, scans, samples, reports })` sustituye a
  `setObjective()` como única entrada de señalización. `currentId` sale del mismo
  `computeObjective()` que alimenta el HUD, así que mundo y HUD no pueden
  divergir.
- **Sitios**: cada `buildPoi()` ya tiene anillo, baliza, luz y bandera. Se añade
  `setMissionState(state, current)` con estados `pending`, `sampled`, `reported`:
  - pendiente: baliza teal, anillo vacío, etiqueta `UNSCANNED`;
  - muestra lista: baliza ámbar, etiqueta `SAMPLE READY · TAKE TO COMMS`;
  - informe enviado: baliza verde atenuada, etiqueta `REPORT SENT`;
  - actual: pulso más rápido, anillo y etiqueta a plena opacidad.
- **Consola**: se construye un mástil/baliza permanente sobre
  `MACHINES.comms_console.position` con la misma geometría procedural que la
  baliza de objetivo, a escala reducida. Se resalta cuando `currentId` es
  `comms_console`; el resto del tiempo queda tenue pero visible.
- **Objetivo genérico**: la baliza actual solo se usa para destinos que no son
  POI (la consola). Para un POI actual se reutiliza su propia baliza, evitando dos
  haces superpuestos en el mismo sitio.
- **Etiquetas**: se conserva `WorldLabel`; las de los POIs ya usan
  `depthTest: false`, de modo que se ven desde el hábitat. La baliza y el anillo
  del sitio actual también se dibujan sin prueba de profundidad y con
  `renderOrder` alto para que las paredes no los tapen.
- **Actualización**: `updateObjective()` llama a `world.setMissionMarkers()` cada
  vez que cambia el objetivo y `beginGameplay()` lo hace al cargar. Tras el
  tercer informe, `currentId` es `null`, los tres sitios quedan `reported` y no
  hay resaltado.
- **Sin bloqueo**: son mallas de Three.js sin colliders ni áreas de interacción;
  no afectan a `world.move()` ni a `getNearestInteractable()`.

**Alternativas descartadas:** minimapa o pantalla de mapa (elegido por el usuario
marcadores en el mundo), y una flecha de brújula en el HUD (segunda fuente de
verdad para la dirección).

### 8. Pruebas

- `tests/sim.test.mjs`: ida y vuelta de `snapshot()`/`restore()` (estado, tick,
  recursos, máquinas, muestras, informes y ledger) y continuación determinista:
  avanzar N ticks, snapshot, avanzar M; restaurar y avanzar M debe dar el mismo
  estado.
- Nuevo `tests/save.test.mjs` con un `storage` falso en memoria: registro válido,
  JSON corrupto, versión desconocida, campos faltantes, estado de victoria y
  derrota, `setItem` que lanza (cuota) y `applyRecord()` restaurando una
  simulación.
- No se añaden pruebas de navegador obligatorias; `scripts/smoke.mjs` y la
  checklist de `docs/PLAYTEST.md` cubren título, reanudación, sprint y marcadores.

## Risks / Trade-offs

- **`localStorage` lleno o bloqueado** → el juego avisa de que no puede guardar y
  sigue jugable; ningún fallo de escritura detiene el bucle.
- **Dos pestañas abiertas** → la última escritura gana y puede pisar el progreso
  de la otra. Es una limitación aceptada de un juego de una sola pestaña; el
  formato versionado evita mezclar estados incompatibles.
- **`pagehide` no se dispara en un cierre forzado** → se pierde como máximo el
  último tick no guardado (60 s a ×1, 6 s a ×10). Mitigación: autoguardado por
  tick y al pausar.
- **Cambios de contenido tras guardar** → un id desaparecido invalida el archivo
  y se descarta con aviso; es preferible a restaurar máquinas o POIs fantasma.
- **Doble baliza en el objetivo actual** → se evita reutilizando la baliza del
  POI y reservando la genérica para la consola.
- **Sprint demasiado fuerte para el mapa** → 1.6 es una constante de juego
  ajustable; no altera la simulación ni permite atravesar colisiones.
- **Serialización por tick** → el estado es pequeño y la frecuencia máxima es de
  un tick cada 6 s a ×10; no se espera impacto perceptible.

## Migration Plan

No hay guardados previos: la clave es nueva y, si no existe, el título arranca
como hoy. No se migran datos. Revertir el cambio consiste en retirar la clave y
volver al comportamiento sin guardado; los archivos `.broken` no afectan al
juego. La build sigue siendo estática y sin backend.

## Open Questions

- Ajuste fino del multiplicador de sprint (1.6) y de la opacidad de los
  marcadores tras el playtest. No cambia los requisitos ni el enfoque.

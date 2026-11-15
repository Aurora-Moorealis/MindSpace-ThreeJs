# Tasks

## 1. Snapshot y restauración del núcleo

- [x] 1.1 Añadir `snapshot()` y `restore(snapshot)` a `src/core/sim.js`: copia
  profunda de `state` y `presence`, `log.serialize()`/`log.seed()`,
  `recomputeStats()` y validación de ids de máquinas y POIs. Verificar que
  `npm test` pasa y que un snapshot restaurado conserva tick, recursos,
  máquinas, muestras, informes y ledger.
- [x] 1.2 Añadir a `tests/sim.test.mjs` la prueba de continuación determinista:
  avanzar N ticks, guardar, avanzar M; restaurar y avanzar M debe producir el
  mismo estado. Verificar que la prueba nueva y las existentes pasan.

## 2. Módulo de guardado

- [x] 2.1 Crear `src/core/save-game.js` con la clave
  `outpost-lunar.save.v1`, la versión de formato, `buildRecord()`,
  `readSave(storage)`, `writeSave(record, storage)`, `clearSave(storage)`,
  `applyRecord(record, { sim, app })` y la cuarentena `.broken`. El `storage`
  debe ser inyectable. Verificar con un almacenamiento falso en memoria.
- [x] 2.2 Crear `tests/save.test.mjs`: registro válido, JSON corrupto, versión
  desconocida, campos faltantes, estados `in_progress`/`victory`, `setItem` que
  lanza por cuota y `applyRecord()` restaurando una simulación. Verificar que
  `node --test tests/save.test.mjs` pasa.
- [x] 2.3 Documentar en `docs/ADAPTATION.md` el formato del guardado y la
  validación (una clave, versión, cuarentena). Verificar que el documento
  describe la clave y el flujo de descarte de un archivo inválido.

## 3. Autoguardado y reanudación en la aplicación

- [x] 3.1 Enganchar `autosave()` en `src/main.js`: tras cada `sim.tick()` sin
  fin de misión, al abrir la pausa, en `visibilitychange` oculto, en `pagehide`
  y antes de `sim.reset()` en `goToTitle()`. Excluir `app.demo`, `app.freeplay`
  y partidas terminadas; avisar una sola vez si la escritura falla. Verificar en
  el navegador que tras dos ticks existe la clave, que recargar conserva el tick
  y que un preset de demo no la modifica.
- [x] 3.2 Implementar `continueMission()` en `src/main.js`: `readSave()`,
  `sim.restore()`, restaurar posición/orientación/velocidad/fracción de hora,
  limpiar paneles y escaneo, saltar intro y tutorial, y entrar en freeplay si el
  registro es `victory`. Si el guardado no valida, volver al título con aviso.
  Verificar recargando en mitad de una partida y comprobando estado, posición y
  ausencia de tutorial.
- [x] 3.3 Resolver victoria y derrota en `triggerEnding()` de `src/main.js`:
  victoria escribe el registro `victory`; derrota borra solo un guardado
  `in_progress`; una derrota en freeplay conserva el completado. Verificar con
  una victoria (`localStorage` conserva el registro) y una derrota (se elimina).
- [x] 3.4 Implementar `NEW MISSION` con confirmación y borrado previo; hacer que
  el reinicio desde la pausa y “Run it again” en la evaluación reemplacen el
  guardado sin confirmación. Verificar que cancelar conserva el guardado,
  confirmar lo elimina y reintentar tras ganar lo reemplaza.
- [x] 3.5 Actualizar `README.md` (sección de estado y de cómo se juega) y
  `docs/PLAYTEST.md` con las pruebas de autoguardado, reanudación, victoria y
  derrota. Verificar que los pasos escritos se pueden seguir tal cual.

## 4. Título y evaluación

- [x] 4.1 Ampliar `TitleScreen` en `src/ui/screens.js` para recibir el guardado
  y renderizar los estados sin guardado, en curso, completado, ilegible y
  almacenamiento no disponible, con `CONTINUE MISSION` / `CONTINUE FREEPLAY`,
  `NEW MISSION` y la confirmación en dos pasos. Añadir los textos en
  `src/data/strings.js` y los estilos necesarios en `src/ui/styles.css`.
  Verificar los cinco estados inyectando guardados falsos en `localStorage` y
  simulando un almacenamiento bloqueado.
- [x] 4.2 Pasar `saveOutcome` a `EvaluationScreen` en `src/ui/screens.js` y
  actualizar la nota del pie para victoria, derrota, derrota en freeplay y
  almacenamiento no disponible. Actualizar la nota del menú de pausa en
  `src/ui/menus.js`. Verificar las cuatro variantes en pantalla.
- [x] 4.3 Comprobar el título y la evaluación a 1280×720 y en una ventana
  estrecha: sin desbordes, sin botones inaccesibles y con la confirmación
  cancelable. Verificar visualmente en el navegador.

## 5. Sprint con Shift

- [x] 5.1 En `src/main.js`, seguir `ShiftLeft`/`ShiftRight` en `app.keys`,
  añadir `hasMovementInput()` y cambiar la cancelación de escaneo de
  `app.keys.size > 0` a esa comprobación. Aplicar
  `5.0 * sim.stats.movement_speed * 1.6` al sprint manteniendo la normalización
  diagonal y `world.move()`. Verificar que Shift solo no cancela un escaneo,
  que Shift+dirección es más rápido y que una pared detiene el sprint.
- [x] 5.2 Pasar el factor de sprint a `Astronaut.update(dt, moving, speedFactor)`
  en `src/world/astronaut.js` y desde `src/world/world.js`/`src/main.js` para
  acelerar el ciclo de caminata. Verificar visualmente la diferencia de cadencia
  al caminar y al sprintar.
- [x] 5.3 Documentar Shift en `controlsMarkup()` de `src/ui/menus.js`, en la
  tabla de controles de `README.md` y en la primera línea del tutorial de
  `src/data/strings.js`. Añadir a `docs/PLAYTEST.md` las pruebas de sprint,
  colisión y escaneo con Shift. Verificar que la pantalla de controles y el
  README muestran la tecla.
- [x] 5.4 Verificar que el sprint es transitorio: guardar durante un sprint,
  recargar y comprobar que la astronauta aparece caminando. Anotarlo en
  `docs/PLAYTEST.md`.

## 6. Marcadores de misión

- [x] 6.1 Sustituir `World.setObjective()` por
  `World.setMissionMarkers({ currentId, scans, samples, reports })` en
  `src/world/world.js`, con estados `pending`, `sampled`, `reported` y resaltado
  del actual. Extender `buildPoi()` en `src/world/machines3d.js` con
  `setMissionState()`. Actualizar las llamadas de `src/main.js`. Verificar el
  ciclo completo: inicio, escaneo, informe y tercer informe.
- [x] 6.2 Añadir un marcador permanente sobre la consola de comunicaciones con
  la geometría procedural existente y resaltarlo cuando sea el objetivo actual.
  Verificar que se ve desde el hábitat y que pasa a actual al escanear un sitio.
- [x] 6.3 Ajustar etiquetas y colores en `src/world/world.js` y los textos en
  `src/data/strings.js` para los tres estados, en inglés. Verificar que cada
  sitio muestra `UNSCANNED`, `SAMPLE READY · TAKE TO COMMS` o `REPORT SENT` sin
  solaparse con la baliza.
- [x] 6.4 Garantizar que los marcadores se ven por encima de paredes y suelo
  (`depthTest: false`, `renderOrder` alto) y que no añaden colliders ni áreas de
  interacción. Verificar desde dentro de la base y caminando por debajo.
- [x] 6.5 Verificar que al cargar un guardado con un escaneo hecho los
  marcadores reflejan el estado al instante y que el HUD apunta al mismo
  destino. Añadir la comprobación a `docs/PLAYTEST.md` y actualizar la sección
  de misión de `README.md`.

## 7. Integración y validación

- [x] 7.1 Ejecutar `npm run check` (audit + tests + build) y corregir cualquier
  fallo. Verificar que termina con código 0.
- [x] 7.2 Ejecutar `npm run smoke` o, si Playwright no está disponible, una
  pasada manual por título → nueva misión → escaneo → informe → recarga →
  continuar → victoria/derrota. Verificar que no hay errores en consola y que el
  guardado se comporta como describen las specs.
- [x] 7.3 Ejecutar `openspec validate add-mission-save-sprint-and-markers
  --strict` y revisar `git diff --stat` para confirmar que solo se tocaron los
  archivos previstos. Verificar que la validación pasa.

## Workflow follow-up

- Archivar el cambio cuando la revisión del proyecto esté satisfecha.
- Verificar el resultado archivado y que `openspec/specs/` contiene las tres
  capacidades nuevas.

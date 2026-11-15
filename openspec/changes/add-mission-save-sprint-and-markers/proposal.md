# Proposal

## Why

El juego no conserva ningún progreso: recargar la página reinicia la partida y el
README lo declara explícitamente. Una misión dura 300 ticks (hasta ~5 horas de
juego real), así que cerrar la pestaña, perder el foco o volver al menú obliga a
repetir todo. Además, al ganar no queda constancia de la victoria, y el jugador
solo ve el objetivo actual, no el estado de los tres sitios de estudio.

Este cambio añade un guardado local por misión que se puede reanudar, un sprint
opcional para recorrer el exterior sin alargar la espera, y marcadores
persistentes en el mundo que muestran qué sitios están pendientes, muestreados o
informados y a dónde ir después de completar cada paso.

## What Changes

- **Guardado automático por misión** en `localStorage`: estado completo de la
  simulación, posición y orientación de la astronauta, velocidad del reloj y
  fracción de hora en curso. Se escribe en cada tick, al pausar, al ocultar o
  cerrar la pestaña y antes de volver al título.
- **Reanudación exacta**: el título ofrece `CONTINUE MISSION` y restaura la
  partida sin repetir intro ni tutorial, con el reloj en la velocidad guardada.
- **Victoria conserva el guardado**: la partida queda marcada como completada y
  el título ofrece continuar en freeplay. **Derrota elimina el guardado** de esa
  misión, como pidió el usuario.
- **Nueva misión con confirmación** cuando ya existe un guardado, para no
  sobrescribirlo por accidente. Los presets de demo no escriben ni borran el
  guardado de la misión real.
- **Aviso de resultado** en la pantalla de evaluación: guardado conservado tras
  ganar, eliminado tras perder.
- **Sprint con Shift**: mantener Shift mientras se mueve aumenta la velocidad a
  pie; no altera el reloj, el consumo ni la dosis, y Shift solo no cancela un
  escaneo en curso.
- **Marcadores persistentes en el mundo**: los tres sitios de estudio y la
  consola de comunicaciones muestran su estado (pendiente, muestra lista,
  informe enviado, objetivo actual) y se actualizan al completar cada escaneo o
  informe, también después de cargar una partida.

## Capabilities

### New Capabilities

- `mission-save`: guardado automático, reanudación, conservación tras victoria,
  borrado tras derrota, confirmación de nueva partida e integridad del archivo.
- `mission-guidance`: marcadores de misión en el mundo, estados por sitio y
  consola, y coherencia con el objetivo del HUD.
- `player-movement`: sprint con Shift, su interacción con el escaneo y la
  respuesta visual del avatar.

### Modified Capabilities

- Ninguna. El proyecto todavía no tiene specs principales en
  `openspec/specs/`, así que las tres capacidades son nuevas.

## Impact

- **Código**: `src/main.js` (autoguardado, reanudación, sprint y actualización de
  marcadores), `src/core/sim.js` (`snapshot`/`restore`), nuevo
  `src/core/save-game.js`, `src/ui/screens.js` (título y evaluación),
  `src/ui/menus.js` (controles y nota de pausa), `src/data/strings.js`,
  `src/world/world.js`, `src/world/machines3d.js` y `src/world/astronaut.js`.
- **Pruebas**: nuevas pruebas de ida y vuelta del snapshot y de validación del
  guardado en `tests/`; `npm run check` debe seguir pasando.
- **Documentación**: `README.md`, `docs/ADAPTATION.md` y `docs/PLAYTEST.md`
  dejan de afirmar que no hay guardado y documentan Shift y la reanudación.
- **Dependencias**: ninguna nueva. Solo `localStorage` del navegador; la build
  sigue siendo estática y sin peticiones de red en runtime.

## Fuera de alcance

- Guardado en la nube, cuentas o varios slots manuales.
- Guardar los presets de demo o el progreso posterior a la victoria en freeplay.
- Estamina, coste de recursos o penalización por sprint.
- Minimapa, pantalla de mapa nuevo o brújula en el HUD.
- Controles táctiles o móviles.

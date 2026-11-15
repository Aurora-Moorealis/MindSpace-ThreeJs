# Tasks

## 1. Textos y glosario

- [x] 1.1 Añadir a `src/data/strings.js` las claves `time.gameTimeLabel`,
  `time.modelNote`, `time.compressionNote`, `time.titleMeta`,
  `time.sideHoursLabel`, `time.dataBadge` y `time.controlsNote` con la redacción
  de `design.md` D2, y reescribir `glossary.lunar_day.definition` para distinguir
  el día lunar real del día de misión del juego. Verificar que
  `node --test tests/glossary.test.mjs` pasa (definición ≤ 40 palabras y sin
  `SOL`).
- [x] 1.2 Crear `tests/time-disclosure.test.mjs` con las comprobaciones de
  `design.md` D6: `time.modelNote` contiene `1 game hour`, `60 real seconds`,
  `24 game hours`, `300 game hours` y `12.5`; `time.compressionNote` contiene
  `not real lunar time`, `29.53` y `junior astronauts`; la definición de día
  lunar menciona `29.53`; `time.sideHoursLabel` es `GAME HOURS`;
  `time.controlsNote` contiene `Game time`; `time.dataBadge` contiene `AT ×1`;
  `time.titleMeta` contiene `GAME TIME`; y ninguna cadena visible contiene
  `REAL-TIME` ni `1s = 1m`. Verificar con
  `node --test tests/time-disclosure.test.mjs`.

## 2. Interfaz

- [x] 2.1 Añadir al `clock-sub` del HUD (`src/ui/hud.js`) un span visible con
  `STRINGS['time.gameTimeLabel']` y componer el `title` del reloj con
  `time.modelNote` + `time.compressionNote`. Verificar en `npm run dev` que el
  HUD muestra `GAME TIME`, que el tooltip incluye la escala, 29,53 días y 300
  horas de juego, y que el reloj no se desborda a 850×480.
- [x] 2.2 Renderizar `time.modelNote` y `time.compressionNote` en la pausa
  (`src/ui/menus.js`) y en el tablero de misión, usando el estilo
  `.compression-note` existente. Verificar que ambos paneles muestran la escala
  y el aviso, y que el reloj sigue en pausa al abrir y cerrar.
- [x] 2.3 Sustituir la nota única del glosario (`src/ui/glossary.js`) por las dos
  claves y comprobar que la entrada `lunar_day` se lee completa dentro del modal.
  Verificar con una captura del glosario abierto desde la pausa y con
  `node --test tests/glossary.test.mjs`.
- [x] 2.4 Sustituir el texto hardcodeado del título en `src/ui/screens.js` por
  `STRINGS['time.titleMeta']` y `STRINGS['time.sideHoursLabel']`; usar
  `STRINGS['time.dataBadge']` para la insignia; y cambiar
  `controlsMarkup()` en `src/ui/menus.js` para usar
  `STRINGS['time.controlsNote']`. Verificar que
  `grep -R "REAL-TIME (1s = 1m)" src` no devuelve nada y que la captura del
  título muestra `GAME TIME` y `300 GAME HOURS`.
- [x] 2.5 Revisar el layout del HUD a 1280×720 y 850×480 y ajustar
  `.clock-sub` (gap, tamaño o min-width) solo si la etiqueta nueva tapa la marca
  o los botones. Verificar con capturas de ambas resoluciones.

## 3. Documentación

- [x] 3.1 Reescribir `README.md` § «El reloj» para declarar que no es tiempo
  real, añadir la escala (1 tick = 1 hora de juego = 60 s a ×1), el día de 24
  horas de juego (12/12), la misión de 300 horas de juego (12,5 días) y un
  párrafo «Por qué el horario no es real (nota para el jurado)» con la razón
  educativa; enlazar a la sección canónica de `docs/DATA-SOURCES.md`. Verificar
  que la sección contiene `29,53`, `300 horas de juego`, `12,5` y `jurado`.
- [x] 3.2 Añadir `### Tiempo: de 29,53 días a 300 horas de juego` dentro de
  «Política de escala» en `docs/DATA-SOURCES.md`, con la tabla de `design.md`
  D5 y el párrafo «Para el jurado»; actualizar el punto «Tiempo» existente para
  que no contradiga la tabla. Verificar que el ancla enlazada desde README
  existe y que ambos documentos dicen lo mismo.
- [x] 3.3 Añadir `Q8 horario` a «Preguntas abiertas del diseño» en
  `docs/ADAPTATION.md` con la decisión de tiempo de juego y su razón, y añadir a
  `docs/PLAYTEST.md` la comprobación de título, HUD, pausa, tablero y glosario,
  más la búsqueda de `REAL-TIME` y `300 hours`. Anotar en «Problemas conocidos»
  que el tutorial y el README aún dicen 1/2/3 para la velocidad mientras el
  manejo actual usa 1–5 para el inventario, y que se corrige en un cambio
  aparte. Verificar que la checklist cubre las cinco superficies y que ningún
  documento afirma que el calendario lunar sea real.

## 4. Integración y verificación

- [x] 4.1 Ejecutar `npm run check` (audit + tests + build) y comprobar que pasa
  sin errores. Verificar también que `npm test` incluye el test nuevo y que el
  número de tests sube respecto al estado anterior.
- [x] 4.2 Ampliar `scripts/smoke.mjs` para comprobar `#hud-game-time`, el
  `title` del reloj, que el título contiene `GAME TIME` y que no contiene
  `REAL-TIME`; añadir capturas de pausa, tablero y glosario. Ejecutar
  `PLAYWRIGHT_CHROMIUM=/ruta/a/chrome node scripts/smoke.mjs` y revisar las
  capturas de título, HUD, pausa, tablero y glosario a 1280×720 y 850×480.
- [x] 4.3 Verificar que
  `grep -R "REAL-TIME (1s = 1m)" src README.md docs --exclude=PLAYTEST.md` no
  devuelve nada (la checklist de PLAYTEST cita el texto a propósito) y que las
  duraciones de misión (300 h, 12,5 días, día de 24 h) aparecen siempre como
  horas o días de juego. Confirmar que la única frase visible con «real time» es
  la del retardo de la luz (1,28 s); el comentario interno de `main.js` describe
  movimiento continuo, no el calendario.

## Workflow follow-up

- Archive the change after implementation and review are complete.
- Verify the archived `openspec/specs/time-model-disclosure/spec.md` exists and
  that the README link to `docs/DATA-SOURCES.md` still resolves.

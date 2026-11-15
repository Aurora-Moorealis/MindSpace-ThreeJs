# Design

## Context

Ver `proposal.md` para la motivación y `specs/time-model-disclosure/spec.md`
para los requisitos. El estado actual que condiciona el diseño:

- `ECONOMY.time` ya define el modelo: `realSecondsPerTick: 60`,
  `missionTicks: 300`, `solTicks: 24`, `dayStartHour: 6`, `dayEndHour: 18` y
  velocidades ×1/×5/×10. La simulación es determinista y no necesita cambios.
- `formatMissionTime()` y `getClockLabel()` producen `MISSION DAY n · HH:MM`;
  `src/ui/hud.js` añade `T+nnnH` y la fase `DAYLIGHT` / `LUNAR NIGHT`.
- La nota actual vive en `STRINGS['time.compressionNote']` y se reutiliza en el
  tooltip del HUD, la pausa y la cabecera del glosario. Solo dice que el reloj
  está comprimido «so that a mission fits in one sitting»; no dice que no sea
  tiempo real ni menciona al público infantil.
- La pantalla de título tiene texto de tiempo **hardcodeado**:
  `SOLO · REAL-TIME (1s = 1m) · ...`, la ficha lateral dice `300 hours` y la
  nota de controles dice `The mission runs in real time`. Son las tres
  superficies que más contradicen el modelo y las que primero ve el jurado.
- El glosario tiene una entrada `lunar_day` con una definición de ≤ 40 palabras
  que ya cita 29,53 días; se puede ampliar sin romper el límite.
- `docs/DATA-SOURCES.md` ya tiene una política de escala con un punto de
  «Tiempo», pero no una explicación pedagógica ni una tabla para el jurado.

## Goals / Non-Goals

**Goals:**

- Que cualquier superficie que muestre o explique el reloj diga, sin ambigüedad,
  que es tiempo de juego comprimido.
- Que la explicación incluya la escala, la duración de la misión y el contraste
  con el día lunar real, en inglés sencillo dentro del juego.
- Que el jurado encuentre en la documentación la misma explicación y el «por
  qué» educativo, sin tener que deducirlo del código.
- Eliminar las afirmaciones de tiempo real que contradicen el modelo.

**Non-Goals:**

- Cambiar `ECONOMY.time`, el tick, el ciclo 12/12, las velocidades o la duración
  de la misión.
- Simular el día lunar real ni un calendario astronómico.
- Reescribir las notas de dosis, cultivos o relay; solo se enlazan.
- Traducir el juego completo al español ni cambiar el idioma de la interfaz.
- Arreglar el desfase entre el tutorial/README (1/2/3 para velocidad) y el
  manejo actual de teclas (1–5 para inventario).

## Decisions

### D1 — Una sola fuente de verdad en `STRINGS`

Se añaden a `src/data/strings.js`:

- `time.gameTimeLabel`: `GAME TIME` para la etiqueta visible del HUD.
- `time.modelNote`: escala y duración en una frase.
- `time.compressionNote`: aviso de que no es tiempo real y razón educativa.
- `time.titleMeta`: la línea completa de metadatos del título, con `GAME TIME`
  en lugar de `REAL-TIME`.
- `time.sideHoursLabel`: `GAME HOURS` para la ficha lateral del título.
- `time.dataBadge`: `1 s = 1 GAME MIN AT ×1 · PAUSE ANYTIME (P)` para la
  insignia de la ficha de datos.
- `time.controlsNote`: `Game time runs live; pause before stepping away.` para
  la nota de controles de pausa y tablero.

La pausa, el tablero, la cabecera del glosario y el tooltip del HUD componen su
texto con `modelNote` + `compressionNote`. El título consume `titleMeta`,
`sideHoursLabel` y `dataBadge`; la ayuda de controles consume `controlsNote`.

- **Por qué:** hoy el texto del título está fuera de `STRINGS`, y por eso pudo
  quedar desactualizado. Centralizarlo permite testear el contrato y evita que
  HUD, pausa y glosario diverjan.
- **Alternativa descartada:** dejar el título hardcodeado y comprobarlo solo con
  el smoke test. Es más frágil y no cubre el texto sin abrir un navegador.

### D2 — Redacción del aviso: explícita, corta y para 7–12

Texto propuesto (inglés sencillo, frases cortas):

- `time.modelNote`: `1 tick = 1 game hour = 60 real seconds at ×1. A mission day is 24 game hours: 12 daylight, 12 night. The mission lasts 300 game hours (12.5 mission days).`
- `time.compressionNote`: `Game time, not real lunar time. A real lunar day lasts 29.53 Earth days; we shorten it so junior astronauts can see a full day, watch their choices play out, and finish a mission in one sitting.`
- `time.titleMeta`: `SOLO · GAME TIME (1 TICK = 1 GAME HOUR) · 4 RESOURCES · 3 SURVEY SITES · NASA DATA`

La entrada `glossary.lunar_day.definition` se reescribe dentro del límite de 40
palabras: distingue día lunar real de día de misión y menciona la compresión para
junior astronauts.

- **Por qué «junior astronauts» y no «kids»:** es el término de marca del juego
  y el mismo que usa el título; en documentación se traduce como «niños de 7 a
  12 años».
- **Por qué no una nota más larga en el HUD:** el reloj mide 190 px de ancho y
  comparte la franja superior con la marca y los botones; un párrafo rompería el
  layout a 850×480. El HUD lleva una etiqueta visible y el texto completo va al
  tooltip, la pausa, el tablero y el glosario.

### D3 — El HUD declara el tiempo de juego de forma visible

El `clock-sub` añade un tercer span con `GAME TIME`, junto a `DAYLIGHT` y
`T+nnnH`. El `title` del reloj pasa a ser `modelNote` + `compressionNote`.

- **Por qué visible y no solo tooltip:** un juez puede mirar el HUD sin pasar el
  ratón; la etiqueta de tres palabras no compite con el reloj.
- **Alternativa descartada:** cambiar `MISSION DAY` por `GAME DAY`. Rompe la
  terminología que el cambio anterior fijó y que ya usan evaluación y contratos.

### D4 — Corregir el título, no solo añadir una nota

Se sustituye `REAL-TIME (1s = 1m)` por `GAME TIME (1 TICK = 1 GAME HOUR)`, se
etiqueta la ficha lateral como `300 GAME HOURS` mediante
`time.sideHoursLabel`, la insignia `1s = 1 GAME MIN` pasa a
`time.dataBadge` con `AT ×1`, y la nota de controles pasa a
`time.controlsNote` (`Game time runs live; pause before stepping away.`).

- **Por qué:** son afirmaciones falsas o ambiguas en la primera pantalla. Añadir
  una nota debajo sin corregirlas dejaría dos mensajes contradictorios.
- **Alternativa descartada:** conservar `REAL-TIME` y explicar que significa
  «no por turnos». Es cierto, pero el jurado lee «tiempo real» como tiempo
  lunar real; el coste de aclararlo es una palabra.

### D5 — Documentación: una explicación canónica y resúmenes

`docs/DATA-SOURCES.md` gana una subsección `### Tiempo: de 29,53 días a 300
horas de juego` dentro de «Política de escala», con una tabla:

| En el juego | En la realidad | Por qué |
| --- | --- | --- |
| 1 tick = 1 hora de juego = 60 s reales a ×1 | Un día lunar dura 29,53 días terrestres | Que una hora de decisiones se vea en un minuto |
| Día de misión de 24 horas de juego (12/12) | ~14 días de luz y ~14 de noche | Que el niño vea el ciclo completo sin esperar semanas |
| Misión de 300 horas de juego (12,5 días) | Una misión lunar real se planifica por semanas | Que el arco completo quepa en una sesión de 20–60 min |

Incluye un párrafo `Para el jurado` con la razón educativa y una frase de
límites: no es una medida, ni una predicción, ni un calendario operativo.
`README.md` resume lo mismo en «El reloj» y enlaza a la sección canónica.
`docs/ADAPTATION.md` añade una fila `Q8 horario` a las preguntas del diseño.
`docs/PLAYTEST.md` añade la comprobación visual y de textos.

- **Por qué una sección canónica:** evita que README y DATA-SOURCES se
  contradigan; el README ya enlaza a DATA-SOURCES para otros modelos.
- **Alternativa descartada:** duplicar la tabla en README. Se desincroniza en
  cuanto cambie un número.

### D6 — Pruebas de contrato de texto, no de DOM

Nuevo `tests/time-disclosure.test.mjs` que importa `STRINGS` y comprueba:

- `time.modelNote` contiene `1 game hour`, `60 real seconds`, `24 game hours`,
  `300 game hours` y `12.5`;
- `time.compressionNote` contiene `not real lunar time`, `29.53` y
  `junior astronauts`;
- `glossary.lunar_day.definition` menciona `29.53`, `game` y no supera 40
  palabras;
- `time.sideHoursLabel` es `GAME HOURS`, `time.controlsNote` contiene
  `Game time` y `time.dataBadge` contiene `AT ×1`;
- ninguna cadena visible contiene `REAL-TIME` ni `1s = 1m`;
- `time.titleMeta` contiene `GAME TIME` y no `REAL-TIME`.

- **Por qué no un test de DOM:** el proyecto no tiene jsdom; los tests actuales
  son de datos y simulación. El contrato de cadenas más una captura manual cubre
  el riesgo real (volver a escribir la afirmación).
- **Alternativa descartada:** leer `screens.js` con `fs` desde el test. Detecta
  el texto actual, pero se rompe con cualquier refactor y no prueba la cadena
  renderizada.

### D7 — Sin cambios en la simulación ni en el guardado

No se toca `src/core/sim.js`, `src/core/save-game.js` ni `src/data/economy.js`.
El cambio es de presentación y documentación.

- **Por qué:** el modelo ya es determinista y correcto; el problema es que no se
  explica. Tocar la simulación introduciría riesgo de balance y de guardados sin
  mejorar la claridad.

## Risks / Trade-offs

- **El span `GAME TIME` aprieta el reloj a 850×480** → el `clock-sub` ya usa
  `display: flex` y `gap: 10px`; revisar con captura y, si no cabe, reducir el
  gap o acortar la etiqueta antes de tocar el tamaño del reloj.
- **La nota nueva supera la capacidad de atención de un niño** → mantenerla en
  dos frases, con la escala en una frase aparte, y validar la entrada del
  glosario con el límite de 40 palabras que ya existe.
- **`REAL-TIME` reaparece en otro texto** → el test de cadenas busca la cadena
  exacta en todo `STRINGS`; la captura del título cubre el texto hardcodeado que
  quede.
- **README y DATA-SOURCES se desincronizan** → README enlaza a la sección
  canónica y no repite la tabla; la tarea de documentación verifica ambos.
- **La frase «real time» de la consola se confunde con el calendario** → se
  mantiene porque describe el retardo de la luz (1,28 s), no el calendario; el
  nuevo aviso usa «game time, not real lunar time» para desambiguar.
- **Desfase de teclas 1/2/3 (velocidad) frente a 1–5 (inventario)** → fuera de
  alcance; se anota en «Problemas conocidos» de PLAYTEST para que el jurado no
  lo confunda con un fallo del reloj y se corrige en un cambio aparte.

## Migration Plan

1. Textos y claves en `STRINGS` (incluida la entrada del glosario).
2. HUD, pausa, tablero, glosario y título.
3. Documentación (DATA-SOURCES canónico, README, ADAPTATION, PLAYTEST).
4. Test nuevo y `npm run check`.
5. Capturas de título, HUD, pausa, tablero y glosario a 1280×720 y 850×480.

No hay migración de datos, guardados ni despliegue: el build sigue siendo
estático. El rollback es revertir el commit de la rama
`feat/clarify-simplified-game-clock`.

## Open Questions

- Ninguna que cambie el enfoque o el desglose de tareas. La redacción final en
  inglés se revisa durante la implementación, pero debe conservar las palabras
  clave que fija el test (`game time`, `not real lunar time`, `29.53`,
  `junior astronauts`, `300 game hours`, `12.5`).

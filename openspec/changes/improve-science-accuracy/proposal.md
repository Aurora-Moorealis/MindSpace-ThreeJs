# Proposal

## Why

El juego ya cita datos NASA reales, pero tres de sus modelos siguen sin explicar
la realidad que representan: la dosis de radiación es un número abstracto de
0 a 100 sin equivalente en mSv, la consola de comunicaciones no muestra el
retardo Tierra–Luna ni cuándo sale un informe, y la hidroponía produce comida de
forma continua como si las plantas crecieran por hora. Además, la interfaz llama
`SOL` a los días de una base lunar y usa jerga técnica ("dose", "EVA", "regolith",
"DSN") sin definirla. Para un jurado de *Validity* y para un niño de 7–12 años,
eso convierte decisiones reales en números opacos.

Este cambio mantiene la jugabilidad y la escala corta del juego, pero hace
explícito **qué se simplifica y por qué**, y sustituye las dos mecánicas menos
creíbles (dosis sin unidad, comida instantánea) por versiones con una unidad
real y un ciclo de cultivo visible.

## What Changes

- **Dosis en unidades reales**: además del presupuesto 0–100, el HUD, el panel
  de máquina y la evaluación muestran el equivalente en mSv, con una conversión
  declarada (`1 punto = 2,5 mSv`; `100 = 250 mSv`, el límite de misión de
  NASA-STD-3001). Alcanzar el límite termina la misión como **aborto médico por
  dosis**, no como muerte, y el texto lo dice así.
- **Retardo de comunicaciones**: la consola muestra el tiempo de luz de ida y
  vuelta (1,28 s / 2,56 s) y los informes ya no se envían al instante: quedan en
  cola hasta el siguiente **pase de relay**, con cuenta atrás visible. La
  victoria se dispara cuando el tercer informe se transmite, no cuando se
  encola. Un corte de DSN detiene los pases.
- **Hidroponía con ciclo de cultivo**: la producción continua de comida
  desaparece. La máquina tiene bandejas que se plantan, pasan por etapas de
  crecimiento visibles y se cosechan. El ciclo está comprimido para la partida
  (una lechuga real tarda ~28 días; aquí ~30 horas de juego) y el panel declara
  esa compresión. El crecimiento solo avanza con la máquina encendida y sana.
- **Glosario y terminología**: nuevo panel de glosario accesible desde la pausa
  y el tutorial, con definiciones breves en inglés para dosis, mSv, microgravedad,
  día lunar, evento de partículas solares, GCR, regolito, EVA, DSN e hidroponía.
  `SOL` pasa a `MISSION DAY` en HUD, intro, contratos y depuración, con una nota
  visible de que el día lunar real dura 29,53 días terrestres y aquí está
  comprimido.

## Capabilities

### New Capabilities

- `radiation-model`: presupuesto de dosis, conversión a mSv, umbrales, lectura
  en HUD/paneles/evaluación y desenlace de misión por límite de dosis.
- `comms-link`: tiempo de luz, cola de informes y pases de relay, con su
  interacción con los cortes de DSN y la victoria.
- `hydroponics`: bandejas de cultivo, etapas, ritmo de crecimiento, cosecha y
  reequilibrio de la comida del invernadero.
- `science-literacy`: glosario de términos, terminología de tiempo lunar y avisos
  de modelo simplificado en la interfaz.

### Modified Capabilities

- Ninguna. El proyecto todavía no tiene specs principales en `openspec/specs/`,
  así que las cuatro capacidades son nuevas.

## Impact

- **Datos**: `src/data/economy.js` (conversión de dosis, duración de ciclo,
  intervalo de relay, comida inicial), `src/data/machines.js` (bandejas de
  hidroponía), `src/data/strings.js` (glosario, terminología y textos nuevos),
  `src/data/sources.js` (notas de conversión y compresión).
- **Simulación**: `src/core/sim.js` (estado de cultivos, cola de informes,
  pases de relay, API de conversión de dosis), `src/core/save-game.js`
  (persistencia de cultivos y cola), `src/core/evaluation.js` (dosis en mSv y
  causa de fin de misión).
- **Interfaz**: `src/ui/hud.js` (mSv y `MISSION DAY`), `src/ui/machine-panel.js`
  (bandejas y etapas), `src/ui/comms-panel.js` (tiempo de luz y cuenta atrás),
  nuevo panel de glosario en `src/ui/`, `src/ui/menus.js` y `src/ui/screens.js`
  (accesos y textos).
- **Documentación**: `README.md` y `docs/DATA-SOURCES.md` (conversión, pases de
  relay, ciclo de cultivo).
- **Pruebas**: `tests/sim.test.mjs`, `tests/data.test.mjs`,
  `tests/evaluation.test.mjs`, `tests/save.test.mjs` y `scripts/balance.mjs`
  (el throughput de comida debe seguir sosteniendo una misión de 300 ticks).
- **Compatibilidad**: un guardado anterior no contiene cultivos ni cola de
  informes; al cargarlo se inicializan vacíos y la partida sigue siendo válida.

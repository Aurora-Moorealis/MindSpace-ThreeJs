# Design

## Context

Ver `proposal.md` para la motivación y `specs/` para los requisitos. El estado
actual que condiciona el diseño:

- La simulación (`src/core/sim.js`) es pura y determinista, sin `Math.random`, y
  se ejecuta por ticks de 1 hora de juego. Los números viven en filas de
  `src/data/economy.js` y `src/data/machines.js`.
- La dosis se guarda en `state.radiation` como presupuesto 0–100. Los umbrales
  son 30 / 70 / 100 y el HUD ya muestra la cifra y la tasa por hora.
- Los informes se envían al instante en `sendReport()`; la victoria se comprueba
  en ese mismo método.
- La hidroponía es un conversor continuo: `outputs { food: 0.95, o2: 0.35 }` por
  tick.
- El guardado (`src/core/save-game.js`) usa `SAVE_VERSION = 1` y serializa
  `sim.snapshot()`; el snapshot ya incluye recursos, máquinas y log.
- La UI usa modales propios (`SourcesModal`, `PauseMenu`) y una tabla de strings
  en inglés (`src/data/strings.js`).

## Goals / Non-Goals

**Goals:**

- Añadir unidad real a la dosis sin reequilibrar el juego ni migrar guardados.
- Convertir el envío de informes en una cola con pases de relay deterministas.
- Sustituir la producción continua del invernadero por bandejas con ciclo.
- Explicar jerga y simplificaciones en inglés sencillo, sin salir de la partida.

**Non-Goals:**

- Simular el día lunar real de 29,53 días o el ciclo solar completo.
- Modelar dosis clínica, GCR por espectro ni blindaje por material.
- Programar pases de DSN con geometría orbital real.
- Animar el crecimiento planta a planta en 3D; las etapas se muestran en UI.
- Traducir el juego a otros idiomas.

## Decisions

### D1 — La dosis sigue en puntos; los mSv se derivan al presentar

Se mantiene `state.radiation` en la escala 0–100 y se añade a `economy.radiation`
la constante `msvPerPoint: 2.5` (100 puntos = 250 mSv). La conversión se aplica
solo en la capa de presentación con un helper compartido; el estado guardado no
cambia.

- **Por qué:** migrar el estado a mSv obligaría a tocar cada umbral, test,
  balance y guardado, sin cambiar la jugabilidad.
- **Alternativa descartada:** guardar 0–250 mSv y dividir para la UI. Mismo
  resultado visible, más riesgo y ruido en tests.
- **Consecuencia:** las etiquetas de umbral (30/70/100) muestran también 75/175/
  250 mSv; la tasa del HUD añade `mSv/h`.

### D2 — El fin por dosis es un aborto, no una muerte

Se añade la causa de fin `dose_limit`. El daño por encima del umbral sigue
usando la causa de daño `radiation`, pero `_endMission` por dosis usa
`dose_limit` y la evaluación lo traduce a "Dose limit exceeded — mission
aborted".

- **Por qué:** 250 mSv es el límite de misión de NASA-STD-3001, no una dosis
  letal; presentarlo como muerte contradice la fuente que el juego cita.
- **Alternativa descartada:** mantener `radiation` como causa de fin y cambiar
  solo el texto. El ledger quedaría mezclando daño y fin de misión.

### D3 — Pases de relay deterministas y derivados del tick

Se añade `economy.comms = { lightDelayOneWaySeconds: 1.28, relayIntervalTicks:
4, relayPhaseTicks: 2 }`. El próximo pase se calcula con una función pura a
partir del tick (`nextRelayTick`), sin temporizador guardado. `sendReport()`
pasa a encolar (`state.reportQueue`), y un paso nuevo del tick transmite la cola
cuando toca pase y no hay corte de DSN.

- **Por qué:** el calendario derivado del tick sobrevive al guardado sin un campo
  extra y mantiene la simulación reproducible.
- **Alternativa descartada:** retardo real de 1,28 s en la UI. Es invisible y no
  crea ninguna decisión.
- **Alternativa descartada:** guardar `nextPassTick`. Redundante con el tick y
  fuente de desincronización tras cargar.
- **Orden en el tick:** el paso de relay va después de consecuencias y antes del
  cierre del reloj, para que el pase que cae en el último tick pueda ganar la
  partida.
- **Victoria:** se mueve la comprobación de 3 informes de `sendReport()` a la
  transmisión. Los presets de demo se ajustan para que el tercer informe tenga
  un pase a menos de `relayIntervalTicks`.

### D4 — Hidroponía como máquina de estados por bandeja

`economy.hydroponics` define `{ trays: 3, cycleTicks: 30, stages: 4, yieldFood:
10 }`. El estado añade `crops: Array<{ progress, plantedTick }>`. La fila de
máquina pierde `food` de `outputs` y conserva `o2` y el consumo de agua. El
crecimiento avanza un paso por tick solo si el plan de la máquina está activo y
sano; al llegar a `cycleTicks` la bandeja queda madura. Plantar y cosechar son
acciones del panel (`plantTray`, `harvestTray`).

- **Por qué 30 ticks:** una lechuga real tarda ~28 días; 30 horas de juego son
  una compresión ~22× que cabe en la misión de 300 ticks y deja ver varios
  ciclos.
- **Por qué 3 bandejas × 10 comida / 30 ticks:** da 1,0 comida/tick de media,
  prácticamente el 0,95 actual. Evita reequilibrar el resto de la economía; el
  consumo es 0,55/tick y la comida inicial es 68.
- **Alternativa descartada:** cosecha automática. Elimina la decisión de cuándo
  plantar y deja el invernadero como un conversor con animación.
- **Alternativa descartada:** mantener producción continua y añadir solo etapas
  visuales. No corrige la mecánica que el brief cuestiona.
- **Coste de plantar:** agua y energía de la propia máquina, no un recurso
  nuevo; se declara en el panel.
- **Riesgo de hambruna:** se valida con `scripts/balance.mjs basic` y un test de
  simulación de 300 ticks.

### D5 — Glosario como dato + modal reutilizando el patrón existente

Nuevo `src/data/glossary.js` (id, término, definición corta, enlaces) y
`src/ui/glossary.js`, clonando la estructura de `SourcesModal`. Se abre desde la
pausa, el tutorial y botones `data-term` en HUD, panel de hidroponía y consola.

- **Por qué:** el contenido queda fuera del código y sigue el patrón de
  `sources.js`/`strings.js` que ya usa el equipo.
- **Alternativa descartada:** tooltips nativos. No caben definiciones de 40
  palabras ni funcionan con teclado/táctil.
- **Límite de contenido:** 10 entradas fijas, ≤ 40 palabras cada una; se revisan
  como texto, no como código.

### D6 — Terminología: cambiar solo lo visible

Se sustituye `Sol`/`SOL` por `MISSION DAY` en `formatMissionTime`, `formatTicks`,
HUD, intro, contratos y overlay de debug. Los identificadores internos
(`sim.sol`, `getSol`) se mantienen para no tocar balance, tests ni guardado.
Se añade una nota de compresión visible junto al reloj y en el glosario.

- **Por qué:** el cambio es de vocabulario, no de modelo; renombrar el estado
  interno no aporta y multiplica el diff.

### D7 — Guardado aditivo, sin subir versión

`restore()` inicializa `reportQueue` y `crops` vacíos cuando faltan, y el
snapshot los incluye. `SAVE_VERSION` sigue en 1.

- **Por qué:** los guardados existentes siguen siendo válidos; los campos nuevos
  tienen un valor por defecto seguro.
- **Alternativa descartada:** subir a versión 2 y rechazar guardados viejos.
  Castiga al jugador sin necesidad.

### D8 — Presentación compacta en el HUD

La línea de dosis muestra `3.4 · 8.5 mSv` y la tasa `+1.1 mSv/h`. El detalle
completo (conversión, umbrales, nota de modelo) vive en el tooltip, la pausa y
el glosario.

- **Por qué:** el panel de signos vitales es estrecho; meter párrafos rompe el
  layout a 850×480 y en pantallas pequeñas.

## Risks / Trade-offs

- **La comida deja de ser infinita** → validar con `balance.mjs basic` y un test
  de 300 ticks; ajustar `yieldFood`, `cycleTicks` o `start` si falla.
- **La cola retrasa la victoria y puede romper el preset final** → colocar el
  preset a ≤ 2 ticks de un pase y cubrirlo con un test de preset.
- **HUD saturado con mSv** → formato corto y detalle en tooltip; revisar captura
  a 850×480 antes de cerrar.
- **Glosario que crece sin control** → lista cerrada de 10 entradas y revisión
  de contenido en la tarea de textos.
- **Textos nuevos fuera de `strings.js`** → regla de revisión: toda cadena
  visible pasa por la tabla.
- **Guardados viejos sin cultivos** → defaults en `restore()` y test de carga de
  un snapshot v1 sin los campos nuevos.

## Migration Plan

1. Datos y constantes (`economy.js`, `machines.js`).
2. Simulación (cultivos, cola, transmisión, causa `dose_limit`).
3. Guardado y preset de demo.
4. UI (HUD, panel de máquina, consola, glosario, pausa, evaluación).
5. Textos y documentación.
6. `npm run check` + `scripts/smoke.mjs`.

No hay migración de datos ni despliegue especial: el build es estático y el
rollback es revertir el commit. Los guardados existentes se aceptan tal cual.

## Open Questions

- Redacción final de las 10 entradas del glosario (contenido, no arquitectura).
- Si el indicador de dosis cabe con dos cifras o conviene mover los mSv al
  tooltip en pantallas estrechas; se decide con una captura durante la
  implementación.

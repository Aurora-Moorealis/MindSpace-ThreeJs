# Tasks

## 1. Constantes y datos

- [x] 1.1 Añadir `msvPerPoint: 2.5` a `economy.radiation` y una nota de que 100 puntos equivalen a 250 mSv; verificar con `npm run audit` y un test que compruebe la conversión.
- [x] 1.2 Añadir `economy.comms` con `lightDelayOneWaySeconds: 1.28`, `relayIntervalTicks` y `relayPhaseTicks`; verificar con `npm run audit`.
- [x] 1.3 Añadir `economy.hydroponics` (`trays`, `cycleTicks`, `stages`, `yieldFood`, coste de plantar) y quitar `food` de los `outputs` de `machines.js`; verificar que el audit acepta el rango y que la fila ya no declara comida.
- [x] 1.4 Documentar en `docs/DATA-SOURCES.md` la conversión a mSv y la compresión del ciclo de cultivo, citando la fuente de cada una; verificar que las cifras coinciden con `economy.js`.

## 2. Dosis en unidades reales

- [x] 2.1 Añadir el helper de conversión y formato de dosis (puntos y mSv) en la capa de datos; verificar con un test unitario de 0, 30, 70 y 100 puntos.
- [x] 2.2 Cambiar la causa de fin por dosis a `dose_limit` y actualizar `_endMission`; verificar que el test de muerte por radiación espera `dose_limit` y que el daño sigue registrando `radiation`.
- [x] 2.3 Mostrar el pico y la dosis final en puntos y mSv en `evaluation.js`, con el texto de aborto médico; verificar con un test de evaluación que el resultado y la causa se describen como límite de dosis.

## 3. Cola de informes y pases de relay

- [x] 3.1 Añadir `state.reportQueue`, `nextRelayTick()` y el paso de transmisión del tick; hacer que `sendReport()` encole en vez de enviar; verificar que un informe encolado no incrementa `reports` y que el pase lo transmite.
- [x] 3.2 Suspender los pases durante un corte de DSN sin perder la cola; verificar con un test que simula corte en el tick del pase y transmisión en el siguiente.
- [x] 3.3 Mover la victoria de `sendReport()` a la transmisión del tercer informe; verificar que el tercer informe encolado no termina la partida y que el pase sí.
- [x] 3.4 Incluir la cola en `snapshot()`/`restore()` y cubrir la reanudación con un test de guardado con informes pendientes.
- [x] 3.5 Ajustar los presets de demo para que el preset final tenga el tercer informe a menos de un intervalo de pase; verificar que el preset sigue terminando en victoria.

## 4. Hidroponía con ciclo de cultivo

- [x] 4.1 Añadir `state.crops` y el avance de etapas en el tick, solo con la máquina activa y sana; verificar con un test de avance, pausa por apagado y pausa por avería.
- [x] 4.2 Implementar `plantTray()` y `harvestTray()` con coste de agua/energía y rendimiento declarado; verificar con tests de plantado, rechazo sin recursos, cosecha y bandeja madura que espera.
- [x] 4.3 Exponer el estado de las bandejas en el snapshot y el restore; verificar con un test de guardado a mitad de ciclo.
- [x] 4.4 Validar el equilibrio de comida con `node scripts/balance.mjs basic`: comida por encima de cero durante 300 ticks; ajustar `yieldFood`, `cycleTicks` o la comida inicial si falla y dejarlo registrado en el test.

## 5. HUD y evaluación

- [x] 5.1 Mostrar dosis y tasa en mSv en el HUD junto a los puntos, con formato compacto; verificar con una captura del smoke test a 1600×900 y otra a 850×480.
- [x] 5.2 Sustituir `SOL` por `MISSION DAY` en el reloj, la intro, los contratos y el debug, y añadir la nota de compresión; verificar con un test que `formatMissionTime()` no contiene "Sol" y con captura del HUD.
- [x] 5.3 Actualizar las etiquetas de umbral del HUD (30/70/100) con su equivalente en mSv; verificar visualmente en la captura y con el texto del tooltip.

## 6. Consola, panel de máquina y glosario

- [x] 6.1 Mostrar en la consola el retardo de ida y vuelta, la cuenta atrás del próximo pase y la lista de informes en cola; verificar con el smoke test y una captura de la pestaña de informes.
- [x] 6.2 Añadir al panel de hidroponía las bandejas, la etapa, el tiempo restante, el rendimiento y la nota de compresión real; verificar con el smoke test y captura del panel.
- [x] 6.3 Crear `src/data/glossary.js` con las 10 entradas y `src/ui/glossary.js` como modal; verificar con un test de datos (número de entradas, campos completos y máximo de palabras) y con apertura desde la pausa.
- [x] 6.4 Conectar los enlaces contextuales de dosis, hidroponía y enlace de comunicaciones al glosario; verificar que cada botón abre la entrada correcta en el smoke test.

## 7. Textos y documentación

- [x] 7.1 Revisar todas las cadenas nuevas en `src/data/strings.js` en inglés sencillo y sin acrónimos sin definir; verificar con un test que las claves usadas existen y que no queda `SOL` en textos visibles.
- [x] 7.2 Actualizar `README.md` (dosis, relay, hidroponía, glosario, terminología) y `docs/PLAYTEST.md` con los pasos nuevos; verificar que las cifras y los controles coinciden con el juego.

## 8. Integración

- [x] 8.1 Ejecutar `npm run check` (audit + tests + build) y `scripts/smoke.mjs` con 0 errores; revisar las capturas de título, HUD, consola, hidroponía y evaluación.
- [x] 8.2 Probar el flujo completo: partida nueva → plantar → escanear → enviar informe → esperar pase → ganar; y una derrota por límite de dosis que muestre el aborto.
- [x] 8.3 Comprobar que un guardado anterior sin `crops` ni `reportQueue` carga sin errores y que la partida continúa.

## Workflow follow-up

- Ejecutar `openspec validate improve-science-accuracy --strict` antes de archivar.
- Archivar el cambio con `openspec archive improve-science-accuracy --yes` cuando la implementación y las pruebas estén cerradas.

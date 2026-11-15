# Playtest y verificación

## Automático

```bash
npm run check
```

Ejecuta:

1. `npm run audit` — valida datos, fuentes y presets.
2. `npm test` — suite de simulación, economía, radiación, comunicaciones,
   hidroponía, contratos, glosario, guardado y evaluación.
3. `npm run build` — build de Vite.

También hay una simulación de políticas de juego sin DOM:

```bash
node scripts/balance.mjs basic
node scripts/balance.mjs idle
```

La política `basic` escanea, envía informes, planta y cosecha bandejas, repara y
limpia paneles; la `idle` no hace nada y muere por la cascada de O₂. Sirve para
comparar el tuning.

## Smoke test en navegador

Con el servidor de desarrollo levantado (`npm run dev`):

```bash
PLAYWRIGHT_CHROMIUM=/ruta/a/chrome node scripts/smoke.mjs
```

El script comprueba título, intro, tutorial, partida, teleport a salas, panel de
máquina, exterior, debug, pausa y preset final. Guarda capturas en
`/tmp/opencode/outpost/`.

En esta máquina (Chromium 1248 + SwiftShader) la escena corre a pocos FPS por
software rendering; el juego real usa GPU. Por eso el smoke test fuerza ticks
con `sim.tick()` y espera de más en las transiciones.

## Checklist manual

### Flujo

- [x] La pantalla de título carga sin errores y el botón **Start Mission**
      arranca la intro.
- [x] La intro tiene 3 pasos, se puede skipear y avanza sola.
- [x] El tutorial de Mission Control pausa el reloj y se puede skipear.
- [x] Al cerrar el tutorial, el HUD aparece y el reloj corre.
- [x] ×1 / ×5 / ×10 cambian la tasa; la pausa detiene el reloj.
- [x] El reloj día/noche avanza; las luces interiores cambian.

### Base

- [x] Se recorren las 5 salas, el hub y el airlock; las paredes colisionan.
- [x] El airlock se abre al acercarse; el exterior es accesible.
- [x] El dormitorio, invernadero, energía, taller y comunicaciones tienen sus
      máquinas y props.
- [x] El refugio de tormenta se puede cerrar; solo protege dentro.
- [x] La Mission Board y la Holo Table están en el hub.

### Recursos y máquinas

- [x] O₂, agua, comida y energía se mueven con el tick y muestran deltas.
- [x] El sistema de O₂ produce O₂ consumiendo agua y energía.
- [ ] El reciclador produce agua; la hidroponía produce O₂ de forma continua.
- [ ] La hidroponía no produce comida por tick: la comida llega al cosechar.
- [x] La batería define la capacidad; el distribuidor permite toggles.
- [x] La escalera de apagado respeta luces → hidroponía → reciclador → O₂.
- [x] Reparar cuesta energía y 2 horas; la mejora de herramientas lo acelera.
- [x] Las mejoras se instalan y cambian los números del panel.
- [x] Toda mejora muestra su contrapartida antes de instalarla y la aplica al
  simular (el beneficio sigue pesando más que el coste).
- [x] El panel muestra la procedencia NASA/simulada.

### Radiación y eventos

- [x] La primera ventana DONKI empieza temprano y muestra su banner/fuente.
- [ ] La dosis no decrece; el HUD muestra el tope de salud al pasar 30 puntos
      (75 mSv).
- [x] El refugio cerrado reduce la dosis; el exterior es peligroso.
- [x] El polvo solar reduce la producción y se limpia fuera con dosis.
- [ ] Las averías de máquina se reparan; los cortes de DSN bloquean previsión y
      suministros, y suspenden los pases sin perder la cola.
- [x] Los eventos simulados muestran el badge `SIMULATED`.

### Misión y evaluación

- [x] Los 3 POIs se escanean con barra de 3 s; moverse cancela.
- [x] Las muestras se convierten en informes solo en la consola.
- [x] Los 4 contratos se evalúan y se reclaman en la consola.
- [ ] Con 3 informes transmitidos aparece la evaluación de victoria.
- [ ] La derrota por O₂/límite de dosis/inanición/reloj también evalúa.
- [x] La evaluación muestra 5 contadores, nota, timeline y fuentes NASA.
- [x] "Continue (freeplay)" reanuda la partida tras la victoria.
- [x] "Run it again" reinicia sin intro/tutorial.
- [x] Los presets mid/final cargan y validan sus invariantes.

### Ciencia, relay y cultivos

Estos pasos cubren el cambio `improve-science-accuracy`; se dejan sin marcar
hasta verificarlos en la build final.

- [ ] Dosis en dos unidades: en partida, el HUD muestra los puntos y su
      equivalente en mSv, la tasa en mSv/h y el detalle `1 punto = 2,5 mSv` con
      los umbrales 30/70/100 = 75/175/250 mSv.
- [ ] Límite de dosis: llevar la dosis a 100 y comprobar que la evaluación
      describe un aborto médico por el límite de 250 mSv y no una muerte por
      radiación.
- [ ] Plantar: abrir la hidroponía, comprobar que muestra 3 bandejas y plantar
      una bandeja vacía; debe descontar agua y energía, no entregar comida al
      plantar y mostrar etapa, tiempo restante y rendimiento esperado.
- [ ] Madurar: dejar correr el reloj hasta la cosecha y comprobar que el cultivo
      pasa por las 4 etapas y que la bandeja madura permanece disponible sin
      perder rendimiento.
- [ ] Cosechar: pulsar Harvest y comprobar que la comida sube en el rendimiento
      mostrado (10 base, ajustado por mejoras) y que la bandeja queda vacía.
- [ ] Pausa del crecimiento: apagar o averiar la hidroponía y comprobar que el
      tiempo se detiene sin destruir el cultivo; al repararla, continúa desde la
      misma etapa.
- [ ] Compresión del cultivo: el panel indica ~28 días reales frente a 30 horas
      de juego y deja claro que es una simplificación didáctica.
- [ ] Cola de informes: enviar un informe y comprobar que aparece `QUEUED`, que
      el contador de enviados no cambia y que la consola muestra la cuenta atrás
      hasta el pase.
- [ ] Pase de relay: esperar el pase (cada 4 h de juego: ticks 2, 6, 10…) y
      comprobar que todos los informes en cola se transmiten juntos, que la cola
      queda vacía y que el contador sube.
- [ ] Corte de DSN: con un corte activo en el tick de un pase, comprobar que no
      se transmite nada, que la cola se conserva y que el primer pase tras el
      corte la vacía.
- [ ] Victoria en el pase: con el tercer informe en cola, comprobar que la
      partida sigue en curso y que termina en victoria cuando se transmite.
- [ ] Retardo de la luz: la consola muestra 1,28 s por sentido y 2,56 s ida y
      vuelta, y explica que la base no se controla en tiempo real.
- [ ] Glosario desde la pausa: abrirlo, leer una entrada, usar `See also` y
      volver; el reloj sigue en pausa.
- [ ] Glosario desde el tutorial: abrirlo y volver al mismo paso del tutorial.
- [ ] Enlaces contextuales: los botones de ayuda de dosis, hidroponía y consola
      abren la entrada correcta del glosario.
- [ ] Terminología: el HUD dice `MISSION DAY` y no `SOL`; la nota de compresión
      (29,53 días terrestres) está junto al reloj, en la pausa y en el glosario.
- [ ] Guardado con cola y cultivos: enviar un informe, plantar una bandeja,
      recargar y comprobar que la cola, la cuenta atrás y el progreso del
      cultivo se restauran.
- [ ] Guardado anterior: cargar un guardado sin cola ni cultivos y comprobar
      que arranca con ambos vacíos y la partida sigue siendo válida.

### Guardado, sprint y marcadores

- [x] Autoguardado: jugar dos ticks, recargar y comprobar que el título ofrece
      `CONTINUE MISSION` con el tick y la posición restaurados.
- [ ] Pausa y cierre: pausar u ocultar la pestaña escribe la fracción de hora
      en curso.
- [ ] Victoria: el pase que transmite el tercer informe deja la tarjeta en
      `MISSION COMPLETE`; `CONTINUE FREEPLAY` entra en freeplay desde la
      instantánea de victoria.
- [x] Derrota: morir en una misión en curso borra el guardado y el título ya no
      ofrece continuar.
- [x] Nueva misión con guardado: pide confirmación; cancelar lo conserva y
      confirmar lo elimina.
- [ ] Preset de demo: cargarlo no modifica el guardado de la misión real.
- [x] Guardado corrupto: escribir basura en `outpost-lunar.save.v1` muestra
      `SAVE UNREADABLE`, no reanuda y el juego sigue arrancando.
- [x] Sprint: `Shift` + dirección recorre más distancia que caminar, soltarlo
      vuelve a la velocidad normal y una pared detiene el sprint.
- [x] Escaneo con Shift: mantener Shift sin dirección no cancela el escaneo;
      Shift + dirección sí lo cancela.
- [ ] Marcadores: inicio (`NEXT SURVEY` en A, `UNSCANNED` en B/C), tras escanear
      A (`SAMPLE READY` y consola actual), tras enviar el informe (en cola) y
      tras el pase (transmitido; B actual) y tras el tercer informe transmitido
      (ningún objetivo actual).
- [x] Cargar un guardado con A escaneado deja los marcadores y el HUD apuntando
      a la consola en el mismo instante.

### UI

- [x] El HUD se lee a 1600×900 y se adapta a 1280×720.
- [x] La consola tiene Reports, Contracts, Forecast, Supplies y Data Sources.
- [x] El drawer de máquina se abre con E y se cierra con Esc.
- [x] La pausa se abre con Esc/P y se cierra con Resume.
- [x] El overlay F1 muestra el estado y el audit.
- [x] Los enlaces a NASA abren en pestaña nueva; no hay HTTP al cargar.
- [x] Autopause al perder foco (los enlaces externos pausan la partida).
- [ ] **Pendiente:** el panel Data Sources separa **Official challenge
      resource** (DONKI) de **Additional NASA sources** (CRaTER/BVAD/ECLSS/OGS)
      y **Simulated**, sin listar recursos no usados.
      Ver [`DATA-SOURCES.md#recursos-oficiales-del-challenge-y-fuentes-externas`](DATA-SOURCES.md#recursos-oficiales-del-challenge-y-fuentes-externas).

## Problemas conocidos

- **Rendimiento en software rendering**: SwiftShader es muy lento; no es
  representativo de una GPU. En un portátil normal la escena es ligera.
- **Guardado local**: el progreso se guarda en el navegador; dos pestañas
  abiertas comparten la misma clave y la última escritura gana. Está pensado
  para una sola pestaña.
- **Web-only**: para Windows hace falta empaquetar la build web.
- **Fuentes en canvas**: los labels 3D se generan cuando las fuentes ya están
  cargadas; en una conexión muy lenta podría verse el fallback durante un frame.
- **Evaluación sin rúbrica oficial**: la nota S/A/B/C/D es cosmética y no
  pretende replicar la rúbrica de NASA Space Apps.

## Registro de la sesión de validación

- Fecha: 2026-11-15.
- Navegador: Chromium 1248 headless (SwiftShader) en Linux.
- Build: Vite 6.4.6, Three.js r170.
- Resultado: flujo completo sin errores de página; 54 tests en verde; audit en
  verde; capturas en `docs/screenshots/`.
- FPS de software rendering: bajo; no se usa como criterio de rendimiento.

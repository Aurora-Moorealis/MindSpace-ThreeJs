# Adaptación Godot → Three.js

Este documento traza cómo se tradujo el diseño original
[`designs/junior-astronauta-outpost-lunar.md`](designs/junior-astronauta-outpost-lunar.md)
a este repositorio. La intención es que cualquier decisión rara se pueda
explicar: o viene del diseño, o es una desviación consciente de la adaptación.

## Resumen de la decisión

El diseño original es un juego 2D top-down en Godot con escenas `.tscn`,
Resources `.tres`, autoloads y UI instanciada. Esta versión mantiene **el modelo
y el contenido** del diseño, pero cambia la capa de presentación:

- **Three.js** con una cámara **ortográfica inclinada** para el juego y una
  cámara en perspectiva para el título, la intro y la evaluación.
- **Mundo 3D low-poly** con base lunar, exterior, máquinas volumétricas y
  astronauta animada.
- **UI HTML/CSS** (HUD, paneles, consola, drawers) en vez de escenas de UI.
- **Datos en módulos JS** en vez de `.tres`, con el mismo principio: contenido
  editable sin tocar el núcleo.
- **Web estática** (sin servidor, sin HTTP en runtime). Windows/HTML5 se cubren
  publicando la build web o empaquetándola con Electron/Tauri.

## Correspondencia por sistema

| Diseño Godot | Implementación Three.js | Notas |
| --- | --- | --- |
| `GameSim` (autoload) | `src/core/sim.js` | Tick determinista, reglas, scheduler, presets. Sin DOM ni Three.js. |
| `GameState` (autoload) | `app` en `src/main.js` + `sim.state` | Fase, pausa, velocidad, presencia, paneles; el estado de partida vive en el sim. |
| `EventLog` (autoload) | `src/core/event-log.js` | Ledger append-only tipado; alimenta evaluación, timeline y debug. |
| `AudioManager` (autoload) | `src/core/audio.js` | 5 SFX sintetizados + viento; sin archivos de audio. |
| `EconomyData` / `economy.tres` | `src/data/economy.js` | Tasas, capacidades, radiación, reparación, suministros, grading. |
| `EventData` / `events.tres` | `src/data/events.js` | 19 filas, 5 arquetipos, intensidad inicio/pico/fin. |
| `SubmissionData` / `submissions.tres` | `src/data/submissions.js` | 4 contratos con enum fijo de condición. |
| `MachineData` / máquinas | `src/data/machines.js` + `src/world/machines3d.js` | Datos + modelos procedurales. 9 máquinas (se añade Storm Shelter como interactuable). |
| `DemoStatePreset` | `src/data/demo-states.js` + `validatePreset` | Dos presets; validación estructural + 4 ticks de simulación. |
| `StringTable` | `src/data/strings.js` | Todo el texto visible, en inglés. |
| `DataAudit` | `src/core/audit.js` + `npm run audit` | Corre en desarrollo y en CI; el overlay F1 lo muestra. |
| `Astronaut` | `src/world/astronaut.js` | Personaje procedural, walk cycle, orientación, mochila, visor. |
| Mapa de salas | `src/world/base.js` | 5 salas + hub + airlock + corredor, props y colisiones. |
| Exterior | `src/world/exterior.js` | Terreno, cráteres, rocas, rover, lander, balizas, polvo. |
| `scan_poi` | `src/world/machines3d.js` (`buildPoi`) + UI | Barra in-world de 32 segmentos; cancela al moverse. |
| HUD + paneles | `src/ui/hud.js`, `machine-panel.js`, `comms-panel.js`, `menus.js` | Todo el HUD y los paneles. |
| Evaluación | `src/core/evaluation.js` + `src/ui/screens.js` | 5 contadores, nota, bullets, timeline, fuentes. |
| Intro stills | `src/ui/screens.js` (`IntroScreen`) + cámara cinematográfica | 3 pasos con cámara en perspectiva, skippeable. |
| Tutorial Mission Control | `src/ui/dialogue.js` | 4 mensajes con retrato SVG de Aurora; pausa el reloj. |
| Debug overlay | `src/ui/debug.js` | Tick, recursos, stats ocultas, máquinas, cola de eventos, presets, audit. |

## El tick

El orden implementado en `GameSim.tick()`:

1. **Eventos**: se disparan los `onset` de este tick (averías, ventanas,
   cortes). Se aplican al inicio para que el jugador vea el efecto en la misma
   hora.
2. **Radiación**: dosis según presencia (`outside`, `inShelter`) y la ventana
   activa; el refugio cerrado reduce. La dosis nunca decrece.
3. **Desgaste**: condición de máquinas y polvo solar.
4. **Energía y producción**: se calcula la demanda, se aplica la escalera de
   apagado (luces → hidroponía → reciclador → O₂) y se ejecutan las máquinas
   activas con sus entradas y salidas.
5. **Tripulación**: consumo de O₂/agua/comida, comidas automáticas, nutrición,
   hidratación, regeneración de salud.
6. **Consecuencias**: tope de salud por radiación, daño por radiación alta,
   inanición/deshidratación, reserva de O₂, muerte.
7. **Contratos y suministros**.
8. **Avisos y ledger**.

El tick es **puro y determinista**: no usa `Math.random`, ni DOM, ni relojes
reales. Dos simulaciones con las mismas acciones producen el mismo snapshot
(hay un test que lo verifica).

### Diferencias con el orden del documento

El diseño especifica `producción → consumos → degradación → eventos →
consecuencias`. Aquí los eventos se disparan **antes** de producción para que la
tormenta o la avería se noten en la misma hora en que empieza la fila. El resto
del pipeline mantiene el orden. Se documenta como desviación consciente.

## Recursos y cifras

- Las tasas base vienen de BVAD/ECLSS, pero se normalizan a 0-100 para que una
  partida corta sea legible. La UI muestra porcentajes y los paneles explican
  la escala.
- La energía usa kWh-equivalentes y una capacidad que depende del estado de la
  batería (si está rota, 30 kWh). Los paneles muestran potencia, carga y
  capacidad.
- La radiación se convierte a un presupuesto de 0-100 sobre 300 horas. El
  umbral 30 y la muerte a 100 son abstracciones de juego; las referencias
  CRaTER/LND están citadas.
- La condición de una máquina va de 100 a 0; por debajo de 0.5 de factor de
  salida la producción cae. Las averías de evento la ponen a 0 hasta reparar.
- Reparar cuesta 4 kWh y 2 horas de juego; la mejora de herramientas lo baja a
  1 hora. Las mejoras cuestan energía y 2 horas.
- Cada mejora aplica un beneficio y una contrapartida (`effect` y `drawback`):
  más producción a cambio de más consumo, menos potencia a cambio de menos
  caudal, velocidad a cambio de desgaste del traje, etc. El panel muestra ambos
  números antes de instalarla y la auditoría de datos comprueba que el beneficio
  mejora su stat y la contrapartida la empeora.

## Eventos y datos NASA

Las 6 ventanas de radiación usan como base:

- CME 2024-05-08T22:24:00 (1130 km/s, AR 13664, X1.0).
- SEP 2024-05-10T14:50:00 (STEREO A, 13-100 MeV).
- CME 2024-05-09T09:24:00 (1330 km/s).
- GST 2024-05-10T15:00:00 (Kp 9, tormenta de Gannon).

Los multiplicadores de dosis, la duración y el `onset` son **tuning de juego**;
la fuente es real y se muestra con el badge `NASA ARCHIVE`. Las averías,
caídas de producción, picos de consumo y cortes de DSN son `SIMULATED` y se
etiquetan como tal en el banner y en el panel de fuentes.

## Desviaciones conscientes

1. **3D en vez de 2D tile-based.** El diseño original es 2D con tiles de 32 px.
   Aquí se eligió un diorama 3D low-poly con cámara ortográfica inclinada para
   aprovechar Three.js y dar profundidad sin perder legibilidad. La lógica y el
   contenido se mantienen.
2. **UI HTML en vez de escenas de UI.** Permite iterar mucho más rápido, escalar
   el texto y separar el trabajo de UI del mundo 3D. El HUD mantiene la misma
   información y jerarquía.
3. **9 máquinas interactuables.** Las 8 del diseño más el Storm Shelter como
   interactuable (el diseño lo lista como máquina/refugio). La Mission Board y
   la Holo Table son estaciones decorativas/informativas adicionales.
4. **5 salas + hub + airlock.** El diseño pide una base fija de 5 salas. Se
   mantienen las 5 (dormitorio-almacén, invernadero, energía, taller y
   comunicaciones), con un hub de tránsito y un airlock como espacios de paso.
   El O₂ y el reciclador están en el taller, junto al banco de reparación.
5. **Energía con batería como máquina.** El diseño menciona batería y cable en
   el cambio `energy-grid`; aquí la batería define la capacidad usable y el
   distribuidor gestiona toggles y escalera. El cable es visual (conductos).
6. **Sin guardado.** Igual que el diseño. Los presets son constructores
   explícitos, no save files.
7. **Web-only.** El diseño pide Windows + HTML5. La build es HTML5 estática; se
   puede envolver en Electron/Tauri para Windows sin cambiar el juego.
8. **Audio sintetizado.** El diseño congela 5 SFX; aquí se generan con WebAudio
   (click, reparación, informe, alarma, evento) más un lecho de viento. No hay
   archivos de audio externos.
9. **Freeplay** es un botón desde la evaluación, no un tercer estado de partida.
10. **El reloj arranca a las 08:00**, no a las 06:00, para que la primera sala
    esté legible con luz de mañana. El ciclo día/noche sigue siendo 12/12 y el
    primer evento sigue siendo temprano (tick 6).

## Preguntas abiertas del diseño

| Pregunta | Decisión en esta adaptación |
| --- | --- |
| Q1 economía | Valores por defecto en `src/data/economy.js`; `npm run balance` permite comparar políticas. |
| Q2 textos/umbrales | Textos en `strings.js`; umbrales en `submissions.js`. |
| Q3 rúbrica NASA | No disponible; no se afirma nada sobre ella. |
| Q4 pasos de escaneo | Barra in-world de 3 s; se cancela al moverse o salir de rango. |
| Q5 opciones grises | Dos misiones "COMING SOON" en el selector. |
| Q6 velocidad como hidden stat | El traje Mk II/servo del banco de reparación la toca (+15%) y el panel lo declara. |
| Q7 look nocturno | Ciclo día/noche con luces interiores cálidas y paleta azulada en el exterior. |

## Qué falta si se quiere ampliar

- Otras misiones/planetas (Marte con polvo y latencia).
- Multijugador y varios astronautas.
- Construcción/movimiento de edificios.
- Save/persistencia.
- Más arte 3D o modelos importados (GLTF) en lugar de primitivas.
- Empaquetado Electron/Tauri para Windows.
- Traducción de la UI (hoy inglés, como pide la convención del proyecto
  original); el sistema de strings ya está centralizado.

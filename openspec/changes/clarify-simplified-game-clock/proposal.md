# Proposal

## Why

El juego comprime el tiempo para que una misión quepa en una sesión, pero esa
decisión no está explicada con claridad. La nota actual solo dice que el reloj
está comprimido «para que una misión quepa en una sola sesión», sin decir que
**no es tiempo real** ni por qué esa simplificación es adecuada para niños de 7
a 12 años. Además, la pantalla de título afirma `REAL-TIME (1s = 1m)` y la ficha
lateral muestra `300 hours` sin la palabra «game», así que el primer mensaje
que ve el jurado contradice el modelo real del reloj.

Para un jurado que evalúa validez y valor educativo, y para un niño que necesita
entender por qué el día avanza tan rápido, falta una explicación explícita: qué
es tiempo de juego, cuánto dura de verdad un día lunar y por qué se acorta.

## What Changes

- **Aviso de tiempo de juego en la interfaz**: el HUD, la pausa, el tablero de
  misión y el glosario declaran que el reloj es **tiempo de juego comprimido, no
  un horario lunar real**. La nota incluye la escala (1 tick = 1 hora de juego =
  60 s reales a ×1), el día de misión de 24 horas de juego (12 de luz y 12 de
  noche), la misión de 300 horas de juego (12,5 días de misión) y el contraste
  con el día lunar real de 29,53 días terrestres.
- **Razón educativa explícita**: la nota dice que la compresión es intencionada
  para que los astronautas junior vean un día completo, entiendan la relación
  causa-efecto y terminen una misión en una sesión.
- **Título y unidades coherentes**: se elimina `REAL-TIME (1s = 1m)`, se
  etiqueta la duración como **game hours** y se aclara que «real time» solo
  describe que el juego no es por turnos, no que el calendario lunar sea real.
- **Documentación para el jurado**: `README.md` y `docs/DATA-SOURCES.md`
  explican el modelo temporal con una tabla «en el juego / en la realidad / por
  qué»; `docs/ADAPTATION.md` registra la decisión y `docs/PLAYTEST.md` añade la
  comprobación visual.
- **Cobertura de pruebas**: un test nuevo fija el contenido mínimo del aviso y
  evita que vuelva a colarse una etiqueta `REAL-TIME` o una duración en horas
  reales sin aclarar.

## Capabilities

### New Capabilities

- `time-model-disclosure`: presentación del reloj como tiempo de juego,
  declaración de su escala, contraste con el día lunar real, razón educativa
  para junior astronauts y explicación equivalente en la documentación del
  proyecto.

### Modified Capabilities

- Ninguna. El proyecto todavía no tiene specs principales en `openspec/specs/`.
  El cambio anterior `improve-science-accuracy` ya introdujo una nota inicial
  dentro de `science-literacy`, pero sigue sin archivar; este cambio no edita
  artefactos de otro cambio y añade una capacidad dedicada al modelo temporal.

## Impact

- **Datos y textos**: `src/data/strings.js` (aviso, regla del reloj, duración de
  misión, etiqueta de tiempo de juego y definición de día lunar).
- **Interfaz**: `src/ui/hud.js` (etiqueta visible y tooltip), `src/ui/menus.js`
  (pausa y tablero de misión), `src/ui/glossary.js` (cabecera del glosario),
  `src/ui/screens.js` (título: meta, ficha lateral y nota de controles) y
  `src/ui/styles.css` solo si la etiqueta nueva necesita ajuste.
- **Documentación**: `README.md`, `docs/DATA-SOURCES.md`,
  `docs/ADAPTATION.md` y `docs/PLAYTEST.md`.
- **Pruebas**: nuevo `tests/time-disclosure.test.mjs`; se mantienen las
  restricciones existentes de `tests/glossary.test.mjs` (≤ 40 palabras por
  definición y prohibición de `SOL`).
- **Sin cambios de simulación**: no se toca `economy.time`, `sim.js`, el
  guardado ni el balance. No hay migración de datos ni nuevas dependencias.

## Fuera de alcance

- Simular el día lunar real de 29,53 días o un calendario astronómico.
- Cambiar la duración de la misión, el tick, las velocidades ×1/×5/×10 o el
  ciclo 12/12.
- Reescribir las notas de compresión de cultivos, pases de relay o dosis; ya
  existen y este cambio solo las enlaza cuando hace falta.
- Corregir la discrepancia entre el tutorial/README (1/2/3 para la velocidad) y
  el manejo actual de teclas (1–5 para el inventario); es un fallo aparte, se
  anota en Problemas conocidos y no se arregla aquí.

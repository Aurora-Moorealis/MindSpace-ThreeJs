# Datos NASA y política de procedencia

El juego muestra en cada fila de números si viene de un archivo NASA o si es
tuning del juego. Esta política se implementa en:

- `src/data/sources.js` — registro de fuentes.
- `src/data/economy.js`, `events.js`, `machines.js`, `submissions.js`, `pois.js`
  — filas que apuntan a una fuente.
- `src/ui/sources-view.js` — panel **Data Sources**.
- `src/core/audit.js` — valida que `real_data: true` tenga URL y fecha.
- `src/ui/notifications.js` y `src/ui/panels.js` — badges en banners y paneles.

## Etiquetas

| Badge | Significado |
| --- | --- |
| `NASA ARCHIVE` | El número o evento se ancla a un documento/registro NASA archivado y enlazado. |
| `SIMULATED` | Valor de equilibrado del juego; no es una medida ni una predicción. |

El juego **no descarga datos en runtime**. Los enlaces del panel se abren solo
cuando el jugador hace clic (`target="_blank"`).

## Recursos oficiales del challenge y fuentes externas

> **Snapshot:** página oficial consultada el **2026-11-15**:
> <https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources>
>
> La propia página avisa: *“More resources may be added before the hackathon
> begins.”* Si se incorpora un recurso oficial nuevo, se marca como
> `challenge`; si no se usa, no se lista.

Para el jurado, lo útil no es enumerar los recursos que **no** se usaron: eso se
deduce de los que sí aparecen. Lo útil es separar el **origen** de cada fuente
usada en tres grupos visibles:

### 1. Recurso oficial del challenge

- **DONKI** — <https://ccmc.gsfc.nasa.gov/tools/DONKI/>
- Es el único recurso del tab oficial que el juego usa. Alimenta las 6 ventanas
  de radiación con 4 eventos archivados:
  - CME `2024-05-08T22:24:00-CME-001` (1130 km/s, AR 13664, X1.0).
  - SEP `2024-05-10T14:50:00-SEP-001` (STEREO A, 13-100 MeV).
  - CME `2024-05-09T09:24:00-CME-001` (1330 km/s).
  - GST `2024-05-10T15:00:00-GST-001` (Kp 9, tormenta de Gannon).
- Filas en `src/data/sources.js` y `src/data/events.js`; enlaces en el panel
  **Data Sources**.
- En el panel debe llevar el badge **`OFFICIAL CHALLENGE RESOURCE`** y aparecer
  en el primer grupo.

### 2. Fuentes NASA adicionales (no están en el tab, pero sí se usan)

- **LRO CRaTER / LND** — dosis lunar de referencia; es la fuente correcta para
  un escenario lunar.
- **NASA BVAD** (`NASA/TP-2015-218570/REV2`) — O₂, agua y comida por
  tripulante/día.
- **NASA ECLSS / ISS OGS** — ratios de soporte vital y potencia.
- En el panel deben ir en un grupo **`Additional NASA sources`** con el badge
  **`NASA ARCHIVE`**. Son NASA, pero no salen del tab oficial del challenge.

### 3. Contenido simulado

- Ajuste de economía, fiabilidad de máquinas, textos de misión y guion.
- En el panel va en el grupo **`Simulated`** con el badge **`SIMULATED`**.

### Estado actual y tarea para otra sesión

El panel ya muestra las fuentes usadas y distingue `NASA ARCHIVE` de
`SIMULATED`, pero **no separa** el recurso oficial del challenge de las fuentes
NASA adicionales. La mejora es de presentación, no de mecánica.

- [ ] En `src/data/sources.js`, añadir un campo de grupo a las fuentes:
      `group: 'challenge'` para DONKI; `group: 'nasa'` para CRaTER, BVAD,
      ECLSS/OGS; `group: 'simulated'` para gameplay/mission. Mantener
      `real_data` y la auditoría de URL/fecha.
- [ ] En `src/ui/sources-view.js` (`sourcesMarkup`), renderizar **tres grupos
      en este orden**: `Official challenge resource`, `Additional NASA
      sources`, `Simulated`.
- [ ] Usar **`OFFICIAL CHALLENGE RESOURCE`** para DONKI y **`NASA ARCHIVE`**
      para las fuentes NASA adicionales. No añadir una lista de “recursos no
      usados”: el panel solo muestra lo que se usa.
- [ ] Validar en `src/core/audit.js` que toda fuente `group: 'challenge'` tenga
      `real_data: true`, URL y fecha ISO.
- [ ] Comprobar el panel a 1280×720 y 1600×900, sin HTTP en runtime.
- [ ] `npm run check` debe seguir en verde; no cambiar números, eventos ni
      mecánicas por esta tarea.

**Dónde tocar:** `src/data/sources.js`, `src/ui/sources-view.js` y
`src/core/audit.js` si se valida el grupo.

**Texto propuesto para la UI (inglés, como el resto de la interfaz):**

```text
Official challenge resource
DONKI — archived CME / SEP / GST events drive the radiation windows.

Additional NASA sources
LRO CRaTER / LND — lunar dose reference.
NASA BVAD — crew consumables.
ECLSS / ISS OGS — life support and power ratios.

Simulated
Gameplay balance and mission script.
```

**Criterio de aceptación:** el panel muestra los tres grupos en ese orden,
DONKI aparece como recurso oficial del challenge, las fuentes NASA adicionales
llevan `NASA ARCHIVE`, el contenido de juego lleva `SIMULATED`, no se lista
ningún recurso no usado y `npm run check` sigue en verde.

## Fuentes archivadas

### DONKI — CME 2024-05-08T22:24:00-CME-001

- Archivo: <https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/CME/30640/3>
- Fecha del evento: 2024-05-08T22:24Z.
- Datos: CME full-halo, AR 13664, flare X1.0/M9.8 de origen. Velocidad bulk
  estimada **1130 km/s**, semiángulo 40°, dirección LON 12 / LAT -16.
- Uso: base de la primera ventana de radiación (`storm_gannon_arrival`) y de la
  ventana final (`storm_final`), escaladas para el juego.
- Archivado para el juego: 2026-11-15.

### DONKI — SEP 2024-05-10T14:50:00-SEP-001

- Archivo: <https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/SEP/30684/1>
- Fecha: 2024-05-10T14:50Z.
- Datos: evento de partículas solares detectado por STEREO A (IMPACT 13-100
  MeV); el flujo superó 0,1 pfu/MeV.
- Uso: segunda ventana (`storm_sep_may10`) y ventana de pico (`storm_sep_peak`).

### DONKI — CME 2024-05-09T09:24:00-CME-001

- Archivo: <https://ccmc.gsfc.nasa.gov/TP/2024-05-TP-02/> (página del periodo de
  la tormenta de mayo de 2024, que reúne los 5 CME enlazados).
- Fecha: 2024-05-09T09:24Z.
- Datos: CME asociado al flare X2.2 de AR 13664, velocidad estimada 1330 km/s,
  semiángulo 45°.
- Uso: tercera ventana (`storm_cme_may9`).

### DONKI — GST 2024-05-10T15:00:00-GST-001

- Archivo: <https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/GST/30693/1>
- Fecha: 2024-05-10T15:00Z.
- Datos: tormenta geomagnética de Gannon; Kp máximo 9,0 en el periodo
  synoptic 2024-05-11T00:00Z. El registro enlaza cinco CME y un IPS.
- Uso: ventana de pico de radiación (`storm_gannon_peak`).

### LRO CRaTER / dosimetría lunar

- Artículo principal: <https://doi.org/10.1002/2013SW000995>
- Suplemento con tasas: <https://doi.org/10.1038/s41526-021-00143-x>
- Datos de referencia: dosis absorbida en órbita lunar ~**0,197 mGy/día**
  (CRaTER, media 2010-2020) y dosis total en superficie lunar ~**0,318 mGy/día**
  (LND). La tasa equivalente en piel con poco blindaje es ~2,88 mSv/día en el
  modelo CRaTER de mínimo solar.
- Uso: ancla de la dosis de fondo y de la forma en que la radiación se acumula.
  El juego **no** usa estos valores como cifras clínicas: los convierte a un
  presupuesto de 0-100 para 300 horas.

### NASA BVAD — Life Support Baseline Values and Assumptions

- Documento: <https://ntrs.nasa.gov/citations/20210024855>
- PDF: <https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf>
- Referencia: NASA/TP-2015-218570/REV2, febrero 2022.
- Datos: 0,84 kg de O₂, 0,62 kg de sólidos de comida y 2,0 kg de agua potable
  por tripulante y día. Es la base de las tasas de consumo.
- Uso: recursos de tripulación, ratios de soporte vital y narrativa del O₂.

### NASA ECLSS / ISS OGS

- ECLSS: <https://ntrs.nasa.gov/citations/20210013975>
- ISS OGS: <https://ntrs.nasa.gov/citations/20180002051>
- Datos: 0,84 kg O₂/día, 0,62 kg comida/día, 2,0 kg agua/día; el OGS de la ISS
  produce hasta 20,4 lb/día de O₂ con 23 lb/día de agua y 3955 W de pico.
- Uso: ancla de potencia y del sistema de O₂; las cifras del juego están
  normalizadas.

## Filas simuladas

Estas filas no llevan URL porque no existe un dato archivado que las respalde:

- Fiabilidad y desgaste de máquinas, costes de reparación y mejoras.
- Multiplicadores y duración exacta de las ventanas de radiación (la fuente es
  real; el tuning es del juego).
- Averías de máquina, caídas de producción, picos de consumo y cortes de DSN.
- Contratos, recompensas, pedidos de suministro y textos de misión.
- Los 3 POIs y sus nombres (Shackleton Rim, Hadley Rille, Malapert Massif) son
  escenarios ficticios inspirados en la geografía lunar real.
- La telemetría de la base y el estado inicial de los recursos.

Se etiquetan como `SIMULATED` en el juego y aparecen como
"Simulated for this game" en el panel de fuentes.

## Política de escala

- **Recursos**: tasas NASA (kg/día) → unidades 0-100 por tick para que una barra
  se mueva de forma legible en una sesión corta. La UI muestra el porcentaje y
  el panel de la máquina muestra el input/output por hora.
- **Radiación**: tasas NASA → dosis 0-100 por 300 horas. El umbral 30 y la
  muerte a 100 son una abstracción. No es un modelo de dosis clínica ni una
  recomendación de exposición.
- **Energía**: kW/kWh normalizados con la referencia ISS OGS; la capacidad de la
  batería y el reparto son tuning.
- **Tiempo**: 1 tick = 1 hora de juego = 60 s reales a ×1. La misión dura 300
  horas (12,5 soles). Los eventos están comprimidos para que una sesión de 20-60
  minutos vea el arco completo.
- **NASA no avala este juego.** Los datos se citan; los errores de adaptación
  son nuestros.

## Cómo añadir una fuente

1. Añade la entrada en `src/data/sources.js` con `id`, `label`, `short`, `url`,
   `date_archived`, `real_data` y una `note` que explique qué se usó.
2. Apunta la fila (`source: 'id'`) en el registro correspondiente.
3. Ejecuta `npm run audit`. El audit exige URL y fecha ISO si `real_data: true`.
4. Comprueba el panel **Data Sources** en el juego y el badge del evento/panel.
5. Si el valor es tuning sobre una fuente real, añade una `scaleNote` o una nota
   en el panel; no lo disfraces de medida.

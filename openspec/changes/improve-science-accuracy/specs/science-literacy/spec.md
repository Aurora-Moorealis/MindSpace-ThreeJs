# Spec Delta

## Purpose

Explicar en lenguaje claro los términos científicos y las simplificaciones del
juego, para que un estudiante de 7 a 12 años entienda qué está decidiendo y qué
parte es real y qué parte está adaptada.

## ADDED Requirements

### Requirement: Glosario accesible en partida

El juego SHALL ofrecer un glosario accesible desde el menú de pausa y desde el
tutorial, sin abandonar la partida ni detener el reloj más de lo que ya hace la
pausa.

#### Scenario: Abrir el glosario desde la pausa

- **WHEN** el jugador abre la pausa y elige el glosario
- **THEN** se muestra el glosario y el reloj permanece en pausa

#### Scenario: Abrir el glosario desde el tutorial

- **WHEN** el jugador está en el tutorial y abre el glosario
- **THEN** puede leer las entradas y volver al tutorial en el mismo paso

### Requirement: Cobertura mínima de términos

El glosario SHALL incluir al menos: dosis de radiación, mSv, microgravedad, día
lunar, evento de partículas solares, rayos cósmicos galácticos, regolito, EVA,
DSN e hidroponía. Cada entrada SHALL definir el término en una o dos frases y
NO SHALL usar un acrónimo sin explicarlo.

#### Scenario: Entrada de dosis

- **WHEN** el jugador abre la entrada de dosis de radiación
- **THEN** la definición explica qué mide la dosis, en qué unidad se expresa y
  por qué importa en la Luna

#### Scenario: Entrada de día lunar

- **WHEN** el jugador abre la entrada de día lunar
- **THEN** la definición explica que un día lunar dura 29,53 días terrestres y
  que el reloj del juego está comprimido

### Requirement: Enlaces contextuales desde la interfaz

Los indicadores de dosis, el panel de hidroponía y la consola de comunicaciones
SHALL ofrecer un acceso directo a la entrada de glosario correspondiente.

#### Scenario: Desde el indicador de dosis

- **WHEN** el jugador activa la ayuda del indicador de dosis
- **THEN** se abre la entrada de dosis del glosario

#### Scenario: Desde la consola

- **WHEN** el jugador activa la ayuda del estado del enlace
- **THEN** se abre la entrada que explica el retardo de la luz y el pase de relay

### Requirement: Terminología de tiempo lunar

La interfaz SHALL llamar `MISSION DAY` a los días de la misión y NO SHALL usar
`SOL` como etiqueta visible. Donde se muestre el reloj SHALL indicarse que el
ciclo día/noche es una compresión del día lunar real.

#### Scenario: Reloj del HUD

- **WHEN** la partida está en curso
- **THEN** el HUD muestra `MISSION DAY` con el número de día y NO muestra `SOL`

#### Scenario: Nota de compresión

- **WHEN** el jugador consulta el reloj, la pausa o el glosario
- **THEN** se indica que un día lunar real dura 29,53 días terrestres y que el
  ciclo del juego está comprimido por jugabilidad

### Requirement: Avisos de modelo simplificado

Cada modelo simplificado del juego (presupuesto de dosis, ciclo de cultivo y
pases de relay) SHALL mostrar una nota breve de que es una simplificación
didáctica cuando el jugador ve sus números.

#### Scenario: Panel de hidroponía

- **WHEN** el jugador abre el panel de hidroponía
- **THEN** el panel indica que el ciclo está comprimido y que no representa el
  tiempo real de crecimiento

#### Scenario: Nota de dosis

- **WHEN** el jugador abre el detalle de la dosis
- **THEN** se indica que el presupuesto de 250 mSv es un límite de misión y que
  el modelo es educativo, no clínico

### Requirement: Lenguaje adecuado para la edad

Las entradas del glosario y las notas de simplificación SHALL estar en inglés
sencillo, con frases cortas y sin jerga sin definir, adecuadas para lectores de
7 a 12 años.

#### Scenario: Lectura de una entrada

- **WHEN** un lector de 7 a 12 años abre cualquier entrada del glosario
- **THEN** la entrada se entiende sin conocimientos previos de física y sin
  acrónimos sin explicar

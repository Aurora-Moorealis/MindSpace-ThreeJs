# Spec Delta

## Purpose

Declarar y explicar que el reloj y el calendario del juego son tiempo de juego
comprimido, no un horario lunar real, tanto en la interfaz como en la
documentación que lee el jurado.

## ADDED Requirements

### Requirement: Reloj identificado como tiempo de juego

La interfaz SHALL identificar el reloj de misión como tiempo de juego y NO SHALL
presentarlo como tiempo lunar o terrestre real. Toda duración visible cuyo
número pueda confundirse con horas reales SHALL llevar la unidad «game».

#### Scenario: Pantalla de título

- **WHEN** el jugador abre el título antes de empezar
- **THEN** la pantalla no afirma `REAL-TIME (1s = 1m)` ni muestra `300 hours` sin
  aclarar que son horas de juego
- **AND** la escala se presenta como tiempo de juego

#### Scenario: Reloj del HUD

- **WHEN** la partida está en curso
- **THEN** el reloj muestra `MISSION DAY` y una etiqueta visible de tiempo de
  juego
- **AND** no usa `SOL` como etiqueta

#### Scenario: Nota de controles

- **WHEN** el jugador abre la ayuda de controles
- **THEN** la nota dice que el tiempo de juego corre en vivo y que puede pausar,
  sin afirmar que la misión transcurre en tiempo lunar real

### Requirement: Escala del reloj declarada

Donde se explica el reloj, la interfaz SHALL declarar que un tick equivale a una
hora de juego y a 60 segundos reales a ×1, que un día de misión son 24 horas de
juego con 12 de luz y 12 de noche, y que la misión dura 300 horas de juego
(12,5 días de misión).

#### Scenario: Reloj y pausa

- **WHEN** el jugador consulta el reloj del HUD o abre la pausa
- **THEN** la explicación incluye la equivalencia tick / hora de juego / segundos
  reales, el día de 24 horas de juego y la duración de 300 horas de juego

#### Scenario: Tablero de misión

- **WHEN** el jugador abre el tablero de misión
- **THEN** la hora mostrada se acompaña de la nota de tiempo de juego y de la
  duración de la misión en horas de juego

### Requirement: Contraste con el día lunar real y razón educativa

La nota de compresión SHALL indicar que un día lunar real dura 29,53 días
terrestres y que el juego lo acorta a propósito para astronautas junior, de forma
que vean un día completo, entiendan la relación causa-efecto y terminen la misión
en una sesión. Dentro del juego, la nota SHALL estar en inglés sencillo y evitar
jerga sin definir.

#### Scenario: Nota de compresión en pausa y glosario

- **WHEN** el jugador lee la nota de compresión en la pausa o en el glosario
- **THEN** la nota dice que el reloj no es tiempo real, cita los 29,53 días
  terrestres y explica que la compresión es para que los niños vean un día y una
  misión completos

#### Scenario: Entrada de día lunar

- **WHEN** el jugador abre la entrada de día lunar del glosario
- **THEN** la definición distingue el día lunar real del día de misión del juego
  y menciona que el reloj está comprimido para junior astronauts

### Requirement: Explicación del modelo temporal para el jurado

El proyecto SHALL incluir una explicación en español, accesible desde la
documentación principal, que distinga qué parte del tiempo es real, qué parte es
tiempo de juego y por qué se comprime para el público infantil (7 a 12 años). La
explicación NO SHALL presentar la compresión como una medida, una predicción ni
un calendario operativo.

#### Scenario: Lectura del README

- **WHEN** el jurado lee la sección del reloj en el README
- **THEN** encuentra la escala, la duración de la misión, el contraste con el día
  lunar real y una nota explícita para el jurado con la razón educativa

#### Scenario: Lectura de las fuentes de datos

- **WHEN** el jurado consulta la política de escala en `docs/DATA-SOURCES.md`
- **THEN** encuentra una tabla o sección equivalente que separa «en el juego»,
  «en la realidad» y «por qué», y que remite a las demás compresiones sin
  duplicarlas

#### Scenario: Verificación de la adaptación

- **WHEN** el equipo revisa la lista de pruebas manuales
- **THEN** existe una comprobación de que título, HUD, pausa, tablero y glosario
  declaran el tiempo de juego y ninguna superficie visible afirma tiempo real

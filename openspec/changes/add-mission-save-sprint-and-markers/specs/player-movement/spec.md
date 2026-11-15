# Spec Delta

## Purpose

Permitir recorrer la base y el exterior a pie más rápido con un sprint opcional,
sin alterar la simulación ni las reglas de escaneo.

## ADDED Requirements

### Requirement: Sprint con Shift

Mientras haya una entrada de movimiento y se mantenga pulsado Shift, la
astronauta SHALL moverse a una velocidad mayor que la de caminata, con un
multiplicador fijo. Al soltar Shift SHALL volver a la velocidad normal. La
diagonal SHALL seguir normalizada para no ser más rápida que el movimiento recto,
y el sprint SHALL respetar las colisiones del mundo.

#### Scenario: Sprint recto

- **WHEN** el jugador mantiene Shift y una dirección de movimiento durante un
  segundo sin obstáculos
- **THEN** recorre más distancia que caminando el mismo segundo, según el
  multiplicador de sprint

#### Scenario: Soltar Shift

- **WHEN** el jugador suelta Shift sin dejar de moverse
- **THEN** la velocidad vuelve inmediatamente a la de caminata

#### Scenario: Diagonal

- **WHEN** el jugador sprinta en diagonal
- **THEN** la velocidad total no supera la del sprint recto y la dirección es la
  esperada

#### Scenario: Colisión

- **WHEN** el jugador sprinta contra una pared, una máquina o el borde del mapa
- **THEN** se detiene igual que al caminar y no atraviesa el obstáculo

#### Scenario: Dentro y fuera de la base

- **WHEN** el jugador sprinta dentro del hábitat o en la superficie lunar
- **THEN** el sprint funciona en ambos entornos

### Requirement: El sprint no altera la simulación

El sprint SHALL NOT cambiar la velocidad del reloj, el consumo de recursos, la
dosis de radiación, el daño ni el resultado de la misión.

#### Scenario: Mismo consumo por tick

- **WHEN** se compara un intervalo de juego con sprint y otro sin sprint
- **THEN** los recursos, la dosis y la salud evolucionan igual tick a tick

### Requirement: Sprint y escaneo

Mantener Shift sin una entrada de movimiento SHALL NOT cancelar un escaneo en
curso. Cualquier entrada de movimiento SHALL cancelarlo, con o sin Shift.

#### Scenario: Solo Shift

- **WHEN** el jugador mantiene Shift mientras un escaneo está en curso y no pulsa
  ninguna dirección
- **THEN** el escaneo continúa

#### Scenario: Shift y movimiento

- **WHEN** el jugador pulsa una dirección mientras mantiene Shift durante un
  escaneo
- **THEN** el escaneo se cancela como con cualquier otro movimiento

### Requirement: Respuesta visual del sprint

Mientras se sprinta, el ciclo de caminata de la astronauta SHALL reproducirse a
mayor cadencia que al caminar, sin cambiar el modelo ni la orientación.

#### Scenario: Animación acelerada

- **WHEN** el jugador pasa de caminar a sprintar
- **THEN** el ciclo de piernas y brazos se acelera de forma perceptible

### Requirement: Controles documentados

La pantalla de controles SHALL documentar la tecla Shift como sprint mantenido.

#### Scenario: Abrir controles

- **WHEN** el jugador abre la pantalla de controles
- **THEN** ve una entrada que explica que Shift, mantenido al moverse, hace
  sprint

### Requirement: Estado transitorio

El sprint SHALL NOT guardarse como parte de la partida: al reanudar, la
astronauta empieza caminando aunque se guardara mientras sprintaba.

#### Scenario: Reanudar tras guardar sprintando

- **WHEN** se reanuda una partida guardada mientras la astronauta sprintaba
- **THEN** la astronauta aparece caminando y el sprint solo se activa al volver
  a pulsar Shift con una dirección

# Spec Delta

## Purpose

Señalar en el mundo los destinos de la misión y su estado, para que el jugador
sepa a dónde ir después de completar cada escaneo o informe.

## ADDED Requirements

### Requirement: Marcadores persistentes de sitios y consola

Mientras la misión esté activa, el mundo SHALL mostrar un marcador sobre cada uno
de los tres sitios de estudio y sobre la consola de comunicaciones. Cada sitio
SHALL mostrar uno de tres estados: pendiente, muestra lista o informe enviado. La
consola SHALL mostrar un marcador permanente y SHALL resaltarse como destino
actual cuando haya una muestra por entregar.

#### Scenario: Inicio de la misión

- **WHEN** empieza una misión nueva
- **THEN** los tres sitios muestran el estado pendiente y el primer sitio es el
  objetivo actual

#### Scenario: Escaneo completado

- **WHEN** se completa el escaneo de un sitio
- **THEN** ese sitio pasa a muestra lista y la consola pasa a ser el objetivo
  actual

#### Scenario: Informe enviado

- **WHEN** se envía el informe de una muestra
- **THEN** ese sitio pasa a informe enviado y el siguiente sitio pendiente pasa a
  ser el objetivo actual

#### Scenario: Tercer informe

- **WHEN** se envía el tercer informe
- **THEN** los tres sitios quedan como informe enviado y no hay objetivo actual

#### Scenario: Partida cargada

- **WHEN** se reanuda una partida guardada
- **THEN** los marcadores reflejan el progreso guardado en el mismo instante de
  la carga

### Requirement: Objetivo actual único y coherente con el HUD

Solo un destino SHALL estar resaltado como objetivo actual a la vez. El
resaltado SHALL distinguirse visualmente de los estados pendiente y completado.
El objetivo mostrado en el mundo SHALL coincidir con el destino y la distancia
que muestra el HUD.

#### Scenario: Coherencia tras un escaneo

- **WHEN** se completa un escaneo
- **THEN** el mundo resalta la consola y el HUD muestra la consola como destino

#### Scenario: Coherencia tras un informe

- **WHEN** se envía un informe
- **THEN** el mundo resalta el siguiente sitio y el HUD muestra ese mismo sitio

#### Scenario: Sin objetivo

- **WHEN** la misión termina
- **THEN** ningún marcador queda resaltado como objetivo actual

### Requirement: Visibilidad de los marcadores

Los marcadores de los sitios SHALL ser visibles desde el interior del hábitat y
desde el exterior, por encima de la geometría de la base, sin quedar ocultos por
las paredes o el suelo.

#### Scenario: Desde el hábitat

- **WHEN** la astronauta está dentro de la base
- **THEN** ve los marcadores de los sitios de estudio en la superficie

#### Scenario: Desde el exterior

- **WHEN** la astronauta recorre la superficie lunar
- **THEN** distingue el estado de cada sitio y cuál es el objetivo actual

### Requirement: Actualización inmediata al completar o cargar

Al completar un escaneo, enviar un informe o cargar una partida, los marcadores
SHALL recalcularse de inmediato, sin recargar la escena ni reiniciar el mundo, y
SHALL reflejar el nuevo objetivo actual.

#### Scenario: Actualización tras un escaneo

- **WHEN** termina un escaneo con éxito
- **THEN** el marcador del sitio cambia de estado en el mismo renderizado
  posterior, sin recargar la página

#### Scenario: Actualización tras un informe

- **WHEN** se envía un informe desde la consola
- **THEN** el marcador del sitio cambia a completado y el siguiente objetivo se
  resalta de inmediato

### Requirement: Los marcadores no interfieren con el juego

Los marcadores SHALL ser elementos visuales y NO SHALL bloquear el movimiento, la
cámara, la interacción ni la selección de máquinas.

#### Scenario: Caminar bajo un marcador

- **WHEN** la astronauta cruza por debajo de un marcador
- **THEN** se mueve con normalidad y puede interactuar con lo que tenga cerca

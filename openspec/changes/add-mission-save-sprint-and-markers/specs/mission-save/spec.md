# Spec Delta

## Purpose

Conservar y reanudar una partida de misión en el navegador, incluyendo el
desenlace de victoria o derrota y la integridad del archivo local.

## ADDED Requirements

### Requirement: Guardado automático de la partida en curso

Mientras una misión esté en curso y no sea un preset de demo, el juego SHALL
guardar una instantánea reanudable en el almacenamiento local del navegador en
cada tick, al abrir la pausa, al ocultar o cerrar la pestaña y antes de volver al
título. La instantánea SHALL incluir el estado de simulación, el ledger, la
posición y orientación de la astronauta, la velocidad del reloj y la fracción de
hora en curso. Los presets de demo NO SHALL escribir ni borrar el guardado de la
misión.

#### Scenario: Autoguardado por tick

- **WHEN** transcurre un tick de una misión en curso
- **THEN** el guardado local refleja el estado posterior a ese tick

#### Scenario: Autoguardado al pausar u ocultar

- **WHEN** el jugador abre la pausa, oculta la pestaña o cierra la página durante
  una misión en curso
- **THEN** se escribe una instantánea con el estado más reciente, incluida la
  fracción de hora transcurrida

#### Scenario: Preset de demo

- **WHEN** el jugador juega un preset de demo
- **THEN** el guardado de la misión real anterior permanece intacto y no se crea
  uno nuevo

### Requirement: Reanudación de la partida

Cuando exista un guardado válido en curso, el título SHALL ofrecer continuar y,
al elegirlo, el juego SHALL restaurar la partida sin repetir intro ni tutorial,
con el estado de simulación, la posición, la velocidad del reloj y el progreso
de misión del guardado, sin paneles ni escaneo activos.

#### Scenario: Restaurar el estado

- **WHEN** se reanuda una partida guardada
- **THEN** el tick, los recursos, la salud, las máquinas, las muestras y los
  informes coinciden con los del guardado

#### Scenario: Restaurar la posición y el reloj

- **WHEN** se reanuda una partida guardada
- **THEN** la astronauta aparece en la posición y orientación guardadas y el
  reloj usa la velocidad guardada

#### Scenario: Reanudar sin tutorial

- **WHEN** se reanuda una partida guardada
- **THEN** la partida entra directamente en juego, sin intro ni tutorial

### Requirement: Victoria conserva el guardado

Al ganar la misión, el juego SHALL conservar el guardado y marcarlo como
completado, de modo que el título muestre la misión como ganada y permita
continuar en freeplay desde la instantánea de victoria. La pantalla de evaluación
SHALL indicar que el guardado se conservó.

#### Scenario: Ganar la misión

- **WHEN** se envía el tercer informe y la misión termina en victoria
- **THEN** el guardado de esa misión sigue existiendo y queda marcado como
  completado

#### Scenario: Título tras la victoria

- **WHEN** el jugador vuelve al título después de ganar
- **THEN** la misión aparece como completada y se ofrece continuar en freeplay

#### Scenario: Reanudar una misión completada

- **WHEN** el jugador elige continuar una misión completada
- **THEN** el juego entra en freeplay desde la instantánea de victoria

#### Scenario: Aviso en la evaluación

- **WHEN** la evaluación se abre tras una victoria
- **THEN** muestra que el guardado de la misión se conservó

### Requirement: Derrota elimina el guardado

Al perder una misión en curso, el juego SHALL eliminar su guardado y NO SHALL
ofrecer reanudarla; el título SHALL volver a mostrar la misión como no iniciada y
la evaluación SHALL indicar que el guardado se eliminó. Una derrota posterior en
freeplay NO SHALL eliminar el guardado de una misión ya completada.

#### Scenario: Perder la misión

- **WHEN** la misión termina en derrota
- **THEN** el guardado de esa misión se elimina

#### Scenario: Título tras la derrota

- **WHEN** el jugador vuelve al título después de perder
- **THEN** no se ofrece continuar la misión y se puede empezar una nueva

#### Scenario: Derrota en freeplay

- **WHEN** la astronauta muere durante el freeplay de una misión ya ganada
- **THEN** el guardado completado se conserva

### Requirement: Nueva partida sobre un guardado existente

Iniciar una misión nueva desde el título con un guardado existente SHALL pedir
confirmación explícita antes de reemplazarlo. Cancelar la confirmación NO SHALL
modificar el guardado; confirmar SHALL eliminarlo antes de empezar la nueva
partida. Reiniciar desde la pausa o reintentar desde la evaluación SHALL
reemplazar el guardado sin confirmación, porque son acciones explícitas sobre la
partida actual.

#### Scenario: Confirmación obligatoria

- **WHEN** el jugador pulsa nueva misión en el título con un guardado existente
- **THEN** el juego pide confirmación antes de empezar

#### Scenario: Cancelar

- **WHEN** el jugador cancela la confirmación
- **THEN** el guardado anterior sigue disponible para continuar

#### Scenario: Confirmar

- **WHEN** el jugador confirma la nueva misión
- **THEN** el guardado anterior se elimina y empieza una partida nueva

#### Scenario: Reinicio desde la pausa

- **WHEN** el jugador reinicia la misión desde la pausa
- **THEN** el guardado anterior se reemplaza por el de la nueva partida

#### Scenario: Reintento desde la evaluación

- **WHEN** el jugador elige “Run it again” en la evaluación de una misión ganada
- **THEN** empieza una partida nueva que reemplaza el guardado completado

### Requirement: Integridad y disponibilidad del guardado

El guardado SHALL tener una versión de formato y SHALL validarse al cargar. Un
archivo ausente, ilegible, corrupto o de versión desconocida NO SHALL reanudarse
ni interrumpir el arranque; SHALL descartarse y el título SHALL informar de que
no se pudo leer. Un fallo de escritura SHALL NOT interrumpir la partida ni borrar
un guardado anterior válido.

#### Scenario: Archivo corrupto

- **WHEN** el guardado existe pero no se puede interpretar
- **THEN** no se reanuda, el juego arranca y el título avisa de que no se pudo
  leer

#### Scenario: Versión desconocida

- **WHEN** el guardado declara una versión de formato no soportada
- **THEN** se descarta y el título avisa de que no se pudo leer

#### Scenario: Almacenamiento no disponible

- **WHEN** el navegador bloquea o no ofrece almacenamiento local
- **THEN** el juego sigue siendo jugable y avisa de que el progreso no se puede
  guardar

#### Scenario: Fallo de escritura

- **WHEN** una escritura falla por cuota o por un error del navegador
- **THEN** la partida continúa y el guardado anterior válido no se pierde

### Requirement: Persistencia local sin red

El guardado SHALL residir en el almacenamiento local del navegador, SHALL
sobrevivir a una recarga de la página y NO SHALL requerir red, servidor ni
cuenta.

#### Scenario: Recargar la página

- **WHEN** el jugador recarga la página durante una misión en curso
- **THEN** el título ofrece continuar desde el último autoguardado

#### Scenario: Sin conexión

- **WHEN** el juego se ejecuta sin conexión de red
- **THEN** guardar y reanudar funcionan igual

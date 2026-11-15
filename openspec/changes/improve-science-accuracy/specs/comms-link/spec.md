# Spec Delta

## Purpose

Modelar el enlace de comunicaciones Tierra–Luna: el retardo de la luz y las
ventanas de relay por las que salen los informes científicos.

## ADDED Requirements

### Requirement: Retardo de la luz visible

La consola de comunicaciones SHALL mostrar el retardo de ida y vuelta
Tierra–Luna (1,28 s y 2,56 s) y SHALL explicar que no es posible controlar la
base en tiempo real.

#### Scenario: Consola abierta

- **WHEN** el jugador abre la consola de comunicaciones
- **THEN** el estado del enlace muestra el retardo de ida y vuelta de 2,56 s

#### Scenario: Explicación del retardo

- **WHEN** el jugador consulta el detalle del enlace o su entrada de glosario
- **THEN** se explica que la señal tarda 1,28 s en cada sentido y que las
  órdenes no pueden ser en tiempo real

### Requirement: Los informes entran en cola

Enviar un informe SHALL encolarlo en lugar de transmitirlo de inmediato. La cola
SHALL mostrar cuántos informes esperan y la cuenta atrás hasta el siguiente
pase. Un informe en cola NO SHALL contar como enviado.

#### Scenario: Informe encolado

- **WHEN** el jugador envía un informe desde la consola
- **THEN** el informe aparece en la cola, el contador de informes enviados no
  cambia y se muestra la hora del próximo pase

#### Scenario: Varios informes en cola

- **WHEN** hay dos o más informes esperando
- **THEN** la cola los muestra en orden y todos salen en el mismo pase

### Requirement: Pases de relay periódicos

El juego SHALL abrir un pase de relay a intervalos fijos de horas de juego. Al
abrirse un pase, todos los informes en cola SHALL transmitirse a la vez y la
cola SHALL quedar vacía.

#### Scenario: Transmisión en el pase

- **WHEN** llega la hora del siguiente pase y hay informes en cola
- **THEN** se transmiten todos, el contador de enviados aumenta y la cola queda
  vacía

#### Scenario: Cuenta atrás

- **WHEN** el jugador mantiene la consola abierta
- **THEN** la cuenta atrás hasta el próximo pase se actualiza con el reloj

### Requirement: Los cortes de DSN suspenden los pases

Durante un corte de DSN NO SHALL abrirse ningún pase. Los informes en cola SHALL
conservarse sin perderse y SHALL transmitirse en el primer pase posterior al
restablecimiento del enlace.

#### Scenario: Corte durante el pase

- **WHEN** un corte de DSN está activo cuando tocaría un pase
- **THEN** no se transmite ningún informe y la consola indica que el enlace está
  caído

#### Scenario: Recuperación del enlace

- **WHEN** termina el corte de DSN y hay informes en cola
- **THEN** el siguiente pase los transmite todos

### Requirement: La victoria exige transmisión

La victoria por misión científica SHALL ocurrir cuando se transmita el tercer
informe, no cuando se encole. Si el tercer informe está en cola, la partida
sigue en curso hasta el pase.

#### Scenario: Tercer informe en cola

- **WHEN** el jugador envía el tercer informe y aún no hay pase
- **THEN** la partida continúa y el HUD sigue mostrando la misión en curso hasta
  que el informe se transmite

#### Scenario: Tercer informe transmitido

- **WHEN** el pase transmite el tercer informe
- **THEN** la partida termina en victoria con los tres informes contados

### Requirement: La cola sobrevive al guardado

El guardado SHALL persistir los informes en cola y la hora del próximo pase. Al
reanudar, la cola y la cuenta atrás SHALL coincidir con el estado guardado.

#### Scenario: Reanudar con informes en cola

- **WHEN** se reanuda una partida guardada con informes esperando
- **THEN** la consola muestra los mismos informes en cola y la misma hora de
  pase que antes de cerrar

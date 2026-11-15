# Spec Delta

## Purpose

Sustituir la producción instantánea de comida por un ciclo de cultivo visible en
bandejas, con etapas de crecimiento y cosecha, comprimido en el tiempo para que
un estudiante pueda verlo dentro de una misión.

## ADDED Requirements

### Requirement: Bandejas de cultivo

La hidroponía SHALL tener un número fijo de bandejas. Una bandeja vacía SHALL
poder plantarse desde el panel de la máquina, consumiendo agua y energía.
Plantar NO SHALL producir comida de inmediato.

#### Scenario: Plantar una bandeja

- **WHEN** el jugador planta en una bandeja vacía con agua y energía suficientes
- **THEN** la bandeja pasa a la primera etapa de crecimiento y los insumos se
  descuentan

#### Scenario: Sin recursos para plantar

- **WHEN** el jugador intenta plantar sin agua o sin energía suficiente
- **THEN** la acción se rechaza con un motivo visible y la bandeja sigue vacía

### Requirement: Etapas de crecimiento visibles

Cada cultivo SHALL recorrer etapas de crecimiento y SHALL mostrar en el panel la
etapa actual, el tiempo restante y el rendimiento esperado. El ciclo completo
SHALL estar comprimido respecto al ciclo real y el panel SHALL declarar esa
compresión con la referencia real.

#### Scenario: Avance de etapa

- **WHEN** transcurre el intervalo configurado de una bandeja activa
- **THEN** el cultivo avanza a la siguiente etapa y el panel actualiza el tiempo
  restante

#### Scenario: Comparación con la realidad

- **WHEN** el jugador consulta el detalle de un cultivo
- **THEN** el panel indica cuánto tarda ese cultivo en la realidad y cuánto tarda
  en el juego, dejando claro que el tiempo está comprimido

### Requirement: La cosecha entrega la comida

Una bandeja madura SHALL poder cosecharse desde el panel. Al cosechar, la
comida SHALL aumentar en el rendimiento declarado y la bandeja SHALL quedar
vacía. Un cultivo maduro SHALL esperar sin perder rendimiento hasta que se
coseche.

#### Scenario: Cosechar

- **WHEN** el jugador cosecha una bandeja madura
- **THEN** la comida del inventario aumenta en el rendimiento mostrado y la
  bandeja vuelve a estar vacía

#### Scenario: Cultivo maduro sin cosechar

- **WHEN** un cultivo alcanza la madurez y el jugador no lo cosecha
- **THEN** el cultivo permanece disponible y no se pierde

### Requirement: Sin producción continua de comida

La hidroponía NO SHALL producir comida por tick. La única comida que aporta
SHALL venir de las cosechas; el resto del suministro son raciones y entregas de
emergencia.

#### Scenario: Bandeja recién plantada

- **WHEN** hay cultivos creciendo y ninguno maduro
- **THEN** la comida no aumenta por el invernadero

### Requirement: El crecimiento exige una máquina operativa

El crecimiento SHALL avanzar solo mientras la hidroponía esté encendida, sin
avería y con suministro eléctrico. Si la máquina se apaga o se avería, el
crecimiento SHALL pausarse sin destruir el cultivo, y SHALL reanudarse al
restablecerse la máquina.

#### Scenario: Apagado por falta de energía

- **WHEN** la escalera de apagado corta la hidroponía
- **THEN** el tiempo de crecimiento se detiene y el panel lo indica

#### Scenario: Reanudación

- **WHEN** la hidroponía vuelve a estar operativa
- **THEN** el crecimiento continúa desde la etapa y el tiempo restante que tenía

### Requirement: La comida de la misión sigue siendo suficiente

Con el ciclo y el rendimiento configurados, una misión estándar de 300 ticks
SHALL poder completarse sin que la comida llegue a cero bajo la política de
juego básica. El equilibrio SHALL verificarse con la simulación headless antes
de dar el cambio por terminado.

#### Scenario: Misión de referencia

- **WHEN** se ejecuta la simulación de equilibrio con la política básica
- **THEN** la comida se mantiene por encima de cero durante los 300 ticks y la
  partida puede completarse

### Requirement: El estado de los cultivos se guarda

El guardado SHALL incluir las bandejas, sus etapas, el progreso de cada cultivo y
el tiempo restante. Al reanudar, los cultivos SHALL continuar en el mismo punto.

#### Scenario: Reanudar a mitad de cultivo

- **WHEN** se reanuda una partida guardada con cultivos creciendo
- **THEN** cada bandeja conserva su etapa y su tiempo restante

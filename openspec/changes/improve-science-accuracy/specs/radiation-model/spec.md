# Spec Delta

## Purpose

Definir cómo la base registra la dosis de radiación, cómo se expresa en unidades
reales y qué ocurre cuando la tripulación alcanza el límite de la misión.

## ADDED Requirements

### Requirement: Dosis con equivalencia en mSv

El juego SHALL mantener el presupuesto de dosis de 0 a 100 y SHALL mostrar su
equivalente en mSv con una conversión declarada de 2,5 mSv por punto, de modo que
100 puntos equivalgan a 250 mSv. La conversión SHALL estar visible junto a
cualquier lectura de dosis y en el glosario.

#### Scenario: Lectura del HUD en ambas unidades

- **WHEN** la astronauta está en una partida en curso
- **THEN** el indicador de dosis muestra los puntos acumulados y su equivalente
  en mSv

#### Scenario: Conversión declarada

- **WHEN** el jugador abre el glosario o la nota de fuente de la dosis
- **THEN** se indica que 1 punto equivale a 2,5 mSv y que 100 puntos equivalen a
  250 mSv

### Requirement: Umbrales de dosis explicados

Los umbrales de dosis SHALL comunicarse en puntos y en mSv: 30 puntos (75 mSv)
para el inicio del daño, 70 puntos (175 mSv) para el daño continuo y 100 puntos
(250 mSv) para el fin de la misión.

#### Scenario: Aviso de umbral

- **WHEN** la dosis cruza los 30 puntos
- **THEN** el HUD muestra el aviso correspondiente con ambos valores y el
  indicador pasa a estado de advertencia

#### Scenario: Daño por encima del umbral alto

- **WHEN** la dosis supera los 70 puntos
- **THEN** el indicador pasa a estado crítico y el HUD muestra el umbral en
  puntos y en mSv

### Requirement: Fin de misión por límite de dosis

Al alcanzar 100 puntos de dosis, la partida SHALL terminar con un desenlace de
aborto médico por límite de dosis. La pantalla de evaluación SHALL describirlo
como superación del límite de misión y NO SHALL presentarlo como muerte por
radiación.

#### Scenario: Se alcanza el límite

- **WHEN** la dosis acumulada llega a 100 puntos
- **THEN** la partida termina como derrota y la evaluación indica que se superó
  el límite de dosis de la misión y que la misión se abortó

#### Scenario: Resumen final con unidades

- **WHEN** la evaluación muestra el pico o la dosis final
- **THEN** la cifra aparece en puntos y en mSv

### Requirement: Tasa de dosis en unidades reales

El HUD SHALL mostrar la tasa de dosis instantánea en mSv por hora además de los
puntos por hora, y SHALL distinguir entre estar bajo techo y estar en el
exterior.

#### Scenario: Tasa en el exterior

- **WHEN** la astronauta está en el exterior durante una ventana de radiación
- **THEN** la tasa mostrada refleja el incremento del evento en puntos por hora
  y en mSv por hora

#### Scenario: Tasa bajo techo

- **WHEN** la astronauta está bajo techo
- **THEN** la tasa mostrada indica que el hábitat está blindado y no acumula
  dosis de fondo

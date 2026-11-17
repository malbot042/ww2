# Frentes 1939–45

Juego de acción táctica con vista cenital, ambientado en la Segunda Guerra Mundial. Tú controlas una unidad en acción directa y das órdenes al resto de tu escuadra: 10 contra 10 en el mar, en el aire y en tierra. Está hecho con HTML, JavaScript y [Three.js](https://threejs.org) (r160, cargado desde jsDelivr). No hay que compilar nada.

**Jugar online:** https://malbot042.github.io/ww2/

Para jugar en local hay que servir la carpeta, porque los módulos ES no funcionan con `file://`. Por ejemplo: `python3 -m http.server` y después abrir `http://localhost:8000`.

## Frentes y batallas

| Frente | Naval | Aérea | Tanques | Combinada |
|---|---|---|---|---|
| **Pacífico** (EE. UU. contra Japón) | Islas Salomón, 1942 | Midway, 1942 | — | — |
| **Norte de África** (Commonwealth contra Alemania e Italia) | — | Desierto occidental, 1942 | El Alamein, 1942 | — |
| **Europa** (Aliados contra Alemania) | Canal de la Mancha, 1944 | Sobre el Canal, 1944 | Bocage normando, 1944 | **Día D: playa de Normandía, 1944** |

Cada frente tiene también una **campaña**, que encadena sus batallas en el orden naval → aérea → tanques (→ combinada) y acumula la puntuación.

### Batalla combinada: Día D
Mar, aire y tierra en el mismo mapa. 13 unidades aliadas contra 10 alemanas:
- **Aliados:** crucero, 2 destructores, lancha, 3 P-51, 2 P-47 y 4 tanques que desembarcan en la playa.
- **Alemanes:** destructor, 2 S-Boot, U-Boot, 3 aviones y 4 blindados, apoyados por 3 baterías costeras y 2 antiaéreos.

Los objetivos A (salida de la playa) y B (pueblo) los capturan los tanques; el C (fondeadero) lo capturan los barcos. Los barcos pueden bombardear la costa, los tanques pueden disparar a los barcos cercanos y los aviones atacan lo que haya debajo. Con **Tab** saltas entre barco, avión y tanque, y con **G** seleccionas por tipo para dar órdenes solo a la flota, a la aviación o a los blindados. Si mandas un barco a un objetivo de tierra, se coloca en el agua más cercana para apoyar con su artillería.

### Unidades
- **Naval:** cruceros (Baltimore, Takao, Belfast, Admiral Hipper), destructores (Fletcher, Kagero, Tribal, Z 1936), **submarinos** (Gato, I-15, Clase T, U-Boot VII C) y lanchas torpederas (PT-109, MTB Vosper, S-Boot).
- **Aérea:** Wildcat, Zero, Dauntless, Val, Kittyhawk, Hurricane, Bf 109 F/G, Macchi C.202, Stuka, P-51D, P-47 y Fw 190 F.
- **Tanques:** Sherman, Firefly, Cromwell, M10, Grant, Crusader, Panzer III, Panzer IV F2/H, M13/40, Panther, StuG III y Tiger I.

## Cómo se gana
- **Naval y tanques:** cada bando tiene 600 puntos. Si controlas más objetivos (A, B, C) que el enemigo, él pierde puntos cada segundo. Cada unidad destruida también resta puntos a su bando.
- **Aérea:** cada bando tiene 3 instalaciones (aeródromo, depósito y radar) protegidas por antiaéreos. Gana quien destruye las del rival o agota sus puntos.

## Controles

| Tecla | Acción |
|---|---|
| ↑ ↓ | Acelerar y frenar tu unidad |
| ← → | Girar |
| Espacio (o Ctrl derecho) | Arma principal; las torretas apuntan solas |
| Shift | Secundaria: torpedos, bombas, humo o cañón de cubierta |
| C | Sumergirse/emerger (submarino) o cargas de profundidad (destructor) |
| T | Siguiente blanco (queda fijado) · **Y** vuelve al blanco automático · clic sobre un enemigo para fijarlo |
| **W S** | Bajar o subir la cámara: de la vista cenital a la de persecución |
| **A D** | Girar la cámara alrededor de tu unidad |
| **V** | Vistas: cenital, desde atrás, lateral izquierdo, lateral derecho y mirando hacia atrás (B vuelve a cenital) |
| Z X / rueda | Zoom |
| 1 2 3 | Enviar la escuadra seleccionada al objetivo A, B o C |
| Q · E · R · F | Seguirme · Ataque libre · Mantener posición · Defender |
| G | Seleccionar por tipo: todos, barcos, aviones o tanques |
| Tab | Tomar el mando de otra unidad |
| M | Mapa táctico con todo el campo de batalla |
| P | Pausa táctica (puedes seguir dando órdenes) |
| Esc | Seleccionar a toda la escuadra |

**Ratón (opcional):** arrastra para seleccionar unidades, haz clic derecho sobre un objetivo o un punto del mapa para darles una orden y doble clic sobre una unidad para tomar su mando.

## Detalles tácticos
- **Ritmo arcade:** barcos y tanques se mueven más rápido que en la realidad; el HUD muestra la velocidad real equivalente.
- **Selección de blanco:** si no fijas uno, se elige automáticamente: en barcos se prefiere el blanco al que apuntan más torres y en tanques el más cercano a la dirección del cañón; además se priorizan los dañados y los que te están disparando. El panel muestra la vida y la distancia del blanco, cuántas torres apuntan y por qué lado le das a un tanque (y cuánto daño hace eso).
- **Barcos:** las torres tienen arcos de tiro, así que de costado disparan todas a la vez. La artillería traza una parábola con dispersión. Los torpedos son lentos pero devastadores.
- **Submarinos:** sumergidos son invisibles para los cañones, pero gastan batería. Los destructores los detectan de cerca y los atacan con cargas de profundidad.
- **Tanques:** el blindaje es más débil por los lados y por detrás, así que flanquear compensa. Disparar en movimiento es menos preciso. El humo corta la línea de tiro.
- **Aviones:** la mira de bombas marca el punto de impacto. Los bombarderos llevan ametrallador de cola y la flak explota por proximidad.

## Estructura
```
index.html        menús, HUD e importmap de three.js
css/style.css
js/main.js        render, cámara, bucle, menús y entrada
js/data.js        frentes, batallas y catálogo de unidades
js/world.js       terreno por escenario, shader de agua, vegetación y atmósfera
js/models.js      modelos procedurales de barcos, aviones, tanques e instalaciones
js/units.js       movimiento, armas, proyectiles, daño e IA de las unidades
js/battle.js      preparación de la batalla, objetivos, puntos, mando enemigo y órdenes
js/hud.js         HUD, minimapa y marcadores de puntería
js/fx.js          partículas (humo, fuego, espuma) y audio sintetizado
v1.html           primer prototipo (v0.1)
```
Con `#debug` en la URL queda disponible `window.__ww2` para pruebas automáticas.

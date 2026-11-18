# Frentes 1939–45

Juego de acción táctica con vista cenital, ambientado en la Segunda Guerra Mundial. Tú controlas una unidad en acción directa y das órdenes al resto de tu escuadra: 10 contra 10 en el mar, en el aire y en tierra. Está hecho con HTML, JavaScript y [Three.js](https://threejs.org) (r160, cargado desde jsDelivr). No hay que compilar nada.

**Jugar online:** https://malbot042.github.io/ww2/

Para jugar en local hay que servir la carpeta, porque los módulos ES no funcionan con `file://`. Por ejemplo: `python3 -m http.server` y después abrir `http://localhost:8000`.

## Frentes y batallas

| Frente | Naval | Aérea | Tanques | Combinada |
|---|---|---|---|---|
| **Pacífico** (EE. UU. contra Japón) | Islas Salomón, 1942 | Midway, 1942 | — | **Tarawa, 1943** |
| **Norte de África** (Commonwealth contra Alemania e Italia) | — | Desierto occidental, 1942 | El Alamein, 1942 | **Asedio de Tobruk, 1941** |
| **Europa** (Aliados contra Alemania) | Canal de la Mancha, 1944 | Sobre el Canal, 1944 | Bocage normando, 1944 | **Día D: playa de Normandía, 1944** |

Cada frente tiene también una **campaña**, que encadena sus batallas y acumula la puntuación. Las unidades que sobreviven ganan **veteranía** (★ Regular, ★★ Veterano, ★★★ Élite: más vida, precisión y cadencia), cada victoria da puntos extra de despliegue y desbloquea una unidad, y la campaña se guarda en el navegador para continuarla después.

Antes de cada batalla eliges también la **hora** (día, atardecer o noche) y el **clima** (despejado, niebla o tormenta).

### Batalla combinada: Día D
Mar, aire y tierra en el mismo mapa. 13 unidades aliadas contra 10 alemanas:
- **Aliados:** crucero, 2 destructores, lancha, 3 P-51, 2 P-47 y 4 tanques que desembarcan en la playa.
- **Alemanes:** destructor, 2 S-Boot, U-Boot, 3 aviones y 4 blindados, apoyados por 3 baterías costeras y 2 antiaéreos.

Los objetivos A (salida de la playa) y B (pueblo) los capturan los tanques; el C (fondeadero) lo capturan los barcos. Los barcos pueden bombardear la costa, los tanques pueden disparar a los barcos cercanos y los aviones atacan lo que haya debajo. Con **Tab** saltas entre barco, avión y tanque, y con **G** seleccionas por tipo para dar órdenes solo a la flota, a la aviación o a los blindados. Si mandas un barco a un objetivo de tierra, se coloca en el agua más cercana para apoyar con su artillería.

### Unidades
- **Naval:** portaaviones (Yorktown, Akagi), acorazados (Washington, Iowa, Kirishima, Yamato, Bismarck, Rodney), cruceros (Baltimore, Takao, Belfast, Admiral Hipper), destructores (Fletcher, Kagero, Tribal, Z 1936), **submarinos** (Gato, I-15, Clase T, U-Boot VII C) y lanchas torpederas (PT-109, MTB Vosper, S-Boot).
- **Aérea:** Wildcat, Zero, Dauntless, Val, Kittyhawk, Hurricane, Bf 109 F/G, Macchi C.202, Stuka, P-51D, P-47 y Fw 190 F; bombarderos pesados B-17, Lancaster y He 111.
- **Tanques:** Sherman, Firefly, Cromwell, M10, Grant, Crusader, Panzer III, Panzer IV F2/H, M13/40, Panther, StuG III, Tiger I, Matilda II y Chi-Ha; infantería y cañones antitanque de cada bando.

## Hangar
La tarjeta **Hangar** del menú muestra las 73 unidades del juego (barcos, aviones, carros, infantería, cañones y defensas) en 3D sobre una plataforma giratoria: arrastra para girarlas y usa la rueda para acercarte. Para cada una verás su papel en combate, barras comparativas (resistencia, velocidad, potencia de fuego, alcance, blindaje), el armamento en detalle, sus controles y el coste de despliegue. Desde ahí puedes saltar a una **prueba rápida** en el campo de pruebas (con la unidad ya colocada en su terreno y blancos delante) o a cualquier **batalla** en la que aparece.

## Tutorial
La tarjeta **Tutorial** del menú enseña lo básico en 10 pasos guiados (unos 5 minutos): moverse, cámara, zoom, fijar un blanco, disparar, munición, control de daños, órdenes a la escuadra, cambiar de unidad y mapa táctico.

## Campo de pruebas
Mapa propio (unos 5 × 5 km jugables) que mezcla los tres frentes: **desierto** al oeste, **campiña europea** con setos y pueblos al este, una franja de estepa entre ambos y, al sur, el **Pacífico** con islas tropicales y atolones. Los botones **Desierto / Europa / Pacífico** del panel llevan tu unidad al terreno elegido (a tierra, al agua o por encima, según lo que manejes).

Una tarjeta aparte en el menú lleva a un mapa con mar, playa y tierra, sin puntos ni derrota. Desde el panel de la derecha puedes:
- Ser **cualquier unidad** del catálogo, incluidas las del Eje.
- Añadir enemigos o aliados de cualquier modelo, también baterías costeras y antiaéreos. Los enemigos pueden ser **pasivos**, quietos o en movimiento, o tener la IA activada.
- Colocar **blancos fijos** adaptados a tu unidad: tanques orientados de distintas formas para probar el blindaje, barcos para practicar disparar de costado, aviones para practicar la puntería.
- Reparar tu unidad, activar la **invulnerabilidad** y ver el **daño de cada impacto**, con el lado y el multiplicador de blindaje.

## Marcas en amarillo
- **Blanco seleccionado:** anillo y flecha amarilla sobre él en el mapa 3D (visible con cualquier cámara y zoom), círculo y línea discontinua en el minimapa, y panel del blanco con borde amarillo en el HUD.
- **Objetivo ordenado:** el objetivo A, B o C (o la instalación, en las batallas aéreas) al que va la mayor parte de tu selección se resalta en amarillo en la barra superior, en el minimapa y en el anillo del mapa.

## Cómo se gana
- **Naval y tanques:** cada bando tiene 600 puntos. Si controlas más objetivos (A, B, C) que el enemigo, él pierde puntos cada segundo. Cada unidad destruida también resta puntos a su bando.
- **Aérea:** cada bando tiene 3 instalaciones (aeródromo, depósito y radar) protegidas por antiaéreos. Gana quien destruye las del rival o agota sus puntos.

## Modo sencillo y modo veterano
Por defecto el juego arranca en **modo sencillo**, pensado para jugar sin aprender veinte teclas:
- Antes de la batalla ves la fuerza recomendada y un solo botón, **¡Al combate!** (sin niebla de guerra ni colocación). «Personalizar…» abre las opciones completas.
- Órdenes básicas: objetivos **1 2 3**, **Q** seguidme y **E** ataque libre. La escuadra decide su formación.
- La **munición se elige sola** (HE contra infantería y cañones, AP contra blindados); **N** la cambia a mano.
- **7** pide el apoyo más útil en ese momento (artillería, aviones o refuerzos).
- La barra de abajo solo muestra las teclas que sirven a tu unidad en ese instante.

El **modo veterano** (se elige en el menú principal o en la pausa) activa todo: presupuesto y colocación, niebla de guerra, mantener y defender, formaciones, grupos, órdenes encadenadas y los tres apoyos por separado. La tabla siguiente es la de este modo.

## Controles

| Tecla | Acción |
|---|---|
| ↑ ↓ | Acelerar y frenar tu unidad; en avión, **picar** (↑) y **subir** (↓) |
| ← → | Girar |
| Espacio (o Ctrl derecho) | Arma principal; las torretas apuntan solas |
| Shift | Secundaria: torpedos, bombas, humo o cañón de cubierta |
| N | Munición perforante (AP) o explosiva (HE) |
| K | Control de daños: apaga incendios y repara averías (40 s de espera) |
| C | Sumergirse/emerger (submarino) o cargas de profundidad (destructor) |
| T | Siguiente blanco (queda fijado) · **Y** vuelve al blanco automático · clic sobre un enemigo para fijarlo |
| **W S** | Bajar o subir la cámara: de la vista cenital a la de persecución |
| **A D** | Girar la cámara alrededor de tu unidad |
| **V** | Vistas: cenital, desde atrás, lateral izquierdo, lateral derecho y mirando hacia atrás (B vuelve a cenital) |
| Z X / rueda | Zoom |
| 1 2 3 | Enviar la escuadra seleccionada al objetivo A, B o C · con **Shift**, encadenar (A y luego B…) |
| 7 · 8 · 9 | Apoyo con puntos de mando: artillería · ataque aéreo · refuerzo |
| O | Formación: cuña, línea o columna |
| Q · E · R · F | Seguirme · Ataque libre · Mantener posición · Defender |
| G | Seleccionar por tipo: todos, barcos, aviones o tanques |
| Tab | Tomar el mando de otra unidad |
| M | Mapa táctico con todo el campo de batalla |
| J | Bengala (de noche o al atardecer): ilumina y revela la zona |
| L | Aterrizar en el portaaviones · **Shift** en un portaaviones lanza un avión |
| P | Pausa táctica (puedes seguir dando órdenes); incluye volúmenes, calidad gráfica, FPS y cámara lenta |
| Esc | Seleccionar a toda la escuadra |

**Mando:** stick izquierdo mueve, stick derecho la cámara, RT dispara, LT secundaria, A blanco, B reparar, X sígueme, Y vista, LB cambiar unidad, RB mapa, cruceta para objetivos y Select/Start para pausa.

**Pantalla táctil:** joystick virtual, botones de acción y de órdenes, pellizco para el zoom y un dedo para girar la cámara.

**Ratón (opcional):** arrastra para seleccionar unidades, **Shift + clic derecho** para añadir puntos de ruta, haz clic derecho sobre un objetivo o un punto del mapa para darles una orden y doble clic sobre una unidad para tomar su mando.

## Averías, munición y altitud (v0.6)
- **Averías por partes:**
  - Barcos: torres, motor, timón e incendio.
  - Tanques: orugas, motor, torreta e incendio.
  - Aviones: motor, mandos e incendio.
  - **K** activa el control de daños.
- **Munición limitada:** AP contra blindados y barcos, HE contra infantería, cañones y defensas (cambias con **N**). Para rearmarte y reparar, vuelve a tu **base**, el círculo verde con **R**.
- **Aviones con altitud real:** picar da velocidad, subir la quita, y puedes estrellarte. Desde arriba las bombas se dispersan más.
- **Infantería con bazuca o Panzerschreck y cañones antitanque** en El Alamein, el Bocage y el Día D. Los tanques tienen ametralladora coaxial automática.

## Estrategia (v0.7)
- **Despliegue:** antes de cada batalla eliges la composición con un presupuesto y colocas tus unidades (1–5 disposiciones rápidas, arrastrar con el ratón, Enter para empezar).
- **Niebla de guerra:** solo ves lo que detectan tus unidades (radar, sonar, línea de visión). Se puede desactivar en el despliegue.
- **Puntos de mando:** se ganan controlando objetivos y destruyendo enemigos, y se gastan en artillería (7), ataque aéreo (8) o refuerzos (9). El enemigo también los usa.
- **Formaciones, rutas y órdenes encadenadas,** y un mando enemigo que concentra fuerzas, flanquea y se retira a reparar.

Todos los campos de batalla son 1,4 veces más grandes que en las primeras versiones (el doble de superficie).

## Contenido, aspecto y comodidad (v0.8–v1.0)
- **Portaaviones** que lanzan y recuperan aviones, **acorazados** de torres lentas y gran calibre y **bombarderos pesados** en formación en caja con varios artilleros.
- **Noche y clima:** menos detección y más dispersión; bengalas, reflectores, lluvia, rayos y mar gruesa que mueve los barcos.
- **Daño visible** (quemaduras, escora, restos, cráteres, petróleo), **estelas** de condensación y **rodadas** de los carros.
- **Sonido:** motores por tipo, radio con voz en español, música procedural según la intensidad del combate.
- **Cámara lenta** en los grandes derribos y **repetición** de los últimos 20 s al terminar.
- **Aspecto retro:** la escena se dibuja siempre a baja resolución (360 líneas) y se muestra con un **efecto de monitor CRT** sin curvatura (líneas de barrido, rejilla RGB, resplandor). Se puede quitar el CRT en la pausa.
- **Calidad gráfica** Baja/Media/Alta (sombras, vegetación, partículas) con contador de FPS, **guardado** de opciones, campaña y récords.
- **Pantalla partida:** un segundo jugador maneja el Eje con un mando o con el teclado numérico (opción en el despliegue).

La hoja de ruta completa está en [MEJORAS.md](MEJORAS.md).

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
js/sandbox.js     campo de pruebas
js/strategy.js    niebla de guerra, puntos de mando y apoyo
js/deploy.js      fase de despliegue (composición y colocación)
js/env.js         hora del día, clima, lluvia, rayos, bengalas y reflectores
js/campaign.js    veteranía, premios y desbloqueos de campaña
js/damagefx.js    daño visible, restos, cráteres y petróleo
js/marks.js       rodadas de los carros
js/sound.js       música procedural, radio con voz y volúmenes
js/replay.js      grabación y repetición de los últimos 20 s
js/quality.js     niveles de calidad y contador de FPS
js/post.js        render a baja resolución y pase CRT
js/gamepad.js     mando (Gamepad API)
js/touch.js       controles táctiles
js/save.js        guardado en localStorage
js/tutorial.js    tutorial guiado
js/split.js       multijugador local a pantalla partida
js/hangar.js      hangar 3D con fichas de todas las unidades
v1.html           primer prototipo (v0.1)
```
Con `#debug` en la URL queda disponible `window.__ww2` para pruebas automáticas.

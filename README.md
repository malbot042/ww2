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

## Escuela de mando (estrategia de grupo)
La tarjeta **Escuela de mando** del menú explica cómo combate cada grupo: naval, aéreo, terrestre y combinado. Para cada uno muestra la formación de partida (diagrama visto desde arriba), las fases del enfrentamiento, los errores típicos y una tabla con la **misión de cada tipo de unidad**, su **posición y distancia** dentro del grupo y **cuándo entra en combate** (por ejemplo: submarinos 1200–1500 m por delante explorando, pantalla de destructores a 500–700 m, acorazados abriendo fuego a máxima distancia y sin acercarse a menos de 1000 m, portaaviones 800–1000 m detrás).

La IA de los dos bandos —y el mando aliado cuando coordina tu escuadra— sigue esta doctrina en las batallas:
- **Flota:** el buque más pesado hace de insignia; los demás ocupan su puesto en la formación (pantalla de destructores por delante en arco, cruceros a los lados, submarinos muy adelantados, lanchas en los flancos y un destructor pegado al portaaviones). Las fases cambian solas: exploración, duelo artillero cuando el enemigo está a menos de 1700 m y, tras 25 s de duelo o si el enemigo se acerca a menos de 750 m, ataque con torpedos de destructores, cruceros, lanchas y submarinos.
- **Aire:** de los cazas, 2 de cada 5 escoltan de cerca a los bombarderos, 2 hacen cobertura alta (unos 75 m más arriba, atacando picando) y 1 defiende las instalaciones propias.
- **Tierra:** la infantería abre camino hacia el objetivo; los carros avanzan por saltos (la mitad espera cubriendo mientras la otra avanza, y se turnan cada 7 s) hasta el contacto; los carros de cañón largo se quedan vigilando a la distancia de su cañón; los antitanque defienden.
- En las combinadas cada dominio aplica su doctrina; el orden aviación → flota → desembarco no se fuerza.

Cada grupo (salvo el combinado) tiene una **demostración en 3D** en el campo de pruebas: la formación aparece con el nombre y el anillo de alcance de cada unidad, y la IA ejecuta las fases (exploración, duelo artillero, ataque de destructores; cobertura alta y escolta cercana; avance por saltos, vigilancia y flanqueo) mientras el panel lo explica paso a paso. También se abre desde el panel del campo de pruebas, y la ficha de cada unidad en el hangar incluye su **papel en el grupo**.

## Maniobras básicas
Lecciones cortas y guiadas (2–4 pasos que se comprueban solos) para aprender a combatir con cada tipo de unidad. Se practican en el campo de pruebas, eres invulnerable y los blancos no disparan salvo cuando la lección lo pide:
- **Naval:** andanada de costado, ataque con torpedos (apuntar con ventaja) y caza de submarinos con cargas de profundidad.
- **Aérea:** altitud y energía (subir, picar, viraje cerrado), ponerse a las seis de un bombardero y bombardeo en picado.
- **Carros:** dar el frente (blindaje), flanqueo de un Panther y munición AP/HE con cortina de humo.

Se abren desde el panel **Maniobras básicas** del campo de pruebas o desde la ficha de cada unidad en el **Hangar**. Si la unidad elegida sirve para la lección (por ejemplo, tiene torpedos), se usa esa; si no, una adecuada.

## Tutorial
La tarjeta **Tutorial** del menú enseña lo básico en 10 pasos guiados (unos 5 minutos): moverse, cámara, zoom, fijar un blanco, disparar, munición, control de daños, órdenes a la escuadra, cambiar de unidad y mapa táctico.

## Campos de pruebas
Sin puntos ni derrota, hay un escenario hecho para cada modo (se elige en la tarjeta del menú o con los botones Naval / Aéreo / Terrestre del panel):
- **Naval:** mar abierto con islas y arrecifes; puedes llevar cualquier barco y añadir barcos o aviones como blancos.
- **Aéreo:** el mapa mixto con el **Pacífico** y sus islas al suroeste, el **desierto africano** al sur y la **campiña europea** al este, para practicar combate aéreo y bombardeo contra blancos aéreos, navales y terrestres; los botones **Desierto / Europa / Pacífico** llevan tu avión a cada zona.
- **Terrestre:** campiña normanda con setos, pueblos y colinas para probar blindajes, munición, flanqueos y avance por saltos.

En cada uno, el panel ofrece solo las unidades, maniobras básicas y demostraciones de estrategia de ese modo; «Blancos fijos» coloca blancos adecuados (barcos y un submarino; cazas, bombarderos y antiaéreos; carros, infantería y cañones). La prueba rápida del hangar, las maniobras y las demostraciones abren el campo del modo que corresponde.

## Marcas en amarillo
- **Blanco seleccionado:** anillo y flecha amarilla sobre él en el mapa 3D (visible con cualquier cámara y zoom), círculo y línea discontinua en el minimapa, y panel del blanco con borde amarillo en el HUD.
- **Objetivo ordenado:** el objetivo A, B o C (o la instalación, en las batallas aéreas) al que va la mayor parte de tu selección se resalta en amarillo en la barra superior, en el minimapa y en el anillo del mapa.

## Cómo se gana
- **Naval y tanques:** cada bando tiene 600 puntos. Si controlas más objetivos (A, B, C) que el enemigo, él pierde puntos cada segundo. Cada unidad destruida también resta puntos a su bando.
- **Aérea:** cada bando tiene 3 instalaciones (aeródromo, depósito y radar) protegidas por antiaéreos. Gana quien destruye las del rival o agota sus puntos.

## Dificultad
Se elige en el menú principal o en la pausa (se guarda) y solo afecta al enemigo:

| | Fácil | Medio | Difícil |
|---|---|---|---|
| Daño enemigo | ×0,75 | ×1 | ×1,15 |
| Dispersión del tiro enemigo | ×1,5 | ×1 | ×0,85 |
| Recarga enemiga | 30 % más lenta | 10 % más lenta | igual que la tuya |
| Apoyos enemigos | cada 18 s, sin refuerzos | cada 9 s | cada 7 s y refuerzos antes |
| Replanificación del mando enemigo | cada 14 s | cada 7 s | cada 5 s |
| Puntos de batalla aliados | +25 % | — | — |
| Puntuación | ×0,75 | ×1 | ×1,25 |

En el campo de pruebas y en las demostraciones no se aplica.

## Mando aliado coordinado por IA
Por defecto la escuadra aliada actúa coordinada bajo un **mando aliado de IA**: cada pocos segundos reparte las unidades entre los objetivos (concentra el esfuerzo donde el enemigo es más débil o donde hay que defender), mantiene los portaaviones atrás y los cañones antitanque en posición, organiza escoltas en las batallas aéreas y pide apoyo de artillería, aviación o refuerzos cuando sobran puntos de mando (siempre deja una reserva para ti). Te avisa por radio del esfuerzo principal, y en la lista de escuadra las órdenes de la IA aparecen como «IA · …».

Tú sigues mandando: cualquier orden que des (objetivos, sígueme, ataque libre, rutas…) tiene prioridad durante 45 s; después la IA vuelve a integrar esas unidades en el plan. En el menú principal o en la pausa puedes cambiar **Mando aliado** a «Solo mis órdenes» para dirigirlo todo tú.

## Modo sencillo y modo veterano
Por defecto el juego arranca en **modo sencillo**, pensado para jugar sin aprender veinte teclas:
- Antes de la batalla ves la fuerza recomendada y un solo botón, **¡Al combate!** (sin niebla de guerra ni colocación). «Personalizar…» abre las opciones completas.
- Órdenes básicas: objetivos **1 2 3**, **Q** seguidme y **E** ataque libre. La escuadra decide su formación.
- La **munición se elige sola** (HE contra infantería y cañones, AP contra blindados); **N** la cambia a mano.
- **7** pide el apoyo más útil en ese momento (artillería, aviones o refuerzos).
- La barra de abajo solo muestra las teclas que sirven a tu unidad en ese instante.

El **modo veterano** (se elige en el menú principal o en la pausa) activa todo: presupuesto y colocación, niebla de guerra, mantener y defender, formaciones, grupos, órdenes encadenadas y los tres apoyos por separado. La tabla siguiente es la de este modo.

## Línea de visión, cobertura y colisiones
- **Islas y colinas tapan**: un barco o tanque detrás de una isla o una loma no se ve ni se puede apuntar; la IA tampoco dispara a través del terreno. Los aviones ven por encima de todo.
- **Cobertura terrestre**: setos, bosques, palmeras, rocas y casas reducen la distancia a la que se ve una unidad (hasta −45 %) y paran parte de los disparos (≈40 % × cobertura, más con casas). Mucha vegetación entre tirador y blanco también corta la visión.
- **Choques entre navíos**: los barcos se esquivan; si chocan, el daño depende de la masa y la velocidad relativa (menor entre propios). Un destructor puede embestir a un submarino en superficie, que recibe el doble.
- **Aire**: colisiones en el aire raras, solo entre enemigos que se cruzan de frente a gran velocidad.
- **Tierra**: los carros arrollan infantería enemiga y se dañan al embestir otro vehículo a velocidad.

## Ayudas en pantalla (v2.3)
- **Portada sencilla**: un gran botón **Jugar** lleva a la siguiente batalla recomendada (de la más sencilla a la más exigente; si hay campaña en curso, la continúa). Frentes y campañas, Aprender (tutorial y escuela), Hangar y Campos de pruebas quedan en el menú de abajo.
- **Línea de tiro**: si tu blanco está tapado, la retícula se vuelve gris con el aviso «SIN LÍNEA DE TIRO» y el panel explica si lo tapa el relieve o la vegetación y casas. Tu unidad no malgasta disparos contra el terreno.
- **Estado de tu unidad**: «A cubierto» (vegetación o edificios) o «Al descubierto», y «El enemigo no te ve» / «Te están viendo».
- **Marcas de impacto**: distintas al acertar, al rebotar en el blindaje (con consejo para buscar el lateral), en un punto débil, al causar averías (motor, orugas, timón, torre…), al alcanzar la **santabárbara** (munición: gran daño e incendio) y cuando la cobertura para el disparo.
- **Punto de anticipación**: círculo que marca dónde apuntar a un avión enemigo (verde cuando las ráfagas van a acertar), dónde se cruzarán los torpedos de submarinos y lanchas con el blanco (la guía se pone verde al estar bien alineada) y dónde caerán los proyectiles de la artillería naval.
- **Pausa táctica** (<kbd>Intro</kbd>, Select en el mando, botón «Táctica» en pantalla táctil): congela la acción sin tapar el campo de batalla para dar órdenes, seleccionar o cambiar de unidad con calma. <kbd>P</kbd> sigue abriendo la pausa con la ayuda y las opciones.

## Inercia de giro (v2.4)
- **Barcos**: el giro entra poco a poco según el tamaño (≈0,5 s una lancha, ≈1 s un destructor, ≈2,5 s un acorazado) y sigue un poco al soltar el timón. La IA lo anticipa para no pasarse.
- **Aviones**: primero alabean (hasta ~60°, a ~290°/s) y el giro sale del alabeo; invertir un giro a fondo tarda ~0,4 s.
- **Tanques**: las orugas tardan ~0,3 s en coger el giro a fondo y en pararlo.
- Las velocidades máximas de giro no cambian (mismo equilibrio).

## Vista «Hacia el blanco» (v2.5)
Con <kbd>V</kbd> se llega a la vista **Hacia el blanco**: la cámara se coloca detrás de tu unidad, en la línea que va hacia tu blanco, así lo tienes siempre delante aunque gires o te adelante. Usa el blanco fijado (<kbd>T</kbd>) o el automático; si no hay ninguno, el enemigo visible más cercano (en avión, prefiere otros aviones). Si no hay enemigos, se comporta como la vista desde atrás. <kbd>A</kbd>/<kbd>D</kbd> siguen girando la cámara alrededor.

## Avisos, cámara automática, resumen y medallas (v2.6)
- **Flechas de amenaza** en los bordes: enemigos fuera de pantalla que te apuntan (rojo, con distancia), aviones **a tus seis** (amarillo) y torpedos que vienen hacia ti.
- **Dirección del daño**: un arco rojo alrededor de tu unidad señala desde dónde te han dado.
- **Aviso de torpedo**: alarma, mensaje con el lado (proa, popa, babor, estribor) y los segundos hasta el impacto, y una línea roja con su trayectoria (naranja si va a pasar de largo).
- **Cámara automática**: con combate cerca pasa sola a la vista «Hacia el blanco» y vuelve a la cenital cuando no queda nadie cerca. Si eliges vista a mano en pleno combate, se respeta. Se desactiva en Pausa → opciones.
- **Cobertura en las órdenes**: al mandar mover a unidades de tierra se marcan los setos, bosques y casas cercanos al destino, y cada unidad se coloca en el más próximo a su puesto. Con «Sígueme», cuando te paras, tus tanques e infantería se ponen a cubierto junto a su puesto.
- **Resumen final**: tus bajas por tipo, aciertos y precisión, daño causado y recibido, bajas de tu bando y una línea de tiempo con quién controlaba cada zona y los puntos de batalla.
- **Estrellas por batalla**: ★ ganar · ★★ con menos del 30 % de bajas · ★★★ con menos del 15 % en dificultad media o difícil. Se ven en la portada, en cada frente y en las batallas de la campaña.
- **Medallas** (pestaña Medallas de la portada): Bautismo de fuego, As del aire, Cazador de submarinos, Pez de acero, Matagigantes, Cazacarros, Embestida, Santabárbara, Buen tirador, Superviviente, Victoria impecable, Veterano, Perfeccionista y Campaña completada.

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
js/drills.js      maniobras básicas guiadas (naval, aérea y carros)
js/doctrine.js    escuela de mando: doctrina de grupo y demostraciones en 3D
v1.html           primer prototipo (v0.1)
```
Con `#debug` en la URL queda disponible `window.__ww2` para pruebas automáticas.

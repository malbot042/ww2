# Hoja de ruta de mejoras — Frentes 1939–45

Estado de cada idea:
- ✅ **Hecho**
- 🟡 **Siguiente**: propuesta para la próxima ronda
- ⬜ **Pendiente**

Las ideas están agrupadas por lo que aportan al juego.

---

## 1. Lo que más se notaría al jugar — ✅ hecho en v0.6

### 1.1 Daño por partes (averías) ✅
Las unidades ya no solo pierden vida: algunos impactos inutilizan partes concretas.

| Unidad | Averías posibles | Efecto |
|---|---|---|
| Barcos | Torre destruida, motor, timón, incendio | La torre deja de disparar; la velocidad baja a la mitad; el giro baja al 35 %; el incendio quita vida durante 16–26 s |
| Tanques | Orugas, motor, torreta, incendio | Inmovilizado unos 9 s; mitad de velocidad; la torreta gira al 30 % y recarga más lenta; quema |
| Aviones | Motor, mandos, incendio | Pierde altura y velocidad y suelta humo; gira peor; quema |

- **Dónde se golpea importa:**
  - En barcos, un impacto en popa daña el timón o el motor, y un impacto cerca de una torre puede destruirla. Los torpedos y la munición explosiva provocan incendios.
  - En tanques, los impactos laterales rompen orugas, los traseros dañan el motor o causan incendios, y los frontales pueden atascar la torreta.
- **K · Control de daños:** apaga el fuego al instante y repara motor, timón, mandos, torreta y orugas en 3–5 s. Después hay que esperar 40 s para volver a usarlo. La IA también lo usa.
- **En la base** se repara todo, incluidas las torres destruidas.
- El HUD muestra las averías como etiquetas rojas, y los impactos críticos que causas aparecen como «¡Timón dañado!».

### 1.2 Munición limitada y tipos de proyectil ✅
- **N** alterna entre perforante (AP) y explosiva (HE) en tanques, cañones antitanque y la artillería de los barcos.
  - **AP:** daño completo contra blindados y barcos; poco contra infantería (×0,35) y defensas (×0,6).
  - **HE:** ×1,6 contra infantería, cañones, defensas y costa, con metralla en un radio de unos 8 m; ×0,45 contra blindados; más incendios en los barcos.
- **Munición limitada:** salvas de AP y HE, torpedos, cargas de profundidad, cañón de cubierta, bombas, balas de ametralladora y cohetes de la infantería.
- **Bases de reabastecimiento** (círculo verde con una **R**), una por tipo de unidad, donde despliega cada bando. Dentro de ellas se recupera munición, vida, averías y batería del submarino.
- **La IA vuelve a rearmarse** cuando se queda sin munición, y elige AP o HE según el blanco.

### 1.3 Altitud real en los aviones ✅
- **↑ pica** (bajas y ganas velocidad) y **↓ sube** (pierdes velocidad). La velocidad depende de la energía, no de un acelerador.
- **Ventajas y riesgos de la altura:**
  - Más alto: menos expuesto a las ametralladoras antiaéreas, pero las bombas se dispersan más.
  - Más bajo: bombardeo preciso y ametrallamiento de blancos en tierra, pero más riesgo de choque.
- **Choque contra el suelo o el agua**, con aviso «¡BAJO!» en el HUD y una línea vertical hasta el suelo.
- **IA:** los cazas igualan la altura de su blanco y solo disparan si están a su nivel. Los bombarderos se acercan alto y bajan en picado sobre el objetivo.
- **Ametralladoras:** disparan en la dirección de vuelo, así que al picar se puede ametrallar en tierra. Hay ayuda de puntería vertical contra aviones a ±60 m.

### 1.4 Infantería y cañones antitanque ✅
- **Escuadras de 6 soldados:**
  - Fusileros de EE. UU. con bazuca, sección británica con PIAT, granaderos con Panzerschreck y Afrika Korps.
  - Disparan con fusil a infantería y a dotaciones, y con el arma antitanque contra blindados a menos de 140 m, donde el lateral y la popa son más débiles.
  - Si se quedan quietas reciben menos daño (cuerpo a tierra) y van perdiendo soldados según su vida.
- **Cañones antitanque** (57 mm M1, 6 libras y Pak 40): perfil bajo, giro limitado y gran pegada. Los alemanes ya están emplazados junto a los objetivos.
- **Ametralladora coaxial automática** en los tanques contra infantería y dotaciones.
- Están en El Alamein, en el Bocage normando y en el Día D. Capturan objetivos y se pueden controlar con Tab.

---

## 2. Más estrategia — ✅ hecho en v0.7

### 2.1 Niebla de guerra ✅
- Solo ves lo que detectan tus unidades. Cada tipo tiene su alcance:
  - Destructores y cruceros (radar): 1400 m.
  - Aviones: hasta 950 m, más cuanto más altos.
  - Tanques: 560 m.
  - Infantería: 430 m.
  - Estación de radar: 1800 m.
- **Más difíciles de ver:** la infantería quieta (cuerpo a tierra), los cañones antitanque, las lanchas y los submarinos.
- **Submarinos sumergidos:** solo se detectan con el sonar de los destructores (260 m) o a muy corta distancia.
- **Línea de visión en tierra:** las colinas y el humo tapan.
- **Disparar delata la posición** durante 2 s.
- **Última posición conocida:** una ✕ en el minimapa y un icono atenuado en el mapa táctico durante 25 s. Las zonas que tus unidades no ven aparecen en sombra en el minimapa.
- **La IA también juega con niebla:** el mando enemigo y sus unidades solo usan lo que ven. Las órdenes de «ataque libre» van a la última posición conocida.
- Se puede desactivar en la pantalla de despliegue.

### 2.2 Fase de despliegue ✅
- **Composición con presupuesto:** antes de cada batalla eliges cuántas unidades de cada modelo llevas.
  - El presupuesto equivale a la composición original.
  - Los modelos disponibles son los que usa tu bando en ese frente.
  - Puedes llevar hasta 3 unidades más que el roster original.
- **Colocación:** con el tiempo detenido, arrastras tus unidades dentro de los círculos azules de tierra y mar, o eliges una disposición:
  - **1** Línea · **2** Cuña · **3** Columna · **4** Flanco izquierdo · **5** Flanco derecho.
  - **Enter** comienza la batalla.
- La campaña y la opción «Repetir» también pasan por el despliegue.

### 2.3 Puntos de mando y apoyo ✅
- **Cómo se ganan:** cada segundo, más por cada objetivo controlado (o por cada instalación viva en las batallas aéreas), y por cada enemigo destruido.
- **7 · Artillería o salva naval (60):** marca de humo rojo y, a los 5 s, 16 proyectiles en un radio de 60 m. **Hay fuego amigo.**
- **8 · Ataque aéreo (90):** dos cazabombarderos (Dauntless, Hurricane o P-47) bombardean el punto y se marchan.
- **9 · Refuerzo (110):** una unidad nueva del tipo que controlas aparece en tu base.
- **Dónde apuntan:** al punto bajo el ratón, a tu blanco, al objetivo ordenado o al primer objetivo que no es tuyo.
- **El enemigo también los usa:** artillería contra grupos de tus unidades, ataques aéreos contra blindados o barcos, y refuerzos cuando pierde fuerzas. Recibes un aviso cuando lo hace.

### 2.4 Formaciones, rutas y órdenes encadenadas ✅
- **O** cambia la formación entre cuña, línea y columna. Se aplica al seguirte y al mover la escuadra; al mover, la formación se orienta según la dirección de marcha.
- **Shift + clic derecho** añade puntos de ruta. Las unidades los recorren en orden y luego mantienen la posición.
- **Shift + 1/2/3** encadena objetivos (por ejemplo, «toma A y luego B»). La siguiente orden empieza cuando el objetivo es tuyo y la unidad está dentro.
- La escuadra muestra la ruta («Ruta 2/4») o la cadena («Objetivo A → B»). En el mapa táctico se dibujan las rutas.

### 2.5 IA enemiga más lista ✅
- **Esfuerzo principal:** elige el objetivo que más le conviene atacar o defender y concentra allí sus fuerzas. Defiende los objetivos amenazados.
- **Reorganización** cada 7 s en lugar de cada 12.
- **Flanqueo:** la mitad de sus tanques busca el lateral de los blindados con buen frontal.
- **Retirada:** las unidades por debajo del 30 % de vida vuelven a la base a reparar y regresan al 70 %. Lo hacen también tus unidades controladas por la IA.
- **Cañones antitanque emplazados** junto a los objetivos.

## 3. Contenido

| Mejora | Estado | Notas |
|---|---|---|
| Batalla combinada en el Pacífico | 🟡 | Desembarco en un atolón con tanques Chi-Ha y búnkeres |
| Batalla combinada en África | ⬜ | Tobruk: puerto, convoyes y asedio |
| Portaaviones | ⬜ | Lanzar y recuperar escuadrillas; blanco de gran valor |
| Acorazados | ⬜ | Iowa, Yamato y Bismarck |
| Bombarderos pesados | ⬜ | B-17 y Lancaster en formación con varias torretas |
| Noche y clima | ⬜ | Bengalas, focos, niebla, tormenta y mar agitado que afecte a la puntería |
| Campaña con progresión | ⬜ | Experiencia de las unidades que sobreviven y desbloqueo por épocas |

## 4. Aspecto y sensación

| Mejora | Estado | Notas |
|---|---|---|
| Daño visible en los modelos | ⬜ | Agujeros, escora progresiva y restos (de momento se ven las torres torcidas, el humo y el fuego) |
| Estelas de vapor y huellas | ⬜ | Estelas a gran altitud y huellas de orugas en la arena |
| Olas que mueven los barcos | ⬜ | Según el estado del mar |
| Sonido | ⬜ | Motores por tipo, radio con órdenes y música |
| Cámara cinemática y repetición | ⬜ | Al destruir algo importante y al final de la batalla |

## 5. Técnico y comodidad

| Mejora | Estado | Notas |
|---|---|---|
| **Selector de calidad y contador de fotogramas** | 🟡 | Sombras, vegetación y partículas ajustables; necesario porque no se ha medido el rendimiento en equipos reales |
| Mando de consola | ⬜ | Gamepad API |
| Controles táctiles | ⬜ | Tablet y móvil |
| Guardado | ⬜ | Campaña, puntuaciones y opciones en el navegador |
| Tutorial guiado | ⬜ | 3–4 minutos: control, órdenes, cámara, munición y averías |
| Multijugador | ⬜ | Local o en línea; es lo más costoso de la lista |

---

## Historial

| Versión | Contenido |
|---|---|
| v0.1 | Prototipo: tanque, destructor y caza en un mapa combinado |
| v0.2 | Mando táctico 10 contra 10, tres frentes, siete batallas y gráficos nuevos |
| v0.3 | Cámara orbital (WASD y V), control con flechas, alabeo corregido |
| v0.4 | Batalla combinada del Día D; velocidad y selección de blancos |
| v0.5 | Campo de pruebas; blanco y objetivo marcados en amarillo |
| v0.6 | Averías por partes, munición AP/HE limitada y bases, altitud real en aviones, infantería y cañones antitanque |
| v0.7 | Niebla de guerra, despliegue con presupuesto, puntos de mando (artillería, ataque aéreo, refuerzos), formaciones, rutas y órdenes encadenadas, IA más lista |

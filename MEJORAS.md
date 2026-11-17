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

## 2. Más estrategia

| Mejora | Estado | Notas |
|---|---|---|
| **Niebla de guerra** | 🟡 | Ver solo lo que detectan tus unidades: reconocimiento aéreo, radar en barcos, sonar contra submarinos, visión limitada por setos y colinas |
| Fase de despliegue | ⬜ | Elegir composición con un presupuesto y colocar las unidades antes de empezar |
| Refuerzos y apoyo por puntos | ⬜ | Ganar puntos con los objetivos para pedir bombardeo naval, un ataque aéreo o refuerzos |
| Formaciones y rutas | ⬜ | Columna, línea o cuña; rutas con varios puntos (Shift+clic); órdenes encadenadas |
| IA enemiga más lista | ⬜ | Flanquear, retirarse dañada, concentrar fuerzas y reaccionar a tus movimientos |

## 3. Contenido

| Mejora | Estado | Notas |
|---|---|---|
| Batalla combinada en el Pacífico | ⬜ | Desembarco en un atolón con tanques Chi-Ha y búnkeres |
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

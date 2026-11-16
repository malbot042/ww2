# Frentes 1939–45

Juego arcade de combate con vista cenital, ambientado en la Segunda Guerra Mundial. Usa HTML y JavaScript con Three.js (r128 desde cdnjs). Todo el juego es un único archivo, `index.html`: no hay que compilar nada ni tener servidor.

## Cómo jugar

**Jugar online:** https://malbot042.github.io/ww2/

También puedes abrir `index.html` directamente en el navegador.

| Tecla | Acción |
|---|---|
| W A S D / flechas | Acelerar, frenar y girar |
| Espacio | Arma principal. La torreta apunta sola al enemigo más cercano; en el caza, disparo frontal con ayuda de puntería |
| Shift / X | Arma secundaria: ametralladora AA (tanque), torpedos (destructor) o bombas (caza) |
| 1 2 3 / Tab | Cambiar de unidad |
| P | Pausa |

## Prototipo actual (v0.1)

- **Mapa grande (4×4 km)** con tres teatros que se funden entre sí: Europa al noroeste, Norte de África al suroeste y Pacífico al este, con islas y mar abierto.
- **Grupo aliado** formado por un M4 Sherman, un destructor Fletcher y un P-51 Mustang. Puedes cambiar de unidad en cualquier momento. Las que no controlas se defienden solas, pero con menos alcance y menos daño.
- **Enemigos del Eje** que llegan en oleadas crecientes: Panzer IV, destructores, cazas Bf 109 y bombarderos en picado Ju 87 Stuka.
- **Bases aliadas** (círculo verde) donde las unidades se reparan.
- **Refuerzos limitados:** si se pierden las tres unidades sin refuerzos disponibles, la partida termina.
- **Efectos:** sombras, nubes con sombra propia, estelas de barco, polvo de orugas, humo de daño y sonido sintetizado con WebAudio.

Para depurar, con `index.html#debug` queda disponible `window.__ww2`, que permite avanzar la simulación paso a paso.

## Próximos pasos propuestos

1. Más modelos por época: 1939–41, 1942–43 y 1944–45, con su hangar y selector.
2. Misiones con objetivos, como escoltar un convoy, desembarcar o destruir un puente.
3. Portaaviones y submarino.
4. Soporte para mando (Gamepad API) y ratón opcional.

# Sincronización Porteña

Simulación interactiva del modelo de Kuramoto aplicado a semáforos, ambientada
en el Microcentro de la Ciudad de Buenos Aires. Está basada en el modelo de
osciladores de fase de Nishikawa, Nakazawa y Kita (2003) y en el relevamiento
de tránsito de [`../aplicaciones_ciudad`](../aplicaciones_ciudad).

El jugador arma una red con cuadras reales del mapa; los semáforos son
osciladores que se acoplan según el flujo de autos y terminan coordinándose
solos. La aplicación es un sitio estático con estética pixel art, sin paso de
compilación.

## Cómo correr

Los datos de calles se cargan con `loadJSON`, así que hace falta servirlos por
HTTP (abrir `index.html` con `file://` falla por CORS):

```bash
cd sincro-ba
python3 -m http.server 8000
```

Después, abrir <http://localhost:8000>. También sirve cualquier otro servidor
de archivos estáticos.

## Qué se puede hacer

- **Elegir una escena.** `Córdoba, una mano` arma la onda verde de Av. Córdoba
  hacia el oeste; `Doble mano` usa ocho cuadras de Av. Presidente Roque Sáenz
  Peña, donde dos sentidos compiten.
- **Cambiar el tránsito.** Bajo, medio o alto ajustan a la vez el acople `K` y
  la cantidad de autos visibles.
- **Editar la red.** Las herramientas `Mirar`, `Calle`, `Borrar` y `Graficar`
  se eligen desde la barra inferior o con las teclas `1` a `4`. Con `Calle`
  se puede pintar arrastrando con el mouse.
- **Desordenar y reiniciar.** `Mezclar` reparte fases al azar para ver cómo la
  red vuelve al equilibrio; `Reiniciar escena` la deja como al principio.
- **Seguir la sincronización.** El indicador `Potencial V` baja a medida que
  los semáforos se ordenan, y `Tardó en sincronizar` marca el momento en que
  todas las cuadras quedan azules.
- **Ver los gráficos.** El panel muestra el potencial en el tiempo, el desfase
  de hasta cuatro calles contra su objetivo y una rueda con una cuadra por
  punto.
- **Jugar en el celular.** Hay gestos de arrastre y zoom, pestañas para los
  paneles y botones para ocultarlos.

## Modelo

Cada esquina con semáforo es un oscilador de fase `φᵢ` en `[0, 2π)`. La red se
describe con tres estructuras: `vecinos[i]` (esquinas conectadas), `K[j][i]`
(flujo de `j` hacia `i`, cero si la calle es contramano en ese sentido) y
`delta[j][i]` (desfase objetivo de ese flujo).

La dinámica es la ecuación 11 del paper, en su versión bidireccional:

```
dφᵢ/dt = ω + (1/|Nᵢ|) Σⱼ [ K[j][i]/2 · sin(φⱼ − φᵢ − Δ[j][i])
                          + K[i][j]/2 · sin(φⱼ − φᵢ + Δ[i][j]) ]
```

El desfase objetivo de una cuadra de largo `L` sale del tiempo de viaje
(ecuación 1):

```
Δ = 2π · L / (v · T)   (módulo 2π)
```

El potencial que se muestra en pantalla es

```
V = ½ Σᵢ Σⱼ K[j][i] · (1 − cos(φⱼ − φᵢ − Δ[j][i]))
```

y con esta forma de las derivadas nunca sube. La red se considera sincronizada
cuando ninguna fase se aparta de `ω` más de una tolerancia.

Parámetros por defecto:

| Parámetro | Valor |
|---|---|
| Ciclo del semáforo `T` | 90 s (lo fija cada escena) |
| Velocidad de marcha `v` | 40 km/h |
| Verde de la calle principal `s` | 0,5 del ciclo |
| Peso base `K` | 0,5 por calle y 5 por avenida |
| Acople por nivel de tránsito | ×0,4 (bajo), ×1 (medio), ×2 (alto) |
| Tolerancia de sincronización | 0,1 rad |
| Integración | Euler, `dt ≤ 0,01 s` |

Las cuadras de doble mano no pueden cumplir sus dos flujos a la vez: se las
evalúa contra el mejor equilibrio posible, en fase si `Δ < π/2` y en antifase
si `Δ > π/2` (ecuación 2). Una cuadra que es principal en una punta y
secundaria en la otra corrige su objetivo según la ecuación 17.

## Estructura

| Archivo | Rol |
|---|---|
| `index.html` | Estructura de la pantalla de inicio, el juego y los paneles |
| `css/estilo.css` | Estilos, tipografía y disposición responsive |
| `js/modelo.js` | Ecuaciones del modelo: derivadas, potencial, desfases y criterios de sincronización |
| `js/calles.js` | Carga el grafo de OSM, mide cuadras y reparte los verdes de cada esquina |
| `js/plano.js` | Arma la red que el jugador edita y la matriz de acoples |
| `js/escenarios.js` | Niveles de tránsito y las dos escenas precargadas |
| `js/autos.js` | Autos ilustrativos que recorren la red (no alteran las fases) |
| `js/dibujo.js` | Dibujo pixel art del mapa, las calles, los semáforos y los autos |
| `js/graficos.js` | Gráficos de Chart.js: potencial, desfases y rueda |
| `js/gestos.js` | Paneo, zoom y gestos táctiles |
| `js/sonido.js` | Efectos sintetizados con Web Audio |
| `js/ayuda.js` | Textos y globos de ayuda |
| `js/paleta.js` | Colores del mundo |
| `js/principal.js` | Inicialización, bucle de simulación, interfaz y transiciones |
| `assets/` | Mapa, grafo de calles, Obelisco y tipografía Monocraft |
| `vendor/` | p5.js, Chart.js y QUnit |
| `tests/` | Pruebas de QUnit |

## Datos y assets

`assets/calles_microcentro.json` es el grafo del Microcentro: 401 esquinas,
624 cuadras y 75 calles, con clase (`avenida`, `calle`, `peatonal`), mano y
largo en metros. Las coordenadas están en píxeles del mapa de 320×180, con una
escala de 8,11 m por píxel. El grafo y el mapa se derivaron de
OpenStreetMap; `assets/mapa_microcentro.png` (640×360) se dibuja ampliado ×2
en una capa de 1280×720.

## Tests

Las pruebas usan QUnit y cubren el modelo, el plano, los autos, los gráficos y
los escenarios. Con el servidor levantado:

<http://localhost:8000/tests/index.html>

La ciudad de prueba (`tests/ciudad_de_prueba.js`) es un grafo chico escrito a
mano, para que los resultados no dependan del mapa real.

## Compatibilidad

Funciona en navegadores modernos de escritorio y celular. Necesita canvas,
Web Audio y `matchMedia`; no usa frameworks ni dependencias instalables. En
pantallas chicas los paneles pasan a pestañas y el canvas se ajusta con
`visualViewport` para no quedar cortado por la barra del navegador.

## Créditos

- Modelo: Nishikawa, Nakazawa y Kita, *Self-organized control of traffic
  signals*, 2003.
- Cartografía: colaboradores de OpenStreetMap.
- Conteos de tránsito: BA Data, *Volumen Vehicular 2024*.
- Tipografía Monocraft, bajo licencia OFL (`assets/fuentes/OFL.txt`).

## Declaración de uso de IA

_(Sección pendiente de completar.)_

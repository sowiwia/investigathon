# Aplicaciones ciudad

Análisis de datos abiertos de tránsito de la Ciudad de Buenos Aires y
simulaciones del modelo de semáforos sobre dos corredores reales: el circuito
del centro (Entre Ríos → Belgrano → Paseo Colón → Independencia) y la
Av. Córdoba en sentido oeste. Los flujos medidos se usan como pesos de acople
`K` y las distancias entre cruces como desfases objetivo `Δ`. Los mismos dos
corredores son las escenas de la simulación interactiva de
[`../sincro-ba`](../sincro-ba).

## Contenido

| Archivo | Qué es |
|---|---|
| `circuito.ipynb` | Flujo de los cuatro sensores del circuito, simulación de los 45 semáforos con los flujos de cada cuarto de hora y animación del circuito |
| `onda_verde.ipynb` | Flujo de los doce sensores de Av. Córdoba (oeste), simulación de la onda verde para varias condiciones iniciales y barrido de velocidades |
| `volumen_vehicular_2024_detalle_semanal.csv` | Conteos vehiculares crudos (BA Data, semana del 2 al 8 de marzo de 2024) |
| `semaforos_circuito_distancias.csv` | 46 cruces semaforizados del circuito, con coordenadas y distancias |
| `semaforos_cordoba_oeste.csv` | 35 cruces semaforizados de Av. Córdoba hacia el oeste, con distancias |
| `mapa_circuito.png` | Mapa del circuito (5,06 km, 45 cruces) con los cuatro sensores marcados |
| `mapa_cordoba_oeste.png` | Mapa de Av. Córdoba hacia el oeste (4,42 km, 35 semáforos, 12 sensores) |

## Datos

### Volumen vehicular

`volumen_vehicular_2024_detalle_semanal.csv` tiene 231.191 filas y 16 columnas.
Cada fila es el conteo de un tipo de vehículo en una ubicación, durante un
cuarto de hora de un día:

| Columna | Contenido |
|---|---|
| `fecha_conteo`, `anio_conteo`, `mes_conteo` | Día del relevamiento |
| `dia_semana_conteo` | `LUN` … `DOM` |
| `franja_horaria_conteo` | Hora del día, de `0` a `23` |
| `cuarto_hora_conteo` | Cuarto de hora dentro de la franja, de `1` a `4` |
| `ubicacion_conteo` | Nombre y altura de la posta de conteo |
| `longitud_conteo`, `latitud_conteo`, `comuna_conteo` | Posición y comuna |
| `cantidad_carriles_via_conteos`, `especificacion_via_conteos` | Carriles y tipo de vía |
| `tipo_circulacion_via_conteos`, `sentido_circulacion_conteo` | Circulación y sentido (`norte`, `sur`, `este`, `oeste`) |
| `tipo_vehiculo` | `Auto/Camión`, `Taxi`, `Colectivo`, `Moto`, `Otros` |
| `conteo_vehiculos` | Vehículos contados |

El archivo cubre una sola semana (2 al 8 de marzo de 2024), 95 ubicaciones y
las 24 horas del día. Los notebooks se quedan con los días hábiles
(`LUN` a `VIE`) y con la franja de las 8.

### Semáforos y distancias

Los dos CSV de semáforos se armaron a partir de OpenStreetMap y de los puntos
de conteo de BA Data. Tienen una fila por cruce, ordenada a lo largo del
recorrido, con la distancia al inicio y la distancia al cruce anterior en
metros. El del circuito también trae latitud y longitud.

- Circuito: 46 cruces (incluido el punto de inicio) y 5.059 m.
- Av. Córdoba oeste: 35 cruces y 4.361 m.

## Modelo

Cada semáforo es un oscilador de fase `φ_i`. Las fases evolucionan según

```
dφ_i/dt = ω + (1/d) Σ_{j vecino de i} [ (K_ji/2) sin(φ_j − φ_i − Δ_ji)
                                       + (K_ij/2) sin(φ_j − φ_i + Δ_ij) ]
```

que es el descenso por gradiente del potencial

```
V = Σ_i (1/d) Σ_{j vecino de i} (1/2) K_ji (1 − cos(φ_j − φ_i − Δ_ji))
```

- `A` es la matriz de adyacencia entre semáforos consecutivos y `d` el grado.
- `K` pesa cada cuadra con su flujo, normalizado por el máximo, y solo en el
  sentido de circulación.
- `Δ = 2πL/(vT)` es el desfase objetivo de una cuadra de largo `L`, para una
  velocidad de marcha `v` y un ciclo común `T` (90 s).

Cuando `V` llega a un mínimo, cada semáforo queda atrasado respecto del
anterior lo justo para que un auto a velocidad `v` los encuentre en verde.

Las funciones `condiciones_iniciales_random` (fases uniformes en `[−π, π)`),
`ecuaciones` y `simular` (integra con `scipy.integrate.solve_ivp`) están
copiadas de [`../simulaciones/Colab_investigathon.ipynb`](../simulaciones/Colab_investigathon.ipynb)
en una celda propia de cada notebook. Esa celda tiene que correrse antes que
las simulaciones.

## Notebooks

### `circuito.ipynb`

**Análisis del flujo.** Filtra los conteos de 8:00 a 9:00 de los cuatro
sensores del circuito, suma por cuarto de hora y promedia entre los días
hábiles. El resultado es una curva de vehículos promedio cada 15 minutos para
cada sentido:

| Sensor | Sentido |
|---|---|
| Entre Ríos 678 | norte |
| Belgrano 324 | este |
| Paseo Colón 753 | sur |
| Independencia 1784 | oeste |

**Simulaciones.** Arma el circuito como un anillo de 45 semáforos: el último
tramo de Independencia vuelve al inicio. Cada tramo toma el flujo del sensor de
su avenida, con estos promedios en vehículos cada 15 minutos:

| Cuarto | Entre Ríos | Belgrano | Paseo Colón | Independencia |
|---|---|---|---|---|
| 8:00–8:15 | 57,6 | 14,0 | 193,6 | 233,0 |
| 8:15–8:30 | 59,2 | 7,0 | 180,4 | 242,0 |
| 8:30–8:45 | 68,2 | 32,6 | 192,2 | 269,0 |
| 8:45–9:00 | 67,8 | 96,4 | 206,2 | 282,8 |

Simula los cuatro cuartos de hora con `v = 60 km/h`, `T = 90 s` y 1000 s de
simulación, partiendo siempre de la misma condición inicial (semilla 0). Para
cada caso grafica:

- los desfases `φ_{k+1} − φ_k` de cada tramo, con un color por avenida, y
- el potencial `V(t)`.

**Animación.** Simula 1200 s del cuarto 8:00–8:15 y dibuja los 45 semáforos
sobre sus coordenadas reales, en verde o rojo según la fase. La simulación
corre en el sistema que rota con `ω = 2π/T`, así que para la animación se le
suma `ωt`. Cada semáforo está en verde la mitad del ciclo (`VERDE = 0.5`). Los
parámetros (`CUARTO`, `T_ANIM`, `DT_FRAME`, `SEMILLA`, `VERDE`) están al
principio de la celda.

### `onda_verde.ipynb`

**Análisis del flujo.** Hace lo mismo para los doce sensores de Av. Córdoba
entre 1147 y 4570, todos en sentido oeste, y grafica una serie por sensor.

**Armado del modelo.** Toma los 35 semáforos de Libertad a Araoz y saca los
dos últimos (`QUITAR_ULTIMOS = 2`), porque ahí los sensores (4471 y 4570) marcan
más de 600 vehículos cada 15 minutos, muy por encima del resto. Quedan
33 semáforos, de Libertad a Lavalleja, y 10 sensores. A diferencia del
circuito, Córdoba es una recta abierta.

Los sensores se ubican sobre la avenida en proporción a su altura. El flujo de
cada tramo se interpola entre los sensores vecinos en el punto medio de la
cuadra. Por defecto se usa el cuarto 8:00–8:15 (`CUARTO = 0`) y
`v = 30 km/h`.

**Simulaciones.**

- *Varias condiciones iniciales:* 30 simulaciones de 1000 s con semillas
  0 a 29, y todas las curvas `V(t)` en un mismo gráfico. `V(t)` se calcula
  para toda la trayectoria de una vez con `potencial_vectorizado`.
- *Barrido de velocidades:* repite las 30 condiciones iniciales para 20, 30,
  40, 50 y 60 km/h. Solo cambia `Δ`, porque `A` y `K` no dependen de la
  velocidad. Las curvas se pintan con un color por velocidad. Se puede apagar
  con `BARRER_V = False`.

## Cómo ejecutar

Los notebooks esperan los CSV en el directorio actual, así que hay que abrir
Jupyter desde esta carpeta:

```bash
cd aplicaciones_ciudad
python3 -m venv .venv
source .venv/bin/activate
pip install jupyter pandas numpy scipy seaborn matplotlib
jupyter lab
```

Se usó Python 3.12. Conviene correr cada notebook de arriba hacia abajo. Las
simulaciones son lentas porque `ecuaciones` recorre la red con dos `for` de
Python: el barrido de velocidades de Córdoba (150 integraciones) tarda varios
minutos. La animación del circuito pesa unos 17 MB en el notebook; el límite de
`animation.embed_limit` está subido a 100 MB para que no se corte.

## Relación con la simulación

- El flujo por cuarto de hora y por sentido es el peso de acople `K` de cada
  cuadra, tanto acá como en `sincro-ba`.
- Las distancias entre cruces definen el desfase objetivo `Δ` de cada cuadra.
- Los dos corredores corresponden a las escenas de la simulación: el circuito
  del centro y la onda verde de Av. Córdoba hacia el oeste.

## Notas y limitaciones

- Solo hay una semana de conteos; los promedios son de cinco días hábiles.
- Se analiza únicamente la hora pico de la mañana (8:00 a 9:00).
- Los conteos son por posta y por sentido, no por carril.
- El ciclo de 90 s y las velocidades de marcha son supuestos, no datos
  relevados.
- En Córdoba, la ubicación de los sensores entre semáforos es aproximada:
  proporcional a la altura, no medida.
- Los mapas y las distancias se midieron sobre OpenStreetMap; los cruces
  semaforizados pueden no coincidir exactamente con el relevamiento oficial.


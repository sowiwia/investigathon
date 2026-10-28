# Aplicaciones ciudad

Análisis exploratorio de datos abiertos de tránsito de la Ciudad de Buenos Aires
para caracterizar dos corredores reales: el circuito del centro
(Entre Ríos → Belgrano → Paseo Colón → Independencia) y la Av. Córdoba en
sentido oeste. Los resultados alimentan los parámetros de la simulación de
semáforos de [`../sincro-ba`](../sincro-ba).

## Contenido

| Archivo | Qué es |
|---|---|
| `flujo_vehicular.ipynb` | Flujo promedio cada 15 minutos en los cuatro sensores del circuito, entre las 8:00 y las 9:00 |
| `onda_verde.ipynb` | Flujo promedio en los doce sensores de Av. Córdoba (oeste) y su relación con la onda verde |
| `semaforos.ipynb` | Primeras tablas del relevamiento de semáforos: separa el circuito por avenida |
| `volumen_vehicular_2024_detalle_semanal.csv` | Conteos vehiculares crudos (BA Data, semana del 2 al 8 de marzo de 2024) |
| `semaforos_circuito_distancias.csv` | 46 cruces semaforizados del circuito, con distancia acumulada desde el inicio |
| `semaforos_cordoba_oeste.csv` | 35 cruces semaforizados de Av. Córdoba hacia el oeste, con distancias |
| `mapa_circuito.png` | Mapa del circuito (5,06 km, 45 cruces) con los cuatro sensores marcados |
| `mapa_cordoba_oeste.png` | Mapa de Av. Córdoba hacia el oeste (4,42 km, 35 semáforos, 12 sensores) |
| `mapa_puntos_conteo_centro.png` | Puntos de conteo de la zona centro; en negrita, los cuatro del circuito |

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
metros. Esa distancia es la que define el desfase objetivo entre semáforos
vecinos, `Δ = 2πL/(vT)`.

- Circuito: 46 cruces (incluido el punto de inicio) y 5.059 m.
- Av. Córdoba oeste: 35 cruces y 4.361 m.

## Notebooks

### `flujo_vehicular.ipynb`

Filtra los conteos de las 8:00 a las 9:00 de los cuatro sensores del circuito,
suma por cuarto de hora y promedia entre los días hábiles. El resultado es una
curva de vehículos promedio cada 15 minutos para cada sentido:

| Sensor | Sentido |
|---|---|
| Entre Ríos 678 | norte |
| Belgrano 324 | este |
| Paseo Colón 753 | sur |
| Independencia 1784 | oeste |

La figura final compara las cuatro curvas y muestra cómo el flujo no es
constante dentro de la hora.

### `onda_verde.ipynb`

Hace lo mismo para los doce sensores de Av. Córdoba entre 1147 y 4570, todos
en sentido oeste, y grafica una serie por sensor. Al final carga
`semaforos_cordoba_oeste.csv` para cruzar el flujo con las distancias entre
semáforos, que es la base de la onda verde: con `v` y `T` fijos, cada cuadra
impone un atraso.

### `semaforos.ipynb`

Lee `semaforos_circuito_distancias.csv`, descarta las coordenadas y separa los
cruces por avenida (`Entre Ríos`, `Belgrano`, `Paseo Colón`, `Independencia`).
Es la tabla de trabajo para contar semáforos y medir tramos.

## Cómo ejecutar

Los notebooks esperan los CSV en el directorio actual, así que hay que abrir
Jupyter desde esta carpeta:

```bash
cd aplicaciones_ciudad
python3 -m venv .venv
source .venv/bin/activate
pip install jupyter pandas numpy seaborn matplotlib
jupyter lab
```

Se usó Python 3.12. No hace falta ninguna otra dependencia.

## Relación con la simulación

- El flujo por cuarto de hora y por sentido justifica el desbalance entre
  avenidas y calles que usa `sincro-ba` como peso de acople `K`.
- Las distancias entre cruces definen el desfase objetivo de cada cuadra.
- Los dos corredores corresponden a las escenas de la simulación: el circuito
  del centro y la onda verde de Av. Córdoba hacia el oeste.

## Notas y limitaciones

- Solo hay una semana de conteos; los promedios son de cinco días hábiles.
- Se analiza únicamente la hora pico de la mañana (8:00 a 9:00).
- Los conteos son por posta y por sentido, no por carril.
- Los mapas y las distancias se midieron sobre OpenStreetMap; los cruces
  semaforizados pueden no coincidir exactamente con el relevamiento oficial.

## Declaración de uso de IA

_(Sección pendiente de completar.)_

# Simulaciones

Notebook base del trabajo, integración del modelo de semáforos acoplados sobre
redes idealizadas. Define las funciones del modelo, las mismas que después
reusan los notebooks de [`../aplicaciones_ciudad`](../aplicaciones_ciudad), y
las prueba en una calle recta de una mano, una calle recta de doble mano y una
grilla de tres calles paralelas con perpendiculares, donde se barre el acople
entre calles para ver cuándo la red deja de coordinarse.

## Contenido

| Archivo | Qué es |
|---|---|
| `Colab_investigathon.ipynb` | Único notebook, con las funciones del modelo, las calles rectas, la corrida de referencia y el barrido de acople |

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

`A` es la matriz de adyacencia y `d` el grado. `K_ij` pesa la cuadra que va del
cruce `i` al `j`, solo en el sentido de circulación, y `Δ_ij` es su desfase
objetivo. Acá `Δ` es el mismo para toda la red. En `../aplicaciones_ciudad` sale
de distancias y flujos reales.

## Las cuatro celdas

**1. Funciones.** `condiciones_iniciales_random`, `potencial`, `ecuaciones` y
`simular` (integra con `scipy.integrate.solve_ivp`), más las matrices `A` y `K`
de cada geometría, calle recta de una mano y de doble mano (`matriz_ady`,
`matriz_flow_uni`, `matriz_flow_bi`) y grilla de tres calles paralelas con
perpendiculares alternadas (`matriz_ady1`, `matriz_K1`). Hay que correrla antes
que las otras tres.

**2. Calles rectas.** Dos corridas con sus gráficos de desfases. Con una sola
mano (25 cruces, `Δ = 3π/8`) los desfases van al objetivo `−Δ`. Con doble mano
(5 cruces, `Δ` de `0` a `π`) no: van a `0` si `Δ < π/2` y a `π` si `Δ > π/2`,
porque los dos sentidos tiran en direcciones opuestas.

**3. Grilla con `K_perp = 0`.** Corrida de referencia sobre 3 calles de 10
cruces, con `K_av = 10`, `Δ = 2π/8` y 50 condiciones iniciales. Con las
perpendiculares apagadas las tres calles se coordinan por separado. Imprime las
listas `V0_K0` y `Vfin_K0` para comparar con el barrido.

**4. Barrido de `K_perp`.** Lo central del notebook, 20 valores de `K_perp`
entre `0` y `50`, 50 condiciones iniciales cada uno, integrados en lote con
`BDF` y el patrón de dispersión del jacobiano. El gráfico es
`σ = V_final / V_inicial` contra `K_perp`, con una curva por condición inicial y
la envolvente de mínimos. `σ` es peor cuando las perpendiculares pesan parecido
a las avenidas (`K_perp ≈ K_av = 10`), ahí las dos familias de calles piden
desfases incompatibles. Se puede saltear con `BARRIDO = False`.

## Cómo ejecutar

Está pensado para Google Colab, pero corre igual en local.

```bash
cd simulaciones
python3 -m venv .venv
source .venv/bin/activate
pip install jupyter numpy scipy matplotlib
jupyter lab
```

Se usó Python 3.12. No necesita ningún archivo de datos. Hay que correr las
celdas de arriba hacia abajo, porque la primera define todo lo que usan las
otras. El barrido tarda unos minutos, el resto es casi instantáneo.

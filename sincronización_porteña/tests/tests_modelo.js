// Tests del modelo. Cada test escribe sus fases iniciales a mano para que sea repetible.

const omega = vuelta / 90;  // T = 90 s
const dt = 0.01;

// Red de n esquinas sin calles.
function redVacia(n) {
  const matriz = () => Array.from({ length: n }, () => new Array(n).fill(0));
  return { vecinos: Array.from({ length: n }, () => []), K: matriz(), delta: matriz() };
}

// Calle entre a y b, con el flujo de cada sentido y el mismo desfase objetivo para ambos.
function conectar(red, a, b, flujoAB, flujoBA, delta) {
  red.vecinos[a].push(b);
  red.vecinos[b].push(a);
  red.K[a][b] = flujoAB;
  red.K[b][a] = flujoBA;
  red.delta[a][b] = delta;
  red.delta[b][a] = delta;
}

// Semáforos 0, 1, ..., n-1 en fila, con tránsito de i hacia i+1 y, si es doble mano, también de vuelta.
function serie(n, delta, dobleMano) {
  const red = redVacia(n);
  for (let i = 0; i < n - 1; i++) {
    conectar(red, i, i + 1, 1, dobleMano ? 1 : 0, delta);
  }
  return red;
}

// Grilla de 3x3 con avenida doble mano en el medio, calles de mano única y perpendiculares
// de sentido intercalado (como la figura 3 del informe).
//   0 → 1 → 2
//   3 ↔ 4 ↔ 5
//   6 ← 7 ← 8
function grillaMixta(delta) {
  const red = redVacia(9);
  conectar(red, 0, 1, 1, 0, delta);
  conectar(red, 1, 2, 1, 0, delta);
  conectar(red, 3, 4, 10, 10, delta);
  conectar(red, 4, 5, 10, 10, delta);
  conectar(red, 7, 6, 1, 0, delta);
  conectar(red, 8, 7, 1, 0, delta);
  conectar(red, 6, 3, 1, 0, delta);  // columna izquierda hacia arriba
  conectar(red, 3, 0, 1, 0, delta);
  conectar(red, 1, 4, 1, 0, delta);  // columna del medio hacia abajo
  conectar(red, 4, 7, 1, 0, delta);
  conectar(red, 8, 5, 1, 0, delta);  // columna derecha hacia arriba
  conectar(red, 5, 2, 1, 0, delta);
  return red;
}

const fasesSerie5 = [0.3, 2.9, 5.1, 1.7, 4.4];
const fasesGrilla = [0.2, 3.1, 5.9, 1.4, 4.0, 2.2, 6.1, 0.9, 3.7];

// Mayor distancia entre cada desfase fases[j] - fases[i] de una serie y el valor esperado.
function errorDesfases(fases, esperado) {
  let error = 0;
  for (let i = 0; i < fases.length - 1; i++) {
    error = Math.max(error, Math.abs(wrap(fases[i] - fases[i + 1] - esperado)));
  }
  return error;
}

QUnit.module('funciones básicas', () => {
  QUnit.test('wrap lleva a (-π, π]', assert => {
    assert.strictEqual(wrap(Math.PI), Math.PI);
    assert.strictEqual(wrap(-Math.PI), Math.PI);
    assert.strictEqual(wrap(0), 0);
    assert.ok(Math.abs(wrap(1.5 * Math.PI) + 0.5 * Math.PI) < 1e-12);
    assert.ok(Math.abs(wrap(7) - (7 - vuelta)) < 1e-12);
  });

  QUnit.test('mod2pi lleva a [0, 2π)', assert => {
    assert.ok(Math.abs(mod2pi(-0.5) - (vuelta - 0.5)) < 1e-12);
    assert.strictEqual(mod2pi(vuelta), 0);
    assert.ok(Math.abs(mod2pi(7) - (7 - vuelta)) < 1e-12);
  });

  QUnit.test('desfase objetivo (ec. 1)', assert => {
    const v = 40 / 3.6;  // 40 km/h en m/s
    const T = 90;
    assert.ok(Math.abs(desfaseObjetivo(v * T / 4, v, T) - Math.PI / 2) < 1e-12, 'un cuarto de ciclo de viaje da π/2');
    assert.ok(Math.abs(wrap(desfaseObjetivo(v * T, v, T))) < 1e-12, 'un ciclo entero de viaje da 0');
    assert.ok(Math.abs(desfaseObjetivo(115, v, T) - 0.7226) < 1e-4, 'una cuadra de 115 m da 0.72 rad');
  });
});

QUnit.module('ecuación 11', () => {
  QUnit.test('par de mano única: coincide con la ec. 12', assert => {
    const delta = 1.0;
    const red = redVacia(2);
    conectar(red, 0, 1, 1, 0, delta);  // tránsito de 0 hacia 1
    const fases = [2.0, 0.5];
    const velocidades = derivadas(fases, red, omega);
    const esperada1 = omega + 0.5 * Math.sin(fases[0] - fases[1] - delta);
    const esperada0 = omega + 0.5 * Math.sin(fases[1] - fases[0] + delta);
    assert.ok(Math.abs(velocidades[1] - esperada1) < 1e-12, 'semáforo de destino');
    assert.ok(Math.abs(velocidades[0] - esperada0) < 1e-12, 'semáforo de origen');
  });

  QUnit.test('dφi/dt = ω - (1/|Ni|) ∂V/∂φi', assert => {
    const red = grillaMixta(0.7);
    const h = 1e-6;
    const velocidades = derivadas(fasesGrilla, red, omega);
    let error = 0;
    for (let i = 0; i < fasesGrilla.length; i++) {
      const mas = fasesGrilla.slice();
      const menos = fasesGrilla.slice();
      mas[i] += h;
      menos[i] -= h;
      const gradiente = (potencial(mas, red) - potencial(menos, red)) / (2 * h);
      const esperada = omega - gradiente / red.vecinos[i].length;
      error = Math.max(error, Math.abs(velocidades[i] - esperada));
    }
    assert.ok(error < 1e-6, `error máximo ${error.toExponential(2)}`);
  });
});

QUnit.module('dinámica', () => {
  QUnit.test('V no sube entre pasos', assert => {
    const red = grillaMixta(2.0);
    let fases = fasesGrilla;
    let V = potencial(fases, red);
    let mayorSubida = 0;
    for (let k = 0; k < 20000; k++) {
      fases = paso(fases, red, omega, dt);
      const nuevo = potencial(fases, red);
      mayorSubida = Math.max(mayorSubida, nuevo - V);
      V = nuevo;
    }
    assert.ok(mayorSubida < 1e-12, `mayor subida ${mayorSubida.toExponential(2)}`);
  });

  QUnit.test('con Δ = 0 todas las fases se igualan', assert => {
    const red = grillaMixta(0);
    // fases repartidas en menos de media vuelta, donde la sincronización está garantizada
    const iniciales = [0.2, 1.4, 2.6, 0.9, 2.1, 0.5, 1.8, 2.9, 1.1];
    const fases = simular(iniciales, red, omega, dt, 30000);
    const error = Math.max(...fases.map(fase => Math.abs(wrap(fase - fases[0]))));
    assert.ok(error < 1e-3, `mayor diferencia ${error.toExponential(2)}`);
  });

  QUnit.test('par de mano única: φj - φi → Δji (ec. 12)', assert => {
    const delta = 5 * Math.PI / 8;
    const red = redVacia(2);
    conectar(red, 0, 1, 1, 0, delta);
    const fases = simular([0.4, 4.0], red, omega, dt, 3000);
    const error = Math.abs(wrap(fases[0] - fases[1] - delta));
    assert.ok(error < 1e-3, `error ${error.toExponential(2)}`);
  });

  QUnit.test('serie de mano única: todos los desfases → Δ', assert => {
    const delta = 5 * Math.PI / 8;
    const fases = simular(fasesSerie5, serie(5, delta, false), omega, dt, 20000);
    const error = errorDesfases(fases, delta);
    assert.ok(error < 1e-3, `error máximo ${error.toExponential(2)}`);
  });

  QUnit.test('serie doble mano con Δ < π/2: en fase', assert => {
    const fases = simular(fasesSerie5, serie(5, Math.PI / 4, true), omega, dt, 20000);
    const error = errorDesfases(fases, 0);
    assert.ok(error < 1e-3, `error máximo ${error.toExponential(2)}`);
  });

  QUnit.test('serie doble mano con Δ > π/2: antifase', assert => {
    const fases = simular(fasesSerie5, serie(5, 3 * Math.PI / 4, true), omega, dt, 20000);
    const error = errorDesfases(fases, Math.PI);
    assert.ok(error < 1e-3, `error máximo ${error.toExponential(2)}`);
  });

  QUnit.test('mismo resultado con dt y dt/2', assert => {
    const red = grillaMixta(2.0);
    // 5 s: en pleno transitorio, donde más se nota el paso
    const conDt = simular(fasesGrilla, red, omega, dt, 500);
    const conMedioDt = simular(fasesGrilla, red, omega, dt / 2, 1000);
    const error = Math.max(...conDt.map((fase, i) => Math.abs(wrap(fase - conMedioDt[i]))));
    assert.ok(error < 1e-3, `mayor diferencia ${error.toExponential(2)}`);
  });
});

QUnit.module('figura 2 del informe', () => {
  // Serie de 20 semáforos de mano única con tránsito de i hacia i+1.
  // Con la convención φj - φi = Δji, los desfases φ(i+1) - φi tienen que ir a -Δ.
  const iniciales = [
    0.3, 2.9, 5.1, 1.7, 4.4, 0.8, 3.6, 6.0, 2.2, 4.9,
    1.1, 3.3, 5.6, 0.5, 2.7, 4.1, 1.9, 5.3, 3.0, 0.1,
  ];

  function desfasesFinales(delta) {
    const fases = simular(iniciales, serie(20, delta, false), omega, dt, 300000);
    return fases.slice(1).map((fase, i) => wrap(fase - fases[i]));
  }

  QUnit.test('con Δ = 5π/8 los desfases van a -5π/8 ≈ -1.96', assert => {
    const error = Math.max(...desfasesFinales(5 * Math.PI / 8).map(d => Math.abs(d + 5 * Math.PI / 8)));
    assert.ok(error < 1e-3, `error máximo ${error.toExponential(2)}`);
  });

  QUnit.test('con Δ = 3π/8 van a -3π/8 ≈ -1.18, el valor que muestra la figura', assert => {
    const error = Math.max(...desfasesFinales(3 * Math.PI / 8).map(d => Math.abs(d + 3 * Math.PI / 8)));
    assert.ok(error < 1e-3, `error máximo ${error.toExponential(2)}`);
  });
});

QUnit.module('indicadores', () => {
  QUnit.test('fase a color (sec. 4.3)', assert => {
    assert.true(verdeEnPrincipal(0, 0.5), 'en φ = 0 empieza el verde de la principal');
    assert.true(verdeEnPrincipal(3.1, 0.5));
    assert.false(verdeEnPrincipal(Math.PI, 0.5), 'en φ = s·2π pasa a la secundaria');
    assert.false(verdeEnPrincipal(6.2, 0.5));
    assert.true(verdeEnPrincipal(4.0, 0.7), 'con s = 0.7 la principal tiene más verde');
  });

  QUnit.test('doble mano en el óptimo de la ec. 2', assert => {
    const enFase = redVacia(2);
    conectar(enFase, 0, 1, 1, 1, Math.PI / 4);
    assert.true(dobleManoEnOptimo([2.0, 2.05], enFase, 0, 1, 0.1), 'Δ < π/2: en fase');
    assert.false(dobleManoEnOptimo([2.0, 2.0 + Math.PI], enFase, 0, 1, 0.1));

    const antifase = redVacia(2);
    conectar(antifase, 0, 1, 1, 1, 3 * Math.PI / 4);
    assert.true(dobleManoEnOptimo([0.1, 0.1 + Math.PI], antifase, 0, 1, 0.1), 'Δ > π/2: en antifase');
    assert.false(dobleManoEnOptimo([0.1, 0.1], antifase, 0, 1, 0.1));

    const casiUnaVuelta = redVacia(2);
    conectar(casiUnaVuelta, 0, 1, 1, 1, vuelta - 0.3);
    assert.true(dobleManoEnOptimo([1.0, 1.0], casiUnaVuelta, 0, 1, 0.1), 'Δ = 2π - 0.3 equivale a |Δ| = 0.3');
  });

  QUnit.test('flujo cumplido', assert => {
    const red = redVacia(2);
    conectar(red, 0, 1, 1, 0, 1.0);
    assert.true(flujoCumplido([1.05, 0], red, 0, 1, 0.1));
    assert.false(flujoCumplido([1.3, 0], red, 0, 1, 0.1));
    assert.true(flujoCumplido([0.05, vuelta - 0.9], red, 0, 1, 0.1), 'funciona al cruzar 2π');
  });

  QUnit.test('convergencia', assert => {
    const red = serie(5, Math.PI / 4, true);
    assert.false(convergio(fasesSerie5, red, omega, 0.001), 'al principio no');
    const fases = simular(fasesSerie5, red, omega, dt, 20000);
    assert.true(convergio(fases, red, omega, 0.001), 'al final sí');
  });
});

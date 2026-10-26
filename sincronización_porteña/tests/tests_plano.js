// Tests del plano (las cuadras que el jugador pone en la red) y de cómo se arma la red
// que usa el modelo.

QUnit.module('plano', hooks => {
  hooks.beforeEach(ciudadDePrueba);

  QUnit.test('una cuadra trae sus dos esquinas', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    assert.strictEqual(plano.calles.length, 1);
    assert.strictEqual(plano.esquinas.length, 2);
    assert.deepEqual(plano.esquinas.map(e => e.ciudad), [0, 1]);
  });

  QUnit.test('dos cuadras seguidas comparten la esquina del medio', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    assert.strictEqual(plano.calles.length, 2);
    assert.strictEqual(plano.esquinas.length, 3, 'la esquina B no se repite');
  });

  QUnit.test('una cuadra no entra dos veces', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    assert.strictEqual(agregarCalle(plano, ciudad.calles[ARRIBA_IZQ]), null);
    assert.strictEqual(plano.calles.length, 1);
  });

  QUnit.test('la cuadra entra con el sentido y la categoría que tiene en la realidad', assert => {
    ciudad.calles[ARRIBA_IZQ].mano = 'ab';
    const plano = planoCon(ARRIBA_IZQ, VERTICAL_1);
    assert.true(plano.calles[0].deAaB);
    assert.false(plano.calles[0].deBaA, 'mano única como en el mapa');
    assert.true(plano.calles[0].avenida);
    assert.false(plano.calles[1].avenida, 'la vertical es calle');
  });

  QUnit.test('quitar una cuadra se lleva las esquinas que quedan sueltas', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    quitarCalle(plano, plano.calles[0]);
    assert.strictEqual(plano.calles.length, 1);
    assert.strictEqual(plano.esquinas.length, 2, 'la esquina A se va, la B queda');
    assert.deepEqual(plano.esquinas.map(e => e.ciudad), [1, 2]);
    assert.strictEqual(plano.calles[0].a, 0, 'los índices de la cuadra que queda se corrigen');
    assert.strictEqual(plano.calles[0].b, 1);
  });

  QUnit.test('la mano de contramano entra al revés', assert => {
    ciudad.calles[ARRIBA_IZQ].mano = 'ba';
    const calle = planoCon(ARRIBA_IZQ).calles[0];
    assert.false(calle.deAaB);
    assert.true(calle.deBaA);
  });
});

QUnit.module('verdes de cada esquina', hooks => {
  hooks.beforeEach(ciudadDePrueba);

  QUnit.test('la principal es la dirección de la calle más importante del cruce', assert => {
    // en B se cruzan la avenida horizontal y una calle vertical
    assert.strictEqual(rolEn(1, ciudad.calles[ARRIBA_IZQ]), 'principal');
    assert.strictEqual(rolEn(1, ciudad.calles[ARRIBA_DER]), 'principal');
    assert.strictEqual(rolEn(1, ciudad.calles[VERTICAL_2]), 'secundaria');
  });

  QUnit.test('una calle sola en su esquina es la principal de esa esquina', assert => {
    assert.strictEqual(rolEn(6, ciudad.calles[DIAGONAL]), 'principal', 'la diagonal en G');
  });

  QUnit.test('la diagonal entra por el verde de la secundaria donde cruza la avenida', assert => {
    assert.strictEqual(rolEn(5, ciudad.calles[ABAJO_DER]), 'principal');
    assert.strictEqual(rolEn(5, ciudad.calles[DIAGONAL]), 'secundaria', 'la diagonal en F');
  });
});

QUnit.module('red para el modelo', hooks => {
  hooks.beforeEach(ciudadDePrueba);

  QUnit.test('Δ sale del largo real de la cuadra, de v y de T', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const red = armarRed(plano, parametrosDePrueba);
    const esperado = desfaseObjetivo(130, parametrosDePrueba.v, parametrosDePrueba.T);
    assert.ok(Math.abs(red.delta[0][1] - esperado) < 1e-12);
    assert.ok(Math.abs(red.delta[1][0] - esperado) < 1e-12, 'igual en los dos sentidos');

    const masLento = armarRed(plano, { ...parametrosDePrueba, v: 20 / 3.6 });
    assert.ok(masLento.delta[0][1] > red.delta[0][1], 'con menos velocidad el desfase crece');
  });

  QUnit.test('una cuadra que cambia de rol entre puntas corre su Δ (ec. 17)', assert => {
    const plano = planoCon(ABAJO_DER, DIAGONAL);
    const red = armarRed(plano, parametrosDePrueba);
    const f = plano.esquinas.findIndex(e => e.ciudad === 5);
    const g = plano.esquinas.findIndex(e => e.ciudad === 6);
    const base = desfaseObjetivo(184, parametrosDePrueba.v, parametrosDePrueba.T);
    // secundaria en F y principal en G: el objetivo se corre s·2π
    const corrido = mod2pi(base + parametrosDePrueba.s * 2 * Math.PI);
    assert.ok(Math.abs(red.delta[f][g] - corrido) < 1e-12);
    assert.ok(Math.abs(red.delta[g][f] - mod2pi(base - parametrosDePrueba.s * 2 * Math.PI)) < 1e-12);
  });

  QUnit.test('sin cambio de rol no hay corrección', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    const red = armarRed(plano, parametrosDePrueba);
    const base = desfaseObjetivo(130, parametrosDePrueba.v, parametrosDePrueba.T);
    assert.ok(Math.abs(red.delta[0][1] - base) < 1e-12);
  });

  QUnit.test('con Δ = 0 todos los objetivos son 0, también los corridos', assert => {
    const plano = planoCon(ABAJO_DER, DIAGONAL);
    const red = armarRed(plano, { ...parametrosDePrueba, deltaCero: true });
    assert.deepEqual(red.delta.flat().filter(d => d !== 0), []);
  });

  QUnit.test('una calle de mano única no cambia |Ni|, sacarla sí', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    const antes = armarRed(plano, parametrosDePrueba).vecinos.map(v => v.length);

    plano.calles[0].deBaA = false;
    const unaMano = armarRed(plano, parametrosDePrueba);
    assert.deepEqual(unaMano.vecinos.map(v => v.length), antes, '|Ni| no cambia');
    assert.strictEqual(unaMano.K[1][0], 0, 'pero el flujo contramano es 0');

    quitarCalle(plano, plano.calles[0]);
    const sacada = armarRed(plano, parametrosDePrueba);
    assert.strictEqual(sacada.vecinos.length, 2, 'sacarla sí se lleva la esquina suelta');
  });

  QUnit.test('las avenidas llevan más flujo', assert => {
    const plano = planoCon(ARRIBA_IZQ, VERTICAL_1);
    const red = armarRed(plano, parametrosDePrueba);
    const a = plano.esquinas.findIndex(e => e.ciudad === 0);
    const b = plano.esquinas.findIndex(e => e.ciudad === 1);
    const d = plano.esquinas.findIndex(e => e.ciudad === 3);
    assert.strictEqual(red.K[a][b], parametrosDePrueba.flujoAvenida);
    assert.strictEqual(red.K[a][d], parametrosDePrueba.flujoCalle);
  });

  QUnit.test('el acople multiplica el flujo de calles y avenidas por igual', assert => {
    const plano = planoCon(ARRIBA_IZQ, VERTICAL_1);
    const a = plano.esquinas.findIndex(e => e.ciudad === 0);
    const b = plano.esquinas.findIndex(e => e.ciudad === 1);
    const d = plano.esquinas.findIndex(e => e.ciudad === 3);
    const doble = { ...parametrosDePrueba, acople: 2 };
    const red = armarRed(plano, doble);
    assert.strictEqual(red.K[a][b], 2 * parametrosDePrueba.flujoAvenida, 'la avenida');
    assert.strictEqual(red.K[a][d], 2 * parametrosDePrueba.flujoCalle, 'la calle');
    assert.strictEqual(armarRed(plano, { ...parametrosDePrueba, acople: 0.5 }).K[a][b],
      parametrosDePrueba.flujoAvenida / 2, 'y también para abajo');
  });

  QUnit.test('el acople no mueve los desfases objetivo', assert => {
    const plano = planoCon(ARRIBA_IZQ, VERTICAL_1);
    const a = plano.esquinas.findIndex(e => e.ciudad === 0);
    const b = plano.esquinas.findIndex(e => e.ciudad === 1);
    const flojo = armarRed(plano, { ...parametrosDePrueba, acople: 0.25 });
    const fuerte = armarRed(plano, { ...parametrosDePrueba, acople: 4 });
    assert.strictEqual(flojo.delta[a][b], fuerte.delta[a][b], 'Δ sale de L, v y T, no de K');
  });

  QUnit.test('la red armada funciona con el modelo y V no sube', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER, VERTICAL_2, ABAJO_DER, DIAGONAL);
    const red = armarRed(plano, parametrosDePrueba);
    let fases = plano.esquinas.map((e, i) => (i * 1.37) % (2 * Math.PI));
    let V = potencial(fases, red);
    for (let k = 0; k < 500; k++) {
      fases = paso(fases, red, 2 * Math.PI / parametrosDePrueba.T, 0.01);
      const nuevo = potencial(fases, red);
      assert.ok(nuevo <= V + 1e-9, 'V no sube');
      V = nuevo;
    }
  });

  QUnit.test('calle cumplida según su sentido', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const calle = plano.calles[0];
    const red = armarRed(plano, parametrosDePrueba);
    const delta = red.delta[0][1];

    calle.deBaA = false;  // de a hacia b
    assert.true(calleCumplida(calle, red, [delta, 0], 0.01), 'φa − φb = Δab');
    assert.false(calleCumplida(calle, red, [0, delta], 0.01));
  });
});

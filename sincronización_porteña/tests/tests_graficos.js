// Tests de lo que se grafica (sin dibujar: Chart.js no hace falta acá).

function unaCuadra(deAaB, deBaA, delta) {
  ciudadDePrueba();
  const plano = planoCon(ARRIBA_IZQ);
  const calle = plano.calles[0];
  calle.deAaB = deAaB;
  calle.deBaA = deBaA;
  const red = { vecinos: [[1], [0]], K: [[0, 1], [1, 0]], delta: [[0, delta], [delta, 0]] };
  return { plano, calle, red };
}

QUnit.module('gráficos', () => {
  QUnit.test('mano única: φj − φi con j la esquina de donde vienen los autos, y objetivo Δji', assert => {
    const haciaB = unaCuadra(true, false, 0.8);
    assert.deepEqual(desfaseDeCalle(haciaB.calle, haciaB.red, [2.0, 0.5]), { desfase: 1.5, objetivo: 0.8 });

    const haciaA = unaCuadra(false, true, 0.8);
    assert.deepEqual(desfaseDeCalle(haciaA.calle, haciaA.red, [2.0, 0.5]), { desfase: -1.5, objetivo: 0.8 });
  });

  QUnit.test('doble mano: el objetivo es el óptimo de la ec. 2', assert => {
    const enFase = unaCuadra(true, true, 0.8);
    assert.strictEqual(desfaseDeCalle(enFase.calle, enFase.red, [1.0, 1.0]).objetivo, 0, 'Δ < π/2');

    const antifase = unaCuadra(true, true, 2.4);
    assert.strictEqual(desfaseDeCalle(antifase.calle, antifase.red, [1.0, 1.0]).objetivo, Math.PI, 'Δ > π/2');
  });

  QUnit.test('el orden es 1 con los errores parejos y 0 con los errores opuestos', assert => {
    ciudadDePrueba();
    const plano = planoCon(ARRIBA_IZQ, ABAJO_IZQ);
    const red = armarRed(plano, { ...parametrosDePrueba, deltaCero: true });

    assert.strictEqual(ordenDeLaRed(plano, red, [0, 0, 0, 0]).orden, 1, 'las dos cumplidas');
    assert.ok(ordenDeLaRed(plano, red, [0, 0, 0, Math.PI]).orden < 1e-9, 'una cumplida y la otra en contra');
    assert.strictEqual(ordenDeLaRed(crearPlano(), red, []).orden, 0, 'sin cuadras no hay orden');
  });

  QUnit.test('se grafican hasta 4 calles, cada una con su color', assert => {
    ciudadDePrueba();
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER, ABAJO_IZQ, ABAJO_DER, VERTICAL_2);
    series = [];
    for (const calle of plano.calles) alternarSerie(calle);
    assert.strictEqual(series.length, 4, 'la quinta saca a la más vieja');
    assert.strictEqual(new Set(series.map(s => s.color)).size, 4, 'no se repiten los colores');
    assert.strictEqual(series[0].calle, plano.calles[1], 'se fue la primera');
  });

  QUnit.test('tocar de nuevo una calle la saca del gráfico', assert => {
    ciudadDePrueba();
    const plano = planoCon(ARRIBA_IZQ);
    series = [];
    alternarSerie(plano.calles[0]);
    assert.strictEqual(series.length, 1);
    alternarSerie(plano.calles[0]);
    assert.strictEqual(series.length, 0);
  });

  QUnit.test('las series de calles borradas se van', assert => {
    ciudadDePrueba();
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    series = [];
    for (const calle of plano.calles) alternarSerie(calle);
    quitarCalle(plano, plano.calles[0]);
    limpiarSeries(plano);
    assert.strictEqual(series.length, 1);
  });
});

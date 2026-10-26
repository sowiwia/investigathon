// Tests de los autitos ilustrativos.

const nuncaAparecen = () => 0.99;
const siempreAparecen = () => 0;  // con azar 0 nace un auto por entrada, en el carril 0
const tolDePrueba = 0.001;

// Avanza de a 0.1 s, como la app cuadro a cuadro.
function moverDurante(autos, plano, fases, segundos) {
  for (let k = 0; k < segundos * 10; k++) {
    autos = moverAutos(autos, plano, fases, parametrosDePrueba, 0.1, nuncaAparecen);
  }
  return autos;
}

function autoEn(calle, haciaB = true, avance = 0, carril = 0) {
  return { calle, haciaB, carril, avance, tono: 0.5 };
}

// Deja la cuadra de mano única en el sentido a → b.
function manoUnica(calle) {
  calle.deBaA = false;
  return calle;
}

QUnit.module('autos', hooks => {
  hooks.beforeEach(ciudadDePrueba);

  QUnit.test('avanzan a la velocidad v', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const calle = manoUnica(plano.calles[0]);
    const autos = moverDurante([autoEn(calle)], plano, [0, 0], 2);
    assert.strictEqual(autos.length, 1);
    assert.ok(Math.abs(autos[0].avance - 2 * parametrosDePrueba.v) < 0.1,
      `avanzó ${autos[0].avance.toFixed(1)} m en 2 s`);
  });

  QUnit.test('frenan en rojo antes del cruce', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const calle = manoUnica(plano.calles[0]);
    // en la esquina b la fase pasó el verde de la principal, así que la horizontal está en rojo
    const autos = moverDurante([autoEn(calle)], plano, [0, 4], 30);
    assert.strictEqual(autos.length, 1, 'sigue en la cuadra');
    assert.ok(Math.abs(autos[0].avance - (calle.cuadra.largo - metrosAntesDelCruce)) < 0.5,
      `frenó en ${autos[0].avance.toFixed(1)} m`);
  });

  QUnit.test('con verde cruzan y siguen derecho, no doblan', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER, VERTICAL_2);
    const primera = manoUnica(plano.calles[0]);
    manoUnica(plano.calles[1]);
    manoUnica(plano.calles[2]);
    const autos = moverDurante([autoEn(primera, true, 100)], plano, [0, 0, 0, 0], 10);
    assert.strictEqual(autos.length, 1);
    assert.strictEqual(autos[0].calle.cuadra.nombre, 'Avenida de arriba', 'siguió por la avenida');
    assert.notStrictEqual(autos[0].calle, primera, 'pasó a la cuadra siguiente');
  });

  QUnit.test('al final de la red salen', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const calle = manoUnica(plano.calles[0]);
    const autos = moverDurante([autoEn(calle, true, 120)], plano, [0, 0], 10);
    assert.deepEqual(autos, [], 'no hay calle que siga, el auto se va');
  });

  QUnit.test('frenan detrás del auto de adelante', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const calle = manoUnica(plano.calles[0]);
    const adelante = autoEn(calle, true, 60);
    const atras = autoEn(calle, true, 0);
    const autos = moverDurante([adelante, atras], plano, [0, 4], 30);
    assert.strictEqual(autos.length, 2);
    const separacion = Math.abs(adelante.avance - atras.avance);
    assert.ok(separacion >= metrosEntreAutos - 0.5, `quedaron a ${separacion.toFixed(1)} m`);
  });

  QUnit.test('en otro carril no se estorban', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const calle = manoUnica(plano.calles[0]);  // avenida: dos carriles por lado
    const unCarril = autoEn(calle, true, 60, 0);
    const otroCarril = autoEn(calle, true, 55, 1);
    moverDurante([unCarril, otroCarril], plano, [0, 0], 1);
    assert.ok(Math.abs(otroCarril.avance - (55 + parametrosDePrueba.v)) < 0.2, 'avanzó igual');
  });

  QUnit.test('los autos de una calle borrada o de contramano desaparecen', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    const calle = manoUnica(plano.calles[0]);
    const alReves = autoEn(calle, false);
    assert.deepEqual(moverDurante([alReves], plano, [0, 0], 1), [], 'va contramano');

    quitarCalle(plano, calle);
    assert.deepEqual(moverDurante([autoEn(calle)], plano, [0, 0], 1), [], 'la calle ya no está');
  });

  QUnit.test('todas las cuadras reciben autos nuevos, no solo la primera', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    const primera = manoUnica(plano.calles[0]);
    const segunda = manoUnica(plano.calles[1]);
    const autos = moverAutos([], plano, [0, 0, 0], parametrosDePrueba, 0.1, siempreAparecen);
    assert.ok(autos.some(auto => auto.calle === primera), 'la primera cuadra');
    assert.ok(autos.some(auto => auto.calle === segunda), 'y la del medio también');
  });

  QUnit.test('los autos nuevos entran con el cruce en rojo igual que en verde', assert => {
    const plano = planoCon(ARRIBA_IZQ);
    manoUnica(plano.calles[0]);
    // la fase 4 ya pasó el verde de la principal: la avenida está en rojo en las dos esquinas
    const enRojo = moverAutos([], plano, [4, 4], parametrosDePrueba, 0.1, siempreAparecen);
    assert.strictEqual(enRojo.length, 1, 'entra igual y se va a poner en la cola');
    assert.ok(enRojo[0].avance <= metrosDeEntrada + metrosDeDispersion, 'apenas pasado el cruce');
  });

  QUnit.test('no se meten en el cruce si no hay lugar del otro lado', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    const primera = manoUnica(plano.calles[0]);
    const segunda = manoUnica(plano.calles[1]);
    const frenada = lineaDeFrenado(primera.cuadra);
    // la segunda cuadra está en rojo en su esquina y tiene la cola llena hasta la bocacalle
    const cola = [];
    for (let m = frenada; m >= 0; m -= metrosEntreAutos) cola.push(autoEn(segunda, true, m));
    const llega = autoEn(primera, true, frenada - 20);
    // la esquina del medio está en verde: lo único que lo frena es que del otro lado no hay lugar
    const fases = [0, 0, 4];
    let autos = [...cola, llega];
    let maximo = 0;
    for (let k = 0; k < 60; k++) {
      autos = moverAutos(autos, plano, fases, parametrosDePrueba, 0.1, nuncaAparecen);
      maximo = Math.max(maximo, llega.avance);
    }
    assert.true(tieneVerde(plano, fases, primera, 1, parametrosDePrueba.s), 'su esquina está en verde');
    assert.ok(maximo <= frenada + 0.01,
      `esperó en la línea y no se metió en el cruce (llegó hasta ${maximo.toFixed(1)} m, línea en ${frenada.toFixed(1)})`);
    assert.ok(llega.avance > frenada - 1, 'pero sí avanzó hasta la línea');
  });

  QUnit.test('los autos nuevos salen de los segundos simulados, no de los cuadros', assert => {
    const mitad = () => 0.5;
    assert.strictEqual(cuantosNacen(0.2, 1, mitad), 0, '0.2 esperados: no nace ninguno');
    assert.strictEqual(cuantosNacen(0.8, 1, mitad), 1, '0.8 esperados: nace uno');
    assert.strictEqual(cuantosNacen(3.2, 1, mitad), 3, '3.2 esperados: nacen los tres enteros');
    assert.strictEqual(cuantosNacen(3.8, 1, mitad), 4, '3.8 esperados: tres enteros más la fracción');
    assert.strictEqual(cuantosNacen(2, 0.5, mitad), 1, 'la mitad de los segundos, la mitad de autos');
  });

  // El caso de la onda verde: si el modelo cumplió los Δ, un auto tiene que hacer el corredor
  // entero sin frenar en ningún semáforo.
  QUnit.test('con los desfases cumplidos el auto cruza el corredor sin frenar', assert => {
    const plano = planoCon(ARRIBA_IZQ, ARRIBA_DER);
    const primera = manoUnica(plano.calles[0]);
    manoUnica(plano.calles[1]);
    const red = armarRed(plano, parametrosDePrueba);
    const omega = vuelta / parametrosDePrueba.T;
    let fases = simular([0, 1, 2], red, omega, 0.01, 20000);
    assert.true(convergio(fases, red, omega, tolDePrueba), 'la red acomodó los desfases');

    // el auto espera en la línea de frenado y la esquina del medio se pone en verde justo ahora
    fases = fases.map(fase => mod2pi(fase - fases[1]));
    let autos = [autoEn(primera, true, lineaDeFrenado(primera.cuadra))];
    let quieto = 0;
    for (let k = 0; k < 400 && autos.length > 0; k++) {
      const antes = autos[0].avance;
      const cuadra = autos[0].calle;
      fases = simular(fases, red, omega, 0.01, 10);
      autos = moverAutos(autos, plano, fases, parametrosDePrueba, 0.1, nuncaAparecen);
      if (autos.length > 0 && autos[0].calle === cuadra && autos[0].avance - antes < 0.5) quieto += 0.1;
    }
    assert.deepEqual(autos, [], 'recorrió las dos cuadras y salió de la red');
    assert.ok(quieto <= 0.3, `no frenó en ningún semáforo (estuvo quieto ${quieto.toFixed(1)} s)`);
  });

  QUnit.test('la calle que cruza tiene verde cuando la avenida no', assert => {
    const plano = planoCon(ARRIBA_IZQ, VERTICAL_2);
    const avenida = plano.calles[0];
    const vertical = plano.calles[1];
    const b = plano.esquinas.findIndex(e => e.ciudad === 1);
    const fases = [0, 0, 0];  // en 0 arranca el verde de la principal
    assert.true(tieneVerde(plano, fases, avenida, b, parametrosDePrueba.s));
    assert.false(tieneVerde(plano, fases, vertical, b, parametrosDePrueba.s));

    fases[b] = 4;  // ya pasó s·2π: verde de la secundaria
    assert.false(tieneVerde(plano, fases, avenida, b, parametrosDePrueba.s));
    assert.true(tieneVerde(plano, fases, vertical, b, parametrosDePrueba.s));
  });
});

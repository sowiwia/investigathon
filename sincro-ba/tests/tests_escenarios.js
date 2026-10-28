QUnit.module('escenas', () => {
  QUnit.test('son estables y forman redes válidas', async assert => {
    const datos = await (await fetch('../assets/calles_microcentro.json')).json();
    cargarCiudad(datos);
    for (const [clave, escena] of Object.entries(escenarios)) {
      const primera = escena.armar();
      const segunda = escena.armar();
      assert.deepEqual(primera.map(c => c.id), segunda.map(c => c.id), `${clave}: mismas cuadras`);
      const plano = crearPlano();
      primera.forEach(c => agregarCalle(plano, c));
      assert.ok(plano.calles.length > 0 && plano.esquinas.length > 1, `${clave}: red válida`);
    }
    assert.strictEqual(escenarios.cordoba.armar().length, 24, 'Córdoba cubre la avenida en el mapa');
  });
});

// Niveles de tránsito y escenarios de arranque.
//
// Cada nivel cambia la cantidad de autos ilustrativos y el acople K del modelo.

// autosPorSegundo es por entrada: cada entrada de la red recibe esa cantidad de autos nuevos por
// segundo en cada sentido (una calle recibe menos que una avenida, ver autosEnCalle).
const nivelesDeTransito = {
  bajo: { nombre: 'Tránsito bajo', autosPorSegundo: 0.12, acople: 0.4, cuadrasPorAuto: 4 },
  medio: { nombre: 'Tránsito medio', autosPorSegundo: 0.3, acople: 1, cuadrasPorAuto: 2 },
  alto: { nombre: 'Tránsito alto', autosPorSegundo: 0.6, acople: 2, cuadrasPorAuto: 1 },
};

// Euler necesita dt·K chico; con estos K alcanza de sobra con centésimas de segundo.
function pasoDeIntegracion(parametros) {
  return Math.min(0.01, 0.1 / Math.max(1, parametros.flujoAvenida * parametros.acople));
}

function cuadrasDe(nombre) {
  return ciudad.calles.filter(c => c.nombre === nombre);
}

// Arma un corredor: arranca en una cuadra y sigue derecho cuadra a cuadra, eligiendo en cada
// esquina la continuación más alineada, como hace un auto que no dobla.
function corredor(cuadra, desdeEsquina, cuantas) {
  const tramos = [cuadra];
  let esquina = puntaOpuesta(cuadra, desdeEsquina);
  let actual = cuadra;
  while (tramos.length < cuantas) {
    const llegada = rumboDeLlegada(actual, esquina);
    let mejor = null;
    let menorGiro = Math.PI / 3;
    for (const otra of ciudad.esquinas[esquina].calles) {
      if (otra === actual || tramos.includes(otra)) continue;
      const giro = Math.abs(wrap(rumboDeSalida(otra, esquina) - llegada));
      if (giro < menorGiro) {
        menorGiro = giro;
        mejor = otra;
      }
    }
    if (!mejor) break;
    tramos.push(mejor);
    actual = mejor;
    esquina = puntaOpuesta(mejor, esquina);
  }
  return tramos;
}

// Sigue una avenida desde un extremo estable, sin elecciones aleatorias.
function avenidaDesdeExtremo(nombre, cantidad, extremo) {
  const cuadras = cuadrasDe(nombre).filter(c => c.mano !== 'no' || nombre.includes('Sáenz'));
  const extremos = [];
  for (const c of cuadras) for (const punta of [c.a, c.b]) {
    if (cuadras.filter(otra => otra.a === punta || otra.b === punta).length === 1) extremos.push({ c, punta });
  }
  extremos.sort((a, b) => extremo === 'este'
    ? ciudad.esquinas[b.punta].x - ciudad.esquinas[a.punta].x
    : ciudad.esquinas[a.punta].x - ciudad.esquinas[b.punta].x);
  return extremos.length ? corredor(extremos[0].c, extremos[0].punta, cantidad) : cuadras.slice(0, cantidad);
}

const escenarios = {
  cordoba: {
    nombre: 'Córdoba, una mano', ayuda: 'Onda verde hacia el oeste',
    transito: 'medio', T: 90,
    armar: () => avenidaDesdeExtremo('Avenida Córdoba', 8, 'este'),
  },
  dobleMano: {
    nombre: 'Doble mano', ayuda: 'Sáenz Peña: dos sentidos que compiten',
    transito: 'medio', T: 90,
    armar: () => avenidaDesdeExtremo('Avenida Presidente Roque Sáenz Peña', 8, 'este'),
  },
};

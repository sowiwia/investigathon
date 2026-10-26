// Niveles de tránsito y escenarios de arranque.
//
// El nivel de tránsito es cuántos autitos se ven y nada más: son ilustrativos y no entran en el
// modelo. Lo que decide en cuántos ciclos se ordena la red es el acople K, que tiene su propio
// control.

// autosPorSegundo es por cuadra: cada cuadra de la red recibe esa cantidad de autos nuevos por
// segundo en cada sentido (una calle recibe menos que una avenida, ver autosEnCalle).
const nivelesDeTransito = {
  bajo: { nombre: 'Tránsito bajo', autosPorSegundo: 0.12 },
  medio: { nombre: 'Tránsito medio', autosPorSegundo: 0.25 },
  alto: { nombre: 'Tránsito alto', autosPorSegundo: 0.32 },
};

// Euler necesita dt·K chico; con estos K alcanza de sobra con centésimas de segundo.
function pasoDeIntegracion(parametros) {
  return Math.min(0.01, 0.1 / Math.max(1, parametros.flujoAvenida * parametros.acople));
}

function cuadrasDe(nombre) {
  return ciudad.calles.filter(c => c.nombre === nombre);
}

function vecinasDe(cuadra) {
  return [...ciudad.esquinas[cuadra.a].calles, ...ciudad.esquinas[cuadra.b].calles]
    .filter(otra => otra !== cuadra);
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

// La cuadra más al norte del grupo, con su punta norte: así el corredor se arma hacia el sur.
function arranqueDesdeElNorte(cuadras) {
  const cuadra = cuadras.reduce((mejor, c) =>
    ciudad.esquinas[c.a].y < ciudad.esquinas[mejor.a].y ? c : mejor);
  const norte = ciudad.esquinas[cuadra.a].y < ciudad.esquinas[cuadra.b].y ? cuadra.a : cuadra.b;
  return { cuadra, norte };
}

// Crece una red desde una cuadra tomando vecinas al azar: así cada partida es distinta.
function manchaAlAzar(semilla, cuantas) {
  const elegidas = [semilla];
  while (elegidas.length < cuantas) {
    const candidatas = [];
    for (const cuadra of elegidas) {
      for (const otra of vecinasDe(cuadra)) {
        if (otra.clase !== 'peatonal' && !elegidas.includes(otra)) candidatas.push(otra);
      }
    }
    if (candidatas.length === 0) break;
    elegidas.push(candidatas[Math.floor(Math.random() * candidatas.length)]);
  }
  return elegidas;
}

// Una cuadra cualquiera cerca del Obelisco, que es donde arranca mirando el jugador.
function cuadraCercaDelObelisco() {
  const cerca = ciudad.calles.filter(c => c.clase !== 'peatonal' &&
    Math.hypot(ciudad.esquinas[c.a].x - 640, ciudad.esquinas[c.a].y - 360) < 220);
  return cerca[Math.floor(Math.random() * cerca.length)];
}

const escenarios = {
  microcentro: {
    nombre: 'Microcentro al azar',
    ayuda: 'Unas cuadras del centro, elegidas al azar',
    transito: 'medio',
    T: 90,
    armar: () => manchaAlAzar(cuadraCercaDelObelisco(), 18),
  },
  nueveDeJulio: {
    nombre: 'Onda verde en la 9 de Julio',
    ayuda: 'La 9 de Julio de punta a punta: el caso donde el desfase se ve de una',
    transito: 'medio',
    T: 90,
    armar: () => {
      const cuadras = cuadrasDe('Avenida 9 de Julio');
      if (cuadras.length === 0) return [];
      const { cuadra, norte } = arranqueDesdeElNorte(cuadras);
      return corredor(cuadra, norte, 20);
    },
  },
  embotellamiento: {
    nombre: 'Embotellamiento',
    ayuda: 'Centro apretado, tránsito alto y ciclo corto: los desfases no se pueden cumplir',
    transito: 'alto',
    T: 35,  // con T chico, Δ pasa de π/2 y las dobles manos se van a antifase (ec. 2)
    armar: () => manchaAlAzar(cuadraCercaDelObelisco(), 26),
  },
};

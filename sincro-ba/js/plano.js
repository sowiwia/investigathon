// Plano: las cuadras de la ciudad que el jugador puso en la red, con sus esquinas.
// Cada esquina del plano es un cruce real y lleva un semáforo; cada calle es una cuadra real.

function crearPlano() {
  return { esquinas: [], calles: [] };
}

function agregarEsquina(plano, indiceCiudad) {
  const existente = plano.esquinas.findIndex(e => e.ciudad === indiceCiudad);
  if (existente !== -1) return existente;
  const esquina = ciudad.esquinas[indiceCiudad];
  plano.esquinas.push({ ciudad: indiceCiudad, x: esquina.x, y: esquina.y });
  return plano.esquinas.length - 1;
}

function quitarEsquina(plano, indice) {
  plano.esquinas.splice(indice, 1);
  plano.calles = plano.calles.filter(c => c.a !== indice && c.b !== indice);
  for (const calle of plano.calles) {
    if (calle.a > indice) calle.a--;
    if (calle.b > indice) calle.b--;
  }
}

function buscarCalle(plano, cuadra) {
  return plano.calles.find(c => c.cuadra === cuadra);
}

function agregarCalle(plano, cuadra) {
  if (buscarCalle(plano, cuadra)) return null;
  const calle = {
    cuadra,
    a: agregarEsquina(plano, cuadra.a),
    b: agregarEsquina(plano, cuadra.b),
    deAaB: cuadra.mano !== 'ba',
    deBaA: cuadra.mano !== 'ab',
    avenida: cuadra.clase === 'avenida',
  };
  plano.calles.push(calle);
  return calle;
}

function quitarCalle(plano, calle) {
  plano.calles = plano.calles.filter(c => c !== calle);
  for (let i = plano.esquinas.length - 1; i >= 0; i--) {
    if (!plano.calles.some(c => c.a === i || c.b === i)) quitarEsquina(plano, i);
  }
}

function hayFlujo(calle, haciaB) {
  return haciaB ? calle.deAaB : calle.deBaA;
}

// Si la cuadra entra por el verde de la principal o por el de la secundaria en esa esquina.
function rolDeCalle(plano, calle, indiceEnPlano) {
  return rolEn(plano.esquinas[indiceEnPlano].ciudad, calle.cuadra);
}

// Peso K de una cuadra: su flujo base por el multiplicador del nivel de tránsito.
function acopleDeCalle(calle, parametros) {
  return (calle.avenida ? parametros.flujoAvenida : parametros.flujoCalle) * parametros.acople;
}

// Arma vecinos, K y delta para el modelo. Las calles cortadas no cuentan; las de mano única sí
// cuentan como vecinas en sus dos esquinas, porque Ni son las señales adyacentes (sec. 4.1).
function armarRed(plano, parametros) {
  const n = plano.esquinas.length;
  const matriz = () => Array.from({ length: n }, () => new Array(n).fill(0));
  const red = { vecinos: Array.from({ length: n }, () => []), K: matriz(), delta: matriz() };

  for (const calle of plano.calles) {
    const { a, b } = calle;
    const flujo = acopleDeCalle(calle, parametros);
    const base = desfaseObjetivo(calle.cuadra.largo, parametros.v, parametros.T);
    // una cuadra que entra como principal en una punta y como secundaria en la otra corre su
    // objetivo lo que valga la diferencia entre los arranques de verde (ec. 17)
    const correccion = correccionPi(calle.cuadra, plano.esquinas[a].ciudad, plano.esquinas[b].ciudad, parametros.s);

    // Ni es un conjunto: dos cuadras entre las mismas esquinas no hacen dos vecinos.
    if (!red.vecinos[a].includes(b)) red.vecinos[a].push(b);
    if (!red.vecinos[b].includes(a)) red.vecinos[b].push(a);
    red.K[a][b] = calle.deAaB ? flujo : 0;
    red.K[b][a] = calle.deBaA ? flujo : 0;
    red.delta[a][b] = mod2pi(base + correccion);
    red.delta[b][a] = mod2pi(base - correccion);
  }
  return red;
}

// Una mano única está cumplida si su flujo lo está; una doble mano, si está en el óptimo de la ec. 2.
function calleCumplida(calle, red, fases, tol) {
  if (calle.deAaB && calle.deBaA) return dobleManoEnOptimo(fases, red, calle.a, calle.b, tol);
  if (calle.deAaB) return flujoCumplido(fases, red, calle.a, calle.b, tol);
  return flujoCumplido(fases, red, calle.b, calle.a, tol);
}

function redCumplida(plano, red, fases, tol) {
  return plano.calles.length > 0 && plano.calles.every(calle => calleCumplida(calle, red, fases, tol));
}

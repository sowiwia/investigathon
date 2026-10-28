// Autitos ilustrativos. Circulan a la velocidad v del modelo, siempre derecho, y frenan con la luz
// roja o detrás del auto de adelante. Son solo visuales: no cambian las fases.
//
// Cada auto va por una cuadra, en un sentido (haciaB: de la esquina a hacia la b, o al revés) y por
// un carril; avance es cuántos metros lleva recorridos de la cuadra.
//
// Los autos nuevos entran solo por las puntas de la red; al abrir una escena ya hay algunos en camino.
// No doblan ni desaparecen al azar en un cruce: si no hay una cuadra recta con flujo, salen.

const autosEnCalle = 0.3;  // una calle recibe menos autos que una avenida
const maximoDeAutos = 600;
const metrosEntreAutos = 16;
const metrosDeEntrada = 2;  // desde dónde aparece un auto nuevo: saliendo del cruce
const metrosDeDispersion = 6;  // y cuánto más adelante puede aparecer, para que no entren pegados
const anguloDerecho = Math.PI / 3;  // hasta acá se considera que una calle sigue derecho
const acumuladoPorEntrada = new Map();

function reiniciarEntradasDeAutos() {
  acumuladoPorEntrada.clear();
}

// Una doble mano tiene uno por sentido (dos si es avenida); una mano única, el doble en un solo sentido.
function carrilesPorLado(calle) {
  return calle.avenida ? 2 : 1;
}

function cantidadDeCarriles(calle) {
  return calle.deAaB && calle.deBaA ? carrilesPorLado(calle) : 2 * carrilesPorLado(calle);
}

// Esquina a la que llega un auto que va por 'calle' en el sentido 'haciaB'.
function esquinaDeLlegada(calle, haciaB) {
  return haciaB ? calle.b : calle.a;
}

// Carril que le toca a un auto al pasar a otra cuadra, que puede tener menos carriles.
function carrilAlPasar(auto, calle) {
  return auto.carril < cantidadDeCarriles(calle) ? auto.carril : 0;
}

function posicionDeAuto(auto) {
  const cuadra = auto.calle.cuadra;
  const avance = auto.avance / cuadra.largo * cuadra.largoPx;
  return puntoSobreCuadra(cuadra, avance, auto.haciaB);
}

// Calle de la red que sigue derecho al llegar a 'destino', si un auto puede tomarla.
function calleSiguiente(plano, calle, haciaB) {
  const destino = esquinaDeLlegada(calle, haciaB);
  const enCiudad = plano.esquinas[destino].ciudad;
  const llegada = rumboDeLlegada(calle.cuadra, enCiudad);
  let elegida = null;
  let menor = anguloDerecho;
  for (const otra of plano.calles) {
    if (otra === calle || (otra.a !== destino && otra.b !== destino)) continue;
    const siguienteHaciaB = otra.a === destino;
    if (!hayFlujo(otra, siguienteHaciaB)) continue;
    const giro = Math.abs(wrap(rumboDeSalida(otra.cuadra, enCiudad) - llegada));
    if (giro < menor) {
      menor = giro;
      elegida = { calle: otra, haciaB: siguienteHaciaB };
    }
  }
  return elegida;
}

// Una cuadra es entrada de la red si su esquina de arriba no recibe tránsito de otra cuadra.
// Así los autos no aparecen en el medio de un corredor que ya tenía tránsito.
function esEntradaDeRed(plano, calle, haciaB) {
  const arriba = haciaB ? calle.a : calle.b;
  return !plano.calles.some(otra => {
    if (otra === calle) return false;
    return (otra.b === arriba && otra.deAaB) || (otra.a === arriba && otra.deBaA);
  });
}

// Verde de 'calle' en una de sus esquinas: depende de si esa cuadra entra por el verde de la
// principal o por el de la secundaria en ese cruce.
function tieneVerde(plano, fases, calle, esquina, s) {
  const verdePrincipal = verdeEnPrincipal(fases[esquina], s);
  return rolDeCalle(plano, calle, esquina) === 'principal' ? verdePrincipal : !verdePrincipal;
}

// Segundos de verde que le quedan a 'calle' en una esquina, estando en verde.
function verdeQueQueda(plano, fases, calle, esquina, parametros) {
  const principal = rolDeCalle(plano, calle, esquina) === 'principal';
  const termina = principal ? parametros.s * 2 * Math.PI : 2 * Math.PI;
  return mod2pi(termina - fases[esquina]) / (2 * Math.PI / parametros.T);
}

// Lugar al principio de la cuadra que sigue, en el carril que le tocaría al que cruza.
function hayLugarDespues(autos, plano, auto) {
  const siguiente = calleSiguiente(plano, auto.calle, auto.haciaB);
  if (!siguiente) return true;  // se va del mapa: nada lo puede trabar
  const carril = carrilAlPasar(auto, siguiente.calle);
  const clave = claveDeCarril(plano, siguiente.calle, siguiente.haciaB, carril);
  return !autos.some(otro => otro.clave === clave && otro.avance < metrosEntreAutos);
}

// Un auto arranca a cruzar solo si tiene verde, le alcanza el verde para despejar el cruce y hay
// lugar del otro lado: si no, al cambiar la luz quedaría clavado arriba del cruce y le pasarían por
// encima los que cruzan por la otra calle.
function puedeCruzar(autos, plano, fases, auto, parametros) {
  const destino = esquinaDeLlegada(auto.calle, auto.haciaB);
  if (!tieneVerde(plano, fases, auto.calle, destino, parametros.s)) return false;
  const despeje = (auto.calle.cuadra.largo - lineaDeFrenado(auto.calle.cuadra) + 8) / parametros.v;
  if (verdeQueQueda(plano, fases, auto.calle, destino, parametros) < despeje) return false;
  return hayLugarDespues(autos, plano, auto);
}

function claveDeCarril(plano, calle, haciaB, carril) {
  return `${plano.calles.indexOf(calle)}-${haciaB}-${carril}`;
}

// Avanza los autos 'segundos' simulados y devuelve la nueva lista. 'azar' se puede fijar en los tests.
function moverAutos(autos, plano, fases, parametros, segundos, azar = Math.random) {
  // si la calle se cortó, se borró o cambió de mano, sus autos desaparecen
  const vivos = autos.filter(auto => plano.calles.includes(auto.calle) &&
    hayFlujo(auto.calle, auto.haciaB) && auto.carril < cantidadDeCarriles(auto.calle));
  for (const auto of vivos) auto.clave = claveDeCarril(plano, auto.calle, auto.haciaB, auto.carril);

  // por carril y de adelante hacia atrás, así cada uno frena detrás del que tiene adelante
  vivos.sort((x, y) => x.clave.localeCompare(y.clave) || y.avance - x.avance);

  const avance = segundos * parametros.v;
  const quedan = [];
  let claveAnterior = null;
  let avanceDelDeAdelante = Infinity;

  for (const auto of vivos) {
    if (auto.clave !== claveAnterior) {
      claveAnterior = auto.clave;
      avanceDelDeAdelante = Infinity;
    }
    const largo = auto.calle.cuadra.largo;
    const frenada = lineaDeFrenado(auto.calle.cuadra);
    let limite = avanceDelDeAdelante - metrosEntreAutos;
    // el cruce solo le importa al que está por pisar la línea de frenado en este paso
    if (auto.avance <= frenada && auto.avance + avance > frenada &&
        !puedeCruzar(vivos, plano, fases, auto, parametros)) {
      limite = Math.min(limite, frenada);
    }
    auto.avance = Math.max(auto.avance, Math.min(auto.avance + avance, limite));
    avanceDelDeAdelante = auto.avance;

    if (auto.avance < largo) {
      quedan.push(auto);
      continue;
    }

    // llegó a la esquina: sigue derecho o sale del mapa; no hay giros
    const siguiente = calleSiguiente(plano, auto.calle, auto.haciaB);
    if (!siguiente) continue;
    const carril = carrilAlPasar(auto, siguiente.calle);
    const clave = claveDeCarril(plano, siguiente.calle, siguiente.haciaB, carril);
    // ya se fijó que había lugar antes de pisar la línea, así que esto casi no pasa; si igual se
    // llenó, espera donde está y no se lo manda para atrás, que le caería encima al de atrás.
    if (vivos.some(otro => otro.clave === clave && otro.avance < metrosEntreAutos)) {
      auto.avance = largo;
    } else {
      auto.avance -= largo;
      auto.calle = siguiente.calle;
      auto.haciaB = siguiente.haciaB;
      auto.carril = carril;
      // la clave queda al día para que el que cruza atrás lo vea y no se le suba encima
      auto.clave = clave;
    }
    quedan.push(auto);
  }

  agregarAutosNuevos(quedan, plano, parametros, segundos, azar);
  return quedan;
}

// Cuántos autos nacen en un paso: la parte entera y la fracción al azar. Así la cantidad sale de los
// segundos simulados y no de cuántos cuadros por segundo dé la máquina.
function cuantosNacen(tasa, segundos, azar) {
  const esperados = tasa * segundos;
  return Math.floor(esperados) + (azar() < esperados % 1 ? 1 : 0);
}

// En la app los autos entran con una cadencia pareja; la fracción se conserva entre cuadros.
function nacimientosRegulares(calle, haciaB, tasa, segundos) {
  const clave = `${calle.cuadra.id}-${haciaB}`;
  const acumulado = (acumuladoPorEntrada.get(clave) || 0) + tasa * segundos;
  const cantidad = Math.floor(acumulado + 1e-9);
  acumuladoPorEntrada.set(clave, acumulado - cantidad);
  return cantidad;
}

// Un auto nuevo aparece apenas pasado el cruce de arriba, en un carril libre. Devuelve false si no
// pudo entrar porque la cuadra ya tiene un auto pegado al cruce.
function agregarAuto(autos, calle, haciaB, azar) {
  if (autos.length >= maximoDeAutos) return false;
  const tope = lineaDeFrenado(calle.cuadra) - 2;
  if (tope < 0) return false;
  const carril = Math.floor(azar() * cantidadDeCarriles(calle));
  const desde = Math.min(metrosDeEntrada + azar() * metrosDeDispersion, tope);
  const ocupado = autos.some(auto => auto.calle === calle && auto.haciaB === haciaB &&
    auto.carril === carril && Math.abs(auto.avance - desde) < metrosEntreAutos);
  if (ocupado) return false;
  autos.push({ calle, haciaB, carril, avance: desde, tono: azar() });
  return true;
}

// Mete los autos nuevos del paso, apenas pasado el cruce de arriba de cada entrada de la red.
function agregarAutosNuevos(autos, plano, parametros, segundos, azar) {
  for (const calle of plano.calles) {
    for (const haciaB of [true, false]) {
      if (!hayFlujo(calle, haciaB) || !esEntradaDeRed(plano, calle, haciaB)) continue;
      const tasa = parametros.autosPorSegundo * (calle.avenida ? 1 : autosEnCalle);
      const cantidad = parametros.nacimientosRegulares
        ? nacimientosRegulares(calle, haciaB, tasa, segundos)
        : cuantosNacen(tasa, segundos, azar);
      for (let k = cantidad; k > 0; k--) {
        if (autos.length >= maximoDeAutos) return;
        agregarAuto(autos, calle, haciaB, azar);
      }
    }
  }
}

// Deja un auto de muestra en una cuadra recién agregada, para que no quede vacía hasta que toque
// el próximo nacimiento aleatorio. Solo si la cuadra es una entrada: no inventa tránsito en el
// medio de un corredor. Si es de doble mano, pone uno en cada sentido. 'ignorarEntrada' se usa en
// un circuito cerrado, donde no hay ninguna entrada.
function sembrarAutosEnCalle(autos, plano, calle, azar = Math.random, ignorarEntrada = false) {
  for (const haciaB of [true, false]) {
    if (!hayFlujo(calle, haciaB) || (!ignorarEntrada && !esEntradaDeRed(plano, calle, haciaB))) continue;
    agregarAuto(autos, calle, haciaB, azar);
  }
}

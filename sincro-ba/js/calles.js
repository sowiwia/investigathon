// Calles del Microcentro tal como son: el grafo sale de OpenStreetMap y viene en píxeles del mapa.
// Una esquina es un cruce real y una cuadra es el tramo de calle entre dos cruces, con su forma.
//
// En cada esquina las calles se reparten en los dos verdes del semáforo: las que van en la dirección
// de la calle más importante son la principal y las demás, la secundaria. Una cuadra puede entrar
// como principal en una punta y como secundaria en la otra; eso se corrige en Δ (Nishikawa ec. 17).

const pixelesPorPunto = 4;  // del mapa de 320x180 del grafo a la capa del mundo
const tolRumbo = Math.PI / 4;  // hasta acá una calle cuenta como paralela a la principal

let ciudad = { esquinas: [], calles: [] };

function cargarCiudad(datos) {
  ciudad = {
    metrosPorPixel: datos.mapa.metrosPorPixel / pixelesPorPunto,
    esquinas: datos.esquinas.map(e => ({
      osm: e.osm,
      x: e.x * pixelesPorPunto,
      y: e.y * pixelesPorPunto,
      semaforo: e.semaforo,
      calles: [],
    })),
    calles: datos.calles.map((c, i) => ({
      id: i,
      a: c.a,
      b: c.b,
      nombre: c.nombre,
      clase: c.clase,
      mano: c.mano,
      largo: c.largo,
      puntos: c.puntos.map(([x, y]) => [x * pixelesPorPunto, y * pixelesPorPunto]),
    })),
  };
  for (const calle of ciudad.calles) {
    medirCuadra(calle);
    ciudad.esquinas[calle.a].calles.push(calle);
    ciudad.esquinas[calle.b].calles.push(calle);
  }
  ciudad.esquinas.forEach(repartirVerdes);
  return ciudad;
}

// Largo de la cuadra en píxeles y distancia acumulada hasta cada punto, para poder recorrerla.
function medirCuadra(calle) {
  calle.acumulado = [0];
  for (let i = 1; i < calle.puntos.length; i++) {
    const [x1, y1] = calle.puntos[i - 1];
    const [x2, y2] = calle.puntos[i];
    calle.acumulado.push(calle.acumulado[i - 1] + Math.hypot(x2 - x1, y2 - y1));
  }
  calle.largoPx = calle.acumulado[calle.acumulado.length - 1];
}

// Punto y dirección a 'avance' píxeles del arranque, recorriendo la cuadra en el sentido dado.
function puntoSobreCuadra(calle, avance, haciaB) {
  const puntos = haciaB ? calle.puntos : [...calle.puntos].reverse();
  const acumulado = haciaB
    ? calle.acumulado
    : calle.acumulado.map(d => calle.largoPx - d).reverse();
  const d = Math.max(0, Math.min(avance, calle.largoPx));
  let i = 1;
  while (i < acumulado.length - 1 && acumulado[i] < d) i++;
  const tramo = acumulado[i] - acumulado[i - 1];
  const t = tramo < 0.01 ? 0 : (d - acumulado[i - 1]) / tramo;
  const [x1, y1] = puntos[i - 1];
  const [x2, y2] = puntos[i];
  const largo = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, ux: (x2 - x1) / largo, uy: (y2 - y1) / largo };
}

// Dónde frena el que llega al cruce por esta cuadra, en metros desde el arranque: diez metros antes
// de la esquina, pero nunca más atrás del 40 % de la cuadra, porque en el Microcentro hay cuadras
// de once metros.
const metrosAntesDelCruce = 10;

function lineaDeFrenado(cuadra) {
  return Math.max(cuadra.largo * 0.4, cuadra.largo - metrosAntesDelCruce);
}

// El punto del eje donde frena quien llega a esa esquina, con la dirección en la que viene.
function puntoDeParada(cuadra, esquina) {
  const haciaB = cuadra.b === esquina;
  return puntoSobreCuadra(cuadra, cuadra.largoPx * lineaDeFrenado(cuadra) / cuadra.largo, haciaB);
}

function puntaOpuesta(calle, esquina) {
  return calle.a === esquina ? calle.b : calle.a;
}

// Los puntos de la cuadra ordenados desde una de sus esquinas, para mirarla desde esa punta.
function puntosDesde(calle, esquina) {
  return calle.a === esquina ? calle.puntos : [...calle.puntos].reverse();
}

// Dirección con la que una cuadra sale de una esquina, en toda la vuelta, para saber qué calle
// sigue derecho en un cruce.
function rumboDeSalida(calle, esquina) {
  const [[x1, y1], [x2, y2]] = puntosDesde(calle, esquina);
  return Math.atan2(y2 - y1, x2 - x1);
}

// Y con la que llega a esa esquina, que es el último tramo visto desde la otra punta.
function rumboDeLlegada(calle, esquina) {
  const puntos = puntosDesde(calle, puntaOpuesta(calle, esquina));
  const [x1, y1] = puntos[puntos.length - 2];
  const [x2, y2] = puntos[puntos.length - 1];
  return Math.atan2(y2 - y1, x2 - x1);
}

// El rumbo de salida sin importar el sentido, en [0, π): una calle y su contraria apuntan al mismo
// lado para esto.
function rumboDesde(calle, esquina) {
  return ((rumboDeSalida(calle, esquina) % Math.PI) + Math.PI) % Math.PI;
}

function diferenciaDeRumbo(a, b) {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
}

const importancia = { avenida: 3, calle: 2, peatonal: 1 };

// Reparte las calles de la esquina en los dos verdes, tomando como principal la dirección de la
// calle más importante y poniendo con ella a todas las que van más o menos para el mismo lado.
function repartirVerdes(esquina, indice) {
  esquina.rol = new Map();
  if (esquina.calles.length === 0) return;
  const peso = calle => importancia[calle.clase] * 1e6 + calle.largo;
  const mandamas = esquina.calles.reduce((mejor, calle) => peso(calle) > peso(mejor) ? calle : mejor);
  const eje = rumboDesde(mandamas, indice);
  for (const calle of esquina.calles) {
    const propio = rumboDesde(calle, indice);
    esquina.rol.set(calle.id, diferenciaDeRumbo(propio, eje) < tolRumbo ? 'principal' : 'secundaria');
  }
}

function rolEn(indiceEsquina, calle) {
  return ciudad.esquinas[indiceEsquina].rol.get(calle.id) || 'principal';
}

// Arranque del verde de una calle en una esquina, en fase: 0 la principal y s·2π la secundaria
// (Nishikawa sec. 4.3).
function arranqueDeVerde(indiceEsquina, calle, s) {
  return rolEn(indiceEsquina, calle) === 'principal' ? 0 : s * 2 * Math.PI;
}

// Corrección Π de la ec. 17: si una cuadra entra como principal en una punta y como secundaria en
// la otra, el objetivo se corre lo que valga la diferencia entre los arranques de verde.
function correccionPi(calle, desde, hacia, s) {
  return arranqueDeVerde(desde, calle, s) - arranqueDeVerde(hacia, calle, s);
}

// Distancia de un punto a un segmento, en píxeles del mundo.
function distanciaASegmento(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / largo2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distanciaACalle(px, py, calle) {
  let menor = Infinity;
  for (let i = 0; i < calle.puntos.length - 1; i++) {
    menor = Math.min(menor, distanciaASegmento(px, py, calle.puntos[i], calle.puntos[i + 1]));
  }
  return menor;
}

// La cuadra más cercana al punto, si está a menos de tol.
function calleCercana(px, py, tol) {
  let elegida = null;
  let menor = tol;
  for (const calle of ciudad.calles) {
    const d = distanciaACalle(px, py, calle);
    if (d < menor) {
      menor = d;
      elegida = calle;
    }
  }
  return elegida;
}

function anchoDeCalzada(clase) {
  return { avenida: 4, calle: 3, peatonal: 2 }[clase];
}

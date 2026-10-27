// Una ciudad chica escrita a mano, para que los tests sean repetibles.
//
//   A ── B ── C          A, B, C y D, E, F en dos filas; las verticales las unen.
//   │    │    │          De F sale una diagonal a 45° hasta G.
//   D ── E ── F
//             ╲
//              G
//
// Las posiciones van en píxeles del mapa y los largos en metros, como en los datos reales.

function ciudadDePrueba() {
  const punto = (x, y) => ({ osm: x * 100 + y, x, y, semaforo: true });
  const esquinas = [
    punto(0, 0), punto(16, 0), punto(32, 0),
    punto(0, 16), punto(16, 16), punto(32, 16),
    punto(48, 32),
  ];
  const recta = (a, b, nombre, clase, mano, largo) => ({
    a, b, nombre, clase, mano, largo,
    puntos: [[esquinas[a].x, esquinas[a].y], [esquinas[b].x, esquinas[b].y]],
  });
  const calles = [
    recta(0, 1, 'Avenida de arriba', 'avenida', 'no', 130),
    recta(1, 2, 'Avenida de arriba', 'avenida', 'no', 130),
    recta(3, 4, 'Avenida de abajo', 'avenida', 'no', 130),
    recta(4, 5, 'Avenida de abajo', 'avenida', 'no', 130),
    recta(0, 3, 'Primera vertical', 'calle', 'no', 130),
    recta(1, 4, 'Segunda vertical', 'calle', 'no', 130),
    recta(2, 5, 'Tercera vertical', 'calle', 'no', 130),
    recta(5, 6, 'Diagonal', 'calle', 'no', 184),
  ];
  return cargarCiudad({ mapa: { ancho: 320, alto: 180, metrosPorPixel: 8.11 }, esquinas, calles });
}

// Índices de las cuadras de la ciudad de prueba, para leer los tests sin contar.
const ARRIBA_IZQ = 0, ARRIBA_DER = 1, ABAJO_IZQ = 2, ABAJO_DER = 3;
const VERTICAL_1 = 4, VERTICAL_2 = 5, VERTICAL_3 = 6, DIAGONAL = 7;

const parametrosDePrueba = {
  v: 40 / 3.6,  // 40 km/h en m/s
  T: 90,
  s: 0.5,
  flujoCalle: 1,
  flujoAvenida: 10,
  acople: 1,
  autosPorSegundo: 0.15,
};

// Pone en la red las cuadras que se le pidan y devuelve el plano.
function planoCon(...indices) {
  const plano = crearPlano();
  for (const i of indices) agregarCalle(plano, ciudad.calles[i]);
  return plano;
}

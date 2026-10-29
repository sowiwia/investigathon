const anchoMundo = 1280;
const altoMundo = 720;

let capaCiudad;
let ciudadAlDia = false;

function invalidarCiudad() {
  ciudadAlDia = false;
}

function banda(capa, p, q, medio, salteo = 1, desfase = 0) {
  const largo = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (largo < 0.01) return;
  const ux = (q[0] - p[0]) / largo;
  const uy = (q[1] - p[1]) / largo;
  const nx = -uy;
  const ny = ux;
  for (let i = 0; i <= largo; i++) {
    if (salteo > 1 && Math.floor((i + desfase) / salteo) % 2) continue;
    const cx = p[0] + ux * i;
    const cy = p[1] + uy * i;
    for (let d = -medio; d <= medio; d++) {
      capa.rect(Math.round(cx + nx * d), Math.round(cy + ny * d), 1, 1);
    }
  }
}

function contorno(capa, p, q, medio) {
  const largo = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (largo < 0.01) return;
  const ux = (q[0] - p[0]) / largo;
  const uy = (q[1] - p[1]) / largo;
  for (let i = 0; i <= largo; i++) {
    const cx = p[0] + ux * i;
    const cy = p[1] + uy * i;
    capa.rect(Math.round(cx - uy * medio), Math.round(cy + ux * medio), 1, 1);
    capa.rect(Math.round(cx + uy * medio), Math.round(cy - ux * medio), 1, 1);
  }
}

function recorrer(puntos, fn) {
  for (let i = 0; i < puntos.length - 1; i++) fn(puntos[i], puntos[i + 1], i);
}

function medioAncho(cuadra) {
  return anchoDeCalzada(cuadra.clase) + (cuadra.clase === 'avenida' ? 1 : 0);
}

function flechas(capa, puntos, medio) {
  const alto = Math.min(3, Math.max(2, medio - 2));
  let recorrido = 0;
  recorrer(puntos, (p, q) => {
    const largo = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (largo < 0.01) return;
    const ux = (q[0] - p[0]) / largo;
    const uy = (q[1] - p[1]) / largo;
    for (let t = ((-recorrido) % 36 + 36) % 36; t < largo; t += 36) {
      const cx = p[0] + ux * t;
      const cy = p[1] + uy * t;
      for (let d = 0; d <= alto; d++) {
        const adelante = alto - d;
        capa.rect(Math.round(cx + ux * adelante - uy * d), Math.round(cy + uy * adelante + ux * d), 1, 1);
        capa.rect(Math.round(cx + ux * adelante + uy * d), Math.round(cy + uy * adelante - ux * d), 1, 1);
      }
    }
    recorrido += largo;
  });
}

function puntosEnSentido(calle) {
  const puntos = calle.cuadra.puntos;
  return calle.deAaB ? puntos : [...puntos].reverse();
}

function dibujarFantasmas(capa, plano) {
  capa.fill(paleta.fantasma);
  for (const cuadra of ciudad.calles) {
    if (plano.calles.some(c => c.cuadra === cuadra)) continue;
    recorrer(cuadra.puntos, (p, q, i) => banda(capa, p, q, 0, 3, i * 5));
  }
}

function dibujarCalzada(capa, calle) {
  const medio = medioAncho(calle.cuadra);
  const puntos = calle.cuadra.puntos;
  capa.fill(paleta.cordon);
  recorrer(puntos, (p, q) => banda(capa, p, q, medio + 1));
  capa.fill(paleta.asfalto);
  recorrer(puntos, (p, q) => banda(capa, p, q, medio));
}

function dibujarEje(capa, calle, color) {
  capa.fill(color);
  const unaMano = calle.deAaB !== calle.deBaA;
  recorrer(calle.cuadra.puntos, (p, q, i) => banda(capa, p, q, 0, unaMano ? 1 : 5, i * 7));
  if (unaMano) flechas(capa, puntosEnSentido(calle), medioAncho(calle.cuadra));
}

function dibujarPrevia(capa, cuadra) {
  const medio = medioAncho(cuadra);
  capa.fill(paleta.cordon);
  recorrer(cuadra.puntos, (p, q) => banda(capa, p, q, medio + 1));
  capa.fill(paleta.asfalto);
  recorrer(cuadra.puntos, (p, q) => banda(capa, p, q, medio));
  capa.fill(paleta.senalada);
  recorrer(cuadra.puntos, (p, q, i) => banda(capa, p, q, 0, 3, i * 5));
}

function radioDeCruce(plano, indice) {
  let radio = 3;
  for (const calle of plano.calles) {
    if (calle.a === indice || calle.b === indice) {
      radio = Math.max(radio, medioAncho(calle.cuadra) + 1);
    }
  }
  return radio;
}

function dibujarCruce(capa, plano, indice) {
  const { x, y } = plano.esquinas[indice];
  const radio = radioDeCruce(plano, indice);
  capa.fill(paleta.asfalto);
  capa.rect(Math.round(x - radio), Math.round(y - radio), 2 * radio + 1, 2 * radio + 1);
}

function dibujarSemaforos(capa, plano, indice, fase, s, chicos) {
  const esquina = plano.esquinas[indice];
  const verdePrincipal = verdeEnPrincipal(fase, s);
  if (chicos) {
    capa.fill(verdePrincipal ? paleta.verde : paleta.rojo);
    capa.rect(Math.round(esquina.x) - 1, Math.round(esquina.y) - 1, 3, 3);
    return;
  }
  for (const calle of plano.calles) {
    if (calle.a !== indice && calle.b !== indice) continue;
    if (!hayFlujo(calle, calle.b === indice)) continue;
    const parada = puntoDeParada(calle.cuadra, esquina.ciudad);
    const costado = medioAncho(calle.cuadra) + 3;
    const verde = rolDeCalle(plano, calle, indice) === 'principal' ? verdePrincipal : !verdePrincipal;
    dibujarCabezal(capa,
      Math.round(parada.x - parada.uy * costado),
      Math.round(parada.y + parada.ux * costado), verde);
  }
}

function dibujarCabezal(capa, x, y, verde) {
  capa.fill(paleta.caja);
  capa.rect(x - 1, y - 3, 3, 6);
  capa.fill(verde ? paleta.rojoApagado : paleta.rojo);
  capa.rect(x, y - 2, 1, 2);
  capa.fill(verde ? paleta.verde : paleta.verdeApagado);
  capa.rect(x, y, 1, 2);
}

function dibujarAutos(capa, autos) {
  for (const auto of autos) {
    const pos = posicionDeAuto(auto);
    const lado = auto.carril < carrilesPorLado(auto.calle) ? 1 : -1;
    const distancia = 1 + 2 * (auto.carril % carrilesPorLado(auto.calle));
    const dx = -pos.uy * lado * distancia;
    const dy = pos.ux * lado * distancia;
    capa.fill(coloresDeAutos[Math.floor(auto.tono * coloresDeAutos.length)]);
    const derecho = Math.abs(pos.ux) > 2 * Math.abs(pos.uy);
    const parado = Math.abs(pos.uy) > 2 * Math.abs(pos.ux);
    const largo = derecho ? [2, 1] : parado ? [1, 2] : [1, 1];
    capa.rect(Math.round(pos.x + dx - largo[0]), Math.round(pos.y + dy - largo[1]),
      2 * largo[0], 2 * largo[1]);
  }
}

function dibujarMundo(capa, mapa, escena) {
  const { plano, red, fases, parametros, autos, elegidas, tol, señalada, zoom } = escena;
  capa.noStroke();

  if (!ciudadAlDia) {
    capaCiudad.noStroke();
    capaCiudad.image(mapa, 0, 0, anchoMundo, altoMundo);
    dibujarFantasmas(capaCiudad, plano);
    for (const calle of plano.calles) dibujarCalzada(capaCiudad, calle);
    for (let i = 0; i < plano.esquinas.length; i++) dibujarCruce(capaCiudad, plano, i);
    ciudadAlDia = true;
  }
  capa.image(capaCiudad, 0, 0);

  for (const { calle, color } of elegidas) {
    capa.fill(color);
    recorrer(calle.cuadra.puntos, (p, q) => contorno(capa, p, q, medioAncho(calle.cuadra) + 3));
  }
  if (señalada) {
    if (plano.calles.some(calle => calle.cuadra === señalada)) {
      capa.fill(paleta.senalada);
      recorrer(señalada.puntos, (p, q) => contorno(capa, p, q, medioAncho(señalada) + 2));
    } else {
      dibujarPrevia(capa, señalada);
    }
  }
  for (const calle of plano.calles) {
    dibujarEje(capa, calle, calleCumplida(calle, red, fases, tol) ? paleta.cumplido : paleta.lejos);
  }
  dibujarAutos(capa, autos);
  for (let i = 0; i < plano.esquinas.length; i++) {
    dibujarSemaforos(capa, plano, i, fases[i], parametros.s, zoom < 2);
  }
  dibujarObelisco(capa);
}

const obeliscoChico = [
  '..sS..',
  '..sS..',
  '.ssSS.',
  '.ssSS.',
  '.ssSS.',
  '.ssSS.',
  '.ssSS.',
  '.ssSS.',
  '.ssSS.',
  '.ssSS.',
  'sssSSS',
  'sssSSS',
  'sssSSS',
  'sssSSS',
  'sssSSS',
  'sssSSS',
  'kkkkkk',
];
let capaObelisco = null;

function dibujarObelisco(capa) {
  if (!capaObelisco) {
    capaObelisco = createGraphics(12, 34);
    capaObelisco.pixelDensity(1);
    capaObelisco.noSmooth();
    capaObelisco.noStroke();
    const colores = { s: paleta.piedra, S: paleta.piedraSombra, k: paleta.caja };
    obeliscoChico.forEach((fila, j) => [...fila].forEach((clave, i) => {
      if (clave !== '.') {
        capaObelisco.fill(colores[clave]);
        capaObelisco.rect(i * 2, j * 2, 2, 2);
      }
    }));
  }
  capa.image(capaObelisco, 634, 336);
}

const iconos = {
  mirar: ['.........', '..wwwww..', '.w.....w.', 'w...c...w', 'w..ccc..w', 'w...c...w', '.w.....w.', '..wwwww..', '.........'],
  calle: ['.........', '.........', 'ggggggggg', 'aaaaaaaaa', 'wwaawwaaw', 'aaaaaaaaa', 'ggggggggg', '.........', '.........'],
  borrar: ['R.......R', '.R.....R.', '..R...R..', '...R.R...', '....R....', '...R.R...', '..R...R..', '.R.....R.', 'R.......R'],
  graficar: ['w........', 'w......c.', 'w.....c..', 'w....c...', 'w.c..c...', 'wc.cc....', 'w........', 'wwwwwwwww', '.........'],
  vaciar: ['.........', '..yyyyy..', '.yyyyyyy.', '..y...y..', '..y...y..', '..y...y..', '..y...y..', '..yyyyy..', '.........'],
  paneles: ['wwwwwwwww', 'wggpppggw', 'wggpppggw', 'wggpppggw', 'wggpppggw', 'wggpppggw', 'wggpppggw', 'wggpppggw', 'wwwwwwwww'],
};

const coloresDeIconos = {
  k: paleta.caja, R: paleta.rojo, g: paleta.gris, a: paleta.asfalto,
  w: paleta.texto, y: paleta.amarillo, c: paleta.cumplido, p: paleta.pantalla,
};

function pintarIcono(canvas, icono) {
  const ctx = canvas.getContext('2d');
  icono.forEach((fila, j) => {
    [...fila].forEach((clave, i) => {
      if (clave === '.') return;
      ctx.fillStyle = coloresDeIconos[clave];
      ctx.fillRect(i, j, 1, 1);
    });
  });
}

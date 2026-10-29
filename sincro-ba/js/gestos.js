const vista = { zoom: 2, x: 0, y: 0 };

const zoomMaximo = 5;
const pasoDeZoom = 1.25;

const pantallaCelularVertical = window.matchMedia('(max-width: 700px) and (orientation: portrait)');
const pantallaChicaDeJuego = window.matchMedia('(max-width: 700px), (max-height: 500px)');

function esCelularVertical() {
  return pantallaCelularVertical.matches;
}

function esPantallaChica() {
  return pantallaChicaDeJuego.matches;
}

const altoMinimoDeBanda = 48;

let bandaGuardada = null;

function olvidarBanda() {
  bandaGuardada = null;
}

function bandaDelMapa() {
  if (bandaGuardada) return bandaGuardada;
  bandaGuardada = medirBanda();
  return bandaGuardada;
}

function medirBanda() {
  if (!esCelularVertical()) return { desde: 0, hasta: height };
  const arriba = document.querySelector('.arriba');
  const desde = arriba ? Math.max(0, arriba.getBoundingClientRect().bottom - 16) : 0;
  let hasta = height;
  for (const elemento of document.querySelectorAll('.pestanasMoviles, .panelVentana, .barra')) {
    const estilo = getComputedStyle(elemento);
    if (estilo.display === 'none' || estilo.opacity === '0') continue;
    const borde = elemento.getBoundingClientRect().top;
    if (borde > desde) hasta = Math.min(hasta, borde);
  }
  if (hasta - desde < altoMinimoDeBanda) return { desde: 0, hasta: height };
  return { desde, hasta };
}

function medioDeLaBanda() {
  const banda = bandaDelMapa();
  return (banda.desde + banda.hasta) / 2;
}

function zoomMinimo() {
  const banda = bandaDelMapa();
  return Math.max(width / anchoMundo, (banda.hasta - banda.desde) / altoMundo);
}

function aMundo(x, y) {
  return { x: vista.x + x / vista.zoom, y: vista.y + y / vista.zoom };
}

function limitarVista() {
  const banda = bandaDelMapa();
  const visibleX = width / vista.zoom;
  const visibleY = (banda.hasta - banda.desde) / vista.zoom;
  vista.x = visibleX >= anchoMundo ? (anchoMundo - visibleX) / 2 : constrain(vista.x, 0, anchoMundo - visibleX);
  const yDeLaBanda = vista.y + banda.desde / vista.zoom;
  const limitada = visibleY >= altoMundo
    ? (altoMundo - visibleY) / 2
    : constrain(yDeLaBanda, 0, altoMundo - visibleY);
  vista.y = limitada - banda.desde / vista.zoom;
}

function centrarVistaEn(x, y) {
  vista.x = x - width / vista.zoom / 2;
  vista.y = y - medioDeLaBanda() / vista.zoom;
  limitarVista();
}

function centroDeLaVista() {
  return aMundo(width / 2, medioDeLaBanda());
}

function conservandoElCentro(cambiar) {
  const centro = centroDeLaVista();
  cambiar();
  olvidarBanda();
  vista.zoom = constrain(vista.zoom, zoomMinimo(), zoomMaximo);
  centrarVistaEn(centro.x, centro.y);
}

function mostrarZoom() {
  document.getElementById('valorZoom').textContent = `×${vista.zoom.toFixed(1)}`;
}

function cambiarZoom(nuevo, x, y) {
  const punto = aMundo(x, y);
  vista.zoom = constrain(nuevo, zoomMinimo(), zoomMaximo);
  vista.x = punto.x - x / vista.zoom;
  vista.y = punto.y - y / vista.zoom;
  limitarVista();
  mostrarZoom();
}

const punteros = new Map();
let toque = null;
let pellizco = null;
let arrastre = null;
let ruedaAcumulada = 0;

function escucharGestos(canvas) {
  canvas.addEventListener('pointerdown', alApoyar);
  canvas.addEventListener('pointermove', alMover);
  canvas.addEventListener('pointerup', alSoltar);
  canvas.addEventListener('pointercancel', alCancelar);
  canvas.addEventListener('wheel', alGirarRueda, { passive: false });
  canvas.addEventListener('pointerleave', () => { señalada = null; mostrarNombre(); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function alApoyar(e) {
  e.target.setPointerCapture(e.pointerId);
  punteros.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

  if (e.pointerType === 'mouse' && e.button !== 0) {
    arrastre = { x: e.offsetX, y: e.offsetY };
  } else if (punteros.size === 2) {
    toque = null;
    empezarPellizco();
  } else if (punteros.size === 1) {
    toque = {
      id: e.pointerId,
      x: e.offsetX,
      y: e.offsetY,
      movido: false,
      tipo: e.pointerType,
    };
    señalar(e.offsetX, e.offsetY);
  }
}

function alMover(e) {
  if (!punteros.has(e.pointerId)) {
    if (punteros.size === 0) señalar(e.offsetX, e.offsetY);
    return;
  }
  const anterior = punteros.get(e.pointerId);
  punteros.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

  if (pellizco && punteros.size === 2) {
    seguirPellizco();
  } else if (arrastre) {
    vista.x -= (e.offsetX - arrastre.x) / vista.zoom;
    vista.y -= (e.offsetY - arrastre.y) / vista.zoom;
    arrastre = { x: e.offsetX, y: e.offsetY };
    limitarVista();
  } else if (toque && toque.id === e.pointerId) {
    if (!toque.movido && dist(e.offsetX, e.offsetY, toque.x, toque.y) > 8) {
      toque.movido = true;
      if (toque.tipo === 'mouse' && herramienta !== 'mirar') {
        moverHerramienta(toque.x, toque.y);
      } else {
        señalada = null;
        mostrarNombre();
      }
    }
    if (!toque.movido) return;
    if (toque.tipo === 'mouse' && herramienta !== 'mirar') {
      moverHerramienta(e.offsetX, e.offsetY);
    } else {
      vista.x -= (e.offsetX - anterior.x) / vista.zoom;
      vista.y -= (e.offsetY - anterior.y) / vista.zoom;
      limitarVista();
    }
  }
}

function alSoltar(e) {
  if (toque && toque.id === e.pointerId) {
    if (!toque.movido) tocar(toque.x, toque.y);
    toque = null;
  }
  terminarPuntero(e.pointerId);
}

function alCancelar(e) {
  if (toque && toque.id === e.pointerId) toque = null;
  terminarPuntero(e.pointerId);
}

function terminarPuntero(id) {
  punteros.delete(id);
  if (punteros.size < 2) pellizco = null;
  if (punteros.size === 0) arrastre = null;
}

function dedos() {
  const [p, q] = [...punteros.values()];
  return { medio: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, distancia: dist(p.x, p.y, q.x, q.y) };
}

function empezarPellizco() {
  const { medio, distancia } = dedos();
  if (distancia < 1) {
    pellizco = null;
    return;
  }
  pellizco = { distancia, zoom: vista.zoom, punto: aMundo(medio.x, medio.y) };
}

function seguirPellizco() {
  if (!pellizco || pellizco.distancia < 1) return;
  const { medio, distancia } = dedos();
  vista.zoom = constrain(pellizco.zoom * distancia / pellizco.distancia, zoomMinimo(), zoomMaximo);
  vista.x = pellizco.punto.x - medio.x / vista.zoom;
  vista.y = pellizco.punto.y - medio.y / vista.zoom;
  limitarVista();
  mostrarZoom();
}

function alGirarRueda(e) {
  e.preventDefault();
  ruedaAcumulada += e.deltaY;
  if (Math.abs(ruedaAcumulada) < 60) return;
  cambiarZoom(ruedaAcumulada < 0 ? vista.zoom * pasoDeZoom : vista.zoom / pasoDeZoom, e.offsetX, e.offsetY);
  ruedaAcumulada = 0;
}

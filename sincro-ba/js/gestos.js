// Vista y gestos. La vista tiene su zoom y su esquina en píxeles del mundo.
// Con Pointer Events, el mouse y los dedos usan el mismo código:
// - un dedo o el botón izquierdo usa la herramienta elegida (tocar o arrastrar);
// - dos dedos hacen zoom y mueven la vista;
// - en la computadora, la rueda hace zoom y el botón derecho o del medio mueve la vista.

const vista = { zoom: 2, x: 0, y: 0 };

const zoomMaximo = 5;
// El zoom cambia de a pasos chicos y multiplicativos: así el salto se siente parejo tanto cerca
// como lejos, y no da el tirón que daba sumar 1.
const pasoDeZoom = 1.25;

// El zoom más lejano es el que hace que el mundo tape la pantalla entera: con menos quedarían
// bordes de fondo vacío alrededor del mapa.
function zoomMinimo() {
  return Math.max(width / anchoMundo, height / altoMundo);
}

function aMundo(x, y) {
  return { x: vista.x + x / vista.zoom, y: vista.y + y / vista.zoom };
}

function limitarVista() {
  const visibleX = width / vista.zoom;
  const visibleY = height / vista.zoom;
  vista.x = visibleX >= anchoMundo ? (anchoMundo - visibleX) / 2 : constrain(vista.x, 0, anchoMundo - visibleX);
  vista.y = visibleY >= altoMundo ? (altoMundo - visibleY) / 2 : constrain(vista.y, 0, altoMundo - visibleY);
}

function centrarVistaEn(x, y) {
  vista.x = x - width / vista.zoom / 2;
  vista.y = y - height / vista.zoom / 2;
  limitarVista();
}

function mostrarZoom() {
  document.getElementById('valorZoom').textContent = `×${vista.zoom.toFixed(1)}`;
}

// Cambia el zoom dejando quieto el punto del mundo que está bajo (x, y) en la pantalla.
function cambiarZoom(nuevo, x, y) {
  const punto = aMundo(x, y);
  vista.zoom = constrain(nuevo, zoomMinimo(), zoomMaximo);
  vista.x = punto.x - x / vista.zoom;
  vista.y = punto.y - y / vista.zoom;
  limitarVista();
  mostrarZoom();
}

const punteros = new Map();
let toque = null;  // el dedo o botón que usa la herramienta: { id, x, y, movido }
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
    // un segundo dedo cancela lo que estaba haciendo el primero, para que el pellizco no dibuje
    toque = null;
    empezarPellizco();
  } else if (punteros.size === 1) {
    toque = { id: e.pointerId, x: e.offsetX, y: e.offsetY, movido: false };
    empezarHerramienta(e.offsetX, e.offsetY);
  }
}

function alMover(e) {
  // sin ningún dedo apoyado, el movimiento solo ilumina la calle que está debajo
  if (!punteros.has(e.pointerId)) {
    if (punteros.size === 0) señalar(e.offsetX, e.offsetY);
    return;
  }
  punteros.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

  if (pellizco && punteros.size === 2) {
    seguirPellizco();
  } else if (arrastre) {
    vista.x -= (e.offsetX - arrastre.x) / vista.zoom;
    vista.y -= (e.offsetY - arrastre.y) / vista.zoom;
    arrastre = { x: e.offsetX, y: e.offsetY };
    limitarVista();
  } else if (toque && toque.id === e.pointerId) {
    // un toque que se movió más de unos píxeles ya es un arrastre
    if (dist(e.offsetX, e.offsetY, toque.x, toque.y) > 8) toque.movido = true;
    moverHerramienta(e.offsetX, e.offsetY);
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

// El punto del mundo que quedó entre los dedos sigue entre los dedos mientras se mueven.
function seguirPellizco() {
  if (!pellizco || pellizco.distancia < 1) return;
  const { medio, distancia } = dedos();
  vista.zoom = constrain(pellizco.zoom * distancia / pellizco.distancia, zoomMinimo(), zoomMaximo);
  vista.x = pellizco.punto.x - medio.x / vista.zoom;
  vista.y = pellizco.punto.y - medio.y / vista.zoom;
  limitarVista();
  mostrarZoom();
}

// Los touchpads mandan muchos eventos chicos: se acumulan hasta sumar un paso de zoom.
function alGirarRueda(e) {
  e.preventDefault();
  ruedaAcumulada += e.deltaY;
  if (Math.abs(ruedaAcumulada) < 60) return;
  cambiarZoom(ruedaAcumulada < 0 ? vista.zoom * pasoDeZoom : vista.zoom / pasoDeZoom, e.offsetX, e.offsetY);
  ruedaAcumulada = 0;
}

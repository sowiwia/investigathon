// Estado del juego, simulación, interfaz y herramientas.

const pasosMaximosPorCuadro = 300;
const tolCumplido = 0.1;

// T lo fija cada escenario y v es la velocidad de marcha de siempre: los dos entran en
// Δ = 2πL/(vT) y se muestran como lectura en vez de dejarlos a mano.
//
// flujoCalle y flujoAvenida son el peso K de base, con la avenida llevando diez veces el flujo de
// la calle, y el deslizador de acople los multiplica por igual. En cuántos ciclos se ordena la red
// lo decide K contra ω = 2π/T: con K/ω ≈ 3 tarda unos pocos ciclos, el orden del paper
// (sec. 5.1: K = 0.5 con ω = 1).
const parametros = {
  T: 90,
  s: 0.5,
  v: 40 / 3.6,
  flujoCalle: 0.02,
  flujoAvenida: 0.2,
  acople: 1,
  deltaCero: false,
};

// El deslizador va en pasos de 2^(1/4), así el acople barre de ×0.25 a ×8 sin que el extremo lento
// quede aplastado contra el borde.
function acopleDeDeslizador(posicion) {
  return Math.pow(2, posicion / 4);
}

let animacion = 10;
let plano = crearPlano();
let redActual = armarRed(plano, parametros);
let fases = [];
let tiempo = 0;
let jugando = true;

let mapa;
let datosDeCalles;
let mundo;
let señalada = null;  // la cuadra que está bajo el dedo
let largoTipico = 0;
let ultimaActualizacion = 0;

const herramientas = [
  { nombre: 'calle', ayuda: 'Calle: tocá o arrastrá sobre una calle para sumarla a la red' },
  { nombre: 'borrar', ayuda: 'Borrar: tocá una cuadra para sacarla de la red' },
];
let herramienta = 'calle';

function preload() {
  mapa = loadImage('assets/mapa_microcentro.png');
  datosDeCalles = loadJSON('assets/calles_microcentro.json');
}

function setup() {
  const lienzo = createCanvas(windowWidth, windowHeight);
  lienzo.parent('lienzo');
  mundo = createGraphics(anchoMundo, altoMundo);
  capaCiudad = createGraphics(anchoMundo, altoMundo);

  cargarCiudad(datosDeCalles);
  const largos = ciudad.calles.map(c => c.largo).sort((a, b) => a - b);
  largoTipico = Math.round(largos[Math.floor(largos.length / 2)]);

  vista.zoom = zoomMinimo;
  centrarVistaEn(640, 360);  // el Obelisco
  mostrarZoom();
  prepararInterfaz();
  escucharGestos(lienzo.elt);
  aplicarEscenario('microcentro');
}

function draw() {
  if (jugando) avanzar(Math.min(deltaTime, 100) / 1000 * animacion);

  dibujarMundo(mundo, mapa, {
    plano, red: redActual, fases, parametros, tol: tolCumplido, señalada, zoom: vista.zoom,
  });
  background(paleta.fondo);
  image(mundo, Math.round(-vista.x * vista.zoom), Math.round(-vista.y * vista.zoom),
    anchoMundo * vista.zoom, altoMundo * vista.zoom);

  if (millis() - ultimaActualizacion > 250) {
    ultimaActualizacion = millis();
    actualizarIndicadores();
  }
}

function windowResized() {
  const centro = aMundo(width / 2, height / 2);
  resizeCanvas(windowWidth, windowHeight);
  vista.zoom = constrain(vista.zoom, zoomMinimo, zoomMaximo);
  centrarVistaEn(centro.x, centro.y);
  mostrarZoom();
}

// Simulación

function avanzar(segundos) {
  const dt = pasoDeIntegracion(parametros);
  const pasos = Math.min(Math.round(segundos / dt), pasosMaximosPorCuadro);
  fases = simular(fases, redActual, vuelta / parametros.T, dt, pasos);
  tiempo += pasos * dt;
}

function rearmarRed() {
  redActual = armarRed(plano, parametros);
  const delta = parametros.deltaCero ? 0 : desfaseObjetivo(largoTipico, parametros.v, parametros.T);
  document.getElementById('valorDelta').textContent = `${delta.toFixed(2)} rad`;
}

function alCambiarElPlano() {
  emparejarFases();
  rearmarRed();
  invalidarCiudad();
}

function mezclarFases() {
  fases = fases.map(() => Math.random() * vuelta);
  reiniciarReloj();
}

function reiniciarReloj() {
  tiempo = 0;
}

// Pone en la red las cuadras del escenario, con su nivel de tránsito y su período.
function aplicarEscenario(clave) {
  const escenario = escenarios[clave];
  plano = crearPlano();
  fases = [];
  autos = [];
  for (const cuadra of escenario.armar()) agregarCalle(plano, cuadra);
  parametros.T = escenario.T;
  document.getElementById('valorT').textContent = `${escenario.T} s`;
  alCambiarElPlano();
  mezclarFases();
  for (const boton of document.querySelectorAll('#escenarios .boton')) {
    boton.classList.toggle('activo', boton.dataset.escenario === clave);
  }
}

function actualizarIndicadores() {
  document.getElementById('valorV').textContent = potencial(fases, redActual).toFixed(2);
  document.getElementById('valorTiempo').textContent = `${Math.floor(tiempo)} s`;
}

// Herramientas. Reciben posiciones de la pantalla; gestos.js decide si fue un toque o un arrastre.

// Radio para acertar con el dedo: unos 20 px de pantalla.
function radioDeToque() {
  return Math.max(6, 20 / vista.zoom);
}

// Qué cuadra está bajo el dedo, para iluminarla antes de tocar.
function señalar(x, y) {
  const p = aMundo(x, y);
  señalada = calleCercana(p.x, p.y, radioDeToque());
  mostrarNombre();
}

function mostrarNombre() {
  const cartel = document.getElementById('nombreHerramienta');
  if (señalada) {
    const nombre = señalada.nombre || 'Calle sin nombre';
    cartel.textContent = `${nombre} · ${Math.round(señalada.largo)} m`;
    cartel.classList.add('senalando');
  } else {
    cartel.textContent = herramientas.find(h => h.nombre === herramienta).ayuda;
    cartel.classList.remove('senalando');
  }
}

function empezarHerramienta(x, y) {
  señalar(x, y);
  if (herramienta === 'calle' && señalada) {
    agregarCalle(plano, señalada);
    alCambiarElPlano();
  }
}

// Con la herramienta Calle, arrastrar el dedo va sumando a la red todas las cuadras que toca.
function moverHerramienta(x, y) {
  señalar(x, y);
  if (herramienta !== 'calle' || !señalada) return;
  if (agregarCalle(plano, señalada)) alCambiarElPlano();
}

function tocar(x, y) {
  señalar(x, y);
  if (!señalada) return;
  if (herramienta === 'calle') {
    agregarCalle(plano, señalada);
    alCambiarElPlano();
    return;
  }
  const calle = buscarCalle(plano, señalada);
  if (!calle) return;
  if (herramienta === 'borrar') quitarCalleYFases(calle);
  alCambiarElPlano();
}

// Al sacar una cuadra pueden quedar esquinas sueltas: las fases las siguen.
function quitarCalleYFases(calle) {
  const antes = plano.esquinas.map(e => e.ciudad);
  quitarCalle(plano, calle);
  const quedan = new Set(plano.esquinas.map(e => e.ciudad));
  fases = fases.filter((fase, i) => quedan.has(antes[i]));
}

// Cada esquina nueva arranca con una fase al azar.
function emparejarFases() {
  while (fases.length < plano.esquinas.length) fases.push(Math.random() * vuelta);
  fases.length = plano.esquinas.length;
}

// Interfaz

function prepararInterfaz() {
  const barra = document.getElementById('barra');
  herramientas.forEach((h, i) => {
    const ranura = document.createElement('button');
    ranura.className = 'ranura';
    ranura.id = `herramienta-${h.nombre}`;
    ranura.setAttribute('aria-label', h.ayuda);
    ranura.innerHTML = `<span class="tecla">${i + 1}</span>`;
    const icono = document.createElement('canvas');
    icono.width = 9;
    icono.height = 9;
    pintarIcono(icono, iconos[h.nombre]);
    ranura.appendChild(icono);
    ranura.addEventListener('click', () => elegirHerramienta(h.nombre));
    barra.appendChild(ranura);
  });
  elegirHerramienta(herramienta);

  document.getElementById('deslizadorAnimacion').addEventListener('input', e => {
    animacion = Number(e.target.value);
    document.getElementById('valorAnimacion').textContent = `×${animacion}`;
  });
  document.getElementById('deslizadorAcople').addEventListener('input', e => {
    parametros.acople = acopleDeDeslizador(Number(e.target.value));
    mostrarAcople();
    rearmarRed();
    reiniciarReloj();
  });
  document.getElementById('botonDeltaCero').addEventListener('click', e => {
    parametros.deltaCero = !parametros.deltaCero;
    e.currentTarget.classList.toggle('activo', parametros.deltaCero);
    rearmarRed();
    reiniciarReloj();
  });
  document.getElementById('botonMezclar').addEventListener('click', mezclarFases);

  const lista = document.getElementById('escenarios');
  for (const [clave, escenario] of Object.entries(escenarios)) {
    const boton = document.createElement('button');
    boton.className = 'boton';
    boton.dataset.escenario = clave;
    boton.textContent = escenario.nombre;
    boton.title = escenario.ayuda;
    boton.addEventListener('click', () => aplicarEscenario(clave));
    lista.appendChild(boton);
  }
  document.getElementById('masZoom').addEventListener('click', () => cambiarZoom(vista.zoom + 1, width / 2, height / 2));
  document.getElementById('menosZoom').addEventListener('click', () => cambiarZoom(vista.zoom - 1, width / 2, height / 2));
  mostrarAcople();
  rearmarRed();
}

function mostrarAcople() {
  const m = parametros.acople;
  document.getElementById('valorAcople').textContent = `×${m < 1 ? m.toFixed(2) : m.toFixed(1)}`;
}

function elegirHerramienta(nombre) {
  herramienta = nombre;
  for (const h of herramientas) {
    document.getElementById(`herramienta-${h.nombre}`).classList.toggle('elegida', h.nombre === nombre);
  }
  mostrarNombre();
}

function keyPressed() {
  const numero = Number(key);
  if (numero >= 1 && numero <= herramientas.length) elegirHerramienta(herramientas[numero - 1].nombre);
}

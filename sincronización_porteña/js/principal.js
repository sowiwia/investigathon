// Estado del juego, simulación, interfaz y herramientas.

const pasosMaximosPorCuadro = 300;
// Los autos se mueven en tramos cortos en vez de todos los segundos del cuadro de una vez: con la
// animación rápida, o si el teléfono baja los cuadros por segundo, un solo salto saldría más largo
// que la distancia entre autos y se vería a saltos.
const segundosPorTramoDeAutos = 0.25;
const tolCumplido = 0.1;
// Error de fase que se tolera para dar la red por equilibrada, medido contra el acople
// (ver escalaDeAcople en modelo.js).
const tolEquilibrio = 0.005;

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
  transito: 'medio',
  flujoCalle: 0.02,
  flujoAvenida: 0.2,
  acople: 1,
  autosPorSegundo: nivelesDeTransito.medio.autosPorSegundo,
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
let autos = [];
let tiempo = 0;
let verdes = [];  // qué luz tenía cada semáforo en el cuadro anterior, para oír cuándo cambian
let sincronizoEn = null;  // cuánto tardó la red en llegar al equilibrio, en segundos simulados
let jugando = false;
let entrada = null;  // la cámara acercándose al Obelisco mientras se va la pantalla de inicio

let mapa;
let datosDeCalles;
let mundo;
let señalada = null;  // la cuadra que está bajo el dedo
let largoTipico = 0;
let ultimaActualizacion = 0;

const herramientas = [
  { nombre: 'calle', ayuda: 'Calle: tocá o arrastrá sobre una calle para sumarla a la red' },
  { nombre: 'borrar', ayuda: 'Borrar: tocá una cuadra para sacarla de la red' },
  { nombre: 'graficar', ayuda: 'Graficar: tocá una cuadra para seguir su desfase' },
];
let herramienta = 'calle';

function preload() {
  mapa = loadImage('assets/mapa_microcentro.png');
  datosDeCalles = loadJSON('assets/calles_microcentro.json');
}

function setup() {
  pixelDensity(1);
  const lienzo = createCanvas(windowWidth, windowHeight);
  lienzo.parent('lienzo');
  noSmooth();
  mundo = createGraphics(anchoMundo, altoMundo);
  mundo.pixelDensity(1);
  mundo.noSmooth();
  capaCiudad = createGraphics(anchoMundo, altoMundo);
  capaCiudad.pixelDensity(1);
  capaCiudad.noSmooth();

  cargarCiudad(datosDeCalles);
  const largos = ciudad.calles.map(c => c.largo).sort((a, b) => a - b);
  largoTipico = Math.round(largos[Math.floor(largos.length / 2)]);

  vista.zoom = zoomMinimo();
  centrarVistaEn(640, 360);  // el Obelisco
  mostrarZoom();
  prepararInterfaz();
  crearGraficos();
  escucharGestos(lienzo.elt);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => windowResized());
  aplicarEscenario('microcentro');
}

function draw() {
  if (entrada) avanzarEntrada();
  if (jugando) avanzar(Math.min(deltaTime, 100) / 1000 * animacion);

  dibujarMundo(mundo, mapa, {
    plano, red: redActual, fases, parametros, autos, elegidas: callesElegidas(),
    tol: tolCumplido, señalada, zoom: vista.zoom,
  });
  background(paleta.fondo);
  image(mundo, Math.round(-vista.x * vista.zoom), Math.round(-vista.y * vista.zoom),
    anchoMundo * vista.zoom, altoMundo * vista.zoom);

  dibujarRueda(plano, redActual, fases, tolCumplido);

  if (millis() - ultimaActualizacion > 250) {
    ultimaActualizacion = millis();
    actualizarIndicadores();
    actualizarGraficos();
  }
  animarSemaforoDeInicio();
}

function windowResized() {
  const centro = aMundo(width / 2, height / 2);
  resizeCanvas(windowWidth, windowHeight);
  vista.zoom = constrain(vista.zoom, zoomMinimo(), zoomMaximo);
  centrarVistaEn(centro.x, centro.y);
  mostrarZoom();
}

// Simulación

function avanzar(segundos) {
  const dt = pasoDeIntegracion(parametros);
  const pasos = Math.min(Math.round(segundos / dt), pasosMaximosPorCuadro);
  const tramos = Math.max(1, Math.ceil(pasos * dt / segundosPorTramoDeAutos));
  const pasosPorTramo = Math.floor(pasos / tramos);
  for (let k = 0; k < tramos; k++) {
    fases = simular(fases, redActual, vuelta / parametros.T, dt, pasosPorTramo);
    autos = moverAutos(autos, plano, fases, parametros, pasosPorTramo * dt);
  }
  tiempo += tramos * pasosPorTramo * dt;
  registrarMuestra(tiempo, redActual, fases);
  sonarCambiosDeSemaforos();
}

// Junta en un solo golpecito los semáforos que cambiaron de luz en el cuadro.
function sonarCambiosDeSemaforos() {
  if (verdes.length !== fases.length) verdes = new Array(fases.length).fill(null);
  let cambios = 0;
  for (let i = 0; i < fases.length; i++) {
    const verde = verdeEnPrincipal(fases[i], parametros.s);
    if (verdes[i] !== null && verdes[i] !== verde) cambios++;
    verdes[i] = verde;
  }
  if (cambios > 0) sonarSemaforos(cambios, fases.length, ordenDeLaRed(plano, redActual, fases).orden);
}

function rearmarRed() {
  redActual = armarRed(plano, parametros);
  const delta = parametros.deltaCero ? 0 : desfaseObjetivo(largoTipico, parametros.v, parametros.T);
  document.getElementById('valorDelta').textContent = `${delta.toFixed(2)} rad`;
}

function alCambiarElPlano() {
  emparejarFases();
  rearmarRed();
  limpiarSeries(plano);
  invalidarCiudad();
  sincronizoEn = null;
}

function mezclarFases() {
  fases = fases.map(() => Math.random() * vuelta);
  reiniciarReloj();
}

// El cronómetro de sincronización arranca de nuevo cada vez que cambia algo que mueve el equilibrio.
function reiniciarReloj() {
  tiempo = 0;
  sincronizoEn = null;
  reiniciarMuestras();
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
  elegirTransito(escenario.transito);
  alCambiarElPlano();
  mezclarFases();
  for (const boton of document.querySelectorAll('#escenarios .boton')) {
    boton.classList.toggle('activo', boton.dataset.escenario === clave);
  }
}

// Solo cambia cuántos autitos se ven: no toca el modelo, así que no rearma la red ni reinicia el
// cronómetro de sincronización.
function elegirTransito(clave) {
  parametros.transito = clave;
  parametros.autosPorSegundo = nivelesDeTransito[clave].autosPorSegundo;
  for (const boton of document.querySelectorAll('#niveles .boton')) {
    boton.classList.toggle('activo', boton.dataset.nivel === clave);
  }
}

function actualizarIndicadores() {
  const hayEsquinas = plano.esquinas.length > 0;

  document.getElementById('valorV').textContent = potencial(fases, redActual).toFixed(2);
  document.getElementById('valorTiempo').textContent = `${Math.floor(tiempo)} s`;

  const estado = document.getElementById('estado');
  const enEquilibrio = hayEsquinas &&
    convergio(fases, redActual, vuelta / parametros.T, tolEquilibrio * escalaDeAcople(redActual));
  if (enEquilibrio && sincronizoEn === null) {
    sincronizoEn = tiempo;
    marcarSincronizacion(tiempo);
    sonarSincronizacion();
  }
  document.getElementById('valorSincro').textContent = sincronizoEn === null
    ? '–'
    : `${Math.round(sincronizoEn)} s · ${(sincronizoEn / parametros.T).toFixed(1)} ciclos`;
  estado.textContent = !hayEsquinas ? 'Sin semáforos' : enEquilibrio ? 'En equilibrio' : 'Ordenándose';
  estado.classList.toggle('equilibrio', enEquilibrio);
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
    if (agregarCalle(plano, señalada)) sonarCalle();
    alCambiarElPlano();
  }
}

// Con la herramienta Calle, arrastrar el dedo va sumando a la red todas las cuadras que toca.
function moverHerramienta(x, y) {
  señalar(x, y);
  if (herramienta !== 'calle' || !señalada) return;
  if (agregarCalle(plano, señalada)) {
    sonarCalle();
    alCambiarElPlano();
  }
}

function tocar(x, y) {
  señalar(x, y);
  if (!señalada) return;
  if (herramienta === 'calle') {
    if (agregarCalle(plano, señalada)) sonarCalle();
    alCambiarElPlano();
    return;
  }
  const calle = buscarCalle(plano, señalada);
  if (!calle) return;
  if (herramienta === 'borrar') {
    quitarCalleYFases(calle);
    sonarBorrar();
  }
  if (herramienta === 'graficar') sonarGraficar(alternarSerie(calle));
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
  document.getElementById('botonMezclar').addEventListener('click', () => {
    mezclarFases();
    sonarMezclar();
  });

  const niveles = document.getElementById('niveles');
  for (const [clave, nivel] of Object.entries(nivelesDeTransito)) {
    const boton = document.createElement('button');
    boton.className = 'boton';
    boton.dataset.nivel = clave;
    boton.textContent = nivel.nombre.replace('Tránsito ', '');
    boton.title = nivel.nombre;
    boton.addEventListener('click', () => elegirTransito(clave));
    niveles.appendChild(boton);
  }

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
  document.getElementById('botonEmpezar').addEventListener('click', empezar);

  prepararBotonDeInterfaz();
  pintarIcono(document.getElementById('iconoGirar'), iconoGirar);
  prepararSonido();
  mostrarAcople();
  rearmarRed();
}

// El botón de la esquina esconde los paneles de los costados para mirar el mapa sin tapar nada.
// La barra de herramientas del centro y el cartel de abajo quedan siempre.
function prepararBotonDeInterfaz() {
  const boton = document.getElementById('botonInterfaz');
  const icono = document.createElement('canvas');
  icono.width = 9;
  icono.height = 9;
  pintarIcono(icono, iconos.paneles);
  boton.appendChild(icono);
  boton.addEventListener('click', () => {
    const sinPaneles = document.body.classList.toggle('sinPaneles');
    boton.classList.toggle('activo', sinPaneles);
    boton.setAttribute('aria-label', sinPaneles ? 'Mostrar los paneles' : 'Ocultar los paneles');
    sonarHerramienta();
  });
}

function mostrarAcople() {
  const m = parametros.acople;
  document.getElementById('valorAcople').textContent = `×${m < 1 ? m.toFixed(2) : m.toFixed(1)}`;
}

function elegirHerramienta(nombre) {
  herramienta = nombre;
  if (jugando) sonarHerramienta();
  for (const h of herramientas) {
    document.getElementById(`herramienta-${h.nombre}`).classList.toggle('elegida', h.nombre === nombre);
  }
  mostrarNombre();
}

function keyPressed() {
  const numero = Number(key);
  if (numero >= 1 && numero <= herramientas.length) elegirHerramienta(herramientas[numero - 1].nombre);
}

// Paso del inicio al juego: la pantalla de inicio se desvanece, la cámara se acerca al Obelisco y
// la interfaz aparece atrás, en vez de aparecer todo de golpe.
const duracionEntrada = 900;  // ms, igual que la transición de #inicio en el CSS
const acercamientoDeEntrada = 1.8;

function empezar() {
  if (jugando) return;
  const inicio = document.getElementById('inicio');
  inicio.classList.add('saliendo');
  inicio.addEventListener('transitionend', () => inicio.classList.add('oculto'), { once: true });
  document.body.classList.add('enJuego');
  entrada = {
    comenzo: millis(),
    desde: vista.zoom,
    hasta: constrain(vista.zoom * acercamientoDeEntrada, zoomMinimo(), zoomMaximo),
  };
  jugando = true;
  sonarInicio();
}

function avanzarEntrada() {
  const t = Math.min((millis() - entrada.comenzo) / duracionEntrada, 1);
  const suave = 1 - Math.pow(1 - t, 3);  // arranca rápido y frena al final
  vista.zoom = entrada.desde + (entrada.hasta - entrada.desde) * suave;
  centrarVistaEn(640, 360);  // el Obelisco
  mostrarZoom();
  if (t === 1) {
    entrada = null;
    document.body.classList.add('listo');
  }
}

// El semáforo del dibujo del inicio alterna con el mismo ciclo que los del mapa.
function animarSemaforoDeInicio() {
  if (document.getElementById('inicio').classList.contains('oculto')) return;
  const fase = mod2pi(millis() / 1000 * animacion * vuelta / parametros.T);
  const verde = verdeEnPrincipal(fase, parametros.s);
  document.getElementById('luzVerde').classList.toggle('prendida', verde);
  document.getElementById('luzRoja').classList.toggle('prendida', !verde);
}

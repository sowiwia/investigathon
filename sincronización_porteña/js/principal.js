// Estado del juego, simulación, interfaz y herramientas.

const pasosMaximosPorCuadro = 300;
// Un segundo y medio simulado por segundo real: los autos se pueden seguir con la vista y un ciclo
// de semáforo de 90 s tarda un minuto en pantalla.
const escalaDeTiempo = 1.5;
// Los autos se mueven en tramos cortos en vez de todos los segundos del cuadro de una vez: con la
// escala acelerada, o si el teléfono baja los cuadros por segundo, un solo salto saldría más largo
// que la distancia entre autos y se vería a saltos.
const segundosPorTramoDeAutos = 0.25;
const tolCumplido = 0.1;

// T lo fija cada escenario y v es la velocidad de marcha de siempre: los dos entran en
// Δ = 2πL/(vT) y se muestran como lectura en vez de dejarlos a mano.
//
// flujoCalle y flujoAvenida son el peso K de base, con la avenida llevando diez veces el flujo de
// la calle, y el deslizador de acople los multiplica por igual. En cuántos ciclos se ordena la red
// lo decide K contra ω = 2π/T: cuanto más grande, más rápido. Estos valores están pensados para el
// juego: con K en ×1 la red se ordena en unos segundos y con ×8, casi al instante.
const parametros = {
  T: 90,
  s: 0.5,
  v: 40 / 3.6,
  transito: 'medio',
  flujoCalle: 0.5,
  flujoAvenida: 5,
  acople: 1,
  autosPorSegundo: nivelesDeTransito.medio.autosPorSegundo,
};

// El deslizador va en pasos de 2^(1/4), así el acople barre de ×0.25 a ×8 sin que el extremo lento
// quede aplastado contra el borde.
function acopleDeDeslizador(posicion) {
  return Math.pow(2, posicion / 4);
}

let plano = crearPlano();
let redActual = armarRed(plano, parametros);
let fases = [];
let autos = [];
let tiempo = 0;
let sincronizoEn = null;  // cuánto tardó la red en tener todas sus calles azules
let jugando = false;
let entrada = null;  // la cámara acercándose al Obelisco mientras se va la pantalla de inicio

let mapa;
let datosDeCalles;
let mundo;
let señalada = null;  // la cuadra que está bajo el dedo
let ultimaActualizacionIndicadores = 0;
let ultimaActualizacionGraficos = 0;

// En el celular, windowHeight a veces incluye la barra del navegador. visualViewport da el alto
// que realmente se ve, así el canvas no queda cortado ni deja una franja vacía.
function anchoDePantalla() {
  return Math.round((window.visualViewport && window.visualViewport.width) || windowWidth);
}

function altoDePantalla() {
  return Math.round((window.visualViewport && window.visualViewport.height) || windowHeight);
}

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
  const lienzo = createCanvas(anchoDePantalla(), altoDePantalla());
  lienzo.parent('lienzo');
  noSmooth();
  mundo = createGraphics(anchoMundo, altoMundo);
  mundo.pixelDensity(1);
  mundo.noSmooth();
  capaCiudad = createGraphics(anchoMundo, altoMundo);
  capaCiudad.pixelDensity(1);
  capaCiudad.noSmooth();

  cargarCiudad(datosDeCalles);

  vista.zoom = zoomMinimo();
  centrarVistaEn(640, 360);  // el Obelisco
  mostrarZoom();
  prepararInterfaz();
  crearGraficos();
  prepararPaneles();
  escucharGestos(lienzo.elt);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => windowResized());
  window.addEventListener('orientationchange', () => setTimeout(windowResized, 120));
  aplicarEscenario('microcentro');
}

function draw() {
  if (entrada) avanzarEntrada();
  if (jugando) avanzar(Math.min(deltaTime, 100) / 1000 * escalaDeTiempo);
  detectarSincronizacion();

  dibujarMundo(mundo, mapa, {
    plano, red: redActual, fases, parametros, autos, elegidas: callesElegidas(),
    tol: tolCumplido, señalada, zoom: vista.zoom,
  });
  background(paleta.fondo);
  image(mundo, Math.round(-vista.x * vista.zoom), Math.round(-vista.y * vista.zoom),
    anchoMundo * vista.zoom, altoMundo * vista.zoom);

  dibujarRueda(plano, redActual, fases, tolCumplido);

  if (millis() - ultimaActualizacionIndicadores > 250) {
    ultimaActualizacionIndicadores = millis();
    actualizarIndicadores();
  }
  if (millis() - ultimaActualizacionGraficos > 80 && graficosVisibles()) {
    ultimaActualizacionGraficos = millis();
    actualizarGraficos();
  }
  animarSemaforoDeInicio();
}

function windowResized() {
  const centro = aMundo(width / 2, height / 2);
  resizeCanvas(anchoDePantalla(), altoDePantalla());
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
}

function largoTipicoDe(plano) {
  const largos = plano.calles.map(calle => calle.cuadra.largo).sort((a, b) => a - b);
  return largos.length ? largos[Math.floor(largos.length / 2)] : 0;
}

function rearmarRed() {
  redActual = armarRed(plano, parametros);
  const largo = largoTipicoDe(plano);
  document.getElementById('valorDelta').textContent = largo
    ? `${desfaseObjetivo(largo, parametros.v, parametros.T).toFixed(2)} rad`
    : '–';
  // Cambiar K mueve el equilibrio: la red tiene que volver a sincronizarse.
  sincronizoEn = null;
}

function alCambiarElPlano() {
  emparejarFases();
  rearmarRed();
  limpiarSeries(plano);
  sembrarAutosFaltantes();
  invalidarCiudad();
}

// Las entradas nuevas arrancan con un auto de muestra: así no hay que esperar al próximo nacimiento
// aleatorio para ver que la red quedó con tránsito. En un circuito cerrado, sin entradas, se siembran
// las cuadras para que no quede vacío.
function sembrarAutosFaltantes() {
  const hayEntradas = plano.calles.some(calle => [true, false].some(haciaB =>
    hayFlujo(calle, haciaB) && esEntradaDeRed(plano, calle, haciaB)));
  for (const calle of plano.calles) {
    if (!autos.some(auto => auto.calle === calle)) {
      sembrarAutosEnCalle(autos, plano, calle, Math.random, !hayEntradas);
    }
  }
}

function mezclarFases() {
  fases = fases.map(() => Math.random() * vuelta);
  reiniciarReloj();
}

// Saca todas las cuadras de la red y deja el tablero limpio.
function vaciarRed() {
  plano = crearPlano();
  fases = [];
  autos = [];
  señalada = null;
  alCambiarElPlano();
  reiniciarReloj();
  mostrarNombre();
  sonarBorrar();
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
    const activo = boton.dataset.escenario === clave;
    boton.classList.toggle('activo', activo);
    boton.setAttribute('aria-pressed', String(activo));
  }
}

// Solo cambia cuántos autitos se ven: no toca el modelo, así que no rearma la red ni reinicia el
// cronómetro de sincronización.
function elegirTransito(clave) {
  parametros.transito = clave;
  parametros.autosPorSegundo = nivelesDeTransito[clave].autosPorSegundo;
  for (const boton of document.querySelectorAll('#niveles .boton')) {
    const activo = boton.dataset.nivel === clave;
    boton.classList.toggle('activo', activo);
    boton.setAttribute('aria-pressed', String(activo));
  }
}

function actualizarIndicadores() {
  const hayCalles = plano.calles.length > 0;

  document.getElementById('valorV').textContent = potencial(fases, redActual).toFixed(2);
  document.getElementById('valorTiempo').textContent = `${Math.floor(tiempo)} s`;

  const estado = document.getElementById('estado');
  const sincronizada = redCumplida(plano, redActual, fases, tolCumplido);
  document.getElementById('valorSincro').textContent = sincronizoEn === null
    ? '–'
    : `${Math.round(sincronizoEn)} s · ${(sincronizoEn / parametros.T).toFixed(1)} ciclos`;
  estado.textContent = !hayCalles ? 'Sin semáforos' : sincronizada ? 'Sincronizado' : 'Sin sincronizar';
  estado.classList.toggle('sincronizado', sincronizada);
}

// Se comprueba en cada cuadro, igual que el color de las calles, para que el tiempo y el acorde
// coincidan con el instante en que la última cuadra pasa a azul.
function detectarSincronizacion() {
  if (!jugando || sincronizoEn !== null || !redCumplida(plano, redActual, fases, tolCumplido)) return;
  sincronizoEn = tiempo;
  marcarSincronizacion(tiempo);
  sonarSincronizacion();
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
    ranura.type = 'button';
    ranura.className = 'ranura';
    ranura.id = `herramienta-${h.nombre}`;
    ranura.setAttribute('aria-label', h.ayuda);
    ranura.setAttribute('aria-pressed', 'false');
    ranura.innerHTML = `<span class="tecla">${i + 1}</span>`;
    const icono = document.createElement('canvas');
    icono.width = 9;
    icono.height = 9;
    pintarIcono(icono, iconos[h.nombre]);
    ranura.appendChild(icono);
    ranura.addEventListener('click', () => elegirHerramienta(h.nombre));
    barra.appendChild(ranura);
  });

  const vaciar = document.createElement('button');
  vaciar.type = 'button';
  vaciar.className = 'ranura';
  vaciar.id = 'botonVaciar';
  vaciar.setAttribute('aria-label', 'Vaciar toda la red');
  vaciar.title = 'Vaciar toda la red';
  const iconoVaciar = document.createElement('canvas');
  iconoVaciar.width = 9;
  iconoVaciar.height = 9;
  pintarIcono(iconoVaciar, iconos.vaciar);
  vaciar.appendChild(iconoVaciar);
  vaciar.addEventListener('click', vaciarRed);
  barra.appendChild(vaciar);

  elegirHerramienta(herramienta);

  document.getElementById('deslizadorAcople').addEventListener('input', e => {
    parametros.acople = acopleDeDeslizador(Number(e.target.value));
    mostrarAcople();
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
    boton.type = 'button';
    boton.className = 'boton';
    boton.dataset.nivel = clave;
    boton.setAttribute('aria-pressed', 'false');
    const nombre = nivel.nombre.replace('Tránsito ', '');
    boton.textContent = nombre[0].toUpperCase() + nombre.slice(1);
    boton.title = nivel.nombre;
    boton.addEventListener('click', () => elegirTransito(clave));
    niveles.appendChild(boton);
  }

  const lista = document.getElementById('escenarios');
  for (const [clave, escenario] of Object.entries(escenarios)) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton';
    boton.dataset.escenario = clave;
    boton.setAttribute('aria-pressed', 'false');
    boton.textContent = escenario.nombre;
    boton.title = escenario.ayuda;
    boton.addEventListener('click', () => aplicarEscenario(clave));
    lista.appendChild(boton);
  }
  document.getElementById('masZoom').addEventListener('click', () => cambiarZoom(vista.zoom * pasoDeZoom, width / 2, height / 2));
  document.getElementById('menosZoom').addEventListener('click', () => cambiarZoom(vista.zoom / pasoDeZoom, width / 2, height / 2));
  document.getElementById('botonEmpezar').addEventListener('click', empezar);

  prepararBotonDeInterfaz();
  prepararSonido();
  mostrarAcople();
  rearmarRed();
}

// Cada ventana se puede plegar por separado. En pantallas chicas (celular vertical u horizontal)
// se inicia con las dos cerradas y, al abrir una, se cierra la otra para que el mapa no quede
// cubierto por dos capas.
function prepararPaneles() {
  const paneles = [...document.querySelectorAll('.panelVentana')];
  const pantallaChica = window.matchMedia('(max-width: 700px), (max-height: 500px)');

  function mostrarPanel(panel, abierto) {
    panel.classList.toggle('cerrada', !abierto);
    const boton = panel.querySelector('.panelCabecera');
    boton.setAttribute('aria-expanded', String(abierto));
    boton.querySelector('.marcaPanel').textContent = abierto ? '−' : '+';
  }

  for (const panel of paneles) {
    mostrarPanel(panel, !pantallaChica.matches);
    panel.querySelector('.panelCabecera').addEventListener('click', () => {
      const abrir = panel.classList.contains('cerrada');
      if (abrir && pantallaChica.matches) {
        for (const otro of paneles) if (otro !== panel) mostrarPanel(otro, false);
      }
      mostrarPanel(panel, abrir);
      if (abrir && panel.id === 'panelGraficos') {
        graficoV.resize();
        graficoDesfases.resize();
        actualizarGraficos();
      }
      if (abrir) {
        document.body.classList.remove('sinPaneles');
        const botonInterfaz = document.getElementById('botonInterfaz');
        botonInterfaz.classList.remove('activo');
        botonInterfaz.setAttribute('aria-pressed', 'false');
        botonInterfaz.setAttribute('aria-label', 'Ocultar los paneles');
      }
      sonarHerramienta();
    });
  }

  pantallaChica.addEventListener('change', e => {
    for (const panel of paneles) mostrarPanel(panel, !e.matches);
  });
}

// El botón de la esquina esconde los paneles de los costados para mirar el mapa sin tapar nada.
// La barra de herramientas del centro y el cartel de abajo quedan siempre.
function prepararBotonDeInterfaz() {
  const boton = document.getElementById('botonInterfaz');
  boton.type = 'button';
  boton.setAttribute('aria-pressed', 'false');
  const icono = document.createElement('canvas');
  icono.width = 9;
  icono.height = 9;
  pintarIcono(icono, iconos.paneles);
  boton.appendChild(icono);
  boton.addEventListener('click', () => {
    const sinPaneles = document.body.classList.toggle('sinPaneles');
    boton.classList.toggle('activo', sinPaneles);
    boton.setAttribute('aria-pressed', String(sinPaneles));
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
    const boton = document.getElementById(`herramienta-${h.nombre}`);
    const activa = h.nombre === nombre;
    boton.classList.toggle('elegida', activa);
    boton.setAttribute('aria-pressed', String(activa));
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
  const ocultarInicio = () => inicio.classList.add('oculto');
  inicio.addEventListener('transitionend', ocultarInicio, { once: true });
  setTimeout(ocultarInicio, duracionEntrada + 200);
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
  const fase = mod2pi(millis() / 1000 * escalaDeTiempo * vuelta / parametros.T);
  const verde = verdeEnPrincipal(fase, parametros.s);
  document.getElementById('luzVerde').classList.toggle('prendida', verde);
  document.getElementById('luzRoja').classList.toggle('prendida', !verde);
}

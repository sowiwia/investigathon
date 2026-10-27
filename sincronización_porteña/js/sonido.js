// Sonidos de la interfaz, sintetizados con Web Audio: no hay archivos de audio que cargar.
//
// La idea es un eco del tango: bandoneón (varias ondas diente de sierra desafinadas entre sí y
// filtradas) y cuerda pulsada (triángulo con el filtro cerrándose), sobre una pentatónica menor de
// La. Cualquier combinación de esas notas suena bien junta, así que la red puede disparar muchas
// seguidas sin que choquen.
//
// Para que no moleste: todo entra por un volumen general bajo y un compresor, cada efecto tiene un
// mínimo de tiempo entre repeticiones, hay un tope de voces a la vez y el sonido se puede apagar.

const volumenGeneral = 0.5;
const vocesMaximas = 18;

// Pentatónica menor de La, en hercios. La escala sube casi dos octavas: alcanza para que agregar
// cuadras suba de a una nota sin irse a un agudo molesto.
const escala = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];

const sonido = {
  contexto: null,
  maestro: null,
  eco: null,
  encendido: localStorage.getItem('sonido') !== 'no',
  voces: 0,
  ultimaVez: {},    // por efecto, el millis del navegador en que sonó
  notaDeCalle: 0,   // en qué escalón de la escala va la cadena de calles agregadas
};

// El navegador deja arrancar el audio recién con un gesto de la persona, así que el contexto se
// crea en el primer toque y no al cargar la página.
function prepararAudio() {
  if (sonido.contexto) {
    if (sonido.contexto.state === 'suspended') sonido.contexto.resume();
    return sonido.contexto;
  }
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return null;
  const ctx = new Contexto();

  const maestro = ctx.createGain();
  maestro.gain.value = volumenGeneral;
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -18;
  compresor.ratio.value = 8;
  compresor.release.value = 0.25;
  maestro.connect(compresor);
  compresor.connect(ctx.destination);

  // Eco corto con devolución: da el aire de sala sin cargar un impulso de reverberación.
  const eco = ctx.createDelay(1);
  eco.delayTime.value = 0.17;
  const devolucion = ctx.createGain();
  devolucion.gain.value = 0.26;
  const vueltaDelEco = ctx.createGain();
  vueltaDelEco.gain.value = 0.22;
  const apagaAgudos = ctx.createBiquadFilter();
  apagaAgudos.type = 'lowpass';
  apagaAgudos.frequency.value = 2200;
  eco.connect(devolucion);
  devolucion.connect(eco);
  eco.connect(apagaAgudos);
  apagaAgudos.connect(vueltaDelEco);
  vueltaDelEco.connect(maestro);

  sonido.contexto = ctx;
  sonido.maestro = maestro;
  sonido.eco = eco;
  return ctx;
}

// Deja pasar un efecto solo si ya pasó su espera y si no hay demasiadas voces sonando.
function puedeSonar(efecto, esperaMs) {
  if (!sonido.encendido) return false;
  if (!prepararAudio()) return false;
  if (sonido.voces >= vocesMaximas) return false;
  const ahora = performance.now();
  if (ahora - (sonido.ultimaVez[efecto] || -Infinity) < esperaMs) return false;
  sonido.ultimaVez[efecto] = ahora;
  return true;
}

// Una voz: oscilador, filtro y una envolvente de ataque y caída. Se apaga sola.
function tocarNota(frecuencia, opciones = {}) {
  const ctx = sonido.contexto;
  const {
    tipo = 'triangle',
    volumen = 0.2,
    ataque = 0.005,
    caida = 0.3,
    filtro = 2600,
    filtroFinal = filtro,
    desafine = 0,
    demora = 0,
    eco = 0.25,
  } = opciones;

  const t = ctx.currentTime + demora;
  const osc = ctx.createOscillator();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frecuencia, t);
  if (opciones.frecuenciaFinal) {
    osc.frequency.exponentialRampToValueAtTime(opciones.frecuenciaFinal, t + ataque + caida);
  }
  osc.detune.value = desafine;

  const paso = ctx.createBiquadFilter();
  paso.type = 'lowpass';
  paso.Q.value = 1;
  paso.frequency.setValueAtTime(filtro, t);
  paso.frequency.exponentialRampToValueAtTime(Math.max(120, filtroFinal), t + ataque + caida);

  const sobre = ctx.createGain();
  sobre.gain.setValueAtTime(0.0001, t);
  sobre.gain.exponentialRampToValueAtTime(volumen, t + ataque);
  sobre.gain.exponentialRampToValueAtTime(0.0001, t + ataque + caida);

  osc.connect(paso);
  paso.connect(sobre);
  sobre.connect(sonido.maestro);
  if (eco > 0) {
    const envio = ctx.createGain();
    envio.gain.value = eco;
    sobre.connect(envio);
    envio.connect(sonido.eco);
  }

  sonido.voces++;
  osc.onended = () => { sonido.voces--; };
  osc.start(t);
  osc.stop(t + ataque + caida + 0.05);
}

// Ruido corto y filtrado, para los golpecitos de la interfaz.
function tocarRoce(opciones = {}) {
  const ctx = sonido.contexto;
  const { volumen = 0.12, caida = 0.08, filtro = 1800, tipo = 'bandpass' } = opciones;
  const t = ctx.currentTime;
  const largo = Math.ceil(ctx.sampleRate * (caida + 0.02));
  const buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < largo; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / largo);

  const fuente = ctx.createBufferSource();
  fuente.buffer = buffer;
  const paso = ctx.createBiquadFilter();
  paso.type = tipo;
  paso.frequency.value = filtro;
  paso.Q.value = 0.8;
  const sobre = ctx.createGain();
  sobre.gain.setValueAtTime(volumen, t);
  sobre.gain.exponentialRampToValueAtTime(0.0001, t + caida);

  fuente.connect(paso);
  paso.connect(sobre);
  sobre.connect(sonido.maestro);
  sonido.voces++;
  fuente.onended = () => { sonido.voces--; };
  fuente.start(t);
}

// Acorde de bandoneón: cada nota son dos sierras desafinadas, con ataque de fuelle.
function tocarAcorde(frecuencias, opciones = {}) {
  const { volumen = 0.055, ataque = 0.12, caida = 0.9, separacion = 0.05 } = opciones;
  frecuencias.forEach((f, i) => {
    for (const desafine of [-7, 7]) {
      tocarNota(f, {
        tipo: 'sawtooth', volumen, ataque, caida, desafine,
        filtro: 1500, filtroFinal: 700, demora: i * separacion, eco: 0.3,
      });
    }
  });
}

// Efectos

// Botones de la interfaz: una madera seca, apenas audible.
function sonarBoton() {
  if (!puedeSonar('boton', 40)) return;
  tocarRoce({ volumen: 0.09, caida: 0.05, filtro: 2400 });
  tocarNota(392, { volumen: 0.07, ataque: 0.002, caida: 0.07, filtro: 1800, eco: 0.1 });
}

// Elegir herramienta: el mismo golpecito, un poco más arriba.
function sonarHerramienta() {
  if (!puedeSonar('herramienta', 40)) return;
  tocarRoce({ volumen: 0.07, caida: 0.04, filtro: 3200 });
  tocarNota(587.33, { volumen: 0.07, ataque: 0.002, caida: 0.09, filtro: 2400, eco: 0.2 });
}

// Sumar una cuadra: cuerda pulsada que sube por la escala mientras se arrastra el dedo, y vuelve al
// grave cuando pasa medio segundo sin agregar nada. Así una calle larga suena como una frase.
function sonarCalle() {
  if (!puedeSonar('calle', 55)) return;
  const ahora = performance.now();
  if (ahora - (sonido.ultimaCalle || 0) > 500) sonido.notaDeCalle = 0;
  sonido.ultimaCalle = ahora;
  const f = escala[Math.min(sonido.notaDeCalle, escala.length - 1)];
  sonido.notaDeCalle++;
  tocarNota(f, { volumen: 0.16, ataque: 0.004, caida: 0.32, filtro: 3200, filtroFinal: 700, eco: 0.3 });
  tocarNota(f * 2, { volumen: 0.04, ataque: 0.004, caida: 0.14, filtro: 4000, eco: 0.2 });
}

// Borrar: la misma cuerda, pero grave y cayendo.
function sonarBorrar() {
  if (!puedeSonar('borrar', 55)) return;
  tocarNota(196, {
    volumen: 0.16, ataque: 0.004, caida: 0.3, filtro: 1400, filtroFinal: 300,
    frecuenciaFinal: 146.83, eco: 0.2,
  });
  tocarRoce({ volumen: 0.06, caida: 0.06, filtro: 700 });
}

// Graficar: dos notas, hacia arriba al empezar a seguir una cuadra y hacia abajo al soltarla.
function sonarGraficar(prendida) {
  if (!puedeSonar('graficar', 60)) return;
  const notas = prendida ? [440, 659.25] : [659.25, 440];
  notas.forEach((f, i) => {
    tocarNota(f, {
      volumen: 0.11, ataque: 0.004, caida: 0.2, filtro: 3000, filtroFinal: 900,
      demora: i * 0.08, eco: 0.3,
    });
  });
}

// Mezclar las fases: un barrido de ruido, como las cartas al barajarse.
function sonarMezclar() {
  if (!puedeSonar('mezclar', 120)) return;
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      if (!sonido.encendido || !sonido.contexto) return;
      tocarRoce({ volumen: 0.06, caida: 0.05, filtro: 1200 + i * 900 });
    }, i * 45);
  }
}

// Empezar: el fuelle abriendo en La menor con novena.
function sonarInicio() {
  if (!puedeSonar('inicio', 400)) return;
  tocarAcorde([220, 329.63, 440, 587.33], { volumen: 0.05, ataque: 0.18, caida: 1.4, separacion: 0.07 });
}

// Cambio de luz de un semáforo: un golpecito de madera. No suena uno por semáforo, que serían
// varios por segundo, sino uno cada medio ciclo, al ritmo al que cambia de luz un semáforo.
// La nota la pone el orden de la red: desordenada suena grave y sorda, ordenada aguda y pareja.
function sonarSemaforos(orden, espera) {
  if (!puedeSonar('semaforo', espera)) return false;
  const nota = escala[Math.round(constrain(orden, 0, 1) * (escala.length - 1))];
  const volumen = 0.03 + 0.05 * orden;
  tocarRoce({ volumen: volumen * 0.7, caida: 0.04, filtro: 2200 + 2200 * orden });
  tocarNota(nota, {
    volumen, ataque: 0.002, caida: 0.06 + 0.06 * orden, filtro: 1800 + 2400 * orden, eco: 0.15,
  });
  return true;
}

// La red llegó al equilibrio: acorde mayor que resuelve, el único sonido que se permite destacar.
function sonarSincronizacion() {
  if (!puedeSonar('sincro', 1500)) return;
  tocarAcorde([261.63, 392, 523.25], { volumen: 0.055, ataque: 0.1, caida: 1.6, separacion: 0.09 });
  [659.25, 783.99, 1046.5].forEach((f, i) => {
    tocarNota(f, {
      volumen: 0.07, ataque: 0.004, caida: 0.5, filtro: 3600, filtroFinal: 1200,
      demora: 0.26 + i * 0.1, eco: 0.4,
    });
  });
}

// Encendido y apagado

function alternarSonido() {
  sonido.encendido = !sonido.encendido;
  localStorage.setItem('sonido', sonido.encendido ? 'si' : 'no');
  mostrarSonido();
  if (sonido.encendido) sonarHerramienta();
}

function mostrarSonido() {
  const boton = document.getElementById('botonSonido');
  if (!boton) return;
  boton.classList.toggle('activo', sonido.encendido);
  boton.textContent = sonido.encendido ? 'Sonido ♪' : 'Sonido ✕';
}

function prepararSonido() {
  mostrarSonido();
  document.getElementById('botonSonido').addEventListener('click', alternarSonido);
  // Los botones de la interfaz comparten el mismo golpecito; los efectos propios del juego los
  // dispara principal.js donde pasa cada cosa.
  document.addEventListener('pointerdown', e => {
    const boton = e.target.closest('.boton');
    if (!boton || boton.id === 'botonSonido') return;
    if (boton.id === 'botonEmpezar') return;  // el inicio tiene su propio acorde
    sonarBoton();
  });
}

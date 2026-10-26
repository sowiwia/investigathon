// Gráficos con Chart.js: el potencial V en el tiempo y el desfase de hasta 4 calles elegidas,
// cada uno con su objetivo como línea punteada.

const segundosEntreMuestras = 1;
const maximoDeMuestras = 300;
const coloresDeSeries = ['#ff7eb6', '#9be564', '#c792ea', '#7fdbca'];

let graficoV;
let graficoDesfases;
let muestrasDeV = [];
let series = [];  // { calle, color, datos: [{ x, y }], ultimo, objetivo }
let proximaMuestra = 0;
let marcaDeSincronizacion = null;  // en qué segundo la red llegó al equilibrio

function crearGraficos() {
  Chart.defaults.font.family = "'Monocraft', monospace";
  Chart.defaults.font.size = 9;
  Chart.defaults.color = '#9a9fc3';
  graficoV = new Chart(document.getElementById('graficoV'), configuracion());
  graficoDesfases = new Chart(document.getElementById('graficoDesfases'), configuracion());
}

// Arranca de cero el historial: se usa al mezclar fases o al cambiar algo que mueve el equilibrio.
function reiniciarMuestras() {
  muestrasDeV = [];
  proximaMuestra = 0;
  marcaDeSincronizacion = null;
  for (const serie of series) {
    serie.datos = [];
    serie.ultimo = null;
  }
}

function marcarSincronizacion(tiempo) {
  marcaDeSincronizacion = tiempo;
}

function configuracion() {
  return {
    type: 'line',
    data: { datasets: [] },
    options: {
      animation: false,
      maintainAspectRatio: false,
      events: [],
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { type: 'linear', grid: { display: false }, ticks: { maxTicksLimit: 5 }, border: { color: '#4a4f78' } },
        y: { grid: { color: '#22263f' }, ticks: { maxTicksLimit: 4 }, border: { color: '#4a4f78' } },
      },
    },
  };
}

function linea(datos, color, punteada = false) {
  return {
    data: datos,
    borderColor: color,
    borderWidth: punteada ? 1 : 2,
    borderDash: punteada ? [4, 4] : [],
    pointRadius: 0,
  };
}

// Desfase φj − φi de una calle y su objetivo. En una mano única, j es la esquina de donde vienen
// los autos y el objetivo es Δji; en una doble mano, el objetivo es el óptimo de la ec. 2.
function desfaseDeCalle(calle, red, fases) {
  const [j, i] = calle.deAaB ? [calle.a, calle.b] : [calle.b, calle.a];
  const desfase = fases[j] - fases[i];
  if (calle.deAaB && calle.deBaA) {
    return { desfase, objetivo: Math.abs(wrap(red.delta[j][i])) < Math.PI / 2 ? 0 : Math.PI };
  }
  return { desfase, objetivo: red.delta[j][i] };
}

// Guarda una muestra por segundo simulado.
function registrarMuestra(tiempo, red, fases) {
  if (tiempo < proximaMuestra) return;
  proximaMuestra = tiempo + segundosEntreMuestras;

  muestrasDeV.push({ x: tiempo, y: potencial(fases, red) });
  if (muestrasDeV.length > maximoDeMuestras) muestrasDeV.shift();

  for (const serie of series) {
    const { desfase, objetivo } = desfaseDeCalle(serie.calle, red, fases);
    // continuo, sin saltos de 2π: se suma solo el cambio desde la muestra anterior
    serie.ultimo = serie.ultimo === null ? wrap(desfase) : serie.ultimo + wrap(desfase - serie.ultimo);
    serie.objetivo = objetivo;
    serie.datos.push({ x: tiempo, y: serie.ultimo });
    if (serie.datos.length > maximoDeMuestras) serie.datos.shift();
  }
}

function actualizarGraficos() {
  const deV = [linea(muestrasDeV, '#eceaf6')];
  // la línea vertical marca el momento en que V dejó de bajar: lo que tardó en sincronizar
  if (marcaDeSincronizacion !== null && muestrasDeV.length > 0) {
    const valores = muestrasDeV.map(m => m.y);
    const alto = Math.max(...valores);
    const bajo = Math.min(...valores);
    deV.push(linea([{ x: marcaDeSincronizacion, y: bajo }, { x: marcaDeSincronizacion, y: alto }],
      '#3fd47a', true));
  }
  graficoV.data.datasets = deV;
  graficoV.update('none');

  const conjuntos = [];
  for (const serie of series) {
    conjuntos.push(linea(serie.datos, serie.color));
    if (serie.objetivo === null || serie.datos.length === 0) continue;
    // el objetivo se dibuja en la vuelta más cercana al desfase actual
    const objetivo = serie.ultimo + wrap(serie.objetivo - serie.ultimo);
    const desde = serie.datos[0].x;
    const hasta = serie.datos[serie.datos.length - 1].x;
    conjuntos.push(linea([{ x: desde, y: objetivo }, { x: hasta, y: objetivo }], serie.color, true));
  }
  graficoDesfases.data.datasets = conjuntos;
  graficoDesfases.update('none');
  document.getElementById('pistaDesfases').hidden = series.length > 0;
}

// Elige o deja de graficar una calle. Si ya hay 4, se va la más vieja.
function alternarSerie(calle) {
  const yaEsta = series.find(serie => serie.calle === calle);
  if (yaEsta) {
    series = series.filter(serie => serie !== yaEsta);
    return;
  }
  if (series.length === coloresDeSeries.length) series.shift();
  const color = coloresDeSeries.find(c => !series.some(serie => serie.color === c));
  series.push({ calle, color, datos: [], ultimo: null, objetivo: null });
}

// Saca las series de calles que ya no existen.
function limpiarSeries(plano) {
  series = series.filter(serie => plano.calles.includes(serie.calle));
}

function callesElegidas() {
  return series.map(serie => ({ calle: serie.calle, color: serie.color }));
}

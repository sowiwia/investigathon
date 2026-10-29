const segundosEntreMuestras = 0.25;
const maximoDeMuestras = 800;
const coloresDeSeries = ['#ff7eb6', '#9be564', '#c792ea', '#7fdbca'];

let graficoV;
let graficoDesfases;
let muestrasDeV = [];
let series = [];
let proximaMuestra = 0;
let marcaDeSincronizacion = null;

function crearGraficos() {
  Chart.defaults.font.family = "'Monocraft', monospace";
  Chart.defaults.font.size = 9;
  Chart.defaults.color = '#9a9fc3';
  graficoV = new Chart(document.getElementById('graficoV'), configuracion());
  graficoDesfases = new Chart(document.getElementById('graficoDesfases'), configuracion());
}

function graficosVisibles() {
  const panel = document.getElementById('panelGraficos');
  return !panel.classList.contains('cerrada') && !document.body.classList.contains('sinPaneles');
}

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
      normalized: true,
      parsing: false,
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

function alternarSerie(calle) {
  const yaEsta = series.find(serie => serie.calle === calle);
  if (yaEsta) {
    series = series.filter(serie => serie !== yaEsta);
    return false;
  }
  if (series.length === coloresDeSeries.length) series.shift();
  const color = coloresDeSeries.find(c => !series.some(serie => serie.color === c));
  series.push({ calle, color, datos: [], ultimo: null, objetivo: null });
  return true;
}

function limpiarSeries(plano) {
  series = series.filter(serie => plano.calles.includes(serie.calle));
}

function callesElegidas() {
  return series.map(serie => ({ calle: serie.calle, color: serie.color }));
}

// Rueda de desfases: un punto por cuadra, en el ángulo que le falta para cumplir su objetivo.
// Arriba (ángulo 0) está el desfase cumplido; todos los puntos azules arriba significa que la red
// está sincronizada.

const radioDeLaRueda = 34;

function errorDeCalle(calle, red, fases) {
  const { desfase, objetivo } = desfaseDeCalle(calle, red, fases);
  return objetivo === null ? null : wrap(desfase - objetivo);
}

// La aguja apunta al promedio de los puntos. Su largo muestra qué tan juntos están: cuando las
// calles convergen arriba, llega hasta el grupo azul sin necesitar un indicador numérico aparte.
function agujaDeLaRueda(plano, red, fases) {
  let sumaX = 0;
  let sumaY = 0;
  let cuantas = 0;
  for (const calle of plano.calles) {
    const error = errorDeCalle(calle, red, fases);
    if (error === null) continue;
    sumaX += Math.sin(error);
    sumaY -= Math.cos(error);
    cuantas++;
  }
  return cuantas === 0 ? null : { x: sumaX / cuantas, y: sumaY / cuantas };
}

function dibujarRueda(plano, red, fases, tol) {
  const canvas = document.getElementById('rueda');
  const ctx = canvas.getContext('2d');
  const medio = canvas.width / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = paleta.cordon;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(medio, medio, radioDeLaRueda, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = paleta.cumplido;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(medio, medio, radioDeLaRueda, -Math.PI / 2 - tol, -Math.PI / 2 + tol);
  ctx.stroke();

  for (const calle of plano.calles) {
    const error = errorDeCalle(calle, red, fases);
    if (error === null) continue;
    const x = medio + radioDeLaRueda * Math.sin(error);
    const y = medio - radioDeLaRueda * Math.cos(error);
    const lado = calle.avenida ? 4 : 3;
    ctx.fillStyle = Math.abs(error) < tol ? paleta.cumplido : paleta.lejos;
    ctx.fillRect(Math.round(x - lado / 2), Math.round(y - lado / 2), lado, lado);
  }

  const aguja = agujaDeLaRueda(plano, red, fases);
  if (aguja) {
    ctx.strokeStyle = paleta.texto;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(medio, medio);
    ctx.lineTo(medio + radioDeLaRueda * aguja.x, medio + radioDeLaRueda * aguja.y);
    ctx.stroke();
  }
}

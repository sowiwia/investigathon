const textosDeAyuda = {
  T: 'Duración de un ciclo completo del semáforo.',
  delta: 'Cuánto conviene atrasar un semáforo para que el auto llegue en verde. Δ = 2πL/(vT).',
  V: 'Descoordinación total. 0 es acuerdo perfecto; más alto, más lejos del objetivo.',
  sincronizado: 'Todas las calles están dentro de la tolerancia de su desfase objetivo.',
  transito: 'Cambia cuántos autos se ven y el acople K: con más tránsito, los semáforos se ajustan más entre sí.',
  mezclar: 'Desordena las fases para ver cómo la red vuelve a ordenarse.',
  mirar: 'Arrastrá para mover el mapa. Tocar una calle no modifica la red.',
  calle: 'Tocá una calle para sumarla a la red.',
  borrar: 'Tocá una cuadra para sacarla de la red.',
  graficar: 'Tocá una cuadra para seguir su desfase.',
};

function prepararAyuda() {
  const guia = document.getElementById('guia');
  const globo = document.getElementById('ayudaEmergente');
  document.getElementById('botonGuia').addEventListener('click', () => {
    if (!jugando) return;
    guia.hidden = !guia.hidden;
    globo.hidden = true;
  });
  document.getElementById('saltarGuia').addEventListener('click', () => {
    guia.hidden = true;
    confirmarPresentacion();
  });
  document.querySelectorAll('[data-ayuda]').forEach(boton => boton.addEventListener('click', e => {
    e.stopPropagation();
    const abierto = !globo.hidden && globo.dataset.clave === boton.dataset.ayuda;
    globo.hidden = abierto;
    if (abierto) return;
    globo.dataset.clave = boton.dataset.ayuda;
    globo.textContent = textosDeAyuda[boton.dataset.ayuda];
    const rect = boton.getBoundingClientRect();
    globo.style.top = `${Math.min(window.innerHeight - 110, rect.bottom + 8)}px`;
    globo.style.left = `${Math.max(8, Math.min(window.innerWidth - 300, rect.left))}px`;
  }));
  document.addEventListener('click', e => { if (!e.target.closest('[data-ayuda]')) globo.hidden = true; });
}

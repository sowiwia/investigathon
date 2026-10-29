const textosDeAyuda = {
  T: 'Duración de un ciclo completo del semáforo.',
  delta: 'Cuánto conviene atrasar un semáforo para que el auto llegue en verde. Δ = 2πL/(vT).',
  V: 'Descoordinación total. 0 es acuerdo perfecto; más alto, más lejos del objetivo.',
  sincronizado: 'Sincronizado: todas las calles dentro de la tolerancia. Equilibrio frustrado: V tocó su mínimo y dejó de bajar, pero ese mínimo no es cero. Pasa con circuitos, donde los desfases objetivo no pueden cumplirse todos a la vez.',
  transito: 'Cambia cuántos autos se ven y el acople K: con más tránsito, los semáforos se ajustan más entre sí.',
  mezclar: 'Desordena las fases para ver cómo la red vuelve a ordenarse.',
  mirar: 'Arrastrá para mover el mapa. Tocar una calle no modifica la red.',
  calle: 'Tocá una calle para sumarla a la red.',
  borrar: 'Tocá una cuadra para sacarla de la red.',
  graficar: 'Tocá una cuadra para seguir su desfase.',
};

const margenDelGlobo = 8;

function ubicarGlobo(globo, boton) {
  globo.style.left = '0px';
  globo.style.top = '0px';
  const ancho = globo.offsetWidth;
  const alto = globo.offsetHeight;
  const abajo = boton.bottom + margenDelGlobo;
  const entraAbajo = abajo + alto <= window.innerHeight - margenDelGlobo;
  const arriba = boton.top - margenDelGlobo - alto;
  globo.style.top = `${Math.max(margenDelGlobo, entraAbajo ? abajo : arriba)}px`;
  globo.style.left = `${Math.max(margenDelGlobo, Math.min(window.innerWidth - ancho - margenDelGlobo, boton.left))}px`;
}

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
    ubicarGlobo(globo, boton.getBoundingClientRect());
  }));
  document.addEventListener('click', e => { if (!e.target.closest('[data-ayuda]')) globo.hidden = true; });
}

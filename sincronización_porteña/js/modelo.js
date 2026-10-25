// Semáforos como osciladores de fase (Nishikawa, Nakazawa y Kita 2003).
//
// Una red tiene:
//   vecinos[i]  esquinas conectadas a i por una calle, sin importar el sentido
//   K[j][i]     flujo de autos de j hacia i (0 si la calle es contramano en ese sentido)
//   delta[j][i] desfase objetivo de ese flujo: se busca que fases[j] - fases[i] = delta[j][i]
//
// Las fases se guardan en [0, 2π) y φ = 0 es el comienzo del verde de la calle principal.

const vuelta = 2 * Math.PI;

// Lleva un ángulo a (-π, π].
function wrap(x) {
  return x - vuelta * Math.ceil((x - Math.PI) / vuelta);
}

// Lleva un ángulo a [0, 2π).
function mod2pi(x) {
  return ((x % vuelta) + vuelta) % vuelta;
}

// Con amarillo y despeje nulos, la principal tiene verde en 0 ≤ φ < s·2π y la secundaria el resto (sec. 4.3).
function verdeEnPrincipal(fase, s) {
  return fase < s * vuelta;
}

// Desfase objetivo de una cuadra de largo L (ec. 1): el tiempo de viaje L/v medido en fase.
function desfaseObjetivo(L, v, T) {
  return mod2pi(vuelta * L / (v * T));
}

// Velocidad de cada fase según la ec. 11 (sistema bidireccional).
function derivadas(fases, red, omega) {
  const velocidades = [];
  for (let i = 0; i < fases.length; i++) {
    const vecinos = red.vecinos[i];
    let suma = 0;
    for (const j of vecinos) {
      const dif = fases[j] - fases[i];
      suma += red.K[j][i] / 2 * Math.sin(dif - red.delta[j][i])
            + red.K[i][j] / 2 * Math.sin(dif + red.delta[i][j]);
    }
    // una esquina sin calles sigue su ciclo sola
    velocidades.push(vecinos.length > 0 ? omega + suma / vecinos.length : omega);
  }
  return velocidades;
}

// Un paso de Euler.
function paso(fases, red, omega, dt) {
  const velocidades = derivadas(fases, red, omega);
  return fases.map((fase, i) => mod2pi(fase + dt * velocidades[i]));
}

function simular(fases, red, omega, dt, pasos) {
  for (let k = 0; k < pasos; k++) {
    fases = paso(fases, red, omega, dt);
  }
  return fases;
}

// Potencial V. Con la ec. 11, dφi/dt = ω - (1/|Ni|) ∂V/∂φi, así que V nunca sube.
function potencial(fases, red) {
  let V = 0;
  for (let i = 0; i < fases.length; i++) {
    for (const j of red.vecinos[i]) {
      V += red.K[j][i] * (1 - Math.cos(fases[j] - fases[i] - red.delta[j][i]));
    }
  }
  return V / 2;
}

// El flujo j→i está cumplido si su desfase está a menos de tol del objetivo.
function flujoCumplido(fases, red, j, i, tol) {
  return Math.abs(wrap(fases[j] - fases[i] - red.delta[j][i])) < tol;
}

// Una doble mano no puede cumplir sus dos flujos a la vez. Con flujos iguales, lo mejor posible es
// estar en fase si Δ < π/2 o en antifase si Δ > π/2 (ec. 2).
function dobleManoEnOptimo(fases, red, a, b, tol) {
  const optimo = Math.abs(wrap(red.delta[a][b])) < Math.PI / 2 ? 0 : Math.PI;
  return Math.abs(wrap(fases[b] - fases[a] - optimo)) < tol;
}

// La red está en equilibrio cuando ninguna fase se aparta de ω más que tol.
function convergio(fases, red, omega, tol) {
  return derivadas(fases, red, omega).every(velocidad => Math.abs(velocidad - omega) < tol);
}

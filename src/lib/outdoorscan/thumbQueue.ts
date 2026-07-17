// Fila global para carregar thumbs do Street View de forma sequencial.
// Evita disparar centenas de requisições em paralelo (168 cards) e permite
// mostrar um indicador de "carregando" até o slot ficar livre.

const MAX_CONCURRENT = 8;
let active = 0;
const queue: Array<() => void> = [];

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    active++;
    next();
  }
}

export function acquireThumbSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const start = () => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        active = Math.max(0, active - 1);
        pump();
      };
      resolve(release);
    };
    queue.push(start);
    pump();
  });
}
// Portal-wide click feedback: a small ring that expands and fades wherever the user clicks.
// Installed once from main.tsx, so it covers every page and role (and the login screen).
// Skipped for users who ask the OS for reduced motion.

const FLAG = '__cscClickRipple';

export function installClickRipple(): void {
  const w = window as unknown as Record<string, boolean>;
  if (w[FLAG]) return; // guard against double install during hot reload
  w[FLAG] = true;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || reducedMotion?.matches) return;
      const ring = document.createElement('span');
      ring.className = 'click-ripple';
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      ring.addEventListener('animationend', () => ring.remove());
      document.body.appendChild(ring);
    },
    { capture: true, passive: true }
  );
}

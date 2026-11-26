// Celebraciones sutiles en los momentos que cierran el ciclo: completar el foco del día, marcar el
// último hábito del día, cerrar el día y cerrar la semana. Un anillo que se cierra alrededor del ✓
// de lo que se tocó, con unos destellos breves (≈1 s), en el color de la app. Sin sonido, sin
// confeti y sin texto extra: el aviso de siempre ya dice lo que pasó. Se omite con «reducir
// movimiento» del sistema.
const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const celebrates = () => !reduce();

/** Celebra sobre el elemento `target` (lo busca de nuevo si se pasa un selector, tras dibujar). */
export function celebrate(target, tone = '') {
  if (reduce()) return;
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const r = el?.getBoundingClientRect?.();
  if (!r || !r.width) return;
  const fx = document.createElement('div');
  fx.className = `celebrate${tone ? ` ${tone}` : ''}`;
  fx.setAttribute('aria-hidden', 'true');
  fx.style.left = `${r.left + r.width / 2 + scrollX}px`;
  fx.style.top = `${r.top + r.height / 2 + scrollY}px`;
  const sparks = [...Array(8)].map((_, i) => `<i style="--a:${i * 45 + 22}deg"></i>`).join('');
  fx.innerHTML = `<svg viewBox="0 0 64 64"><circle class="c-ring" cx="32" cy="32" r="26" pathLength="100"/></svg>${sparks}`;
  document.body.append(fx);
  setTimeout(() => fx.remove(), 1400);
}

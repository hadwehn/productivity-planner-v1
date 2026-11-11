// Se ejecuta antes de dibujar la página: aplica la última apariencia elegida en este dispositivo
// (o la del sistema si es «Automática»), para que la pantalla de carga no destelle en claro.
(function () {
  var pref = 'auto';
  try { pref = localStorage.getItem('diario-apariencia') || 'auto'; } catch (e) { /* almacenamiento bloqueado */ }
  var dark = pref === 'dark' || (pref === 'auto' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-appearance', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#111413' : '#F4F1EB');
})();

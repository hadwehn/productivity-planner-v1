// Se ejecuta antes de dibujar la página: aplica la última apariencia elegida en este dispositivo
// (o la del sistema si es «Automática»), para que la pantalla de carga no destelle en claro.
(function () {
  var pref = 'auto';
  try { pref = localStorage.getItem('diario-apariencia') || 'auto'; } catch (e) { /* almacenamiento bloqueado */ }
  var dark = pref === 'dark' || (pref === 'auto' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-appearance', dark ? 'dark' : 'light');
  try { if (localStorage.getItem('diario-idioma') === 'en') document.documentElement.lang = 'en'; } catch (e) { /* almacenamiento bloqueado */ }
  try { if (localStorage.getItem('diario-texto') === 'large') document.documentElement.setAttribute('data-text', 'large'); } catch (e) { /* almacenamiento bloqueado */ }
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#111413' : '#F4F1EB');
  // El ícono sigue a la apariencia: claro con punto azul, u oscuro con punto amarillo.
  var icon = dark ? 'icons/estoico-productivity-icon-dark.png?v=1' : 'icons/estoico-productivity-icon.png?v=3';
  var links = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
  for (var i = 0; i < links.length; i++) links[i].setAttribute('href', icon);
})();

// Se ejecuta antes de dibujar la página: aplica la apariencia elegida en este dispositivo
// (o la del sistema si es «Automática»), para que la pantalla de carga no destelle en claro.
(function () {
  var pref = 'auto';
  try { pref = localStorage.getItem('focus-apariencia') || 'auto'; /* de este dispositivo (ver ui.js) */ } catch (e) { /* almacenamiento bloqueado */ }
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

  // Celular en horizontal: el iPhone ignora "orientation" del manifiesto y no deja bloquear el giro
  // desde la web, así que se cubre la app con un aviso para volver a vertical (#rotate-hint).
  // Se mira la orientación de la pantalla y no el alto de la ventana: así el teclado abierto
  // (que achica la ventana en Android) no lo activa. Solo en celulares: el iPad gira libre.
  function checkRotation() {
    var s = window.screen || {}, type = s.orientation && s.orientation.type;
    var landscape = type ? type.indexOf('landscape') === 0 : Math.abs(window.orientation || 0) === 90;
    var phone = Math.min(s.width || 0, s.height || 0) < 500 && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    document.documentElement.classList.toggle('landscape-phone', landscape && phone);
  }
  checkRotation();
  if (window.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', checkRotation);
  window.addEventListener('orientationchange', checkRotation);
  window.addEventListener('resize', checkRotation);
})();

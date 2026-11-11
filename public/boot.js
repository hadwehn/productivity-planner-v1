import('./app.js').catch(() => {
  const en = document.documentElement.lang === 'en';
  document.querySelector('#auth-status').textContent = en
    ? 'The app couldn’t load. Check your connection and that your browser allows cdn.jsdelivr.net. Then reload this page.'
    : 'No se pudo cargar la aplicación. Revisa tu conexión y que el navegador permita cdn.jsdelivr.net. Luego recarga esta página.';
  const button = document.querySelector('#retry-load');
  button.hidden = false;
  button.onclick = () => location.reload();
});

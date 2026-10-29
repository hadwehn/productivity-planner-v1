import('./app.js').catch(() => {
  document.querySelector('#auth-status').textContent =
    'No se pudo cargar la aplicación. Revisa tu conexión y que el navegador permita cdn.jsdelivr.net. Luego recarga esta página.';
  const button=document.querySelector('#retry-load');
  button.hidden=false; button.onclick=()=>location.reload();
});

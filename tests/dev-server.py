"""Servidor local para probar la app sin Supabase real.

Uso:  python3 tests/dev-server.py   y abre http://localhost:8765/public/index.html
Pruebas unitarias en el navegador:   http://localhost:8765/tests/run.html

Sirve el repositorio tal cual, salvo public/client.js, que se reemplaza por
tests/mock-client.js (un backend simulado que guarda en localStorage).
"""
import http.server
import os
import socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT', '8765'))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        if path.split('?')[0] == '/public/client.js':
            return os.path.join(ROOT, 'tests', 'mock-client.js')
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'Abre http://localhost:{PORT}/public/index.html')
    httpd.serve_forever()

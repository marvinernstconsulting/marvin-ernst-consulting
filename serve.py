#!/usr/bin/env python3
"""
Lokaler Vorschau-Server.

Bildet das Verhalten von Cloudflare Workers Static Assets nach: eine Anfrage
auf /impressum liefert public/impressum.html. Ohne das würden die internen
Links lokal ins Leere laufen, weil sie — wie in Produktion — ohne .html-Endung
geschrieben sind.

    python3 serve.py          # http://localhost:4321
"""

import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
WURZEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        ziel = super().translate_path(path)
        # Endungslose Adresse, die es nicht gibt: .html daneben probieren.
        if not os.path.exists(ziel) and not os.path.splitext(ziel)[1]:
            if os.path.isfile(ziel + '.html'):
                return ziel + '.html'
        return ziel

    def end_headers(self):
        # Kein Caching in der Vorschau, sonst sieht man Änderungen nicht.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, format, *args):
        if '404' in (args[1] if len(args) > 1 else ''):
            super().log_message(format, *args)


if __name__ == '__main__':
    os.chdir(WURZEL)
    print(f"Vorschau auf http://localhost:{PORT}  (Wurzel: {WURZEL})")
    print("Hinweis: /api/lead läuft hier nicht — dafür braucht es Wrangler oder ein Deployment.")
    http.server.HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()

#!/usr/bin/env python3
import sys
import os
import http.server

sys.stdout = open(os.devnull, 'w')
sys.stderr = open(os.devnull, 'w')

FRONTEND_DIR = os.path.dirname(os.path.abspath(__file__))

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def translate_path(self, path):
        clean = path.split('?')[0].split('#')[0]
        target = super().translate_path(clean)
        if os.path.exists(target) and not os.path.isdir(target):
            return target
        return os.path.join(FRONTEND_DIR, 'index.html')

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3001
    server_address = ('127.0.0.1', port)
    httpd = http.server.HTTPServer(server_address, SPARequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

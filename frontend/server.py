#!/usr/bin/env python3
import sys
import os
import http.server

# Redirect stdout and stderr to devnull to avoid broken pipe on Windows background tasks
sys.stdout = open(os.devnull, 'w')
sys.stderr = open(os.devnull, 'w')

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        clean_path = self.path.split('?')[0].split('#')[0].lstrip('/')
        file_path = os.path.join(os.getcwd(), clean_path)
        if not clean_path or not os.path.exists(file_path) or os.path.isdir(file_path):
            self.path = '/index.html'
        return super().do_GET()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    server_address = ('127.0.0.1', port)
    httpd = http.server.HTTPServer(server_address, SPARequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

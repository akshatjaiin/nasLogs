#!/usr/bin/env python3
import sys
import os
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler

class SPARequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        clean_path = self.path.split('?')[0].lstrip('/')
        if not clean_path:
            clean_path = 'index.html'

        file_path = os.path.join(os.getcwd(), clean_path)
        
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            file_path = os.path.join(os.getcwd(), 'index.html')

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            mime, _ = mimetypes.guess_type(file_path)
            self.send_response(200)
            self.send_header('Content-Type', mime or 'text/html')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            self.wfile.flush()
        except Exception as e:
            try:
                self.send_error(404, f"File not found: {e}")
            except Exception:
                pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, SPARequestHandler)
    print(f"Smoke Detector SPA Server running on port {port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

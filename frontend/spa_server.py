import http.server
import socketserver
import os
import sys
import urllib.request
import urllib.error

PORT = 3000
BACKEND_URL = "http://localhost:8000"
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def proxy_api(self):
        url = f"{BACKEND_URL}{self.path}"
        headers = {k: v for k, v in self.headers.items() if k.lower() != 'host'}
        body = None
        if 'Content-Length' in self.headers:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)

        req = urllib.request.Request(url, data=body, headers=headers, method=self.command)

        try:
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ('transfer-encoding', 'content-length'):
                        self.send_header(k, v)
                resp_body = resp.read()
                self.send_header('Content-Length', str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() not in ('transfer-encoding', 'content-length'):
                    self.send_header(k, v)
            resp_body = e.read()
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(f'{{"error": "Bad Gateway: {str(e)}"}}'.encode('utf-8'))

    def do_GET(self):
        if self.path.startswith('/api'):
            return self.proxy_api()
        path = self.translate_path(self.path)
        if not os.path.exists(path):
            self.path = '/index.html'
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api'):
            return self.proxy_api()
        return super().do_POST()

    def do_PUT(self):
        if self.path.startswith('/api'):
            return self.proxy_api()
        return super().do_PUT()

    def do_PATCH(self):
        if self.path.startswith('/api'):
            return self.proxy_api()
        return super().do_PATCH()

    def do_DELETE(self):
        if self.path.startswith('/api'):
            return self.proxy_api()
        return super().do_DELETE()

    def do_OPTIONS(self):
        if self.path.startswith('/api'):
            return self.proxy_api()
        return super().do_OPTIONS()

if __name__ == '__main__':
    try:
        with ReusableTCPServer(("0.0.0.0", PORT), SPARequestHandler) as httpd:
            print(f"Serving SPA frontend on http://localhost:{PORT} (Proxying /api -> {BACKEND_URL})")
            httpd.serve_forever()
    except Exception as e:
        print(f"Server error on port {PORT}: {e}")
        sys.exit(1)

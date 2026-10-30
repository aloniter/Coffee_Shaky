"""Local preview with an in-memory kitchen. Never loads Firebase credentials or SDK."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import json
from datetime import datetime, timezone
from threading import Lock

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
orders = {}
orders_lock = Lock()

class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        route = self.path.split('?', 1)[0]
        if route == '/__preview/orders':
            with orders_lock:
                payload = json.dumps(list(orders.values())).encode()
            return self.send_content(payload, 'application/json')
        if route == '/firebase-config.js':
            return self.send_content(b'// Local preview: Firebase is not loaded.', 'application/javascript')
        if route == '/firebase-db.js':
            return self.send_content((ROOT / 'tests/local-db.js').read_bytes(), 'application/javascript')
        if route in ['/', '/index.html', '/barista.html']:
            html = (ROOT / ('barista.html' if route == '/barista.html' else 'index.html')).read_text()
            note = '<div style="position:fixed;bottom:88px;left:50%;transform:translateX(-50%);z-index:45;background:#21180ff2;border:1px solid #d9ae6b45;border-radius:8px;color:#e9cda8;padding:5px 12px;font:11px Rubik,Arial,sans-serif;white-space:nowrap;pointer-events:none">תצוגה מקומית · הזמנות ניסיון בלבד</div>'
            if route == '/barista.html':
                note = note.replace('position:fixed;bottom:88px;left:50%;transform:translateX(-50%);', 'position:relative;width:max-content;margin:0 auto 20px;')
            return self.send_content(html.replace('</body>', note + '</body>').encode(), 'text/html; charset=utf-8')
        if '/.' in route or route.startswith('/tests/') or route.startswith('/tools/'):
            self.send_error(404)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path != '/__preview/orders' or self.headers.get('Content-Type') != 'application/json':
            return self.send_error(404)
        if self.headers.get('Origin') not in (None, 'http://127.0.0.1:4175', 'http://localhost:4175'):
            return self.send_error(403)
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 65536:
                return self.send_error(400)
            data = json.loads(self.rfile.read(length))
            with orders_lock:
                if data['action'] == 'create':
                    order = data['order']
                    orders[order['id']] = dict(id=order['id'], product_name=order['productName'],
                        customer_name=order['customerName'], special_request=order['specialRequest'],
                        status='preparing', created_at=datetime.now(timezone.utc).isoformat(), pending=False)
                elif data['action'] == 'status':
                    if data['status'] not in ('preparing', 'ready'):
                        return self.send_error(400)
                    orders[data['id']]['status'] = data['status']
                elif data['action'] == 'remove':
                    for order_id in data['ids']:
                        orders.pop(order_id, None)
                else:
                    return self.send_error(400)
            return self.send_content(b'{}', 'application/json')
        except (ValueError, KeyError, TypeError):
            return self.send_error(400)

    def send_content(self, content, mime):
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(content)

if __name__ == '__main__':
    print('Coffee Shaky local-only preview: http://127.0.0.1:4175', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 4175), Preview).serve_forever()

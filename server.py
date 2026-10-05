#!/usr/bin/env python3
"""Harold Street Energy - home server helper.

Serves the dashboard on your home network and forwards requests to the few
services that don't let a browser page call them directly (PVGIS solar data,
the EPC register) or that some browsers block (Octopus).

Only these services can be reached through it. Keep it on your home network:
don't forward its port on your router.

    python3 server.py              # http://<this machine>:8787
    python3 server.py --port 9000  # pick another port

Needs Python 3.8 or newer and nothing else.
"""
import argparse
import http.server
import os
import socket
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))

ROUTES = {
    "octopus": "https://api.octopus.energy",
    "pvgis": "https://re.jrc.ec.europa.eu/api",
    "epc": "https://api.get-energy-performance-data.communities.gov.uk/api",
    "carbon": "https://api.carbonintensity.org.uk",
    "meteo": "https://api.open-meteo.com",
}
POST_ALLOWED = {("octopus", "v1/graphql/"), ("octopus", "v1/graphql")}
FORWARD = ("Authorization", "Content-Type", "Accept")
MAX_BODY = 1_000_000


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "HaroldStreetEnergy/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript",
    }

    def do_GET(self):
        if self.path.startswith("/proxy/"):
            return self.proxy("GET")
        if urllib.parse.urlsplit(self.path).path.endswith((".py", ".md")):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/proxy/"):
            return self.proxy("POST")
        self.send_error(405)

    def proxy(self, method):
        parts = urllib.parse.urlsplit(self.path)
        rest = parts.path[len("/proxy/"):]
        if rest == "ping":
            return self.reply(200, b"ok", "text/plain")
        name, _, sub = rest.partition("/")
        base = ROUTES.get(name)
        if not base or ".." in sub:
            return self.reply(404, b'{"error":"unknown service"}', "application/json")
        if method == "POST" and (name, sub) not in POST_ALLOWED:
            return self.reply(405, b'{"error":"not allowed"}', "application/json")

        url = f"{base}/{sub}" + (f"?{parts.query}" if parts.query else "")
        body = None
        if method == "POST":
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return self.reply(413, b'{"error":"too large"}', "application/json")
            body = self.rfile.read(length)
        headers = {"User-Agent": "HaroldStreetEnergy/1.0 (home dashboard)"}
        for h in FORWARD:
            if self.headers.get(h):
                headers[h] = self.headers[h]
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return self.reply(r.status, r.read(), r.headers.get("Content-Type", "application/json"))
        except urllib.error.HTTPError as e:
            return self.reply(e.code, e.read(), e.headers.get("Content-Type", "application/json"))
        except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
            msg = str(getattr(e, "reason", e)).replace('"', "'")
            return self.reply(502, f'{{"error":"could not reach {name}: {msg}"}}'.encode(), "application/json")

    def reply(self, status, data, ctype):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        # Keep the console readable: one short line per request, never headers.
        line = self.requestline.split(" ")
        path = urllib.parse.urlsplit(line[1] if len(line) > 1 else "").path
        print(f"{self.log_date_time_string()}  {args[1] if len(args) > 1 else ''}  {path}")


def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser(description="Serve Harold Street Energy on your home network.")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--host", default="0.0.0.0", help="address to listen on (default: all)")
    a = ap.parse_args()
    httpd = http.server.ThreadingHTTPServer((a.host, a.port), Handler)
    print("Harold Street Energy is running.")
    print(f"  On this machine:  http://localhost:{a.port}")
    print(f"  On your network:  http://{local_ip()}:{a.port}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

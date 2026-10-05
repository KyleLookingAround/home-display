#!/usr/bin/env python3
"""Harold Street Energy - home server helper.

Serves the dashboard and the household display on your home network, and
forwards requests to the few services that don't let a browser page call them
directly: PVGIS solar data, the EPC register, Google Calendar's iCal feeds,
Realtime Trains and TfGM Metrolink.

It holds the train and tram keys, so they never reach a browser. Put them in
the environment or in a file called .env next to this one:

    RTT_TOKEN=...          Realtime Trains access token (api-portal.rtt.io)
    RTT_REFRESH_TOKEN=...  or a refresh token, swapped for access tokens as needed
    TFGM_KEY=...           TfGM Open Data subscription key (developer.tfgm.com)

Only the services below can be reached through it. Keep it on your home
network: don't forward its port on your router.

    python3 server.py              # http://<this machine>:8787
    python3 server.py --port 9000  # pick another port

Needs Python 3.8 or newer and nothing else.
"""
import argparse
import http.server
import json
import os
import socket
import threading
import time
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
    "rtt": "https://data.rtt.io",
    "tfgm": "https://api.tfgm.com",
    "gcal": "https://calendar.google.com",
}
POST_ALLOWED = {("octopus", "v1/graphql/"), ("octopus", "v1/graphql")}
# Only these paths can be reached on the services the helper holds keys for, or that carry a private address.
PATH_PREFIX = {"rtt": ("gb-nr/location",), "tfgm": ("odata/Metrolinks",), "gcal": ("calendar/ical/",)}
FORWARD = ("Authorization", "Content-Type", "Accept")
MAX_BODY = 1_000_000


def load_env(path):
    """Read KEY=VALUE lines from a .env file into a dict. The environment wins over the file."""
    out = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    out[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    for k in ("RTT_TOKEN", "RTT_REFRESH_TOKEN", "TFGM_KEY"):
        if os.environ.get(k):
            out[k] = os.environ[k]
    return out


SECRETS = load_env(os.path.join(ROOT, ".env"))
_rtt = {"token": None, "until": 0.0}
_rtt_lock = threading.Lock()


def rtt_token():
    """An access token for Realtime Trains: the fixed one, or one swapped for the refresh token and cached."""
    if SECRETS.get("RTT_TOKEN"):
        return SECRETS["RTT_TOKEN"]
    refresh = SECRETS.get("RTT_REFRESH_TOKEN")
    if not refresh:
        return None
    with _rtt_lock:
        if _rtt["token"] and time.time() < _rtt["until"] - 60:
            return _rtt["token"]
        req = urllib.request.Request(ROUTES["rtt"] + "/api/get_access_token",
                                     headers={"Authorization": "Bearer " + refresh, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            j = json.loads(r.read())
        _rtt["token"] = j["token"]
        try:
            from datetime import datetime
            _rtt["until"] = datetime.fromisoformat(j["validUntil"].replace("Z", "+00:00")).timestamp()
        except (KeyError, ValueError):
            _rtt["until"] = time.time() + 600
        return _rtt["token"]


def keys_status():
    return {"rtt": bool(SECRETS.get("RTT_TOKEN") or SECRETS.get("RTT_REFRESH_TOKEN")), "tfgm": bool(SECRETS.get("TFGM_KEY"))}


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "HaroldStreetEnergy/1.1"

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
        path = urllib.parse.urlsplit(self.path).path
        # Never serve the helper itself, notes, or dotfiles such as .env (which holds the keys).
        if path.endswith((".py", ".md")) or any(part.startswith(".") for part in path.split("/") if part):
            return self.send_error(404)
        if path.rstrip("/") == "/display":
            self.send_response(301)
            self.send_header("Location", "/display.html")
            self.end_headers()
            return None
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
        if rest == "status":
            return self.reply(200, json.dumps({"ok": True, "keys": keys_status()}).encode(), "application/json")
        name, _, sub = rest.partition("/")
        base = ROUTES.get(name)
        if not base or ".." in sub:
            return self.reply(404, b'{"error":"unknown service"}', "application/json")
        if method == "POST" and (name, sub) not in POST_ALLOWED:
            return self.reply(405, b'{"error":"not allowed"}', "application/json")
        if name in PATH_PREFIX and not sub.startswith(PATH_PREFIX[name]):
            return self.reply(404, b'{"error":"unknown path"}', "application/json")

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
        if name in PATH_PREFIX:
            headers.pop("Authorization", None)
        if name == "rtt":
            try:
                token = rtt_token()
            except (urllib.error.URLError, socket.timeout, TimeoutError, KeyError, ValueError):
                return self.reply(502, b'{"error":"could not get a Realtime Trains access token"}', "application/json")
            if not token:
                return self.reply(503, b'{"error":"no Realtime Trains token on the home server helper"}', "application/json")
            headers["Authorization"] = "Bearer " + token
        if name == "tfgm":
            if not SECRETS.get("TFGM_KEY"):
                return self.reply(503, b'{"error":"no TfGM key on the home server helper"}', "application/json")
            headers["Ocp-Apim-Subscription-Key"] = SECRETS["TFGM_KEY"]
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
    keys = keys_status()
    print("Harold Street Energy is running.")
    print(f"  On this machine:  http://localhost:{a.port}")
    print(f"  On your network:  http://{local_ip()}:{a.port}")
    print(f"  Display:          http://{local_ip()}:{a.port}/display.html")
    print(f"  Trains: {'token set' if keys['rtt'] else 'no RTT_TOKEN'}  ·  Trams: {'key set' if keys['tfgm'] else 'no TFGM_KEY'}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

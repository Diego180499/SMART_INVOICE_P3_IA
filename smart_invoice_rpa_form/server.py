"""Formulario web simulado para el RPA de SmartInvoice.

Representa un "sistema externo" al que el robot (Playwright) ingresa los datos
extraidos de cada factura. No tiene dependencias externas: usa solo la libreria
estandar de Python.

Rutas:
  GET  /formulario-simulado   -> Formulario HTML con los campos que el RPA rellena.
  POST /formulario-simulado   -> Recibe el envio del RPA, lo guarda y muestra confirmacion.
  GET  /                       -> Tablero con todos los registros recibidos.
  GET  /registros              -> Devuelve los registros en formato JSON.
  GET  /health                 -> Estado del servicio.

Los campos esperados (coinciden con los que rellena el RPA del backend):
  numero_factura, fecha, proveedor, nit, total
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "3000"))
DATA_FILE = os.environ.get("DATA_FILE", "/data/registros.json")
FIELDS = ["numero_factura", "fecha", "proveedor", "nit", "total"]
LABELS = {
    "numero_factura": "Numero de factura",
    "fecha": "Fecha",
    "proveedor": "Proveedor",
    "nit": "NIT",
    "total": "Total",
}

_lock = threading.Lock()


def load_registros() -> list:
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []


def save_registros(registros: list) -> None:
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as fh:
            json.dump(registros, fh, ensure_ascii=False, indent=2)
    except Exception as exc:  # noqa: BLE001
        print("[rpa_form] No se pudo persistir:", exc, flush=True)


REGISTROS = load_registros()

# ----------------------------------------------------------------------------
# Plantillas HTML (paleta de SmartInvoice)
# ----------------------------------------------------------------------------
STYLE = """
<style>
  :root{--green:#588157;--green-dark:#3A5A40;--green-darker:#344E41;--sage:#A3B18A;--beige:#DAD7CD;--border:#e1e3da;}
  *{box-sizing:border-box;} body{margin:0;font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#f3f4ef;color:#29342b;}
  .topbar{background:var(--green-darker);color:#eef1ea;padding:16px 28px;display:flex;align-items:center;gap:12px;}
  .topbar b{color:#fff;} .topbar .tag{margin-left:auto;font-size:12px;background:rgba(255,255,255,.12);padding:4px 10px;border-radius:20px;}
  .wrap{max-width:880px;margin:28px auto;padding:0 18px;}
  .card{background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:0 1px 3px rgba(52,78,65,.08);padding:24px;margin-bottom:20px;}
  h1{font-size:20px;margin:0 0 4px;} h2{font-size:16px;margin:0 0 14px;} .muted{color:#8a968b;font-size:13.5px;margin:0 0 18px;}
  label{display:block;font-size:12.5px;font-weight:600;color:#5d6b5f;margin:12px 0 6px;}
  input{width:100%;font-size:14px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;}
  input:focus{outline:none;border-color:var(--green);box-shadow:0 0 0 3px rgba(88,129,87,.15);}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}
  button{margin-top:18px;background:var(--green);color:#fff;border:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;}
  button:hover{background:var(--green-dark);}
  table{width:100%;border-collapse:collapse;font-size:13.5px;} th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);}
  th{background:#f7f8f3;color:#5d6b5f;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;}
  .ok{display:inline-flex;align-items:center;gap:8px;background:#e6f2e9;color:#2f7d4f;padding:6px 12px;border-radius:20px;font-weight:600;font-size:13px;}
  .a{color:var(--green-dark);text-decoration:none;font-weight:600;font-size:13.5px;} .empty{color:#8a968b;text-align:center;padding:30px;}
  .kv{display:grid;grid-template-columns:auto 1fr;gap:8px 18px;font-size:14px;margin-top:8px;} .kv dt{color:#8a968b;font-weight:600;} .kv dd{margin:0;}
</style>
"""


def page(title: str, body: str) -> bytes:
    html = (
        "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>" + title + " - Formulario simulado</title>" + STYLE + "</head><body>"
        "<div class='topbar'><span>Sistema externo (simulado) &middot; <b>Registro de Facturas</b></span>"
        "<span class='tag'>RPA target</span></div><div class='wrap'>" + body + "</div></body></html>"
    )
    return html.encode("utf-8")


def esc(v) -> str:
    s = "" if v is None else str(v)
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;").replace("'", "&#39;"))


def form_html(prefill=None) -> str:
    prefill = prefill or {}
    grid = ("<div class='grid'>"
            "<div><label for='numero_factura'>Numero de factura</label><input id='numero_factura' name='numero_factura' autocomplete='off'></div>"
            "<div><label for='fecha'>Fecha</label><input id='fecha' name='fecha' autocomplete='off'></div>"
            "<div><label for='proveedor'>Proveedor</label><input id='proveedor' name='proveedor' autocomplete='off'></div>"
            "<div><label for='nit'>NIT</label><input id='nit' name='nit' autocomplete='off'></div>"
            "</div>"
            "<label for='total'>Total</label><input id='total' name='total' autocomplete='off'>")
    return ("<div class='card'><h1>Formulario de registro de factura</h1>"
            "<p class='muted'>Este formulario simula un sistema externo. El RPA de SmartInvoice "
            "lo abre automaticamente, rellena los campos con los datos extraidos por el OCR y envia el registro.</p>"
            "<form method='post' action='/formulario-simulado'>" + grid +
            "<button type='submit'>Registrar factura</button></form>"
            "<p style='margin-top:16px'><a class='a' href='/'>Ver registros recibidos &rsaquo;</a></p></div>")


def registros_table() -> str:
    if not REGISTROS:
        return "<div class='empty'>Aun no se han recibido registros del RPA.</div>"
    body = ("<table><thead><tr><th>#</th><th>Numero</th><th>Fecha</th><th>Proveedor</th>"
            "<th>NIT</th><th>Total</th><th>Recibido</th></tr></thead><tbody>")
    for i, r in enumerate(reversed(REGISTROS), 1):
        body += ("<tr><td>" + str(len(REGISTROS) - i + 1) + "</td><td>" + esc(r.get("numero_factura")) +
                 "</td><td>" + esc(r.get("fecha")) + "</td><td>" + esc(r.get("proveedor")) +
                 "</td><td>" + esc(r.get("nit")) + "</td><td>" + esc(r.get("total")) +
                 "</td><td>" + esc(r.get("_recibido")) + "</td></tr>")
    body += "</tbody></table>"
    return body


class Handler(BaseHTTPRequestHandler):
    server_version = "RPAFormSim/1.0"

    def _send(self, status: int, body: bytes, ctype="text/html; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # registro compacto
        print("[rpa_form] " + (fmt % args), flush=True)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/formulario-simulado", "/formulario", "/form"):
            self._send(200, page("Formulario", form_html()))
        elif path == "/" or path == "/registros.html":
            body = ("<div class='card'><h2>Registros recibidos desde el RPA</h2>"
                    "<p class='muted'>Total: " + str(len(REGISTROS)) + ". "
                    "<a class='a' href='/formulario-simulado'>Abrir formulario</a></p>" +
                    registros_table() + "</div>")
            self._send(200, page("Registros", body))
        elif path == "/registros":
            self._send(200, json.dumps(REGISTROS, ensure_ascii=False).encode("utf-8"),
                       "application/json; charset=utf-8")
        elif path == "/health":
            self._send(200, json.dumps({"status": "ok", "registros": len(REGISTROS)}).encode("utf-8"),
                       "application/json")
        else:
            self._send(404, page("No encontrado", "<div class='card'><h2>404</h2><p class='muted'>Ruta no encontrada.</p></div>"))

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/formulario-simulado":
            self._send(404, page("No encontrado", "<div class='card'><h2>404</h2></div>"))
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length else ""
        data = parse_qs(raw)
        registro = {f: (data.get(f, [""])[0]) for f in FIELDS}
        registro["_recibido"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with _lock:
            REGISTROS.append(registro)
            save_registros(REGISTROS)
        kv = "".join("<dt>" + LABELS[f] + "</dt><dd>" + esc(registro.get(f) or "-") + "</dd>" for f in FIELDS)
        body = ("<div class='card'><span class='ok'>&#10003; Factura registrada correctamente</span>"
                "<p class='muted' style='margin-top:14px'>El sistema externo recibio los siguientes datos del RPA:</p>"
                "<dl class='kv'>" + kv + "</dl>"
                "<p style='margin-top:18px'><a class='a' href='/'>Ver todos los registros</a> &nbsp; "
                "<a class='a' href='/formulario-simulado'>Nuevo registro</a></p></div>")
        self._send(200, page("Registro recibido", body))


def main():
    print("[rpa_form] Formulario simulado escuchando en http://" + HOST + ":" + str(PORT), flush=True)
    print("[rpa_form] Endpoint del RPA: /formulario-simulado", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()

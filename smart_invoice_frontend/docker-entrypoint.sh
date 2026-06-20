#!/bin/sh
# Se ejecuta automáticamente por la imagen oficial de nginx (carpeta
# /docker-entrypoint.d/) antes de arrancar el servidor.
#
# Genera env.js a partir de la variable de entorno API_URL (si está definida),
# permitiendo configurar la URL del backend en despliegue sin reconstruir la imagen.
set -e

TARGET=/usr/share/nginx/html/env.js

if [ -n "$API_URL" ]; then
  echo "window.__SMARTINVOICE_API__ = \"${API_URL}\";" > "$TARGET"
  echo "[smartinvoice] API_URL configurada: ${API_URL}"
else
  echo 'window.__SMARTINVOICE_API__ = window.__SMARTINVOICE_API__ || "";' > "$TARGET"
  echo "[smartinvoice] API_URL no definida; el frontend usará su valor por defecto (host:8000)."
fi

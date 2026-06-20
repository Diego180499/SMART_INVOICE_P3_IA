# Formulario web simulado (sistema externo) que recibe los datos del RPA.
# Sin dependencias: solo la libreria estandar de Python.
FROM python:3.11-slim

WORKDIR /app
COPY server.py .

# Carpeta de persistencia de los registros recibidos.
VOLUME ["/data"]
ENV PORT=3000 DATA_FILE=/data/registros.json

EXPOSE 3000
CMD ["python", "server.py"]

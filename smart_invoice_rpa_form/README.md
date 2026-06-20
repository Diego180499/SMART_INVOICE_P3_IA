# Formulario web simulado (objetivo del RPA)

Mini servicio que representa un **sistema externo** al que el RPA de SmartInvoice
ingresa los datos extraidos de cada factura. Construido solo con la libreria
estandar de Python (sin dependencias).

## Funcion dentro del proyecto

El backend ejecuta un robot (Playwright) que abre este formulario, rellena sus
campos con los datos de la factura y envia el registro. Asi se cumple el
requisito del enunciado de "registrar automaticamente la informacion extraida en
formularios web o sistemas simulados".

## Rutas

| Ruta | Descripcion |
|---|---|
| `GET /formulario-simulado` | Formulario HTML que rellena el RPA (campos: `numero_factura`, `fecha`, `proveedor`, `nit`, `total`). |
| `POST /formulario-simulado` | Recibe el envio del RPA, lo guarda y muestra confirmacion. |
| `GET /` | Tablero con todos los registros recibidos. |
| `GET /registros` | Registros en formato JSON. |
| `GET /health` | Estado del servicio. |

## Uso

Se levanta junto con el resto del sistema mediante el `docker-compose.yml` del
backend (servicio `rpa_form`). El backend lo alcanza por la red interna de Docker
en `http://rpa_form:3000/formulario-simulado`, y tu puedes abrirlo en el navegador
en `http://localhost:3000` para ver los registros que el RPA va ingresando.

### Ejecutar de forma independiente

```bash
python server.py          # http://localhost:3000
# o con Docker:
docker build -t rpa-form . && docker run -p 3000:3000 rpa-form
```

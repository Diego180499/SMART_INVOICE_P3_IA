# SmartInvoice — Backend

Backend del sistema **SmartInvoice**: procesamiento inteligente de facturas con
**OCR (Tesseract + OpenCV)**, validación automática, generación de reportes
(PDF/Excel/CSV) y automatización **RPA (Playwright + correo SMTP)**.

Construido con **Python 3.11+**, **FastAPI**, **SQLAlchemy 2** y **MySQL 8**.

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Instalación local](#instalación-local)
- [Ejecución con Docker](#ejecución-con-docker)
- [Variables de entorno](#variables-de-entorno)
- [Crear usuario administrador](#crear-usuario-administrador)
- [Documentación de la API](#documentación-de-la-api)
- [Pipeline OCR](#pipeline-ocr)

---

## Arquitectura

```
app/
├── main.py            # Instancia FastAPI, CORS, routers, eventos
├── config.py          # Configuración (Pydantic Settings)
├── database.py        # Engine SQLAlchemy + sesión
├── models/            # Modelos ORM (mapeo de la BD smart_invoice)
├── schemas/           # DTOs Pydantic v2 (request/response)
├── routers/           # Endpoints por dominio (/api/v1/*)
├── services/          # Lógica de negocio (OCR, CV, reportes, RPA, etc.)
├── core/              # Seguridad JWT, dependencias, excepciones
└── utils/             # Manejo de archivos y conversión de PDF
```

Capas: **router → service → model**. Los servicios no dependen de HTTP, lo que
facilita las pruebas y el mantenimiento.

---

## Requisitos

- Python **3.11+** (probado también en 3.13 para el núcleo de la API).
- **MySQL 8** con la base de datos `smart_invoice` ya creada.
- Para el OCR/RPA local (opcional fuera de Docker):
  - **Tesseract OCR** (con idioma `spa`).
  - **Poppler** (para convertir PDF a imagen).
  - Navegador de **Playwright** (`playwright install chromium`).

> Las funciones de OCR y RPA se importan de forma perezosa: la API arranca y
> los módulos de autenticación, proveedores, facturas, bitácora y reportes
> funcionan aunque Tesseract/Poppler/Playwright no estén instalados localmente.
> Para el procesamiento completo se recomienda usar Docker.

---

## Instalación local

```bash
# 1. Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate     # Linux/Mac

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variables de entorno
copy .env.example .env         # Windows
# cp .env.example .env           # Linux/Mac
# …edita .env con las credenciales de tu MySQL local

# 4. Levantar el servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

La API quedará disponible en `http://localhost:8000` y la documentación
interactiva en `http://localhost:8000/docs`.

### Tesseract y Poppler en Windows (opcional)

1. Instala Tesseract (UB Mannheim) y el paquete de idioma español.
2. Instala Poppler para Windows.
3. En `.env` indica las rutas:

```env
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
POPPLER_PATH=C:\poppler\Library\bin
```

---

## Ejecución con Docker

`docker-compose.yml` levanta el backend junto a una instancia de MySQL con todas
las dependencias del sistema (Tesseract, Poppler, Chromium) ya instaladas.

```bash
docker compose up --build
```

- Backend: `http://localhost:8000`
- MySQL: `localhost:3306`

> Para inicializar el esquema dentro del contenedor MySQL, coloca tu script SQL
> en `db/init/` (se ejecuta automáticamente al crear el volumen).

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_HOST` | Host de MySQL (`localhost` local, `mysql` en Docker) | `localhost` |
| `DB_PORT` | Puerto de MySQL | `3306` |
| `DB_NAME` | Nombre de la base de datos | `smart_invoice` |
| `DB_USER` / `DB_PASSWORD` | Credenciales de la BD | — |
| `SECRET_KEY` | Clave para firmar JWT | (cadena larga aleatoria) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token | `480` (8 h) |
| `UPLOAD_DIR` / `REPORTS_DIR` | Carpetas de archivos | `uploads` / `reports` |
| `MAX_FILE_SIZE_MB` | Tamaño máximo de archivo | `20` |
| `TESSERACT_CMD` | Ruta a Tesseract (Windows) | — |
| `POPPLER_PATH` | Ruta a Poppler/bin (Windows) | — |
| `OCR_LANG` | Idiomas Tesseract | `spa+eng` |
| `SMTP_*` / `EMAIL_FROM` | Configuración de correo | — |
| `RPA_FORM_URL` / `RPA_HEADLESS` | Formulario RPA | — |

---

## Crear usuario administrador

La BD ya está creada pero puedes generar un admin con credenciales conocidas:

```bash
python -m scripts.create_admin --email admin@smartinvoice.com --password Admin123 --nombre "Administrador"
```

Luego inicia sesión en `POST /api/v1/auth/login` (campo *username* = email).

---

## Documentación de la API

Base URL: `/api/v1`

| Dominio | Prefijo | Descripción |
|---|---|---|
| Autenticación | `/auth` | Login (JWT), registro, perfil |
| Proveedores | `/proveedores` | CRUD + búsqueda |
| Facturas | `/facturas` | Carga, consulta, corrección de datos |
| OCR | `/ocr` | Procesamiento OCR (individual y por lote) |
| Bitácora | `/bitacora` | Auditoría de operaciones |
| Reportes | `/reportes` | Generación y descarga (PDF/Excel/CSV) |
| RPA | `/rpa` | Registro en formulario y envío por correo |

Explora y prueba todos los endpoints en **Swagger UI**: `http://localhost:8000/docs`.

### Flujo típico

1. `POST /auth/login` → obtener token Bearer.
2. `POST /facturas/upload` → subir una factura (PDF/JPG/JPEG/PNG).
3. `POST /ocr/procesar/{factura_id}` → ejecutar el pipeline OCR.
4. `GET /facturas/{id}` → ver datos extraídos y validados.
5. `POST /reportes/generar` → generar un reporte.
6. `POST /rpa/enviar-reporte/{id}` → enviar el reporte por correo.

---

## Pipeline OCR

```
Archivo → OpenCV (gris, ruido, binarización Otsu, deskew)
        → Tesseract (--oem 3 --psm 6, lang spa+eng)
        → Extracción de campos (regex: número, fecha, NIT, montos)
        → Validación (coherencia total≈subtotal+impuestos, fecha, NIT)
        → Persistencia (datos_extraidos) + actualización de estado
        → Registro en bitácora de cada etapa
```

Estados de la factura: `Pendiente` → `Procesado` / `Rechazado` / `Error`.

---

## Restricciones cumplidas

- Backend 100% en Python.
- OCR y Computer Vision implementados localmente (sin IA generativa externa).
- Persistencia en base de datos relacional.
- Al menos una automatización RPA funcional (formulario web + correo).
- Ejecutable mediante Docker Compose.

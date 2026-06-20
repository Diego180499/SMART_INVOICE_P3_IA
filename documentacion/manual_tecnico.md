# Manual Técnico — SmartInvoice

**Proyecto:** SmartInvoice — Procesamiento inteligente de facturas (OCR + Validación + Reportes + RPA)
**Versión:** 1.0.0
**Componentes documentados:** `smart_invoice_frontend` (interfaz web) y `smart_invoice_backend` (API REST), con apoyo del servicio auxiliar `smart_invoice_rpa_form`.

> **Nota importante sobre Prolog.** El enunciado de la práctica contempla el uso de **Prolog** para el manejo lógico de la aplicación. **Este proyecto no utiliza Prolog**: el backend está implementado **100% en Python** y toda la lógica de negocio (extracción de campos, reglas de validación y decisiones del flujo OCR) se resuelve con módulos Python. En la sección de backend se documenta de forma explícita dónde residen esas reglas y qué hace cada capa, de modo que el lector tenga la equivalencia funcional de lo que en otra arquitectura correspondería a "hechos y reglas".

---

## Índice

1. [Documentación técnica del Frontend](#1-documentación-técnica-del-frontend)
   - 1.1 [Tecnologías usadas](#11-tecnologías-usadas)
   - 1.2 [Patrón de diseño usado](#12-patrón-de-diseño-usado)
   - 1.3 [Responsabilidad de cada vista](#13-responsabilidad-de-cada-vista)
   - 1.4 [Distribución de carpetas](#14-distribución-de-carpetas)
   - 1.5 [Tecnología para consumir la API REST](#15-tecnología-para-consumir-la-api-rest-del-backend)
   - 1.6 [Paleta de colores](#16-paleta-de-colores)
   - 1.7 [Notas técnicas adicionales](#17-notas-técnicas-adicionales-del-frontend)
2. [Documentación técnica del Backend](#2-documentación-técnica-del-backend)
   - 2.1 [Tecnologías usadas](#21-tecnologías-usadas)
   - 2.2 [Patrón de diseño usado](#22-patrón-de-diseño-usado)
   - 2.3 [Detalle de cada endpoint](#23-detalle-de-cada-endpoint)
   - 2.4 [Distribución de carpetas](#24-distribución-de-carpetas)
   - 2.5 [Manejo lógico de la aplicación (hechos y reglas)](#25-manejo-lógico-de-la-aplicación-hechos-y-reglas)
   - 2.6 [Responsabilidades de la capa lógica (equivalente a Prolog)](#26-responsabilidades-de-la-capa-lógica-equivalente-a-prolog)
   - 2.7 [Responsabilidades de Python](#27-responsabilidades-de-python)
   - 2.8 [Pasos para iniciar la aplicación backend](#28-pasos-para-iniciar-la-aplicación-backend)
   - 2.9 [Modelo de datos](#29-modelo-de-datos)
   - 2.10 [Seguridad](#210-seguridad)

---

# 1. Documentación técnica del Frontend

El frontend es la **interfaz web administrativa** de SmartInvoice. Es una SPA (Single Page Application) construida sin frameworks ni paso de compilación, que consume íntegramente la API REST del backend y cubre todo el flujo del negocio: autenticación, gestión de proveedores, carga y procesamiento OCR de facturas, corrección de datos extraídos, bitácora, reportes y automatización RPA.

## 1.1 Tecnologías usadas

| Tecnología | Uso en el proyecto |
|---|---|
| **HTML5** | Estructura del *shell* de la SPA (`index.html`): layout con barra lateral, cabecera y contenedores globales (toasts, modales, overlay de carga). |
| **CSS3** (CSS plano, sin preprocesadores) | Sistema de estilos completo en `css/styles.css`, basado en variables CSS (`:root`) para la paleta y los tokens de diseño. Diseño responsivo. |
| **JavaScript Vanilla (ES2017+)** | Toda la lógica del cliente. Sin frameworks (no React/Vue/Angular) ni *bundlers*. Los scripts se cargan con `defer` y comparten un espacio de nombres global `SI_*`. |
| **Fetch API** | Cliente HTTP nativo del navegador para consumir la API REST. |
| **Chart.js 4.4.1** (vía CDN) | Única dependencia externa. Se usa solo para las gráficas del Dashboard (facturas por estado y actividad por tipo de acción). |
| **Web Storage (`localStorage`)** | Persistencia del token JWT, del usuario en sesión y de la URL del backend configurada por el usuario. |
| **SVG inline** | Íconos de navegación y logotipo, embebidos directamente en el HTML/JS (sin librerías de íconos). |
| **Nginx 1.27 (Alpine)** + **Docker** | Servidor estático para el despliegue. `docker-entrypoint.sh` inyecta la URL del backend en tiempo de arranque sin reconstruir la imagen. |

No existe `package.json` ni dependencias de `node_modules` para la ejecución: el sitio es 100% estático. Basta con servir la carpeta con cualquier servidor HTTP.

## 1.2 Patrón de diseño usado

El frontend implementa un patrón **SPA modular con enrutamiento por hash y separación por capas (vista / estado / servicio)**, que en la práctica es una variante artesanal del patrón **MV* (Modelo–Vista–Controlador / patrón mediador por módulos)**:

- **Módulo de configuración (`config.js`)**: resuelve la URL base del API y expone constantes globales (`SI_CONFIG`).
- **Capa de estado / modelo (`store.js`)**: encapsula la sesión (token + usuario) y los formateadores de datos (moneda en quetzales, fechas locales `es-GT`, iniciales). Expone `SI_STORE` y `SI_FMT`.
- **Capa de servicio / acceso a datos (`api.js`)**: cliente REST único (`SI_API`) que centraliza el `fetch`, la inyección del header `Authorization: Bearer`, el manejo uniforme de errores (incluida la traducción de errores de validación de Pydantic) y la descarga autenticada de archivos.
- **Controlador de navegación (`router.js`)**: enrutador por *hash* (`#/ruta`) con soporte de parámetros (`/facturas/:id`), *guards* de rol (vistas solo-admin) y resaltado del menú activo.
- **Capa de presentación / utilidades (`ui.js`)**: *helpers* de creación de DOM (`h()`), toasts, modales, *badges*, estados de carga/vacío y escape de HTML.
- **Vistas (`js/views/*.js`)**: una vista por dominio del backend. Cada vista se autorregistra en `window.SI_VIEWS` y expone una función `render(root, ctx)` que el router invoca.
- **Orquestador / arranque (`app.js`)**: registra las rutas, construye el menú lateral, controla la transición entre pantalla de login y aplicación, y gestiona el ciclo de sesión (auto-logout ante `401`).

**Por qué este patrón:** permite una aplicación de una sola página, mantenible y de carga inmediata, sin la complejidad de un *framework* ni un paso de *build*. La separación en módulos con responsabilidades únicas (estado, servicios, router, UI, vistas) favorece la legibilidad, la prueba manual aislada de cada vista y el cumplimiento del principio de responsabilidad única.

## 1.3 Responsabilidad de cada vista

Cada archivo en `js/views/` representa una pantalla del sistema y consume uno o varios dominios de la API:

| Vista (archivo) | Ruta | Responsabilidad |
|---|---|---|
| **Login / Registro** (`login.js`) | (pantalla de autenticación, fuera del *shell*) | Inicio de sesión con email y contraseña (flujo OAuth2 `x-www-form-urlencoded`), registro de nuevos usuarios y configuración de la URL del servidor backend. Es la puerta de entrada a la aplicación. |
| **Dashboard** (`dashboard.js`) | `#/` | Panel de inicio con tarjetas de métricas y gráficas (Chart.js): distribución de facturas por estado y actividad por tipo de acción. Punto de partida con accesos directos a "Cargar factura" y "Generar reporte". |
| **Facturas** (`facturas.js`) | `#/facturas` | Listado de facturas con filtros (estado, proveedor, rango de fechas) y paginación. Carga de archivos por *arrastrar y soltar* (PDF/JPG/JPEG/PNG, máx. 20 MB), selección múltiple y disparo del OCR individual o por lote. |
| **Detalle de factura** (`factura-detalle.js`) | `#/facturas/:id` | Detalle por pestañas de una factura: datos extraídos por OCR, nivel de confianza, validación de coherencia, texto crudo, formulario de corrección manual, bitácora de la factura y acción RPA (registro en formulario). |
| **Proveedores** (`proveedores.js`) | `#/proveedores` | CRUD completo del catálogo de proveedores, búsqueda por nombre/NIT, paginación y *soft-delete*. Las acciones de escritura (crear/editar/desactivar) solo se muestran a usuarios con rol `admin`. |
| **Bitácora** (`bitacora.js`) | `#/bitacora` | Consulta cronológica de todas las operaciones del sistema, con filtros por acción, estado, usuario y rango de fechas, y detalle técnico de cada evento (auditoría). |
| **Reportes** (`reportes.js`) | `#/reportes` | Generación de reportes (PDF/Excel/CSV) con filtros, listado, descarga autenticada (vía *blob*) y envío por correo mediante RPA. |
| **RPA / Automatización** (`rpa.js`) | `#/rpa` | Registro automático de facturas en un formulario web externo (bot Playwright), envío de reportes por correo e historial de ejecuciones RPA. |
| **Mi perfil** (`perfil.js`) | `#/perfil` | Consulta y actualización de los datos de la cuenta del usuario autenticado (`GET`/`PUT /auth/me`). |

Existe además una vista implícita de **"Página no encontrada"** gestionada por el router cuando la ruta no coincide con ningún patrón registrado.

## 1.4 Distribución de carpetas

```
smart_invoice_frontend/
├── index.html              # Shell de la SPA (layout, orden de carga de scripts)
├── env.js                  # URL pública del backend (se inyecta en despliegue)
├── css/
│   └── styles.css          # Sistema de estilos, variables y paleta de colores
├── js/
│   ├── config.js           # Resolución de la URL del API y constantes globales (SI_CONFIG)
│   ├── store.js            # Sesión (token/usuario) + formateadores (SI_STORE / SI_FMT)
│   ├── ui.js               # Helpers de UI: DOM, toasts, modales, badges, loading (SI_UI)
│   ├── api.js              # Cliente REST: fetch + JWT + manejo de errores (SI_API)
│   ├── router.js           # Router por hash con parámetros y guards (SI_ROUTER)
│   ├── app.js              # Arranque, navegación, control de sesión
│   └── views/              # Una vista por dominio del backend
│       ├── login.js
│       ├── dashboard.js
│       ├── facturas.js
│       ├── factura-detalle.js
│       ├── proveedores.js
│       ├── bitacora.js
│       ├── reportes.js
│       ├── rpa.js
│       └── perfil.js
├── Dockerfile              # Imagen Nginx con el sitio estático
├── nginx.conf              # Configuración Nginx (SPA + proxy opcional al backend)
├── docker-entrypoint.sh    # Inyecta API_URL en env.js al arrancar el contenedor
└── docker-compose.yml      # Servicio frontend independiente (puerto 8080)
```

**Orden de carga (definido en `index.html`):** primero las dependencias externas (Chart.js) y la configuración de entorno (`env.js`); luego el núcleo (`config → store → ui → api → router`); después las vistas; y por último el arranque (`app.js`). Todo se carga con `defer` para no bloquear el renderizado.

## 1.5 Tecnología para consumir la API REST del backend

El consumo de la API se centraliza en un **único cliente REST** (`js/api.js`, expuesto como `window.SI_API`), construido sobre la **Fetch API** nativa del navegador. Sus características técnicas:

- **Resolución dinámica de la URL base** (`config.js`), con el siguiente orden de prioridad:
  1. Valor guardado por el usuario en `localStorage` (configurable desde la pantalla de login).
  2. `window.__SMARTINVOICE_API__` definido en `env.js` (recomendado para despliegue; lo inyecta Docker).
  3. El mismo host en el puerto `8000` (caso típico en la nube / Docker Compose).
  4. `http://localhost:8000` (desarrollo local).
- **Prefijo de API:** todas las rutas de negocio usan el prefijo `/api/v1`; las rutas de salud (`/` y `/health`) se llaman sin prefijo.
- **Autenticación JWT automática:** si existe token en sesión, se adjunta el header `Authorization: Bearer <token>` en cada petición (salvo las marcadas `noAuth`, como login/registro).
- **Tres formatos de cuerpo según el endpoint:**
  - `application/x-www-form-urlencoded` para el login (compatible con el flujo OAuth2 del backend, campo `username` = email).
  - `application/json` para la mayoría de operaciones (CRUD, generación de reportes, etc.).
  - `multipart/form-data` (`FormData`) para la carga de archivos de factura.
- **Manejo uniforme de errores:** una clase `ApiError` encapsula el estado HTTP y el *payload*. La función `extractMessage()` traduce los errores del backend a mensajes legibles, incluidos los errores de validación de **Pydantic (HTTP 422)**, que llegan como arreglo de detalles.
- **Auto-logout:** ante una respuesta `401 Unauthorized`, el cliente emite un evento global `si:unauthorized` que fuerza el cierre de sesión y el regreso a la pantalla de login.
- **Descarga autenticada de archivos:** los reportes se descargan como `blob` (modo `raw`), respetando el header `Content-Disposition` para el nombre del archivo.

El cliente expone un método por cada endpoint del backend, agrupados por dominio (`auth`, `proveedores`, `facturas`, `ocr`, `bitacora`, `reportes`, `rpa`), además de un *helper* `qs()` para construir *query strings* a partir de objetos.

## 1.6 Paleta de colores

La paleta es de marca, en tonos verdes (estilo "salvia / naturaleza"), definida como variables CSS en `:root` (`css/styles.css`):

| Token CSS | Hex | Nombre / uso |
|---|---|---|
| `--sage` | `#A3B18A` | Verde salvia claro (acentos, puntos, detalles) |
| `--beige` | `#DAD7CD` | Beige / gris claro (fondos suaves, pantalla de auth) |
| `--green` | `#588157` | Verde medio — **color primario** (botones, énfasis) |
| `--green-dark` | `#3A5A40` | Verde oscuro (enlaces, *hover*, trazos) |
| `--green-darker` | `#344E41` | Verde muy oscuro (texto, barra lateral) |

**Tokens neutros y de superficie:**

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#f3f4ef` | Fondo general de la aplicación |
| `--surface` | `#ffffff` | Tarjetas y superficies |
| `--surface-2` | `#f7f8f3` | Superficie secundaria |
| `--border` | `#e1e3da` | Bordes |
| `--text` | `#29342b` | Texto principal |
| `--text-soft` | `#5d6b5f` | Texto secundario |
| `--text-mute` | `#8a968b` | Texto atenuado |

**Tokens semánticos de estado** (para *badges*, toasts y validaciones):

| Estado | Color | Fondo |
|---|---|---|
| Éxito (`--ok`) | `#2f7d4f` | `#e6f2e9` |
| Advertencia (`--warn`) | `#b9821f` | `#fbf2e0` |
| Error (`--err`) | `#b3402f` | `#f8e7e3` |
| Información (`--info`) | `#3a5a40` | `#e9efe9` |

**Colores de las gráficas del Dashboard** (estados de factura): Procesado `#588157`, Pendiente `#A3B18A`, Error `#b3402f`, Rechazado `#3A5A40`.

Otros tokens de diseño: radios (`--radius: 12px`, `--radius-sm: 8px`), sombras (`--shadow`, `--shadow-lg`), ancho de barra lateral (`--sidebar-w: 244px`) y tipografía (`--font: 'Segoe UI', system-ui, ...`).

## 1.7 Notas técnicas adicionales del frontend

- **Sin paso de compilación:** los scripts se cargan con `defer` y comparten un espacio de nombres global (`SI_CONFIG`, `SI_STORE`, `SI_API`, `SI_UI`, `SI_ROUTER`, `SI_VIEWS`, `SI_FMT`). Cada archivo es un IIFE (`(function(){ 'use strict'; ... })()`) para evitar contaminar el ámbito global.
- **Control de roles en la UI:** las acciones de escritura (crear/editar/eliminar proveedores, eliminar facturas, etc.) se ocultan o bloquean según el rol del usuario (`SI_STORE.isAdmin()`), reforzando en el cliente la autorización que aplica el backend.
- **Localización:** formato de moneda en quetzales (`Q`) y fechas en configuración regional `es-GT`.
- **Experiencia de usuario:** toasts, modales, estados de carga (esqueletos/*spinner*) y estados vacíos consistentes a través de `ui.js`. Diseño responsivo con barra lateral colapsable en móvil.
- **Despliegue flexible:** Nginx sirve la SPA con *fallback* a `index.html` (para soportar F5), compresión gzip y caché de estáticos. La URL del backend se configura sin reconstruir la imagen mediante la variable de entorno `API_URL`.
- **CORS:** el backend solo acepta los orígenes definidos en su variable `CORS_ORIGINS` (incluye `http://localhost:8080` por defecto). Al desplegar, debe agregarse la URL pública del frontend.

---

# 2. Documentación técnica del Backend

El backend es una **API REST** que implementa el procesamiento inteligente de facturas: recibe los archivos, ejecuta el pipeline de **OCR (Tesseract) con preprocesamiento de Computer Vision (OpenCV)**, extrae y valida los datos, los persiste en base de datos relacional, genera reportes (PDF/Excel/CSV) y ejecuta automatizaciones **RPA** (registro en formulario web con Playwright y envío de correos SMTP). Toda la operación queda auditada en una bitácora.

## 2.1 Tecnologías usadas

| Tecnología | Versión | Uso |
|---|---|---|
| **Python** | 3.11+ | Lenguaje base del backend (100% Python). |
| **FastAPI** | 0.111.0 | Framework web/API REST; documentación interactiva automática (Swagger UI en `/docs`). |
| **Uvicorn** | 0.30.1 | Servidor ASGI para ejecutar la aplicación. |
| **SQLAlchemy** | 2.0.30 | ORM para el mapeo objeto-relacional y el acceso a la base de datos. |
| **PyMySQL** | 1.1.0 | Driver de conexión a MySQL. |
| **MySQL** | 8.0 | Base de datos relacional (`smart_invoice`). |
| **Pydantic** / **Pydantic-Settings** | 2.7.1 / 2.3.0 | Validación de datos (DTOs/schemas) y carga de configuración desde `.env`. |
| **python-jose** | 3.3.0 | Firma y verificación de JSON Web Tokens (JWT, algoritmo HS256). |
| **passlib[bcrypt]** / **bcrypt** | 1.7.4 / 4.0.1 | Hashing seguro de contraseñas con bcrypt. |
| **pytesseract** (Tesseract OCR) | 0.3.13 | Motor de OCR; reconocimiento de texto en idioma español + inglés (`spa+eng`). |
| **opencv-python-headless** | 4.9.0.80 | Computer Vision: preprocesamiento de imágenes para mejorar el OCR. |
| **pdf2image** (+ Poppler) | 1.17.0 | Conversión de PDF a imágenes para el OCR. |
| **Pillow** / **NumPy** | 10.3.0 / 1.26.4 | Manipulación de imágenes y arreglos numéricos. |
| **ReportLab** | 4.2.0 | Generación de reportes en PDF. |
| **openpyxl** | 3.1.4 | Generación de reportes en Excel (.xlsx). |
| **Playwright** | 1.44.0 | RPA: automatización de navegador (Chromium) para registrar datos en un formulario web. |
| **smtplib** (librería estándar) | — | Envío de reportes por correo electrónico (SMTP). |
| **Docker / Docker Compose** | — | Empaquetado y orquestación (backend + MySQL + frontend + formulario RPA). |

> **Carga perezosa de dependencias pesadas:** los módulos de OCR (OpenCV, Tesseract), conversión de PDF (Poppler) y RPA (Playwright) se importan de forma diferida. Esto permite que la API arranque y que los módulos de autenticación, proveedores, facturas, bitácora y reportes funcionen aunque esas librerías no estén instaladas localmente. Para el procesamiento completo se recomienda usar Docker.

## 2.2 Patrón de diseño usado

El backend implementa una **arquitectura en capas (Layered Architecture)** con el patrón **Router → Service → Model (Repository/ORM)**, complementada con el patrón **DTO (Data Transfer Object)** mediante schemas de Pydantic y el patrón **Dependency Injection** propio de FastAPI.

**Capas:**

1. **Routers (capa de presentación / controladores HTTP)** — `app/routers/`: definen las rutas, validan la entrada/salida con schemas Pydantic, aplican la autenticación/autorización (dependencias `CurrentUser`/`AdminUser`) y delegan la lógica a los servicios. No contienen lógica de negocio.
2. **Services (capa de lógica de negocio)** — `app/services/`: concentran las reglas del dominio (pipeline OCR, extracción, validación, generación de reportes, RPA, bitácora, auth). **No dependen de HTTP**, lo que facilita las pruebas y el mantenimiento.
3. **Models (capa de datos / ORM)** — `app/models/`: modelos SQLAlchemy que mapean las tablas de la base de datos.
4. **Schemas (DTOs)** — `app/schemas/`: contratos de entrada y salida (request/response) con validación Pydantic v2, desacoplados de los modelos de la base de datos.
5. **Core / Utils** — `app/core/` (seguridad JWT, dependencias inyectables, manejo de excepciones) y `app/utils/` (manejo de archivos, conversión de PDF).

**¿Por qué este patrón (arquitectura en capas + Router/Service/Model)?**

- **Separación de responsabilidades (SoC):** cada capa tiene una única razón de cambio. Modificar una regla de validación no toca el router ni el modelo.
- **Independencia de la lógica respecto del transporte:** como los servicios no conocen HTTP, la lógica de negocio puede probarse de forma aislada y reutilizarse (por ejemplo, el OCR se invoca tanto desde el endpoint individual como desde el de procesamiento por lote).
- **Mantenibilidad y escalabilidad:** la organización por dominios (auth, proveedores, facturas, ocr, bitácora, reportes, rpa) hace el código predecible y fácil de extender con nuevos módulos.
- **Validación robusta y contratos explícitos:** los DTOs de Pydantic garantizan que los datos que entran y salen de la API cumplan el contrato, y generan automáticamente la documentación OpenAPI/Swagger.
- **Bajo acoplamiento mediante inyección de dependencias:** la sesión de base de datos y el usuario autenticado se inyectan como dependencias de FastAPI, evitando estado global y facilitando el reemplazo en pruebas.

> No se utiliza el patrón **MVC** clásico (no hay "vistas" renderizadas en el servidor: la presentación vive en el frontend), sino el equivalente para APIs: **arquitectura por capas con controladores REST**.

## 2.3 Detalle de cada endpoint

**Base URL:** `http://localhost:8000` · **Prefijo común:** `/api/v1` · **Autenticación:** JWT Bearer (salvo login, registro y salud). La documentación interactiva completa está disponible en `/docs` (Swagger UI).

Convenciones de los campos de cada endpoint:
- **Auth**: 🔓 público · 🔒 requiere token · 👑 requiere rol `admin`.

### 2.3.1 Salud (`/`)

| | |
|---|---|
| **URL** | `GET /` y `GET /health` |
| **Auth** | 🔓 público |
| **Path/Query Param** | — |
| **Request Body** | — |
| **Response Body** | `/` → `{ app, version, docs, api_prefix }`. `/health` → `{ status: "ok"\|"degraded", database: true\|false }` |
| **Responsabilidad** | Endpoints informativos y de *healthcheck*; `/health` verifica la conectividad con la base de datos. Usados por el frontend para validar la conexión. |

### 2.3.2 Autenticación — `/api/v1/auth`

| Método y URL | Auth | Request Body | Query/Path Param | Response Body | Responsabilidad |
|---|---|---|---|---|---|
| `POST /auth/login` | 🔓 | `application/x-www-form-urlencoded`: `username` (email), `password` | — | `Token`: `{ access_token, token_type: "bearer", user }` | Autentica al usuario (email + contraseña) y devuelve un JWT. Registra el intento en bitácora (LOGIN, EXITOSO/FALLIDO). |
| `POST /auth/register` | 🔓 | `UserCreate`: `{ nombre, email, password, rol? }` | — | `UserRead` (201) | Registra un nuevo usuario en el sistema (rol por defecto `usuario`). |
| `GET /auth/me` | 🔒 | — | — | `UserRead` | Devuelve el perfil del usuario autenticado. |
| `PUT /auth/me` | 🔒 | `UserUpdate`: `{ nombre?, email?, password? }` | — | `UserRead` | Actualiza el perfil del usuario autenticado. |

### 2.3.3 Proveedores — `/api/v1/proveedores`

| Método y URL | Auth | Request Body | Query/Path Param | Response Body | Responsabilidad |
|---|---|---|---|---|---|
| `GET /proveedores` | 🔒 | — | Query: `skip` (≥0), `limit` (1–200), `solo_activos` (bool) | `ProveedorList`: `{ total, items[] }` | Lista paginada de proveedores. |
| `GET /proveedores/buscar` | 🔒 | — | Query: `q` (texto) | `ProveedorRead[]` | Busca proveedores por nombre o NIT. |
| `GET /proveedores/{proveedor_id}` | 🔒 | — | Path: `proveedor_id` | `ProveedorRead` | Obtiene un proveedor por su ID. |
| `POST /proveedores` | 👑 | `ProveedorCreate`: `{ nombre, nit, direccion?, telefono?, email? }` | — | `ProveedorRead` (201) | Crea un proveedor. Solo admin. Registra en bitácora (CRUD_PROVEEDOR). |
| `PUT /proveedores/{proveedor_id}` | 👑 | `ProveedorUpdate`: `{ nombre?, nit?, direccion?, telefono?, email?, activo? }` | Path: `proveedor_id` | `ProveedorRead` | Actualiza un proveedor existente. Solo admin. |
| `DELETE /proveedores/{proveedor_id}` | 👑 | — | Path: `proveedor_id` | `{ detail }` | *Soft-delete* (desactiva) un proveedor. Solo admin. |

### 2.3.4 Facturas — `/api/v1/facturas`

| Método y URL | Auth | Request Body | Query/Path Param | Response Body | Responsabilidad |
|---|---|---|---|---|---|
| `POST /facturas/upload` | 🔒 | `multipart/form-data`: `file` (PDF/JPG/JPEG/PNG, máx. 20 MB) | — | `FacturaUploadResponse`: `{ id, nombre_archivo_original, tipo_archivo, estado, mensaje }` (201) | Carga un archivo de factura, lo guarda en disco con nombre UUID y crea el registro en estado `Pendiente`. |
| `GET /facturas` | 🔒 | — | Query: `estado?`, `proveedor_id?`, `fecha_inicio?`, `fecha_fin?`, `skip`, `limit` | `FacturaList`: `{ total, items[] }` | Lista facturas con filtros por estado, proveedor y rango de fechas. |
| `GET /facturas/{factura_id}` | 🔒 | — | Path: `factura_id` | `FacturaDetail` (incluye `proveedor` y `datos_extraidos`) | Detalle completo de una factura. |
| `GET /facturas/{factura_id}/datos` | 🔒 | — | Path: `factura_id` | `DatoExtraidoRead` | Devuelve solo los datos extraídos por OCR (404 si aún no hay datos). |
| `PUT /facturas/{factura_id}/datos` | 🔒 | `DatoExtraidoUpdate`: campos extraídos + `validado?`, `observaciones_validacion?` | Path: `factura_id` | `DatoExtraidoRead` | Corrección manual de los datos extraídos de una factura. |
| `DELETE /facturas/{factura_id}` | 👑 | — | Path: `factura_id` | `{ detail }` | Elimina la factura y su archivo del disco. Solo admin. |

### 2.3.5 OCR / Procesamiento — `/api/v1/ocr`

| Método y URL | Auth | Request Body | Query/Path Param | Response Body | Responsabilidad |
|---|---|---|---|---|---|
| `POST /ocr/procesar/{factura_id}` | 🔒 | — | Path: `factura_id` | `DatoExtraidoRead` | Ejecuta el **pipeline OCR completo** para una factura (preprocesamiento → Tesseract → extracción → validación → persistencia) y actualiza su estado. |
| `POST /ocr/procesar-lote` | 👑 | `application/json`: `{ factura_ids: [int] }` | — | `{ procesadas, resultados[] }` | Procesa múltiples facturas en secuencia. Solo admin. Tolerante a fallos por factura. |
| `GET /ocr/estado/{factura_id}` | 🔒 | — | Path: `factura_id` | `{ factura_id, estado, validado, confianza_ocr, observaciones }` | Consulta el estado de procesamiento y un resumen de la factura. |

### 2.3.6 Bitácora — `/api/v1/bitacora`

| Método y URL | Auth | Request Body | Query/Path Param | Response Body | Responsabilidad |
|---|---|---|---|---|---|
| `GET /bitacora` | 🔒 | — | Query: `accion?`, `estado?`, `usuario_id?`, `fecha_inicio?`, `fecha_fin?`, `skip`, `limit` | `BitacoraList`: `{ total, items[] }` | Lista paginada de eventos de auditoría con filtros. |
| `GET /bitacora/factura/{factura_id}` | 🔒 | — | Path: `factura_id` | `BitacoraRead[]` | Historial completo de eventos de una factura específica. |
| `GET /bitacora/{bitacora_id}` | 🔒 | — | Path: `bitacora_id` | `BitacoraRead` | Detalle de una entrada de bitácora (404 si no existe). |

### 2.3.7 Reportes — `/api/v1/reportes`

| Método y URL | Auth | Request Body | Query/Path Param | Response Body | Responsabilidad |
|---|---|---|---|---|---|
| `POST /reportes/generar` | 🔒 | `ReporteCreate`: `{ tipo: PDF\|EXCEL\|CSV, nombre?, fecha_inicio?, fecha_fin?, proveedor_id?, incluir_rechazados? }` | — | `ReporteRead` (201) | Genera un reporte administrativo (PDF/Excel/CSV) con los filtros indicados y lo guarda en disco. |
| `GET /reportes` | 🔒 | — | Query: `skip`, `limit` | `ReporteList`: `{ total, items[] }` | Lista los reportes generados. |
| `GET /reportes/{reporte_id}` | 🔒 | — | Path: `reporte_id` | `ReporteRead` | Metadatos de un reporte específico. |
| `GET /reportes/{reporte_id}/descargar` | 🔒 | — | Path: `reporte_id` | Archivo físico (`FileResponse`: PDF/Excel/CSV) | Descarga el archivo del reporte (404 si no existe en disco). |
| `DELETE /reportes/{reporte_id}` | 👑 | — | Path: `reporte_id` | `{ detail }` | Elimina el reporte y su archivo. Solo admin. |

### 2.3.8 RPA / Automatización — `/api/v1/rpa`

| Método y URL | Auth | Request Body | Query/Path Param | Response Body | Responsabilidad |
|---|---|---|---|---|---|
| `POST /rpa/registrar-formulario/{factura_id}` | 🔒 | — | Path: `factura_id` | `{ ok, factura_id, campos }` | Ejecuta el bot RPA (Playwright) que abre el formulario web configurado (`RPA_FORM_URL`) y lo rellena con los datos de la factura. Requiere OCR previo. |
| `POST /rpa/enviar-reporte/{reporte_id}` | 🔒 | `EnvioReporteRequest`: `{ destinatario }` | Path: `reporte_id` | `{ ok, reporte_id, destinatario }` | Envía un reporte por correo electrónico (automatización de notificación SMTP). |
| `GET /rpa/historial` | 🔒 | — | — | `BitacoraRead[]` | Lista las ejecuciones RPA pasadas (acciones `RPA_FORMULARIO` y `ENVIO_EMAIL`), ordenadas por fecha descendente. |

## 2.4 Distribución de carpetas

```
smart_invoice_backend/
├── app/
│   ├── main.py             # Instancia FastAPI, CORS, manejadores de excepciones, eventos de ciclo de vida, registro de routers
│   ├── config.py           # Configuración (Pydantic Settings): BD, JWT, OCR, SMTP, RPA, CORS
│   ├── database.py         # Engine SQLAlchemy + fábrica de sesiones (get_db)
│   ├── models/             # Modelos ORM (mapeo de tablas)
│   │   ├── user.py  proveedor.py  factura.py
│   │   ├── dato_extraido.py  bitacora.py  reporte.py
│   ├── schemas/            # DTOs Pydantic v2 (request/response) por dominio
│   │   ├── user.py  proveedor.py  factura.py
│   │   ├── dato_extraido.py  bitacora.py  reporte.py
│   ├── routers/            # Endpoints por dominio (capa HTTP)
│   │   ├── auth.py  proveedores.py  facturas.py  ocr.py
│   │   ├── bitacora.py  reportes.py  rpa.py
│   ├── services/           # Lógica de negocio
│   │   ├── auth_service.py        # Autenticación y gestión de usuarios
│   │   ├── proveedor_service.py   # CRUD de proveedores
│   │   ├── factura_service.py     # Carga/consulta/borrado de facturas
│   │   ├── ocr_service.py         # Orquestador del pipeline OCR
│   │   ├── cv_service.py          # Computer Vision (OpenCV): preprocesamiento
│   │   ├── extraction_service.py  # Extracción de campos (regex/heurísticas)
│   │   ├── validation_service.py  # Reglas de validación de los datos extraídos
│   │   ├── reporte_service.py     # Generación de reportes (PDF/Excel/CSV)
│   │   ├── rpa_service.py         # RPA (Playwright) + disparo de correo
│   │   ├── email_service.py       # Envío de correos (SMTP)
│   │   └── bitacora_service.py    # Registro de auditoría
│   ├── core/               # Transversales
│   │   ├── security.py     # Hashing bcrypt + JWT (crear/validar tokens)
│   │   ├── dependencies.py # Inyección: sesión BD, usuario actual, guard admin
│   │   └── exceptions.py   # Excepciones de dominio + handlers
│   └── utils/              # Utilidades
│       ├── file_handler.py    # Guardar/eliminar archivos, validar tipo y tamaño
│       └── pdf_converter.py   # Conversión PDF → imágenes (pdf2image/Poppler)
├── db/
│   └── init/01-schema.sql  # Esquema MySQL + datos semilla (se ejecuta al crear el volumen)
├── scripts/
│   ├── create_admin.py     # Crea un usuario administrador
│   └── smoke_test.py       # Prueba de humo de la API
├── uploads/                # Archivos de facturas subidos (UUID en disco)
├── reports/                # Reportes generados (PDF/Excel/CSV)
├── requirements.txt        # Dependencias Python
├── Dockerfile              # Imagen del backend (con Tesseract, Poppler, Chromium)
├── docker-compose.yml      # Orquesta backend + MySQL + frontend + rpa_form
├── .env.example            # Plantilla de variables de entorno
└── README.md
```

## 2.5 Manejo lógico de la aplicación (hechos y reglas)

> **Aclaración:** el enunciado pide describir los "hechos y reglas que se están usando para el manejo lógico de la aplicación (Prolog)". **Este proyecto no usa Prolog.** Toda la lógica está escrita en Python. A continuación se documentan, con la misma intención, los **hechos** (datos de partida) y las **reglas** (condiciones que decide el sistema) que gobiernan el comportamiento de la aplicación, tal como están implementadas en los servicios Python.

### Hechos (datos sobre los que opera el sistema)

Los "hechos" son los datos que entran al motor de decisión, principalmente el texto crudo del OCR y los campos extraídos de cada factura:

- **Texto OCR** de la factura (cadena completa reconocida por Tesseract).
- **Campos extraídos:** `numero_factura`, `fecha_factura`, `nombre_proveedor_ocr`, `nit_ocr`, `subtotal`, `impuestos`, `total`.
- **Catálogo de proveedores** existente (para asociar la factura por NIT).
- **Confianza del OCR** (porcentaje promedio devuelto por Tesseract).
- **Rol del usuario** (`admin` / `usuario`) y **estado de la factura** (`Pendiente`, `Procesado`, `Rechazado`, `Error`).

### Reglas de extracción (módulo `extraction_service.py`)

El sistema deduce los campos estructurados a partir del texto mediante expresiones regulares y heurísticas adaptadas a facturas guatemaltecas:

- **Número de factura:** se reconoce tras etiquetas como `factura / serie / no. / número / nro. / invoice`.
- **Fecha:** se prioriza la fecha etiquetada (`Fecha: …`); si no, la primera fecha del documento. Se aceptan múltiples formatos (`dd/mm/aaaa`, `aaaa-mm-dd`, etc.).
- **NIT:** patrón guatemalteco (`NIT: 1234567-8`), con un patrón "suelto" de respaldo.
- **Montos (subtotal, IVA/impuestos, total):** búsqueda **por línea** — se localiza la línea de la etiqueta y se toma el monto de esa misma línea; se ignoran porcentajes (`IVA 12%`) y se evita cruzar saltos de línea hacia la tabla de detalle. Al buscar `total` se excluye explícitamente la línea de `subtotal`.
- **Proveedor:** se prioriza la línea `Proveedor: <nombre>`; como respaldo, la primera línea con aspecto de nombre (descartando palabras reservadas como `factura`, `nit`, `fecha`, `total`, etc.).
- **Inferencias:** si falta el `total` pero hay `subtotal`, se calcula `total = subtotal + impuestos`; si falta el `subtotal` pero hay `total` e `impuestos`, se calcula `subtotal = total − impuestos`.

### Reglas de validación (módulo `validation_service.py`)

Tras la extracción, el sistema decide si los datos son coherentes. Una factura es **válida** solo si **no** se incumple ninguna de estas reglas:

1. **Montos no negativos:** `subtotal`, `impuestos` y `total` no pueden ser negativos.
2. **Coherencia matemática:** `total ≈ subtotal + impuestos`, con una **tolerancia del 1%** (y un margen mínimo absoluto de 1 unidad) para absorber errores de redondeo/OCR.
3. **Fecha no futura:** la `fecha_factura` no puede ser posterior a la fecha actual.
4. **Formato de NIT válido:** debe cumplir el patrón `^\d{1,9}-?[0-9kK]$`.
5. **Total identificable:** debe existir un `total` reconocible; si no, la factura no puede validarse.

### Reglas de decisión del flujo (módulo `ocr_service.py`)

- Si la validación es **exitosa** → la factura pasa a estado **`Procesado`** y `validado = 1`.
- Si la validación **falla** → la factura pasa a **`Rechazado`**, `validado = 0` y se guardan las observaciones.
- Si ocurre una **excepción** durante el pipeline → la factura pasa a **`Error`** y se registra el detalle técnico (*traceback*) en la bitácora.
- Si el `nit_ocr` coincide con un proveedor del catálogo → la factura se **asocia automáticamente** a ese proveedor.

### Reglas de autorización

- Operaciones de escritura sobre proveedores, borrado de facturas/reportes y procesamiento por lote → **solo rol `admin`**.
- Toda petición a endpoints protegidos requiere un **JWT válido y vigente**; un usuario `inactivo` es rechazado (403).

## 2.6 Responsabilidades de la capa lógica (equivalente a Prolog)

Dado que **no se emplea Prolog**, las responsabilidades que en una arquitectura declarativa basada en reglas corresponderían a un motor Prolog (definir hechos, reglas e inferir conclusiones) están cubiertas por los siguientes módulos Python, que actúan como **motor de reglas del dominio**:

- **`extraction_service.py`** — *Motor de inferencia de campos.* A partir de los "hechos" (texto OCR), deduce los valores estructurados aplicando reglas (patrones regex y heurísticas por línea).
- **`validation_service.py`** — *Motor de reglas de negocio.* Evalúa el conjunto de reglas de coherencia y decide si los datos son válidos, devolviendo el resultado y las observaciones (equivalente a la "conclusión" inferida).
- **`ocr_service.py`** — *Orquestador de decisiones.* Encadena los hechos y las reglas anteriores y deriva el estado final de la factura (`Procesado` / `Rechazado` / `Error`) y sus efectos (asociación de proveedor, persistencia, auditoría).

En conjunto, estos tres módulos cumplen el rol que tendría la base de conocimiento + motor de inferencia: declaran las condiciones del dominio y derivan automáticamente el resultado del procesamiento de cada factura.

## 2.7 Responsabilidades de Python

Python es el **único lenguaje** del backend y asume la totalidad de las responsabilidades del sistema:

- **Exposición de la API REST** (FastAPI): definición de endpoints, validación de entrada/salida (Pydantic), documentación OpenAPI y manejo de errores.
- **Autenticación y autorización:** hashing de contraseñas (bcrypt), emisión/validación de JWT, *guards* por rol e inyección del usuario autenticado.
- **Persistencia:** mapeo objeto-relacional (SQLAlchemy), gestión de sesiones y transacciones contra MySQL.
- **Computer Vision (OpenCV):** preprocesamiento de imágenes — escala de grises, redimensionado, reducción de ruido, binarización Otsu y corrección de inclinación (*deskew*) — para mejorar la precisión del OCR.
- **OCR (Tesseract vía pytesseract):** reconocimiento de texto (`--oem 3 --psm 6`, idiomas `spa+eng`) y cálculo de la confianza promedio.
- **Conversión de documentos:** PDF → imágenes (pdf2image/Poppler) antes del OCR.
- **Extracción y validación de datos:** la lógica de negocio descrita en las secciones 2.5 y 2.6.
- **Generación de reportes:** PDF (ReportLab), Excel (openpyxl) y CSV (librería estándar).
- **RPA / automatización:** control de un navegador Chromium con Playwright para registrar datos en un formulario web externo, y envío de reportes por correo (SMTP con `smtplib`).
- **Auditoría:** registro de cada operación en la bitácora.
- **Configuración y arranque:** carga de variables de entorno, verificación de la conexión a la base de datos en el *startup* y creación de los directorios de trabajo (`uploads`, `reports`).

## 2.8 Pasos para iniciar la aplicación backend

### Opción A — Ejecución local (entorno virtual)

Requisitos previos: **Python 3.11+**, **MySQL 8** con la base de datos `smart_invoice` creada y, para el OCR/RPA completo, **Tesseract** (idioma `spa`), **Poppler** y el navegador de **Playwright**.

```bash
# 1. Crear y activar el entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate       # Linux/Mac

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. (Opcional, para OCR/RPA completo) instalar el navegador de Playwright
playwright install chromium

# 4. Configurar variables de entorno
copy .env.example .env           # Windows
# cp .env.example .env             # Linux/Mac
#  …editar .env con las credenciales de MySQL y, en Windows, las rutas de
#    TESSERACT_CMD y POPPLER_PATH.

# 5. Levantar el servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

- API disponible en: `http://localhost:8000`
- Documentación interactiva (Swagger UI): `http://localhost:8000/docs`

**Crear un usuario administrador** (credenciales conocidas):

```bash
python -m scripts.create_admin --email admin@smartinvoice.com --password Admin1234! --nombre "Administrador"
```

### Opción B — Ejecución con Docker Compose (recomendada)

El `docker-compose.yml` del backend levanta **todo el sistema** con las dependencias del sistema ya instaladas (Tesseract, Poppler, Chromium): MySQL, backend, frontend y el formulario RPA simulado.

```bash
cd smart_invoice_backend
docker compose up --build
```

Servicios y puertos publicados:

| Servicio | URL / Puerto | Descripción |
|---|---|---|
| `backend` | `http://localhost:8000` | API REST (Swagger en `/docs`) |
| `mysql` | `localhost:3307` → 3306 | Base de datos (esquema inicializado desde `db/init/`) |
| `frontend` | `http://localhost:8080` | Interfaz web (Nginx + SPA) |
| `rpa_form` | `http://localhost:3000` | Formulario web simulado (objetivo del RPA) |

> El esquema y los datos semilla de MySQL se cargan automáticamente desde `db/init/01-schema.sql` al crear el volumen por primera vez.

**Credenciales de ejemplo (semilla):** `admin@smartinvoice.com` / `Admin1234!`.

### Flujo típico de uso de la API

1. `POST /auth/login` → obtener el token Bearer.
2. `POST /facturas/upload` → subir una factura (PDF/JPG/JPEG/PNG).
3. `POST /ocr/procesar/{factura_id}` → ejecutar el pipeline OCR.
4. `GET /facturas/{id}` → ver los datos extraídos y validados.
5. `POST /reportes/generar` → generar un reporte.
6. `POST /rpa/enviar-reporte/{id}` → enviar el reporte por correo.

## 2.9 Modelo de datos

Base de datos relacional **MySQL 8** (`smart_invoice`). Tablas principales:

| Tabla | Descripción | Relaciones |
|---|---|---|
| `users` | Usuarios del sistema. Campos: `id`, `nombre`, `email` (único), `password_hash` (bcrypt), `rol` (`admin`/`usuario`), `activo` (soft-delete), `created_at`, `updated_at`. | 1—N con `facturas` y `reportes`. |
| `proveedores` | Catálogo de proveedores. Campos: `id`, `nombre`, `nit` (único), `direccion`, `telefono`, `email`, `activo`, timestamps. | 1—N con `facturas`. |
| `facturas` | Archivos de factura cargados. Campos: `id`, `nombre_archivo_original`, `nombre_archivo_almacenado` (UUID), `ruta_archivo`, `tipo_archivo` (PDF/JPG/JPEG/PNG), `estado` (Pendiente/Procesado/Rechazado/Error), `proveedor_id`, `usuario_id`, timestamps. | N—1 con `proveedores` y `users`; 1—1 con `datos_extraidos`. |
| `datos_extraidos` | Datos OCR de cada factura (relación 1:1). Campos: `numero_factura`, `fecha_factura`, `nombre_proveedor_ocr`, `nit_ocr`, `subtotal`, `impuestos`, `total` (DECIMAL 14,2), `texto_raw`, `confianza_ocr`, `validado`, `observaciones_validacion`, timestamps. | 1—1 con `facturas`. |
| `bitacora` | Auditoría de operaciones. Campos: `id`, `factura_id?`, `usuario_id?`, `fecha_hora`, `accion`, `estado` (EXITOSO/FALLIDO/PENDIENTE), `resultado`, `detalle`. | N—1 con `facturas` y `users`. |
| `reportes` | Reportes generados. Campos: `id`, `nombre`, `tipo` (PDF/EXCEL/CSV), `ruta_archivo`, `usuario_id`, filtros aplicados (`fecha_inicio`, `fecha_fin`, `proveedor_id`), `total_facturas`, `created_at`. | N—1 con `users` y `proveedores`. |

**Acciones registradas en bitácora:** `LOGIN`, `UPLOAD_FACTURA`, `OCR_PROCESO`, `EXTRACCION_DATOS`, `VALIDACION_DATOS`, `ALMACENAMIENTO_DATOS`, `GENERACION_REPORTE`, `ENVIO_EMAIL`, `RPA_FORMULARIO`, `CRUD_PROVEEDOR`.

## 2.10 Seguridad

- **Contraseñas:** se almacenan con hash **bcrypt** (`passlib`); nunca en texto plano.
- **Tokens JWT:** firmados con **HS256** (`python-jose`), con expiración configurable (`ACCESS_TOKEN_EXPIRE_MINUTES`, por defecto 480 min = 8 h). El *payload* incluye `sub` (id de usuario) y `rol`.
- **Autorización por rol:** dependencias `CurrentUser` (token válido + usuario activo) y `AdminUser` (además, rol `admin`).
- **CORS:** restringido a los orígenes declarados en `CORS_ORIGINS`.
- **Validación de archivos:** se valida tipo (PDF/JPG/JPEG/PNG) y tamaño máximo (`MAX_FILE_SIZE_MB`, 20 MB por defecto). Los archivos se almacenan con nombre UUID para evitar colisiones y *path traversal*.
- **Manejo de errores uniforme:** excepciones de dominio (`NotFoundError`, `ValidationError`, etc.) con *handlers* centralizados que devuelven respuestas HTTP consistentes.

---

### Servicio auxiliar — `smart_invoice_rpa_form`

Mini-servicio en Python (solo librería estándar, `http.server`) que representa un **sistema externo** al que el RPA ingresa los datos. Expone un formulario web (`GET/POST /formulario-simulado`) con los campos `numero_factura`, `fecha`, `proveedor`, `nit`, `total`, un tablero de registros recibidos (`GET /`), una API JSON (`GET /registros`) y un *healthcheck* (`GET /health`). Se levanta junto al resto del sistema en el `docker-compose.yml` del backend (servicio `rpa_form`, puerto 3000); el backend lo alcanza por la red interna de Docker en `http://rpa_form:3000/formulario-simulado`.

---

*Documento generado como manual técnico del proyecto SmartInvoice. La documentación interactiva y siempre actualizada de la API está disponible en `/docs` (Swagger UI) cuando el backend está en ejecución.*

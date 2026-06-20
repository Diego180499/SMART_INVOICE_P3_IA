# SmartInvoice — Frontend

Interfaz web administrativa de **SmartInvoice**, construida en **HTML5, CSS3 y JavaScript vanilla** (sin frameworks ni build step). Consume la API REST del microservicio `smart_invoice_backend` (FastAPI) y cubre todo el flujo: autenticación, gestión de proveedores, carga y procesamiento OCR de facturas, corrección de datos, bitácora, reportes y automatización RPA.

## Características

- **SPA modular** con enrutamiento por hash (sin recargas), una vista por servicio del backend.
- **Autenticación JWT**: login (OAuth2 `x-www-form-urlencoded`), registro y perfil. El token se guarda en el navegador y se adjunta automáticamente como `Authorization: Bearer`.
- **Dashboard** con tarjetas de métricas y gráficas (Chart.js): facturas por estado y actividad por tipo de acción.
- **Proveedores**: CRUD completo, búsqueda por nombre/NIT, paginación y soft-delete. Las acciones de escritura se muestran solo a usuarios `admin`.
- **Facturas**: carga por arrastrar-y-soltar (PDF/JPG/JPEG/PNG, máx. 20 MB), filtros por estado/proveedor/fechas, detalle por pestañas, disparo de OCR individual y por lote.
- **OCR y corrección**: visualización de campos extraídos, confianza, validación de coherencia (`total ≈ subtotal + impuestos`), texto crudo y formulario de corrección manual.
- **Bitácora**: consulta con filtros por acción, estado, usuario y rango de fechas; detalle técnico de cada evento.
- **Reportes**: generación (PDF/Excel/CSV) con filtros, descarga autenticada y envío por correo (RPA).
- **RPA**: registro de facturas en formulario web, envío de reportes por correo e historial de ejecuciones.
- **UX**: control de roles, toasts, modales, estados de carga/vacío, diseño responsivo y paleta de marca.

## Estructura

```
smart_invoice_frontend/
├── index.html              # Shell de la SPA (layout, carga de scripts)
├── env.js                  # URL del backend (se inyecta en despliegue)
├── css/
│   └── styles.css          # Sistema de estilos y paleta de colores
├── js/
│   ├── config.js           # Resolución de la URL del API
│   ├── store.js            # Sesión (token/usuario) y formateadores
│   ├── ui.js               # Helpers: DOM, toasts, modales, badges, loading
│   ├── api.js              # Cliente REST (fetch + JWT + manejo de errores)
│   ├── router.js           # Router por hash
│   ├── app.js              # Arranque, navegación y control de sesión
│   └── views/              # Una vista por dominio
│       ├── login.js  dashboard.js  proveedores.js
│       ├── facturas.js  factura-detalle.js
│       ├── bitacora.js  reportes.js  rpa.js  perfil.js
├── Dockerfile              # Imagen Nginx con el sitio estático
├── nginx.conf              # Configuración Nginx (SPA + proxy opcional)
├── docker-entrypoint.sh    # Inyecta API_URL en env.js al arrancar
└── docker-compose.yml      # Servicio frontend (puerto 8080)
```

## Configuración del backend (URL del API)

El frontend resuelve la URL del backend en este orden:

1. Valor guardado por el usuario en la pantalla de login → *Configuración del servidor*.
2. `window.__SMARTINVOICE_API__` definido en `env.js` (recomendado para despliegue).
3. El mismo host en el puerto `8000` (caso típico en la nube).
4. `http://localhost:8000` (desarrollo local).

> **CORS:** el backend solo acepta los orígenes definidos en `CORS_ORIGINS` de su `.env`
> (por defecto incluye `http://localhost:8080`). Al desplegar, agrega la URL pública del
> frontend a `CORS_ORIGINS` en el backend.

## Ejecución en local

Como es estático, basta con servir la carpeta con cualquier servidor HTTP. Asegúrate de que el backend esté corriendo en `http://localhost:8000`.

```bash
# Opción A: Python
cd smart_invoice_frontend
python -m http.server 8080
# → http://localhost:8080

# Opción B: Node
npx serve -l 8080 smart_invoice_frontend
```

Credenciales de ejemplo (semilla del backend): `admin@smartinvoice.com` / `Admin1234!`.

## Despliegue con Docker

```bash
cd smart_invoice_frontend
docker compose up -d --build
# → http://localhost:8080
```

Para apuntar a un backend en otra URL:

```bash
API_URL="https://api.tudominio.com" docker compose up -d --build
```

### Ejecutar frontend + backend juntos

Puedes añadir este servicio al `docker-compose.yml` raíz del backend:

```yaml
  frontend:
    build: ./smart_invoice_frontend
    container_name: smartinvoice_frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      API_URL: http://localhost:8000
    depends_on:
      - backend
```

Recuerda mantener `http://localhost:8080` (o tu dominio) en `CORS_ORIGINS` del backend.

## Endpoints consumidos

Cubre la totalidad de la API documentada en `curl-guide.md`: `/auth/*`, `/proveedores/*`, `/facturas/*`, `/ocr/*`, `/bitacora/*`, `/reportes/*` y `/rpa/*`, además de `/health` para verificar conectividad.

## Notas técnicas

- Sin dependencias de build: los scripts se cargan con `defer` y comparten un espacio de nombres global (`SI_*`); las vistas se registran en `window.SI_VIEWS`.
- Única dependencia externa: **Chart.js** vía CDN (solo para las gráficas del dashboard).
- Compatible con navegadores modernos (Fetch API, ES2017+).

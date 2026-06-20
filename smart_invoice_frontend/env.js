/* env.js — Configuración de entorno del frontend.
 *
 * En desarrollo local puede quedar vacío: el frontend usará automáticamente
 * http://localhost:8000 (o el mismo host en el puerto 8000).
 *
 * En despliegue, define aquí la URL pública del backend. El contenedor Docker
 * reescribe este archivo automáticamente a partir de la variable de entorno
 * API_URL (ver docker-entrypoint.sh).
 *
 * Ejemplo:
 *   window.__SMARTINVOICE_API__ = "https://api.tudominio.com";
 */
window.__SMARTINVOICE_API__ = window.__SMARTINVOICE_API__ || "";

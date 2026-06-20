/* api.js — Cliente REST de SmartInvoice (fetch + JWT + manejo de errores) */
(function () {
  'use strict';
  const C = window.SI_CONFIG;
  const Store = window.SI_STORE;

  class ApiError extends Error {
    constructor(message, status, payload) {
      super(message); this.name = 'ApiError'; this.status = status; this.payload = payload;
    }
  }

  function url(path) {
    const base = C.getApiBase().replace(/\/+$/, '');
    // Las rutas de salud ("/", "/health") van sin prefijo; el resto con /api/v1.
    if (path === '/' || path === '/health') return base + path;
    return base + C.API_PREFIX + path;
  }

  // Traduce errores del backend a un mensaje legible.
  function extractMessage(payload, status, fallback) {
    if (!payload) return fallback || `Error ${status}`;
    if (typeof payload === 'string') return payload;
    const d = payload.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) {
      // Errores de validación Pydantic (422)
      return d.map((e) => {
        const loc = Array.isArray(e.loc) ? e.loc.filter((x) => x !== 'body').join('.') : '';
        return (loc ? loc + ': ' : '') + (e.msg || 'inválido');
      }).join(' · ');
    }
    if (payload.message) return payload.message;
    return fallback || `Error ${status}`;
  }

  async function request(method, path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    const token = Store.getToken();
    if (token && !opts.noAuth) headers['Authorization'] = 'Bearer ' + token;

    let body;
    if (opts.form) {
      // application/x-www-form-urlencoded (login OAuth2)
      const p = new URLSearchParams();
      Object.keys(opts.form).forEach((k) => p.append(k, opts.form[k]));
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = p.toString();
    } else if (opts.file instanceof FormData) {
      body = opts.file; // multipart: el navegador define el boundary
    } else if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.json);
    }

    let res;
    try {
      res = await fetch(url(path), { method, headers, body, signal: opts.signal });
    } catch (netErr) {
      throw new ApiError(
        'No se pudo conectar con el servidor. Verifica que el backend esté en línea y la URL del API.',
        0, null,
      );
    }

    if (opts.raw) {
      if (!res.ok) {
        let payload = null; try { payload = await res.json(); } catch (_) {}
        throw new ApiError(extractMessage(payload, res.status), res.status, payload);
      }
      return res; // el llamador maneja blob/headers
    }

    let payload = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) { try { payload = await res.json(); } catch (_) {} }
    else { try { payload = await res.text(); } catch (_) {} }

    if (!res.ok) {
      if (res.status === 401 && !opts.noAuth) {
        // Token inválido / expirado → forzar re-login.
        window.dispatchEvent(new CustomEvent('si:unauthorized'));
      }
      throw new ApiError(extractMessage(payload, res.status), res.status, payload);
    }
    return payload;
  }

  const qs = (params) => {
    const p = new URLSearchParams();
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v !== null && v !== undefined && v !== '') p.append(k, v);
    });
    const s = p.toString();
    return s ? '?' + s : '';
  };

  const API = {
    ApiError,
    qs,
    raw: (method, path, opts) => request(method, path, Object.assign({ raw: true }, opts)),

    // -------- Salud --------
    health: () => request('GET', '/health', { noAuth: true }),
    info: () => request('GET', '/', { noAuth: true }),

    // -------- Auth --------
    login: (email, password) => request('POST', '/auth/login', { noAuth: true, form: { username: email, password } }),
    register: (data) => request('POST', '/auth/register', { noAuth: true, json: data }),
    me: () => request('GET', '/auth/me'),
    updateMe: (data) => request('PUT', '/auth/me', { json: data }),

    // -------- Proveedores --------
    proveedores: (params) => request('GET', '/proveedores' + qs(params)),
    proveedorBuscar: (q) => request('GET', '/proveedores/buscar' + qs({ q })),
    proveedor: (id) => request('GET', '/proveedores/' + id),
    proveedorCrear: (data) => request('POST', '/proveedores', { json: data }),
    proveedorActualizar: (id, data) => request('PUT', '/proveedores/' + id, { json: data }),
    proveedorEliminar: (id) => request('DELETE', '/proveedores/' + id),

    // -------- Facturas --------
    facturaUpload: (formData) => request('POST', '/facturas/upload', { file: formData }),
    facturas: (params) => request('GET', '/facturas' + qs(params)),
    factura: (id) => request('GET', '/facturas/' + id),
    facturaDatos: (id) => request('GET', '/facturas/' + id + '/datos'),
    facturaActualizarDatos: (id, data) => request('PUT', '/facturas/' + id + '/datos', { json: data }),
    facturaEliminar: (id) => request('DELETE', '/facturas/' + id),

    // -------- OCR --------
    ocrProcesar: (id) => request('POST', '/ocr/procesar/' + id),
    ocrProcesarLote: (ids) => request('POST', '/ocr/procesar-lote', { json: { factura_ids: ids } }),
    ocrEstado: (id) => request('GET', '/ocr/estado/' + id),

    // -------- Bitácora --------
    bitacora: (params) => request('GET', '/bitacora' + qs(params)),
    bitacoraFactura: (id) => request('GET', '/bitacora/factura/' + id),
    bitacoraDetalle: (id) => request('GET', '/bitacora/' + id),

    // -------- Reportes --------
    reportes: (params) => request('GET', '/reportes' + qs(params)),
    reporte: (id) => request('GET', '/reportes/' + id),
    reporteGenerar: (data) => request('POST', '/reportes/generar', { json: data }),
    reporteEliminar: (id) => request('DELETE', '/reportes/' + id),
    reporteDescargarUrl: (id) => url('/reportes/' + id + '/descargar'),
    reporteDescargar: (id) => request('GET', '/reportes/' + id + '/descargar', { raw: true }),

    // -------- RPA --------
    rpaRegistrarFormulario: (facturaId) => request('POST', '/rpa/registrar-formulario/' + facturaId),
    rpaEnviarReporte: (reporteId, destinatario) => request('POST', '/rpa/enviar-reporte/' + reporteId, { json: { destinatario } }),
    rpaHistorial: () => request('GET', '/rpa/historial'),
  };

  // Descarga autenticada de un archivo (reportes) usando blob.
  API.descargarArchivo = async function (id, filename) {
    const res = await API.reporteDescargar(id);
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const name = filename || (m && m[1]) || ('reporte_' + id);
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl; a.download = name; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(objUrl);
  };

  window.SI_API = API;
})();

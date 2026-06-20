/* config.js — Configuración global de SmartInvoice frontend */
(function () {
  'use strict';

  // URL del backend. Orden de prioridad:
  //   1) Valor guardado por el usuario (localStorage) — útil tras el despliegue.
  //   2) window.__SMARTINVOICE_API__ (se puede inyectar en index.html en producción).
  //   3) Mismo host en el puerto 8000 (caso típico Docker Compose / nube).
  //   4) http://localhost:8000 (desarrollo local).
  const LS_KEY = 'si_api_base';

  function defaultBase() {
    if (window.__SMARTINVOICE_API__) return window.__SMARTINVOICE_API__;
    try {
      const { protocol, hostname } = window.location;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && protocol.startsWith('http')) {
        return `${protocol}//${hostname}:8000`;
      }
    } catch (_) { /* noop */ }
    return 'http://localhost:8000';
  }

  function getApiBase() {
    const saved = localStorage.getItem(LS_KEY);
    return (saved && saved.trim()) || defaultBase();
  }

  function setApiBase(url) {
    if (url && url.trim()) localStorage.setItem(LS_KEY, url.trim().replace(/\/+$/, ''));
    else localStorage.removeItem(LS_KEY);
  }

  window.SI_CONFIG = {
    LS_KEY,
    API_PREFIX: '/api/v1',
    TOKEN_KEY: 'si_token',
    USER_KEY: 'si_user',
    getApiBase,
    setApiBase,
    defaultBase,
  };
})();

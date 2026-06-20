/* app.js — Arranque, layout, navegación y control de sesión */
(function () {
  'use strict';
  const Store = window.SI_STORE;
  const UI = window.SI_UI;
  const Router = window.SI_ROUTER;
  const Views = window.SI_VIEWS || {};
  const C = window.SI_CONFIG;

  // Íconos SVG inline para la navegación
  const ICONS = {
    dashboard: '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    facturas:  '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
    proveedores:'<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6M9 11h.01M15 11h.01"/></svg>',
    bitacora:  '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>',
    reportes:  '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5M4 19h16M8 17v-6M12 17V8M16 17v-9"/></svg>',
    rpa:       '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V4M9 13h.01M15 13h.01M9 17h6"/><path d="M4 13H2M22 13h-2"/></svg>',
    perfil:    '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  };

  const NAV = [
    { section: 'Principal' },
    { route: '/',            title: 'Dashboard',   icon: 'dashboard' },
    { route: '/facturas',    title: 'Facturas',    icon: 'facturas' },
    { route: '/proveedores', title: 'Proveedores', icon: 'proveedores' },
    { section: 'Operación' },
    { route: '/bitacora',    title: 'Bitácora',    icon: 'bitacora' },
    { route: '/reportes',    title: 'Reportes',    icon: 'reportes' },
    { route: '/rpa',         title: 'RPA',         icon: 'rpa' },
    { section: 'Cuenta' },
    { route: '/perfil',      title: 'Mi perfil',   icon: 'perfil' },
  ];

  // -------- Registro de rutas --------
  function registerRoutes() {
    Router.register('/',             Views.dashboard,      { title: 'Dashboard' });
    Router.register('/facturas',     Views.facturas,       { title: 'Facturas' });
    Router.register('/facturas/:id', Views.facturaDetalle, { title: 'Detalle de factura' });
    Router.register('/proveedores',  Views.proveedores,    { title: 'Proveedores' });
    Router.register('/bitacora',     Views.bitacora,       { title: 'Bitácora' });
    Router.register('/reportes',     Views.reportes,       { title: 'Reportes' });
    Router.register('/rpa',          Views.rpa,            { title: 'RPA / Automatización' });
    Router.register('/perfil',       Views.perfil,         { title: 'Mi perfil' });
    Router.setNotFound((root) => {
      UI.empty(root, { icon: '🧭', title: 'Página no encontrada',
        message: 'La ruta solicitada no existe.',
        action: UI.h('a', { class: 'btn btn--primary', href: '#/', text: 'Ir al inicio' }) });
    });
  }

  // -------- Construcción del sidebar --------
  function buildNav() {
    const nav = document.getElementById('main-nav');
    nav.innerHTML = '';
    NAV.forEach((item) => {
      if (item.section) {
        nav.appendChild(UI.h('div', { class: 'nav-section', text: item.section }));
        return;
      }
      const link = UI.h('a', {
        class: 'nav-link', href: '#' + item.route, 'data-route': item.route,
        html: (ICONS[item.icon] || '') + '<span>' + UI.esc(item.title) + '</span>',
        onClick: () => closeMobileNav(),
      });
      nav.appendChild(link);
    });
  }

  function renderUserChip() {
    const u = Store.getUser() || {};
    const chip = document.getElementById('user-chip');
    chip.innerHTML = '';
    chip.appendChild(UI.h('div', { class: 'avatar', text: window.SI_FMT.initials(u.nombre) }));
    chip.appendChild(UI.h('div', null, [
      UI.h('div', { class: 'u-name', text: u.nombre || 'Usuario' }),
      UI.h('div', { class: 'u-rol', text: u.rol || '' }),
    ]));
    const badge = document.getElementById('api-badge');
    if (badge) badge.textContent = C.getApiBase().replace(/^https?:\/\//, '');
  }

  function closeMobileNav() { document.getElementById('app-shell').classList.remove('nav-open'); }

  // -------- Mostrar app vs login --------
  function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    buildNav();
    renderUserChip();
    if (!window.location.hash) window.location.hash = '/';
    Router.start();
  }

  function showAuth() {
    document.getElementById('app-shell').classList.add('hidden');
    const screen = document.getElementById('auth-screen');
    screen.classList.remove('hidden');
    Views.login(screen, { onSuccess: bootAuthenticated });
  }

  async function bootAuthenticated() {
    // Verifica el token con /auth/me y refresca el usuario almacenado.
    try {
      UI.showLoading();
      const user = await window.SI_API.me();
      Store.setUser(user);
    } catch (err) {
      UI.hideLoading();
      Store.logout();
      showAuth();
      if (err.status && err.status !== 401) UI.toastErr(err.message);
      return;
    }
    UI.hideLoading();
    showApp();
  }

  // -------- Eventos globales --------
  function wireGlobalEvents() {
    document.getElementById('logout-btn').addEventListener('click', () => {
      Store.logout();
      window.location.hash = '';
      showAuth();
      UI.toastOk('Sesión cerrada.');
    });
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('app-shell').classList.toggle('nav-open');
    });
    document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileNav);

    // 401 desde cualquier petición → cerrar sesión.
    window.addEventListener('si:unauthorized', () => {
      if (!Store.isAuthenticated()) return;
      Store.logout();
      showAuth();
      UI.toastWarn('Tu sesión expiró. Inicia sesión nuevamente.', 'Sesión');
    });
  }

  // -------- Init --------
  function init() {
    window.SI_VIEWS = window.SI_VIEWS || Views;
    registerRoutes();
    wireGlobalEvents();
    if (Store.isAuthenticated()) bootAuthenticated();
    else showAuth();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* router.js — Router por hash para la SPA */
(function () {
  'use strict';

  const routes = {};      // pattern -> { handler, title, admin }
  let notFound = null;
  let current = null;

  function register(pattern, handler, meta) {
    routes[pattern] = Object.assign({ handler }, meta || {});
  }
  function setNotFound(fn) { notFound = fn; }

  // Convierte "/facturas/:id" + "/facturas/5" => { id: "5" }
  function match(pattern, path) {
    const pp = pattern.split('/').filter(Boolean);
    const ph = path.split('/').filter(Boolean);
    if (pp.length !== ph.length) return null;
    const params = {};
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ph[i]);
      else if (pp[i] !== ph[i]) return null;
    }
    return params;
  }

  function parseHash() {
    let h = window.location.hash.replace(/^#/, '');
    if (!h) h = '/';
    const [path, query] = h.split('?');
    const q = {};
    if (query) new URLSearchParams(query).forEach((v, k) => { q[k] = v; });
    return { path: path || '/', query: q };
  }

  function resolve() {
    const { path, query } = parseHash();
    for (const pattern of Object.keys(routes)) {
      const params = match(pattern, path);
      if (params) return { route: routes[pattern], params, query, path };
    }
    return { route: null, params: {}, query, path };
  }

  async function run() {
    const ctx = resolve();
    current = ctx;
    const root = document.getElementById('view-root');
    if (!ctx.route) {
      if (notFound) notFound(root, ctx);
      return;
    }
    // Guard de admin
    if (ctx.route.admin && !window.SI_STORE.isAdmin()) {
      window.SI_UI.toastErr('Esta sección requiere rol de administrador.');
      Router.go('/');
      return;
    }
    document.getElementById('view-title').textContent = ctx.route.title || 'SmartInvoice';
    highlightNav(ctx.path);
    root.scrollTop = 0;
    try {
      await ctx.route.handler(root, ctx);
    } catch (err) {
      console.error('[router] error en vista', err);
      root.innerHTML = '';
      window.SI_UI.empty(root, { icon: '⚠️', title: 'No se pudo cargar la vista', message: err.message || String(err) });
    }
  }

  function highlightNav(path) {
    document.querySelectorAll('.nav-link').forEach((a) => {
      const target = a.getAttribute('data-route');
      if (!target) return;
      const base = '/' + (path.split('/').filter(Boolean)[0] || '');
      a.classList.toggle('active', target === path || target === base);
    });
  }

  function go(path) {
    if (('#' + path) === window.location.hash) run();
    else window.location.hash = path;
  }

  window.addEventListener('hashchange', run);

  const Router = { register, setNotFound, start: run, go, current: () => current, parseHash };
  window.SI_ROUTER = Router;
})();

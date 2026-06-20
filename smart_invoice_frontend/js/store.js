/* store.js — Estado de sesión (token + usuario) y utilidades de formato */
(function () {
  'use strict';
  const C = window.SI_CONFIG;

  const Store = {
    getToken() { return localStorage.getItem(C.TOKEN_KEY) || null; },
    setToken(t) { t ? localStorage.setItem(C.TOKEN_KEY, t) : localStorage.removeItem(C.TOKEN_KEY); },

    getUser() {
      try { return JSON.parse(localStorage.getItem(C.USER_KEY) || 'null'); }
      catch (_) { return null; }
    },
    setUser(u) { u ? localStorage.setItem(C.USER_KEY, JSON.stringify(u)) : localStorage.removeItem(C.USER_KEY); },

    isAuthenticated() { return !!this.getToken(); },
    isAdmin() { const u = this.getUser(); return !!u && u.rol === 'admin'; },

    login(token, user) { this.setToken(token); this.setUser(user); },
    logout() { this.setToken(null); this.setUser(null); },
  };

  // ---------- Formateadores ----------
  const Fmt = {
    money(v) {
      if (v === null || v === undefined || v === '') return '—';
      const n = typeof v === 'number' ? v : parseFloat(v);
      if (Number.isNaN(n)) return '—';
      return 'Q ' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    number(v) {
      const n = typeof v === 'number' ? v : parseFloat(v);
      return Number.isNaN(n) ? '0' : n.toLocaleString('es-GT');
    },
    date(v) {
      if (!v) return '—';
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return v;
      return d.toLocaleDateString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit' });
    },
    datetime(v) {
      if (!v) return '—';
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return v;
      return d.toLocaleString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    },
    initials(name) {
      if (!name) return '?';
      return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
    },
  };

  window.SI_STORE = Store;
  window.SI_FMT = Fmt;
})();

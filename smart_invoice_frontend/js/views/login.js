/* views/login.js — Pantalla de autenticación (login + registro) */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, Store = window.SI_STORE, C = window.SI_CONFIG;

  function heroHTML() {
    return `
      <div class="auth-hero">
        <div class="auth-hero__logo">
          <svg viewBox="0 0 32 32" width="34" height="34"><rect width="32" height="32" rx="7" fill="#588157"/><path d="M9 8h11l3 3v13H9z" fill="#DAD7CD"/><path d="M12 14h8M12 17h8M12 20h5" stroke="#3A5A40" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span>Smart<strong>Invoice</strong></span>
        </div>
        <h2>Procesamiento inteligente de facturas</h2>
        <p>Carga facturas en PDF o imagen y deja que el OCR extraiga, valide y registre los datos automáticamente. Genera reportes y automatiza el flujo con RPA.</p>
        <div class="auth-hero__features">
          <div><span class="dot"></span> Extracción automática con OCR + Computer Vision</div>
          <div><span class="dot"></span> Validación y corrección de datos extraídos</div>
          <div><span class="dot"></span> Reportes PDF · Excel · CSV y envío por correo</div>
          <div><span class="dot"></span> Bitácora completa de cada operación</div>
        </div>
      </div>`;
  }

  function apiConfigBlock() {
    return `
      <details class="api-config">
        <summary>Configuración del servidor (API)</summary>
        <div class="field" style="margin-top:10px">
          <label for="api-base">URL del backend</label>
          <input class="input" id="api-base" type="text" placeholder="${UI.esc(C.defaultBase())}" value="${UI.esc(localStorage.getItem(C.LS_KEY) || '')}" />
          <span class="hint">Por defecto: ${UI.esc(C.defaultBase())}. Cámbiala si el backend está en otra URL.</span>
          <button class="btn btn--ghost btn--sm" id="api-save" type="button" style="margin-top:8px;align-self:flex-start">Guardar URL</button>
        </div>
      </details>`;
  }

  function render(root, ctx) {
    const onSuccess = (ctx && ctx.onSuccess) || function () {};
    root.innerHTML = heroHTML() + `
      <div class="auth-panel">
        <div class="auth-card" id="auth-card"></div>
      </div>`;
    const card = root.querySelector('#auth-card');
    renderLogin(card, onSuccess);
  }

  function bindApiConfig(card) {
    const saveBtn = card.querySelector('#api-save');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', () => {
      const val = card.querySelector('#api-base').value;
      C.setApiBase(val);
      UI.toastOk('URL del API actualizada.');
    });
  }

  /* ---------------- LOGIN ---------------- */
  function renderLogin(card, onSuccess) {
    card.innerHTML = `
      <h3>Iniciar sesión</h3>
      <div class="sub">Ingresa tus credenciales para continuar</div>
      <form id="login-form" class="form-grid" novalidate>
        <div class="field">
          <label for="email">Correo electrónico <span class="req">*</span></label>
          <input class="input" id="email" name="email" type="email" autocomplete="username" placeholder="admin@smartinvoice.com" required />
        </div>
        <div class="field">
          <label for="password">Contraseña <span class="req">*</span></label>
          <input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
        </div>
        <button class="btn btn--primary btn--block" id="login-submit" type="submit">Entrar</button>
      </form>
      <div class="auth-switch">¿No tienes cuenta? <a id="to-register">Crear una cuenta</a></div>
      ${apiConfigBlock()}`;

    bindApiConfig(card);
    card.querySelector('#to-register').addEventListener('click', () => renderRegister(card, onSuccess));

    card.querySelector('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = UI.serializeForm(e.target);
      if (!data.email || !data.password) { UI.toastErr('Completa correo y contraseña.'); return; }
      const btn = card.querySelector('#login-submit');
      btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Entrando…';
      try {
        const res = await API.login(data.email, data.password);
        Store.login(res.access_token, res.user);
        UI.toastOk('Bienvenido, ' + (res.user?.nombre || '') + '.');
        onSuccess();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Entrar';
        if (err.status === 401 || err.status === 400) UI.toastErr('Correo o contraseña incorrectos.');
        else UI.toastErr(err.message);
      }
    });
  }

  /* ---------------- REGISTRO ---------------- */
  function renderRegister(card, onSuccess) {
    card.innerHTML = `
      <h3>Crear cuenta</h3>
      <div class="sub">Regístrate para acceder a SmartInvoice</div>
      <form id="reg-form" class="form-grid" novalidate>
        <div class="field">
          <label for="r-nombre">Nombre completo <span class="req">*</span></label>
          <input class="input" id="r-nombre" name="nombre" type="text" placeholder="María López" required />
        </div>
        <div class="field">
          <label for="r-email">Correo electrónico <span class="req">*</span></label>
          <input class="input" id="r-email" name="email" type="email" placeholder="maria@empresa.com" required />
        </div>
        <div class="field">
          <label for="r-pass">Contraseña <span class="req">*</span></label>
          <input class="input" id="r-pass" name="password" type="password" placeholder="Mínimo 6 caracteres" required />
          <span class="hint">Entre 6 y 128 caracteres.</span>
        </div>
        <button class="btn btn--primary btn--block" id="reg-submit" type="submit">Crear cuenta e iniciar sesión</button>
      </form>
      <div class="auth-switch">¿Ya tienes cuenta? <a id="to-login">Iniciar sesión</a></div>`;

    card.querySelector('#to-login').addEventListener('click', () => renderLogin(card, onSuccess));

    card.querySelector('#reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = UI.serializeForm(e.target);
      if (!data.nombre || data.nombre.length < 2) { UI.toastErr('Ingresa un nombre válido.'); return; }
      if (!data.email) { UI.toastErr('Ingresa un correo válido.'); return; }
      if (!data.password || data.password.length < 6) { UI.toastErr('La contraseña debe tener al menos 6 caracteres.'); return; }
      const btn = card.querySelector('#reg-submit');
      btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Creando…';
      try {
        await API.register({ nombre: data.nombre, email: data.email, password: data.password, rol: 'usuario' });
        // Auto-login tras registrar
        const res = await API.login(data.email, data.password);
        Store.login(res.access_token, res.user);
        UI.toastOk('Cuenta creada. ¡Bienvenido!');
        onSuccess();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Crear cuenta e iniciar sesión';
        if (err.status === 409) UI.toastErr('Ese correo ya está registrado.');
        else UI.toastErr(err.message);
      }
    });
  }

  window.SI_VIEWS.login = render;
})();

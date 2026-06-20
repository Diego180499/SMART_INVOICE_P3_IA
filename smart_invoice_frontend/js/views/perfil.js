/* views/perfil.js — Perfil del usuario autenticado (GET/PUT /auth/me) */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, Store = window.SI_STORE, FMT = window.SI_FMT;

  async function render(root) {
    root.innerHTML = `
      <div class="page-head"><div><h2>Mi perfil</h2><div class="lead">Consulta y actualiza tus datos de cuenta</div></div></div>
      <div id="perfil-body"></div>`;
    const body = root.querySelector('#perfil-body');
    body.innerHTML = '<div class="card card--pad"><div class="skeleton" style="height:120px"></div></div>';

    let user;
    try { user = await API.me(); Store.setUser(user); }
    catch (err) { UI.empty(body, { icon: '⚠️', title: 'No se pudo cargar el perfil', message: err.message }); return; }

    body.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card__head"><h3>Información de la cuenta</h3>${user.rol === 'admin' ? UI.badge('Administrador','info') : UI.badge('Usuario','mute')}</div>
          <div class="card__body">
            <dl class="kv">
              <dt>ID</dt><dd>#${user.id}</dd>
              <dt>Estado</dt><dd>${user.activo ? UI.badge('Activo','ok') : UI.badge('Inactivo','err')}</dd>
              <dt>Registrado</dt><dd>${FMT.datetime(user.created_at)}</dd>
              <dt>Actualizado</dt><dd>${FMT.datetime(user.updated_at)}</dd>
            </dl>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Editar datos</h3></div>
          <div class="card__body">
            <form id="perfil-form" class="form-grid">
              <div class="field">
                <label for="p-nombre">Nombre completo</label>
                <input class="input" id="p-nombre" name="nombre" type="text" value="${UI.esc(user.nombre)}" />
              </div>
              <div class="field">
                <label for="p-email">Correo electrónico</label>
                <input class="input" id="p-email" name="email" type="email" value="${UI.esc(user.email)}" />
              </div>
              <div class="field">
                <label for="p-pass">Nueva contraseña</label>
                <input class="input" id="p-pass" name="password" type="password" placeholder="Dejar en blanco para no cambiar" />
                <span class="hint">Mínimo 6 caracteres si deseas cambiarla.</span>
              </div>
              <button class="btn btn--primary" id="p-submit" type="submit">Guardar cambios</button>
            </form>
          </div>
        </div>
      </div>`;

    body.querySelector('#perfil-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = UI.serializeForm(e.target);
      const payload = {};
      if (data.nombre && data.nombre !== user.nombre) payload.nombre = data.nombre;
      if (data.email && data.email !== user.email) payload.email = data.email;
      if (data.password) {
        if (data.password.length < 6) { UI.toastErr('La contraseña debe tener al menos 6 caracteres.'); return; }
        payload.password = data.password;
      }
      if (!Object.keys(payload).length) { UI.toastWarn('No hay cambios para guardar.'); return; }
      const btn = body.querySelector('#p-submit');
      btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Guardando…';
      try {
        const updated = await API.updateMe(payload);
        Store.setUser(updated);
        UI.toastOk('Perfil actualizado.');
        render(root);
        document.getElementById('user-chip')?.querySelector('.u-name') &&
          (document.querySelector('#user-chip .u-name').textContent = updated.nombre);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Guardar cambios';
        if (err.status === 409) UI.toastErr('Ese correo ya está en uso.');
        else UI.toastErr(err.message);
      }
    });
  }

  window.SI_VIEWS.perfil = render;
})();

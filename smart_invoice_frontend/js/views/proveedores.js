/* views/proveedores.js — CRUD de proveedores */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, Store = window.SI_STORE, FMT = window.SI_FMT;

  const state = { skip: 0, limit: 10, q: '', soloActivos: true, total: 0 };

  async function render(root) {
    const isAdmin = Store.isAdmin();
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Proveedores</h2><div class="lead">Catálogo de proveedores del sistema</div></div>
        <div class="page-head__actions">
          ${isAdmin ? '<button class="btn btn--primary" id="btn-nuevo">+ Nuevo proveedor</button>' : ''}
        </div>
      </div>
      <div class="filters">
        <div class="field" style="flex:1;min-width:220px">
          <label for="f-q">Buscar por nombre o NIT</label>
          <input class="input" id="f-q" type="text" placeholder="Ej. Guatemala o 1234567-8" value="${UI.esc(state.q)}" />
        </div>
        <div class="field">
          <label for="f-activos">Mostrar</label>
          <select class="select" id="f-activos">
            <option value="true"${state.soloActivos ? ' selected' : ''}>Solo activos</option>
            <option value="false"${!state.soloActivos ? ' selected' : ''}>Todos</option>
          </select>
        </div>
        <button class="btn btn--ghost" id="f-apply">Aplicar</button>
      </div>
      <div id="prov-table"></div>`;

    if (isAdmin) root.querySelector('#btn-nuevo').addEventListener('click', () => openForm(root));
    root.querySelector('#f-apply').addEventListener('click', () => {
      state.q = root.querySelector('#f-q').value.trim();
      state.soloActivos = root.querySelector('#f-activos').value === 'true';
      state.skip = 0;
      load(root);
    });
    root.querySelector('#f-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') root.querySelector('#f-apply').click(); });

    load(root);
  }

  async function load(root) {
    const cont = root.querySelector('#prov-table');
    cont.innerHTML = tableShell(UI.tableSkeleton(6, 6));
    try {
      let items, total;
      if (state.q) {
        items = await API.proveedorBuscar(state.q);
        total = items.length;
      } else {
        const res = await API.proveedores({ skip: state.skip, limit: state.limit, solo_activos: state.soloActivos });
        items = res.items; total = res.total;
      }
      state.total = total;
      paint(root, items);
    } catch (err) {
      UI.empty(cont, { icon: '⚠️', title: 'Error al cargar', message: err.message });
    }
  }

  function tableShell(rowsHtml) {
    return `
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Proveedor</th><th>NIT</th><th>Contacto</th><th>Teléfono</th><th>Estado</th><th class="actions">Acciones</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  function paint(root, items) {
    const cont = root.querySelector('#prov-table');
    const isAdmin = Store.isAdmin();
    if (!items || !items.length) {
      UI.empty(cont, { icon: '🏢', title: 'Sin proveedores', message: state.q ? 'No hay resultados para tu búsqueda.' : 'Aún no se han registrado proveedores.' });
      return;
    }
    const rows = items.map((p) => `
      <tr>
        <td>
          <div style="font-weight:600">${UI.esc(p.nombre)}</div>
          <div class="muted" style="font-size:12px">${UI.esc(p.direccion || '—')}</div>
        </td>
        <td class="mono">${UI.esc(p.nit)}</td>
        <td>${UI.esc(p.email || '—')}</td>
        <td>${UI.esc(p.telefono || '—')}</td>
        <td>${p.activo ? UI.badge('Activo', 'ok') : UI.badge('Inactivo', 'mute')}</td>
        <td class="actions">
          <div class="btn-row" style="justify-content:flex-end">
            <button class="btn btn--ghost btn--sm" data-act="ver" data-id="${p.id}">Ver</button>
            ${isAdmin ? `<button class="btn btn--soft btn--sm" data-act="editar" data-id="${p.id}">Editar</button>` : ''}
            ${isAdmin && p.activo ? `<button class="btn btn--danger btn--sm" data-act="eliminar" data-id="${p.id}">Desactivar</button>` : ''}
          </div>
        </td>
      </tr>`).join('');

    cont.innerHTML = tableShell(rows);

    if (!state.q) {
      const from = state.skip + 1, to = state.skip + items.length;
      cont.appendChild(UI.h('div', { class: 'pager' }, [
        UI.h('span', { text: `Mostrando ${from}–${to} de ${state.total}` }),
        UI.h('div', { class: 'pg-btns' }, [
          UI.h('button', { class: 'btn btn--ghost btn--sm', text: '‹ Anterior', disabled: state.skip === 0,
            onClick: () => { state.skip = Math.max(0, state.skip - state.limit); load(root); } }),
          UI.h('button', { class: 'btn btn--ghost btn--sm', text: 'Siguiente ›', disabled: to >= state.total,
            onClick: () => { state.skip += state.limit; load(root); } }),
        ]),
      ]));
    }

    cont.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const prov = items.find((x) => x.id === id);
        if (btn.dataset.act === 'ver') openDetalle(prov);
        else if (btn.dataset.act === 'editar') openForm(root, prov);
        else if (btn.dataset.act === 'eliminar') confirmDelete(root, prov);
      });
    });
  }

  function openDetalle(p) {
    UI.openModal({
      title: p.nombre,
      body: UI.h('dl', { class: 'kv', html: `
        <dt>NIT</dt><dd class="mono">${UI.esc(p.nit)}</dd>
        <dt>Dirección</dt><dd>${UI.esc(p.direccion || '—')}</dd>
        <dt>Teléfono</dt><dd>${UI.esc(p.telefono || '—')}</dd>
        <dt>Correo</dt><dd>${UI.esc(p.email || '—')}</dd>
        <dt>Estado</dt><dd>${p.activo ? UI.badge('Activo','ok') : UI.badge('Inactivo','mute')}</dd>
        <dt>Registrado</dt><dd>${FMT.datetime(p.created_at)}</dd>
        <dt>Actualizado</dt><dd>${FMT.datetime(p.updated_at)}</dd>` }),
      footer: [{ label: 'Cerrar', class: 'btn--ghost' }],
    });
  }

  function openForm(root, prov) {
    const editing = !!prov;
    const form = UI.h('form', { class: 'form-grid', id: 'prov-form', novalidate: true, html: `
      <div class="form-grid cols-2">
        <div class="field">
          <label>Razón social <span class="req">*</span></label>
          <input class="input" name="nombre" value="${editing ? UI.esc(prov.nombre) : ''}" placeholder="Distribuidora Guatemala S.A." required />
        </div>
        <div class="field">
          <label>NIT <span class="req">*</span></label>
          <input class="input" name="nit" value="${editing ? UI.esc(prov.nit) : ''}" placeholder="1234567-8" required />
        </div>
      </div>
      <div class="field">
        <label>Dirección</label>
        <input class="input" name="direccion" value="${editing ? UI.esc(prov.direccion || '') : ''}" placeholder="7a Avenida 1-23, Zona 1" />
      </div>
      <div class="form-grid cols-2">
        <div class="field">
          <label>Teléfono</label>
          <input class="input" name="telefono" value="${editing ? UI.esc(prov.telefono || '') : ''}" placeholder="22222222" />
        </div>
        <div class="field">
          <label>Correo electrónico</label>
          <input class="input" name="email" type="email" value="${editing ? UI.esc(prov.email || '') : ''}" placeholder="contacto@empresa.com" />
        </div>
      </div>
      ${editing ? `<div class="field"><label>Estado</label><select class="select" name="activo"><option value="true"${prov.activo ? ' selected':''}>Activo</option><option value="false"${!prov.activo ? ' selected':''}>Inactivo</option></select></div>` : ''}
    ` });

    UI.openModal({
      title: editing ? 'Editar proveedor' : 'Nuevo proveedor',
      body: form,
      footer: [
        { label: 'Cancelar', class: 'btn--ghost' },
        { label: editing ? 'Guardar cambios' : 'Crear proveedor', class: 'btn--primary', closeAfter: false,
          onClick: async ({ close, btn }) => {
            const d = UI.serializeForm(form);
            if (!d.nombre || d.nombre.length < 2) { UI.toastErr('La razón social es obligatoria.'); return false; }
            if (!d.nit || d.nit.length < 2) { UI.toastErr('El NIT es obligatorio.'); return false; }
            const payload = { nombre: d.nombre, nit: d.nit, direccion: d.direccion || null, telefono: d.telefono || null, email: d.email || null };
            if (editing) payload.activo = d.activo === 'true';
            btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Guardando…';
            try {
              if (editing) { await API.proveedorActualizar(prov.id, payload); UI.toastOk('Proveedor actualizado.'); }
              else { await API.proveedorCrear(payload); UI.toastOk('Proveedor creado.'); }
              close(); load(root);
            } catch (err) {
              btn.disabled = false; btn.textContent = editing ? 'Guardar cambios' : 'Crear proveedor';
              if (err.status === 409) UI.toastErr('Ya existe un proveedor con ese NIT.');
              else if (err.status === 403) UI.toastErr('No tienes permisos (se requiere admin).');
              else UI.toastErr(err.message);
              return false;
            }
          } },
      ],
    });
  }

  async function confirmDelete(root, prov) {
    const ok = await UI.confirm({
      title: 'Desactivar proveedor', danger: true, okLabel: 'Desactivar',
      message: `¿Desactivar a "${prov.nombre}"? Quedará inactivo (soft-delete), no se elimina físicamente.`,
    });
    if (!ok) return;
    try { await API.proveedorEliminar(prov.id); UI.toastOk('Proveedor desactivado.'); load(root); }
    catch (err) { err.status === 403 ? UI.toastErr('Se requiere rol admin.') : UI.toastErr(err.message); }
  }

  window.SI_VIEWS.proveedores = render;
})();

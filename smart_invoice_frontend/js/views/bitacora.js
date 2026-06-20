/* views/bitacora.js — Bitácora de operaciones del sistema */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, FMT = window.SI_FMT, Router = window.SI_ROUTER;

  const ACCIONES = ['LOGIN', 'UPLOAD_FACTURA', 'OCR_PROCESO', 'EXTRACCION_DATOS', 'VALIDACION_DATOS',
    'ALMACENAMIENTO_DATOS', 'GENERACION_REPORTE', 'ENVIO_EMAIL', 'RPA_FORMULARIO', 'CRUD_PROVEEDOR'];
  const ESTADOS = ['EXITOSO', 'FALLIDO', 'PENDIENTE'];
  const state = { skip: 0, limit: 15, accion: '', estado: '', fecha_inicio: '', fecha_fin: '', total: 0 };

  function render(root) {
    root.innerHTML = `
      <div class="page-head"><div><h2>Bitácora</h2><div class="lead">Registro cronológico de todas las operaciones</div></div></div>
      <div class="filters">
        <div class="field"><label>Acción</label><select class="select" id="b-accion"><option value="">Todas</option>${ACCIONES.map(a => `<option value="${a}"${state.accion===a?' selected':''}>${a}</option>`).join('')}</select></div>
        <div class="field"><label>Estado</label><select class="select" id="b-estado"><option value="">Todos</option>${ESTADOS.map(e => `<option value="${e}"${state.estado===e?' selected':''}>${e}</option>`).join('')}</select></div>
        <div class="field"><label>Desde</label><input class="input" id="b-ini" type="date" value="${state.fecha_inicio}" /></div>
        <div class="field"><label>Hasta</label><input class="input" id="b-fin" type="date" value="${state.fecha_fin}" /></div>
        <button class="btn btn--ghost" id="b-apply">Filtrar</button>
        <button class="btn btn--ghost" id="b-clear">Limpiar</button>
      </div>
      <div id="bit-table"></div>`;

    root.querySelector('#b-apply').addEventListener('click', () => {
      state.accion = root.querySelector('#b-accion').value;
      state.estado = root.querySelector('#b-estado').value;
      state.fecha_inicio = root.querySelector('#b-ini').value;
      state.fecha_fin = root.querySelector('#b-fin').value;
      state.skip = 0; load(root);
    });
    root.querySelector('#b-clear').addEventListener('click', () => {
      Object.assign(state, { accion: '', estado: '', fecha_inicio: '', fecha_fin: '', skip: 0 });
      render(root);
    });
    load(root);
  }

  async function load(root) {
    const cont = root.querySelector('#bit-table');
    cont.innerHTML = shell(UI.tableSkeleton(6, 8));
    try {
      const res = await API.bitacora({
        skip: state.skip, limit: state.limit,
        accion: state.accion, estado: state.estado,
        fecha_inicio: state.fecha_inicio, fecha_fin: state.fecha_fin,
      });
      state.total = res.total;
      paint(root, res.items);
    } catch (err) { UI.empty(cont, { icon: '⚠️', title: 'Error al cargar', message: err.message }); }
  }

  function shell(rows) {
    return `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Fecha y hora</th><th>Acción</th><th>Estado</th><th>Factura</th><th>Resultado</th><th class="actions"></th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function paint(root, items) {
    const cont = root.querySelector('#bit-table');
    if (!items || !items.length) { UI.empty(cont, { icon: '🕓', title: 'Sin registros', message: 'No hay entradas que coincidan con los filtros.' }); return; }
    const rows = items.map(b => `
      <tr>
        <td>${FMT.datetime(b.fecha_hora)}</td>
        <td>${UI.badge(b.accion, 'info')}</td>
        <td>${UI.bitacoraBadge(b.estado)}</td>
        <td>${b.factura_id ? `<a href="#/facturas/${b.factura_id}">#${b.factura_id}</a>` : '—'}</td>
        <td>${UI.esc((b.resultado || '—').slice(0, 90))}${(b.resultado||'').length>90?'…':''}</td>
        <td class="actions"><button class="btn btn--ghost btn--sm" data-id="${b.id}">Detalle</button></td>
      </tr>`).join('');
    cont.innerHTML = shell(rows);

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

    cont.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => detalle(parseInt(b.dataset.id, 10), items)));
  }

  function detalle(id, items) {
    const b = items.find(x => x.id === id);
    if (!b) return;
    UI.openModal({
      title: `Bitácora #${b.id}`, size: 'lg',
      body: UI.h('div', { html: `
        <dl class="kv">
          <dt>Fecha y hora</dt><dd>${FMT.datetime(b.fecha_hora)}</dd>
          <dt>Acción</dt><dd>${UI.badge(b.accion,'info')}</dd>
          <dt>Estado</dt><dd>${UI.bitacoraBadge(b.estado)}</dd>
          <dt>Factura</dt><dd>${b.factura_id ? '#'+b.factura_id : '—'}</dd>
          <dt>Usuario</dt><dd>${b.usuario_id ? '#'+b.usuario_id : '—'}</dd>
          <dt>Resultado</dt><dd>${UI.esc(b.resultado || '—')}</dd>
        </dl>
        ${b.detalle ? `<h4 class="mt-16" style="font-size:13px">Detalle técnico</h4><pre class="mono" style="white-space:pre-wrap;font-size:12px;background:var(--surface-2);padding:12px;border-radius:8px;max-height:300px;overflow:auto">${UI.esc(b.detalle)}</pre>` : ''}
      ` }),
      footer: [{ label: 'Cerrar', class: 'btn--ghost' }],
    });
  }

  window.SI_VIEWS.bitacora = render;
})();

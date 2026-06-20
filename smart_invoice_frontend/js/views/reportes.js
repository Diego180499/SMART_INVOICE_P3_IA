/* views/reportes.js — Generación, descarga y envío de reportes */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, Store = window.SI_STORE, FMT = window.SI_FMT;

  const state = { skip: 0, limit: 10, total: 0 };
  let provs = null;

  const TIPO_BADGE = { PDF: 'err', EXCEL: 'ok', CSV: 'info' };

  async function getProveedores() {
    if (provs) return provs;
    try { provs = (await API.proveedores({ limit: 200, solo_activos: false })).items; } catch (_) { provs = []; }
    return provs;
  }

  async function render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Reportes</h2><div class="lead">Genera, descarga y envía reportes administrativos</div></div>
        <div class="page-head__actions"><button class="btn btn--primary" id="btn-gen">+ Generar reporte</button></div>
      </div>
      <div id="rep-table"></div>`;
    root.querySelector('#btn-gen').addEventListener('click', () => openGenerar(root));
    load(root);
  }

  async function load(root) {
    const cont = root.querySelector('#rep-table');
    cont.innerHTML = shell(UI.tableSkeleton(7, 5));
    try {
      const res = await API.reportes({ skip: state.skip, limit: state.limit });
      state.total = res.total;
      paint(root, res.items);
    } catch (err) { UI.empty(cont, { icon: '⚠️', title: 'Error al cargar', message: err.message }); }
  }

  function shell(rows) {
    return `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>#</th><th>Nombre</th><th>Tipo</th><th>Período</th><th>Facturas</th><th>Generado</th><th class="actions">Acciones</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function periodo(r) {
    if (!r.fecha_inicio && !r.fecha_fin) return 'Todo';
    return `${r.fecha_inicio ? FMT.date(r.fecha_inicio) : '…'} – ${r.fecha_fin ? FMT.date(r.fecha_fin) : '…'}`;
  }

  function paint(root, items) {
    const cont = root.querySelector('#rep-table');
    const isAdmin = Store.isAdmin();
    if (!items || !items.length) {
      UI.empty(cont, { icon: '📊', title: 'Sin reportes', message: 'Genera tu primer reporte administrativo.',
        action: UI.h('button', { class: 'btn btn--primary', text: '+ Generar reporte', onClick: () => openGenerar(root) }) });
      return;
    }
    const rows = items.map(r => `
      <tr>
        <td>#${r.id}</td>
        <td style="font-weight:600">${UI.esc(r.nombre)}</td>
        <td>${UI.badge(r.tipo, TIPO_BADGE[r.tipo] || 'mute')}</td>
        <td>${periodo(r)}</td>
        <td>${FMT.number(r.total_facturas ?? 0)}</td>
        <td>${FMT.datetime(r.created_at)}</td>
        <td class="actions"><div class="btn-row" style="justify-content:flex-end">
          <button class="btn btn--ghost btn--sm" data-act="descargar" data-id="${r.id}">Descargar</button>
          <button class="btn btn--soft btn--sm" data-act="enviar" data-id="${r.id}">Enviar correo</button>
          ${isAdmin ? `<button class="btn btn--danger btn--sm" data-act="eliminar" data-id="${r.id}">Eliminar</button>` : ''}
        </div></td>
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

    cont.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const rep = items.find(x => x.id === id);
        if (btn.dataset.act === 'descargar') descargar(rep);
        else if (btn.dataset.act === 'enviar') enviar(rep);
        else if (btn.dataset.act === 'eliminar') eliminar(root, rep);
      });
    });
  }

  async function openGenerar(root) {
    const ps = await getProveedores();
    const form = UI.h('form', { class: 'form-grid', html: `
      <div class="form-grid cols-2">
        <div class="field"><label>Tipo de reporte</label><select class="select" name="tipo"><option value="PDF">PDF</option><option value="EXCEL">Excel</option><option value="CSV">CSV</option></select></div>
        <div class="field"><label>Nombre (opcional)</label><input class="input" name="nombre" placeholder="Reporte Junio 2026" /></div>
      </div>
      <div class="form-grid cols-2">
        <div class="field"><label>Fecha inicio</label><input class="input" name="fecha_inicio" type="date" /></div>
        <div class="field"><label>Fecha fin</label><input class="input" name="fecha_fin" type="date" /></div>
      </div>
      <div class="field"><label>Proveedor (opcional)</label><select class="select" name="proveedor_id"><option value="">Todos</option>${ps.map(p => `<option value="${p.id}">${UI.esc(p.nombre)}</option>`).join('')}</select></div>
      <label class="field"><span><input type="checkbox" name="incluir_rechazados" /> Incluir facturas rechazadas</span></label>
    ` });

    UI.openModal({
      title: 'Generar reporte', size: 'lg', body: form,
      footer: [
        { label: 'Cancelar', class: 'btn--ghost' },
        { label: 'Generar', class: 'btn--primary', closeAfter: false, onClick: async ({ close, btn }) => {
          const v = UI.serializeForm(form);
          const payload = {
            tipo: v.tipo,
            nombre: v.nombre || null,
            fecha_inicio: v.fecha_inicio || null,
            fecha_fin: v.fecha_fin || null,
            proveedor_id: v.proveedor_id ? parseInt(v.proveedor_id, 10) : null,
            incluir_rechazados: form.querySelector('[name=incluir_rechazados]').checked,
          };
          btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Generando…';
          try {
            const r = await API.reporteGenerar(payload);
            UI.toastOk(`Reporte generado (#${r.id}) con ${r.total_facturas ?? 0} facturas.`);
            close(); load(root);
          } catch (err) {
            btn.disabled = false; btn.textContent = 'Generar';
            UI.toastErr(err.message); return false;
          }
        } },
      ],
    });
  }

  async function descargar(rep) {
    UI.showLoading();
    try {
      const ext = rep.tipo === 'EXCEL' ? 'xlsx' : rep.tipo.toLowerCase();
      await API.descargarArchivo(rep.id, `${(rep.nombre || 'reporte').replace(/\s+/g, '_')}.${ext}`);
      UI.toastOk('Descarga iniciada.');
    } catch (err) { UI.toastErr(err.message); }
    UI.hideLoading();
  }

  function enviar(rep) {
    const u = Store.getUser() || {};
    const form = UI.h('form', { class: 'form-grid', html: `
      <p class="soft mb-0">Enviar <strong>${UI.esc(rep.nombre)}</strong> (${rep.tipo}) por correo electrónico.</p>
      <div class="field"><label>Destinatario <span class="req">*</span></label><input class="input" name="destinatario" type="email" placeholder="gerencia@empresa.com" value="${UI.esc(u.email || '')}" required /></div>
    ` });
    UI.openModal({
      title: 'Enviar reporte por correo', body: form,
      footer: [
        { label: 'Cancelar', class: 'btn--ghost' },
        { label: 'Enviar', class: 'btn--primary', closeAfter: false, onClick: async ({ close, btn }) => {
          const v = UI.serializeForm(form);
          if (!v.destinatario) { UI.toastErr('Ingresa un destinatario.'); return false; }
          btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Enviando…';
          try {
            const r = await API.rpaEnviarReporte(rep.id, v.destinatario);
            r.ok ? UI.toastOk(r.mensaje || 'Reporte enviado.') : UI.toastWarn(r.mensaje || 'No se pudo enviar (revisa configuración SMTP).', 'Correo');
            close();
          } catch (err) { btn.disabled = false; btn.textContent = 'Enviar'; UI.toastErr(err.message); return false; }
        } },
      ],
    });
  }

  async function eliminar(root, rep) {
    const ok = await UI.confirm({ title: 'Eliminar reporte', danger: true, okLabel: 'Eliminar',
      message: `Se eliminará el reporte "${rep.nombre}" y su archivo del disco.` });
    if (!ok) return;
    try { await API.reporteEliminar(rep.id); UI.toastOk('Reporte eliminado.'); load(root); }
    catch (err) { err.status === 403 ? UI.toastErr('Se requiere rol admin.') : UI.toastErr(err.message); }
  }

  window.SI_VIEWS.reportes = render;
})();

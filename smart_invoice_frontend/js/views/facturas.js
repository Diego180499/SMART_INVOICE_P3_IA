/* views/facturas.js — Listado, carga y procesamiento OCR de facturas */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, Store = window.SI_STORE, FMT = window.SI_FMT, Router = window.SI_ROUTER;

  const ESTADOS = ['Pendiente', 'Procesado', 'Error', 'Rechazado'];
  const ACCEPT = '.pdf,.jpg,.jpeg,.png';
  const state = { skip: 0, limit: 10, estado: '', proveedor_id: '', fecha_inicio: '', fecha_fin: '', total: 0 };
  let proveedoresCache = null;
  const selected = new Set();

  async function getProveedores() {
    if (proveedoresCache) return proveedoresCache;
    try { const r = await API.proveedores({ limit: 200, solo_activos: false }); proveedoresCache = r.items; }
    catch (_) { proveedoresCache = []; }
    return proveedoresCache;
  }

  async function render(root) {
    const isAdmin = Store.isAdmin();
    const provs = await getProveedores();
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Facturas</h2><div class="lead">Carga, consulta y procesamiento OCR de facturas</div></div>
        <div class="page-head__actions">
          ${isAdmin ? '<button class="btn btn--soft" id="btn-lote">Procesar selección (OCR)</button>' : ''}
          <button class="btn btn--primary" id="btn-upload">+ Cargar factura</button>
        </div>
      </div>
      <div class="filters">
        <div class="field"><label>Estado</label>
          <select class="select" id="f-estado"><option value="">Todos</option>${ESTADOS.map(e => `<option value="${e}"${state.estado===e?' selected':''}>${e}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Proveedor</label>
          <select class="select" id="f-prov"><option value="">Todos</option>${provs.map(p => `<option value="${p.id}"${String(state.proveedor_id)===String(p.id)?' selected':''}>${UI.esc(p.nombre)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Desde</label><input class="input" id="f-ini" type="date" value="${state.fecha_inicio}" /></div>
        <div class="field"><label>Hasta</label><input class="input" id="f-fin" type="date" value="${state.fecha_fin}" /></div>
        <button class="btn btn--ghost" id="f-apply">Filtrar</button>
        <button class="btn btn--ghost" id="f-clear">Limpiar</button>
      </div>
      <div id="fact-table"></div>`;

    root.querySelector('#btn-upload').addEventListener('click', () => openUpload(root));
    if (isAdmin) root.querySelector('#btn-lote').addEventListener('click', () => procesarLote(root));
    root.querySelector('#f-apply').addEventListener('click', () => {
      state.estado = root.querySelector('#f-estado').value;
      state.proveedor_id = root.querySelector('#f-prov').value;
      state.fecha_inicio = root.querySelector('#f-ini').value;
      state.fecha_fin = root.querySelector('#f-fin').value;
      state.skip = 0; load(root);
    });
    root.querySelector('#f-clear').addEventListener('click', () => {
      Object.assign(state, { estado: '', proveedor_id: '', fecha_inicio: '', fecha_fin: '', skip: 0 });
      render(root);
    });

    load(root);
  }

  async function load(root) {
    const cont = root.querySelector('#fact-table');
    cont.innerHTML = shell(UI.tableSkeleton(7, 6));
    try {
      const res = await API.facturas({
        skip: state.skip, limit: state.limit,
        estado: state.estado, proveedor_id: state.proveedor_id,
        fecha_inicio: state.fecha_inicio, fecha_fin: state.fecha_fin,
      });
      state.total = res.total;
      paint(root, res.items);
    } catch (err) {
      UI.empty(cont, { icon: '⚠️', title: 'Error al cargar', message: err.message });
    }
  }

  function shell(rows) {
    const isAdmin = Store.isAdmin();
    return `<div class="table-wrap"><table class="tbl"><thead><tr>
      ${isAdmin ? '<th style="width:34px"></th>' : ''}
      <th>#</th><th>Archivo</th><th>Tipo</th><th>Estado</th><th>Proveedor</th><th>Cargada</th><th class="actions">Acciones</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function provName(id) {
    if (!id) return '—';
    const p = (proveedoresCache || []).find(x => x.id === id);
    return p ? p.nombre : ('#' + id);
  }

  function paint(root, items) {
    const cont = root.querySelector('#fact-table');
    const isAdmin = Store.isAdmin();
    if (!items || !items.length) {
      UI.empty(cont, { icon: '🧾', title: 'Sin facturas', message: 'Carga una factura para comenzar el procesamiento.',
        action: UI.h('button', { class: 'btn btn--primary', text: '+ Cargar factura', onClick: () => openUpload(root) }) });
      return;
    }
    const rows = items.map((f) => `
      <tr class="row-click" data-id="${f.id}">
        ${isAdmin ? `<td><input type="checkbox" class="sel" data-id="${f.id}" ${selected.has(f.id)?'checked':''} /></td>` : ''}
        <td>#${f.id}</td>
        <td><span style="font-weight:600">${UI.esc(f.nombre_archivo_original)}</span></td>
        <td>${UI.badge(f.tipo_archivo, 'mute')}</td>
        <td>${UI.facturaBadge(f.estado)}</td>
        <td>${UI.esc(provName(f.proveedor_id))}</td>
        <td>${FMT.datetime(f.created_at)}</td>
        <td class="actions"><div class="btn-row" style="justify-content:flex-end">
          <button class="btn btn--ghost btn--sm" data-act="ver" data-id="${f.id}">Ver</button>
          ${f.estado === 'Pendiente' || f.estado === 'Error' ? `<button class="btn btn--soft btn--sm" data-act="ocr" data-id="${f.id}">Procesar OCR</button>` : ''}
        </div></td>
      </tr>`).join('');
    cont.innerHTML = shell(rows);

    // Paginación
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

    // Eventos
    cont.querySelectorAll('tr.row-click').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        Router.go('/facturas/' + tr.dataset.id);
      });
    });
    cont.querySelectorAll('[data-act="ver"]').forEach(b => b.addEventListener('click', () => Router.go('/facturas/' + b.dataset.id)));
    cont.querySelectorAll('[data-act="ocr"]').forEach(b => b.addEventListener('click', () => procesarUna(root, parseInt(b.dataset.id, 10))));
    cont.querySelectorAll('input.sel').forEach(chk => chk.addEventListener('change', () => {
      const id = parseInt(chk.dataset.id, 10);
      chk.checked ? selected.add(id) : selected.delete(id);
    }));
  }

  /* ---------- Procesar una factura ---------- */
  async function procesarUna(root, id) {
    UI.showLoading();
    try {
      const r = await API.ocrProcesar(id);
      UI.hideLoading();
      if (r.validado) UI.toastOk(`Factura #${id} procesada y validada (confianza ${r.confianza_ocr ?? '—'}%).`);
      else UI.toastWarn(`Factura #${id} procesada, pero no pasó la validación. Revisa los datos.`, 'OCR');
      load(root);
    } catch (err) {
      UI.hideLoading();
      UI.toastErr(err.message, 'Error de OCR');
      load(root);
    }
  }

  /* ---------- Procesar lote (admin) ---------- */
  async function procesarLote(root) {
    if (!selected.size) { UI.toastWarn('Selecciona al menos una factura con la casilla.'); return; }
    const ids = Array.from(selected);
    const ok = await UI.confirm({ title: 'Procesar en lote', okLabel: `Procesar ${ids.length}`,
      message: `Se ejecutará el OCR sobre ${ids.length} factura(s) seleccionada(s).` });
    if (!ok) return;
    UI.showLoading();
    try {
      const r = await API.ocrProcesarLote(ids);
      UI.hideLoading();
      const okN = (r.resultados || []).filter(x => x.ok).length;
      const valN = (r.resultados || []).filter(x => x.validado).length;
      UI.toastOk(`Lote procesado: ${okN}/${r.procesadas} OK, ${valN} validadas.`);
      selected.clear();
      load(root);
    } catch (err) { UI.hideLoading(); UI.toastErr(err.message); }
  }

  /* ---------- Modal de carga ---------- */
  function openUpload(root) {
    const queue = [];
    const wrap = UI.h('div');
    wrap.innerHTML = `
      <div class="dropzone" id="dz">
        <div class="dz-ico">⬆️</div>
        <h4>Arrastra archivos aquí o haz clic para seleccionar</h4>
        <p>Formatos: PDF, JPG, JPEG, PNG · Máx. 20 MB por archivo</p>
        <input type="file" id="dz-input" accept="${ACCEPT}" multiple hidden />
      </div>
      <div class="file-list" id="dz-list"></div>
      <label class="field" style="margin-top:14px"><input type="checkbox" id="auto-ocr" /> Ejecutar OCR automáticamente tras la carga</label>`;

    const dz = wrap.querySelector('#dz');
    const input = wrap.querySelector('#dz-input');
    const list = wrap.querySelector('#dz-list');

    function valid(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) { UI.toastErr(`"${file.name}": formato no permitido.`); return false; }
      if (file.size > 20 * 1024 * 1024) { UI.toastErr(`"${file.name}": supera los 20 MB.`); return false; }
      return true;
    }
    function addFiles(files) {
      Array.from(files).forEach((f) => { if (valid(f)) queue.push(f); });
      renderList();
    }
    function renderList() {
      list.innerHTML = '';
      queue.forEach((f, i) => {
        list.appendChild(UI.h('div', { class: 'file-row' }, [
          UI.h('span', { text: '📄' }),
          UI.h('span', { class: 'f-name', text: f.name }),
          UI.h('span', { class: 'muted', text: (f.size / 1024).toFixed(0) + ' KB' }),
          UI.h('button', { class: 'btn btn--ghost btn--sm', text: '✕', onClick: () => { queue.splice(i, 1); renderList(); } }),
        ]));
      });
    }

    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', () => addFiles(input.files));
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => { if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });

    UI.openModal({
      title: 'Cargar facturas', size: 'lg', body: wrap,
      footer: [
        { label: 'Cancelar', class: 'btn--ghost' },
        { label: 'Cargar', class: 'btn--primary', closeAfter: false, onClick: async ({ close, btn }) => {
          if (!queue.length) { UI.toastWarn('Agrega al menos un archivo.'); return false; }
          const autoOcr = wrap.querySelector('#auto-ocr').checked;
          btn.disabled = true;
          let okCount = 0; const ids = [];
          for (let i = 0; i < queue.length; i++) {
            btn.innerHTML = `<span class="inline-spin"></span> Subiendo ${i + 1}/${queue.length}…`;
            try {
              const fd = new FormData(); fd.append('file', queue[i]);
              const r = await API.facturaUpload(fd);
              okCount++; ids.push(r.id);
            } catch (err) {
              UI.toastErr(`"${queue[i].name}": ${err.message}`);
            }
          }
          if (okCount) UI.toastOk(`${okCount} factura(s) cargada(s).`);
          close();
          if (autoOcr && ids.length) {
            UI.showLoading();
            try { await API.ocrProcesarLote(ids); UI.toastOk('OCR ejecutado sobre las cargas.'); }
            catch (err) { UI.toastErr('OCR automático: ' + err.message); }
            UI.hideLoading();
          }
          load(root);
        } },
      ],
    });
  }

  window.SI_VIEWS.facturas = render;
  window.SI_VIEWS._facturasProveedores = getProveedores; // reutilizado por detalle
})();

/* views/factura-detalle.js — Detalle de factura: datos OCR, corrección, bitácora, RPA */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, Store = window.SI_STORE, FMT = window.SI_FMT, Router = window.SI_ROUTER;

  async function render(root, ctx) {
    const id = parseInt(ctx.params.id, 10);
    root.innerHTML = `
      <div class="page-head">
        <div>
          <a href="#/facturas" class="soft" style="font-size:13px;text-decoration:none">‹ Volver a facturas</a>
          <h2 style="margin-top:4px">Factura #${id}</h2>
        </div>
        <div class="page-head__actions" id="det-actions"></div>
      </div>
      <div id="det-body"><div class="card card--pad"><div class="skeleton" style="height:160px"></div></div></div>`;

    const body = root.querySelector('#det-body');
    let factura;
    try { factura = await API.factura(id); }
    catch (err) {
      UI.empty(body, { icon: '⚠️', title: 'No se encontró la factura', message: err.message,
        action: UI.h('a', { class: 'btn btn--primary', href: '#/facturas', text: 'Volver a facturas' }) });
      return;
    }

    paintActions(root, factura);
    paintBody(body, factura, root);
  }

  function paintActions(root, f) {
    const cont = root.querySelector('#det-actions');
    const isAdmin = Store.isAdmin();
    cont.innerHTML = '';
    if (f.estado === 'Pendiente' || f.estado === 'Error') {
      cont.appendChild(UI.h('button', { class: 'btn btn--soft', text: 'Procesar OCR',
        onClick: () => procesarOCR(root, f.id) }));
    } else {
      cont.appendChild(UI.h('button', { class: 'btn btn--ghost', text: 'Reprocesar OCR',
        onClick: () => procesarOCR(root, f.id) }));
    }
    if (f.datos_extraidos) {
      cont.appendChild(UI.h('button', { class: 'btn btn--soft', text: 'Registrar en formulario (RPA)',
        onClick: () => rpaRegistrar(f.id) }));
    }
    if (isAdmin) {
      cont.appendChild(UI.h('button', { class: 'btn btn--danger', text: 'Eliminar',
        onClick: () => eliminar(f) }));
    }
  }

  function paintBody(body, f, root) {
    const d = f.datos_extraidos;
    const p = f.proveedor;
    body.innerHTML = `
      <div class="tabs" id="det-tabs">
        <div class="tab active" data-tab="datos">Datos extraídos</div>
        <div class="tab" data-tab="archivo">Archivo y proveedor</div>
        <div class="tab" data-tab="texto">Texto OCR</div>
        <div class="tab" data-tab="historial">Historial</div>
      </div>
      <div id="tab-content"></div>`;

    const tabs = { datos: tabDatos, archivo: tabArchivo, texto: tabTexto, historial: tabHistorial };
    const tc = body.querySelector('#tab-content');
    function show(name) {
      body.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
      tabs[name](tc, f, root);
    }
    body.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
    show('datos');
  }

  /* ---------- Tab: Datos extraídos ---------- */
  function tabDatos(tc, f, root) {
    const d = f.datos_extraidos;
    if (!d) {
      UI.empty(tc, { icon: '🔍', title: 'Sin datos extraídos', message: 'Esta factura aún no ha sido procesada con OCR.',
        action: UI.h('button', { class: 'btn btn--primary', text: 'Procesar OCR ahora', onClick: () => procesarOCR(root, f.id) }) });
      return;
    }
    const conf = d.confianza_ocr != null ? Math.round(d.confianza_ocr) : null;
    tc.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card__head"><h3>Campos extraídos</h3>${UI.validadoBadge(d.validado)}</div>
          <div class="card__body">
            <dl class="kv">
              <dt>N.º de factura</dt><dd class="mono">${UI.esc(d.numero_factura || '—')}</dd>
              <dt>Fecha</dt><dd>${FMT.date(d.fecha_factura)}</dd>
              <dt>Proveedor (OCR)</dt><dd>${UI.esc(d.nombre_proveedor_ocr || '—')}</dd>
              <dt>NIT (OCR)</dt><dd class="mono">${UI.esc(d.nit_ocr || '—')}</dd>
              <dt>Subtotal</dt><dd>${FMT.money(d.subtotal)}</dd>
              <dt>Impuestos</dt><dd>${FMT.money(d.impuestos)}</dd>
              <dt>Total</dt><dd style="font-weight:700">${FMT.money(d.total)}</dd>
            </dl>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Validación</h3></div>
          <div class="card__body">
            <dl class="kv">
              <dt>Confianza OCR</dt><dd>${conf != null ? `<div class="flex center gap-8"><div class="conf-bar" style="width:120px"><span style="width:${conf}%"></span></div><span>${conf}%</span></div>` : '—'}</dd>
              <dt>Estado validación</dt><dd>${UI.validadoBadge(d.validado)}</dd>
              <dt>Coherencia</dt><dd>${coherencia(d)}</dd>
              <dt>Observaciones</dt><dd>${UI.esc(d.observaciones_validacion || '—')}</dd>
              <dt>Extraído</dt><dd>${FMT.datetime(d.created_at)}</dd>
              <dt>Modificado</dt><dd>${FMT.datetime(d.updated_at)}</dd>
            </dl>
            <div class="btn-row mt-16">
              <button class="btn btn--primary" id="btn-corregir">Corregir datos</button>
            </div>
          </div>
        </div>
      </div>`;
    tc.querySelector('#btn-corregir').addEventListener('click', () => openCorreccion(root, f));
  }

  function coherencia(d) {
    const s = parseFloat(d.subtotal), i = parseFloat(d.impuestos), t = parseFloat(d.total);
    if ([s, i, t].some(Number.isNaN)) return UI.badge('Incompleto', 'mute');
    const diff = Math.abs((s + i) - t);
    const tol = Math.max(0.01, t * 0.01);
    return diff <= tol ? UI.badge('Total = Subtotal + Impuestos', 'ok') : UI.badge(`Descuadre: ${FMT.money(diff)}`, 'err');
  }

  /* ---------- Tab: Archivo y proveedor ---------- */
  function tabArchivo(tc, f) {
    const p = f.proveedor;
    tc.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card__head"><h3>Archivo</h3>${UI.facturaBadge(f.estado)}</div>
          <div class="card__body"><dl class="kv">
            <dt>Nombre original</dt><dd>${UI.esc(f.nombre_archivo_original)}</dd>
            <dt>Tipo</dt><dd>${UI.badge(f.tipo_archivo, 'mute')}</dd>
            <dt>Almacenado</dt><dd class="mono" style="font-size:12px;word-break:break-all">${UI.esc(f.nombre_archivo_almacenado || '—')}</dd>
            <dt>Ruta</dt><dd class="mono" style="font-size:12px;word-break:break-all">${UI.esc(f.ruta_archivo || '—')}</dd>
            <dt>Cargada</dt><dd>${FMT.datetime(f.created_at)}</dd>
            <dt>Actualizada</dt><dd>${FMT.datetime(f.updated_at)}</dd>
          </dl></div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Proveedor asociado</h3></div>
          <div class="card__body">${p ? `<dl class="kv">
            <dt>Nombre</dt><dd>${UI.esc(p.nombre)}</dd>
            <dt>NIT</dt><dd class="mono">${UI.esc(p.nit)}</dd>
            <dt>Dirección</dt><dd>${UI.esc(p.direccion || '—')}</dd>
            <dt>Teléfono</dt><dd>${UI.esc(p.telefono || '—')}</dd>
            <dt>Correo</dt><dd>${UI.esc(p.email || '—')}</dd>
          </dl>` : '<p class="muted">Sin proveedor asociado todavía. Se vincula automáticamente tras la extracción OCR.</p>'}</div>
        </div>
      </div>`;
  }

  /* ---------- Tab: Texto OCR ---------- */
  function tabTexto(tc, f) {
    const raw = f.datos_extraidos?.texto_raw;
    if (!raw) { UI.empty(tc, { icon: '📝', title: 'Sin texto OCR', message: 'No hay texto crudo extraído para esta factura.' }); return; }
    tc.innerHTML = `<div class="card"><div class="card__head"><h3>Texto reconocido por OCR</h3></div>
      <div class="card__body"><pre class="mono" style="white-space:pre-wrap;font-size:12.5px;margin:0;max-height:460px;overflow:auto;background:var(--surface-2);padding:14px;border-radius:8px">${UI.esc(raw)}</pre></div></div>`;
  }

  /* ---------- Tab: Historial (bitácora) ---------- */
  async function tabHistorial(tc, f) {
    tc.innerHTML = `<div class="card"><div class="card__head"><h3>Historial de la factura</h3></div><div class="card__body" id="hist"><div class="skeleton" style="height:90px"></div></div></div>`;
    const hist = tc.querySelector('#hist');
    try {
      const items = await API.bitacoraFactura(f.id);
      if (!items || !items.length) { UI.empty(hist, { icon: '🕓', title: 'Sin registros', message: 'No hay entradas de bitácora para esta factura.' }); return; }
      hist.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Acción</th><th>Estado</th><th>Resultado</th></tr></thead><tbody>
        ${items.map(b => `<tr><td>${FMT.datetime(b.fecha_hora)}</td><td>${UI.badge(b.accion,'info')}</td><td>${UI.bitacoraBadge(b.estado)}</td><td>${UI.esc(b.resultado || '—')}</td></tr>`).join('')}
      </tbody></table></div>`;
    } catch (err) { UI.empty(hist, { icon: '⚠️', title: 'Error', message: err.message }); }
  }

  /* ---------- Acciones ---------- */
  async function procesarOCR(root, id) {
    UI.showLoading();
    try {
      const r = await API.ocrProcesar(id);
      UI.hideLoading();
      r.validado ? UI.toastOk(`OCR completado y validado (confianza ${r.confianza_ocr ?? '—'}%).`)
                 : UI.toastWarn('OCR completado, pero no pasó la validación. Revisa y corrige los datos.', 'OCR');
      render(root, { params: { id } });
    } catch (err) { UI.hideLoading(); UI.toastErr(err.message, 'Error de OCR'); }
  }

  function openCorreccion(root, f) {
    const d = f.datos_extraidos || {};
    const form = UI.h('form', { class: 'form-grid', html: `
      <div class="form-grid cols-2">
        <div class="field"><label>N.º de factura</label><input class="input" name="numero_factura" value="${UI.esc(d.numero_factura || '')}" /></div>
        <div class="field"><label>Fecha</label><input class="input" name="fecha_factura" type="date" value="${UI.esc(d.fecha_factura || '')}" /></div>
      </div>
      <div class="form-grid cols-2">
        <div class="field"><label>Proveedor (OCR)</label><input class="input" name="nombre_proveedor_ocr" value="${UI.esc(d.nombre_proveedor_ocr || '')}" /></div>
        <div class="field"><label>NIT (OCR)</label><input class="input" name="nit_ocr" value="${UI.esc(d.nit_ocr || '')}" /></div>
      </div>
      <div class="form-grid cols-2">
        <div class="field"><label>Subtotal</label><input class="input" name="subtotal" type="number" step="0.01" value="${UI.esc(d.subtotal ?? '')}" /></div>
        <div class="field"><label>Impuestos</label><input class="input" name="impuestos" type="number" step="0.01" value="${UI.esc(d.impuestos ?? '')}" /></div>
      </div>
      <div class="form-grid cols-2">
        <div class="field"><label>Total</label><input class="input" name="total" type="number" step="0.01" value="${UI.esc(d.total ?? '')}" /></div>
        <div class="field"><label>¿Validado?</label><select class="select" name="validado"><option value="true"${d.validado?' selected':''}>Sí, marcar como válido</option><option value="false"${!d.validado?' selected':''}>No</option></select></div>
      </div>
      <div class="field"><label>Observaciones</label><textarea class="input" name="observaciones_validacion" placeholder="Comentario sobre la corrección aplicada">${UI.esc(d.observaciones_validacion || '')}</textarea></div>
    ` });

    UI.openModal({
      title: 'Corregir datos extraídos', size: 'lg', body: form,
      footer: [
        { label: 'Cancelar', class: 'btn--ghost' },
        { label: 'Guardar correcciones', class: 'btn--primary', closeAfter: false, onClick: async ({ close, btn }) => {
          const v = UI.serializeForm(form);
          const payload = {
            numero_factura: v.numero_factura || null,
            fecha_factura: v.fecha_factura || null,
            nombre_proveedor_ocr: v.nombre_proveedor_ocr || null,
            nit_ocr: v.nit_ocr || null,
            subtotal: v.subtotal === '' ? null : parseFloat(v.subtotal),
            impuestos: v.impuestos === '' ? null : parseFloat(v.impuestos),
            total: v.total === '' ? null : parseFloat(v.total),
            validado: v.validado === 'true',
            observaciones_validacion: v.observaciones_validacion || null,
          };
          btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Guardando…';
          try {
            await API.facturaActualizarDatos(f.id, payload);
            UI.toastOk('Datos corregidos correctamente.');
            close();
            render(root, { params: { id: f.id } });
          } catch (err) {
            btn.disabled = false; btn.textContent = 'Guardar correcciones';
            UI.toastErr(err.message); return false;
          }
        } },
      ],
    });
  }

  async function rpaRegistrar(id) {
    UI.showLoading();
    try {
      const r = await API.rpaRegistrarFormulario(id);
      UI.hideLoading();
      r.ok ? UI.toastOk(r.mensaje || 'Datos registrados en el formulario web.')
           : UI.toastWarn(r.mensaje || 'RPA no completó la ejecución (revisa RPA_FORM_URL).', 'RPA');
    } catch (err) { UI.hideLoading(); UI.toastErr(err.message, 'RPA'); }
  }

  async function eliminar(f) {
    const ok = await UI.confirm({ title: 'Eliminar factura', danger: true, okLabel: 'Eliminar',
      message: `Se eliminará la factura #${f.id} y su archivo del disco. Esta acción no se puede deshacer.` });
    if (!ok) return;
    UI.showLoading();
    try { await API.facturaEliminar(f.id); UI.hideLoading(); UI.toastOk('Factura eliminada.'); Router.go('/facturas'); }
    catch (err) { UI.hideLoading(); err.status === 403 ? UI.toastErr('Se requiere rol admin.') : UI.toastErr(err.message); }
  }

  window.SI_VIEWS.facturaDetalle = render;
})();

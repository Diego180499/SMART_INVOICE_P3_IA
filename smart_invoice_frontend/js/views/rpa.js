/* views/rpa.js — Automatización RPA: registro en formulario, envío de reportes, historial */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, FMT = window.SI_FMT;

  async function render(root) {
    root.innerHTML = `
      <div class="page-head"><div><h2>RPA / Automatización</h2><div class="lead">Registro automático en formularios web y envío de reportes por correo</div></div></div>
      <div class="grid-2 mb-0" style="margin-bottom:18px">
        <div class="card">
          <div class="card__head"><h3>Registrar factura en formulario web</h3></div>
          <div class="card__body">
            <p class="soft">Ejecuta el bot (Playwright) que llena el formulario configurado en <span class="mono">RPA_FORM_URL</span> con los datos extraídos de una factura.</p>
            <div class="filters" style="margin-bottom:0">
              <div class="field" style="flex:1"><label>ID de factura</label><input class="input" id="rpa-fid" type="number" min="1" placeholder="Ej. 1" /></div>
              <button class="btn btn--primary" id="rpa-run">Ejecutar RPA</button>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Enviar reporte por correo</h3></div>
          <div class="card__body">
            <p class="soft">Adjunta y envía un reporte previamente generado al destinatario indicado vía SMTP.</p>
            <div class="filters" style="margin-bottom:0">
              <div class="field"><label>ID de reporte</label><input class="input" id="rpa-rid" type="number" min="1" placeholder="Ej. 1" /></div>
              <div class="field" style="flex:1"><label>Destinatario</label><input class="input" id="rpa-dest" type="email" placeholder="gerencia@empresa.com" /></div>
              <button class="btn btn--primary" id="rpa-send">Enviar</button>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h3>Historial de ejecuciones RPA</h3><button class="btn btn--ghost btn--sm" id="rpa-refresh">Actualizar</button></div>
        <div class="card__body" id="rpa-hist"></div>
      </div>`;

    root.querySelector('#rpa-run').addEventListener('click', () => registrar(root));
    root.querySelector('#rpa-send').addEventListener('click', () => enviar(root));
    root.querySelector('#rpa-refresh').addEventListener('click', () => loadHist(root));
    loadHist(root);
  }

  async function registrar(root) {
    const id = parseInt(root.querySelector('#rpa-fid').value, 10);
    if (!id) { UI.toastErr('Ingresa un ID de factura válido.'); return; }
    const btn = root.querySelector('#rpa-run');
    btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Ejecutando…';
    try {
      const r = await API.rpaRegistrarFormulario(id);
      r.ok ? UI.toastOk(r.mensaje || 'Datos registrados en el formulario.') : UI.toastWarn(r.mensaje || 'RPA no completó (revisa RPA_FORM_URL).', 'RPA');
      loadHist(root);
    } catch (err) { UI.toastErr(err.message); }
    btn.disabled = false; btn.textContent = 'Ejecutar RPA';
  }

  async function enviar(root) {
    const id = parseInt(root.querySelector('#rpa-rid').value, 10);
    const dest = root.querySelector('#rpa-dest').value.trim();
    if (!id) { UI.toastErr('Ingresa un ID de reporte válido.'); return; }
    if (!dest) { UI.toastErr('Ingresa un destinatario.'); return; }
    const btn = root.querySelector('#rpa-send');
    btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span> Enviando…';
    try {
      const r = await API.rpaEnviarReporte(id, dest);
      r.ok ? UI.toastOk(r.mensaje || 'Reporte enviado.') : UI.toastWarn(r.mensaje || 'No se pudo enviar (revisa SMTP).', 'Correo');
      loadHist(root);
    } catch (err) { UI.toastErr(err.message); }
    btn.disabled = false; btn.textContent = 'Enviar';
  }

  async function loadHist(root) {
    const cont = root.querySelector('#rpa-hist');
    cont.innerHTML = '<div class="skeleton" style="height:90px"></div>';
    try {
      const items = await API.rpaHistorial();
      if (!items || !items.length) { UI.empty(cont, { icon: '🤖', title: 'Sin ejecuciones', message: 'Aún no se han ejecutado automatizaciones RPA.' }); return; }
      cont.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr>
        <th>Fecha</th><th>Acción</th><th>Estado</th><th>Factura</th><th>Resultado</th>
      </tr></thead><tbody>
        ${items.map(b => `<tr>
          <td>${FMT.datetime(b.fecha_hora)}</td>
          <td>${UI.badge(b.accion, 'info')}</td>
          <td>${UI.bitacoraBadge(b.estado)}</td>
          <td>${b.factura_id ? `<a href="#/facturas/${b.factura_id}">#${b.factura_id}</a>` : '—'}</td>
          <td>${UI.esc(b.resultado || '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
    } catch (err) { UI.empty(cont, { icon: '⚠️', title: 'Error', message: err.message }); }
  }

  window.SI_VIEWS.rpa = render;
})();

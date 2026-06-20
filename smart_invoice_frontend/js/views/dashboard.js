/* views/dashboard.js — Panel con métricas y gráficas */
(function () {
  'use strict';
  window.SI_VIEWS = window.SI_VIEWS || {};
  const UI = window.SI_UI, API = window.SI_API, Store = window.SI_STORE, FMT = window.SI_FMT, Router = window.SI_ROUTER;

  const COLORS = { Procesado: '#588157', Pendiente: '#A3B18A', Error: '#b3402f', Rechazado: '#3A5A40' };
  const charts = [];

  function destroyCharts() { while (charts.length) { try { charts.pop().destroy(); } catch (_) {} } }

  async function render(root) {
    destroyCharts();
    const u = Store.getUser() || {};
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Hola, ${UI.esc((u.nombre || '').split(' ')[0] || 'usuario')} 👋</h2><div class="lead">Resumen general del procesamiento de facturas</div></div>
        <div class="page-head__actions">
          <a href="#/facturas" class="btn btn--primary">+ Cargar factura</a>
          <a href="#/reportes" class="btn btn--ghost">Generar reporte</a>
        </div>
      </div>
      <div class="stat-grid" id="stats"></div>
      <div class="grid-2" style="margin-bottom:18px">
        <div class="card"><div class="card__head"><h3>Facturas por estado</h3></div><div class="card__body"><div class="chart-box"><canvas id="ch-estado"></canvas></div></div></div>
        <div class="card"><div class="card__head"><h3>Actividad por tipo de acción</h3></div><div class="card__body"><div class="chart-box"><canvas id="ch-accion"></canvas></div></div></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card__head"><h3>Facturas recientes</h3><a href="#/facturas" class="soft" style="font-size:12.5px">Ver todas ›</a></div><div class="card__body" id="recent-fact"></div></div>
        <div class="card"><div class="card__head"><h3>Actividad reciente</h3><a href="#/bitacora" class="soft" style="font-size:12.5px">Ver bitácora ›</a></div><div class="card__body" id="recent-bit"></div></div>
      </div>`;

    loadStats(root);
    loadCharts(root);
    loadRecent(root);
  }

  function statCard(label, value, sub, ico) {
    return `<div class="stat"><div class="stat__ico">${ico}</div><div class="stat__label">${label}</div><div class="stat__value">${value}</div><div class="stat__sub">${sub || ''}</div></div>`;
  }

  async function totalFor(params) {
    try { return (await API.facturas(Object.assign({ limit: 1 }, params))).total; } catch (_) { return 0; }
  }

  async function loadStats(root) {
    const stats = root.querySelector('#stats');
    stats.innerHTML = Array(5).fill('<div class="stat"><div class="skeleton" style="height:60px"></div></div>').join('');
    const [total, proc, pend, err, rech, provTotal, repTotal] = await Promise.all([
      totalFor({}), totalFor({ estado: 'Procesado' }), totalFor({ estado: 'Pendiente' }),
      totalFor({ estado: 'Error' }), totalFor({ estado: 'Rechazado' }),
      API.proveedores({ limit: 1, solo_activos: true }).then(r => r.total).catch(() => 0),
      API.reportes({ limit: 1 }).then(r => r.total).catch(() => 0),
    ]);
    const tasa = total ? Math.round((proc / total) * 100) : 0;
    stats.innerHTML =
      statCard('Total facturas', FMT.number(total), 'En el sistema', '🧾') +
      statCard('Procesadas', FMT.number(proc), `${tasa}% del total`, '✅') +
      statCard('Pendientes', FMT.number(pend), 'Esperando OCR', '⏳') +
      statCard('Error / Rechazadas', FMT.number(err + rech), 'Requieren revisión', '⚠️') +
      statCard('Proveedores activos', FMT.number(provTotal), `${FMT.number(repTotal)} reportes generados`, '🏢');
    // guarda para la gráfica de estados
    root._estados = { Procesado: proc, Pendiente: pend, Error: err, Rechazado: rech };
    drawEstadoChart(root);
  }

  function drawEstadoChart(root) {
    if (!window.Chart || !root._estados) return;
    const canvas = root.querySelector('#ch-estado');
    if (!canvas) return;
    const data = root._estados;
    const labels = Object.keys(data).filter(k => data[k] > 0);
    if (!labels.length) { canvas.parentElement.innerHTML = '<div class="empty"><div class="emo">📊</div><h4>Aún no hay facturas</h4></div>'; return; }
    charts.push(new window.Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: labels.map(l => data[l]), backgroundColor: labels.map(l => COLORS[l]), borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 } } } } },
    }));
  }

  async function loadCharts(root) {
    if (!window.Chart) return;
    const canvas = root.querySelector('#ch-accion');
    try {
      const res = await API.bitacora({ limit: 200 });
      const counts = {};
      (res.items || []).forEach(b => { counts[b.accion] = (counts[b.accion] || 0) + 1; });
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (!entries.length) { canvas.parentElement.innerHTML = '<div class="empty"><div class="emo">📈</div><h4>Sin actividad registrada</h4></div>'; return; }
      charts.push(new window.Chart(canvas, {
        type: 'bar',
        data: { labels: entries.map(e => e[0]), datasets: [{ label: 'Eventos', data: entries.map(e => e[1]), backgroundColor: '#588157', borderRadius: 5 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { font: { size: 11 } } } } },
      }));
    } catch (_) {
      canvas.parentElement.innerHTML = '<div class="empty"><div class="emo">📈</div><h4>Sin datos de bitácora</h4></div>';
    }
  }

  async function loadRecent(root) {
    const rf = root.querySelector('#recent-fact');
    const rb = root.querySelector('#recent-bit');
    rf.innerHTML = '<div class="skeleton" style="height:80px"></div>';
    rb.innerHTML = '<div class="skeleton" style="height:80px"></div>';

    try {
      const res = await API.facturas({ limit: 6 });
      if (!res.items || !res.items.length) UI.empty(rf, { icon: '🧾', title: 'Sin facturas', message: 'Carga la primera factura.' });
      else rf.innerHTML = `<div class="table-wrap" style="border:none"><table class="tbl"><tbody>
        ${res.items.map(f => `<tr class="row-click" data-id="${f.id}"><td>#${f.id}</td><td style="font-weight:600">${UI.esc(f.nombre_archivo_original)}</td><td>${UI.facturaBadge(f.estado)}</td><td class="muted" style="font-size:12px">${FMT.datetime(f.created_at)}</td></tr>`).join('')}
      </tbody></table></div>`;
      rf.querySelectorAll('tr.row-click').forEach(tr => tr.addEventListener('click', () => Router.go('/facturas/' + tr.dataset.id)));
    } catch (err) { UI.empty(rf, { icon: '⚠️', title: 'Error', message: err.message }); }

    try {
      const res = await API.bitacora({ limit: 6 });
      if (!res.items || !res.items.length) UI.empty(rb, { icon: '🕓', title: 'Sin actividad', message: 'No hay eventos todavía.' });
      else rb.innerHTML = `<div class="table-wrap" style="border:none"><table class="tbl"><tbody>
        ${res.items.map(b => `<tr><td>${UI.bitacoraBadge(b.estado)}</td><td>${UI.badge(b.accion,'info')}</td><td class="muted" style="font-size:12px">${FMT.datetime(b.fecha_hora)}</td></tr>`).join('')}
      </tbody></table></div>`;
    } catch (err) { UI.empty(rb, { icon: '⚠️', title: 'Error', message: err.message }); }
  }

  window.SI_VIEWS.dashboard = render;
})();

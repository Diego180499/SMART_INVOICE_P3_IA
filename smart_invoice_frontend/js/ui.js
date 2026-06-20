/* ui.js — Helpers de interfaz: DOM, toasts, modales, loading, badges */
(function () {
  'use strict';

  /* ---------- Escape de HTML ---------- */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Creación de elementos (h('div',{class:'x'}, hijos)) ---------- */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const val = attrs[k];
        if (val === null || val === undefined || val === false) return;
        if (k === 'class') el.className = val;
        else if (k === 'html') el.innerHTML = val;
        else if (k === 'text') el.textContent = val;
        else if (k === 'dataset') Object.assign(el.dataset, val);
        else if (k.startsWith('on') && typeof val === 'function') el.addEventListener(k.slice(2).toLowerCase(), val);
        else if (k in el && k !== 'list') { try { el[k] = val; } catch (_) { el.setAttribute(k, val); } }
        else el.setAttribute(k, val);
      });
    }
    appendChildren(el, children);
    return el;
  }
  function appendChildren(el, children) {
    if (children === null || children === undefined || children === false) return;
    if (Array.isArray(children)) { children.forEach((c) => appendChildren(el, c)); return; }
    if (children instanceof Node) { el.appendChild(children); return; }
    el.appendChild(document.createTextNode(String(children)));
  }

  /* ---------- Toasts ---------- */
  function toast(message, type, title) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const t = h('div', { class: 'toast toast--' + (type || 'ok') }, [
      h('div', null, [
        title ? h('strong', { text: title }) : null,
        h('span', { text: message }),
      ]),
    ]);
    stack.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0'; t.style.transform = 'translateY(6px)';
      setTimeout(() => t.remove(), 260);
    }, type === 'err' ? 5200 : 3400);
  }
  const toastOk   = (m, t) => toast(m, 'ok', t);
  const toastErr  = (m, t) => toast(m, 'err', t || 'Error');
  const toastWarn = (m, t) => toast(m, 'warn', t);

  /* ---------- Loading overlay ---------- */
  let loadCount = 0;
  function showLoading() { loadCount++; document.getElementById('loading-overlay')?.classList.remove('hidden'); }
  function hideLoading() { loadCount = Math.max(0, loadCount - 1); if (loadCount === 0) document.getElementById('loading-overlay')?.classList.add('hidden'); }

  /* ---------- Modal ----------
     openModal({ title, body(node|html), size, footer:[{label,class,onClick,closeAfter}], onClose })
     Devuelve un objeto { close() }. */
  function openModal(opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    const backdrop = h('div', { class: 'modal-backdrop' });
    const modal = h('div', { class: 'modal' + (opts.size === 'lg' ? ' modal--lg' : '') });

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      if (typeof opts.onClose === 'function') opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    const head = h('div', { class: 'modal__head' }, [
      h('h3', { text: opts.title || '' }),
      h('button', { class: 'modal__close', type: 'button', onClick: close, html: '&times;' }),
    ]);
    const body = h('div', { class: 'modal__body' });
    if (opts.body instanceof Node) body.appendChild(opts.body);
    else if (typeof opts.body === 'string') body.innerHTML = opts.body;

    modal.appendChild(head);
    modal.appendChild(body);

    if (opts.footer && opts.footer.length) {
      const foot = h('div', { class: 'modal__foot' });
      opts.footer.forEach((b) => {
        const btn = h('button', {
          class: 'btn ' + (b.class || 'btn--ghost'),
          type: 'button',
          text: b.label,
          onClick: async () => {
            if (typeof b.onClick === 'function') {
              const r = await b.onClick({ close, btn });
              if (r === false) return; // cancelar cierre
            }
            if (b.closeAfter !== false) close();
          },
        });
        foot.appendChild(btn);
      });
      modal.appendChild(foot);
    }

    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop && opts.dismissable !== false) close(); });
    document.addEventListener('keydown', onKey);
    root.appendChild(backdrop);
    return { close, body, modal };
  }

  /* ---------- Confirmación ---------- */
  function confirm(opts) {
    return new Promise((resolve) => {
      openModal({
        title: opts.title || 'Confirmar',
        body: h('p', { class: 'soft', text: opts.message || '¿Deseas continuar?' }),
        footer: [
          { label: opts.cancelLabel || 'Cancelar', class: 'btn--ghost', onClick: () => resolve(false) },
          { label: opts.okLabel || 'Confirmar', class: opts.danger ? 'btn--danger' : 'btn--primary', onClick: () => resolve(true) },
        ],
        onClose: () => resolve(false),
      });
    });
  }

  /* ---------- Badges de estado ---------- */
  const FACTURA_BADGE = { Pendiente: 'warn', Procesado: 'ok', Error: 'err', Rechazado: 'err' };
  const BITACORA_BADGE = { EXITOSO: 'ok', FALLIDO: 'err', PENDIENTE: 'warn' };
  function badge(text, kind) {
    return `<span class="badge badge--${kind || 'mute'}">${esc(text)}</span>`;
  }
  function facturaBadge(estado) { return badge(estado, FACTURA_BADGE[estado] || 'mute'); }
  function bitacoraBadge(estado) { return badge(estado, BITACORA_BADGE[estado] || 'mute'); }
  function validadoBadge(v) { return v ? badge('Validado', 'ok') : badge('Sin validar', 'warn'); }

  /* ---------- Estado vacío ---------- */
  function empty(node, opts) {
    opts = opts || {};
    node.innerHTML = '';
    node.appendChild(h('div', { class: 'empty' }, [
      h('div', { class: 'emo', text: opts.icon || '📭' }),
      h('h4', { text: opts.title || 'Sin datos' }),
      opts.message ? h('p', { text: opts.message }) : null,
      opts.action || null,
    ]));
  }

  /* ---------- Skeleton de tabla ---------- */
  function tableSkeleton(cols, rows) {
    const body = [];
    for (let r = 0; r < (rows || 5); r++) {
      const tds = [];
      for (let c = 0; c < cols; c++) tds.push('<td><div class="skeleton" style="height:14px;width:'+ (40 + (c*13)%50) +'%"></div></td>');
      body.push('<tr>' + tds.join('') + '</tr>');
    }
    return body.join('');
  }

  /* ---------- Form helpers ---------- */
  function serializeForm(form) {
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
    return data;
  }

  window.SI_UI = {
    esc, h, toast, toastOk, toastErr, toastWarn,
    showLoading, hideLoading, openModal, confirm,
    badge, facturaBadge, bitacoraBadge, validadoBadge,
    empty, tableSkeleton, serializeForm,
  };
})();

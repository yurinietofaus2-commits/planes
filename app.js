(() => {
  'use strict';

  const API = window.PLANES_API;
  const LS_CLAVE = 'planes_clave';
  const LS_CACHE = 'planes_cache';

  const CONCEPTOS = [
    { n: 'Gasolina', e: '⛽' },
    { n: 'Actividad', e: '🎟️' },
    { n: 'Transporte', e: '🚌' },
    { n: 'Material', e: '🎒' },
    { n: 'Comida', e: '🥪' },
    { n: 'Alojamiento', e: '⛺' },
    { n: 'Peajes', e: '🛣️' },
    { n: 'Parking', e: '🅿️' }
  ];
  const emojiDe = n => (CONCEPTOS.find(c => c.n.toLowerCase() === String(n).toLowerCase()) || { e: '•' }).e;

  const $ = s => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  let planes = [];
  let editando = null; // id en edición

  /* ---------- utilidades ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseFecha = f => { if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) return null; const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d); };
  const diasHasta = d => Math.round((d - hoy()) / 86400000);

  function cuando(dias) {
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    if (dias === -1) return 'Ayer';
    if (dias > 1 && dias < 14) return `En ${dias} días`;
    if (dias >= 14 && dias < 60) return `En ${Math.round(dias / 7)} semanas`;
    if (dias >= 60) return `En ${Math.round(dias / 30)} meses`;
    if (dias < -1 && dias > -60) return `Hace ${-dias} días`;
    return `Hace ${Math.round(-dias / 30)} meses`;
  }

  function normalizaUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
  }

  function toast(msg, error) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast toast--show' + (error ? ' toast--error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; }, 2800);
  }

  function status(msg, error) {
    const s = $('#status');
    if (!msg) { s.hidden = true; return; }
    s.hidden = false;
    s.textContent = msg;
    s.className = 'status' + (error ? ' status--error' : '');
  }

  /* ---------- API ---------- */
  async function apiList() {
    const url = API + '?action=list&clave=' + encodeURIComponent(store.get(LS_CLAVE) || '') + '&t=' + Date.now();
    const r = await fetch(url);
    return r.json();
  }
  async function apiPost(body) {
    body.clave = store.get(LS_CLAVE) || '';
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return r.json();
  }

  /* ---------- render ---------- */
  function ordenar(lista) {
    const prox = [], sin = [], pas = [];
    const h = hoy();
    for (const p of lista) {
      const d = parseFecha(p.fecha);
      if (!d) sin.push(p);
      else if (d >= h) prox.push(p);
      else pas.push(p);
    }
    prox.sort((a, b) => a.fecha.localeCompare(b.fecha));
    pas.sort((a, b) => b.fecha.localeCompare(a.fecha));
    sin.sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')));
    return { prox, sin, pas };
  }

  function tarjeta(p) {
    const d = parseFecha(p.fecha);
    const dias = d ? diasHasta(d) : null;
    const pronto = dias !== null && dias >= 0 && dias <= 7;
    const cls = ['card', !d && 'card--sinfecha', pronto && 'card--pronto'].filter(Boolean).join(' ');

    const datebox = d
      ? `<div class="datebox" title="${esc(d.toLocaleDateString('es-ES', { dateStyle: 'full' }))}">
           <span class="datebox__m">${esc(d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''))}</span>
           <span class="datebox__d">${d.getDate()}</span>
           <span class="datebox__w">${esc(d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''))}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}</span>
         </div>`
      : `<div class="datebox datebox--none" title="Sin fecha"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></div>`;

    const when = d
      ? `<span class="when ${dias < 0 ? 'when--past' : ''}">${cuando(dias)}</span>`
      : `<span class="when when--past">Cuando surja</span>`;

    const links = (p.links || []).map(u => {
      const url = normalizaUrl(u);
      if (!url) return '';
      const host = new URL(url).hostname.replace(/^www\./, '');
      return `<a class="link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(url)}">
                <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32" alt="" loading="lazy" onerror="this.style.display='none'">
                <span>${esc(host)}</span></a>`;
    }).join('');

    const gastos = (p.presupuesto || []);
    const total = gastos.reduce((s, g) => s + (Number(g.importe) || 0), 0);
    const budget = gastos.length
      ? `<div class="budget">
           ${gastos.map(g => `<span class="chip"><i>${emojiDe(g.concepto)}</i>${esc(g.concepto)}${g.importe !== null && g.importe !== '' && !isNaN(g.importe) ? ` <b>${eur(Number(g.importe))}</b>` : ''}</span>`).join('')}
           ${total ? `<span class="budget__total">${eur(total)}</span>` : ''}
         </div>`
      : '';

    const gente = (p.participantes || []);
    const people = gente.length
      ? `<div class="people" title="Participantes">
           ${gente.map(n => `<span class="person"><span class="avatar" style="--h:${hue(n)}">${esc(iniciales(n))}</span>${esc(n)}</span>`).join('')}
         </div>`
      : '';

    const cal = d
      ? `<div class="cal">
           <button type="button" class="calbtn" data-cal="${esc(p.id)}" aria-expanded="false">
             <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v5M9.5 15.5h5"/></svg>
             Añadir al calendario
           </button>
           <div class="calmenu" hidden>
             <a href="${esc(urlGoogle(p))}" target="_blank" rel="noopener noreferrer">Google Calendar</a>
             <button type="button" data-ics="${esc(p.id)}">Apple / Outlook (.ics)</button>
           </div>
         </div>`
      : '';

    return `<article class="${cls}" data-id="${esc(p.id)}">
      <div class="card__head">
        ${datebox}
        <div class="card__titles">
          <h3 class="card__title ${p.titulo ? '' : 'card__title--empty'}">${p.titulo ? esc(p.titulo) : 'Plan sin título'}</h3>
          ${when}
        </div>
      </div>
      <button class="iconbtn card__edit" type="button" data-editar="${esc(p.id)}" aria-label="Editar plan">
        <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>
      </button>
      ${p.descripcion ? `<p class="card__desc">${esc(p.descripcion)}</p>` : ''}
      ${people}
      ${links ? `<div class="links">${links}</div>` : ''}
      ${budget}
      ${cal}
    </article>`;
  }

  /* ---------- participantes: utilidades ---------- */
  function iniciales(n) {
    const p = String(n).trim().split(/\s+/);
    return ((p[0] || '')[0] || '').toUpperCase() + ((p[1] || '')[0] || '').toUpperCase();
  }
  function hue(n) {
    let h = 0;
    for (const c of String(n).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }

  /* ---------- calendario ---------- */
  const yyyymmdd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  function rangoDia(p) {
    const d = parseFecha(p.fecha);
    const sig = new Date(d); sig.setDate(sig.getDate() + 1);
    return [yyyymmdd(d), yyyymmdd(sig)];
  }
  function detallesEvento(p) {
    const partes = [];
    if (p.descripcion) partes.push(p.descripcion);
    if ((p.participantes || []).length) partes.push('Participantes: ' + p.participantes.join(', '));
    const ls = (p.links || []).map(normalizaUrl).filter(Boolean);
    if (ls.length) partes.push('Enlaces:\n' + ls.join('\n'));
    const tot = (p.presupuesto || []).reduce((s, g) => s + (Number(g.importe) || 0), 0);
    if (tot) partes.push('Presupuesto estimado: ' + eur(tot));
    return partes.join('\n\n');
  }
  function urlGoogle(p) {
    const [a, b] = rangoDia(p);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: p.titulo || 'Plan', dates: `${a}/${b}`, details: detallesEvento(p) });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    const out = [];
    while (line.length > 72) { out.push(line.slice(0, 72)); line = ' ' + line.slice(72); }
    out.push(line);
    return out.join('\r\n');
  }
  function descargarIcs(p) {
    const [a, b] = rangoDia(p);
    const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lineas = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planes//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${p.id}@planes`,
      `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${a}`,
      `DTEND;VALUE=DATE:${b}`,
      `SUMMARY:${icsEsc(p.titulo || 'Plan')}`,
      `DESCRIPTION:${icsEsc(detallesEvento(p))}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].map(icsFold).join('\r\n');
    const blob = new Blob([lineas], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = (p.titulo || 'plan').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) + '.ics';
    document.body.appendChild(el);
    el.click();
    el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function cerrarMenusCal(excepto) {
    document.querySelectorAll('.calmenu').forEach(m => {
      if (m === excepto) return;
      m.hidden = true;
      m.previousElementSibling.setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cal]');
    if (b) {
      const m = b.nextElementSibling;
      cerrarMenusCal(m);
      m.hidden = !m.hidden;
      b.setAttribute('aria-expanded', String(!m.hidden));
      return;
    }
    const ics = e.target.closest('[data-ics]');
    if (ics) {
      const p = planes.find(x => x.id === ics.dataset.ics);
      if (p) descargarIcs(p);
      cerrarMenusCal();
      return;
    }
    if (e.target.closest('.calmenu a')) { setTimeout(cerrarMenusCal, 0); return; }
    if (!e.target.closest('.cal')) cerrarMenusCal();
  });

  function render() {
    const { prox, sin, pas } = ordenar(planes);
    $('#gridProximos').innerHTML = prox.map(tarjeta).join('');
    $('#gridSinFecha').innerHTML = sin.map(tarjeta).join('');
    $('#gridPasados').innerHTML = pas.map(tarjeta).join('');
    $('#secProximos').hidden = !prox.length;
    $('#secSinFecha').hidden = !sin.length;
    $('#secPasados').hidden = !pas.length;
    $('#numPasados').textContent = pas.length;
    $('#empty').hidden = planes.length > 0;
  }

  function skeleton() {
    $('#secProximos').hidden = false;
    $('#gridProximos').innerHTML = '<div class="skeleton"></div>'.repeat(3);
    $('#secSinFecha').hidden = $('#secPasados').hidden = true;
    $('#empty').hidden = true;
  }

  async function cargar() {
    const cache = store.get(LS_CACHE);
    if (cache) { try { planes = JSON.parse(cache); render(); } catch (e) { skeleton(); } }
    else skeleton();
    try {
      const r = await apiList();
      if (!r.ok) {
        if (r.error === 'clave') return pedirClave(true);
        throw new Error(r.error);
      }
      planes = r.planes || [];
      store.set(LS_CACHE, JSON.stringify(planes));
      status('');
      render();
    } catch (e) {
      status('No se ha podido conectar con la hoja de cálculo. ' + (cache ? 'Mostrando la última copia guardada.' : 'Revisa la conexión y recarga.'), true);
      if (!cache) { planes = []; render(); $('#empty').hidden = true; }
    }
  }

  /* ---------- clave ---------- */
  function pedirClave(error) {
    $('#claveError').hidden = !error;
    const d = $('#dlgClave');
    if (!d.open) d.showModal();
    d.querySelector('input').focus();
  }
  $('#formClave').addEventListener('submit', e => {
    e.preventDefault();
    const v = e.target.clave.value.trim();
    if (!v) return;
    store.set(LS_CLAVE, v);
    store.del(LS_CACHE);
    $('#dlgClave').close();
    e.target.reset();
    cargar();
  });
  $('#dlgClave').addEventListener('cancel', e => e.preventDefault());
  $('#btnSalir').addEventListener('click', () => { store.del(LS_CLAVE); store.del(LS_CACHE); planes = []; render(); pedirClave(false); });

  /* ---------- formulario ---------- */
  const form = $('#formPlan');
  const dlg = $('#dlgPlan');

  function filaLink(valor = '') {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<input type="text" inputmode="url" placeholder="https://…" value="${esc(valor)}">
      <button type="button" class="iconbtn" aria-label="Quitar enlace"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    row.querySelector('button').onclick = () => row.remove();
    $('#links').appendChild(row);
    return row;
  }

  function filaGasto(concepto = '', importe = '', libre = false) {
    const row = document.createElement('div');
    row.className = 'row gasto';
    row.innerHTML = `<input type="text" class="gasto__nombre" placeholder="Concepto" value="${esc(concepto)}" ${libre ? '' : 'readonly tabindex="-1"'}>
      <div class="importe"><input type="number" inputmode="decimal" step="0.01" min="0" placeholder="0" value="${importe === null ? '' : esc(importe)}"></div>
      <button type="button" class="iconbtn" aria-label="Quitar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    row.querySelector('button').onclick = () => { row.remove(); syncPicks(); calcTotal(); };
    row.querySelector('.importe input').addEventListener('input', calcTotal);
    $('#gastos').appendChild(row);
    syncPicks(); calcTotal();
    return row;
  }

  function leerGastos() {
    return [...$('#gastos').children].map(r => {
      const [n, v] = r.querySelectorAll('input');
      const imp = v.value === '' ? null : Number(String(v.value).replace(',', '.'));
      return { concepto: n.value.trim(), importe: isNaN(imp) ? null : imp };
    }).filter(g => g.concepto);
  }

  function calcTotal() {
    const g = leerGastos();
    const t = g.reduce((s, x) => s + (x.importe || 0), 0);
    $('#totalRow').hidden = !g.length;
    $('#totalForm').textContent = eur(t);
  }

  function syncPicks() {
    const usados = new Set(leerGastos().map(g => g.concepto.toLowerCase()));
    document.querySelectorAll('.pick[data-c]').forEach(b => b.classList.toggle('pick--on', usados.has(b.dataset.c.toLowerCase())));
  }

  $('#chipsPick').innerHTML = CONCEPTOS.map(c => `<button type="button" class="pick" data-c="${c.n}">${c.e} ${c.n}</button>`).join('')
    + `<button type="button" class="pick" data-otro>＋ Otro</button>`;
  $('#chipsPick').addEventListener('click', e => {
    const b = e.target.closest('.pick');
    if (!b) return;
    if (b.dataset.otro !== undefined) { filaGasto('', '', true).querySelector('input').focus(); return; }
    const c = b.dataset.c;
    const existente = [...$('#gastos').children].find(r => r.querySelector('input').value.toLowerCase() === c.toLowerCase());
    if (existente) { existente.remove(); syncPicks(); calcTotal(); }
    else filaGasto(c).querySelector('.importe input').focus();
  });

  /* participantes en el formulario */
  let personas = [];
  function pintarPersonas() {
    $('#people').innerHTML = personas.map((n, i) =>
      `<span class="person person--edit"><span class="avatar" style="--h:${hue(n)}">${esc(iniciales(n))}</span>${esc(n)}
         <button type="button" data-quitar-persona="${i}" aria-label="Quitar ${esc(n)}">×</button></span>`).join('');
    const usados = new Set(personas.map(n => n.toLowerCase()));
    const conocidos = new Map();
    planes.forEach(p => (p.participantes || []).forEach(n => { if (!usados.has(n.toLowerCase())) conocidos.set(n.toLowerCase(), n); }));
    $('#peopleSuggest').innerHTML = [...conocidos.values()].sort((a, b) => a.localeCompare(b, 'es'))
      .map(n => `<button type="button" class="pick" data-sugerida="${esc(n)}">＋ ${esc(n)}</button>`).join('');
  }
  function añadirPersona(texto) {
    String(texto || '').split(',').map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean).forEach(n => {
      if (!personas.some(x => x.toLowerCase() === n.toLowerCase())) personas.push(n.slice(0, 40));
    });
    $('#inPersona').value = '';
    pintarPersonas();
  }
  $('#inPersona').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); añadirPersona(e.target.value); }
  });
  $('#btnAddPersona').onclick = () => { añadirPersona($('#inPersona').value); $('#inPersona').focus(); };
  $('#people').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar-persona]');
    if (b) { personas.splice(Number(b.dataset.quitarPersona), 1); pintarPersonas(); }
  });
  $('#peopleSuggest').addEventListener('click', e => {
    const b = e.target.closest('[data-sugerida]');
    if (b) añadirPersona(b.dataset.sugerida);
  });

  $('#btnAddLink').onclick = () => filaLink().querySelector('input').focus();
  $('#btnSinFecha').onclick = () => { $('#inFecha').value = ''; };

  function abrir(plan) {
    editando = plan ? plan.id : null;
    form.reset();
    $('#links').innerHTML = '';
    $('#gastos').innerHTML = '';
    $('#dlgTitulo').textContent = plan ? 'Editar plan' : 'Nuevo plan';
    $('#btnBorrar').hidden = !plan;
    delete $('#btnBorrar').dataset.seguro;
    $('#btnBorrar').textContent = 'Borrar';
    if (plan) {
      form.titulo.value = plan.titulo || '';
      form.descripcion.value = plan.descripcion || '';
      form.fecha.value = plan.fecha || '';
      (plan.links || []).forEach(l => filaLink(l));
      (plan.presupuesto || []).forEach(g => filaGasto(g.concepto, g.importe, !CONCEPTOS.some(c => c.n.toLowerCase() === g.concepto.toLowerCase())));
    }
    personas = plan ? [...(plan.participantes || [])] : [];
    $('#inPersona').value = '';
    pintarPersonas();
    if (!$('#links').children.length) filaLink();
    syncPicks(); calcTotal();
    dlg.showModal();
    if (!plan) form.titulo.focus();
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#btnNuevo, [data-nuevo]')) abrir(null);
    const ed = e.target.closest('[data-editar]');
    if (ed) abrir(planes.find(p => p.id === ed.dataset.editar));
    if (e.target.closest('[data-cerrar]')) dlg.close();
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const plan = {
      id: editando || '',
      titulo: form.titulo.value.trim(),
      descripcion: form.descripcion.value.trim(),
      fecha: form.fecha.value,
      links: [...$('#links').querySelectorAll('input')].map(i => normalizaUrl(i.value)).filter(Boolean),
      presupuesto: leerGastos(),
      participantes: (añadirPersona($('#inPersona').value), [...personas])
    };
    if (!plan.titulo && !plan.descripcion && !plan.fecha && !plan.links.length && !plan.presupuesto.length && !plan.participantes.length) {
      toast('Escribe al menos algo del plan', true);
      return;
    }
    const btn = $('#btnGuardar');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const r = await apiPost({ action: 'save', plan });
      if (!r.ok) throw new Error(r.error);
      const i = planes.findIndex(p => p.id === r.plan.id);
      if (i >= 0) planes[i] = r.plan; else planes.push(r.plan);
      store.set(LS_CACHE, JSON.stringify(planes));
      render();
      dlg.close();
      toast(editando ? 'Plan actualizado' : 'Plan guardado');
    } catch (err) {
      toast(err.message === 'clave' ? 'La clave no es válida' : 'No se pudo guardar. Inténtalo de nuevo.', true);
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });

  $('#btnBorrar').addEventListener('click', async () => {
    if (!editando) return;
    const b = $('#btnBorrar');
    if (!b.dataset.seguro) {
      b.dataset.seguro = '1';
      b.textContent = '¿Seguro? Pulsa otra vez';
      clearTimeout(b._t);
      b._t = setTimeout(() => { delete b.dataset.seguro; b.textContent = 'Borrar'; }, 3500);
      return;
    }
    delete b.dataset.seguro; b.textContent = 'Borrar';
    b.disabled = true;
    try {
      const r = await apiPost({ action: 'delete', id: editando });
      if (!r.ok) throw new Error(r.error);
      planes = planes.filter(x => x.id !== editando);
      store.set(LS_CACHE, JSON.stringify(planes));
      render();
      dlg.close();
      toast('Plan borrado');
    } catch (err) {
      toast('No se pudo borrar', true);
    } finally { b.disabled = false; }
  });

  /* ---------- inicio ---------- */
  if (!API || API.includes('PEGAR')) {
    status('Falta configurar la URL del Apps Script en config.js', true);
    render();
  } else if (!store.get(LS_CLAVE)) {
    render(); $('#empty').hidden = true; pedirClave(false);
  } else {
    cargar();
  }
})();

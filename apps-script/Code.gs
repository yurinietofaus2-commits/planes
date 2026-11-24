/**
 * API de "Planes" sobre Google Sheets.
 * Despliegue: Implementar > Nueva implementación > Aplicación web
 *   Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 */
const SHEET_ID = '1wCANuHk3XOe82WimgyrtTbhEKKKeaomsKRY_aTmf4h0';
const HOJA = 'Planes';
const CLAVE = 'TU_CLAVE'; // la real está solo en el proyecto de Apps Script
const COLS = ['id', 'titulo', 'descripcion', 'links', 'fecha', 'presupuesto', 'total', 'actualizado', 'participantes'];

function doGet(e) {
  return responder(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return responder(body);
}

function responder(p) {
  try {
    if (String(p.clave || '') !== CLAVE) return salida({ ok: false, error: 'clave' });
    const hoja = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA);
    const accion = p.action || 'list';
    if (accion === 'list') return salida({ ok: true, planes: leer(hoja) });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (accion === 'save') return salida({ ok: true, plan: guardar(hoja, p.plan || {}) });
      if (accion === 'delete') { borrar(hoja, String(p.id || '')); return salida({ ok: true }); }
    } finally {
      lock.releaseLock();
    }
    return salida({ ok: false, error: 'accion desconocida' });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- lectura ---------- */
function leer(hoja) {
  const n = hoja.getLastRow();
  if (n < 2) return [];
  const filas = hoja.getRange(2, 1, n - 1, COLS.length).getDisplayValues();
  return filas.filter(f => f[0]).map(filaAPlan);
}

function filaAPlan(f) {
  return {
    id: f[0],
    titulo: f[1],
    descripcion: f[2],
    links: f[3] ? f[3].split('\n').map(s => s.trim()).filter(Boolean) : [],
    fecha: f[4],
    presupuesto: textoAPresupuesto(f[5]),
    actualizado: f[7],
    participantes: f[8] ? f[8].split('\n').map(s => s.trim()).filter(Boolean) : []
  };
}

// "Gasolina: 30\nActividad: 25.5"  <->  [{concepto, importe}]
function textoAPresupuesto(t) {
  if (!t) return [];
  return t.split('\n').map(l => {
    const i = l.lastIndexOf(':');
    if (i < 0) return { concepto: l.trim(), importe: null };
    const v = l.slice(i + 1).trim().replace(',', '.');
    return { concepto: l.slice(0, i).trim(), importe: v === '' ? null : Number(v) };
  }).filter(x => x.concepto);
}

function presupuestoATexto(arr) {
  return (arr || [])
    .filter(x => x && String(x.concepto || '').trim())
    .map(x => String(x.concepto).replace(/\n/g, ' ').trim() + ': ' +
      (x.importe === null || x.importe === '' || isNaN(Number(x.importe)) ? '' : Number(x.importe)))
    .join('\n');
}

/* ---------- escritura ---------- */
function guardar(hoja, plan) {
  const id = plan.id ? String(plan.id) : Utilities.getUuid().slice(0, 8) + Date.now().toString(36);
  const presupuesto = (plan.presupuesto || []).filter(x => x && String(x.concepto || '').trim());
  const total = presupuesto.reduce((s, x) => s + (Number(x.importe) || 0), 0);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(plan.fecha || '') ? plan.fecha : '';
  const ahora = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm');
  const fila = [
    id,
    String(plan.titulo || '').trim(),
    String(plan.descripcion || '').trim(),
    (plan.links || []).map(s => String(s).trim()).filter(Boolean).join('\n'),
    fecha,
    presupuestoATexto(presupuesto),
    presupuesto.length ? total : '',
    ahora,
    (plan.participantes || []).map(s => String(s).replace(/\n/g, ' ').trim()).filter(Boolean).join('\n')
  ];

  const r = buscarFila(hoja, id);
  const destino = r ? r : hoja.getLastRow() + 1;
  const rango = hoja.getRange(destino, 1, 1, COLS.length);
  rango.setNumberFormat('@');
  hoja.getRange(destino, 7).setNumberFormat('#,##0.00 "€"');
  rango.setValues([fila]);
  return filaAPlan(hoja.getRange(destino, 1, 1, COLS.length).getDisplayValues()[0]);
}

function borrar(hoja, id) {
  const r = buscarFila(hoja, id);
  if (r) hoja.deleteRow(r);
}

function buscarFila(hoja, id) {
  const n = hoja.getLastRow();
  if (n < 2 || !id) return 0;
  const ids = hoja.getRange(2, 1, n - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return 0;
}

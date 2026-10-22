// نتائج فانوس: يحفظ نتيجة كل طالب في هذا الجدول، ويعيد نتائج المسابقة للترتيب ولوحة المعلم.
const SHEET_NAME = 'النتائج';
const LEVELS = ['تذكر', 'فهم', 'تطبيق', 'تحليل', 'تقييم', 'إبداع'];
const HEAD = ['الوقت', 'رقم المسابقة', 'الاسم', 'الصحة', 'السرعة', 'المجموع'].concat(LEVELS.map(function (l) { return l + ' %'; }), ['تفاصيل']);

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}

function num_(v, max) { v = Math.round(Number(v) || 0); return Math.max(0, Math.min(max, v)); }

function add_(p) {
  const gid = String(p.gid || '').replace(/\D/g, '');
  if (gid.length !== 4) throw new Error('gid');
  let name = String(p.name || '').replace(/\s+/g, ' ').trim().slice(0, 22);
  if (!name) throw new Error('name');
  if (/^[=+\-@]/.test(name)) name = ' ' + name;
  const c = num_(p.c, 999), sp = num_(p.sp, 999);
  let bl = {};
  try { bl = JSON.parse(p.bl || '{}') || {}; } catch (e) {}
  const clean = {}, pct = [];
  for (let i = 1; i <= 6; i++) {
    const r = bl[i];
    if (Array.isArray(r) && Number(r[1]) > 0) {
      const mx = num_(r[1], 999), got = Math.min(num_(r[0], 999), mx);
      clean[i] = [got, mx];
      pct.push(Math.round(100 * got / mx));
    } else pct.push('');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([new Date(), gid, name, c, sp, c + sp].concat(pct, [JSON.stringify(clean)]));
  } finally { lock.releaseLock(); }
}

function list_(gid) {
  const v = sheet_().getDataRange().getValues().slice(1);
  return v.filter(function (r) { return r[2] !== '' && String(r[1]).indexOf(gid) === 0; }).map(function (r) {
    let bl = {};
    try { bl = JSON.parse(r[12] || '{}'); } catch (e) {}
    return { g: String(r[1]), n: String(r[2]).trim(), c: Number(r[3]) || 0, sp: Number(r[4]) || 0, bl: bl, ts: r[0] instanceof Date ? r[0].getTime() : 0 };
  });
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.a === 'add') add_(p);
    out = { ok: true, rows: list_(String(p.gid || '').replace(/\D/g, '')) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  const json = JSON.stringify(out), cb = String(p.cb || '');
  if (/^[A-Za-z_$][\w$]{0,40}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

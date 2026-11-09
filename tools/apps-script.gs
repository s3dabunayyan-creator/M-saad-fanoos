// نتائج فانوس: يحفظ نتيجة كل طالب في هذا الجدول، ويعيد نتائج المسابقة للترتيب ولوحة المعلم.
// ورقة «الطلاب»: اكتب اسم الطالب في العمود B فيظهر رقمه الخاص في العمود A تلقائيًا.
const SHEET_NAME = 'النتائج';
const ROSTER = 'الطلاب';
const VERSION = 3; // لوحة المعلم تنبّه إذا كان الكود المنشور أقدم من هذا
const LEVELS = ['تذكر', 'فهم', 'تطبيق', 'تحليل', 'تقييم', 'إبداع'];
const HEAD = ['الوقت', 'رقم المسابقة', 'الاسم', 'الصحة', 'السرعة', 'المجموع'].concat(LEVELS.map(function (l) { return l + ' %'; }), ['تفاصيل', 'رقم الطالب', 'رمز المحاولة']);
const ID_COL = 13; // 0-based column of «رقم الطالب» in النتائج
const U_COL = 14;  // 0-based column of «رمز المحاولة»: the same result sent twice is saved once

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

function roster_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ROSTER);
  if (!sh) {
    sh = ss.insertSheet(ROSTER);
    sh.appendRow(['رقم الطالب', 'اسم الطالب', 'الصف']);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}

function digits_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
function clean_(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

// gives every named student without a number a random, unused 4-digit number
function fillIds_(sh) {
  const v = sh.getDataRange().getValues();
  const used = {};
  v.forEach(function (r) { const d = digits_(r[0]); if (d) used[d] = 1; });
  let changed = false;
  const col = v.slice(1).map(function (r) {
    if (clean_(r[1]) && !digits_(r[0])) {
      let id;
      do { id = String(1000 + Math.floor(Math.random() * 9000)); } while (used[id]);
      used[id] = 1; changed = true;
      return [id];
    }
    return [r[0]];
  });
  if (changed && col.length) sh.getRange(2, 1, col.length, 1).setValues(col);
}

function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === ROSTER) fillIds_(e.range.getSheet());
}

function onOpen() {
  fillIds_(roster_());
  SpreadsheetApp.getUi().createMenu('فانوس').addItem('أعطِ كل طالب رقمًا', 'giveIds').addToUi();
}

function giveIds() { fillIds_(roster_()); }

// id -> name, and name -> id (only when the name is unique), from the الطلاب sheet
function students_() {
  const byId = {}, byName = {};
  roster_().getDataRange().getValues().slice(1).forEach(function (r) {
    const id = digits_(r[0]), n = clean_(r[1]);
    if (!id || !n) return;
    if (!byId[id]) byId[id] = n;
    byName[n] = byName[n] === undefined ? id : null;
  });
  return { byId: byId, byName: byName };
}

// a stable key for a student that does not reveal their number
function key_(id) {
  const pr = PropertiesService.getScriptProperties();
  let salt = pr.getProperty('salt');
  if (!salt) { salt = Utilities.getUuid(); pr.setProperty('salt', salt); }
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + id);
  return 's' + b.slice(0, 6).map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}

function who_(p) {
  const id = digits_(p.id);
  const n = id && students_().byId[id];
  return n ? { k: key_(id), n: n } : null;
}

function num_(v, max) { v = Math.round(Number(v) || 0); return Math.max(0, Math.min(max, v)); }

function add_(p) {
  const gid = String(p.gid || '').replace(/\D/g, '');
  if (gid.length !== 4) throw new Error('gid');
  const id = digits_(p.id).slice(0, 12);
  let name = (id && students_().byId[id]) || clean_(p.name).slice(0, 22);
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
  const u = String(p.u || '').replace(/[^\w-]/g, '').slice(0, 40);
  // when the game was played (a result kept on the student's device can arrive later)
  const now = Date.now(), t = Number(p.t);
  const when = new Date(t > now - 45 * 864e5 && t < now + 36e5 ? t : now);
  const cache = CacheService.getScriptCache();
  if (u && cache.get('u' + u)) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(28000)) throw new Error('busy');
  try {
    const sh = sheet_();
    if (u && seen_(sh, u)) return;
    if (sh.getRange(1, ID_COL + 1).getValue() === '') sh.getRange(1, ID_COL + 1).setValue(HEAD[ID_COL]);
    if (sh.getRange(1, U_COL + 1).getValue() === '') sh.getRange(1, U_COL + 1).setValue(HEAD[U_COL]);
    sh.appendRow([when, gid, name, c, sp, c + sp].concat(pct, [JSON.stringify(clean), id, u]));
    if (u) cache.put('u' + u, '1', 21600);
  } finally { lock.releaseLock(); }
}

// was this attempt already saved? (looks at the latest rows only)
function seen_(sh, u) {
  const last = sh.getLastRow();
  if (last < 2) return false;
  const n = Math.min(400, last - 1);
  return sh.getRange(last - n + 1, U_COL + 1, n, 1).getValues().some(function (r) { return String(r[0]) === u; });
}

function list_(gid) {
  const v = sheet_().getDataRange().getValues().slice(1);
  const st = students_(), keys = {};
  const keyOf = function (id) { return keys[id] || (keys[id] = key_(id)); };
  return v.filter(function (r) { return r[2] !== '' && String(r[1]).indexOf(gid) === 0; }).map(function (r) {
    let bl = {};
    try { bl = JSON.parse(r[12] || '{}'); } catch (e) {}
    const n = clean_(r[2]);
    // results saved before student numbers existed join the student with the same name
    const id = digits_(r[ID_COL]) || st.byName[n] || '';
    const o = { g: String(r[1]), n: (id && st.byId[id]) || n, c: Number(r[3]) || 0, sp: Number(r[4]) || 0, bl: bl, ts: r[0] instanceof Date ? r[0].getTime() : 0 };
    if (id) o.k = keyOf(id);
    return o;
  });
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.a === 'who') out = { ok: true, st: who_(p) };
    else {
      if (p.a === 'add') add_(p);
      out = { ok: true, rows: list_(String(p.gid || '').replace(/\D/g, '')) };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  out.v = VERSION;
  const json = JSON.stringify(out), cb = String(p.cb || '');
  if (/^[A-Za-z_$][\w$]{0,40}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

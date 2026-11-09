// Runs apps-script.gs against a fake spreadsheet to check roster ids, add/list/who and JSONP.
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
function fakeSheet(name){const rows=[];return {rows,getName:()=>name,appendRow:r=>rows.push(r.slice()),setFrozenRows(){},setRightToLeft(){},
  getLastRow:()=>rows.length,getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),
  getRange:(r,c,nr,nc)=>({getValues:()=>rows.slice(r-1,r-1+nr).map(x=>[x[c-1]??'']),getValue:()=>(rows[r-1]||[])[c-1]??'',setValue:v=>{(rows[r-1]||(rows[r-1]=[]))[c-1]=v;},
    setValues:vs=>vs.forEach((x,i)=>{(rows[r-1+i]||(rows[r-1+i]=[]))[c-1]=x[0];}),getSheet:()=>sheets[name]})};}
const sheets={};const props={};const cache={};
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>sheets[n]=fakeSheet(n)}),
    getUi:()=>({createMenu:()=>({addItem(){return this;},addToUi(){}})})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
  Utilities:{getUuid:()=>'uuid-1',DigestAlgorithm:{SHA_256:1},computeDigest:(a,s)=>[...crypto.createHash('sha256').update(s).digest()].map(b=>b>127?b-256:b)},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  CacheService:{getScriptCache:()=>({get:k=>cache[k]||null,put:(k,v)=>cache[k]=v})},
  ContentService:{MimeType:{JAVASCRIPT:'js',JSON:'json'},createTextOutput:t=>({setMimeType:()=>t})},JSON,Math,Number,String,Array,Date,Error,Object};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/apps-script.gs','utf8'),ctx);
const g=p=>JSON.parse(ctx.doGet({parameter:p}));

// old-style result (before ids) from a student who is later added to the roster
ctx.add_({gid:'5105',name:'سارة  أحمد',c:'50',sp:'10',bl:'{"1":[5,10]}'});
// teacher opens the sheet, types names; ids appear
ctx.onOpen();
const ro=sheets['الطلاب'];
ro.appendRow(['','سارة أحمد','خامس']);ro.appendRow(['','علي محمد','ثالث']);ro.appendRow(['777','نورة','خامس']);ro.appendRow(['','','']);
ctx.onEdit({range:ro.getRange(2,2)});
const ids=ro.rows.slice(1).map(r=>String(r[0]));
console.log('ids',ids);
assert(/^\d{4}$/.test(ids[0])&&/^\d{4}$/.test(ids[1])&&ids[0]!==ids[1]&&ids[2]==='777'&&ids[3]==='');
// who
assert.strictEqual(g({a:'who',id:'12'}).st,null);
const sara=g({a:'who',id:ids[0]}).st;assert.strictEqual(sara.n,'سارة أحمد');assert(/^s[0-9a-f]{12}$/.test(sara.k));
// add with id stores roster name + id; list joins old name-only row to the same key
g({a:'add',gid:'5106',id:ids[0],name:'ignored',c:'80',sp:'20',bl:'{"2":[3,4]}'});
g({a:'add',gid:'3101',id:'777',c:'1',sp:'1'});
const all=g({gid:''}).rows;console.log(all);
assert(all.length===3&&all[0].k===sara.k&&all[1].k===sara.k&&all[1].n==='سارة أحمد');
assert.strictEqual(sheets['النتائج'].rows[0][13],'رقم الطالب');assert.strictEqual(sheets['النتائج'].rows[2][13],ids[0]);
// the same attempt sent twice (retry, or kept on the device and resent) is saved once, even without the cache
const before=sheets['النتائج'].rows.length;
g({a:'add',gid:'5101',id:'777',c:'5',sp:'1',u:'abc-1',t:String(Date.now()-864e5)});
for(const k in cache)delete cache[k];
const r2=g({a:'add',gid:'5101',id:'777',c:'5',sp:'1',u:'abc-1'});
assert.strictEqual(sheets['النتائج'].rows.length,before+1);assert.strictEqual(r2.v,3);
const saved=sheets['النتائج'].rows[before];assert.strictEqual(saved[14],'abc-1');assert(Date.now()-saved[0].getTime()>8e7);
assert.strictEqual(sheets['النتائج'].rows[0][14],'رمز المحاولة');
// errors and JSONP guard still behave
assert.strictEqual(g({a:'add',gid:'12',name:'x'}).ok,false);
console.log(ctx.doGet({parameter:{cb:'alert(1)//'}}).slice(0,30));
console.log(ctx.doGet({parameter:{a:'who',id:'777',cb:'cb1'}}));
console.log('ok');

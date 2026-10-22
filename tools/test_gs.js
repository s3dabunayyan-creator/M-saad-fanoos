// Runs apps-script.gs against a fake spreadsheet to check add/list/JSONP.
const fs=require('fs'),vm=require('vm');
const rows=[];let header=false;
const sh={appendRow:r=>rows.push(r),setFrozenRows(){},setRightToLeft(){},getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())})};
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>header?sh:null,insertSheet:()=>{header=true;return sh;}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{MimeType:{JAVASCRIPT:'js',JSON:'json'},createTextOutput:t=>({setMimeType:()=>t})},JSON,Math,Number,String,Array,Date,Error};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/apps-script.gs','utf8'),ctx);
const g=p=>ctx.doGet({parameter:p});
console.log(g({a:'add',gid:'5105',name:' =سارة  ',c:'120',sp:'40',bl:'{"1":[50,60],"2":[30,40],"9":[1,1]}',cb:'cb1'}));
console.log(g({a:'add',gid:'3104',name:'علي',c:'5',sp:'1',bl:'oops'}));
console.log(g({gid:'51',cb:'x'}));
console.log(g({a:'add',gid:'12',name:'x'}));
console.log(g({cb:'alert(1)//'}).slice(0,40));
console.log(rows[1]);


/* ---------- class ranking: solo results go to the teacher's Google Sheet (FANOOS_API, set in fanoos-config.js) ---------- */
function addBl(p,l,got,max){if(!l)return;p.bl=p.bl||{};const r=p.bl[l]||(p.bl[l]=[0,0]);r[0]+=got;r[1]+=max;}
function API(){return typeof window.FANOOS_API==='string'?window.FANOOS_API.trim():'';}
function api(params){return new Promise((res,rej)=>{const u=API();if(!u)return rej(new Error('off'));
  const cb='fz'+Date.now()+Math.floor(Math.random()*1e4),s=document.createElement('script');
  const done=()=>{clearTimeout(t);delete window[cb];s.remove();};const t=setTimeout(()=>{done();rej(new Error('timeout'));},20000);
  window[cb]=d=>{done();d&&d.ok?res(d):rej(new Error('api'));};s.onerror=()=>{done();rej(new Error('net'));};
  s.src=u+(u.includes('?')?'&':'?')+new URLSearchParams({...params,cb});document.head.appendChild(s);});}
function normName(n){return String(n).replace(/\s+/g,' ').trim();}
// best attempt per student (by number when they have one, else by name), then competition ranking (ties share a place)
function rowKey(r){return r.k||'n:'+normName(r.n);}
function rankRows(rows){const best={};
  rows.forEach(r=>{const n=normName(r.n),t=(+r.c||0)+(+r.sp||0);if(!n)return;const key=rowKey(r),o=best[key];if(!o||t>o.t||(t===o.t&&+r.c>o.c))best[key]={n,key,t,c:+r.c||0};});
  const out=Object.values(best).sort((a,b)=>b.t-a.t||b.c-a.c);out.forEach((r,i)=>r.k=i&&r.t===out[i-1].t?out[i-1].k:i+1);return out;}
function MEDAL(k){return k===1?'🥇':k===2?'🥈':k===3?'🥉':'🏅';}
function boardHTML(list,me){const m=me?list.find(r=>r.key===me):null;
  return (m?'<div class="myrank"><span class="md">'+MEDAL(m.k)+'</span><span class="rn">'+m.k+'</span><span class="of">من '+list.length+'</span></div>':'')+
   '<ol class="lb">'+list.map(r=>'<li'+(m&&r===m?' class="me"':'')+'><span class="k">'+(r.k<4?MEDAL(r.k):r.k)+'</span><span class="n">'+esc(r.n)+'</span><span class="s">'+r.t+'</span></li>').join('')+'</ol>'+
   '<button class="tbtn" id="rkR" type="button">↻ تحديث</button>';}
async function showBoard(box,gid,me,add){
  if(!box||!API())return;box.innerHTML='<h3>ترتيب الصف</h3><p class="small">…</p>';
  try{const d=await api(add?{a:'add',gid,...add}:{a:'list',gid});if(add&&S.self)S.self.sent=true,save();
    if(!box.isConnected)return;box.innerHTML='<h3>ترتيب الصف</h3>'+boardHTML(rankRows(d.rows||[]),me);
    const m=me&&rankRows(d.rows||[]).find(r=>r.key===me);if(m&&m.k<=3)burst(120);}
  catch(e){if(box.isConnected)box.innerHTML='<h3>ترتيب الصف</h3><p class="small">تعذر الاتصال</p><button class="tbtn" id="rkR" type="button">↻ حاول مرة أخرى</button>';}
  const r=$('#rkR');if(r)r.onclick=()=>showBoard(box,gid,me,S.self&&!S.self.sent?add:null);}
function fanoosRank(p){const box=$('#rankBox');if(!box||!API())return;box.className='rank';
  showBoard(box,S.self.gid,S.self.k||'n:'+normName(p.n),S.self.sent?null:{name:normName(p.n),id:S.self.id||'',c:p.c,sp:p.sp,bl:JSON.stringify(p.bl||{})});}
function boardScreen(gid){clearInterval(tId);$('#bar').hidden=true;panel.innerHTML='';
  app.innerHTML='<section class="screen story"><div id="rankBox" class="rank"></div><button class="big alt" id="rkBack" type="button">رجوع</button></section>';
  $('#rkBack').onclick=()=>studentJoin(gid);showBoard($('#rankBox'),gid,myId().k||'',null);}
/* student number: remembered on this device, checked against the teacher's الطلاب sheet */
function myId(){try{const o=JSON.parse(localStorage.getItem('fanoosMe')||'{}');return o&&typeof o==='object'?o:{};}catch(e){return {};}}
function setMyId(o){try{localStorage.setItem('fanoosMe',JSON.stringify(o));}catch(e){}}
function idField(){const me=myId();
  return '<label class="small" for="ji">رقمك</label><input id="ji" inputmode="numeric" maxlength="12" autocomplete="off" value="'+esc(me.id||'')+'">'+
   '<p class="hi" id="jhi">'+(me.id&&me.n?'👋 '+esc(me.n):'')+'</p>';}
function idWire(){const i=$('#ji');if(i)i.oninput=()=>{const me=myId();$('#jhi').textContent=me.id&&me.n&&i.value.replace(/\D/g,'')===me.id?'👋 '+me.n:'';};}
async function whoAmI(msg,btn){const id=$('#ji').value.replace(/\D/g,''),me=myId();
  if(id.length<3){msg.textContent='اكتب رقمك';$('#ji').focus();return null;}
  btn.disabled=true;msg.textContent='…';
  try{const d=await api({a:'who',id});
    if(!('st' in d)){msg.textContent='';return {old:true};} // results sheet not updated for student numbers yet
    if(!d.st){msg.textContent='هذا الرقم غير مسجّل، اسأل معلمك';return null;}
    setMyId({id,n:d.st.n,k:d.st.k});msg.textContent='';return {id,n:d.st.n,k:d.st.k};}
  catch(e){if(me.id===id&&me.n){msg.textContent='';return me;}msg.textContent='تعذر الاتصال، حاول مرة أخرى';return null;}
  finally{btn.disabled=false;}}

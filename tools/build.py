"""Add class ranking + Bloom tracking to the Fanoos teacher games, then regenerate every copy.

Usage: python3 tools/build.py   (run from the repo root)
Teacher sources: /mnt/project-files/lessons/<src>.html (patched in place, idempotent).
Outputs: lessons/student/<src>-student.html, lessons/فانوس-مرتبة/*, repo <slug>.html
"""
import re, os, sys, shutil, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from bloom_map import level

LES = '/mnt/project-files/lessons'
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://s3dabunayyan-creator.github.io/M-saad-fanoos/'
GAMES = [  # src, repo slug, sorted name
 ('fanoos', 'khamis1', 'خامس ١ - الأصول الثلاثة'),
 ('fanoos2', 'khamis2', 'خامس ٢ - العبادة (مراجعة الوحدة)'),
 ('fanoos3', 'khamis3', 'خامس ٣ - معرفة الدين'),
 ('fanoos4', 'khamis4', 'خامس ٤ - الخوف والرجاء والتوكل'),
 ('fanoos5', 'khamis5', 'خامس ٥ - الخشوع والإنابة والذبح لله'),
 ('fanoos6', 'khamis6', 'خامس ٦ - هديه ﷺ في الطهارة والصلاة'),
 ('fanoos7', 'khamis7', 'خامس ٧ - معاني كلمات سورة المطففين'),
 ('fanoosT1', 'thalith1', 'ثالث ١ - الإيمان'),
 ('fanoosT2', 'thalith2', 'ثالث ٢ - أركان الإسلام'),
 ('fanoosT3', 'thalith3', 'ثالث ٣ - الإحسان'),
 ('fanoosT4', 'thalith4', 'ثالث ٤ - آداب قضاء الحاجة وإزالة النجاسة'),
 ('fanoosT5', 'thalith5', 'ثالث ٥ - معاني كلمات سورة الشمس'),
]
TOOLS = os.path.dirname(os.path.abspath(__file__))
CSS = open(os.path.join(TOOLS, 'rank.css')).read()
JS = open(os.path.join(TOOLS, 'rank.js')).read()
CONFIG_TAG = '<script src="' + BASE + 'fanoos-config.js"></script>\n'
MARK = '/* class ranking (solo play) */'

def sub1(pat, rep, s, literal=True):
    n = s.count(pat) if literal else len(re.findall(pat, s))
    assert n == 1, (pat[:60], n)
    return s.replace(pat, rep) if literal else re.sub(pat, rep, s)

def patch_teacher(s):
    if MARK in s:
        return s
    # 1) tag every challenge with its Bloom level
    def tag(m):
        return "{bl:%d,t:'%s',p:'%s'" % (level(m.group(1), m.group(2)), m.group(1), m.group(2))
    s, n = re.subn(r"\{t:'(\w+)',p:'([^']*)'", tag, s)
    assert n >= 10, n
    # 2) count correctness per Bloom level (screen challenges: 10 each, speed round: 5 each, all recall)
    s = sub1('const p=cur();p.c+=correct;p.sp+=speed;renderBar();',
             'const p=cur();p.c+=correct;p.sp+=speed;addBl(p,c.bl,correct,10);renderBar();', s)
    s = sub1("if(k>=0)opts[k].classList.add('wrong');sfx.bad();}",
             "if(k>=0)opts[k].classList.add('wrong');sfx.bad();}addBl(p,1,c,5);", s)
    # solo play has no behavior marks, so the bar shows the same points as the class ranking
    s = sub1("mode:'solo',players:[newP(n,0)]", "mode:'solo',players:[{...newP(n,0),b:0}]", s)
    # 3) solo certificate -> class ranking under it
    i = s.index('if(S.self){const p=S.players[0];')
    j = s.index("</div></section>';\n    return;}", i)
    s = s[:j] + "</div><div id=\"rankBox\"></div></section>';\n    fanoosRank(p);return;}" + s[j + len("</div></section>';\n    return;}"):]
    # 4) trophy button on the join screen
    s = sub1('<button class="big" id="jgo" type="button">ابدأ</button>',
             '<button class="big" id="jgo" type="button">ابدأ</button><button class="tbtn" id="jlb" type="button"\'+(API()?\'\':\' hidden\')+\'>🏆 الترتيب</button>', s)
    s = sub1("(gid?$('#jn'):$('#jg')).focus();",
             "(gid?$('#jn'):$('#jg')).focus();\n  $('#jlb').onclick=()=>{const g=$('#jg').value.trim();if(/^\\d{4}$/.test(g))boardScreen(g);else $('#jmsg').textContent='اكتب رقم المسابقة المكوّن من ٤ أرقام';};", s)
    # 5) code, style, config
    s = sub1('\n})();\n</script>', JS + '})();\n</script>', s)
    s = sub1('</style>', CSS + '</style>', s) if s.count('</style>') == 1 else s.replace('</style>', CSS + '</style>', 1)
    k = s.rindex('<script>')
    s = s[:k] + CONFIG_TAG + s[k:]
    return s

BRAND = '/* school brand join screen */'
BRAND_CSS = BRAND + """
.brand{gap:16px;padding-block:6px 20px}
.crest{width:100%;max-width:560px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:var(--deep);border:2px solid var(--gold);border-radius:26px;padding:14px 20px;box-shadow:0 8px 0 #00292C}
.crest .logo{width:min(170px,42vw)}
.crest .tag{display:flex;flex-direction:column;align-items:center;gap:2px}
.crest .tag .lantern{width:54px;height:54px}
.crest .tag b{font-family:var(--f-display);font-weight:400;font-size:1.25rem;color:var(--gold);line-height:1.2}
.brand h1{font-size:clamp(2.2rem,8vw,3.6rem)}
.brand .lesson{font-family:var(--f-display);font-size:clamp(1.3rem,5vw,1.8rem);line-height:1.35;color:var(--ink);margin-top:-8px}
.brand .join{background:var(--panel);border:1px solid var(--line);border-radius:24px;padding:18px}
.brand .credit{border-top:2px solid var(--gold);padding-top:8px}
"""

def brand(s):
    """Join screen in the school's identity: logo band, lesson title, framed form, teacher credit."""
    if BRAND in s:
        return s
    t = re.search(r'<h1>(فانوس [^<]*)</h1><p class="big-q" style="font-size:1.8rem">([^<]*)</p>', s)
    head = ("app.innerHTML='<section class=\"screen hero brand\"><header class=\"crest\">'+LOGO+"
            "'<div class=\"tag\">'+LANTERN+'<b>مسابقة فانوس</b></div></header><h1>%s</h1><p class=\"lesson\">%s</p><div class=\"join\">'"
            % (t.group(1), t.group(2)))
    s = sub1("app.innerHTML='<section class=\"screen hero\">'+LOGO.replace('class=\"logo\"','class=\"logo sm\"')+LANTERN+'<h1>%s</h1><div class=\"join\">'" % t.group(1), head, s)
    i = s.index(head)
    j = s.index("</section>';", i)
    s = s[:j] + "<p class=\"small credit\">من إعداد الأستاذ سعد أبونيان</p>" + s[j:]
    k = s.index('</style>')
    return s[:k] + BRAND_CSS + s[k:]

JS_START = '/* ---------- class ranking:'
ID_MARK = "S.self.k=sid.k"

def sync_rank(s):
    """Keep the ranking code and style embedded in a game in step with tools/rank.js and rank.css."""
    i = s.index(JS_START)
    j = s.index('})();\n</script>', i)
    s = s[:i] + JS[JS.index(JS_START):] + s[j:]
    i = s.index(MARK)
    j = s.index(BRAND, i)
    return s[:i] + CSS + s[j:]

def student_ids(s):
    """Join screen asks for the student's number (remembered on the device) instead of a free-text name."""
    if ID_MARK in s:
        return s
    s = sub1(''''<label class="small" for="jn">اسمك</label><input id="jn" maxlength="22" autocomplete="off">'+''',
             '''(API()?idField():'')+'<div class="join" id="jnw" style="padding:0;border:0;background:none"'+(API()?' hidden':'')+'><label class="small" for="jn">اسمك</label><input id="jn" maxlength="22" autocomplete="off"></div>'+''', s)
    s = sub1("(gid?$('#jn'):$('#jg')).focus();",
             "(gid?$(API()?'#ji':'#jn'):$('#jg')).focus();idWire();", s)
    s = sub1("const g=$('#jg').value.trim(),n=$('#jn').value.trim();const msg=$('#jmsg');",
             "const g=$('#jg').value.trim(),msg=$('#jmsg');let n=$('#jn').value.trim(),sid=null;", s)
    s = sub1("if(!n){msg.textContent='اكتب اسمك';return;}\n    startSelf(g,n);",
             "if(API()&&$('#jnw').hidden){sid=await whoAmI(msg,$('#jgo'));if(!sid)return;\n      if(sid.old){sid=null;$('#jnw').hidden=false;$('#jn').focus();msg.textContent='اكتب اسمك';return;}n=sid.n;}\n"
             "    if(!n){msg.textContent='اكتب اسمك';return;}\n    startSelf(g,n);if(sid){S.self.id=sid.id;S.self.k=sid.k;save();}", s)
    return s

QR = '/* QR for every game */'
QR_CSS = QR + """
.qrov{position:fixed;inset:0;z-index:999;background:rgba(0,30,32,.92);display:grid;place-items:center;padding:16px}
.qrbox{background:#fff;color:#003C40;border-radius:24px;padding:20px;display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:520px;text-align:center}
.qrbox b{font-size:1.4rem}
.qrbig{width:min(78vw,58vh,420px);aspect-ratio:1}
.qrbig svg{width:100%;height:100%;display:block}
.qrbox .qrg{font-size:1.6rem;font-weight:700}
.qrbox .qrl{direction:ltr;word-break:break-all;color:#003C40}
"""
QR_JS = QR + """
function qrScreen(g){g=/^\\d{4}$/.test(g||'')?g:'';const link=PAGE_URL+(g?'#'+g:'');
  const d=document.createElement('div');d.className='qrov';d.setAttribute('role','dialog');d.setAttribute('aria-label','رمز QR للمسابقة');
  d.innerHTML='<div class="qrbox"><b>'+esc(document.title.replace(/^الطالب · /,''))+'</b><div class="qrbig"></div>'+(g?'<span class="qrg">رقم المسابقة '+esc(g)+'</span>':'')+'<p class="small qrl">'+esc(link)+'</p><button class="big" type="button">إغلاق</button></div>';
  document.body.appendChild(d);
  try{const q=qrcode(0,'M');q.addData(link);q.make();d.querySelector('.qrbig').innerHTML=q.createSvgTag({cellSize:8,margin:2,scalable:true});}catch(e){d.querySelector('.qrbig').textContent='افتح الرابط';}
  d.onclick=e=>{if(e.target===d||e.target.tagName==='BUTTON')d.remove();};}
"""

def add_qr(s):
    """A QR button on every game's join screen (big code to show the class); ?qr opens it straight away."""
    if QR in s:
        return s
    s = sub1('🏆 الترتيب</button><p class="small" id="jmsg">',
             '🏆 الترتيب</button><button class="tbtn" id="jqr" type="button">📱 رمز QR</button><p class="small" id="jmsg">', s)
    s = sub1("  $('#jlb').onclick=",
             "  $('#jqr').onclick=()=>qrScreen($('#jg').value.trim());\n"
             "  if(/[?&]qr\\b/.test(location.search)&&!window.__qrOnce){window.__qrOnce=1;setTimeout(()=>qrScreen(gid),0);}\n"
             "  $('#jlb').onclick=", s)
    s = sub1('function drawQR(){', QR_JS + 'function drawQR(){', s)
    k = s.index('</style>')
    return s[:k] + QR_CSS + s[k:]

def public_url(s, url):
    """Teacher copies share the public GitHub Pages link too (students can't open Claude artifact links)."""
    s, n = re.subn(r"const PAGE_URL='[^']*';", "const PAGE_URL='%s';" % url, s)
    assert n == 1
    return s

def student(s, page_url=None):
    s = re.sub(r'<title>(فانوس [^<]*)</title>', r'<title>الطالب · \1</title>', s, count=1)
    s = sub1('function setup(){\n', 'function setup(){return studentJoin(GID);\n', s)
    s = re.sub(r'<button class="tbtn" id="jback" type="button">شاشة المعلم</button>\n?', '', s)
    s = re.sub(r"  \$\('#jback'\)\.onclick=.*\n", '', s)
    s = sub1("const boot=d=>{if(/^\\d{4}$/.test(hashGid))return studentJoin(hashGid);",
             "const boot=d=>{return studentJoin(/^\\d{4}$/.test(hashGid)?hashGid:GID);", s)
    if page_url:
        s, n = re.subn(r"const PAGE_URL='[^']*';", "const PAGE_URL='%s';" % page_url, s)
        assert n == 1
    return s

def main():
    os.makedirs(LES + '/student', exist_ok=True)
    srt = LES + '/فانوس-مرتبة'
    for src, slug, name in GAMES:
        tp = '%s/%s.html' % (LES, src)
        t = public_url(add_qr(student_ids(sync_rank(brand(patch_teacher(open(tp, encoding='utf-8').read()))))), BASE + slug + '.html')
        open(tp, 'w', encoding='utf-8').write(t)
        st = student(t)
        open('%s/student/%s-student.html' % (LES, src), 'w', encoding='utf-8').write(st)
        open('%s/%s - للمعلم.html' % (srt, name), 'w', encoding='utf-8').write(t)
        open('%s/%s - للطالب.html' % (srt, name), 'w', encoding='utf-8').write(st)
        open('%s/%s.html' % (REPO, slug), 'w', encoding='utf-8').write(student(t, BASE + slug + '.html'))
        print('ok', src)
    # zips that already exist get refreshed
    for z in [srt + '/' + f for f in os.listdir(srt) if f.endswith('.zip')]:
        h = z[:-4] + '.html'
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(h, os.path.basename(h))
    for gid, src in (('3104', 'fanoosT4'), ('5105', 'fanoos5'), ('5106', 'fanoos6'), ('3105', 'fanoosT5'), ('5107', 'fanoos7')):
        h = '%s/send/fanoos%s.html' % (LES, gid)
        shutil.copyfile('%s/student/%s-student.html' % (LES, src), h)
        with zipfile.ZipFile(h[:-5] + '.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(h, os.path.basename(h))
    with zipfile.ZipFile(LES + '/fanoos-student-all.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for src, _, _ in GAMES:
            zf.write('%s/student/%s-student.html' % (LES, src), '%s-student.html' % src)
    with zipfile.ZipFile(LES + '/فانوس-مرتبة.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(srt)):
            if f.endswith('.html'):
                zf.write(srt + '/' + f, f)

if __name__ == '__main__':
    main()

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
 ('fanoosT1', 'thalith1', 'ثالث ١ - الإيمان'),
 ('fanoosT2', 'thalith2', 'ثالث ٢ - أركان الإسلام'),
 ('fanoosT3', 'thalith3', 'ثالث ٣ - الإحسان'),
 ('fanoosT4', 'thalith4', 'ثالث ٤ - آداب قضاء الحاجة وإزالة النجاسة'),
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
        t = patch_teacher(open(tp, encoding='utf-8').read())
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
    for gid, src in (('3104', 'fanoosT4'), ('5105', 'fanoos5')):
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

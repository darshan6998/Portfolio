"""Build ../st-practice.html from the sources in this folder.

Run from anywhere:  python3 st-practice-src/build.py
"""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
rd = lambda f: open(os.path.join(HERE, f), encoding='utf-8').read()
s = rd('index.src.html')
parts = {'/*ENGINE*/': 'engine.js', '/*PROBLEMS*/': 'problems.js', '/*PROBLEMS2*/': 'problems2.js', '/*PROBLEMS3*/': 'problems3.js', '/*EXPLAIN*/': 'explain.js', '/*LADDER*/': 'ladder.js'}
t = s.replace('<!--HOME-->', '<a class="home" href="/">← Portfolio</a>')
fav = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2210%22%20fill%3D%22%231d2422%22/%3E%3Crect%20x%3D%228%22%20y%3D%2250%22%20width%3D%2248%22%20height%3D%225%22%20fill%3D%22%23d4520f%22/%3E%3Ctext%20x%3D%2232%22%20y%3D%2241%22%20font-family%3D%22Arial%2CHelvetica%2Csans-serif%22%20font-size%3D%2228%22%20font-weight%3D%22700%22%20fill%3D%22%23ffffff%22%20text-anchor%3D%22middle%22%3EDS%3C/text%3E%3C/svg%3E">'
meta = f'''<title>Structured Text Practice · Darshan Shah</title>
<meta name="description" content="A free, in-browser coding judge for Allen-Bradley Logix Structured Text and ladder logic: PLC problems graded scan by scan.">
<link rel="canonical" href="https://darshanhshah.com/st-practice.html">
{fav}
<meta property="og:type" content="website">
<meta property="og:title" content="Structured Text Practice">
<meta property="og:description" content="PLC programming problems in Logix Structured Text and ladder, graded scan by scan in your browser.">
<meta property="og:url" content="https://darshanhshah.com/st-practice.html">
<meta property="og:image" content="https://darshanhshah.com/og.jpg">'''
t = t.replace('<title>ST Practice</title>', meta)
t = t.replace("document.title = 'ST Practice'", "document.title = 'Structured Text Practice · Darshan Shah'")
t = t.replace("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap", "https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700;800&family=Figtree:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap")
t = t.replace('"Geist Mono"', '"IBM Plex Mono"').replace('Geist,', 'Figtree,')
theme = '''<style>
/* Site theme: matches darshanhshah.com (HMI greys, furnace-glow orange) */
:root{--bg:light-dark(#f6f7f5,#131716);--panel:light-dark(#ffffff,#1b201f);--code:light-dark(#ffffff,#101413);
--ink:light-dark(#1d2422,#ecf0ee);--mute:light-dark(#5d6763,#a2ada8);--line:light-dark(#e1e5e2,#2c3331);
--acc:light-dark(#d4520f,#ff8a4c);--accink:light-dark(#b8460c,#ff8a4c);--ok:light-dark(#2f8a4c,#4cc074);--okbg:light-dark(#e6f3ea,#16271c)}
h1,h2,.brand{font-family:"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif;font-weight:800;letter-spacing:-.01em}
.brand{font-size:1.25rem}.ph h1{font-weight:700}
.btn{border-radius:4px}.btn.go{color:#fff}.list,.card{border-radius:6px}
.ticks span.on{background:var(--acc)}
</style>
</head>'''
t = t.replace('</head>', theme, 1)
for k, f in parts.items():
    t = t.replace(k, rd(f))
open(os.path.join(ROOT, 'st-practice.html'), 'w', encoding='utf-8').write(t)

# keep the homepage problem count in step
import subprocess, json
n = int(subprocess.check_output(['node', '-e', open(os.path.join(HERE, 'test.js')).read().split('// ---- checks')[0] + 'console.log(P.length)'], cwd=HERE).decode().strip().splitlines()[-1])
idx = os.path.join(ROOT, 'index.html'); h = open(idx, encoding='utf-8').read()
h2 = re.sub(r'It has \d+ problems in Structured Text and ladder logic', f'It has {n} problems in Structured Text and ladder logic', h)
if h2 != h: open(idx, 'w', encoding='utf-8').write(h2)
print(f'built st-practice.html with {n} problems')

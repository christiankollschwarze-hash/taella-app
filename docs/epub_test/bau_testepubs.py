# Baut zwei Test-EPUB3 mit Media Overlays aus Ruf der Wildnis (public/manifest_en.json + public/audio/en)
#   test_mo_taella.epub : 2 Kapitel, Clock-Zeiten, clipEnd überall
#   test_mo_fremd.epub  : fremde Ordnerstruktur, Timecount "s", clipEnd teils fehlend, verschachtelte seq,
#                         3. Kapitel ohne Media Overlay (nur lesbar)
# Aufruf: python bau_testepubs.py   (braucht ffmpeg)
import json, os, subprocess, wave, zipfile, html, tempfile, uuid
HIER = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(os.path.dirname(HIER))
M = json.load(open(os.path.join(APP, "public", "manifest_en.json"), encoding="utf-8"))
GAP = 0.25

def kapitel(n, maxs=10):
    pre = f"c{n:03d}_"
    ss = [s for s in M["saetze"] if s["tag_id"].startswith(pre) and s["typ"] != "p" and s["text"]]
    return ss[:maxs]

def dauer(p):
    with wave.open(p) as w: return w.getnframes() / w.getframerate()

def audio(saetze, ziel):
    tmp = tempfile.mkdtemp(); lst = os.path.join(tmp, "l.txt"); sil = os.path.join(tmp, "sil.wav")
    first = os.path.join(APP, "public", "audio", "en", saetze[0]["tag_id"] + ".wav")
    with wave.open(first) as w: sr, ch = w.getframerate(), w.getnchannels()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r={sr}:cl={'mono' if ch == 1 else 'stereo'}", "-t", str(GAP), sil], check=True)
    zeiten, t = [], 0.0
    with open(lst, "w") as f:
        for s in saetze:
            p = os.path.join(APP, "public", "audio", "en", s["tag_id"] + ".wav")
            d = dauer(p); zeiten.append((t, t + d)); t += d + GAP
            f.write(f"file '{p}'\nfile '{sil}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-ac", "1", "-b:a", "64k", ziel], check=True)
    return zeiten, t

def clock(x): h = int(x // 3600); m = int(x % 3600 // 60); return f"{h}:{m:02d}:{x % 60:06.3f}"

def xhtml(titel, saetze, idp, lang="en"):
    body = [f'<h1 id="{idp}h">{html.escape(titel)}</h1>']
    absatz = []
    for i, s in enumerate(saetze[1:], 1):
        absatz.append(f'<span id="{idp}{i}">{html.escape(s["text"])}</span>')
        if i % 4 == 0: body.append("<p>" + " ".join(absatz) + "</p>"); absatz = []
    if absatz: body.append("<p>" + " ".join(absatz) + "</p>")
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{lang}">'
            f'<head><title>{html.escape(titel)}</title></head><body>{"".join(body)}</body></html>')

def ids(saetze, idp): return [f"{idp}h"] + [f"{idp}{i}" for i in range(1, len(saetze))]

def bau(name, fremd):
    out = os.path.join(HIER, name); tmp = tempfile.mkdtemp()
    O = "OEBPS/" if fremd else "EPUB/"
    tx, au, sm = (("Text/", "Audio/", "Smil/") if fremd else ("", "", ""))
    kaps = [kapitel(1), kapitel(2)] + ([kapitel(3, 12)] if fremd else [])
    files, man, spine, navli, total = {}, [], [], [], 0.0
    for k, ss in enumerate(kaps, 1):
        titel = ss[0]["text"]; idp = f"k{k}s" if fremd else f"c{k}_"
        files[f"{O}{tx}kap{k}.xhtml"] = xhtml(titel, ss, idp)
        navli.append(f'<li><a href="{"Text/" if fremd else ""}kap{k}.xhtml">{html.escape(titel)}</a></li>')
        mo = not (fremd and k == 3)
        attr = f' media-overlay="mo{k}"' if mo else ""
        man.append(f'<item id="kap{k}" href="{tx}kap{k}.xhtml" media-type="application/xhtml+xml"{attr}/>')
        spine.append(f'<itemref idref="kap{k}"/>')
        if not mo: continue
        mp3 = os.path.join(tmp, f"kap{k}.mp3"); zeiten, dur = audio(ss, mp3); total += dur
        files[f"{O}{au}kap{k}.mp3"] = open(mp3, "rb").read()
        man.append(f'<item id="a{k}" href="{au}kap{k}.mp3" media-type="audio/mpeg"/>')
        man.append(f'<item id="mo{k}" href="{sm}kap{k}.smil" media-type="application/smil+xml"/>')
        rel_t = "../Text/" if fremd else ""; rel_a = "../Audio/" if fremd else ""
        pars = []
        for j, (i, (b, e)) in enumerate(zip(ids(ss, idp), zeiten)):
            if fremd:
                ce = "" if j % 3 == 1 else f' clipEnd="{e:.3f}s"'
                pars.append(f'<par id="p{k}_{j}"><text src="{rel_t}kap{k}.xhtml#{i}"/><audio src="{rel_a}kap{k}.mp3" clipBegin="{b:.3f}s"{ce}/></par>')
            else:
                pars.append(f'<par id="p{k}_{j}"><text src="kap{k}.xhtml#{i}"/><audio src="kap{k}.mp3" clipBegin="{clock(b)}" clipEnd="{clock(e)}"/></par>')
        inner = "".join(pars)
        if fremd: inner = f'<seq epub:textref="{rel_t}kap{k}.xhtml" epub:type="chapter">{inner}</seq>'
        files[f"{O}{sm}kap{k}.smil"] = (f'<?xml version="1.0" encoding="UTF-8"?>\n<smil xmlns="http://www.w3.org/ns/SMIL" xmlns:epub="http://www.idpf.org/2007/ops" version="3.0"><body>{inner}</body></smil>')
        man.append(f'<!-- d{k} -->'); man[-1] = ""
        files.setdefault("_dur", []).append((f"#mo{k}", dur))
    durs = files.pop("_dur")
    meta_d = "".join(f'<meta property="media:duration" refines="{r}">{clock(d)}</meta>' for r, d in durs)
    files[f"{O}nav.xhtml"] = ('<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Inhalt</title></head>'
        f'<body><nav epub:type="toc"><ol>{"".join(navli)}</ol></nav></body></html>')
    titel = "Call of the Wild – Testauszug (fremd)" if fremd else "Call of the Wild – Testauszug"
    files[f"{O}{'content' if fremd else 'package'}.opf"] = (f'<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">'
        f'<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, name)}</dc:identifier>'
        f'<dc:title>{titel}</dc:title><dc:creator>Jack London</dc:creator><dc:language>en</dc:language>'
        f'<meta property="dcterms:modified">2026-10-24T00:00:00Z</meta>{meta_d}<meta property="media:duration">{clock(total)}</meta>'
        f'<meta property="media:active-class">-epub-media-overlay-active</meta></metadata>'
        f'<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{"".join(man)}</manifest>'
        f'<spine>{"".join(spine)}</spine></package>')
    container = ('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
        f'<rootfiles><rootfile full-path="{O}{"content" if fremd else "package"}.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    with zipfile.ZipFile(out, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", container, zipfile.ZIP_DEFLATED)
        for n, c in files.items():
            z.writestr(n, c, zipfile.ZIP_STORED if n.endswith(".mp3") else zipfile.ZIP_DEFLATED)
    print(out, round(total, 1), "s")

bau("test_mo_taella.epub", False)
bau("test_mo_fremd.epub", True)

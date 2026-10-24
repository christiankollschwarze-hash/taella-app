import json, sys
with open(r"public\manifest_en.json", encoding="utf-8") as f:
    d = json.load(f)
for s in d["saetze"]:
    if "grass" in s.get("text","") and s.get("align"):
        txt = s["text"]; gi = txt.find("grass")
        print("tag_id:", s["tag_id"])
        print("Kontext:", repr(txt[max(0,gi-15):gi+15]))
        print()
        for w in s["align"]:
            a,b = w.get("en_span",[None,None])
            if a is None: continue
            if gi-10 <= a <= gi+10:
                print(f"  i={w['i']:>3}  en_span={w['en_span']}  en={txt[a:b]!r:12}  de={w.get('de')!r}  de_span={w.get('de_span')}")
        break

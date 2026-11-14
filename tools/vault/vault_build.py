import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "/home/user/bloops-studio/out"
plan = json.load(open(os.path.join(HERE, "vault_plan.json")))
yt = {r["id"]: r for r in json.load(open(os.path.join(HERE, "yt_data.json")))}
n = int(sys.argv[1])
group = plan["groups"][n - 1]
amap_path = os.path.join(HERE, f"vault_{n}_assets.json")
amap = json.load(open(amap_path)) if os.path.exists(amap_path) else {}
rows = []
for e in group:
    r = yt[e]
    expected = -(-plan["sizes"][e] // 19922944)
    parts = sorted(k for k in amap if k.startswith(e + "_part_"))
    if len(parts) != expected and os.path.isdir(os.path.join(OUT, "_chunks", e)):
        parts = sorted(os.listdir(os.path.join(OUT, "_chunks", e)))
    if len(parts) != expected:
        print(f"  {e}: {len(parts)}/{expected} parts")
    short = r["title"].split(" | ")[0]
    safe = re.sub(r'[\\/:*?"<>|]', "", short).strip()
    rows.append(dict(id=e, lang=r["lang"], title=r["title"], short=short, dur=r["dur"], size=plan["sizes"][e],
                     filename=f"{e} {safe}.mp4", thumb=r["thumb"], parts=[amap.get(p, "") for p in parts]))
ready = all(x["parts"] and all(x["parts"]) for x in rows)
ids = ", ".join(group)
t = open(os.path.join(HERE, "vault_tpl.html")).read()
t = (t.replace("__TITLE__", f"Vidéos Bloop · lot {n}")
      .replace("__EYEBROW__", f"Lot {n} sur {len(plan['groups'])} · {ids}")
      .replace("__H1__", f"Enregistrer les épisodes (lot {n})")
      .replace("__DATA__", json.dumps(rows, ensure_ascii=False).replace("</", "<\\/")))
open(os.path.join(HERE, f"vault_{n}.html"), "w").write(t)
print(f"lot {n}: {len(rows)} episodes, {sum(len(x['parts']) for x in rows)} parts, urls complete: {ready}")

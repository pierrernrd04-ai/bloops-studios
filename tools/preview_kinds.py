"""Dev helper: build a short episode with chosen song kinds / lessons, for visual checks.
usage: python3 tools/preview_kinds.py fr 7 out/preview ride hide vehicles lesson:find"""
import json, os, sys
import soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from studio.planner import Episode

lang, seed, out, kinds = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4:]
os.makedirs(out, exist_ok=True)
ep = Episode(lang, seed, target_min=10)
ep.segments.append(dict(type="title", start=0.0, end=3.2)); ep.t = 3.2
for i, k in enumerate(kinds):
    if k.startswith("lesson:"):
        ep.lesson(k.split(":")[1])
    else:
        ep.song(k, ep.singers[i % 2])
ep.segments.append(dict(type="end", start=ep.t, end=ep.t + 4)); ep.t += 4
tl = dict(fps=30, duration=ep.t, lang=lang, seed=seed, narrator=ep.narrator, singers=ep.singers, segments=ep.segments,
          brand=ep.T["title"], ep_title="Preview", ui={"bye": "Bye-bye!"})
json.dump(tl, open(os.path.join(out, "timeline.json"), "w"))
sf.write(os.path.join(out, "audio.wav"), ep.mix.render(ep.duck, length=int(ep.t * 44100)).T, 44100, subtype="PCM_16")
for s in tl["segments"]:
    if s["type"] in ("song", "lesson"):
        v = s.get("verses")
        print(s["type"], s.get("kind"), round(s["start"], 1), round(s["end"], 1), "verse2:", round(v[1]["start"], 1) if v and len(v) > 1 else "")

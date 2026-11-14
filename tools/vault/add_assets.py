import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
n = sys.argv[1]
p = os.path.join(HERE, f"vault_{n}_assets.json")
m = json.load(open(p)) if os.path.exists(p) else {}
added = 0
for line in sys.stdin:
    g = re.search(r'"([^"]+\.mp4)" \((\d+) bytes, video/mp4\) → "(/_blob/[0-9a-f]{32})"', line)
    if g:
        path, size, url = g.groups()
        if os.path.getsize(path) != int(size):
            sys.exit(f"size mismatch {path}")
        m[os.path.basename(path)] = url
        added += 1
json.dump(m, open(p, "w"), indent=0)
print(f"lot {n}: +{added}, total {len(m)}")

#!/usr/bin/env python3
"""Generate a batch of episodes and (optionally) publish them as a GitHub Release.

    python3 batch.py --count 2                      # today's batch (1 EN + 1 FR), seeds derived from the date
    python3 batch.py --count 2 --publish            # ... and upload to a GitHub Release (needs `gh` auth)
    python3 batch.py --langs en,en,fr --seeds 41,42,43

Seeds are derived from the ISO date so every day gives new, different episodes
and a re-run of the same day reproduces the same episodes.
"""
import argparse
import datetime as dt
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def day_seed(day, i):
    return int(day.strftime("%Y%j")) % 100000 * 10 + i


def publish(tag, title, dirs):
    files = []
    notes = [f"# {title}", ""]
    for d in dirs:
        meta = json.load(open(os.path.join(d, "metadata.json")))
        base = os.path.basename(d)
        for src, ext in (("episode.mp4", "mp4"), ("thumbnail.jpg", "jpg"), ("description.txt", "txt")):
            dst = os.path.join(d, f"{base}.{ext}")
            if not os.path.exists(dst):
                os.link(os.path.join(d, src), dst)
            files.append(dst)
        notes += [f"## {base} ({meta['language'].upper()}, {meta['duration_sec'] / 60:.1f} min)", f"**{meta['title']}**", ""]
    nf = os.path.join(HERE, "out", f"{tag}-notes.md")
    open(nf, "w").write("\n".join(notes))
    subprocess.run(["gh", "release", "create", tag, "--title", title, "--notes-file", nf, *files], check=True, cwd=HERE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--langs", default=None, help="comma list, default alternates en,fr")
    ap.add_argument("--seeds", default=None)
    ap.add_argument("--date", default=None, help="YYYY-MM-DD (default today, UTC)")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--publish", action="store_true")
    a = ap.parse_args()
    day = dt.date.fromisoformat(a.date) if a.date else dt.datetime.utcnow().date()
    langs = a.langs.split(",") if a.langs else [("en", "fr")[i % 2] for i in range(a.count)]
    seeds = [int(s) for s in a.seeds.split(",")] if a.seeds else [day_seed(day, i) for i in range(len(langs))]
    dirs = []
    for lang, seed in zip(langs, seeds):
        out = os.path.join(HERE, "out", f"{lang}-{seed}")
        subprocess.run([sys.executable, os.path.join(HERE, "make_episode.py"), "--lang", lang, "--seed", str(seed),
                        "--out", out, "--workers", str(a.workers)], check=True)
        dirs.append(out)
    if a.publish:
        tag = f"episodes-{day.isoformat()}"
        publish(tag, f"Bloop Town / Bloop Ville – {day.isoformat()}", dirs)
    print("\n".join(dirs))


if __name__ == "__main__":
    main()

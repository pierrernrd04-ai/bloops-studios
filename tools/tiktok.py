#!/usr/bin/env python3
"""Cut a 1:30 vertical TikTok clip (1080x1920) from each finished episode.

The clip starts on a song announcement, so it opens on Bloopy introducing the song.
When possible it uses a different song from the 2-3 min shorts of the same episode.

    python3 tools/tiktok.py out/en-1001
    python3 tools/tiktok.py --all

Writes <episode>/tiktok/<episode>_tiktok_90s.mp4 and <episode>_tiktok.txt (caption + hashtags).
"""
import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shorts import HERE, pick, vertical, windows  # noqa: E402

DUR = 90.0
PREF = {"ride": 0, "farm": 1, "dance": 2, "count": 3, "fruits": 4, "hide": 5, "vehicles": 6, "rowboat": 7, "twinkle": 8, "lullaby": 9}
TAGS = {
    "en": "#nurseryrhymes #kidssongs #toddlers #preschool #singalong #learningisfun #babysongs #kidsmusic",
    "fr": "#comptines #chansonsenfant #maternelle #toutpetits #apprendreenchantant #chansonpourenfants #enfants #musique",
}
# TikTok is 13+: captions talk to the parents, who watch with their toddlers
CAPTION = {
    "en": "{title} 🎵 A sing-along nursery rhyme to enjoy with your toddler, with Bloopy and the Bloops. Full episode on our YouTube channel {brand}.",
    "fr": "{title} 🎵 Une comptine à chanter avec votre tout-petit, avec Bloopy et les Bloops. L'épisode complet est sur notre chaîne YouTube {brand}.",
}


def candidates(tl):
    segs = tl["segments"]
    out = []
    for i, s in enumerate(segs[:-1]):
        song = segs[i + 1]
        if s["type"] != "announce" or song["type"] != "song":
            continue
        start = max(0.0, s["start"] - 0.2)
        if start + DUR > tl["duration"] - 0.5:
            continue
        natural = song["end"] + 0.6 - start
        # a song that ends close to 1:30 is best; a long song is cut, a short one runs into the next segment
        cut = max(0.0, natural - DUR)
        spill = max(0.0, DUR - natural)
        out.append(dict(start=start, end=start + DUR, title=song["title"], kind=song["kind"],
                        score=cut * 1.0 + spill * 0.6 + PREF.get(song["kind"], 9) * 4))
    return out


def choose(tl, seen_titles=(), seen_kinds=()):
    """Best 1:30 window; avoids the shorts' songs and, across a batch, songs already used by other clips."""
    used = pick(windows(tl), 2)
    cands = candidates(tl)
    free = [c for c in cands if all(c["end"] <= u["start"] or c["start"] >= u["end"] for u in used)
            and c["title"] not in {u["title"] for u in used}] or cands
    key = lambda c: c["score"] + 100 * list(seen_titles).count(c["title"]) + 25 * list(seen_kinds).count(c["kind"])
    return min(free, key=key)


def write_text(td, name, lang, brand, c):
    cap = CAPTION[lang].format(title=c["title"], brand=brand)
    json.dump(dict(episode=name, lang=lang, title=c["title"], kind=c["kind"], start=round(c["start"], 2), duration=DUR,
                   caption=cap, hashtags=TAGS[lang]), open(os.path.join(td, "tiktok.json"), "w"), ensure_ascii=False, indent=1)
    open(os.path.join(td, f"{name}_tiktok.txt"), "w").write(
        f"Durée : 1 min 30 s\nExtrait : {c['title']} (à {int(c['start'] // 60)}:{int(c['start'] % 60):02d} dans l'épisode)\n\n"
        f"Légende TikTok :\n{cap}\n\n{TAGS[lang]}\n")


def refresh_text(ep_dir):
    """Rewrite caption files from tiktok.json without re-encoding the clip."""
    name = os.path.basename(ep_dir.rstrip("/"))
    td = os.path.join(ep_dir, "tiktok")
    meta = os.path.join(td, "tiktok.json")
    if os.path.exists(meta):
        c = json.load(open(meta))
        tl = json.load(open(os.path.join(ep_dir, "timeline.json")))
        write_text(td, name, c["lang"], tl["brand"], c)


def process(ep_dir, c=None):
    """Render the clip; with a planned window c, re-render only if the existing clip used another song."""
    name = os.path.basename(ep_dir.rstrip("/"))
    td = os.path.join(ep_dir, "tiktok")
    out = os.path.join(td, f"{name}_tiktok_90s.mp4")
    txt = os.path.join(td, f"{name}_tiktok.txt")
    meta = os.path.join(td, "tiktok.json")
    if os.path.exists(out) and os.path.exists(txt):
        if c is None or (os.path.exists(meta) and abs(json.load(open(meta))["start"] - c["start"]) < 0.5):
            return
    tl = json.load(open(os.path.join(ep_dir, "timeline.json")))
    c = c or choose(tl)
    vertical(ep_dir, tl, c["start"], DUR, c["title"], out, "tk")
    write_text(td, name, tl["lang"], tl["brand"], c)
    print(f"{name}: {c['title']} @ {c['start']:.0f}s", flush=True)


def plan(dirs):
    """Pick one window per episode so that clips of the same language use varied songs."""
    seen = {}
    out = []
    for d in dirs:
        tl = json.load(open(os.path.join(d, "timeline.json")))
        titles, kinds = seen.setdefault(tl["lang"], ([], []))
        c = choose(tl, titles, kinds)
        titles.append(c["title"])
        kinds.append(c["kind"])
        out.append((d, c))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--captions-only", action="store_true", help="rewrite captions of existing clips")
    ap.add_argument("--plan", action="store_true", help="print the varied plan for --all and exit")
    ap.add_argument("--jobs", type=int, default=1)
    a = ap.parse_args()
    dirs = [a.episode] if a.episode else sorted(d for d in glob.glob(os.path.join(HERE, "out", "*-[12]0??")) if os.path.isdir(d))
    dirs = [d for d in dirs if os.path.exists(os.path.join(d, "episode.mp4")) and os.path.exists(os.path.join(d, "thumbnail.jpg"))]
    if a.captions_only:
        for d in dirs:
            refresh_text(d)
        return
    planned = plan(dirs) if a.all else [(d, None) for d in dirs]
    if a.plan:
        for d, c in planned:
            print(os.path.basename(d), c["kind"], c["title"], round(c["start"]))
        return
    if a.jobs > 1:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(a.jobs) as ex:
            list(ex.map(lambda dc: process(*dc), planned))
    else:
        for d, c in planned:
            process(d, c)


if __name__ == "__main__":
    main()

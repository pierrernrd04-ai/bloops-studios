#!/usr/bin/env python3
"""Make a vertical cover (1080x1920 JPEG) for each TikTok clip.

The cover is a sharp, full-height crop of the song scene with the brand, the
song title in large letters and a "1:30" badge, so it reads at thumbnail size.

    python3 tools/covers.py --all
    python3 tools/covers.py out/en-1001

Writes <episode>/tiktok/<episode>_tiktok_cover.jpg (needs tiktok.json from tools/tiktok.py).
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import textwrap

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shorts import FONT, HERE  # noqa: E402

BADGE = {"en": "Sing along · 1:30", "fr": "Chante avec nous · 1:30"}


def cover(ep_dir, force=False):
    name = os.path.basename(ep_dir.rstrip("/"))
    td = os.path.join(ep_dir, "tiktok")
    meta = os.path.join(td, "tiktok.json")
    out = os.path.join(td, f"{name}_tiktok_cover.jpg")
    if not os.path.exists(meta) or (os.path.exists(out) and not force):
        return None
    c = json.load(open(meta))
    tl = json.load(open(os.path.join(ep_dir, "timeline.json")))
    lines = textwrap.wrap(c["title"], 15)[:3]
    tmp = []
    def txt(tag, s):
        p = os.path.join(td, f".cv_{tag}.txt")
        open(p, "w").write(s)
        tmp.append(p)
        return p.replace(":", "\\:")
    brand = txt("b", tl["brand"])
    badge = txt("g", BADGE[c["lang"]])
    y0 = 290 if len(lines) < 3 else 250
    draw = [f"drawtext=fontfile={FONT}:textfile={brand}:fontsize=64:fontcolor=white:box=1:boxcolor=0x7B4FE0:boxborderw=26:x=(w-tw)/2:y=110"]
    for k, line in enumerate(lines):
        draw.append(f"drawtext=fontfile={FONT}:textfile={txt(f't{k}', line)}:fontsize=128:fontcolor=white:"
                    f"borderw=16:bordercolor=0xFF4B4B:shadowcolor=0x00000066:shadowx=0:shadowy=8:x=(w-tw)/2:y={y0 + k * 150}")
    draw.append(f"drawtext=fontfile={FONT}:textfile={badge}:fontsize=72:fontcolor=0x3A2A00:box=1:boxcolor=0xFFD54A:boxborderw=28:"
                f"x=(w-tw)/2:y=1480")
    # a vivid moment of the song (12 s into the clip, after the announcement), shown whole in the middle
    # over a blurred copy; the karaoke line at the bottom of the frame is cropped out
    t = c["start"] + 12.0
    fc = ("[0:v]split=2[a][b];"
          "[a]scale=-2:480,crop=270:480,boxblur=7:2,scale=1080:1920,eq=brightness=-0.06:saturation=1.3[bg];"
          "[b]crop=iw*0.84:ih*0.88:iw*0.08:0,scale=1080:-2[fg];"
          "[bg][fg]overlay=0:720," + ",".join(draw) + "[v]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", os.path.join(ep_dir, "episode.mp4"),
                    "-frames:v", "1", "-filter_complex", fc, "-map", "[v]", "-q:v", "3", out], check=True)
    for p in tmp:
        os.remove(p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    dirs = [a.episode] if a.episode else sorted(glob.glob(os.path.join(HERE, "out", "*-[12]0??")))
    for d in dirs:
        o = cover(d, a.force)
        if o:
            print(o, flush=True)


if __name__ == "__main__":
    main()

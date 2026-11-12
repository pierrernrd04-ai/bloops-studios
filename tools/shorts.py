#!/usr/bin/env python3
"""Cut an episode into short videos of 2:00-2:58 (TikTok, YouTube Shorts, YouTube).

For each short, three files land in <episode>/shorts/:
    short_N_vertical.mp4   1080x1920 (TikTok + YouTube Shorts), title on top, blurred background
    short_N_youtube.mp4    1920x1080 cut of the episode (regular YouTube)
    short_N.txt            title + caption + hashtags

    python3 tools/shorts.py out/en-1001 [--count 2]
    python3 tools/shorts.py --all [--count 2]      # every finished episode in out/ without shorts
"""
import argparse
import glob
import json
import os
import subprocess
import textwrap

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
MIN_S, MAX_S = 121.0, 178.0

TAGS = {
    "en": "#nurseryrhymes #kidssongs #toddlers #preschool #singalong #learncolors #babysongs #shorts",
    "fr": "#comptines #chansonsenfant #maternelle #toutpetits #apprendre #chanson #enfants #shorts",
}
CTA = {"en": "Sing along with Bloopy!", "fr": "Chante avec Bloopy !"}


def windows(tl):
    """Contiguous runs of segments that start at a song announcement and last 2:00-2:58."""
    segs = tl["segments"]
    out = []
    for i, s in enumerate(segs):
        if s["type"] != "announce":
            continue
        song = next((x for x in segs[i + 1:i + 2] if x["type"] == "song"), None)
        if not song:
            continue
        start = max(0.0, s["start"] - 0.2)
        j = i + 1
        end = song["end"] + 0.6
        # extend with the following segments until the clip is long enough
        while end - start < MIN_S and j + 1 < len(segs):
            j += 1
            nxt = segs[j]
            if nxt["type"] in ("announce",) and j + 1 < len(segs) and segs[j + 1]["type"] == "song":
                cand = segs[j + 1]["end"] + 0.6
                if cand - start > MAX_S:
                    break
                end = cand
                j += 1
            else:
                if nxt["end"] - start > MAX_S:
                    break
                end = nxt["end"] + 0.2
        if MIN_S <= end - start <= MAX_S:
            out.append(dict(start=start, end=min(end, tl["duration"]), title=song["title"], kind=song["kind"]))
    return out


def pick(cands, count):
    pref = {"ride": 0, "farm": 1, "count": 2, "dance": 3, "hide": 4, "fruits": 5, "vehicles": 6, "rowboat": 7, "twinkle": 8, "lullaby": 9}
    chosen, used = [], set()
    for c in sorted(cands, key=lambda c: (pref.get(c["kind"], 9), abs(c["end"] - c["start"] - 150))):
        if c["kind"] in used or any(not (c["end"] <= x["start"] or c["start"] >= x["end"]) for x in chosen):
            continue
        chosen.append(c)
        used.add(c["kind"])
        if len(chosen) == count:
            break
    return sorted(chosen, key=lambda c: c["start"])


def vertical(ep_dir, tl, start, dur, title, out, tag):
    """Render a 1080x1920 clip of the episode with brand, title and call to action on top."""
    sd = os.path.dirname(out)
    os.makedirs(sd, exist_ok=True)
    lang = tl["lang"]
    lines = textwrap.wrap(title, 18)[:2]
    for k, line in enumerate(lines):
        open(os.path.join(sd, f".t{tag}_{k}.txt"), "w").write(line)
    open(os.path.join(sd, f".b{tag}.txt"), "w").write(tl["brand"])
    open(os.path.join(sd, f".c{tag}.txt"), "w").write(CTA[lang])
    esc = lambda p: p.replace(":", "\\:")
    y0 = 300 if len(lines) == 2 else 360
    draw = [f"drawtext=fontfile={FONT}:textfile={esc(os.path.join(sd, f'.b{tag}.txt'))}:fontsize=58:fontcolor=white:"
            f"box=1:boxcolor=0x7B4FE0:boxborderw=22:x=(w-tw)/2:y=170"]
    for k in range(len(lines)):
        draw.append(f"drawtext=fontfile={FONT}:textfile={esc(os.path.join(sd, f'.t{tag}_{k}.txt'))}:fontsize=96:fontcolor=white:"
                    f"borderw=12:bordercolor=0xFF4B4B:x=(w-tw)/2:y={y0 + k * 118}")
    draw.append(f"drawtext=fontfile={FONT}:textfile={esc(os.path.join(sd, f'.c{tag}.txt'))}:fontsize=70:fontcolor=0xFFE066:"
                f"borderw=10:bordercolor=0x3D2A8A:x=(w-tw)/2:y=1470")
    fade_out = max(0.0, dur - 0.8)
    vf = (f"[0:v]split=2[a][b];[a]scale=-2:480,crop=270:480,boxblur=7:2,scale=1080:1920,eq=brightness=-0.10:saturation=1.25[bg];"
          f"[b]scale=1080:-2[fg];[bg][fg]overlay=0:(H-h)/2+20," + ",".join(draw) +
          f",fade=t=in:st=0:d=0.3,fade=t=out:st={fade_out:.2f}:d=0.8[v];"
          f"[0:a]afade=t=in:st=0:d=0.3,afade=t=out:st={fade_out:.2f}:d=0.8[a2]")
    tmp = out + ".part.mp4"
    subprocess.run(["nice", "-n", "15", "ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-t", f"{dur:.2f}",
                    "-i", os.path.join(ep_dir, "episode.mp4"), "-filter_complex", vf, "-map", "[v]", "-map", "[a2]",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30",
                    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", tmp], check=True)
    os.replace(tmp, out)
    for f in glob.glob(os.path.join(sd, f".[tbc]{tag}*.txt")):
        os.remove(f)


def make_short(ep_dir, tl, w, n):
    sd = os.path.join(ep_dir, "shorts")
    lang = tl["lang"]
    dur = w["end"] - w["start"]
    vertical(ep_dir, tl, w["start"], dur, w["title"], os.path.join(sd, f"short_{n}_vertical.mp4"), str(n))
    yt = os.path.join(sd, f"short_{n}_youtube.mp4")
    subprocess.run(["nice", "-n", "15", "ffmpeg", "-y", "-loglevel", "error", "-ss", f"{w['start']:.2f}", "-t", f"{dur:.2f}",
                    "-i", os.path.join(ep_dir, "episode.mp4"), "-c", "copy", "-movflags", "+faststart", yt], check=True)
    if lang == "en":
        title = f"{w['title']} | {tl['brand']} Nursery Rhymes & Kids Songs"
        cap = f"{w['title']} 🎵 Sing, dance and learn with Bloopy and the Bloops! Sing-along lyrics on screen."
    else:
        title = f"{w['title']} | {tl['brand']} Comptines pour enfants"
        cap = f"{w['title']} 🎵 Chante, danse et apprends avec Bloopy et les Bloops ! Paroles à l'écran."
    m, s = divmod(int(round(dur)), 60)
    open(os.path.join(sd, f"short_{n}.txt"), "w").write(
        f"Durée / Duration : {m} min {s:02d} s\n\nTitre YouTube :\n{title[:100]}\n\nLégende TikTok / description :\n{cap}\n{TAGS[lang]}\n\n"
        f"Réglages : « conçue pour les enfants » sur YouTube.\n")
    return dur


def process(ep_dir, count):
    tl = json.load(open(os.path.join(ep_dir, "timeline.json")))
    done = 0
    for n, w in enumerate(pick(windows(tl), count), 1):
        if os.path.exists(os.path.join(ep_dir, "shorts", f"short_{n}.txt")):
            done += 1
            continue
        d = make_short(ep_dir, tl, w, n)
        print(f"{os.path.basename(ep_dir)} short {n}: {d:.0f}s  {w['title']}", flush=True)
        done += 1
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--count", type=int, default=2)
    a = ap.parse_args()
    dirs = [a.episode] if a.episode else sorted(d for d in glob.glob(os.path.join(HERE, "out", "*-*")) if os.path.isdir(d))
    for d in dirs:
        if os.path.exists(os.path.join(d, "episode.mp4")) and os.path.exists(os.path.join(d, "thumbnail.jpg")):
            process(d, a.count)


if __name__ == "__main__":
    main()

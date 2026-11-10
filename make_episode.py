#!/usr/bin/env python3
"""Generate one complete Bloop Town episode.

    python3 make_episode.py --lang en --seed 12            # 22-27 min episode
    python3 make_episode.py --lang fr --seed 3 --minutes 25
    python3 make_episode.py --lang en --seed 1 --minutes 3 --no-render   # quick audio/plan test

Output folder (default out/<lang>-<seed>/):
    episode.mp4, thumbnail.jpg, metadata.json, description.txt, timeline.json, audio.wav
"""
import argparse
import json
import os
import random
import subprocess
import sys
import time

import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from studio.planner import Episode  # noqa: E402
from studio.voices import BY_ID  # noqa: E402

LESSON_NAMES = {
    "en": dict(count="Counting time!", find="Find the color!", shape="Shape time!", animal="Guess the animal!"),
    "fr": dict(count="On compte !", find="Trouve la couleur !", shape="Les formes !", animal="Devine l'animal !"),
}
HOOKS = {
    "en": ["Colors, Animals & Fun Songs", "Sing, Dance & Learn", "Count, Sing & Play", "Happy Songs for Kids", "Learn Colors & Numbers"],
    "fr": ["Couleurs, animaux et chansons", "Chante, danse et apprends", "Compte, chante et joue", "Chansons joyeuses pour enfants", "Apprends les couleurs et les chiffres"],
}
CREDITS = {
    "kokoro": "Kokoro TTS v1.0 (Apache-2.0)",
    "fr_FR-gilles-low": "Piper voice 'gilles' (dataset CC0)",
    "fr_FR-siwis-medium": "Piper voice 'siwis' (SIWIS dataset, CC BY 4.0)",
}


def ts(sec):
    sec = int(sec)
    return f"{sec // 3600}:{sec % 3600 // 60:02d}:{sec % 60:02d}" if sec >= 3600 else f"{sec // 60}:{sec % 60:02d}"


def chapters(tl, lang):
    out = [(0, "Intro" if lang == "en" else "Introduction")]
    for s in tl["segments"]:
        if s["type"] == "announce":
            out.append((s["start"], s["song_title"]))
        elif s["type"] == "lesson":
            out.append((s["start"], LESSON_NAMES[lang][s["kind"]]))
        elif s["type"] == "bye":
            out.append((s["start"], "Bye-bye!" if lang == "en" else "Au revoir !"))
    clean = []
    for t, name in out:
        if clean and t - clean[-1][0] < 10:
            if len(clean) == 1:          # first song starts right after the intro: label 0:00 with it
                clean[0] = (0, name)
            continue
        clean.append((t, name))
    return clean


def metadata(tl, lang, seed, hook):
    songs = [s["title"] for s in tl["segments"] if s["type"] == "song"]
    brand = tl["brand"]
    mins = round(tl["duration"] / 60)
    if lang == "en":
        title = f"{hook} | {songs[0]}, {songs[1]} & More | {brand} Nursery Rhymes & Kids Songs"
        if len(title) > 100:
            title = f"{hook} | {songs[0]} & More | {brand} Kids Songs"
        intro = (f"Sing, dance and learn with Bloopy and the Bloops! {mins} minutes of happy nursery rhymes and kids songs "
                 f"with sing-along lyrics, plus fun learning games: colors, counting, shapes and animal sounds.\n"
                 f"Perfect for toddlers, preschool and kindergarten.")
        tags = ["nursery rhymes", "kids songs", "songs for kids", "toddler songs", "preschool", "learn colors", "counting song",
                "sing along", "baby songs", "children songs", "Bloop Town", "Bloopy", "educational videos for kids"]
        credit_head, music_line = "Credits", "Music: original arrangements of traditional public-domain melodies; original lyrics and animation by Bloop Town."
    else:
        title = f"{hook} | {songs[0]}, {songs[1]} et plus | {brand} Comptines pour enfants"
        if len(title) > 100:
            title = f"{hook} | {songs[0]} et plus | {brand} Comptines"
        intro = (f"Chante, danse et apprends avec Bloopy et les Bloops ! {mins} minutes de comptines et chansons pour enfants "
                 f"avec les paroles à l'écran, et des jeux pour apprendre : couleurs, chiffres, formes et cris des animaux.\n"
                 f"Idéal pour les tout-petits, la crèche et la maternelle.")
        tags = ["comptines", "chansons pour enfants", "comptines maternelle", "chanson enfant", "apprendre les couleurs",
                "chanson pour compter", "bébé", "maternelle", "dessin animé enfant", "Bloop Ville", "Bloopy", "vidéos éducatives"]
        credit_head, music_line = "Crédits", "Musique : arrangements originaux de mélodies traditionnelles du domaine public ; paroles et animation originales Bloop Ville."
    voices = {tl["narrator"], *tl["singers"]}
    creds = sorted({CREDITS["kokoro"] if BY_ID[v]["engine"] == "kokoro" else CREDITS.get(BY_ID[v].get("model"), BY_ID[v].get("model")) for v in voices})
    chap = "\n".join(f"{ts(t)} {name}" for t, name in chapters(tl, lang))
    desc = f"{intro}\n\n{chap}\n\n{credit_head}:\n{music_line}\nVoices / Voix : {'; '.join(creds)}.\n"
    return dict(title=title[:100], description=desc, tags=tags, language=lang, made_for_kids=True, category_id="27",
                duration_sec=round(tl["duration"], 1), seed=seed, songs=songs, voices=sorted(voices))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["en", "fr"], required=True)
    ap.add_argument("--seed", type=int, required=True)
    ap.add_argument("--minutes", type=float, default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--crf", type=int, default=22)
    ap.add_argument("--no-render", action="store_true")
    a = ap.parse_args()
    out = a.out or os.path.join(HERE, "out", f"{a.lang}-{a.seed:04d}")
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    print(f"== {a.lang} seed {a.seed} -> {out}")
    if os.path.exists(os.path.join(out, "episode.mp4")) and os.path.exists(os.path.join(out, "thumbnail.jpg")):
        print("   already done")
        return
    if all(os.path.exists(os.path.join(out, f)) for f in ("timeline.json", "audio.wav", "metadata.json")):
        print("   resuming: plan and audio already built")
        return render(a, out, t0)
    ep = Episode(a.lang, a.seed, target_min=a.minutes)
    tl, audio = ep.build()
    hook = random.Random(a.seed).choice(HOOKS[a.lang])
    tl["ep_title"] = hook
    tl["ui"] = {"bye": "Bye-bye!" if a.lang == "en" else "Au revoir !"}
    json.dump(tl, open(os.path.join(out, "timeline.json"), "w"))
    sf.write(os.path.join(out, "audio.wav"), audio.T, 44100, subtype="PCM_16")
    meta = metadata(tl, a.lang, a.seed, hook)
    json.dump(meta, open(os.path.join(out, "metadata.json"), "w"), indent=1, ensure_ascii=False)
    open(os.path.join(out, "description.txt"), "w").write(f"{meta['title']}\n\n{meta['description']}\nTags: {', '.join(meta['tags'])}\n")
    print(f"   plan+audio {tl['duration'] / 60:.1f} min in {time.time() - t0:.0f}s")
    del ep, audio                      # free several GB before the video render
    import gc
    gc.collect()
    if a.no_render:
        return
    render(a, out, t0)


def render(a, out, t0):
    subprocess.run(["node", os.path.join(HERE, "render", "render.js"), out, "--workers", str(a.workers), "--crf", str(a.crf)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(out, "thumb_src.png"), "-vf", "scale=1280:720", "-q:v", "2",
                    os.path.join(out, "thumbnail.jpg")], check=True)
    os.remove(os.path.join(out, "thumb_src.png"))
    print(f"== done in {(time.time() - t0) / 60:.1f} min: {out}/episode.mp4")


if __name__ == "__main__":
    main()

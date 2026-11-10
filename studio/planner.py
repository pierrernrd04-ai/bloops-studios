"""Episode planner: seed + language -> timeline (for the renderer) + soundtrack."""
import random

import numpy as np

from . import music, songs
from .music import SR, Arranger, Mix, STYLES, midi
from .voices import BY_ID, VoiceBank, voices_for

KIND_STYLE = {"lullaby": ["lullaby"], "twinkle": ["lullaby", "piano", "marimba"], "farm": ["bright", "parade", "musette"],
              "rowboat": ["marimba", "bright", "musette"], "vehicles": ["parade", "bright"], "dance": ["bright", "parade", "piano"]}

TXT = {
    "en": dict(
        hello=["Hello, friends! Welcome to Bloop Town! I'm Bloopy!", "Hi everyone! It's me, Bloopy! Are you ready to sing and play?",
               "Hello, hello! Welcome back to Bloop Town! Let's have fun together!"],
        pre_song=["Let's sing {t}!", "Ready? Here comes {t}!", "Everybody sing along! {t}!", "Clap your hands for {t}!",
                  "Ooh, I love this one! {t}!"],
        post_song=["Great singing!", "Wow, you did it!", "That was so much fun!", "Yay! Well done, friends!", "Hooray! Give yourself a big clap!"],
        count_intro="Let's count the {o} together! Ready?", count_end="{n} {o}! Great counting!",
        find_intro="Let's play a game! Can you find the right ball?", find_q="Where is the {c} ball?", find_a="Here it is! {C}!",
        shape_intro="Shape time! Let's look at some shapes!", shape_q="What shape is this?", shape_a="It's a {s}!",
        animal_intro="Listen carefully! Who makes this sound?", animal_q="Who says {s}?", animal_a="It's the {a}!",
        bye=["That's all for today! Thank you for singing with me! Bye-bye, see you next time!",
             "What a fun day in Bloop Town! See you soon, friends! Bye-bye!"],
        objs=dict(star="stars", balloon="balloons", apple="apples", duck="ducks", bubble="bubbles", bloop="Bloops"),
        nums=["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
        colors=dict(red="red", blue="blue", yellow="yellow", green="green", orange="orange", purple="purple", pink="pink"),
        shapes=dict(circle="circle", square="square", triangle="triangle", star="star", heart="heart", diamond="diamond", oval="oval", rectangle="rectangle"),
        animals=dict(cow=("moo", "cow"), pig=("oink", "pig"), duck=("quack", "duck"), sheep=("baa", "sheep"), cat=("meow", "cat"),
                     dog=("woof", "dog"), hen=("cluck", "hen"), frog=("ribbit", "frog")),
        title="Bloop Town", ep="Episode"),
    "fr": dict(
        hello=["Bonjour les amis ! Bienvenue à Bloop Ville ! C'est moi, Bloopy !", "Coucou tout le monde ! C'est Bloopy ! Prêts à chanter et à jouer ?",
               "Bonjour, bonjour ! Bon retour à Bloop Ville ! On va bien s'amuser !"],
        pre_song=["Chantons {t} !", "Prêts ? Voici {t} !", "Tout le monde chante avec moi ! {t} !", "Tapez dans vos mains pour {t} !",
                  "Oh, j'adore celle-là ! {t} !"],
        post_song=["Bravo, tu chantes super bien !", "Youpi ! Tu as réussi !", "C'était trop amusant !", "Bravo les amis !", "Hourra ! Un grand bravo !"],
        count_intro="On compte les {o} ensemble ! Prêts ?", count_end="{n} {o} ! Bravo, tu sais compter !",
        find_intro="On joue à un jeu ! Trouve la bonne boule !", find_q="Où est la boule {c} ?", find_a="La voilà ! {C} !",
        shape_intro="C'est l'heure des formes ! Regardons ensemble !", shape_q="Quelle est cette forme ?", shape_a="C'est un {s} !",
        animal_intro="Écoute bien ! Qui fait ce bruit ?", animal_q="Qui fait {s} ?", animal_a="C'est {a} !",
        bye=["C'est fini pour aujourd'hui ! Merci d'avoir chanté avec moi ! Au revoir, à bientôt !",
             "Quelle belle journée à Bloop Ville ! À très vite les amis ! Au revoir !"],
        objs=dict(star="étoiles", balloon="ballons", apple="pommes", duck="canards", bubble="bulles", bloop="Bloops"),
        nums=["un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"],
        colors=dict(red="rouge", blue="bleue", yellow="jaune", green="verte", orange="orange", purple="violette", pink="rose"),
        shapes=dict(circle="rond", square="carré", triangle="triangle", star="étoile", heart="cœur", diamond="losange", oval="ovale", rectangle="rectangle"),
        animals=dict(cow=("meuh", "la vache"), pig=("groin groin", "le cochon"), duck=("coin coin", "le canard"), sheep=("bêê", "le mouton"),
                     cat=("miaou", "le chat"), dog=("ouaf ouaf", "le chien"), hen=("cot cot", "la poule"), frog=("croa croa", "la grenouille")),
        title="Bloop Ville", ep="Épisode"),
}
FR_SHAPE_ART = {"star": "C'est une étoile !"}

LESSONS = ["count", "find", "shape", "animal"]
SCENES_TALK = ["trees", "flowers", "houses", "stage", "farm", "sea", "pines", "night"]


class Episode:
    def __init__(self, lang, seed, target_min=None, vb=None, log=print):
        self.lang = lang
        self.seed = seed
        self.rng = random.Random(seed * 7919 + (0 if lang == "en" else 1))
        self.T = TXT[lang]
        self.vb = vb or VoiceBank()
        self.log = log
        pool = voices_for(lang)
        r = self.rng
        self.narrator = pool[seed % len(pool)]["id"]
        singers = [v["id"] for v in voices_for(lang, singing=True) if v["id"] != self.narrator]
        r.shuffle(singers)
        self.singers = singers[:2]
        self.target = (target_min or r.uniform(22.0, 27.0)) * 60
        self.t = 0.0
        self.segments = []
        self.mix = Mix(self.target + 240)
        self.arr = Arranger(self.mix, r)
        self.duck = []

    # ------------------------------------------------------------ helpers
    def say(self, text, t=None, seg_extra=None, scene=None):
        t = self.t if t is None else t
        a = self.vb.speak(self.narrator, text)
        d = len(a) / SR
        self.mix.add(a, t, 0.9, 0, "voice")
        self.duck.append((t - 0.1, t + d + 0.1))
        env = _envelope(a)
        return d, env

    def talk(self, text, scene, kind="talk", extra=None, pad_after=0.5):
        d, env = self.say(text)
        seg = dict(type=kind, start=self.t, end=self.t + d + pad_after, text=text, scene=scene, env=env, env_t0=self.t)
        if extra:
            seg.update(extra)
        self.arr.pad_loop(self.t, d + pad_after, transpose=self.rng.choice([0, 2, -3]))
        self.segments.append(seg)
        self.t += d + pad_after
        return seg

    # ------------------------------------------------------------ song
    def song(self, kind, singer):
        r = self.rng
        sg = songs.make_song(kind, self.lang, r)
        mel = songs.MELODIES[sg["melody"]]
        style = dict(r.choice([s for s in STYLES if s["name"] in KIND_STYLE.get(kind, ["bright", "marimba", "piano", "parade", "musette"])]))
        bpm = r.uniform(*mel["bpm"])
        if kind == "lullaby":
            bpm *= 0.92
        B = 60.0 / bpm
        meter = mel["meter"]
        bar_beats = 3 if meter == 6 else 4
        gender = BY_ID[singer]["gender"]
        allm = [midi(n) for line in mel["lines"] for n, _ in line]
        med = float(np.median(allm))
        target = 67 if gender == "f" else 55
        transpose = int(round(target - med))
        style["lead_oct"] = 12 if gender == "m" else 0
        pickup = mel["pickup"]
        verse_beats = sum(d for line in mel["lines"] for _, d in line)
        gap_bars = 1 if kind in ("ride", "farm", "count", "fruits", "vehicles", "hide", "rowboat", "dance") else 0
        intro_bars = 2
        # pre-song announcement
        self.talk(r.choice(self.T["pre_song"]).format(t=sg["title"].rstrip("!")), sg["scene"], kind="announce",
                  extra=dict(song_title=sg["title"]), pad_after=0.3)
        t_song = self.t
        t0 = t_song + intro_bars * bar_beats * B + pickup * B   # downbeat of verse 1
        notes_all = []
        words = []
        verses_tl = []
        actions = []
        down = 0.0    # beat of current verse downbeat relative to t0
        for vi, v in enumerate(sg["verses"]):
            vstart_beat = down - pickup
            b = vstart_beat
            lines_tl = []
            for li, (text, mline) in enumerate(zip(v["lines"], mel["lines"])):
                fitted = songs.fit(text, mline)
                lstart = b
                for disp, sing, nts in fitted:
                    w_beat = b
                    dur_b = sum(d for _, d in nts)
                    notes_sec = tuple((midi(n) + transpose, d * B) for n, d in nts)
                    if sing.strip():
                        y, lead = self.vb.sing_word(singer, sing, notes_sec)
                        ts = t0 + w_beat * B
                        self.mix.add(y, ts - lead, 0.95, 0, "voice_wet")
                        self.mix.add(_detune(y), ts - lead + 0.018, 0.28, 0.4, "voice_wet")
                    words.append(dict(t=t0 + w_beat * B, d=dur_b * B, text=disp, line=li, verse=vi))
                    bb = w_beat
                    for n, d in nts:
                        notes_all.append((midi(n), bb, d))
                        bb += d
                    if li in v.get("act_lines", []):
                        actions.append(dict(t=t0 + w_beat * B, d=dur_b * B, verse=vi, word=disp))
                    b += dur_b
                lines_tl.append(dict(start=t0 + lstart * B - 0.35, end=t0 + b * B))
            vend_beat = down - pickup + verse_beats
            info = {k: v[k] for k in v if k not in ("lines", "act_lines")}
            verses_tl.append(dict(start=t0 + vstart_beat * B, end=t0 + vend_beat * B, lines=lines_tl, **info))
            down += verse_beats + gap_bars * bar_beats
        n_bars_music = int(np.ceil((down - gap_bars * bar_beats) / bar_beats))
        outro_bars = 2
        self.arr.song(t0, bpm, meter, notes_all, pickup, n_bars_music, style, transpose)
        # intro / gaps / outro chords are filled by the arranger with the nearest chord; add a little intro fanfare
        self._intro_outro(t0, B, bar_beats, intro_bars, n_bars_music, outro_bars, transpose, style)
        t_end = t0 + (n_bars_music + outro_bars) * bar_beats * B
        seg = dict(type="song", kind=kind, title=sg["title"], start=t_song, end=t_end, t0=t0, beat=B, meter=meter,
                   scene=sg["scene"], vehicle=sg.get("vehicle"), theme=sg.get("theme"), obj=sg.get("obj"),
                   verses=verses_tl, words=words, actions=actions, singer=singer, style=style["name"])
        self.segments.append(seg)
        self.t = t_end + 0.2
        self.log(f"  song {kind:9s} {sg['title'][:34]:34s} {t_end - t_song:6.1f}s  bpm {bpm:5.1f}  {style['name']:8s} voice {singer}")
        return seg

    def _intro_outro(self, t0, B, bar_beats, intro_bars, n_bars, outro_bars, tr, style):
        mx = self.mix
        # intro: chord stabs C | G ; outro: G | C with final hit
        for b, ch in ((-intro_bars, "C"), (-1, "G")):
            tb = t0 + b * bar_beats * B
            for bt in range(bar_beats):
                for q, p in enumerate(music.CHORDS[ch]):
                    mx.add(music.pluck(60 + p + tr if p > 3 else 72 + p + tr), tb + bt * B + q * 0.012, 0.11, -0.3, "music_wet")
            mx.add(music.bass(music.hz(36 + music.CHORDS[ch][0] + tr + (12 if tr < -2 else 0)), B * 1.5), tb, 0.4, 0, "drums")
            if style["drums"]:
                for bt in range(bar_beats):
                    mx.add(music.shaker(int(tb * 100 + bt)), tb + bt * B, 0.1, 0.3, "drums")
                mx.add(music.kick(), tb, 0.4, 0, "drums")
        te = t0 + n_bars * bar_beats * B
        for q, p in enumerate(music.CHORDS["C"] + [12]):
            mx.add(music.pluck(60 + p + tr) * 1.5, te + q * 0.015, 0.14, -0.3, "music_wet")
        mx.add(music.bass(music.hz(36 + tr + (12 if tr < -2 else 0)), 2.5), te, 0.45, 0, "drums")
        mx.add(music.kick(), te, 0.6, 0, "drums")
        mx.add(music.sparkle(), te + 0.05, 0.12, 0.2, "sfx")

    # ------------------------------------------------------------ lessons
    def lesson(self, kind):
        r, T = self.rng, self.T
        t_start = self.t
        if kind == "count":
            key = r.choice(list(T["objs"]))
            n = r.choice([6, 7, 8, 10, 10])
            d, env = self.say(T["count_intro"].format(o=T["objs"][key]))
            events = []
            envs = [(self.t, env)]
            self.t += d + 0.5
            for i in range(n):
                word = T["nums"][i].capitalize() + "!"
                if BY_ID[self.narrator].get("speech_only"):
                    word = ("Numéro " + T["nums"][i] + " !") if self.lang == "fr" else ("Number " + T["nums"][i] + "!")
                dd, e = self.say(word)
                events.append(dict(t=self.t, i=i + 1))
                self.mix.add(music.SFX["pop"](), self.t, 0.18, 0, "sfx")
                envs.append((self.t, e))
                self.t += max(dd, 0.6) + 0.45
            dd, e = self.say(T["count_end"].format(n=T["nums"][n - 1].capitalize(), o=T["objs"][key]))
            envs.append((self.t, e))
            self.mix.add(music.chime_up(), self.t, 0.25, 0, "sfx")
            self.t += dd + 0.8
            seg = dict(type="lesson", kind="count", obj=key, n=n, events=events)
        elif kind == "find":
            d, env = self.say(T["find_intro"])
            envs = [(self.t, env)]
            self.t += d + 0.4
            cols = r.sample(songs.COLORS, 5)
            rounds = []
            for c in r.sample(cols, 4):
                cname = T["colors"][c["key"]]
                dq, e = self.say(T["find_q"].format(c=cname))
                envs.append((self.t, e))
                t_q = self.t
                self.t += dq + 2.4
                self.mix.add(music.SFX["sparkle"](), self.t, 0.2, 0, "sfx")
                da, e = self.say(T["find_a"].format(C=cname.capitalize()))
                envs.append((self.t, e))
                rounds.append(dict(t_q=t_q, t_a=self.t, color=c["key"], hex=c["hex"], word=cname.upper()))
                self.t += da + 0.7
            seg = dict(type="lesson", kind="find", balls=[dict(color=c["key"], hex=c["hex"]) for c in cols], rounds=rounds)
        elif kind == "shape":
            d, env = self.say(T["shape_intro"])
            envs = [(self.t, env)]
            self.t += d + 0.4
            rounds = []
            for s in r.sample(songs.SHAPES, 4):
                name = T["shapes"][s["key"]]
                dq, e = self.say(T["shape_q"])
                envs.append((self.t, e))
                t_q = self.t
                self.t += dq + 2.0
                self.mix.add(music.SFX["sparkle"](), self.t, 0.2, 0, "sfx")
                ans = T["shape_a"].format(s=name)
                if self.lang == "fr" and s["key"] in ("star",):
                    ans = FR_SHAPE_ART[s["key"]]
                da, e = self.say(ans)
                envs.append((self.t, e))
                rounds.append(dict(t_q=t_q, t_a=self.t, shape=s["key"], hex=r.choice(songs.COLORS)["hex"], word=name.upper()))
                self.t += da + 0.7
            seg = dict(type="lesson", kind="shape", rounds=rounds)
        else:
            d, env = self.say(T["animal_intro"])
            envs = [(self.t, env)]
            self.t += d + 0.4
            rounds = []
            for a in r.sample(songs.FARM, 4):
                snd, name = T["animals"][a["key"]]
                dq, e = self.say(T["animal_q"].format(s=snd))
                envs.append((self.t, e))
                t_q = self.t
                self.t += dq + 2.2
                self.mix.add(music.SFX["sparkle"](), self.t, 0.2, 0, "sfx")
                da, e = self.say(T["animal_a"].format(a=name))
                envs.append((self.t, e))
                rounds.append(dict(t_q=t_q, t_a=self.t, animal=a["key"], word=name.split()[-1].upper(), sound=snd.upper()))
                self.t += da + 0.7
            seg = dict(type="lesson", kind="animal", rounds=rounds)
        self.arr.pad_loop(t_start, self.t - t_start, transpose=r.choice([0, 2, 5]))
        seg.update(start=t_start, end=self.t, scene=r.choice(["stage", "flowers", "trees"]), envs=_merge_envs(envs, t_start, self.t))
        self.segments.append(seg)
        self.log(f"  lesson {kind:8s} {self.t - t_start:6.1f}s")

    # ------------------------------------------------------------ whole episode
    def build(self):
        r, T = self.rng, self.T
        queue = [k for k in songs.SONG_KINDS if k != "lullaby"]
        r.shuffle(queue)
        # opening
        self.mix.add(music.chime_up(), 0.2, 0.3, 0, "sfx")
        self.segments.append(dict(type="title", start=0.0, end=3.2))
        self.t = 3.2
        self.talk(r.choice(T["hello"]), "trees", pad_after=0.6)
        order = []
        lessons = LESSONS[:]
        r.shuffle(lessons)
        li = 0
        qi = 0
        while self.t < self.target - 160:
            if qi and qi % len(queue) == 0:          # new round: reshuffle, avoid repeating the last kind
                last = queue[-1]
                r.shuffle(queue)
                if queue[0] == last:
                    queue.append(queue.pop(0))
            kind = queue[qi % len(queue)]
            qi += 1
            singer = self.singers[len(order) % 2]
            self.song(kind, singer)
            order.append(kind)
            if len(order) % 2 == 0 and self.t < self.target - 220:
                self.lesson(lessons[li % len(lessons)])
                li += 1
            else:
                self.talk(r.choice(T["post_song"]), self.segments[-1]["scene"], pad_after=0.4)
        # close with the lullaby if it was not used, then goodbye
        self.song("lullaby", self.singers[len(order) % 2])
        self.talk(r.choice(T["bye"]), "night", kind="bye", pad_after=1.5)
        self.segments.append(dict(type="end", start=self.t, end=self.t + 4.0))
        self.mix.add(music.chime_up(), self.t + 0.3, 0.3, 0, "sfx")
        self.t += 4.0
        self.duration = self.t
        audio = self.mix.render(self.duck, length=int(self.duration * SR))
        self.mix = None
        tl = dict(fps=30, duration=self.duration, lang=self.lang, seed=self.seed, narrator=self.narrator,
                  singers=self.singers, segments=self.segments, brand=T["title"])
        return tl, audio


def _envelope(a, fps=30):
    hop = SR // fps
    n = len(a) // hop + 1
    e = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2)) if i * hop < len(a) else 0 for i in range(n)])
    e = e / (e.max() + 1e-9)
    return [round(float(x), 2) for x in e]


def _merge_envs(envs, t0, t1, fps=30):
    n = int((t1 - t0) * fps) + 1
    out = np.zeros(n)
    for ts, e in envs:
        i = int((ts - t0) * fps)
        for k, v in enumerate(e):
            if 0 <= i + k < n:
                out[i + k] = max(out[i + k], v)
    return [round(float(x), 2) for x in out]


def _detune(y, cents=9):
    r = 2 ** (cents / 1200)
    idx = np.arange(0, len(y) - 1, r)
    return np.interp(idx, np.arange(len(y)), y).astype(np.float32)

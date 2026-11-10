"""Song catalogue: public-domain melodies + ORIGINAL lyrics (EN / FR) + an
original-melody generator.

Lyric notation: syllables are separated by '-', '+' is a real hyphen that is
also a syllable break (là+haut -> "là-haut"), '_' extends the previous
syllable over one more note. fit() auto-adjusts small mismatches so item
slots ({animal}, {fruit}...) can have any length.
"""
import re

# ------------------------------------------------------------------ melodies
# "C4" = middle C, ":x" = duration in quarter-note beats (default 1)


def M(s):
    out = []
    for tok in s.split():
        n, _, d = tok.partition(":")
        out.append((n, float(d) if d else 1.0))
    return out


MELODIES = {
    # traditional "Mulberry Bush" / "Wheels on the Bus" tune
    "wheels": dict(meter=4, pickup=0.5, bpm=(112, 124), lines=[
        M("G4:.5 C5 C5:.5 C5:.5 C5:.5 C5:.5 E5 G5 E5 C5:2"),
        M("D5 B4 G4:2 G5 E5 C5:1.5"),
        M("G4:.5 C5 C5:.5 C5:.5 C5:.5 C5:.5 E5 G5 E5 C5:2"),
        M("D5:2 G4 G4 C5:3.5")]),
    "oldmac": dict(meter=4, pickup=0, bpm=(116, 128), lines=[
        M("C5 C5 C5 G4 A4 A4 G4:2"),
        M("E5 E5 D5 D5 C5:3"),
        M("G4 C5 C5 C5 G4 A4 A4 G4:2"),
        M("E5 E5 D5 D5 C5:3"),
        M("G4:.5 G4:.5 C5 C5 C5 G4:.5 G4:.5 C5 C5 C5:2"),
        M("C5:.5 C5:.5 C5 C5:.5 C5:.5 C5 C5:.5 C5:.5 C5:.5 C5:.5 C5 C5"),
        M("C5 C5 C5 G4 A4 A4 G4:2"),
        M("E5 E5 D5 D5 C5:4")]),
    "twinkle": dict(meter=4, pickup=0, bpm=(92, 104), lines=[
        M("C4 C4 G4 G4 A4 A4 G4:2"), M("F4 F4 E4 E4 D4 D4 C4:2"),
        M("G4 G4 F4 F4 E4 E4 D4:2"), M("G4 G4 F4 F4 E4 E4 D4:2"),
        M("C4 C4 G4 G4 A4 A4 G4:2"), M("F4 F4 E4 E4 D4 D4 C4:2")]),
    "rowboat": dict(meter=6, pickup=0, bpm=(132, 150), lines=[
        M("C4:1.5 C4:1.5 C4 D4:.5 E4:1.5"),
        M("E4 D4:.5 E4 F4:.5 G4:3"),
        M("C5:.5 C5:.5 C5:.5 G4:.5 G4:.5 G4:.5 E4:.5 E4:.5 E4:.5 C4:.5 C4:.5 C4:.5"),
        M("G4 F4:.5 E4 D4:.5 C4:3")]),
    "london": dict(meter=4, pickup=0, bpm=(108, 120), lines=[
        M("G4:1.5 A4:.5 G4 F4 E4 F4 G4:2"), M("D4 E4 F4:2"), M("E4 F4 G4:2"),
        M("G4:1.5 A4:.5 G4 F4 E4 F4 G4:2"), M("D4:2 G4:2 E4 C4:3")]),
    "frere": dict(meter=4, pickup=0, bpm=(104, 116), lines=[
        M("C4 D4 E4 C4"), M("C4 D4 E4 C4"), M("E4 F4 G4:2"), M("E4 F4 G4:2"),
        M("G4:.5 A4:.5 G4:.5 F4:.5 E4 C4"), M("G4:.5 A4:.5 G4:.5 F4:.5 E4 C4"),
        M("C4 G3 C4:2"), M("C4 G3 C4:2")]),
    "mary": dict(meter=4, pickup=0, bpm=(108, 120), lines=[
        M("E4 D4 C4 D4 E4 E4 E4:2"), M("D4 D4 D4:2"), M("E4 G4 G4:2"),
        M("E4 D4 C4 D4 E4 E4 E4 E4"), M("D4 D4 E4 D4 C4:4")]),
    "yankee": dict(meter=4, pickup=0, bpm=(120, 132), lines=[
        M("C4 C4 D4 E4 C4 E4 D4 G3"), M("C4 C4 D4 E4 C4:2 B3:2"),
        M("C4 C4 D4 E4 F4 E4 D4 C4"), M("B3 G3 A3 B3 C4:2 C4:2")]),
    "auclair": dict(meter=4, pickup=0, bpm=(88, 100), lines=[
        M("C4 C4 C4 D4 E4:2 D4:2"), M("C4 E4 D4 D4 C4:4"),
        M("C4 C4 C4 D4 E4:2 D4:2"), M("C4 E4 D4 D4 C4:4"),
        M("D4 D4 D4 D4 A3:2 A3:2"), M("D4 C4 B3 A3 G3:4"),
        M("C4 C4 C4 D4 E4:2 D4:2"), M("C4 E4 D4 D4 C4:4")]),
}

# ------------------------------------------------------------------ items
COLORS = [
    dict(key="red", hex="#FF4B4B", en="red", fr="rouge"),
    dict(key="blue", hex="#3D8BFF", en="blue", fr="bleu"),
    dict(key="yellow", hex="#FFC928", en="yel-low", fr="jaune"),
    dict(key="green", hex="#3DD66B", en="green", fr="vert"),
    dict(key="orange", hex="#FF9F43", en="or-ange", fr="o-range"),
    dict(key="purple", hex="#9B6BFF", en="pur-ple", fr="vi-o-let"),
    dict(key="pink", hex="#FF7AB8", en="pink", fr="rose"),
]
# group = the three-note "action" phrase of the ride song
ACTIONS = [
    dict(key="bounce", en="bounce", fr="hop", en_grp="bounce, bounce, bounce", fr_grp="hop, hop, hop", en_ing="bounc-ing", fr_imp="re-bon-dis"),
    dict(key="spin", en="spin", fr="tourne", en_grp="spin, spin, spin", fr_grp="tourne, tourne, tourne", en_ing="spin-ning", fr_imp="tour-ne"),
    dict(key="clap", en="clap", fr="clap", en_grp="clap, clap, clap", fr_grp="clap, clap, clap", en_ing="clap-ping", fr_imp="ta-pe"),
    dict(key="peek", en="peek", fr="coucou", en_grp="peek-a-boo!", fr_grp="cou-cou toi!", en_ing="peek-ing", fr_imp="cou-cou"),
    dict(key="jump", en="jump", fr="saute", en_grp="jump, jump, jump", fr_grp="saute, saute, saute", en_ing="jump-ing", fr_imp="sau-te"),
    dict(key="wiggle", en="wiggle", fr="remue", en_grp="wiggle, wiggle, wiggle", fr_grp="remue, remue, remue", en_ing="wig-gling", fr_imp="re-mue"),
    dict(key="wave", en="wave", fr="salut", en_grp="wave, wave, wave", fr_grp="salut, salut, salut", en_ing="wav-ing", fr_imp="sa-lue"),
    dict(key="nod", en="nod", fr="oui", en_grp="nod, nod, nod", fr_grp="oui, oui, oui", en_ing="nod-ding", fr_imp="danse"),
]
FARM = [
    dict(key="cow", en="cow", fr="la va-che", en_s="moo", fr_s="meuh", en_name="cow", fr_name="vache"),
    dict(key="pig", en="pig", fr="le co-chon", en_s="oink", fr_s="groin", en_name="pig", fr_name="cochon"),
    dict(key="duck", en="duck", fr="le ca-nard", en_s="quack", fr_s="coin", en_name="duck", fr_name="canard"),
    dict(key="sheep", en="sheep", fr="le mou-ton", en_s="baa", fr_s="bêê", en_name="sheep", fr_name="mouton"),
    dict(key="cat", en="cat", fr="le chat", en_s="meow", fr_s="miaou", en_name="cat", fr_name="chat"),
    dict(key="dog", en="dog", fr="le chien", en_s="woof", fr_s="ouaf", en_name="dog", fr_name="chien"),
    dict(key="hen", en="hen", fr="la pou-le", en_s="cluck", fr_s="cot", en_name="hen", fr_name="poule"),
    dict(key="frog", en="frog", fr="la gre-nouille", en_s="ribbit", fr_s="croa", en_name="frog", fr_name="grenouille"),
]
SEA = [
    dict(key="fish", en="lit-tle fish", fr="le pois-son"), dict(key="crab", en="sil-ly crab", fr="le cra-be"),
    dict(key="whale", en="big blue whale", fr="la ba-leine"), dict(key="octopus", en="oc-to-pus", fr="la pieu-vre"),
    dict(key="turtle", en="sea tur-tle", fr="la tor-tue"), dict(key="dolphin", en="dol-phin friend", fr="le dau-phin"),
    dict(key="starfish", en="pink star-fish", fr="l'é-toi-le"), dict(key="jellyfish", en="jel-ly-fish", fr="la mé-duse"),
]
FRUITS = [
    dict(key="apple", hex="#FF4B4B", en="ap-ple", fr="u-ne pom-me", en_c="red", fr_c="rouge"),
    dict(key="banana", hex="#FFC928", en="ba-na-na", fr="u-ne ba-nane", en_c="yel-low", fr_c="jaune"),
    dict(key="orange", hex="#FF9F43", en="or-ange", fr="u-ne o-range", en_c="juic-y", fr_c="o-range"),
    dict(key="strawberry", hex="#FF4B6B", en="straw-ber-ry", fr="u-ne frai-se", en_c="sweet", fr_c="rouge"),
    dict(key="grapes", hex="#9B6BFF", en="grapes", fr="du rai-sin", en_c="pur-ple", fr_c="vi-o-let"),
    dict(key="watermelon", hex="#3DD66B", en="mel-on", fr="u-ne pas-tè-que", en_c="green", fr_c="vert"),
    dict(key="pear", hex="#A8D84B", en="pear", fr="u-ne poire", en_c="green", fr_c="vert"),
    dict(key="cherry", hex="#E8344E", en="cher-ry", fr="des ce-ri-ses", en_c="red", fr_c="rouge"),
]
SHAPES = [
    dict(key="circle", en="cir-cle", fr="rond"), dict(key="square", en="square", fr="car-ré"),
    dict(key="triangle", en="tri-an-gle", fr="tri-an-gle"), dict(key="star", en="star", fr="é-toile"),
    dict(key="heart", en="heart", fr="cœur"), dict(key="diamond", en="dia-mond", fr="lo-sange"),
    dict(key="oval", en="o-val", fr="o-vale"), dict(key="rectangle", en="rec-tan-gle", fr="rec-tan-gle"),
]
VEHICLES = [
    dict(key="bus", en="bus", fr="bus", en_s="beep", fr_s="tut"),
    dict(key="train", en="train", fr="train", en_s="choo", fr_s="tchou"),
    dict(key="boat", en="boat", fr="ba-teau", en_s="toot", fr_s="pouet"),
    dict(key="plane", en="plane", fr="a-vion", en_s="zoom", fr_s="vroum"),
    dict(key="car", en="car", fr="voi-ture", en_s="honk", fr_s="bip"),
    dict(key="rocket", en="rock-et", fr="fu-sée", en_s="whoosh", fr_s="zoum"),
    dict(key="tractor", en="trac-tor", fr="trac-teur", en_s="chug", fr_s="teuf"),
]
COUNT_OBJS = [
    dict(key="balloon", en_sg="lit-tle bal-loon", en_pl="lit-tle bal-loons", en_v="float-ing high",
         fr_sg="bal-lon qui s'en-vo-le", fr_pl="bal-lons qui s'en-vo-lent", fr_v="s'en-vo-lent"),
    dict(key="star", en_sg="lit-tle star", en_pl="lit-tle stars", en_v="shin-ing bright",
         fr_sg="é-toi-le qui bril-le", fr_pl="é-toi-les qui bril-lent", fr_v="qui bril-lent"),
    dict(key="duck", en_sg="lit-tle duck", en_pl="lit-tle ducks", en_v="swim-ming by",
         fr_sg="ca-nard sur l'é-tang", fr_pl="ca-nards sur l'é-tang", fr_v="sur l'é-tang"),
    dict(key="bubble", en_sg="lit-tle bub-ble", en_pl="lit-tle bub-bles", en_v="float-ing up",
         fr_sg="bul-le qui s'en-vo-le", fr_pl="bul-les qui s'en-vo-lent", fr_v="s'en-vo-lent"),
    dict(key="apple", en_sg="ap-ple on the tree", en_pl="ap-ples on the tree", en_v="on the tree",
         fr_sg="pom-me sur l'ar-bre", fr_pl="pom-mes sur l'ar-bre", fr_v="sur l'ar-bre"),
    dict(key="bloop", en_sg="lit-tle Bloop", en_pl="lit-tle Bloops", en_v="jump-ing high",
         fr_sg="Bloop qui sau-te haut", fr_pl="Bloops qui sau-tent haut", fr_v="sau-tent haut"),
]
NUMBERS = dict(en=["one", "two", "three", "four", "five", "six", "sev-en", "eight", "nine", "ten"],
               fr=["un", "deux", "trois", "qua-tre", "cinq", "six", "sept", "huit", "neuf", "dix"])
FR_NUM_F = {"un": "u-ne"}   # feminine "une" for étoile, bulle, pomme

# ------------------------------------------------------------------ lyric fitting


def syllabify(text):
    """-> list of words, each word = list of syllables ('_' = melisma)."""
    words = []
    text = re.sub(r"\s+([!?;:,.])", r"\1", text)
    for w in text.split():
        if w == "_":
            if words:
                words[-1].append("_")
            continue
        parts = re.split(r"(?<=[^\s])-(?=[^\s])", w.replace("+", "‑"))
        out = []
        for p in parts:
            out += [q + "‑" for q in p.split("‑")[:-1]] + [p.split("‑")[-1]]
        words.append([s for s in out if s])
    return words


def fit(text, notes):
    """Align lyric text to melody notes. Returns [(display_word, sing_text, [(note, beats), ...])]."""
    words = syllabify(text)
    notes = list(notes)
    n_syl = lambda: sum(len(w) for w in words)
    # too many syllables: merge inside the longest word, then join short words
    while n_syl() > len(notes):
        multi = [i for i, w in enumerate(words) if len(w) > 1 and "_" not in w[-1:]]
        if multi:
            i = max(multi, key=lambda i: (len(words[i]), i))
            w = words[i]
            w[-2:] = [w[-2] + w[-1]]
        else:
            j = min(range(len(words) - 1), key=lambda j: len("".join(words[j])) + len("".join(words[j + 1])))
            words[j:j + 2] = [["".join(words[j]) + " " + "".join(words[j + 1])]]
    # too few syllables: merge equal adjacent notes, else melisma on the last word
    while n_syl() < len(notes):
        k = next((k for k in range(len(notes) - 1) if notes[k][0] == notes[k + 1][0]), None)
        if k is not None and len(notes) - n_syl() > 0:
            notes[k:k + 2] = [(notes[k][0], notes[k][1] + notes[k + 1][1])]
        else:
            words[-1].append("_")
    out = []
    i = 0
    for w in words:
        k = len(w)
        disp = "".join(s for s in w if s != "_").replace("‑", "-")
        sing = re.sub(r"[^\w' \-]", "", disp.replace("-", " ")).strip() or disp
        out.append((disp, sing, notes[i:i + k]))
        i += k
    return out


def check_all():
    """Developer helper: list lines whose syllable count differs from the melody."""
    import random
    rng = random.Random(1)
    for lang in ("en", "fr"):
        for kind in SONG_KINDS:
            song = make_song(kind, lang, rng)
            mel = MELODIES[song["melody"]]
            for v in song["verses"]:
                for li, line in enumerate(v["lines"]):
                    n = sum(len(w) for w in syllabify(line))
                    m = len(mel["lines"][li])
                    if n != m:
                        print(f"{lang} {kind} L{li}: {n} syl / {m} notes  | {line}")


# ------------------------------------------------------------------ song makers
def _pick(rng, seq, k):
    seq = list(seq)
    rng.shuffle(seq)
    return seq[:k]


def song_ride(lang, rng):
    veh = rng.choice([v for v in VEHICLES if v["key"] in ("bus", "train", "boat")])
    cols = _pick(rng, COLORS, rng.choice([4, 5]))
    acts = _pick(rng, ACTIONS, len(cols))
    end = {"en": {"bus": "all through the town!", "train": "all a-long the track!", "boat": "all a-cross the sea!"},
           "fr": {"bus": "par-tout en ville !", "train": "sur les rails, tchou !", "boat": "sur la mer bleue !"}}[lang][veh["key"]]
    verses = []
    for c, a in zip(cols, acts):
        if lang == "en":
            l1 = f"The {c['en']} ball on the {veh['en']} goes {a['en_grp']}"
            l2 = f"{a['en_grp']}, {a['en_grp']}"
        else:
            l1 = f"Bou-le {c['fr']} dans le {veh['fr']} fait {a['fr_grp']}"
            l2 = f"{a['fr_grp']}, {a['fr_grp']}"
        verses.append(dict(lines=[l1, l2, l1, end], color=c["key"], hex=c["hex"], action=a["key"],
                           word=_plain(c[lang]).upper(), act_lines=[0, 1, 2]))
    title = {"en": f"The Colors on the {veh['key'].title()}", "fr": f"Les couleurs dans le {_plain(veh['fr'])}"}[lang]
    return dict(kind="ride", melody="wheels", title=title, vehicle=veh["key"], verses=verses,
                scene=rng.choice({"bus": ["trees", "houses", "flowers", "pines"], "train": ["pines", "trees", "snow"], "boat": ["sea"]}[veh["key"]]))


def song_farm(lang, rng):
    animals = _pick(rng, FARM, rng.choice([4, 5]))
    verses = []
    for a in animals:
        s = a[lang + "_s"]
        if lang == "en":
            L = ["Grand-pa Bloop-y had a farm,", "E, I, E, I, O!", f"And on that farm he had a {a['en']},", "E, I, E, I, O!",
                 f"With a {s} {s} here and a {s} {s} there,", f"Here a {s}, there a {s}, ev-ery-where a {s} {s}!",
                 "Grand-pa Bloop-y had a farm,", "E, I, E, I, O!"]
        else:
            L = ["Pa-py Bloop a sa fer-me,", "I, A, I, A, O !", f"Dans sa ferme, y a {a['fr']},", "I, A, I, A, O !",
                 f"Il fait {s} {s} ici, et puis {s} {s} là,", f"I-ci {s}, là {s}, par-tout, par-tout, {s} {s} !",
                 "Pa-py Bloop a sa fer-me,", "I, A, I, A, O !"]
        verses.append(dict(lines=L, animal=a["key"], sound=s.upper(), word=a[lang + "_name"].upper(), act_lines=[4, 5]))
    title = {"en": "Grandpa Bloopy's Farm", "fr": "La ferme de Papy Bloop"}[lang]
    return dict(kind="farm", melody="oldmac", title=title, verses=verses, scene="farm")


TWINKLE_THEMES = {
    "rainbow": dict(
        en=[["Red and or-ange, yel-low too,", "green and blue and pur-ple, woo!", "Col-ors danc-ing in the sky,",
             "rain-bow, rain-bow, way up high!", "Red and or-ange, yel-low too,", "green and blue and pur-ple, woo!"]],
        fr=[["Rouge, o-ran-ge, jaune et vert,", "bleu, vi-o-let, dans les airs,", "les cou-leurs dan-sent là+haut,",
             "oh ! re-gar-de l'arc+en+ciel !", "Rouge, o-ran-ge, jaune et vert,", "bleu, vi-o-let, dans les airs !"]],
        title=dict(en="Rainbow Colors Song", fr="La chanson de l'arc-en-ciel"), scene="flowers"),
    "shapes": dict(
        en=[["Cir-cle, square and tri-an-gle,", "star and heart, I see them all!", "Round and round the cir-cle goes,",
             "square has cor-ners, four in rows,", "Cir-cle, square and tri-an-gle,", "star and heart, I see them all!"]],
        fr=[["Rond, car-ré, et tri-an-gle,", "cœur, é-toi-le, tout est beau,", "le rond tour-ne, tour-ne, tourne,",
             "le car-ré a qua-tre coins,", "Rond, car-ré, et tri-an-gle,", "cœur, é-toi-le, tout est beau !"]],
        title=dict(en="Shapes Song", fr="La chanson des formes"), scene="stage"),
    "night": dict(
        en=[["Shi-ny moon and stars so bright,", "Bloop-y waves a soft good+night,", "Close your eyes and dream a-way,",
             "we will play a-gain some day,", "Shi-ny moon and stars so bright,", "Bloop-y waves a soft good+night."]],
        fr=[["Lu-ne bel-le, é-toiles d'or,", "pe-tit Bloop, il est temps, dors,", "fer-me les yeux dou-ce-ment,",
             "rê-ve de nu-a-ges blancs,", "Lu-ne bel-le, é-toiles d'or,", "pe-tit Bloop, il est temps, dors."]],
        title=dict(en="Shiny Moon Lullaby", fr="Berceuse de la lune"), scene="night"),
}


def song_twinkle(lang, rng):
    key = rng.choice(list(TWINKLE_THEMES))
    th = TWINKLE_THEMES[key]
    reps = rng.choice([2, 3])
    verses = [dict(lines=th[lang][0], theme=key, act_lines=[]) for _ in range(reps)]
    return dict(kind="twinkle", melody="twinkle", title=th["title"][lang], theme=key, verses=verses, scene=th["scene"])


def song_rowboat(lang, rng):
    animals = _pick(rng, SEA, rng.choice([6, 7]))
    verses = []
    for a in animals:
        if lang == "en":
            L = ["Row, row, row the boat,", "out up-on the sea,", f"{a['en']} is swim-ming, {a['en']} is swim-ming,", "wave hel-lo to me!"]
        else:
            L = ["Ra-me, ra-me, rame !", "sur la mer si bleue,", f"{a['fr']} qui na-ge, {a['fr']} qui na-ge,", "di-sons-lui bon+jour !"]
        verses.append(dict(lines=L, animal=a["key"], word=_plain(a[lang]).upper(), act_lines=[2, 3]))
    title = {"en": "Row Row the Boat", "fr": "Rame, petit bateau"}[lang]
    return dict(kind="rowboat", melody="rowboat", title=title, verses=verses, scene="sea", vehicle="boat")


def song_count(lang, rng):
    obj = rng.choice(COUNT_OBJS)
    top = rng.choice([5, 5, 6])
    verses = []
    for n in range(1, top + 1):
        num = NUMBERS[lang][n - 1]
        if lang == "en":
            what = obj["en_sg"] if n == 1 else obj["en_pl"]
            L = [f"{num} {what} {obj['en_v'] if obj['key'] != 'apple' else ''}".strip() + ",", f"{obj['en_v']},", f"{obj['en_v']},",
                 f"{num} {what} {obj['en_v'] if obj['key'] != 'apple' else ''}".strip() + ",", "count with me!"]
        else:
            if obj["key"] in ("star", "bubble", "apple"):
                num = FR_NUM_F.get(num, num)
            what = obj["fr_sg"] if n == 1 else obj["fr_pl"]
            L = [f"{num} {what},", f"{obj['fr_v']},", f"{obj['fr_v']},", f"{num} {what},", "comp-tons en-semble !"]
        verses.append(dict(lines=L, n=n, obj=obj["key"], word=str(n), act_lines=[]))
    title = {"en": f"Counting {obj['key'].title()}s", "fr": "On compte ensemble"}[lang]
    return dict(kind="count", melody="london", title=title, obj=obj["key"], verses=verses,
                scene=rng.choice(["stage", "trees", "flowers"]))


def song_hide(lang, rng):
    cols = _pick(rng, COLORS, 4)
    acts = _pick(rng, ACTIONS, 4)
    verses = []
    for c, a in zip(cols, acts):
        if lang == "en":
            hop = {"bounce": "Bounce", "spin": "Spin", "clap": "Clap", "peek": "Peek", "jump": "Jump", "wiggle": "Wig-gle", "wave": "Wave", "nod": "Nod"}[a["key"]]
            col = _plain(c["en"]).title()
            L = [f"Where is {col} Bloop?", f"Where is {col} Bloop?", "Here I am!", "Here I am!",
                 "How are you to-day, friend?", "Ve-ry well, I thank you!", f"{hop} a-way!", f"{hop} a-way!"]
        else:
            w = a["fr"]
            L = [f"Où est Bloop {c['fr']} ?", f"Où est Bloop {c['fr']} ?", "Me voi-ci !", "Me voi-ci !",
                 "Bon+jour, com-ment vas-tu ?", "Très bien, mer-ci, et toi ?", f"{w}, {w}, {w} !", f"{w}, {w}, {w} !"]
        verses.append(dict(lines=L, color=c["key"], hex=c["hex"], action=a["key"], word=_plain(c[lang]).upper(), act_lines=[6, 7]))
    title = {"en": "Where Is Bloopy? Hide and Seek", "fr": "Où est Bloop ? Cache-cache"}[lang]
    return dict(kind="hide", melody="frere", title=title, verses=verses, scene=rng.choice(["trees", "flowers", "pines"]))


def song_fruits(lang, rng):
    fruits = _pick(rng, FRUITS, rng.choice([4, 5]))
    verses = []
    for f in fruits:
        if lang == "en":
            L = [f"Bloop-y has a {f['en_c']} {f['en']},", f"{f['en_c']} {f['en']},", f"{f['en_c']} {f['en']},",
                 f"Bloop-y has a {f['en_c']} {f['en']}, it's", "yum-my, yum-my, yum!"]
        else:
            L = [f"Bloop-y man-ge {f['fr']},", f"{f['fr']},", f"{f['fr']},", f"Bloop-y man-ge {f['fr']}, c'est", "miam, miam, c'est bon !"]
        verses.append(dict(lines=L, fruit=f["key"], hex=f["hex"], word=_plain(f[lang]).split()[-1].upper(), act_lines=[4]))
    title = {"en": "Yummy Fruits Song", "fr": "La chanson des fruits"}[lang]
    return dict(kind="fruits", melody="mary", title=title, verses=verses, scene=rng.choice(["flowers", "trees", "stage"]))


def song_vehicles(lang, rng):
    vs = _pick(rng, [v for v in VEHICLES if v["key"] != "boat"], rng.choice([4, 5]))
    verses = []
    for v in vs:
        s = v[lang + "_s"]
        if lang == "en":
            L = [f"Bloop-y took the {v['en']} to town,", f"{s}, {s}, here we go!", "Ev-ery-bo-dy clap your hands and", "sing a-long with Bloop-y!"]
        else:
            L = [f"Bloop-y part en {v['fr']} en vil-le,", f"{s}, {s}, c'est par-ti !", "Tout le mon-de tape des mains et", "chan-te a-vec Bloop-y !"]
        verses.append(dict(lines=L, vehicle=v["key"], sound=s.upper(), word=_plain(v[lang]).upper(), act_lines=[1, 2]))
    title = {"en": "Bloopy's Vehicle Parade", "fr": "La parade des véhicules"}[lang]
    return dict(kind="vehicles", melody="yankee", title=title, verses=verses, scene=rng.choice(["houses", "trees"]))


LULLABY = dict(
    en=[["Hel-lo, sil-ver moon-light,", "shin-ing on my bed,", "Bloop-y yawns and stretch-es,", "time to rest my head,",
         "Count the sleep-y sheep-ies,", "one, two, three, and four,", "Hel-lo, sil-ver moon-light,", "dream a lit-tle more."],
        ["Twin-kle, sleep-y star-light,", "dan-cing in the sky,", "Bloop-y hugs his ted-dy,", "sing a lul-la-by,",
         "Soft-ly, soft-ly sway-ing,", "like a boat at sea,", "Twin-kle, sleep-y star-light,", "sing good+night with me."]],
    fr=[["Sous la lu-ne blan-che,", "Bloop-y va dor-mir,", "les é-toi-les bril-lent", "pour le faire sou-rire,",
         "On comp-te les mou-tons,", "un, deux, trois, qua-tre,", "Sous la lu-ne blan-che,", "fais un beau do-do."],
        ["Pe-ti-te é-toi-le,", "qui bril-le là+haut,", "veil-le sur mon rê-ve,", "jus-qu'au jour nou-veau,",
         "Dou-ce-ment je ber-ce", "mon dou-dou tout doux,", "Pe-ti-te é-toi-le,", "bon-ne nuit à tous."]])


def song_lullaby(lang, rng):
    verses = [dict(lines=L, act_lines=[]) for L in LULLABY[lang]]
    title = {"en": "Silver Moonlight Lullaby", "fr": "Sous la lune blanche"}[lang]
    return dict(kind="lullaby", melody="auclair", title=title, verses=verses, scene="night")


def song_dance(lang, rng):
    """Original melody, generated from the seed."""
    acts = _pick(rng, ACTIONS, rng.choice([4, 5]))
    verses = []
    for a in acts:
        if lang == "en":
            w = a["en"]
            W = w.title()
            L = [f"Ev-ery-bo-dy {w}, {w}, {w}!", f"{W} with Bloop-y, {w} with me!", f"{W} up high and {w} down low,", "now we're read-y, here we go!"]
        else:
            w = a["fr_imp"]
            W = w[0].upper() + w[1:]
            L = [f"Tout le mon-de {w}, {w} !", f"{W} a-vec Bloop-y, a-vec moi !", f"{W} en haut, {w} en bas,", "on est prêts, et on y va !"]
        verses.append(dict(lines=L, action=a["key"], word=_plain(a[lang if lang == 'en' else 'fr_imp']).upper(), act_lines=[0, 1, 2]))
    melody = generate_melody(rng, [len(_syl_count(l)) for l in verses[0]["lines"]])
    title = {"en": "Dance with Bloopy!", "fr": "Danse avec Bloop !"}[lang]
    return dict(kind="dance", melody=melody, title=title, verses=verses, scene="stage")


SONG_KINDS = {
    "ride": song_ride, "farm": song_farm, "twinkle": song_twinkle, "rowboat": song_rowboat, "count": song_count,
    "hide": song_hide, "fruits": song_fruits, "vehicles": song_vehicles, "lullaby": song_lullaby, "dance": song_dance,
}


def make_song(kind, lang, rng):
    return SONG_KINDS[kind](lang, rng)


def _plain(s):
    return s.replace("-", "").replace("+", "-")


def _syl_count(line):
    return [s for w in syllabify(line) for s in w]


# ------------------------------------------------------------------ original melodies
SCALE = [0, 2, 4, 5, 7, 9, 11]


def generate_melody(rng, syl_counts):
    """A fresh AABA-ish 4-line melody in C major, 2 bars per line, fitted to
    the syllable count of each line."""
    prog = rng.choice([["C", "F", "G", "C"], ["C", "Am", "F", "G"], ["C", "G", "Am", "F"], ["F", "C", "G", "C"]])
    tones = {"C": [0, 4, 7], "F": [5, 9, 0], "G": [7, 11, 2], "Am": [9, 0, 4]}
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    def rhythm(k):
        if k <= 4:
            base = [2.0] * k
        elif k <= 8:
            base = [1.0] * k
        else:
            base = [0.5] * (2 * (k - 8)) + [1.0] * (k - 2 * (k - 8))
            base = base[:k]
        tot = sum(base)
        if tot < 8:
            base[-1] += 8 - tot
        while sum(base) > 8:
            i = max(range(k), key=lambda j: base[j])
            base[i] /= 2
        if sum(base) < 8:
            base[-1] += 8 - sum(base)
        return base

    def line(k, chord_a, chord_b, end_tonic, prev=7):
        out = []
        r = rhythm(k)
        t = 0
        cur = prev
        for i, d in enumerate(r):
            chord = chord_a if t < 4 else chord_b
            strong = (t % 2 == 0)
            if i == k - 1 and end_tonic:
                target = 12 if rng.random() < .5 else 0
            elif strong:
                target = min([c + o for c in tones[chord] for o in (0, 12)], key=lambda x: abs(x - cur) + rng.random() * 3)
            else:
                cand = [s + o for s in SCALE for o in (0, 12) if abs(s + o - cur) <= 4]
                target = rng.choice(cand) if cand else cur
            target = max(0, min(14, target))
            cur = target
            midi = 60 + target
            out.append((names[midi % 12] + str(midi // 12 - 1), d))
            t += d
        return out, cur

    a, p = line(syl_counts[0], prog[0], prog[1], False)
    b, p = line(syl_counts[1], prog[2], prog[3], True, p)
    c, p = line(syl_counts[2], prog[1], prog[2], False, p)
    d, p = line(syl_counts[3], prog[2], prog[3], True, p)
    name = f"gen{rng.randrange(10**6)}"
    MELODIES[name] = dict(meter=4, pickup=0, bpm=(116, 128), lines=[a, b, c, d], generated=True)
    return name

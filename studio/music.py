"""Instrument synthesis, arrangement and mixing (all generated, no samples)."""
import numpy as np
from scipy.signal import lfilter

SR = 44100
NOTE_IDX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(n):
    if isinstance(n, (int, float)):
        return n
    base = NOTE_IDX[n[0]]
    rest = n[1:]
    acc = 0
    while rest and rest[0] in "#b":
        acc += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + base + acc


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(d):
    return np.arange(int(max(d, 0.001) * SR)) / SR


# ------------------------------------------------------------------ instruments
def flute(f, d):
    t = tt(d + 0.12)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    env = np.clip(t / 0.03, 0, 1) * np.where(t < d, 1 - 0.15 * t / max(d, 1e-3), 0.85 * np.exp(-(t - d) / 0.04))
    return s * env


def marimba(f, d):
    t = tt(max(d, 0.5) + 0.4)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.45) + 0.35 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.07)
         + 0.12 * np.sin(2 * np.pi * 10 * f * t) * np.exp(-t / 0.02))
    return s * np.clip(t / 0.002, 0, 1)


def glock(f, d=1.0):
    t = tt(1.2)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.5) + 0.25 * np.sin(2 * np.pi * 2.756 * f * t) * np.exp(-t / 0.15)
         + 0.1 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t / 0.05))
    return s * np.clip(t / 0.001, 0, 1)


def epiano(f, d):
    t = tt(d + 0.5)
    mod = 1.2 * np.exp(-t / 0.3) * np.sin(2 * np.pi * f * 7 * t)
    s = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.9) + 0.25 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.3)
    return s * np.clip(t / 0.003, 0, 1) * np.where(t < d, 1, np.exp(-(t - d) / 0.12))


def clarinet(f, d):
    t = tt(d + 0.1)
    ph = 2 * np.pi * f * t
    s = np.sin(ph) + 0.4 * np.sin(3 * ph) + 0.18 * np.sin(5 * ph) + 0.07 * np.sin(7 * ph)
    env = np.clip(t / 0.05, 0, 1) * np.where(t < d, 1, np.exp(-(t - d) / 0.05))
    return s * env * 0.7


def accordion(f, d):
    t = tt(d + 0.1)
    s = 0
    for det in (0.997, 1.0, 1.004):
        ph = 2 * np.pi * f * det * t
        s = s + np.sign(np.sin(ph)) * 0.2 + np.sin(ph) * 0.3
    s = lfilter([0.25], [1, -0.75], s)
    env = np.clip(t / 0.04, 0, 1) * np.where(t < d, 1, np.exp(-(t - d) / 0.05))
    return s * env


LEADS = {"flute": flute, "marimba": marimba, "glock": glock, "epiano": epiano, "clarinet": clarinet, "accordion": accordion}

_pluck_cache = {}


def pluck(m, bright=0.5):
    key = (int(m), bright)
    if key in _pluck_cache:
        return _pluck_cache[key]
    f = hz(m)
    length = int(0.9 * SR)
    P = int(round(SR / f))
    rng = np.random.default_rng(int(m))
    x = np.zeros(length)
    x[:P] = lfilter([bright, 1 - bright], [1], rng.uniform(-1, 1, P))
    a = np.zeros(P + 2)
    a[0], a[P], a[P + 1] = 1, -0.4985, -0.4985
    y = lfilter([1], a, x) * np.exp(-np.arange(length) / SR / 0.35)
    y = lfilter([0.6], [1, -0.4], y)
    _pluck_cache[key] = y / (np.abs(y).max() + 1e-9)
    return _pluck_cache[key]


def piano_chord_note(m):
    return epiano(hz(m), 0.6) * 0.6


def bass(f, d):
    t = tt(d + 0.05)
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    env = np.clip(t / 0.005, 0, 1) * np.exp(-t / 0.4) * np.where(t < d, 1, np.exp(-(t - d) / 0.02))
    return s * env


def kick():
    t = tt(0.35)
    f = 48 + 110 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16) * np.clip(t / 0.002, 0, 1)


def clap(seed, big=1.0):
    rng = np.random.default_rng(seed)
    t = tt(0.3)
    n = lfilter([1], [1, -0.3], np.diff(rng.standard_normal(len(t)), prepend=0))
    env = np.zeros_like(t)
    for k, o in enumerate((0, 0.011, 0.022)):
        env += (t >= o) * np.exp(-np.clip(t - o, 0, None) / (0.007 if k < 2 else 0.08 * big))
    return n * env * 0.35


def shaker(seed):
    rng = np.random.default_rng(seed)
    t = tt(0.08)
    return np.diff(rng.standard_normal(len(t)), prepend=0) * np.clip(t / 0.008, 0, 1) * np.exp(-t / 0.025) * 0.3


def sweep(f0, f1, d, tau, wob=0.0):
    t = tt(d)
    f = f0 + (f1 - f0) * (t / d) ** 0.6 + wob * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.25)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.exp(-t / tau) * np.clip(t / 0.003, 0, 1)


def horn(d=0.22, f1=392.0, f2=494.0):
    t = tt(d)
    s = np.zeros_like(t)
    for f in (f1, f2):
        ph = 2 * np.pi * f * t
        s += 0.35 * np.sign(np.sin(ph)) + 0.5 * np.sin(ph)
    s = lfilter([0.18], [1, -0.82], s)
    return s * np.clip(t / 0.01, 0, 1) * np.clip((d - t) / 0.02, 0, 1)


def whoosh(d, seed):
    rng = np.random.default_rng(seed)
    t = tt(d)
    n = lfilter([0.08], [1, -0.92], rng.standard_normal(len(t)))
    return n * np.sin(np.pi * t / d) ** 2 * 2.5


def sparkle():
    out = np.zeros(int(0.9 * SR))
    for k, n in enumerate((84, 88, 91, 96, 100)):
        g = glock(hz(n))
        i = int(k * 0.045 * SR)
        m = min(len(out) - i, len(g))
        out[i:i + m] += g[:m] * (0.6 - k * 0.07)
    return out


def chime_up():
    out = np.zeros(int(1.2 * SR))
    for k, n in enumerate((72, 76, 79, 84)):
        g = marimba(hz(n), 0.5)
        i = int(k * 0.09 * SR)
        m = min(len(out) - i, len(g))
        out[i:i + m] += g[:m] * 0.5
    return out


SFX = {
    "pop": lambda: sweep(500, 1900, 0.09, 0.03),
    "boing": lambda: sweep(180, 620, 0.5, 0.18, wob=40),
    "boing_down": lambda: sweep(620, 220, 0.45, 0.16, wob=30),
    "sparkle": sparkle,
    "chime": chime_up,
    "horn": horn,
    "thud": lambda: sweep(160, 70, 0.12, 0.05),
}

# ------------------------------------------------------------------ harmony
CHORDS = {"C": [0, 4, 7], "Dm": [2, 5, 9], "Em": [4, 7, 11], "F": [5, 9, 0], "G": [7, 11, 2], "Am": [9, 0, 4], "G7": [7, 11, 2, 5]}


def infer_chords(notes, bar_beats, pickup):
    """notes: [(midi, start_beat, dur)] in C major. Returns {bar: chord}."""
    bars = {}
    for m, s, d in notes:
        b = int(np.floor(s / bar_beats + 1e-6))
        w = d * (1.5 if abs(s % bar_beats) < 1e-6 else 1.0)
        bars.setdefault(b, {}).setdefault(int(m) % 12, 0)
        bars[b][int(m) % 12] += w
    out = {}
    prev = "C"
    for b in sorted(bars):
        best, bs = "C", -1
        for name in ("C", "F", "G", "Am", "Dm", "Em"):
            tones = CHORDS[name]
            sc = sum(w for pc, w in bars[b].items() if pc in tones) - 0.6 * sum(w for pc, w in bars[b].items() if pc not in tones)
            sc += {"C": .35, "F": .2, "G": .25}.get(name, 0) + (0.1 if name == prev else 0)
            if sc > bs:
                best, bs = name, sc
        out[b] = best
        prev = best
    return out


# ------------------------------------------------------------------ mixing
def comb(x, D, g):
    y = np.zeros_like(x)
    for k in range(0, len(x), D):
        seg = x[k:k + D].copy()
        if k >= D:
            seg += g * y[k - D:k - D + len(seg)]
        y[k:k + len(seg)] = seg
    return y


def allpass(x, D, g):
    y = np.zeros_like(x)
    for k in range(0, len(x), D):
        xs = x[k:k + D]
        seg = -g * xs
        if k >= D:
            seg = seg + x[k - D:k - D + len(xs)] + g * y[k - D:k - D + len(xs)]
        y[k:k + len(xs)] = seg
    return y


def reverb(x, spread=0):
    out = np.zeros_like(x)
    for D, g in ((1557, .84), (1617, .83), (1491, .82), (1422, .81)):
        out += comb(x, D + spread, g)
    out = lfilter([0.35], [1, -0.65], out / 4)
    for D, g in ((225, .5), (556, .5)):
        out = allpass(out, D + spread // 3, g)
    return out


class Mix:
    """Four stereo buses: music (ducked under speech), music_wet (+reverb, ducked), voice_wet (+reverb), dry."""
    ALIAS = {"music": "music", "drums": "music", "music_wet": "music_wet", "voice_wet": "voice_wet", "voice": "dry", "sfx": "dry"}

    def __init__(self, dur):
        self.n = int((dur + 2.0) * SR)
        self.bus = {k: np.zeros((2, self.n), np.float32) for k in ("music", "music_wet", "voice_wet", "dry")}

    def add(self, sig, t0, gain=1.0, pan=0.0, bus="music"):
        i = int(round(t0 * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        j = min(self.n, i + len(sig))
        if j <= i:
            return
        sig = np.asarray(sig[:j - i], np.float32)
        th = (pan + 1) * np.pi / 4
        b = self.bus[self.ALIAS[bus]]
        b[0, i:j] += sig * np.float32(gain * np.cos(th))
        b[1, i:j] += sig * np.float32(gain * np.sin(th))

    def render(self, duck_regions=(), length=None):
        n = min(self.n, length or self.n)
        gain = None
        if duck_regions:
            g = np.ones(n, np.float32)
            for a, b in duck_regions:
                g[max(0, int(a * SR)):max(0, min(n, int(b * SR)))] = 0.35
            k = 4410
            c = np.concatenate([[0.0], np.cumsum(g, dtype=np.float64)])
            idx = np.arange(n)
            lo, hi = np.clip(idx - k // 2, 0, n), np.clip(idx + k // 2, 0, n)
            gain = ((c[hi] - c[lo]) / np.maximum(hi - lo, 1)).astype(np.float32)
            del c, idx, lo, hi, g
        out = np.zeros((2, n), np.float32)
        for ch in range(2):
            mw = self.bus["music_wet"][ch, :n]
            m = self.bus["music"][ch, :n] + mw + 0.3 * reverb(mw, 23 * ch).astype(np.float32)
            if gain is not None:
                m *= gain
            vw = self.bus["voice_wet"][ch, :n]
            out[ch] = m + vw + 0.22 * reverb(vw, 17 * ch).astype(np.float32) + self.bus["dry"][ch, :n]
            del m
        self.bus = None                      # free the buses
        out = lfilter([1, -1], [1, -0.995], out, axis=1).astype(np.float32)
        out *= np.float32(1.4 / (np.abs(out).max() + 1e-9))
        np.tanh(out, out=out)
        out *= np.float32(0.92 / np.tanh(1.4))
        return out


class Arranger:
    """Plays a song's backing track into the mix."""

    def __init__(self, mix, rng):
        self.mx = mix
        self.rng = rng

    def song(self, t0, bpm, meter, notes, pickup, bar_count, style, transpose):
        """notes: [(midi C-major, start_beat, dur_beats)] relative to the downbeat t0."""
        B = 60.0 / bpm
        bar_beats = 3 if meter == 6 else 4
        chords = infer_chords(notes, bar_beats, pickup)
        mx = self.mx
        lead = LEADS[style["lead"]]
        # melody doubling (soft, the voice carries the tune)
        for m, s, d in notes:
            f = hz(m + transpose + style.get("lead_oct", 0))
            mx.add(lead(f, d * B * 0.95), t0 + s * B, style["lead_gain"], 0.15, "music_wet")
        # chords + bass per bar
        for b in range(0, bar_count):
            ch = chords.get(b, chords.get(b - 1, "C"))
            tb = t0 + b * bar_beats * B
            tones = [60 + p if p >= 4 else 72 + p for p in CHORDS[ch][:3]]
            tones = sorted(t + transpose for t in tones)
            if tones[0] > 64 + transpose:
                tones = [t - 12 for t in tones]
            if meter == 6:
                pattern = [(0, 1.0, 1), (1.5, .8, 1), (2.5, .5, -1)]
            else:
                pattern = style["strum"]
            for bt, vel, direc in pattern:
                if bt >= bar_beats:
                    continue
                notes_c = tones if direc > 0 else tones[::-1]
                for q, m in enumerate(notes_c):
                    if style["rhythm"] == "uke":
                        sig = pluck(m)
                    else:
                        sig = piano_chord_note(m)
                    mx.add(sig, tb + bt * B + q * 0.012, style["chord_gain"] * vel, -0.35, "music_wet")
            root = CHORDS[ch][0] + 36 + transpose
            while root < 36:
                root += 12
            while root > 50:
                root -= 12
            fifth = root + 7
            beats = [(0, root), (1.5, fifth)] if meter == 6 else [(0, root), (2, fifth)]
            for bt, m in beats:
                mx.add(bass(hz(m), B * 1.2), tb + bt * B, 0.42, 0, "drums")
            # drums
            if style["drums"]:
                if meter == 6:
                    hits = [(0, "k"), (1.5, "c"), (0.5, "s"), (1, "s"), (2, "s"), (2.5, "s")]
                else:
                    hits = [(0, "k"), (2, "k"), (1, "c"), (3, "c")] + [(x / 2, "s") for x in range(8)]
                for bt, kind in hits:
                    ts = tb + bt * B
                    if kind == "k":
                        mx.add(kick(), ts, 0.5 * style["drums"], 0, "drums")
                    elif kind == "c":
                        mx.add(clap(int(ts * 100)), ts, 0.26 * style["drums"], 0.05, "music_wet")
                    else:
                        mx.add(shaker(int(ts * 1000)), ts, 0.08 * style["drums"], 0.3, "drums")
        return chords

    def pad_loop(self, t0, dur, transpose=0, bpm=100):
        """Soft background bed for narration segments."""
        B = 60.0 / bpm
        prog = ["C", "Am", "F", "G"]
        bar = 4 * B
        k = 0
        t = t0
        while t < t0 + dur - 0.1:
            ch = prog[k % 4]
            for q, p in enumerate(CHORDS[ch][:3]):
                m = 72 + p + transpose
                for rep in (0, 2):
                    if t + rep * B < t0 + dur:
                        self.mx.add(glock(hz(m)) * 0.5, t + rep * B + q * 0.08, 0.05, 0.3, "music_wet")
            self.mx.add(bass(hz(36 + CHORDS[ch][0] + transpose), bar * 0.9), t, 0.18, 0, "drums")
            t += bar
            k += 1


STYLES = [
    dict(name="bright", lead="flute", lead_gain=0.10, rhythm="uke", chord_gain=0.12, drums=1.0,
         strum=[(0, 1.0, 1), (1, .7, 1), (1.5, .5, -1), (2, .9, 1), (3, .7, 1), (3.5, .5, -1)]),
    dict(name="marimba", lead="marimba", lead_gain=0.14, rhythm="uke", chord_gain=0.11, drums=0.9,
         strum=[(0, 1.0, 1), (2, .8, 1), (2.5, .5, -1), (3.5, .5, -1)]),
    dict(name="piano", lead="epiano", lead_gain=0.10, rhythm="piano", chord_gain=0.10, drums=0.8,
         strum=[(0, 1.0, 1), (1, .6, 1), (2, .9, 1), (3, .6, 1)]),
    dict(name="parade", lead="clarinet", lead_gain=0.09, rhythm="uke", chord_gain=0.12, drums=1.1,
         strum=[(0, 1.0, 1), (1, .8, 1), (2, 1.0, 1), (3, .8, 1)]),
    dict(name="musette", lead="accordion", lead_gain=0.08, rhythm="piano", chord_gain=0.09, drums=0.9,
         strum=[(1, .8, 1), (2, .5, 1), (3, .8, 1)]),
    dict(name="lullaby", lead="glock", lead_gain=0.10, rhythm="piano", chord_gain=0.08, drums=0.0,
         strum=[(0, 1.0, 1), (2, .7, 1)]),
]

"""Voice bank: 30 free, commercially usable voices (15 English, 15 French).

* speech  -> straight TTS (Kokoro ONNX, Apache-2.0 / Piper, CC-BY datasets)
* singing -> each word is synthesised, then re-timed and re-pitched onto the
             melody with Praat's PSOLA (parselmouth). Vowels are stretched,
             consonants are kept short, long notes get a gentle vibrato.
"""
import os
from functools import lru_cache

import numpy as np
import parselmouth
from parselmouth.praat import call
from scipy.signal import resample_poly

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get("BLOOPS_MODELS", os.path.join(HERE, "..", "models"))

# gender drives the singing key: f -> melody centred on E4, m -> one octave lower
VOICES = [
    # ---- English (Kokoro v1.0, Apache-2.0)
    dict(id="en01", lang="en", engine="kokoro", voice="af_heart",    gender="f", label="Heart (US)"),
    dict(id="en02", lang="en", engine="kokoro", voice="af_bella",    gender="f", label="Bella (US)"),
    dict(id="en03", lang="en", engine="kokoro", voice="af_nicole",   gender="f", label="Nicole (US)"),
    dict(id="en04", lang="en", engine="kokoro", voice="af_aoede",    gender="f", label="Aoede (US)"),
    dict(id="en05", lang="en", engine="kokoro", voice="af_kore",     gender="f", label="Kore (US)"),
    dict(id="en06", lang="en", engine="kokoro", voice="af_sarah",    gender="f", label="Sarah (US)"),
    dict(id="en07", lang="en", engine="kokoro", voice="af_nova",     gender="f", label="Nova (US)"),
    dict(id="en08", lang="en", engine="kokoro", voice="af_sky",      gender="f", label="Sky (US)"),
    dict(id="en09", lang="en", engine="kokoro", voice="bf_emma",     gender="f", label="Emma (UK)"),
    dict(id="en10", lang="en", engine="kokoro", voice="bf_isabella", gender="f", label="Isabella (UK)"),
    dict(id="en11", lang="en", engine="kokoro", voice="am_michael",  gender="m", label="Michael (US)"),
    dict(id="en12", lang="en", engine="kokoro", voice="am_fenrir",   gender="m", label="Fenrir (US)"),
    dict(id="en13", lang="en", engine="kokoro", voice="am_puck",     gender="m", label="Puck (US)"),
    dict(id="en14", lang="en", engine="kokoro", voice="bm_george",   gender="m", label="George (UK)"),
    dict(id="en15", lang="en", engine="kokoro", voice="bm_fable",    gender="m", label="Fable (UK)"),
    # ---- French
    # ---- French: Kokoro "siwis" (Apache-2.0) in 13 timbres (formant ratio, pitch shift in semitones)
    #      + 2 Piper voices for narration only (Piper cannot pronounce isolated words, so it never sings)
    dict(id="fr01", lang="fr", engine="kokoro", voice="ff_siwis", gender="f", label="Siwis"),
    dict(id="fr02", lang="fr", engine="piper", model="fr_FR-gilles-low", speaker=None, gender="m", label="Gilles", speech_only=True),
    dict(id="fr03", lang="fr", engine="piper", model="fr_FR-siwis-medium", speaker=None, gender="f", label="Siwis (Piper)", speech_only=True),
] + [
    dict(id=f"fr{i + 4:02d}", lang="fr", engine="kokoro", voice="ff_siwis", gender=g, label=lab, formant=fr, shift=sh)
    for i, (lab, fr, sh, g) in enumerate([
        ("Lila (enfant)", 1.17, 5, "f"), ("Zoé (claire)", 1.09, 2, "f"), ("Nina (douce)", 1.04, -1, "f"),
        ("Rose (pétillante)", 1.12, 3, "f"), ("Jade (chaude)", 0.97, -2, "f"), ("Mila (aiguë)", 1.2, 7, "f"),
        ("Léo (garçon)", 1.1, -3, "f"), ("Tom (jeune)", 0.93, -5, "m"), ("Hugo (grave)", 0.86, -8, "m"),
        ("Paul (chaleureux)", 0.89, -7, "m"), ("Max (rieur)", 0.95, -4, "m"), ("Noé (doux)", 0.9, -6, "m"),
    ])
]

BY_ID = {v["id"]: v for v in VOICES}


def voices_for(lang, singing=False):
    return [v for v in VOICES if v["lang"] == lang and not (singing and v.get("speech_only"))]


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


class VoiceBank:
    def __init__(self, models_dir=MODELS):
        self.dir = models_dir
        self._kokoro = None
        self._piper = {}

    # ------------------------------------------------------------ raw TTS
    def _k(self):
        if self._kokoro is None:
            from kokoro_onnx import Kokoro
            self._kokoro = Kokoro(os.path.join(self.dir, "kokoro-v1.0.onnx"), os.path.join(self.dir, "voices-v1.0.bin"))
        return self._kokoro

    def _p(self, model):
        if model not in self._piper:
            from piper import PiperVoice
            self._piper[model] = PiperVoice.load(os.path.join(self.dir, model + ".onnx"))
        return self._piper[model]

    @lru_cache(maxsize=4096)
    def tts(self, vid, text, speed=1.0):
        """Mono float32 at 44.1 kHz."""
        v = BY_ID[vid]
        if v["engine"] == "kokoro":
            lang = {"af": "en-us", "am": "en-us", "bf": "en-gb", "bm": "en-gb", "ff": "fr-fr"}[v["voice"][:2]]
            a, sr = self._k().create(text, voice=v["voice"], speed=speed, lang=lang)
            a = resample_poly(np.asarray(a, np.float64), 147, 80)          # 24000 -> 44100
        else:
            from piper import SynthesisConfig
            pv = self._p(v["model"])
            cfg = SynthesisConfig(speaker_id=v.get("speaker"), length_scale=1.0 / speed, noise_scale=0.55, noise_w_scale=0.7)
            a = np.concatenate([c.audio_float_array for c in pv.synthesize(text, syn_config=cfg)]).astype(np.float64)
            src = pv.config.sample_rate
            g = np.gcd(SR, src)
            a = resample_poly(a, SR // g, src // g)
        if v.get("formant") or v.get("shift"):
            a = _timbre(a, v.get("formant", 1.0), v.get("shift", 0))
        a = a / (np.abs(a).max() + 1e-9) * 0.9
        return trim(a).astype(np.float32)

    def speak(self, vid, text, speed=0.95):
        return self.tts(vid, text, speed)

    # ------------------------------------------------------------ singing
    @lru_cache(maxsize=8192)
    def sing_word(self, vid, word, notes):
        """notes: tuple of (midi, seconds). Returns (audio, lead) where lead is
        the time from the start of the audio to the vowel onset (place the
        audio `lead` seconds before the beat)."""
        a = self.tts(vid, word, 1.0).astype(np.float64)
        snd = parselmouth.Sound(a, SR)
        dur = snd.get_total_duration()
        pitch = snd.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=500)
        f0 = pitch.selected_array["frequency"]
        times = pitch.xs()
        voiced = times[f0 > 0]
        total = sum(d for _, d in notes)
        if len(voiced) < 2:                       # unvoiced word (rare): just pad it
            return a.astype(np.float32), 0.0
        c0, c1 = max(0.0, voiced[0] - 0.01), min(dur, voiced[-1] + 0.01)
        core = c1 - c0
        coda = dur - c1
        target_core = max(total * 0.93 - coda, 0.05)
        k = float(np.clip(target_core / core, 0.5, 9.0))
        dt = call("Create DurationTier", "d", 0, dur)
        for tt, val in ((0, 1.0), (max(c0 - 0.004, 0), 1.0), (c0 + 0.004, k), (c1 - 0.004, k), (min(c1 + 0.004, dur), 1.0), (dur, 1.0)):
            call(dt, "Add point", tt, val)
        pt = call("Create PitchTier", "p", 0, dur)
        acc = 0.0
        for i, (m, d) in enumerate(notes):
            s0 = c0 + core * acc / total
            s1 = c0 + core * (acc + d) / total
            hz = midi_hz(m)
            glide = min(0.02, (s1 - s0) * 0.2)
            call(pt, "Add point", s0 + (glide if i else 0.0), hz)
            out_len = d                               # seconds in the output
            if out_len > 0.42:                        # vibrato on long notes
                steps = int((s1 - s0) / 0.004)
                for q in range(1, steps):
                    tq = s0 + (s1 - s0) * q / steps
                    t_out = (tq - s0) * k
                    depth = 0.35 * np.clip((t_out - 0.18) / 0.25, 0, 1)
                    call(pt, "Add point", tq, hz * 2 ** (depth * np.sin(2 * np.pi * 5.3 * t_out) / 12))
            call(pt, "Add point", s1 - glide, hz)
            acc += d
        if c0 > 0.01:
            call(pt, "Add point", c0 * 0.5, midi_hz(notes[0][0]))
        manip = call(snd, "To Manipulation", 0.01, 70, 500)
        call([pt, manip], "Replace pitch tier")
        call([dt, manip], "Replace duration tier")
        out = call(manip, "Get resynthesis (overlap-add)")
        y = out.values[0]
        fade = int(0.02 * SR)
        if len(y) > fade:
            y[-fade:] *= np.linspace(1, 0, fade)
        return y.astype(np.float32), float(c0)


def _timbre(a, formant, shift):
    """New voice character: shift formants (vocal tract size) and the speaking pitch."""
    snd = parselmouth.Sound(a, SR)
    f0 = snd.to_pitch(0.01, 70, 500).selected_array["frequency"]
    med = float(np.median(f0[f0 > 0])) if np.any(f0 > 0) else 200.0
    out = call(snd, "Change gender", 70, 500, formant, med * 2 ** (shift / 12), 1.0, 1.0)
    return out.values[0]


def trim(a, thr=0.02, pad=0.01):
    env = np.convolve(np.abs(a), np.ones(256) / 256, mode="same")
    idx = np.where(env > thr * env.max())[0]
    if len(idx) == 0:
        return a
    i0 = max(0, idx[0] - int(pad * SR))
    i1 = min(len(a), idx[-1] + int(pad * SR))
    return a[i0:i1]

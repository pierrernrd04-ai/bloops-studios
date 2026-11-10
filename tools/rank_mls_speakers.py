"""Rank the 125 French MLS Piper speakers by intelligibility (Whisper) and pitch.
usage: python3 tools/rank_mls_speakers.py models/ > voices_fr_rank.json"""
import json, sys, re, numpy as np
from piper import PiperVoice, SynthesisConfig
from faster_whisper import WhisperModel
import parselmouth

md = sys.argv[1]
TEXT = "Bonjour les petits amis ! Aujourd'hui, on va compter les étoiles avec le bus magique."
ref = re.sub(r"[^a-zàâçéèêëîïôûùüÿœ' ]", " ", TEXT.lower()).split()
v = PiperVoice.load(f"{md}/fr_FR-mls-medium.onnx")
sr = v.config.sample_rate
asr = WhisperModel("small", device="cpu", compute_type="int8")

def wer(a, b):
    d = np.zeros((len(a) + 1, len(b) + 1), int); d[:, 0] = range(len(a) + 1); d[0, :] = range(len(b) + 1)
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i, j] = min(d[i-1, j] + 1, d[i, j-1] + 1, d[i-1, j-1] + (a[i-1] != b[j-1]))
    return d[-1, -1] / len(a)

out = []
for spk in range(v.config.num_speakers):
    a = np.concatenate([c.audio_float_array for c in v.synthesize(TEXT, syn_config=SynthesisConfig(speaker_id=spk))])
    a16 = np.interp(np.arange(0, len(a), sr / 16000), np.arange(len(a)), a).astype(np.float32)
    segs, _ = asr.transcribe(a16, language="fr", beam_size=1)
    segs = list(segs)
    hyp = re.sub(r"[^a-zàâçéèêëîïôûùüÿœ' ]", " ", " ".join(s.text for s in segs).lower()).split()
    lp = float(np.mean([s.avg_logprob for s in segs])) if segs else -9
    f0 = parselmouth.Sound(a.astype(np.float64), sr).to_pitch().selected_array["frequency"]
    f0 = float(np.median(f0[f0 > 0])) if np.any(f0 > 0) else 0
    out.append(dict(speaker=spk, wer=round(wer(ref, hyp), 3), logprob=round(lp, 3), f0=round(f0), dur=round(len(a) / sr, 2)))
    print(spk, out[-1], file=sys.stderr)
print(json.dumps(out, indent=1))

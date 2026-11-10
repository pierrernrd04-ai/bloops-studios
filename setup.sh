#!/usr/bin/env bash
# Install everything Bloops Studio needs (Python deps + voice models, ~700 MB).
# Safe to re-run: existing models are kept.
set -euo pipefail
cd "$(dirname "$0")"
pip install -q -r requirements.txt
mkdir -p models
HF=https://huggingface.co/rhasspy/piper-voices/resolve/main
get() { [ -s "models/$2" ] || curl -sSL --retry 4 -o "models/$2" "$1"; }
get https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx kokoro-v1.0.onnx
get https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin voices-v1.0.bin
for p in fr/fr_FR/gilles/low/fr_FR-gilles-low fr/fr_FR/mls/medium/fr_FR-mls-medium; do
  n=$(basename "$p"); get "$HF/$p.onnx" "$n.onnx"; get "$HF/$p.onnx.json" "$n.onnx.json"
done
command -v ffmpeg >/dev/null || (apt-get update -qq && apt-get install -y -qq ffmpeg)
node -e "require('playwright')" 2>/dev/null || npm install --silent playwright
echo "Bloops Studio ready."

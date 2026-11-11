#!/usr/bin/env bash
# Make shorts for every finished episode until the production log says FINISHED.
cd "$(dirname "$0")/.."
while true; do
  python3 tools/shorts.py --all --count 2 >> out/shorts.log 2>&1
  if tail -1 out/production.log | grep -q FINISHED; then
    python3 tools/shorts.py --all --count 2 >> out/shorts.log 2>&1
    echo "SHORTS FINISHED $(date +%H:%M:%S)" >> out/shorts.log
    break
  fi
  sleep 120
done

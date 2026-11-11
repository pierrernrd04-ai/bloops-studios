#!/usr/bin/env python3
"""Produce a list of episodes as fast as the machine allows, and survive restarts.

The audio of the next episode is built while the current one renders. Re-running the
script skips finished episodes and resumes half-rendered ones.

    python3 tools/produce.py --en 1001-1015 --fr 2001-2015
"""
import argparse, os, subprocess, sys, threading, time, json

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "out")
LOG = os.path.join(OUT, "production.log")


def rng(s):
    a, _, b = s.partition("-")
    return list(range(int(a), int(b or a) + 1))


def d_of(job):
    return os.path.join(OUT, f"{job[0]}-{job[1]}")


def done(d):
    return os.path.exists(os.path.join(d, "episode.mp4")) and os.path.exists(os.path.join(d, "thumbnail.jpg"))


def ready(d):
    return all(os.path.exists(os.path.join(d, f)) for f in ("timeline.json", "audio.wav", "metadata.json"))


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)
    open(LOG, "a").write(line + "\n")


def run(job, render):
    lang, seed = job
    cmd = [sys.executable, os.path.join(HERE, "make_episode.py"), "--lang", lang, "--seed", str(seed), "--out", d_of(job)]
    if not render:
        cmd = ["nice", "-n", "5"] + cmd + ["--no-render"]
    with open(os.path.join(OUT, f"{lang}-{seed}.log"), "a") as f:
        return subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT).returncode


def audio_worker(jobs):
    for i, job in enumerate(jobs):
        d = d_of(job)
        if done(d) or ready(d):
            continue
        while sum(1 for j in jobs[:i] if ready(d_of(j)) and not done(d_of(j))) >= 2:
            time.sleep(10)
        t = time.time()
        rc = run(job, render=False)
        log(f"AUDIO {os.path.basename(d)} rc={rc} {time.time() - t:.0f}s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--en", default="")
    ap.add_argument("--fr", default="")
    a = ap.parse_args()
    en, fr = [("en", s) for s in rng(a.en)] if a.en else [], [("fr", s) for s in rng(a.fr)] if a.fr else []
    jobs = [j for pair in zip(en, fr) for j in pair] + en[len(fr):] + fr[len(en):]
    os.makedirs(OUT, exist_ok=True)
    log(f"START {len(jobs)} episodes, {sum(done(d_of(j)) for j in jobs)} already done")
    th = threading.Thread(target=audio_worker, args=(jobs,), daemon=True)
    th.start()
    for job in jobs:
        d = d_of(job)
        if done(d):
            continue
        while not ready(d) and th.is_alive():
            time.sleep(5)
        t = time.time()
        rc = run(job, render=True)
        if rc == 0 and done(d):
            os.remove(os.path.join(d, "audio.wav"))
            m = json.load(open(os.path.join(d, "metadata.json")))
            log(f"DONE {os.path.basename(d)} {m['duration_sec'] / 60:.1f}min {time.time() - t:.0f}s | {m['title']}")
        else:
            log(f"FAIL {os.path.basename(d)} rc={rc}")
    log(f"FINISHED {sum(done(d_of(j)) for j in jobs)}/{len(jobs)}")


if __name__ == "__main__":
    main()

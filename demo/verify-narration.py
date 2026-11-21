#!/usr/bin/env python3
"""Transcribes each cached narration line of a language back to text (speech-to-text) and reports the word error rate
against the script, so a mispronounced word (an acronym, a number) shows up without anyone listening. Not a
substitute for a native listener. Needs OPENROUTER_API_KEY; with OR_LEDGER_DIR set the calls go through the spend ledger.

  python3 -I demo/verify-narration.py es        # or en
"""
import base64, hashlib, json, os, re, sys, unicodedata, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
lang = sys.argv[1] if len(sys.argv) > 1 else "es"
spec = json.loads((HERE / "script.json").read_text())
MODEL = "elevenlabs/eleven-multilingual-v2"
norm = lambda s: re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()).split()

def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        p = d[:]; d[0] = i
        for j in range(1, len(h) + 1):
            d[j] = min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(1, len(r))

def transcribe(mp3):
    body = {"model": "elevenlabs/scribe-v2", "input_audio": {"data": base64.b64encode(mp3.read_bytes()).decode(), "format": "mp3"}, "language": lang}
    if os.environ.get("OR_LEDGER_DIR"):
        sys.path.insert(0, os.environ["OR_LEDGER_DIR"])
        import or_ledger
        return (or_ledger.post("/audio/transcriptions", body, "lintelia-verify", timeout=180, estimate=0.01)[2] or {}).get("text", "")
    req = urllib.request.Request("https://openrouter.ai/api/v1/audio/transcriptions", json.dumps(body).encode(),
                                 {"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"], "content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=180)).get("text", "")

seen, worst = set(), []
for v in spec["videos"]:
    if v["lang"] != lang:
        continue
    for p in v["parts"]:
        for line in ([(p.get("say"), v["voice"])] if p.get("say") else []) + [(l["say"], l.get("voice", v["voice"])) for l in p.get("lines", [])]:
            text, voice = line
            mp3 = HERE / "narration" / (hashlib.sha1(f"{MODEL}|{voice}|{text}".encode()).hexdigest()[:16] + ".mp3")
            if not mp3.exists() or mp3 in seen:
                continue
            seen.add(mp3)
            heard = transcribe(mp3)
            w = wer(text, heard)
            worst.append((w, v["slug"], text, heard))
worst.sort(reverse=True)
print(f"{len(worst)} lines checked, mean WER {sum(w for w, *_ in worst) / max(1, len(worst)):.3f}")
for w, slug, text, heard in worst[:8]:
    print(f"\nWER {w:.2f} [{slug}]\n  script: {text}\n  heard:  {heard}")

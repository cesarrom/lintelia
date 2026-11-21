#!/usr/bin/env python3
"""Compose narrated, captioned demo videos from Playwright demo-mode results (E2E_DEMO=1).

usage: python3 demo/compose.py <results-dir> demo/script.json demo [--only <slug-substring>]

results-dir : folder holding the test folders (each has demo-timeline.json + *.webm)
script.json : see SCRIPT FORMAT below
out-dir     : gets videos/<slug>.mp4 and videos/<slug>.poster.jpg

OPENROUTER_API_KEY must be in the environment when narration has to be generated
(lines are cached by content hash in <out-dir>/narration, so re-renders cost nothing).

SCRIPT FORMAT
{
  "project": "EJV", "voice": "Brian",
  "brand": {"bg1": "#050a30", "bg2": "#101a4f", "accent": "#fe8400", "closing": "EJV"},
  "videos": [
    {
      "slug": "01-pitch-es", "voice": "Sarah", "lang": "es",
      "note": "small standing tag above the footage",
      "parts": [
        {"type": "card", "kicker": "01 · HOY", "title": "...", "subtitle": "...", "say": "narration over the card", "seconds": 3.2},
        {"type": "compare", "title": "...", "left": {"title": "...", "items": ["..."]}, "right": {"title": "...", "items": ["..."]}, "say": "..."},
        {"type": "scene", "key": "<substring of the test folder name>",
         "lines": [{"step": 1, "text": "caption", "say": "spoken form (optional)", "fast": 12}],
         "to": 3}        # last step this scene covers (default: the test's last step)
      ]
    }
  ]
}
A scene stretches or compresses the footage between one line's step and the next so the narration fits;
"fast": N allows up to N-times fast-forward for long waits (the scene is tagged as accelerated).
"""
import hashlib, json, os, shutil, subprocess, sys, time, urllib.request
from pathlib import Path

FONT = "/System/Library/Fonts/Avenir Next.ttc"
W, H = 1920, 1080
FASTWORD = {"es": "Acelerado", "en": "Fast-forward"}


# Pace. Viewers need time to look, then listen, then digest: the screen shows for LEAD seconds before
# the voice starts, each line is followed by BREATH seconds of quiet, speech is slowed a little
# (SPEECH 0.92 = 8 percent, pitch kept), and footage is only sped up where a line asks for it ("fast").
SPEECH, LEAD, BREATH = 0.82, 1.0, 1.8
ZOOM_IN_AT, ZOOM_IN_FOR, ZOOM_OUT_FOR, ZOOM_MAX = 0.8, 0.9, 0.6, 1.7


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        raise SystemExit(f"FAILED: {' '.join(str(c) for c in cmd[:4])}…\n{r.stderr[-1500:]}")
    return r.stdout


def probe(path, entries):
    return run(["ffprobe", "-v", "error", *entries, "-of", "csv=p=0", str(path)]).strip()


def dur(path):
    return float(probe(path, ["-show_entries", "format=duration"]))


def size(path):
    w, h = probe(path, ["-select_streams", "v", "-show_entries", "stream=width,height"]).split(",")[:2]
    return int(w), int(h)


# ---------------------------------------------------------------- narration
def tts(text, voice, cache, model="elevenlabs/eleven-multilingual-v2"):
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / (hashlib.sha1(f"{model}|{voice}|{text}".encode()).hexdigest()[:16] + ".mp3")
    if f.exists():
        return f
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise SystemExit("OPENROUTER_API_KEY not set and narration is not cached")
    if os.environ.get("OR_LEDGER_DIR"):           # optional spend ledger: guards the cap and records the real cost of each call
        sys.path.insert(0, os.environ["OR_LEDGER_DIR"])
        import or_ledger
        for attempt in range(4):
            try:
                raw, _, _ = or_ledger.post("/audio/speech", {"model": model, "input": text, "voice": voice, "response_format": "mp3"}, "lintelia-narration")
                f.write_bytes(raw)
                return f
            except (TimeoutError, OSError):
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/audio/speech",
        data=json.dumps({"model": model, "input": text, "voice": voice, "response_format": "mp3"}).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    for attempt in range(4):                      # the speech endpoint occasionally stalls
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                f.write_bytes(r.read())
            return f
        except (TimeoutError, OSError):
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


# ---------------------------------------------------------------- still frames (ImageMagick)
def finish_still(path):
    """Vignette + fine grain so flat gradients read as designed, not generated."""
    run(["magick", str(path), "-background", "black", "-vignette", "0x180", "-attenuate", "0.10", "+noise", "Gaussian", "-colorspace", "sRGB",
         "-unsharp", "0x0.8", str(path)])


_BASES = {}


def base_images(brand, cache_dir):
    if "card" in _BASES:
        return _BASES
    cache_dir.mkdir(parents=True, exist_ok=True)
    c, st = cache_dir / "card_bg.png", cache_dir / "stage_base.png"
    if not c.exists():
        src = brand.get("backdrop")
        if src and Path(src).exists():
            run(["magick", src, "-resize", f"{W}x{H}^", "-gravity", "center", "-extent", f"{W}x{H}", "-modulate", "62,90", str(c)])
        else:
            run(["magick", "-size", f"{W}x{H}", f"gradient:{brand['bg2']}-{brand['bg1']}", str(c)])
        finish_still(c)
    if not st.exists():
        run(["magick", "-size", f"{W}x{H}", f"gradient:{brand['bg2']}-{brand['bg1']}", "-background", "black", "-vignette", "0x220",
             "-attenuate", "0.08", "+noise", "Gaussian", "-colorspace", "sRGB", str(st)])
    _BASES.update(card=c, stage=st)
    return _BASES


def text_png(text, out, width, pt, fill="white", gravity="center", font=FONT):
    run(["magick", "-size", f"{width}x", "-background", "none", "-fill", fill, "-font", font, "-pointsize", str(pt),
         "-gravity", gravity, f"caption:{text}", str(out)])


def card(brand, title, subtitle, out, kicker=None):
    """Accent bar (or kicker), headline and subtitle stacked as one centred block on the cached backdrop."""
    out = Path(out)
    shutil.copy(_BASES["card"], out)
    parts = []
    if kicker:
        k = out.with_suffix(".kick.png")
        text_png(kicker.upper(), k, 1400, 36, fill=brand["accent"])
        parts.append(k)
    else:
        bar = out.with_suffix(".bar.png")
        run(["magick", "-size", "96x8", "xc:none", "-fill", brand["accent"], "-draw", "roundrectangle 0,0 95,7 4,4", str(bar)])
        parts.append(bar)
    ttl = out.with_suffix(".ttl.png")
    pt = 84 if len(title) <= 34 else (72 if len(title) <= 56 else 60)
    text_png(title, ttl, 1640, pt)
    parts.append(ttl)
    if subtitle:
        sub = out.with_suffix(".sub.png")
        text_png(subtitle, sub, 1400, 38, fill="#d7dde8")
        parts.append(sub)
    block = out.with_suffix(".blk.png")
    cmd = ["magick", "-background", "none", "-gravity", "center"]
    for i, pth in enumerate(parts):
        cmd += [str(pth)]
        if i < len(parts) - 1:
            cmd += ["-size", f"1x{44 if i == 0 else 36}", "xc:none"]
    cmd += ["-append", str(block)]
    run(cmd)
    run(["magick", str(out), str(block), "-gravity", "center", "-geometry", "+0-10", "-composite", str(out)])
    for pth in parts + [block]:
        pth.unlink()


def compare_card(brand, title, left, right, out):
    """Two panels side by side: today (muted) and the proposal (accent outline)."""
    out = Path(out)
    shutil.copy(_BASES["card"], out)
    pw, ph = 800, 680
    panels = []
    for name, side, edge in (("l", left, "#ffffff40"), ("r", right, brand["accent"])):
        p = out.with_suffix(f".{name}.png")
        t = out.with_suffix(f".{name}.t.png")
        i = out.with_suffix(f".{name}.i.png")
        text_png(side["title"].upper(), t, pw - 100, 34, fill=("#c3cad9" if name == "l" else brand["accent"]), gravity="west")
        text_png("\n\n".join("•  " + s for s in side["items"]), i, pw - 100, 29, gravity="west")
        run(["magick", "-size", f"{pw}x{ph}", "xc:none", "-fill", "rgba(8,12,32,0.72)", "-stroke", edge, "-strokewidth", "3",
             "-draw", f"roundrectangle 2,2 {pw-3},{ph-3} 26,26", "-stroke", "none",
             str(t), "-gravity", "northwest", "-geometry", "+50+44", "-composite",
             str(i), "-gravity", "northwest", "-geometry", "+50+120", "-composite", str(p)])
        panels.append(p)
        t.unlink(); i.unlink()
    head = out.with_suffix(".h.png")
    text_png(title, head, 1640, 56)
    run(["magick", str(out), str(head), "-gravity", "north", "-geometry", "+0+90", "-composite",
         str(panels[0]), "-gravity", "west", "-geometry", "+110+70", "-composite",
         str(panels[1]), "-gravity", "east", "-geometry", "+110+70", "-composite", str(out)])
    for p in panels + [head]:
        p.unlink()


def tag_png(text, out, pt=22, fill="#e8ecf6", bg="rgba(8,12,32,0.72)"):
    t = out.with_suffix(".t.png")
    text_png(text, t, 1500, pt, fill=fill)
    run(["magick", str(t), "-trim", "+repage", str(t)])
    tw, th = size(t)
    bw, bh = tw + 28, th + 12
    run(["magick", "-size", f"{bw}x{bh}", "xc:none", "-fill", bg, "-draw", f"roundrectangle 0,0 {bw-1},{bh-1} 10,10",
         str(t), "-gravity", "center", "-composite", str(out)])
    t.unlink()


def side_caption_png(text, out):
    """Large left-aligned caption for the space beside a phone."""
    t = out.with_suffix(".t.png")
    text_png(text, t, 520, 46, gravity="west")
    run(["magick", str(t), "-trim", "+repage", str(t)])
    tw, th = size(t)
    bw, bh = tw + 70, th + 56
    run(["magick", "-size", f"{bw}x{bh}", "xc:none", "-fill", "rgba(8,12,20,0.62)", "-draw", f"roundrectangle 0,0 {bw-1},{bh-1} 26,26",
         "-fill", "#ff8a3d", "-draw", f"roundrectangle 0,14 7,{bh-15} 3,3",
         str(t), "-gravity", "center", "-geometry", "+6+0", "-composite", str(out)])
    t.unlink()


def bezel_png(fw, fh, out):
    """A simple phone body around a frame of fw x fh: dark rim with rounded corners that also clips the footage's corners."""
    bw, bh = fw + 40, fh + 40
    run(["magick", "-size", f"{bw}x{bh}", "xc:none", "-fill", "#0b0d1c", "-draw", f"roundrectangle 0,0 {bw-1},{bh-1} 64,64",
         "(", "-size", f"{bw}x{bh}", "xc:none", "-fill", "white", "-draw", f"roundrectangle 20,20 {bw-21},{bh-21} 44,44", ")",
         "-compose", "DstOut", "-composite", str(out)])


def caption_png(text, out):
    t = out.with_suffix(".t.png")
    text_png(text, t, 1500, 40)
    run(["magick", str(t), "-trim", "+repage", str(t)])
    tw, th = size(t)
    bw, bh = tw + 90, th + 44
    run(["magick", "-size", f"{bw}x{bh}", "xc:none", "-fill", "rgba(8,12,20,0.80)", "-draw", f"roundrectangle 0,0 {bw-1},{bh-1} 24,24",
         str(t), "-gravity", "center", "-composite", str(out)])
    t.unlink()


def stage_bg(fw, fh, fx, fy, out):
    sw, sh = max(8, fw // 4), max(8, fh // 4)
    run(["magick", str(_BASES["stage"]),
         "(", "-size", f"{sw}x{sh}", "xc:black", "-bordercolor", "none", "-border", "12", "-blur", "0x6", "-resize", "400%", "-alpha", "set",
         "-channel", "A", "-evaluate", "multiply", "0.7", "+channel", ")",
         "-geometry", f"+{fx-48}+{fy-48+22}", "-composite", str(out)])


# ---------------------------------------------------------------- footage
def find_dir(results, key):
    hits = [p for p in sorted(results.iterdir()) if p.is_dir() and key in p.name and (p / "demo-timeline.json").exists()]
    if len(hits) != 1:
        raise SystemExit(f"scene key {key!r} matches {len(hits)} test folders: {[h.name for h in hits][:5]}")
    return hits[0]


def load_timeline(d):
    tl = json.loads((d / "demo-timeline.json").read_text())
    vids = {}
    for p in d.rglob("*.webm"):
        vids.setdefault(p.name, p)           # Playwright keeps a copy under attachments/ too
    windows = sorted(tl["windows"], key=lambda w: w["startMs"])
    exact = [vids.get(Path(w["video"]).name) if w.get("video") else None for w in windows]
    if all(exact):                                   # the video path each window recorded when it closed
        wins = [{**w, "path": f} for w, f in zip(windows, exact)]
    else:                                            # fallback: by file creation order (can swap windows)
        files = sorted(vids.values(), key=lambda p: p.stat().st_birthtime)
        if len(files) != len(windows):
            raise SystemExit(f"{d.name}: {len(windows)} windows but {len(files)} videos")
        wins = [{**w, "path": f} for w, f in zip(windows, files)]
    base = min(w["startMs"] for w in wins)
    for w in wins:
        w["off"] = (w["startMs"] - base) / 1000
        w["dur"] = dur(w["path"])
        w["sz"] = size(w["path"])
    starts, ends, actors, focus = {}, {}, {}, {}
    for e in tl["events"]:
        t = (e["at"] - base) / 1000
        if e["kind"] == "step":
            starts[e["no"]] = t
            actors[e["no"]] = e.get("actor", "")
        elif e["kind"] == "focus":                       # the test spotlighted this region (fractions of the window)
            focus.setdefault(e["no"], {"rect": e["rect"], "at": t, "until": None})
        elif e["kind"] == "unfocus":
            if e["no"] in focus and focus[e["no"]]["until"] is None:
                focus[e["no"]]["until"] = t
        else:
            ends[e["no"]] = t
    total = max(w["off"] + w["dur"] for w in wins)
    return wins, starts, ends, total, actors, focus


def pick_windows(wins, starts, actors, steps):
    """For each wanted step: the window of whoever acts in it. A window recast later (a visitor who
    signed up) pairs with the one step actor no window is called; steps with no actor (done behind the
    scenes) keep the previous window; duplicates take the most recently opened one."""
    labels = {w["label"] for w in wins}
    actor_names = {a for a in actors.values() if a}
    spare_windows = [i for i, w in enumerate(wins) if w["label"] not in actor_names]
    spare_actors = sorted(a for a in actor_names if a not in labels)
    alias = {a: spare_windows[k] for k, a in enumerate(spare_actors) if k < len(spare_windows)}
    out, prev = [], 0
    for no in steps:
        a = actors.get(no, "")
        if a in alias:
            j = alias[a]
        elif a:
            cands = [i for i, w in enumerate(wins) if w["label"] == a]
            ready = [i for i in cands if wins[i]["off"] <= starts[no] + 0.5]
            j = (ready or cands or [prev])[-1]
        else:
            j = prev
        out.append(j)
        prev = j
    return out


_BLANK = {}


def blank_map(path):
    """Blank flags at 4 fps for a whole window video (cached): Next compiling a route, a spinner, a page
    between two documents. Sampled on the content area (left sidebar and the bottom strip left out):
    blank when almost nothing in it is darker than the page background."""
    key = str(path)
    if key not in _BLANK:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vf", "fps=4,scale=96:54,format=gray", "-f", "rawvideo", "-"], capture_output=True)
        raw, n = r.stdout, 96 * 54
        def blank(f):
            px = [f[y * 96 + x] for y in range(0, 44) for x in range(20, 96)]
            return sum(1 for v in px if v < 225) / len(px) < 0.025
        _BLANK[key] = [blank(raw[i * n:(i + 1) * n]) for i in range(len(raw) // n)]
    return _BLANK[key]


def blank_runs(path, t0, t1, min_len=0.6):
    """Blank stretches (window-local seconds) inside [t0, t1]."""
    flags = blank_map(path)
    a, b = max(0, int(t0 * 4)), min(len(flags), int(t1 * 4) + 1)
    if t1 - t0 < min_len:
        return []
    runs, start = [], None
    for i in range(a, b + 1):
        bl = flags[i] if i < b else False
        if bl and start is None:
            start = i
        elif not bl and start is not None:
            if (i - start) / 4 >= min_len:
                runs.append((start / 4, i / 4))
            start = None
    return runs


def nearest_ok(path, t, wdur):
    """Window-local time of the closest non-blank frame to t, looking ahead first, then back; None if the window is blank throughout."""
    flags = blank_map(path)
    k = min(int(t * 4), len(flags) - 1)
    for i in range(max(0, k), len(flags)):
        if not flags[i]:
            return i / 4, "fwd"
    for i in range(min(k, len(flags) - 1), -1, -1):
        if not flags[i]:
            return i / 4, "back"
    return None, None


def change_box(path, t0, t1):
    """Where the screen changes between t0 and t1 (window-local seconds): the bounding box, as fractions
    of the frame (x0, y0, x1, y1), of pixels that differ between frames sampled at 4 fps; None when
    little changes. 3rd to 97th percentile, so a stray pixel or a toast does not drag the box."""
    if t1 - t0 < 0.8:
        return None
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, t0):.2f}", "-t", f"{t1 - t0:.2f}", "-i", str(path), "-vf", "fps=4,scale=160:100,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True)
    raw, n = r.stdout, 160 * 100
    fr = [raw[i * n:(i + 1) * n] for i in range(len(raw) // n)]
    xs, ys = [], []
    for a, b in zip(fr, fr[1:]):
        for y in range(4, 94):
            row = y * 160
            for x in range(0, 160):
                if abs(a[row + x] - b[row + x]) > 28:
                    xs.append(x)
                    ys.append(y)
    if len(xs) < 40:
        return None
    xs.sort(); ys.sort()
    q = lambda v, f: v[min(len(v) - 1, int(len(v) * f))]
    return (q(xs, 0.03) / 160, q(ys, 0.03) / 100, (q(xs, 0.97) + 1) / 160, (q(ys, 0.97) + 1) / 100)


def zoom_target(box, pad=0.07):
    """(zoom factor, centre x, centre y) for a box, or None when it is too spread out or too small a gain."""
    x0, y0, x1, y1 = box
    w, h = min(1, x1 - x0 + 2 * pad), min(1, y1 - y0 + 2 * pad)
    z = min(ZOOM_MAX, 1 / max(w, h))
    if z < 1.25:
        return None
    return round(z, 3), round((x0 + x1) / 2, 4), round((y0 + y1) / 2, 4)


def compose_scene(part, results, out_mp4, brand, voice, lang, cache, work, note, actor_names):
    d = find_dir(results, part["key"])
    lines = part["lines"]
    wins, starts, ends, total, actors, focus = load_timeline(d)
    work.mkdir(parents=True, exist_ok=True)
    chosen = pick_windows(wins, starts, actors, [ln["step"] for ln in lines])

    segs = []
    for ln, j in zip(lines, chosen):
        if ln["step"] not in starts:
            raise SystemExit(f"{part['key']}: no step {ln['step']} in timeline (have {sorted(starts)})")
        mp3 = tts(ln.get("say", ln["text"]), ln.get("voice", voice), cache)
        segs.append({"text": ln["text"], "mp3": mp3, "n": dur(mp3) / SPEECH, "a": max(0, starts[ln["step"]] - 0.3), "fast": ln.get("fast", 0), "hold": float(ln.get("hold", 0)), "win": j,
                     "who": actors.get(ln["step"], "")})
    to = part.get("to")
    last_end = ends[to] if to else (max(ends.values()) if ends else total)
    for i, s in enumerate(segs):
        s["b"] = segs[i + 1]["a"] if i + 1 < len(segs) else min(total, last_end + 1.2)
        step_end = ends.get(lines[i]["step"])
        if step_end is not None and i + 1 < len(segs):       # steps the script skips are not shown: stop where this step ends
            s["b"] = max(s["a"] + 1.0, min(s["b"], step_end + 0.6))
        w = wins[s["win"]]
        cur, pieces = s["a"], []
        for r0, r1 in blank_runs(w["path"], s["a"] - w["off"], s["b"] - w["off"]):
            r0, r1 = r0 + w["off"], r1 + w["off"]
            if r0 - cur >= 0.4:
                pieces.append((cur, r0))
            cur = max(cur, r1)
        if s["b"] - cur >= 0.4:
            pieces.append((cur, s["b"]))
        if sum(pb - pa for pa, pb in pieces) < min(2.0, s["n"]):
            # the window is blank for nearly the whole step (a slow page load): use the closest real frame, ahead first
            t_local, wend = s["b"] - w["off"], w["off"] + w["dur"]
            t_ok, way = nearest_ok(w["path"], t_local, w["dur"])
            if t_ok is not None:
                pa = t_ok + w["off"]
                if way == "fwd":
                    nxt = [r0 for r0, r1 in blank_runs(w["path"], t_ok, w["dur"]) if r0 > t_ok + 0.2]
                    pb = min(pa + max(s["n"] + 0.5, 3.0), (nxt[0] + w["off"]) if nxt else wend, wend)
                    pieces = [(pa, pb)] if pb - pa >= 0.5 else [(pa, pa + 0.5)]
                else:                                           # nothing real ahead: hold the last real frame
                    pieces = [(max(w["off"], pa - 0.5), pa)]
        s["pieces"] = pieces or [(s["a"], s["b"])]
        L = max(0.8, sum(pb - pa for pa, pb in s["pieces"]))
        need = s["n"] + LEAD + BREATH + s["hold"]
        lo = 1.0 / s["fast"] if s["fast"] else 0.85
        f = min(2.5, max(lo, need / L))
        s["f"] = f
        s["len"] = max(L * f, need)
        s["pad"] = s["len"] - L * f
        ln_zoom = lines[i].get("zoom", "auto" if part.get("autozoom", True) else False)
        s["zoom"], s["zoom_t"] = None, (ZOOM_IN_AT, s["len"])
        if ln_zoom and s["len"] >= ZOOM_IN_AT + ZOOM_IN_FOR + ZOOM_OUT_FOR + 0.8:
            if isinstance(ln_zoom, list):                       # explicit rect [x, y, w, h] as fractions of the frame
                s["zoom"] = zoom_target((ln_zoom[0], ln_zoom[1], ln_zoom[0] + ln_zoom[2], ln_zoom[1] + ln_zoom[3]), pad=0.02)
            elif lines[i]["step"] in focus:                     # the test said where to look: zoom on exactly that, while it is in focus
                fc = focus[lines[i]["step"]]
                r = fc["rect"]
                s["zoom"] = zoom_target((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]), pad=0.04)
                if s["zoom"]:
                    def out_t(tr, pieces=s["pieces"], f=f):         # source time to time within this segment's output
                        acc = 0.0
                        for pa, pb in pieces:
                            if tr <= pa:
                                return acc
                            if tr <= pb:
                                return acc + (tr - pa) * f
                            acc += (pb - pa) * f
                        return acc
                    t0 = max(0.3, out_t(fc["at"]) - 0.2)
                    t1 = min(s["len"] - 0.2, out_t(fc["until"]) if fc["until"] is not None else s["len"])
                    t1 = max(t1, min(s["len"] - 0.2, t0 + ZOOM_IN_FOR + ZOOM_OUT_FOR + 1.0))
                    if t1 - t0 < ZOOM_IN_FOR + ZOOM_OUT_FOR + 0.4:
                        s["zoom"] = None
                    else:
                        s["zoom_t"] = (round(t0, 2), round(t1, 2))
            else:
                box = None
                for pa, pb in s["pieces"]:
                    box = change_box(w["path"], pa - w["off"], pb - w["off"])
                    if box:
                        break
                s["zoom"] = zoom_target(box) if box else None
        if s["zoom"]:
            print(f"      zoom line {i + 1}: x{s['zoom'][0]} at ({s['zoom'][1]}, {s['zoom'][2]})", flush=True)
    body_len = sum(s["len"] for s in segs)

    # The window's own size (1440x900 desktop by default, a phone in portrait), read from the footage.
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0",
                         str(wins[segs[0]["win"]]["path"])], capture_output=True, text=True).stdout.strip().split(",")
    w0, h0 = (int(pr[0]), int(pr[1])) if len(pr) == 2 and all(x.isdigit() for x in pr) else (1440, 900)
    portrait = h0 > w0
    # Portrait (a phone): as tall as the stage allows, centred, the caption still below it; landscape: as before.
    fit = (940 / h0) if portrait else min(1760 / w0, 830 / h0)
    fw, fh = int(w0 * fit) // 2 * 2, int(h0 * fit) // 2 * 2
    # A phone stands left of centre inside a bezel; the caption is large text beside it (never below, never boxed into 4:3).
    fx, fy = (W - fw) // 2, ((H - fh) // 2 if portrait else 36)
    capx = fx + fw + 120
    bg = work / "bg.png"
    stage_bg(fw, fh, fx, fy, bg)

    t = 0.0
    overlays = []   # (png, x, y, a, b)
    for i, s in enumerate(segs):
        p = work / f"cap{i}.png"
        if portrait:
            side_caption_png(s["text"], p)
            overlays.append((p, f"{capx}", "(H-h)/2+40", t + LEAD - 0.1, t + LEAD + s["n"] + 0.5))
        else:
            caption_png(s["text"], p)
            overlays.append((p, "(W-w)/2", "H-h-26", t + LEAD - 0.1, t + LEAD + s["n"] + 0.5))
        if s["f"] < 0.5:
            b = work / f"fast{i}.png"
            tag_png(f"⏩ {FASTWORD.get(lang, 'Fast-forward')} ×{round(1 / s['f'])}", b, pt=24, fill="#ffd9a8")
            overlays.append((b, f"{fx + fw}-w", f"{fy}+12", t, t + s["len"]))
        if len(wins) > 1:
            who = actor_names.get(wins[s["win"]]["label"] if not s["who"] else s["who"], s["who"] or wins[s["win"]]["label"])
            c = work / f"who{i}.png"
            tag_png(who, c, pt=20, fill="#fff3e0", bg="rgba(254,132,0,0.85)")
            overlays.append((c, f"{capx}" if portrait else f"{fx + fw}-w", "(H-h)/2-110" if portrait else "6", t, t + s["len"]))
        s["start"] = t
        t += s["len"]
    if note:
        p = work / "note.png"
        tag_png(note, p, pt=18, fill="#b9c2d8", bg="rgba(8,12,32,0.0)")
        overlays.append((p, "24" if portrait else f"{fx}", "6", 0, body_len))   # a phone frame is too narrow for the note: top-left of the stage

    if portrait:
        bez = work / "bezel.png"
        bezel_png(fw, fh, bez)
        overlays.append((bez, f"{fx - 20}", f"{fy - 20}", 0, body_len))
    inputs, fg = [], []
    uses = {}
    for s in segs:
        uses[s["win"]] = uses.get(s["win"], 0) + len(s["pieces"])
    for i, w in enumerate(wins):
        inputs += ["-i", str(w["path"])]
        if i not in uses:
            continue                      # an idle window in this scene: its input is simply not used
        pad = f",tpad=start_mode=clone:start_duration={w['off']:.3f}" if w["off"] > 0.05 else ""
        fg.append(f"[{i}:v]setpts=PTS-STARTPTS,scale=-2:{h0}:flags=lanczos,setsar=1,fps=30{pad},tpad=stop_mode=clone:stop_duration=30[w{i}]")
    for j, cnt in uses.items():
        fg.append(f"[w{j}]split={cnt}" + "".join(f"[w{j}_{m}]" for m in range(cnt)))
    counter = {j: 0 for j in uses}
    k = len(segs)
    for i, s in enumerate(segs):
        j = s["win"]
        labels = []
        for m, (pa, pb) in enumerate(s["pieces"]):
            src = f"w{j}_{counter[j]}"
            counter[j] += 1
            fg.append(f"[{src}]trim=start={pa:.3f}:end={pb:.3f},setpts=PTS-STARTPTS[p{i}_{m}]")
            labels.append(f"[p{i}_{m}]")
        pad = f",tpad=stop_mode=clone:stop_duration={s['pad']:.3f}" if s["pad"] > 0.02 else ""
        if s["zoom"]:
            z, cx, cy = s["zoom"]
            sm = lambda x: f"(clip({x},0,1)*clip({x},0,1)*(3-2*clip({x},0,1)))"
            z0, z1 = s["zoom_t"]
            e = f"({sm(f'(t-{z0})/{ZOOM_IN_FOR}')}*{sm(f'({z1:.3f}-t)/{ZOOM_OUT_FOR}')})"
            zt = f"(1+({z}-1)*{e})"
            zoomf = (f"scale=w='trunc({fw}*{zt}/2)*2':h='trunc({fh}*{zt}/2)*2':eval=frame:flags=bicubic,"
                     f"crop={fw}:{fh}:x='min(max({cx}*{fw}*{zt}-{fw}/2,0),{fw}*{zt}-{fw})':y='min(max({cy}*{fh}*{zt}-{fh}/2,0),{fh}*{zt}-{fh})'")
            tail = zoomf
        else:
            tail = f"scale={fw}:{fh}:flags=lanczos"
        fg.append("".join(labels) + f"concat=n={len(labels)}:v=1:a=0,setpts=(PTS-STARTPTS)*{s['f']:.4f}{pad},{tail},setsar=1[s{i}]")
    fg.append("".join(f"[s{i}]" for i in range(k)) + f"concat=n={k}:v=1:a=0[body]")
    n = len(wins)
    inputs += ["-loop", "1", "-framerate", "30", "-t", f"{body_len:.3f}", "-i", str(bg)]
    bgi = n
    fg.append(f"[{bgi}:v][body]overlay={fx}:{fy}:shortest=1[c0]")
    last, ci = "c0", bgi + 1
    for j, (p, x, y, a, b) in enumerate(overlays):
        inputs += ["-loop", "1", "-framerate", "30", "-t", f"{body_len:.3f}", "-i", str(p)]
        fg.append(f"[{last}][{ci}:v]overlay={x}:{y}:enable='between(t,{a:.2f},{b:.2f})'[c{j+1}]")
        last = f"c{j+1}"
        ci += 1
    fg.append(f"[{last}]format=yuv420p,setsar=1[vout]")
    alabels = []
    for i, s in enumerate(segs):
        inputs += ["-i", str(s["mp3"])]
        ms = int((s["start"] + LEAD) * 1000)
        fg.append(f"[{ci}:a]aresample=44100,atempo={SPEECH},adelay={ms}|{ms}[a{i}]")
        alabels.append(f"[a{i}]")
        ci += 1
    fg.append("".join(alabels) + f"amix=inputs={len(alabels)}:normalize=0:dropout_transition=0,apad=whole_dur={body_len:.3f},"
              f"loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
    script = work / "graph.txt"
    script.write_text(";\n".join(fg))
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    run(["ffmpeg", "-y", "-loglevel", "error", "-threads", "4", *inputs, "-filter_complex_script", str(script), "-map", "[vout]", "-map", "[aout]",
         "-t", f"{body_len:.3f}", "-c:v", "libx264", "-preset", "fast", "-crf", "27", "-pix_fmt", "yuv420p", "-r", "30",
         "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "160k", str(out_mp4)])
    print(f"    scene {part['key'][:28]}: {dur(out_mp4):.0f}s in {time.time()-t0:.0f}s", flush=True)


def still_clip(png, mp3, seconds, out_mp4):
    """A still card, with narration when there is some, as a normalised mp4."""
    d_ = max(seconds, (dur(mp3) / SPEECH + 0.8 + 1.4) if mp3 else 0)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-t", f"{d_:.2f}", "-i", str(png)]
    if mp3:
        cmd += ["-i", str(mp3), "-af", f"aresample=44100,atempo={SPEECH},adelay=800|800,apad=whole_dur={d_:.2f},loudnorm=I=-16:TP=-1.5:LRA=11"]
    else:
        cmd += ["-f", "lavfi", "-t", f"{d_:.2f}", "-i", "anullsrc=r=44100:cl=stereo"]
    cmd += ["-vf", f"scale={W}:{H},setsar=1,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st={d_-0.5:.2f}:d=0.5", "-r", "30",
            "-c:v", "libx264", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2", "-t", f"{d_:.2f}", str(out_mp4)]
    run(cmd)


def split_scene(part, results):
    """A scene whose lines alternate between a phone window and a desktop window is cut into runs of one orientation,
    so each run gets its own layout (portrait phone in a centred bezel, or the landscape stage)."""
    lines = part["lines"]
    wins, starts, ends, total, actors, focus = load_timeline(find_dir(results, part["key"]))
    chosen = pick_windows(wins, starts, actors, [ln["step"] for ln in lines])
    orient = [wins[j]["sz"][1] > wins[j]["sz"][0] for j in chosen]
    groups = []
    for ln, o in zip(lines, orient):
        if groups and groups[-1][0] == o:
            groups[-1][1].append(ln)
        else:
            groups.append((o, [ln]))
    out = []
    for gi, (o, ls) in enumerate(groups):
        p = {**part, "lines": ls}
        if gi + 1 < len(groups):
            p["to"] = groups[gi + 1][1][0]["step"] - 1
        out.append(p)
    return out


def build_video(v, results, out, brand, default_voice, cache, work_root, actor_names):
    voice, lang, note = v.get("voice", default_voice), v.get("lang", "en"), v.get("note")
    work = work_root / v["slug"]
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    clips = []
    parts = []
    for part in v["parts"]:
        parts += split_scene(part, results) if part["type"] == "scene" else [part]
    for i, part in enumerate(parts):
        mp4 = work / f"p{i:02d}.mp4"
        kind = part["type"]
        if kind in ("card", "compare"):
            png = work / f"p{i:02d}.png"
            if kind == "card":
                card(brand, part["title"], part.get("subtitle"), png, kicker=part.get("kicker"))
            else:
                compare_card(brand, part["title"], part["left"], part["right"], png)
            mp3 = tts(part["say"], part.get("voice", voice), cache) if part.get("say") else None
            still_clip(png, mp3, part.get("seconds", 4.0), mp4)
        else:
            compose_scene(part, results, mp4, brand, voice, lang, cache, work / f"s{i:02d}", note, actor_names.get(lang, {}))
        clips.append(mp4)
    lst = work / "list.txt"
    lst.write_text("".join(f"file '{c.resolve()}'\n" for c in clips))
    final = out / "videos" / f"{v['slug']}.mp4"
    final.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(final)])
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{min(dur(final) * 0.3, 40):.2f}", "-i", str(final), "-frames:v", "1", str(final.with_suffix(".poster.jpg"))])
    return dur(final)


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    results, spec_path, out = Path(a[0]), Path(a[1]), Path(a[2])
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    spec = json.loads(spec_path.read_text())
    brand, voice = spec["brand"], spec.get("voice", "Brian")
    if brand.get("backdrop") and not Path(brand["backdrop"]).is_absolute():
        brand["backdrop"] = str((spec_path.parent / brand["backdrop"]).resolve())
    base_images(brand, out / ".cache")
    for v in spec["videos"]:
        if only and only not in v["slug"]:
            continue
        t0 = time.time()
        d = build_video(v, results, out, brand, voice, out / "narration", out / ".work", spec.get("actors", {}))
        f = out / "videos" / f"{v['slug']}.mp4"
        print(f"{v['slug']}: {d:.0f}s, {f.stat().st_size / 1e6:.1f} MB, composed in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()

"""Kokoro (local, offline) narration: public/audio/<id>.wav plus <id>.json with word timings.

Words come from src/generated/data.json (built from §4 of the demo script, the single source). Some words are respelled
for the voice only (SPEECH); captions keep the written forms (DISPLAY) with the timing of the words that spoke them.
Usage: python tts/synth.py <speed> [S1 S2 ...]
"""
import json
import os
import re
import sys
import wave

os.environ.setdefault("HF_HUB_OFFLINE", "1")
import numpy as np
from kokoro import KPipeline

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "public", "audio")
SR = 24000
VOICE = "af_heart"

# written word -> spoken form (matched on the word without its trailing punctuation)
SPEECH = {
    "firstbad": "first bad",
    "fc2879c": "F C two eight seven nine C",
    "CLI": "C L I",
    "README": "reed me",  # "read me" is voiced as "red me"
}
# spoken words in the script -> what the caption shows
DISPLAY = [
    (["save", "ten"], "SAVE10"),
    (["twenty", "dollars"], "$20.00"),
    (["eighteen", "dollars"], "$18.00"),
    (["shows", "eighteen"], "shows $18.00"),
    (["be", "eighteen"], "be $18.00"),
    (["Version", "one"], "v1.0"),
]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def split_word(w):
    m = re.match(r"^(.*?)([.,:;!?]*)$", w)
    return m.group(1), m.group(2)


def display_words(words):
    out, i = [], 0
    while i < len(words):
        for pattern, shown in DISPLAY:
            chunk = words[i : i + len(pattern)]
            if [split_word(c["text"])[0] for c in chunk] == pattern:
                punct = split_word(chunk[-1]["text"])[1]
                out.append({"text": shown + punct, "start": chunk[0]["start"], "end": chunk[-1]["end"]})
                i += len(pattern)
                break
        else:
            out.append(words[i])
            i += 1
    return out


def write_wav(path, samples):
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


def main(speed, ids):
    os.makedirs(OUT, exist_ok=True)
    data = json.load(open(os.path.join(HERE, "src", "generated", "data.json"), encoding="utf8"))
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    total = 0.0
    for sc in data["scenes"]:
        if ids and sc["id"] not in ids:
            continue
        spoken, targets = [], []
        for w in sc["narration"].split():
            core, punct = split_word(w)
            said = SPEECH.get(core, core)
            spoken.append(said + punct)
            targets.append((w, norm(said)))
        audio, tokens, offset = [], [], 0.0
        for r in pipe(" ".join(spoken), voice=VOICE, speed=speed, split_pattern=r"\n+"):
            a = r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio)
            for tk in r.tokens or []:
                if tk.start_ts is not None and tk.end_ts is not None and norm(tk.text):
                    tokens.append((norm(tk.text), offset + float(tk.start_ts), offset + float(tk.end_ts)))
            audio.append(a)
            offset += len(a) / SR
        y = np.concatenate(audio)
        duration = len(y) / SR
        words, i, aligned = [], 0, True
        for original, target in targets:
            acc, first, last = "", None, None
            while i < len(tokens) and len(acc) < len(target):
                acc += tokens[i][0]
                first = tokens[i][1] if first is None else first
                last = tokens[i][2]
                i += 1
            if acc != target or first is None:
                aligned = False
                print(f"{sc['id']}: alignment broke at '{original}' (heard '{acc}')")
                break
            words.append({"text": original, "start": first, "end": last})
        if not aligned:
            words = [{"text": o, "start": duration * k / len(targets), "end": duration * (k + 1) / len(targets)} for k, (o, _) in enumerate(targets)]
        write_wav(os.path.join(OUT, f"{sc['id']}.wav"), y)
        json.dump(
            {"id": sc["id"], "duration": duration, "aligned": aligned, "words": display_words(words)},
            open(os.path.join(OUT, f"{sc['id']}.json"), "w", encoding="utf8"),
            indent=1,
        )
        total += duration
        print(f"{sc['id']}: {duration:5.1f}s (planned {sc['seconds']}s) aligned={aligned}")
    print(f"total narration {total:.1f}s")


if __name__ == "__main__":
    main(float(sys.argv[1]), set(sys.argv[2:]))

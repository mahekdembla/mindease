"""
Applies three safety fixes to backend/main.py (a backup main.py.bak_safety is saved first):
  1. Long messages no longer break the emotion/risk models: truncation=True, max_length=128
     (128 is the length the models were trained with)
  2. Curly apostrophes (don’t, typed on phones) are treated like straight ones in evaluate_safety
  3. More explicit self-harm phrases in HARD_STOP_PHRASES

Run from the repo root:   python apply_safety_fixes.py      (or pass the path to main.py)
Safe to run twice. If something is not found it changes nothing and tells you what.
"""
import re, sys, shutil
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("backend/main.py")
raw = path.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")
problems = []

# 1. truncation, set when the pipelines are created (same way eval_heldout.py did it)
pat = re.compile(r'"text-classification",(?! truncation=True)')
n = len(pat.findall(text))
if n:
    text = pat.sub('"text-classification", truncation=True, max_length=128,', text)
    print(f"applied : truncation on {n} text-classification pipeline(s)")
elif '"text-classification", truncation=True' in text:
    print("already : truncation")
else:
    problems.append("text-classification pipelines")

# 2. curly apostrophes
old = "    text_lower = text.lower()\n    hard_hit"
new = "    text_lower = text.lower().replace(\"\\u2019\", \"'\")\n    hard_hit"
if text.count(old) == 1:
    text = text.replace(old, new)
    print("applied : curly apostrophes")
elif new in text:
    print("already : curly apostrophes")
else:
    problems.append("evaluate_safety text_lower line")

# 3. phrase list
PHRASES = '''HARD_STOP_PHRASES = ["suicide", "suicidal", "kill myself", "killing myself", "end my life", "ending my life",
                     "take my own life", "want to die", "wanted to die", "wanna die", "overdose",
                     "self harm", "self-harm", "cutting myself", "cut myself", "hanging myself",
                     "hurt myself", "harm myself", "don't want to be alive", "dont want to be alive",
                     "don't want to live", "dont want to live", "better off dead", "wish i was dead",
                     "wish i were dead", "no reason to live", "end it all"]'''
m = re.search(r"HARD_STOP_PHRASES = \[.*?\]", text, flags=re.S)
if m is None:
    problems.append("HARD_STOP_PHRASES")
elif "better off dead" in m.group(0):
    print("already : phrase list")
else:
    text = text[:m.start()] + PHRASES + text[m.end():]
    print("applied : phrase list")

if problems:
    print("\nNOTHING WAS WRITTEN. Could not find:", ", ".join(problems))
    print("main.py may differ from the version I expected; send it to me or edit those spots by hand.")
    sys.exit(1)

shutil.copy(path, str(path) + ".bak_safety")
path.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))
print("\nmain.py updated; backup saved as", str(path) + ".bak_safety")
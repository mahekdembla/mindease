"""
Sets the safety thresholds chosen on the validation split and updates the three unit tests
whose fake scores sat between the old and new thresholds.
  ZS_DANGER_HIGH        0.60 -> 0.80
  CLF_SUICIDAL_HIGH     0.85 -> 0.70
  ZS_DISTRESS_WITH_CLF  0.70 -> -1.0   (MEDIUM no longer needs the zero-shot model when the classifier is available)
  CLF_DISTRESS_MEDIUM   0.60 -> 0.95

Run from the repo root:   python apply_thresholds.py
Backups: main.py.bak_thresholds and test_safety_merge.py.bak_thresholds. Safe to run twice.
"""
import re, shutil, sys
from pathlib import Path

MAIN = Path("backend/main.py")
TEST = Path("backend/tests/test_safety_merge.py")

def read(p):
    raw = p.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw

def write(p, text, crlf):
    shutil.copy(p, str(p) + ".bak_thresholds")
    p.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))

problems = []

# ---- main.py constants
text, crlf = read(MAIN)
changed = False
for name, val in (("ZS_DANGER_HIGH", "0.80"), ("CLF_SUICIDAL_HIGH", "0.70"),
                  ("ZS_DISTRESS_WITH_CLF", "-1.0"), ("CLF_DISTRESS_MEDIUM", "0.95")):
    pat = re.compile(r"(?m)^(%s\s*=\s*)([-0-9.]+)" % name)
    m = pat.search(text)
    if not m:
        problems.append(name)
    elif m.group(2) == val:
        print(f"already : {name} = {val}")
    else:
        text = pat.sub(lambda mm: mm.group(1) + val, text, count=1)
        print(f"applied : {name} {m.group(2)} -> {val}")
        changed = True
main_text, main_crlf = text, crlf

# ---- unit tests
ttext, tcrlf = read(TEST)
tchanged = False
for old, new, label in (
    ('"everyone would be better off without me", fake_zero_shot(danger=0.7)',
     '"everyone would be better off without me", fake_zero_shot(danger=0.9)', "zero-shot danger test"),
    ('fake_risk(depression=0.8, normal=0.2)', 'fake_risk(depression=0.97, normal=0.03)', "classifier distress test"),
    ('"my friends wouldn\'t care if I disappeared", fake_zero_shot(danger=0.8)',
     '"my friends wouldn\'t care if I disappeared", fake_zero_shot(danger=0.9)', "friend test"),
):
    if ttext.count(old) == 1:
        ttext = ttext.replace(old, new); tchanged = True; print("applied : updated", label)
    elif new in ttext:
        print("already : updated", label)
    else:
        problems.append("test: " + label)

if problems:
    print("\nNOTHING WAS WRITTEN. Could not find:", ", ".join(problems))
    sys.exit(1)
if changed:
    write(MAIN, main_text, main_crlf)
if tchanged:
    write(TEST, ttext, tcrlf)
print("\ndone")
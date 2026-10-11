"""
Checks the safety decision (main.evaluate_safety).

Run from the backend folder:
    python check_safety_samples.py                              # 18 hand-written sentences (fast)
    python check_safety_samples.py --validation 300 --save      # 300 rows per class from the validation split
    python check_safety_samples.py --heldout 300 --save         # 300 rows per class from the held-out split
--save writes safety_signals_<split>.csv (one row per message, with every signal) for threshold analysis.

Use the validation split to choose thresholds and the held-out split to report results.
"""
import os, sys, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.chdir(HERE)                      # model paths in main.py are relative to backend/
sys.path.insert(0, str(HERE))

SAMPLES = [
    # explicit crisis language -> HIGH
    ("HIGH", "I want to kill myself"),
    ("HIGH", "my friend is away and i want to kill myself"),
    ("HIGH", "I don't want to be alive anymore"),
    ("HIGH", "I've been thinking about ending my life"),
    ("HIGH", "everyone would be better off without me"),
    ("HIGH", "I can't see any reason to keep going"),
    # distress without crisis language -> MEDIUM
    ("MEDIUM", "I feel so hopeless lately"),
    ("MEDIUM", "I feel empty and exhausted all the time"),
    ("MEDIUM", "everything feels pointless and I can't take this anymore"),
    # ordinary negative or neutral messages -> LOW
    ("LOW", "yesterday was a really hard day for me"),
    ("LOW", "i got into a fight with my bestfriend"),
    ("LOW", "I'm stressed about my exam tomorrow"),
    ("LOW", "I had a great day today"),
    ("LOW", "hello there"),
    # talk about fiction, other people, or figures of speech -> LOW
    ("LOW", "this song makes me so sad"),
    ("LOW", "that movie about suicide was really well made"),
    ("LOW", "I want to die of embarrassment lol"),
    ("LOW", "my friend's dog passed away and she is sad"),
]

def wilson(k, n, z=1.96):
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return c - h, c + h

def rate(k, n):
    lo, hi = wilson(k, n)
    return f"{k / n:.1%} (95% CI {lo:.1%}-{hi:.1%})"

def fmt_signals(out):
    s = out.get("signals")
    if not s:
        return "(no signal detail: merged safety logic not applied?)"
    return " ".join(f"{k}={v}" for k, v in s.items())

def run_samples(main):
    print(f"{'RESULT':9}{'EXPECTED':9}{'GOT':8}TEXT  |  SIGNALS")
    bad = 0
    for expected, text in SAMPLES:
        out = main.evaluate_safety(text)
        got = out["riskLevel"]
        ok = got == expected
        bad += (not ok)
        print(f"{'ok' if ok else 'MISMATCH':9}{expected:9}{got:8}{text[:58]}  |  {fmt_signals(out)}")
    print(f"\n{len(SAMPLES) - bad}/{len(SAMPLES)} as expected")

def pick_rows(uni, train_texts, val_texts, split, n_per_class):
    """Validation rows = rows used for checkpoint selection; held-out rows = never used."""
    import pandas as pd
    if split == "validation":
        pool = uni[uni.text.isin(val_texts)]
    else:
        pool = uni[~uni.text.isin(train_texts | val_texts)]
    parts = [d.sample(min(len(d), n_per_class), random_state=42) for _, d in pool.groupby("status")]
    return pool, pd.concat(parts)

def summarize(sample):
    import pandas as pd
    counts = pd.crosstab(sample.status, sample.level)
    for lvl in ("HIGH", "MEDIUM", "LOW"):
        if lvl not in counts:
            counts[lvl] = 0
    counts = counts[["HIGH", "MEDIUM", "LOW"]]
    print("\nCounts (rows = dataset label, columns = safety decision):")
    print(counts)
    print("\nPer-class rates:")
    for label in counts.index:
        r = counts.loc[label]
        n = int(r.sum())
        print(f"  {label:11} n={n:4}  HIGH {rate(int(r['HIGH']), n)} | any flag {rate(int(r['HIGH'] + r['MEDIUM']), n)} | LOW {rate(int(r['LOW']), n)}")
    print("\nThe sample is balanced per class: read the per-class rates, not overall accuracy.")
    print("Dataset labels are not clinical diagnoses.")

def run_split(main, split, n_per_class, save):
    import pandas as pd
    from datasets import load_from_disk
    tdir = HERE / "training"
    uni = pd.read_csv(tdir / "data/clean/risk_unified.csv")
    train_texts = set(load_from_disk(str(tdir / "data/tokenized/risk/train"))["text"])
    val_texts = set(load_from_disk(str(tdir / "data/tokenized/risk/validation"))["text"])
    pool, sample = pick_rows(uni, train_texts, val_texts, split, n_per_class)
    print(f"\n{split} rows available: {len(pool)}; testing {len(sample)}")
    rows = []
    for i, (status, text) in enumerate(zip(sample.status, sample.text.astype(str)), 1):
        out = main.evaluate_safety(text)
        sig = out.get("signals", {})
        rows.append({"status": status, "level": out["riskLevel"], "confidence": out["confidence"],
                     "keyword": sig.get("keyword"), "zero_shot_danger": sig.get("zero_shot_danger"),
                     "zero_shot_distress": sig.get("zero_shot_distress"),
                     "classifier_suicidal": sig.get("classifier_suicidal"),
                     "classifier_distress": sig.get("classifier_distress"),
                     "fiction_shortcut": "zero_shot_danger" not in sig,
                     "text": text[:300].replace("\n", " ")})
        if i % 50 == 0:
            print(f"  {i}/{len(sample)}", flush=True)
    df = pd.DataFrame(rows)
    summarize(df)
    if save:
        path = HERE / f"safety_signals_{split}.csv"
        df.to_csv(path, index=False)
        print(f"\nSaved {path.name}")

def arg(flag):
    if flag in sys.argv:
        k = sys.argv.index(flag)
        return int(sys.argv[k + 1]) if len(sys.argv) > k + 1 and sys.argv[k + 1].isdigit() else 150
    return None

if __name__ == "__main__":
    import main                     # imported here so the helpers above can be tested without models
    run_samples(main)
    save = "--save" in sys.argv
    for flag, split in (("--validation", "validation"), ("--heldout", "heldout")):
        n = arg(flag)
        if n:
            run_split(main, split, n, save)
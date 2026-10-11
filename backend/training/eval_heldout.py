import json
import numpy as np
import pandas as pd
from pathlib import Path
from datasets import load_from_disk
from transformers import pipeline
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

here = Path(__file__).resolve().parent
tok = here / "data" / "tokenized"

def make_clf(name):
    d = str(here / "models" / name)
    return pipeline("text-classification", model=d, tokenizer=d,
                    truncation=True, max_length=128, batch_size=32)

def predict(clf, texts, id2=None):
    out = []
    for p in clf(list(texts)):
        lab = p["label"]
        if id2 and lab.startswith("LABEL_"):
            lab = id2[int(lab.split("_")[1])]
        out.append(lab)
    return out

def show(title, y, p, labels):
    print(f"\n=== {title} (n={len(y)}) ===")
    print(classification_report(y, p, labels=labels, digits=2, zero_division=0))
    print("confusion matrix (rows = true, cols = predicted):", labels)
    print(confusion_matrix(y, p, labels=labels))
    acc = accuracy_score(y, p); mf1 = f1_score(y, p, labels=labels, average="macro", zero_division=0)
    y, p = np.array(y), np.array(p)
    rng = np.random.default_rng(0); n = len(y); accs, f1s = [], []
    for _ in range(1000):
        i = rng.integers(0, n, n)
        accs.append(accuracy_score(y[i], p[i]))
        f1s.append(f1_score(y[i], p[i], labels=labels, average="macro", zero_division=0))
    ci = lambda a: f"[{np.percentile(a, 2.5):.3f}, {np.percentile(a, 97.5):.3f}]"
    print(f"accuracy {acc:.3f} 95% CI {ci(accs)} | macro-F1 {mf1:.3f} 95% CI {ci(f1s)}")

# ---------- RISK: rebuild the never-used 10% held-out split ----------
uni = pd.read_csv(here / "data/clean/risk_unified.csv")
seen = set(load_from_disk(str(tok / "risk" / "train"))["text"]) | \
       set(load_from_disk(str(tok / "risk" / "validation"))["text"])
held = uni[~uni.text.isin(seen)].copy()
print("risk held-out rows:", len(held), "(expected 4982)")
print(held.status.value_counts().to_string())

risk_labels = ["Anxiety", "Depression", "Normal", "Suicidal"]
held["pred"] = predict(make_clf("risk-classifier"), held.text.astype(str))
held.to_csv(here / "risk_heldout_predictions.csv", index=False)
show("RISK held-out split (never used for training or checkpoint selection)",
     held.status.tolist(), held.pred.tolist(), risk_labels)

# ---------- EMOTION: confirm Table I reproduces ----------
emo = load_from_disk(str(tok / "emotion" / "test"))
l2i = json.load(open(tok / "emotion_label2id.json"))
id2 = {v: k for k, v in l2i.items()}
y = [id2[i] for i in emo["label"]]
p = predict(make_clf("emotion-classifier"), emo["text"], id2)
show("EMOTION test split", y, p, sorted(l2i, key=l2i.get))
import pandas as pd
from pathlib import Path
from transformers import pipeline
from sklearn.metrics import classification_report, accuracy_score, f1_score

here = Path(__file__).resolve().parent
model_dir = here / "models" / "risk-classifier"

tr = pd.read_csv(here / "data/clean/risk_unified.csv")
te = pd.read_csv(here / "data/clean/risk_test_clean.csv")

norm = lambda s: s.astype(str).str.strip().str.lower()
te["leaked"] = norm(te.text).isin(set(norm(tr.text)))

clf = pipeline("text-classification", model=str(model_dir), tokenizer=str(model_dir),
               truncation=True, max_length=128, batch_size=32)
te["pred"] = [p["label"] for p in clf(te.text.astype(str).tolist())]
te.to_csv(here / "risk_test_predictions.csv", index=False)

def report(name, d):
    print(f"\n=== {name} (n={len(d)}) ===")
    print(d.status.value_counts().to_string())
    print(classification_report(d.status, d.pred, digits=2, zero_division=0))
    print("accuracy", round(accuracy_score(d.status, d.pred), 3),
          "| macro-F1", round(f1_score(d.status, d.pred, average="macro"), 3))

report("ORIGINAL test set", te)
report("LEAKED rows only (also in training data)", te[te.leaked])
report("CLEAN test set (leaked rows removed)", te[~te.leaked])
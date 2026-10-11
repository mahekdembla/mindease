import pandas as pd
n = lambda p: len(pd.read_csv(p))

goemo = n("data/clean/goemotions_clean.csv")
emo   = n("data/clean/emotion_unified.csv")
rtr   = n("data/clean/risk_train_clean.csv")
rte   = n("data/clean/risk_test_clean.csv")
risk  = n("data/clean/risk_unified.csv")

print("Synthetic raw rows:", n("data/raw/mindease_synthetic_dataset.csv"))
print(f"Emotion: GoEmotions {goemo} | unified {emo} | synthetic kept {emo-goemo} ({(emo-goemo)/emo:.1%})")
print(f"Risk: source train {rtr} | unified {risk} | synthetic kept {risk-rtr} ({(risk-rtr)/risk:.1%}) | source test {rte}")

try:
    from datasets import load_from_disk
    for task in ("emotion", "risk"):
        for s in ("train", "validation", "test"):
            print(task, s, len(load_from_disk(f"data/tokenized/{task}/{s}")))
except Exception as e:
    print("tokenized split sizes: skipped ->", e)
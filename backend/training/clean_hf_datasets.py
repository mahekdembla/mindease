from datasets import load_dataset
import pandas as pd
import os

os.makedirs("data/clean", exist_ok=True)

# ---------------- GoEmotions ----------------
print("Streaming GoEmotions...")
go = load_dataset("google-research-datasets/go_emotions", "simplified", split="train", streaming=True)
label_names = go.features["labels"].feature.names
print("GoEmotions label names:", label_names)

EKMAN_MAP = {
    "anger": ["anger", "annoyance", "disapproval", "disgust"],
    "fear": ["fear", "nervousness"],
    "joy": ["amusement", "excitement", "joy", "love", "desire", "optimism",
            "caring", "pride", "admiration", "gratitude", "relief", "approval"],
    "sadness": ["sadness", "disappointment", "embarrassment", "grief", "remorse"],
    "surprise": ["surprise", "realization", "confusion", "curiosity"],
    "neutral": ["neutral"],
}
RAW_TO_TARGET = {raw: target for target, raws in EKMAN_MAP.items() for raw in raws}

rows = []
for row in go:
    if len(row["labels"]) != 1:
        continue
    raw_label = label_names[row["labels"][0]]
    target = RAW_TO_TARGET.get(raw_label)
    if target is None:
        continue
    text = row["text"].strip()
    if len(text) <= 3:
        continue
    rows.append({"text": text, "emotion": target})

goemo_df = pd.DataFrame(rows).drop_duplicates(subset="text")
goemo_df.to_csv("data/clean/goemotions_clean.csv", index=False)
print("GoEmotions clean shape:", goemo_df.shape)
print(goemo_df["emotion"].value_counts())

# ---------------- Mental Health dataset ----------------
def clean_mh(split_name):
    print(f"Streaming Mental Health dataset ({split_name})...")
    ds = load_dataset("ourafla/Mental-Health_Text-Classification_Dataset", split=split_name, streaming=True)
    seen = set()
    rows = []
    for row in ds:
        text = (row["text"] or "").strip()
        status = row["status"]
        if not text or len(text) <= 3 or status is None or text in seen:
            continue
        seen.add(text)
        rows.append({"text": text, "status": status})
    return pd.DataFrame(rows)

mh_train_df = clean_mh("train")
mh_test_df = clean_mh("test")

mh_train_df.to_csv("data/clean/risk_train_clean.csv", index=False)
mh_test_df.to_csv("data/clean/risk_test_clean.csv", index=False)

print("Risk train shape:", mh_train_df.shape)
print(mh_train_df["status"].value_counts())
print("Risk test shape:", mh_test_df.shape)
print(mh_test_df["status"].value_counts())

print("\nDone — clean files are in data/clean/")

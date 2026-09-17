from datasets import Dataset
from transformers import AutoTokenizer
import pandas as pd

MODEL_NAME = "distilbert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def build_dataset(csv_path, label_col, out_dir):
    df = pd.read_csv(csv_path)
    labels = sorted(df[label_col].unique())
    label2id = {l: i for i, l in enumerate(labels)}
    df["label"] = df[label_col].map(label2id)

    ds = Dataset.from_pandas(df[["text", "label"]], preserve_index=False)
    ds = ds.class_encode_column("label")

    split1 = ds.train_test_split(test_size=0.2, seed=42, stratify_by_column="label")
    split2 = split1["test"].train_test_split(test_size=0.5, seed=42, stratify_by_column="label")

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=128, padding="max_length")

    for split_name, split_ds in [("train", split1["train"]), ("validation", split2["train"]), ("test", split2["test"])]:
        tokenized = split_ds.map(tokenize, batched=True)
        tokenized.save_to_disk(f"{out_dir}/{split_name}")
        print(f"{out_dir}/{split_name}: {len(tokenized)} rows")

    return label2id

print("=== Emotion classifier ===")
emotion_label2id = build_dataset("data/clean/emotion_unified.csv", "emotion", "data/tokenized/emotion")
print("label2id:", emotion_label2id)

print()
print("=== Risk classifier ===")
risk_label2id = build_dataset("data/clean/risk_unified.csv", "status", "data/tokenized/risk")
print("label2id:", risk_label2id)

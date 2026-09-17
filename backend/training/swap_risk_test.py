from datasets import Dataset
from transformers import AutoTokenizer
import pandas as pd, json

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

with open("data/tokenized/risk_label2id.json") as f:
    risk_label2id = json.load(f)

df = pd.read_csv("data/clean/risk_test_clean.csv")
df["label"] = df["status"].map(risk_label2id)

ds = Dataset.from_pandas(df[["text", "label"]], preserve_index=False)

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True, max_length=128, padding="max_length")

ds = ds.map(tokenize, batched=True)
ds.save_to_disk("data/tokenized/risk/test")

print("New risk test set saved:", len(ds), "rows")
print(df["status"].value_counts())

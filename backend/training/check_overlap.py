import pandas as pd

tr = pd.read_csv("data/clean/risk_unified.csv")
te = pd.read_csv("data/clean/risk_test_clean.csv")

norm = lambda s: s.astype(str).str.strip().str.lower()
ov = set(norm(tr.text)) & set(norm(te.text))

print(len(ov), "unique texts appear in both train and test")
print(norm(te.text).isin(ov).sum(), "of", len(te), "test rows are affected")
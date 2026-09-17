import pandas as pd

df = pd.read_csv("data/raw/mindease_synthetic_dataset.csv")
df = df.dropna(subset=["text", "emotion_label", "mental_state"])
df["text"] = df["text"].str.strip()
df = df[df["text"].str.len() > 3]
df = df.drop_duplicates(subset="text")

# ---------------- Emotion classifier merge ----------------
SYNTH_EMOTION_MAP = {
    "sadness": "sadness", "anger": "anger", "fear": "fear",
    "love": "joy", "neutral": "neutral", "surprise": "surprise", "joy": "joy"
}
synth_emotion = df.copy()
synth_emotion["emotion"] = synth_emotion["mental_state"].map(SYNTH_EMOTION_MAP)
synth_emotion = synth_emotion.dropna(subset=["emotion"])[["text", "emotion"]]

goemo = pd.read_csv("data/clean/goemotions_clean.csv")

emotion_all = pd.concat([goemo, synth_emotion], ignore_index=True).drop_duplicates(subset="text")
emotion_all.to_csv("data/clean/emotion_unified.csv", index=False)
print("Emotion unified shape:", emotion_all.shape)
print(emotion_all["emotion"].value_counts())

# ---------------- Risk classifier merge ----------------
RISK_MAP = {"crisis": "Suicidal", "anxiety": "Anxiety", "negative": "Depression",
            "neutral": "Normal", "positive": "Normal"}
synth_risk = df.copy()
synth_risk["status"] = synth_risk["emotion_label"].map(RISK_MAP)
synth_risk = synth_risk.dropna(subset=["status"])[["text", "status"]]

risk_train = pd.read_csv("data/clean/risk_train_clean.csv")
risk_all = pd.concat([risk_train, synth_risk], ignore_index=True).drop_duplicates(subset="text")
risk_all.to_csv("data/clean/risk_unified.csv", index=False)
print()
print("Risk unified shape:", risk_all.shape)
print(risk_all["status"].value_counts())

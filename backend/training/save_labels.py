import json

emotion_label2id = {"anger": 0, "fear": 1, "joy": 2, "neutral": 3, "sadness": 4, "surprise": 5}
risk_label2id = {"Anxiety": 0, "Depression": 1, "Normal": 2, "Suicidal": 3}

with open("data/tokenized/emotion_label2id.json", "w") as f:
    json.dump(emotion_label2id, f, indent=2)

with open("data/tokenized/risk_label2id.json", "w") as f:
    json.dump(risk_label2id, f, indent=2)

print("Saved both label mapping files.")

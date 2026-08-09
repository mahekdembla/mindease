from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model="SamLowe/roberta-base-go_emotions",
    top_k=3
)

from datasets import load_dataset

dataset = load_dataset("go_emotions")

test = dataset["test"]

label_map = {
    0: "admiration", 1: "amusement", 2: "anger", 3: "annoyance",
    4: "approval", 5: "caring", 6: "confusion", 7: "curiosity",
    8: "desire", 9: "disappointment", 10: "disapproval",
    11: "disgust", 12: "embarrassment", 13: "excitement",
    14: "fear", 15: "gratitude", 16: "grief", 17: "joy",
    18: "love", 19: "nervousness", 20: "optimism", 21: "pride",
    22: "realization", 23: "relief", 24: "remorse",
    25: "sadness", 26: "surprise", 27: "neutral"
}

correct = 0
total = 100   # test on small sample

for i in range(total):
    text = test[i]["text"]

    true_labels = [label_map[l] for l in test[i]["labels"]]

    pred = classifier(text)[0][0]['label']  # top-1

    if pred in true_labels:
        correct += 1

print("Top-1 Accuracy:", correct / total)

correct = 0
total = 100

for i in range(total):
    text = test[i]["text"]

    true_labels = [label_map[l] for l in test[i]["labels"]]

    preds = classifier(text)[0]  # top-3

    predicted_labels = [p['label'] for p in preds]

    if any(p in true_labels for p in predicted_labels):
        correct += 1

print("Top-3 Accuracy:", correct / total)
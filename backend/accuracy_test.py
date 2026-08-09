from transformers import pipeline
from datasets import load_dataset
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay

print("Loading models...")

# LOAD MODELS
emotion_model = pipeline(
    "text-classification",
    model="SamLowe/roberta-base-go_emotions",
    top_k=3
)

mental_model = pipeline(
    "text-classification",
    model="bhadresh-savani/distilbert-base-uncased-emotion"
)

print("Models loaded!\n")

# LOAD DATASET
dataset = load_dataset("go_emotions", split="test")

label_list = dataset.features["labels"].feature.names

# MAPPING FUNCTION
def map_emotion(label):
    if label in ["joy", "love", "admiration", "gratitude", "amusement"]:
        return "positive"
    elif label in ["sadness", "grief", "remorse", "disappointment"]:
        return "negative"
    elif label in ["anger", "annoyance", "disapproval"]:
        return "anger"
    elif label in ["fear", "nervousness", "confusion"]:
        return "anxiety"
    else:
        return "neutral"

# TEST SIZE
TOTAL = 100

y_true = []
y_pred_top1 = []

top3_correct = 0
mental_correct = 0

print("Running evaluation...\n")

# LOOP
for i in range(TOTAL):

    text = dataset[i]["text"]
    true_labels_idx = dataset[i]["labels"]

    # True labels mapped
    true_labels = [label_list[l] for l in true_labels_idx]
    true_mapped = [map_emotion(t) for t in true_labels]

    # Take first label as ground truth (for metrics)
    true_main = true_mapped[0]

    # EMOTION MODEL
    preds = emotion_model(text)[0]

    # Top-1
    pred_top1 = map_emotion(preds[0]["label"])

    y_true.append(true_main)
    y_pred_top1.append(pred_top1)

    # Top-3
    top3_preds = [map_emotion(p["label"]) for p in preds]

    if any(p in true_mapped for p in top3_preds):
        top3_correct += 1

    # MENTAL MODEL (ROUGH CHECK)
    mental_pred = mental_model(text)[0]["label"].lower()

    if mental_pred in ["sadness", "fear", "anger", "joy"]:
        mental_correct += 1

# METRICS
accuracy = accuracy_score(y_true, y_pred_top1)
precision = precision_score(y_true, y_pred_top1, average='weighted', zero_division=0)
recall = recall_score(y_true, y_pred_top1, average='weighted', zero_division=0)
f1 = f1_score(y_true, y_pred_top1, average='weighted', zero_division=0)

top3_accuracy = top3_correct / TOTAL
mental_score = mental_correct / TOTAL

# PRINT RESULTS
print("===== FINAL RESULTS =====\n")

print(f"Top-1 Accuracy: {accuracy:.2f}")
print(f"Precision: {precision:.2f}")
print(f"Recall: {recall:.2f}")
print(f"F1 Score: {f1:.2f}\n")

print(f"Top-3 Accuracy: {top3_accuracy:.2f}")
print(f"Mental Model Consistency: {mental_score:.2f}")


# CONFUSION MATRIX
labels = list(set(y_true))  # unique classes

cm = confusion_matrix(y_true, y_pred_top1, labels=labels)

disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels)

plt.figure()
disp.plot()

plt.title("Confusion Matrix (Top-1 Emotion Classification)")
plt.show()

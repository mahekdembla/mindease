import json
import numpy as np
import torch
from datasets import load_from_disk
from transformers import (AutoModelForSequenceClassification, AutoTokenizer,
                           TrainingArguments, Trainer, DataCollatorWithPadding)
import evaluate
from sklearn.utils.class_weight import compute_class_weight

# ---- change this one line to switch tasks ----
TASK = "emotion"          # or "risk"
# ------------------------------------------------

MODEL_NAME = "distilbert-base-uncased"
DATA_DIR = f"data/tokenized/{TASK}"
LABEL_MAP_FILE = f"data/tokenized/{TASK}_label2id.json"
OUTPUT_DIR = f"models/{TASK}-classifier"

with open(LABEL_MAP_FILE) as f:
    label2id = json.load(f)
id2label = {v: k for k, v in label2id.items()}
num_labels = len(label2id)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
train_ds = load_from_disk(f"{DATA_DIR}/train")
val_ds = load_from_disk(f"{DATA_DIR}/validation")

# compute class weights from the training set's actual label distribution
train_labels = train_ds["label"]
class_weights = compute_class_weight(class_weight="balanced", classes=np.arange(num_labels), y=train_labels)
class_weights = torch.tensor(class_weights, dtype=torch.float)
print("Class weights:", {id2label[i]: round(w, 3) for i, w in enumerate(class_weights.tolist())})

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, num_labels=num_labels, id2label=id2label, label2id=label2id
)

class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        loss_fct = torch.nn.CrossEntropyLoss(weight=class_weights.to(logits.device))
        loss = loss_fct(logits, labels)
        return (loss, outputs) if return_outputs else loss

accuracy = evaluate.load("accuracy")
f1 = evaluate.load("f1")

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy.compute(predictions=preds, references=labels)["accuracy"],
        "f1_macro": f1.compute(predictions=preds, references=labels, average="macro")["f1"],
    }

args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate=2e-5,
    per_device_train_batch_size=32,
    per_device_eval_batch_size=32,
    num_train_epochs=4,
    weight_decay=0.01,
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
    fp16=True,
    logging_steps=50,
)

trainer = WeightedTrainer(
    model=model, args=args,
    train_dataset=train_ds, eval_dataset=val_ds,
    data_collator=DataCollatorWithPadding(tokenizer),
    compute_metrics=compute_metrics,
)

trainer.train()
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print(f"\nDone. {TASK} model saved to {OUTPUT_DIR}")

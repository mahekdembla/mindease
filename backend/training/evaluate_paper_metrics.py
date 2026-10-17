import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)

# --------------------------------------------------
# MindEase: Research Paper Evaluation
# Evaluates saved risk-classifier predictions.
# Does NOT retrain the model.
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "risk_heldout_predictions.csv"
REPORT_PATH = BASE_DIR / "risk_classifier_evaluation.txt"

LABELS = ["Anxiety", "Depression", "Normal", "Suicidal"]
BOOTSTRAP_SAMPLES = 2000
RANDOM_SEED = 42


def main():
    print("=" * 65)
    print("MINDEASE RISK CLASSIFIER EVALUATION")
    print("=" * 65)

    if not CSV_PATH.exists():
        print(f"ERROR: Prediction CSV not found:\n{CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH)

    required_columns = {"status", "pred"}
    missing = required_columns - set(df.columns)

    if missing:
        print(f"ERROR: Missing required columns: {sorted(missing)}")
        print(f"Available columns: {list(df.columns)}")
        return

    df = df.dropna(subset=["status", "pred"]).copy()

    df["status"] = df["status"].astype(str).str.strip()
    df["pred"] = df["pred"].astype(str).str.strip()

    # Normalize capitalization and whitespace.
    label_lookup = {label.lower(): label for label in LABELS}
    df["status"] = df["status"].str.lower().map(label_lookup)
    df["pred"] = df["pred"].str.lower().map(label_lookup)

    invalid = df["status"].isna() | df["pred"].isna()

    if invalid.any():
        print("ERROR: Unrecognized labels were found.")
        print("Actual labels:", sorted(
            set(df["status"].dropna()) |
            set(df["pred"].dropna())
        ))
        print("Check the CSV's status and pred columns.")
        return

    y_true = df["status"].tolist()
    y_pred = df["pred"].tolist()

    accuracy = accuracy_score(y_true, y_pred)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true,
        y_pred,
        labels=LABELS,
        zero_division=0
    )

    macro_precision, macro_recall, macro_f1, _ = (
        precision_recall_fscore_support(
            y_true,
            y_pred,
            labels=LABELS,
            average="macro",
            zero_division=0
        )
    )

    weighted_precision, weighted_recall, weighted_f1, _ = (
        precision_recall_fscore_support(
            y_true,
            y_pred,
            labels=LABELS,
            average="weighted",
            zero_division=0
        )
    )

    # Bootstrap confidence interval for accuracy and macro-F1.
    rng = np.random.default_rng(RANDOM_SEED)
    y_true_array = np.array(y_true)
    y_pred_array = np.array(y_pred)
    n = len(df)

    bootstrap_accuracy = []
    bootstrap_macro_f1 = []

    for _ in range(BOOTSTRAP_SAMPLES):
        indices = rng.integers(0, n, size=n)

        bootstrap_accuracy.append(
            accuracy_score(
                y_true_array[indices],
                y_pred_array[indices]
            )
        )

        _, _, sample_macro_f1, _ = precision_recall_fscore_support(
            y_true_array[indices],
            y_pred_array[indices],
            labels=LABELS,
            average="macro",
            zero_division=0
        )

        bootstrap_macro_f1.append(sample_macro_f1)

    accuracy_ci = np.percentile(bootstrap_accuracy, [2.5, 97.5])
    macro_f1_ci = np.percentile(bootstrap_macro_f1, [2.5, 97.5])

    report = classification_report(
        y_true,
        y_pred,
        labels=LABELS,
        zero_division=0,
        digits=4
    )

    matrix = confusion_matrix(y_true, y_pred, labels=LABELS)

    results = []
    results.append("=" * 65)
    results.append("MINDEASE RISK CLASSIFIER EVALUATION")
    results.append("=" * 65)
    results.append(f"Prediction CSV: {CSV_PATH.name}")
    results.append(f"Number of evaluated rows: {n}")
    results.append("")
    results.append("OVERALL METRICS")
    results.append(f"Accuracy:          {accuracy:.4f} ({accuracy * 100:.2f}%)")
    results.append(f"Macro precision:   {macro_precision:.4f}")
    results.append(f"Macro recall:      {macro_recall:.4f}")
    results.append(f"Macro F1-score:    {macro_f1:.4f}")
    results.append(f"Weighted precision:{weighted_precision:.4f}")
    results.append(f"Weighted recall:   {weighted_recall:.4f}")
    results.append(f"Weighted F1-score: {weighted_f1:.4f}")
    results.append("")
    results.append("BOOTSTRAP 95% CONFIDENCE INTERVALS")
    results.append(
        f"Accuracy:   [{accuracy_ci[0]:.4f}, {accuracy_ci[1]:.4f}]"
    )
    results.append(
        f"Macro F1:   [{macro_f1_ci[0]:.4f}, {macro_f1_ci[1]:.4f}]"
    )
    results.append("")
    results.append("PER-CLASS CLASSIFICATION REPORT")
    results.append(report)
    results.append("CONFUSION MATRIX")
    results.append(f"Label order: {LABELS}")
    results.append(str(matrix))
    results.append("")
    results.append("TRUE-LABEL COUNTS")
    results.append(str(df["status"].value_counts().to_dict()))
    results.append("")
    results.append(
        "LIMITATION: These metrics evaluate the saved predictions in the CSV. "
        "They do not independently verify the model, dataset quality, "
        "or held-out status of the data."
    )

    output = "\n".join(results)

    print(output)
    REPORT_PATH.write_text(output, encoding="utf-8")

    print("\nReport saved to:")
    print(REPORT_PATH)


if __name__ == "__main__":
    main()
"""
Restores config.json + tokenizer files next to the fine-tuned model.safetensors weights.

main.py only loads a local model when its folder contains config.json; if the folder holds
just model.safetensors (e.g. after a git checkout, since only the weights are tracked) the
app silently falls back to generic Hub models and the risk classifier stops contributing to
the safety decision.

Both checkpoints were trained from distilbert-base-uncased (see train_classifier.py), so the
architecture/tokenizer are rebuilt from that base and the label maps come from
data/tokenized/<task>_label2id.json. The rebuilt tokenizer is checked against ids taken from
the tokenized training data before anything is written.

Run from the backend folder:   python training/repair_model_dirs.py          (add --force to overwrite)
"""
import json
import sys
from pathlib import Path

from huggingface_hub import hf_hub_download
from tokenizers import BertWordPieceTokenizer
from transformers import AutoConfig, PreTrainedTokenizerFast

HERE = Path(__file__).resolve().parent
# Same architecture + uncased vocab as distilbert-base-uncased; the second one is usually already
# in the HF cache because main.py uses it as the risk-model fallback. Tried in order.
BASE_CANDIDATES = ["distilbert-base-uncased", "bhadresh-savani/distilbert-base-uncased-emotion"]


def _try_bases(fn):
    last = None
    for name in BASE_CANDIDATES:
        for offline in (True, False):
            try:
                return fn(name, offline)
            except Exception as e:
                last = e
    raise RuntimeError(f"Could not load DistilBERT base files: {last}")


def build_tokenizer():
    # Built from vocab.txt with the `tokenizers` library: transformers 5 mis-converts a bare
    # vocab.txt into a 5-token vocabulary that maps every word to [UNK].
    vocab = _try_bases(lambda n, off: hf_hub_download(n, "vocab.txt", local_files_only=off))
    wp = BertWordPieceTokenizer(vocab, lowercase=True)
    return PreTrainedTokenizerFast(
        tokenizer_object=wp._tokenizer, model_max_length=512,
        unk_token="[UNK]", sep_token="[SEP]", pad_token="[PAD]", cls_token="[CLS]", mask_token="[MASK]",
    )


# A row from data/tokenized/risk/validation and the input_ids it was trained with.
REFERENCE_TEXT = "quite bored reallyyy :| on the phone to my baby x"
REFERENCE_IDS = [101, 3243, 11471, 2428, 2100, 2100, 1024, 1064, 2006, 1996, 3042, 2000, 2026, 3336, 1060, 102]


def check_tokenizer(tok):
    got = tok(REFERENCE_TEXT)["input_ids"]
    if got != REFERENCE_IDS:
        raise RuntimeError(f"Rebuilt tokenizer does not match the training ids: {got}")


def repair(task, force=False):
    model_dir = HERE / "models" / f"{task}-classifier"
    if not (model_dir / "model.safetensors").exists():
        print(f"[{task}] no model.safetensors in {model_dir}, skipping")
        return
    if (model_dir / "config.json").exists() and not force:
        print(f"[{task}] config.json already present, nothing to do (use --force to rebuild)")
        return

    label2id = json.loads((HERE / "data" / "tokenized" / f"{task}_label2id.json").read_text())
    id2label = {v: k for k, v in label2id.items()}

    tok = build_tokenizer()
    check_tokenizer(tok)

    config = _try_bases(lambda n, off: AutoConfig.from_pretrained(
        n, local_files_only=off, num_labels=len(label2id), id2label=id2label, label2id=label2id))
    config.architectures = ["DistilBertForSequenceClassification"]
    config.problem_type = "single_label_classification"

    for stale in ("tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt"):
        (model_dir / stale).unlink(missing_ok=True)
    config.save_pretrained(model_dir)
    tok.save_pretrained(model_dir)
    print(f"[{task}] restored config + tokenizer ({len(label2id)} labels: {list(label2id)})")


if __name__ == "__main__":
    for t in ("emotion", "risk"):
        repair(t, force="--force" in sys.argv)

"""
STEP 2 + STEP 3 patch for backend/main.py

Run from the repo root (the folder that contains backend/ and frontend/):

    python apply_steps_2_3.py

Requires Step 1 to be applied first (new rag.py that accepts `history`).
Saves backend/main.py.step23.bak first, prints what it changed, safe to re-run.
"""
import re
import shutil
from pathlib import Path

MAIN = Path("backend") / "main.py"
RAG = Path("backend") / "rag.py"


def read(path):
    raw = path.read_bytes()
    return raw.decode("utf-8").replace("\r\n", "\n"), b"\r\n" in raw


def write(path, text, crlf):
    if crlf:
        text = text.replace("\n", "\r\n")
    path.write_bytes(text.encode("utf-8"))


NEW_GENERATE_RESPONSE = '''def generate_response(emotion, mental_state, user_text, history=None):
    llm_reply = generate_llm_response(user_text, emotion, mental_state, history)
    if llm_reply:
        return llm_reply

    # Fallback templates, used only when the LLM is unavailable. They key off `emotion`
    # (the app's 5-class mood label), which is reliable with both the fine-tuned and hub models.
    if emotion == "negative":
        return "I'm sorry things feel heavy right now. What's been weighing on you the most?"
    elif emotion == "anger":
        return "That sounds really frustrating. What happened?"
    elif emotion == "anxiety":
        return "That sounds stressful. What's been on your mind the most?"
    elif emotion == "positive":
        return "That's lovely to hear \U0001F60A What made today feel good?"
    else:
        return "I'm here and listening. What's on your mind?"


'''

NEW_SAFETY_BLOCK = '''# Safety thresholds. Calibrate with backend/check_safety_samples.py
HARD_STOP_PHRASES = ["suicide", "kill myself", "end my life", "want to die", "overdose",
                     "self harm", "cutting myself", "hanging myself"]
DISTRESS_PHRASES = ["hopeless", "can't go on", "overwhelmed", "breakdown", "panicking", "depressed"]
FICTION_CONTEXT_WORDS = ["movie", "character", "book", "song"]

ZS_DANGER_HIGH = 0.60         # zero-shot "immediate danger or self harm" score -> HIGH
CLF_SUICIDAL_HIGH = 0.85      # fine-tuned risk classifier P(Suicidal) -> HIGH
ZS_DISTRESS_WITH_CLF = 0.70   # zero-shot distress needed when the fine-tuned classifier agrees
CLF_DISTRESS_MEDIUM = 0.60    # P(Depression)+P(Anxiety)+P(Suicidal) needed for that agreement
ZS_DISTRESS_ALONE = 0.85      # zero-shot distress needed when the fine-tuned classifier is unavailable


def _risk_classifier_scores(text):
    """Label -> probability from the fine-tuned risk classifier; {} if unavailable
    (including when the app has fallen back to the generic hub model)."""
    try:
        res = get_mental_model()(text, top_k=None)
    except Exception as e:
        print(f"Risk classifier inference error: {e}")
        return {}
    if res and isinstance(res[0], list):
        res = res[0]
    scores = {r["label"]: float(r["score"]) for r in res}
    return scores if "Suicidal" in scores else {}


def _safety(level, confidence, signals):
    return {
        "riskLevel": level,
        "confidence": round(float(confidence), 2),
        "requiresSafetyFlow": level in ("HIGH", "MEDIUM"),
        "signals": signals,
    }


def evaluate_safety(text):
    text_lower = text.lower()
    hard_hit = any(p in text_lower for p in HARD_STOP_PHRASES)
    signals = {"keyword": hard_hit}

    # Talking about a film, book, song or character is not a risk signal by itself,
    # but this shortcut must never hide an explicit self-harm phrase.
    if not hard_hit and any(w in text_lower for w in FICTION_CONTEXT_WORDS):
        return _safety("LOW", 1.0, signals)

    # Signal 1: zero-shot safety classifier
    zs_danger = zs_distress = 0.0
    zs_ok = False
    safety_pipe = get_safety_model()
    if safety_pipe is not None:
        try:
            result = safety_pipe(text, ["safe", "emotional distress", "immediate danger or self harm"])
            scores = dict(zip(result["labels"], result["scores"]))
            zs_danger = scores.get("immediate danger or self harm", 0.0)
            zs_distress = scores.get("emotional distress", 0.0)
            zs_ok = True
        except Exception as e:
            print(f"Safety model inference error: {e}. Using rule-based signals only.")

    # Signal 2: fine-tuned four-class risk classifier
    clf = _risk_classifier_scores(text)
    clf_suicidal = clf.get("Suicidal", 0.0)
    clf_distress = clf.get("Depression", 0.0) + clf.get("Anxiety", 0.0) + clf_suicidal

    signals.update({
        "zero_shot_danger": round(zs_danger, 2),
        "zero_shot_distress": round(zs_distress, 2),
        "classifier_suicidal": round(clf_suicidal, 2),
        "classifier_distress": round(clf_distress, 2),
    })

    # HIGH: any one strong signal is enough (a missed crisis costs far more than a false alarm).
    if hard_hit:
        return _safety("HIGH", 0.95, signals)
    if zs_danger > ZS_DANGER_HIGH:
        return _safety("HIGH", zs_danger, signals)
    if clf_suicidal >= CLF_SUICIDAL_HIGH:
        return _safety("HIGH", clf_suicidal, signals)

    # MEDIUM: the two models must agree, so an ordinary bad day does not trigger it.
    if clf:
        if zs_distress > ZS_DISTRESS_WITH_CLF and clf_distress >= CLF_DISTRESS_MEDIUM:
            return _safety("MEDIUM", min(zs_distress, clf_distress), signals)
    elif zs_ok:
        if zs_distress > ZS_DISTRESS_ALONE:
            return _safety("MEDIUM", zs_distress, signals)

    # No model available at all: fall back to distress phrases.
    if not zs_ok and not clf and any(p in text_lower for p in DISTRESS_PHRASES):
        return _safety("MEDIUM", 0.85, signals)

    return _safety("LOW", 0.9, signals)


'''


def main():
    if not MAIN.exists():
        print(f"!! {MAIN} not found - run this from the repo root.")
        return
    if not RAG.exists() or "history=None" not in RAG.read_text(encoding="utf-8"):
        print("!! backend/rag.py is still the old version. Apply Step 1 first (new rag.py + apply_chat_fixes.py).")
        return

    shutil.copy(MAIN, MAIN.with_name("main.py.step23.bak"))
    text, crlf = read(MAIN)

    # ---- STEP 2: fallback replies keyed to the labels the app really produces ----
    marker = "# SAFETY DETECTION"
    pat = re.compile(r"def generate_response\([^)]*\):\n.*?(?=\n# SAFETY DETECTION)", re.S)
    if "if emotion == \"negative\":" in text:
        print("--  Step 2: already applied (skipped)")
    elif pat.search(text) and marker in text:
        text = pat.sub(lambda m: NEW_GENERATE_RESPONSE.rstrip("\n") + "\n\n", text, count=1)
        print("OK  Step 2: fallback replies now keyed to the app's emotion label")
    else:
        print("!!  Step 2: generate_response not found in the expected shape - skipped")

    # ---- STEP 3: merged safety decision ----
    pat = re.compile(r"def evaluate_safety\(text\):\n.*?(?=# SAVE CHAT \(WITH CONVERSATION ID & TITLE\))", re.S)
    if "CLF_SUICIDAL_HIGH" in text:
        print("--  Step 3: already applied (skipped)")
    elif pat.search(text):
        text = pat.sub(lambda m: NEW_SAFETY_BLOCK, text, count=1)
        print("OK  Step 3: evaluate_safety now merges keywords + zero-shot + fine-tuned risk classifier")
    else:
        print("!!  Step 3: evaluate_safety not found in the expected shape - skipped")

    write(MAIN, text, crlf)
    print("\nBackup saved as backend/main.py.step23.bak. Restart the backend, then run:")
    print("    cd backend && python check_safety_samples.py")


if __name__ == "__main__":
    main()
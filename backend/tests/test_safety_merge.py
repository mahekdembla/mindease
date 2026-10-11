"""
Unit tests for the merged safety decision (Step 3). They need no models, database or network:
the evaluate_safety source is pulled out of main.py with `ast` and run against fake pipelines.

Run from the repo root:   python backend/tests/test_safety_merge.py     (or:  pytest backend/tests)
"""
import ast, re, os, json
from pathlib import Path

MAIN = Path(__file__).resolve().parents[1] / "main.py"
WANTED_ASSIGNS = {"HARD_STOP_PHRASES", "DISTRESS_PHRASES", "FICTION_CONTEXT_WORDS", "ZS_DANGER_HIGH",
                  "CLF_SUICIDAL_HIGH", "ZS_DISTRESS_WITH_CLF", "CLF_DISTRESS_MEDIUM", "ZS_DISTRESS_ALONE"}
WANTED_FUNCS = {"_risk_classifier_scores", "_safety", "evaluate_safety"}

def load_namespace():
    tree = ast.parse(MAIN.read_text(encoding="utf-8"))
    ns = {"re": re, "os": os, "json": json}      # modules the extracted code may use
    for node in tree.body:
        is_const = (isinstance(node, ast.Assign) and
                    all(isinstance(t, ast.Name) and t.id.isupper() for t in node.targets))
        is_func = (isinstance(node, ast.FunctionDef) and
                   (node.name in WANTED_FUNCS or node.name.startswith("_")))
        if is_const or is_func:
            try:
                exec(compile(ast.Module(body=[node], type_ignores=[]), str(MAIN), "exec"), ns)
            except Exception as e:   # constant needing something unavailable here: skip it
                print("skipped:", getattr(node, "name", None) or [t.id for t in node.targets], type(e).__name__)
    return ns


NS = load_namespace()


def fake_zero_shot(danger=0.0, distress=0.0):
    def pipe(text, labels):
        safe = max(0.0, 1 - danger - distress)
        return {"labels": ["safe", "emotional distress", "immediate danger or self harm"],
                "scores": [safe, distress, danger]}
    return pipe


def fake_risk(anxiety=0.0, depression=0.0, normal=1.0, suicidal=0.0):
    rows = [{"label": "Anxiety", "score": anxiety}, {"label": "Depression", "score": depression},
            {"label": "Normal", "score": normal}, {"label": "Suicidal", "score": suicidal}]
    return lambda text, top_k=None: sorted(rows, key=lambda r: -r["score"])


def fake_hub_emotion(sadness=1.0):
    rows = [{"label": "sadness", "score": sadness}, {"label": "joy", "score": 1 - sadness}]
    return lambda text, top_k=None: rows


def run(text, zero_shot=None, risk=None):
    NS["get_safety_model"] = lambda: zero_shot
    NS["get_mental_model"] = (lambda: risk) if risk is not None else (lambda: (_ for _ in ()).throw(RuntimeError("no model")))
    return NS["evaluate_safety"](text)["riskLevel"]


def test_self_harm_phrase_is_high_even_with_friend_and_safe_models():
    assert run("my friend is away and i want to kill myself", fake_zero_shot(), fake_risk()) == "HIGH"

def test_self_harm_phrase_is_high_even_when_models_are_down():
    assert run("I want to end my life", None, None) == "HIGH"

def test_zero_shot_danger_triggers_high():
    assert run("everyone would be better off without me", fake_zero_shot(danger=0.9), fake_risk()) == "HIGH"

def test_fine_tuned_classifier_alone_can_trigger_high():
    assert run("I can't see any reason to keep going", fake_zero_shot(), fake_risk(normal=0.05, suicidal=0.9)) == "HIGH"

def test_ordinary_bad_day_is_not_medium():
    # zero-shot over-fires on negative sentences, but the fine-tuned classifier says Normal
    assert run("yesterday was a hard day", fake_zero_shot(distress=0.95), fake_risk(normal=0.9)) == "LOW"

def test_agreement_gives_medium():
    assert run("I feel empty and exhausted all the time", fake_zero_shot(distress=0.8), fake_risk(depression=0.97, normal=0.03)) == "MEDIUM"

def test_hub_fallback_model_uses_stricter_zero_shot_only_rule():
    hub = fake_hub_emotion()
    assert run("rough week", fake_zero_shot(distress=0.9), hub) == "MEDIUM"
    assert run("rough week", fake_zero_shot(distress=0.8), hub) == "LOW"

def test_no_models_uses_distress_phrases():
    assert run("I feel hopeless lately", None, None) == "MEDIUM"
    assert run("hello there", None, None) == "LOW"

def test_fiction_context_without_self_harm_phrase_is_low():
    assert run("this song makes me so sad", fake_zero_shot(danger=0.9), fake_risk(suicidal=0.9)) == "LOW"

def test_friend_alone_no_longer_skips_the_models():
    assert run("my friends wouldn't care if I disappeared", fake_zero_shot(danger=0.9), fake_risk()) == "HIGH"

def test_signals_are_reported():
    out = NS["evaluate_safety"]("hi")
    assert "signals" in out and "keyword" in out["signals"]


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"PASS  {name}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL  {name}  {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
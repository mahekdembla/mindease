"""
Run from the backend/ folder:   python check_models.py
Loads the SAME models the chatbot uses (local fine-tuned ones if present in
training/models/, otherwise the Hugging Face ones) and prints what they predict,
so you can see whether the emotion model itself needs retraining.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import main

SAMPLES = [
    "yesterday was a really hard day for me",
    "i got into a fight with my bestfriend",
    "i feel so alone and nobody understands me",
    "i'm nervous about my exam tomorrow",
    "my manager yelled at me in front of everyone",
    "i failed my test and i feel terrible",
    "i broke up with my girlfriend last night",
    "i can't stop crying today",
    "i'm so happy, i passed my exam!",
    "had a calm, peaceful evening",
    "i feel hopeless and tired of everything",
    "my friend said something that really hurt me",
]

emo = main.get_emotion_model()
men = main.get_mental_model()

print(f"{'TEXT':45} {'EMOTION top-3 (raw)':38} {'->mapped':9} {'->fixed':9} {'RISK MODEL':18} SAFETY")
print("-" * 140)
wrong = 0
for t in SAMPLES:
    preds = emo(t)[0]
    raw = ", ".join(f"{p['label']}:{p['score']:.2f}" for p in preds)
    mapped = main.map_emotion(preds[0]["label"])
    fixed = main.correct_emotion_with_cues(mapped, t)
    m = men(t)[0]
    safety = main.evaluate_safety(t)["riskLevel"]
    print(f"{t[:44]:45} {raw[:37]:38} {mapped:9} {fixed:9} {m['label']+':'+format(m['score'],'.2f'):18} {safety}")
    if mapped == "positive" and "happy" not in t and "calm" not in t:
        wrong += 1

print(f"\n{wrong} sentence(s) with a clearly negative meaning were labelled 'positive' by the emotion model itself.")
print("If that number is more than ~2, the emotion model is worth retraining (see notes).")
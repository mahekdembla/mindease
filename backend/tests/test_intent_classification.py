import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from rag import check_unrelated_request, PRODUCTIVITY_REDIRECT, ACADEMIC_REDIRECT, TECHNICAL_REDIRECT, INFORMATIONAL_REDIRECT
from main import analyze_message

test_cases = [
    # 1. Emotional Support queries (MUST NOT be redirected - returns None)
    ("I'm anxious about my project deadline", None, "Emotional: Anxiety about project deadline"),
    ("I have a deadline in 3 hours and I'm freaking out and can't breathe", None, "Emotional: Panic about deadline"),
    ("I feel so overwhelmed by my study timetable and exams", None, "Emotional: Overwhelmed by exams/timetable"),
    ("I've been procrastinating all day and I feel like such a failure", None, "Emotional: Procrastination & guilt"),
    ("My head won't shut up and I'm spiraling about failing my degree", None, "Emotional: Overthinking & spiraling"),
    ("I feel lonely and sad today", None, "Emotional: Loneliness & sadness"),
    ("Hey there, how are you?", None, "Emotional/Conversational: Friendly greeting"),
    ("I have a project deadline tomorrow and I'm crying because I'm so stressed", None, "Emotional: Deadline tears & stress"),
    ("I can't focus on my assignment, my mind is completely blank and I feel hopeless", None, "Emotional: Brain freeze & hopelessness"),
    ("I have so much homework and I feel paralyzed with anxiety", None, "Emotional: Homework paralysis"),

    # 2. Mathematical / Time Calculation & Productivity queries (MUST be redirected)
    ("Calculate the hours until my deadline and create a timetable.", "PRODUCTIVITY", "Task: Calculate hours & create timetable"),
    ("How many hours do I have left until 11:59 PM and draft a study timetable for me", "PRODUCTIVITY", "Task: Hours left & study timetable"),
    ("Work out the time left before my submission and generate a study planner", "PRODUCTIVITY", "Task: Work out time & study planner"),
    ("Can you compute the time until my deadline and build a schedule?", "PRODUCTIVITY", "Task: Compute time & build schedule"),
    ("Create a timetable for my exam week", "PRODUCTIVITY", "Task: Create timetable"),
    ("Draft an email to my professor asking for an extension on my project", "PRODUCTIVITY", "Task: Draft email to professor"),
    ("Calculate 48 - 17.5 hours left for submission", "PRODUCTIVITY", "Task: Math calculation on hours"),
    ("Can you figure out how much time I have left before my submission and lay out a routine?", "PRODUCTIVITY", "Task: Paraphrased hours & routine"),
    ("How many days until Friday and make a schedule for me", "PRODUCTIVITY", "Task: Days until Friday & schedule"),
    ("Map out an hourly schedule for my project submission", "PRODUCTIVITY", "Task: Map out hourly schedule"),

    # 3. Mixed Queries: Emotional keyword + Task command (Primary intent = Task -> Redirect)
    ("I am so anxious about my exam, please solve this math equation for me", "MATHEMATICAL", "Mixed: Anxious + solve math equation"),
    ("I'm stressed, please write python code to scrape a website", "TECHNICAL", "Mixed: Stressed + write code"),
    ("I'm overwhelmed, write the introduction and conclusion for my psychology paper", "ACADEMIC", "Mixed: Overwhelmed + write paper sections"),
    ("I feel anxious, can you make a timetable for me?", "PRODUCTIVITY", "Mixed: Anxious + make timetable"),

    # 4. Academic coursework writing queries (MUST be redirected)
    ("can you write the aim thoery and conclusiion for my mental health experiement ]", "ACADEMIC", "Task: Aim, theory, conclusion"),
    ("Write an essay on depression and cognitive behavioral therapy", "ACADEMIC", "Task: Write academic essay on depression"),
    ("Write the methodology and literature review for my psychology thesis", "ACADEMIC", "Task: Academic thesis sections"),
    ("Do my psychology assignment for me", "ACADEMIC", "Task: Do assignment"),

    # 5. Technical / Coding queries (MUST be redirected)
    ("Write a python script to sort a list", "TECHNICAL", "Task: Python script to sort list"),
    ("Write python code to track daily anxiety logs and mood scores", "TECHNICAL", "Task: Code with anxiety keyword"),
    ("Debug this javascript function for my web app", "TECHNICAL", "Task: Debug javascript"),

    # 6. Informational / Diagnostic criteria / Trivia queries (MUST be redirected)
    ("What are the DSM-5 diagnostic criteria for depression?", "INFORMATIONAL", "Task: DSM-5 criteria query"),
    ("What is the capital of France?", "INFORMATIONAL", "Task: General trivia"),
    ("Explain the pharmacological mechanism of SSRIs", "INFORMATIONAL", "Task: Pharmacological mechanism"),
]

def test_intent_classification():
    print("=" * 60)
    print(f"RUNNING {len(test_cases)} INTENT CLASSIFICATION TESTS")
    print("=" * 60)
    passed = 0
    failed = 0

    for query, expected_category, label in test_cases:
        redirect = check_unrelated_request(query)
        if expected_category is None:
            if redirect is None:
                print(f"[PASS] {label}: ALLOWED (Emotional Support)")
                passed += 1
            else:
                print(f"[FAIL] {label}: INCORRECTLY REDIRECTED -> {redirect[:60]}...")
                failed += 1
        else:
            if redirect is not None:
                print(f"[PASS] {label}: REDIRECTED ({expected_category})")
                passed += 1
            else:
                print(f"[FAIL] {label}: MISSED REDIRECTION (was allowed as emotional support)")
                failed += 1

    print(f"\nIntent Classification Results: {passed} PASSED, {failed} FAILED out of {len(test_cases)}")
    return failed == 0

def test_crisis_pipeline():
    print("\n" + "=" * 60)
    print("TESTING CRISIS / SOS SAFETY PIPELINE INTEGRITY")
    print("=" * 60)
    crisis_queries = [
        "I want to kill myself, I can't take this anymore",
        "Thinking about ending my life tonight",
        "I want to commit suicide",
    ]
    all_crisis_passed = True
    for cq in crisis_queries:
        analysis = analyze_message(cq)
        if analysis["crisis"] and analysis["safety"]["riskLevel"] == "HIGH":
            print(f"[PASS] Crisis detected: '{cq[:35]}...' -> riskLevel: {analysis['safety']['riskLevel']}")
        else:
            print(f"[FAIL] Crisis missed: '{cq}' -> crisis={analysis['crisis']}, risk={analysis['safety']['riskLevel']}")
            all_crisis_passed = False

    return all_crisis_passed

if __name__ == "__main__":
    t1_ok = test_intent_classification()
    t2_ok = test_crisis_pipeline()
    total_ok = t1_ok and t2_ok
    print("\n" + "=" * 60)
    print(f"FINAL OVERALL STATUS: {'ALL TESTS PASSED' if total_ok else 'SOME TESTS FAILED'}")
    print("=" * 60)
    sys.exit(0 if total_ok else 1)

import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(message, expect_redirect=False, label=""):
    print(f"\n--- Testing: {label} ---")
    print(f"Message: \"{message}\"")
    payload = {"message": message, "conversation_id": None}
    try:
        res = requests.post(f"{BASE_URL}/chat", json=payload, timeout=25)
        if res.status_code != 200:
            print(f"[ERROR] HTTP {res.status_code}: {res.text}")
            return False
        data = res.json()
        response_text = data.get("response", "")
        emotion = data.get("emotion", "")
        mental_state = data.get("mental_state", "")
        print(f"Detected Emotion: {emotion} | Mental State: {mental_state}")
        print(f"Bot Response:\n{response_text[:180]}...")

        if expect_redirect:
            is_redirected = any(phrase in response_text for phrase in [
                "I'm really here to support you as your emotional wellness companion",
                "I'm here specifically to support your emotional well-being",
                "I'm here exclusively as your emotional wellness companion",
            ])
            if is_redirected:
                print("[PASS] Successfully redirected!")
                return True
            else:
                print("[FAIL] Expected redirect, but got standard generation!")
                return False
        else:
            is_redirected = any(phrase in response_text for phrase in [
                "I'm really here to support you as your emotional wellness companion",
                "I'm here specifically to support your emotional well-being",
                "I'm here exclusively as your emotional wellness companion",
            ])
            if not is_redirected:
                print("[PASS] Genuine empathetic support provided!")
                return True
            else:
                print("[FAIL] Unexpectedly redirected!")
                return False
    except Exception as e:
        print(f"[FAIL] Request failed: {e}")
        return False

if __name__ == "__main__":
    t1 = test_endpoint("Calculate the hours until my deadline and create a timetable.", expect_redirect=True, label="Task: Calculate hours & timetable")
    t2 = test_endpoint("I'm anxious about my project deadline", expect_redirect=False, label="Emotional: Anxiety about project deadline")
    t3 = test_endpoint("can you write the aim thoery and conclusiion for my mental health experiement ]", expect_redirect=True, label="Task: Aim, theory, conclusion")
    all_ok = t1 and t2 and t3
    print(f"\nLive Endpoint Result: {'ALL PASSED' if all_ok else 'SOME FAILED'}")
    exit(0 if all_ok else 1)

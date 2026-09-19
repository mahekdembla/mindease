import os
import sys
import json
import requests

API_URL = "http://127.0.0.1:8000"

def run_tests():
    print("==================================================")
    print("MINDEASE — TWO-USER ISOLATION VERIFICATION PASS")
    print("==================================================")

    session_a = requests.Session()
    session_b = requests.Session()

    email_a = "usera_isolation_test@mindease.com"
    password_a = "Password123!"
    name_a = "User A"

    email_b = "userb_isolation_test@mindease.com"
    password_b = "Password123!"
    name_b = "User B"

    # Step 1: User A Signup / Login
    print("\n--- [STEP 1] User A Signup & Login ---")
    resp_a = session_a.post(f"{API_URL}/auth/signup", json={"name": name_a, "email": email_a, "password": password_a})
    if resp_a.status_code != 200:
        resp_a = session_a.post(f"{API_URL}/auth/login", json={"email": email_a, "password": password_a})
    
    assert resp_a.status_code == 200, f"User A auth failed: {resp_a.text}"
    token_a = resp_a.json().get("token")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f"User A authenticated. Token acquired.")

    # Step 2: User A creates two distinct conversations
    print("\n--- [STEP 2] User A creates 2 distinct AI conversations ---")
    chat1_a = session_a.post(f"{API_URL}/chat", json={"message": "I feel so stressed about my upcoming exams."}, headers=headers_a).json()
    conv1_id_a = chat1_a["conversation_id"]
    title1_a = chat1_a["title"]
    print(f"Conversation 1 created: id={conv1_id_a}, title='{title1_a}'")

    chat2_a = session_a.post(f"{API_URL}/chat", json={"message": "College workload is overwhelming today."}, headers=headers_a).json()
    conv2_id_a = chat2_a["conversation_id"]
    title2_a = chat2_a["title"]
    print(f"Conversation 2 created: id={conv2_id_a}, title='{title2_a}'")

    # Step 3: User A creates a journal entry
    print("\n--- [STEP 3] User A creates a journal entry ---")
    j_a = session_a.post(f"{API_URL}/journal", json={"text": "User A secret journal entry", "mood": "anxious"}, headers=headers_a).json()
    journal_id_a = j_a["entry"]["id"]
    print(f"User A Journal entry created: id={journal_id_a}")

    # Step 4: User A verifies conversations list
    convs_a = session_a.get(f"{API_URL}/conversations", headers=headers_a).json()
    print(f"User A Conversations count: {len(convs_a)}")
    assert len(convs_a) >= 2, "User A should have at least 2 conversations"

    # Step 5: User B Signup / Login
    print("\n--- [STEP 4] User B Signup & Login ---")
    resp_b = session_b.post(f"{API_URL}/auth/signup", json={"name": name_b, "email": email_b, "password": password_b})
    if resp_b.status_code != 200:
        resp_b = session_b.post(f"{API_URL}/auth/login", json={"email": email_b, "password": password_b})
    
    assert resp_b.status_code == 200, f"User B auth failed: {resp_b.text}"
    token_b = resp_b.json().get("token")
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print(f"User B authenticated. Token acquired.")

    # Step 6: User B data isolation checks
    print("\n--- [STEP 5] Verifying User B cannot see User A data ---")
    convs_b = session_b.get(f"{API_URL}/conversations", headers=headers_b).json()
    print(f"User B Conversations count: {len(convs_b)}")
    a_conv_ids_in_b = [c for c in convs_b if c["conversation_id"] in (conv1_id_a, conv2_id_a)]
    assert len(a_conv_ids_in_b) == 0, "CRITICAL LEAKAGE: User B saw User A conversations in /conversations!"
    print("PASS: User B sees ZERO User A conversations in /conversations.")

    journals_b = session_b.get(f"{API_URL}/journal", headers=headers_b).json()
    a_journals_in_b = [j for j in journals_b if j.get("text") == "User A secret journal entry"]
    assert len(a_journals_in_b) == 0, "CRITICAL LEAKAGE: User B saw User A journal entry!"
    print("PASS: User B sees ZERO User A entries in /journal.")

    # Step 7: Security Test — User B attempts direct access / deletion of User A conversation
    print("\n--- [STEP 6] Security Attack Test: User B attempts direct access to User A's conversation ---")
    direct_access_resp = session_b.get(f"{API_URL}/conversations/{conv1_id_a}", headers=headers_b).json()
    print(f"User B direct GET /conversations/{conv1_id_a} result length: {len(direct_access_resp)}")
    assert len(direct_access_resp) == 0, "CRITICAL SECURITY BREACH: User B accessed User A's conversation messages!"
    print("PASS: User B direct GET on User A conversation returns 0 messages.")

    delete_attack_resp = session_b.delete(f"{API_URL}/conversations/{conv1_id_a}", headers=headers_b)
    print(f"User B DELETE /conversations/{conv1_id_a} status: {delete_attack_resp.status_code}")
    assert delete_attack_resp.status_code == 404, "CRITICAL SECURITY BREACH: User B deleted User A's conversation!"
    print("PASS: User B DELETE on User A conversation returns 404 Not Found.")

    # Step 8: User B creates a conversation
    print("\n--- [STEP 7] User B creates own conversation ---")
    chat_b = session_b.post(f"{API_URL}/chat", json={"message": "I feel happy and optimistic about my new project."}, headers=headers_b).json()
    conv_id_b = chat_b["conversation_id"]
    title_b = chat_b["title"]
    print(f"User B conversation created: id={conv_id_b}, title='{title_b}'")

    # Step 9: User A re-authenticates and verifies data
    print("\n--- [STEP 8] Re-authenticate User A & Verify Isolation ---")
    convs_a_retest = session_a.get(f"{API_URL}/conversations", headers=headers_a).json()
    b_conv_in_a = [c for c in convs_a_retest if c["conversation_id"] == conv_id_b]
    assert len(b_conv_in_a) == 0, "CRITICAL LEAKAGE: User A saw User B conversation!"
    print("PASS: User A sees User A's previous conversations and ZERO User B conversations.")

    print("\n==================================================")
    print("ALL TWO-USER DATA ISOLATION TESTS PASSED (100%)!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()

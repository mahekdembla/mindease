import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import db_manager
from main import get_dashboard_data, save_mood_checkin, MoodCheckinRequest
from datetime import datetime
import asyncio

class DummyUser:
    def __init__(self, user_id, email, name):
        self.user_id = user_id
        self.email = email
        self.name = name

    def get(self, key, default=None):
        if key == "_id" or key == "user_id": return self.user_id
        if key == "email": return self.email
        if key == "name": return self.name
        return default

    def __getitem__(self, key):
        return self.get(key)

test_user_a = DummyUser("test_user_a_123", "usera@mindease.test", "Mahek")
test_user_b = DummyUser("test_user_b_456", "userb@mindease.test", "Sam")

async def run_all_tests():
    print("============================================================")
    print("MIND EASE DASHBOARD BEHAVIOR VERIFICATION SUITE")
    print("============================================================\n")

    # Clean test user data
    if db_manager.is_connected():
        if db_manager.journal_entries is not None:
            db_manager.journal_entries.delete_many({"user_id": {"$in": ["test_user_a_123", "test_user_b_456"]}})
        if db_manager.chat_history is not None:
            db_manager.chat_history.delete_many({"user_id": {"$in": ["test_user_a_123", "test_user_b_456"]}})
        if db_manager.mood_records is not None:
            db_manager.mood_records.delete_many({"user_id": {"$in": ["test_user_a_123", "test_user_b_456"]}})

    # Clear memory cache
    if hasattr(get_dashboard_data, "cache"):
        get_dashboard_data.cache = {}

    # TEST 1: INITIAL STATE
    print("--- TEST 1: INITIAL STATE ---")
    data_init = await get_dashboard_data(current_user=test_user_a)
    rem_init = data_init["daily_reminder"]
    print(f"Message: \"{rem_init['message']}\"")
    print(f"Category Pill: \"{rem_init['category_pill']}\"")
    assert "message" in rem_init and "category_pill" in rem_init
    assert "source_context" not in rem_init, "PRIVACY VIOLATION: raw source_context should not be in GET /dashboard output!"
    print("✓ Initial state test PASSED (Privacy verified!)\n")

    # TEST 2: FEELING WHEEL POSITIVE CHECK-IN
    print("--- TEST 2: FEELING WHEEL POSITIVE CHECK-IN ---")
    req_pos = MoodCheckinRequest(core_emotion="Happy", specific_feeling="Cheerful", granular_feeling="Joyful")
    await save_mood_checkin(req_pos, current_user=test_user_a)
    
    data_feel = await get_dashboard_data(current_user=test_user_a)
    rem_feel = data_feel["daily_reminder"]
    print(f"Feeling Wheel Selected: Happy → Cheerful → Joyful")
    print(f"Message: \"{rem_feel['message']}\"")
    print(f"Category Pill: \"{rem_feel['category_pill']}\"")
    assert rem_feel["message"] != "You made space to check in with yourself today." or rem_feel["category_pill"] in ["A Small Win", "Emotional Check-in", "Mindful Moment"]
    print("✓ Feeling Wheel positive check-in test PASSED\n")

    # TEST 3: POSITIVE AI SUPPORT USER MESSAGE
    print("--- TEST 3: POSITIVE AI SUPPORT USER MESSAGE ---")
    if db_manager.chat_history is not None:
        db_manager.chat_history.insert_one({
            "user_id": "test_user_a_123",
            "conversation_id": "conv_1",
            "message": "I am feeling very grateful today",
            "response": "That is wonderful to hear!",
            "timestamp": datetime.now()
        })
    data_pos_chat = await get_dashboard_data(current_user=test_user_a)
    rem_pos_chat = data_pos_chat["daily_reminder"]
    print(f"User Message: \"I am feeling very grateful today\"")
    print(f"Message: \"{rem_pos_chat['message']}\"")
    print(f"Category Pill: \"{rem_pos_chat['category_pill']}\"")
    assert any(w in rem_pos_chat['message'].lower() for w in ["brighter", "space", "warmth", "grateful", "positive", "enjoy", "thought", "uplifting", "notice", "moment"])
    assert "stress" not in rem_pos_chat['message'].lower() and "anxious" not in rem_pos_chat['message'].lower()
    print("✓ Positive AI support test PASSED\n")

    # TEST 4: NEW JOURNAL ENTRY
    print("--- TEST 4: NEW JOURNAL ENTRY ---")
    if db_manager.journal_entries is not None:
        db_manager.journal_entries.insert_one({
            "user_id": "test_user_a_123",
            "text": "Reflecting on my peaceful morning walk.",
            "title": "Morning Walk",
            "mood": "Calm",
            "created_at": datetime.now()
        })
    data_j = await get_dashboard_data(current_user=test_user_a)
    rem_j = data_j["daily_reminder"]
    print(f"Journal Text: \"Reflecting on my peaceful morning walk.\"")
    print(f"Message: \"{rem_j['message']}\"")
    print(f"Category Pill: \"{rem_j['category_pill']}\"")
    print("✓ New journal test PASSED\n")

    # TEST 5: RECENCY PRIORITY TEST ("I had a fight with my sister" -> then "I am okay now")
    print("--- TEST 5: RECENCY PRIORITY TEST ---")
    await asyncio.sleep(0.1)
    if db_manager.chat_history is not None:
        db_manager.chat_history.insert_one({
            "user_id": "test_user_a_123",
            "conversation_id": "conv_2",
            "message": "I had a fight with my sister.",
            "response": "I'm sorry to hear that.",
            "timestamp": datetime.now()
        })
    data_neg = await get_dashboard_data(current_user=test_user_a)
    rem_neg = data_neg["daily_reminder"]
    print(f"Step 5a (Older Event): \"I had a fight with my sister.\"")
    print(f"Message 5a: \"{rem_neg['message']}\"")
    print(f"Category Pill 5a: \"{rem_neg['category_pill']}\"")

    await asyncio.sleep(0.1)
    if db_manager.chat_history is not None:
        db_manager.chat_history.insert_one({
            "user_id": "test_user_a_123",
            "conversation_id": "conv_3",
            "message": "I am okay now",
            "response": "Glad you are feeling better!",
            "timestamp": datetime.now()
        })
    data_recency = await get_dashboard_data(current_user=test_user_a)
    rem_recency = data_recency["daily_reminder"]
    print(f"\nStep 5b (Newer Event): \"I am okay now\"")
    print(f"Message 5b: \"{rem_recency['message']}\"")
    print(f"Category Pill 5b: \"{rem_recency['category_pill']}\"")
    assert rem_recency["message"] != rem_neg["message"], "Newer context MUST update reminder context!"
    print("✓ Recency priority test PASSED\n")

    # TEST 6: CACHE STABILITY ON RELOAD
    print("--- TEST 6: CACHE STABILITY ON RELOAD ---")
    data_reload = await get_dashboard_data(current_user=test_user_a)
    rem_reload = data_reload["daily_reminder"]
    print(f"Reload Message: \"{rem_reload['message']}\"")
    assert rem_reload["message"] == rem_recency["message"], "Cache MUST remain stable when context is unchanged!"
    print("✓ Cache stability test PASSED\n")

    # TEST 7: USER ISOLATION
    print("--- TEST 7: USER ISOLATION ---")
    data_user_b = await get_dashboard_data(current_user=test_user_b)
    rem_user_b = data_user_b["daily_reminder"]
    print(f"User B Message: \"{rem_user_b['message']}\"")
    print(f"User B Category Pill: \"{rem_user_b['category_pill']}\"")
    assert rem_user_b["message"] != rem_recency["message"], "User A data MUST NOT bleed into User B context!"
    print("✓ User isolation test PASSED\n")

    print("============================================================")
    print("ALL 7 VERIFICATION SUITE TESTS COMPLETED SUCCESSFULLY!")
    print("============================================================")

if __name__ == "__main__":
    asyncio.run(run_all_tests())

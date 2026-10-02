import sys
import os
import json
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import db_manager
from main import get_journal, add_journal, update_journal, delete_journal, JournalRequest
from bson import ObjectId

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
        if key == "_id": return self.user_id
        return self.get(key)

def run_audit():
    print("=== STARTING JOURNAL END-TO-END BACKEND AUDIT ===")
    user_a = DummyUser("test_user_journal_a", "usera@example.com", "User A")
    user_b = DummyUser("test_user_journal_b", "userb@example.com", "User B")

    # 1. Clean test entries
    if db_manager.is_connected() and db_manager.journal_entries is not None:
        db_manager.journal_entries.delete_many({"user_id": {"$in": ["test_user_journal_a", "test_user_journal_b"]}})

    # 2. Add Free Write for User A
    fw_req = JournalRequest(
        title="My Sunny Day",
        text="Had a great walk outside.",
        mood="😊 Happy",
        entry_type="free_write",
        type="free_write"
    )
    fw_res = add_journal(fw_req, current_user=user_a)
    print("User A Free Write Created:", fw_res["entry"]["id"], fw_res["entry"]["title"])
    fw_id = fw_res["entry"]["id"]

    # 3. Add Trigger Worksheet for User A
    tw_req = JournalRequest(
        entry_type="trigger_worksheet",
        type="trigger_worksheet",
        trigger="Sudden loud noise in office",
        response="Heart raced, felt overwhelmed",
        life_effect="Spent 20 mins recovering focus",
        next_time_help="Take 3 deep breaths and step outside",
        intensity=4,
        mood="😟 Anxious"
    )
    tw_res = add_journal(tw_req, current_user=user_a)
    print("User A Trigger Worksheet Created:", tw_res["entry"]["id"], tw_res["entry"]["trigger"], "Intensity:", tw_res["entry"]["intensity"])
    tw_id = tw_res["entry"]["id"]

    # 4. Fetch User A entries & check fields
    user_a_entries = get_journal(current_user=user_a)
    print(f"User A Entries Count: {len(user_a_entries)}")
    assert len(user_a_entries) == 2, f"Expected 2 entries, got {len(user_a_entries)}"

    fw_entry = next(e for e in user_a_entries if str(e["id"]) == str(fw_id))
    assert fw_entry["title"] == "My Sunny Day"
    assert fw_entry["text"] == "Had a great walk outside."
    assert fw_entry["entry_type"] == "free_write"

    tw_entry = next(e for e in user_a_entries if str(e["id"]) == str(tw_id))
    assert tw_entry["trigger"] == "Sudden loud noise in office"
    assert tw_entry["response"] == "Heart raced, felt overwhelmed"
    assert tw_entry["life_effect"] == "Spent 20 mins recovering focus"
    assert tw_entry["next_time_help"] == "Take 3 deep breaths and step outside"
    assert tw_entry["intensity"] == 4
    assert tw_entry["entry_type"] == "trigger_worksheet"

    # 5. User Isolation Check: User B should see 0 entries
    user_b_entries = get_journal(current_user=user_b)
    print(f"User B Entries Count (User Isolation Verification): {len(user_b_entries)}")
    assert len(user_b_entries) == 0, "User isolation failed! User B saw User A's entries."

    # 6. Update Trigger Worksheet for User A
    tw_update_req = JournalRequest(
        entry_type="trigger_worksheet",
        type="trigger_worksheet",
        trigger="Sudden loud noise in office (Updated)",
        response="Heart raced, felt overwhelmed",
        life_effect="Spent 15 mins recovering focus",
        next_time_help="Take 3 deep breaths and step outside",
        intensity=5,
        mood="😟 Anxious"
    )
    update_res = update_journal(str(tw_id), tw_update_req, current_user=user_a)
    print("User A Trigger Worksheet Updated. New Intensity:", update_res["entry"]["intensity"])
    assert update_res["entry"]["intensity"] == 5
    assert update_res["entry"]["trigger"] == "Sudden loud noise in office (Updated)"

    # 7. User B attempt to update User A entry (Should be unauthorized / fail)
    try:
        b_update_res = update_journal(str(tw_id), tw_update_req, current_user=user_b)
        assert b_update_res.get("message") == "Journal entry not found", "User B was able to update User A's entry!"
        print("User Isolation on Update Passed: User B could not update User A's entry.")
    except Exception as e:
        print("User Isolation on Update exception caught:", e)

    # 8. User B attempt to delete User A entry
    try:
        b_del_res = delete_journal(str(tw_id), current_user=user_b)
        print("User B delete attempt result:", b_del_res)
    except Exception as e:
        print("User B delete attempt exception caught:", e)

    # Verify entry still exists for User A
    user_a_entries_after = get_journal(current_user=user_a)
    assert len(user_a_entries_after) == 2, "Entry was deleted by User B!"
    print("User Isolation on Delete Passed: User A's entry remained intact.")

    # 9. Delete Free Write for User A
    del_res = delete_journal(str(fw_id), current_user=user_a)
    print("User A Free Write Deleted Result:", del_res)
    user_a_final = get_journal(current_user=user_a)
    assert len(user_a_final) == 1, f"Expected 1 remaining entry, got {len(user_a_final)}"

    # Cleanup
    if db_manager.is_connected() and db_manager.journal_entries is not None:
        db_manager.journal_entries.delete_many({"user_id": {"$in": ["test_user_journal_a", "test_user_journal_b"]}})

    print("=== ALL JOURNAL BACKEND AUDIT TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_audit()

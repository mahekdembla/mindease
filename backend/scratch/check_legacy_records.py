import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.mongodb import db_manager

def check_legacy():
    db_manager.connect_db()
    db = db_manager.get_database()
    if db is None:
        print("MongoDB not connected!")
        return

    collections = ["chat_history", "journal_entries", "trusted_contacts", "mood_records", "safety_activities"]
    report = {}

    for col in collections:
        collection = db[col]
        total = collection.count_documents({})
        no_user_id = collection.count_documents({"user_id": {"$exists": False}})
        null_user_id = collection.count_documents({"user_id": None})
        demo_user_id = collection.count_documents({"user_id": "demo_user"})

        report[col] = {
            "total": total,
            "no_user_id_field": no_user_id,
            "null_user_id": null_user_id,
            "demo_user": demo_user_id,
            "ownerless_legacy": no_user_id + null_user_id
        }

    print("=== MONGODB LEGACY RECORD AUDIT ===")
    for col, data in report.items():
        print(f"Collection '{col}': Total={data['total']}, Ownerless (no user_id)={data['ownerless_legacy']}, Temporary demo_user={data['demo_user']}")

if __name__ == "__main__":
    check_legacy()

import os
import sys
import json
import logging
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.mongodb import db_manager


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mindease.migration")

def migrate():
    logger.info("Starting MindEase JSON to MongoDB migration...")

    if not db_manager.connect_db():
        logger.error("Could not connect to MongoDB. Migration aborted.")
        return

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    journal_path = os.path.join(base_dir, "journal.json")
    chat_path = os.path.join(base_dir, "chat_history.json")

    # 1. Migrate Journal Entries
    journal_inserted = 0
    journal_skipped = 0

    if os.path.exists(journal_path):
        try:
            with open(journal_path, "r", encoding="utf-8") as f:
                journals = json.load(f)
            
            journal_col = db_manager.journal_entries
            if journal_col is not None:
                for entry in journals:
                    entry_id = entry.get("id")
                    text = entry.get("text", "")
                    mood = entry.get("mood", "")
                    time_str = entry.get("time", str(datetime.now()))

                    # Duplicate check by numeric id or text + time
                    existing = journal_col.find_one({
                        "$or": [
                            {"id": entry_id},
                            {"text": text, "time": time_str}
                        ]
                    })

                    if existing:
                        journal_skipped += 1
                    else:
                        doc = {
                            "id": entry_id,
                            "user_id": "demo_user",
                            "text": text,
                            "mood": mood,
                            "time": time_str,
                            "created_at": datetime.now()
                        }
                        journal_col.insert_one(doc)
                        journal_inserted += 1

            logger.info(f"Journal Migration Complete: {journal_inserted} inserted, {journal_skipped} skipped.")
        except Exception as e:
            logger.error(f"Error migrating journal entries: {e}")
    else:
        logger.warning(f"No journal.json found at {journal_path}")

    # 2. Migrate Chat History
    chat_inserted = 0
    chat_skipped = 0

    if os.path.exists(chat_path):
        try:
            with open(chat_path, "r", encoding="utf-8") as f:
                chats = json.load(f)

            chat_col = db_manager.chat_history
            if chat_col is not None:
                for chat in chats:
                    msg = chat.get("message", "")
                    resp = chat.get("response", "")
                    emotion = chat.get("emotion", "neutral")
                    mental_state = chat.get("mental_state", "")
                    time_str = chat.get("time", str(datetime.now()))

                    existing = chat_col.find_one({"message": msg, "time": time_str})

                    if existing:
                        chat_skipped += 1
                    else:
                        safety_level = "HIGH" if emotion == "crisis" else "LOW"
                        doc = {
                            "user_id": "demo_user",
                            "message": msg,
                            "response": resp,
                            "emotion": emotion,
                            "mental_state": mental_state,
                            "safety_level": safety_level,
                            "top_emotions": [emotion] if emotion else [],
                            "time": time_str,
                            "timestamp": datetime.now()
                        }
                        chat_col.insert_one(doc)
                        chat_inserted += 1

            logger.info(f"Chat History Migration Complete: {chat_inserted} inserted, {chat_skipped} skipped.")
        except Exception as e:
            logger.error(f"Error migrating chat history: {e}")
    else:
        logger.warning(f"No chat_history.json found at {chat_path}")

    db_manager.close_db()
    logger.info("Migration script finished safely.")

if __name__ == "__main__":
    migrate()

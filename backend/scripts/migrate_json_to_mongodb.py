import os
import sys
import json
import logging
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.mongodb import db_manager


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mindease.migration")


def parse_time(time_str: str) -> datetime:
    """Attempt to parse a time string into a datetime object."""
    if not time_str:
        return datetime.now()
    for fmt in [
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
    ]:
        try:
            return datetime.strptime(str(time_str)[:26], fmt)
        except ValueError:
            continue
    return datetime.now()


def migrate():
    logger.info("Starting MindEase JSON → MongoDB migration...")

    if not db_manager.connect_db():
        logger.error("Could not connect to MongoDB. Migration aborted.")
        return

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    journal_path  = os.path.join(base_dir, "journal.json")
    chat_path     = os.path.join(base_dir, "chat_history.json")

    # ------------------------------------------------------------------
    # 1. Migrate Journal Entries
    # ------------------------------------------------------------------
    journal_inserted = 0
    journal_skipped  = 0
    journal_errors   = 0

    if os.path.exists(journal_path):
        try:
            with open(journal_path, "r", encoding="utf-8") as f:
                journals = json.load(f)

            journal_col = db_manager.journal_entries
            if journal_col is not None:
                for entry in journals:
                    entry_id  = entry.get("id")
                    text      = entry.get("text", "")
                    mood      = entry.get("mood", "")
                    time_str  = entry.get("time", "")
                    entry_type = entry.get("type") or entry.get("entry_type") or "free_write"

                    # Duplicate guard: match by numeric id OR (text + time)
                    existing = journal_col.find_one({
                        "$or": [
                            {"id": entry_id},
                            {"text": text, "time": time_str}
                        ]
                    })

                    if existing:
                        journal_skipped += 1
                        continue

                    try:
                        doc = {
                            "id":           entry_id,
                            "user_id":      entry.get("user_id", "demo_user"),
                            "title":        entry.get("title", ""),
                            "text":         text,
                            "mood":         mood,
                            "entry_type":   entry_type,
                            "type":         entry_type,
                            "trigger":      entry.get("trigger", ""),
                            "response":     entry.get("response", ""),
                            "life_effect":  entry.get("life_effect", ""),
                            "next_time_help": entry.get("next_time_help", ""),
                            "intensity":    entry.get("intensity", 3),
                            "time":         time_str,
                            "created_at":   parse_time(time_str),
                            "updated_at":   datetime.now(),
                        }
                        journal_col.insert_one(doc)
                        journal_inserted += 1
                    except Exception as insert_err:
                        logger.warning("Failed to insert journal entry id=%s: %s", entry_id, insert_err)
                        journal_errors += 1

            logger.info(
                "Journal migration complete — %d inserted, %d skipped, %d errors.",
                journal_inserted, journal_skipped, journal_errors
            )
        except Exception as e:
            logger.error("Error reading journal.json: %s", e)
    else:
        logger.warning("No journal.json found at %s — skipping journal migration.", journal_path)

    # ------------------------------------------------------------------
    # 2. Migrate Chat History
    # ------------------------------------------------------------------
    chat_inserted = 0
    chat_skipped  = 0
    chat_errors   = 0

    if os.path.exists(chat_path):
        try:
            with open(chat_path, "r", encoding="utf-8") as f:
                chats = json.load(f)

            chat_col = db_manager.chat_history
            if chat_col is not None:
                for chat in chats:
                    msg       = chat.get("message", "")
                    resp      = chat.get("response", "")
                    emotion   = chat.get("emotion", "neutral")
                    time_str  = chat.get("time", "")

                    # Duplicate guard
                    existing = chat_col.find_one({"message": msg, "time": time_str})
                    if existing:
                        chat_skipped += 1
                        continue

                    try:
                        safety_level = "HIGH" if emotion == "crisis" else "LOW"
                        doc = {
                            "user_id":         chat.get("user_id", "demo_user"),
                            "conversation_id": chat.get("conversation_id", ""),
                            "title":           chat.get("title", msg[:35] if msg else ""),
                            "message":         msg,
                            "response":        resp,
                            "emotion":         emotion,
                            "mental_state":    chat.get("mental_state", ""),
                            "safety_level":    safety_level,
                            "top_emotions":    chat.get("top_emotions", [emotion] if emotion else []),
                            "safety":          chat.get("safety", {}),
                            "time":            time_str,
                            "timestamp":       parse_time(time_str),
                        }
                        chat_col.insert_one(doc)
                        chat_inserted += 1
                    except Exception as insert_err:
                        logger.warning("Failed to insert chat message: %s", insert_err)
                        chat_errors += 1

            logger.info(
                "Chat history migration complete — %d inserted, %d skipped, %d errors.",
                chat_inserted, chat_skipped, chat_errors
            )
        except Exception as e:
            logger.error("Error reading chat_history.json: %s", e)
    else:
        logger.warning(
            "No chat_history.json found at %s — skipping chat migration.", chat_path
        )

    db_manager.close_db()
    logger.info(
        "Migration finished. Journal: +%d | Chat: +%d",
        journal_inserted, chat_inserted
    )


if __name__ == "__main__":
    migrate()

"""
Long-term memory for MindEase.

After every exchange a short private "memory note" for that conversation is (re)written in the
background: a running summary, key facts, themes and the overall mood. When the user writes
again, the most relevant notes from their OTHER conversations and related journal entries are
recalled and given to the model, so it can follow up on things said days ago. The same notes
feed the Insights page and the dashboard's daily reminder.

Collection: conversation_memory  (one document per user + conversation)
"""
import json
import os
import re
import threading
from datetime import datetime, timedelta

import numpy as np

import rag
from database.mongodb import db_manager

ANONYMOUS_USER = "demo_user"        # every demo chat shares this id, so nothing is remembered for it
RECALL_MIN_SIMILARITY = 0.25        # past-conversation notes below this similarity are not recalled
JOURNAL_MIN_SIMILARITY = 0.30
MAX_CONTEXT_CHARS = 3000
HISTORY_TURNS_IN_PROMPT = 6         # matches main.load_conversation_history

# The message refers back to something said before, so recent notes are recalled even if the
# wording does not match.
PAST_REFERENCE = re.compile(
    r"\b(last time|before|earlier|yesterday|last week|last night|we talked|i told you|i mentioned|"
    r"remember|again|still|update|follow up|as i said|that thing)\b", re.I)
JOURNAL_REFERENCE = re.compile(r"\b(journal|diary|i wrote|wrote down|my entry)\b", re.I)

MEMORY_PROMPT = """You maintain private memory notes for MindEase, a supportive wellbeing companion.
Update the note for ONE conversation using the previous note and the newest exchange.

Previous note (may be empty):
{previous}

Newest exchanges ({when}), oldest first:
{exchanges}

Return ONLY a JSON object with these keys:
"summary": 2-4 sentences in third person ("They..."): what this conversation is about, what happened, how they felt and anything still unresolved. Keep the important points from the previous note.
"key_facts": up to 8 short, durable facts worth remembering later (people with names/relationships, events and when they happen, goals, worries, preferences, what helped). Merge with the previous facts and drop trivia.
"themes": 1-4 short lowercase topic labels, e.g. "exam stress", "family conflict", "sleep", "loneliness", "work", "self-esteem", "friendship", "health".
"mood": one of "positive", "calm", "mixed", "anxious", "sad", "angry", "distressed".
"recap": one short, warm sentence addressed to the user ("You talked about ...") for their Insights page.
Only use what was actually said; never invent details."""

MOODS = {"positive", "calm", "mixed", "anxious", "sad", "angry", "distressed"}


def _collection():
    return db_manager.get_collection("conversation_memory")


def _parse_json(text):
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return None
    return None


def update_conversation_memory(user_id, conversation_id, exchanges, title=None):
    """Rewrite the memory note for one conversation with the newest exchanges folded in.
    `exchanges` is a list of (user_text, reply) pairs, oldest first."""
    col = _collection()
    if col is None or not user_id or user_id == ANONYMOUS_USER or not conversation_id:
        return

    key = {"user_id": user_id, "conversation_id": conversation_id}
    existing = col.find_one(key, {"embedding": 0, "embeddings": 0}) or {}
    previous = json.dumps({k: existing.get(k) for k in ("summary", "key_facts", "themes", "mood", "recap")},
                          ensure_ascii=False) if existing else "(none)"

    # Keep the prompt small: the newest exchanges matter most, and long replies are trimmed.
    recent = exchanges[-6:]
    text = "\n\n".join(f"User: {u[:1500]}\nMindEase: {(r or '')[:600]}" for u, r in recent)
    prompt = MEMORY_PROMPT.format(previous=previous, when=datetime.now().strftime("%d %b %Y"), exchanges=text)
    user_text = " ".join(u for u, _ in recent)
    data = _parse_json(rag.complete_text(prompt, max_tokens=900, temperature=0.2, json_mode=True, timeout=25, retries=2))

    if not isinstance(data, dict) or not data.get("summary"):
        # LLM unavailable: keep a minimal note so recall and insights still have something.
        data = {
            "summary": existing.get("summary") or f"They talked about: {user_text[:200]}",
            "key_facts": existing.get("key_facts", []),
            "themes": existing.get("themes", []),
            "mood": existing.get("mood", "mixed"),
            "recap": existing.get("recap", ""),
        }

    summary = str(data.get("summary", "")).strip()[:1200]
    facts = [str(f).strip()[:200] for f in (data.get("key_facts") or []) if str(f).strip()][:8]
    themes = [str(t).strip().lower()[:40] for t in (data.get("themes") or []) if str(t).strip()][:4]
    mood = str(data.get("mood") or "mixed").strip().lower()
    if mood not in MOODS:
        mood = "mixed"

    now = datetime.now()
    fields = {
        "summary": summary,
        "key_facts": facts,
        "themes": themes,
        "mood": mood,
        "recap": str(data.get("recap") or "").strip()[:300],
        "updated_at": now,
        "message_count": int(existing.get("message_count", 0)) + len(exchanges),
    }
    if title:
        fields["title"] = title
    # One vector per piece (summary, themes, each fact): a short message is matched against its
    # closest piece, which separates topics far better than one vector for the whole note.
    pieces = [summary] + ([", ".join(themes)] if themes else []) + facts
    vecs = rag.embed(pieces)
    if vecs is not None:
        fields["embeddings"] = [[round(float(x), 5) for x in v] for v in vecs]

    col.update_one(key, {"$set": fields, "$setOnInsert": {"created_at": now}}, upsert=True)


# Memory notes are written once the conversation pauses, not after every message: all exchanges
# since the last update are folded in with ONE LLM call. This keeps background LLM usage (and the
# per-minute token budget it shares) low during a fast back-and-forth.
MEMORY_DEBOUNCE_SECONDS = float(os.environ.get("MEMORY_DEBOUNCE_SECONDS", "20"))

_PENDING = {}                  # (user_id, conversation_id) -> {"exchanges": [...], "title": str, "timer": Timer}
_PENDING_GUARD = threading.Lock()
_LOCKS = {}                    # one lock per conversation so two updates never overlap


def _flush(key):
    with _PENDING_GUARD:
        pending = _PENDING.pop(key, None)
        lock = _LOCKS.setdefault(key, threading.Lock())
    if not pending:
        return
    with lock:
        try:
            update_conversation_memory(key[0], key[1], pending["exchanges"], pending["title"])
        except Exception as e:
            print(f"[memory] update failed: {type(e).__name__}: {e}")


def remember_in_background(user_id, conversation_id, user_text, reply, title=None):
    """Queue this exchange for the conversation's memory note without delaying the reply. The note
    is updated MEMORY_DEBOUNCE_SECONDS after the latest message (each new message restarts the wait)."""
    if not user_id or user_id == ANONYMOUS_USER or not conversation_id:
        return

    key = (user_id, conversation_id)
    with _PENDING_GUARD:
        pending = _PENDING.setdefault(key, {"exchanges": [], "title": title, "timer": None})
        pending["exchanges"].append((user_text, reply))
        if title:
            pending["title"] = title
        if pending["timer"] is not None:
            pending["timer"].cancel()
        timer = threading.Timer(MEMORY_DEBOUNCE_SECONDS, _flush, args=(key,))
        timer.daemon = True
        pending["timer"] = timer
        timer.start()


def flush_all_pending():
    """Write every queued memory note now (called on server shutdown)."""
    with _PENDING_GUARD:
        keys = list(_PENDING)
        for key in keys:
            if _PENDING[key]["timer"] is not None:
                _PENDING[key]["timer"].cancel()
    for key in keys:
        _flush(key)


def delete_conversation_memory(user_id, conversation_id):
    with _PENDING_GUARD:
        pending = _PENDING.pop((user_id, conversation_id), None)
    if pending and pending["timer"] is not None:
        pending["timer"].cancel()
    col = _collection()
    if col is not None:
        col.delete_one({"user_id": user_id, "conversation_id": conversation_id})


def recent_notes(user_id, since=None, limit=20):
    """Most recently updated memory notes (without embeddings), newest first."""
    col = _collection()
    if col is None or not user_id or user_id == ANONYMOUS_USER:
        return []
    query = {"user_id": user_id}
    if since is not None:
        query["updated_at"] = {"$gte": since}
    try:
        return list(col.find(query, {"embedding": 0, "embeddings": 0, "_id": 0}).sort("updated_at", -1).limit(limit))
    except Exception as e:
        print(f"[memory] read failed: {e}")
        return []


def _date(value):
    if not isinstance(value, datetime):
        return str(value or "")[:10] or "recently"
    days = (datetime.now().date() - value.date()).days
    if days == 0:
        return "today"
    if days == 1:
        return "yesterday"
    return value.strftime("%d %b")


def _journal_date(entry):
    raw = entry.get("created_at") or entry.get("time")
    if isinstance(raw, datetime):
        return raw
    try:
        return datetime.fromisoformat(str(raw)[:19])
    except Exception:
        return None


def _note_line(note):
    line = f"- {_date(note.get('updated_at'))}"
    if note.get("title"):
        line += f' ("{note["title"]}")'
    line += f": {note.get('summary', '')}"
    if note.get("key_facts"):
        line += " Facts: " + "; ".join(note["key_facts"])
    return line


def _note_score(note, query_vec):
    """Best similarity between the message and any piece of the note (0 if it has no vectors)."""
    vecs = note.get("embeddings") or ([note["embedding"]] if note.get("embedding") else [])
    if not vecs:
        return 0.0
    return float(np.max(np.asarray(vecs, dtype=np.float32) @ query_vec))


def recall_context(user_id, conversation_id, user_text, k=2):
    """Background for the reply prompt: an earlier-part summary of this conversation, the most
    relevant notes from other conversations, and related journal entries. '' if nothing fits."""
    if not user_id or user_id == ANONYMOUS_USER or not db_manager.is_connected():
        return ""

    col = _collection()
    notes = []
    if col is not None:
        try:
            notes = list(col.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).limit(60))
        except Exception as e:
            print(f"[memory] recall failed: {e}")

    current = next((n for n in notes if conversation_id and n.get("conversation_id") == conversation_id), None)
    others = [n for n in notes if n is not current]
    query_vec = rag.embed([user_text])
    refers_back = bool(PAST_REFERENCE.search(user_text))

    picked = []
    if query_vec is not None and others:
        scored = sorted(((_note_score(n, query_vec[0]), i) for i, n in enumerate(others)), reverse=True)
        picked = [others[i] for score, i in scored[:k] if score >= RECALL_MIN_SIMILARITY]
    # The message points back in time ("the exam I told you about"): also offer the latest chats,
    # even if the wording does not match. Otherwise only related notes are recalled, so unrelated
    # parts of their life are not pulled into every reply.
    if refers_back:
        cutoff = datetime.now() - timedelta(days=7)
        for n in others[:2]:
            if n not in picked and isinstance(n.get("updated_at"), datetime) and n["updated_at"] >= cutoff:
                picked.append(n)

    sections = []
    if refers_back and picked:
        sections.append("NOTE: their message refers back to something from a past conversation. Show that you "
                        "remember it by naturally mentioning the specific detail (names, events) from the notes below.")
    if current and current.get("message_count", 0) > HISTORY_TURNS_IN_PROMPT and current.get("summary"):
        sections.append("Earlier in THIS conversation (older messages are not shown above): "
                        + current["summary"]
                        + (" Facts: " + "; ".join(current["key_facts"]) if current.get("key_facts") else ""))
    if picked:
        sections.append("Past conversations (newest first):\n"
                        + "\n".join(_note_line(n) for n in sorted(picked, key=lambda n: n.get("updated_at") or datetime.min, reverse=True)))

    journal_lines = _recall_journal(user_id, user_text, query_vec)
    if journal_lines:
        sections.append("Their journal:\n" + "\n".join(journal_lines))

    return "\n\n".join(sections)[:MAX_CONTEXT_CHARS]


def _recall_journal(user_id, user_text, query_vec, k=2):
    col = db_manager.journal_entries
    if col is None:
        return []
    try:
        entries = list(col.find({"user_id": user_id}).sort("_id", -1).limit(30))
    except Exception:
        return []
    entries = [e for e in entries if (e.get("text") or e.get("title"))]
    if not entries:
        return []

    picked = []
    texts = [f"{e.get('title') or ''} {e.get('text') or ''}".strip() for e in entries]
    vecs = rag.embed(texts) if query_vec is not None else None
    if vecs is not None:
        scores = vecs @ query_vec[0]
        picked = [i for i in np.argsort(scores)[::-1][:k] if scores[i] >= JOURNAL_MIN_SIMILARITY]
    # The newest entry is useful context when it is fresh or when they mention their journal.
    newest_dt = _journal_date(entries[0])
    if 0 not in picked and (JOURNAL_REFERENCE.search(user_text)
                            or (newest_dt and newest_dt >= datetime.now() - timedelta(days=2))):
        picked.insert(0, 0)

    lines = []
    for i in picked:
        e = entries[i]
        dt = _journal_date(e)
        mood = f", mood {e.get('mood')}" if e.get("mood") else ""
        lines.append(f"- {_date(dt)}{mood}: {texts[i][:350]}")
    return lines

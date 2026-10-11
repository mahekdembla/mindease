import os
import json
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_PATH = os.path.join(BASE_DIR, "data", "knowledge_base.json")

LLM_MODEL = "openai/gpt-oss-120b"
MIN_SIMILARITY = 0.30      # guidance below this score is ignored
MAX_HISTORY_MESSAGES = 8   # last 4 exchanges are sent to the model

# ---------------------------------------------------------------------------
# Retrieval (optional: if it fails, the LLM still answers, just without guidance)
# ---------------------------------------------------------------------------
RETRIEVAL_AVAILABLE = False
embedder = None
kb_texts = []
kb_embeddings = None

try:
    import numpy as np
    from sentence_transformers import SentenceTransformer

    with open(KB_PATH, "r", encoding="utf-8") as f:
        _kb = json.load(f)
    kb_texts = [entry["text"] for entry in _kb]
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    kb_embeddings = embedder.encode(kb_texts, normalize_embeddings=True)
    RETRIEVAL_AVAILABLE = True
    print(f"[rag] Retrieval ready ({len(kb_texts)} knowledge-base entries).")
except Exception as e:
    print(f"[rag] Retrieval DISABLED: {type(e).__name__}: {e}")

# ---------------------------------------------------------------------------
# LLM client
# ---------------------------------------------------------------------------
groq_client = None
try:
    from groq import Groq

    _api_key = os.environ.get("GROQ_API_KEY")
    if _api_key:
        groq_client = Groq(api_key=_api_key)
        print("[rag] Groq client ready.")
    else:
        print("[rag] GROQ_API_KEY not set - replies will use the fallback templates.")
except Exception as e:
    print(f"[rag] Groq DISABLED: {type(e).__name__}: {e}")


def retrieve(user_text: str, k: int = 2):
    """Return up to k knowledge-base entries that are genuinely similar to the message."""
    if not RETRIEVAL_AVAILABLE:
        return []
    query_emb = embedder.encode([user_text], normalize_embeddings=True)[0]
    scores = np.dot(kb_embeddings, query_emb)
    top_idx = np.argsort(scores)[::-1][:k]
    return [kb_texts[i] for i in top_idx if scores[i] >= MIN_SIMILARITY]


SYSTEM_PROMPT = """You are MindEase, a warm, emotionally intelligent companion for people who want to talk about how they feel. You are not a therapist and you never diagnose.

How to reply:
- Respond to the specific thing the person just said. Reflect their situation back in your own words and use their concrete details (for example "your brother", "the exams") instead of generic comfort.
- Sound like a thoughtful friend: 2-4 short sentences, plain language, no bullet points, no headings, no lectures.
- Almost always end with ONE gentle, open question that invites them to say more (what happened, how it feels now, what they need). Listen to the story first; do not rush to fix it.
- Do NOT give advice or coping tips in every message. Offer at most one small suggestion, and only when the person asks for help, says they feel stuck, or you have already listened for a couple of turns. Never repeat a tip that appears earlier in the conversation.
- Vary your openings. Do not begin every reply with "I'm sorry" or "I'm glad", and avoid stock phrases such as "it's okay to feel this way", "gentle wind-down" or "take care of yourself".
- If they share good news, celebrate it genuinely and ask what it means to them.
- If they say they want to stop talking, respect that warmly and do not push more questions.
- Never claim to be human or a professional. If they mention wanting to hurt themselves, encourage them to reach out to someone they trust or local emergency services."""


def build_system_prompt(emotion, guidance):
    parts = [SYSTEM_PROMPT]
    if emotion:
        parts.append(
            f"\nAn automatic classifier guessed the person's emotion might be '{emotion}'. "
            "It is often wrong - trust the person's own words over this guess."
        )
    if guidance:
        ideas = "\n".join(f"- {g}" for g in guidance)
        parts.append(
            "\nBackground ideas you MAY draw on (use at most one, only if it truly fits, "
            f"and always rephrase it in your own words):\n{ideas}"
        )
    return "\n".join(parts)


def generate_llm_response(user_text, emotion=None, mental_state=None, history=None):
    """Return a generated reply, or None so the caller can fall back to templates."""
    if groq_client is None:
        return None

    history = (history or [])[-MAX_HISTORY_MESSAGES:]

    # Let the person be heard first: only bring in coping ideas after one earlier exchange.
    guidance = retrieve(user_text) if len(history) >= 2 else []

    messages = (
        [{"role": "system", "content": build_system_prompt(emotion, guidance)}]
        + history
        + [{"role": "user", "content": user_text}]
    )

    try:
        completion = groq_client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=400,
            temperature=0.8,
        )
        text = (completion.choices[0].message.content or "").strip()
        return text or None
    except Exception as e:
        print(f"[rag] Groq call failed: {type(e).__name__}: {e}")
        return None


# main.py's dashboard code does `from rag import groq_client, RAG_AVAILABLE`.
# Keep that name working: True whenever the LLM client is ready.
RAG_AVAILABLE = groq_client is not None
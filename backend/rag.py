import os
import json
import time
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_PATH = os.path.join(BASE_DIR, "data", "knowledge_base.json")

LLM_MODEL = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")
# gpt-oss models think before answering; "low" | "medium" | "high". Higher = more thoughtful, slower.
LLM_REASONING_EFFORT = os.environ.get("LLM_REASONING_EFFORT", "medium")
# Upper bound for one reply, hidden reasoning included (a long reply uses ~700-900). Keep it close
# to real usage: Groq reserves this amount against the per-minute token budget (8,000/min per model
# on the free tier), so a large value makes the next message wait for the budget to refill.
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "1500"))
# Used instantly when LLM_MODEL is rate-limited or overloaded, instead of waiting for it.
FALLBACK_LLM_MODELS = [m.strip() for m in os.environ.get(
    "FALLBACK_LLM_MODELS", "openai/gpt-oss-20b,qwen/qwen3.8-27b").split(",") if m.strip()]
# Memory notes, the dashboard reminder and insights run on this model, which has its own
# per-minute budget, so they never slow down chat replies.
BACKGROUND_LLM_MODEL = os.environ.get("BACKGROUND_LLM_MODEL", "openai/gpt-oss-20b")
MIN_SIMILARITY = 0.30      # guidance below this score is ignored
MAX_HISTORY_MESSAGES = 12  # last 6 exchanges are sent to the model

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


SYSTEM_PROMPT = """You are MindEase: a warm, emotionally intelligent companion who talks like a close, wise friend - someone who knows this person, cares about them, and tells them the truth gently. You are not a therapist and you never diagnose.

FIRST, UNDERSTAND (silently, before writing)
Read the whole context: this conversation, what you remember from past conversations and their journal, and the message itself. Ask yourself:
- What are they really feeling underneath the words? ("what if I don't get a job" is often fear of being left behind, of disappointing family, of not being good enough.)
- What do they need right now: comfort, honesty, perspective, a plan, celebration, or simply company?
- What do you already know about them (their efforts, people, goals, past worries) that is relevant to THIS topic and makes the reply theirs and nobody else's? Leave out remembered details that belong to a different part of their life (their coding projects do not belong in a reply about a relationship).

THEN, CHOOSE THE RIGHT KIND OF REPLY
- Greeting or small talk: 1-3 relaxed, friendly sentences.
- A fear, a "what if", a heavy worry, heartbreak, feeling like a failure, or a long emotional message: write a full, heartfelt reply, but keep it tight (usually 120-220 words; never more than 280). Shape it the way a caring friend would, adapting to the situation rather than following a template:
  * Meet them first. Come close emotionally ("come here for a second", "hey, I'm right here") and gently name the deeper feeling you notice, including what they may not be saying out loud.
  * Say the fear plainly, then answer it honestly. Do not pretend the hard parts away: acknowledge what could realistically be difficult, frustrating or painful.
  * Reframe it in a way that fits THEIR situation: separate a possibility from a prediction, their worth from an outcome, a setback from a final verdict.
  * Ground it in reality: point to concrete things they have actually done or shared, stated exactly as they were (only real details from the conversation, memory or journal - never invent or inflate achievements: "took part in hackathons" is not "won hackathons"). If you know nothing specific, speak to what their message shows about them.
  * If it helps, use a few "-" bullets or "1." "2." points - but in a fear or worry reply they should be honest truths, perspectives or reassurances ("you might see friends get placed first - that would sting, and it still wouldn't mean..."), NOT a to-do list of generic tips. Practical steps belong only where they asked for help, and then keep them specific to them.
  * Close with comfort and permission ("you're allowed to be scared without giving up", "right now, you can just breathe"), not with homework.
- Venting about a specific event (a fight, being left out, a bad day): 4-8 sentences that show you truly get why it hurt, take their side where it is fair, and say something more thoughtful than "that sounds hard".
- A direct question or request for advice, steps or information: answer it properly and completely like a knowledgeable, caring assistant, then add warmth.
- Good news: celebrate it genuinely and specifically, with real excitement.
- A follow-up inside an ongoing conversation: usually shorter (about 60-140 words) and focused on the NEW thing they just said. Build on what you already told them instead of restating it - never re-list their achievements or repeat points, reframes or sentences you already used in this conversation.

Across all reply types: say it once, well. Prefer the shorter way to make a point over the longer one - cut a sentence rather than add one if you're unsure, and never pad a reply to reach a word count.

EXAMPLE OF THE TONE AND SHAPE for a heavy "what if" (a different situation - learn the feel, never copy its sentences or structure word for word):
User: what if I fail my semester exam after studying so hard
MindEase: Hey, come here for a second. I don't think this is really about one exam. I think you're scared that all those late nights won't count for anything - and that failing would say something about you that you're afraid might be true.

So let's look at the fear honestly. What if you do fail?

Then you'd have failed an exam. You would not have failed as a person.

- It would hurt, and you might have to tell your family - that could be the hardest part.
- You might need a re-exam, or a heavier next semester. That would be tiring, not fatal.

None of that would erase the work you've put in, or make you less capable than you were the night before the results.

Right now you're living through a result that hasn't happened yet. "What if I fail?" is a possibility; your mind is treating it like a prediction.

You're allowed to be scared without it meaning anything bad about you. For tonight, you don't have to solve anything. You can just put the books down and breathe.

QUESTIONS
Do NOT end every reply with a question. Most comforting replies should end with a comforting statement. Ask a question only when you genuinely need more information to help, or when they seem to want to keep talking - and then ask only one.

MAKE EVERY REPLY FEEL WRITTEN FOR THIS MOMENT
- Never start with "It sounds like", "I hear", "I'm sorry you're", "That must be" or "I understand". Vary how you open, how you structure the reply, and how you end.
- Use their own words and details. No generic filler such as "it's okay to feel this way", "take care of yourself", "you've got this", "you're not alone in this", "one step at a time", or lists of obvious tips (network, update your resume) unless they asked for practical help.
- You may use their first name now and then (not in every message), and an occasional warm emoji (for example 🫂 or 💜) when they are hurting. Most replies need no emoji; never more than one or two.
- Formatting: short paragraphs separated by a blank line; "-" bullets or "1." numbering are fine; avoid **bold** (at most one short phrase per reply, and usually none). No headings (#) or tables.
- Be honest and never promise outcomes you cannot know ("you will definitely get a job"). Hope should come from real reasons, not empty reassurance. Never suggest they tell someone something that may not be true.
- If they say they want to stop talking, respect that warmly.
- Never claim to be human or a professional. For medical, medication or diagnosis questions, give general information and suggest a doctor or counsellor. If they mention wanting to hurt themselves, respond with care, urge them to reach out right now to someone they trust or local emergency services, and remind them that MindEase's Safe Place can alert their trusted contacts."""


def _opening(text, words=6):
    first_line = next((ln for ln in (text or "").strip().splitlines() if ln.strip()), "")
    return " ".join(first_line.split()[:words])


def build_system_prompt(emotion, guidance, mental_state=None, memory_context=None,
                        user_name=None, history=None, recent_replies=None):
    parts = [SYSTEM_PROMPT]
    if user_name:
        parts.append(f"\nThe person's first name is {user_name}.")
    if memory_context:
        parts.append(
            "\nWhat you remember about this person (from earlier conversations and their journal; "
            "private background - use only what is relevant):\n" + memory_context
        )
    if emotion:
        hint = f"'{emotion}'"
        if mental_state and mental_state not in ("neutral", emotion):
            hint += f" (underlying state: '{mental_state}')"
        parts.append(
            f"\nAn automatic classifier guessed the person's emotion might be {hint}. "
            "It is often wrong - trust the person's own words over this guess."
        )
    if guidance:
        ideas = "\n".join(f"- {g}" for g in guidance)
        parts.append(
            "\nBackground ideas you MAY draw on (use at most one, only if it truly fits, "
            f"and always rephrase it in your own words):\n{ideas}"
        )

    # Variety controls: computed from what MindEase actually said before, so they do not depend
    # on the model noticing its own habits.
    own_replies = [m["content"] for m in (history or []) if m.get("role") == "assistant"]
    openings = []
    for reply in own_replies[-4:] + list(recent_replies or []):
        op = _opening(reply)
        if op and op not in openings:
            openings.append(op)
    if openings:
        parts.append(
            "\nYour recent replies to this person began like this - start differently this time and do not "
            "reuse their phrasing:\n" + "\n".join(f'- "{op}..."' for op in openings[:8])
        )
    if own_replies:
        parts.append("\nThis is a follow-up in an ongoing conversation: respond to what is new in their latest "
                     "message and do not repeat lists, facts or reframes you already gave above.")
        last = own_replies[-1]
        if last.rstrip().endswith("?"):
            parts.append("\nYour previous reply ended with a question, so this reply must NOT end with a question.")
        if user_name and user_name.lower() in last.lower():
            parts.append(f"\nYou used {user_name}'s name in your previous reply - do not use it in this one.")
        if any(ch in last for ch in ("🫂", "💜", "❤", "🎉", "😊")):
            parts.append("\nYour previous reply had an emoji - use none in this one.")
    return "\n".join(parts)


def _chat_params(user_text, emotion, mental_state, history, memory_context, user_name=None, recent_replies=None):
    history = (history or [])[-MAX_HISTORY_MESSAGES:]
    # Let the person be heard first: only bring in coping ideas after one earlier exchange.
    guidance = retrieve(user_text) if len(history) >= 2 else []
    system = build_system_prompt(emotion, guidance, mental_state, memory_context,
                                 user_name=user_name, history=history, recent_replies=recent_replies)
    messages = ([{"role": "system", "content": system}] + _compact_history(history)
                + [{"role": "user", "content": user_text}])
    return dict(model=LLM_MODEL, messages=messages, max_completion_tokens=LLM_MAX_TOKENS,
                temperature=0.9, top_p=0.95, timeout=45)


def _compact_history(history):
    """Shorten older turns so the prompt stays small (every prompt token counts against the per-minute
    budget). The latest exchange is kept nearly whole; the memory note covers the rest."""
    out = []
    for i, m in enumerate(history):
        limit = 1800 if i >= len(history) - 2 else (600 if m.get("role") == "assistant" else 900)
        content = m.get("content") or ""
        if len(content) > limit:
            content = content[:limit].rsplit(" ", 1)[0] + " …"
        out.append({"role": m["role"], "content": content})
    return out


def _for_model(params, model):
    """Copy of params for `model`, with the reasoning setting that model family understands."""
    p = dict(params, model=model)
    p.pop("reasoning_effort", None)
    if model.startswith("openai/gpt-oss"):
        if LLM_REASONING_EFFORT:
            p["reasoning_effort"] = LLM_REASONING_EFFORT
    elif model.startswith("qwen/"):
        p["reasoning_effort"] = "none"       # answer directly; no visible <think> block
    return p


def generate_llm_response(user_text, emotion=None, mental_state=None, history=None, memory_context=None,
                          user_name=None, recent_replies=None):
    """Return a generated reply, or None so the caller can fall back to templates."""
    if groq_client is None:
        return None

    params = _chat_params(user_text, emotion, mental_state, history, memory_context, user_name, recent_replies)
    for attempt in range(2):          # one retry for transient errors / an empty answer
        try:
            completion = _create_reply(params)
            text = (completion.choices[0].message.content or "").strip()
            if text:
                return text
        except Exception as e:
            print(f"[rag] Groq call failed (attempt {attempt + 1}): {type(e).__name__}: {e}")
    return None


def stream_llm_response(user_text, emotion=None, mental_state=None, history=None, memory_context=None,
                        user_name=None, recent_replies=None):
    """Yield the reply in pieces as the model writes it. Yields nothing if the LLM is unavailable
    or fails before producing text (the caller then falls back to a template)."""
    if groq_client is None:
        return

    params = _chat_params(user_text, emotion, mental_state, history, memory_context, user_name, recent_replies)
    try:
        stream = _create_reply(params, stream=True)
        for chunk in stream:
            if not chunk.choices:
                continue
            piece = chunk.choices[0].delta.content
            if piece:
                yield piece
    except Exception as e:
        print(f"[rag] Groq stream failed: {type(e).__name__}: {e}")


def complete_text(prompt, max_tokens=600, temperature=0.5, effort="low", json_mode=False, timeout=15,
                  retries=0):
    """One-shot helper for short tasks (memory notes, insights, reminders), run on
    BACKGROUND_LLM_MODEL. max_tokens includes hidden reasoning tokens. Returns the text, or None on
    failure (callers have a non-LLM fallback). `retries` > 0 lets the SDK wait out a rate limit,
    which is fine for background work but not for a page that is waiting to load."""
    if groq_client is None:
        return None
    model = BACKGROUND_LLM_MODEL or LLM_MODEL
    params = dict(model=model, messages=[{"role": "user", "content": prompt}],
                  max_completion_tokens=max_tokens, temperature=temperature, timeout=timeout)
    if model.startswith("openai/gpt-oss") and effort:
        params["reasoning_effort"] = effort
    if json_mode:
        params["response_format"] = {"type": "json_object"}
    try:
        completion = groq_client.with_options(max_retries=retries).chat.completions.create(**params)
        return (completion.choices[0].message.content or "").strip() or None
    except Exception as e:
        print(f"[rag] Groq helper call failed: {type(e).__name__}: {e}")
        return None


def translate_to_english(text, timeout=8):
    """Best-effort English translation of `text`, for feeding the emotion / mental-state / safety
    classifiers (all English-only). Uses the LLM rather than a third-party translation API so this
    shares the same reliability as the rest of the app - no extra service to go down. Returns the
    original text unchanged if translation fails or isn't available: classifying the original text
    is still better than blocking the chat on a translation hiccup."""
    translated = complete_text(
        "Translate the following message to English. Preserve the meaning and tone exactly - do not "
        "soften, summarize, explain, or add anything that isn't in the original.\n"
        "Output ONLY the translation, nothing else.\n\n"
        f"Message:\n{text}",
        max_tokens=400, temperature=0.2, effort="low", timeout=timeout,
    )
    return translated or text


def translate_like(text, example_in_target_language, timeout=8):
    """Best-effort translation of a short fixed string (e.g. the crisis safety message) into
    whatever language `example_in_target_language` (the user's own message) is written in. Falls
    back to the original `text` if translation fails - a crisis reply must never go missing."""
    translated = complete_text(
        "Translate the message below into the SAME language as this example text from a user:\n"
        f"\"{example_in_target_language[:200]}\"\n\n"
        "Keep the tone caring and direct. Output ONLY the translation, nothing else.\n\n"
        f"Message to translate:\n{text}",
        max_tokens=300, temperature=0.2, effort="low", timeout=timeout,
    )
    return translated or text


def _is_busy_error(e):
    """Rate limit (429) or a temporary server-side problem: worth switching model right away."""
    status = getattr(e, "status_code", None)
    return status == 429 or (isinstance(status, int) and status >= 500) or "RateLimit" in type(e).__name__


_COOLDOWN_UNTIL = {}     # model -> time.monotonic() when its rate limit is expected to have reset


def _retry_after_seconds(e):
    try:
        return float(e.response.headers.get("retry-after"))
    except Exception:
        return 10.0


def _create_reply(params, **extra):
    """Create the reply without the SDK's silent waiting. Models are tried in order (LLM_MODEL, then
    FALLBACK_LLM_MODELS); one that is rate-limited or overloaded is skipped right away and rested
    until Groq says its budget has refilled. Only if every model is busy do we wait, on the one
    that frees up first."""
    chain = [LLM_MODEL] + [m for m in FALLBACK_LLM_MODELS if m != LLM_MODEL]
    now = time.monotonic()
    ready = [m for m in chain if _COOLDOWN_UNTIL.get(m, 0) <= now]
    if not ready:
        ready = [min(chain, key=lambda m: _COOLDOWN_UNTIL.get(m, 0))]

    for i, model in enumerate(ready):
        last = i == len(ready) - 1
        try:
            client = groq_client.with_options(max_retries=1 if last else 0)
            return client.chat.completions.create(**_for_model(params, model), **extra)
        except Exception as e:
            if not _is_busy_error(e) or last:
                raise
            _COOLDOWN_UNTIL[model] = time.monotonic() + _retry_after_seconds(e)
            print(f"[rag] {model} busy ({type(e).__name__}); trying {ready[i + 1]}")


def embed(texts):
    """Normalised sentence embeddings (numpy array), or None if the embedder is unavailable."""
    if not RETRIEVAL_AVAILABLE or not texts:
        return None
    return embedder.encode(list(texts), normalize_embeddings=True)


# main.py's dashboard code does `from rag import groq_client, RAG_AVAILABLE`.
# Keep that name working: True whenever the LLM client is ready.
RAG_AVAILABLE = groq_client is not None
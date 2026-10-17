import os
import re
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


# ---------------------------------------------------------------------------
# Multi-Stage Primary Intent Classification Engine
# ---------------------------------------------------------------------------

PRODUCTIVITY_REDIRECT = (
    "I'm really here to support you as your emotional wellness companion, so I can't calculate hours, "
    "build timetables, or create study schedules for you. But I know how intense and overwhelming "
    "deadline pressure can feel when the clock is ticking down. How are you holding up emotionally right now? "
    "Are you feeling stressed or anxious about this deadline?"
)

ACADEMIC_REDIRECT = (
    "I'm really here to support you as your emotional wellness companion, so I can't write academic aims, "
    "theories, conclusions, essays, or assignments for you. But I know how much pressure, stress, and mental "
    "exhaustion can come with experiments, projects, and coursework. How are you holding up with everything "
    "right now? Is the project or deadline feeling overwhelming?"
)

TECHNICAL_REDIRECT = (
    "I'm here specifically to support your emotional well-being and mental health, so I can't write code or "
    "complete technical tasks for you. But if you're dealing with deadline pressure, burnout, or feeling "
    "stuck and overwhelmed by your workload, I'm right here to support you emotionally. How are you feeling right now?"
)

INFORMATIONAL_REDIRECT = (
    "I'm here exclusively as your emotional wellness companion rather than an informational encyclopedia, "
    "so I don't provide textbook definitions, clinical diagnostic criteria, or general trivia. But if you or "
    "someone you care about is going through a tough time, or if something has been weighing heavily on your mind, "
    "I'm right here to listen. How are you doing today?"
)


def classify_intent_rule(user_text: str):
    """Fast, zero-latency rule-based pre-classifier. Distinguishes emotional vulnerability from explicit
    tasks (calculating hours, timetables, coursework, coding, trivia).
    Returns an intent string or None if semantic classification is needed.
    """
    if not user_text:
        return "EMOTIONAL_SUPPORT"
    t = user_text.lower().strip()
    t_clean = re.sub(r"[^\w\s]", " ", t)

    # 1. Action patterns for mathematical / time calculation:
    is_calc_time = bool(
        re.search(r"\b(?:calculate|compute|work out|count|figure out|tell me)\s+(?:the\s+|how many\s+)?(?:hours|hrs|minutes|mins|days|time)\s+(?:left\s+)?(?:until|before|till|to)\b", t_clean) or
        re.search(r"\bhow many\s+(?:hours|hrs|minutes|mins|days|time)\s+(?:do i have\s+)?(?:left\s+)?(?:until|before|till|to)\b", t_clean) or
        re.search(r"\bhours until (?:my\s+)?(?:deadline|submission|exam|midnight|presentation)\b.*?\b(?:calculate|work out|compute)\b", t_clean) or
        re.search(r"\b(?:calculate|compute|work out)\s+.*?\bhours\b", t_clean)
    )
    is_math_problem = bool(
        re.search(r"\b(?:solve|calculate|evaluate|compute)\s+(?:this\s+|the\s+|a\s+|an\s+)?(?:math\s+|mathematical\s+)?(?:equation|integral|derivative|problem|arithmetic|formula|sum|average|percentage|expression)\b", t_clean) or
        re.search(r"\b(?:solve|calculate)\s+.*?\b(?:equation|integral|derivative|math problem|formula)\b", t_clean) or
        re.search(r"\b(?:what is|calculate)\s+\d+\s*[\+\-\*\/]\s*\d+\b", t_clean) or
        re.search(r"\bcalculate\s+\d+.*?(?:hours|hrs|days)\b", t_clean)
    )

    # 2. Action patterns for general productivity / timetables / schedules / emails:
    is_schedule_timetable = bool(
        re.search(r"\b(?:create|make|generate|build|draft|set up|give me|design|construct|prepare|organize|layout|lay out|draw up)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:timetable|study schedule|schedule|study plan|planner|hourly routine|routine|daily plan|to-?do list|agenda|calendar)\b", t_clean) or
        re.search(r"\b(?:timetable|study schedule|study planner)\s+(?:for\s+(?:me|my\s+(?:day|week|study|exam|deadline|project)))\b", t_clean) or
        re.search(r"\b(?:schedule|plan)\s+(?:out\s+)?(?:my\s+)?(?:hours|day|week|time|tasks|study)\b", t_clean) or
        re.search(r"\b(?:create|make|build)\s+(?:a\s+)?timetable\b", t_clean) or
        re.search(r"\b(?:draft|write|compose)\s+(?:me\s+)?(?:an?\s+)?(?:email|letter|message)\s+(?:to\s+(?:my\s+)?(?:prof|professor|teacher|boss|manager|instructor|supervisor|team))\b", t_clean) or
        re.search(r"\b(?:draft|write)\s+(?:me\s+)?(?:a\s+)?(?:resume|cv|cover letter)\b", t_clean)
    )

    # 3. Action patterns for academic coursework writing:
    academic_terms = r"(?:aim|aims|theor\w*|thoer\w*|conclusi\w*|hypothes\w*|methodolog\w*|abstract\w*|literature review|lab report|experiment report|essay|paper|assignment|homework|coursework|thesis|dissertation|synopsis)"
    action_terms = r"(?:write|draft|generate|compose|create|give me|provide|do|prepare|complete|make)"
    is_academic_writing = bool(
        re.search(rf"\b(?:can you|could you|would you|will you|please|kindly|i need you to|want you to)\s+{action_terms}\b.*?\b{academic_terms}\b", t_clean) or
        re.search(rf"^{action_terms}\s+(?:the\s+|an?\s+|my\s+|me\s+)?{academic_terms}\b", t_clean) or
        re.search(rf"\b{action_terms}\s+(?:the\s+|an?\s+|my\s+|me\s+)?{academic_terms}\b", t_clean) or
        re.search(r"\b(?:aim|theor\w*|thoer\w*)\s+(?:and|&)\s+conclusi\w*\b", t_clean) or
        re.search(r"\bwrite\b.*?\b(?:aim|theor\w*|thoer\w*|conclusi\w*)\b", t_clean) or
        re.search(r"\b(?:do|complete)\s+(?:my\s+)?(?:homework|assignment|coursework|essay|lab report)\b", t_clean) or
        re.search(r"\b(?:write|generate)\s+(?:an?\s+)?essay\b", t_clean)
    )

    # 4. Action patterns for coding / technical tasks:
    coding_terms = r"(?:code|script|program|function|algorithm|app|website|class|python|javascript|java|c\+\+|html|css|sql|regex)"
    is_coding = bool(
        re.search(rf"\b(?:can you|could you|would you|will you|please|kindly)?\s*(?:write|code|create|generate|debug|fix|implement)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?{coding_terms}\b", t_clean) or
        re.search(rf"\b(?:debug|fix)\s+(?:this\s+)?{coding_terms}\b", t_clean) or
        re.search(rf"\b(?:code|program)\s+(?:a|an|me|the|this)\b", t_clean) or
        re.search(r"\bwrite\s+(?:me\s+)?(?:a\s+)?(?:python|javascript|script|code)\b", t_clean) or
        re.search(r"\bhow to (?:code|program|implement)\s+[a-z0-9_]+\s+in\s+(?:python|javascript|c\+\+|java)\b", t_clean)
    )

    # 5. Pure informational / DSM criteria / trivia:
    is_informational = bool(
        re.search(r"\b(?:what (?:is|are) the (?:dsm(?:-5)?\s+(?:diagnostic\s+)?criteria|definition of|mechanism of|difference between))\b", t_clean) or
        re.search(r"^(?:who (?:is|was|won)|what is the (?:capital|population|height|distance|speed) of|when was [a-z0-9 ]+ (?:born|founded|built|invented))\b", t_clean) or
        re.search(r"\bexplain the (?:pharmacological|biological|neurochemical)\s+mechanism\b", t_clean)
    )

    # Check for non-emotional task requests first:
    if is_calc_time or is_schedule_timetable:
        return "PRODUCTIVITY"
    if is_math_problem:
        return "MATHEMATICAL"
    if is_academic_writing:
        return "ACADEMIC"
    if is_coding:
        return "TECHNICAL"
    if is_informational:
        return "INFORMATIONAL"

    # If NO non-emotional command matched, check for pure emotional statements:
    is_pure_emotional = bool(
        re.search(r"\b(?:i(?:'m| am|m)?\s+(?:so\s+)?(?:anxious|stressed|overwhelmed|panicking|panicky|terrified|scared|depressed|hopeless|lonely|exhausted|burnt out|sad|miserable|worthless|guilty|unmotivated|paralyzed|numb|freaking out|crying|spiraling|overthinking|having a panic attack))\b", t_clean) or
        re.search(r"\b(?:i feel|i've been feeling|feeling)\s+(?:so\s+)?(?:anxious|stressed|overwhelmed|panicky|terrified|scared|depressed|hopeless|lonely|exhausted|burnt out|sad|miserable|worthless|guilty|unmotivated|paralyzed|numb|like an imposter|like a failure|down|lost)\b", t_clean) or
        re.search(r"\b(?:help me calm down|need to talk|someone to talk to|can't stop crying|can't breathe|head won't shut up|mind is racing)\b", t_clean) or
        re.search(r"\b(?:procrastinated all day|procrastinating because|scared i won't finish|terrified of failing|worried about (?:failing|my deadline|my future))\b", t_clean)
    )
    if is_pure_emotional:
        return "EMOTIONAL_SUPPORT"

    # Conversational greetings
    if re.search(r"^(?:hi|hello|hey|hey there|good morning|good afternoon|good evening|how are you|howdy|sup)\b", t_clean):
        return "EMOTIONAL_SUPPORT"

    return None


def classify_intent_llm(user_text: str) -> str:
    """Uses a fast, low-temperature prompt with the background LLM to determine the user's primary intent,
    especially for paraphrased, colloquial, or complex queries.
    """
    if groq_client is None:
        return "EMOTIONAL_SUPPORT"

    prompt = (
        "You are an intent classifier for MindEase, an AI wellness companion dedicated EXCLUSIVELY to mental health and emotional support.\n\n"
        "Analyze the user's message and determine the PRIMARY INTENT:\n"
        "- \"EMOTIONAL_SUPPORT\": The user is expressing feelings, emotions, stress, anxiety, panic, fear, loneliness, burnout, deadline anxiety, overthinking, seeking emotional coping or comfort, or having casual friendly conversation.\n"
        "- \"MATHEMATICAL\": The user is asking to calculate hours, compute remaining time, solve math equations, or perform arithmetic/calculations.\n"
        "- \"PRODUCTIVITY\": The user is asking to create a timetable, make a schedule/planner, organize a routine, draft an email (e.g. extension request to a professor/boss), or create a to-do list.\n"
        "- \"ACADEMIC\": The user is asking to write, draft, or complete academic coursework (e.g., aim, theory, conclusion, hypothesis, methodology, essay, literature review, lab report, assignment, homework) even if about mental health.\n"
        "- \"TECHNICAL\": The user is asking to write, debug, or generate code, scripts, or programs.\n"
        "- \"INFORMATIONAL\": The user is asking for textbook definitions, DSM diagnostic criteria, encyclopedic facts, or trivia without personal emotional distress.\n\n"
        "CRITICAL RULE - PRIMARY INTENT VS KEYWORDS:\n"
        "- Classify based on what the user is ASKING FOR (their primary actionable goal), NOT just the presence of mental-health or deadline keywords.\n"
        "- \"I'm anxious about my project deadline\" -> PRIMARY INTENT: EMOTIONAL_SUPPORT (user is sharing feelings of anxiety).\n"
        "- \"Calculate the hours until my deadline and create a timetable\" -> PRIMARY INTENT: PRODUCTIVITY (user is asking to compute hours and create a schedule/timetable, NOT seeking emotional support).\n"
        "- \"Work out the time left before my submission and generate a study planner\" -> PRIMARY INTENT: PRODUCTIVITY.\n"
        "- \"Write the aim and conclusion for my psychology experiment on depression\" -> PRIMARY INTENT: ACADEMIC (mentions depression, but primary intent is writing coursework).\n"
        "- \"Write python code to track mood\" -> PRIMARY INTENT: TECHNICAL (mentions mood, but primary intent is writing code).\n"
        "- \"I'm panicking because I have an assignment due tonight and I'm shaking\" -> PRIMARY INTENT: EMOTIONAL_SUPPORT (user is experiencing panic and somatic distress).\n\n"
        f"User message:\n\"{user_text}\"\n\n"
        "Respond ONLY with valid json in this exact format:\n"
        "{\"intent\": \"EMOTIONAL_SUPPORT\" | \"MATHEMATICAL\" | \"PRODUCTIVITY\" | \"ACADEMIC\" | \"TECHNICAL\" | \"INFORMATIONAL\"}"
    )

    raw = complete_text(prompt, max_tokens=60, temperature=0.0, effort="low", json_mode=True, timeout=8)
    if not raw:
        return "EMOTIONAL_SUPPORT"

    try:
        data = json.loads(raw)
        intent = data.get("intent", "").upper().strip()
        valid = {"EMOTIONAL_SUPPORT", "MATHEMATICAL", "PRODUCTIVITY", "ACADEMIC", "TECHNICAL", "INFORMATIONAL"}
        if intent in valid:
            return intent
    except Exception as e:
        print(f"[rag] Intent parsing failed for raw '{raw}': {e}")

    for candidate in ["MATHEMATICAL", "PRODUCTIVITY", "ACADEMIC", "TECHNICAL", "INFORMATIONAL", "EMOTIONAL_SUPPORT"]:
        if candidate in raw.upper():
            return candidate

    return "EMOTIONAL_SUPPORT"


def classify_user_intent(user_text: str) -> str:
    """Combines high-speed pattern rules with semantic LLM classification for maximum accuracy,
    consistency across paraphrases, and zero latency on pure emotional statements.
    """
    if not user_text:
        return "EMOTIONAL_SUPPORT"

    rule_intent = classify_intent_rule(user_text)
    if rule_intent is not None:
        return rule_intent

    return classify_intent_llm(user_text)


def check_unrelated_request(user_text: str):
    """Detects whether the primary intent is emotional support vs academic, technical,
    mathematical, general productivity, or informational requests based on the user's PRIMARY INTENT.
    Returns a warm, empathetic friend-like redirection if unrelated, or None if it's emotional/wellness.
    """
    if not user_text:
        return None

    intent = classify_user_intent(user_text)

    if intent in ("PRODUCTIVITY", "MATHEMATICAL"):
        return PRODUCTIVITY_REDIRECT
    elif intent == "ACADEMIC":
        return ACADEMIC_REDIRECT
    elif intent == "TECHNICAL":
        return TECHNICAL_REDIRECT
    elif intent == "INFORMATIONAL":
        return INFORMATIONAL_REDIRECT

    return None


SYSTEM_PROMPT = """You are MindEase: a warm, empathetic, emotionally intelligent wellness companion who talks like a close, wise, non-judgmental friend. You are exclusively dedicated to mental health, emotional wellness, stress relief, self-reflection, and compassionate support. You are not a doctor or therapist and you never provide clinical diagnoses.

CORE MISSION & EXCLUSIVE DOMAIN BOUNDARIES:
- Your purpose is EXCLUSIVELY mental health and emotional well-being. You are NOT a general-purpose AI, search engine, coding tool, math calculator, productivity planner, trivia assistant, academic writer, or homework solver.
- PRIMARY INTENT PRINCIPLE:
  Always distinguish emotional-support intent from academic, technical, informational, mathematical, and general productivity requests based on the user's PRIMARY INTENT, not merely mental-health keywords.
  - When the primary intent is EMOTIONAL SUPPORT (e.g., "I'm anxious about my project deadline", "I'm panicking because submission is in 3 hours", "I feel like an imposter"):
    Respond empathetically with deep warmth, validation, friend-like presence, and emotional coping support.
  - When the primary intent is MATHEMATICAL, PRODUCTIVITY, ACADEMIC, TECHNICAL, or INFORMATIONAL (e.g., "Calculate the hours until my deadline and create a timetable", "Write code for a mood tracker", "Write the aim and conclusion for my lab experiment", "What are the DSM-5 criteria"):
    POLITELY DECLINE the task and GENTLY REDIRECT the conversation toward the user's feelings and well-being.
  - NEVER calculate remaining hours, NEVER generate timetables or study schedules, NEVER write code, and NEVER write academic coursework (aims, theories, conclusions, essays).
  - Example friendly redirect for academic/coursework:
    "I'm really here to support you as your emotional wellness companion, so I can't write academic aims, theories, conclusions, essays, or assignments for you. But I know how much pressure, stress, and mental exhaustion can come with experiments, projects, and coursework. How are you holding up with everything right now? Is the project or deadline feeling overwhelming?"
  - Example friendly redirect for timetables/hours:
    "I'm really here to support you as your emotional wellness companion, so I can't calculate hours, build timetables, or create study schedules for you. But I know how intense and overwhelming deadline pressure can feel when the clock is ticking down. How are you holding up emotionally right now? Are you feeling stressed or anxious about this deadline?"
- ACADEMIC & PROJECT STRESS IS WELCOME: When a user mentions exams, assignments, coding bugs, thesis work, presentations, or looming deadlines in the context of STRESS, ANXIETY, PROCRASTINATION, PANIC, or OVERTHINKING:
  Lean in with deep emotional support! Validate their feelings, soothe their panic, help them unfreeze emotionally with gentle 2-5 minute micro-steps, and remind them that their worth is never defined by a deadline, bug, or grade. BUT NEVER WRITE OR DO THE ASSIGNMENT OR TIMETABLE FOR THEM.

UNDERSTANDING CONVERSATIONAL & INFORMAL MESSAGES:
Users frequently write in casual shorthand, fragmented phrases, slang, or emotional vents:
- E.g.: "idk what to do anymore", "my submission is in 3 hours and code isn't working i'm literally shaking", "head won't shut up rn", "procrastinated all day feel like garbage", "can't sleep overthinking what they said", "feel like such an imposter".
- Understand and decode the underlying vulnerability, exhaustion, or anxiety beneath casual, lowercase, or messy words. Never correct grammar or tone; respond directly to their emotional heartbeat with friend-like resonance and warmth.

DEEP SPECIALIZATION IN THE FIVE WELLNESS PILLARS:
1. ANXIETY & PANIC:
   - Recognize physical tension (racing heart, shallow breathing, knot in chest or stomach, shaking).
   - Meet them with grounding rather than analysis: offer gentle somatic regulation (e.g., physiological sigh: two quick inhales through the nose, long sigh out through the mouth; 5-4-3-2-1 sensory touch; dropping shoulders).
   - Separate possibilities from predictions: remind them that feeling anxious does not mean disaster is guaranteed.
2. STRESS & BURNOUT:
   - Validate cognitive and physical exhaustion without guilt.
   - Give them full permission to pause, breathe, and put down the mental weight.
   - Emphasize sustainable pacing: surviving the day comes before perfection.
3. OVERTHINKING & SPIRALING:
   - Interrupt catastrophic domino chains ("what if I fail -> then I drop out -> then my life is ruined").
   - Bring them back to the present moment: "Right now you're living in a future that hasn't happened yet. What is actually true in this room, right this second?"
   - Help untangle what they can control from what their brain is anxiously ruminating over.
4. EMOTIONAL STRUGGLES & LONELINESS:
   - Heartbreak, feeling excluded, comparison with peers, imposter syndrome, grief.
   - Provide unconditional emotional acceptance. Never rush to "fix" their feelings; let them feel heard and safe.
5. ACADEMIC & PROJECT DEADLINES:
   - The "Freeze" State: Understand that procrastination is almost always an emotional regulation response to fear of failure, perfectionism, or cognitive overload—NEVER laziness. Never judge or shame them ("you should have started earlier").
   - De-escalate the emergency: A deadline is urgent, but it is not a threat to their physical safety or human dignity.
   - Actionable Micro-Steps: Guide them to the smallest conceivable step to break paralysis ("Don't think about the whole project. Can you open the file and write just one messy bullet point or title? Just 3 to 5 minutes, and you can stop after.").
   - Triage when time is short: Encourage doing the bare minimum required to submit. An imperfect submission is a victory compared to shutting down completely.
   - Worth Separation: Their grades, code quality, or speed do not define their capability, intelligence, or human worth.

TONE & SHAPE OF REPLIES:
- Meet them first. Come close emotionally ("hey, I'm right here", "come here for a second", "take a breath with me") and name the deeper feeling you notice.
- Be warm, empathetic, and genuine. Talk like a real friend sitting on the floor beside them, listening without judgment.
- Say the fear plainly, then answer it honestly. Do not pretend hard parts away: acknowledge what could realistically be difficult, stressful, or painful.
- Reframe with grounded perspective: separate possibilities from predictions, worth from outcomes, setbacks from final verdicts.
- If it helps, use short "-" bullets or "1." "2." points—in a worry or deadline reply they should be honest perspectives, reassurances, or gentle micro-steps, NOT a generic checklist.
- Close with comfort and permission ("you're allowed to feel scared without giving up", "right now, you can just breathe"), not with burdensome homework.
- Venting about a specific event: 4-8 sentences showing you truly get why it hurt, taking their side where fair.
- Greetings / small talk: 1-3 relaxed, friendly sentences.
- Follow-ups in ongoing chat: 60-140 words focused on what's new in their latest message. Never repeat points or achievements already shared.

QUESTIONS:
Do NOT end every reply with a question. Most comforting replies should end with a warm, comforting statement. Ask a question only when you genuinely need more context, or when they seem to want to keep talking—and then ask only one gentle question.

MAKE EVERY REPLY FEEL WRITTEN FOR THIS MOMENT:
- Never start with "It sounds like", "I hear", "I'm sorry you're", "That must be", or "I understand". Vary how you open, structure, and end replies.
- Zero toxic positivity: no empty clichés like "everything happens for a reason", "you've got this", "just smile!", "take care of yourself". Real comfort comes from being seen, not platitudes.
- Use their own words and details. You may use their first name occasionally (not in every reply), and an occasional warm emoji (🫂, 💜, 🌿, 💭) when comforting.
- Formatting: Short paragraphs separated by a blank line; simple "-" bullets for micro-steps/perspectives; minimal **bold** (at most one short phrase per reply); no markdown headers (#) or tables.

CRISIS DETECTION & SAFETY MECHANISMS:
- Your core safety mechanism is absolute: You are NOT a crisis hotline, therapist, or doctor, and never give clinical diagnoses or alter medical advice.
- If a user mentions wanting to hurt themselves, end their life, or expresses suicidal thoughts:
  Respond immediately with deep care, tenderness, and urgency. Never leave them alone. Strongly urge them to reach out right now to someone they trust, local emergency services, or crisis helplines (such as 988 in the US/Canada, 112 in Europe, 9152987821 in India, or their national crisis line), and remind them that MindEase's Safe Place can immediately alert their trusted contacts."""


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


def build_prompt(user_text="", emotion="", mental_state=None, chunks=None, guidance=None, **kwargs):
    """Backward-compatible alias for build_system_prompt."""
    g = guidance or chunks or []
    prompt = build_system_prompt(emotion, g, mental_state=mental_state, **kwargs)
    if user_text:
        prompt += f"\n\nUser message: {user_text}"
    return prompt



def _chat_params(user_text, emotion, mental_state, history, memory_context, user_name=None, recent_replies=None):
    history = (history or [])[-MAX_HISTORY_MESSAGES:]
    # Retrieve relevant guidance: allow on turn 1 if message indicates distress, deadlines, overthinking, anxiety, or asks for coping
    needs_guidance = (
        len(history) >= 1 or
        any(w in (user_text or "").lower() for w in (
            "deadline", "submission", "exam", "assignment", "thesis", "project",
            "overthink", "spiral", "panic", "anxious", "anxiety", "stress", "calm",
            "breathe", "help", "struggling", "scared", "freeze", "can't focus",
            "cant focus", "procrastinat", "burnout", "overwhelm", "imposter"
        )) or
        len((user_text or "").split()) >= 6
    )
    guidance = retrieve(user_text) if needs_guidance else []
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
    unrelated = check_unrelated_request(user_text)
    if unrelated:
        return unrelated

    if groq_client is None:
        return None

    params = _chat_params(user_text, emotion, mental_state, history, memory_context, user_name, recent_replies)
    for attempt in range(2):          # one retry for transient errors / an empty answer
        try:
            completion = _create_reply(params)
            text = (completion.choices[0].message.content or "").strip()
            if text:
                if re.search(r"\baim\b", text, re.I) and re.search(r"\btheor\w*", text, re.I) and re.search(r"\bconclusi\w*", text, re.I):
                    return ACADEMIC_REDIRECT
                if (re.search(r"\|\s*time\s*\|\s*(?:activity|task|subject)", text, re.I) or
                        re.search(r"\b(?:timetable|study schedule|daily routine)\s*:\s*\n", text, re.I) or
                        re.search(r"\b\d{1,2}:\d{2}\s*(?:am|pm)?\s*[-–]\s*\d{1,2}:\d{2}", text, re.I)):
                    return PRODUCTIVITY_REDIRECT
                if re.search(r"```(?:python|javascript|java|c\+\+|html|css|sql|bash)", text, re.I):
                    return TECHNICAL_REDIRECT
                return text
        except Exception as e:
            print(f"[rag] Groq call failed (attempt {attempt + 1}): {type(e).__name__}: {e}")
    return None


def stream_llm_response(user_text, emotion=None, mental_state=None, history=None, memory_context=None,
                        user_name=None, recent_replies=None):
    """Yield the reply in pieces as the model writes it. Yields nothing if the LLM is unavailable
    or fails before producing text (the caller then falls back to a template)."""
    unrelated = check_unrelated_request(user_text)
    if unrelated:
        yield unrelated
        return

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
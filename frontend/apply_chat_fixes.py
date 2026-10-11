"""
Run from the repo root (the folder that contains backend/ and frontend/):

    python apply_chat_fixes.py

It edits two files, saves a .bak copy of each first, and prints what it changed.
Re-running it is safe: anything already patched is skipped.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(".")
MAIN = ROOT / "backend" / "main.py"
CHAT_UI = ROOT / "frontend" / "src" / "pages" / "Support" / "AISupport.jsx"


def read(path):
    raw = path.read_bytes()
    crlf = b"\r\n" in raw
    text = raw.decode("utf-8").replace("\r\n", "\n")
    return text, crlf


def write(path, text, crlf):
    if crlf:
        text = text.replace("\n", "\r\n")
    path.write_bytes(text.encode("utf-8"))


HELPER = '''def get_recent_history(user_id, conv_id, limit=6):
    """Last few turns of this conversation, shaped for the LLM."""
    if not conv_id or not db_manager.is_connected() or db_manager.chat_history is None:
        return []
    try:
        docs = list(
            db_manager.chat_history
            .find({"user_id": user_id, "conversation_id": conv_id}, {"_id": 0, "message": 1, "response": 1})
            .sort("timestamp", -1)
            .limit(limit)
        )
    except Exception:
        return []
    docs.reverse()
    history = []
    for d in docs:
        if d.get("message"):
            history.append({"role": "user", "content": d["message"]})
        if d.get("response"):
            history.append({"role": "assistant", "content": d["response"]})
    return history


'''


def patch_main():
    if not MAIN.exists():
        print(f"!! {MAIN} not found - run this from the repo root.")
        return
    shutil.copy(MAIN, MAIN.with_suffix(".py.bak"))
    text, crlf = read(MAIN)
    changes = 0

    # 1) generate_response accepts history and forwards it (+ add helper above it)
    pat = re.compile(
        r"def generate_response\(emotion, mental_state, user_text\):\n(\s+)llm_reply = generate_llm_response\(user_text, emotion, mental_state\)"
    )
    if pat.search(text):
        helper = "" if "def get_recent_history" in text else HELPER
        text = pat.sub(
            lambda m: helper
            + "def generate_response(emotion, mental_state, user_text, history=None):\n"
            + m.group(1)
            + "llm_reply = generate_llm_response(user_text, emotion, mental_state, history)",
            text,
            count=1,
        )
        changes += 1
        print("OK  main.py: generate_response now receives conversation history")
    else:
        print("--  main.py: generate_response already patched or has a different shape (skipped)")

    # 2) /chat passes history into generate_response
    pat = re.compile(r"response = generate_response\(\s*final_emotion,\s*mental_state,\s*user_input\s*\)")
    if pat.search(text) and "get_recent_history(user_id, conv_id)" not in text:
        text = pat.sub(
            "history = get_recent_history(user_id, conv_id)\n"
            "    response = generate_response(\n"
            "        final_emotion,\n"
            "        mental_state,\n"
            "        user_input,\n"
            "        history\n"
            "    )",
            text,
            count=1,
        )
        changes += 1
        print("OK  main.py: /chat now loads recent history and passes it on")
    else:
        print("--  main.py: /chat call already patched or has a different shape (skipped)")

    # 3) safety: the 'friend/movie/book...' shortcut must never hide a self-harm phrase
    pat = re.compile(r"(?m)^(\s*)if any\(ctx in text_lower for ctx in safe_contexts\):")
    if pat.search(text):
        def repl(m):
            i = m.group(1)
            return (
                f'{i}hard_stop_phrases = ["suicide", "kill myself", "end my life", "want to die", '
                f'"overdose", "self harm", "cutting myself", "hanging myself"]\n'
                f"{i}if any(ctx in text_lower for ctx in safe_contexts) and not any(p in text_lower for p in hard_stop_phrases):"
            )
        text = pat.sub(repl, text, count=1)
        changes += 1
        print("OK  main.py: safe-context shortcut no longer skips self-harm phrases")
    else:
        print("--  main.py: safe-context shortcut not found (already fixed in your copy?)")

    write(MAIN, text, crlf)
    print(f"    main.py: {changes} change(s) applied (backup: backend/main.py.bak)\n")


def patch_ui():
    if not CHAT_UI.exists():
        print(f"!! {CHAT_UI} not found - run this from the repo root.")
        return
    shutil.copy(CHAT_UI, CHAT_UI.with_suffix(".jsx.bak"))
    text, crlf = read(CHAT_UI)
    changes = 0

    if "sustainedDistress" in text:
        print("--  AISupport.jsx: already patched (skipped)")
    else:
        decl = re.compile(r'(?m)^(\s*)const isMediumRisk = msg\.safety\?\.riskLevel === "MEDIUM";')
        btn = 'msg.sender === "ai" && isMediumRisk && ('
        if decl.search(text) and btn in text:
            def add_decl(m):
                i = m.group(1)
                return (
                    m.group(0) + "\n"
                    f"{i}// Nudge towards Safe Place only when distress is sustained (3 of the last 4 AI replies),\n"
                    f"{i}// not after a single hard-day message.\n"
                    f'{i}const recentAiReplies = messages.slice(0, index + 1).filter(m => m.sender === "ai").slice(-4);\n'
                    f'{i}const sustainedDistress = recentAiReplies.filter(m => m.safety?.riskLevel === "MEDIUM").length >= 3;'
                )
            text = decl.sub(add_decl, text, count=1)
            text = text.replace(btn, 'msg.sender === "ai" && isMediumRisk && sustainedDistress && (', 1)
            changes += 1
            print("OK  AISupport.jsx: 'Contact My Safe Place' now needs sustained distress")
        else:
            print("--  AISupport.jsx: expected lines not found (different version?) - skipped")

    write(CHAT_UI, text, crlf)
    print(f"    AISupport.jsx: {changes} change(s) applied (backup: AISupport.jsx.bak)\n")


if __name__ == "__main__":
    patch_main()
    patch_ui()
    print("Done. Now copy rag.py and knowledge_base.json into place (see instructions) and restart the backend.")
    sys.exit(0)
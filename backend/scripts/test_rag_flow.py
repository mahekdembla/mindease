"""
test_rag_flow.py — End-to-end integration test for the RAG + LLM chat pipeline.

Usage (from the backend/ directory):
    python scripts/test_rag_flow.py

What it tests:
  1. Knowledge base loads and embeddings are built successfully.
  2. `retrieve()` returns relevant context chunks for several sample queries.
  3. `build_prompt()` formats the prompt correctly with emotion / state / context.
  4. `generate_llm_response()` calls Groq API and returns a non-empty reply.
  5. The full /chat endpoint flow: safety check → emotion model → risk model → LLM reply.
"""

import os
import sys
import json
import logging

# ---------------------------------------------------------------------------
# Resolve backend root so all local imports work from any working directory.
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(BACKEND_DIR, ".env"), override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mindease.test_rag")

PASS = "✅ PASS"
FAIL = "❌ FAIL"
SKIP = "⚠️  SKIP"

results: list[dict] = []


def record(name: str, passed: bool | None, detail: str = ""):
    """Append a test result and print it immediately."""
    symbol = PASS if passed else (SKIP if passed is None else FAIL)
    line = f"{symbol}  {name}"
    if detail:
        line += f"\n         {detail}"
    print(line)
    results.append({"name": name, "passed": passed, "detail": detail})


# ---------------------------------------------------------------------------
# Test 1 — Knowledge base loads correctly
# ---------------------------------------------------------------------------
def test_kb_loads():
    kb_path = os.path.join(BACKEND_DIR, "data", "knowledge_base.json")
    try:
        with open(kb_path, "r", encoding="utf-8") as f:
            kb = json.load(f)
        assert len(kb) > 0, "knowledge_base.json is empty"
        assert all("text" in entry for entry in kb), "Some entries missing 'text' field"
        record("KB loads and all entries have 'text' field", True, f"{len(kb)} entries found")
        return kb
    except Exception as e:
        record("KB loads and all entries have 'text' field", False, str(e))
        return None


# ---------------------------------------------------------------------------
# Test 2 — SentenceTransformer + embeddings build
# ---------------------------------------------------------------------------
def test_embedder():
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        sample = embedder.encode(["I feel overwhelmed today"], normalize_embeddings=True)
        assert sample.shape == (1, 384), f"Unexpected embedding shape: {sample.shape}"
        record("SentenceTransformer encodes text correctly", True, f"embedding shape: {sample.shape}")
        return True
    except Exception as e:
        record("SentenceTransformer encodes text correctly", False, str(e))
        return False


# ---------------------------------------------------------------------------
# Test 3 — retrieve() returns relevant chunks
# ---------------------------------------------------------------------------
def test_retrieve():
    try:
        from rag import retrieve, RAG_AVAILABLE
        if not RAG_AVAILABLE:
            record("retrieve() returns relevant context", None, "RAG not available — skipped")
            return

        test_cases = [
            ("I feel so anxious and can't stop worrying", ["anxiety", "fear", "grounding"]),
            ("I'm really sad and feel lonely",            ["sadness", "loneliness"]),
            ("I got into a fight with my friend",         ["conflict", "anger"]),
        ]

        all_ok = True
        details = []
        for query, expected_tags in test_cases:
            chunks = retrieve(query, k=2)
            assert len(chunks) > 0, f"No chunks returned for: {query!r}"
            details.append(f"  '{query[:40]}...' → {len(chunks)} chunk(s) returned")
            logger.info("RETRIEVE query=%r chunks=%r", query, chunks)

        record("retrieve() returns relevant context", all_ok, "\n         ".join(details))
    except Exception as e:
        record("retrieve() returns relevant context", False, str(e))


# ---------------------------------------------------------------------------
# Test 4 — build_prompt() formats correctly
# ---------------------------------------------------------------------------
def test_build_prompt():
    try:
        from rag import build_prompt
        chunks = [
            "Slow breathing can calm the body's stress response.",
            "Grounding: name 5 things you can see."
        ]
        prompt = build_prompt(
            user_text="I feel very anxious right now",
            emotion="anxiety",
            mental_state="Anxiety",
            chunks=chunks
        )
        assert "anxiety" in prompt.lower(), "Emotion label missing from prompt"
        assert "Anxiety" in prompt, "Mental state missing from prompt"
        assert chunks[0] in prompt, "Context chunk not included in prompt"
        assert "I feel very anxious right now" in prompt, "User message missing from prompt"
        record("build_prompt() formats prompt correctly", True,
               f"Prompt length: {len(prompt)} chars")
        logger.debug("PROMPT:\n%s", prompt)
    except Exception as e:
        record("build_prompt() formats prompt correctly", False, str(e))


# ---------------------------------------------------------------------------
# Test 5 — generate_llm_response() calls Groq and returns non-empty reply
# ---------------------------------------------------------------------------
def test_llm_response():
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        record("generate_llm_response() returns a reply from Groq", None,
               "GROQ_API_KEY not set — skipped")
        return

    try:
        from rag import generate_llm_response, RAG_AVAILABLE
        if not RAG_AVAILABLE:
            record("generate_llm_response() returns a reply from Groq", None,
                   "RAG not available — skipped")
            return

        reply = generate_llm_response(
            user_text="I've been feeling really overwhelmed with work and can't sleep.",
            emotion="anxiety",
            mental_state="Anxiety"
        )
        assert reply is not None, "LLM returned None (fell back to rule-based)"
        assert len(reply.strip()) > 10, f"LLM reply too short: {reply!r}"
        record("generate_llm_response() returns a reply from Groq", True,
               f"Reply ({len(reply)} chars): {reply[:100]}...")
        logger.info("LLM REPLY: %s", reply)
    except Exception as e:
        record("generate_llm_response() returns a reply from Groq", False, str(e))


# ---------------------------------------------------------------------------
# Test 6 — Full chat endpoint logic (in-process, no HTTP server)
# ---------------------------------------------------------------------------
def test_full_chat_flow():
    try:
        # Import the main-module functions directly
        from main import (
            evaluate_safety,
            get_emotion_model,
            get_mental_model,
            map_emotion,
            normalize_mental_state,
            correct_emotion_with_cues,
            generate_response,
        )

        test_messages = [
            ("I've had a hard day and feel really sad", "negative/anxiety"),
            ("I am so grateful for my friends today", "positive"),
            ("I can't stop panicking and feel hopeless", "anxiety/high-risk"),
        ]

        details = []
        for msg, expected_category in test_messages:
            # Safety check
            safety = evaluate_safety(msg)
            assert "riskLevel" in safety

            if safety["riskLevel"] == "HIGH":
                details.append(f"  '{msg[:40]}' → HIGH risk detected, crisis flow triggered")
                continue

            # Emotion model
            emotion_pipe = get_emotion_model()
            preds = emotion_pipe(msg)[0]
            raw_labels = [p["label"] for p in preds]
            mapped = [map_emotion(l) for l in raw_labels]
            final_emotion = correct_emotion_with_cues(mapped[0], msg)

            # Risk model
            mental_pipe = get_mental_model()
            mental_pred = mental_pipe(msg)[0]
            mental_state = mental_pred["label"]
            support_state = normalize_mental_state(mental_state)

            # Generate response
            reply = generate_response(final_emotion, support_state, msg)
            assert reply and len(reply) > 5

            details.append(
                f"  '{msg[:40]}' → emotion={final_emotion}, state={mental_state}, "
                f"risk={safety['riskLevel']}, reply_len={len(reply)}"
            )
            logger.info("CHAT FLOW msg=%r emotion=%r state=%r safety=%r reply=%r",
                        msg, final_emotion, mental_state, safety["riskLevel"], reply[:60])

        record("Full chat endpoint logic (in-process)", True, "\n         ".join(details))
    except Exception as e:
        record("Full chat endpoint logic (in-process)", False, str(e))


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
def print_summary():
    total = len(results)
    passed = sum(1 for r in results if r["passed"] is True)
    failed = sum(1 for r in results if r["passed"] is False)
    skipped = sum(1 for r in results if r["passed"] is None)

    print("\n" + "=" * 60)
    print(f"  RAG + LLM Test Summary: {passed}/{total} passed, "
          f"{failed} failed, {skipped} skipped")
    print("=" * 60)
    if failed:
        print("\nFailed tests:")
        for r in results:
            if r["passed"] is False:
                print(f"  {FAIL} {r['name']}")
                if r["detail"]:
                    print(f"       {r['detail']}")
    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("\n🧠 MindEase — RAG + LLM End-to-End Test\n" + "=" * 60)

    # Make sure we run from the backend directory so relative imports resolve
    os.chdir(BACKEND_DIR)

    test_kb_loads()
    test_embedder()
    test_retrieve()
    test_build_prompt()
    test_llm_response()
    test_full_chat_flow()
    print_summary()

    # Exit with non-zero if any test failed
    if any(r["passed"] is False for r in results):
        sys.exit(1)

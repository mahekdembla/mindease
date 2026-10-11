"""
Speed-ups for the MindEase backend (backup saved as main.py.bak_speed):
  1. Warm-up: all models load once when the server starts, so the first chat message is not slow
     (set WARM_UP_MODELS=0 in backend/.env to skip it while developing).
  2. DISABLE_SAFETY_MODEL=1 in backend/.env skips the slow zero-shot model. On the held-out data it added no
     detections at the current thresholds, and MEDIUM no longer needs it.
  3. TIMING_LOGS=1 in backend/.env prints how long each step of a request takes (off by default).
  4. The dashboard's Groq call gives up after 6 seconds instead of making the page wait.

Run from the repo root:   python apply_backend_speedup.py      (the script can live anywhere)
Safe to run twice. If an anchor is not found it changes nothing and says which one.
"""
import re, shutil, sys
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("backend/main.py")
raw = path.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")
problems = []

def edit(done, old, new, label):
    global text
    if done in text:
        print("already :", label)
    elif text.count(old) == 1:
        text = text.replace(old, new)
        print("applied :", label)
    else:
        problems.append(label)

# 1. DISABLE_SAFETY_MODEL switch
edit("DISABLE_SAFETY_MODEL",
     "def get_safety_model():\n    global _safety_model\n",
     "def get_safety_model():\n    global _safety_model\n"
     "    if os.environ.get(\"DISABLE_SAFETY_MODEL\") == \"1\":\n"
     "        return None  # skip the slow zero-shot model; keywords + fine-tuned classifier still decide\n",
     "DISABLE_SAFETY_MODEL switch")

# 2. warm-up at startup
WARM = '''print("Backend initialization complete (models configured for on-demand loading).")


def _warm_up_models():
    """Load every model once at startup so the first chat message is not slow."""
    import time as _t
    t0 = _t.perf_counter()
    try:
        evaluate_safety("hello")        # loads the risk classifier (and the zero-shot model unless disabled)
        get_emotion_model()("hello")    # loads the emotion model
        try:
            from rag import retrieve
            retrieve("hello")           # loads the sentence-embedding model
        except Exception:
            pass
        print(f"[warm-up] models ready in {_t.perf_counter() - t0:.1f}s", flush=True)
    except Exception as e:
        print(f"[warm-up] skipped: {e}", flush=True)
'''
edit("def _warm_up_models",
     'print("Backend initialization complete (models configured for on-demand loading).")\n', WARM,
     "warm-up function")
edit("WARM_UP_MODELS",
     "    db_manager.connect_db()\n    yield\n",
     "    db_manager.connect_db()\n    if os.environ.get(\"WARM_UP_MODELS\", \"1\") == \"1\":\n        _warm_up_models()\n    yield\n",
     "warm-up on startup")

# 3. optional timing logs (appended at the end of the file)
TIMING = '''

# TIMING LOGS (set TIMING_LOGS=1 in backend/.env to see where a request spends its time)
if os.environ.get("TIMING_LOGS") == "1":
    import time as _time

    def _timed(fn, label):
        def wrapper(*a, **k):
            t = _time.perf_counter()
            try:
                return fn(*a, **k)
            finally:
                print(f"[timing]   {label}: {_time.perf_counter() - t:.2f}s", flush=True)
        wrapper.__name__ = fn.__name__
        return wrapper

    evaluate_safety = _timed(evaluate_safety, "safety check")
    generate_response = _timed(generate_response, "reply (retrieval + LLM)")
    save_chat = _timed(save_chat, "save to database")

    @app.middleware("http")
    async def _log_request_time(request, call_next):
        t = _time.perf_counter()
        response = await call_next(request)
        print(f"[timing] {request.method} {request.url.path}: {_time.perf_counter() - t:.2f}s total", flush=True)
        return response
'''
if "TIMING LOGS (set TIMING_LOGS" in text:
    print("already : timing logs")
else:
    text = text.rstrip("\n") + "\n" + TIMING
    print("applied : timing logs")

# 4. dashboard Groq call gives up after 6 seconds
if "timeout=6," in text:
    print("already : dashboard timeout")
else:
    pat = re.compile(r"(max_tokens=\d+,\n(\s+)temperature=0\.5,\n)")
    if len(pat.findall(text)) == 1:
        text = pat.sub(lambda m: m.group(1) + m.group(2) + "timeout=6,\n", text, count=1)
        print("applied : dashboard timeout")
    else:
        problems.append("dashboard Groq call")

if problems:
    print("\nNOTHING WAS WRITTEN. Could not find:", ", ".join(problems))
    print("main.py may differ from the version I expected; send it to me and I will adjust.")
    sys.exit(1)

if (text.replace("\n", "\r\n") if crlf else text) != raw:
    shutil.copy(path, str(path) + ".bak_speed")
    path.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))
print("\ndone. Add to backend/.env:  DISABLE_SAFETY_MODEL=1   (and TIMING_LOGS=1 while measuring)")
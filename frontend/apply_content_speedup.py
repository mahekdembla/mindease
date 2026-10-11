"""
Speeds up Healing Space (Stories, Articles, YouTube videos). Backups are saved as <file>.bak_speed.

Why it was slow (found in the code):
  * YouTube: every visit checked ~19 videos ONE BY ONE (2 web requests each, up to 3 s apiece).
  * Stories/Articles: every visit re-checked every item's link ONE BY ONE, re-wrote 24 database records
    one at a time, and ran a cleanup query.

What this changes:
  * Video and link checks run in parallel, are remembered (videos 6 h, links 12 h), and a background check is
    started when the server starts, so visitors do not wait for them.
  * Links are never checked while a visitor waits: a link not checked yet is assumed fine, and replaced on
    the next visit if the background check finds it broken.
  * The default content is written to the database once per server start (in one request, not 24); the cleanup
    runs once per server start. POST /api/content/seed still forces a re-seed.

Run from the repo root:   python apply_content_speedup.py      (the script can live anywhere)
Safe to run twice. If an anchor is not found it changes nothing and says which one.
"""
import re, shutil, sys
from pathlib import Path

BACKEND = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("backend")
CS = BACKEND / "services/content_service.py"
YT = BACKEND / "services/youtube_service.py"
RT = BACKEND / "routers/content_router.py"

def read(p):
    raw = p.read_bytes().decode("utf-8")
    return raw, raw.replace("\r\n", "\n"), "\r\n" in raw

problems, results = [], []

# ------------------------------------------------------------------ content_service.py
raw, text, crlf = read(CS)
orig_text = text

URL_CACHE = '''

# ---- link checks: parallel, remembered, and never run while a visitor waits ----
import threading, time
from concurrent.futures import ThreadPoolExecutor

_URL_CHECK_CACHE: Dict[str, tuple] = {}      # url -> (is_ok, checked_at)
_URL_CHECK_TTL = 12 * 3600
_URL_CHECK_LOCK = threading.Lock()
_URL_CHECK_PENDING = set()
_PURGED_CATEGORIES = set()                    # legacy-cleanup already done for these categories
_SEEDED = False                               # default content already written to MongoDB


def _url_check_is_fresh(url: str) -> bool:
    entry = _URL_CHECK_CACHE.get(url)
    return entry is not None and time.time() - entry[1] < _URL_CHECK_TTL


def _check_urls_in_background(urls) -> None:
    with _URL_CHECK_LOCK:
        todo = [u for u in dict.fromkeys(urls) if u and u not in _URL_CHECK_PENDING and not _url_check_is_fresh(u)]
        _URL_CHECK_PENDING.update(todo)
    if not todo:
        return

    def run():
        try:
            with ThreadPoolExecutor(max_workers=8) as pool:
                for url, ok in zip(todo, pool.map(verify_url_accessibility, todo)):
                    _URL_CHECK_CACHE[url] = (ok, time.time())
        finally:
            with _URL_CHECK_LOCK:
                _URL_CHECK_PENDING.difference_update(todo)

    threading.Thread(target=run, daemon=True).start()


def _is_url_ok(url: str) -> bool:
    entry = _URL_CHECK_CACHE.get(url)
    return True if entry is None else entry[0]   # not checked yet -> assume fine


'''
if "_check_urls_in_background" in text:
    print("already : content_service: link-check cache")
else:
    anchor = "# ==============================================================================\n# CURATED CHILDHOOD WISDOM"
    if text.count(anchor) == 1:
        text = text.replace(anchor, URL_CACHE.lstrip("\n") + anchor)
        print("applied : content_service: link-check cache")
    else:
        problems.append("content_service: insertion point for the cache")

OLD_LOOP = '''    for item in items:
        orig_url = item.get("original_url", "")
        if orig_url and not verify_url_accessibility(orig_url):'''
NEW_LOOP = '''    _check_urls_in_background([i.get("original_url", "") for i in items])
    for item in items:
        orig_url = item.get("original_url", "")
        if orig_url and not _is_url_ok(orig_url):'''
if "_is_url_ok(orig_url)" in text:
    print("already : content_service: cached link check")
elif text.count(OLD_LOOP) == 1:
    text = text.replace(OLD_LOOP, NEW_LOOP)
    print("applied : content_service: cached link check")
else:
    problems.append("content_service: link-check loop")

# legacy cleanup once per category
purge = re.compile(r"(?P<ind> {12})content_collection\.delete_many\(\{.*?\n {12}\}\)\n", re.S)
if "_PURGED_CATEGORIES.add(category)" in text:
    print("already : content_service: cleanup once")
else:
    m = purge.search(text)
    if m and len(purge.findall(text)) == 1:
        block = m.group(0)
        indented = "".join("    " + ln if ln.strip() else ln for ln in block.splitlines(True))
        new = (" " * 12 + "if category not in _PURGED_CATEGORIES:\n" + indented +
               " " * 16 + "_PURGED_CATEGORIES.add(category)\n")
        text = text[:m.start()] + new + text[m.end():]
        print("applied : content_service: cleanup once")
    else:
        problems.append("content_service: legacy cleanup block")

# seed once, in one round trip
SEED_NEW = '''def seed_default_content(force: bool = False) -> bool:
    """
    Writes the default stories, articles and books to MongoDB.
    Runs once per server start (force=True to run again), using one bulk request instead of one per item.
    """
    global _SEEDED
    if _SEEDED and not force:
        return True

    db = db_manager.db
    if not db_manager.is_connected() or db is None:
        return False

    try:
        from pymongo import UpdateOne
        content_collection = db["content"]
        ops = [
            UpdateOne({"id": item["id"]}, {"$set": dict(item)}, upsert=True)
            for item in DEFAULT_STORIES + DEFAULT_ARTICLES + DEFAULT_BOOKS
        ]
        content_collection.bulk_write(ops, ordered=False)
        _SEEDED = True
        logger.info("Successfully synced distinct Stories, Articles, and Book models in MongoDB.")
        return True
    except Exception as e:
        logger.error(f"Error seeding default content: {e}")
        return False


'''
if "def seed_default_content(force" in text:
    print("already : content_service: seed once")
else:
    m = re.search(r"def seed_default_content\(\) -> bool:.*?(?=\ndef process_and_ingest_url)", text, re.S)
    if m:
        text = text[:m.start()] + SEED_NEW.rstrip("\n") + "\n\n" + text[m.end():]
        print("applied : content_service: seed once")
    else:
        problems.append("content_service: seed_default_content")
results.append((CS, raw, text, crlf))

# ------------------------------------------------------------------ youtube_service.py
raw, text, crlf = read(YT)
YT_NEW = '''def get_youtube_videos() -> List[Dict[str, Any]]:
    """
    Returns the verified (active, embeddable, real thumbnail) videos.
    Videos are checked in parallel and the result is remembered for 6 hours; a check also starts when the
    server starts, so visitors do not wait for it.
    """
    cached = _VIDEO_CACHE["videos"]
    if cached is not None:
        if time.time() - _VIDEO_CACHE["at"] >= _VIDEO_TTL:      # stale: refresh quietly, serve the current list
            threading.Thread(target=_refresh_video_cache, daemon=True).start()
        return cached
    return _refresh_video_cache()


import threading, time
from concurrent.futures import ThreadPoolExecutor

_VIDEO_CACHE: Dict[str, Any] = {"videos": None, "at": 0.0}
_VIDEO_TTL = 6 * 3600
_VIDEO_LOCK = threading.Lock()


def _refresh_video_cache() -> List[Dict[str, Any]]:
    with _VIDEO_LOCK:
        if _VIDEO_CACHE["videos"] is not None and time.time() - _VIDEO_CACHE["at"] < _VIDEO_TTL:
            return _VIDEO_CACHE["videos"]
        with ThreadPoolExecutor(max_workers=8) as pool:
            flags = list(pool.map(verify_video_availability, CANDIDATE_VIDEOS))
        verified = [v for v, ok in zip(CANDIDATE_VIDEOS, flags) if ok]
        for v, ok in zip(CANDIDATE_VIDEOS, flags):
            if not ok:
                logger.info(f"Filtered out unavailable/blocked video: {v.get('id')} - {v.get('title')}")
        stamp = time.time()
        if not verified:
            logger.warning("No video passed verification (offline?). Showing the full curated list for now.")
            verified = list(CANDIDATE_VIDEOS)
            stamp = time.time() - _VIDEO_TTL + 120          # look again in 2 minutes
        _VIDEO_CACHE.update(videos=verified, at=stamp)
        return verified


# start checking as soon as the server starts
threading.Thread(target=_refresh_video_cache, daemon=True).start()
'''
if "_refresh_video_cache" in text:
    print("already : youtube_service: parallel cached check")
else:
    m = re.search(r"def get_youtube_videos\(\) -> List\[Dict\[str, Any\]\]:.*\Z", text.replace("\r\n", "\n"), re.S)
    t = raw.replace("\r\n", "\n")
    m = re.search(r"def get_youtube_videos\(\) -> List\[Dict\[str, Any\]\]:.*\Z", t, re.S)
    if m:
        text = t[:m.start()] + YT_NEW
        print("applied : youtube_service: parallel cached check")
    else:
        text = raw.replace("\r\n", "\n")
        problems.append("youtube_service: get_youtube_videos")
results.append((YT, raw, text if "_refresh_video_cache" in text else raw.replace("\r\n", "\n"), crlf))

# ------------------------------------------------------------------ content_router.py
raw, text, crlf = read(RT)
if "seed_default_content(force=True)" in text:
    print("already : content_router: /seed forces a re-seed")
elif text.count("success = seed_default_content()") == 1:
    text = text.replace("success = seed_default_content()", "success = seed_default_content(force=True)")
    print("applied : content_router: /seed forces a re-seed")
else:
    problems.append("content_router: /seed endpoint")
results.append((RT, raw, text, crlf))

if problems:
    print("\nNOTHING WAS WRITTEN. Could not find:", "; ".join(problems))
    print("Your files may differ from the version I expected; send them to me and I will adjust.")
    sys.exit(1)

for path, old_raw, new_text, crlf in results:
    new_raw = new_text.replace("\n", "\r\n") if crlf else new_text
    if new_raw != old_raw:
        shutil.copy(path, str(path) + ".bak_speed")
        path.write_bytes(new_raw.encode("utf-8"))
print("\ndone. Restart the backend.")
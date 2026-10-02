import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Candidates to test
test_videos = [
    # User's sketch link
    ("CkP_8bkjf1E", "After Skool - Overthinking Sketch"),
    ("iG9CE55wbtY", "RSA Animate Drive"),
    ("d714-D4o7yU", "Psych2Go Burnout"),
    
    # TED & TEDx
    ("v10o18G8t90", "Olivia Remes Anxiety TEDx"),
    ("m3-O7gPsQK0", "Kelly McGonigal Stress TED"),
    ("gLwB9Y69J9E", "Alison Ledgerwood Negative TEDx"),
    ("iCvmsMzlF7o", "Mel Robbins TEDx"),
    ("C_p4f_d4qHw", "Leon Taylor Mental Health TEDx"),
    ("fAJ3m2-RntU", "Susan David Emotional Courage TED"),
    ("UNQhuFL6CWg", "Amy Cuddy Body Language TED"),
    ("WWloIAQVKCg", "Brene Brown Vulnerability TED"),
    ("7o4O_1nE2zs", "Dr Aditi Nerurkar TEDx"),
    ("IvtZBUSplr4", "Tim Urban Procrastination TED"),
    ("8KkKuTCFvzI", "Sarah Knight TEDx"),
    
    # Guided Meditation & Relaxation
    ("inpok4MKVLM", "Goodful Meditation"),
    ("ZToicYcHIOU", "Declutter The Mind Meditation"),
    ("O-6f5wQTY68", "10 Min Meditation"),
    
    # Breathing
    ("1vZWEpG1k34", "Therapy in a Nutshell 54321"),
    ("tEmt1Znux58", "478 Breathing"),
    ("acUZdGd_3Dg", "Box Breathing"),
    
    # Sleep
    ("aEqlQvczMjQ", "Jason Stephenson Sleep"),
    ("1ZYbU82GVz4", "Yellow Brick Cinema Sleep"),
    ("r3lWJgWw1Xk", "Deep Sleep Music"),
    
    # Student Stress
    ("arj7oStGLkU", "Thomas Frank Student Stress"),
    ("Py4_t4wS9Jg", "Ali Abdaal"),
    ("k1u1Z12d6_A", "Student Procrastination"),
    ("hN_q-_nGv4U", "Exam Anxiety"),
]

valid = []
invalid = []

for vid_id, name in test_videos:
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid_id}&format=json"
    thumb_url = f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"
    
    is_ok = False
    title = ""
    try:
        req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=4) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                title = data.get("title", "")
                
        # Check thumbnail size
        req_thumb = urllib.request.Request(thumb_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req_thumb, context=ctx, timeout=4) as resp_t:
            content_length = len(resp_t.read())
            # YouTube gray "no thumbnail" image is under 2500 bytes (usually ~1097 bytes)
            if content_length > 3000:
                is_ok = True
            else:
                print(f"FAIL THUMB SIZE ({content_length} bytes): {vid_id} - {name}")
    except Exception as e:
        print(f"FAIL OEMBED ({e}): {vid_id} - {name}")

    if is_ok:
        valid.append((vid_id, name, title))
        print(f"✅ VALID: {vid_id} | {title[:40]}")
    else:
        invalid.append((vid_id, name))

print("\n-------------------------------------------")
print(f"TOTAL VALID: {len(valid)} / {len(test_videos)}")
print(f"INVALID ({len(invalid)}): {invalid}")

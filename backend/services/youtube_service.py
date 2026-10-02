import os
import logging
import urllib.request
import json
import ssl
from typing import List, Dict, Any

logger = logging.getLogger("mindease.youtube_service")

# SSL Context for background oEmbed verification
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# Master Curated Video Candidates
CANDIDATE_VIDEOS: List[Dict[str, Any]] = [
    # --- Sketch & Drawing Explanations (Visual Learning) ---
    {
        "id": "CkP_8bkjf1E",
        "title": "How to Stop Overthinking & Break Negative Thought Loops (Sketch Explanation)",
        "creator": "After Skool",
        "category": "Mental Health Talks",
        "description": "An engaging whiteboard sketch explanation breaking down cognitive distortions, overthinking, and how to quiet a restless mind.",
        "thumbnail": "https://img.youtube.com/vi/CkP_8bkjf1E/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=CkP_8bkjf1E",
        "duration": "10 min",
        "is_sketch": True
    },
    {
        "id": "iG9CE55wbtY",
        "title": "RSA ANIMATE: Drive - The Surprising Truth About Motivation & Stress",
        "creator": "RSA Animate (Whiteboard Sketch)",
        "category": "Inspirational Talks",
        "description": "World-famous RSA whiteboard animation illustrating the psychology of human motivation, stress, and fulfillment.",
        "thumbnail": "https://img.youtube.com/vi/iG9CE55wbtY/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=iG9CE55wbtY",
        "duration": "11 min",
        "is_sketch": True
    },
    {
        "id": "d714-D4o7yU",
        "title": "8 Signs You Are Experiencing Emotional Burnout (Psych2Go Sketches)",
        "creator": "Psych2Go (Animated Drawings)",
        "category": "Mental Health Talks",
        "description": "Illustrated drawings explaining the key psychological signs of burnout and how to gently recover.",
        "thumbnail": "https://img.youtube.com/vi/d714-D4o7yU/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=d714-D4o7yU",
        "duration": "7 min",
        "is_sketch": True
    },
    {
        "id": "IvtZBUSplr4",
        "title": "Inside the Mind of a Master Procrastinator (Illustrated Talk)",
        "creator": "TED - Tim Urban",
        "category": "Student Life & Stress",
        "description": "Tim Urban uses funny illustrations and drawings to explain why we procrastinate and how to overcome deadline panic.",
        "thumbnail": "https://img.youtube.com/vi/IvtZBUSplr4/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=IvtZBUSplr4",
        "duration": "14 min",
        "is_sketch": True
    },

    # --- Featured TED & TEDx Talks ---
    {
        "id": "v10o18G8t90",
        "title": "How to Cope With Anxiety & Overthinking",
        "creator": "TEDxTalks - Dr. Olivia Remes",
        "category": "Mental Health Talks",
        "description": "Cambridge researcher Dr. Olivia Remes shares actionable strategies to overcome anxiety, indecision, and emotional paralysis.",
        "thumbnail": "https://img.youtube.com/vi/v10o18G8t90/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=v10o18G8t90",
        "duration": "15 min"
    },
    {
        "id": "m3-O7gPsQK0",
        "title": "How to Make Stress Your Friend",
        "creator": "TED - Kelly McGonigal",
        "category": "Mental Health Talks",
        "description": "Health psychologist Kelly McGonigal urges us to see stress as a positive force for courage and connection.",
        "thumbnail": "https://img.youtube.com/vi/m3-O7gPsQK0/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=m3-O7gPsQK0",
        "duration": "14 min"
    },
    {
        "id": "gLwB9Y69J9E",
        "title": "Getting Stuck in the Negative (And How to Get Unstuck)",
        "creator": "TEDxTalks - Alison Ledgerwood",
        "category": "Personal Growth",
        "description": "Social psychologist Alison Ledgerwood explains why our brains cling to negative thoughts and how to retrain your perspective.",
        "thumbnail": "https://img.youtube.com/vi/gLwB9Y69J9E/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=gLwB9Y69J9E",
        "duration": "10 min"
    },
    {
        "id": "iCvmsMzlF7o",
        "title": "How to Stop Screwing Yourself Over",
        "creator": "TEDxSF - Mel Robbins",
        "category": "Personal Growth",
        "description": "Mel Robbins breaks down the science of activation energy and how to stop sabotaging your own growth.",
        "thumbnail": "https://img.youtube.com/vi/iCvmsMzlF7o/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=iCvmsMzlF7o",
        "duration": "21 min"
    },
    {
        "id": "C_p4f_d4qHw",
        "title": "How to Manage Your Mental Health",
        "creator": "TEDxClapham - Leon Taylor",
        "category": "Mental Health Talks",
        "description": "Olympic medalist Leon Taylor shares physical and mental toolkits for navigating stress and emotional overload.",
        "thumbnail": "https://img.youtube.com/vi/C_p4f_d4qHw/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=C_p4f_d4qHw",
        "duration": "16 min"
    },
    {
        "id": "fAJ3m2-RntU",
        "title": "The Gift and Power of Emotional Courage",
        "creator": "TED - Susan David",
        "category": "Inspirational Talks",
        "description": "Psychologist Susan David shares how emotional agility helps us navigate life's complexities with acceptance and grace.",
        "thumbnail": "https://img.youtube.com/vi/fAJ3m2-RntU/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=fAJ3m2-RntU",
        "duration": "17 min"
    },
    {
        "id": "UNQhuFL6CWg",
        "title": "Your Body Language May Shape Who You Are",
        "creator": "TED - Amy Cuddy",
        "category": "Inspirational Talks",
        "description": "Social psychologist Amy Cuddy demonstrates how posture and physical presence influence brain chemistry and confidence.",
        "thumbnail": "https://img.youtube.com/vi/UNQhuFL6CWg/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=UNQhuFL6CWg",
        "duration": "21 min"
    },
    {
        "id": "WWloIAQVKCg",
        "title": "The Power of Vulnerability & Self-Compassion",
        "creator": "TED - Dr. Brené Brown",
        "category": "Mental Health Talks",
        "description": "A landmark TED talk exploring how accepting vulnerability fosters deep emotional resilience and human connection.",
        "thumbnail": "https://img.youtube.com/vi/WWloIAQVKCg/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=WWloIAQVKCg",
        "duration": "20 min"
    },

    # --- Guided Meditation & Relaxation ---
    {
        "id": "inpok4MKVLM",
        "title": "10-Minute Guided Meditation for Anxiety & Stress Relief",
        "creator": "Goodful",
        "category": "Guided Meditation & Relaxation",
        "description": "A gentle 10-minute guided meditation designed to calm your nervous system, relieve overthinking, and restore clarity.",
        "thumbnail": "https://img.youtube.com/vi/inpok4MKVLM/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=inpok4MKVLM",
        "duration": "10 min"
    },
    {
        "id": "ZToicYcHIOU",
        "title": "10-Minute Daily Mindfulness Meditation",
        "creator": "Declutter The Mind",
        "category": "Guided Meditation & Relaxation",
        "description": "Start your day with grounded awareness and ease emotional tension with this simple daily practice.",
        "thumbnail": "https://img.youtube.com/vi/ZToicYcHIOU/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=ZToicYcHIOU",
        "duration": "10 min"
    },

    # --- Breathing & Grounding ---
    {
        "id": "1vZWEpG1k34",
        "title": "5-4-3-2-1 Grounding Technique for Panic & Overwhelm",
        "creator": "Therapy in a Nutshell",
        "category": "Breathing & Grounding",
        "description": "Learn the science-backed 5-4-3-2-1 sensory grounding exercise to bring you back to the present moment quickly.",
        "thumbnail": "https://img.youtube.com/vi/1vZWEpG1k34/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=1vZWEpG1k34",
        "duration": "6 min"
    },

    # --- Sleep & Calm ---
    {
        "id": "aEqlQvczMjQ",
        "title": "Nighttime Guided Sleep Meditation for Deep Peace",
        "creator": "Jason Stephenson",
        "category": "Sleep & Calm",
        "description": "Soothing voice guided meditation paired with tranquil soundscapes to drift into restful sleep.",
        "thumbnail": "https://img.youtube.com/vi/aEqlQvczMjQ/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=aEqlQvczMjQ",
        "duration": "20 min"
    },
    {
        "id": "1ZYbU82GVz4",
        "title": "Deep Sleep Delta Waves & Calming Soundscape",
        "creator": "Yellow Brick Cinema",
        "category": "Sleep & Calm",
        "description": "Gentle delta frequencies and relaxing ambient sounds designed to quiet a busy evening mind.",
        "thumbnail": "https://img.youtube.com/vi/1ZYbU82GVz4/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=1ZYbU82GVz4",
        "duration": "30 min"
    },

    # --- Student Life & Stress ---
    {
        "id": "arj7oStGLkU",
        "title": "How to Manage Academic Stress & Prevent Student Burnout",
        "creator": "Thomas Frank",
        "category": "Student Life & Stress",
        "description": "Actionable routines for students to balance study deadlines, overcome exam pressure, and maintain mental health.",
        "thumbnail": "https://img.youtube.com/vi/arj7oStGLkU/hqdefault.jpg",
        "url": "https://www.youtube.com/watch?v=arj7oStGLkU",
        "duration": "11 min"
    }
]


def verify_video_availability(video: Dict[str, Any]) -> bool:
    """
    Strictly verifies YouTube video availability via YouTube oEmbed API and thumbnail image byte length.
    Returns True only if video is active, public, embeddable, and has a real thumbnail (>3000 bytes).
    """
    vid_id = video.get("id")
    if not vid_id:
        return False

    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid_id}&format=json"
    thumb_url = f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"

    try:
        # 1. Verify oEmbed returns HTTP 200
        req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=3) as resp:
            if resp.status != 200:
                return False
            data = json.loads(resp.read().decode('utf-8'))
            if not data.get("title"):
                return False

        # 2. Verify thumbnail image is a real image (> 3000 bytes, YouTube missing image is ~1097 bytes)
        req_thumb = urllib.request.Request(thumb_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req_thumb, context=ssl_ctx, timeout=3) as resp_t:
            img_bytes = len(resp_t.read())
            if img_bytes < 3000:
                logger.warning(f"Video {vid_id} thumbnail byte size ({img_bytes}) is below valid image threshold.")
                return False

        return True

    except Exception as e:
        logger.warning(f"Video {vid_id} failed availability verification: {e}")
        return False


def get_youtube_videos() -> List[Dict[str, Any]]:
    """
    Filter and return ONLY 100% verified, active, embeddable YouTube videos with valid thumbnails.
    """
    verified_videos = []
    for video in CANDIDATE_VIDEOS:
        if verify_video_availability(video):
            verified_videos.append(video)
        else:
            logger.info(f"Filtered out unavailable/blocked video: {video.get('id')} - {video.get('title')}")

    return verified_videos

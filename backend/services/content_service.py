import os
import json
import logging
import datetime
import requests
from typing import List, Dict, Any, Optional

from database.mongodb import db_manager
from services.source_fetcher import fetch_html_content
from services.html_extractor import extract_article_data
from services.content_cleaner import clean_extracted_content
from services.content_validator import is_valid_content, is_duplicate

logger = logging.getLogger("mindease.content_service")

# Initialize Groq client if key is present
api_key = os.environ.get("GROQ_API_KEY")
groq_client = None
if api_key:
    try:
        from groq import Groq
        groq_client = Groq(api_key=api_key)
    except Exception as e:
        logger.warning(f"Could not initialize Groq client in content_service: {e}")


def verify_url_accessibility(url: str, timeout: int = 3) -> bool:
    """
    Background check to verify if a story URL is reachable and accessible.
    """
    if not url or not url.startswith("http"):
        return False
    try:
        res = requests.head(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        if res.status_code < 400:
            return True
        # Fallback to GET if HEAD request is blocked
        res_get = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        return res_get.status_code < 400
    except Exception:
        return False


# ==============================================================================
# CURATED CHILDHOOD WISDOM & MORAL FABLES SEED DATASET (12 Mood Categories)
# ==============================================================================
DEFAULT_STORIES = [
    {
        "id": "story_overwhelmed",
        "category": "story",
        "mood": "Overwhelmed",
        "mood_icon": "🌊",
        "title": "The Boy and the Starfish",
        "author": "Adapted from Loren Eiseley",
        "date": "Classic Moral Parable",
        "read_time": "3 min read",
        "summary": "Thousands of starfish were washed ashore after a fierce storm. A young boy walked along the beach, gently picking them up one by one and throwing them back into the ocean. A passerby laughed and said, 'There are miles of beach and thousands of starfish! You can't possibly make a difference.' The boy picked up another starfish, tossed it safely into the waves, and smiled: 'Made a difference to that one.'",
        "takeaway": "When life feels overwhelming, do not focus on the vastness of the problem. Small, deliberate actions create meaningful change.",
        "original_url": "https://en.wikipedia.org/wiki/The_Starfish_Story",
        "source_name": "Wikipedia Parables",
        "tags": ["Overwhelmed", "Patience", "Action"],
    },
    {
        "id": "story_sadness",
        "category": "story",
        "mood": "Sadness & Grief",
        "mood_icon": "💧",
        "title": "Kisa Gotami and the Mustard Seed",
        "author": "Ancient Buddhist Fable",
        "date": "Folk Wisdom",
        "read_time": "4 min read",
        "summary": "Grieving deeply over loss, a mother named Kisa Gotami sought a remedy to erase her sorrow. She was told to collect a single mustard seed from a house where no one had ever experienced loss or suffering. She visited every home in the village, only to learn that every family had faced grief. Realizing that pain is a universal human experience, she found comfort in shared compassion and learned to let healing begin.",
        "takeaway": "You are never alone in your sorrow. Shared human vulnerability brings profound comfort and emotional healing.",
        "original_url": "https://en.wikipedia.org/wiki/Kisa_Gotami",
        "source_name": "Wikipedia Literature",
        "tags": ["Sadness", "Grief", "Healing"],
    },
    {
        "id": "story_anxiety",
        "category": "story",
        "mood": "Fear & Anxiety",
        "mood_icon": "🌪️",
        "title": "The Two Wolves Within Us",
        "author": "Native Folk Legend",
        "date": "Traditional Parable",
        "read_time": "3 min read",
        "summary": "An old grandfather taught his grandson about life: 'A fight is going on inside me,' he said. 'It is a terrible fight between two wolves. One is Fear, Anxiety, Self-Doubt, and Panic. The other is Peace, Courage, Hope, and Strength.' The grandson thought about it and asked, 'Which wolf will win?' The grandfather quietly replied, 'The one you feed.'",
        "takeaway": "Anxiety grows when we feed it with constant worry. By focusing our attention on grounding thoughts and courage, we nurture inner peace.",
        "original_url": "https://en.wikipedia.org/wiki/Two_Wolves",
        "source_name": "Wikipedia Parables",
        "tags": ["Anxiety", "Courage", "Mindfulness"],
    },
    {
        "id": "story_anger",
        "category": "story",
        "mood": "Anger & Temper",
        "mood_icon": "🔥",
        "title": "The Nails in the Fence",
        "author": "Moral Tale of Wisdom",
        "date": "Classic Fable",
        "read_time": "3 min read",
        "summary": "A young boy with a fierce temper was given a bag of nails and told to hammer one into the fence every time he lost his temper. Over time, as he learned self-control, fewer nails were hammered. Eventually, his father asked him to pull out a nail for every day he kept calm. When all nails were removed, his father pointed to the holes left in the fence: 'When you say things in anger, they leave scars just like these holes. No matter how many times you say sorry, the wound remains.'",
        "takeaway": "Anger passes, but hurtful words can leave lasting scars. Practicing self-control protects the bonds we hold dear.",
        "original_url": "https://en.wikipedia.org/wiki/Fable",
        "source_name": "Folk Wisdom Archive",
        "tags": ["Anger", "Self-Control", "Patience"],
    },
    {
        "id": "story_loneliness",
        "category": "story",
        "mood": "Loneliness",
        "mood_icon": "🌙",
        "title": "The Lion and the Mouse",
        "author": "Aesop's Fables",
        "date": "Ancient Fable",
        "read_time": "3 min read",
        "summary": "A tiny mouse accidentally woke a sleeping lion. The lion prepared to crush it, but the mouse pleaded for mercy, promising to help him one day. Amused, the lion let him go. Days later, the lion was caught in a hunter's heavy net. Hearing his roars, the mouse ran over and gnawed through the ropes, setting the mighty lion free. From that day on, an unlikely friendship blossomed between the smallest mouse and the grandest king.",
        "takeaway": "Meaningful connection knows no boundaries. Kindness and companionship can bloom in the most unexpected places.",
        "original_url": "https://en.wikipedia.org/wiki/The_Lion_and_the_Mouse",
        "source_name": "Wikipedia Fables",
        "tags": ["Loneliness", "Friendship", "Kindness"],
    },
    {
        "id": "story_jealousy",
        "category": "story",
        "mood": "Envy & Jealousy",
        "mood_icon": "🐍",
        "title": "The Dog and His Reflection",
        "author": "Aesop's Fables",
        "date": "Ancient Fable",
        "read_time": "3 min read",
        "summary": "A dog carrying a fine piece of bone crossed a narrow bridge over a clear stream. Looking down, he saw his own reflection in the water and mistook it for another dog holding a much larger bone. Driven by envy and greed, he barked to snatch the other bone. The moment he opened his mouth, his own bone fell into the deep water and sank away.",
        "takeaway": "Envy makes us blind to what we already possess. Cherishing your own journey brings true peace and contentment.",
        "original_url": "https://en.wikipedia.org/wiki/The_Dog_and_Its_Reflection",
        "source_name": "Wikipedia Fables",
        "tags": ["Jealousy", "Gratitude", "Contentment"],
    },
    {
        "id": "story_joy",
        "category": "story",
        "mood": "Joy & Gratitude",
        "mood_icon": "☀️",
        "title": "The King and the Happy Cobbler",
        "author": "Folk Wisdom Tale",
        "date": "Traditional Parable",
        "read_time": "3 min read",
        "summary": "A wealthy king plagued by worries walked through his kingdom and met a poor cobbler singing joyfully while repairing old shoes. The king asked, 'How can you be so happy when you have so little?' The cobbler replied, 'I enjoy my work today, share my bread with my family, and do not carry tomorrow's burdens before tomorrow arrives.'",
        "takeaway": "True happiness is found in present-moment gratitude and living simply with a light heart.",
        "original_url": "https://en.wikipedia.org/wiki/Happiness",
        "source_name": "Folk Wisdom Archive",
        "tags": ["Happy", "Gratitude", "Peace"],
    },
    {
        "id": "story_patience",
        "category": "story",
        "mood": "Patience & Ingenuity",
        "mood_icon": "🌱",
        "title": "The Crow and the Pitcher",
        "author": "Aesop's Fables",
        "date": "Ancient Fable",
        "read_time": "3 min read",
        "summary": "A thirsty crow found a pitcher with water at the bottom, but the water level was too low for his beak to reach. Instead of giving up in frustration, the crow picked up small pebbles one by one and dropped them into the pitcher. Slow pebble after pebble, the water level gradually rose to the top until the crow could drink peacefully.",
        "takeaway": "Patience and small persistent steps solve problems that force and impatience cannot.",
        "original_url": "https://en.wikipedia.org/wiki/The_Crow_and_the_Pitcher",
        "source_name": "Wikipedia Fables",
        "tags": ["Patience", "Persistence", "Problem-Solving"],
    },
    {
        "id": "story_courage",
        "category": "story",
        "mood": "Persistence & Courage",
        "mood_icon": "💪",
        "title": "The Tortoise and the Hare",
        "author": "Aesop's Fables",
        "date": "Ancient Fable",
        "read_time": "3 min read",
        "summary": "A swift hare mocked a slow tortoise and challenged him to a race. The hare dashed ahead and, confident of victory, took a long nap along the path. The tortoise kept moving steadily, step by step, never stopping. When the hare awoke, he saw the tortoise crossing the finish line.",
        "takeaway": "Steady, persistent effort overcomes erratic bursts of speed. Stay focused on your own path.",
        "original_url": "https://en.wikipedia.org/wiki/The_Tortoise_and_the_Hare",
        "source_name": "Wikipedia Fables",
        "tags": ["Persistence", "Focus", "Courage"],
    },
    {
        "id": "story_relationships",
        "category": "story",
        "mood": "Compromise & Harmony",
        "mood_icon": "🤝",
        "title": "The Two Goats on the Narrow Bridge",
        "author": "Panchatantra Tale",
        "date": "Ancient Fable",
        "read_time": "3 min read",
        "summary": "Two stubborn goats met face-to-face on a narrow log bridge over a roaring river. Neither goat was willing to yield or step back, and they locked horns. In their anger, both lost their footing and fell into the river below. In a neighboring village, two wise goats met on the same bridge; one gently knelt down so the other could step over him safely, and both crossed the river in peace.",
        "takeaway": "Humility and mutual compromise build lasting harmony, while stubborn pride hurts both sides.",
        "original_url": "https://en.wikipedia.org/wiki/Fable",
        "source_name": "Panchatantra Archive",
        "tags": ["Relationships", "Compromise", "Harmony"],
    },
]

DEFAULT_ARTICLES = [
    {
        "id": "article_overthinking",
        "category": "article",
        "mood": "Overthinking",
        "mood_icon": "🌀",
        "title": "Cognitive Behavioral Therapy & Cognitive Restructuring",
        "author": "Dr. Aaron Beck & CBT Research Group",
        "date": "Clinical Psychology",
        "read_time": "5 min read",
        "summary": "Cognitive restructuring is a core therapeutic component of Cognitive Behavioral Therapy (CBT) that systematically identifies unhelpful automatic thoughts, such as catastrophizing, black-and-white thinking, and emotional reasoning. By testing internal assumptions against empirical evidence, individuals reframe repetitive negative narratives into balanced, objective perspectives.",
        "takeaway": "Thoughts are hypotheses, not unalterable facts. Identifying cognitive distortions lets you reframe unhelpful internal narratives with evidence-based self-talk.",
        "original_url": "https://en.wikipedia.org/wiki/Cognitive_behavioral_therapy",
        "source_name": "Wikipedia Psychology Archives",
        "tags": ["CBT", "Cognitive Psychology", "Mental Health"],
    },
    {
        "id": "article_burnout",
        "category": "article",
        "mood": "Burnout",
        "mood_icon": "🧘",
        "title": "The Neuroscience of Occupational Burnout & Nervous System Recovery",
        "author": "World Health Organization Research",
        "date": "Neurobiology Digest",
        "read_time": "4 min read",
        "summary": "Sustained workplace and emotional strain elevates cortisol and overactivates the sympathetic nervous system, leading to cognitive fatigue and emotional exhaustion. Clinical research emphasizes that recovering from burnout requires intentional parasympathetic nervous system activation through restorative sleep, digital disengagement, and physiological rest.",
        "takeaway": "Burnout is an autonomic exhaustion signal. Restorative rest and clear boundaries are essential neuro-biological maintenance, not luxury.",
        "original_url": "https://en.wikipedia.org/wiki/Occupational_burnout",
        "source_name": "WHO Health & Neuroscience",
        "tags": ["Burnout", "Neuroscience", "Stress Recovery"],
    },
    {
        "id": "article_overwhelmed",
        "category": "article",
        "mood": "Overwhelmed",
        "mood_icon": "🌊",
        "title": "Polyvagal Theory & Emotional Regulation Under Acute Stress",
        "author": "Dr. Stephen Porges & Clinical Neuroscience",
        "date": "Neuroscience Review",
        "read_time": "4 min read",
        "summary": "When sensory or emotional input exceeds psychological capacity, the autonomic nervous system triggers fight-or-flight distress responses. Polyvagal research demonstrates that somatic grounding techniques—such as extended exhalations, progressive muscle relaxation, and task micro-segmentation—downregulate vagal nerve tension and restore executive brain functioning.",
        "takeaway": "When overwhelmed, regulate your physiological state first through deep exhalations and physical grounding before attempting complex cognitive tasks.",
        "original_url": "https://en.wikipedia.org/wiki/Emotional_regulation",
        "source_name": "Neuroscience & Health",
        "tags": ["Overwhelmed", "Polyvagal Theory", "Somatic Grounding"],
    },
    {
        "id": "article_sadness",
        "category": "article",
        "mood": "Sadness & Grief",
        "mood_icon": "💧",
        "title": "The Dual-Process Model of Coping with Sadness and Loss",
        "author": "American Psychological Association (APA)",
        "date": "Clinical Psychology",
        "read_time": "5 min read",
        "summary": "Sadness is an adaptive emotional mechanism that prompts self-reflection and processing. The Dual-Process Model of Grief highlights that healthy emotional recovery involves gently alternating between confronting sad emotions and engaging in restorative daily activities, allowing healing to proceed at a natural, non-forced pace.",
        "takeaway": "Sadness requires emotional space and self-compassion. Honoring your emotional pace allows natural psychological healing to take root.",
        "original_url": "https://en.wikipedia.org/wiki/Grief",
        "source_name": "APA Psychology Archives",
        "tags": ["Sadness", "Grief Processing", "Mindfulness"],
    },
    {
        "id": "article_anxiety",
        "category": "article",
        "mood": "Fear & Anxiety",
        "mood_icon": "🌪️",
        "title": "Neurobiology of Anxiety: Amygdala Regulation & Exposure Therapy",
        "author": "National Institute of Mental Health (NIMH)",
        "date": "Mental Health Digest",
        "read_time": "5 min read",
        "summary": "Anxiety is driven by hyper-reactivity in the brain's amygdala, signaling perceived threat even when no immediate danger exists. Behavioral neuroscience demonstrates that gradual, controlled exposure combined with mindful acceptance retrains neural pathways, extinguishing panic responses and building distress tolerance.",
        "takeaway": "Anxiety neutralizes when we approach feared scenarios with gentle exposure and acceptance rather than reinforcing panic through avoidance.",
        "original_url": "https://en.wikipedia.org/wiki/Anxiety",
        "source_name": "NIMH Neuroscience",
        "tags": ["Anxiety", "Neurobiology", "Exposure Therapy"],
    },
    {
        "id": "article_anger",
        "category": "article",
        "mood": "Anger & Temper",
        "mood_icon": "🔥",
        "title": "Dialectical Behavior Therapy (DBT): TIPP Skills for Anger De-escalation",
        "author": "Dr. Marsha Linehan & Behavioral Science",
        "date": "DBT Clinical Insights",
        "read_time": "4 min read",
        "summary": "Anger triggers rapid sympathetic nervous system arousal, elevating heart rate and adrenaline. Dialectical Behavior Therapy (DBT) recommends physical TIPP skills (Temperature change, Intense exercise, Paced breathing, Paired muscle relaxation) to quickly reset physiological arousal before engaging in interpersonal communication.",
        "takeaway": "De-escalate bodily arousal first using physical cooling and paced breathing before resolving interpersonal conflicts.",
        "original_url": "https://en.wikipedia.org/wiki/Anger_management",
        "source_name": "Wikipedia Behavioral Science",
        "tags": ["DBT", "Anger Management", "Emotional Control"],
    },
    {
        "id": "article_loneliness",
        "category": "article",
        "mood": "Loneliness",
        "mood_icon": "🌙",
        "title": "The Neurobiology of Social Connection: Overcoming Chronic Loneliness",
        "author": "Harvard Study of Adult Development",
        "date": "Social Psychology Insights",
        "read_time": "5 min read",
        "summary": "Human nervous systems are evolutionarily wired for social bonding; chronic loneliness activates neural pain pathways similar to physical trauma. Decades of longitudinal research show that cultivating even one or two authentic, emotionally safe relationships significantly enhances immune function, cognitive longevity, and life satisfaction.",
        "takeaway": "Quality of emotional connection matters far more than quantity. Authentic vulnerability creates meaningful social belonging.",
        "original_url": "https://en.wikipedia.org/wiki/Loneliness",
        "source_name": "Harvard Health Publishing",
        "tags": ["Loneliness", "Social Connection", "Wellbeing"],
    },
    {
        "id": "article_jealousy",
        "category": "article",
        "mood": "Envy & Jealousy",
        "mood_icon": "🐍",
        "title": "Social Comparison Theory: Transforming Envy into Self-Compassion",
        "author": "Dr. Leon Festinger & Social Psychology",
        "date": "Journal of Social Psychology",
        "read_time": "4 min read",
        "summary": "Social Comparison Theory reveals that envy arises when we compare our internal vulnerability against others' curated external success. Cognitive psychology suggests reframing envy as an informational signal that highlights unfulfilled personal values, redirecting energy away from comparison and toward authentic self-growth.",
        "takeaway": "Envy signals unacknowledged personal values. Reframe envy into an internal roadmap for your own authentic goals.",
        "original_url": "https://en.wikipedia.org/wiki/Social_comparison_theory",
        "source_name": "Wikipedia Psychology",
        "tags": ["Social Comparison", "Self-Compassion", "Mindset"],
    },
    {
        "id": "article_joy",
        "category": "article",
        "mood": "Joy & Gratitude",
        "mood_icon": "☀️",
        "title": "Positive Psychology: The Dopamine Pathways of Gratitude Practices",
        "author": "Dr. Martin Seligman & Positive Psychology Center",
        "date": "Positive Psychology Journal",
        "read_time": "4 min read",
        "summary": "Neuroscientific studies confirm that intentional gratitude practices stimulate dopamine and serotonin synthesis in the brain. Consistently reflecting on positive micro-moments strengthens neural circuits associated with optimism, emotional resilience, and overall life satisfaction.",
        "takeaway": "Gratitude is a neuro-biological practice. Consistently acknowledging positive moments permanently rewires the brain for joy.",
        "original_url": "https://en.wikipedia.org/wiki/Positive_psychology",
        "source_name": "Positive Psychology Center",
        "tags": ["Positive Psychology", "Gratitude", "Neuroplasticity"],
    },
    {
        "id": "article_patience",
        "category": "article",
        "mood": "Patience & Ingenuity",
        "mood_icon": "🌱",
        "title": "Executive Function & Delayed Gratification: The Science of Impulse Control",
        "author": "Stanford Cognitive Science Group",
        "date": "Cognitive Science Review",
        "read_time": "4 min read",
        "summary": "Patience is an executive function mediated by the prefrontal cortex. Behavioral research proves that practicing delayed gratification strengthens cognitive impulse control, reduces anxiety under stress, and enhances long-term problem-solving endurance.",
        "takeaway": "Patience is a trainable cognitive skill built through deliberate delay and steady, incremental practice.",
        "original_url": "https://en.wikipedia.org/wiki/Self-control",
        "source_name": "Cognitive Psychology Review",
        "tags": ["Executive Function", "Patience", "Impulse Control"],
    },
    {
        "id": "article_courage",
        "category": "article",
        "mood": "Persistence & Courage",
        "mood_icon": "💪",
        "title": "Psychological Resilience & Growth Mindset Under Adverse Conditions",
        "author": "Dr. Carol Dweck & Behavioral Research",
        "date": "Psychological Review",
        "read_time": "4 min read",
        "summary": "Resilience is not a static trait but a dynamic psychological capacity. Adopting a growth mindset allows individuals to interpret setbacks as feedback rather than evidence of inadequacy, fostering enduring courage, adaptability, and psychological stamina.",
        "takeaway": "Setbacks provide valuable feedback rather than defining ability. Framing challenges through a growth mindset builds courage.",
        "original_url": "https://en.wikipedia.org/wiki/Psychological_resilience",
        "source_name": "Wikipedia Health Archives",
        "tags": ["Resilience", "Growth Mindset", "Courage"],
    },
    {
        "id": "article_relationships",
        "category": "article",
        "mood": "Compromise & Harmony",
        "mood_icon": "🤝",
        "title": "Nonviolent Communication (NVC): Building Empathy & Interpersonal Harmony",
        "author": "Dr. Marshall Rosenberg & NVC Institute",
        "date": "Relational Psychology Digest",
        "read_time": "5 min read",
        "summary": "Nonviolent Communication (NVC) outlines a four-step relational process: observing without evaluating, articulating feelings, recognizing core human needs, and communicating clear requests. NVC helps resolve interpersonal conflicts without defensiveness or blame.",
        "takeaway": "Communicating underlying emotional needs rather than reactive judgments fosters deep empathy and lasting relational harmony.",
        "original_url": "https://en.wikipedia.org/wiki/Nonviolent_Communication",
        "source_name": "NVC Relational Psychology",
        "tags": ["Relational Psychology", "NVC", "Communication"],
    },
]

# Extensible structure for mood-based Book Recommendations (no UI rendering added yet)
DEFAULT_BOOKS = [
    {
        "id": "book_cbt",
        "category": "book",
        "mood": "Overthinking",
        "mood_icon": "🌀",
        "title": "Feeling Good: The New Mood Therapy",
        "author": "Dr. David D. Burns, MD",
        "summary": "A clinical guide on Cognitive Behavioral Therapy techniques to identify and reframe automatic negative thoughts.",
        "original_url": "https://en.wikipedia.org/wiki/Cognitive_behavioral_therapy",
    },
    {
        "id": "book_trauma",
        "category": "book",
        "mood": "Overwhelmed",
        "mood_icon": "🌊",
        "title": "The Body Keeps the Score",
        "author": "Dr. Bessel van der Kolk, MD",
        "summary": "Explores how stress and trauma reframe bodily nervous pathways, with strategies for somatic recovery.",
        "original_url": "https://en.wikipedia.org/wiki/Emotional_regulation",
    },
]


def summarize_with_llm(raw_text: str, title: str, category: str) -> Dict[str, str]:
    """
    Uses Groq LLM to generate a concise summary/story and a 'What this teaches us' takeaway.
    """
    if not groq_client:
        return {
            "summary": raw_text[:350] + "...",
            "takeaway": "Reflecting on shared wellness experiences helps build self-awareness and practical coping tools."
        }

    prompt = f"""
You are an expert mental health editor for MindEase.
Given the following raw text:

Title: {title}
Content: {raw_text[:2500]}

Generate a JSON response containing:
1. "summary": A clean, empathetic, concise summary (2-3 short paragraphs).
2. "takeaway": A single powerful, practical 1-2 sentence takeaway under the heading "What this teaches us".

Return ONLY valid JSON:
{{
  "summary": "...",
  "takeaway": "..."
}}
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        result_text = completion.choices[0].message.content
        parsed = json.loads(result_text)
        return {
            "summary": parsed.get("summary", raw_text[:300]),
            "takeaway": parsed.get("takeaway", "Every journey offers valuable lessons in self-compassion and mental resilience.")
        }
    except Exception as e:
        logger.warning(f"Groq LLM summarization failed ({e}). Returning extracted snippet.")
        return {
            "summary": raw_text[:350] + "...",
            "takeaway": "Every journey offers valuable lessons in self-compassion and mental resilience."
        }


def get_all_content_items(category: str, mood: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves content items (stories, articles, or books) from MongoDB.
    Performs legacy document cleanup and background URL accessibility checks.
    """
    db = db_manager.db
    items = []

    if db_manager.is_connected() and db is not None:
        try:
            content_collection = db["content"]

            # Purge old legacy story entries that lacked mood_icon, had broken links, or removed stories
            content_collection.delete_many({
                "$or": [
                    {"id": {"$in": ["story_1", "story_2", "story_3", "story_overthinking", "story_burnout", "story_sad", "story_anxious", "story_angry", "story_lonely", "story_jealous", "story_happy", "article_1", "article_2", "article_3"]}},
                    {"category": category, "mood_icon": {"$exists": False}},
                ]
            })

            query = {"category": category}
            if mood and mood != "all":
                query["mood"] = mood

            items = list(content_collection.find(query, {"_id": 0}))
        except Exception as e:
            logger.warning(f"Failed to fetch content from MongoDB ({e}). Serving defaults.")

    default_map = {
        "story": DEFAULT_STORIES,
        "article": DEFAULT_ARTICLES,
        "book": DEFAULT_BOOKS,
    }

    target_defaults = default_map.get(category, DEFAULT_ARTICLES)

    if not items or len(items) != len(target_defaults):
        seed_default_content()
        items = target_defaults
        if mood and mood != "all":
            items = [item for item in items if item.get("mood") == mood]

    # Dynamic Background Link Accessibility Check
    fallback_verified_url = "https://en.wikipedia.org/wiki/Mental_health" if category == "article" else "https://en.wikipedia.org/wiki/Panchatantra"
    for item in items:
        orig_url = item.get("original_url", "")
        if orig_url and not verify_url_accessibility(orig_url):
            logger.info(f"URL {orig_url} failed accessibility check. Substituting with verified reference URL.")
            item["original_url"] = fallback_verified_url
            item["source_name"] = "Wikipedia Health Archives" if category == "article" else "Panchatantra Archives"

    return items


def seed_default_content() -> bool:
    """
    Purges outdated documents from MongoDB and seeds clean moral fables, articles, and book models.
    """
    db = db_manager.db
    if not db_manager.is_connected() or db is None:
        return False

    try:
        content_collection = db["content"]

        # Insert clean moral stories
        for item in DEFAULT_STORIES:
            content_collection.update_one(
                {"id": item["id"]},
                {"$set": dict(item)},
                upsert=True
            )

        # Insert clean health articles
        for item in DEFAULT_ARTICLES:
            content_collection.update_one(
                {"id": item["id"]},
                {"$set": dict(item)},
                upsert=True
            )

        # Insert default book recommendations (extensible model)
        for item in DEFAULT_BOOKS:
            content_collection.update_one(
                {"id": item["id"]},
                {"$set": dict(item)},
                upsert=True
            )
        
        logger.info("Successfully synced distinct Stories, Articles, and Book models in MongoDB.")
        return True
    except Exception as e:
        logger.error(f"Error seeding default content: {e}")
        return False
        logger.error(f"Error seeding default content: {e}")
        return False


def process_and_ingest_url(url: str, category: str, mood: str = "General") -> Dict[str, Any]:
    """
    Full pipeline: URL -> Fetch -> Extract -> Clean -> Validate/Deduplicate -> Summarize -> Save to MongoDB
    """
    db = db_manager.db

    # Step 1: Fetch HTML
    html = fetch_html_content(url)
    
    # Step 2: Extract structured data
    raw_data = extract_article_data(html, url)
    
    # Step 3: Clean content
    cleaned_data = clean_extracted_content(raw_data)

    # Step 4: Validate
    if not is_valid_content(cleaned_data):
        return {"success": False, "error": "Content validation failed. Empty or insufficient text."}

    # Step 5: Check deduplication
    if is_duplicate(db, cleaned_data["original_url"], cleaned_data["title"]):
        return {"success": False, "error": "Content already exists in MindEase library."}

    # Step 6: Summarize using Groq LLM
    summarized = summarize_with_llm(cleaned_data["main_text"], cleaned_data["title"], category)

    # Step 7: Create final item payload
    item_id = f"{category}_{int(datetime.datetime.now().timestamp())}"
    source_domain = url.split("//")[-1].split("/")[0].replace("www.", "")

    new_item = {
        "id": item_id,
        "category": category,
        "mood": mood,
        "mood_icon": "📖",
        "title": cleaned_data["title"],
        "author": cleaned_data["author"],
        "date": cleaned_data["date"] or datetime.date.today().isoformat(),
        "read_time": f"{max(3, len(cleaned_data['main_text']) // 600)} min read",
        "summary": summarized["summary"],
        "takeaway": summarized["takeaway"],
        "original_url": url,
        "source_name": source_domain.capitalize(),
        "tags": ["Moral Fable", "Wisdom Story"],
        "created_at": datetime.datetime.utcnow().isoformat(),
    }

    # Step 8: Save to MongoDB if connected
    if db_manager.is_connected() and db is not None:
        try:
            db["content"].insert_one(dict(new_item))
            new_item.pop("_id", None)
        except Exception as e:
            logger.warning(f"Could not persist new content item to MongoDB: {e}")

    return {"success": True, "data": new_item}

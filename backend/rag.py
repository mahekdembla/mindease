import os
import json
from dotenv import load_dotenv

load_dotenv()

# Safe imports to prevent backend crash if dependencies are missing
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    from groq import Groq
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    kb_path = os.path.join(BASE_DIR, "data", "knowledge_base.json")
    
    with open(kb_path, "r", encoding="utf-8") as f:
        kb = json.load(f)

    kb_texts = [entry["text"] for entry in kb]
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    kb_embeddings = embedder.encode(kb_texts, normalize_embeddings=True)
    
    api_key = os.environ.get("GROQ_API_KEY")
    groq_client = Groq(api_key=api_key) if api_key else None
    RAG_AVAILABLE = True
except Exception as e:
    RAG_AVAILABLE = False
    groq_client = None
    embedder = None


def retrieve(user_text: str, k: int = 2):
    if not RAG_AVAILABLE:
        return []
    query_emb = embedder.encode([user_text], normalize_embeddings=True)[0]
    scores = np.dot(kb_embeddings, query_emb)
    top_idx = np.argsort(scores)[::-1][:k]
    return [kb_texts[i] for i in top_idx]


def build_prompt(user_text, emotion, mental_state, chunks):
    context = "\n".join(f"- {c}" for c in chunks)
    return f"""You are a supportive, non-clinical mental health companion.
Never diagnose. Never claim to be a therapist. Keep replies short (2-3 sentences) and warm.

Detected emotion: {emotion}
Detected mental state: {mental_state}

Relevant guidance:
{context}

User message: "{user_text}"

Write a brief, supportive reply."""


def generate_llm_response(user_text, emotion, mental_state):
    if not RAG_AVAILABLE or not groq_client or not os.environ.get("GROQ_API_KEY"):
        return None  # signal to fall back to the old rule-based response

    chunks = retrieve(user_text)
    prompt = build_prompt(user_text, emotion, mental_state, chunks)

    completion = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.7,
    )
    return completion.choices[0].message.content.strip()
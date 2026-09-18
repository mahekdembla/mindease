import os
import json
from sentence_transformers import SentenceTransformer
import numpy as np
from groq import Groq

embedder = SentenceTransformer("all-MiniLM-L6-v2")

with open("data/knowledge_base.json") as f:
    kb = json.load(f)

kb_texts = [entry["text"] for entry in kb]
kb_embeddings = embedder.encode(kb_texts, normalize_embeddings=True)

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def retrieve(user_text: str, k: int = 2):
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
    if not os.environ.get("GROQ_API_KEY"):
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
import os
import sys
import json
import re
import secrets
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from contextlib import asynccontextmanager
import requests  # type: ignore # pyrefly: ignore [missing-import]

# Add backend directory to sys.path for absolute and relative import compatibility
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv  # type: ignore # pyrefly: ignore [missing-import]
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path, override=True)

from fastapi import FastAPI, Request, Response, Depends, HTTPException, status  # type: ignore # pyrefly: ignore [missing-import]
from fastapi.responses import RedirectResponse, StreamingResponse  # type: ignore # pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware  # type: ignore # pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field  # type: ignore # pyrefly: ignore [missing-import]
from transformers import pipeline  # type: ignore # pyrefly: ignore [missing-import]
from bson import ObjectId  # type: ignore # pyrefly: ignore [missing-import]
from langdetect import detect as detect_language, DetectorFactory  # type: ignore # pyrefly: ignore [missing-import]
from langdetect.lang_detect_exception import LangDetectException  # type: ignore # pyrefly: ignore [missing-import]
DetectorFactory.seed = 0  # deterministic detection (langdetect is otherwise randomized per call)

from rag import generate_llm_response, stream_llm_response, translate_to_english, translate_like
import memory
from database.mongodb import db_manager
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_current_user
)


# LIFECYCLE HANDLER

@asynccontextmanager
async def lifespan(app: FastAPI):
    db_manager.connect_db()
    if os.environ.get("WARM_UP_MODELS", "1") == "1":
        _warm_up_models()
    yield
    memory.flush_all_pending()      # write memory notes still waiting for the conversation to pause
    db_manager.close_db()

# INIT APP

app = FastAPI(lifespan=lifespan)

# FRONTEND / CORS
# FRONTEND_URL: where the React app is served (OAuth redirects land there). In production set it
# to the deployed URL; several origins may be given comma-separated (the first one is used for
# redirects). Any localhost / 127.0.0.1 port is always allowed for local development.

FRONTEND_ORIGINS = [u.strip().rstrip("/") for u in os.environ.get("FRONTEND_URL", "").split(",") if u.strip()]
FRONTEND_URL = FRONTEND_ORIGINS[0] if FRONTEND_ORIGINS else "http://localhost:5173"
COOKIE_SECURE = FRONTEND_URL.startswith("https://")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.content_router import router as content_router
app.include_router(content_router)

from routers.professionals_router import router as professionals_router
app.include_router(professionals_router)




# LOAD MODELS (LAZY / ON-DEMAND LOADER)

def is_valid_local_model(model_path: str) -> bool:
    if not os.path.exists(model_path):
        return False
    return os.path.isfile(os.path.join(model_path, "config.json"))

_emotion_model = None
_mental_model = None
_safety_model = None

def get_emotion_model():
    global _emotion_model
    if _emotion_model is None:
        LOCAL_EMOTION_PATH = "training/models/emotion-classifier"
        HUB_EMOTION_MODEL = "SamLowe/roberta-base-go_emotions"
        if is_valid_local_model(LOCAL_EMOTION_PATH):
            try:
                print(f"Loading local emotion model from: {LOCAL_EMOTION_PATH}")
                _emotion_model = pipeline(
                    "text-classification", truncation=True, max_length=128,
                    model=LOCAL_EMOTION_PATH,
                    tokenizer=LOCAL_EMOTION_PATH,
                    top_k=3
                )
            except Exception:
                _emotion_model = pipeline("text-classification", truncation=True, max_length=128, model=HUB_EMOTION_MODEL, top_k=3)
        else:
            print(f"Loading emotion model ({HUB_EMOTION_MODEL})...")
            _emotion_model = pipeline("text-classification", truncation=True, max_length=128, model=HUB_EMOTION_MODEL, top_k=3)
    return _emotion_model

def get_mental_model():
    global _mental_model
    if _mental_model is None:
        LOCAL_RISK_PATH = "training/models/risk-classifier"
        HUB_RISK_MODEL = "bhadresh-savani/distilbert-base-uncased-emotion"
        if is_valid_local_model(LOCAL_RISK_PATH):
            try:
                print(f"Loading local risk model from: {LOCAL_RISK_PATH}")
                _mental_model = pipeline(
                    "text-classification", truncation=True, max_length=128,
                    model=LOCAL_RISK_PATH,
                    tokenizer=LOCAL_RISK_PATH
                )
            except Exception:
                _mental_model = pipeline("text-classification", truncation=True, max_length=128, model=HUB_RISK_MODEL)
        else:
            print(f"Loading risk model ({HUB_RISK_MODEL})...")
            _mental_model = pipeline("text-classification", truncation=True, max_length=128, model=HUB_RISK_MODEL)
    return _mental_model

def get_safety_model():
    global _safety_model
    if os.environ.get("DISABLE_SAFETY_MODEL", "").strip().lower() in ("1", "true", "yes"):
        return None  # skip the slow zero-shot model; keywords + fine-tuned classifier still decide
    if _safety_model is None:
        try:
            print("Loading safety model (cross-encoder/nli-distilroberta-base)...")
            _safety_model = pipeline(
                "zero-shot-classification",
                model="cross-encoder/nli-distilroberta-base"
            )
            print("Safety model loaded successfully!")
        except Exception as e:
            print(f"Warning: Could not load transformer safety model due to system memory limit ({e}). Using lightweight safety evaluator.")
            _safety_model = None
    return _safety_model

print("Backend initialization complete (models configured for on-demand loading).")


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


# REQUEST MODELS

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ContactRequest(BaseModel):
    name: str
    phone: str = ""
    email: str
    relationship: str = ""
    receive_sos: bool = True

class UpdateContactRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    relationship: Optional[str] = None
    receive_sos: Optional[bool] = None


# AUTHENTICATION ENDPOINTS

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="mindease_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,  # HTTPS-only cookie when the frontend is served over HTTPS
        max_age=7 * 24 * 3600
    )

@app.post("/auth/signup")
def signup(req: SignupRequest, response: Response):
    name = req.name.strip()
    email = req.email.lower().strip()
    password = req.password

    if not name or not email or not password:
        raise HTTPException(status_code=400, detail="Name, email, and password are required.")

    users_col = db_manager.users
    if not db_manager.is_connected() or users_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable.")

    existing_user = users_col.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please log in.")

    new_user = {
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "auth_provider": "local",
        "provider_id": None,
        "token_version": 1,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }

    res = users_col.insert_one(new_user)
    user_id_str = str(res.inserted_id)

    token = create_access_token(user_id_str, token_version=1)
    set_auth_cookie(response, token)

    return {
        "message": "Account created successfully",
        "token": token,
        "user": {
            "id": user_id_str,
            "name": name,
            "email": email,
            "auth_provider": "local"
        }
    }

@app.post("/auth/login")
def login(req: LoginRequest, response: Response):
    email = req.email.lower().strip()
    password = req.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    users_col = db_manager.users
    if not db_manager.is_connected() or users_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable.")

    user = users_col.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id_str = str(user["_id"])
    token_version = user.get("token_version", 1)
    if "token_version" not in user:
        users_col.update_one({"_id": user["_id"]}, {"$set": {"token_version": 1}})

    token = create_access_token(user_id_str, token_version=token_version)
    set_auth_cookie(response, token)

    return {
        "message": "Logged in successfully",
        "token": token,
        "user": {
            "id": user_id_str,
            "name": user.get("name", "User"),
            "email": email,
            "auth_provider": user.get("auth_provider", "local")
        }
    }

@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "name": current_user.get("name", "User"),
        "email": current_user.get("email"),
        "auth_provider": current_user.get("auth_provider", "local")
    }

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

@app.put("/auth/me")
def update_me(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    users_col = db_manager.users
    if not db_manager.is_connected() or users_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable.")

    updates = {}
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty.")
        updates["name"] = name
    if req.email is not None:
        email = req.email.lower().strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise HTTPException(status_code=400, detail="Please enter a valid email address.")
        if email != current_user.get("email"):
            if users_col.find_one({"email": email, "_id": {"$ne": current_user["_id"]}}):
                raise HTTPException(status_code=400, detail="An account with this email already exists.")
            updates["email"] = email

    if updates:
        updates["updated_at"] = datetime.now()
        users_col.update_one({"_id": current_user["_id"]}, {"$set": updates})
        current_user.update(updates)

    return {
        "id": str(current_user["_id"]),
        "name": current_user.get("name", "User"),
        "email": current_user.get("email"),
        "auth_provider": current_user.get("auth_provider", "local")
    }

@app.post("/auth/logout")
def logout(response: Response, current_user: dict = Depends(get_current_user)):
    users_col = db_manager.users
    if db_manager.is_connected() and users_col is not None:
        users_col.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"token_version": 1}}
        )
    response.delete_cookie(key="mindease_token")
    return {"message": "Logged out successfully"}


# GOOGLE OAUTH

@app.get("/auth/google")
def google_auth():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    if not client_id:
        raise HTTPException(status_code=500, detail="Google Client ID is not configured in backend environment.")
    
    state = secrets.token_urlsafe(32)
    google_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=openid%20profile%20email&"
        f"state={state}"
    )
    redirect_resp = RedirectResponse(url=google_url)
    redirect_resp.set_cookie(
        key="mindease_google_oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=600
    )
    return redirect_resp

@app.get("/auth/google/callback")
def google_callback(request: Request, code: str, state: Optional[str] = None):
    cookie_state = request.cookies.get("mindease_google_oauth_state")
    if not state or not cookie_state or not secrets.compare_digest(state, cookie_state):
        raise HTTPException(status_code=400, detail="Invalid or missing OAuth state CSRF verification token.")

    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google credentials missing in environment.")

    token_url = "https://oauth2.googleapis.com/token"
    token_resp = requests.post(token_url, data={
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    })

    if not token_resp.ok:
        raise HTTPException(status_code=400, detail="Failed to retrieve Google token.")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    user_info_resp = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    if not user_info_resp.ok:
        raise HTTPException(status_code=400, detail="Failed to retrieve Google user details.")

    user_info = user_info_resp.json()
    google_id = user_info.get("id")
    email = user_info.get("email", "").lower()
    name = user_info.get("name", "Google User")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no verified email address.")

    users_col = db_manager.users
    if not db_manager.is_connected() or users_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable.")

    user = users_col.find_one({"$or": [{"provider_id": google_id}, {"email": email}]})

    if user:
        user_id_str = str(user["_id"])
        token_version = user.get("token_version", 1)
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"auth_provider": "google", "provider_id": google_id, "token_version": token_version, "updated_at": datetime.now()}}
        )
    else:
        token_version = 1
        new_user = {
            "name": name,
            "email": email,
            "password_hash": None,
            "auth_provider": "google",
            "provider_id": google_id,
            "token_version": 1,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        res = users_col.insert_one(new_user)
        user_id_str = str(res.inserted_id)

    token = create_access_token(user_id_str, token_version=token_version)
    
    redirect_response = RedirectResponse(url=f"{FRONTEND_URL}/dashboard?token={token}")
    set_auth_cookie(redirect_response, token)
    redirect_response.delete_cookie("mindease_google_oauth_state")
    return redirect_response


# GITHUB OAUTH

@app.get("/auth/github")
def github_auth():
    client_id = os.environ.get("GITHUB_CLIENT_ID")
    redirect_uri = os.environ.get("GITHUB_REDIRECT_URI", "http://localhost:8000/auth/github/callback")
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub Client ID is not configured in backend environment.")

    state = secrets.token_urlsafe(32)
    github_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope=user:email&"
        f"state={state}"
    )
    redirect_resp = RedirectResponse(url=github_url)
    redirect_resp.set_cookie(
        key="mindease_github_oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=600
    )
    return redirect_resp

@app.get("/auth/github/callback")
def github_callback(request: Request, code: str, state: Optional[str] = None):
    cookie_state = request.cookies.get("mindease_github_oauth_state")
    if not state or not cookie_state or not secrets.compare_digest(state, cookie_state):
        raise HTTPException(status_code=400, detail="Invalid or missing OAuth state CSRF verification token.")

    client_id = os.environ.get("GITHUB_CLIENT_ID")
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET")
    redirect_uri = os.environ.get("GITHUB_REDIRECT_URI", "http://localhost:8000/auth/github/callback")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub credentials missing in environment.")

    token_url = "https://github.com/login/oauth/access_token"
    token_resp = requests.post(token_url, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri
    }, headers={"Accept": "application/json"})

    if not token_resp.ok:
        raise HTTPException(status_code=400, detail="Failed to retrieve GitHub access token.")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="GitHub token exchange returned empty token.")

    user_resp = requests.get("https://api.github.com/user", headers={
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github.v3+json"
    })

    if not user_resp.ok:
        raise HTTPException(status_code=400, detail="Failed to retrieve GitHub user profile.")

    gh_user = user_resp.json()
    github_id = str(gh_user.get("id"))
    name = gh_user.get("name") or gh_user.get("login") or "GitHub User"
    email = gh_user.get("email")

    if not email:
        emails_resp = requests.get("https://api.github.com/user/emails", headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json"
        })
        if emails_resp.ok:
            emails_list = emails_resp.json()
            for em in emails_list:
                if em.get("primary") and em.get("verified"):
                    email = em.get("email")
                    break
            if not email and emails_list:
                email = emails_list[0].get("email")

    if not email:
        email = f"{gh_user.get('login')}@users.noreply.github.com"

    email = email.lower().strip()

    users_col = db_manager.users
    if not db_manager.is_connected() or users_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable.")

    user = users_col.find_one({"$or": [{"provider_id": github_id}, {"email": email}]})

    if user:
        user_id_str = str(user["_id"])
        token_version = user.get("token_version", 1)
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"auth_provider": "github", "provider_id": github_id, "token_version": token_version, "updated_at": datetime.now()}}
        )
    else:
        token_version = 1
        new_user = {
            "name": name,
            "email": email,
            "password_hash": None,
            "auth_provider": "github",
            "provider_id": github_id,
            "token_version": 1,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        res = users_col.insert_one(new_user)
        user_id_str = str(res.inserted_id)

    token = create_access_token(user_id_str, token_version=token_version)
    
    redirect_response = RedirectResponse(url=f"{FRONTEND_URL}/dashboard?token={token}")
    set_auth_cookie(redirect_response, token)
    redirect_response.delete_cookie("mindease_github_oauth_state")
    return redirect_response



# EMOTION MAPPING

def map_emotion(label):
    if label in ["joy", "love", "admiration", "gratitude", "amusement"]:
        return "positive"
    elif label in ["sadness", "grief", "remorse", "disappointment"]:
        return "negative"
    elif label in ["anger", "annoyance", "disapproval"]:
        return "anger"
    elif label in ["fear", "nervousness", "confusion"]:
        return "anxiety"
    else:
        return "neutral"


# MENTAL-STATE NORMALISATION
# The fine-tuned risk classifier (training/models/risk-classifier) outputs
# Anxiety / Depression / Normal / Suicidal, while the Hub fallback model outputs
# sadness / anger / fear / joy / love / surprise. generate_response() and the LLM
# prompt expect the second vocabulary, so map the first onto it. The RAW label is
# still what the API returns and what gets stored in the database.

RISK_LABEL_TO_STATE = {
    "depression": "sadness",
    "anxiety": "fear",
    "normal": "neutral",
    "suicidal": "severe distress",
}

def normalize_mental_state(label):
    if not label:
        return "neutral"
    key = str(label).strip().lower()
    return RISK_LABEL_TO_STATE.get(key, key)


# EMOTION CORRECTION
# The emotion classifier sometimes tags clearly negative messages as positive or
# neutral (e.g. "I got into a fight with my best friend" -> joy). If the message
# contains an unmistakable negative cue, override the label. Cues are matched at
# word starts and skipped when negated ("not sad", "isn't sad", "no longer sad").

NEGATIVE_CUES = {
    "anger": ["fight", "fought", "argument", "argued", "yelled", "angry", "furious",
              "annoyed", "betrayed"],
    "anxiety": ["anxious", "worried", "scared", "afraid", "nervous", "panic",
                "can't sleep", "cant sleep"],
    "negative": ["hard day", "bad day", "rough day", "tough day", "terrible day",
                 "sad", "lonely", "crying", "cried", "upset", "hurt", "broke up",
                 "breakup", "failed", "exhausted", "miserable", "stressed",
                 "overwhelmed", "passed away", "lost my"],
}

def correct_emotion_with_cues(emotion, user_text):
    if emotion not in ("positive", "neutral"):
        return emotion
    t = user_text.lower().replace("\u2019", "'")
    for corrected, cues in NEGATIVE_CUES.items():
        for cue in cues:
            if re.search(r"(?<!not )(?<!n't )(?<!no longer )\b" + re.escape(cue), t):
                return corrected
    return emotion


# RESPONSE GENERATION

def generate_response(emotion, mental_state, user_text, history=None, memory_context=None,
                      user_name=None, recent_replies=None):
    llm_reply = generate_llm_response(user_text, emotion, mental_state, history, memory_context,
                                      user_name=user_name, recent_replies=recent_replies)
    if llm_reply:
        return llm_reply
    return fallback_reply(emotion)


def fallback_reply(emotion):
    # Fallback templates, used only when the LLM is unavailable. They key off `emotion`
    # (the app's 5-class mood label), which is reliable with both the fine-tuned and hub models.
    if emotion == "negative":
        return "I'm sorry things feel heavy right now. What's been weighing on you the most?"
    elif emotion == "anger":
        return "That sounds really frustrating. What happened?"
    elif emotion == "anxiety":
        return "That sounds stressful. What's been on your mind the most?"
    elif emotion == "positive":
        return "That's lovely to hear 😊 What made today feel good?"
    else:
        return "I'm here and listening. What's on your mind?"


# SAFETY DETECTION

# Figures of speech that should not trigger the crisis flow ("I want to die of embarrassment").
DIE_IDIOMS = (r"\bto die (?:of|from) (?:embarrassment|shame|laughter|boredom)\b"
              r"|\bdie laughing\b"
              r"|\bdying (?:of|from) (?:embarrassment|shame|laughter|boredom)\b")

FIRST_PERSON = r"\b(?:i|i'm|im|i've|ive|i'll|my|me|myself)\b"

# Hard-stop words that also appear in impersonal talk ("a movie about suicide"). When one of
# these is the ONLY hard-stop hit, it counts only if the message also refers to the speaker.
AMBIGUOUS_HARD_STOP = {"suicide", "overdose", "self harm", "self-harm"}

def _risk(level, confidence):
    return {
        "riskLevel": level,
        "confidence": confidence,
        "requiresSafetyFlow": level != "LOW"
    }

# Safety thresholds. Calibrate with backend/check_safety_samples.py
HARD_STOP_PHRASES = ["suicide", "suicidal", "kill myself", "killing myself", "end my life", "ending my life",
                     "take my own life", "want to die", "wanted to die", "wanna die", "overdose",
                     "self harm", "self-harm", "cutting myself", "cut myself", "hanging myself",
                     "hurt myself", "harm myself", "don't want to be alive", "dont want to be alive",
                     "don't want to live", "dont want to live", "better off dead", "wish i was dead",
                     "wish i were dead", "no reason to live", "end it all"]
DISTRESS_PHRASES = ["hopeless", "can't go on", "overwhelmed", "breakdown", "panicking", "depressed"]
FICTION_CONTEXT_WORDS = ["movie", "character", "book", "song"]

ZS_DANGER_HIGH = 0.80         # zero-shot "immediate danger or self harm" score -> HIGH
CLF_SUICIDAL_HIGH = 0.70      # fine-tuned risk classifier P(Suicidal) -> HIGH, but only when the
                              # zero-shot model at least mildly agrees (see ZS_DANGER_CONFIRM below):
                              # on its own this classifier reacts to ordinary loneliness/exhaustion
                              # language ("I'm so tired of not feeling my family's presence") the
                              # same way it reacts to real crisis language, which forced those
                              # messages straight past the LLM into the canned crisis reply.
CLF_SUICIDAL_VERY_HIGH = 0.92 # fine-tuned classifier confident enough to count on its own
ZS_DANGER_CONFIRM = 0.30      # zero-shot "danger" score needed to corroborate a CLF_SUICIDAL_HIGH hit
ZS_DISTRESS_WITH_CLF = -1.0   # zero-shot distress needed when the fine-tuned classifier agrees
CLF_DISTRESS_MEDIUM = 0.95    # P(Depression)+P(Anxiety)+P(Suicidal) needed for that agreement
ZS_DISTRESS_ALONE = 0.85      # zero-shot distress needed when the fine-tuned classifier is unavailable


def _risk_classifier_scores(text):
    """Label -> probability from the fine-tuned risk classifier; {} if unavailable
    (including when the app has fallen back to the generic hub model)."""
    try:
        res = get_mental_model()(text, top_k=None)
    except Exception as e:
        print(f"Risk classifier inference error: {e}")
        return {}
    if res and isinstance(res[0], list):
        res = res[0]
    scores = {r["label"]: float(r["score"]) for r in res}
    return scores if "Suicidal" in scores else {}


def _safety(level, confidence, signals):
    return {
        "riskLevel": level,
        "confidence": round(float(confidence), 2),
        "requiresSafetyFlow": level in ("HIGH", "MEDIUM"),
        "signals": signals,
    }


def _hard_stop_hit(text_lower):
    """True if the message contains explicit self-harm language about the speaker."""
    scan = re.sub(DIE_IDIOMS, " ", text_lower)          # "die of embarrassment" is not a risk phrase

    # Explicit denial / negation ("not thinking of suicide", "not going to hurt myself", "no suicidal thoughts")
    negation_pattern = r"\b(?:not|no|never|don't|dont|am not|ain't|without)\s+(?:having|thinking\s+of|planning|feeling|any)?\s*(?:suicid|kill|hurt|harm|die|ending my life)"
    is_negated = re.search(negation_pattern, scan) is not None

    hits = {p for p in HARD_STOP_PHRASES if p in scan}
    if not hits:
        return False
    if is_negated:
        return False
    if hits <= AMBIGUOUS_HARD_STOP:                      # only "suicide"/"overdose"/"self harm"
        return re.search(FIRST_PERSON, scan) is not None
    return True


def evaluate_safety(text):
    text_lower = text.lower().replace("\u2019", "'")
    hard_hit = _hard_stop_hit(text_lower)
    signals = {"keyword": hard_hit}

    # Talking about a film, book, song or character is not a risk signal by itself,
    # but this shortcut must never hide an explicit self-harm phrase.
    if not hard_hit and any(w in text_lower for w in FICTION_CONTEXT_WORDS):
        return _safety("LOW", 1.0, signals)

    # Signal 1: zero-shot safety classifier
    zs_danger = zs_distress = 0.0
    zs_ok = False
    safety_pipe = get_safety_model()
    if safety_pipe is not None:
        try:
            result = safety_pipe(text, ["safe", "emotional distress", "immediate danger or self harm"])
            scores = dict(zip(result["labels"], result["scores"]))
            zs_danger = scores.get("immediate danger or self harm", 0.0)
            zs_distress = scores.get("emotional distress", 0.0)
            zs_ok = True
        except Exception as e:
            print(f"Safety model inference error: {e}. Using rule-based signals only.")

    # Signal 2: fine-tuned four-class risk classifier
    clf = _risk_classifier_scores(text)
    clf_suicidal = clf.get("Suicidal", 0.0)
    clf_distress = clf.get("Depression", 0.0) + clf.get("Anxiety", 0.0) + clf_suicidal

    signals.update({
        "zero_shot_danger": round(zs_danger, 2),
        "zero_shot_distress": round(zs_distress, 2),
        "classifier_suicidal": round(clf_suicidal, 2),
        "classifier_distress": round(clf_distress, 2),
    })

    # HIGH: explicit keywords or a strong zero-shot danger score are trusted alone (a missed crisis
    # costs far more than a false alarm). The fine-tuned classifier is noisier on everyday distress
    # phrasing, so unless it is near-certain on its own, it needs the zero-shot model's agreement.
    if hard_hit:
        return _safety("HIGH", 0.95, signals)
    if zs_danger > ZS_DANGER_HIGH:
        return _safety("HIGH", zs_danger, signals)
    if clf_suicidal >= CLF_SUICIDAL_VERY_HIGH:
        return _safety("HIGH", clf_suicidal, signals)
    if clf_suicidal >= CLF_SUICIDAL_HIGH and zs_danger >= ZS_DANGER_CONFIRM:
        return _safety("HIGH", clf_suicidal, signals)

    # MEDIUM: the two models must agree, so an ordinary bad day does not trigger it.
    if clf:
        if zs_distress > ZS_DISTRESS_WITH_CLF and clf_distress >= CLF_DISTRESS_MEDIUM:
            return _safety("MEDIUM", min(zs_distress, clf_distress), signals)
    elif zs_ok:
        if zs_distress > ZS_DISTRESS_ALONE:
            return _safety("MEDIUM", zs_distress, signals)

    # No model available at all: fall back to distress phrases.
    if not zs_ok and not clf and any(p in text_lower for p in DISTRESS_PHRASES):
        return _safety("MEDIUM", 0.85, signals)

    return _safety("LOW", 0.9, signals)


# SAVE CHAT (WITH CONVERSATION ID & TITLE)

def save_chat(user_input, response, emotion, mental_state, user_id: str = "demo_user", conversation_id: Optional[str] = None, top_emotions: Optional[list] = None, safety: Optional[dict] = None):
    time_str = str(datetime.now())
    
    if not conversation_id or conversation_id.strip() == "":
        conversation_id = f"conv_{int(datetime.now().timestamp()*1000)}_{secrets.token_hex(4)}"

    title = None
    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            existing_doc = db_manager.chat_history.find_one({"user_id": user_id, "conversation_id": conversation_id})
            if existing_doc and "title" in existing_doc and existing_doc["title"]:
                title = existing_doc["title"]
        except Exception:
            pass

    if not title:
        clean_input = user_input.strip()
        title = clean_input[:35] + ("..." if len(clean_input) > 35 else "")

    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            doc = {
                "user_id": user_id,
                "conversation_id": conversation_id,
                "title": title,
                "message": user_input,
                "response": response,
                "emotion": emotion,
                "mental_state": mental_state,
                "safety_level": (safety or {}).get("riskLevel") or ("HIGH" if emotion == "crisis" else "LOW"),
                "top_emotions": top_emotions or ([emotion] if emotion else []),
                "safety": safety or {},
                "time": time_str,
                "timestamp": datetime.now()
            }
            db_manager.chat_history.insert_one(doc)
            return conversation_id, title
        except Exception as e:
            print(f"MongoDB save_chat error: {e}")

    chat_data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "title": title,
        "message": user_input,
        "response": response,
        "emotion": emotion,
        "mental_state": mental_state,
        "time": time_str,
        "timestamp": str(datetime.now())
    }

    try:
        with open("chat_history.json", "r") as f:
            chats = json.load(f)
    except Exception:
        chats = []

    chats.append(chat_data)

    with open("chat_history.json", "w") as f:
        json.dump(chats, f, indent=4)

    return conversation_id, title


# ROOT & HEALTH API

@app.get("/")
def home():
    status = db_manager.get_status()
    return {
        "message": "MindEase Dual Model Backend Running",
        "database": status.get("status", "disconnected")
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "database": db_manager.get_status()
    }


# SOS EMAIL API

class SosRequest(BaseModel):
    emails: List[str] = []
    automatic: bool = False

@app.post("/api/sos")
def send_sos(req: SosRequest, current_user: dict = Depends(get_current_user)):
    """Emails the caller's own SOS-enabled trusted contacts. `emails` narrows the selection;
    addresses that are not among the user's contacts are ignored, so this cannot be used to
    send mail to arbitrary people."""
    user_id = str(current_user["_id"])
    contacts_col = db_manager.trusted_contacts
    if not db_manager.is_connected() or contacts_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable.")

    allowed = {
        (c.get("email") or "").strip().lower()
        for c in contacts_col.find({"user_id": user_id, "receive_sos": {"$ne": False}})
    } - {""}
    requested = {e.strip().lower() for e in req.emails if e and e.strip()}
    recipients = sorted(allowed & requested if requested else allowed)
    if not recipients:
        raise HTTPException(status_code=400, detail="No trusted contacts with SOS alerts enabled. Add one in Safe Place.")

    sender_email = os.environ.get("SENDER_EMAIL")
    sender_password = os.environ.get("SENDER_PASSWORD")

    if not sender_email or not sender_password:
        print("WARNING: SOS email NOT sent. Set SENDER_EMAIL and SENDER_PASSWORD in backend/.env.")
        return {
            "sent": 0,
            "simulated": True,
            "message": "SOS email is not configured on the server, so no email was sent."
        }

    user_name = current_user.get("name") or "A MindEase User"
    user_email = current_user.get("email") or "Not provided"
    first_name = user_name.split(" ")[0]
    subject = f"URGENT: MindEase Safety Alert from {user_name}"
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #ef4444; color: white; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 18px; margin-bottom: 20px;">
            ⚠️ MindEase Immediate Safety Alert
        </div>
        <p style="font-size: 16px; color: #1e293b; line-height: 1.5;">
            <strong>{user_name}</strong> (<a href="mailto:{user_email}" style="color: #6366f1;">{user_email}</a>) has listed you as their trusted emergency contact and triggered an SOS alert via MindEase.
        </p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #991b1b; font-size: 15px; font-weight: 600;">
                {first_name} indicated that they are feeling overwhelmed or unsafe right now and may need urgent emotional support.
            </p>
        </div>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
            <strong>What you can do:</strong><br>
            • Reply directly to this email to reach {first_name} ({user_email})<br>
            • Call or message them immediately to check on their well-being<br>
            • If you are concerned for their immediate physical safety, reach out to local emergency services or national crisis helplines (e.g., Tele-MANAS at 14416 / 1800-891-4416 in India, or 988 in the US/Canada).
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 12px; color: #64748b; margin: 0;">
            This automated alert was sent via MindEase on behalf of {user_name} ({user_email}).
        </p>
    </div>
    """

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587, timeout=15)
        server.starttls()
        server.login(sender_email, sender_password)

        for recipient in recipients:
            msg = MIMEMultipart()
            msg["From"] = f"{user_name} via MindEase <{sender_email}>"
            msg["To"] = recipient
            if user_email and "@" in user_email:
                msg["Reply-To"] = f"{user_name} <{user_email}>"
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "html"))

            server.send_message(msg)

        server.quit()
    except Exception as e:
        print(f"Failed to send SOS email: {e}")
        raise HTTPException(status_code=502, detail=f"Could not send the SOS email: {str(e)}")

    if db_manager.safety_activities is not None:
        try:
            db_manager.safety_activities.insert_one({
                "user_id": user_id,
                "type": "sos_automatic" if req.automatic else "sos_manual",
                "recipients": recipients,
                "recipient_count": len(recipients),
                "timestamp": datetime.now(),
                "title": "SOS Alert Sent",
                "description": f"Emergency email sent to: {', '.join(recipients)}"
            })
        except Exception:
            pass

    return {
        "sent": len(recipients),
        "recipients": recipients,
        "simulated": False,
        "message": f"Successfully sent SOS email to {len(recipients)} contact(s)."
    }


# CHAT API

def load_conversation_history(user_id: str, conversation_id: Optional[str], max_turns: int = 6):
    """Last `max_turns` exchanges of this conversation as LLM messages (oldest first)."""
    if not conversation_id:
        return []
    turns = []
    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            turns = list(db_manager.chat_history.find(
                {"user_id": user_id, "conversation_id": conversation_id},
                {"_id": 0, "message": 1, "response": 1}
            ).sort("timestamp", -1).limit(max_turns))[::-1]
        except Exception as e:
            print(f"MongoDB load_conversation_history error: {e}")
    else:
        try:
            with open("chat_history.json", "r") as f:
                turns = [c for c in json.load(f)
                         if c.get("user_id") == user_id and c.get("conversation_id") == conversation_id][-max_turns:]
        except Exception:
            turns = []

    history = []
    for t in turns:
        if t.get("message"):
            history.append({"role": "user", "content": t["message"]})
        if t.get("response"):
            history.append({"role": "assistant", "content": t["response"]})
    return history


CRISIS_RESPONSE = "I'm really sorry you're going through this. Your safety is important. You don't have to handle this alone."

_crisis_translation_cache = {}


def crisis_response_for(user_input, language):
    """CRISIS_RESPONSE in the user's own language. Translated once per language and cached (it's a
    fixed string, so there's no need to call the LLM again for the next person who needs it in the
    same language). Falls back to the English original if translation fails - a crisis reply must
    never go missing."""
    if language == "en":
        return CRISIS_RESPONSE
    if language in _crisis_translation_cache:
        return _crisis_translation_cache[language]
    translated = translate_like(CRISIS_RESPONSE, user_input)
    _crisis_translation_cache[language] = translated
    return translated

POSITIVE_CURRENT_PHRASES = [
    "now i am happy", "now i'm happy", "now i feel happy",
    "now i am feeling happy", "now i'm feeling happy",
    "but now i am happy", "but now i'm happy",
    "but now i feel happy", "but now i'm feeling happy",
    "i am happy now", "i'm happy now", "feeling happy now"
]


def detect_user_language(text):
    """ISO 639-1 code for `text`, or "en" when detection isn't reliable (too short, mixed script,
    detector failure) - treating it as English in that case is the safe default: it just skips the
    translation step below rather than mistranslating."""
    stripped = (text or "").strip()
    if len(stripped.split()) < 3:
        return "en"
    try:
        return detect_language(stripped)
    except LangDetectException:
        return "en"


def analyze_message(user_input):
    """Safety check + emotion / mental-state classification shared by /chat and /chat/stream.

    The classifiers (safety, emotion, mental-state) are English-only models, but MindEase itself is
    multilingual: the chat LLM naturally replies in whatever language the user writes in, with no
    translation needed there. So a non-English message is translated to English ONLY for these
    classifiers; `user_input` itself is untouched and still flows to the reply LLM and to storage.
    """
    language = detect_user_language(user_input)
    classify_text = user_input if language == "en" else translate_to_english(user_input)

    safety_result = evaluate_safety(classify_text)

    if safety_result["riskLevel"] == "HIGH":
        return {"crisis": True, "safety": safety_result, "emotion": "crisis",
                "mental_state": "critical", "support_state": "critical", "top_emotions": None,
                "language": language}

    emotion_pipe = get_emotion_model()
    emotion_preds = emotion_pipe(classify_text)[0]
    raw_emotions = []
    mapped_emotions = []

    for p in emotion_preds:
        label = p["label"]
        raw_emotions.append(label)
        mapped_emotions.append(map_emotion(label))

    final_emotion = mapped_emotions[0]

    mental_pipe = get_mental_model()
    mental_pred = mental_pipe(classify_text)[0]
    mental_state = mental_pred["label"]  # raw label: shown in the UI and stored in the DB
    mental_score = float(mental_pred.get("score", 0.0))
    # Vocabulary used for reply generation (risk-model labels -> sadness/fear/etc.)
    support_state = normalize_mental_state(mental_state)

    text_lower = classify_text.lower()

    if any(phrase in text_lower for phrase in POSITIVE_CURRENT_PHRASES):
        final_emotion = "positive"
        mental_state = "joy"
        support_state = "joy"
    else:
        # Fix obviously negative messages the emotion model tagged positive/neutral
        final_emotion = correct_emotion_with_cues(final_emotion, classify_text)

        # If the trained risk model flags suicidal content with high confidence,
        # surface the Safe Place option even if the zero-shot check said LOW.
        if (support_state == "severe distress" and mental_score >= 0.80
                and safety_result["riskLevel"] == "LOW"):
            safety_result = _risk("MEDIUM", round(mental_score, 2))

    return {"crisis": False, "safety": safety_result, "emotion": final_emotion,
            "mental_state": mental_state, "support_state": support_state, "top_emotions": raw_emotions,
            "language": language}


def _chat_result(analysis, response, conversation_id, title):
    result = {
        "response": response,
        "emotion": analysis["emotion"],
        "mental_state": analysis["mental_state"],
        "safety": analysis["safety"],
        "conversation_id": conversation_id,
        "title": title
    }
    if analysis["top_emotions"] is not None:
        result["top_emotions"] = analysis["top_emotions"]
    return result


def _save_and_remember(user_input, response, analysis, user_id, conv_id):
    assigned_conv_id, assigned_title = save_chat(
        user_input,
        response,
        analysis["emotion"],
        analysis["mental_state"],
        user_id,
        conversation_id=conv_id,
        top_emotions=analysis["top_emotions"],
        safety=analysis["safety"]
    )
    # Fold this exchange into the long-term memory note (runs in the background)
    memory.remember_in_background(user_id, assigned_conv_id, user_input, response, assigned_title)
    return assigned_conv_id, assigned_title


def load_recent_replies(user_id: str, exclude_conversation_id: Optional[str], limit: int = 5):
    """MindEase's latest replies to this user in OTHER conversations, so a new chat does not open
    the same way as the last few did."""
    if user_id == "demo_user" or not db_manager.is_connected() or db_manager.chat_history is None:
        return []
    query = {"user_id": user_id, "emotion": {"$ne": "crisis"}}
    if exclude_conversation_id:
        query["conversation_id"] = {"$ne": exclude_conversation_id}
    try:
        docs = db_manager.chat_history.find(query, {"_id": 0, "response": 1}).sort("timestamp", -1).limit(limit)
        return [d["response"] for d in docs if d.get("response")]
    except Exception as e:
        print(f"MongoDB load_recent_replies error: {e}")
        return []


def _first_name(current_user):
    name = (current_user or {}).get("name") or ""
    return name.split(" ")[0] if name.strip() else None


@app.post("/chat")
def chat(req: ChatRequest, current_user: Optional[dict] = Depends(get_optional_current_user)):
    user_input = req.message
    user_id = str(current_user["_id"]) if current_user else "demo_user"
    conv_id = req.conversation_id

    analysis = analyze_message(user_input)

    if analysis["crisis"]:
        response = crisis_response_for(user_input, analysis["language"])
    else:
        response = generate_response(
            analysis["emotion"],
            analysis["support_state"],
            user_input,
            history=load_conversation_history(user_id, conv_id),
            memory_context=memory.recall_context(user_id, conv_id, user_input),
            user_name=_first_name(current_user),
            recent_replies=load_recent_replies(user_id, conv_id)
        )

    assigned_conv_id, assigned_title = _save_and_remember(user_input, response, analysis, user_id, conv_id)
    return _chat_result(analysis, response, assigned_conv_id, assigned_title)


def _sse(payload):
    return f"data: {json.dumps(payload, default=str)}\n\n"


@app.post("/chat/stream")
def chat_stream(req: ChatRequest, current_user: Optional[dict] = Depends(get_optional_current_user)):
    """Same as /chat, but the reply is sent as Server-Sent Events while the model writes it:
    {"type": "delta", "text": ...} pieces, then one {"type": "done", ...} event carrying the same
    fields /chat returns. The full reply is saved once it is complete."""
    user_input = req.message
    user_id = str(current_user["_id"]) if current_user else "demo_user"
    conv_id = req.conversation_id

    def events():
        try:
            analysis = analyze_message(user_input)
            pieces = []
            if analysis["crisis"]:
                crisis_text = crisis_response_for(user_input, analysis["language"])
                pieces.append(crisis_text)
                yield _sse({"type": "delta", "text": crisis_text})
            else:
                for piece in stream_llm_response(
                    user_input,
                    analysis["emotion"],
                    analysis["support_state"],
                    load_conversation_history(user_id, conv_id),
                    memory.recall_context(user_id, conv_id, user_input),
                    user_name=_first_name(current_user),
                    recent_replies=load_recent_replies(user_id, conv_id),
                ):
                    pieces.append(piece)
                    yield _sse({"type": "delta", "text": piece})
                if not "".join(pieces).strip():
                    fallback = fallback_reply(analysis["emotion"])
                    pieces = [fallback]
                    yield _sse({"type": "delta", "text": fallback})

            response = "".join(pieces).strip()
            assigned_conv_id, assigned_title = _save_and_remember(user_input, response, analysis, user_id, conv_id)
            yield _sse({"type": "done", **_chat_result(analysis, response, assigned_conv_id, assigned_title)})
        except Exception as e:
            print(f"/chat/stream error: {type(e).__name__}: {e}")
            yield _sse({"type": "error", "message": "Something went wrong while replying."})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# GET CHAT HISTORY & CONVERSATIONS (USER ISOLATED)

@app.get("/chat-history")
def get_chat_history(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            cursor = db_manager.chat_history.find(
                {"user_id": user_id},
                {"_id": 0}
            ).sort("timestamp", 1)
            chats = list(cursor)
            for c in chats:
                if "timestamp" in c and isinstance(c["timestamp"], datetime):
                    c["timestamp"] = c["timestamp"].isoformat()
            if chats:
                return chats
        except Exception as e:
            print(f"MongoDB get_chat_history error: {e}")

    try:
        with open("chat_history.json", "r") as f:
            chats = json.load(f)
            return [c for c in chats if c.get("user_id") == user_id]
    except Exception:
        return []

@app.get("/conversations")
def get_user_conversations(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            pipeline_agg = [
                {"$match": {"user_id": user_id}},
                {"$sort": {"timestamp": -1}},
                {
                    "$group": {
                        "_id": "$conversation_id",
                        "title": {"$first": "$title"},
                        "last_updated": {"$first": "$timestamp"},
                        "time": {"$first": "$time"},
                        "message_count": {"$sum": 1}
                    }
                },
                {"$sort": {"last_updated": -1}}
            ]
            results = list(db_manager.chat_history.aggregate(pipeline_agg))
            conversations = []
            for r in results:
                if r["_id"]:
                    last_updated_str = ""
                    if isinstance(r.get("last_updated"), datetime):
                        last_updated_str = r["last_updated"].isoformat()
                    else:
                        last_updated_str = str(r.get("last_updated", r.get("time", "")))

                    conversations.append({
                        "conversation_id": r["_id"],
                        "title": r.get("title") or "Conversation",
                        "last_updated": last_updated_str,
                        "time": r.get("time", ""),
                        "message_count": r.get("message_count", 0)
                    })
            return conversations
        except Exception as e:
            print(f"MongoDB get_user_conversations error: {e}")

    try:
        with open("chat_history.json", "r") as f:
            chats = json.load(f)
            user_chats = [c for c in chats if c.get("user_id") == user_id]
            conv_map = {}
            for c in user_chats:
                cid = c.get("conversation_id", "default")
                if cid not in conv_map:
                    conv_map[cid] = {
                        "conversation_id": cid,
                        "title": c.get("title", "Conversation"),
                        "last_updated": c.get("timestamp", c.get("time", "")),
                        "time": c.get("time", ""),
                        "message_count": 0
                    }
                conv_map[cid]["message_count"] += 1
            return list(conv_map.values())
    except Exception:
        return []

@app.get("/conversations/{conversation_id}")
def get_conversation_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            cursor = db_manager.chat_history.find(
                {"user_id": user_id, "conversation_id": conversation_id},
                {"_id": 0}
            ).sort("timestamp", 1)
            messages = list(cursor)
            for m in messages:
                if "timestamp" in m and isinstance(m["timestamp"], datetime):
                    m["timestamp"] = m["timestamp"].isoformat()
            return messages
        except Exception as e:
            print(f"MongoDB get_conversation_messages error: {e}")

    try:
        with open("chat_history.json", "r") as f:
            chats = json.load(f)
            return [c for c in chats if c.get("user_id") == user_id and c.get("conversation_id") == conversation_id]
    except Exception:
        return []

@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            res = db_manager.chat_history.delete_many({"user_id": user_id, "conversation_id": conversation_id})
            memory.delete_conversation_memory(user_id, conversation_id)
            if res.deleted_count > 0:
                return {"message": "Conversation deleted successfully"}
            raise HTTPException(status_code=404, detail="Conversation not found")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        with open("chat_history.json", "r") as f:
            chats = json.load(f)
        filtered = [c for c in chats if not (c.get("user_id") == user_id and c.get("conversation_id") == conversation_id)]
        with open("chat_history.json", "w") as f:
            json.dump(filtered, f, indent=4)
        return {"message": "Conversation deleted successfully"}
    except Exception:
        raise HTTPException(status_code=404, detail="Conversation not found")


# JOURNAL SAVE FUNCTION (USER ISOLATED)

class JournalRequest(BaseModel):
    text: Optional[str] = ""
    mood: Optional[str] = ""
    title: Optional[str] = ""
    entry_type: Optional[str] = "free_write"
    type: Optional[str] = None
    trigger: Optional[str] = ""
    response: Optional[str] = ""
    life_effect: Optional[str] = ""
    next_time_help: Optional[str] = ""
    intensity: Optional[int] = 3

def save_journal(req: JournalRequest, user_id: str):
    time_str = str(datetime.now())
    entry_type = req.type or req.entry_type or "free_write"
    intensity_val = req.intensity if req.intensity is not None else 3
    
    # Compute synthesized text for trigger worksheets if not provided directly
    if entry_type == "trigger_worksheet":
        parts = []
        if req.trigger: parts.append(f"Trigger: {req.trigger}")
        if req.response: parts.append(f"Response: {req.response}")
        if req.life_effect: parts.append(f"Impact: {req.life_effect}")
        if req.next_time_help: parts.append(f"Next time: {req.next_time_help}")
        final_text = req.text or "\n".join(parts) or "Trigger Worksheet Entry"
        final_title = req.title or (f"Trigger: {req.trigger[:35]}..." if req.trigger and len(req.trigger) > 35 else (req.trigger or "Trigger Worksheet"))
    else:
        final_text = req.text or ""
        final_title = req.title or ""

    max_id = 0
    try:
        with open("journal.json", "r") as f:
            local_journals = json.load(f)
            max_id = max([j.get("id", 0) for j in local_journals], default=0)
    except:
        local_journals = []

    if db_manager.is_connected() and db_manager.journal_entries is not None:
        try:
            top_doc = db_manager.journal_entries.find_one(sort=[("id", -1)])
            if top_doc and "id" in top_doc and isinstance(top_doc["id"], int):
                max_id = max(max_id, top_doc["id"])

            # Atomic counter so two simultaneous saves never get the same id
            # ($max keeps it ahead of any existing entry, $inc hands out the next value).
            counters = db_manager.get_collection("counters")
            counters.update_one({"_id": "journal_id"}, {"$max": {"seq": max_id}}, upsert=True)
            new_id = counters.find_one_and_update(
                {"_id": "journal_id"}, {"$inc": {"seq": 1}}, return_document=True
            )["seq"]
            doc = {
                "id": new_id,
                "user_id": user_id,
                "title": final_title,
                "text": final_text,
                "mood": req.mood or "",
                "entry_type": entry_type,
                "type": entry_type,
                "trigger": req.trigger or "",
                "response": req.response or "",
                "life_effect": req.life_effect or "",
                "next_time_help": req.next_time_help or "",
                "intensity": intensity_val,
                "time": time_str,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            res = db_manager.journal_entries.insert_one(doc)
            
            doc["_id"] = str(res.inserted_id)
            doc.pop("created_at", None)
            doc.pop("updated_at", None)
            
            data_to_save = {
                "id": new_id,
                "user_id": user_id,
                "title": final_title,
                "text": final_text,
                "mood": req.mood or "",
                "entry_type": entry_type,
                "type": entry_type,
                "trigger": req.trigger or "",
                "response": req.response or "",
                "life_effect": req.life_effect or "",
                "next_time_help": req.next_time_help or "",
                "intensity": intensity_val,
                "time": time_str
            }
            local_journals.append(data_to_save)
            with open("journal.json", "w") as f:
                json.dump(local_journals, f, indent=4)
                
            return doc
        except Exception as e:
            print(f"MongoDB save_journal error: {e}")

    new_id = max_id + 1
    data = {
        "id": new_id,
        "user_id": user_id,
        "title": final_title,
        "text": final_text,
        "mood": req.mood or "",
        "entry_type": entry_type,
        "type": entry_type,
        "trigger": req.trigger or "",
        "response": req.response or "",
        "life_effect": req.life_effect or "",
        "next_time_help": req.next_time_help or "",
        "intensity": intensity_val,
        "time": time_str
    }
    local_journals.append(data)
    with open("journal.json", "w") as f:
        json.dump(local_journals, f, indent=4)
    return data


# GET JOURNAL ENTRIES (USER ISOLATED)

@app.get("/journal")
def get_journal(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    if db_manager.is_connected() and db_manager.journal_entries is not None:
        try:
            cursor = db_manager.journal_entries.find({"user_id": user_id}).sort("id", 1)
            results = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                doc.pop("created_at", None)
                doc.pop("updated_at", None)
                results.append(doc)
            return results
        except Exception as e:
            print(f"MongoDB get_journal error: {e}")

    try:
        with open("journal.json", "r") as f:
            return [j for j in json.load(f) if j.get("user_id") == user_id]
    except:
        return []


# SAVE JOURNAL ENTRY

@app.post("/journal")
def add_journal(req: JournalRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    data = save_journal(
        req,
        user_id
    )
    return {
        "message": "Saved successfully",
        "entry": data
    }


# UPDATE JOURNAL ENTRY (USER ISOLATED)

@app.put("/journal/{journal_id}")
def update_journal(
    journal_id: str,
    req: JournalRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    time_str = str(datetime.now())
    entry_type = req.type or req.entry_type or "free_write"
    intensity_val = req.intensity if req.intensity is not None else 3
    
    if entry_type == "trigger_worksheet":
        parts = []
        if req.trigger: parts.append(f"Trigger: {req.trigger}")
        if req.response: parts.append(f"Response: {req.response}")
        if req.life_effect: parts.append(f"Impact: {req.life_effect}")
        if req.next_time_help: parts.append(f"Next time: {req.next_time_help}")
        final_text = req.text or "\n".join(parts) or "Trigger Worksheet Entry"
        final_title = req.title or (f"Trigger: {req.trigger[:35]}..." if req.trigger and len(req.trigger) > 35 else (req.trigger or "Trigger Worksheet"))
    else:
        final_text = req.text or ""
        final_title = req.title or ""

    query = {"user_id": user_id}
    if journal_id.isdigit():
        query["$or"] = [{"id": int(journal_id)}, {"id": journal_id}]
    elif ObjectId.is_valid(journal_id):
        query["$or"] = [{"_id": ObjectId(journal_id)}, {"id": journal_id}]
    else:
        query["id"] = journal_id

    set_fields = {
        "title": final_title,
        "text": final_text,
        "mood": req.mood or "",
        "entry_type": entry_type,
        "type": entry_type,
        "trigger": req.trigger or "",
        "response": req.response or "",
        "life_effect": req.life_effect or "",
        "next_time_help": req.next_time_help or "",
        "intensity": intensity_val,
        "time": time_str,
        "updated_at": datetime.now()
    }

    if db_manager.is_connected() and db_manager.journal_entries is not None:
        try:
            updated = db_manager.journal_entries.find_one_and_update(
                query,
                {"$set": set_fields},
                return_document=True
            )
            if updated:
                updated["_id"] = str(updated["_id"])
                updated.pop("created_at", None)
                updated.pop("updated_at", None)
                
                try:
                    with open("journal.json", "r") as f:
                        journals = json.load(f)
                    mirror_fields = {k: v for k, v in set_fields.items() if k != "updated_at"}
                    for j in journals:
                        if str(j.get("id")) == str(updated.get("id")):
                            j.update(mirror_fields)
                    with open("journal.json", "w") as f:
                        json.dump(journals, f, indent=4)
                except Exception:
                    pass

                return {
                    "message": "Updated successfully",
                    "entry": updated
                }
        except Exception as e:
            print(f"MongoDB update_journal error: {e}")

    try:
        with open("journal.json", "r") as f:
            journals = json.load(f)
    except:
        journals = []

    for journal in journals:
        if str(journal.get("id")) == str(journal_id) and journal.get("user_id") == user_id:
            set_fields.pop("updated_at", None)   # datetime is not JSON serialisable
            journal.update(set_fields)
            with open("journal.json", "w") as f:
                json.dump(journals, f, indent=4)
            return {
                "message": "Updated successfully",
                "entry": journal
            }

    return {
        "message": "Journal entry not found"
    }


# DELETE JOURNAL ENTRY (USER ISOLATED)

@app.delete("/journal/{journal_id}")
def delete_journal(journal_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}
    if journal_id.isdigit():
        query["$or"] = [{"id": int(journal_id)}, {"id": journal_id}]
    elif ObjectId.is_valid(journal_id):
        query["$or"] = [{"_id": ObjectId(journal_id)}, {"id": journal_id}]
    else:
        query["id"] = journal_id

    deleted_in_db = False
    if db_manager.is_connected() and db_manager.journal_entries is not None:
        try:
            res = db_manager.journal_entries.delete_one(query)
            if res.deleted_count > 0:
                deleted_in_db = True
        except Exception as e:
            print(f"MongoDB delete_journal error: {e}")

    try:
        with open("journal.json", "r") as f:
            journals = json.load(f)
        # Mirror of a DB delete (already authorised by the user-scoped query), or the caller's own local entry
        updated_journals = [
            j for j in journals
            if not (str(j.get("id")) == str(journal_id) and (deleted_in_db or j.get("user_id") == user_id))
        ]
        if len(updated_journals) < len(journals):
            with open("journal.json", "w") as f:
                json.dump(updated_journals, f, indent=4)
            return {
                "message": "Deleted successfully"
            }
    except Exception:
        pass

    if deleted_in_db:
        return {
            "message": "Deleted successfully"
        }

    return {
        "message": "Journal entry not found"
    }


# SAFE PLACE / TRUSTED CONTACTS USER ISOLATED ENDPOINTS

@app.get("/api/contacts")
def get_contacts(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    contacts_col = db_manager.trusted_contacts
    if db_manager.is_connected() and contacts_col is not None:
        try:
            cursor = contacts_col.find({"user_id": user_id})
            results = []
            for doc in cursor:
                doc["id"] = str(doc["_id"])
                doc["_id"] = str(doc["_id"])
                results.append(doc)
            return results
        except Exception as e:
            print(f"MongoDB get_contacts error: {e}")
    return []

@app.post("/api/contacts")
def add_contact(req: ContactRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    contacts_col = db_manager.trusted_contacts
    if not db_manager.is_connected() or contacts_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    doc = {
        "user_id": user_id,
        "name": req.name,
        "phone": req.phone,
        "email": req.email,
        "relationship": req.relationship,
        "receive_sos": req.receive_sos,
        "created_at": datetime.now()
    }
    res = contacts_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc["_id"] = str(res.inserted_id)
    doc.pop("created_at", None)
    return doc

@app.put("/api/contacts/{contact_id}")
def update_contact(contact_id: str, req: UpdateContactRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    contacts_col = db_manager.trusted_contacts
    if not db_manager.is_connected() or contacts_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    query = {"user_id": user_id}
    if ObjectId.is_valid(contact_id):
        query["_id"] = ObjectId(contact_id)
    else:
        query["id"] = contact_id

    update_fields = {}
    if req.name is not None: update_fields["name"] = req.name
    if req.phone is not None: update_fields["phone"] = req.phone
    if req.email is not None: update_fields["email"] = req.email
    if req.relationship is not None: update_fields["relationship"] = req.relationship
    if req.receive_sos is not None: update_fields["receive_sos"] = req.receive_sos

    if update_fields:
        res = contacts_col.find_one_and_update(query, {"$set": update_fields}, return_document=True)
        if res:
            res["id"] = str(res["_id"])
            res["_id"] = str(res["_id"])
            res.pop("created_at", None)
            return res
    raise HTTPException(status_code=404, detail="Contact not found")

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    contacts_col = db_manager.trusted_contacts
    if not db_manager.is_connected() or contacts_col is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    query = {"user_id": user_id}
    if ObjectId.is_valid(contact_id):
        query["_id"] = ObjectId(contact_id)
    else:
        query["id"] = contact_id

    res = contacts_col.delete_one(query)
    if res.deleted_count > 0:
        return {"message": "Contact deleted successfully"}
    raise HTTPException(status_code=404, detail="Contact not found")


@app.get("/api/safety-activities")
def get_safety_activities(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    activities_col = db_manager.safety_activities
    if not db_manager.is_connected() or activities_col is None:
        return []
    try:
        cursor = activities_col.find({"user_id": user_id}).sort("timestamp", -1).limit(20)
        results = []
        for doc in cursor:
            results.append({
                "id": str(doc["_id"]),
                "type": doc.get("type", "sos"),
                "title": doc.get("title", "Safety Action"),
                "description": doc.get("description", ""),
                "recipients": doc.get("recipients", []),
                "date": doc.get("timestamp").strftime("%b %d, %Y %I:%M %p") if isinstance(doc.get("timestamp"), datetime) else str(doc.get("timestamp", ""))
            })
        return results
    except Exception as e:
        print(f"Error fetching safety activities: {e}")
        return []


@app.get("/api/safety-status")
def get_safety_status(current_user: dict = Depends(get_current_user)):
    sender_email = (os.environ.get("SENDER_EMAIL") or "").strip()
    sender_pass = (os.environ.get("SENDER_PASSWORD") or "").strip()
    return {
        "email_configured": bool(sender_email and sender_pass),
        "sender_email": sender_email if sender_email else None
    }


# INSIGHTS ENDPOINT (USER ISOLATED & CONSOLIDATED DATA TRACING)

@app.get("/insights")
def get_insights(view: str = "weekly", current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    # 1. Fetch authenticated user's journal entries (MongoDB + local JSON fallback)
    journals = []
    if db_manager.is_connected() and db_manager.journal_entries is not None:
        try:
            cursor = db_manager.journal_entries.find({"user_id": user_id})
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                journals.append(doc)
        except Exception as e:
            print(f"MongoDB get_insights journal error: {e}")

    try:
        with open("journal.json", "r") as f:
            local_j = json.load(f)
            existing_ids = {str(j.get("id")) for j in journals if "id" in j}
            for j in local_j:
                if str(j.get("id")) not in existing_ids:
                    if j.get("user_id") == user_id:
                        journals.append(j)
    except Exception as e:
        print(f"Local journal.json fallback error: {e}")

    # 2. Fetch authenticated user's chat history turns
    chats = []
    if db_manager.is_connected() and db_manager.chat_history is not None:
        try:
            cursor = db_manager.chat_history.find({"user_id": user_id})
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                chats.append(doc)
        except Exception as e:
            print(f"MongoDB get_insights chat error: {e}")

    # 3. Group chat turns by conversation_id (unique conversation sessions)
    conversation_ids = set()
    for c in chats:
        cid = c.get("conversation_id")
        if cid:
            conversation_ids.add(cid)
    chat_conversation_count = len(conversation_ids) if conversation_ids else (len(chats) if chats else 0)

    # 4. Define time range
    now = datetime.now()
    days_to_show = 7 if view == "weekly" else 32
    start_date = now - timedelta(days=days_to_show - 1)
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

    # Mood score mappings
    mood_score_map = {
        "😊 Happy": 8, "Happy": 8,
        "😌 Calm": 7, "Calm": 7,
        "😟 Anxious": 5, "Anxious": 5,
        "😢 Sad": 4, "Sad": 4,
        "😫 Stressed": 3, "Stressed": 3
    }
    
    chat_emotion_score_map = {
        "positive": 8,
        "neutral": 7,
        "anxiety": 5,
        "negative": 4,
        "anger": 3
    }

    # Helper function to parse timestamp flexibly across ISO, strptime formats, and local strings
    def parse_item_date(item):
        raw = item.get("timestamp") or item.get("created_at") or item.get("time") or item.get("date")
        if not raw:
            return None
        if isinstance(raw, datetime):
            return raw
        if isinstance(raw, (int, float)):
            try:
                return datetime.fromtimestamp(raw)
            except Exception:
                return None

        s_raw = str(raw).strip()
        if not s_raw:
            return None

        try:
            return datetime.fromisoformat(s_raw.replace("Z", "+00:00").replace(" ", "T"))
        except Exception:
            pass

        formats_to_try = [
            "%b %d, %Y",       # "Sep 20, 2026"
            "%b %d %Y",        # "Sep 20 2026"
            "%B %d, %Y",       # "September 20, 2026"
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%m/%d/%Y"
        ]

        for fmt in formats_to_try:
            try:
                return datetime.strptime(s_raw[:25], fmt)
            except Exception:
                pass

        if len(s_raw) >= 10:
            try:
                return datetime.strptime(s_raw[:10], "%Y-%m-%d")
            except Exception:
                pass

        return None

    # Helper to derive mood category from journal entry (tag or text sentiment fallback)
    def get_journal_mood(j):
        m = j.get("mood", "")
        if m:
            clean_m = m.replace("😊 ", "").replace("😌 ", "").replace("😟 ", "").replace("😢 ", "").replace("😫 ", "").strip()
            if clean_m:
                return clean_m
        
        # Text/Trigger sentiment analysis fallback if mood tag is missing
        text_content = (str(j.get("text", "")) + " " + str(j.get("trigger", "")) + " " + str(j.get("title", ""))).lower()
        if any(w in text_content for w in ["happy", "good", "great", "assignment", "passed", "joy", "cheer", "wonderful", "on track"]):
            return "Happy"
        if any(w in text_content for w in ["calm", "peaceful", "nature", "book", "relax", "quiet"]):
            return "Calm"
        if any(w in text_content for w in ["anxious", "nervous", "worry", "breakdown", "shaking", "vulnerable", "dealing with"]):
            return "Anxious"
        if any(w in text_content for w in ["sad", "bad", "crying", "miserable", "hurt", "hopeless"]):
            return "Sad"
        if any(w in text_content for w in ["stressed", "fight", "wrong", "conflict", "terrible", "pressure"]):
            return "Stressed"
            
        return "Calm"

    # Filter journal & chat entries within timeframe
    filtered_journals = []
    for j in journals:
        dt = parse_item_date(j)
        if dt:
            j["_dt"] = dt
            if dt >= start_date:
                filtered_journals.append(j)

    filtered_chats = []
    for c in chats:
        dt = parse_item_date(c)
        if dt:
            c["_dt"] = dt
            if dt >= start_date:
                filtered_chats.append(c)

    # Use filtered items if present in window, else fall back to active user items for metrics
    active_journals = filtered_journals if filtered_journals else journals
    active_chats = filtered_chats if filtered_chats else chats

    has_data = len(journals) > 0 or len(chats) > 0

    if not has_data:
        return {
            "has_data": False,
            "view": view,
            "average_mood": 0,
            "journal_count": 0,
            "chat_conversation_count": 0,
            "total_chat_messages": 0,
            "most_common_mood": "-",
            "best_day": "-",
            "chart_data": [],
            "emotion_distribution": [],
            "insight_summary": "Your insights will appear as you use MindEase. Journal your thoughts or talk with MindEase AI to build your personalized emotional metrics."
        }

    # Daily Chart Points (Combines Journal moods & AI Support detected emotions)
    chart_data = []
    for i in range(days_to_show):
        cur_day = start_date + timedelta(days=i)
        day_str = cur_day.strftime("%b %d")
        
        day_scores = []
        for j in active_journals:
            dt_val = j.get("_dt") or parse_item_date(j)
            if dt_val and dt_val.date() == cur_day.date():
                mood_name = get_journal_mood(j)
                score = mood_score_map.get(mood_name, 7)
                day_scores.append(score)
                
        for c in active_chats:
            dt_val = c.get("_dt") or parse_item_date(c)
            if dt_val and dt_val.date() == cur_day.date():
                emo = c.get("emotion", "neutral")
                score = chat_emotion_score_map.get(emo, 7)
                day_scores.append(score)

        avg_day_mood = round(sum(day_scores) / len(day_scores), 1) if day_scores else None
        chart_data.append({"day": day_str, "mood": avg_day_mood})

    # Emotion Distribution Counts across journals and chats
    emotion_counts = {}
    for j in active_journals:
        norm_label = get_journal_mood(j)
        if norm_label:
            emotion_counts[norm_label] = emotion_counts.get(norm_label, 0) + 1

    for c in active_chats:
        emo = c.get("emotion")
        if emo:
            label_map = {"positive": "Happy", "neutral": "Calm", "anxiety": "Anxious", "negative": "Sad", "anger": "Stressed"}
            norm_label = label_map.get(emo, emo.capitalize())
            emotion_counts[norm_label] = emotion_counts.get(norm_label, 0) + 1

    emotion_distribution = [{"name": k, "value": v} for k, v in emotion_counts.items()]

    # Most common mood
    most_common_mood = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "-"

    # Overall Average Mood
    all_scores = []
    for j in active_journals:
        mood_name = get_journal_mood(j)
        all_scores.append(mood_score_map.get(mood_name, 7))
    for c in active_chats:
        all_scores.append(chat_emotion_score_map.get(c.get("emotion"), 7))

    average_mood = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0

    # Best Day calculation
    best_day_str = "-"
    if active_journals:
        best_j = max(active_journals, key=lambda x: mood_score_map.get(get_journal_mood(x), 7))
        score_val = mood_score_map.get(get_journal_mood(best_j), 7)
        dt_val = best_j.get("_dt") or parse_item_date(best_j) or datetime.now()
        best_day_str = f"{dt_val.strftime('%B %d')} ({score_val}/10)"

    # AI Insight Summary Text
    insight_summary = "Keep tracking your emotions to better understand your wellbeing over time."
    if most_common_mood in ["Happy", "Positive"]:
        insight_summary = "You've been feeling positive recently! Keep engaging in activities that bring you joy and peace."
    elif most_common_mood in ["Calm", "Balanced"]:
        insight_summary = "You've maintained a steady, calm emotional state recently. Continue creating space for rest and reflection."
    elif most_common_mood in ["Anxious", "Fear"]:
        insight_summary = "Anxiety or tension has appeared in your recent entries. Consider taking gentle breathing breaks in Safe Place."
    elif most_common_mood in ["Stressed", "Anger"]:
        insight_summary = "Stress signals have been detected recently. Try giving yourself rest periods and talking through feelings with AI Support."
    elif most_common_mood in ["Sad", "Negative"]:
        insight_summary = "You've been experiencing lower mood recently. Writing in your journal and reaching out can help process these feelings."

    # Themes & AI reflection from the long-term memory notes (memory.py) and journal text
    notes = memory.recent_notes(user_id, since=start_date, limit=30)
    theme_counts = {}
    for n in notes:
        for t in n.get("themes", []):
            theme_counts[t] = theme_counts.get(t, 0) + 1
    themes = [{"name": t, "count": c} for t, c in sorted(theme_counts.items(), key=lambda x: -x[1])[:6]]
    highlights = [
        {
            "title": n.get("title") or "Conversation",
            "summary": n.get("recap") or n.get("summary", ""),
            "date": n["updated_at"].strftime("%b %d") if isinstance(n.get("updated_at"), datetime) else "",
            "mood": n.get("mood", ""),
        }
        for n in notes[:3] if n.get("summary")
    ]

    recent_journals = sorted(active_journals, key=lambda j: j.get("_dt") or datetime.min, reverse=True)[:8]
    ai_summary = _ai_insight_summary(user_id, view, notes, recent_journals, emotion_counts, average_mood)
    if ai_summary:
        insight_summary = ai_summary

    return {
        "has_data": True,
        "view": view,
        "average_mood": average_mood,
        "journal_count": len(journals),
        "chat_conversation_count": chat_conversation_count,
        "total_chat_messages": len(chats),
        "most_common_mood": most_common_mood,
        "best_day": best_day_str,
        "chart_data": chart_data,
        "emotion_distribution": emotion_distribution,
        "insight_summary": insight_summary,
        "themes": themes,
        "highlights": highlights
    }


_INSIGHT_CACHE = {}

def _ai_insight_summary(user_id, view, notes, journals, emotion_counts, average_mood):
    """2-3 sentence personal reflection written by the LLM from this period's conversation notes and
    journal entries. Cached until the underlying data changes; None if there is nothing to say or
    the LLM is unavailable (the caller keeps its rule-based sentence)."""
    if not notes and not journals:
        return None

    import hashlib
    fingerprint = hashlib.md5("|".join(
        [view, datetime.now().strftime("%Y-%m-%d")]
        + [f"{n.get('conversation_id')}:{n.get('updated_at')}" for n in notes]
        + [f"{j.get('_id') or j.get('id')}:{j.get('time')}" for j in journals]
    ).encode("utf-8")).hexdigest()
    cached = _INSIGHT_CACHE.get((user_id, view))
    if cached and cached["fingerprint"] == fingerprint:
        return cached["text"]

    period = "week" if view == "weekly" else "month"
    convo_lines = "\n".join(
        f"- {n['updated_at'].strftime('%b %d') if isinstance(n.get('updated_at'), datetime) else ''} "
        f"(mood {n.get('mood', '?')}; themes {', '.join(n.get('themes', []))}): {n.get('summary', '')}"
        for n in notes[:10]
    ) or "(none)"
    journal_lines = "\n".join(
        f"- {j['_dt'].strftime('%b %d') if j.get('_dt') else ''} (mood {j.get('mood') or 'not set'}): "
        f"{(str(j.get('title') or '') + ' ' + str(j.get('text') or ''))[:300]}"
        for j in journals
    ) or "(none)"
    moods = ", ".join(f"{k}: {v}" for k, v in sorted(emotion_counts.items(), key=lambda x: -x[1])) or "n/a"

    prompt = (
        f"You are MindEase, a warm wellbeing companion. Write a short personal reflection for the user's "
        f"Insights page about their past {period}.\n\n"
        f"Mood counts: {moods}. Average mood score: {average_mood}/10.\n"
        f"AI Support conversation notes:\n{convo_lines}\n\n"
        f"Journal entries:\n{journal_lines}\n\n"
        "Write 2-3 sentences in second person (\"you\"). Name the main things that have been on their mind and "
        "any pattern you notice (for example what tends to bring their mood down or lift it, or something that "
        "helped). End with one gentle, specific suggestion. Warm and non-judgmental, never diagnostic, no "
        "invented details, plain text only, no quotes or preamble."
    )
    from rag import complete_text
    text = complete_text(prompt, max_tokens=700, temperature=0.5, timeout=12)
    if not text or len(text) < 20:
        return None
    text = text.strip().strip('"')
    _INSIGHT_CACHE[(user_id, view)] = {"fingerprint": fingerprint, "text": text}
    return text


# DASHBOARD & FEELING WHEEL ENDPOINTS

class MoodCheckinRequest(BaseModel):
    core_emotion: str
    specific_feeling: Optional[str] = None
    granular_feeling: Optional[str] = None


@app.post("/mood-checkin")
def save_mood_checkin(
    req: MoodCheckinRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id_str = str(current_user["_id"])
    now_local = datetime.now()
    
    record = {
        "user_id": user_id_str,
        "core_emotion": req.core_emotion,
        "specific_feeling": req.specific_feeling or "",
        "granular_feeling": req.granular_feeling or "",
        "timestamp": now_local,
        "date_str": now_local.strftime("%Y-%m-%d")
    }
    
    try:
        db_manager.mood_records.insert_one(record)
    except Exception as e:
        print(f"Error saving mood checkin: {e}")
        # Proceed gracefully even if DB write has minor issue

    # Generate immediate contextual response pills
    emotion_lower = req.core_emotion.lower()
    selected_label = req.granular_feeling or req.specific_feeling or req.core_emotion
    
    actions = [
        {"title": "Talk to MindEase", "type": "chat", "icon": "💬", "path": "/chat"},
        {"title": "Journal it", "type": "journal", "icon": "📖", "path": "/journal"},
        {"title": "Try a Reset", "type": "reset", "icon": "🌬", "path": "/safe-place"}
    ]

    return {
        "status": "success",
        "selected_emotion": selected_label,
        "core_emotion": req.core_emotion,
        "message": f"You selected: {selected_label}. MindEase is here to support you.",
        "actions": actions
    }


# COPING PLAN QUESTIONNAIRE
# Every dimension is rated 1 (struggling) to 5 (doing well), so an average can be read directly -
# low average = more concern, no sign-flipping needed when building the plan.
QUESTIONNAIRE_DIMENSIONS = {
    "mood": "Overall mood the last few days",
    "anxiety": "Calm, rather than anxious or on edge",
    "sleep": "Sleep quality",
    "energy": "Energy and motivation",
    "support": "Feeling supported by people around them",
    "hope": "Hopefulness that things will improve",
}

# User-facing question text, shown as-is for a brand-new user with no context yet. When there is
# recent AI Support / journal / mood context, /questionnaire/prompts rewrites "label" (only) to
# speak to what's actually going on for that person - "low"/"high" scale anchors stay fixed so the
# 1-5 meaning never drifts.
QUESTIONNAIRE_DEFAULT_QUESTIONS = {
    "mood": {"label": "How has your overall mood been the last few days?", "low": "Very low", "high": "Very good"},
    "anxiety": {"label": "How calm do you feel, as opposed to anxious or on edge?", "low": "Very anxious", "high": "Very calm"},
    "sleep": {"label": "How has your sleep been?", "low": "Very poor", "high": "Very good"},
    "energy": {"label": "How is your energy and motivation?", "low": "Very low", "high": "Very high"},
    "support": {"label": "Do you feel supported by the people around you?", "low": "Not at all", "high": "Very supported"},
    "hope": {"label": "How hopeful do you feel that things will improve?", "low": "Not hopeful", "high": "Very hopeful"},
}

# Used only when the LLM is unavailable or its reply cannot be parsed, keyed by the
# lowest-scoring dimension so the fallback still points at the user's actual weak spot.
FALLBACK_PLANS = {
    "mood": {
        "focus": "Lifting your mood gently",
        "overview": "Your mood has been low lately. That's worth taking seriously, without rushing yourself to feel better overnight.",
        "steps": [
            {"title": "Name the feeling", "detail": "Write or say out loud what you're actually feeling right now - it takes some of its weight away."},
            {"title": "Do one small enjoyable thing", "detail": "Pick something that used to feel good, even briefly, and let it be enough for today."},
            {"title": "Talk it through with MindEase", "detail": "Share what's been going on in AI Support so the plan can keep adjusting to you."},
        ],
    },
    "anxiety": {
        "focus": "Easing the anxious edge",
        "overview": "Things have been feeling anxious or on edge lately. Your nervous system can learn to settle again with small, repeated practice.",
        "steps": [
            {"title": "Try a short breathing reset", "detail": "A couple of minutes of slow breathing in Safe Place can lower the intensity enough to think clearly."},
            {"title": "Name the worry specifically", "detail": "Vague anxiety feels bigger than named anxiety - write down exactly what you're worried about."},
            {"title": "Keep today small", "detail": "Pick one manageable thing to get done today instead of everything on your mind."},
        ],
    },
    "sleep": {
        "focus": "Protecting your sleep",
        "overview": "Your sleep has been rough recently, and that affects almost everything else - mood, focus, patience.",
        "steps": [
            {"title": "Set a wind-down cue", "detail": "Pick one small signal (dim lights, put the phone away) that tells your body it's time to slow down."},
            {"title": "Keep a consistent wake time", "detail": "Even an imperfect night is easier to recover from when you get up around the same time."},
            {"title": "Unload your mind before bed", "detail": "Jot down what's on your mind in your journal so it doesn't keep circling as you try to sleep."},
        ],
    },
    "energy": {
        "focus": "Rebuilding your energy",
        "overview": "Your energy and motivation have been low. That's often the body asking for rest and smaller steps, not more pressure.",
        "steps": [
            {"title": "Shrink the next task", "detail": "Break whatever feels heaviest into a version so small it's almost impossible to refuse."},
            {"title": "Move a little", "detail": "A short walk or stretch can lift energy more reliably than willpower alone."},
            {"title": "Be honest about your capacity", "detail": "Let today's to-do list match the energy you actually have, not the energy you wish you had."},
        ],
    },
    "support": {
        "focus": "Feeling less alone",
        "overview": "You've been feeling unsupported by the people around you, and that loneliness is real and heavy on its own.",
        "steps": [
            {"title": "Send one small message", "detail": "Reach out to one person with something low-pressure - it doesn't have to be a big conversation."},
            {"title": "Name what you need", "detail": "Think about whether you need comfort, company, or practical help - it's easier to ask for the right thing."},
            {"title": "Lean on MindEase in between", "detail": "Use AI Support to talk through what you're missing until that connection feels closer."},
        ],
    },
    "hope": {
        "focus": "Finding a little more hope",
        "overview": "It's been hard to feel hopeful that things will improve. That feeling is understandable, and it isn't permanent.",
        "steps": [
            {"title": "Look for one counter-example", "detail": "Think of one time things did get better before, even slightly - hold onto that as evidence, not proof it'll stay bad."},
            {"title": "Shrink the time horizon", "detail": "Instead of 'everything,' focus on getting through today in a way you can be proud of."},
            {"title": "Keep the door open", "detail": "If things feel heavier than this plan can hold, reach out to someone you trust or a professional - that's a strength, not a failure."},
        ],
    },
}


class QuestionnaireRequest(BaseModel):
    mood: int = Field(ge=1, le=5)
    anxiety: int = Field(ge=1, le=5)
    sleep: int = Field(ge=1, le=5)
    energy: int = Field(ge=1, le=5)
    support: int = Field(ge=1, le=5)
    hope: int = Field(ge=1, le=5)
    note: Optional[str] = None


@app.post("/questionnaire")
def submit_questionnaire(req: QuestionnaireRequest, current_user: dict = Depends(get_current_user)):
    user_id_str = str(current_user["_id"])
    record = {
        "user_id": user_id_str,
        "answers": {k: getattr(req, k) for k in QUESTIONNAIRE_DIMENSIONS},
        "note": (req.note or "").strip()[:500],
        "created_at": datetime.now(),
    }
    if db_manager.questionnaires is not None:
        try:
            db_manager.questionnaires.insert_one(record)
        except Exception as e:
            print(f"Error saving questionnaire: {e}")
    return {"status": "success"}


_questionnaire_prompt_cache = {}


@app.get("/questionnaire/prompts")
def get_questionnaire_prompts(current_user: dict = Depends(get_current_user)):
    """Question text tailored to what's actually going on for this person right now, so the
    check-in feels responsive rather than a fixed generic form. Falls back to the default wording
    (QUESTIONNAIRE_DEFAULT_QUESTIONS) when there's no context yet or the LLM is unavailable - the
    1-5 scale and its meaning never change, only the words asking about it."""
    user_id_str = str(current_user["_id"])

    memory_notes = memory.recent_notes(user_id_str, limit=3)
    chats = []
    if db_manager.chat_history is not None:
        try:
            chats = list(db_manager.chat_history.find({"user_id": user_id_str}).sort("_id", -1).limit(5))
        except Exception as e:
            print(f"Error reading chat_history for questionnaire prompts: {e}")
    journals = []
    if db_manager.journal_entries is not None:
        try:
            journals = list(db_manager.journal_entries.find({"user_id": user_id_str}).sort("_id", -1).limit(2))
        except Exception as e:
            print(f"Error reading journals for questionnaire prompts: {e}")

    context_parts = []
    if memory_notes:
        context_parts.append("RECENT AI SUPPORT CONVERSATIONS (newest first):\n" + "\n".join(
            f"- {n.get('summary', '')}" for n in memory_notes))
    else:
        chat_lines = [f"- \"{(c.get('message') or '').strip()[:200]}\""
                      for c in chats[:3] if (c.get("message") or "").strip()]
        if chat_lines:
            context_parts.append("RECENT MESSAGES TO AI SUPPORT (newest first):\n" + "\n".join(chat_lines))
    journal_lines = [f"- \"{(j.get('text') or j.get('content') or j.get('title') or '').strip()[:200]}\""
                     for j in journals if (j.get("text") or j.get("content") or j.get("title") or "").strip()]
    if journal_lines:
        context_parts.append("RECENT JOURNAL ENTRIES (newest first):\n" + "\n".join(journal_lines))

    if not context_parts:
        return {"questions": QUESTIONNAIRE_DEFAULT_QUESTIONS, "personalized": False}

    import hashlib
    from rag import complete_text
    fp_raw = (f"{chats[0]['_id'] if chats else 'c_none'}|"
              f"{memory_notes[0].get('conversation_id') if memory_notes else 'n_none'}:{memory_notes[0].get('updated_at') if memory_notes else ''}|"
              f"{journals[0]['_id'] if journals else 'j_none'}")
    fingerprint = hashlib.md5(fp_raw.encode("utf-8")).hexdigest()
    cached = _questionnaire_prompt_cache.get(user_id_str)
    if cached and cached.get("fingerprint") == fingerprint:
        return cached["result"]

    formatted_context = "\n\n".join(context_parts)
    llm_prompt = (
        "You are MindEase, a compassionate wellness companion about to ask someone a short self check-in "
        "before building their coping plan.\n\n"
        f"{formatted_context}\n\n"
        "Rewrite these 6 check-in questions so each one speaks to what's actually going on for this person, "
        "based on the context above, while keeping the SAME underlying meaning (a 1-5 answer must still mean "
        "the same thing it always did). Keep each question short (under 20 words) and answerable on its own "
        "1 (struggling) to 5 (doing well) scale.\n\n"
        + "\n".join(f'- {key}: "{QUESTIONNAIRE_DEFAULT_QUESTIONS[key]["label"]}"' for key in QUESTIONNAIRE_DIMENSIONS)
        + "\n\nReturn ONLY a JSON object with exactly these keys, each mapped to the rewritten question string:\n"
        '{"mood": "...", "anxiety": "...", "sleep": "...", "energy": "...", "support": "...", "hope": "..."}\n'
        "Don't invent details that weren't mentioned. If nothing specific fits a question, keep that one close "
        "to its original wording rather than forcing a connection."
    )
    result = {"questions": QUESTIONNAIRE_DEFAULT_QUESTIONS, "personalized": False}
    ai_text = complete_text(llm_prompt, max_tokens=900, temperature=0.6, effort="low", json_mode=True, timeout=12)
    if ai_text:
        try:
            parsed = json.loads(ai_text)
            questions = {}
            any_personalized = False
            for key, default in QUESTIONNAIRE_DEFAULT_QUESTIONS.items():
                label = parsed.get(key)
                if isinstance(label, str) and label.strip():
                    questions[key] = {"label": label.strip()[:200], "low": default["low"], "high": default["high"]}
                    any_personalized = True
                else:
                    questions[key] = default
            if any_personalized:
                result = {"questions": questions, "personalized": True}
        except Exception as e:
            print(f"Questionnaire prompt JSON parse error: {e}")

    _questionnaire_prompt_cache[user_id_str] = {"fingerprint": fingerprint, "result": result}
    return result


def _build_coping_plan(user_id_str, questionnaire, memory_notes, chats, journals, mood_records,
                       now, format_relative_time, parse_dt):
    """A short, personalised coping plan from the latest questionnaire plus recent AI Support
    conversations, journal entries and mood check-ins. Cached per user like the daily reminder."""
    if not questionnaire:
        return {"has_questionnaire": False}

    answers = questionnaire.get("answers") or {}
    note = questionnaire.get("note") or ""
    taken_at = questionnaire.get("created_at")

    if not hasattr(get_dashboard_data, "plan_cache"):
        get_dashboard_data.plan_cache = {}

    import hashlib
    latest_chat_fp = f"{chats[0]['_id']}:{chats[0].get('timestamp')}" if chats else "c_none"
    latest_memory_fp = f"{memory_notes[0].get('conversation_id')}:{memory_notes[0].get('updated_at')}" if memory_notes else "n_none"
    fp_raw = f"{questionnaire.get('_id')}|{latest_chat_fp}|{latest_memory_fp}|{now.strftime('%Y-%m-%d')}"
    fingerprint = hashlib.md5(fp_raw.encode("utf-8")).hexdigest()

    cached = get_dashboard_data.plan_cache.get(user_id_str)
    if cached and cached.get("fingerprint") == fingerprint:
        return cached["plan"]

    def when(dt_val):
        dt_val = parse_dt(dt_val)
        return format_relative_time(dt_val) if dt_val != datetime.min else "recently"

    ratings_lines = [f"- {label}: {answers.get(key, 3)}/5" for key, label in QUESTIONNAIRE_DIMENSIONS.items()]
    average = sum(answers.get(k, 3) for k in QUESTIONNAIRE_DIMENSIONS) / max(len(QUESTIONNAIRE_DIMENSIONS), 1)
    lowest_dim = min(QUESTIONNAIRE_DIMENSIONS, key=lambda k: answers.get(k, 3))

    context_parts = [f"SELF CHECK-IN ({when(taken_at)}, 1 = struggling, 5 = doing well):\n" + "\n".join(ratings_lines)]
    if note.strip():
        context_parts.append(f"WHAT THEY SAID THEY WANT HELP WITH: \"{note.strip()[:400]}\"")
    if memory_notes:
        context_parts.append("RECENT AI SUPPORT CONVERSATIONS (newest first):\n" + "\n".join(
            f"- {when(n.get('updated_at'))}: {n.get('summary','')}" for n in memory_notes))
    else:
        chat_lines = [f"- {when(c.get('timestamp'))}: \"{(c.get('message') or '').strip()[:200]}\""
                      for c in chats[:3] if (c.get("message") or "").strip()]
        if chat_lines:
            context_parts.append("RECENT MESSAGES TO AI SUPPORT (newest first):\n" + "\n".join(chat_lines))
    journal_lines = [f"- {when(j.get('created_at') or j.get('timestamp'))}: \"{(j.get('text') or j.get('content') or j.get('title') or '').strip()[:200]}\""
                     for j in journals[:2] if (j.get("text") or j.get("content") or j.get("title") or "").strip()]
    if journal_lines:
        context_parts.append("RECENT JOURNAL ENTRIES (newest first):\n" + "\n".join(journal_lines))
    formatted_context = "\n\n".join(context_parts)

    plan = dict(FALLBACK_PLANS[lowest_dim])

    from rag import complete_text
    llm_prompt = (
        "You are MindEase, a compassionate wellness companion helping a user build a short coping plan "
        "so they can understand their own situation and know concretely what to do about it.\n\n"
        f"{formatted_context}\n\n"
        "Write the plan as a JSON object with exactly these keys:\n"
        '{"focus": "...", "overview": "...", "steps": [{"title": "...", "detail": "..."}, ...]}\n\n'
        "RULES:\n"
        "- \"focus\": 3-6 words naming the main thing to work on right now, grounded in their own ratings and words "
        "(e.g. \"Feeling closer to your family\"), never a clinical label.\n"
        "- \"overview\": 2-3 warm sentences showing you understand their actual situation (combine the ratings with "
        "the conversations/journal - do not just restate the numbers), and reassure them this is manageable.\n"
        "- \"steps\": exactly 3 to 4 concrete, doable actions for the next few days. Each needs a short \"title\" "
        "(3-6 words) and one supportive \"detail\" sentence explaining how or why, specific to their real situation - "
        "never generic filler like \"practice self-care\" on its own.\n"
        "- Never diagnose, never make medical claims, never promise outcomes you can't know.\n"
        f"- Their average rating is {average:.1f}/5. If it is 2.0 or lower, gently make one step about continuing "
        "to talk to MindEase AI Support or reaching out to a trusted person or professional - phrase it as care, not alarm.\n"
        "- Output ONLY the JSON object. No markdown fences, no preamble."
    )
    # max_tokens covers hidden reasoning too (gpt-oss "thinks" before answering), so it needs real
    # headroom above the short JSON reply itself, same as the chat LLM's own budget.
    ai_plan = complete_text(llm_prompt, max_tokens=1500, temperature=0.6, effort="low", json_mode=True, timeout=15)
    if ai_plan:
        try:
            parsed = json.loads(ai_plan)
            steps = parsed.get("steps") or []
            if parsed.get("focus") and parsed.get("overview") and isinstance(steps, list) and len(steps) >= 2:
                clean_steps = [{"title": s.get("title", "").strip(), "detail": s.get("detail", "").strip()}
                               for s in steps if s.get("title") and s.get("detail")]
                if clean_steps:
                    plan = {"focus": parsed["focus"].strip(), "overview": parsed["overview"].strip(), "steps": clean_steps}
        except Exception as e:
            print(f"Coping plan JSON parse error: {e}")

    result = {"has_questionnaire": True, "taken_at": taken_at, **plan}
    get_dashboard_data.plan_cache[user_id_str] = {"fingerprint": fingerprint, "plan": result}
    return result


@app.get("/dashboard")
def get_dashboard_data(
    current_user: dict = Depends(get_current_user)
):
    user_id_str = str(current_user["_id"])
    now = datetime.now()
    hour = now.hour
    
    # Personal Dynamic Greeting
    if hour < 12:
        greeting_time = "Good morning"
    elif hour < 17:
        greeting_time = "Good afternoon"
    else:
        greeting_time = "Good evening"
        
    full_name = current_user.get("name", "Friend")
    first_name = full_name.split(" ")[0] if full_name else "Friend"
    greeting = f"{greeting_time}, {first_name} 👋"

    # Fetch User Data (Strict User Isolation)
    journals = []
    if db_manager.journal_entries is not None:
        try:
            journals = list(db_manager.journal_entries.find({"user_id": user_id_str}).sort("_id", -1).limit(30))
        except Exception as e:
            print(f"Error reading journals for dashboard: {e}")

    chats = []
    if db_manager.chat_history is not None:
        try:
            chats = list(db_manager.chat_history.find({"user_id": user_id_str}).sort("_id", -1).limit(40))
        except Exception as e:
            print(f"Error reading chat_history for dashboard: {e}")

    mood_records = []
    if db_manager.mood_records is not None:
        try:
            mood_records = list(db_manager.mood_records.find({"user_id": user_id_str}).sort("_id", -1).limit(30))
        except Exception as e:
            print(f"Error reading mood_records for dashboard: {e}")

    latest_questionnaire = None
    if db_manager.questionnaires is not None:
        try:
            latest_questionnaire = db_manager.questionnaires.find_one(
                {"user_id": user_id_str}, sort=[("created_at", -1)])
        except Exception as e:
            print(f"Error reading questionnaire for dashboard: {e}")

    # CONTEXT EXTRACTION & RECENT USER-AUTHORED DATA PIPELINE
    def parse_dt(dt_val):
        if not dt_val:
            return datetime.min
        if isinstance(dt_val, datetime):
            return dt_val.replace(tzinfo=None) if dt_val.tzinfo else dt_val
        if isinstance(dt_val, str):
            try:
                parsed = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
                return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
            except Exception:
                try:
                    return datetime.strptime(str(dt_val)[:19], "%Y-%m-%d %H:%M:%S")
                except Exception:
                    return datetime.min
        return datetime.min

    user_events = []

    if mood_records:
        latest_mood = mood_records[0]
        core = latest_mood.get("core_emotion") or "Calm"
        spec = latest_mood.get("specific_feeling") or ""
        gran = latest_mood.get("granular_feeling") or ""
        hierarchy = f"{core}" + (f" → {spec}" if spec else "") + (f" → {gran}" if gran else "")
        user_events.append({
            "type": "feeling_checkin",
            "time": parse_dt(latest_mood.get("timestamp")),
            "core": core,
            "specific": spec,
            "granular": gran,
            "hierarchy": hierarchy,
            "detail": f"Selected feeling: {hierarchy}"
        })

    if chats:
        for c in chats:
            user_msg = c.get("message") or ""
            if user_msg and user_msg.strip():
                user_events.append({
                    "type": "ai_support",
                    "time": parse_dt(c.get("timestamp")),
                    "detail": user_msg.strip()[:150],
                    "emotion": c.get("emotion"),
                    "mental_state": c.get("mental_state")
                })
                break

    if journals:
        latest_j = journals[0]
        j_text = latest_j.get("text") or latest_j.get("content") or latest_j.get("title") or ""
        if j_text and j_text.strip():
            user_events.append({
                "type": "journal",
                "time": parse_dt(latest_j.get("created_at") or latest_j.get("timestamp")),
                "detail": j_text.strip()[:150],
                "mood": latest_j.get("mood")
            })

    # Sort user_events by time descending (Recency Priority: newest user event takes precedence)
    user_events.sort(key=lambda x: x["time"], reverse=True)
    latest_event = user_events[0] if user_events else None

    def format_relative_time(dt_val):
        if not dt_val:
            return "Recently"
        if isinstance(dt_val, str):
            try:
                dt_val = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
            except Exception:
                return dt_val[:16].replace("T", " ")
        if hasattr(dt_val, "tzinfo") and dt_val.tzinfo is not None:
            dt_val = dt_val.replace(tzinfo=None)
        
        diff = datetime.now() - dt_val
        diff_days = diff.days
        
        if diff_days <= 0:
            time_str = dt_val.strftime("%I:%M %p").lstrip("0")
            return f"Today · {time_str}"
        elif diff_days == 1:
            time_str = dt_val.strftime("%I:%M %p").lstrip("0")
            return f"Yesterday · {time_str}"
        elif diff_days < 7:
            return f"{diff_days} days ago"
        else:
            return dt_val.strftime("%b %d, %Y")

    # Compute composite context fingerprint across journals, user chats, and mood check-ins
    latest_journal_fp = f"{journals[0]['_id']}:{journals[0].get('created_at') or journals[0].get('timestamp')}" if journals else "j_none"
    latest_chat_fp = f"{chats[0]['_id']}:{chats[0].get('timestamp')}:{chats[0].get('message','')[:30]}" if chats else "c_none"
    latest_mood_fp = f"{mood_records[0]['_id']}:{mood_records[0].get('timestamp')}:{mood_records[0].get('core_emotion')}:{mood_records[0].get('specific_feeling')}:{mood_records[0].get('granular_feeling')}" if mood_records else "m_none"
    
    # Long-term memory notes of recent AI Support conversations (updated in the background after
    # each chat), so the reminder also refreshes once a conversation has been summarised.
    memory_notes = memory.recent_notes(user_id_str, limit=3)
    latest_memory_fp = f"{memory_notes[0].get('conversation_id')}:{memory_notes[0].get('updated_at')}" if memory_notes else "n_none"

    import hashlib
    # The date is part of the fingerprint so the reminder is also refreshed every day.
    composite_raw = f"{latest_journal_fp}|{latest_chat_fp}|{latest_mood_fp}|{latest_memory_fp}|{now.strftime('%Y-%m-%d')}"
    composite_fingerprint = hashlib.md5(composite_raw.encode("utf-8")).hexdigest()

    # Global cache check (Prevents redundant LLM calls & text jitter on dashboard reloads)
    if not hasattr(get_dashboard_data, "cache"):
        get_dashboard_data.cache = {}

    cached = get_dashboard_data.cache.get(user_id_str)
    if cached and cached.get("composite_fingerprint") == composite_fingerprint:
        reminder_message = cached["message"]
        category_pill = cached["category_pill"]
    else:
        # Determine tone and context elements based strictly on NEWEST user event (Recency priority)
        positive_keywords = ["grateful", "happy", "joyful", "excited", "peaceful", "calm", "okay", "good", "great", "better", "amused", "delighted", "optimistic", "content", "inspired"]
        difficult_keywords = ["fight", "angry", "sad", "upset", "hurt", "crying", "anxious", "overwhelmed", "scared", "fearful", "lonely", "hopeless", "depressed", "frustrated"]

        latest_event_type = latest_event["type"] if latest_event else "general"
        latest_text = latest_event.get("detail", "").lower() if latest_event else ""

        if latest_event_type == "feeling_checkin":
            latest_core = latest_event.get("core", "Calm")
            if latest_core in ["Happy", "Calm"]:
                detected_tone = "positive"
            else:
                detected_tone = "difficult"
        elif any(w in latest_text for w in positive_keywords):
            detected_tone = "positive"
        elif any(w in latest_text for w in difficult_keywords):
            detected_tone = "difficult"
        elif latest_event_type == "journal":
            detected_tone = "reflective"
        else:
            detected_tone = "neutral"

        # Formulate internal structured context (Backend-internal only, never exposed raw):
        # the latest check-in, the last few journal entries and AI Support conversations.
        def when(dt_val):
            dt_val = parse_dt(dt_val)
            return format_relative_time(dt_val) if dt_val != datetime.min else "recently"

        # AI Support conversations are the primary driver of the reminder; journal entries and
        # mood check-ins are only secondary, supporting context (put first in the prompt, and
        # called out as PRIMARY/SECONDARY, so the LLM actually leans on the conversation).
        context_parts = []
        if memory_notes:
            context_parts.append("PRIMARY CONTEXT - RECENT AI SUPPORT CONVERSATIONS (newest first):\n" + "\n".join(
                f"- {when(n.get('updated_at'))}: {n.get('summary','')}" for n in memory_notes))
        else:
            chat_lines = [f"- {when(c.get('timestamp'))}: \"{(c.get('message') or '').strip()[:200]}\""
                          for c in chats[:3] if (c.get("message") or "").strip()]
            if chat_lines:
                context_parts.append("PRIMARY CONTEXT - RECENT MESSAGES TO AI SUPPORT (newest first):\n" + "\n".join(chat_lines))
        has_chat_context = bool(context_parts)

        secondary_parts = []
        if mood_records:
            mr0 = mood_records[0]
            secondary_parts.append(f"LATEST FEELING CHECK-IN ({when(mr0.get('timestamp'))}): {mr0.get('core_emotion','')} → {mr0.get('specific_feeling','')} → {mr0.get('granular_feeling','')}")
        journal_lines = []
        for j in journals[:3]:
            j_text = (j.get("text") or j.get("content") or j.get("title") or "").strip()
            if j_text:
                mood_tag = f", mood {j.get('mood')}" if j.get("mood") else ""
                journal_lines.append(f"- {when(j.get('created_at') or j.get('timestamp'))}{mood_tag}: \"{j_text[:250]}\"")
        if journal_lines:
            secondary_parts.append("RECENT JOURNAL ENTRIES (newest first):\n" + "\n".join(journal_lines))
        if secondary_parts:
            label = "SECONDARY CONTEXT" if has_chat_context else "PRIMARY CONTEXT (no recent AI Support conversation)"
            context_parts.append(f"{label}:\n" + "\n\n".join(secondary_parts))
        if latest_event:
            context_parts.append(f"MOST RECENT ACTIVITY: {latest_event['type'].replace('_', ' ')} ({when(latest_event.get('time'))})")

        formatted_context = "\n\n".join(context_parts) if context_parts else "No recent activities recorded yet."

        # Determine dynamic category pill label
        if detected_tone == "positive":
            category_pill = "A Small Win" if latest_event_type != "journal" else "Mindful Moment"
        elif latest_event_type == "journal":
            category_pill = "Personal Reflection"
        elif latest_event_type == "ai_support":
            category_pill = "Support & Reflection"
        elif latest_event_type == "feeling_checkin":
            category_pill = "Emotional Check-in"
        else:
            category_pill = "Daily Reminder"

        # Context-Aware Fallback Engine (No repetitive generic hardcoding)
        if detected_tone == "positive":
            if latest_event_type == "feeling_checkin":
                fallback_msg = "You've been noticing some brighter moments today. Give yourself a little space to enjoy them."
            elif latest_event_type == "ai_support":
                fallback_msg = "You expressed some uplifting thoughts today. Keep holding onto that positive warmth."
            elif latest_event_type == "journal":
                fallback_msg = "You brought positive reflection into your journal today. Celebrating these moments matters."
            else:
                fallback_msg = "You've been noticing brighter moments today. Give yourself space to enjoy them."
        elif detected_tone == "difficult":
            if latest_event_type == "ai_support":
                fallback_msg = "You gave yourself room to talk through what's on your mind today."
            elif latest_event_type == "feeling_checkin":
                fallback_msg = "You took a moment to honor how you're feeling today. Be gentle with yourself."
            else:
                fallback_msg = "You're giving your thoughts space today. Take things one step at a time."
        elif latest_event_type == "journal":
            fallback_msg = "You took a moment to put your thoughts into words today. That space for reflection is valuable."
        elif latest_event_type == "ai_support":
            fallback_msg = "You reached out to give your thoughts some space today."
        elif latest_event_type == "feeling_checkin":
            fallback_msg = "You took a moment to check in with how you're feeling today. Keep noticing what matters to you."
        else:
            fallback_msg = "Take a gentle moment today to notice how you're feeling."

        reminder_message = fallback_msg

        # LLM Synthesis (if Groq LLM client is available)
        if context_parts:
            from rag import complete_text
            llm_prompt = (
                f"You are MindEase, a compassionate emotional wellness companion.\n"
                f"Today is {now.strftime('%A, %d %B')}. Write the user's daily reminder for their home screen.\n\n"
                f"{formatted_context}\n\n"
                f"RULES:\n"
                f"- Base the reminder mainly on the PRIMARY CONTEXT above (what they actually talked about with "
                f"MindEase AI Support). Use the SECONDARY CONTEXT (journal, feeling check-ins) only to add a small "
                f"supporting detail if it genuinely fits - never let it override or contradict what the conversation shows.\n"
                f"- One sentence, at most 25 words, speaking to the user as \"you\".\n"
                f"- Refer to something specific from the conversation (the newest matters most), so it clearly reflects their own week, without quoting private details word for word.\n"
                f"- If their context is positive, grateful, or peaceful, reflect that with gentle validation. Do NOT invent anxiety, stress, or conflict.\n"
                f"- If it involves difficulty or conflict, offer compassionate, non-judgmental encouragement for today without diagnosing or exaggerating.\n"
                f"- Output ONLY the reminder text. No quotes, no preamble."
            )
            ai_reminder = complete_text(llm_prompt, max_tokens=500, temperature=0.6, timeout=10)
            if ai_reminder:
                ai_reminder = ai_reminder.strip().replace('"', '')
                if len(ai_reminder) > 10:
                    reminder_message = ai_reminder

        # Update cache for this user
        get_dashboard_data.cache[user_id_str] = {
            "composite_fingerprint": composite_fingerprint,
            "message": reminder_message,
            "category_pill": category_pill
        }

    # COPING PLAN (questionnaire + AI Support chat + journal/mood context)
    coping_plan = _build_coping_plan(user_id_str, latest_questionnaire, memory_notes, chats, journals,
                                      mood_records, now, format_relative_time, parse_dt)

    # TIMELINE & JOURNEY ACTIVITIES AGGREGATION
    raw_journey = []

    # Mood Check-ins
    emoji_map = {"Calm": "😌", "Happy": "😊", "Sad": "😢", "Angry": "😠", "Fearful": "😟"}
    for m in mood_records:
        t_val = m.get("timestamp")
        core = m.get("core_emotion", "Calm")
        label = m.get("granular_feeling") or m.get("specific_feeling") or core
        raw_journey.append({
            "id": f"checkin_{m.get('_id')}",
            "type": "feeling_checkin",
            "title": "Feeling Check-in",
            "subtitle": label,
            "icon": emoji_map.get(core, "🌱"),
            "raw_time": t_val if isinstance(t_val, datetime) else datetime.min
        })

    # Journal Entries
    for j in journals:
        t_val = j.get("created_at") or j.get("timestamp")
        title_val = j.get("title") or "Reflection added"
        raw_journey.append({
            "id": f"journal_{j.get('_id')}",
            "type": "journal",
            "title": "Journal",
            "subtitle": title_val,
            "icon": "📖",
            "raw_time": t_val if isinstance(t_val, datetime) else datetime.min
        })

    # AI Support (Grouped per conversation)
    seen_convs = set()
    for c in chats:
        cid = c.get("conversation_id")
        if cid and cid in seen_convs:
            continue
        if cid:
            seen_convs.add(cid)
        t_val = c.get("timestamp")
        raw_journey.append({
            "id": f"chat_{c.get('_id')}",
            "type": "ai_support",
            "title": "AI Support",
            "subtitle": c.get("title") or "Talked with MindEase",
            "icon": "💬",
            "raw_time": t_val if isinstance(t_val, datetime) else datetime.min
        })

    # Sort journey events chronologically descending
    raw_journey.sort(key=lambda x: x["raw_time"] if isinstance(x["raw_time"], datetime) else datetime.min, reverse=True)
    
    journey_activities = []
    for item in raw_journey[:6]:
        journey_activities.append({
            "id": item["id"],
            "type": item["type"],
            "title": item["title"],
            "subtitle": item["subtitle"],
            "icon": item["icon"],
            "time": format_relative_time(item["raw_time"])
        })

    # CONTEXTUAL "A MOMENT TO NOTICE"
    total_recent = len(journey_activities)
    checkin_recent = sum(1 for x in journey_activities if x["type"] == "feeling_checkin")
    journal_recent = sum(1 for x in journey_activities if x["type"] == "journal")
    chat_recent = sum(1 for x in journey_activities if x["type"] == "ai_support")

    if checkin_recent >= 2:
        a_moment_to_notice = "You've been checking in with yourself regularly this week."
    elif journal_recent >= 1 and checkin_recent >= 1:
        a_moment_to_notice = "You returned to your journal after checking in with your feelings."
    elif journal_recent >= 2:
        a_moment_to_notice = "You've been making space to reflect in your journal recently."
    elif chat_recent >= 1:
        a_moment_to_notice = "You reached out to MindEase recently to process your thoughts."
    elif total_recent >= 1:
        a_moment_to_notice = "You've been giving your thoughts and feelings space lately."
    else:
        a_moment_to_notice = "Taking a moment to check in with yourself builds a gentle rhythm of self-care."

    # CONTEXTUAL "WHAT CAN HELP RIGHT NOW?" ACTIONS & WHAT HELPED (COMPATIBILITY)
    unique_conversations = set()
    for c in chats:
        cid = c.get("conversation_id")
        if cid:
            unique_conversations.add(cid)
            
    ai_conv_count = len(unique_conversations) if unique_conversations else len(chats)
    journal_count = len(journals)
    checkin_count = len(mood_records)

    suggested_actions = [
        {"id": "breath", "title": "2-Minute Breathing", "subtitle": "Take a short reset to center yourself", "icon": "🌬", "path": "/safe-place", "category": "Calming"},
        {"id": "chat", "title": "Talk to MindEase", "subtitle": "Share whatever is on your mind right now", "icon": "💬", "path": "/chat", "category": "AI Companion"},
        {"id": "journal", "title": "Journal Reflection", "subtitle": "Write down a quick check-in for today", "icon": "📖", "path": "/journal", "category": "Reflection"}
    ]

    what_helped = [
        {"activity": "Journal Entries", "count": journal_count, "icon": "📖"},
        {"activity": "AI Support Sessions", "count": ai_conv_count, "icon": "💬"},
        {"activity": "Feeling Wheel Check-ins", "count": checkin_count, "icon": "🎯"},
        {"activity": "Calming Resets", "count": min(checkin_count + journal_count, 12), "icon": "🌬"}
    ]

    # WEEKLY EMOTIONAL TIMELINE (Past 7 Days: Mon to Sun)
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday()) # Monday
    days_map = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    weekly_timeline = []

    record_by_date = {}
    for m in mood_records:
        d_str = m.get("date_str")
        if not d_str and m.get("timestamp"):
            d_str = str(m.get("timestamp"))[:10]
        if d_str and d_str not in record_by_date:
            core = m.get("core_emotion", "Calm")
            record_by_date[d_str] = {
                "emoji": emoji_map.get(core, "😌"),
                "emotion": m.get("granular_feeling") or m.get("specific_feeling") or core,
                "has_activity": True
            }

    for j in journals:
        raw_t = j.get("created_at") or j.get("time") or j.get("date")
        if raw_t:
            d_str = str(raw_t)[:10]
            if d_str not in record_by_date:
                m_str = j.get("mood", "Calm")
                emoji_val = m_str[0] if m_str and len(m_str) > 1 and not m_str[0].isalnum() else "😌"
                clean_m = m_str.replace("😊 ", "").replace("😌 ", "").replace("😟 ", "").replace("😢 ", "").replace("😫 ", "")
                record_by_date[d_str] = {
                    "emoji": emoji_val,
                    "emotion": clean_m or "Checked in",
                    "has_activity": True
                }

    for idx, day_name in enumerate(days_map):
        day_date = start_of_week + timedelta(days=idx)
        d_str = day_date.strftime("%Y-%m-%d")
        if d_str in record_by_date:
            item_data = record_by_date[d_str]
            weekly_timeline.append({
                "day": day_name,
                "date": day_date.strftime("%b %d"),
                "emoji": item_data["emoji"],
                "emotion": item_data["emotion"],
                "has_activity": True,
                "is_today": day_date == today
            })
        else:
            weekly_timeline.append({
                "day": day_name,
                "date": day_date.strftime("%b %d"),
                "emoji": "▫️",
                "emotion": "No entry",
                "has_activity": False,
                "is_today": day_date == today
            })

    latest_checkin = None
    if mood_records:
        mr0 = mood_records[0]
        latest_checkin = {
            "core_emotion": mr0.get("core_emotion"),
            "specific_feeling": mr0.get("specific_feeling"),
            "granular_feeling": mr0.get("granular_feeling"),
            "timestamp": mr0.get("timestamp")
        }

    return {
        "greeting": greeting,
        "first_name": first_name,
        "daily_reminder": {
            "message": reminder_message,
            "category_pill": category_pill
        },
        "journey_activities": journey_activities,
        "a_moment_to_notice": a_moment_to_notice,
        "latest_checkin": latest_checkin,
        "coping_plan": coping_plan,
        "suggested_actions": suggested_actions,
        "what_helped": what_helped,
        "weekly_timeline": weekly_timeline,
        "activity_counts": {
            "journals": journal_count,
            "ai_conversations": ai_conv_count,
            "checkins": checkin_count
        }
    }


# YOUTUBE CONTENT ENDPOINT
from services.youtube_service import get_youtube_videos

@app.get("/api/content/youtube")
def get_youtube_content():
    videos = get_youtube_videos()
    return {"status": "success", "count": len(videos), "data": videos}


# AUTO SYNC CUSTOM LANDING IMAGES TO PUBLIC FOLDER
try:
    import shutil
    _src_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "images")
    _dst_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "images")
    if os.path.exists(_src_dir):
        os.makedirs(_dst_dir, exist_ok=True)
        _imgs = [f for f in sorted(os.listdir(_src_dir)) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
        for idx, f in enumerate(_imgs, 1):
            shutil.copy2(os.path.join(_src_dir, f), os.path.join(_dst_dir, f"hero_custom_{idx}.jpg"))
        print(f"Auto-synced {len(_imgs)} custom landing images to public/images.")
except Exception as e:
    print(f"Image sync warning: {e}")


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
    generate_response = _timed(generate_response, "reply (retrieval + LLM)")
    save_chat = _timed(save_chat, "save to database")

    @app.middleware("http")
    async def _log_request_time(request, call_next):
        t = _time.perf_counter()
        response = await call_next(request)
        print(f"[timing] {request.method} {request.url.path}: {_time.perf_counter() - t:.2f}s total", flush=True)
        return response

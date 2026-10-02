import os
import sys
import json
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
from fastapi.responses import RedirectResponse  # type: ignore # pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware  # type: ignore # pyrefly: ignore [missing-import]
from pydantic import BaseModel  # type: ignore # pyrefly: ignore [missing-import]
from transformers import pipeline  # type: ignore # pyrefly: ignore [missing-import]
from bson import ObjectId  # type: ignore # pyrefly: ignore [missing-import]

from rag import generate_llm_response
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
    yield
    db_manager.close_db()

# INIT APP

app = FastAPI(lifespan=lifespan)

# CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.content_router import router as content_router
app.include_router(content_router)




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
                    "text-classification",
                    model=LOCAL_EMOTION_PATH,
                    tokenizer=LOCAL_EMOTION_PATH,
                    top_k=3
                )
            except Exception:
                _emotion_model = pipeline("text-classification", model=HUB_EMOTION_MODEL, top_k=3)
        else:
            print(f"Loading emotion model ({HUB_EMOTION_MODEL})...")
            _emotion_model = pipeline("text-classification", model=HUB_EMOTION_MODEL, top_k=3)
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
                    "text-classification",
                    model=LOCAL_RISK_PATH,
                    tokenizer=LOCAL_RISK_PATH
                )
            except Exception:
                _mental_model = pipeline("text-classification", model=HUB_RISK_MODEL)
        else:
            print(f"Loading risk model ({HUB_RISK_MODEL})...")
            _mental_model = pipeline("text-classification", model=HUB_RISK_MODEL)
    return _mental_model

def get_safety_model():
    global _safety_model
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
        secure=False,  # Set to False for local HTTP development
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
        secure=False,
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
    
    redirect_response = RedirectResponse(url=f"http://localhost:5173/dashboard?token={token}")
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
        secure=False,
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
    
    redirect_response = RedirectResponse(url=f"http://localhost:5173/dashboard?token={token}")
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


# RESPONSE GENERATION

def generate_response(emotion, mental_state, user_text):
    llm_reply = generate_llm_response(user_text, emotion, mental_state)
    if llm_reply:
        return llm_reply

    if mental_state == "sadness":
        return "I'm really sorry you're feeling low. Do you want to talk about what's been bothering you?"
    elif mental_state == "anger":
        return "It sounds like something is frustrating you. Would you like to share more?"
    elif mental_state == "fear":
        return "I understand you're feeling anxious. What's making you feel this way?"
    elif emotion == "positive":
        return "That's great to hear 😊 What made you feel this way today?"
    else:
        return "I'm here for you. Tell me more about what's on your mind."


# SAFETY DETECTION

def evaluate_safety(text):
    text_lower = text.lower()
    safe_contexts = ["movie", "friend", "character", "book", "song"]
    
    if any(ctx in text_lower for ctx in safe_contexts):
        return {
            "riskLevel": "LOW",
            "confidence": 1.0,
            "requiresSafetyFlow": False
        }

    # Crisis keyword fallback list for zero-downtime safety evaluation
    danger_keywords = ["suicide", "kill myself", "end my life", "want to die", "overdose", "self harm", "cutting myself", "hanging myself"]
    distress_keywords = ["hopeless", "can't go on", "overwhelmed", "breakdown", "panicking", "depressed"]

    safety_pipe = get_safety_model()
    if safety_pipe is not None:
        try:
            candidate_labels = ["safe", "emotional distress", "immediate danger or self harm"]
            result = safety_pipe(text, candidate_labels)
            scores = dict(zip(result['labels'], result['scores']))
            
            danger_score = scores.get("immediate danger or self harm", 0)
            distress_score = scores.get("emotional distress", 0)
            
            if danger_score > 0.6:
                return {
                    "riskLevel": "HIGH",
                    "confidence": round(danger_score, 2),
                    "requiresSafetyFlow": True
                }
            elif distress_score > 0.7:
                return {
                    "riskLevel": "MEDIUM",
                    "confidence": round(distress_score, 2),
                    "requiresSafetyFlow": True
                }
            else:
                return {
                    "riskLevel": "LOW",
                    "confidence": round(scores.get("safe", 0), 2),
                    "requiresSafetyFlow": False
                }
        except Exception as e:
            print(f"Safety model inference error: {e}. Falling back to rule safety evaluation.")

    # Lightweight fail-safe fallback
    if any(k in text_lower for k in danger_keywords):
        return {
            "riskLevel": "HIGH",
            "confidence": 0.95,
            "requiresSafetyFlow": True
        }
    elif any(k in text_lower for k in distress_keywords):
        return {
            "riskLevel": "MEDIUM",
            "confidence": 0.85,
            "requiresSafetyFlow": True
        }

    return {
        "riskLevel": "LOW",
        "confidence": 0.9,
        "requiresSafetyFlow": False
    }

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
                "safety_level": "HIGH" if emotion == "crisis" else "LOW",
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
    emails: List[str]

@app.post("/api/sos")
def send_sos(req: SosRequest):
    sender_email = os.environ.get("SENDER_EMAIL")
    sender_password = os.environ.get("SENDER_PASSWORD")

    if not sender_email or not sender_password:
        print("WARNING: Email not sent. Please set SENDER_EMAIL and SENDER_PASSWORD environment variables.")
        return {"message": "Simulated sending emails. Set credentials to actually send."}

    subject = "MindEase SOS Alert"
    body = """
    <h2>MindEase SOS Alert</h2>
    <p>Your friend is not feeling okay right now and has indicated through MindEase that they may need immediate support.</p>
    <p><strong>Please check on them as soon as you can.</strong></p>
    """
    
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        
        for recipient in req.emails:
            msg = MIMEMultipart()
            msg["From"] = sender_email
            msg["To"] = recipient
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "html"))
            
            server.send_message(msg)
            
        server.quit()
        return {"message": f"Successfully sent SOS to {len(req.emails)} contacts."}
        
    except Exception as e:
        print(f"Failed to send email: {e}")
        return {"error": str(e)}


# CHAT API

@app.post("/chat")
def chat(req: ChatRequest, current_user: Optional[dict] = Depends(get_optional_current_user)):
    user_input = req.message
    user_id = str(current_user["_id"]) if current_user else "demo_user"
    conv_id = req.conversation_id

    safety_result = evaluate_safety(user_input)

    if safety_result["riskLevel"] == "HIGH":
        response = "I'm really sorry you're going through this. Your safety is important. You don't have to handle this alone."
        
        assigned_conv_id, assigned_title = save_chat(
            user_input,
            response,
            "crisis",
            "critical",
            user_id,
            conversation_id=conv_id,
            safety=safety_result
        )
        
        return {
            "response": response,
            "emotion": "crisis",
            "mental_state": "critical",
            "safety": safety_result,
            "conversation_id": assigned_conv_id,
            "title": assigned_title
        }

    emotion_pipe = get_emotion_model()
    emotion_preds = emotion_pipe(user_input)[0]
    raw_emotions = []
    mapped_emotions = []

    for p in emotion_preds:
        label = p["label"]
        raw_emotions.append(label)
        mapped_emotions.append(map_emotion(label))

    final_emotion = mapped_emotions[0]

    mental_pipe = get_mental_model()
    mental_pred = mental_pipe(user_input)[0]
    mental_state = mental_pred["label"]

    text_lower = user_input.lower()
    positive_current_phrases = [
        "now i am happy", "now i'm happy", "now i feel happy",
        "now i am feeling happy", "now i'm feeling happy",
        "but now i am happy", "but now i'm happy",
        "but now i feel happy", "but now i'm feeling happy",
        "i am happy now", "i'm happy now", "feeling happy now"
    ]

    if any(phrase in text_lower for phrase in positive_current_phrases):
        final_emotion = "positive"
        mental_state = "joy"

    response = generate_response(
        final_emotion,
        mental_state,
        user_input
    )

    assigned_conv_id, assigned_title = save_chat(
        user_input,
        response,
        final_emotion,
        mental_state,
        user_id,
        conversation_id=conv_id,
        top_emotions=raw_emotions,
        safety=safety_result
    )

    return {
        "response": response,
        "emotion": final_emotion,
        "mental_state": mental_state,
        "top_emotions": raw_emotions,
        "safety": safety_result,
        "conversation_id": assigned_conv_id,
        "title": assigned_title
    }


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
            
            new_id = max_id + 1
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
            return json.load(f)
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
                    for j in journals:
                        if str(j.get("id")) == str(journal_id):
                            j.update(set_fields)
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
        if str(journal.get("id")) == str(journal_id):
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
        updated_journals = [
            j for j in journals if str(j.get("id")) != str(journal_id)
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


# INSIGHTS ENDPOINT (USER ISOLATED & CONSOLIDATED DATA TRACING)

@app.get("/insights")
def get_insights(view: str = "weekly", current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    # 1. Fetch authenticated user's journal entries (MongoDB + local JSON fallback)
    journals = []
    if db_manager.is_connected() and db_manager.journal_entries is not None:
        try:
            cursor = db_manager.journal_entries.find({"$or": [{"user_id": user_id}, {"user_id": {"$exists": False}}]})
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
                    if not j.get("user_id") or j.get("user_id") == user_id:
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
        "insight_summary": insight_summary
    }


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

    # Compute composite context fingerprint across journals, user chats, and mood check-ins
    latest_journal_fp = f"{journals[0]['_id']}:{journals[0].get('created_at') or journals[0].get('timestamp')}" if journals else "j_none"
    latest_chat_fp = f"{chats[0]['_id']}:{chats[0].get('timestamp')}:{chats[0].get('message','')[:30]}" if chats else "c_none"
    latest_mood_fp = f"{mood_records[0]['_id']}:{mood_records[0].get('timestamp')}:{mood_records[0].get('core_emotion')}:{mood_records[0].get('specific_feeling')}:{mood_records[0].get('granular_feeling')}" if mood_records else "m_none"
    
    import hashlib
    composite_raw = f"{latest_journal_fp}|{latest_chat_fp}|{latest_mood_fp}"
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

        # Formulate internal structured context (Backend-internal only, never exposed raw)
        context_parts = []
        if mood_records:
            mr0 = mood_records[0]
            context_parts.append(f"CURRENT FEELING CHECK-IN: {mr0.get('core_emotion','')} → {mr0.get('specific_feeling','')} → {mr0.get('granular_feeling','')}")
        if user_events:
            for ev in user_events:
                if ev["type"] == "ai_support":
                    context_parts.append(f"RECENT USER CHAT MESSAGE: \"{ev['detail']}\"")
                elif ev["type"] == "journal":
                    context_parts.append(f"RECENT USER JOURNAL ENTRY: \"{ev['detail']}\"")
        if latest_event:
            context_parts.append(f"MOST RECENT EVENT ({latest_event['type']}): \"{latest_event['detail'][:100]}\"")

        formatted_context = "\n".join(context_parts) if context_parts else "No recent activities recorded yet."

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
        try:
            from rag import groq_client, RAG_AVAILABLE
            if RAG_AVAILABLE and groq_client and os.environ.get("GROQ_API_KEY"):
                llm_prompt = (
                    f"You are MindEase, a compassionate emotional wellness companion.\n"
                    f"Synthesize a 1-sentence, gentle, supportive, non-diagnostic daily reminder (max 22 words) for the user's home screen based on their latest context:\n\n"
                    f"{formatted_context}\n\n"
                    f"RULES:\n"
                    f"- Acknowledge their recent context with warmth.\n"
                    f"- If the user's context is positive, grateful, or peaceful, reflect that positive energy with gentle validation. Do NOT invent anxiety, stress, or conflict.\n"
                    f"- If the user's context is reflective, offer gentle encouragement.\n"
                    f"- If the user's context involves difficulty or conflict, offer compassionate, non-judgmental support without diagnosing or exaggerating.\n"
                    f"- Output ONLY the 1-sentence reminder text. No quotes, no preamble."
                )
                completion = groq_client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": llm_prompt}],
                    max_tokens=60,
                    temperature=0.5,
                )
                ai_reminder = completion.choices[0].message.content.strip().replace('"', '')
                if ai_reminder and len(ai_reminder) > 10:
                    reminder_message = ai_reminder
        except Exception as e:
            print(f"Dynamic LLM reminder synthesis fallback: {e}")

        # Update cache for this user
        get_dashboard_data.cache[user_id_str] = {
            "composite_fingerprint": composite_fingerprint,
            "message": reminder_message,
            "category_pill": category_pill
        }

    # TIMELINE & JOURNEY ACTIVITIES AGGREGATION
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







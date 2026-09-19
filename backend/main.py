import os
import sys
import json
import secrets
from datetime import datetime
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
        print("Loading safety model (cross-encoder/nli-distilroberta-base)...")
        _safety_model = pipeline(
            "zero-shot-classification",
            model="cross-encoder/nli-distilroberta-base"
        )
        print("Safety model loaded successfully!")
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

    candidate_labels = ["safe", "emotional distress", "immediate danger or self harm"]
    safety_pipe = get_safety_model()
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

def save_journal(entry, mood, user_id: str):
    time_str = str(datetime.now())
    
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
                "text": entry,
                "mood": mood,
                "time": time_str,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            res = db_manager.journal_entries.insert_one(doc)
            
            doc["_id"] = str(res.inserted_id)
            doc.pop("created_at", None)
            doc.pop("updated_at", None)
            
            data_to_save = {"id": new_id, "text": entry, "mood": mood, "time": time_str}
            local_journals.append(data_to_save)
            with open("journal.json", "w") as f:
                json.dump(local_journals, f, indent=4)
                
            return doc
        except Exception as e:
            print(f"MongoDB save_journal error: {e}")

    new_id = max_id + 1
    data = {
        "id": new_id,
        "text": entry,
        "mood": mood,
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

class JournalRequest(BaseModel):
    text: str
    mood: str = ""

@app.post("/journal")
def add_journal(req: JournalRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    data = save_journal(
        req.text,
        req.mood,
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
    query = {"user_id": user_id}
    if journal_id.isdigit():
        query["id"] = int(journal_id)
    elif ObjectId.is_valid(journal_id):
        query["_id"] = ObjectId(journal_id)
    else:
        query["id"] = journal_id

    if db_manager.is_connected() and db_manager.journal_entries is not None:
        try:
            updated = db_manager.journal_entries.find_one_and_update(
                query,
                {"$set": {"text": req.text, "mood": req.mood, "time": time_str, "updated_at": datetime.now()}},
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
                            j["text"] = req.text
                            j["mood"] = req.mood
                            j["time"] = time_str
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
            journal["text"] = req.text
            journal["mood"] = req.mood
            journal["time"] = time_str
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
        query["id"] = int(journal_id)
    elif ObjectId.is_valid(journal_id):
        query["_id"] = ObjectId(journal_id)
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

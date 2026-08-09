from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
import json
from datetime import datetime

# INIT APP

app = FastAPI()

# CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LOAD MODELS

print("Loading models...")

emotion_model = pipeline(
    "text-classification",
    model="SamLowe/roberta-base-go_emotions",
    top_k=3
)

mental_model = pipeline(
    "text-classification",
    model="bhadresh-savani/distilbert-base-uncased-emotion"
)

print("Models loaded successfully!")


# REQUEST MODEL

class ChatRequest(BaseModel):
    message: str


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

def generate_response(emotion, mental_state):

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


# CRISIS DETECTION

def is_crisis(text):

    keywords = [
        "suicide",
        "kill myself",
        "end my life",
        "killing myself",
        "commit suicide"
    ]

    return any(k in text.lower() for k in keywords)


# SAVE CHAT

def save_chat(user_input, response, emotion, mental_state):

    chat_data = {
        "message": user_input,
        "response": response,
        "emotion": emotion,
        "mental_state": mental_state,
        "time": str(datetime.now())
    }

    try:
        with open("chat_history.json", "r") as f:
            chats = json.load(f)

    except:
        chats = []

    chats.append(chat_data)

    with open("chat_history.json", "w") as f:
        json.dump(chats, f, indent=4)


# ROOT

@app.get("/")
def home():
    return {"message": "MindEase Dual Model Backend Running"}


# CHAT API

@app.post("/chat")
def chat(req: ChatRequest):

    user_input = req.message

    # CRISIS HANDLING

    if is_crisis(user_input):

        response = (
            "I'm really sorry you're feeling this way 💜 "
            "You're not alone. Please consider reaching out "
            "to a trusted person or a helpline."
        )

        save_chat(
            user_input,
            response,
            "crisis",
            "critical"
        )

        return {
            "response": response,
            "emotion": "crisis",
            "mental_state": "critical"
        }


    # MODEL 1 → EMOTIONS

    emotion_preds = emotion_model(user_input)[0]

    raw_emotions = []
    mapped_emotions = []

    for p in emotion_preds:

        label = p["label"]

        raw_emotions.append(label)
        mapped_emotions.append(map_emotion(label))

    final_emotion = mapped_emotions[0]


    # MODEL 2 → MENTAL STATE

    mental_pred = mental_model(user_input)[0]

    mental_state = mental_pred["label"]


    # CURRENT FEELING OVERRIDE
    #
    # Handles sentences where the user talks about
    # a previous negative feeling but clearly states
    # that they feel positive now.

    text_lower = user_input.lower()

    positive_current_phrases = [
        "now i am happy",
        "now i'm happy",
        "now i feel happy",
        "now i am feeling happy",
        "now i'm feeling happy",
        "but now i am happy",
        "but now i'm happy",
        "but now i feel happy",
        "but now i'm feeling happy",
        "i am happy now",
        "i'm happy now",
        "feeling happy now"
    ]

    if any(
        phrase in text_lower
        for phrase in positive_current_phrases
    ):

        final_emotion = "positive"
        mental_state = "joy"


    # RESPONSE

    response = generate_response(
        final_emotion,
        mental_state
    )


    # SAVE CHAT

    save_chat(
        user_input,
        response,
        final_emotion,
        mental_state
    )


    # RETURN

    return {
        "response": response,
        "emotion": final_emotion,
        "mental_state": mental_state,
        "top_emotions": raw_emotions
    }


# JOURNAL SAVE FUNCTION

def save_journal(entry, mood):

    try:
        with open("journal.json", "r") as f:
            journals = json.load(f)

    except:
        journals = []

    # Generate unique ID
    new_id = max(
        [journal.get("id", 0) for journal in journals],
        default=0
    ) + 1

    data = {
        "id": new_id,
        "text": entry,
        "mood": mood,
        "time": str(datetime.now())
    }

    journals.append(data)

    with open("journal.json", "w") as f:
        json.dump(journals, f, indent=4)

    return data


# GET JOURNAL ENTRIES

@app.get("/journal")
def get_journal():

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
def add_journal(req: JournalRequest):

    data = save_journal(
        req.text,
        req.mood
    )

    return {
        "message": "Saved successfully",
        "entry": data
    }


# UPDATE JOURNAL ENTRY

@app.put("/journal/{journal_id}")
def update_journal(
    journal_id: int,
    req: JournalRequest
):

    try:

        with open("journal.json", "r") as f:
            journals = json.load(f)

    except:

        journals = []

    for journal in journals:

        if journal.get("id") == journal_id:

            journal["text"] = req.text
            journal["mood"] = req.mood
            journal["time"] = str(datetime.now())

            with open("journal.json", "w") as f:
                json.dump(journals, f, indent=4)

            return {
                "message": "Updated successfully",
                "entry": journal
            }

    return {
        "message": "Journal entry not found"
    }


# DELETE JOURNAL ENTRY

@app.delete("/journal/{journal_id}")
def delete_journal(journal_id: int):

    try:

        with open("journal.json", "r") as f:
            journals = json.load(f)

    except:

        journals = []

    updated_journals = [
        journal
        for journal in journals
        if journal.get("id") != journal_id
    ]

    if len(updated_journals) == len(journals):

        return {
            "message": "Journal entry not found"
        }

    with open("journal.json", "w") as f:
        json.dump(updated_journals, f, indent=4)

    return {
        "message": "Deleted successfully"
    }
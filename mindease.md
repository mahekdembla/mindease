# MindEase — Master Project Context

> **Purpose:** This document is the authoritative technical and project context for the MindEase application.
>
> **Important:** The current implementation described here is based on inspection of the actual MindEase repository. The actual codebase is the source of truth. Do not assume a feature is implemented merely because it appears in a proposal, README, old code, or future-scope document.

---

# 1. Project Overview

## Project Name

**MindEase**

## Project Type

MindEase is a **digital mental health and emotional wellness web application**.

The application combines:

* AI-assisted emotional support
* Emotion classification
* Mental-state classification
* Crisis/safety detection
* Digital journaling
* Mood tracking
* Mood analytics and insights
* Safe Place / trusted contact management
* SOS emergency email notifications
* Crisis support resources
* Voice input
* User settings and preferences

The current application is a web-based client-server system consisting of:

```text
React Frontend
       ↓
FastAPI Backend
       ↓
ML Models / JSON Storage / SMTP
```

The frontend is a React Single Page Application and the backend is a Python FastAPI server.

---

# 2. Core Problem MindEase Addresses

MindEase is designed to address several problems related to emotional wellness:

### 2.1 Immediate Emotional Support

Users can interact with an AI-assisted support system when they need a low-friction space to express their emotions.

### 2.2 Emotional Self-Awareness

Users can record moods and journal entries and view historical patterns through the Insights section.

### 2.3 Crisis/Safety Detection

The system analyzes incoming chatbot messages for possible emotional distress or immediate danger/self-harm indicators.

### 2.4 Emergency Human Support

When high-risk content is detected, the system can provide crisis messaging and allow an SOS alert to be sent to trusted contacts.

---

# 3. Target Users

The current project is intended primarily for:

* Individuals seeking emotional reflection
* Users dealing with everyday stress or emotional difficulties
* Users who want to track their mood
* Users who want to maintain a private digital journal
* Users who may need access to trusted contacts during a crisis

The application should be described as an **emotional wellness/support system**, not as a replacement for professional mental-health care.

---

# 4. Current Application Modules

The current frontend contains the following major modules:

```text
MindEase
│
├── Landing Page
├── Login
├── Signup
├── Dashboard
├── AI Support
├── Journal
├── Safe Place
├── Insights
└── Settings
```

There is also a global sidebar and Crisis Modal.

---

# 5. Feature Status

| Feature                      | Status                | Current Implementation          |
| ---------------------------- | --------------------- | ------------------------------- |
| Landing Page                 | IMPLEMENTED           | React                           |
| 3-Minute Demo                | IMPLEMENTED           | `localStorage` + timer          |
| Login                        | PARTIALLY IMPLEMENTED | Client-side localStorage        |
| Signup                       | PARTIALLY IMPLEMENTED | Client-side localStorage        |
| AI Support                   | IMPLEMENTED           | FastAPI + HuggingFace models    |
| Emotion Detection            | IMPLEMENTED           | GoEmotions RoBERTa              |
| Mental State Detection       | IMPLEMENTED           | DistilBERT Emotion              |
| Crisis Detection             | IMPLEMENTED           | Zero-Shot NLI                   |
| Rule-Based Support Response  | IMPLEMENTED           | `generate_response()`           |
| Voice Input                  | IMPLEMENTED           | Browser Web Speech API          |
| Crisis Modal                 | IMPLEMENTED           | 988 / 741741 information        |
| Safe Place                   | IMPLEMENTED           | Trusted contacts + activity log |
| SOS Email                    | IMPLEMENTED           | FastAPI + Gmail SMTP            |
| Journal                      | IMPLEMENTED           | REST CRUD + `journal.json`      |
| Mood Selection               | IMPLEMENTED           | 5 preset moods                  |
| Insights                     | IMPLEMENTED           | Recharts                        |
| Settings                     | IMPLEMENTED           | Preferences/profile/reset       |
| Real Database                | NOT IMPLEMENTED       | JSON files/localStorage         |
| Backend Authentication       | NOT IMPLEMENTED       | No JWT/session                  |
| Password Hashing             | NOT IMPLEMENTED       | Plain-text localStorage         |
| Multi-user backend isolation | NOT IMPLEMENTED       | Shared JSON files               |
| Generative LLM chatbot       | NOT IMPLEMENTED       | Rule-based responses            |
| Conversational LLM memory    | NOT IMPLEMENTED       | Single-turn processing          |
| Dataset ML evaluation        | EXPERIMENTAL          | Separate evaluation scripts     |
| Fine-tuned model             | NOT IMPLEMENTED       | No integrated fine-tuned model  |

---

# 6. Technology Stack

## 6.1 Frontend

### Framework

React 19

### Build Tool

Vite

### Language

JavaScript / JSX

### Routing

React Router DOM

### Styling

Tailwind CSS

### Visualization

Recharts

### Icons

FontAwesome

### Browser APIs

Web Speech API for voice input.

---

# 7. Backend Stack

## Framework

FastAPI

## Server

Uvicorn

## Programming Language

Python

## Machine Learning

HuggingFace Transformers

## ML Runtime

PyTorch / supported ML runtime

## Email

Python:

* `smtplib`
* `email.mime`

## Persistence

Currently:

* `journal.json`
* `chat_history.json`
* Browser `localStorage`

There is currently no PostgreSQL, MongoDB, SQLite, or Supabase database in the runtime architecture.

---

# 8. Project Structure

Current project structure:

```text
mindease/
│
├── start.bat
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── acc.py
│   ├── accuracy_test.py
│   ├── chat_history.json
│   ├── journal.json
│   │
│   ├── Script.js
│   ├── index.html
│   ├── journal.html
│   └── style.css
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── eslint.config.js
    ├── index.html
    │
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        │
        ├── services/
        │   └── api.js
        │
        ├── utils/
        │   └── getReply.js
        │
        ├── components/
        │   ├── common/
        │   │   ├── CrisisModal.jsx
        │   │   ├── button.jsx
        │   │   └── card.jsx
        │   │
        │   └── layout/
        │       ├── sidebar.jsx
        │       └── MainLayout.jsx
        │
        ├── pages/
        │   ├── Landing/
        │   │   └── Landing.jsx
        │   │
        │   ├── Auth/
        │   │   ├── Login.jsx
        │   │   └── Signup.jsx
        │   │
        │   ├── Dashboard/
        │   │   └── Dashboard.jsx
        │   │
        │   ├── Support/
        │   │   └── AISupport.jsx
        │   │
        │   ├── Journal/
        │   │   └── Journal.jsx
        │   │
        │   ├── SafePlace/
        │   │   └── SafePlace.jsx
        │   │
        │   ├── Insights/
        │   │   └── Insights.jsx
        │   │
        │   └── Settings/
        │       └── Settings.jsx
        │
        ├── routes/
        │   └── AppRoutes.jsx
        │
        └── context/
            ├── AuthContext.jsx
            └── MoodContent.jsx
```

---

# 9. Important Unused Files

The following files exist but are currently empty or unused:

```text
AppRoutes.jsx
AuthContext.jsx
MoodContent.jsx
MainLayout.jsx
```

Routing is currently handled directly inside:

```text
App.jsx
```

Do not assume these files are active architectural components.

---

# 10. Frontend Architecture

MindEase uses a React SPA architecture.

```text
                    React Application
                           │
                           ▼
                        App.jsx
                           │
              ┌────────────┴────────────┐
              │                         │
        Public Pages              User Pages
              │                         │
       Landing/Login/Signup      Sidebar Navigation
                                        │
              ┌───────────────┬─────────┼─────────────┐
              │               │         │             │
              ▼               ▼         ▼             ▼
          Dashboard        Support   Journal      Insights
                                      │
                                      ▼
                                  Safe Place
                                      │
                                      ▼
                                   Settings
```

Frontend state is mainly handled using:

* `useState`
* `useEffect`

Browser `localStorage` is used for persistence.

---

# 11. Application Routing

Current routes include:

```text
/
 /dashboard
 /support
 /journal
 /insights
 /safeplace
 /settings
```

Authentication pages include Login and Signup.

For non-landing application pages, the global sidebar is mounted.

---

# 12. Demo Mode

MindEase currently has a three-minute demo mechanism.

The flow is:

```text
Landing Page
     ↓
Try Demo
     ↓
demoStartedAt stored in localStorage
     ↓
Dashboard
     ↓
User explores application
     ↓
3-minute timer expires
     ↓
demoLocked = true
     ↓
Full-screen blocking modal
     ↓
Login / Create Account
```

The demo duration is:

```text
3 minutes
```

The demo timer is implemented in `App.jsx`.

This behavior must not be changed without explicit permission.

---

# 13. Authentication Architecture

Current authentication is **client-side only**.

## Signup

```text
User enters information
        ↓
Signup.jsx
        ↓
localStorage
        ↓
users[]
        ↓
Account created
```

## Login

```text
User enters email/password
        ↓
Login.jsx
        ↓
Read users from localStorage
        ↓
Validate credentials
        ↓
Set currentUser
        ↓
Navigate to Dashboard
```

Relevant storage:

```text
users
currentUser
```

## Current Limitations

There is currently:

* no backend authentication
* no JWT
* no server session
* no password hashing
* no authorization middleware
* no user ID-based backend isolation

Passwords are currently stored in browser localStorage.

This is a prototype/demo implementation and should not be described as production-grade authentication.

---

# 14. AI Architecture

MindEase currently uses a **local multi-model NLP pipeline**.

There are three main models.

## Model 1 — Emotion Classification

```text
SamLowe/roberta-base-go_emotions
```

Purpose:

Detect user emotions.

The system takes the top emotion results and maps them into broader categories.

Categories include:

```text
positive
negative
anger
anxiety
neutral
```

---

# 15. Model 2 — Mental State Classification

```text
bhadresh-savani/distilbert-base-uncased-emotion
```

Purpose:

Identify the underlying emotional/mental state.

Possible labels include:

```text
sadness
anger
fear
joy
love
surprise
```

---

# 16. Model 3 — Safety Classification

```text
cross-encoder/nli-distilroberta-base
```

Purpose:

Detect potential crisis/self-harm risk using zero-shot classification.

The candidate labels are:

```text
safe
emotional distress
immediate danger or self harm
```

The result is converted into:

```text
LOW
MEDIUM
HIGH
```

risk levels.

---

# 17. Critical AI Architecture Detail

## MindEase is NOT currently using a generative LLM for chatbot response generation.

The current architecture is:

```text
NLP Classification
        +
Rule-Based Response Generation
```

It is NOT:

```text
User
 ↓
LLM
 ↓
Generated conversational response
```

The response is generated using:

```text
generate_response()
```

based on detected emotion and mental state.

This distinction must be preserved in all future documentation unless the implementation is actually changed.

---

# 18. Complete AI Chatbot Pipeline

The actual chatbot flow is:

```text
                   USER
                    │
                    ▼
          Text / Voice Input
                    │
                    ▼
             AISupport.jsx
                    │
                    ▼
          sendChatMessage()
                    │
                    ▼
             POST /chat
                    │
                    ▼
          FastAPI main.py
                    │
                    ▼
          evaluate_safety()
                    │
                    ▼
       Zero-Shot NLI Classifier
                    │
           ┌────────┴────────┐
           │                 │
           ▼                 ▼
        HIGH             LOW/MEDIUM
           │                 │
           ▼                 ▼
    Crisis Response      Emotion Analysis
                              │
                       ┌──────┴──────┐
                       │             │
                       ▼             ▼
                 GoEmotions      DistilBERT
                 RoBERTa         Emotion
                       │             │
                       └──────┬──────┘
                              │
                              ▼
                     Phrase Override
                              │
                              ▼
                     generate_response()
                              │
                              ▼
                      save_chat()
                              │
                              ▼
                     chat_history.json
                              │
                              ▼
                       JSON Response
                              │
                              ▼
                     React State Update
                              │
                              ▼
                         UI Display
```

---

# 19. AI Input

The user can provide input through:

### Text

Normal chatbot input.

### Voice

Browser Web Speech API:

```text
SpeechRecognition
webkitSpeechRecognition
```

Voice is converted into text and then enters the same chatbot pipeline.

---

# 20. Safety Evaluation

The function:

```text
evaluate_safety(text)
```

performs safety analysis.

The system checks contextual safe words and then performs zero-shot classification.

Example contextual words include:

```text
movie
friend
character
book
song
```

These are intended to reduce false crisis detection in contextual conversations.

---

# 21. Safety Risk Thresholds

Current logic:

### HIGH

If:

```text
immediate danger or self harm score > 0.6
```

then:

```text
riskLevel = HIGH
requiresSafetyFlow = true
```

### MEDIUM

If:

```text
emotional distress score > 0.7
```

then:

```text
riskLevel = MEDIUM
requiresSafetyFlow = true
```

### LOW

Otherwise:

```text
riskLevel = LOW
```

---

# 22. HIGH-RISK Chat Flow

When HIGH risk is detected:

```text
User Message
      ↓
Safety Classifier
      ↓
HIGH
      ↓
Normal response generation is bypassed
      ↓
Fixed crisis-support response
      ↓
Chat saved as:
emotion = crisis
mental_state = critical
      ↓
Frontend receives HIGH risk
      ↓
Safety alert UI
      ↓
Contact Safe Person
      ↓
SOS flow
```

The system currently returns supportive crisis-oriented text rather than attempting normal conversational generation.

---

# 23. LOW/MEDIUM Chat Flow

For LOW/MEDIUM:

```text
User Message
      ↓
Safety Evaluation
      ↓
LOW/MEDIUM
      ↓
GoEmotions
      ↓
Emotion
      ↓
DistilBERT
      ↓
Mental State
      ↓
Phrase Override
      ↓
generate_response()
      ↓
Save Chat
      ↓
Return JSON
```

---

# 24. Phrase Override

The system contains specific phrase override logic.

For example:

```text
"now I am happy"
```

can override the model classification and set:

```text
emotion = positive
mental_state = joy
```

This is a rule-based correction layer.

---

# 25. Response Generation

The current response generator is:

```text
generate_response()
```

It uses the detected state.

Examples:

```text
sadness
→ supportive response about feeling low

anger
→ response acknowledging frustration

fear
→ response acknowledging anxiety/fear

positive
→ positive acknowledgement

other
→ general supportive response
```

This is a deterministic rule-based response matrix.

---

# 26. Journal Architecture

The Journal module is implemented in:

```text
frontend/src/pages/Journal/Journal.jsx
```

Backend persistence:

```text
backend/journal.json
```

Supported operations:

```text
POST /journal
GET /journal
PUT /journal/{id}
DELETE /journal/{id}
```

---

# 27. Journal Create Flow

```text
User opens Journal
       ↓
Selects mood
       ↓
Writes journal entry
       ↓
Clicks Enter/Save
       ↓
POST /journal
       ↓
FastAPI
       ↓
Generate entry ID
       ↓
Append to journal.json
       ↓
Return response
       ↓
Frontend updates UI
```

---

# 28. Journal Read Flow

When Journal loads:

```text
Journal.jsx
     ↓
GET /journal
     ↓
FastAPI
     ↓
Read journal.json
     ↓
Return entries
     ↓
Frontend
     ↓
Display journal history
```

---

# 29. Journal Update Flow

```text
Existing Entry
      ↓
Edit
      ↓
Populate editor
      ↓
User modifies text/mood
      ↓
PUT /journal/{id}
      ↓
Update journal.json
      ↓
Return updated entry
      ↓
Refresh UI
```

---

# 30. Journal Delete Flow

```text
Delete selected
      ↓
Confirmation modal
      ↓
User confirms
      ↓
DELETE /journal/{id}
      ↓
Remove record from journal.json
      ↓
Update UI
```

---

# 31. Safe Place Architecture

Safe Place is the human-support/emergency contact layer.

It allows users to:

* manage trusted contacts
* choose contacts for SOS notifications
* view safety activity
* send emergency alerts

Frontend:

```text
SafePlace.jsx
```

Backend SOS endpoint:

```text
POST /api/sos
```

---

# 32. Trusted Contact Storage

Trusted contacts are currently stored in:

```text
localStorage
```

under:

```text
trustedContacts
```

Each contact can contain:

```text
id
name
email
receive_sos
```

---

# 33. SOS Flow

The SOS flow is:

```text
User / Safety System
       ↓
Select trusted contacts
       ↓
POST /api/sos
       ↓
FastAPI
       ↓
Python smtplib
       ↓
Gmail SMTP
       ↓
Emergency HTML email
       ↓
Trusted contact
```

The backend uses Gmail SMTP:

```text
smtp.gmail.com
Port 587
TLS
```

---

# 34. Automatic SOS

The application supports an automatic SOS setting:

```text
autoSos
```

When enabled, high-risk detection can trigger the safety flow.

The current implementation must be inspected before changing this behavior.

---

# 35. Safety Activity Log

Safety activities are stored in:

```text
localStorage
```

under:

```text
safetyActivities
```

Example information includes:

```text
title
description
timestamp
date
```

---

# 36. Crisis Modal

The application includes:

```text
CrisisModal.jsx
```

It provides crisis-support information.

Current information includes:

```text
988 Suicide & Crisis Lifeline
741741 Crisis Text Line
```

The modal can be accessed from the application's safety/navigation interface.

---

# 37. Dashboard Architecture

The Dashboard is:

```text
Dashboard.jsx
```

It acts as the primary user hub.

Current sections include:

### Personalized Header

Displays the current user's name.

Source:

```text
localStorage.currentUser
```

### Mood Check-in

Five mood choices:

```text
Happy
Anxious
Sad
Calm
Stressed
```

### Quick Access

Links to:

```text
AI Support
Journal
Mood Insights
```

### Daily Reminder

Provides a mindfulness/breathing reminder.

---

# 38. Mood Tracking

Current mood options:

```text
😊 Happy
😟 Anxious
😢 Sad
😌 Calm
😫 Stressed
```

Users can select moods from the Dashboard.

Journal entries can also have a mood assigned.

---

# 39. Mood Scoring

Current Insights implementation uses:

```text
Happy     = 8/10
Calm      = 7/10
Anxious   = 5/10
Sad       = 4/10
Stressed  = 3/10
```

These are predefined application values.

They should not be described as clinically validated mental-health scores.

---

# 40. Insights Architecture

Insights is implemented in:

```text
Insights.jsx
```

Visualization uses:

```text
Recharts
```

Current analytics include:

* mood trends
* emotion distribution
* graphical representations
* statistical visualization

The Insights system should be described as **wellness analytics**, not clinical diagnosis.

---

# 41. Settings Architecture

Settings currently supports functionality such as:

* profile editing
* AI safety preference
* automatic SOS toggle
* application/data reset

Relevant localStorage settings include:

```text
aiSafety
autoSos
```

---

# 42. Database / Persistence Architecture

## Important

MindEase currently has **NO actual database engine**.

There is no runtime:

```text
PostgreSQL
MongoDB
SQLite
Supabase
```

Instead, there are two storage mechanisms.

---

# 43. Backend Storage

## chat_history.json

Stores chatbot interactions.

Conceptually:

```json
{
  "message": "User message",
  "response": "System response",
  "emotion": "anxiety",
  "mental_state": "fear",
  "time": "timestamp"
}
```

## journal.json

Stores journal entries.

Conceptually:

```json
{
  "id": 1,
  "text": "Journal entry",
  "mood": "😊 Happy",
  "time": "timestamp"
}
```

---

# 44. Frontend localStorage

Current localStorage data includes:

```text
currentUser
users
trustedContacts
safetyActivities
aiSafety
autoSos
chatHistory
demoStartedAt
demoLocked
```

The exact current keys should be verified in code before changing them.

---

# 45. Current Multi-Tenancy Limitation

The backend JSON files are globally shared.

There is no proper:

```text
user_id
```

association for backend journal/chat data.

Therefore:

```text
User A
   \
    → journal.json
   /
User B
```

rather than:

```text
User A → User A's records
User B → User B's records
```

This is a known limitation.

---

# 46. API Architecture

Current backend base URL:

```text
http://127.0.0.1:8000
```

Frontend communicates with FastAPI through HTTP requests.

---

# 47. API Endpoints

## Health Check

```text
GET /
```

Purpose:

Backend status/health check.

---

## Chat

```text
POST /chat
```

Request:

```json
{
  "message": "string"
}
```

Processing:

```text
Safety evaluation
→ emotion classification
→ mental-state classification
→ response generation
→ chat persistence
```

Response contains information such as:

```text
response
emotion
mental_state
top_emotions
safety
```

---

## Chat History

```text
GET /chat-history
```

Reads:

```text
chat_history.json
```

---

## SOS

```text
POST /api/sos
```

Purpose:

Send emergency email notifications.

---

## Journal Read

```text
GET /journal
```

---

## Journal Create

```text
POST /journal
```

Request:

```json
{
  "text": "string",
  "mood": "string"
}
```

---

## Journal Update

```text
PUT /journal/{id}
```

Request:

```json
{
  "text": "string",
  "mood": "string"
}
```

---

## Journal Delete

```text
DELETE /journal/{id}
```

---

# 48. Complete System Data Flow

```text
                         USER
                           │
                           ▼
                  React Frontend
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
           Chat         Journal       Safe Place
              │            │            │
              └────────────┼────────────┘
                           │
                           ▼
                     HTTP REST API
                           │
                           ▼
                    FastAPI Backend
                           │
            ┌──────────────┼───────────────┐
            │              │               │
            ▼              ▼               ▼
        ML Models       JSON Files      SMTP
            │              │               │
            │              │               ▼
            │              │          Trusted Contact
            │              │
            └──────────────┴───────────────┐
                                           │
                                           ▼
                                     API Response
                                           │
                                           ▼
                                  React State Update
                                           │
                                           ▼
                                         UI
```

---

# 49. Complete AI Data Flow

```text
User
 ↓
AISupport.jsx
 ↓
sendChatMessage()
 ↓
POST /chat
 ↓
FastAPI
 ↓
evaluate_safety()
 ↓
Zero-Shot NLI
 ↓
 ┌───────────────────────────────┐
 │                               │
HIGH                           LOW/MEDIUM
 │                               │
 ▼                               ▼
Crisis Response             GoEmotions
                                  ↓
                             DistilBERT
                                  ↓
                          Phrase Override
                                  ↓
                        generate_response()
                                  ↓
                           save_chat()
                                  ↓
                             Response
```

---

# 50. Complete High-Risk Safety Flow

```text
User enters message
       ↓
POST /chat
       ↓
Zero-Shot NLI
       ↓
Immediate danger/self-harm
       ↓
Score > HIGH threshold
       ↓
HIGH
       ↓
Crisis response
       ↓
Save crisis interaction
       ↓
Frontend displays safety alert
       ↓
Contact Safe Person
       ↓
SOS modal
       ↓
Selected trusted contacts
       ↓
POST /api/sos
       ↓
Gmail SMTP
       ↓
Emergency email
```

---

# 51. Complete New User Flow

```text
User
 ↓
Landing Page
 ↓
Try Demo
 ↓
demoStartedAt
 ↓
Dashboard
 ↓
Explore:
   ├── AI Support
   ├── Journal
   ├── Insights
   ├── Safe Place
   └── Settings
 ↓
3 minutes
 ↓
Demo Lock
 ↓
Login / Signup
```

---

# 52. Complete Registered User Flow

```text
Landing
 ↓
Login / Signup
 ↓
Client-side authentication
 ↓
currentUser stored
 ↓
Dashboard
 ↓
Choose feature
 ├── AI Support
 ├── Journal
 ├── Insights
 ├── Safe Place
 └── Settings
```

---

# 53. Security Architecture

## Currently Implemented

### CORS

FastAPI has CORS middleware.

### Environment Variable Support

Email credentials can be loaded through environment variables.

Example variable names:

```text
SENDER_EMAIL
SENDER_PASSWORD
```

Never expose actual values.

---

# 54. Current Security Gaps

The following are known limitations:

### 1. No backend authentication

APIs do not currently require authenticated users.

### 2. Plain-text passwords

Passwords are stored in localStorage.

### 3. Shared backend files

All users share:

```text
journal.json
chat_history.json
```

### 4. No user authorization

Backend endpoints do not currently verify ownership of records.

### 5. Hardcoded API URL

The frontend uses:

```text
http://127.0.0.1:8000
```

### 6. SMTP fallback credentials

The current code contains fallback SMTP credential behavior.

This must be removed before treating the application as production-ready.

---

# 55. External Services

Current external dependencies/services include:

## HuggingFace

Used to download/load:

```text
SamLowe/roberta-base-go_emotions
bhadresh-savani/distilbert-base-uncased-emotion
cross-encoder/nli-distilroberta-base
```

## Gmail SMTP

Used for SOS emergency email dispatch.

---

# 56. Environment Configuration

Backend environment variables include:

```text
SENDER_EMAIL
SENDER_PASSWORD
```

Frontend API URL is currently hardcoded rather than being fully environment-driven.

Never commit or expose secret values.

---

# 57. Running MindEase

## Windows Automated Startup

Project contains:

```text
start.bat
```

which starts the backend and frontend.

## Backend

```bash
cd backend
python -m uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# 58. Development Evolution

MindEase evolved through several stages.

## Phase 1 — Vanilla Prototype

Initial prototype contained:

```text
HTML
CSS
JavaScript
```

including:

```text
index.html
journal.html
Script.js
style.css
```

---

## Phase 2 — ML Integration

HuggingFace emotion classification was integrated into FastAPI.

The system introduced:

```text
GoEmotions RoBERTa
+
DistilBERT Emotion
```

---

## Phase 3 — React Migration

The frontend was rebuilt using:

```text
React
Vite
Tailwind CSS
React Router
Recharts
FontAwesome
```

---

## Phase 4 — Safety System

A safety architecture was introduced:

```text
Zero-Shot NLI
+
Crisis Detection
+
Crisis Modal
+
Safe Place
+
SOS Email
```

---

# 59. Important Development Changes

Major changes include:

* Replacing early client-side rule matching with FastAPI-based ML processing
* Adding the dual emotion/mental-state classification system
* Adding Zero-Shot NLI safety classification
* Adding crisis support
* Adding Safe Place
* Adding SOS email functionality
* Migrating to React
* Adding Recharts analytics
* Adding voice input

---

# 60. Dataset / ML Evaluation Work

The repository contains:

```text
backend/acc.py
backend/accuracy_test.py
```

These scripts are used for ML evaluation.

They can evaluate aspects such as:

* top-1 accuracy
* top-3 accuracy
* precision
* recall
* F1 score
* confusion matrix

However:

> **These evaluation scripts are experimental and are NOT part of the runtime MindEase pipeline.**

Do not represent them as live application functionality.

---

# 61. Current Runtime AI vs Experimental ML

This distinction must always be preserved.

## Runtime

```text
User
 ↓
Safety Model
 ↓
Emotion Model
 ↓
Mental State Model
 ↓
Rule-Based Response
```

## Experimental

```text
GoEmotions Dataset
 ↓
Evaluation Scripts
 ↓
Accuracy / Precision / Recall / F1
 ↓
Confusion Matrix
```

The experimental evaluation is not automatically integrated into chatbot runtime.

---

# 62. Current Working State

## Fully Implemented

* Landing page
* Demo mode
* AI Support UI
* Emotion classification
* Mental state classification
* Safety classification
* Crisis response
* Voice input
* Journal CRUD
* Mood selection
* Insights
* Safe Place
* Trusted contacts
* SOS email
* Crisis modal
* Settings
* Activity logging

## Partially Implemented

* Authentication
* User management
* Multi-user data isolation

## Experimental

* ML evaluation scripts
* Dataset analysis

## Not Implemented

* Real database
* Backend authentication
* JWT
* Password hashing
* Multi-tenant backend
* Generative LLM chatbot
* Multi-turn LLM conversational memory
* Fine-tuned generative model

---

# 63. Current Architectural Limitations

The most important limitations are:

1. JSON file persistence
2. No relational/document database
3. Client-side authentication
4. Plain-text passwords
5. No backend authorization
6. Shared backend data
7. Hardcoded API URL
8. No true user-level data isolation
9. Rule-based chatbot responses
10. No LLM conversational memory
11. ML evaluation scripts are separate from runtime
12. Current system is primarily a prototype/demo architecture

---

# 64. Future Architecture Direction

Potential future improvements include:

## Authentication

```text
React
 ↓
FastAPI
 ↓
JWT
 ↓
Password Hashing
```

## Database

Possible future options:

```text
PostgreSQL
MongoDB
Supabase
```

A final choice must be made before implementation.

## User Isolation

Introduce a proper:

```text
user_id
```

relationship across user data.

## AI

Potential future architecture:

```text
User Message
 ↓
Safety Layer
 ↓
Emotion / Mental State Analysis
 ↓
Context / Memory
 ↓
Generative LLM
 ↓
Safety Post-processing
 ↓
Personalized Response
```

This is future scope unless actually implemented.

---

# 65. Recommended Future Database Architecture

If a database is introduced later, the conceptual structure should be:

```text
User
 │
 ├── Journal Entries
 │
 ├── Chat Conversations
 │
 ├── Mood Records
 │
 ├── Trusted Contacts
 │
 └── Safety Activities
```

Every user's records should be associated with a unique user ID.

Do not implement this automatically without explicit approval.

---

# 66. Recommended Future AI Architecture

If the project later transitions to a generative AI architecture, preserve the existing safety layer.

Potential structure:

```text
User Message
      ↓
Input Validation
      ↓
Safety / Risk Detection
      ↓
Emotion + Mental State
      ↓
Context / Conversation History
      ↓
Generative Model
      ↓
Safety Validation
      ↓
Response
      ↓
Storage
      ↓
Frontend
```

The safety layer should not simply be removed because a generative LLM is introduced.

---

# 67. Mental Health Safety Principle

MindEase should be treated as an emotional wellness/support application.

It should not claim to:

* diagnose mental illnesses
* replace psychologists/psychiatrists
* provide professional medical treatment
* guarantee crisis detection
* guarantee emergency intervention

AI predictions and classifications should be presented as supportive signals rather than medical diagnoses.

---

# 68. Things That Must Be Preserved

Unless explicitly requested, do NOT remove or replace the following current architecture:

### AI

```text
SamLowe/roberta-base-go_emotions
bhadresh-savani/distilbert-base-uncased-emotion
cross-encoder/nli-distilroberta-base
```

### Safety

```text
evaluate_safety()
```

and its crisis-detection workflow.

### API Contracts

Preserve:

```text
POST /chat
GET /chat-history
POST /api/sos

GET /journal
POST /journal
PUT /journal/{id}
DELETE /journal/{id}
```

unless explicit permission is given to change them.

### UI

Preserve the existing MindEase visual design system unless a UI redesign is explicitly requested.

### Demo

Preserve the three-minute demo mechanism unless explicitly requested otherwise.

### Safe Place

Do not remove the trusted-contact/SOS workflow.

---

# 69. Things Antigravity Must NOT Do Automatically

Do not automatically:

* replace the ML models
* introduce an LLM
* replace the response generator
* replace JSON with a database
* add JWT
* change authentication
* redesign the UI
* change API contracts
* rename core components
* remove Safe Place
* remove crisis detection
* remove the demo timer
* change the mood system
* delete experimental ML scripts
* remove legacy files without checking their purpose
* expose secrets
* modify SMTP credentials
* change safety thresholds
* change crisis behavior

Any architectural change must be discussed and approved first.

---

# 70. Development Rule

Before modifying anything:

1. Inspect the current implementation.
2. Identify the exact file involved.
3. Understand its dependencies.
4. Determine whether other modules depend on it.
5. Explain the proposed change.
6. Identify possible side effects.
7. Only then implement the change after approval.

Do not make broad architectural changes for a small feature request.

---

# 71. Debugging Rule

When fixing a bug:

```text
Reproduce
 ↓
Locate root cause
 ↓
Identify affected components
 ↓
Make minimum necessary change
 ↓
Test affected flow
 ↓
Verify no regression
```

Do not rewrite an entire module unless necessary.

---

# 72. UI Change Rule

If a UI change is requested:

* preserve existing functionality
* preserve existing API behavior
* preserve existing safety mechanisms
* preserve existing data flow
* modify only the required UI/components

Do not redesign unrelated screens.

---

# 73. AI Change Rule

If an AI-related change is requested:

First determine whether the requested change affects:

```text
Safety
Emotion classification
Mental state classification
Response generation
Chat history
Frontend chatbot
Backend /chat API
```

Any AI change must preserve the safety-first architecture unless explicitly instructed otherwise.

---

# 74. Data Change Rule

If data storage is modified:

Check all affected areas:

```text
Frontend
 ↓
API
 ↓
Backend
 ↓
JSON / Database
 ↓
Analytics
```

Do not change the storage format without checking all consumers.

---

# 75. Final Authoritative Architecture

The current MindEase architecture can be summarized as:

```text
┌─────────────────────────────────────────────────────────────┐
│                    MINDEASE FRONTEND                        │
│                                                             │
│ React 19 + Vite + Tailwind + React Router                  │
│                                                             │
│ Landing │ Login │ Signup │ Dashboard │ AI Support          │
│ Journal │ Insights │ Safe Place │ Settings                 │
│                                                             │
│ React State + localStorage                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                         HTTP REST
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                          │
│                                                             │
│                         main.py                             │
│                                                             │
│ /chat                                                       │
│ /chat-history                                               │
│ /journal                                                    │
│ /api/sos                                                    │
│                                                             │
│ Safety │ Emotion │ Mental State │ Response │ Storage        │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐   ┌─────────────────────────────┐
│       ML PIPELINE        │   │       PERSISTENCE           │
│                          │   │                             │
│ Zero-Shot NLI            │   │ journal.json                │
│ GoEmotions RoBERTa       │   │ chat_history.json           │
│ DistilBERT Emotion       │   │                             │
└──────────────────────────┘   └─────────────────────────────┘
                │
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    SAFETY / SOS LAYER                        │
│                                                             │
│ Crisis Detection → Crisis Response → Safe Place → SOS      │
│                                                             │
│                         ↓                                   │
│                    Gmail SMTP                               │
│                         ↓                                   │
│                 Trusted Contact Email                       │
└─────────────────────────────────────────────────────────────┘
```

---

# 76. One-Sentence Technical Description

> **MindEase is a React 19 + Vite mental-wellness SPA backed by FastAPI, using a local multi-model HuggingFace NLP pipeline for emotion, mental-state, and crisis-risk classification, rule-based supportive response generation, JSON-based persistence, mood/journal analytics, and SMTP-based trusted-contact emergency notifications.**

---

# 77. One-Sentence Product Description

> **MindEase is a digital emotional wellness platform that helps users express, understand, and track their emotions while providing AI-assisted support and a safety pathway connecting users to trusted people during potential crises.**

---

# 78. Final Rule for Future Development

Before making any change to MindEase, always distinguish between:

```text
CURRENT IMPLEMENTATION
        ↓
EXPERIMENTAL WORK
        ↓
PLANNED FEATURE
        ↓
NEW REQUEST
```

Never assume these are interchangeable.

The existing codebase is the source of truth for the current implementation.

When uncertain:

**Inspect first. Ask/confirm second. Modify third.**

---

# END OF MINDEASE MASTER PROJECT CONTEXT

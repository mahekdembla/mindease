MindEase — MongoDB Database Integration & Migration Task Specification

Document Purpose

This document is the implementation specification for connecting the existing MindEase application to MongoDB and migrating the application's persistent backend data from JSON files/localStorage where appropriate.

This document is intended to be executed by Antigravity after it has inspected the current MindEase repository.

The objective is to introduce MongoDB without breaking the existing MindEase application, AI pipeline, safety system, routes, UI, or API behavior.

1. Current MindEase Baseline

The current MindEase application is:

React 19 + Vite + Tailwind CSS
             ↓
         FastAPI
             ↓
     HuggingFace ML Pipeline
             ↓
 JSON files + browser localStorage

Current important backend persistence:

backend/journal.json
backend/chat_history.json

Current frontend persistence includes items such as:

currentUser
users
trustedContacts
safetyActivities
aiSafety
autoSos
chatHistory
demoStartedAt
demoLocked

The current AI runtime must remain unchanged:

User Message
    ↓
Safety Evaluation
    ↓
Zero-Shot NLI
    ↓
Emotion Classification
    ↓
Mental-State Classification
    ↓
Phrase Override
    ↓
Rule-Based Response Generation
    ↓
Chat Persistence
    ↓
Response

Do NOT replace this pipeline with a generative LLM as part of this MongoDB task.

2. Primary Objective

Connect FastAPI to MongoDB and establish a clean persistence architecture:

React Frontend
       ↓
FastAPI REST API
       ↓
MongoDB

MongoDB must be accessed only through the FastAPI backend.

The React frontend must never contain:

MongoDB URI
MongoDB username
MongoDB password
MongoDB credentials

The frontend must continue communicating with the backend through HTTP APIs.

3. Target Architecture

The target architecture is:

                         MINDEASE
                            │
                            ▼
                 ┌─────────────────────┐
                 │    React Frontend   │
                 │                     │
                 │ Dashboard           │
                 │ AI Support          │
                 │ Journal             │
                 │ Insights            │
                 │ Safe Place          │
                 │ Settings            │
                 └──────────┬──────────┘
                            │
                         HTTP/REST
                            │
                            ▼
                 ┌─────────────────────┐
                 │   FastAPI Backend   │
                 │                     │
                 │ API Routes          │
                 │ Validation          │
                 │ Business Logic      │
                 │ AI Pipeline         │
                 │ Safety Layer        │
                 │ Database Access     │
                 └──────────┬──────────┘
                            │
                         PyMongo
                            │
                            ▼
                 ┌─────────────────────┐
                 │      MongoDB        │
                 │                     │
                 │ mindease             │
                 │                     │
                 │ users                │
                 │ journal_entries     │
                 │ chat_history        │
                 │ mood_records        │
                 │ trusted_contacts    │
                 │ safety_activities   │
                 └─────────────────────┘

4. Critical Implementation Rule

Before modifying code:

Inspect the current repository.

Inspect the current backend/main.py.

Inspect the current frontend API service.

Inspect Journal implementation.

Inspect AI Support implementation.

Inspect Safe Place implementation.

Inspect current localStorage usage.

Inspect current JSON file structures.

Identify every read/write operation involving:

journal.json

chat_history.json

user data

trusted contacts

safety activities

mood data

Map each operation to its current frontend and backend consumer.

Only then implement the database layer.

Do not blindly rewrite files.

Make the smallest safe architectural changes necessary.

5. MongoDB Technology Choice

Use MongoDB with the official Python driver:

PyMongo

Do not introduce Node/Mongoose because the database belongs behind the existing Python FastAPI backend.

Use the MongoDB connection through an environment variable.

Recommended environment variable:

MONGODB_URI

Recommended database name:

MINDEASE_DB_NAME=mindease

Do not hardcode credentials.

Do not commit secrets.

6. Environment Configuration

Create/update the backend environment configuration.

Expected variables:

MONGODB_URI=<mongodb-connection-string>
MINDEASE_DB_NAME=mindease

If the existing project already has a .env convention, follow that convention instead of creating a conflicting configuration system.

Create or update:

backend/.env.example

with placeholders only:

MONGODB_URI=
MINDEASE_DB_NAME=mindease

Never place the real MongoDB URI in .env.example.

Make sure .gitignore excludes:

.env

If .env is already ignored, preserve the existing rule.

7. MongoDB Connection Layer

Do NOT put database connection logic directly inside every API endpoint.

Create a centralized database module.

Preferred structure:

backend/
├── main.py
├── database/
│   ├── __init__.py
│   └── mongodb.py

If the current repository already has a suitable database/service structure, use it instead of unnecessarily creating duplicate architecture.

The database module should be responsible for:

loading the MongoDB URI

creating the MongoDB client

selecting the mindease database

exposing collections

providing connection/health checking

closing the MongoDB client cleanly when FastAPI shuts down

Conceptually:

FastAPI
   ↓
database/mongodb.py
   ↓
MongoClient
   ↓
mindease database
   ↓
collections

8. Connection Management Requirements

The implementation must:

Read MONGODB_URI from environment variables.

Fail clearly if the variable is missing.

Create one reusable MongoDB client rather than creating a new client on every request.

Select the configured database.

Expose the required collections.

Verify connectivity during backend startup or through an explicit database health check.

Close the MongoDB client during application shutdown.

Never print the MongoDB URI or password to logs.

Never expose database credentials to the frontend.

Use an appropriate MongoDB server selection timeout so that a failed connection does not hang indefinitely during development.

9. Database Name

Use:

mindease

unless the environment variable specifies another database name.

The code should not scatter the database name throughout the project.

Use one centralized configuration value.

10. Required Collections

Create/use these logical collections:

users
journal_entries
chat_history
mood_records
trusted_contacts
safety_activities

MongoDB can create collections automatically when the first document is inserted. Do not create unnecessary seed data.

11. Users Collection

Target document shape:

{
  "_id": "MongoDB ObjectId",
  "name": "User Name",
  "email": "user@example.com",
  "password_hash": "...",
  "created_at": "datetime",
  "updated_at": "datetime"
}

Important:

The current project has client-side authentication. This MongoDB task must NOT silently claim that production-grade authentication has been implemented.

If user authentication is migrated to the backend, password hashing must be used.

Never store plain-text passwords in MongoDB.

If authentication is not being migrated in this implementation phase, clearly keep the existing authentication behavior and do not create misleading fake password storage.

Do not introduce JWT/authentication redesign unless explicitly required by the current task.

12. Journal Collection

Target document shape:

{
  "_id": "MongoDB ObjectId",
  "user_id": "user identifier",
  "text": "Journal entry",
  "mood": "😊 Happy",
  "created_at": "datetime",
  "updated_at": "datetime"
}

The current API contracts should remain:

GET    /journal
POST   /journal
PUT    /journal/{id}
DELETE /journal/{id}

The frontend should not need to know that storage changed from JSON to MongoDB.

The API response structure should remain compatible with the current frontend unless a compatibility change is genuinely required.

13. Chat History Collection

Target document shape:

{
  "_id": "MongoDB ObjectId",
  "user_id": "user identifier",
  "message": "User message",
  "response": "MindEase response",
  "emotion": "anxiety",
  "mental_state": "fear",
  "safety_level": "LOW",
  "top_emotions": [],
  "timestamp": "datetime"
}

The existing endpoint must remain:

POST /chat
GET /chat-history

The AI processing itself must remain unchanged.

Only persistence should move from:

chat_history.json

to:

MongoDB → chat_history

unless inspection proves that a small compatibility adjustment is necessary.

14. Mood Records Collection

Use:

mood_records

Target shape:

{
  "_id": "MongoDB ObjectId",
  "user_id": "user identifier",
  "mood": "Happy",
  "score": 8,
  "timestamp": "datetime"
}

Important:

The current mood values/scores are application wellness values, not clinically validated measurements.

Do not change the existing mood system merely because MongoDB is being introduced.

15. Trusted Contacts Collection

Target shape:

{
  "_id": "MongoDB ObjectId",
  "user_id": "user identifier",
  "name": "Trusted Person",
  "email": "person@example.com",
  "receive_sos": true,
  "created_at": "datetime",
  "updated_at": "datetime"
}

Do not change the SOS email workflow.

The existing SOS endpoint must remain:

POST /api/sos

MongoDB should store trusted-contact information if that migration is included.

The SMTP implementation must continue using environment variables.

Do not expose SMTP credentials.

16. Safety Activities Collection

Target shape:

{
  "_id": "MongoDB ObjectId",
  "user_id": "user identifier",
  "title": "Safety activity",
  "description": "Activity description",
  "timestamp": "datetime"
}

Preserve the existing Safe Place functionality.

Do not remove or weaken:

Crisis detection
Safe Place
Trusted contacts
SOS
Crisis Modal

17. User ID Requirement

MongoDB migration must establish a way to associate persisted data with the correct user.

Target relationship:

User
 │
 ├── Journal Entries
 ├── Chat History
 ├── Mood Records
 ├── Trusted Contacts
 └── Safety Activities

Every user-owned document should contain:

user_id

Do not use email as the permanent relational identifier if the implementation can establish a stable user ID.

Use the MongoDB user's _id as the canonical database identity where appropriate.

However, do not invent an authentication architecture that the current application does not support.

If proper backend authentication is required to securely determine user_id, document that dependency before implementing it.

18. Existing JSON Migration

The existing files are:

backend/journal.json
backend/chat_history.json

Before deleting or modifying them:

Inspect their exact structure.

Back them up.

Write a migration script if their data needs to be preserved.

Import valid records into MongoDB.

Verify the imported record count.

Verify sample records.

Only then stop using the JSON files at runtime.

Do NOT simply delete the JSON files.

Do NOT silently discard existing user data.

If existing records have no user ID, do not invent ownership.

Instead document how those legacy records are handled.

19. Migration Script

If existing data needs migration, create something like:

backend/scripts/migrate_json_to_mongodb.py

The script should:

Read JSON
   ↓
Validate structure
   ↓
Transform document shape
   ↓
Insert into MongoDB
   ↓
Report inserted/skipped/error counts

The migration script must be safe to run more than once where practical.

Avoid duplicate insertion.

Do not automatically run migration every time FastAPI starts.

Migration must be an explicit development command.

20. MongoDB Indexes

Create indexes where they materially improve common queries.

At minimum, evaluate:

journal_entries.user_id
chat_history.user_id
mood_records.user_id
trusted_contacts.user_id
safety_activities.user_id
users.email

The users.email index should be unique if email is the identity used by the existing authentication flow.

Do not create unnecessary indexes.

21. API Layer

The frontend should continue using:

Frontend
   ↓
services/api.js
   ↓
FastAPI
   ↓
MongoDB

Do not connect React directly to MongoDB.

Preserve existing API endpoints:

GET /
POST /chat
GET /chat-history
POST /api/sos

GET /journal
POST /journal
PUT /journal/{id}
DELETE /journal/{id}

If additional endpoints are required, add them without breaking existing routes.

22. Journal API Migration

Current:

POST /journal
     ↓
journal.json

Target:

POST /journal
     ↓
FastAPI
     ↓
MongoDB
     ↓
journal_entries

Read:

GET /journal
     ↓
MongoDB
     ↓
Filter by user_id
     ↓
Return JSON

Update:

PUT /journal/{id}
     ↓
MongoDB update_one()

Delete:

DELETE /journal/{id}
     ↓
MongoDB delete_one()

The frontend should continue behaving exactly as before.

23. Chat API Migration

Current:

POST /chat
     ↓
AI processing
     ↓
chat_history.json

Target:

POST /chat
     ↓
Safety evaluation
     ↓
Emotion classification
     ↓
Mental-state classification
     ↓
Phrase override
     ↓
Rule-based response
     ↓
MongoDB chat_history
     ↓
JSON response

Do NOT modify:

evaluate_safety()

Do NOT modify safety thresholds.

Do NOT modify crisis behavior.

Do NOT replace the existing models.

Do NOT introduce a generative LLM.

Only change persistence where required.

24. Safe Place Migration

Current Safe Place functionality must continue to work.

Target:

SafePlace.jsx
     ↓
FastAPI API
     ↓
MongoDB
     ↓
trusted_contacts
     +
safety_activities

The SOS flow remains:

Safety Event
     ↓
Safe Place
     ↓
Selected Trusted Contact
     ↓
POST /api/sos
     ↓
FastAPI
     ↓
Gmail SMTP
     ↓
Trusted Contact

MongoDB must not replace Gmail SMTP.

25. localStorage Policy

Do NOT delete localStorage indiscriminately.

Separate:

Data that should eventually become server-side

users
journal data
chat history
mood records
trusted contacts
safety activities

Client-only application state

Potentially:

demoStartedAt
demoLocked
UI preferences
temporary UI state

The exact list must be confirmed by inspecting the current code.

Do not migrate or remove a localStorage key simply because it exists.

26. Error Handling

MongoDB errors must not crash the entire FastAPI application.

Implement clear handling for:

Missing MONGODB_URI
Invalid MongoDB URI
Authentication failure
Database unavailable
Timeout
Duplicate user/email
Invalid ObjectId
Document not found
Insert failure
Update failure
Delete failure

Return appropriate HTTP status codes.

Do not expose:

MongoDB URI
database password
internal stack traces
SMTP password

to the frontend.

Log useful development information without secrets.

27. ObjectId Handling

MongoDB uses:

ObjectId

The frontend currently expects JSON-compatible IDs.

Therefore:

MongoDB ObjectId
        ↓
API serialization
        ↓
string ID
        ↓
React

Do not send raw Python ObjectId objects through FastAPI responses.

When an endpoint receives an ID:

string
   ↓
validate ObjectId
   ↓
ObjectId(...)
   ↓
MongoDB query

Invalid IDs should return a controlled client error rather than a server crash.

28. Datetime Handling

Use timezone-aware UTC timestamps for database records.

Do not store inconsistent timestamp formats.

API responses should use a JSON-compatible ISO representation where required by the existing frontend.

Preserve existing frontend display behavior.

29. FastAPI Startup/Shutdown

The application should:

FastAPI starts
      ↓
Load configuration
      ↓
Initialize MongoDB client
      ↓
Verify MongoDB connectivity
      ↓
Application ready

On shutdown:

FastAPI shutdown
      ↓
Close MongoDB client

Do not reconnect to MongoDB separately inside every endpoint.

30. Health Check

Extend the existing health check carefully.

Current:

GET /

It should continue working.

If useful, expose database status through a dedicated endpoint such as:

GET /health

or include a safe database status in the existing health response.

Do not expose connection strings or sensitive configuration.

Example conceptual response:

{
  "status": "ok",
  "database": "connected"
}

If MongoDB is unavailable, the status should accurately reflect that.

31. Dependency Management

Update:

backend/requirements.txt

with the MongoDB Python driver actually used.

Do not add unnecessary database libraries.

After changing dependencies:

Create/activate virtual environment
        ↓
pip install -r requirements.txt
        ↓
Start FastAPI

Verify imports before continuing.

32. Configuration Rules

If the repository already has:

.env
.env.example
settings.py
config.py

inspect and reuse the existing configuration architecture.

Do not create multiple competing configuration systems.

The final application should have one clear source for:

MongoDB URI
Database name
SMTP configuration
Other secrets

33. Security Rules

Never:

hardcode MongoDB passwords

commit .env

print the MongoDB URI

send MongoDB credentials to React

store plain-text passwords in MongoDB

expose database errors containing credentials

commit Atlas connection strings

create fake authentication just to satisfy user_id

Before completion, inspect:

git diff
git status
.gitignore

Make sure secrets are not staged.

34. Do Not Change These Existing Systems

During this task, do NOT modify unless strictly required:

AI models

SamLowe/roberta-base-go_emotions
bhadresh-savani/distilbert-base-uncased-emotion
cross-encoder/nli-distilroberta-base

Safety

evaluate_safety()

and its existing crisis workflow.

Response generation

generate_response()

Existing API contracts

POST /chat
GET /chat-history
POST /api/sos

GET /journal
POST /journal
PUT /journal/{id}
DELETE /journal/{id}

UI

Do not redesign the UI during the MongoDB task.

Landing page

Do not implement the upcoming landing-page animation during this task.

Colors

Do not change the existing MindEase color system.

Demo

Do not remove/change the three-minute demo mechanism.

35. Required Testing Sequence

After implementation, test in this exact order.

Test 1 — Backend import

Start FastAPI.

Expected:

No import errors
No syntax errors
Server starts successfully

Test 2 — MongoDB connection

Start the backend with valid:

MONGODB_URI=...

Expected:

MongoDB connection successful

No credentials should appear in logs.

Test 3 — Health check

Open:

http://127.0.0.1:8000/

Expected:

Backend responds

If a database health endpoint exists, verify:

database = connected

Test 4 — Frontend startup

Run:

npm run dev

Expected:

http://localhost:5173

No frontend compilation errors.

Test 5 — Journal create

Create a journal entry.

Verify:

React
 ↓
POST /journal
 ↓
FastAPI
 ↓
MongoDB
 ↓
journal_entries

Verify the document exists in MongoDB.

Test 6 — Journal read

Refresh the Journal page.

Expected:

GET /journal
 ↓
MongoDB
 ↓
Entries displayed

The entry must survive frontend refresh.

Test 7 — Journal update

Edit an existing entry.

Verify the MongoDB document changes.

Test 8 — Journal delete

Delete an entry.

Verify the MongoDB document is removed.

Test 9 — Chat

Send a normal chat message.

Verify:

Safety
 ↓
Emotion
 ↓
Mental State
 ↓
Response
 ↓
MongoDB chat_history

The AI result should remain unchanged from the pre-MongoDB behavior.

Test 10 — High-risk safety flow

Do not weaken or bypass the safety system.

Verify the existing high-risk pathway remains functional.

The database migration must not disable:

Crisis response
Safe Place
SOS

Test 11 — Safe Place

Verify trusted contacts continue to function according to the implemented migration scope.

Test 12 — Insights

Verify that Insights still receives the data it previously used.

If Insights currently reads data from localStorage or frontend state, do not break it merely because MongoDB was introduced.

If Insights is migrated to MongoDB, verify the complete data path.

36. Data Verification

After migration, verify:

users
journal_entries
chat_history
mood_records
trusted_contacts
safety_activities

For each collection, verify:

documents can be inserted

documents can be read

IDs serialize correctly

timestamps serialize correctly

user association is correct

frontend receives the expected response structure

37. Failure Testing

Test at least these cases:

MongoDB unavailable

Stop MongoDB/disable network temporarily.

Expected:

Controlled database error

not:

Python traceback exposed to frontend

Invalid ObjectId

Call:

/journal/not-a-valid-id

Expected:

Controlled 4xx response

Missing environment variable

Remove:

MONGODB_URI

Expected:

Clear configuration error

Do not print secrets.

38. Regression Testing

After MongoDB implementation, verify that these still work:

Landing Page
Login
Signup
Demo Mode
Dashboard
AI Support
Voice Input
Journal
Insights
Safe Place
Trusted Contacts
SOS
Settings
Crisis Modal

The MongoDB task is successful only if the existing application continues functioning.

39. Git Safety

Before implementation:

git status

After implementation:

git status
git diff

Review every changed file.

Do not commit:

.env
MongoDB credentials
SMTP credentials
large generated files
temporary debug files

Do not delete existing files unless their replacement is verified.

40. Implementation Order

Follow this exact sequence:

PHASE 0
Inspect repository
       ↓
PHASE 1
Verify current application works
       ↓
PHASE 2
Create MongoDB configuration
       ↓
PHASE 3
Create centralized database connection
       ↓
PHASE 4
Verify MongoDB connectivity
       ↓
PHASE 5
Create collection/data-access structure
       ↓
PHASE 6
Migrate Journal persistence
       ↓
PHASE 7
Test Journal CRUD
       ↓
PHASE 8
Migrate Chat persistence
       ↓
PHASE 9
Test Chat + Safety
       ↓
PHASE 10
Migrate remaining persistent data where supported
       ↓
PHASE 11
Test Safe Place / Mood / Insights
       ↓
PHASE 12
Run complete regression test
       ↓
PHASE 13
Review git diff and secrets
       ↓
PHASE 14
Final architecture report

41. Important: Do Not Do Everything in One Blind Rewrite

Do not rewrite:

main.py
App.jsx
api.js
Journal.jsx
AISupport.jsx
SafePlace.jsx

from scratch.

Modify the smallest number of files necessary.

Preserve working functionality.

42. Required Final Deliverable

When implementation is complete, provide a concise implementation report containing:

A. Files changed

Example:

backend/main.py
backend/database/mongodb.py
backend/requirements.txt
backend/.env.example
frontend/src/services/api.js
...

Only list files actually changed.

B. MongoDB connection

Report:

MongoDB connected: YES/NO
Database: mindease

Never print the URI.

C. Collections

Report which collections are actually used.

D. Migrated features

For example:

Journal: MongoDB
Chat history: MongoDB
Mood: MongoDB
Trusted contacts: MongoDB
Safety activities: MongoDB

Only claim what is actually implemented.

E. Tests performed

List the tests that actually passed.

F. Remaining limitations

Clearly state anything not migrated or anything that still depends on localStorage/JSON.

43. Definition of Done

The task is complete only when all applicable conditions are true:

FastAPI starts successfully.

Frontend starts successfully.

MongoDB connection works.

MongoDB URI is environment-based.

No credentials are hardcoded.

MongoDB credentials are not exposed to React.

Database connection is centralized.

MongoDB client is reused appropriately.

MongoDB client closes correctly.

Existing API contracts remain functional.

Journal CRUD works.

Chat still works.

AI models are unchanged.

Safety classification is unchanged.

Crisis behavior is unchanged.

Safe Place is not broken.

SOS is not broken.

Existing UI is not redesigned.

Existing colors are unchanged.

Existing demo mechanism is unchanged.

ObjectId serialization works.

Database errors are handled.

Existing data is not silently discarded.

JSON migration, if required, has been verified.

No secrets are committed.

git diff has been reviewed.

Complete regression testing has been performed.

44. Final Target Architecture

After successful implementation:

                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │ React Frontend  │
                  └────────┬────────┘
                           │
                       REST API
                           │
                           ▼
                  ┌─────────────────┐
                  │ FastAPI Backend │
                  └────────┬────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
     AI Pipeline      MongoDB Layer      SMTP/SOS
          │                │
          │                ▼
          │          ┌──────────────┐
          │          │   MongoDB    │
          │          │              │
          │          │ users        │
          │          │ journals     │
          │          │ chats        │
          │          │ moods        │
          │          │ contacts     │
          │          │ safety       │
          │          └──────────────┘
          │
          ▼
   Safety + Emotion +
   Mental State +
   Rule Response

45. Final Instruction to Antigravity

Treat the existing MindEase repository as the source of truth.

Do not assume that documentation is more accurate than the current code.

Inspect first.

Implement incrementally.

Test after every major migration.

Do not make unrelated architectural changes.

Do not replace the existing AI system.

Do not redesign the UI.

Do not change the color system.

Do not remove safety mechanisms.

Do not expose secrets.

Do not silently discard existing data.

If a required implementation decision cannot be determined safely from the current codebase, stop at that decision, explain exactly what is ambiguous, and ask for confirmation rather than guessing.

The primary goal is:

A stable, working MongoDB-backed MindEase application with the existing functionality preserved.
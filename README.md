# MindEase — AI-Based Mental Health Supporter

MindEase is an **AI-powered mental health support platform** designed to provide users with an accessible and supportive space for emotional well-being.

The platform combines an AI conversational assistant with journaling, safety-oriented features, and a personalized dashboard to help users reflect on their emotional state and access supportive resources.

## ✨ Features

### 🤖 AI Mental Health Chatbot

An AI-powered conversational assistant that provides supportive responses to users based on their conversations and emotional context.

### 📔 Journal

A private space where users can record their thoughts and feelings.

### 🛡️ Safe Place

A dedicated safety-oriented space designed to provide users with supportive resources when they need them.

### 📊 Personalized Dashboard

A dashboard that brings together relevant user information and features in one place.

### 🔐 Authentication

Secure user authentication and account management.

### 🎨 User-Friendly Interface

A clean and responsive interface designed to make the platform simple and comfortable to use.

## 🧠 AI Pipeline

The AI component follows a pipeline where user input is processed and analyzed before generating a supportive response.

```text
User Message
     ↓
Input Processing
     ↓
Mental Health / Emotion Analysis
     ↓
AI Model
     ↓
Response Generation
     ↓
Supportive Response
```

The project also explores the use of mental-health-related datasets for improving the AI system and understanding emotional language.

## 🛠️ Technology Stack

### Frontend

* React.js
* JavaScript
* HTML
* CSS
* Tailwind CSS

### Backend

* Python
* FastAPI

### Database

* MongoDB

### AI / ML

* Large Language Model (LLM)
* NLP
* Emotion / mental-health text analysis
* Mental health datasets

### Tools

* Git & GitHub
* VS Code
* REST APIs

## 📂 Project Structure

```text
MindEase/
│
├── frontend/
│   └── React application
│
├── backend/
│   └── FastAPI application
│
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Clone the repository

```bash
git clone <repository-url>
cd mindease
```

### Backend

Navigate to the backend directory and create/activate your Python environment.

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

### Frontend

Navigate to the frontend directory:

```bash
npm install
npm run dev
```

The frontend can then be accessed through the local Vite development server.

## 📊 Datasets

The project explored publicly available mental-health and emotion-related datasets for experimentation and model development.

Some of the datasets/resources considered include:

* Multilingual Mental Health Datasets
* GoEmotions
* Mental Health related datasets from Hugging Face

## ⚠️ Disclaimer

MindEase is an academic/project prototype intended to provide supportive interactions and demonstrate the use of AI in mental-health applications.

It is **not a replacement for professional mental-health care, diagnosis, or emergency services**.

## 👩‍💻 Project

**MindEase — AI-Based Mental Health Supporter**

Developed as an academic project with the goal of exploring how AI can be used to create accessible and supportive mental-health technology.

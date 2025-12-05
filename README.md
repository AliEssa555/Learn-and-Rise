# Learn and Rise - English Learning Application

An AI-powered English learning platform that helps users improve their language skills through interactive video lessons, AI-powered conversation practice, and speech recognition capabilities.

## Table of Contents
- [Project Overview](#project-overview)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Core Features](#core-features)
- [Data Handling](#data-handling)
- [Routes & API Endpoints](#routes--api-endpoints)
- [User Interface](#user-interface)
- [Technologies Used](#technologies-used)

---

## Project Overview

This Flask-based application provides an interactive English learning experience with:
- **AI Chatbot**: Context-aware conversation practice using YouTube video transcripts
- **Interactive Video Player**: Learn vocabulary by clicking on words in video transcripts
- **Speech Recognition**: Voice input support using a fine-tuned Whisper model
- **User Authentication**: Secure login/signup with MongoDB backend

---

## Project Structure

```
draft03_FYp_App/
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
├── .env                      # Environment variables (API keys, MongoDB URI)
│
├── app/                      # Main application package
│   ├── __init__.py           # App factory (Flask initialization)
│   ├── config.py             # Application configuration
│   ├── database.py           # MongoDB connection & user operations
│   │
│   ├── routes/               # Flask Blueprints (API endpoints)
│   │   ├── auth.py           # Authentication routes (login/signup/logout)
│   │   ├── main.py           # Dashboard/home routes
│   │   ├── chatbot.py        # AI chatbot & transcript processing
│   │   ├── player.py         # Video player & word explanation
│   │   └── podcast.py        # Podcast generator page
│   │
│   ├── models/               # Data models & AI components
│   │   ├── user.py           # User model for Flask-Login
│   │   ├── player_bot.py     # LLM client for word explanations
│   │   └── chatbot/          # Chatbot AI components
│   │       ├── config.py             # LLM & embedding settings
│   │       ├── model_loader.py       # Whisper ASR model loader
│   │       ├── audio_preprocessor.py # Audio file processing
│   │       ├── transcribe_audio.py   # Audio-to-text transcription
│   │       ├── transcript_processor.py # YouTube transcript extraction
│   │       ├── vector_store.py       # FAISS vector database
│   │       ├── qa_generator.py       # Question-answer generation
│   │       └── chat_handler.py       # RAG-based chat logic
│   │
│   ├── templates/            # HTML templates (Jinja2)
│   │   ├── base.html         # Base layout with navigation
│   │   ├── main.html         # Dashboard/home page
│   │   ├── chat.html         # AI chatbot interface
│   │   ├── player.html       # Video player interface
│   │   ├── generator.html    # Podcast generator page
│   │   └── auth/             # Authentication pages
│   │       ├── login.html
│   │       └── signup.html
│   │
│   ├── static/               # Static assets
│   │   ├── css/              # Stylesheets
│   │   └── js/               # JavaScript files
│   │
│   └── utils/                # Utility functions
│       └── subtitles.py      # YouTube subtitle extraction
│
├── model/                    # Whisper model files (safetensors)
├── processor/                # Whisper processor/tokenizer files
├── whisper_cache/            # HuggingFace cache for Whisper
└── embedding_cache/          # HuggingFace cache for embeddings
```

---

## Installation & Setup

### Prerequisites
- Python 3.8+
- MongoDB (local or Atlas)
- Ollama running locally (for LLM)

### Environment Variables
Create a `.env` file in the project root:
```env
SECRET_KEY=your-secret-key
MONGODB_URI=mongodb://localhost:27017/english_learning
Groq_API_KEY=your-groq-api-key  # Optional
```

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Required Services
1. **MongoDB**: Running on `localhost:27017` (or configure via `MONGODB_URI`)
2. **Ollama**: Running on `http://localhost:11434` with the `gemma3:4b` model
   ```bash
   ollama pull gemma3:4b
   ollama serve
   ```

### Run the Application
```bash
python run.py
```
Access at: `http://localhost:5000`

---

## Core Features

### 1. AI Chatbot (`app/routes/chatbot.py`)
Interactive English learning assistant that uses YouTube video content as context.

**Components:**

| Component | File | Description |
|-----------|------|-------------|
| `WhisperModel` | `model_loader.py` | Loads fine-tuned Whisper ASR model (`khizarAI/finetune-whisper-base.en`) |
| `preprocess_audio()` | `audio_preprocessor.py` | Converts audio files to 16kHz mono tensors using pydub |
| `transcribe_audio()` | `transcribe_audio.py` | Transcribes audio tensors using Whisper |
| `TranscriptProcessor` | `transcript_processor.py` | Extracts & chunks YouTube transcripts |
| `VectorStoreManager` | `vector_store.py` | Creates FAISS vector store with HuggingFace embeddings |
| `QAGenerator` | `qa_generator.py` | Generates question-answer pairs from transcripts using LLM |
| `ChatHandler` | `chat_handler.py` | RAG-based chat with conversation history |

### 2. Interactive Video Player (`app/routes/player.py`)
Learn vocabulary by watching YouTube videos with interactive transcripts.

**Key Functions:**

| Function | Description |
|----------|-------------|
| `video_player()` | Renders the video player interface |
| `subtitles()` | Fetches and returns YouTube subtitles |
| `chatbot()` | Generates detailed word explanations via LLM |

### 3. User Authentication (`app/routes/auth.py`)
Secure user registration and session management.

**Key Functions:**

| Function | Route | Description |
|----------|-------|-------------|
| `login()` | `/login` | User login with email/password |
| `signup()` | `/signup` | New user registration |
| `logout()` | `/logout` | Session termination |
| `main()` | `/main` | Dashboard redirect after login |

---

## Data Handling

### Database Layer (`app/database.py`)

The application uses **MongoDB** for persistent data storage.

**Connection:**
```python
def get_db():
    client = MongoClient(os.getenv("MONGODB_URI"))
    return client.english_learning
```

**User Operations:**

| Function | Description |
|----------|-------------|
| `create_user(email, password)` | Registers a new user with hashed password |
| `verify_user(email, password)` | Validates credentials, returns user data or `None` |

**User Document Schema:**
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "password_hash": "werkzeug-hashed-password",
  "created_at": "datetime"
}
```

### Vector Store (`app/models/chatbot/vector_store.py`)

Uses **FAISS** for semantic search over transcript chunks.

**Key Methods:**

| Method | Description |
|--------|-------------|
| `create_vector_store(docs)` | Creates FAISS index from document list |
| `update_vector_store(link)` | Adds web content to existing index |
| `_get_docs_from_web(link)` | Fetches and chunks web page content |

**Embedding Model:** `sentence-transformers/all-mpnet-base-v2`

### Transcript Processing (`app/models/chatbot/transcript_processor.py`)

Extracts and chunks YouTube video transcripts.

| Method | Description |
|--------|-------------|
| `get_transcript(youtube_url)` | Fetches transcript, groups into 120-second chunks |
| `prepare_documents(df)` | Converts DataFrame to LangChain Documents |

### Audio Processing Pipeline

```
Audio Input → preprocess_audio() → transcribe_audio() → Text
     │              │                     │
   WebM/WAV    16kHz Mono Tensor    Whisper Model
```

---

## Routes & API Endpoints

### Authentication Routes (`app/routes/auth.py`)

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Redirects to login |
| `/login` | GET, POST | Login form/handler |
| `/signup` | GET, POST | Registration form/handler |
| `/logout` | GET | Logs out user |
| `/main` | GET | Dashboard page |

### Main Routes (`app/routes/main.py`)

| Route | Method | Description |
|-------|--------|-------------|
| `/` or `/dashboard` | GET | Renders main dashboard |

### Chatbot Routes (`app/routes/chatbot.py`)

| Route | Method | Description |
|-------|--------|-------------|
| `/chat_interface` | GET | Renders chat UI |
| `/process_transcript` | POST | Processes YouTube URL, creates vector store, generates Q&A |
| `/process_input` | POST | Handles text/audio chat input |
| `/transcribe` | POST | Legacy ASR endpoint |

**Request/Response Examples:**

**POST `/process_transcript`**
```json
// Request
{ "youtube_url": "https://youtube.com/watch?v=..." }

// Response
{
  "message": "Transcript processed successfully",
  "qa_pairs": [["Question 1?", "Answer 1"], ...]
}
```

**POST `/process_input`**
```json
// Request (form-data)
input_type: "text" | "audio"
message: "Your question" // if text
audio: (file) // if audio

// Response
{
  "user_input": "Your question",
  "bot_response": "AI answer",
  "input_type": "text"
}
```

### Player Routes (`app/routes/player.py`)

| Route | Method | Description |
|-------|--------|-------------|
| `/player/` | GET | Renders video player UI |
| `/subtitles` | POST | Fetches YouTube subtitles |
| `/chatbot` | POST | Returns word explanation from LLM |

**POST `/chatbot` Request:**
```json
{
  "word": "vocabulary",
  "sentence": "The video helps you learn new vocabulary."
}
```

### Podcast Routes (`app/routes/podcast.py`)

| Route | Method | Description |
|-------|--------|-------------|
| `/podcast` | GET | Renders podcast generator page |

---

## User Interface

### Base Template (`base.html`)
- Responsive navigation bar with links to:
  - Home (Dashboard)
  - Video Player
  - Chatbot
  - Podcast Generator
  - Logout
- Uses Font Awesome icons

### Dashboard (`main.html`)
- Welcome message with app overview
- Quick-start action cards for:
  - Watch Videos
  - Practice Speaking
  - Generate Podcast

### Chat Interface (`chat.html`)
- YouTube URL input for transcript processing
- Generated questions panel (clickable)
- Chat history display
- Text/voice input toggle
- Audio recording with browser MediaRecorder API

### Video Player (`player.html`)
- YouTube URL input
- Embedded video display
- Interactive transcript (click any word)
- Word explanation panel with detailed breakdown:
  - Pronunciation & part of speech
  - Multiple definitions
  - Contextual usage
  - Learning tips
  - Usage examples
  - Practice exercises

---

## Technologies Used

### Backend
- **Flask** - Web framework
- **Flask-Login** - User session management
- **PyMongo** - MongoDB driver
- **Werkzeug** - Password hashing

### AI/ML
- **LangChain** - LLM orchestration framework
- **LangChain-Ollama** - Local LLM integration
- **Transformers** - Whisper model loading
- **FAISS** - Vector similarity search
- **Sentence-Transformers** - Text embeddings
- **HuggingFace** - Model hub

### Audio Processing
- **pydub** - Audio format conversion
- **Whisper** - Speech recognition (`khizarAI/finetune-whisper-base.en`)

### Frontend
- **Bootstrap 5** - UI framework
- **Font Awesome** - Icons
- **Jinja2** - HTML templating
- **JavaScript** - Audio recording, API calls

### External APIs
- **YouTube Transcript API** - Video subtitle extraction
- **Ollama** - Local LLM serving (`gemma3:4b`)

---

## Configuration

### Chatbot Config (`app/models/chatbot/config.py`)

| Setting | Value | Description |
|---------|-------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `EMBEDDING_MODEL` | `sentence-transformers/all-mpnet-base-v2` | Text embedding model |
| `LLM_MODEL` | `gemma3:4b` | LLM model name |
| `LLM_TEMPERATURE` | `0.7` | Response randomness |

### App Config (`app/config.py`)

| Setting | Source | Description |
|---------|--------|-------------|
| `SECRET_KEY` | `.env` | Flask session key |
| `MONGODB_SETTINGS` | hardcoded | Database connection |
| `Groq_API_KEY` | `.env` | Groq API key (optional) |

---

## License

This project is part of a Final Year Project (FYP).

---

## Authors

Developed as an English Learning Application for ESL learners.

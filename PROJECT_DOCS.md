# Learn and Rise - AI English Tutor (Node.js Edition)

This is a **Node.js** rewrite of the Learn and Rise application, featuring a fully local AI stack.

## 🚀 Features
- **Local LLM**: Powered by **Ollama** (`gemma3:4b`), running entirely on your machine.
- **Node.js Backend**: Fast and efficient Express server.
- **Docker Support**: Full containerization compatible.
- **Virtual Environment**: Python venv included for legacy compatibility.

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js
- **Frontend**: EJS, Bootstrap, Custom CSS
- **AI Engine**: Ollama (gemma3:4b)
- **Utilities**: `dotenv`, `cors`, `multer`

## 📋 Prerequisites
1.  **Node.js** (Installed)
2.  **Ollama** App (Running in background)
    - Run `ollama pull gemma3:4b` if you haven't already.

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Server
```bash
node server.js
```
The app will be available at **http://localhost:3000**.

### 3. Usage
- Go to `http://localhost:3000`.
- Click on **Chatbot**.
- Type a message to talk to your AI English Tutor.

## 🐳 Docker
To run with Docker:
```bash
docker build -t learn-and-rise .
docker run -p 3000:3000 learn-and-rise
```

## 蛇 Python Environment
A Python virtual environment `venv` is also provided in the project root if you need to run specific legacy Python scripts.
```bash
# Activate venv
.\venv\Scripts\activate
```

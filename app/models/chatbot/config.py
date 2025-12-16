import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OLLAMA_BASE_URL = "http://localhost:11434"
    LANGCHAIN_TRACING_V2 = os.getenv("LANGCHAIN_TRACING_V2", "true")
    LANGCHAIN_ENDPOINT = os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
    LANGCHAIN_PROJECT = os.getenv("LANGCHAIN_PROJECT", "default")
    EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"
    LLM_MODEL = "gemma3:4b"
    LLM_TEMPERATURE = 0.7
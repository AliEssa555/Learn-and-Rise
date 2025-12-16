import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY') or 'your-secret-key-here'
    MONGODB_SETTINGS = {
        'db': 'english_learning',
        'host': 'mongodb://localhost:27017/english_learning'
    }
    Groq_API_KEY = os.getenv('Groq_API_KEY')
from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from werkzeug.security import check_password_hash
import datetime
from dotenv import load_dotenv
import os

load_dotenv()

def get_db():
    client = MongoClient(os.getenv("MONGODB_URI"))
    return client.english_learning

def create_user(email, password):
    db = get_db()
    if db.users.find_one({"email": email}):
        return None  # User exists
    db.users.insert_one({
        "email": email,
        "password_hash": generate_password_hash(password),
        "created_at": datetime.datetime.now()
    })
    return True

def verify_user(email, password):
    try:
        db = get_db()
        user = db.users.find_one({"email": email})
        
        if not user:
            return None
            
        if not check_password_hash(user.get("password_hash", ""), password):
            return None
            
        return user
        
    except Exception as e:
        
        return None

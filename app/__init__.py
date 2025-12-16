from flask import Flask
from flask_login import LoginManager
from .models.user import User
import os

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    
    # Initialize Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    
    # User loader configuration
    @login_manager.user_loader
    def load_user(user_id):
        from app.database import get_db
        db = get_db()
        user_data = db.users.find_one({"_id": user_id})
        return User(user_data) if user_data else None

    from app.routes.auth import bp as auth_bp
    from app.routes.main import bp as main_bp
    from app.routes.player import player_bp
    from app.routes.chatbot import bp as chatbot_bp
    from app.routes.podcast import podcast_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(player_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(podcast_bp)
    
    return app
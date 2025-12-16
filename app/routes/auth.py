from flask import Blueprint, render_template, redirect, url_for, flash, request
from app.database import create_user, verify_user

bp = Blueprint('auth', __name__)

from flask_login import login_user, logout_user, login_required
from app.models.user import User

from flask import flash

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        try:
            email = request.form.get('email', '').strip()
            password = request.form.get('password', '').strip()
            
            if not email or not password:
                flash('Please fill in all fields', 'error')
                return redirect(url_for('auth.login'))
            
            user_data = verify_user(email, password)
            
            if not user_data:
                flash('Invalid email or password', 'error')
                return redirect(url_for('auth.login'))
                
            user = User(user_data)
            login_user(user)
            return redirect(url_for('auth.main'))
            
        except Exception as e:
            flash('An error occurred during login', 'error')
            # Log the error for debugging:
            return redirect(url_for('auth.login'))
    
    return render_template('auth/login.html')

@bp.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        if create_user(request.form['email'], request.form['password']):
            flash('Account created! Please login.')
            return redirect(url_for('auth.login'))
        flash('Email already exists')
    return render_template('auth/signup.html')

@bp.route('/main')
def main():
    return render_template('main.html')

@bp.route('/logout')
def logout():
    logout_user()  # This clears the user session
    flash('You have been logged out', 'success')
    return redirect(url_for('auth.login'))

@bp.route('/')  # Add root route
def home():
    return redirect(url_for('auth.login'))
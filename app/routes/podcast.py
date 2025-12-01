from flask import Blueprint, render_template

podcast_bp = Blueprint('podcast', __name__)

@podcast_bp.route('/podcast')
def podcast_generator():
    return render_template('generator.html')
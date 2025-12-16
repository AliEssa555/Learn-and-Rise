from flask import Flask, render_template, request, jsonify, Blueprint
from app.models.player_bot import generate_response_from_llm
from app.utils.subtitles import get_subtitles

player_bp = Blueprint('player', __name__)

@player_bp.route('/player/')
def video_player():
    return render_template('player.html')

@player_bp.route('/subtitles', methods=['POST'])
def subtitles():
    data = request.json
    video_url = data.get('url')
    subtitles = get_subtitles(video_url)
    return jsonify(subtitles)

@player_bp.route('/chatbot', methods=['POST'])
def chatbot():
    """Handle word explanation requests"""
    try:
        data = request.get_json()
        word = data.get('word', '').strip()
        sentence = data.get('sentence', '').strip()

        prompt = f"""
**You are an expert English tutor specializing in ESL (English as a Second Language).**
The student clicked on the word "{word}" in this sentence:
"{sentence}"

Provide a comprehensive explanation using EXACTLY this template (include ALL sections and formatting):

✨ **Word Focus**: _{word}_  
   - Pronunciation: /.../ (add phonetic if possible)
   - Part of Speech: (noun/verb/adjective/etc.)

📚 **Core Meanings**:
1. Primary Definition: (Most common meaning)
2. Secondary Definition: (Other important meanings)

🔍 **In This Sentence**:  
   - Explain how the word functions here
   - Break down any idioms/phrasal verbs if present

🎯 **Learning Tips**:
   - Memory Trick: (Mnemonic or visual association)
   - Common Mistakes: (What learners often get wrong)
   - Related Words: (Synonyms/antonyms/word family)

💬 **Usage Examples**:
   - Formal: (Professional/formal context example)
   - Casual: (Everyday conversation example)
   - Academic: (Writing/essay example)

🌍 **Cultural Note**:  
   - How native speakers commonly use this word
   - Any regional variations

📝 **Practice Exercise**:  
   "Complete this sentence: _[missing word]_"

🔔 **Teacher's Note**:  
   (Encouraging message about mastering this word)

=== (Response must end with this divider) ===
"""

        response = generate_response_from_llm(prompt)
        
        return jsonify({'response': response})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
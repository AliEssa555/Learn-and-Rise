from flask import Flask, render_template, request, jsonify
import io

from audio_preprocessor import preprocess_audio
from model_loader import WhisperModel
from transcribe_audio import transcribe_audio

app = Flask(__name__)

# Load model once
whisper_model = WhisperModel()
processor = whisper_model.get_processor()
model = whisper_model.get_model()

@app.route('/')
def index():
    return render_template('asr.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({'transcript': 'No audio file uploaded'}), 400

    audio_file = request.files['audio']

    try:
        # Read audio bytes and wrap as in-memory file
        audio_bytes = audio_file.read()
        audio_io = io.BytesIO(audio_bytes)

        # Preprocess + Transcribe
        audio_tensor = preprocess_audio(audio_io)
        transcription = transcribe_audio(audio_tensor, processor, model)

        return jsonify({'transcript': transcription})
    
    except Exception as e:
        print("Error during transcription:", e)
        return jsonify({'transcript': f'[Error] {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)

from flask import Flask, render_template, request, jsonify, redirect, url_for, Blueprint
from langchain_ollama import ChatOllama
from app.models.chatbot.config import Config
from app.models.chatbot.transcript_processor import TranscriptProcessor
from app.models.chatbot.qa_generator import QAGenerator
from app.models.chatbot.vector_store import VectorStoreManager
from app.models.chatbot.chat_handler import ChatHandler
from app.models.chatbot.audio_preprocessor import preprocess_audio
from app.models.chatbot.model_loader import WhisperModel
from app.models.chatbot.transcribe_audio import transcribe_audio
import os
import io

bp = Blueprint('chatbot', __name__)

# Initialize components
llm = ChatOllama(
    model=Config.LLM_MODEL,
    temperature=Config.LLM_TEMPERATURE,
    verbose=True,
    base_url=Config.OLLAMA_BASE_URL
)

def initialize_components():
    # 1. First load Whisper (audio processing)
    os.environ["HF_HOME"] = os.path.join(os.getcwd(), "whisper_cache")
    whisper_model = WhisperModel()
    
    # 2. Then load embeddings (text processing)
    os.environ["HF_HOME"] = os.path.join(os.getcwd(), "embedding_cache")
    vector_store_manager = VectorStoreManager(Config.EMBEDDING_MODEL)
    
    # 3. Clear cache environment to prevent conflicts
    if "HF_HOME" in os.environ:
        del os.environ["HF_HOME"]
    
    return whisper_model, vector_store_manager

whisper_model, vector_store_manager = initialize_components()
processor = whisper_model.get_processor()
model = whisper_model.get_model()
print("Whisper and Embedding Model load sucessfully")

#vector_store_manager = VectorStoreManager(bp.config['EMBEDDING_MODEL'])
transcript_processor = TranscriptProcessor()
qa_generator = QAGenerator(llm)

# Initialize chat handler after first transcript is processed
chat_handler = None

@bp.route('/')
def index():
    return redirect(url_for('chat_interface'))

@bp.route('/chat_interface')
def chat_interface():
    """Render the main chat interface"""
    return render_template('chat.html')

@bp.route('/process_transcript', methods=['POST'])
def process_transcript():
    """Process YouTube transcript and initialize chat"""
    global chat_handler
    
    youtube_url = request.json.get('youtube_url')
    if not youtube_url:
        return jsonify({"error": "YouTube URL is required"}), 400
        
    df = transcript_processor.get_transcript(youtube_url)
    if df is None:
        return jsonify({"error": "Failed to process transcript"}), 500
        
    # Prepare documents and create vector store
    docs = transcript_processor.prepare_documents(df)
    vector_store = vector_store_manager.create_vector_store(docs)
    
    # Generate QA pairs
    inputs, outputs = qa_generator.generate_qa_pairs(df["text"].tolist())
    
    # Initialize chat handler
    chat_handler = ChatHandler(llm, vector_store)
    
    return jsonify({
        "message": "Transcript processed successfully",
        "qa_pairs": list(zip([i['question'] for i in inputs], [o['answer'] for o in outputs]))
    })

@bp.route('/process_input', methods=['POST'])
def process_input():
    """Handle both text and audio inputs"""
    global chat_handler
    
    if chat_handler is None:
        return jsonify({"error": "Please process a transcript first"}), 400
        
    input_type = request.form.get('input_type')
    
    if input_type == 'audio':
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file uploaded'}), 400
            
        try:
            # Process audio input
            audio_file = request.files['audio']
            audio_bytes = audio_file.read()
            audio_io = io.BytesIO(audio_bytes)
            audio_tensor = preprocess_audio(audio_io)
            transcription_result = transcribe_audio(audio_tensor, processor, model)
            # Convert transcription result to string
            if isinstance(transcription_result, list):
                user_input = " ".join(transcription_result)  # Join list elements
            elif isinstance(transcription_result, str):
                user_input = transcription_result
            else:
                return jsonify({'error': 'Unexpected transcription format'}), 500
                
        except Exception as e:
            return jsonify({'error': f'Audio processing failed: {str(e)}'}), 500
    else:
        # Process text input
        user_input = request.form.get('message', '')
    
    if not user_input:
        return jsonify({'error': 'Empty input'}), 400
    
    # Get response from chat handler
    try:
        response = chat_handler.process_chat(user_input)
        return jsonify({
            'user_input': user_input,
            'bot_response': response,
            'input_type': input_type
        })
    except Exception as e:
        return jsonify({'error': f'Chat processing failed: {str(e)}'}), 500

@bp.route('/transcribe', methods=['POST'])
def transcribe():
    """Legacy ASR endpoint (kept for compatibility)"""
    if 'audio' not in request.files:
        return jsonify({'transcript': 'No audio file uploaded'}), 400

    try:
        audio_file = request.files['audio']
        audio_bytes = audio_file.read()
        audio_io = io.BytesIO(audio_bytes)
        audio_tensor = preprocess_audio(audio_io)
        transcription = transcribe_audio(audio_tensor, processor, model)
        return jsonify({'transcript': transcription})
    except Exception as e:
        return jsonify({'transcript': f'[Error] {str(e)}'}), 500

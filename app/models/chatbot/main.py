from audio_recorder import record_audio
from audio_preprocessor import preprocess_audio
from model_loader import WhisperModel
from transcribe_audio import transcribe_audio

def main():
    # Initialize the model and processor
    whisper_model = WhisperModel()
    processor = whisper_model.get_processor()
    model = whisper_model.get_model()

    while True:
        print("\nOptions:")
        print("1. Record and transcribe audio")
        print("2. Exit")
        choice = input("Enter your choice: ")

        if choice == "1":
            # Record audio
            audio_path = record_audio()
            
            # Preprocess audio
            audio_tensor = preprocess_audio(audio_path)
            
            # Transcribe audio
            transcription = transcribe_audio(audio_tensor, processor, model)
            
            print("\nTranscription:")
            print(transcription)
        
        elif choice == "2":
            print("Exiting...")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
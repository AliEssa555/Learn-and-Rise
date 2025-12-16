import os
from transformers import WhisperProcessor, WhisperForConditionalGeneration

class WhisperModel:
    def __init__(self, model_name="khizarAI/finetune-whisper-base.en"):
        # Isolate HuggingFace cache for Whisper
        os.environ["HF_HOME"] = os.path.join(os.getcwd(), "whisper_cache")
        os.makedirs(os.environ["HF_HOME"], exist_ok=True)
        
        try:
            self.processor = WhisperProcessor.from_pretrained(
                model_name,
                cache_dir=os.environ["HF_HOME"]
            )
            self.model = WhisperForConditionalGeneration.from_pretrained(
                model_name,
                cache_dir=os.environ["HF_HOME"]
            )
        except Exception as e:
            raise RuntimeError(f"Whisper initialization failed: {str(e)}")
        # Explicitly configure generation settings

        self.model.config.forced_decoder_ids = None
        #self.model.generation_config.forced_decoder_ids = None
        self.model.generation_config.update(
            suppress_tokens=None,          # Disable default token suppression
            begin_suppress_tokens=None,   # Disable begin suppression
            forced_decoder_ids=None       # Ensure no conflicts with timestamps
        )
        print("Model and processor loaded successfully.")
    
    def get_processor(self):
        return self.processor
    
    def get_model(self):
        return self.model


# from transformers import WhisperProcessor, WhisperForConditionalGeneration

# class WhisperModel:
#     def __init__(self, model_path="./FinetuneWhisper"):
#         """
#         Initialize the Whisper model and processor.
        
#         Parameters:
#             model_path (str): Path to the locally saved model.
#         """
#         print("Loading Whisper model and processor...")
#         self.processor = WhisperProcessor.from_pretrained("processor")
#         self.model = WhisperForConditionalGeneration.from_pretrained("model")
        
#         # Explicitly configure generation settings
#         self.model.config.forced_decoder_ids = None
#         #self.model.generation_config.forced_decoder_ids = None
#         self.model.generation_config.update(
#             suppress_tokens=None,          # Disable default token suppression
#             begin_suppress_tokens=None,   # Disable begin suppression
#             forced_decoder_ids=None       # Ensure no conflicts with timestamps
#         )
#         print("Model and processor loaded successfully.")
    
#     def get_processor(self):
#         return self.processor
    
#     def get_model(self):
#         return self.model

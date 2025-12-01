import torch

def transcribe_audio(audio, processor, model):
    """
    Transcribe audio and return the transcription with timestamps.
    
    Parameters:
        audio_tensor (torch.Tensor): Preprocessed audio tensor.
        processor (WhisperProcessor): Loaded processor.
        model (WhisperForConditionalGeneration): Loaded Whisper model.
    
    Returns:
        String: Transcription text
    """
    inputs = processor(audio, sampling_rate=16000, truncation=False, padding="longest", return_attention_mask=True, return_tensors="pt")
    with torch.no_grad():
        predicted_ids = model.generate(**inputs, return_timestamps=True) 

        # predicted_ids = model.generate(inputs["input_features"], return_segments=True, return_dict_in_generate=True, return_timestamps=True)
    
    # Decode transcription
    transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)

    return transcription
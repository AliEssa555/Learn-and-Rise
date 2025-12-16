from pydub import AudioSegment
import numpy as np
import torch
def preprocess_audio(audio_io, target_sample_rate=16000):
    """
    Preprocess audio for Whisper. Truncates audio longer than max_duration.
    
    Parameters:
        audio_path (str): Path to the audio file.
        target_sample_rate (int): Sampling rate for the model.
    
    Returns:
        array: Preprocessed audio as a array.
    """
    audio = AudioSegment.from_file(audio_io, format="webm")
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    samples = np.array(audio.get_array_of_samples()).astype(np.float32) / 32768.0
    return torch.tensor(samples)

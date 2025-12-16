import keyboard
import wave
import struct
from pvrecorder import PvRecorder

def record_audio(output_file="recod.wav", sample_rate=16000):
    """
    Record audio from the microphone.
    
    Parameters:
        output_file (str): File path to save the recording.
        sample_rate (int): Sampling rate for the audio recording.
    
    Returns:
        str: Path to the saved audio file.
    """
    recorder = PvRecorder(device_index=-1, frame_length=512)
    audio = []

    try:
        print("Press space to start recording")
        keyboard.wait('space')
        print("Recording Strat")
        recorder.start()
        print("Press Ctrl+c to stop recodrding")

        while True:
            frame = recorder.read()
            audio.extend(frame)
    except KeyboardInterrupt:
        recorder.stop()
        print("Recording stopped.")
        with wave.open(output_file, 'w') as f:
            f.setparams((1, 2, 16000, 512, "NONE", "NONE"))
            f.writeframes(struct.pack("h" * len(audio), *audio))
    finally:
        recorder.delete()
    
    return output_file
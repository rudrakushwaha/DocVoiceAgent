
import io
import tempfile
import subprocess
import torch
import whisper
from transformers import pipeline

_whisper_model = None
_emotion_pipeline = None

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = whisper.load_model('small')
    return _whisper_model

def get_emotion_pipeline():
    global _emotion_pipeline
    if _emotion_pipeline is None:
        # model: superb/wav2vec2-base-superb-er
        _emotion_pipeline = pipeline('audio-classification', model='superb/wav2vec2-base-superb-er')
    return _emotion_pipeline

async def transcribe_and_emotion(audio_bytes: bytes):
    import os
    # Write incoming bytes to a temp .webm file
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f_in:
        f_in.write(audio_bytes)
        webm_path = f_in.name

    # Convert .webm to .wav using ffmpeg
    wav_path = webm_path.replace('.webm', '.wav')
    try:
        # ffmpeg -i input.webm -ar 16000 -ac 1 output.wav
        try:
            subprocess.run([
                'ffmpeg', '-y', '-i', webm_path,
                '-ar', '16000', '-ac', '1', wav_path
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except FileNotFoundError:
            raise RuntimeError('ffmpeg is not installed or not found in PATH. Please install ffmpeg and ensure it is available in your system PATH.')
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f'ffmpeg failed: {e.stderr.decode("utf-8", errors="ignore")}')

        model = get_whisper()
        result = model.transcribe(wav_path)
        text = result.get('text', '')

        emo_pipe = get_emotion_pipeline()
        emo = emo_pipe(wav_path)
        emotion = emo[0]['label'] if emo else 'neutral'

        return { 'text': text, 'emotion': emotion }
    finally:
        try:
            os.unlink(webm_path)
        except Exception:
            pass
        try:
            os.unlink(wav_path)
        except Exception:
            pass

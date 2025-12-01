import re
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, VideoUnavailable, NoTranscriptFound

def get_video_id(url):
    match = re.search(r"v=([^&]+)", url)
    if match:
        return match.group(1)
    return None

def get_subtitles(url):
    video_id = get_video_id(url)
    if not video_id:
        return [{"text": "Invalid YouTube URL"}]

    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)

        # Combine all transcript text
        all_text = " ".join([entry['text'].strip() for entry in transcript if entry['text'].strip()])
        
        # Split based on punctuation that defines end of sentence
        sentences = re.split(r'(?<=[.?!])\s+', all_text)

        return [{"text": s.strip()} for s in sentences if s.strip()]
    
    except (TranscriptsDisabled, VideoUnavailable, NoTranscriptFound):
        return [{"text": "Transcript not available for this video"}]
    except Exception as e:
        return [{"text": f"Error fetching subtitles: {str(e)}"}]

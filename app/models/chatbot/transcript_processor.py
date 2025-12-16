import pandas as pd
from youtube_transcript_api import YouTubeTranscriptApi
from langchain_core.documents import Document

class TranscriptProcessor:
    def __init__(self, chunk_duration=120):
        self.chunk_duration = chunk_duration
        
    def get_transcript(self, youtube_url):
        try:
            video_id = youtube_url.split("v=")[-1].split("&")[0]
            transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
            df = pd.DataFrame(transcript)
            
            grouped_transcript = []
            current_chunk = {"start": 0, "text": ""}

            for _, row in df.iterrows():
                if row["start"] - current_chunk["start"] < self.chunk_duration:
                    current_chunk["text"] += " " + row["text"]
                else:
                    current_chunk["duration"] = self.chunk_duration
                    grouped_transcript.append(current_chunk)
                    current_chunk = {"start": row["start"], "text": row["text"]}

            if current_chunk:
                current_chunk["duration"] = self.chunk_duration
                grouped_transcript.append(current_chunk)

            return pd.DataFrame(grouped_transcript)
            
        except Exception as e:
            print(f"Error: {str(e)}")
            return None

    def prepare_documents(self, df):
        return [Document(metadata={}, page_content=text) for text in df["text"].tolist()]
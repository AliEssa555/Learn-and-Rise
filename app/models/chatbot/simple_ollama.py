import requests
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

class SimpleOllama:
    def __init__(self, model, base_url="http://localhost:11434", **kwargs):
        self.model = model
        self.base_url = base_url.rstrip('/')
        
    def invoke(self, input_data):
        # input_data can be a string, list of messages, or PromptValue
        if hasattr(input_data, 'to_messages'):
            return self._call_chat_api(input_data.to_messages())
        
        if hasattr(input_data, 'to_string'):
             return self._call_generate_api(input_data.to_string())

        prompt = ""
        if isinstance(input_data, str):
            prompt = input_data
            return self._call_generate_api(prompt)
        elif isinstance(input_data, list):
            return self._call_chat_api(input_data)
        
        # Fallback
        return self._call_generate_api(str(input_data))

    def _call_chat_api(self, messages):
        url = f"{self.base_url}/api/chat"
        
        formatted_messages = []
        for msg in messages:
            role = "user"
            if isinstance(msg, SystemMessage): role = "system"
            elif isinstance(msg, AIMessage): role = "assistant"
            elif isinstance(msg, HumanMessage): role = "user"
            elif hasattr(msg, 'role'): role = msg.role # Dictionary
            elif hasattr(msg, 'type'): # Langchain message type
                if msg.type == 'system': role = 'system'
                elif msg.type == 'ai': role = 'assistant'
            
            content = msg.content if hasattr(msg, 'content') else str(msg)
            formatted_messages.append({"role": role, "content": content})

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            result = response.json()
            content = result.get("message", {}).get("content", "")
            return AIMessage(content=content)
        except Exception as e:
            print(f"SimpleOllama Error: {e}")
            return AIMessage(content=f"Error: {e}")

    def _call_generate_api(self, prompt):
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            content = response.json().get("response", "")
            return AIMessage(content=content)
        except Exception as e:
            return AIMessage(content=f"Error: {e}")
            
    # Support pipe operator interaction if needed by being a Runnable? 
    # In python, simple classes work if they implement invoke for basic LCEL

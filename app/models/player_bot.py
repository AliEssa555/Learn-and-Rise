import os
from openai import OpenAI

# Initialize the Groq client with your API key
#api_key = os.getenv('Groq_API_KEY')

client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1"
)

def generate_response_from_llm(prompt):

    try:
            # Create a chat completion
        chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are an English tutor."},
            {"role": "user", "content": prompt}
        ],
        model="gemma3:4b"  # Replace with your desired model
    )

        # Return the assistant's response
        return chat_completion.choices[0].message.content

    except Exception as e:
        return f"❌ Error getting response from Ollama: {e}"

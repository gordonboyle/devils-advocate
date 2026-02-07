
import os
import sys
from dotenv import load_dotenv
from litellm import completion

# Load env
load_dotenv()

model = os.getenv("LITELLM_MODEL", "gpt-4o")
api_key = os.getenv("GEMINI_API_KEY")

print(f"Testing Model: {model}")
print(f"API Key Present: {bool(api_key)}")

try:
    response = completion(
        model=model,
        messages=[{"role": "user", "content": "Hello, are you working?"}]
    )
    print("Success!")
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}")

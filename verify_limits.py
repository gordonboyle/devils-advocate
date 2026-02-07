import os
import sys
from dotenv import load_dotenv
import litellm

# Load env vars
load_dotenv()

model = os.getenv("LITELLM_MODEL")
api_key = os.getenv("GEMINI_API_KEY")

print(f"--- Google Gemini API Test ---")
print(f"Target Model: {model}")
print(f"API Key Found: {'Yes' if api_key else 'No'}")

if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
    sys.exit(1)

try:
    print(f"Sending test request to {model}...")
    response = litellm.completion(
        model=model,
        messages=[{"role": "user", "content": "Reply with 'API Verified' if you can read this."}],
        api_key=api_key
    )
    content = response.choices[0].message.content
    print("\nSUCCESS!")
    print(f"Response: {content}")
    print("\nNote: Since this call succeeded, you are currently within your quota limits.")
    
except Exception as e:
    print("\nFAILURE")
    print(f"Error details: {e}")
    if "429" in str(e):
        print("\nDiagnosis: Rate Limit Exceeded (Quota Reached)")
    elif "401" in str(e) or "403" in str(e):
        print("\nDiagnosis: Invalid API Key or Permissions")
    elif "404" in str(e):
        print("\nDiagnosis: Model not found (Check LITELLM_MODEL name)")

import os
from typing import Type, TypeVar, Any
from pydantic import BaseModel
import litellm
from litellm import completion

# Generic type for Pydantic models
T = TypeVar("T", bound=BaseModel)

# Safety Constants
MAX_TOTAL_CALLS = 15

class ResourceLimitExceeded(Exception):
    """Raised when the total compute cap is exceeded."""
    pass

def call_agent(
    system_prompt: str, 
    user_input: str, 
    response_model: Type[T], 
    current_call_count: int,
    model_name: str = "gpt-4o"
) -> T:
    """
    Calls the LLM with structured output enforcement (Pydantic).
    
    Args:
        system_prompt: The system instruction for the agent.
        user_input: The specific task or context for this call.
        response_model: The Pydantic class to structure the response.
        current_call_count: The current total number of LLM calls in the session.
        model_name: The LLM model to use (default: gpt-4o).
        
    Returns:
        An instance of response_model populated by the LLM.
        
    Raises:
        ResourceLimitExceeded: If current_call_count >= MAX_TOTAL_CALLS.
    """
    
    # Safety Check: Total Compute Cap
    if current_call_count >= MAX_TOTAL_CALLS:
        raise ResourceLimitExceeded(f"Total compute cap of {MAX_TOTAL_CALLS} reached. Operation halted.")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]

    # Use litellm with response_format for structured output
    # Note: explicit pydantic support in litellm usually works via 'response_format' or instructor.
    # We will use the native 'response_format' if supported or the json_mode + validation pattern.
    # LiteLLM supports 'response_format={"type": "json_object"}' generally, 
    # but for strict schema, we often use `instructor` or specific provider features.
    # For this implementation, we will assume standard LiteLLM structured output behavior 
    # or simple dict parsing if the provider supports it.
    
    # Attempting to use LiteLLM's `response_format` with Pydantic model (if supported by the specific proxy/version)
    # Otherwise, we ask for JSON and parse.
    
    try:
        response = completion(
            model=model_name,
            messages=messages,
            response_format=response_model # Passing the class directly is supported in newer LiteLLM versions
        )
        
        # Depending on LiteLLM version/provider, this returns a parsed object or string.
        # If it returns a Model logic directly:
        # result = response.choices[0].message.content
        
        # If LiteLLM handles the parsing internally with `response_format=Model`:
        # The returned text might still be a JSON string we need to parse.
        # However, `completion` with `response_format=BaseModel` usually returns an object that can be 
        # parsed. Since we are mocking/implementing for general use:
        
        raw_content = response.choices[0].message.content
        
        # Parse JSON strict
        parsed_obj = response_model.model_validate_json(raw_content)
        return parsed_obj

    except Exception as e:
        # Fallback or Error handling
        # In production, we might retry or refine the prompt.
        print(f"LLM Call Failed: {e}")
        raise e

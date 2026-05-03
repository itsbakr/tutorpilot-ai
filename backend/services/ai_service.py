"""
Centralized AI Service
Handles all AI model interactions with Weave tracing
"""

import os
import httpx
import asyncio
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
import weave
import google.generativeai as genai

# weave.init() is called in main.py

@weave.op()
async def call_gemini(
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2000
) -> str:
    """
    Call Google's Gemini 3.0 Flash model via official SDK
    
    Args:
        prompt: The prompt to send
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
        
    Returns:
        Generated text response
    """
    api_key = os.getenv("GOOGLE_LEARNLM_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_GEMINI_API_KEY not set in environment")
    
    # Configure Google AI with the API key
    genai.configure(api_key=api_key)
    
    # Use Gemini 3.0 Flash as requested
    model = genai.GenerativeModel("gemini-3-flash-preview")
    
    # Configure generation
    generation_config = genai.GenerationConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        top_p=0.95,
        top_k=40
    )
    
    # Retry logic with exponential backoff for various API errors
    max_retries = 5
    base_delay = 3  # seconds
    
    for attempt in range(max_retries):
        try:
            # Generate content (run sync function in thread pool for async compatibility)
            response = await asyncio.to_thread(
                model.generate_content,
                prompt,
                generation_config=generation_config
            )
            
            if response and response.text:
                return response.text
            else:
                raise Exception("No text in Gemini response")
                
        except Exception as e:
            error_str = str(e).lower()
            is_last_attempt = attempt == max_retries - 1
            
            if "401" in str(e) or "unauthorized" in error_str:
                print(f"⚠️ Perplexity Authentication Error: Check your PERPLEXITY_API_KEY. Skipping retry.")
                raise Exception(f"Perplexity Sonar API error: Unauthorized. Check API Key.")
                
            # Determine if this is a retryable error
            is_retryable = (
                "429" in str(e) or  # Rate limit
                "503" in str(e) or  # Service unavailable
                "500" in str(e) or  # Internal server error
                "quota" in error_str or
                "service unavailable" in error_str or
                "deadline exceeded" in error_str or
                "timeout" in error_str
            )
            
            # Special handling for 404 (model not found) - don't retry
            if "404" in str(e) or "not found" in error_str:
                raise Exception(f"Gemini model not found. Please check the model name 'gemini-3-flash-preview' is correct.")
            
            if is_retryable and not is_last_attempt:
                # Exponential backoff: 3s, 6s, 12s, 24s, 48s
                delay = base_delay * (2 ** attempt)
                error_type = "rate limit" if "429" in str(e) else "service error"
                print(f"⏳ API {error_type}, retrying in {delay}s... (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(delay)
                continue
            elif is_retryable and is_last_attempt:
                raise Exception(f"Gemini API failed after {max_retries} retries. Last error: {str(e)[:200]}")
            else:
                # Non-retryable error, raise immediately
                raise Exception(f"Gemini API error: {str(e)[:200]}")


@weave.op()
async def call_gemini_multimodal(
    prompt: str,
    audio_bytes: Optional[bytes] = None,
    audio_mime_type: str = "audio/mp4",
    file_uri: Optional[str] = None,
    temperature: float = 0.4,
    max_tokens: int = 8000,
) -> str:
    """
    Call Gemini 3.0 Flash with audio (or video) input.

    Two paths:
    - Pass `audio_bytes` for files <20MB (sent as inline_data)
    - Pass `file_uri` for files already uploaded via the Files API (large files)

    Returns the raw text response. Caller is responsible for parsing JSON.
    """
    api_key = os.getenv("GOOGLE_LEARNLM_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_GEMINI_API_KEY not set in environment")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-3-flash-preview")

    generation_config = genai.GenerationConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        top_p=0.95,
        top_k=40,
    )

    # Build the multimodal content parts
    if file_uri:
        # Already-uploaded Files API reference
        media_part = {"file_data": {"mime_type": audio_mime_type, "file_uri": file_uri}}
    elif audio_bytes is not None:
        media_part = {"inline_data": {"mime_type": audio_mime_type, "data": audio_bytes}}
    else:
        raise ValueError("call_gemini_multimodal requires either audio_bytes or file_uri")

    contents = [{"parts": [{"text": prompt}, media_part]}]

    max_retries = 5
    base_delay = 3

    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(
                model.generate_content,
                contents,
                generation_config=generation_config,
            )

            if response and getattr(response, "text", None):
                return response.text
            raise Exception("No text in Gemini multimodal response")

        except Exception as e:
            error_str = str(e).lower()
            is_last = attempt == max_retries - 1

            if "404" in str(e) or "not found" in error_str:
                raise Exception("Gemini model not found for multimodal call")

            is_retryable = (
                "429" in str(e)
                or "503" in str(e)
                or "500" in str(e)
                or "quota" in error_str
                or "service unavailable" in error_str
                or "deadline exceeded" in error_str
                or "timeout" in error_str
            )

            if is_retryable and not is_last:
                delay = base_delay * (2 ** attempt)
                print(f"⏳ Gemini multimodal retryable error, retrying in {delay}s... ({attempt + 1}/{max_retries})")
                await asyncio.sleep(delay)
                continue
            raise Exception(f"Gemini multimodal API error: {str(e)[:200]}")


async def upload_gemini_file(file_bytes: bytes, mime_type: str, display_name: str = "session_media") -> str:
    """Upload a media file via the Gemini Files API and return its file URI.

    Use for media >20MB. The returned URI can be passed to call_gemini_multimodal as file_uri.
    """
    api_key = os.getenv("GOOGLE_LEARNLM_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_GEMINI_API_KEY not set in environment")
    genai.configure(api_key=api_key)

    import tempfile, os as _os
    suffix = "." + (mime_type.split("/")[-1] if "/" in mime_type else "bin")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(file_bytes)
        tmp.flush()
        tmp.close()
        uploaded = await asyncio.to_thread(
            genai.upload_file, tmp.name, mime_type=mime_type, display_name=display_name
        )
        return uploaded.uri
    finally:
        try:
            _os.unlink(tmp.name)
        except Exception:
            pass


@weave.op()
async def call_perplexity(
    prompt: str,
    temperature: float = 0.1,
    max_tokens: int = 2500
) -> Dict[str, Any]:
    """
    Call Perplexity Sonar API for knowledge retrieval
    
    Args:
        prompt: Search/question prompt
        temperature: Sampling temperature
        max_tokens: Maximum tokens
        
    Returns:
        Dict with 'content' (str) and 'sources' (list)
    """
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY not set in environment")
    
    url = "https://api.perplexity.ai/chat/completions"
    
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "sonar",  # or "sonar-pro"
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "return_citations": True,  # Request citations/sources
        "return_related_questions": False
    }
    
    try:
        # Retry logic with exponential backoff
        max_retries = 3
        base_delay = 2
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, headers=headers, json=payload, timeout=120)
                    response.raise_for_status()
                    
                    data = response.json()
                    
                    if "choices" in data and data["choices"]:
                        choice = data["choices"][0]
                        content = choice["message"]["content"]
                        
                        # Extract sources/citations
                        sources = []
                        if "citations" in data:
                            # Format: citations is a list of URLs
                            for i, citation_url in enumerate(data.get("citations", [])):
                                sources.append({
                                    "title": f"Source {i+1}",
                                    "url": citation_url,
                                    "snippet": ""
                                })
                        
                        return {
                            "content": content,
                            "sources": sources
                        }
                    else:
                        raise Exception(f"No choices in Perplexity response: {data}")
                        
            except httpx.HTTPStatusError as e:
                # Handle specific HTTP errors
                status_code = e.response.status_code
                if status_code == 401:
                    print("⚠️ Perplexity API Error: 401 Unauthorized. Please check your PERPLEXITY_API_KEY.")
                    # Don't retry auth errors, return empty results
                    return {"content": "Information could not be retrieved due to API authentication error.", "sources": []}
                elif status_code == 402:
                    print("⚠️ Perplexity API Error: 402 Payment Required. Check your account balance.")
                    return {"content": "Information could not be retrieved due to API payment error.", "sources": []}
                
                # If not the last attempt, maybe retry
                if attempt < max_retries - 1 and status_code in [429, 500, 502, 503, 504]:
                    delay = base_delay * (2 ** attempt)
                    print(f"   ⏳ Perplexity API error ({status_code}), retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise e
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    print(f"   ⏳ Perplexity connection error, retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise e
                    
    except Exception as e:
        print(f"⚠️ Perplexity Sonar API error: {str(e)}")
        # Return fallback content instead of failing completely
        return {
            "content": f"Unable to fetch information using Perplexity at this time. Please proceed with general knowledge.",
            "sources": []
        }


@weave.op()
async def call_gemini_coder(
    prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 9000
) -> str:
    """
    Call Gemini 3.0 Flash for code generation
    
    Args:
        prompt: Code generation prompt
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
        
    Returns:
        Generated code
    """
    import asyncio
    
    # Use Gemini 3.0 Flash for code generation instead of Qwen
    print("   🔄 Calling Gemini 3 Flash for code generation...")
    
    try:
        gemini_response = await call_gemini(
            prompt + "\n\nIMPORTANT: Return ONLY the complete React component code. Use semicolons after every statement!",
            temperature=temperature,
            max_tokens=max_tokens
        )
        print("   ✅ Gemini code generation succeeded")
        return gemini_response
        
    except Exception as e:
        error_msg = f"Gemini code generation failed: {str(e)}"
        print(f"   ❌ {error_msg}")
        raise Exception(error_msg)


def extract_code_block(response: str, language: str = "jsx") -> str:
    """
    Extract code from markdown code blocks
    
    Args:
        response: LLM response that may contain code blocks
        language: Expected language (jsx, python, javascript)
        
    Returns:
        Extracted code without markdown formatting
    """
    import re
    
    # Try to find code block with language specifier
    pattern = f"```{language}\\n(.*?)```"
    match = re.search(pattern, response, re.DOTALL)
    
    if match:
        return match.group(1).strip()
    
    # Try generic code block
    pattern = "```\\n(.*?)```"
    match = re.search(pattern, response, re.DOTALL)
    
    if match:
        return match.group(1).strip()
    
    # If no code block found, return as-is
    return response.strip()


def has_errors(logs: str) -> bool:
    """
    Check if sandbox logs contain error indicators
    
    Args:
        logs: Sandbox log output
        
    Returns:
        True if errors detected, False otherwise
    """
    if not logs:
        return False
    
    error_keywords = [
        "Error",
        "error:",
        "Exception",
        "Failed",
        "ENOENT",
        "Cannot find",
        "Unexpected",
        "SyntaxError",
        "TypeError",
        "ReferenceError",
        "undefined",
        "Failed to compile",
        "Module not found",
        "Uncaught",
        "Missing semicolon",
        "plugin:vite:react-babel",
        "@babel/parser"
    ]
    
    logs_lower = logs.lower()
    
    for keyword in error_keywords:
        if keyword.lower() in logs_lower:
            return True
    
    return False

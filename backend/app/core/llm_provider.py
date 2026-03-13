"""
Unified LLM provider module.
Supports OpenAI, Google Gemini, Anthropic Claude, xAI Grok, and Groq (Llama/free tier).
API keys are passed per-request (never stored server-side).
"""

import json
import re
import time
from dataclasses import dataclass
from typing import Optional


class LLMError(Exception):
    """Raised when an LLM call fails."""
    pass


@dataclass
class LLMConfig:
    provider: str   # "openai" | "gemini" | "anthropic" | "grok" | "groq"
    api_key: str
    model: str


def _clean_json_response(raw: str) -> str:
    """Strip markdown code fences and fix common LLM JSON formatting issues."""
    raw = raw.strip()
    # Remove ```json ... ``` or ``` ... ```
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    raw = raw.strip()

    # Fix literal newlines inside JSON string values.
    # Some LLMs put actual \n characters inside "..." which makes JSON invalid.
    # Strategy: replace newlines that appear inside a JSON string value with \\n.
    def _escape_newlines_in_strings(s: str) -> str:
        result = []
        in_string = False
        i = 0
        while i < len(s):
            ch = s[i]
            if ch == '\\' and in_string:
                # Keep escape sequence as-is
                result.append(ch)
                i += 1
                if i < len(s):
                    result.append(s[i])
                    i += 1
                continue
            if ch == '"':
                in_string = not in_string
                result.append(ch)
            elif ch in ('\n', '\r') and in_string:
                result.append('\\n')
            else:
                result.append(ch)
            i += 1
        return ''.join(result)

    try:
        import json as _json
        _json.loads(raw)  # Already valid — skip fixup
    except Exception:
        raw = _escape_newlines_in_strings(raw)

    return raw


def _is_rate_limit_error(e: Exception) -> bool:
    """Detect 429 / rate-limit errors across all providers."""
    err_str = str(e)
    type_name = type(e).__name__
    return (
        "429" in err_str
        or "RESOURCE_EXHAUSTED" in err_str
        or "rate_limit" in err_str.lower()
        or "rate limit" in err_str.lower()
        or "RateLimitError" in type_name
        or "quota" in err_str.lower()
        or "too many requests" in err_str.lower()
    )


def _call_with_retry(fn, max_retries: int = 3):
    """
    Call fn() and retry up to max_retries times on rate-limit (429) errors.
    Delays: 5s → 10s → 20s (exponential backoff).
    Raises the original exception for non-rate-limit errors immediately.
    After exhausting retries on 429, raises a clear human-readable error.
    """
    delays = [5, 10, 20]
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as e:
            if _is_rate_limit_error(e):
                if attempt < max_retries:
                    wait = delays[attempt]
                    time.sleep(wait)
                    continue
                # Exhausted all retries — surface a friendly message
                raise Exception(
                    f"Rate limit hit (429). Retried {max_retries}× (waited {sum(delays[:max_retries])}s). "
                    f"Wait ~1 minute then run again. "
                    f"Tip: switch to gemini-2.0-flash-lite in Settings for a higher free quota."
                ) from e
            raise  # Non-rate-limit error — propagate immediately


def _call_openai(config: LLMConfig, system_prompt: str, user_prompt: str) -> str:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=config.api_key)

        def _do():
            response = client.chat.completions.create(
                model=config.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=4096,
                temperature=0.7,
            )
            return response.choices[0].message.content or ""

        return _call_with_retry(_do)
    except Exception as e:
        raise LLMError(f"OpenAI error: {e}") from e


def _call_gemini(config: LLMConfig, system_prompt: str, user_prompt: str) -> str:
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=config.api_key)

        def _do():
            response = client.models.generate_content(
                model=config.model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=4096,
                    temperature=0.7,
                ),
            )
            return response.text or ""

        return _call_with_retry(_do)
    except Exception as e:
        raise LLMError(f"Gemini error: {e}") from e


def _call_anthropic(config: LLMConfig, system_prompt: str, user_prompt: str) -> str:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=config.api_key)

        def _do():
            response = client.messages.create(
                model=config.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            return response.content[0].text or ""

        return _call_with_retry(_do)
    except Exception as e:
        raise LLMError(f"Anthropic error: {e}") from e


def _call_grok(config: LLMConfig, system_prompt: str, user_prompt: str) -> str:
    try:
        from openai import OpenAI
        # Grok uses OpenAI-compatible API
        client = OpenAI(api_key=config.api_key, base_url="https://api.xai.com/v1")

        def _do():
            response = client.chat.completions.create(
                model=config.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=4096,
                temperature=0.7,
            )
            return response.choices[0].message.content or ""

        return _call_with_retry(_do)
    except Exception as e:
        raise LLMError(f"Grok error: {e}") from e


def _call_groq(config: LLMConfig, system_prompt: str, user_prompt: str) -> str:
    try:
        from openai import OpenAI
        # Groq uses an OpenAI-compatible API — free tier with Llama models
        client = OpenAI(api_key=config.api_key, base_url="https://api.groq.com/openai/v1")

        def _do():
            response = client.chat.completions.create(
                model=config.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=4096,
                temperature=0.7,
            )
            return response.choices[0].message.content or ""

        return _call_with_retry(_do)
    except Exception as e:
        raise LLMError(f"Groq error: {e}") from e


def call_llm(config: LLMConfig, system_prompt: str, user_prompt: str) -> str:
    """
    Route to the correct LLM provider based on config.provider.
    Returns raw response text (may need JSON parsing by caller).
    Raises LLMError on failure.
    """
    provider = config.provider.lower()
    if provider == "openai":
        return _call_openai(config, system_prompt, user_prompt)
    elif provider == "gemini":
        return _call_gemini(config, system_prompt, user_prompt)
    elif provider == "anthropic":
        return _call_anthropic(config, system_prompt, user_prompt)
    elif provider == "grok":
        return _call_grok(config, system_prompt, user_prompt)
    elif provider == "groq":
        return _call_groq(config, system_prompt, user_prompt)
    else:
        raise LLMError(f"Unknown provider: {config.provider}. Use 'openai', 'gemini', 'anthropic', 'grok', or 'groq'.")


def generate_image_openai(api_key: str, prompt: str, size: str = "1024x1024") -> str:
    """
    Generate an image with DALL-E 3. Returns the temporary image URL.
    Only works when the LLM provider is OpenAI.
    Raises LLMError on failure.
    """
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            quality="standard",
            n=1,
        )
        return response.data[0].url
    except Exception as e:
        raise LLMError(f"DALL-E image generation error: {e}") from e


def generate_image_gemini(api_key: str, prompt: str) -> str:
    """
    Generate an image with Gemini (gemini-2.0-flash-exp-image-generation).
    Returns a data URI string: "data:image/png;base64,<b64data>"
    Raises LLMError on failure.
    """
    try:
        import base64
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp-image-generation",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["image", "text"],
            ),
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                mime_type = part.inline_data.mime_type or "image/png"
                b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                return f"data:{mime_type};base64,{b64}"
        raise LLMError("Gemini image generation returned no image data.")
    except LLMError:
        raise
    except Exception as e:
        raise LLMError(f"Gemini image generation error: {e}") from e


def generate_image(config: LLMConfig, prompt: str) -> str:
    """
    Generate an image using the configured LLM provider.
    - OpenAI → DALL-E 3, returns a temporary URL
    - Gemini → gemini-2.0-flash-exp-image-generation, returns a data URI
    Raises LLMError if provider does not support image generation or on failure.
    """
    provider = config.provider.lower()
    if provider == "openai":
        return generate_image_openai(config.api_key, prompt)
    elif provider == "gemini":
        return generate_image_gemini(config.api_key, prompt)
    else:
        raise LLMError(
            f"Image generation is not supported for provider '{config.provider}'. "
            "Use 'openai' (DALL-E 3) or 'gemini' (Gemini Flash image generation)."
        )


def call_llm_json(config: LLMConfig, system_prompt: str, user_prompt: str) -> dict:
    """
    Like call_llm() but automatically parses the response as JSON.
    Strips markdown fences before parsing.
    Raises LLMError if response cannot be parsed as JSON.
    """
    raw = call_llm(config, system_prompt, user_prompt)
    cleaned = _clean_json_response(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise LLMError(
            "LLM returned a non-JSON response. Try again or switch to a different model in Settings."
        )

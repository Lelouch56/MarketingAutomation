"""
Unified LLM provider module.
Supports OpenAI, Google Gemini, and Anthropic Claude.
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
    provider: str   # "openai" | "gemini" | "anthropic" | "grok"
    api_key: str
    model: str


def _clean_json_response(raw: str) -> str:
    """Strip markdown code fences that some LLMs add around JSON responses."""
    raw = raw.strip()
    # Remove ```json ... ``` or ``` ... ```
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    return raw.strip()


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
    else:
        raise LLMError(f"Unknown provider: {config.provider}. Use 'openai', 'gemini', 'anthropic', or 'grok'.")


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
    except json.JSONDecodeError as e:
        raise LLMError(f"LLM returned invalid JSON: {e}\nRaw response: {raw[:500]}") from e

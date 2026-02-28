"""
Pydantic v2 request/response models for the Marketing Automation AI API.
"""

import re
from pydantic import BaseModel, field_validator
from typing import Optional, List, Any

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


# ─────────────────────────────────────────────────────────────
# LLM Configuration
# ─────────────────────────────────────────────────────────────

class LLMConfigModel(BaseModel):
    provider: str       # "openai" | "gemini" | "anthropic" | "grok"
    api_key: str
    model: str


class WordPressConfigModel(BaseModel):
    site_url: str
    username: str
    app_password: str
    publish_status: str = "draft"  # "draft" or "publish"


class LinkedInConfigModel(BaseModel):
    access_token: str
    author_urn: str     # "urn:li:person:xxx" or "urn:li:organization:xxx"


class KlentyConfigModel(BaseModel):
    api_key: str
    user_email: str          # Klenty account email used as API identifier
    campaign_a_name: str = "Campaign A"   # Fit clients (score > 70)
    campaign_b_name: str = "Campaign B"   # Warm leads
    campaign_c_name: str = "Campaign C"   # Cold leads


class OutplayConfigModel(BaseModel):
    api_key: str
    sequence_name_a: str = "Travel Fit Sequence"    # Fit clients (score > 70)
    sequence_name_b: str = "Warm Lead Sequence"     # Warm leads
    sequence_name_c: str = "Cold Lead Sequence"     # Cold leads


class RunAgentRequest(BaseModel):
    llm_config: LLMConfigModel
    wordpress: Optional[WordPressConfigModel] = None
    linkedin: Optional[LinkedInConfigModel] = None
    klenty: Optional[KlentyConfigModel] = None
    outplay: Optional[OutplayConfigModel] = None


# ─────────────────────────────────────────────────────────────
# Agent Run State
# ─────────────────────────────────────────────────────────────

class StepStatus(BaseModel):
    step_number: int
    name: str
    status: str                  # "pending" | "running" | "completed" | "failed" | "skipped"
    message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class AgentRunStatus(BaseModel):
    agent_id: str
    run_id: str
    status: str                  # "idle" | "running" | "completed" | "failed"
    steps: List[StepStatus] = []
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    result: Optional[Any] = None


# ─────────────────────────────────────────────────────────────
# Topic Models
# ─────────────────────────────────────────────────────────────

class TopicCreate(BaseModel):
    topic: str
    status: str = "Pending"

    @field_validator('topic')
    @classmethod
    def validate_topic(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Topic text cannot be empty')
        if len(v) > 2000:
            raise ValueError('Topic text must be 2000 characters or fewer')
        return v


# ─────────────────────────────────────────────────────────────
# Lead Models
# ─────────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    email: str
    website: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError('Email cannot be empty')
        if len(v) > 254:
            raise ValueError('Email address is too long (max 254 chars)')
        if not _EMAIL_RE.match(v):
            raise ValueError('Invalid email address format')
        return v

    @field_validator('website')
    @classmethod
    def validate_website(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if not re.match(r'^https?://', v):
            raise ValueError('Website URL must start with http:// or https://')
        if len(v) > 2048:
            raise ValueError('Website URL is too long (max 2048 chars)')
        return v

    @field_validator('company')
    @classmethod
    def validate_company(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) > 255:
            raise ValueError('Company name must be 255 characters or fewer')
        return v


# ─────────────────────────────────────────────────────────────
# Log Entry
# ─────────────────────────────────────────────────────────────

class LogEntry(BaseModel):
    id: str
    timestamp: str
    agent_id: Optional[str] = None
    level: str                   # "info" | "warning" | "error"
    message: str
    metadata: Optional[dict] = None

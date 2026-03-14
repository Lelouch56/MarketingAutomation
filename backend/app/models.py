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


class LinkedInImageTestModel(BaseModel):
    access_token: str
    author_urn: str
    image_url: str          # publicly accessible image URL (JPEG/PNG)
    post_text: Optional[str] = None  # custom caption; defaults to a test message


class KlentyConfigModel(BaseModel):
    api_key: str
    user_email: str          # Klenty account email used as API identifier
    campaign_a_name: str = "Campaign A"   # Qualified leads (score > 70)
    campaign_b_name: str = "Campaign B"   # Personal leads (Gmail/Yahoo/etc.)
    campaign_c_name: str = "Campaign C"   # Optional — Nurture leads


class OutplayConfigModel(BaseModel):
    client_secret: str                              # X-CLIENT-SECRET header
    client_id: str = ""                             # ?client_id= query param
    user_id: str = ""                               # Outplay user ID (required for sequence enrollment)
    location: str = "us4"                           # Regional server, e.g. "us4"
    sequence_id_a: str = ""                         # Qualified Lead Marktech — Agent 2 (score > 70)
    sequence_id_b: str = ""                         # Personal Lead Marktech  — Agent 2 (Gmail/Yahoo/etc.)
    sequence_id_c: str = ""                         # Travel Tech Outreach    — Agent 3 (Matters broad)


class ApolloConfigModel(BaseModel):
    api_key: str
    per_page: int = 10
    sequence_id_ota: str = ""      # Apollo ICP1 sequence — OTA / Travel Tech / TMC companies
    sequence_id_hotels: str = ""   # Apollo ICP2 sequence — Bedbank / Hotel Wholesaler / Hotel Distribution
    email_account_id: str = ""     # Apollo mailbox ID used to send sequence emails


class SalesNavigatorConfigModel(BaseModel):
    access_token: str
    count: int = 10


class HubSpotConfigModel(BaseModel):
    access_token: str
    max_contacts: int = 100
    list_id: str = ""       # Number from objectLists/N in HubSpot URL (e.g. 9)


class PhantomBusterConfigModel(BaseModel):
    api_key: str
    search_phantom_id: str              # "LinkedIn Search Export" phantom Agent ID
    connection_phantom_id: str          # "LinkedIn Connection Sender" phantom Agent ID
    session_cookie: str                 # LinkedIn li_at cookie (demo/local use only)
    connections_per_launch: int = 10    # Cap per run to stay within LinkedIn daily limits


class ImageGenConfigModel(BaseModel):
    provider: str       # "openai" | "gemini"
    api_key: str
    model: str          # "dall-e-3" | "gemini-2.0-flash-exp-image-generation" | "imagen-3.0-generate-002"
    enabled: bool = True


class RunAgentRequest(BaseModel):
    llm_config: LLMConfigModel
    image_gen_config: Optional[ImageGenConfigModel] = None
    wordpress: Optional[WordPressConfigModel] = None
    linkedin: Optional[LinkedInConfigModel] = None
    klenty: Optional[KlentyConfigModel] = None
    outplay: Optional[OutplayConfigModel] = None
    apollo: Optional[ApolloConfigModel] = None
    sales_navigator: Optional[SalesNavigatorConfigModel] = None
    hubspot: Optional[HubSpotConfigModel] = None
    phantombuster: Optional[PhantomBusterConfigModel] = None


class ApproveTargetRequest(BaseModel):
    """Request body for the approve-prospect endpoint.
    Includes optional Outplay config so the prospect can be enrolled immediately
    on approval rather than waiting for the next full agent run.
    """
    outplay: Optional[OutplayConfigModel] = None


# ─────────────────────────────────────────────────────────────
# Agent Run State
# ─────────────────────────────────────────────────────────────

class StepStatus(BaseModel):
    step_number: int
    name: str
    status: str                  # "pending" | "running" | "completed" | "failed" | "skipped" | "warning"
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

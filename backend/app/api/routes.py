"""
All API routes for the Marketing Automation AI platform.
"""

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File

from app.models import (
    RunAgentRequest, AgentRunStatus, TopicCreate, LeadCreate, LLMConfigModel,
    WordPressConfigModel, LinkedInConfigModel, KlentyConfigModel, OutplayConfigModel,
)
from app.core.llm_provider import LLMConfig
from app.core.integrations import (
    WordPressConfig, LinkedInConfig, KlentyConfig, OutplayConfig,
    test_wordpress_connection, test_linkedin_connection, test_klenty_connection, test_outplay_connection,
    publish_to_wordpress, post_to_linkedin,
)
from app.storage.json_db import JsonDB
from app.agents.agent1.service import (
    run_agent1_background, get_agent1_status
)
from app.agents.agent2.service import (
    run_agent2_background, get_agent2_status
)
from app.agents.agent3.service import (
    run_agent3_background, get_agent3_status,
    get_outreach_targets, approve_outreach_target,
)
from app.agents.agent4.service import (
    run_agent4_background, get_agent4_status,
    get_reports,
)

router = APIRouter()

# ─────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────

topics_db = JsonDB("app/data/topics.json")
blogs_db = JsonDB("app/data/blogs.json")
leads_db = JsonDB("app/data/leads.json")

# ─────────────────────────────────────────────────────────────
# In-memory log store (last 50 entries)
# ─────────────────────────────────────────────────────────────

_logs: list = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_log(level: str, message: str, agent_id: Optional[str] = None, metadata: dict = None):
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": _now(),
        "level": level,
        "message": message,
        "agent_id": agent_id,
        "metadata": metadata or {},
    }
    _logs.append(entry)
    if len(_logs) > 50:
        _logs.pop(0)


def _model_to_config(model: LLMConfigModel) -> LLMConfig:
    return LLMConfig(
        provider=model.provider,
        api_key=model.api_key,
        model=model.model,
    )


def _build_klenty_config(request: RunAgentRequest) -> Optional[KlentyConfig]:
    """Extract Klenty config from request if provided."""
    if not request.klenty:
        return None
    return KlentyConfig(
        api_key=request.klenty.api_key,
        user_email=request.klenty.user_email,
        campaign_a_name=request.klenty.campaign_a_name,
        campaign_b_name=request.klenty.campaign_b_name,
        campaign_c_name=request.klenty.campaign_c_name,
    )


def _build_outplay_config(request: RunAgentRequest) -> Optional[OutplayConfig]:
    """Extract Outplay config from request if provided."""
    if not request.outplay:
        return None
    return OutplayConfig(
        api_key=request.outplay.api_key,
        sequence_name_a=request.outplay.sequence_name_a,
        sequence_name_b=request.outplay.sequence_name_b,
        sequence_name_c=request.outplay.sequence_name_c,
    )


# ─────────────────────────────────────────────────────────────
# AGENT 1 ROUTES
# ─────────────────────────────────────────────────────────────

@router.post("/agents/agent1/run")
def run_agent1(request: RunAgentRequest, background_tasks: BackgroundTasks):
    status = get_agent1_status()
    if status.status == "running":
        raise HTTPException(status_code=409, detail="Agent 1 is already running.")

    config = _model_to_config(request.llm_config)

    # Build optional integration configs
    wp_config = None
    if request.wordpress:
        wp_config = WordPressConfig(
            site_url=request.wordpress.site_url,
            username=request.wordpress.username,
            app_password=request.wordpress.app_password,
            publish_status=request.wordpress.publish_status,
        )

    li_config = None
    if request.linkedin:
        li_config = LinkedInConfig(
            access_token=request.linkedin.access_token,
            author_urn=request.linkedin.author_urn,
        )

    background_tasks.add_task(run_agent1_background, config, wp_config, li_config)
    _append_log("info", "Agent 1 started by user", agent_id="agent1",
                metadata={"provider": config.provider, "model": config.model})
    return {"status": "started", "message": "Agent 1 (Content Writer & SEO) has started."}


@router.get("/agents/agent1/status", response_model=AgentRunStatus)
def agent1_status():
    return get_agent1_status()


@router.get("/agents/agent1/topics")
def list_topics():
    return topics_db.read()


@router.post("/agents/agent1/topics", status_code=201)
def create_topic(topic: TopicCreate):
    record = {
        "id": str(uuid.uuid4()),
        "topic": topic.topic.strip(),
        "status": "Pending",
        "created_at": _now(),
    }
    topics_db.append(record)
    _append_log("info", f"New topic added: {topic.topic[:60]}", agent_id="agent1")
    return record


@router.post("/agents/agent1/topics/upload-csv", status_code=201)
async def upload_topics_csv(file: UploadFile = File(...)):
    """
    Upload a CSV file with topics.
    Accepts either:
      - A single-column CSV (one topic per row, optional 'topic' header)
      - A multi-column CSV with a 'topic' column
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    raw = await file.read()

    if len(raw) > 5 * 1024 * 1024:  # 5 MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum allowed size is 5 MB.")
    try:
        text = raw.decode("utf-8-sig")  # handles BOM from Excel
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    if len(rows) > 5001:  # allow up to 5000 data rows + 1 header
        raise HTTPException(status_code=400, detail="CSV file too large. Maximum 5000 rows allowed.")

    # Detect if first row is a header
    header = [col.strip().lower() for col in rows[0]]
    topic_col_idx = None
    start_row = 0

    if "topic" in header:
        topic_col_idx = header.index("topic")
        start_row = 1
    elif len(header) == 1 and header[0] and not header[0].replace(" ", "").isalpha():
        # Single column, first row looks like data (not a simple header word)
        topic_col_idx = 0
        start_row = 0
    else:
        # Assume first column, first row is header if it looks like a label
        topic_col_idx = 0
        first_val = header[0] if header else ""
        start_row = 1 if first_val in ("topic", "topics", "title", "subject", "keyword", "name") else 0

    added = []
    for row in rows[start_row:]:
        if not row or topic_col_idx >= len(row):
            continue
        topic_text = row[topic_col_idx].strip()
        if not topic_text:
            continue
        record = {
            "id": str(uuid.uuid4()),
            "topic": topic_text,
            "status": "Pending",
            "created_at": _now(),
        }
        topics_db.append(record)
        added.append(record)

    if not added:
        raise HTTPException(status_code=400, detail="No valid topics found in the CSV file.")

    _append_log("info", f"Bulk upload: {len(added)} topics added from CSV", agent_id="agent1")
    return {"added_count": len(added), "topics": added}


@router.get("/agents/agent1/blogs")
def list_blogs():
    return blogs_db.read()


# ─────────────────────────────────────────────────────────────
# AGENT 2 ROUTES
# ─────────────────────────────────────────────────────────────

@router.post("/agents/agent2/run")
def run_agent2(request: RunAgentRequest, background_tasks: BackgroundTasks):
    status = get_agent2_status()
    if status.status == "running":
        raise HTTPException(status_code=409, detail="Agent 2 is already running.")

    config = _model_to_config(request.llm_config)
    klenty_config = _build_klenty_config(request)
    outplay_config = _build_outplay_config(request)

    background_tasks.add_task(run_agent2_background, config, klenty_config, outplay_config)
    _append_log("info", "Agent 2 started by user", agent_id="agent2",
                metadata={
                    "provider": config.provider,
                    "model": config.model,
                    "klenty": klenty_config is not None,
                    "outplay": outplay_config is not None,
                })
    return {"status": "started", "message": "Agent 2 (Lead Qualification) has started."}


@router.get("/agents/agent2/status", response_model=AgentRunStatus)
def agent2_status():
    return get_agent2_status()


@router.get("/agents/agent2/leads")
def list_leads():
    return leads_db.read()


@router.post("/agents/agent2/leads", status_code=201)
def create_lead(lead: LeadCreate):
    record = {
        "id": str(uuid.uuid4()),
        "email": lead.email,      # already stripped/lowercased by validator
        "website": lead.website,  # already validated/stripped by validator
        "name": lead.name.strip() if lead.name else None,
        "company": lead.company,  # already stripped by validator
        "created_at": _now(),
    }
    leads_db.append(record)
    _append_log("info", f"New lead added: {lead.email}", agent_id="agent2")
    return record


# ─────────────────────────────────────────────────────────────
# AGENT 3 ROUTES
# ─────────────────────────────────────────────────────────────

@router.post("/agents/agent3/run")
def run_agent3(request: RunAgentRequest, background_tasks: BackgroundTasks):
    status = get_agent3_status()
    if status.status == "running":
        raise HTTPException(status_code=409, detail="Agent 3 is already running.")

    config = _model_to_config(request.llm_config)
    klenty_config = _build_klenty_config(request)
    outplay_config = _build_outplay_config(request)

    background_tasks.add_task(run_agent3_background, config, klenty_config, outplay_config)
    _append_log("info", "Agent 3 started by user", agent_id="agent3",
                metadata={
                    "provider": config.provider,
                    "model": config.model,
                    "klenty": klenty_config is not None,
                    "outplay": outplay_config is not None,
                })
    return {"status": "started", "message": "Agent 3 (LinkedIn Outbound Automation) has started."}


@router.get("/agents/agent3/status", response_model=AgentRunStatus)
def agent3_status():
    return get_agent3_status()


@router.get("/agents/agent3/outreach-targets")
def list_outreach_targets():
    """Return all outreach prospect targets."""
    return get_outreach_targets()


@router.post("/agents/agent3/outreach-targets/{target_id}/approve")
def approve_target(target_id: str):
    """Approve a prospect for Klenty outreach."""
    found = approve_outreach_target(target_id)
    if not found:
        raise HTTPException(status_code=404, detail=f"Outreach target '{target_id}' not found.")
    _append_log("info", f"Outreach target {target_id[:8]}... approved", agent_id="agent3")
    return {"status": "approved", "target_id": target_id}


# ─────────────────────────────────────────────────────────────
# AGENT 4 ROUTES
# ─────────────────────────────────────────────────────────────

@router.post("/agents/agent4/run")
def run_agent4(request: RunAgentRequest, background_tasks: BackgroundTasks):
    status = get_agent4_status()
    if status.status == "running":
        raise HTTPException(status_code=409, detail="Agent 4 is already running.")

    config = _model_to_config(request.llm_config)

    background_tasks.add_task(run_agent4_background, config)
    _append_log("info", "Agent 4 started by user", agent_id="agent4",
                metadata={"provider": config.provider, "model": config.model})
    return {"status": "started", "message": "Agent 4 (Analytics & Reports) has started."}


@router.get("/agents/agent4/status", response_model=AgentRunStatus)
def agent4_status():
    return get_agent4_status()


@router.get("/agents/agent4/reports")
def list_reports():
    """Return all generated performance reports."""
    return get_reports()


# ─────────────────────────────────────────────────────────────
# GLOBAL ROUTES
# ─────────────────────────────────────────────────────────────

@router.get("/agents")
def list_agents():
    """Return metadata for all 4 agents with current status."""
    a1 = get_agent1_status()
    a2 = get_agent2_status()
    a3 = get_agent3_status()
    a4 = get_agent4_status()

    return [
        {
            "id": "agent1",
            "name": "Content Writer & SEO",
            "description": "AI-powered blog generation, SEO optimization, internal linking, quality check, and LinkedIn post creation.",
            "type": "Content Automation",
            "schedule": "Daily",
            "status": a1.status,
            "steps_count": 7,
            "last_run": a1.completed_at,
            "implemented": True,
        },
        {
            "id": "agent2",
            "name": "Lead Qualification",
            "description": "Deduplicates leads, scrapes company websites, AI-scores for travel industry fit, and auto-enrolls into Klenty campaigns.",
            "type": "Lead Automation",
            "schedule": "Hourly",
            "status": a2.status,
            "steps_count": 7,
            "last_run": a2.completed_at,
            "implemented": True,
        },
        {
            "id": "agent3",
            "name": "LinkedIn Outbound",
            "description": "AI-generates B2B prospect profiles, filters decision-makers, and auto-enrolls approved targets into Klenty email sequences.",
            "type": "Outreach Automation",
            "schedule": "6x Daily",
            "status": a3.status,
            "steps_count": 7,
            "last_run": a3.completed_at,
            "implemented": True,
        },
        {
            "id": "agent4",
            "name": "Analytics & Reports",
            "description": "Aggregates data from all agents, generates AI-powered performance insights, and creates executive reports with visualizations.",
            "type": "Reporting",
            "schedule": "Weekly",
            "status": a4.status,
            "steps_count": 6,
            "last_run": a4.completed_at,
            "implemented": True,
        },
    ]


@router.get("/logs")
def get_logs(level: Optional[str] = None, agent_id: Optional[str] = None):
    """Return in-memory logs, optionally filtered. Most recent first."""
    filtered = list(reversed(_logs))
    if level:
        filtered = [l for l in filtered if l.get("level") == level]
    if agent_id:
        filtered = [l for l in filtered if l.get("agent_id") == agent_id]
    return filtered


@router.post("/logs/clear")
def clear_logs():
    _logs.clear()
    return {"message": "Logs cleared"}


@router.get("/health")
def health():
    return {"status": "ok", "timestamp": _now()}


# ─────────────────────────────────────────────────────────────
# INTEGRATION TEST ROUTES
# ─────────────────────────────────────────────────────────────

@router.post("/integrations/test/wordpress")
def test_wordpress(config: WordPressConfigModel):
    """Test WordPress REST API connection."""
    wp_config = WordPressConfig(
        site_url=config.site_url,
        username=config.username,
        app_password=config.app_password,
    )
    return test_wordpress_connection(wp_config)


@router.post("/integrations/test-publish/wordpress")
def test_publish_wordpress(config: WordPressConfigModel):
    """Test publishing a dummy HTML post to WordPress."""
    wp_config = WordPressConfig(
        site_url=config.site_url,
        username=config.username,
        app_password=config.app_password,
        publish_status="publish"  # Force publish for testing
    )

    dummy_data = {
        "title": "Test Dummy Post from Marketing AI",
        "content_html": "<h1>This is a test post</h1><p>If you see this, the WordPress integration is working correctly! You can safely delete this post.</p>",
        "slug": "test-dummy-post"
    }

    return publish_to_wordpress(wp_config, dummy_data)


@router.post("/integrations/test/linkedin")
def test_linkedin(config: LinkedInConfigModel):
    """Test LinkedIn API connection."""
    li_config = LinkedInConfig(
        access_token=config.access_token,
        author_urn=config.author_urn,
    )
    return test_linkedin_connection(li_config)


@router.post("/integrations/test-publish/linkedin")
def test_publish_linkedin(config: LinkedInConfigModel):
    """Test publishing a dummy text post to LinkedIn."""
    li_config = LinkedInConfig(
        access_token=config.access_token,
        author_urn=config.author_urn,
    )

    post_text = "This is a test post from Marketing AI! If you see this, the LinkedIn integration is working correctly. You can safely delete this post."

    return post_to_linkedin(li_config, post_text)


@router.post("/integrations/test/klenty")
def test_klenty(config: KlentyConfigModel):
    """Test Klenty API connection."""
    klenty_config = KlentyConfig(
        api_key=config.api_key,
        user_email=config.user_email,
        campaign_a_name=config.campaign_a_name,
        campaign_b_name=config.campaign_b_name,
        campaign_c_name=config.campaign_c_name,
    )
    return test_klenty_connection(klenty_config)


@router.post("/integrations/test/outplay")
def test_outplay(config: OutplayConfigModel):
    """Test Outplay API connection."""
    outplay_config = OutplayConfig(
        api_key=config.api_key,
        sequence_name_a=config.sequence_name_a,
        sequence_name_b=config.sequence_name_b,
        sequence_name_c=config.sequence_name_c,
    )
    return test_outplay_connection(outplay_config)

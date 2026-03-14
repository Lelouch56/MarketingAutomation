"""
All API routes for the Marketing Automation AI platform.
"""

import csv
import io
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.responses import Response

from app.models import (
    RunAgentRequest, AgentRunStatus, TopicCreate, LeadCreate, LLMConfigModel,
    WordPressConfigModel, LinkedInConfigModel, LinkedInImageTestModel, KlentyConfigModel, OutplayConfigModel, ApolloConfigModel,
    SalesNavigatorConfigModel, HubSpotConfigModel, PhantomBusterConfigModel,
    ApproveTargetRequest,
)
from app.core.llm_provider import LLMConfig
from app.core.integrations import (
    WordPressConfig, LinkedInConfig, KlentyConfig, OutplayConfig, ApolloConfig, SalesNavigatorConfig, HubSpotConfig,
    PhantomBusterConfig, IntegrationError,
    add_prospect_to_outplay, enroll_in_hubspot_sequence,
    test_wordpress_connection, test_linkedin_connection, test_klenty_connection, test_outplay_connection,
    test_apollo_connection, test_sales_navigator_connection, test_hubspot_connection,
    test_phantombuster_connection,
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
    get_rejected_prospects, force_enroll_rejected_prospect,
    retry_enroll_outreach_target,
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
        client_secret=request.outplay.client_secret,
        client_id=request.outplay.client_id,
        user_id=request.outplay.user_id,
        location=request.outplay.location,
        sequence_id_a=request.outplay.sequence_id_a,   # Qualified Lead Marktech (Agent 2)
        sequence_id_b=request.outplay.sequence_id_b,   # Personal Lead Marktech  (Agent 2)
        sequence_id_c=request.outplay.sequence_id_c,   # Travel Tech Outreach    (Agent 3)
    )


def _build_apollo_config(request: RunAgentRequest) -> Optional[ApolloConfig]:
    """Extract Apollo config from request if provided."""
    if not request.apollo:
        return None
    return ApolloConfig(
        api_key=request.apollo.api_key,
        per_page=request.apollo.per_page,
        sequence_id_ota=request.apollo.sequence_id_ota,
        sequence_id_hotels=request.apollo.sequence_id_hotels,
        email_account_id=request.apollo.email_account_id,
    )


def _build_sales_navigator_config(request: RunAgentRequest) -> Optional[SalesNavigatorConfig]:
    """Extract Sales Navigator config from request if provided."""
    if not request.sales_navigator:
        return None
    return SalesNavigatorConfig(
        access_token=request.sales_navigator.access_token,
        count=request.sales_navigator.count,
    )


def _build_hubspot_config(request: RunAgentRequest) -> Optional[HubSpotConfig]:
    """Extract HubSpot config from request if provided."""
    if not request.hubspot:
        return None
    return HubSpotConfig(
        access_token=request.hubspot.access_token,
        max_contacts=request.hubspot.max_contacts,
        list_id=request.hubspot.list_id or "",
    )


def _build_phantombuster_config(request: RunAgentRequest) -> Optional[PhantomBusterConfig]:
    """Extract PhantomBuster config from request if provided."""
    if not request.phantombuster:
        return None
    return PhantomBusterConfig(
        api_key=request.phantombuster.api_key,
        search_phantom_id=request.phantombuster.search_phantom_id,
        connection_phantom_id=request.phantombuster.connection_phantom_id,
        session_cookie=request.phantombuster.session_cookie,
        connections_per_launch=request.phantombuster.connections_per_launch,
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

    # Build separate image generation config if provided and enabled
    image_gen_config = None
    if request.image_gen_config and request.image_gen_config.enabled:
        image_gen_config = LLMConfig(
            provider=request.image_gen_config.provider,
            api_key=request.image_gen_config.api_key,
            model=request.image_gen_config.model,
        )

    li_config = None
    if request.linkedin:
        li_config = LinkedInConfig(
            access_token=request.linkedin.access_token,
            author_urn=request.linkedin.author_urn,
        )

    background_tasks.add_task(run_agent1_background, config, li_config, image_gen_config)
    _append_log("info", "Agent 1 started by user", agent_id="agent1",
                metadata={
                    "provider": config.provider, "model": config.model,
                    "image_gen_provider": image_gen_config.provider if image_gen_config else None,
                })
    return {"status": "started", "message": "Agent 1 (Hangout Social) has started."}


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


@router.get("/agents/agent1/blogs/{blog_id}/download")
def download_blog(blog_id: str, format: str = "html"):
    """
    Download a blog's content.
    format=html  → full standalone HTML file (blog post)
    format=linkedin → LinkedIn post as plain text file
    """
    all_blogs = blogs_db.read()
    blog = next((b for b in all_blogs if b.get("id") == blog_id), None)
    if not blog:
        raise HTTPException(status_code=404, detail=f"Blog '{blog_id}' not found.")

    slug = blog.get("slug") or re.sub(r"[^a-z0-9]+", "-", blog.get("topic", "post").lower()).strip("-")

    if format == "linkedin":
        post_text = blog.get("linkedin_post", "")
        hashtags = blog.get("linkedin_hashtags", [])
        if hashtags:
            post_text += "\n\n" + " ".join(f"#{h.lstrip('#')}" for h in hashtags)
        if not post_text:
            raise HTTPException(status_code=404, detail="No LinkedIn post found for this blog.")
        content = post_text.encode("utf-8")
        return Response(
            content=content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="linkedin-{slug}.txt"'},
        )

    # Default: HTML
    title = blog.get("title", blog.get("topic", "Blog Post"))
    meta_desc = blog.get("meta_description", "")
    content_html = blog.get("content_html", "<p>No content available.</p>")
    quality_score = blog.get("quality_score", "")
    blog_url = blog.get("blog_url", "")
    created_at = blog.get("created_at", "")[:10] if blog.get("created_at") else ""

    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{meta_desc}">
  <title>{title}</title>
  <style>
    body {{ font-family: Georgia, 'Times New Roman', serif; max-width: 820px; margin: 0 auto; padding: 48px 24px; line-height: 1.75; color: #222; background: #fff; }}
    h1 {{ font-size: 2rem; line-height: 1.25; margin-bottom: 0.4rem; color: #111; }}
    h2 {{ font-size: 1.4rem; margin-top: 2rem; color: #111; }}
    h3 {{ font-size: 1.15rem; margin-top: 1.5rem; color: #222; }}
    .meta {{ color: #666; font-size: 0.875rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 1rem; margin-bottom: 2rem; }}
    .meta a {{ color: #0066cc; text-decoration: none; }}
    p {{ margin: 0.9rem 0; }}
    a {{ color: #0066cc; }}
    ul, ol {{ padding-left: 1.5rem; }}
    li {{ margin-bottom: 0.4rem; }}
    blockquote {{ border-left: 3px solid #ccc; margin: 1.5rem 0; padding: 0.5rem 1.25rem; color: #555; font-style: italic; }}
    .faq-section {{ background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 1.5rem; margin-top: 2rem; }}
    .cta-section {{ background: #f0f7ff; border: 1px solid #c3d9f0; border-radius: 6px; padding: 1.25rem 1.5rem; margin-top: 2rem; }}
  </style>
</head>
<body>
  <h1>{title}</h1>
  <div class="meta">
    <p>{meta_desc}</p>
    <p>
      {f'Quality Score: <strong>{quality_score}/100</strong> &nbsp;·&nbsp; ' if quality_score else ''}
      {f'<a href="{blog_url}" target="_blank">View published post</a> &nbsp;·&nbsp; ' if blog_url else ''}
      {f'Generated: {created_at}' if created_at else ''}
    </p>
  </div>
  {content_html}
</body>
</html>"""

    return Response(
        content=html_doc.encode("utf-8"),
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{slug}.html"'},
    )


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
    hubspot_config = _build_hubspot_config(request)

    background_tasks.add_task(run_agent2_background, config, klenty_config, outplay_config, hubspot_config)
    _append_log("info", "Agent 2 started by user", agent_id="agent2",
                metadata={
                    "provider": config.provider,
                    "model": config.model,
                    "klenty": klenty_config is not None,
                    "outplay": outplay_config is not None,
                    "hubspot": hubspot_config is not None,
                })
    return {"status": "started", "message": "Agent 2 (Matters) has started."}


@router.get("/agents/agent2/status", response_model=AgentRunStatus)
def agent2_status():
    return get_agent2_status()


@router.get("/agents/agent2/leads")
def list_leads():
    return leads_db.read()


@router.get("/agents/agent2/leads/download")
def download_leads(campaign: Optional[str] = None):
    """
    Download leads analysis as CSV.
    ?campaign=A|B|nurture|disqualified|all  (default: all)
      A           = Qualified Leads enrolled in Marktech Sequence A
      B           = Personal Leads enrolled in Marktech Sequence B
      nurture     = Nurture Leads flagged for manual review
      disqualified = Disqualified Leads (no outreach)
    """
    all_leads = leads_db.read()

    if campaign and campaign.lower() != "all":
        filtered = [l for l in all_leads if l.get("campaign") == campaign]
    else:
        filtered = all_leads

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "email", "name", "company", "website", "source",
        "category", "analysis_status", "score", "industry_fit", "company_type",
        "campaign", "campaign_label",
        "reasoning", "signals", "concerns",
        "klenty_enrolled", "outplay_enrolled",
        "processed_at", "created_at",
    ], extrasaction="ignore")
    writer.writeheader()
    for lead in filtered:
        row = dict(lead)
        row["signals"] = "; ".join(lead.get("signals") or [])
        row["concerns"] = "; ".join(lead.get("concerns") or [])
        writer.writerow(row)

    label_map = {"A": "qualified", "B": "personal", "nurture": "nurture", "disqualified": "disqualified"}
    suffix_key = label_map.get(campaign, campaign) if campaign and campaign.lower() != "all" else ""
    suffix = f"-{suffix_key}" if suffix_key else ""
    filename = f"leads-analysis{suffix}.csv"
    return Response(
        content=output.getvalue().encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
    hubspot_config = _build_hubspot_config(request)
    apollo_config = _build_apollo_config(request)
    sales_nav_config = _build_sales_navigator_config(request)
    phantombuster_config = _build_phantombuster_config(request)

    background_tasks.add_task(
        run_agent3_background, config, klenty_config, outplay_config, hubspot_config,
        apollo_config, sales_nav_config, phantombuster_config
    )
    _append_log("info", "Agent 3 started by user", agent_id="agent3",
                metadata={
                    "provider": config.provider,
                    "model": config.model,
                    "klenty": klenty_config is not None,
                    "outplay": outplay_config is not None,
                    "hubspot": hubspot_config is not None,
                    "apollo": apollo_config is not None,
                    "sales_navigator": sales_nav_config is not None,
                    "phantombuster": phantombuster_config is not None,
                })
    return {"status": "started", "message": "Agent 3 (Matters broad) has started."}


@router.get("/agents/agent3/status", response_model=AgentRunStatus)
def agent3_status():
    return get_agent3_status()


@router.get("/agents/agent3/outreach-targets")
def list_outreach_targets():
    """Return all outreach prospect targets."""
    return get_outreach_targets()


@router.post("/agents/agent3/outreach-targets/{target_id}/approve")
def approve_target(target_id: str, body: ApproveTargetRequest = ApproveTargetRequest()):
    """Approve a prospect for outreach.
    Optionally accepts Outplay config in the request body to enroll the prospect
    immediately without requiring a full agent re-run.
    """
    outplay_config = None
    if body.outplay:
        outplay_config = OutplayConfig(
            client_secret=body.outplay.client_secret,
            client_id=body.outplay.client_id,
            user_id=body.outplay.user_id,
            location=body.outplay.location,
            sequence_id_a=body.outplay.sequence_id_a,
            sequence_id_b=body.outplay.sequence_id_b,
            sequence_id_c=body.outplay.sequence_id_c,
        )

    result = approve_outreach_target(target_id, outplay_config)
    if not result["found"]:
        raise HTTPException(status_code=404, detail=f"Outreach target '{target_id}' not found.")

    enrolled = result["outplay_enrolled"]
    _append_log(
        "info",
        f"Outreach target {target_id[:8]}... approved"
        + (" and enrolled in Outplay" if enrolled else " (Outplay enrollment pending — add config in Settings)"),
        agent_id="agent3",
    )
    return {"status": "approved", "target_id": target_id, "outplay_enrolled": enrolled}


@router.get("/agents/agent3/rejected-prospects")
def list_rejected_prospects():
    """Return all prospects removed during Step 4 data cleaning."""
    return get_rejected_prospects()


@router.post("/agents/agent3/rejected-prospects/{rejected_id}/force-enroll")
def force_enroll_rejected(rejected_id: str, body: ApproveTargetRequest = ApproveTargetRequest()):
    """Force-enroll a filtered-out prospect into Outplay despite being removed in Step 4."""
    outplay_config = None
    if body.outplay:
        outplay_config = OutplayConfig(
            client_secret=body.outplay.client_secret,
            client_id=body.outplay.client_id,
            user_id=body.outplay.user_id,
            location=body.outplay.location,
            sequence_id_a=body.outplay.sequence_id_a,
            sequence_id_b=body.outplay.sequence_id_b,
            sequence_id_c=body.outplay.sequence_id_c,
        )

    result = force_enroll_rejected_prospect(rejected_id, outplay_config)
    if not result["found"]:
        raise HTTPException(status_code=404, detail=f"Rejected prospect '{rejected_id}' not found.")

    _append_log(
        "info",
        f"Force-enroll rejected prospect {rejected_id[:8]}... "
        + ("enrolled in Outplay" if result["outplay_enrolled"] else f"— {result['message']}"),
        agent_id="agent3",
    )
    return result


@router.post("/agents/agent3/outreach-targets/{target_id}/enroll")
def retry_enroll_target(target_id: str, body: ApproveTargetRequest = ApproveTargetRequest()):
    """Retry Outplay enrollment for a prospect that was not enrolled or whose enrollment failed."""
    outplay_config = None
    if body.outplay:
        outplay_config = OutplayConfig(
            client_secret=body.outplay.client_secret,
            client_id=body.outplay.client_id,
            user_id=body.outplay.user_id,
            location=body.outplay.location,
            sequence_id_a=body.outplay.sequence_id_a,
            sequence_id_b=body.outplay.sequence_id_b,
            sequence_id_c=body.outplay.sequence_id_c,
        )

    result = retry_enroll_outreach_target(target_id, outplay_config)
    if not result["found"]:
        raise HTTPException(status_code=404, detail=f"Outreach target '{target_id}' not found.")

    _append_log(
        "info" if result["outplay_enrolled"] else "warning",
        f"Retry enroll outreach target {target_id[:8]}... "
        + ("enrolled in Outplay" if result["outplay_enrolled"] else f"failed — {result['message']}"),
        agent_id="agent3",
    )
    return result


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
    return {"status": "started", "message": "Agent 4 (Ringside View) has started."}


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
            "id": "agent2",
            "name": "Matters",
            "description": "Deduplicates leads, scrapes company websites, AI-scores for travel industry fit, seeds blog topics to Hangout Social, and auto-enrolls into Klenty/Outplay campaigns.",
            "type": "Lead Automation",
            "schedule": "Hourly",
            "status": a2.status,
            "steps_count": 8,
            "last_run": a2.completed_at,
            "implemented": True,
        },
        {
            "id": "agent3",
            "name": "Matters broad",
            "description": "Scalable outbound lead generation for travel tech companies dealing with hotel data normalization. Discovers OTA / Bedbank / Wholesaler / TMC decision-makers (CTO, VP Eng, Head of Product, Supply/Content/Connectivity Manager) via Apollo + Boolean search, collects and validates contact data, AI-qualifies leads by role and company type, uploads to Matters Board CRM with Qualified Lead / Travel Tech Prospect tags, and launches Outplay 4-email sequences (Day 1 Intro → Day 3 → Day 7 → Day 14 Final).",
            "type": "Outreach Automation",
            "schedule": "6x Daily",
            "status": a3.status,
            "steps_count": 6,
            "last_run": a3.completed_at,
            "implemented": True,
        },
        {
            "id": "agent4",
            "name": "Ringside View",
            "description": "Aggregates data from all agents, generates AI-powered performance insights, and creates executive reports with visualizations.",
            "type": "Reporting",
            "schedule": "Weekly",
            "status": a4.status,
            "steps_count": 6,
            "last_run": a4.completed_at,
            "implemented": True,
        },
        {
            "id": "agent1",
            "name": "Hangout Social",
            "description": "Picks pending topics (seeded by Matters or added manually), writes an Ogilvy-style LinkedIn post, generates a DALL-E illustration, and publishes text + image directly to LinkedIn.",
            "type": "Content Automation",
            "schedule": "Daily",
            "status": a1.status,
            "steps_count": 6,
            "last_run": a1.completed_at,
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
    post_text = "This is a test post from Inbound 360! If you see this, the LinkedIn integration is working correctly. You can safely delete this post."
    try:
        return post_to_linkedin(li_config, post_text)
    except IntegrationError as e:
        return {"post_urn": None, "message": str(e)}


@router.post("/integrations/test-publish/linkedin-image")
def test_publish_linkedin_image(config: LinkedInImageTestModel):
    """Test publishing an image + text post to LinkedIn via the Assets upload API."""
    li_config = LinkedInConfig(
        access_token=config.access_token,
        author_urn=config.author_urn,
    )
    post_text = (
        config.post_text
        or "🎯 Testing LinkedIn image post from Inbound 360! "
           "If you see this with an image attached, the integration is working. You can safely delete this post."
    )
    try:
        return post_to_linkedin(li_config, post_text, image_url=config.image_url)
    except IntegrationError as e:
        return {"post_urn": None, "message": str(e)}


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
        client_secret=config.client_secret,
        client_id=config.client_id,
        user_id=config.user_id,
        location=config.location,
        sequence_id_a=config.sequence_id_a,   # Qualified Lead Marktech
        sequence_id_b=config.sequence_id_b,   # Personal Lead Marktech
    )
    return test_outplay_connection(outplay_config)


@router.post("/integrations/test/outplay-prospect")
def test_outplay_prospect(config: OutplayConfigModel):
    """Send a dummy prospect to Outplay to verify end-to-end enrollment."""
    outplay_config = OutplayConfig(
        client_secret=config.client_secret,
        client_id=config.client_id,
        user_id=config.user_id,
        location=config.location,
        sequence_id_a=config.sequence_id_a,   # Qualified Lead Marktech
        sequence_id_b=config.sequence_id_b,   # Personal Lead Marktech
    )
    try:
        result = add_prospect_to_outplay(
            outplay_config,
            email="test.vervotech@outplay-test.com",
            name="Test Vervotech",
            company="Vervotech Test Account",
            sequence_id=outplay_config.sequence_id_a,
        )
        return {"success": True, **result}
    except IntegrationError as e:
        return {"success": False, "message": str(e)}


@router.post("/integrations/test/apollo")
def test_apollo(config: ApolloConfigModel):
    """Test Apollo.io API connection."""
    apollo_config = ApolloConfig(
        api_key=config.api_key,
        per_page=config.per_page,
    )
    return test_apollo_connection(apollo_config)


@router.post("/integrations/test/sales-navigator")
def test_sales_navigator(config: SalesNavigatorConfigModel):
    """Test LinkedIn Sales Navigator SNAP API connection."""
    sn_config = SalesNavigatorConfig(
        access_token=config.access_token,
        count=config.count,
    )
    return test_sales_navigator_connection(sn_config)


@router.post("/integrations/test/hubspot")
def test_hubspot(config: HubSpotConfigModel):
    """Test HubSpot CRM API connection."""
    hs_config = HubSpotConfig(
        access_token=config.access_token,
        max_contacts=config.max_contacts,
        list_id=config.list_id or "",
    )
    return test_hubspot_connection(hs_config)


@router.post("/integrations/test/hubspot-prospect")
def test_hubspot_prospect(config: HubSpotConfigModel):
    """Send a dummy prospect to HubSpot: creates contact, sets lead status, adds to list."""
    hs_config = HubSpotConfig(
        access_token=config.access_token,
        max_contacts=config.max_contacts,
        list_id=config.list_id or "",
    )
    try:
        result = enroll_in_hubspot_sequence(
            hs_config,
            email="prathamesh.shirtawle@gmail.com",
            name="Test Vervotech",
            company="Vervotech Test Account",
        )
        return {"success": True, **result}
    except IntegrationError as e:
        return {"success": False, "message": str(e)}


@router.post("/integrations/test/phantombuster")
def test_phantombuster(config: PhantomBusterConfigModel):
    """Test PhantomBuster API connection."""
    pb_config = PhantomBusterConfig(
        api_key=config.api_key,
        search_phantom_id=config.search_phantom_id,
        connection_phantom_id=config.connection_phantom_id,
        session_cookie=config.session_cookie,
        connections_per_launch=config.connections_per_launch,
    )
    return test_phantombuster_connection(pb_config)

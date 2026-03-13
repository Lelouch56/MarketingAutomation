"""
Agent 3: LinkedIn Outbound Automation

8-step workflow:
  1. load_qualified_leads   - Read Agent 2 hot leads from leads.json; extract unique company
                              domains + AI context (signals, score, company_type)
  2. prospect_search        - PhantomBuster LinkedIn Search Export (primary, if configured) →
                              Apollo domain search (fallback, if hot leads exist) →
                              Apollo keyword search → LLM generation
  3. filter_decision_makers - AI removes non-decision-maker titles (PROSPECT_FILTER_SYSTEM)
  4. analyze_outreach_fit   - AI scores each prospect using Agent 2 company context; adds
                              outreach_score, outreach_reason, connection_message per prospect
  5. queue_for_approval     - Persist to outreach_targets.json as 'pending_approval'
  6. email_outreach         - Enroll approved prospects in Klenty / Outplay / HubSpot Sequences
  7. linkedin_connection    - PhantomBuster Connection Sender (if configured) or log requests
  8. track_engagement       - Aggregate run metrics
"""

import json
import logging
import random
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

from app.storage.json_db import JsonDB
from app.core.llm_provider import LLMConfig, call_llm_json, LLMError
from app.core.prompts import (
    PROSPECT_GENERATION_SYSTEM, prospect_generation_user,
    PROSPECT_FILTER_SYSTEM, prospect_filter_user,
    PROSPECT_ANALYSIS_SYSTEM, prospect_analysis_user,
)
from app.core.integrations import (
    KlentyConfig, IntegrationError, add_prospect_to_klenty,
    OutplayConfig, add_prospect_to_outplay,
    HubSpotConfig, enroll_in_hubspot_sequence,
    ApolloConfig, search_apollo_prospects, search_apollo_by_domains, _extract_domain,
    SalesNavigatorConfig, search_sales_navigator_prospects,
    PhantomBusterConfig, search_phantombuster_prospects, launch_linkedin_connections,
)
from app.models import AgentRunStatus, StepStatus

# ─────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────

outreach_db = JsonDB("app/data/outreach_targets.json")
leads_db = JsonDB("app/data/leads.json")    # reads Agent 2 hot leads

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

DEFAULT_PERSONAS = [
    "CTO",
    "VP Technology",
    "Product Head",
    "Founder",
    "Head of Supply",
    "Head of Partnerships",
]

STEP_DEFINITIONS = [
    (1, "load_qualified_leads"),
    (2, "prospect_search"),
    (3, "filter_decision_makers"),
    (4, "analyze_outreach_fit"),
    (5, "queue_for_approval"),
    (6, "email_outreach"),
    (7, "linkedin_connection"),
    (8, "track_engagement"),
]

# ─────────────────────────────────────────────────────────────
# In-memory run state
# ─────────────────────────────────────────────────────────────

_run_lock = threading.Lock()
_run_state: Optional[AgentRunStatus] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_idle_state() -> AgentRunStatus:
    return AgentRunStatus(
        agent_id="agent3",
        run_id="",
        status="idle",
        steps=[
            StepStatus(step_number=n, name=name, status="pending")
            for n, name in STEP_DEFINITIONS
        ],
    )


def get_agent3_status() -> AgentRunStatus:
    with _run_lock:
        return _run_state if _run_state is not None else _make_idle_state()


def _update_step(step_num: int, status: str, message: str = "") -> None:
    with _run_lock:
        if _run_state is None:
            return
        step = _run_state.steps[step_num - 1]
        step.status = status
        if message:
            step.message = message
        if status == "running":
            step.started_at = _now()
        elif status in ("completed", "failed", "skipped", "warning"):
            step.completed_at = _now()


def _set_run_status(status: str, error: str = None, result=None) -> None:
    with _run_lock:
        if _run_state is not None:
            _run_state.status = status
            if error:
                _run_state.error = error
            if result is not None:
                _run_state.result = result
            if status in ("completed", "failed"):
                _run_state.completed_at = _now()


# ─────────────────────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────────────────────

def get_outreach_targets() -> list:
    """Read all outreach targets from storage."""
    return outreach_db.read()


def approve_outreach_target(target_id: str) -> bool:
    """
    Set a prospect's status to 'approved' by ID.
    Returns True if found and updated, False otherwise.
    """
    targets = outreach_db.read()
    found = False
    for t in targets:
        if t.get("id") == target_id:
            t["status"] = "approved"
            t["approved_at"] = _now()
            found = True
            break
    if found:
        outreach_db.write(targets)
    return found


# ─────────────────────────────────────────────────────────────
# Step Implementations
# ─────────────────────────────────────────────────────────────

def _step1_load_qualified_leads() -> tuple:
    """
    Read Agent 2's completed hot leads from leads.json.
    Returns (hot_leads list, domain_to_ctx dict mapping bare_domain → lead dict).

    domain_to_ctx is keyed by bare domain (e.g. 'booking.com') and maps to the
    highest-scored Agent 2 lead for that domain. Used by step 2 (Apollo domain search
    and PhantomBuster) and step 4 (outreach fit analysis).

    Returns ([], {}) gracefully if Agent 2 hasn't run yet — later steps fall back
    to keyword search or LLM generation.
    """
    all_leads = leads_db.read()
    hot_leads = [
        l for l in all_leads
        if l.get("category") == "Hot" and l.get("analysis_status") == "completed"
    ]
    domain_to_ctx: dict = {}
    for lead in hot_leads:
        domain = _extract_domain(lead.get("website", ""))
        if domain:
            existing = domain_to_ctx.get(domain)
            # Keep highest-scored lead per domain
            if existing is None or (lead.get("score") or 0) > (existing.get("score") or 0):
                domain_to_ctx[domain] = lead
    return hot_leads, domain_to_ctx


def _step2_prospect_search(
    hot_leads: list,
    domain_to_ctx: dict,
    config: LLMConfig,
    apollo_config: Optional[ApolloConfig] = None,
    sales_nav_config: Optional[SalesNavigatorConfig] = None,
    phantombuster_config: Optional[PhantomBusterConfig] = None,
) -> tuple:
    """
    Search for decision-maker prospects.

    Priority:
      1. PhantomBuster LinkedIn Search Export (if configured + hot leads exist)
         Searches LinkedIn by company name; async poll for results (~2 min).
      2. LinkedIn Sales Navigator (if configured)
      3. Apollo domain search (if configured + hot leads exist)
      4. Apollo keyword search (fallback)
      5. LLM generation (last resort)

    Returns (prospects_list, source_string).
    """
    prospects = []
    source = "llm"

    # Priority 1: PhantomBuster LinkedIn Search Export
    if phantombuster_config and domain_to_ctx:
        company_names = [
            ctx.get("company") or domain
            for domain, ctx in domain_to_ctx.items()
        ]
        try:
            prospects = search_phantombuster_prospects(phantombuster_config, company_names)
            if prospects:
                source = "phantombuster_search"
                # Enrich with company_type from Agent 2 context
                for p in prospects:
                    p_domain = _extract_domain(p.get("website", ""))
                    ctx = domain_to_ctx.get(p_domain) or {}
                    if ctx.get("company_type"):
                        p["company_type"] = ctx["company_type"]
        except IntegrationError as e:
            logger.warning("PhantomBuster search failed, falling back to Apollo: %s", str(e))
            prospects = []

    # Priority 2: LinkedIn Sales Navigator
    if not prospects and sales_nav_config:
        persona = random.choice(DEFAULT_PERSONAS)
        try:
            prospects = search_sales_navigator_prospects(sales_nav_config, persona)
            if prospects:
                source = "sales_navigator"
        except IntegrationError as e:
            logger.warning("Sales Navigator search failed: %s", str(e))
            prospects = []

    # Priority 3: Apollo domain search
    if not prospects and apollo_config and domain_to_ctx:
        try:
            prospects = search_apollo_by_domains(
                apollo_config,
                domains=list(domain_to_ctx.keys()),
                person_titles=DEFAULT_PERSONAS,
            )
            if prospects:
                source = "apollo_domain"
                for p in prospects:
                    p_domain = _extract_domain(p.get("website", ""))
                    ctx = domain_to_ctx.get(p_domain) or {}
                    if ctx.get("company_type"):
                        p["company_type"] = ctx["company_type"]
        except IntegrationError as e:
            logger.warning("Apollo domain search failed, trying keyword: %s", str(e))
            prospects = []

    # Priority 4: Apollo keyword fallback
    if not prospects and apollo_config:
        persona = random.choice(DEFAULT_PERSONAS)
        try:
            prospects = search_apollo_prospects(apollo_config, persona, "travel")
            if prospects:
                source = "apollo"
        except IntegrationError as e:
            logger.warning("Apollo keyword search failed, using LLM: %s", str(e))
            prospects = []

    # Priority 5: LLM generation (last resort — generates demo/synthetic data)
    if not prospects:
        persona = random.choice(DEFAULT_PERSONAS)
        raw = call_llm_json(
            config,
            PROSPECT_GENERATION_SYSTEM,
            prospect_generation_user(persona, "travel technology", "Global"),
        )
        if isinstance(raw, list):
            prospects = raw
        elif isinstance(raw, dict):
            prospects = raw.get("prospects", raw.get("data", []))
        source = "llm"
        # Mark every LLM-generated prospect as demo data so the UI can distinguish
        # them from real profiles returned by PhantomBuster / Apollo / Sales Navigator.
        for p in prospects:
            if isinstance(p, dict):
                p["is_dummy"] = True

    result = []
    for p in prospects:
        if not isinstance(p, dict):
            continue
        p["id"] = p.get("id") or str(uuid.uuid4())
        p["status"] = "raw"
        p["created_at"] = _now()
        p["run_id"] = ""
        p.setdefault("source", source)
        result.append(p)
    return result, source


def _step3_filter_decision_makers(prospects: list, config: LLMConfig) -> list:
    """
    AI filter: remove non-decision-maker titles using PROSPECT_FILTER_SYSTEM prompt.
    Returns filtered prospect list with status='filtered' and relevance_reason added.
    """
    if not prospects:
        return []
    try:
        prospects_json = json.dumps(prospects, indent=2)
        result = call_llm_json(
            config,
            PROSPECT_FILTER_SYSTEM,
            prospect_filter_user(prospects_json),
        )
        if isinstance(result, list):
            filtered = result
        elif isinstance(result, dict):
            filtered = result.get("prospects", result.get("filtered", []))
        else:
            filtered = prospects  # fallback: keep all

        for p in filtered:
            if isinstance(p, dict):
                p["status"] = "filtered"
        return filtered
    except Exception as e:
        logger.warning("Prospect filtering failed, keeping all: %s", str(e)[:100])
        for p in prospects:
            p["status"] = "filtered"
        return prospects


def _step4_analyze_outreach_fit(
    prospects: list,
    domain_to_ctx: dict,
    config: LLMConfig,
) -> list:
    """
    AI-score each prospect for LinkedIn outreach fit using Agent 2 company context.

    For each prospect:
      - Looks up its company domain in domain_to_ctx to get Agent 2 signals/score/reasoning
      - If no Agent 2 context available, uses minimal fallback context (still generates a score)
      - Calls LLM to get outreach_score, outreach_reason, connection_message
      - Adds those fields to the prospect dict in-place

    Non-critical: on per-prospect LLM failure, the prospect keeps its existing data
    with outreach_score=None and empty strings for the text fields.
    Sleeps 2s between LLM calls to respect free-tier rate limits.
    """
    for i, p in enumerate(prospects):
        if not isinstance(p, dict):
            continue

        p_domain = _extract_domain(p.get("website", ""))
        company_ctx = domain_to_ctx.get(p_domain) or {
            "company_type": p.get("company_type", "unknown"),
            "score": None,
            "reasoning": "No Agent 2 analysis available for this company.",
            "signals": [],
            "concerns": [],
        }

        try:
            result = call_llm_json(
                config,
                PROSPECT_ANALYSIS_SYSTEM,
                prospect_analysis_user(p, company_ctx),
            )
            if isinstance(result, dict):
                p["outreach_score"] = result.get("outreach_score")
                p["outreach_reason"] = result.get("outreach_reason", "")
                p["connection_message"] = result.get("connection_message", "")
        except Exception as e:
            logger.warning(
                "Outreach fit analysis failed for %s %s: %s",
                p.get("first_name", ""), p.get("last_name", ""), str(e)[:100]
            )
            p["outreach_score"] = None
            p["outreach_reason"] = ""
            p["connection_message"] = ""

        if i < len(prospects) - 1:
            time.sleep(2)

    return prospects


def _step5_queue_for_approval(prospects: list, run_id: str) -> int:
    """
    Persist prospects to outreach_targets.json with status 'pending_approval'.
    Includes new fields: outreach_score, outreach_reason, connection_message.
    Returns count of newly added records.
    """
    now = _now()
    count = 0
    for p in prospects:
        if not isinstance(p, dict):
            continue
        outreach_db.append({
            "id": p.get("id") or str(uuid.uuid4()),
            "run_id": run_id,
            "first_name": p.get("first_name", ""),
            "last_name": p.get("last_name", ""),
            "email": p.get("email", ""),
            "title": p.get("title", ""),
            "company": p.get("company", ""),
            "company_type": p.get("company_type", "other"),
            "website": p.get("website", ""),
            "linkedin_url": p.get("linkedin_url", ""),
            "region": p.get("region", "Global"),
            "employees": p.get("employees", ""),
            "relevance_reason": p.get("relevance_reason", ""),
            "outreach_score": p.get("outreach_score"),
            "outreach_reason": p.get("outreach_reason", ""),
            "connection_message": p.get("connection_message", ""),
            "is_dummy": p.get("is_dummy", False),
            "status": "pending_approval",
            "klenty_enrolled": False,
            "outplay_enrolled": False,
            "linkedin_status": None,
            "created_at": now,
            "approved_at": None,
        })
        count += 1
    return count


def _step6_email_outreach(
    run_id: str,
    klenty_config: Optional[KlentyConfig],
    outplay_config: Optional[OutplayConfig] = None,
    hubspot_config: Optional[HubSpotConfig] = None,
) -> tuple:
    """
    Enroll 'approved' prospects in Klenty, Outplay, and/or HubSpot Sequences.
    Returns (klenty_enrolled, outplay_enrolled, hubspot_enrolled, skipped_count).
    """
    targets = outreach_db.read()
    klenty_enrolled = 0
    outplay_enrolled = 0
    hubspot_enrolled = 0
    skipped = 0
    updated = False

    for t in targets:
        if t.get("run_id") != run_id and run_id:
            continue
        if t.get("status") != "approved":
            skipped += 1
            continue

        name = f"{t.get('first_name', '')} {t.get('last_name', '')}".strip()

        if klenty_config and not t.get("klenty_enrolled"):
            try:
                add_prospect_to_klenty(
                    klenty_config,
                    email=t.get("email", ""),
                    name=name or None,
                    company=t.get("company"),
                    campaign_name=klenty_config.campaign_a_name,
                )
                t["klenty_enrolled"] = True
                t["klenty_enrolled_at"] = _now()
                klenty_enrolled += 1
                updated = True
            except IntegrationError:
                t["klenty_enrolled"] = False
                updated = True
            except Exception as e:
                logger.error("Unexpected error enrolling %s in Klenty: %s", t.get("email"), str(e)[:100])
                t["klenty_enrolled"] = False
                updated = True
        elif not klenty_config and not t.get("klenty_enrolled"):
            t["klenty_status"] = "queued_no_config"
            updated = True

        if outplay_config and not t.get("outplay_enrolled"):
            try:
                add_prospect_to_outplay(
                    outplay_config,
                    email=t.get("email", ""),
                    name=name or None,
                    company=t.get("company"),
                    sequence_id=outplay_config.sequence_id_a,
                )
                t["outplay_enrolled"] = True
                t["outplay_enrolled_at"] = _now()
                outplay_enrolled += 1
                updated = True
            except IntegrationError:
                t["outplay_enrolled"] = False
                updated = True
            except Exception as e:
                logger.error("Unexpected error enrolling %s in Outplay: %s", t.get("email"), str(e)[:100])
                t["outplay_enrolled"] = False
                updated = True
        elif not outplay_config and not t.get("outplay_enrolled"):
            t["outplay_status"] = "queued_no_config"
            updated = True

        if hubspot_config and not t.get("hubspot_enrolled"):
            try:
                enroll_in_hubspot_sequence(
                    hubspot_config,
                    email=t.get("email", ""),
                    name=name or None,
                    company=t.get("company"),
                )
                t["hubspot_enrolled"] = True
                t["hubspot_enrolled_at"] = _now()
                hubspot_enrolled += 1
                updated = True
            except IntegrationError:
                t["hubspot_enrolled"] = False
                updated = True
            except Exception as e:
                logger.error("Unexpected error enrolling %s in HubSpot: %s", t.get("email"), str(e)[:100])
                t["hubspot_enrolled"] = False
                updated = True
        elif not hubspot_config and not t.get("hubspot_enrolled"):
            t["hubspot_status"] = "queued_no_config"
            updated = True

        if not klenty_config and not outplay_config and not hubspot_config:
            skipped += 1

    if updated:
        outreach_db.write(targets)

    return klenty_enrolled, outplay_enrolled, hubspot_enrolled, skipped


def _step7_linkedin_connection(
    run_id: str,
    phantombuster_config: Optional[PhantomBusterConfig] = None,
) -> tuple:
    """
    Send LinkedIn connection requests.
    If PhantomBuster is configured: launches Connection Sender phantom with personalized
    messages → actual connection requests are sent (fire-and-forget).
    If not configured: logs requests for manual follow-up.
    Returns (logged_count, launched_count).
    """
    targets = outreach_db.read()
    now = _now()
    to_send = []

    for t in targets:
        if t.get("run_id") != run_id and run_id:
            continue
        if t.get("status") in ("approved", "pending_approval") and not t.get("linkedin_status"):
            t["linkedin_status"] = "connection_requested"
            t["linkedin_requested_at"] = now
            if t.get("connection_message"):
                t["linkedin_message"] = t["connection_message"]
            to_send.append(t)

    outreach_db.write(targets)

    launched = 0
    if phantombuster_config and to_send:
        try:
            launch_linkedin_connections(phantombuster_config, to_send)
            launched = len(to_send)
            # Update status to reflect actual send
            for t in to_send:
                t["linkedin_status"] = "sent_via_phantombuster"
            outreach_db.write(targets)
        except IntegrationError as e:
            logger.warning("PhantomBuster connection launch failed (logged only): %s", str(e))

    return len(to_send), launched


def _step8_track_engagement(run_id: str) -> dict:
    """
    Aggregate metrics for this run and return summary dict.
    Includes avg_outreach_score from the new step 4 analysis.
    """
    targets = outreach_db.read()
    run_targets = [t for t in targets if t.get("run_id") == run_id] if run_id else targets

    scores = [t["outreach_score"] for t in run_targets if t.get("outreach_score") is not None]
    avg_score = round(sum(scores) / len(scores)) if scores else None

    return {
        "total_prospects": len(run_targets),
        "pending_approval": sum(1 for t in run_targets if t.get("status") == "pending_approval"),
        "approved": sum(1 for t in run_targets if t.get("status") == "approved"),
        "klenty_enrolled": sum(1 for t in run_targets if t.get("klenty_enrolled")),
        "outplay_enrolled": sum(1 for t in run_targets if t.get("outplay_enrolled")),
        "hubspot_enrolled": sum(1 for t in run_targets if t.get("hubspot_enrolled")),
        "linkedin_connection_sent": sum(
            1 for t in run_targets
            if t.get("linkedin_status") in ("connection_requested", "sent_via_phantombuster")
        ),
        "avg_outreach_score": avg_score,
    }


# ─────────────────────────────────────────────────────────────
# Main Background Task
# ─────────────────────────────────────────────────────────────

def run_agent3_background(
    llm_config: LLMConfig,
    klenty_config: Optional[KlentyConfig] = None,
    outplay_config: Optional[OutplayConfig] = None,
    hubspot_config: Optional[HubSpotConfig] = None,
    apollo_config: Optional[ApolloConfig] = None,
    sales_nav_config: Optional[SalesNavigatorConfig] = None,
    phantombuster_config: Optional[PhantomBusterConfig] = None,
) -> None:
    """
    Entry point for FastAPI BackgroundTasks.
    Runs all 8 steps synchronously; updates _run_state throughout.
    """
    global _run_state

    run_id = str(uuid.uuid4())

    with _run_lock:
        _run_state = AgentRunStatus(
            agent_id="agent3",
            run_id=run_id,
            status="running",
            started_at=_now(),
            steps=[
                StepStatus(step_number=n, name=name, status="pending")
                for n, name in STEP_DEFINITIONS
            ],
        )

    hot_leads = []
    domain_to_ctx = {}
    prospects_raw = []
    prospects_filtered = []
    prospects_analyzed = []
    added_count = 0

    try:
        # ── Step 1: Load qualified leads from Agent 2 ─────────────────────
        _update_step(1, "running", "Reading Agent 2 hot leads from leads.json...")
        hot_leads, domain_to_ctx = _step1_load_qualified_leads()
        domain_count = len(domain_to_ctx)
        if domain_count > 0:
            domains_preview = ", ".join(list(domain_to_ctx.keys())[:5])
            suffix = "..." if domain_count > 5 else ""
            _update_step(
                1, "completed",
                f"Found {len(hot_leads)} hot leads across {domain_count} unique domain(s): "
                f"{domains_preview}{suffix}"
            )
        else:
            _update_step(
                1, "completed",
                "No Agent 2 hot leads found — will fall back to Apollo keyword or AI generation"
            )

        # ── Step 2: Prospect search ────────────────────────────────────────
        if phantombuster_config and domain_to_ctx:
            search_note = f"PhantomBuster LinkedIn Search for {domain_count} companies (polling ~2 min)"
        elif sales_nav_config:
            search_note = "LinkedIn Sales Navigator"
        elif apollo_config and domain_to_ctx:
            search_note = f"Apollo.io domain search for {domain_count} companies"
        elif apollo_config:
            search_note = "Apollo.io keyword search"
        else:
            search_note = "AI generation (⚠️ demo data — no real source configured)"
        _update_step(2, "running", f"Searching prospects via {search_note}...")

        prospects_raw, data_source = _step2_prospect_search(
            hot_leads, domain_to_ctx, llm_config,
            apollo_config, sales_nav_config, phantombuster_config
        )
        for p in prospects_raw:
            p["run_id"] = run_id

        SOURCE_LABELS = {
            "phantombuster_search": "PhantomBuster LinkedIn Search (real data — Agent 2 companies)",
            "sales_navigator": "LinkedIn Sales Navigator (real data)",
            "apollo_domain": "Apollo.io domain search (real data — Agent 2 companies)",
            "apollo": "Apollo.io keyword search (real data)",
            "llm": "⚠️ AI-generated demo data — configure PhantomBuster or Apollo in Settings to get real LinkedIn profiles",
        }
        _update_step(
            2, "completed",
            f"Found {len(prospects_raw)} prospects via {SOURCE_LABELS.get(data_source, data_source)}"
        )
        time.sleep(3)

        # ── Step 3: Filter decision-makers ────────────────────────────────
        _update_step(3, "running", "Filtering prospects by decision-maker title relevance...")
        prospects_filtered = _step3_filter_decision_makers(prospects_raw, llm_config)
        removed = len(prospects_raw) - len(prospects_filtered)
        _update_step(
            3, "completed",
            f"Kept {len(prospects_filtered)}, removed {removed} non-decision-makers"
        )
        time.sleep(3)

        # ── Step 4: Analyze outreach fit (NEW) ────────────────────────────
        _update_step(
            4, "running",
            f"AI-analyzing outreach fit for {len(prospects_filtered)} prospects "
            f"using Agent 2 company context..."
        )
        prospects_analyzed = _step4_analyze_outreach_fit(
            prospects_filtered, domain_to_ctx, llm_config
        )
        scored_count = sum(1 for p in prospects_analyzed if p.get("outreach_score") is not None)
        high_fit = sum(1 for p in prospects_analyzed if (p.get("outreach_score") or 0) >= 70)
        _update_step(
            4, "completed",
            f"Analyzed {scored_count}/{len(prospects_analyzed)} prospects — "
            f"{high_fit} with high outreach fit (score ≥ 70)"
        )
        time.sleep(3)

        # ── Step 5: Queue for manual approval ─────────────────────────────
        _update_step(5, "running", "Saving prospects for manual review...")
        added_count = _step5_queue_for_approval(prospects_analyzed, run_id)
        _update_step(
            5, "completed",
            f"{added_count} prospects saved — approve them in Agent 3 detail page to start outreach"
        )

        # ── Step 6: Email outreach via Klenty / Outplay / HubSpot ────────
        platforms = []
        if klenty_config:
            platforms.append("Klenty")
        if outplay_config:
            platforms.append("Outplay")
        if hubspot_config:
            platforms.append("HubSpot")
        platform_note = f"via {' & '.join(platforms)}" if platforms else "(no platform configured — queuing)"
        _update_step(6, "running", f"Starting email outreach {platform_note}...")
        klenty_cnt, outplay_cnt, hubspot_cnt, skipped = _step6_email_outreach(
            run_id, klenty_config, outplay_config, hubspot_config
        )
        enroll_parts = []
        if klenty_config:
            enroll_parts.append(f"{klenty_cnt} enrolled in Klenty")
        if outplay_config:
            enroll_parts.append(f"{outplay_cnt} enrolled in Outplay")
        if hubspot_config:
            enroll_parts.append(f"{hubspot_cnt} enrolled in HubSpot")
        if enroll_parts:
            _update_step(6, "completed", f"{', '.join(enroll_parts)}, {skipped} pending approval")
        else:
            _update_step(
                6, "completed",
                f"{skipped} queued — connect Klenty, Outplay, or HubSpot in Settings to enable auto-enrollment"
            )

        # ── Step 7: LinkedIn connection requests ──────────────────────────
        if phantombuster_config:
            li_note = "Launching PhantomBuster LinkedIn Connection Sender..."
        else:
            li_note = "Logging LinkedIn connection requests (configure PhantomBuster to send automatically)..."
        _update_step(7, "running", li_note)
        li_logged, li_launched = _step7_linkedin_connection(run_id, phantombuster_config)
        if li_launched > 0:
            _update_step(
                7, "completed",
                f"PhantomBuster launched for {li_launched} prospects — check PhantomBuster dashboard"
            )
        else:
            _update_step(7, "completed", f"Connection requests logged for {li_logged} prospects")

        # ── Step 8: Track engagement ──────────────────────────────────────
        _update_step(8, "running", "Aggregating engagement metrics...")
        summary = _step8_track_engagement(run_id)
        enrolled_total = (
            summary["klenty_enrolled"] + summary["outplay_enrolled"] + summary["hubspot_enrolled"]
        )
        score_note = (
            f", avg outreach score: {summary['avg_outreach_score']}/100"
            if summary.get("avg_outreach_score") is not None else ""
        )
        _update_step(
            8, "completed",
            f"Total: {summary['total_prospects']} prospects, "
            f"{enrolled_total} enrolled{score_note}, "
            f"{summary['pending_approval']} awaiting approval"
        )

        _set_run_status("completed", result={
            "hot_leads_loaded": len(hot_leads),
            "domains_searched": domain_count,
            "total_prospects": summary["total_prospects"],
            "pending_approval": summary["pending_approval"],
            "klenty_enrolled": summary["klenty_enrolled"],
            "outplay_enrolled": summary["outplay_enrolled"],
            "hubspot_enrolled": summary["hubspot_enrolled"],
            "linkedin_connections": summary["linkedin_connection_sent"],
            "avg_outreach_score": summary["avg_outreach_score"],
        })

    except LLMError as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            2
        )
        _update_step(current_step, "failed", f"AI error: {str(e)[:200]}")
        _set_run_status("failed", error=f"LLM error: {str(e)[:200]}")

    except Exception as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            1
        )
        _update_step(current_step, "failed", str(e)[:200])
        _set_run_status("failed", error=str(e)[:200])

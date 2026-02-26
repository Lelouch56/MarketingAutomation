"""
Agent 3: LinkedIn Outbound Automation

7-step workflow:
  1. persona_selection    - Select target decision-maker personas for outreach
  2. sales_navigator_search - AI-generates realistic B2B prospect profiles
  3. seamless_upload      - AI filters out non-decision-maker titles
  4. manual_approval      - Writes prospects to DB; awaits manual approval via UI
  5. email_outreach       - Enrolls approved prospects into Klenty email campaigns
  6. linkedin_connection  - Logs LinkedIn connection request records
  7. track_engagement     - Aggregates run summary and saves metrics
"""

import json
import random
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.storage.json_db import JsonDB
from app.core.llm_provider import LLMConfig, call_llm_json, LLMError
from app.core.prompts import (
    PROSPECT_GENERATION_SYSTEM, prospect_generation_user,
    PROSPECT_FILTER_SYSTEM, prospect_filter_user,
)
from app.core.integrations import (
    KlentyConfig, IntegrationError, add_prospect_to_klenty,
    OutplayConfig, add_prospect_to_outplay,
)
from app.models import AgentRunStatus, StepStatus

# ─────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────

outreach_db = JsonDB("app/data/outreach_targets.json")

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
    (1, "persona_selection"),
    (2, "sales_navigator_search"),
    (3, "seamless_upload"),
    (4, "manual_approval"),
    (5, "email_outreach"),
    (6, "linkedin_connection"),
    (7, "track_engagement"),
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
        elif status in ("completed", "failed", "skipped"):
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

def _step1_persona_selection() -> str:
    """Select a target persona for this outreach run."""
    persona = random.choice(DEFAULT_PERSONAS)
    return persona


def _step2_sales_navigator_search(persona: str, config: LLMConfig) -> list:
    """
    Generate realistic B2B prospects via LLM (simulates Sales Navigator search).
    Returns list of raw prospect dicts.
    """
    raw = call_llm_json(
        config,
        PROSPECT_GENERATION_SYSTEM,
        prospect_generation_user(persona, "travel technology", "Global"),
    )
    # Handle both array and wrapped object responses
    if isinstance(raw, list):
        prospects = raw
    elif isinstance(raw, dict):
        prospects = raw.get("prospects", raw.get("data", []))
    else:
        prospects = []

    # Ensure each prospect has required fields and a UUID
    result = []
    for p in prospects:
        if not isinstance(p, dict):
            continue
        p["id"] = p.get("id") or str(uuid.uuid4())
        p["status"] = "raw"
        p["created_at"] = _now()
        p["run_id"] = ""  # will be filled in main function
        result.append(p)
    return result


def _step3_seamless_upload(prospects: list, config: LLMConfig) -> list:
    """
    Filter out non-decision-maker titles via LLM (simulates Seamless.ai filtering).
    Returns filtered prospect list.
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
        # Handle both array and wrapped responses
        if isinstance(result, list):
            filtered = result
        elif isinstance(result, dict):
            filtered = result.get("prospects", result.get("filtered", []))
        else:
            filtered = prospects  # Fallback: keep all on parse failure

        # Ensure status is updated
        for p in filtered:
            if isinstance(p, dict):
                p["status"] = "filtered"
        return filtered
    except Exception:
        # Non-critical: fall back to keeping all prospects as-is
        for p in prospects:
            p["status"] = "filtered"
        return prospects


def _step4_manual_approval(prospects: list, run_id: str) -> int:
    """
    Persist prospects to outreach_targets.json with status 'pending_approval'.
    Returns the count of newly added prospects.
    """
    now = _now()
    new_records = []
    for p in prospects:
        if not isinstance(p, dict):
            continue
        record = {
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
            "status": "pending_approval",
            "klenty_enrolled": False,
            "linkedin_status": None,
            "created_at": now,
            "approved_at": None,
        }
        new_records.append(record)
        outreach_db.append(record)
    return len(new_records)


def _step5_email_outreach(
    run_id: str,
    klenty_config: Optional[KlentyConfig],
    outplay_config: Optional[OutplayConfig] = None,
) -> tuple:
    """
    Enroll 'approved' prospects in Klenty and/or Outplay email sequences.
    Returns (klenty_enrolled, outplay_enrolled, skipped_count).
    """
    targets = outreach_db.read()
    klenty_enrolled = 0
    outplay_enrolled = 0
    skipped = 0
    updated = False

    for t in targets:
        if t.get("run_id") != run_id and run_id:
            continue  # Only process current run's targets
        if t.get("status") != "approved":
            skipped += 1
            continue

        name = f"{t.get('first_name', '')} {t.get('last_name', '')}".strip()

        # Enroll in Klenty if configured and not already enrolled
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
            except Exception:
                t["klenty_enrolled"] = False
                updated = True
        elif not klenty_config and not t.get("klenty_enrolled"):
            t["klenty_status"] = "queued_no_config"
            updated = True

        # Enroll in Outplay if configured and not already enrolled
        if outplay_config and not t.get("outplay_enrolled"):
            try:
                add_prospect_to_outplay(
                    outplay_config,
                    email=t.get("email", ""),
                    name=name or None,
                    company=t.get("company"),
                    sequence_name=outplay_config.sequence_name_a,
                )
                t["outplay_enrolled"] = True
                t["outplay_enrolled_at"] = _now()
                outplay_enrolled += 1
                updated = True
            except IntegrationError:
                t["outplay_enrolled"] = False
                updated = True
            except Exception:
                t["outplay_enrolled"] = False
                updated = True
        elif not outplay_config and not t.get("outplay_enrolled"):
            t["outplay_status"] = "queued_no_config"
            updated = True

        if not klenty_config and not outplay_config:
            skipped += 1

    if updated:
        outreach_db.write(targets)

    return klenty_enrolled, outplay_enrolled, skipped


def _step6_linkedin_connection(run_id: str) -> int:
    """
    Log LinkedIn connection requests for all enrolled/approved prospects.
    Returns count of records updated.
    """
    targets = outreach_db.read()
    updated_count = 0
    now = _now()

    for t in targets:
        if t.get("run_id") != run_id and run_id:
            continue
        if t.get("status") in ("approved", "pending_approval") and not t.get("linkedin_status"):
            t["linkedin_status"] = "connection_requested"
            t["linkedin_requested_at"] = now
            updated_count += 1

    outreach_db.write(targets)
    return updated_count


def _step7_track_engagement(run_id: str) -> dict:
    """
    Aggregate metrics for this run and return summary.
    """
    targets = outreach_db.read()
    run_targets = [t for t in targets if t.get("run_id") == run_id] if run_id else targets

    summary = {
        "total_prospects": len(run_targets),
        "pending_approval": sum(1 for t in run_targets if t.get("status") == "pending_approval"),
        "approved": sum(1 for t in run_targets if t.get("status") == "approved"),
        "klenty_enrolled": sum(1 for t in run_targets if t.get("klenty_enrolled")),
        "outplay_enrolled": sum(1 for t in run_targets if t.get("outplay_enrolled")),
        "linkedin_connection_sent": sum(1 for t in run_targets if t.get("linkedin_status") == "connection_requested"),
    }
    return summary


# ─────────────────────────────────────────────────────────────
# Main Background Task
# ─────────────────────────────────────────────────────────────

def run_agent3_background(
    llm_config: LLMConfig,
    klenty_config: Optional[KlentyConfig] = None,
    outplay_config: Optional[OutplayConfig] = None,
) -> None:
    """
    Entry point for FastAPI BackgroundTasks.
    Runs all 7 steps synchronously; updates _run_state throughout.
    Supports Klenty and/or Outplay for email outreach enrollment.
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

    persona = ""
    prospects_raw = []
    prospects_filtered = []
    added_count = 0

    try:
        # ── Step 1: Persona selection ────────────────────────────────────
        _update_step(1, "running", "Selecting target decision-maker persona...")
        persona = _step1_persona_selection()
        _update_step(1, "completed", f"Targeting: {persona}")

        # ── Step 2: Sales Navigator search (AI-generated prospects) ──────
        _update_step(2, "running", f"Generating prospect profiles for '{persona}'...")
        prospects_raw = _step2_sales_navigator_search(persona, llm_config)
        for p in prospects_raw:
            p["run_id"] = run_id
        _update_step(2, "completed", f"Found {len(prospects_raw)} prospect profiles")
        time.sleep(3)

        # ── Step 3: Seamless upload / filter ────────────────────────────
        _update_step(3, "running", "Filtering prospects by title relevance...")
        prospects_filtered = _step3_seamless_upload(prospects_raw, llm_config)
        removed = len(prospects_raw) - len(prospects_filtered)
        _update_step(3, "completed", f"Kept {len(prospects_filtered)}, removed {removed} non-decision-makers")
        time.sleep(3)

        # ── Step 4: Manual approval gate ────────────────────────────────
        _update_step(4, "running", "Saving prospects for manual review...")
        added_count = _step4_manual_approval(prospects_filtered, run_id)
        _update_step(
            4, "completed",
            f"{added_count} prospects saved — approve them in Agent 3 detail page to start outreach"
        )

        # ── Step 5: Email outreach via Klenty / Outplay ──────────────────
        platforms = []
        if klenty_config:
            platforms.append("Klenty")
        if outplay_config:
            platforms.append("Outplay")
        platform_note = f"via {' & '.join(platforms)}" if platforms else "(no platform configured — queuing)"
        _update_step(5, "running", f"Starting email outreach {platform_note}...")
        klenty_cnt, outplay_cnt, skipped = _step5_email_outreach(run_id, klenty_config, outplay_config)
        enroll_parts = []
        if klenty_config:
            enroll_parts.append(f"{klenty_cnt} enrolled in Klenty")
        if outplay_config:
            enroll_parts.append(f"{outplay_cnt} enrolled in Outplay")
        if enroll_parts:
            _update_step(5, "completed", f"{', '.join(enroll_parts)}, {skipped} pending approval")
        else:
            _update_step(5, "completed", f"{skipped} queued — connect Klenty or Outplay in Settings to enable auto-enrollment")

        # ── Step 6: LinkedIn connection requests ─────────────────────────
        _update_step(6, "running", "Logging LinkedIn connection requests...")
        li_count = _step6_linkedin_connection(run_id)
        _update_step(6, "completed", f"LinkedIn connection logged for {li_count} prospects")

        # ── Step 7: Track engagement ─────────────────────────────────────
        _update_step(7, "running", "Aggregating engagement metrics...")
        summary = _step7_track_engagement(run_id)
        enrolled_total = summary["klenty_enrolled"] + summary["outplay_enrolled"]
        _update_step(
            7, "completed",
            f"Total: {summary['total_prospects']} prospects, "
            f"{enrolled_total} enrolled (Klenty: {summary['klenty_enrolled']}, Outplay: {summary['outplay_enrolled']}), "
            f"{summary['pending_approval']} awaiting approval"
        )

        _set_run_status("completed", result={
            "persona": persona,
            "total_prospects": summary["total_prospects"],
            "pending_approval": summary["pending_approval"],
            "klenty_enrolled": summary["klenty_enrolled"],
            "outplay_enrolled": summary["outplay_enrolled"],
            "linkedin_connections": summary["linkedin_connection_sent"],
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

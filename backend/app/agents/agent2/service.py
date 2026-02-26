"""
Agent 2: Lead Data Collection & Email Automation

7-step workflow:
  1. load_leads        - Load all leads from leads.json
  2. deduplicate       - Remove duplicate emails (keep last)
  3. categorize        - Rule-based: Cold / Warm / Hot
  4. scrape_websites   - Scrape homepage text for Hot leads
  5. analyze_leads     - LLM scores Hot leads for travel industry fit
  6. assign_campaigns  - Assign to Campaign A/B/C or flag for Rupesh
  7. save_results      - Write updated leads back to leads.json
"""

import threading
import time
import uuid
import warnings
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup

from app.storage.json_db import JsonDB
from app.core.llm_provider import LLMConfig, call_llm_json, LLMError
from app.core.prompts import LEAD_ANALYSIS_SYSTEM, lead_analysis_user
from app.core.integrations import (
    KlentyConfig, IntegrationError, add_prospect_to_klenty,
    OutplayConfig, add_prospect_to_outplay,
)
from app.models import AgentRunStatus, StepStatus

# ─────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────

leads_db = JsonDB("app/data/leads.json")

# ─────────────────────────────────────────────────────────────
# Classification constants
# ─────────────────────────────────────────────────────────────

COLD_LOCAL_KEYWORDS = {
    "test", "dummy", "example", "fake", "temp", "temporary",
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "admin", "postmaster", "spam", "null", "void",
}

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "protonmail.com", "ymail.com",
    "live.com", "msn.com", "yahoo.co.in", "rediffmail.com",
    "mail.com", "inbox.com", "zohomail.com",
}

SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MarketingBot/1.0; +https://vervotech.com/bot)"
}

# ─────────────────────────────────────────────────────────────
# In-memory run state
# ─────────────────────────────────────────────────────────────

_run_lock = threading.Lock()
_run_state: Optional[AgentRunStatus] = None

STEP_DEFINITIONS = [
    (1, "load_leads"),
    (2, "deduplicate"),
    (3, "categorize"),
    (4, "scrape_websites"),
    (5, "analyze_leads"),
    (6, "assign_campaigns"),
    (7, "save_results"),
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_idle_state() -> AgentRunStatus:
    return AgentRunStatus(
        agent_id="agent2",
        run_id="",
        status="idle",
        steps=[
            StepStatus(step_number=n, name=name, status="pending")
            for n, name in STEP_DEFINITIONS
        ],
    )


def get_agent2_status() -> AgentRunStatus:
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
# Step Implementations
# ─────────────────────────────────────────────────────────────

def _step1_load_leads() -> list:
    """Load leads from JSON storage."""
    data = leads_db.read()
    # Ensure all leads have IDs
    for lead in data:
        if not lead.get("id"):
            lead["id"] = str(uuid.uuid4())
    return data


def _step2_deduplicate(leads: list) -> list:
    """Keep last occurrence of each email address (case-insensitive)."""
    seen = {}
    for lead in leads:
        key = lead.get("email", "").strip().lower()
        if key:
            seen[key] = lead  # later entries overwrite earlier ones
    return list(seen.values())


def _classify_lead(email: str, website: str) -> str:
    """Rule-based classification: Cold / Warm / Hot."""
    if not email:
        return "Cold"

    local = email.split("@")[0].lower()
    domain = email.split("@")[-1].lower() if "@" in email else ""
    has_website = bool(website and website.strip())

    # Cold: suspicious local part keywords
    if any(kw in local for kw in COLD_LOCAL_KEYWORDS):
        return "Cold"

    # Cold: free domain with no website
    is_free = domain in FREE_EMAIL_DOMAINS
    if is_free and not has_website:
        return "Cold"

    # Hot: business email with website
    if not is_free and has_website:
        return "Hot"

    # Warm: everything else
    return "Warm"


def _step3_categorize(leads: list) -> list:
    """Apply rule-based categorization to all leads."""
    for lead in leads:
        lead["category"] = _classify_lead(
            lead.get("email", ""),
            lead.get("website", "")
        )
    return leads


def _scrape_website(url: str) -> str:
    """
    Scrape homepage text. Returns empty string on any failure.
    Fault-isolated: never raises exceptions.
    """
    if not url:
        return ""
    try:
        # Suppress InsecureRequestWarning for sites with bad SSL certs
        warnings.filterwarnings("ignore", message="Unverified HTTPS request")
        if not url.startswith("http"):
            url = "https://" + url
        resp = requests.get(url, timeout=10, verify=False, headers=SCRAPE_HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove script and style tags
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        # Normalize whitespace
        import re
        text = re.sub(r"\s+", " ", text).strip()
        return text[:3000]
    except Exception:
        return ""


def _step4_scrape_websites(leads: list) -> dict:
    """Scrape websites for all Hot leads. Returns {email: scraped_text} dict."""
    website_texts = {}
    hot_leads = [l for l in leads if l.get("category") == "Hot" and l.get("website")]
    for lead in hot_leads:
        text = _scrape_website(lead["website"])
        website_texts[lead["email"].lower()] = text
    return website_texts


def _step5_analyze_leads(leads: list, website_texts: dict, config: LLMConfig) -> list:
    """Run AI analysis for Hot leads only."""
    for lead in leads:
        if lead.get("category") != "Hot":
            continue
        email_key = lead.get("email", "").lower()
        homepage_text = website_texts.get(email_key, "")
        try:
            result = call_llm_json(
                config,
                LEAD_ANALYSIS_SYSTEM,
                lead_analysis_user(lead.get("email", ""), lead.get("website", ""), homepage_text)
            )
            lead["score"] = int(result.get("score", 50))
            lead["industry_fit"] = bool(result.get("industry_fit", False))
            lead["company_type"] = result.get("company_type", "other")
            lead["reasoning"] = result.get("reasoning", "")
            lead["signals"] = result.get("signals", [])
            lead["concerns"] = result.get("concerns", [])
        except Exception as e:
            # Fallback: mark as average score
            lead["score"] = 50
            lead["industry_fit"] = False
            lead["company_type"] = "other"
            lead["reasoning"] = f"AI analysis failed: {str(e)[:100]}"
            lead["signals"] = []
            lead["concerns"] = []
        time.sleep(4)  # Throttle between per-lead LLM calls (free-tier RPM limit)
    return leads


def _step6_assign_campaigns(
    leads: list,
    klenty_config: Optional[KlentyConfig] = None,
    outplay_config: Optional[OutplayConfig] = None,
) -> tuple:
    """
    Assign each lead to a campaign based on category and AI score.
    If klenty_config or outplay_config is provided, auto-enroll leads.
    Returns (updated_leads, klenty_enrolled_count, outplay_enrolled_count).
    """
    now = _now()
    klenty_enrolled = 0
    outplay_enrolled = 0

    for lead in leads:
        category = lead.get("category", "Cold")
        score = lead.get("score", 0)

        if category == "Hot":
            if score > 70:
                lead["campaign"] = "A"
                lead["campaign_label"] = "Fit Client — Campaign A"
                klenty_campaign = klenty_config.campaign_a_name if klenty_config else "Campaign A"
                outplay_sequence = outplay_config.sequence_name_a if outplay_config else "Travel Fit Sequence"
            else:
                lead["campaign"] = "notify_rupesh"
                lead["campaign_label"] = "Not Fit — Notify Rupesh"
                klenty_campaign = None
                outplay_sequence = None
        elif category == "Warm":
            lead["campaign"] = "B"
            lead["campaign_label"] = "Warm Lead — Campaign B"
            klenty_campaign = klenty_config.campaign_b_name if klenty_config else "Campaign B"
            outplay_sequence = outplay_config.sequence_name_b if outplay_config else "Warm Lead Sequence"
        else:
            lead["campaign"] = "C"
            lead["campaign_label"] = "Cold Lead — Campaign C"
            klenty_campaign = klenty_config.campaign_c_name if klenty_config else "Campaign C"
            outplay_sequence = outplay_config.sequence_name_c if outplay_config else "Cold Lead Sequence"

        lead["processed_at"] = now
        lead["klenty_enrolled"] = False
        lead["outplay_enrolled"] = False

        # Auto-enroll in Klenty if config is provided and campaign applies
        if klenty_config and klenty_campaign:
            try:
                add_prospect_to_klenty(
                    klenty_config,
                    email=lead.get("email", ""),
                    name=lead.get("name"),
                    company=lead.get("company"),
                    campaign_name=klenty_campaign,
                )
                lead["klenty_enrolled"] = True
                klenty_enrolled += 1
            except IntegrationError:
                lead["klenty_enrolled"] = False
            except Exception:
                lead["klenty_enrolled"] = False

        # Auto-enroll in Outplay if config is provided and sequence applies
        if outplay_config and outplay_sequence:
            try:
                add_prospect_to_outplay(
                    outplay_config,
                    email=lead.get("email", ""),
                    name=lead.get("name"),
                    company=lead.get("company"),
                    sequence_name=outplay_sequence,
                )
                lead["outplay_enrolled"] = True
                outplay_enrolled += 1
            except IntegrationError:
                lead["outplay_enrolled"] = False
            except Exception:
                lead["outplay_enrolled"] = False

    return leads, klenty_enrolled, outplay_enrolled


def _step7_save_results(leads: list) -> None:
    """Write updated leads back to leads.json."""
    leads_db.write(leads)


# ─────────────────────────────────────────────────────────────
# Main Background Task
# ─────────────────────────────────────────────────────────────

def run_agent2_background(
    llm_config: LLMConfig,
    klenty_config: Optional[KlentyConfig] = None,
    outplay_config: Optional[OutplayConfig] = None,
) -> None:
    """
    Entry point for FastAPI BackgroundTasks.
    Runs all 7 steps synchronously; updates _run_state throughout.
    If klenty_config or outplay_config is provided, auto-enrolls qualified leads.
    """
    global _run_state

    run_id = str(uuid.uuid4())

    with _run_lock:
        _run_state = AgentRunStatus(
            agent_id="agent2",
            run_id=run_id,
            status="running",
            started_at=_now(),
            steps=[
                StepStatus(step_number=n, name=name, status="pending")
                for n, name in STEP_DEFINITIONS
            ],
        )

    leads = []

    try:
        # ── Step 1: Load leads ──────────────────────────────────────────
        _update_step(1, "running", "Loading leads from database...")
        leads = _step1_load_leads()
        _update_step(1, "completed", f"Loaded {len(leads)} leads")

        # ── Step 2: Deduplicate ─────────────────────────────────────────
        _update_step(2, "running", "Removing duplicate emails...")
        original_count = len(leads)
        leads = _step2_deduplicate(leads)
        removed = original_count - len(leads)
        _update_step(2, "completed", f"Removed {removed} duplicates. {len(leads)} unique leads")

        # ── Step 3: Categorize ──────────────────────────────────────────
        _update_step(3, "running", "Categorizing leads (Hot/Warm/Cold)...")
        leads = _step3_categorize(leads)
        hot = sum(1 for l in leads if l.get("category") == "Hot")
        warm = sum(1 for l in leads if l.get("category") == "Warm")
        cold = sum(1 for l in leads if l.get("category") == "Cold")
        _update_step(3, "completed", f"Hot: {hot}, Warm: {warm}, Cold: {cold}")

        # ── Step 4: Scrape websites ─────────────────────────────────────
        _update_step(4, "running", f"Scraping websites for {hot} Hot leads...")
        website_texts = _step4_scrape_websites(leads)
        scraped = sum(1 for v in website_texts.values() if v)
        _update_step(4, "completed", f"Scraped {scraped}/{hot} websites successfully")

        # ── Step 5: Analyze leads (AI) ──────────────────────────────────
        if hot > 0:
            _update_step(5, "running", f"AI-scoring {hot} Hot leads...")
            leads = _step5_analyze_leads(leads, website_texts, llm_config)
            fit = sum(1 for l in leads if l.get("industry_fit"))
            _update_step(5, "completed", f"{fit}/{hot} Hot leads are travel industry fit")
        else:
            _update_step(5, "skipped", "No Hot leads to analyze")

        # ── Step 6: Assign campaigns ────────────────────────────────────
        enroll_platforms = []
        if klenty_config:
            enroll_platforms.append("Klenty")
        if outplay_config:
            enroll_platforms.append("Outplay")
        enroll_note = f" + {' & '.join(enroll_platforms)} enroll" if enroll_platforms else ""
        _update_step(6, "running", f"Assigning leads to campaigns{enroll_note}...")
        leads, klenty_enrolled, outplay_enrolled = _step6_assign_campaigns(leads, klenty_config, outplay_config)
        fit_clients = sum(1 for l in leads if l.get("campaign") == "A")
        enroll_parts = []
        if klenty_config:
            enroll_parts.append(f"{klenty_enrolled} enrolled in Klenty")
        if outplay_config:
            enroll_parts.append(f"{outplay_enrolled} enrolled in Outplay")
        enroll_msg = ", " + ", ".join(enroll_parts) if enroll_parts else ""
        _update_step(6, "completed", f"{fit_clients} Fit Clients → Campaign A{enroll_msg}")

        # ── Step 7: Save results ────────────────────────────────────────
        _update_step(7, "running", "Saving results...")
        _step7_save_results(leads)
        _update_step(7, "completed", f"Saved {len(leads)} leads")

        _set_run_status("completed", result={
            "total_leads": len(leads),
            "hot": hot,
            "warm": warm,
            "cold": cold,
            "fit_clients": fit_clients,
            "websites_scraped": scraped,
            "klenty_enrolled": klenty_enrolled,
            "outplay_enrolled": outplay_enrolled,
        })

    except Exception as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            1
        ) if _run_state else 1
        _update_step(current_step, "failed", str(e)[:200])
        _set_run_status("failed", error=str(e)[:200])

"""
Agent 2: Lead Qualification & Email Automation

8-step workflow:
  1. load_leads        - Load all leads from leads.json (+ optional HubSpot fetch)
  2. deduplicate       - Remove duplicate emails (keep last)
  3. categorize        - Rule-based: Qualified / Nurture / Personal / Disqualified
  4. scrape_websites   - Scrape homepage text for Qualified leads
  5. analyze_leads     - LLM scores Qualified leads for ICP fit (Email/Website/ICP/Size/Engagement)
  6. assign_campaigns  - Qualified→Sequence A (score>70), Personal→Sequence B, Nurture→manual review
  7. extract_topics    - Seed relevant blog topics to Agent 1 from scraped content
  8. save_results      - Write updated leads back to leads.json

Lead categories (rule-based, Step 3):
  Qualified    - Business email + website exists → AI-scored in Step 5
  Nurture      - Business email but no website, OR Qualified with AI score ≤ 70 → Need Manual Attention
  Personal     - Free/consumer email (Gmail, Yahoo, Outlook, etc.) → Sequence B
  Disqualified - Fake/test/spam email or invalid domain → No outreach
"""

import logging
import threading
import time
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
from typing import Optional

import requests
from bs4 import BeautifulSoup

from app.storage.json_db import JsonDB
from app.core.llm_provider import LLMConfig, call_llm_json, LLMError
from app.core.prompts import (
    LEAD_ANALYSIS_SYSTEM, lead_analysis_user,
    TOPIC_EXTRACTION_SYSTEM, topic_extraction_user,
)
from app.core.integrations import (
    KlentyConfig, IntegrationError, add_prospect_to_klenty,
    OutplayConfig, add_prospect_to_outplay,
    HubSpotConfig, fetch_hubspot_contacts, add_contacts_to_hubspot_list,
)
from app.models import AgentRunStatus, StepStatus

# ─────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────

leads_db = JsonDB("app/data/leads.json")
topics_db = JsonDB("app/data/topics.json")   # shared with Agent 1 — seeds Pending topics

# ─────────────────────────────────────────────────────────────
# Classification constants
# ─────────────────────────────────────────────────────────────

DISQUALIFIED_LOCAL_KEYWORDS = {
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
    (7, "extract_topics"),
    (8, "save_results"),
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

def _step1_load_leads(hubspot_config: Optional[HubSpotConfig] = None) -> tuple:
    """
    Load leads from leads.json and optionally from HubSpot CRM.
    Returns (combined_leads, hs_fetched, hs_new_count, hs_existing_count, hubspot_error).
    hs_new_count   = HubSpot contacts whose email is NOT already in leads.json
    hs_existing_count = HubSpot contacts whose email IS already in leads.json (will be merged)
    """
    local_leads = leads_db.read()
    # Ensure all local leads have IDs
    for lead in local_leads:
        if not lead.get("id"):
            lead["id"] = str(uuid.uuid4())

    hubspot_leads = []
    hubspot_error = None
    hs_new_count = 0
    hs_existing_count = 0

    if hubspot_config:
        try:
            hubspot_leads = fetch_hubspot_contacts(hubspot_config)
            local_email_set = {l.get("email", "").strip().lower() for l in local_leads}
            for h in hubspot_leads:
                if (h.get("email") or "").strip().lower() in local_email_set:
                    hs_existing_count += 1
                else:
                    hs_new_count += 1
        except Exception as e:
            hubspot_error = str(e)
            logger.warning("HubSpot fetch failed: %s", hubspot_error)

    # Merge: local leads first, then HubSpot leads
    # Deduplication by email happens in step 2
    combined = local_leads + hubspot_leads
    return combined, len(hubspot_leads), hs_new_count, hs_existing_count, hubspot_error


_ANALYSIS_FIELDS = {
    "score", "industry_fit", "company_type", "reasoning", "signals", "concerns",
    "analysis_status", "campaign", "campaign_label",
    "klenty_enrolled", "klenty_enrolled_run_id", "klenty_enrolled_at",
    "outplay_enrolled", "outplay_enrolled_run_id", "outplay_enrolled_at",
    "processed_run_id", "processed_at",
}


def _step2_deduplicate(leads: list) -> list:
    """
    Deduplicate by email (case-insensitive).
    When the same email appears in both local DB and HubSpot:
      - Start with the incoming (HubSpot) record so any updated name/company/website is kept
      - Always preserve analysis/enrollment fields from the existing (local) record
      - Keep existing website/name/company if the incoming record has them empty
    This prevents HubSpot re-imports from wiping previously computed AI scores.
    """
    seen = {}
    for lead in leads:
        key = (lead.get("email") or "").strip().lower()
        if not key:
            continue
        if key not in seen:
            seen[key] = dict(lead)
        else:
            existing = seen[key]
            # Merge: incoming lead as base (fresher contact info from HubSpot)
            merged = dict(lead)
            # Preserve all analysis/enrollment fields from the existing (already-processed) record
            for field in _ANALYSIS_FIELDS:
                if existing.get(field) is not None:
                    merged[field] = existing[field]
            # Keep existing website/name/company if the incoming record is missing them
            for field in ("website", "name", "company"):
                if existing.get(field) and not lead.get(field):
                    merged[field] = existing[field]
            seen[key] = merged
    return list(seen.values())


def _classify_lead(email: str, website: str) -> str:
    """
    Rule-based classification: Qualified / Nurture / Personal / Disqualified.

    Qualified    — business email + website present (AI will score ICP fit in Step 5)
    Nurture      — business email but no website (unclear company info, needs manual review)
    Personal     — free/consumer email domain (Gmail, Yahoo, Outlook, etc.)
    Disqualified — fake, test, or spam-style email address
    """
    if not email:
        return "Disqualified"

    local = email.split("@")[0].lower()
    domain = email.split("@")[-1].lower() if "@" in email else ""
    has_website = bool(website and website.strip())

    # Disqualified: suspicious/test local part
    if any(kw in local for kw in DISQUALIFIED_LOCAL_KEYWORDS):
        return "Disqualified"

    # Personal: free/consumer email domain (Gmail, Yahoo, Outlook, etc.)
    is_free = domain in FREE_EMAIL_DOMAINS
    if is_free:
        return "Personal"

    # Qualified: business email + website present (AI will score ICP fit in Step 5)
    if has_website:
        return "Qualified"

    # Nurture: business email but no website — unclear company info, needs manual review
    return "Nurture"


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
    Scrape homepage text. Uses trafilatura as the primary extractor (handles JS-heavy
    and modern marketing sites better than raw HTML parsing), then falls back to
    requests + BeautifulSoup if trafilatura returns nothing meaningful.
    Returns empty string on any failure — never raises exceptions.
    """
    if not url:
        return ""
    try:
        if not url.startswith("http"):
            url = "https://" + url

        # ── Primary: trafilatura ──────────────────────────────────────────
        # favor_recall=True extracts more content from short marketing pages
        try:
            import trafilatura
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                text = trafilatura.extract(
                    downloaded,
                    include_comments=False,
                    include_tables=True,
                    favor_recall=True,
                )
                if text and len(text.strip()) > 100:
                    import re
                    text = re.sub(r"\s+", " ", text).strip()
                    logger.debug("trafilatura scraped %s (%d chars)", url, len(text))
                    return text[:3000]
        except ImportError:
            pass  # trafilatura not installed, go straight to fallback
        except Exception as e:
            logger.debug("trafilatura failed for %s: %s", url, str(e)[:100])

        # ── Fallback: requests + BeautifulSoup ───────────────────────────
        resp = requests.get(url, timeout=10, verify=True, headers=SCRAPE_HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        import re
        text = re.sub(r"\s+", " ", text).strip()
        logger.debug("bs4 fallback scraped %s (%d chars)", url, len(text))
        return text[:3000]

    except requests.exceptions.SSLError as e:
        logger.warning("SSL error scraping %s: %s", url, str(e)[:100])
        return ""
    except Exception as e:
        logger.debug("Failed to scrape %s: %s", url, str(e)[:100])
        return ""


def _step4_scrape_websites(leads: list) -> dict:
    """
    Scrape websites for Hot leads that have NOT yet been AI-analyzed.
    Already-completed leads are skipped — no need to re-scrape if we won't re-score.
    Returns {email: scraped_text} dict.
    """
    website_texts = {}
    new_qualified_leads = [
        l for l in leads
        if l.get("category") == "Qualified"
        and l.get("website")
        and l.get("analysis_status") != "completed"
    ]
    for lead in new_qualified_leads:
        text = _scrape_website(lead["website"])
        website_texts[lead["email"].lower()] = text
    return website_texts


def _step5_analyze_leads(leads: list, website_texts: dict, config: LLMConfig) -> list:
    """
    Run AI analysis for Hot leads only. Sets analysis_status on every lead.
    Skips leads already marked analysis_status='completed' — preserves existing scores.
    """
    for lead in leads:
        if lead.get("category") != "Qualified":
            # Only Qualified leads are AI-scored — all others are skipped
            lead["analysis_status"] = "skipped"
            lead.setdefault("score", None)
            lead.setdefault("industry_fit", None)
            lead.setdefault("company_type", None)
            cat = lead.get("category", "Unknown")
            if cat == "Personal":
                lead.setdefault("reasoning", "Not analysed — Personal email lead, enrolled in Personal Marktech Sequence")
            elif cat == "Nurture":
                lead.setdefault("reasoning", "Not analysed — no company website, flagged for manual review")
            elif cat == "Disqualified":
                lead.setdefault("reasoning", "Not analysed — disqualified (fake/test email)")
            else:
                lead.setdefault("reasoning", f"Not analysed — category: {cat}")
            lead.setdefault("signals", [])
            lead.setdefault("concerns", [])
            continue
        if lead.get("analysis_status") == "completed":
            # Already AI-scored in a previous run — no need to re-analyze
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
            lead["analysis_status"] = "completed"
        except Exception as e:
            # Fallback: mark as average score
            lead["score"] = 50
            lead["industry_fit"] = False
            lead["company_type"] = "other"
            lead["reasoning"] = f"AI analysis failed: {str(e)[:100]}"
            lead["signals"] = []
            lead["concerns"] = []
            lead["analysis_status"] = "failed"
        time.sleep(4)  # Throttle between per-lead LLM calls (free-tier RPM limit)
    return leads


def _step6_assign_campaigns(
    leads: list,
    run_id: str,
    klenty_config: Optional[KlentyConfig] = None,
    outplay_config: Optional[OutplayConfig] = None,
    hubspot_config: Optional[HubSpotConfig] = None,
) -> tuple:
    """
    Assign each lead to a campaign based on category and AI score.
    If klenty_config or outplay_config is provided, auto-enroll leads.
    If hubspot_config is provided (with list_id), batch-add qualified (Campaign A)
    HubSpot-sourced contacts to the configured Static list.
    Tags each enrolled lead with the run_id so enrollments can be traced per run.
    Returns (updated_leads, klenty_enrolled_count, outplay_enrolled_count, hubspot_list_added).
    """
    now = _now()
    klenty_enrolled = 0
    outplay_enrolled = 0

    for lead in leads:
        category = lead.get("category", "Disqualified")
        score = lead.get("score", 0)

        if category == "Qualified":
            if score > 70:
                # High-quality ICP match — enroll in Qualified Lead Marktech sequence
                lead["campaign"] = "A"
                lead["campaign_label"] = "Qualified Lead — Marktech Sequence"
                klenty_campaign = klenty_config.campaign_a_name if klenty_config else "Campaign A"
                outplay_sequence = outplay_config.sequence_id_a if outplay_config else ""
            else:
                # Business email + website but AI scored below ICP threshold → manual review
                lead["campaign"] = "nurture"
                lead["campaign_label"] = "Need Manual Attention"
                klenty_campaign = None
                outplay_sequence = None
        elif category == "Nurture":
            # Business email but no website — unclear company info
            lead["campaign"] = "nurture"
            lead["campaign_label"] = "Need Manual Attention"
            klenty_campaign = None
            outplay_sequence = None
        elif category == "Personal":
            # Free/consumer email — enroll in Personal Lead Marktech sequence
            lead["campaign"] = "B"
            lead["campaign_label"] = "Personal Lead — Marktech Sequence"
            klenty_campaign = klenty_config.campaign_b_name if klenty_config else "Campaign B"
            outplay_sequence = outplay_config.sequence_id_b if outplay_config else ""
        else:
            # Disqualified — fake/test email, no outreach
            lead["campaign"] = "disqualified"
            lead["campaign_label"] = "Disqualified — No Outreach"
            klenty_campaign = None
            outplay_sequence = None

        lead["processed_at"] = now
        lead["processed_run_id"] = run_id
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
                lead["klenty_enrolled_run_id"] = run_id
                lead["klenty_enrolled_at"] = now
                klenty_enrolled += 1
            except IntegrationError:
                lead["klenty_enrolled"] = False
            except Exception as e:
                logger.error("Unexpected error enrolling %s in Klenty: %s", lead.get("email"), str(e)[:100])
                lead["klenty_enrolled"] = False

        # Auto-enroll in Outplay if config is provided and sequence applies
        if outplay_config and outplay_sequence:
            try:
                add_prospect_to_outplay(
                    outplay_config,
                    email=lead.get("email", ""),
                    name=lead.get("name"),
                    company=lead.get("company"),
                    sequence_id=outplay_sequence,
                )
                lead["outplay_enrolled"] = True
                lead["outplay_enrolled_run_id"] = run_id
                lead["outplay_enrolled_at"] = now
                outplay_enrolled += 1
            except IntegrationError:
                lead["outplay_enrolled"] = False
            except Exception as e:
                logger.error("Unexpected error enrolling %s in Outplay: %s", lead.get("email"), str(e)[:100])
                lead["outplay_enrolled"] = False

    # ── Batch-add ALL qualified (Campaign A) leads to HubSpot Static list ──
    # Uses email-based matching — works for leads from any source (HubSpot, CSV, manual).
    # Contacts not found in HubSpot go to invalidEmails (non-fatal, just not added).
    hubspot_list_added = 0
    if hubspot_config and hubspot_config.list_id:
        campaign_a_leads = [
            lead for lead in leads
            if lead.get("campaign") == "A" and lead.get("email")
        ]
        campaign_a_emails = [lead["email"] for lead in campaign_a_leads]
        if campaign_a_emails:
            try:
                result = add_contacts_to_hubspot_list(hubspot_config, campaign_a_emails)
                hubspot_list_added = result.get("added", 0)
                invalid_emails = result.get("invalid_emails", set())
                if result.get("invalid", 0):
                    logger.warning(
                        "HubSpot list add: %d emails not found in HubSpot CRM (skipped)",
                        result["invalid"],
                    )
                # Mark each lead individually so the UI can show per-row status
                for lead in campaign_a_leads:
                    if (lead["email"] or "").lower() not in invalid_emails:
                        lead["hubspot_list_added"] = True
                        lead["hubspot_list_added_run_id"] = run_id
                        lead["hubspot_list_added_at"] = now
                    else:
                        lead.setdefault("hubspot_list_added", False)
            except IntegrationError as e:
                logger.warning("HubSpot list batch add failed: %s", str(e)[:200])
            except Exception as e:
                logger.error("Unexpected error adding leads to HubSpot list: %s", str(e)[:100])

    return leads, klenty_enrolled, outplay_enrolled, hubspot_list_added


def _step7_extract_topics(leads: list, website_texts: dict, llm_config: LLMConfig) -> dict:
    """
    For each Qualified lead where industry_fit=True (confirmed travel/hospitality company),
    use the LLM to extract potential Vervotech blog topics and seed them into topics.json
    (Agent 1's Pending queue). Skips exact-title duplicates.

    Only travel-relevant leads (industry_fit=True) are processed — leads where the AI
    determined the company has no meaningful travel/hospitality connection are excluded.
    Sorted by ICP score descending so the best matches are processed first.
    Processes at most 5 leads to keep run time bounded.
    Returns {added, skipped, processed} summary.
    """
    existing = topics_db.read()
    existing_titles = {t.get("topic", "").lower().strip() for t in existing}

    candidates = sorted(
        [
            l for l in leads
            if l.get("analysis_status") == "completed"
            and l.get("industry_fit") is True          # only confirmed travel/hospitality companies
            and website_texts.get((l.get("email") or "").lower())
        ],
        key=lambda x: (x.get("score") or 0),
        reverse=True,                                  # highest ICP score leads processed first
    )[:5]  # cap at 5 to limit LLM API calls

    added, skipped = 0, 0
    for lead in candidates:
        email = (lead.get("email") or "").lower()
        text = website_texts.get(email, "")
        if not text:
            continue
        try:
            time.sleep(4)
            result = call_llm_json(
                llm_config,
                TOPIC_EXTRACTION_SYSTEM,
                topic_extraction_user(lead.get("website", ""), text),
            )
            for item in result.get("topics", []):
                title = (item.get("topic") or "").strip()
                if not title or title.lower() in existing_titles:
                    skipped += 1
                    continue
                topics_db.append({
                    "id": str(uuid.uuid4()),
                    "topic": title,
                    "status": "Pending",
                    "created_at": _now(),
                    "source": "web_scrape",
                    "source_company": lead.get("website", ""),
                    "source_lead_email": email,
                    "llm_relevance": item.get("relevance", ""),
                    "relevance_score": item.get("relevance_score", 0),
                })
                existing_titles.add(title.lower())
                added += 1
        except Exception as e:
            logger.warning("Topic extraction failed for %s: %s", email, str(e)[:100])

    return {"added": added, "skipped": skipped, "processed": len(candidates)}


def _step8_save_results(leads: list) -> None:
    """Write updated leads back to leads.json."""
    leads_db.write(leads)


# ─────────────────────────────────────────────────────────────
# Main Background Task
# ─────────────────────────────────────────────────────────────

def run_agent2_background(
    llm_config: LLMConfig,
    klenty_config: Optional[KlentyConfig] = None,
    outplay_config: Optional[OutplayConfig] = None,
    hubspot_config: Optional[HubSpotConfig] = None,
) -> None:
    """
    Entry point for FastAPI BackgroundTasks.
    Runs all 8 steps synchronously; updates _run_state throughout.
    If klenty_config or outplay_config is provided, auto-enrolls qualified leads.
    Step 7 seeds relevant blog topics to Agent 1's pending queue.
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
        source_note = " + HubSpot CRM" if hubspot_config else ""
        _update_step(1, "running", f"Loading leads from database{source_note}...")
        leads, hs_count, hs_new_count, hs_existing_count, hs_error = _step1_load_leads(hubspot_config)
        if hs_error:
            msg = f"Loaded {len(leads)} leads (leads.json only — HubSpot failed: {hs_error[:80]})"
        elif hubspot_config and hs_count > 0:
            local_count = len(leads) - hs_count
            if hs_new_count == 0:
                hs_note = f"{hs_count} from HubSpot — 0 new, all {hs_existing_count} already in DB (will be merged)"
            else:
                hs_note = f"{hs_count} from HubSpot — {hs_new_count} new, {hs_existing_count} already in DB"
            msg = f"Loaded {len(leads)} leads: {local_count} from leads.json, {hs_note}"
        elif hubspot_config:
            msg = f"Loaded {len(leads)} leads from leads.json (HubSpot returned 0 contacts)"
        else:
            msg = f"Loaded {len(leads)} leads from leads.json"
        _update_step(1, "completed", msg)

        # ── Step 2: Deduplicate ─────────────────────────────────────────
        _update_step(2, "running", "Removing duplicate emails...")
        original_count = len(leads)
        leads = _step2_deduplicate(leads)
        removed = original_count - len(leads)
        _update_step(2, "completed", f"Removed {removed} duplicates. {len(leads)} unique leads")

        # ── Step 3: Categorize ──────────────────────────────────────────
        _update_step(3, "running", "Categorizing leads (Qualified / Nurture / Personal / Disqualified)...")
        leads = _step3_categorize(leads)
        qualified = sum(1 for l in leads if l.get("category") == "Qualified")
        nurture = sum(1 for l in leads if l.get("category") == "Nurture")
        personal = sum(1 for l in leads if l.get("category") == "Personal")
        disqualified = sum(1 for l in leads if l.get("category") == "Disqualified")
        _update_step(3, "completed", f"Qualified: {qualified}, Nurture: {nurture}, Personal: {personal}, Disqualified: {disqualified}")

        # ── Step 4: Scrape websites ─────────────────────────────────────
        already_analyzed = sum(1 for l in leads if l.get("category") == "Qualified" and l.get("analysis_status") == "completed")
        new_qualified = qualified - already_analyzed
        skip_note = f" ({already_analyzed} already analysed, skipped)" if already_analyzed else ""
        _update_step(4, "running", f"Scraping websites for {new_qualified} new Qualified leads{skip_note}...")
        website_texts = _step4_scrape_websites(leads)
        scraped = sum(1 for v in website_texts.values() if v)
        _update_step(4, "completed", f"Scraped {scraped}/{new_qualified} Qualified lead websites{skip_note}")

        # ── Step 5: Analyze leads (AI) ──────────────────────────────────
        if new_qualified > 0:
            _update_step(5, "running", f"AI-scoring {new_qualified} new Qualified leads for ICP fit{skip_note}...")
            leads = _step5_analyze_leads(leads, website_texts, llm_config)
            fit = sum(1 for l in leads if l.get("industry_fit"))
            _update_step(5, "completed", f"{fit}/{new_qualified} Qualified leads match ICP criteria (score > 70){skip_note}")
        elif qualified > 0:
            leads = _step5_analyze_leads(leads, website_texts, llm_config)
            _update_step(5, "skipped", f"All {qualified} Qualified leads already analysed — skipped")
        else:
            _update_step(5, "skipped", "No Qualified leads to analyze")

        # ── Step 6: Assign campaigns ────────────────────────────────────
        enroll_platforms = []
        if klenty_config:
            enroll_platforms.append("Klenty")
        if outplay_config:
            enroll_platforms.append("Outplay")
        if hubspot_config and hubspot_config.list_id:
            enroll_platforms.append(f"HubSpot list {hubspot_config.list_id}")
        enroll_note = f" + {' & '.join(enroll_platforms)} enroll" if enroll_platforms else ""
        _update_step(6, "running", f"Enrolling leads — Qualified→Sequence A, Personal→Sequence B, Nurture→manual review{enroll_note}...")
        leads, klenty_enrolled, outplay_enrolled, hubspot_list_added = _step6_assign_campaigns(
            leads, run_id, klenty_config, outplay_config, hubspot_config
        )
        seq_a_count = sum(1 for l in leads if l.get("campaign") == "A")
        seq_b_count = sum(1 for l in leads if l.get("campaign") == "B")
        nurture_count = sum(1 for l in leads if l.get("campaign") == "nurture")
        disqualified_count = sum(1 for l in leads if l.get("campaign") == "disqualified")
        enroll_parts = []
        if klenty_config:
            enroll_parts.append(f"{klenty_enrolled} enrolled in Klenty")
        if outplay_config:
            enroll_parts.append(f"{outplay_enrolled} enrolled in Outplay")
        if hubspot_config and hubspot_config.list_id:
            enroll_parts.append(f"{hubspot_list_added} added to HubSpot list {hubspot_config.list_id}")
        enroll_msg = ", " + ", ".join(enroll_parts) if enroll_parts else ""
        _update_step(6, "completed", f"{seq_a_count} Qualified → Sequence A, {seq_b_count} Personal → Sequence B, {nurture_count} Nurture flagged for manual review{enroll_msg}")

        # ── Step 7: Extract topics for Agent 1 ─────────────────────────
        travel_leads = sum(1 for l in leads if l.get("industry_fit") is True)
        _update_step(7, "running", f"Extracting blog topics from {travel_leads} confirmed travel-relevant lead{'' if travel_leads == 1 else 's'} for Agent 1 (up to 5 processed)...")
        topic_summary = _step7_extract_topics(leads, website_texts, llm_config)
        topic_msg = f"Seeded {topic_summary['added']} new blog topics to Agent 1"
        if topic_summary['skipped']:
            topic_msg += f" ({topic_summary['skipped']} duplicates skipped)"
        topic_msg += f" from {topic_summary['processed']} analyzed leads."
        _update_step(7, "completed", topic_msg)

        # ── Step 8: Save results ────────────────────────────────────────
        _update_step(8, "running", "Saving results...")
        _step8_save_results(leads)
        _update_step(8, "completed", f"Saved {len(leads)} leads")

        _set_run_status("completed", result={
            "total_leads": len(leads),
            "qualified_initial": qualified,
            "nurture_initial": nurture,
            "personal": personal,
            "disqualified": disqualified,
            "sequence_a_enrolled": seq_a_count,
            "sequence_b_enrolled": seq_b_count,
            "nurture_manual_review": nurture_count,
            "websites_scraped": scraped,
            "outplay_enrolled": outplay_enrolled,
        })

    except Exception as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            1
        ) if _run_state else 1
        _update_step(current_step, "failed", str(e)[:200])
        _set_run_status("failed", error=str(e)[:200])

"""
Agent 4: Analytics & Reporting

6-step workflow:
  1. aggregate_data        - Reads all data from topics, blogs, leads, outreach_targets
  2. ai_analysis           - LLM generates funnel insights, conversion metrics, recommendations
  3. generate_report       - Builds structured report JSON with all metrics
  4. create_visualizations - Generates chart-ready JSON data for frontend rendering
  5. send_pdf_report       - LLM writes executive summary; saves full report
  6. update_power_bi       - Graceful stub: queues update, awaits Power BI credentials
"""

import json
import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

from app.storage.json_db import JsonDB
from app.core.llm_provider import LLMConfig, call_llm_json, LLMError
from app.core.prompts import (
    REPORT_ANALYSIS_SYSTEM, report_analysis_user,
    EXECUTIVE_SUMMARY_SYSTEM, executive_summary_user,
)
from app.models import AgentRunStatus, StepStatus

# ─────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────

topics_db = JsonDB("app/data/topics.json")
blogs_db = JsonDB("app/data/blogs.json")
leads_db = JsonDB("app/data/leads.json")
outreach_db = JsonDB("app/data/outreach_targets.json")
reports_db = JsonDB("app/data/reports.json")

# ─────────────────────────────────────────────────────────────
# In-memory run state
# ─────────────────────────────────────────────────────────────

_run_lock = threading.Lock()
_run_state: Optional[AgentRunStatus] = None

STEP_DEFINITIONS = [
    (1, "aggregate_data"),
    (2, "ai_analysis"),
    (3, "generate_report"),
    (4, "create_visualizations"),
    (5, "send_pdf_report"),
    (6, "update_power_bi"),
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_idle_state() -> AgentRunStatus:
    return AgentRunStatus(
        agent_id="agent4",
        run_id="",
        status="idle",
        steps=[
            StepStatus(step_number=n, name=name, status="pending")
            for n, name in STEP_DEFINITIONS
        ],
    )


def get_agent4_status() -> AgentRunStatus:
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
# Utility
# ─────────────────────────────────────────────────────────────

def get_reports() -> list:
    """Read all reports from storage."""
    return reports_db.read()


# ─────────────────────────────────────────────────────────────
# Step Implementations
# ─────────────────────────────────────────────────────────────

def _step1_aggregate_data() -> dict:
    """Read and aggregate all data from all agent databases."""
    topics = topics_db.read()
    blogs = blogs_db.read()
    leads = leads_db.read()
    outreach = outreach_db.read()

    # Compute derived metrics
    published_blogs = [b for b in blogs if b.get("blog_url")]
    avg_quality = (
        sum(b.get("quality_score", 0) for b in blogs) / len(blogs)
        if blogs else 0
    )

    lead_categories = {}
    lead_campaigns = {}
    klenty_enrolled = 0
    for lead in leads:
        cat = lead.get("category", "Unknown")
        lead_categories[cat] = lead_categories.get(cat, 0) + 1
        camp = lead.get("campaign", "Unknown")
        lead_campaigns[camp] = lead_campaigns.get(camp, 0) + 1
        if lead.get("klenty_enrolled"):
            klenty_enrolled += 1

    fit_clients = sum(1 for l in leads if l.get("campaign") == "A")
    avg_lead_score = (
        sum(l.get("score", 0) for l in leads if l.get("score")) / len(leads)
        if leads else 0
    )

    outreach_approved = sum(1 for t in outreach if t.get("status") == "approved")
    outreach_enrolled = sum(1 for t in outreach if t.get("klenty_enrolled"))
    outreach_pending = sum(1 for t in outreach if t.get("status") == "pending_approval")

    return {
        "summary": {
            "total_leads": len(leads),
            "hot_leads": lead_categories.get("Hot", 0),
            "warm_leads": lead_categories.get("Warm", 0),
            "cold_leads": lead_categories.get("Cold", 0),
            "fit_clients": fit_clients,
            "avg_lead_score": round(avg_lead_score, 1),
            "klenty_enrolled_leads": klenty_enrolled,
            "total_topics": len(topics),
            "published_blogs": len(published_blogs),
            "avg_blog_quality": round(avg_quality, 1),
            "total_outreach_targets": len(outreach),
            "outreach_approved": outreach_approved,
            "outreach_enrolled": outreach_enrolled,
            "outreach_pending": outreach_pending,
        },
        "lead_campaigns": lead_campaigns,
        "lead_categories": lead_categories,
        "recent_blogs": [
            {
                "title": b.get("title", ""),
                "quality_score": b.get("quality_score", 0),
                "url": b.get("blog_url", ""),
                "created_at": b.get("created_at", ""),
            }
            for b in sorted(blogs, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
        ],
    }


def _step2_ai_analysis(aggregated: dict, config: LLMConfig) -> dict:
    """Run LLM analysis on aggregated data to produce insights."""
    try:
        data_str = json.dumps(aggregated, indent=2)
        result = call_llm_json(
            config,
            REPORT_ANALYSIS_SYSTEM,
            report_analysis_user(data_str),
        )
        return result if isinstance(result, dict) else {}
    except Exception as e:
        logger.warning("AI analysis failed, using fallback: %s", str(e)[:100])
        # Fallback: generate basic analysis from raw data
        summary = aggregated.get("summary", {})
        total = summary.get("total_leads", 0)
        fit = summary.get("fit_clients", 0)
        blogs = summary.get("published_blogs", 0)
        conv_rate = round((fit / total * 100), 1) if total > 0 else 0
        return {
            "funnel_summary": {
                "total_leads": total,
                "hot_leads": summary.get("hot_leads", 0),
                "warm_leads": summary.get("warm_leads", 0),
                "cold_leads": summary.get("cold_leads", 0),
                "fit_clients": fit,
                "outreach_targets": summary.get("total_outreach_targets", 0),
                "klenty_enrolled": summary.get("klenty_enrolled_leads", 0),
                "blogs_published": blogs,
                "conversion_rate_pct": conv_rate,
            },
            "top_performing_content": aggregated.get("recent_blogs", []),
            "campaign_distribution": aggregated.get("lead_campaigns", {}),
            "key_insights": [
                f"Total of {total} leads processed with {fit} qualifying as fit clients.",
                f"Content pipeline published {blogs} blogs with avg quality score {summary.get('avg_blog_quality', 0)}.",
                f"Overall lead-to-fit conversion rate: {conv_rate}%.",
            ],
            "recommendations": [
                "Focus outreach on Hot leads with score > 70 for highest conversion.",
                "Increase blog publishing frequency to improve organic traffic.",
                "Review and approve pending outreach targets in Agent 3.",
            ],
            "health_score": min(100, int(conv_rate + 30)),
            "health_rating": "Good" if conv_rate > 20 else "Needs Attention",
        }


def _step3_generate_report(run_id: str, aggregated: dict, analysis: dict) -> dict:
    """Build the full structured report and save to reports.json."""
    report = {
        "id": run_id,
        "generated_at": _now(),
        "status": "draft",
        "aggregated": aggregated.get("summary", {}),
        "analysis": analysis,
        "funnel_summary": analysis.get("funnel_summary", {}),
        "campaign_distribution": analysis.get("campaign_distribution", {}),
        "key_insights": analysis.get("key_insights", []),
        "recommendations": analysis.get("recommendations", []),
        "health_score": analysis.get("health_score", 50),
        "health_rating": analysis.get("health_rating", "Unknown"),
        "top_content": analysis.get("top_performing_content", []),
        "executive_summary": "",  # filled in step 5
        "one_liner": "",          # filled in step 5
        "visualizations": {},     # filled in step 4
    }
    reports_db.append(report)
    return report


def _step4_create_visualizations(aggregated: dict, analysis: dict) -> dict:
    """Generate chart-ready JSON data structures for frontend rendering."""
    funnel = analysis.get("funnel_summary", {})
    summary = aggregated.get("summary", {})

    visualizations = {
        "lead_funnel": {
            "type": "bar",
            "labels": ["Total Leads", "Hot", "Fit Clients", "Klenty Enrolled"],
            "data": [
                summary.get("total_leads", 0),
                summary.get("hot_leads", 0),
                funnel.get("fit_clients", 0),
                summary.get("klenty_enrolled_leads", 0),
            ],
        },
        "campaign_distribution": {
            "type": "pie",
            "labels": ["Campaign A (Fit)", "Campaign B (Warm)", "Campaign C (Cold)", "Not Fit"],
            "data": [
                aggregated.get("lead_campaigns", {}).get("A", 0),
                aggregated.get("lead_campaigns", {}).get("B", 0),
                aggregated.get("lead_campaigns", {}).get("C", 0),
                aggregated.get("lead_campaigns", {}).get("notify_rupesh", 0),
            ],
        },
        "lead_categories": {
            "type": "donut",
            "labels": ["Hot", "Warm", "Cold"],
            "data": [
                summary.get("hot_leads", 0),
                summary.get("warm_leads", 0),
                summary.get("cold_leads", 0),
            ],
        },
        "content_quality": {
            "type": "bar",
            "labels": [b.get("title", "Blog")[:30] for b in aggregated.get("recent_blogs", [])[:5]],
            "data": [b.get("quality_score", 0) for b in aggregated.get("recent_blogs", [])[:5]],
        },
    }
    return visualizations


def _step5_send_pdf_report(run_id: str, analysis: dict, config: LLMConfig) -> tuple:
    """
    Generate executive summary via LLM and finalize the report.
    Returns (executive_summary, one_liner).
    """
    try:
        analysis_str = json.dumps(analysis, indent=2)
        result = call_llm_json(
            config,
            EXECUTIVE_SUMMARY_SYSTEM,
            executive_summary_user(analysis_str),
        )
        executive_summary = result.get("executive_summary", "")
        one_liner = result.get("one_liner", "")
    except Exception as e:
        logger.warning("Executive summary generation failed, using fallback: %s", str(e)[:100])
        # Fallback summary
        funnel = analysis.get("funnel_summary", {})
        executive_summary = (
            f"This reporting period saw {funnel.get('total_leads', 0)} leads processed "
            f"with {funnel.get('fit_clients', 0)} qualifying as fit clients "
            f"({funnel.get('conversion_rate_pct', 0)}% conversion rate). "
            f"The content pipeline published {funnel.get('blogs_published', 0)} blogs. "
            f"Overall platform health: {analysis.get('health_rating', 'Good')}."
        )
        one_liner = f"Processed {funnel.get('total_leads', 0)} leads with {funnel.get('fit_clients', 0)} fit clients."

    # Update the report record with executive summary
    reports = reports_db.read()
    for r in reports:
        if r.get("id") == run_id:
            r["executive_summary"] = executive_summary
            r["one_liner"] = one_liner
            r["status"] = "complete"
            break
    reports_db.write(reports)

    return executive_summary, one_liner


def _step6_update_power_bi(run_id: str) -> str:
    """
    Graceful stub for Power BI dashboard update.
    Marks as completed with informational message.
    """
    # Update report record to note Power BI status
    reports = reports_db.read()
    for r in reports:
        if r.get("id") == run_id:
            r["power_bi_status"] = "queued_no_credentials"
            break
    reports_db.write(reports)
    return "Power BI update queued — connect Power BI credentials in Settings to enable auto-push"


# ─────────────────────────────────────────────────────────────
# Main Background Task
# ─────────────────────────────────────────────────────────────

def run_agent4_background(llm_config: LLMConfig) -> None:
    """
    Entry point for FastAPI BackgroundTasks.
    Runs all 6 steps synchronously; updates _run_state throughout.
    """
    global _run_state

    run_id = str(uuid.uuid4())

    with _run_lock:
        _run_state = AgentRunStatus(
            agent_id="agent4",
            run_id=run_id,
            status="running",
            started_at=_now(),
            steps=[
                StepStatus(step_number=n, name=name, status="pending")
                for n, name in STEP_DEFINITIONS
            ],
        )

    aggregated = {}
    analysis = {}
    visualizations = {}
    exec_summary = ""

    try:
        # ── Step 1: Aggregate data ───────────────────────────────────────
        _update_step(1, "running", "Reading data from all agent databases...")
        aggregated = _step1_aggregate_data()
        summary = aggregated.get("summary", {})
        _update_step(
            1, "completed",
            f"Aggregated: {summary.get('total_leads', 0)} leads, "
            f"{summary.get('published_blogs', 0)} blogs, "
            f"{summary.get('total_outreach_targets', 0)} outreach targets"
        )

        # ── Step 2: AI analysis ─────────────────────────────────────────
        _update_step(2, "running", f"Running AI analysis with {llm_config.model}...")
        analysis = _step2_ai_analysis(aggregated, llm_config)
        health = analysis.get("health_rating", "Unknown")
        conv_rate = analysis.get("funnel_summary", {}).get("conversion_rate_pct", 0)
        _update_step(2, "completed", f"Analysis complete — Health: {health}, Conversion: {conv_rate}%")
        time.sleep(3)

        # ── Step 3: Generate report ──────────────────────────────────────
        _update_step(3, "running", "Building structured performance report...")
        report = _step3_generate_report(run_id, aggregated, analysis)
        _update_step(3, "completed", f"Report generated (ID: {run_id[:8]}...)")

        # ── Step 4: Create visualizations ───────────────────────────────
        _update_step(4, "running", "Generating chart data for dashboard...")
        visualizations = _step4_create_visualizations(aggregated, analysis)

        # Save visualizations back to report
        reports = reports_db.read()
        for r in reports:
            if r.get("id") == run_id:
                r["visualizations"] = visualizations
                break
        reports_db.write(reports)

        _update_step(4, "completed", "4 chart datasets created (funnel, campaigns, categories, content quality)")

        # ── Step 5: Send PDF report ──────────────────────────────────────
        _update_step(5, "running", "Generating executive summary...")
        exec_summary, one_liner = _step5_send_pdf_report(run_id, analysis, llm_config)
        _update_step(5, "completed", f"Report finalized — {one_liner[:100] if one_liner else 'Summary saved'}")
        time.sleep(3)

        # ── Step 6: Update Power BI ──────────────────────────────────────
        _update_step(6, "running", "Checking Power BI configuration...")
        pbi_msg = _step6_update_power_bi(run_id)
        _update_step(6, "completed", pbi_msg)

        _set_run_status("completed", result={
            "report_id": run_id,
            "health_rating": analysis.get("health_rating", ""),
            "health_score": analysis.get("health_score", 0),
            "total_leads": summary.get("total_leads", 0),
            "fit_clients": summary.get("fit_clients", 0),
            "blogs_published": summary.get("published_blogs", 0),
            "conversion_rate": conv_rate,
            "one_liner": exec_summary[:150] if exec_summary else "",
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

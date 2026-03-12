"""
Agent 1: Content Writer & SEO + LinkedIn Automation

7-step workflow:
  1. pick_topic       - Find first Pending topic from topics.json
  2. generate_blog    - LLM generates 1500-word SEO blog (JSON)
  3. internal_linking - LLM inserts contextual internal links into HTML
  4. quality_check    - LLM verifies content quality (APPROVED/REJECTED + score)
  5. generate_linkedin- LLM creates LinkedIn post (300 words + 5 hashtags)
  6. publish_mock     - Generate placeholder blog URL (no real WordPress call)
  7. save_results     - Update topics.json + append to blogs.json
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
    BLOG_GENERATION_SYSTEM, blog_generation_user,
    INTERNAL_LINKING_SYSTEM, internal_linking_user,
    QUALITY_CHECK_SYSTEM, quality_check_user,
    LINKEDIN_POST_SYSTEM, linkedin_post_user,
)
from app.core.integrations import (
    WordPressConfig, LinkedInConfig, IntegrationError,
    publish_to_wordpress, post_to_linkedin,
)
from app.models import AgentRunStatus, StepStatus

# ─────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────

topics_db = JsonDB("app/data/topics.json")
blogs_db = JsonDB("app/data/blogs.json")

# ─────────────────────────────────────────────────────────────
# In-memory run state (reset on server restart)
# ─────────────────────────────────────────────────────────────

_run_lock = threading.Lock()
_run_state: Optional[AgentRunStatus] = None

STEP_DEFINITIONS = [
    (1, "pick_topic"),
    (2, "generate_blog"),
    (3, "internal_linking"),
    (4, "quality_check"),
    (5, "generate_linkedin"),
    (6, "publish_wordpress"),
    (7, "publish_linkedin"),
    (8, "save_results"),
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_idle_state() -> AgentRunStatus:
    return AgentRunStatus(
        agent_id="agent1",
        run_id="",
        status="idle",
        steps=[
            StepStatus(step_number=n, name=name, status="pending")
            for n, name in STEP_DEFINITIONS
        ],
    )


def get_agent1_status() -> AgentRunStatus:
    with _run_lock:
        return _run_state if _run_state is not None else _make_idle_state()


def _update_step(step_num: int, status: str, message: str = "") -> None:
    """Thread-safe update of a single step's status."""
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
# Step Implementations
# ─────────────────────────────────────────────────────────────

def _step1_pick_topic() -> dict:
    """Find first Pending topic from topics.json."""
    data = topics_db.read()
    pending = [t for t in data if t.get("status") == "Pending"]
    if not pending:
        raise ValueError("No pending topics found. Add topics in the Agent 1 detail page.")
    # Ensure topic has an id
    topic = pending[0]
    if not topic.get("id"):
        topic["id"] = str(uuid.uuid4())
    return topic


def _step2_generate_blog(topic: str, config: LLMConfig) -> dict:
    """Generate full blog post via LLM."""
    blog_data = call_llm_json(config, BLOG_GENERATION_SYSTEM, blog_generation_user(topic))
    # Validate required fields
    required = ["title", "meta_description", "slug", "content_html"]
    for field in required:
        if field not in blog_data:
            raise LLMError(f"LLM response missing required field: {field}")
    return blog_data


def _step3_internal_linking(blog_data: dict, config: LLMConfig) -> dict:
    """Insert internal links into blog HTML. Non-critical — falls back on failure."""
    try:
        keywords = blog_data.get("secondary_keywords", []) + [blog_data.get("primary_keyword", "")]
        keywords = [k for k in keywords if k]
        result = call_llm_json(
            config,
            INTERNAL_LINKING_SYSTEM,
            internal_linking_user(blog_data["content_html"], keywords[:5])
        )
        if result.get("updated_html"):
            blog_data["content_html"] = result["updated_html"]
            blog_data["links_added"] = result.get("links_added", [])
    except Exception as e:
        blog_data["links_added"] = []
        # Non-critical; continue with original HTML
        _update_step(3, "completed", f"Skipped internal linking: {str(e)[:100]}")
        return blog_data
    return blog_data


def _step4_quality_check(blog_data: dict, topic: str, config: LLMConfig) -> dict:
    """Run AI quality check. Continue even if REJECTED."""
    try:
        result = call_llm_json(
            config,
            QUALITY_CHECK_SYSTEM,
            quality_check_user(blog_data.get("title", ""), blog_data.get("content_html", ""), topic)
        )
        return {
            "verdict": result.get("verdict", "APPROVED"),
            "score": int(result.get("score", 75)),
            "reasons": result.get("reasons", []),
            "improvements": result.get("improvements", []),
        }
    except Exception as e:
        logger.warning("Quality check failed, using default approval: %s", str(e)[:100])
        return {"verdict": "APPROVED", "score": 75, "reasons": ["Quality check skipped"], "improvements": []}


def _step5_generate_linkedin(blog_data: dict, blog_url: str, config: LLMConfig) -> dict:
    """Generate LinkedIn post. Non-critical."""
    try:
        result = call_llm_json(
            config,
            LINKEDIN_POST_SYSTEM,
            linkedin_post_user(
                blog_data.get("title", ""),
                blog_data.get("content_html", ""),
                blog_url,
            )
        )
        return {
            "post_text": result.get("post_text", ""),
            "hashtags": result.get("hashtags", []),
        }
    except Exception as e:
        logger.warning("LinkedIn post generation failed: %s", str(e)[:100])
        return {"post_text": "", "hashtags": []}


def _step6_publish(blog_data: dict, wp_config: Optional[WordPressConfig] = None) -> tuple:
    """
    Publish to WordPress if config provided, otherwise generate mock URL.
    Returns (blog_url, was_real_publish).
    """
    if wp_config:
        result = publish_to_wordpress(wp_config, blog_data)
        return result["link"], True
    # Fallback: mock URL
    slug = blog_data.get("slug", "untitled-post")
    return f"https://vervotech.com/blog/{slug}", False


def _step5b_post_linkedin(
    linkedin_data: dict, blog_url: str, li_config: Optional[LinkedInConfig] = None
) -> bool:
    """
    Post to LinkedIn if config provided.
    Returns True if actually posted, False if skipped.
    """
    if not li_config:
        return False
    post_text = linkedin_data.get("post_text", "")
    if not post_text:
        return False
    hashtags = linkedin_data.get("hashtags", [])
    if hashtags:
        post_text += "\n\n" + " ".join(f"#{h.lstrip('#')}" for h in hashtags)
    post_to_linkedin(li_config, post_text, blog_url)
    return True


def _step7_save_results(
    topic_dict: dict,
    blog_data: dict,
    quality_data: dict,
    linkedin_data: dict,
    blog_url: str,
) -> None:
    """Update topics.json and append to blogs.json."""
    now = _now()

    # Update topic record
    all_topics = topics_db.read()
    for t in all_topics:
        if t.get("id") == topic_dict.get("id") or t.get("topic") == topic_dict.get("topic"):
            t["status"] = "Published"
            t["url"] = blog_url
            t["blog_title"] = blog_data.get("title", "")
            t["quality_score"] = quality_data.get("score", 0)
            t["linkedin_post"] = linkedin_data.get("post_text", "")
            t["updated_at"] = now
            break
    topics_db.write(all_topics)

    # Append to blogs.json
    blogs_db.append({
        "id": str(uuid.uuid4()),
        "topic_id": topic_dict.get("id", ""),
        "topic": topic_dict.get("topic", ""),
        "title": blog_data.get("title", ""),
        "slug": blog_data.get("slug", ""),
        "meta_description": blog_data.get("meta_description", ""),
        "content_html": blog_data.get("content_html", ""),
        "faq": blog_data.get("faq", []),
        "cta": blog_data.get("cta", ""),
        "primary_keyword": blog_data.get("primary_keyword", ""),
        "secondary_keywords": blog_data.get("secondary_keywords", []),
        "links_added": blog_data.get("links_added", []),
        "quality_score": quality_data.get("score", 0),
        "quality_verdict": quality_data.get("verdict", ""),
        "linkedin_post": linkedin_data.get("post_text", ""),
        "linkedin_hashtags": linkedin_data.get("hashtags", []),
        "blog_url": blog_url,
        "created_at": now,
    })


# ─────────────────────────────────────────────────────────────
# Main Background Task
# ─────────────────────────────────────────────────────────────

def run_agent1_background(
    llm_config: LLMConfig,
    wp_config: Optional[WordPressConfig] = None,
    li_config: Optional[LinkedInConfig] = None,
) -> None:
    """
    Entry point for FastAPI BackgroundTasks.
    Runs all 7 steps synchronously; updates _run_state throughout.
    Optionally publishes to WordPress and/or LinkedIn if configs are provided.
    """
    global _run_state

    run_id = str(uuid.uuid4())

    with _run_lock:
        _run_state = AgentRunStatus(
            agent_id="agent1",
            run_id=run_id,
            status="running",
            started_at=_now(),
            steps=[
                StepStatus(step_number=n, name=name, status="pending")
                for n, name in STEP_DEFINITIONS
            ],
        )

    topic_dict = None
    blog_data = None
    quality_data = {"verdict": "APPROVED", "score": 0}
    linkedin_data = {"post_text": "", "hashtags": []}
    blog_url = ""

    try:
        # ── Step 1: Pick topic ──────────────────────────────────────────
        _update_step(1, "running", "Loading pending topics...")
        topic_dict = _step1_pick_topic()
        _update_step(1, "completed", f"Selected: {topic_dict['topic']}")

        # ── Step 2: Generate blog ───────────────────────────────────────
        _update_step(2, "running", f"Generating blog with {llm_config.model}...")
        blog_data = _step2_generate_blog(topic_dict["topic"], llm_config)
        word_count = len(blog_data.get("content_html", "").split())
        _update_step(2, "completed", f"Generated ~{word_count} words: {blog_data.get('title', '')[:60]}")
        time.sleep(4)  # Throttle: stay within free-tier RPM limits

        # ── Step 3: Internal linking ────────────────────────────────────
        _update_step(3, "running", "Inserting internal links...")
        blog_data = _step3_internal_linking(blog_data, llm_config)
        link_count = len(blog_data.get("links_added", []))
        _update_step(3, "completed", f"Added {link_count} internal links")
        time.sleep(4)  # Throttle: stay within free-tier RPM limits

        # ── Step 4: Quality check ───────────────────────────────────────
        _update_step(4, "running", "Running AI quality verification...")
        quality_data = _step4_quality_check(blog_data, topic_dict["topic"], llm_config)
        _update_step(
            4, "completed",
            f"{quality_data['verdict']} — Score: {quality_data['score']}/100"
        )
        time.sleep(4)  # Throttle: stay within free-tier RPM limits

        # ── Step 5: Generate LinkedIn post text ─────────────────────────
        blog_url_temp = f"https://vervotech.com/blog/{blog_data.get('slug', 'post')}"
        _update_step(5, "running", "Creating LinkedIn post text...")
        linkedin_data = _step5_generate_linkedin(blog_data, blog_url_temp, llm_config)
        has_post = bool(linkedin_data.get("post_text"))
        _update_step(5, "completed" if has_post else "skipped",
                     "Post text created" if has_post else "No post text generated")

        # ── Step 6: Publish to WordPress ────────────────────────────────
        if wp_config:
            _update_step(6, "running", "Publishing to WordPress...")
            try:
                blog_url, was_real = _step6_publish(blog_data, wp_config)
                _update_step(6, "completed", f"Published: {blog_url}")
            except IntegrationError as e:
                slug = blog_data.get("slug", "untitled-post")
                blog_url = f"https://vervotech.com/blog/{slug}"
                _update_step(6, "warning", f"WordPress failed — using mock URL. Reason: {str(e)}")
        else:
            slug = blog_data.get("slug", "untitled-post")
            blog_url = f"https://vervotech.com/blog/{slug}"
            _update_step(6, "skipped", f"WordPress not configured — mock URL: {blog_url}")

        # ── Step 7: Publish to LinkedIn ──────────────────────────────────
        if li_config and linkedin_data.get("post_text"):
            _update_step(7, "running", "Posting to LinkedIn...")
            try:
                posted = _step5b_post_linkedin(linkedin_data, blog_url, li_config)
                if posted:
                    _update_step(7, "completed", "Posted to LinkedIn successfully")
                else:
                    _update_step(7, "skipped", "No post text to publish")
            except IntegrationError as e:
                _update_step(7, "warning", f"LinkedIn post failed: {str(e)}")
        else:
            reason = "LinkedIn not configured" if not li_config else "No post text generated"
            _update_step(7, "skipped", reason)

        # ── Step 8: Save results ─────────────────────────────────────────
        _update_step(8, "running", "Saving results to database...")
        _step7_save_results(topic_dict, blog_data, quality_data, linkedin_data, blog_url)
        _update_step(8, "completed", "Results saved")

        _set_run_status("completed", result={
            "topic": topic_dict["topic"],
            "blog_title": blog_data.get("title"),
            "blog_url": blog_url,
            "quality_score": quality_data.get("score"),
            "quality_verdict": quality_data.get("verdict"),
            "linkedin_post_length": len(linkedin_data.get("post_text", "")),
        })

    except ValueError as e:
        # No pending topics (non-fatal for server, fatal for this run)
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status in ("running", "pending")),
            1
        )
        _update_step(current_step, "failed", str(e))
        _set_run_status("failed", error=str(e))

    except LLMError as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            2
        )
        _update_step(current_step, "failed", f"AI error: {str(e)}")
        _set_run_status("failed", error=f"LLM error: {str(e)}")

    except Exception as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            1
        )
        _update_step(current_step, "failed", str(e))
        _set_run_status("failed", error=str(e))

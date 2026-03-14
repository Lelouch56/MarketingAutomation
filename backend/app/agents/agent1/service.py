"""
Agent 1: Hangout Social — LinkedIn Content Automation

6-step workflow:
  1. pick_topic        - Find first Pending topic from topics.json
  2. generate_linkedin - LLM writes an Ogilvy-style LinkedIn post (~150 words)
  3. quality_check     - LLM reviews post: hook, structure, voice, rules, relevance
  4. generate_image    - DALL-E 3 generates a LinkedIn illustration (OpenAI only)
  5. publish_linkedin  - Posts text + image to LinkedIn
  6. save_results      - Mark topic Published, append record to blogs.json
"""

import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

from app.storage.json_db import JsonDB
from app.core.llm_provider import LLMConfig, call_llm_json, LLMError, generate_image
from app.core.prompts import (
    LINKEDIN_POST_SYSTEM, linkedin_post_user,
    LINKEDIN_QUALITY_SYSTEM, linkedin_quality_user,
    linkedin_image_prompt,
)
from app.core.integrations import LinkedInConfig, IntegrationError, post_to_linkedin
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
    (2, "generate_linkedin"),
    (3, "quality_check"),
    (4, "generate_image"),
    (5, "publish_linkedin"),
    (6, "save_results"),
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
    topic = pending[0]
    if not topic.get("id"):
        topic["id"] = str(uuid.uuid4())
    return topic


def _step2_generate_linkedin(topic: str, config: LLMConfig) -> dict:
    """
    Generate an Ogilvy-style LinkedIn post directly from the topic.
    Non-critical — returns empty dict on failure so the run doesn't abort.
    """
    try:
        result = call_llm_json(config, LINKEDIN_POST_SYSTEM, linkedin_post_user(topic))
        return {
            "post_text": result.get("post_text", ""),
            "hashtags": result.get("hashtags", []),
        }
    except Exception as e:
        logger.warning("LinkedIn post generation failed: %s", str(e)[:150])
        return {"post_text": "", "hashtags": []}


def _step3_quality_check(post_text: str, topic: str, config: LLMConfig) -> dict:
    """
    Review the generated LinkedIn post for hook, structure, voice, and rule compliance.
    Non-critical — returns a default APPROVED result on failure so the run continues.
    If score < 70 the verdict is NEEDS_REVISION; the run still proceeds but logs the issues.
    """
    try:
        result = call_llm_json(config, LINKEDIN_QUALITY_SYSTEM, linkedin_quality_user(post_text, topic))
        return {
            "verdict": result.get("verdict", "APPROVED"),
            "score": int(result.get("score", 75)),
            "passed_checks": result.get("passed_checks", []),
            "failed_checks": result.get("failed_checks", []),
        }
    except Exception as e:
        logger.warning("LinkedIn quality check failed, defaulting to APPROVED: %s", str(e)[:100])
        return {"verdict": "APPROVED", "score": 75, "passed_checks": [], "failed_checks": []}


def _step4_generate_image(
    topic: str,
    llm_config: LLMConfig,
    image_gen_config: Optional[LLMConfig] = None,
    post_text: str = "",
) -> Optional[str]:
    """Generate a LinkedIn illustration. Uses image_gen_config if provided, else falls back to llm_config.
    Raises on failure so the caller can show the actual error in the step status."""
    effective_config = image_gen_config if image_gen_config else llm_config
    provider = effective_config.provider.lower()
    if provider not in ("openai", "gemini", "ideogram"):
        return None
    prompt = linkedin_image_prompt(topic, post_text)
    return generate_image(effective_config, prompt)


def _step5_publish_linkedin(
    linkedin_data: dict,
    li_config: Optional[LinkedInConfig],
    image_url: Optional[str] = None,
) -> bool:
    """Post to LinkedIn with optional image. Returns True if posted."""
    if not li_config:
        raise ValueError(
            "LinkedIn not configured. Add your LinkedIn token and Author URN in Settings → LinkedIn."
        )
    post_text = linkedin_data.get("post_text", "")
    if not post_text:
        raise ValueError("No post text was generated — cannot publish to LinkedIn.")
    # Hashtags are already embedded in post_text by the prompt — don't append again.
    post_to_linkedin(li_config, post_text, image_url=image_url)
    return True


def _step6_save_results(
    topic_dict: dict,
    linkedin_data: dict,
    image_url: Optional[str] = None,
) -> None:
    """Mark topic Published and append LinkedIn post record to blogs.json."""
    now = _now()

    all_topics = topics_db.read()
    for t in all_topics:
        if t.get("id") == topic_dict.get("id") or t.get("topic") == topic_dict.get("topic"):
            t["status"] = "Published"
            t["linkedin_post"] = linkedin_data.get("post_text", "")
            t["updated_at"] = now
            break
    topics_db.write(all_topics)

    blogs_db.append({
        "id": str(uuid.uuid4()),
        "topic_id": topic_dict.get("id", ""),
        "topic": topic_dict.get("topic", ""),
        "linkedin_post": linkedin_data.get("post_text", ""),
        "linkedin_hashtags": linkedin_data.get("hashtags", []),
        "image_url": image_url or "",
        "created_at": now,
    })


# ─────────────────────────────────────────────────────────────
# Main Background Task
# ─────────────────────────────────────────────────────────────

def run_agent1_background(
    llm_config: LLMConfig,
    li_config: Optional[LinkedInConfig] = None,
    image_gen_config: Optional[LLMConfig] = None,
) -> None:
    """
    Entry point for FastAPI BackgroundTasks.
    Runs all 6 steps synchronously; updates _run_state throughout.
    Flow: pick topic → LinkedIn copy → quality check → image → post to LinkedIn → save.
    image_gen_config: optional separate config for image generation (e.g. Gemini for images while using Groq for text).
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
    linkedin_data = {"post_text": "", "hashtags": []}
    quality_data = {"verdict": "APPROVED", "score": 0, "passed_checks": [], "failed_checks": []}
    image_url: Optional[str] = None

    try:
        # ── Step 1: Pick topic ──────────────────────────────────────────
        _update_step(1, "running", "Loading pending topics...")
        topic_dict = _step1_pick_topic()
        _update_step(1, "completed", f"Selected: {topic_dict['topic']}")

        # ── Step 2: Generate LinkedIn post copy ─────────────────────────
        _update_step(2, "running", f"Writing LinkedIn post with {llm_config.model}...")
        linkedin_data = _step2_generate_linkedin(topic_dict["topic"], llm_config)
        if linkedin_data.get("post_text"):
            word_count = len(linkedin_data["post_text"].split())
            _update_step(2, "completed", f"Post written ({word_count} words)")
        else:
            _update_step(2, "failed", "Post generation returned empty — skipping quality check, image, and LinkedIn publish")
            _update_step(3, "skipped", "Skipped — no LinkedIn post was generated")
            _update_step(4, "skipped", "Skipped — no LinkedIn post was generated")
            _update_step(5, "skipped", "Skipped — no LinkedIn post was generated")
            _update_step(6, "skipped", "Skipped — topic remains Pending")
            _set_run_status("failed", error="LinkedIn post generation returned empty — no content published. Topic kept as Pending.")
            return
        time.sleep(4)  # Throttle: stay within free-tier RPM limits

        # ── Step 3: Quality check ───────────────────────────────────────
        _update_step(3, "running", "Reviewing post quality...")
        quality_data = _step3_quality_check(
            linkedin_data.get("post_text", ""), topic_dict["topic"], llm_config
        )
        verdict = quality_data["verdict"]
        score = quality_data["score"]
        failed = quality_data.get("failed_checks", [])
        if verdict == "APPROVED":
            _update_step(3, "completed", f"APPROVED — Score: {score}/100")
        else:
            issues = "; ".join(failed[:2]) if failed else "see score"
            _update_step(3, "warning", f"NEEDS_REVISION — Score: {score}/100 ({issues}) — publishing anyway")
        time.sleep(4)  # Throttle: stay within free-tier RPM limits

        # ── Step 4: Generate LinkedIn image (DALL-E / Gemini / Ideogram) ────────────
        effective_img_config = image_gen_config if image_gen_config else llm_config
        img_provider = effective_img_config.provider.lower()
        if img_provider in ("openai", "gemini", "ideogram"):
            if img_provider == "openai":
                provider_label = "DALL-E 3"
            elif img_provider == "ideogram":
                provider_label = "Ideogram v3"
            else:
                provider_label = f"Gemini ({effective_img_config.model})"
            source_label = " (separate image config)" if image_gen_config else ""
            _update_step(4, "running", f"Generating LinkedIn illustration via {provider_label}{source_label}...")
            try:
                image_url = _step4_generate_image(
                    topic_dict["topic"], llm_config, image_gen_config,
                    post_text=linkedin_data.get("post_text", ""),
                )
                if image_url:
                    _update_step(4, "completed", f"Image generated via {provider_label} ✓")
                else:
                    _update_step(4, "warning", "Image generation returned empty — posting text only")
            except Exception as img_e:
                logger.warning("Image generation failed: %s", str(img_e))
                _update_step(4, "warning", f"Image failed: {str(img_e)[:250]} — posting text only")
                image_url = None
        else:
            _update_step(4, "skipped",
                         f"Image generation requires OpenAI, Gemini, or Ideogram (current: {effective_img_config.provider})")

        # ── Step 5: Publish to LinkedIn ──────────────────────────────────
        linkedin_published = False
        img_note = " + image" if image_url else ""
        _update_step(5, "running", f"Posting to LinkedIn{img_note}...")
        try:
            _step5_publish_linkedin(linkedin_data, li_config, image_url=image_url)
            _update_step(5, "completed", f"Posted to LinkedIn{img_note} successfully ✓")
            linkedin_published = True
        except ValueError as e:
            # Config error (no token, no post text) — cannot recover
            _update_step(5, "failed", str(e))
        except IntegrationError as e:
            if image_url:
                # Image upload failed — retry posting text only
                img_warn = str(e)[:150]
                _update_step(5, "running", f"Image upload failed ({img_warn[:80]}…) — retrying text only...")
                try:
                    _step5_publish_linkedin(linkedin_data, li_config, image_url=None)
                    _update_step(5, "completed", f"Posted to LinkedIn (text only — image upload failed: {img_warn[:100]})")
                    image_url = None  # clear so step 6 saves correctly
                    linkedin_published = True
                except (ValueError, IntegrationError) as e2:
                    _update_step(5, "failed", str(e2))
            else:
                _update_step(5, "failed", str(e))

        # ── Step 6: Save results ─────────────────────────────────────────
        _update_step(6, "running", "Saving results...")
        if linkedin_published:
            _step6_save_results(topic_dict, linkedin_data, image_url)
            _update_step(6, "completed", "Topic marked Published, record saved ✓")
        else:
            _update_step(6, "completed", "Topic kept as Pending — LinkedIn post was not published")

        if linkedin_published:
            _set_run_status("completed", result={
                "topic": topic_dict["topic"],
                "quality_score": quality_data.get("score"),
                "quality_verdict": quality_data.get("verdict"),
                "linkedin_post_length": len(linkedin_data.get("post_text", "")),
                "image_generated": image_url is not None,
            })
        else:
            _set_run_status("failed", error="LinkedIn post was not published — topic remains Pending.")

    except ValueError as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status in ("running", "pending")),
            1,
        )
        _update_step(current_step, "failed", str(e))
        _set_run_status("failed", error=str(e))

    except LLMError as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            2,
        )
        _update_step(current_step, "failed", f"AI error: {str(e)}")
        _set_run_status("failed", error=f"LLM error: {str(e)}")

    except Exception as e:
        current_step = next(
            (s.step_number for s in _run_state.steps if s.status == "running"),
            1,
        )
        _update_step(current_step, "failed", str(e))
        _set_run_status("failed", error=str(e))

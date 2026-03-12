# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketing Automation AI — a hackathon project for Vervotech. A full-stack SaaS platform with 4 AI-powered marketing automation agents. Backend is Python/FastAPI; frontend is Next.js 14 (App Router) with MUI.

## Commands

### Backend

```bash
# From repo root or backend/ directory
cd backend

# Install dependencies (uses a .venv at repo root)
pip install -r requirements.txt

# Run the dev server (listens on http://localhost:8000)
# debugpy attaches on port 5678; set DEBUGGER_WAIT=1 to pause until debugger connects
uvicorn app.main:app --reload

# Interactive API docs
# http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build
npm run start
```

## Architecture

### Backend (`backend/`)

Entry point: `app/main.py` — creates FastAPI app, adds CORS (allows `localhost:3000/3001`), mounts the router.

All routes: `app/api/routes.py` — one file containing every HTTP endpoint for agents 1–4, integrations, logs, and health.

**Agent pattern** — each agent lives in `app/agents/agentN/service.py` and follows the same structure:
- Module-level `_run_state: AgentRunStatus` (in-memory, resets on restart) protected by `threading.Lock`
- `run_agentN_background(llm_config, ...)` — entry point called via FastAPI `BackgroundTasks`; executes numbered steps synchronously and updates `_run_state` as it goes
- `get_agentN_status()` — returns current `AgentRunStatus`
- Steps use `time.sleep(4)` between LLM calls to avoid free-tier rate limits

**Agent responsibilities:**
- **Agent 1** (Content Writer & SEO): Picks a pending topic → generates blog HTML → inserts internal links → quality check → LinkedIn post → publishes to WordPress (or mock URL) → saves to `blogs.json`
- **Agent 2** (Lead Qualification): Deduplicates leads → scrapes websites → AI-scores for travel industry fit → enrolls in Klenty/Outplay campaigns
- **Agent 3** (LinkedIn Outbound): Generates B2B prospect profiles → filters decision-makers → approves targets for Klenty outreach
- **Agent 4** (Analytics & Reports): Aggregates data from all agents → generates AI performance insights → saves to `reports.json`

**Core modules:**
- `app/core/llm_provider.py` — `call_llm()` / `call_llm_json()` routing to OpenAI, Gemini, Anthropic, or Grok. API keys are passed per-request (never stored server-side). Includes exponential-backoff retry on 429s.
- `app/core/integrations.py` — WordPress REST API, LinkedIn UGC API, Klenty, and Outplay HTTP clients. Raises `IntegrationError` on failure.
- `app/core/prompts.py` — all LLM system/user prompt strings and builder functions.
- `app/storage/json_db.py` — `JsonDB` class: thread-safe, file-backed list store. Files live in `app/data/` (`topics.json`, `blogs.json`, `leads.json`, `leads.json`, `outreach_targets.json`, `reports.json`).
- `app/models.py` — Pydantic v2 request/response models. `RunAgentRequest` carries `llm_config` plus optional integration configs.

**LLM providers supported:** `openai`, `gemini`, `anthropic`, `grok` (xAI, OpenAI-compatible at `https://api.xai.com/v1`), `groq` (free Llama models, OpenAI-compatible at `https://api.groq.com/openai/v1` — keys start with `gsk_`). Groq recommended for free usage: `llama-3.3-70b-versatile` (quality) or `llama-3.1-8b-instant` (fast).

### Frontend (`frontend/`)

Next.js 14 App Router. Pages live in `frontend/app/`:
- `/` — dashboard/home
- `/agents` — agent list
- `/agents/[id]` — agent detail (run controls, step status, data tables)
- `/logs` — live log viewer
- `/settings` — LLM provider config + integration credentials

UI stack: MUI v5 + Emotion. API calls use `axios` targeting `http://localhost:8000`.

## Key Conventions

- Each agent's run state is **in-memory only** — restarting the server resets status to `idle`. Persisted data (blogs, leads, etc.) stays in the JSON files.
- Only one agent instance can run at a time per agent (checked via `status == "running"` guard in routes).
- `debugpy` is always listening on port `5678`; set env var `DEBUGGER_WAIT=1` to block startup until a debugger attaches. `FORCE_BREAK=1` triggers a breakpoint in the WordPress test route.
- JSON data files (`app/data/*.json`) are created automatically if missing — no migration needed.

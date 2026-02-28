# Marketing Automation AI — Complete Project Blueprint
> Vervotech Hackathon 2026 | Keep this document updated as the project evolves.
> Give this entire file to an AI agent with the instruction: **"Build this project exactly as described."**

---

## 1. PRODUCT OVERVIEW

**What it is:** A B2B SaaS dashboard with 4 AI marketing automation agents built for Vervotech (travel tech company selling hotel content APIs and hotel mapping to OTAs, TMCs, and B2B travel platforms).

**What it does:** Automates the entire marketing pipeline:
- Agent 1 → Writes SEO blog posts + posts to WordPress + posts on LinkedIn
- Agent 2 → Qualifies inbound leads + scores for travel industry fit + enrolls in Klenty/Outplay email campaigns
- Agent 3 → Generates B2B prospect profiles + manual approval gate + enrolls into Klenty email sequences
- Agent 4 → Aggregates all data + AI analysis + executive performance report

**Target users:** Vervotech marketing/sales team (internal tool)

---

## 2. TECH STACK

### Backend
| Component | Choice | Notes |
|-----------|--------|-------|
| Framework | FastAPI (Python) | Async-ready, auto-generates OpenAPI docs |
| Server | uvicorn | `--reload` in dev |
| Port | 8000 | |
| Storage | JSON flat files | `app/data/*.json` — no DB needed for demo |
| LLM | OpenAI / Gemini / Anthropic / Grok | User-configurable at runtime |
| LLM Client (OpenAI) | `openai>=1.0.0` | |
| LLM Client (Gemini) | `google-genai>=1.0.0` | NOT deprecated `google-generativeai` |
| LLM Client (Anthropic) | `anthropic>=0.25.0` | |
| HTML scraping | `requests` + `beautifulsoup4` | For Agent 2 website scraping |
| Validation | `pydantic>=2.0.0` | Uses `field_validator` (v2 syntax) |
| File uploads | `python-multipart` | Required for FastAPI UploadFile |
| CORS | FastAPI CORSMiddleware | Allows `localhost:3000` |

### Frontend
| Component | Choice | Notes |
|-----------|--------|-------|
| Framework | Next.js 14 (App Router) | `"next": "14.0.0"` |
| Language | TypeScript 5 | `"strict": false` in tsconfig (intentional for demo) |
| UI Library | MUI v5 | `@mui/material@5.15.0`, `@mui/icons-material@5.18.0` |
| Styling | Emotion (MUI default) | No SCSS modules needed |
| HTTP client | Axios 1.6 | 30s timeout |
| Port | 3000 | |

---

## 3. DIRECTORY STRUCTURE

```
MarketingAutomation/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app, CORS setup
│   │   ├── models.py                 # All Pydantic request/response models
│   │   ├── api/
│   │   │   └── routes.py             # All REST API endpoints (~350 lines)
│   │   ├── core/
│   │   │   ├── llm_provider.py       # Unified LLM router: call_llm_json()
│   │   │   ├── prompts.py            # All LLM prompt templates
│   │   │   └── integrations.py       # WordPress, LinkedIn, Klenty, Outplay clients
│   │   ├── agents/
│   │   │   ├── agent1/service.py     # Content Writer & SEO (7 steps)
│   │   │   ├── agent2/service.py     # Lead Qualification (7 steps)
│   │   │   ├── agent3/service.py     # LinkedIn Outbound (7 steps)
│   │   │   └── agent4/service.py     # Analytics & Reporting (6 steps)
│   │   ├── storage/
│   │   │   └── json_db.py            # Thread-safe JSON read/write/append
│   │   └── data/                     # Auto-created JSON data files
│   │       ├── topics.json
│   │       ├── blogs.json
│   │       ├── leads.json
│   │       ├── outreach_targets.json
│   │       └── reports.json
│   └── requirements.txt
├── frontend/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root layout with sidebar + topbar
│   │   ├── page.tsx                  # Dashboard (/) — 4 agent cards
│   │   ├── agents/
│   │   │   ├── page.tsx              # /agents — all agents table
│   │   │   └── [id]/page.tsx         # /agents/[id] — agent detail (reusable)
│   │   ├── logs/page.tsx             # /logs — activity log viewer
│   │   └── settings/page.tsx         # /settings — API keys + integrations
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Left nav: Dashboard, Agents, Logs, Settings
│   │   │   ├── TopBar.tsx            # Top bar with product name
│   │   │   └── ThemeRegistry.tsx     # MUI theme provider (SSR-safe)
│   │   ├── agents/
│   │   │   ├── AgentCard.tsx         # Dashboard agent card component
│   │   │   ├── StatusBadge.tsx       # Colored status chip (idle/running/completed/failed)
│   │   │   └── StepperFlow.tsx       # Vertical step-by-step progress display
│   │   ├── data/
│   │   │   └── ResultsTable.tsx      # Generic data table with typed columns
│   │   └── logs/
│   │       └── LogsTable.tsx         # Activity logs table with filters
│   ├── lib/
│   │   ├── storage.ts                # localStorage utilities (SSR-safe, all keys centralized)
│   │   ├── theme.ts                  # MUI light theme config
│   │   └── hooks/
│   │       └── useAgentPoller.ts     # Polling hook — polls status every 2s while running
│   ├── services/
│   │   └── api.ts                    # Typed Axios API client + extractApiError()
│   ├── types/
│   │   └── index.ts                  # All TypeScript interfaces + localStorage key constants
│   ├── package.json
│   └── tsconfig.json
└── BLUEPRINT.md                      # This file
```

**CRITICAL:** Every `app/agents/agent*/` and `app/storage/` and `app/core/` folder needs an empty `__init__.py` file for Python imports to work.

---

## 4. SETUP COMMANDS

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip

### Backend Setup
```bash
cd MarketingAutomation/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd MarketingAutomation/frontend
npm install
npm run dev
```

### First-time run checklist
1. Start backend → verify `http://localhost:8000` returns JSON
2. Start frontend → go to `http://localhost:3000`
3. Navigate to `/settings` → enter your LLM API key (OpenAI/Gemini/Anthropic/Grok)
4. Go to `/agents/agent1` → click "Run Now"

### Data reset (wipe all JSON data files)
```bash
# From backend/ directory
echo "[]" > app/data/topics.json
echo "[]" > app/data/blogs.json
echo "[]" > app/data/leads.json
echo "[]" > app/data/outreach_targets.json
echo "[]" > app/data/reports.json
```

---

## 5. BACKEND ARCHITECTURE

### 5.1 LLM Provider (`app/core/llm_provider.py`)

**The single entry point for all LLM calls:**
```python
def call_llm_json(config: LLMConfig, system_prompt: str, user_prompt: str) -> dict
```
- Takes `LLMConfig(provider, api_key, model)`
- Routes to OpenAI / Gemini / Anthropic / Grok
- All prompts MUST return JSON — the function parses and returns `dict`
- Strips markdown fences if present (` ```json ... ``` `)
- Raises `LLMError` on failure
- Has retry logic: 3 retries with 5s/10s/20s backoff on rate limit (429)
- On `JSONDecodeError`: raises `LLMError("LLM returned a non-JSON response. Try again or switch to a different model.")`
- **API keys are NEVER stored server-side** — passed per-request from frontend via localStorage

**LLM Config:**
```python
@dataclass
class LLMConfig:
    provider: str   # "openai" | "gemini" | "anthropic" | "grok"
    api_key: str
    model: str
```

**Supported models:**
```
openai:    gpt-4o, gpt-4o-mini, gpt-3.5-turbo
gemini:    gemini-2.0-flash, gemini-2.0-flash-lite, gemini-2.0-pro-exp-02-05
anthropic: claude-3-5-sonnet-20241022, claude-3-haiku-20240307, claude-3-opus-20240229
grok:      grok-2, grok-2-latest
```

### 5.2 JSON Storage (`app/storage/json_db.py`)

Thread-safe flat-file storage. Each file is a JSON array.
```python
db = JsonDB("app/data/topics.json")
db.read()        # returns list
db.append(item)  # adds one record
db.write(list)   # replaces entire file
```
- Uses `threading.Lock()` on all operations
- Creates file with `[]` if it doesn't exist
- On corrupt JSON: logs error and returns `[]` (no crash)

### 5.3 API Routes (`app/api/routes.py`)

**Complete endpoint list:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Health check |
| GET | `/agents` | List all 4 agents with metadata |
| GET | `/agents/{agent_id}/status` | Generic status for any agent |
| POST | `/agents/agent1/run` | Start Agent 1 (background task) |
| GET | `/agents/agent1/status` | Agent 1 run status + steps |
| GET | `/agents/agent1/topics` | List all topics |
| POST | `/agents/agent1/topics` | Add single topic |
| POST | `/agents/agent1/topics/upload-csv` | Bulk import topics from CSV |
| GET | `/agents/agent1/blogs` | List all generated blogs |
| POST | `/agents/agent2/run` | Start Agent 2 |
| GET | `/agents/agent2/status` | Agent 2 status |
| GET | `/agents/agent2/leads` | List all leads |
| POST | `/agents/agent2/leads` | Add single lead |
| POST | `/agents/agent3/run` | Start Agent 3 |
| GET | `/agents/agent3/status` | Agent 3 status |
| GET | `/agents/agent3/outreach-targets` | List all outreach prospects |
| POST | `/agents/agent3/outreach-targets/{id}/approve` | Approve prospect for outreach |
| POST | `/agents/agent4/run` | Start Agent 4 |
| GET | `/agents/agent4/status` | Agent 4 status |
| GET | `/agents/agent4/reports` | List all reports |
| GET | `/logs` | Get last 50 activity logs (filterable) |
| POST | `/logs/clear` | Clear all logs |
| POST | `/integrations/test/wordpress` | Test WordPress connection |
| POST | `/integrations/test-publish/wordpress` | Test-publish a post |
| POST | `/integrations/test/linkedin` | Test LinkedIn token |
| POST | `/integrations/test-publish/linkedin` | Test-post on LinkedIn |
| POST | `/integrations/test/klenty` | Test Klenty connection |
| POST | `/integrations/test/outplay` | Test Outplay connection |

**All agent run endpoints:**
- Accept: `RunAgentRequest { llm_config, wordpress?, linkedin?, klenty?, outplay? }`
- Return `409` if agent already running
- Use FastAPI `BackgroundTasks` for async execution

### 5.4 Request Models (`app/models.py`)

All models use Pydantic v2 with `field_validator`:

```python
class LeadCreate(BaseModel):
    email: str       # validated: RFC format, max 254 chars, stripped/lowercased
    website: str?    # validated: must start http(s)://, max 2048 chars
    name: str?
    company: str?    # validated: max 255 chars

class TopicCreate(BaseModel):
    topic: str       # validated: non-empty after strip, max 2000 chars
    status: str = "Pending"
```

### 5.5 CORS Configuration (`app/main.py`)
```python
allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"]
allow_methods=["*"]
allow_headers=["*"]
allow_credentials=True
```

---

## 6. AGENT WORKFLOWS

### Agent 1 — Content Writer & SEO (7 steps)
**Trigger:** Manual "Run Now" | **Schedule in prod:** Daily

```
Step 1: pick_topic       → reads topics.json, picks first "Pending" topic
Step 2: generate_blog    → LLM generates 1500-word HTML blog post
                           Returns: title, meta_description, slug, content_html,
                                    faq, cta, image_suggestions, primary_keyword,
                                    secondary_keywords
Step 3: internal_linking → LLM inserts 3-5 <a> internal links into content_html
                           Points to Vervotech pages: /hotel-content-api, /hotel-mapping, etc.
                           NON-CRITICAL: falls back to original HTML on failure
Step 4: quality_check    → LLM scores blog (0-100) on: SEO, grammar, structure,
                           brand alignment, audience relevance
                           ≥70 = APPROVED, <70 = REJECTED (logged but continues anyway)
Step 5: generate_linkedin → LLM writes 300-word LinkedIn post from blog excerpt
                            Strips HTML tags with regex → plain text → to LLM
                            Returns: post_text (with hook + CTA), hashtags[5]
Step 6: publish_wordpress → POST to WordPress REST API /wp-json/wp/v2/posts
                            If no WP config → uses mock URL: vervotech.com/blog/{slug}
Step 7: post_linkedin     → Calls LinkedIn UGC API /v2/ugcPosts
                            Attaches blog_url as ARTICLE media for link preview
                            If no LinkedIn config → skipped
```
**Inter-step rate limiting:** 4-second sleep between LLM calls (respects free-tier RPM)
**Output stored:** `blogs.json` + updates `topics.json` status to "Published"

### Agent 2 — Lead Qualification (7 steps)
**Trigger:** Manual "Run Now" | **Schedule in prod:** Hourly

```
Step 1: load_leads       → reads all leads from leads.json
Step 2: deduplicate      → keeps latest record per email address
Step 3: categorize       → Rule-based:
                           HOT  = business email domain + website exists
                           WARM = gmail/yahoo/hotmail/free email domain
                           COLD = test/dummy/bot patterns in email
Step 4: scrape_websites  → For HOT leads only: scrapes homepage (requests + BeautifulSoup)
                           SSL errors → logged as warning, returns "" (doesn't crash)
                           Timeout: 10s | Returns max 3000 chars of plain text
Step 5: analyze_leads    → LLM scores each HOT lead 0-100 for Vervotech fit
                           Scoring: travel/hotel industry presence, B2B model,
                                    tech maturity, API mentions, booking platform
                           Returns: score, industry_fit, company_type, reasoning, signals
Step 6: assign_campaigns → score>70 → Campaign A (Fit Client) → Klenty Campaign A / Outplay Seq A
                           WARM    → Campaign B → Klenty Campaign B / Outplay Seq B
                           COLD    → Campaign C → Klenty Campaign C / Outplay Seq C
                           Not fit → campaign="notify_rupesh"
Step 7: save_results     → writes all updated leads back to leads.json
```

### Agent 3 — LinkedIn Outbound (7 steps)
**Trigger:** Manual "Run Now" | **Schedule in prod:** 6x daily

```
Step 1: load_targets     → reads existing outreach_targets.json
Step 2: generate_prospects → LLM generates 8 realistic B2B prospect profiles
                             Per persona (CTO, VP Tech, Product Head, Founder, etc.)
                             Returns: first_name, last_name, email, title, company,
                                      company_type, website, linkedin_url, region, employees
Step 3: seamless_upload  → LLM filters out non-decision-makers (marketing, HR, finance, legal, support)
                           Adds relevance_reason to kept prospects
                           Updates status to "filtered"
Step 4: manual_approval  → saves prospects to outreach_targets.json with status="pending_approval"
                           UI shows "Approve" button per prospect
                           Approved → status="approved" → moves to outreach queue
Step 5: email_outreach   → Enrolls APPROVED prospects in Klenty email sequence
                           (Sequence name configured in Settings)
                           If no Klenty config → queued_no_config
Step 6: linkedin_connection → STUB: logs connection request intent
                              Sets linkedin_status="pending_acceptance"
                              ⚠️ Does NOT actually send LinkedIn connection request
                              (LinkedIn Invitation API requires special OAuth scope not available)
Step 7: track_engagement → aggregates run stats, saves summary
```

**LinkedIn Outbound Gap:** Step 6 is a stub because the LinkedIn `/v2/invitations` API requires
`w_member_social` + invitation OAuth scope which needs LinkedIn app review approval.
For the hackathon demo, this is logged/simulated.

**Per requirement, the INTENDED flow (when LinkedIn Invitation API is available):**
```
Email via Klenty → wait 12h → Send LinkedIn connection request → wait for accept → Send LinkedIn message
```

### Agent 4 — Analytics & Reporting (6 steps)
**Trigger:** Manual "Run Now" | **Schedule in prod:** Daily/Weekly

```
Step 1: aggregate_data   → reads topics.json, blogs.json, leads.json, outreach_targets.json
                           Computes: lead categories, campaign distribution, blog quality avg,
                                     klenty enrolled count, outreach approved/pending counts
Step 2: ai_analysis      → LLM generates funnel insights from aggregated data
                           Returns: funnel_summary, top_performing_content,
                                    campaign_distribution, key_insights[3], recommendations[3],
                                    health_score (0-100), health_rating
                           Fallback: computes basic metrics from raw data if LLM fails
Step 3: generate_report  → builds structured report JSON, saves to reports.json
Step 4: create_visualizations → generates chart-ready JSON:
                                 lead_funnel (bar), campaign_distribution (pie),
                                 lead_categories (donut), content_quality (bar)
Step 5: send_pdf_report  → LLM writes executive_summary (3-5 paragraphs) + one_liner
                           Updates report record in reports.json
                           Fallback: generates summary from raw data if LLM fails
Step 6: update_power_bi  → STUB: logs "queued_no_credentials"
                           Marks report.power_bi_status = "queued_no_credentials"
```

---

## 7. INTEGRATION CLIENTS (`app/core/integrations.py`)

### WordPress
- **API:** `{site_url}/wp-json/wp/v2/posts` (REST API v2)
- **Auth:** HTTP Basic Auth (username + application password)
- **Payload:** `{ title, content (HTML), slug, status, excerpt }`
- **Errors handled:** 401 (bad creds), 403 (no publish permission), connection refused

### LinkedIn (Content Posting — Agent 1)
- **API:** `https://api.linkedin.com/v2/ugcPosts`
- **Auth:** Bearer token
- **Payload:** UGC post with `shareCommentary.text` + optional `ARTICLE` media (blog URL)
- **Required scope:** `w_member_social`
- **Token expiry:** 60 days — manual refresh needed

### LinkedIn (Connection Requests — Agent 3) ⚠️ NOT IMPLEMENTED
- **Would use:** `https://api.linkedin.com/v2/invitations`
- **Status:** Stub only — requires special LinkedIn app review

### Klenty
- **API:** `https://app.klenty.com/apis/v1/user/{email}/prospects`
- **Auth:** `x-API-key` header
- **Payload:** `{ Email, FirstName, LastName, Company, CampaignName }`
- **Campaign names:** Configured in Settings → must match exactly in Klenty dashboard
- **Test endpoint:** `/apis/v1/user/{email}/sequences`

### Outplay
- **API:** `https://api.outplayhq.com/api/v2/prospect`
- **Auth:** `x-api-key` header
- **Payload:** `{ email, first_name, last_name, company, sequence_name }`
- **Test endpoint:** `/api/v2/sequence`

---

## 8. FRONTEND ARCHITECTURE

### 8.1 Pages & Routes

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Dashboard — 4 AgentCard components in grid, each with status + Run button |
| `/agents` | `app/agents/page.tsx` | Table of all 4 agents with status badges |
| `/agents/[id]` | `app/agents/[id]/page.tsx` | Agent detail: steps stepper + data table + add data form |
| `/logs` | `app/logs/page.tsx` | Activity logs from backend + frontend localStorage |
| `/settings` | `app/settings/page.tsx` | LLM config + WordPress + LinkedIn + Klenty + Outplay settings |

### 8.2 Key Components

**`AgentCard`** — Dashboard card:
- Shows: agent name, description, status badge, last run time
- Buttons: "Open Agent" (→ /agents/[id]), "Run Now" (triggers run + polling)
- 4 pollers initialized on dashboard mount (one per agent)

**`StatusBadge`** — Colored MUI Chip:
- `idle` → default grey
- `running` → primary blue (pulsing)
- `completed` → success green
- `failed` → error red

**`StepperFlow`** — Vertical stepper showing each agent step:
- Pending → grey | Running → blue (spinner) | Completed → green check | Failed → red X

**`ResultsTable`** — Generic data table:
- Column types: `text`, `truncate`, `badge`, `score`, `link`, `date`
- Used for: topics, leads, outreach targets, reports

### 8.3 State Management

**No Redux/Zustand** — uses:
1. React local state (`useState`) per page component
2. `localStorage` for persistence across page refreshes (keyed constants in `types/index.ts`)
3. `useAgentPoller` hook for real-time status updates

**localStorage keys:**
```typescript
LS_LLM_CONFIG       = 'ma_llm_config'        // LLM provider settings
LS_AGENT1_STATE     = 'ma_agent1_state'       // cached agent run status
LS_AGENT2_STATE     = 'ma_agent2_state'
LS_AGENT3_STATE     = 'ma_agent3_state'
LS_AGENT4_STATE     = 'ma_agent4_state'
LS_LOGS             = 'ma_logs'               // frontend activity log (max 50)
LS_WP_CONFIG        = 'ma_wp_config'          // WordPress credentials
LS_LINKEDIN_CONFIG  = 'ma_linkedin_config'    // LinkedIn token + URN
LS_KLENTY_CONFIG    = 'ma_klenty_config'      // Klenty API key + campaign names
LS_OUTPLAY_CONFIG   = 'ma_outplay_config'     // Outplay API key + sequence names
```

**SECURITY NOTE:** API keys are stored in localStorage (browser only, never sent to backend config).
Passed per-request in the request body. Acceptable for demo — not for production.

### 8.4 Polling Hook (`lib/hooks/useAgentPoller.ts`)

```typescript
useAgentPoller({ agentId, fetchStatus, intervalMs = 2000 })
// Returns: { status, isPolling, startPolling, stopPolling, setStatus }
```
- Polls every 2 seconds while `isPolling = true`
- Auto-stops when `status.status !== 'running'`
- Guards against duplicate intervals via `intervalRef`
- Cleanup on unmount via `useEffect` return
- Supported agentIds: `'agent1' | 'agent2' | 'agent3' | 'agent4'`

### 8.5 API Client (`services/api.ts`)

```typescript
// Error helper — always use this in catch blocks
extractApiError(err: unknown): string
// → pulls err.response?.data?.detail (Pydantic validation messages) or err.message

agent1Api.{ run, getStatus, getTopics, addTopic, uploadTopicsCsv, getBlogs }
agent2Api.{ run, getStatus, getLeads, addLead }
agent3Api.{ run, getStatus, getOutreachTargets, approveTarget }
agent4Api.{ run, getStatus, getReports }
globalApi.{ getAgents, getAgentStatus, getLogs, clearLogs, health }
integrationsApi.{ testWordPress, testWordPressPublish, testLinkedIn, testLinkedInPublish,
                  testKlenty, testOutplay }
```

Base URL: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`
Timeout: 30 seconds

---

## 9. DATA MODELS (JSON Storage Format)

### topics.json — `TopicRecord[]`
```json
{
  "id": "uuid",
  "topic": "How hotel content APIs improve OTA performance",
  "status": "Pending | Processing | Published | Failed",
  "url": "https://vervotech.com/blog/slug",
  "blog_title": "...",
  "linkedin_post": "...",
  "quality_score": 85,
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### blogs.json — `BlogRecord[]`
```json
{
  "id": "uuid",
  "topic_id": "uuid",
  "topic": "original topic text",
  "title": "SEO Blog Title",
  "slug": "url-friendly-slug",
  "meta_description": "...",
  "content_html": "<h2>...</h2>...",
  "quality_score": 85,
  "quality_verdict": "APPROVED",
  "linkedin_post": "hook... insights... CTA... #hashtags",
  "blog_url": "https://vervotech.com/blog/slug",
  "created_at": "ISO8601"
}
```

### leads.json — `LeadRecord[]`
```json
{
  "id": "uuid",
  "email": "cto@travelcompany.com",
  "website": "https://travelcompany.com",
  "name": "John Smith",
  "company": "TravelCo",
  "category": "Hot | Warm | Cold",
  "campaign": "A | B | C | notify_rupesh",
  "campaign_label": "Fit Client | Warm Lead | Cold Lead | Not Fit",
  "score": 82,
  "industry_fit": true,
  "company_type": "ota | hotel_chain | travel_agency | tmc | ...",
  "reasoning": "Company operates an OTA platform...",
  "signals": ["OTA platform", "API mentions"],
  "concerns": [],
  "klenty_enrolled": true,
  "processed_at": "ISO8601",
  "created_at": "ISO8601"
}
```

### outreach_targets.json — `OutreachTargetRecord[]`
```json
{
  "id": "uuid",
  "run_id": "uuid",
  "first_name": "Sarah",
  "last_name": "Chen",
  "email": "sarah.chen@bookingplatform.com",
  "title": "CTO",
  "company": "BookingPlatform Inc",
  "company_type": "booking_platform",
  "website": "https://bookingplatform.com",
  "linkedin_url": "https://linkedin.com/in/sarah-chen",
  "region": "APAC",
  "employees": "500-2000",
  "relevance_reason": "CTO at a B2B booking platform...",
  "status": "raw | filtered | pending_approval | approved",
  "klenty_enrolled": false,
  "linkedin_status": "pending_acceptance",
  "created_at": "ISO8601",
  "approved_at": "ISO8601"
}
```

### reports.json — `ReportRecord[]`
```json
{
  "id": "uuid",
  "generated_at": "ISO8601",
  "status": "draft | complete",
  "aggregated": { "total_leads": 25, "hot_leads": 8, ... },
  "analysis": { ... },
  "funnel_summary": { "total_leads": 25, "fit_clients": 5, "conversion_rate_pct": 20.0, ... },
  "campaign_distribution": { "A": 5, "B": 10, "C": 6, "notify_rupesh": 4 },
  "key_insights": ["...", "...", "..."],
  "recommendations": ["...", "...", "..."],
  "health_score": 72,
  "health_rating": "Good",
  "top_content": [ { "title": "...", "quality_score": 88, "url": "..." } ],
  "executive_summary": "This reporting period saw...",
  "one_liner": "Generated 25 leads with 5 fit clients (20% conversion).",
  "visualizations": {
    "lead_funnel": { "type": "bar", "labels": [...], "data": [...] },
    "campaign_distribution": { "type": "pie", ... },
    "lead_categories": { "type": "donut", ... },
    "content_quality": { "type": "bar", ... }
  },
  "power_bi_status": "queued_no_credentials"
}
```

---

## 10. LLM PROMPTS SUMMARY (`app/core/prompts.py`)

All prompts instruct the LLM: **"respond with valid JSON only — no markdown fences"**

| Function | Input | Output fields |
|----------|-------|---------------|
| `blog_generation_user(topic)` | topic string | title, meta_description, slug, content_html, faq[], cta, image_suggestions[], primary_keyword, secondary_keywords[] |
| `internal_linking_user(html, keywords)` | HTML + keywords | updated_html, links_added[] |
| `quality_check_user(title, html, topic)` | blog fields | verdict, score, reasons[], improvements[] |
| `linkedin_post_user(title, html, url)` | blog data (HTML stripped to 500-char plain text) | post_text, hashtags[] |
| `lead_analysis_user(email, website, text)` | scraped homepage text | score, industry_fit, company_type, reasoning, signals[], concerns[] |
| `prospect_generation_user(persona, industry, region)` | targeting params | array of 8 prospect objects |
| `prospect_filter_user(prospects_json)` | array of prospects | filtered array with relevance_reason added |
| `report_analysis_user(data_json)` | aggregated metrics | funnel_summary, top_performing_content, campaign_distribution, key_insights[], recommendations[], health_score, health_rating |
| `executive_summary_user(analysis_json)` | analysis results | executive_summary, one_liner |

---

## 11. VALIDATION RULES

### Backend (Pydantic v2 `field_validator`)
| Field | Rule |
|-------|------|
| `LeadCreate.email` | RFC format regex, max 254 chars, strip+lowercase |
| `LeadCreate.website` | Must start `http://` or `https://`, max 2048 chars, None OK |
| `LeadCreate.company` | Max 255 chars |
| `TopicCreate.topic` | Non-empty after strip, max 2000 chars |
| CSV upload | Max 5 MB file size, max 5000 rows |

### Frontend (pre-flight checks in `agents/[id]/page.tsx`)
| Check | Where |
|-------|-------|
| Email regex `^[^@\s]+@[^@\s]+\.[^@\s]+$` | Add Lead form |
| URL prefix `^https?://` | Website field in Add Lead |
| File size ≤ 5 MB | CSV upload |
| Non-empty topic text | Add Topic form |

### Error propagation
All catch blocks in `agents/[id]/page.tsx` use `extractApiError(err)` from `services/api.ts` to surface the Pydantic `detail` field to the user.

---

## 12. KNOWN GAPS & STUBS (intentional for demo)

| Feature | Status | Reason |
|---------|--------|--------|
| LinkedIn connection requests (Agent 3 Step 6) | Stub — logs intent only | LinkedIn Invitation API requires special app review |
| LinkedIn message after acceptance | Not implemented | Depends on connection request acceptance webhook |
| Power BI update (Agent 4 Step 6) | Stub — logs "queued" | Requires Power BI credentials + workspace setup |
| Authentication/authorization | None | Demo only — anyone with network access can call API |
| Rate limiting | None implemented | Use slowapi if deploying beyond demo |
| Agent run persistence | In-memory only | Agent run state resets on server restart |
| CORS | localhost hardcoded | Move to env var for deployment: `CORS_ORIGINS` |
| Logging | In-memory (last 50) | Add `RotatingFileHandler` for production |
| HubSpot/Zoho CRM integration | Not implemented | Spec mentions it; currently manual CSV upload only |
| Sales Navigator / Seamless.ai | Not implemented | Replaced with LLM-generated mock prospects |
| Image generation for blogs | Not implemented | Spec mentions DALL-E; currently omitted |
| Excel/Google Sheets sync | Not implemented | Replaced with JSON file storage |

---

## 13. AGENT 1 — HTML HANDLING NOTES

The blog `content_html` field travels through:
1. **Generation** → LLM returns valid HTML string
2. **Internal linking** → LLM modifies HTML (potential for malformed output — no HTML validator)
3. **Quality check** → first 2000 chars of HTML sent as-is (LLM reads HTML correctly)
4. **LinkedIn post generation** → HTML stripped with `re.sub(r'<[^>]+>', '', html)[:500]`
   - ⚠️ HTML entities (`&amp;`, `&nbsp;`, `&lt;`) are NOT decoded — pass as-is to LLM input
   - For typical blog content this is acceptable; entities are rare
5. **WordPress publish** → raw HTML sent directly to WP REST API `content` field — correct, WP renders HTML natively
6. **LinkedIn post** → plain text only (no HTML) — the `blog_url` is attached as an ARTICLE media object for the link preview card

---

## 14. SETTINGS PAGE CONFIGURATION

Users configure integrations in `/settings`. All stored in localStorage:

### LLM Provider (required for any agent)
- Provider: OpenAI / Google Gemini / Anthropic Claude / xAI Grok
- API Key: stored in localStorage, passed per-request
- Model: dropdown populated from `MODEL_OPTIONS` in `types/index.ts`

### WordPress (Agent 1 — publish blog)
- Site URL: `https://yoursite.com`
- Username: WordPress username
- Application Password: generated in WP Admin → Users → Application Passwords
- Publish Status: `draft` (default) or `publish`

### LinkedIn (Agent 1 — post on LinkedIn)
- Access Token: OAuth2 Bearer token (expires in 60 days)
- Author URN: `urn:li:person:XXXXXX` (personal) or `urn:li:organization:XXXXX` (company page)
- Required OAuth scopes: `r_liteprofile`, `w_member_social`

### Klenty (Agents 2 + 3 — email sequences)
- API Key: from Klenty Settings → API
- User Email: Klenty account email
- Campaign A Name: exact name in Klenty for fit clients (score > 70)
- Campaign B Name: warm leads
- Campaign C Name: cold leads

### Outplay (Agents 2 + 3 — email sequences, alternative to Klenty)
- API Key: from Outplay Settings
- Sequence Name A/B/C: exact sequence names in Outplay dashboard

---

## 15. INSTRUCTIONS FOR AI TO REBUILD THIS PROJECT

If you are an AI reading this to rebuild the project, follow these steps in order:

1. **Create directory structure** exactly as shown in Section 3
2. **Add `__init__.py`** to every Python package folder (app/, app/api/, app/core/, app/agents/, app/agents/agent1/, app/agents/agent2/, app/agents/agent3/, app/agents/agent4/, app/storage/)
3. **Create `app/data/` directory** with 5 empty JSON array files: `topics.json`, `blogs.json`, `leads.json`, `outreach_targets.json`, `reports.json`
4. **Build backend in this order:**
   - `requirements.txt`
   - `app/storage/json_db.py` (thread-safe JSON DB)
   - `app/models.py` (Pydantic models with validators)
   - `app/core/llm_provider.py` (unified LLM router)
   - `app/core/prompts.py` (all prompt templates — JSON only, no markdown fences)
   - `app/core/integrations.py` (WordPress, LinkedIn, Klenty, Outplay)
   - `app/agents/agent1/service.py` through `agent4/service.py` (each follows 7-step or 6-step pattern)
   - `app/api/routes.py` (all endpoints)
   - `app/main.py` (FastAPI app + CORS)
5. **Build frontend in this order:**
   - `types/index.ts` (all interfaces + localStorage key constants)
   - `lib/storage.ts` (localStorage utilities, SSR-safe)
   - `lib/theme.ts` (MUI light theme)
   - `lib/hooks/useAgentPoller.ts` (polling hook)
   - `services/api.ts` (Axios client + extractApiError)
   - Components: StatusBadge → StepperFlow → AgentCard → ResultsTable → LogsTable → Sidebar → TopBar → ThemeRegistry
   - Pages: layout.tsx → page.tsx (dashboard) → agents/page.tsx → agents/[id]/page.tsx → logs/page.tsx → settings/page.tsx
6. **Test run order:** backend → settings → add topics/leads → run agents

---

## 16. CHANGE LOG
> Update this section whenever you modify the project

| Date | Change | File(s) |
|------|--------|---------|
| 2026-03-01 | Initial build | All |
| 2026-03-01 | Added Pydantic validators (email, URL, topic, company) | `models.py` |
| 2026-03-01 | CSV upload guards: 5 MB limit, 5000 row limit | `routes.py` |
| 2026-03-01 | Fixed SSL verify=False → verify=True in website scraping | `agent2/service.py` |
| 2026-03-01 | Added logging to all bare `except Exception` blocks | `agent1-4/service.py` |
| 2026-03-01 | LLM JSONDecodeError no longer leaks raw response text | `llm_provider.py` |
| 2026-03-01 | JSON DB corruption guard (returns [] on bad JSON) | `json_db.py` |
| 2026-03-01 | Added `extractApiError()` helper | `services/api.ts` |
| 2026-03-01 | Fixed AgentId type union (added agent3, agent4) | `useAgentPoller.ts` |
| 2026-03-01 | Client-side email/URL/file-size validation in Add Lead and CSV upload | `agents/[id]/page.tsx` |
| 2026-03-01 | Error state clears on retry; real error messages from API shown | `agents/page.tsx`, `agents/[id]/page.tsx` |

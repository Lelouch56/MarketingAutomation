// ─────────────────────────────────────────────────────────────
// LLM Configuration
// ─────────────────────────────────────────────────────────────

export interface LLMConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'grok' | 'groq';
  apiKey: string;
  model: string;
}

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
  publishStatus: 'draft' | 'publish';
}

export interface LinkedInConfig {
  accessToken: string;
  authorUrn: string;
}

export interface KlentyConfig {
  apiKey: string;
  userEmail: string;
  campaignAName: string;
  campaignBName: string;
  campaignCName: string;
}

export interface OutplayConfig {
  clientSecret: string;  // X-CLIENT-SECRET header
  clientId: string;      // ?client_id= query param
  userId: string;        // Outplay user ID (required for sequence enrollment)
  location: string;      // Regional server, e.g. "us4"
  sequenceIdA: string;   // Numeric sequence ID — Qualified Lead Marktech (Agent 2, score > 70)
  sequenceIdB: string;   // Numeric sequence ID — Personal Lead Marktech (Agent 2, Gmail/Yahoo/etc.)
  sequenceIdC: string;   // Numeric sequence ID — Travel Tech Outreach (Agent 3, Matters broad)
}

export interface ApolloConfig {
  apiKey: string;
  perPage: number;
  sequenceIdOta: string;      // Apollo ICP1 sequence — OTA / Travel Tech / TMC
  sequenceIdHotels: string;   // Apollo ICP2 sequence — Bedbank / Hotel Wholesaler / Hotel Distribution
  emailAccountId: string;     // Apollo mailbox ID used to send sequence emails
}

export interface SalesNavigatorConfig {
  accessToken: string;
  count: number;
}

export interface HubSpotConfig {
  accessToken: string;
  maxContacts: number;
  listId: string;  // Number from objectLists/N in HubSpot URL (e.g. 9)
}

export interface PhantomBusterConfig {
  apiKey: string;
  searchPhantomId: string;       // "LinkedIn Search Export" phantom Agent ID
  connectionPhantomId: string;   // "LinkedIn Connection Sender" phantom Agent ID
  sessionCookie: string;         // LinkedIn li_at cookie
  connectionsPerLaunch: number;  // cap per run (default 10)
}

export const MODEL_OPTIONS: Record<LLMConfig['provider'], string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-2.0-pro-exp-02-05'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  grok: ['grok-2', 'grok-2-latest'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct'],
};

export const PROVIDER_LABELS: Record<LLMConfig['provider'], string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  grok: 'xAI (Grok)',
  groq: 'Groq (Free Llama)',
};

// ─────────────────────────────────────────────────────────────
// Image Generation Configuration (separate from text LLM)
// ─────────────────────────────────────────────────────────────

export interface ImageGenConfig {
  provider: 'openai' | 'gemini' | 'ideogram';
  apiKey: string;
  model: string;
  enabled: boolean;
}

export const IMAGE_GEN_MODEL_OPTIONS: Record<ImageGenConfig['provider'], string[]> = {
  gemini: ['gemini-2.0-flash-exp-image-generation', 'imagen-3.0-generate-002'],
  openai: ['dall-e-3'],
  ideogram: ['ideogram-v3'],
};

export const IMAGE_GEN_PROVIDER_LABELS: Record<ImageGenConfig['provider'], string> = {
  gemini: 'Google Gemini (Free)',
  openai: 'OpenAI (DALL-E 3)',
  ideogram: 'Ideogram (Free)',
};

// ─────────────────────────────────────────────────────────────
// Agent Run State
// ─────────────────────────────────────────────────────────────

export type StepStatusType = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'warning';
export type AgentStatusType = 'idle' | 'running' | 'completed' | 'failed';

export interface StepStatus {
  step_number: number;
  name: string;
  status: StepStatusType;
  message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface AgentRunStatus {
  agent_id: string;
  run_id: string;
  status: AgentStatusType;
  steps: StepStatus[];
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: unknown;
}

// ─────────────────────────────────────────────────────────────
// Agent Metadata (from GET /agents)
// ─────────────────────────────────────────────────────────────

export interface AgentMeta {
  id: string;
  name: string;
  description: string;
  type: string;
  schedule: string;
  status: AgentStatusType | string;
  steps_count: number;
  last_run?: string;
  implemented: boolean;
}

// ─────────────────────────────────────────────────────────────
// Data Models
// ─────────────────────────────────────────────────────────────

export interface TopicRecord {
  id?: string;
  topic: string;
  status: 'Pending' | 'Processing' | 'Published' | 'Failed';
  url?: string;
  blog_title?: string;
  linkedin_post?: string;
  quality_score?: number;
  created_at?: string;
  updated_at?: string;
  // Agent 2 web-scrape seeding fields
  source?: string;              // "web_scrape" = seeded by Agent 2 | undefined = manually added
  source_company?: string;      // company website URL that generated this topic
  source_lead_email?: string;   // lead email that was scraped
  llm_relevance?: string;       // LLM explanation of why this topic suits Vervotech
  relevance_score?: number;     // 0–100 relevance confidence score
}

export interface LeadRecord {
  id?: string;
  email: string;
  website?: string;
  name?: string;
  company?: string;
  category?: 'Qualified' | 'Nurture' | 'Personal' | 'Disqualified';
  analysis_status?: 'completed' | 'skipped' | 'failed';
  campaign?: string;
  campaign_label?: string;
  score?: number;
  industry_fit?: boolean;
  company_type?: string;
  reasoning?: string;
  signals?: string[];
  concerns?: string[];
  klenty_enrolled?: boolean;
  klenty_enrolled_run_id?: string;
  klenty_enrolled_at?: string;
  outplay_enrolled?: boolean;
  outplay_enrolled_run_id?: string;
  outplay_enrolled_at?: string;
  hubspot_list_added?: boolean;
  hubspot_list_added_run_id?: string;
  hubspot_list_added_at?: string;
  processed_run_id?: string;
  processed_at?: string;
  created_at?: string;
}

export interface OutreachTargetRecord {
  id: string;
  run_id?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  title?: string;
  company?: string;
  company_type?: string;          // OTA | Bedbank | Hotel Wholesaler | TMC | Travel Tech | Hotel Distribution
  website?: string;
  linkedin_url?: string;
  phone?: string;
  region?: string;
  employees?: string;
  relevance_reason?: string;
  crm_tag?: string;               // "Qualified Lead" | "Travel Tech Prospect"
  crm_tags?: string[];
  outreach_score?: number | null;
  outreach_reason?: string;
  connection_message?: string;
  is_dummy?: boolean;
  source?: string;
  lead_source?: string;             // "Apollo" | "Boolean Search" | "LinkedIn"
  qualification_status?: string;    // "Qualified" | "Raw"
  status: 'raw' | 'filtered' | 'pending_approval' | 'approved';
  apollo_enrolled?: boolean;
  klenty_enrolled?: boolean;
  outplay_enrolled?: boolean;
  outplay_enroll_error?: string;
  linkedin_status?: string;
  created_at?: string;
  approved_at?: string;
}

export interface RejectedProspectRecord {
  id: string;
  run_id?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  title?: string;
  company?: string;
  company_type?: string;
  linkedin_url?: string;
  region?: string;
  lead_source?: string;             // "Apollo" | "Boolean Search" | "LinkedIn"
  source?: string;
  is_dummy?: boolean;
  removal_reason: 'duplicate_email' | 'off_target_role' | 'non_travel_tech';
  removed_at?: string;
  created_at?: string;
  force_enrolled?: boolean;
  force_enrolled_at?: string;
}

export interface ReportRecord {
  id: string;
  generated_at: string;
  status: 'draft' | 'complete';
  funnel_summary?: {
    total_leads: number;
    qualified_leads: number;
    nurture_leads: number;
    personal_leads: number;
    disqualified_leads: number;
    sequence_a_enrolled: number;
    sequence_b_enrolled: number;
    outreach_targets: number;
    blogs_published: number;
    conversion_rate_pct: number;
  };
  health_score?: number;
  health_rating?: string;
  key_insights?: string[];
  recommendations?: string[];
  executive_summary?: string;
  one_liner?: string;
}

export interface BlogRecord {
  id?: string;
  topic_id?: string;
  topic: string;
  title?: string;
  slug?: string;
  meta_description?: string;
  content_html?: string;
  quality_score?: number;
  quality_verdict?: string;
  linkedin_post?: string;
  linkedin_hashtags?: string[];
  blog_url: string;
  created_at?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  agent_id?: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// localStorage Keys
// ─────────────────────────────────────────────────────────────

export const LS_LLM_CONFIG = 'ma_llm_config';
export const LS_AGENT1_STATE = 'ma_agent1_state';
export const LS_AGENT2_STATE = 'ma_agent2_state';
export const LS_AGENT3_STATE = 'ma_agent3_state';
export const LS_AGENT4_STATE = 'ma_agent4_state';
export const LS_LOGS = 'ma_logs';
export const LS_WP_CONFIG = 'ma_wp_config';
export const LS_LINKEDIN_CONFIG = 'ma_linkedin_config';
export const LS_KLENTY_CONFIG = 'ma_klenty_config';
export const LS_OUTPLAY_CONFIG = 'ma_outplay_config';
export const LS_APOLLO_CONFIG = 'ma_apollo_config';
export const LS_SALES_NAVIGATOR_CONFIG = 'ma_sales_navigator_config';
export const LS_HUBSPOT_CONFIG = 'ma_hubspot_config';
export const LS_PHANTOMBUSTER_CONFIG = 'ma_phantombuster_config';
export const LS_IMAGE_GEN_CONFIG = 'ma_image_gen_config';

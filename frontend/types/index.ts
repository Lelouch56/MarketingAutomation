// ─────────────────────────────────────────────────────────────
// LLM Configuration
// ─────────────────────────────────────────────────────────────

export interface LLMConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'grok';
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
  apiKey: string;
  sequenceNameA: string;
  sequenceNameB: string;
  sequenceNameC: string;
}

export const MODEL_OPTIONS: Record<LLMConfig['provider'], string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-pro-exp-02-05'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  grok: ['grok-2', 'grok-2-latest'],
};

export const PROVIDER_LABELS: Record<LLMConfig['provider'], string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  grok: 'xAI (Grok)',
};

// ─────────────────────────────────────────────────────────────
// Agent Run State
// ─────────────────────────────────────────────────────────────

export type StepStatusType = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
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
}

export interface LeadRecord {
  id?: string;
  email: string;
  website?: string;
  name?: string;
  company?: string;
  category?: 'Hot' | 'Warm' | 'Cold';
  campaign?: string;
  campaign_label?: string;
  score?: number;
  industry_fit?: boolean;
  company_type?: string;
  reasoning?: string;
  signals?: string[];
  concerns?: string[];
  klenty_enrolled?: boolean;
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
  company_type?: string;
  website?: string;
  linkedin_url?: string;
  region?: string;
  employees?: string;
  relevance_reason?: string;
  status: 'raw' | 'filtered' | 'pending_approval' | 'approved';
  klenty_enrolled?: boolean;
  linkedin_status?: string;
  created_at?: string;
  approved_at?: string;
}

export interface ReportRecord {
  id: string;
  generated_at: string;
  status: 'draft' | 'complete';
  funnel_summary?: {
    total_leads: number;
    hot_leads: number;
    warm_leads: number;
    cold_leads: number;
    fit_clients: number;
    outreach_targets: number;
    klenty_enrolled: number;
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
  quality_score?: number;
  quality_verdict?: string;
  linkedin_post?: string;
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

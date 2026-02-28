import axios, { AxiosInstance } from 'axios';
import { getLLMConfig, getWordPressConfig, getLinkedInConfig, getKlentyConfig, getOutplayConfig } from '../lib/storage';
import {
  AgentRunStatus,
  TopicRecord,
  LeadRecord,
  BlogRecord,
  LogEntry,
  AgentMeta,
  OutreachTargetRecord,
  ReportRecord,
} from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

/** Build run request body with LLM config from localStorage. Throws if not configured. */
function buildRunRequest() {
  const config = getLLMConfig();
  if (!config || !config.apiKey) {
    throw new Error(
      'LLM provider not configured. Please go to Settings and add your API key.'
    );
  }

  const body: Record<string, unknown> = {
    llm_config: {
      provider: config.provider,
      api_key: config.apiKey,
      model: config.model,
    },
  };

  // Attach WordPress config if available
  const wpConfig = getWordPressConfig();
  if (wpConfig?.siteUrl && wpConfig?.username && wpConfig?.appPassword) {
    body.wordpress = {
      site_url: wpConfig.siteUrl,
      username: wpConfig.username,
      app_password: wpConfig.appPassword,
      publish_status: wpConfig.publishStatus || 'draft',
    };
  }

  // Attach LinkedIn config if available
  const liConfig = getLinkedInConfig();
  if (liConfig?.accessToken && liConfig?.authorUrn) {
    body.linkedin = {
      access_token: liConfig.accessToken,
      author_urn: liConfig.authorUrn,
    };
  }

  // Attach Klenty config if available
  const klentyConfig = getKlentyConfig();
  if (klentyConfig?.apiKey && klentyConfig?.userEmail) {
    body.klenty = {
      api_key: klentyConfig.apiKey,
      user_email: klentyConfig.userEmail,
      campaign_a_name: klentyConfig.campaignAName || 'Campaign A',
      campaign_b_name: klentyConfig.campaignBName || 'Campaign B',
      campaign_c_name: klentyConfig.campaignCName || 'Campaign C',
    };
  }

  // Attach Outplay config if available
  const outplayConfig = getOutplayConfig();
  if (outplayConfig?.apiKey) {
    body.outplay = {
      api_key: outplayConfig.apiKey,
      sequence_name_a: outplayConfig.sequenceNameA || 'Travel Fit Sequence',
      sequence_name_b: outplayConfig.sequenceNameB || 'Warm Lead Sequence',
      sequence_name_c: outplayConfig.sequenceNameC || 'Cold Lead Sequence',
    };
  }

  return body;
}

// ─────────────────────────────────────────────────────────────
// Agent 1 API
// ─────────────────────────────────────────────────────────────

export const agent1Api = {
  run: (opts?: { wordpress?: boolean; linkedin?: boolean }) => {
    const body = buildRunRequest();
    if (opts?.wordpress === false) delete body.wordpress;
    if (opts?.linkedin === false) delete body.linkedin;
    return http.post('/agents/agent1/run', body);
  },

  getStatus: (): Promise<AgentRunStatus> =>
    http.get('/agents/agent1/status').then((r) => r.data),

  getTopics: (): Promise<TopicRecord[]> =>
    http.get('/agents/agent1/topics').then((r) => r.data),

  addTopic: (topic: string): Promise<TopicRecord> =>
    http.post('/agents/agent1/topics', { topic }).then((r) => r.data),

  uploadTopicsCsv: (file: File): Promise<{ added_count: number; topics: TopicRecord[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    return http
      .post('/agents/agent1/topics/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getBlogs: (): Promise<BlogRecord[]> =>
    http.get('/agents/agent1/blogs').then((r) => r.data),
};

// ─────────────────────────────────────────────────────────────
// Agent 2 API
// ─────────────────────────────────────────────────────────────

export const agent2Api = {
  run: () => http.post('/agents/agent2/run', buildRunRequest()),

  getStatus: (): Promise<AgentRunStatus> =>
    http.get('/agents/agent2/status').then((r) => r.data),

  getLeads: (): Promise<LeadRecord[]> =>
    http.get('/agents/agent2/leads').then((r) => r.data),

  addLead: (lead: Partial<LeadRecord>): Promise<LeadRecord> =>
    http.post('/agents/agent2/leads', lead).then((r) => r.data),
};

// ─────────────────────────────────────────────────────────────
// Agent 3 API
// ─────────────────────────────────────────────────────────────

export const agent3Api = {
  run: () => http.post('/agents/agent3/run', buildRunRequest()),

  getStatus: (): Promise<AgentRunStatus> =>
    http.get('/agents/agent3/status').then((r) => r.data),

  getOutreachTargets: (): Promise<OutreachTargetRecord[]> =>
    http.get('/agents/agent3/outreach-targets').then((r) => r.data),

  approveTarget: (targetId: string): Promise<{ status: string; target_id: string }> =>
    http.post(`/agents/agent3/outreach-targets/${targetId}/approve`).then((r) => r.data),
};

// ─────────────────────────────────────────────────────────────
// Agent 4 API
// ─────────────────────────────────────────────────────────────

export const agent4Api = {
  run: () => http.post('/agents/agent4/run', buildRunRequest()),

  getStatus: (): Promise<AgentRunStatus> =>
    http.get('/agents/agent4/status').then((r) => r.data),

  getReports: (): Promise<ReportRecord[]> =>
    http.get('/agents/agent4/reports').then((r) => r.data),
};

// ─────────────────────────────────────────────────────────────
// Integration Test API
// ─────────────────────────────────────────────────────────────

export const integrationsApi = {
  testWordPress: (config: {
    site_url: string;
    username: string;
    app_password: string;
  }): Promise<{ success: boolean; message: string; site_name?: string }> =>
    http.post('/integrations/test/wordpress', config).then((r) => r.data),

  testWordPressPublish: (config: {
    site_url: string;
    username: string;
    app_password: string;
  }): Promise<{ id?: string; link?: string; status?: string; message?: string }> =>
    http.post('/integrations/test-publish/wordpress', config).then((r) => r.data),

  testLinkedIn: (config: {
    access_token: string;
    author_urn: string;
  }): Promise<{ success: boolean; message: string; name?: string }> =>
    http.post('/integrations/test/linkedin', config).then((r) => r.data),

  testLinkedInPublish: (config: {
    access_token: string;
    author_urn: string;
  }): Promise<{ post_urn?: string; message: string }> =>
    http.post('/integrations/test-publish/linkedin', config).then((r) => r.data),

  testKlenty: (config: {
    api_key: string;
    user_email: string;
    campaign_a_name?: string;
    campaign_b_name?: string;
    campaign_c_name?: string;
  }): Promise<{ success: boolean; message: string; campaigns_found?: number }> =>
    http.post('/integrations/test/klenty', config).then((r) => r.data),

  testOutplay: (config: {
    api_key: string;
    sequence_name_a?: string;
    sequence_name_b?: string;
    sequence_name_c?: string;
  }): Promise<{ success: boolean; message: string; sequences_found?: number }> =>
    http.post('/integrations/test/outplay', config).then((r) => r.data),
};

// ─────────────────────────────────────────────────────────────
// Global API
// ─────────────────────────────────────────────────────────────

export const globalApi = {
  getAgents: (): Promise<AgentMeta[]> =>
    http.get('/agents').then((r) => r.data),

  getAgentStatus: (agentId: string): Promise<AgentRunStatus> =>
    http.get(`/agents/${agentId}/status`).then((r) => r.data),

  getLogs: (params?: { level?: string; agent_id?: string }): Promise<LogEntry[]> =>
    http.get('/logs', { params }).then((r) => r.data),

  clearLogs: () => http.post('/logs/clear'),

  health: () => http.get('/health').then((r) => r.data),
};

/** Extract a human-readable error message from an API call failure. */
export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.detail ?? err.message ?? 'Request failed';
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export default http;


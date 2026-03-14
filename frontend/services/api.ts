import axios, { AxiosInstance } from 'axios';
import { getLLMConfig, getLinkedInConfig, getKlentyConfig, getOutplayConfig, getApolloConfig, getSalesNavigatorConfig, getHubSpotConfig, getPhantomBusterConfig, getImageGenConfig } from '../lib/storage';
import {
  AgentRunStatus,
  TopicRecord,
  LeadRecord,
  BlogRecord,
  LogEntry,
  AgentMeta,
  OutreachTargetRecord,
  RejectedProspectRecord,
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
  if (outplayConfig?.clientSecret) {
    body.outplay = {
      client_secret: outplayConfig.clientSecret,
      client_id: outplayConfig.clientId || '',
      user_id: outplayConfig.userId || '',
      location: outplayConfig.location || 'us4',
      sequence_id_a: outplayConfig.sequenceIdA || '',   // Qualified Lead Marktech (Agent 2)
      sequence_id_b: outplayConfig.sequenceIdB || '',   // Personal Lead Marktech (Agent 2)
      sequence_id_c: outplayConfig.sequenceIdC || '',   // Travel Tech Outreach (Agent 3)
    };
  }

  // Attach Apollo config if available
  const apolloConfig = getApolloConfig();
  if (apolloConfig?.apiKey) {
    body.apollo = {
      api_key: apolloConfig.apiKey,
      per_page: apolloConfig.perPage || 10,
      sequence_id_ota: apolloConfig.sequenceIdOta || '',       // ICP1 — OTA / Travel Tech / TMC
      sequence_id_hotels: apolloConfig.sequenceIdHotels || '', // ICP2 — Bedbank / Hotel Wholesaler / Hotel Distribution
      email_account_id: apolloConfig.emailAccountId || '',     // Apollo mailbox for sending
    };
  }

  // Attach Sales Navigator config if available (primary for Agent 3 prospect search)
  const salesNavConfig = getSalesNavigatorConfig();
  if (salesNavConfig?.accessToken) {
    body.sales_navigator = {
      access_token: salesNavConfig.accessToken,
      count: salesNavConfig.count || 10,
    };
  }

  // Attach HubSpot config if available (lead source for Agent 2 + outreach enrollment for Agent 3)
  const hubspotConfig = getHubSpotConfig();
  if (hubspotConfig?.accessToken) {
    body.hubspot = {
      access_token: hubspotConfig.accessToken,
      max_contacts: hubspotConfig.maxContacts ?? 100,
      list_id: hubspotConfig.listId ?? '',
    };
  }

  // Attach PhantomBuster config if available (LinkedIn Search + Connection Sender for Agent 3)
  const pbConfig = getPhantomBusterConfig();
  if (pbConfig?.apiKey) {
    body.phantombuster = {
      api_key: pbConfig.apiKey,
      search_phantom_id: pbConfig.searchPhantomId,
      connection_phantom_id: pbConfig.connectionPhantomId,
      session_cookie: pbConfig.sessionCookie,
      connections_per_launch: pbConfig.connectionsPerLaunch ?? 10,
    };
  }

  // Attach Image Generation config if available and enabled (Agent 1 uses for LinkedIn image)
  const imageGenConfig = getImageGenConfig();
  if (imageGenConfig?.enabled && imageGenConfig?.apiKey) {
    body.image_gen_config = {
      provider: imageGenConfig.provider,
      api_key: imageGenConfig.apiKey,
      model: imageGenConfig.model,
      enabled: imageGenConfig.enabled,
    };
  }

  return body;
}

// ─────────────────────────────────────────────────────────────
// Agent 1 API
// ─────────────────────────────────────────────────────────────

export const agent1Api = {
  run: (opts?: { linkedin?: boolean }) => {
    const body = buildRunRequest();
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

  downloadLeads: (campaign?: string) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const params = campaign && campaign !== 'all' ? `?campaign=${campaign}` : '';
    const suffix = campaign && campaign !== 'all' ? `-campaign-${campaign}` : '';
    const a = document.createElement('a');
    a.href = `${BASE_URL}/agents/agent2/leads/download${params}`;
    a.download = `leads-analysis${suffix}.csv`;
    a.click();
  },
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

  approveTarget: (
    targetId: string,
    body?: Record<string, unknown>,
  ): Promise<{ status: string; target_id: string; outplay_enrolled: boolean }> =>
    http.post(`/agents/agent3/outreach-targets/${targetId}/approve`, body ?? {}).then((r) => r.data),

  getRejectedProspects: (): Promise<RejectedProspectRecord[]> =>
    http.get('/agents/agent3/rejected-prospects').then((r) => r.data),

  forceEnrollRejected: (
    rejectedId: string,
    body?: Record<string, unknown>,
  ): Promise<{ found: boolean; outplay_enrolled: boolean; message: string }> =>
    http.post(`/agents/agent3/rejected-prospects/${rejectedId}/force-enroll`, body ?? {}).then((r) => r.data),
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
  testLinkedIn: (config: {
    access_token: string;
    author_urn: string;
  }): Promise<{ success: boolean; message: string; name?: string; person_urn?: string }> =>
    http.post('/integrations/test/linkedin', config).then((r) => r.data),

  testLinkedInPublish: (config: {
    access_token: string;
    author_urn: string;
  }): Promise<{ post_urn?: string; message: string }> =>
    http.post('/integrations/test-publish/linkedin', config).then((r) => r.data),

  testLinkedInPublishWithImage: (config: {
    access_token: string;
    author_urn: string;
    image_url: string;
    post_text?: string;
  }): Promise<{ post_urn?: string; message: string }> =>
    http.post('/integrations/test-publish/linkedin-image', config).then((r) => r.data),

  testKlenty: (config: {
    api_key: string;
    user_email: string;
    campaign_a_name?: string;
    campaign_b_name?: string;
    campaign_c_name?: string;
  }): Promise<{ success: boolean; message: string; campaigns_found?: number }> =>
    http.post('/integrations/test/klenty', config).then((r) => r.data),

  testOutplay: (config: {
    client_secret: string;
    client_id?: string;
    user_id?: string;
    location?: string;
    sequence_id_a?: string;   // Qualified Lead Marktech
    sequence_id_b?: string;   // Personal Lead Marktech
  }): Promise<{ success: boolean; message: string }> =>
    http.post('/integrations/test/outplay', config).then((r) => r.data),

  testOutplayProspect: (config: {
    client_secret: string;
    client_id?: string;
    user_id?: string;
    location?: string;
    sequence_id_a?: string;   // Qualified Lead Marktech
    sequence_id_b?: string;   // Personal Lead Marktech
  }): Promise<{ success: boolean; message: string; prospect_id?: string }> =>
    http.post('/integrations/test/outplay-prospect', config).then((r) => r.data),

  testApollo: (config: {
    api_key: string;
    per_page?: number;
  }): Promise<{ success: boolean; message: string }> =>
    http.post('/integrations/test/apollo', config).then((r) => r.data),

  testSalesNavigator: (config: {
    access_token: string;
    count?: number;
  }): Promise<{ success: boolean; message: string }> =>
    http.post('/integrations/test/sales-navigator', config).then((r) => r.data),

  testHubSpot: (config: {
    access_token: string;
    max_contacts?: number;
    list_id?: string;
  }): Promise<{ success: boolean; message: string }> =>
    http.post('/integrations/test/hubspot', config).then((r) => r.data),

  testHubSpotProspect: (config: {
    access_token: string;
    max_contacts?: number;
    list_id?: string;
  }): Promise<{ success: boolean; message: string; contact_id?: string; enrolled?: boolean }> =>
    http.post('/integrations/test/hubspot-prospect', config).then((r) => r.data),

  testPhantomBuster: (config: {
    api_key: string;
    search_phantom_id: string;
    connection_phantom_id: string;
    session_cookie: string;
    connections_per_launch?: number;
  }): Promise<{ status: string; email?: string; message?: string }> =>
    http.post('/integrations/test/phantombuster', config).then((r) => r.data),
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


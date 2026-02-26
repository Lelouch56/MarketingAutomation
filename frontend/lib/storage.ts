import {
  LLMConfig,
  WordPressConfig,
  LinkedInConfig,
  KlentyConfig,
  OutplayConfig,
  AgentRunStatus,
  LogEntry,
  LS_LLM_CONFIG,
  LS_AGENT1_STATE,
  LS_AGENT2_STATE,
  LS_AGENT3_STATE,
  LS_AGENT4_STATE,
  LS_LOGS,
  LS_WP_CONFIG,
  LS_LINKEDIN_CONFIG,
  LS_KLENTY_CONFIG,
  LS_OUTPLAY_CONFIG,
} from '../types';

const isBrowser = typeof window !== 'undefined';

// ─────────────────────────────────────────────────────────────
// LLM Configuration
// ─────────────────────────────────────────────────────────────

export function getLLMConfig(): LLMConfig | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(LS_LLM_CONFIG);
    return raw ? (JSON.parse(raw) as LLMConfig) : null;
  } catch {
    return null;
  }
}

export function setLLMConfig(config: LLMConfig): void {
  if (!isBrowser) return;
  localStorage.setItem(LS_LLM_CONFIG, JSON.stringify(config));
}

export function clearLLMConfig(): void {
  if (!isBrowser) return;
  localStorage.removeItem(LS_LLM_CONFIG);
}

// ─────────────────────────────────────────────────────────────
// WordPress Configuration
// ─────────────────────────────────────────────────────────────

export function getWordPressConfig(): WordPressConfig | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(LS_WP_CONFIG);
    return raw ? (JSON.parse(raw) as WordPressConfig) : null;
  } catch {
    return null;
  }
}

export function setWordPressConfig(config: WordPressConfig): void {
  if (!isBrowser) return;
  localStorage.setItem(LS_WP_CONFIG, JSON.stringify(config));
}

export function clearWordPressConfig(): void {
  if (!isBrowser) return;
  localStorage.removeItem(LS_WP_CONFIG);
}

// ─────────────────────────────────────────────────────────────
// LinkedIn Configuration
// ─────────────────────────────────────────────────────────────

export function getLinkedInConfig(): LinkedInConfig | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(LS_LINKEDIN_CONFIG);
    return raw ? (JSON.parse(raw) as LinkedInConfig) : null;
  } catch {
    return null;
  }
}

export function setLinkedInConfig(config: LinkedInConfig): void {
  if (!isBrowser) return;
  localStorage.setItem(LS_LINKEDIN_CONFIG, JSON.stringify(config));
}

export function clearLinkedInConfig(): void {
  if (!isBrowser) return;
  localStorage.removeItem(LS_LINKEDIN_CONFIG);
}

// ─────────────────────────────────────────────────────────────
// Klenty Configuration
// ─────────────────────────────────────────────────────────────

export function getKlentyConfig(): KlentyConfig | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(LS_KLENTY_CONFIG);
    return raw ? (JSON.parse(raw) as KlentyConfig) : null;
  } catch {
    return null;
  }
}

export function setKlentyConfig(config: KlentyConfig): void {
  if (!isBrowser) return;
  localStorage.setItem(LS_KLENTY_CONFIG, JSON.stringify(config));
}

export function clearKlentyConfig(): void {
  if (!isBrowser) return;
  localStorage.removeItem(LS_KLENTY_CONFIG);
}

// ─────────────────────────────────────────────────────────────
// Outplay Configuration
// ─────────────────────────────────────────────────────────────

export function getOutplayConfig(): OutplayConfig | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(LS_OUTPLAY_CONFIG);
    return raw ? (JSON.parse(raw) as OutplayConfig) : null;
  } catch {
    return null;
  }
}

export function setOutplayConfig(config: OutplayConfig): void {
  if (!isBrowser) return;
  localStorage.setItem(LS_OUTPLAY_CONFIG, JSON.stringify(config));
}

export function clearOutplayConfig(): void {
  if (!isBrowser) return;
  localStorage.removeItem(LS_OUTPLAY_CONFIG);
}

// ─────────────────────────────────────────────────────────────
// Agent State
// ─────────────────────────────────────────────────────────────

const AGENT_STATE_KEYS: Record<string, string> = {
  agent1: LS_AGENT1_STATE,
  agent2: LS_AGENT2_STATE,
  agent3: LS_AGENT3_STATE,
  agent4: LS_AGENT4_STATE,
};

function agentStateKey(agentId: 'agent1' | 'agent2' | 'agent3' | 'agent4'): string {
  return AGENT_STATE_KEYS[agentId] || LS_AGENT1_STATE;
}

export function getAgentState(agentId: 'agent1' | 'agent2' | 'agent3' | 'agent4'): AgentRunStatus | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(agentStateKey(agentId));
    return raw ? (JSON.parse(raw) as AgentRunStatus) : null;
  } catch {
    return null;
  }
}

export function setAgentState(agentId: 'agent1' | 'agent2' | 'agent3' | 'agent4', state: AgentRunStatus): void {
  if (!isBrowser) return;
  localStorage.setItem(agentStateKey(agentId), JSON.stringify(state));
}

// ─────────────────────────────────────────────────────────────
// Activity Logs (capped at 50 entries)
// ─────────────────────────────────────────────────────────────

export function getLogs(): LogEntry[] {
  if (!isBrowser) return [];
  try {
    return JSON.parse(localStorage.getItem(LS_LOGS) || '[]') as LogEntry[];
  } catch {
    return [];
  }
}

export function appendLog(entry: LogEntry): void {
  if (!isBrowser) return;
  const existing = getLogs();
  existing.push(entry);
  if (existing.length > 50) existing.shift();
  localStorage.setItem(LS_LOGS, JSON.stringify(existing));
}

export function clearLogs(): void {
  if (!isBrowser) return;
  localStorage.setItem(LS_LOGS, '[]');
}


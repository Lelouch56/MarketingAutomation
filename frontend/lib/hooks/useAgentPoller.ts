'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AgentRunStatus } from '../../types';
import { setAgentState } from '../storage';

interface UseAgentPollerOptions {
  agentId: 'agent1' | 'agent2' | 'agent3' | 'agent4';
  fetchStatus: () => Promise<AgentRunStatus>;
  intervalMs?: number;
}

export function useAgentPoller({
  agentId,
  fetchStatus,
  intervalMs = 2000,
}: UseAgentPollerOptions) {
  const [status, setStatus] = useState<AgentRunStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async () => {
    try {
      const result = await fetchStatus();
      setStatus(result);
      setAgentState(agentId, result);
      // Stop polling when agent finishes (completed or failed)
      if (result.status !== 'running') {
        stopPolling();
      }
    } catch {
      stopPolling();
    }
  }, [agentId, fetchStatus, stopPolling]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // already polling
    setIsPolling(true);
    poll(); // immediate first poll
    intervalRef.current = setInterval(poll, intervalMs);
  }, [poll, intervalMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { status, isPolling, startPolling, stopPolling, setStatus };
}

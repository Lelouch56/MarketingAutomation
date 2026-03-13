'use client';

import { Grid, Typography, Box, Alert, Snackbar, Button } from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SettingsIcon from '@mui/icons-material/Settings';
import AgentCard from '../components/agents/AgentCard';
import { agent1Api, agent2Api, agent3Api, agent4Api } from '../services/api';
import { useAgentPoller } from '../lib/hooks/useAgentPoller';
import { getLLMConfig, appendLog, getAgentState } from '../lib/storage';

export default function Dashboard() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);

  // Initialize pollers for all 4 agents
  const {
    status: a1Status,
    isPolling: a1Running,
    startPolling: startA1,
    setStatus: setA1Status,
  } = useAgentPoller({ agentId: 'agent1', fetchStatus: agent1Api.getStatus });

  const {
    status: a2Status,
    isPolling: a2Running,
    startPolling: startA2,
    setStatus: setA2Status,
  } = useAgentPoller({ agentId: 'agent2', fetchStatus: agent2Api.getStatus });

  const {
    status: a3Status,
    isPolling: a3Running,
    startPolling: startA3,
    setStatus: setA3Status,
  } = useAgentPoller({ agentId: 'agent3', fetchStatus: agent3Api.getStatus });

  const {
    status: a4Status,
    isPolling: a4Running,
    startPolling: startA4,
    setStatus: setA4Status,
  } = useAgentPoller({ agentId: 'agent4', fetchStatus: agent4Api.getStatus });

  // On mount: check config + load cached state
  useEffect(() => {
    const config = getLLMConfig();
    setHasConfig(!!config?.apiKey);

    const s1 = getAgentState('agent1');
    if (s1) setA1Status(s1);
    const s2 = getAgentState('agent2');
    if (s2) setA2Status(s2);
    const s3 = getAgentState('agent3');
    if (s3) setA3Status(s3);
    const s4 = getAgentState('agent4');
    if (s4) setA4Status(s4);
  }, [setA1Status, setA2Status, setA3Status, setA4Status]);

  const handleRunAgent1 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) {
      setError('Please configure your LLM provider in Settings before running an agent.');
      return;
    }
    try {
      await agent1Api.run();
      appendLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Agent 1 (Hangout Social) started',
        agent_id: 'agent1',
      });
      setSuccessMsg('Agent 1 started! Watching progress...');
      startA1();
      setError(null);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Failed to start Agent 1. Is the backend running?';
      setError(msg);
    }
  }, [startA1]);

  const handleRunAgent2 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) {
      setError('Please configure your LLM provider in Settings before running an agent.');
      return;
    }
    try {
      await agent2Api.run();
      appendLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Agent 2 (Matters) started',
        agent_id: 'agent2',
      });
      setSuccessMsg('Agent 2 started! Watching progress...');
      startA2();
      setError(null);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Failed to start Agent 2. Is the backend running?';
      setError(msg);
    }
  }, [startA2]);

  const handleRunAgent3 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) {
      setError('Please configure your LLM provider in Settings before running an agent.');
      return;
    }
    try {
      await agent3Api.run();
      appendLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Agent 3 (Matters broad) started',
        agent_id: 'agent3',
      });
      setSuccessMsg('Agent 3 started! Watching progress...');
      startA3();
      setError(null);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Failed to start Agent 3. Is the backend running?';
      setError(msg);
    }
  }, [startA3]);

  const handleRunAgent4 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) {
      setError('Please configure your LLM provider in Settings before running an agent.');
      return;
    }
    try {
      await agent4Api.run();
      appendLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Agent 4 (Ringside View) started',
        agent_id: 'agent4',
      });
      setSuccessMsg('Agent 4 started! Watching progress...');
      startA4();
      setError(null);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Failed to start Agent 4. Is the backend running?';
      setError(msg);
    }
  }, [startA4]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            4 AI agents automating your marketing funnel end-to-end
          </Typography>
        </Box>
      </Box>

      {!hasConfig && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => router.push('/settings')}
            >
              Configure
            </Button>
          }
        >
          No LLM provider configured. Add your API key in Settings to run agents.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Agent 2 */}
        <Grid item xs={12} sm={6}>
          <AgentCard
            agentId="agent2"
            name="Matters"
            description="Deduplicates and categorizes leads, scrapes company websites, AI-scores for travel industry fit, seeds blog topics to Hangout Social, and auto-enrolls into Klenty/Outplay campaigns."
            status={a2Status}
            stepsCount={8}
            onRun={handleRunAgent2}
            isRunning={a2Running || a2Status?.status === 'running'}
            lastRun={a2Status?.completed_at}
            implemented={true}
          />
        </Grid>

        {/* Agent 3 */}
        <Grid item xs={12} sm={6}>
          <AgentCard
            agentId="agent3"
            name="Matters broad"
            description="Reads Matters hot leads, domain-searches Apollo for decision-makers at those exact companies, AI-scores outreach fit with personalized LinkedIn messages, and auto-enrolls approved targets."
            status={a3Status}
            stepsCount={8}
            onRun={handleRunAgent3}
            isRunning={a3Running || a3Status?.status === 'running'}
            lastRun={a3Status?.completed_at}
            implemented={true}
          />
        </Grid>

        {/* Agent 4 */}
        <Grid item xs={12} sm={6}>
          <AgentCard
            agentId="agent4"
            name="Ringside View"
            description="Aggregates data from all agents, generates AI-powered performance insights, creates executive reports with visualizations and funnel analysis."
            status={a4Status}
            stepsCount={6}
            onRun={handleRunAgent4}
            isRunning={a4Running || a4Status?.status === 'running'}
            lastRun={a4Status?.completed_at}
            implemented={true}
          />
        </Grid>

        {/* Agent 1 — runs after Agent 2 seeds topics */}
        <Grid item xs={12} sm={6}>
          <AgentCard
            agentId="agent1"
            name="Hangout Social"
            description="Picks pending topics (seeded by Agent 2 or added manually), generates SEO-optimized blogs, runs quality checks, and auto-posts to LinkedIn."
            status={a1Status}
            stepsCount={8}
            onRun={handleRunAgent1}
            isRunning={a1Running || a1Status?.status === 'running'}
            lastRun={a1Status?.completed_at}
            implemented={true}
          />
        </Grid>
      </Grid>

      <Snackbar
        open={!!successMsg}
        autoHideDuration={4000}
        onClose={() => setSuccessMsg(null)}
        message={successMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Box>
  );
}

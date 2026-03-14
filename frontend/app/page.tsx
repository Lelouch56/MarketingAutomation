'use client';

import { Grid, Typography, Box, Alert, Snackbar, Button, Paper } from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupIcon from '@mui/icons-material/Group';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ListAltIcon from '@mui/icons-material/ListAlt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AgentCard from '../components/agents/AgentCard';
import { agent1Api, agent2Api, agent3Api, agent4Api } from '../services/api';
import { useAgentPoller } from '../lib/hooks/useAgentPoller';
import { getLLMConfig, appendLog, getAgentState } from '../lib/storage';

// ---------- KPI sparkline mini-SVGs (decorative) ----------
function Sparkline({ color, path }: { color: string; path: string }) {
  return (
    <svg width="100%" height="32" viewBox="0 0 100 20" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}


const QUICK_ACTIONS = [
  { label: 'Create Campaign', icon: AddCircleIcon, href: null },
  { label: 'Add Lead', icon: PersonAddIcon, href: '/agents/agent2' },
  { label: 'Export Report', icon: FileDownloadIcon, href: '/agents/agent4' },
  { label: 'View Logs', icon: ListAltIcon, href: '/logs' },
];

// ---------- Dashboard ----------
export default function Dashboard() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);
  const [kpiLeads, setKpiLeads] = useState<number | null>(null);
  const [kpiBlogs, setKpiBlogs] = useState<number | null>(null);
  const [kpiEnrolled, setKpiEnrolled] = useState<number | null>(null);

  const { status: a1Status, isPolling: a1Running, startPolling: startA1, setStatus: setA1Status } =
    useAgentPoller({ agentId: 'agent1', fetchStatus: agent1Api.getStatus });
  const { status: a2Status, isPolling: a2Running, startPolling: startA2, setStatus: setA2Status } =
    useAgentPoller({ agentId: 'agent2', fetchStatus: agent2Api.getStatus });
  const { status: a3Status, isPolling: a3Running, startPolling: startA3, setStatus: setA3Status } =
    useAgentPoller({ agentId: 'agent3', fetchStatus: agent3Api.getStatus });
  const { status: a4Status, isPolling: a4Running, startPolling: startA4, setStatus: setA4Status } =
    useAgentPoller({ agentId: 'agent4', fetchStatus: agent4Api.getStatus });

  useEffect(() => {
    const config = getLLMConfig();
    setHasConfig(!!config?.apiKey);
    const s1 = getAgentState('agent1'); if (s1) setA1Status(s1);
    const s2 = getAgentState('agent2'); if (s2) setA2Status(s2);
    const s3 = getAgentState('agent3'); if (s3) setA3Status(s3);
    const s4 = getAgentState('agent4'); if (s4) setA4Status(s4);
  }, [setA1Status, setA2Status, setA3Status, setA4Status]);

  useEffect(() => {
    agent2Api.getLeads().then(ls => setKpiLeads(ls.length)).catch(() => {});
    agent1Api.getTopics().then(ts => setKpiBlogs(ts.filter(t => t.status === 'Published').length)).catch(() => {});
    agent3Api.getOutreachTargets().then(ts => setKpiEnrolled(ts.filter(t => t.outplay_enrolled).length)).catch(() => {});
  }, []);

  const handleRunAgent1 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) { setError('Please configure your LLM provider in Settings before running an agent.'); return; }
    try {
      await agent1Api.run();
      appendLog({ id: Date.now().toString(), timestamp: new Date().toISOString(), level: 'info', message: 'Agent 1 (Hangout Social) started', agent_id: 'agent1' });
      setSuccessMsg('Agent 1 started! Watching progress...'); startA1(); setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start Agent 1. Is the backend running?');
    }
  }, [startA1]);

  const handleRunAgent2 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) { setError('Please configure your LLM provider in Settings before running an agent.'); return; }
    try {
      await agent2Api.run();
      appendLog({ id: Date.now().toString(), timestamp: new Date().toISOString(), level: 'info', message: 'Agent 2 (Matters) started', agent_id: 'agent2' });
      setSuccessMsg('Agent 2 started! Watching progress...'); startA2(); setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start Agent 2. Is the backend running?');
    }
  }, [startA2]);

  const handleRunAgent3 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) { setError('Please configure your LLM provider in Settings before running an agent.'); return; }
    try {
      await agent3Api.run();
      appendLog({ id: Date.now().toString(), timestamp: new Date().toISOString(), level: 'info', message: 'Agent 3 (Matters Broad) started', agent_id: 'agent3' });
      setSuccessMsg('Agent 3 started! Watching progress...'); startA3(); setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start Agent 3. Is the backend running?');
    }
  }, [startA3]);

  const handleRunAgent4 = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) { setError('Please configure your LLM provider in Settings before running an agent.'); return; }
    try {
      await agent4Api.run();
      appendLog({ id: Date.now().toString(), timestamp: new Date().toISOString(), level: 'info', message: 'Agent 4 (Ringside View) started', agent_id: 'agent4' });
      setSuccessMsg('Agent 4 started! Watching progress...'); startA4(); setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start Agent 4. Is the backend running?');
    }
  }, [startA4]);

  return (
    <Box>
      {/* Page header */}
      <Box mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Dashboard Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          4 AI agents automating your marketing funnel end-to-end
        </Typography>
      </Box>

      {!hasConfig && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: '10px' }}
          action={
            <Button color="inherit" size="small" startIcon={<SettingsIcon />} onClick={() => router.push('/settings')}>
              Configure
            </Button>
          }
        >
          No LLM provider configured. Add your API key in Settings to run agents.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── KPI Stats Row ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { label: 'Total Leads', value: kpiLeads !== null ? kpiLeads.toLocaleString() : '–', icon: GroupIcon, iconBg: '#EFF6FF', iconColor: '#2563EB', sparkColor: '#10b981', sparkPath: 'M0 15 L10 12 L20 14 L30 8 L40 10 L50 5 L60 7 L70 3 L80 6 L90 2 L100 4' },
          { label: 'Blogs Published', value: kpiBlogs !== null ? kpiBlogs.toString() : '–', icon: RocketLaunchIcon, iconBg: '#FAF5FF', iconColor: '#9333EA', sparkColor: '#9333EA', sparkPath: 'M0 15 L15 12 L30 10 L45 7 L60 8 L75 5 L90 4 L100 3' },
          { label: 'Outplay Enrolled', value: kpiEnrolled !== null ? kpiEnrolled.toString() : '–', icon: ThumbUpIcon, iconBg: '#ECFDF5', iconColor: '#059669', sparkColor: '#10b981', sparkPath: 'M0 18 L15 14 L30 12 L45 9 L60 10 L75 7 L90 5 L100 4' },
        ].map(({ label, value, icon: Icon, iconBg, iconColor, sparkColor, sparkPath }) => (
          <Grid item xs={12} sm={4} key={label}>
            <Paper
              elevation={0}
              sx={{ p: 2.5, border: '1px solid rgba(23,84,207,0.08)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                <Box sx={{ width: 40, height: 40, bgcolor: iconBg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sx={{ color: iconColor, fontSize: 20 }} />
                </Box>
                <Box display="flex" alignItems="center" gap={0.3}>
                  <TrendingUpIcon sx={{ fontSize: 14, color: '#059669' }} />
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#059669' }}>Live</Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
              <Box sx={{ mt: 1.5 }}>
                <Sparkline color={sparkColor} path={sparkPath} />
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Quick Actions ── */}
      <Grid container spacing={1.5} sx={{ mb: 4 }}>
        {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Paper
              elevation={0}
              component="button"
              onClick={() => href && router.push(href)}
              sx={{
                width: '100%',
                p: 1.75,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.75,
                border: '1px solid rgba(23,84,207,0.08)',
                borderRadius: '12px',
                cursor: href ? 'pointer' : 'default',
                bgcolor: 'background.paper',
                transition: 'all 0.15s',
                '&:hover': {
                  borderColor: href ? 'primary.main' : 'rgba(23,84,207,0.08)',
                  bgcolor: href ? 'rgba(23,84,207,0.04)' : 'background.paper',
                },
              }}
            >
              <Icon sx={{ color: 'primary.main', fontSize: 22 }} />
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.primary' }}>{label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Active Run Agents ── */}
      <Box mb={2} display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Active Run Agents
        </Typography>
        <Button
          size="small"
          variant="text"
          sx={{ textTransform: 'none', fontWeight: 600, color: 'primary.main', fontSize: 13 }}
          onClick={() => router.push('/agents')}
        >
          View All
        </Button>
      </Box>

      <Grid container spacing={2.5}>
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

        <Grid item xs={12} sm={6}>
          <AgentCard
            agentId="agent3"
            name="Matter Boards"
            description="Reads Matters hot leads, domain-searches Apollo for decision-makers at those exact companies, AI-scores outreach fit with personalized LinkedIn messages, and auto-enrolls approved targets."
            status={a3Status}
            stepsCount={8}
            onRun={handleRunAgent3}
            isRunning={a3Running || a3Status?.status === 'running'}
            lastRun={a3Status?.completed_at}
            implemented={true}
          />
        </Grid>

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

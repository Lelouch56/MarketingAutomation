'use client';

import {
  Box,
  Grid,
  Paper,
  Typography,
  Tab,
  Tabs,
  Button,
  TextField,
  Alert,
  Chip,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Snackbar,
  FormControlLabel,
  Switch,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import StepperFlow from '../../../components/agents/StepperFlow';
import ResultsTable, { Column } from '../../../components/data/ResultsTable';
import StatusBadge from '../../../components/agents/StatusBadge';
import { useAgentPoller } from '../../../lib/hooks/useAgentPoller';
import { agent1Api, agent2Api, agent3Api, agent4Api, extractApiError } from '../../../services/api';
import { getLLMConfig, appendLog, getAgentState, getLinkedInConfig, getOutplayConfig } from '../../../lib/storage';
import { TopicRecord, LeadRecord, OutreachTargetRecord, RejectedProspectRecord, ReportRecord, BlogRecord } from '../../../types';

const TOPIC_COLUMNS: Column[] = [
  { key: 'topic', label: 'Topic', type: 'truncate' },
  { key: 'status', label: 'Status', type: 'badge' },
  { key: 'source', label: 'Source', type: 'badge' },
  { key: 'source_company', label: 'From Company', type: 'truncate' },
  { key: 'quality_score', label: 'Quality Score', type: 'score' },
  { key: 'blog_title', label: 'Blog Title', type: 'truncate' },
  { key: 'url', label: 'Blog URL', type: 'link' },
  { key: 'updated_at', label: 'Published', type: 'date' },
];

const LEAD_COLUMNS: Column[] = [
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Company' },
  { key: 'category', label: 'Category', type: 'badge' },
  { key: 'analysis_status', label: 'Analysed', type: 'badge' },
  { key: 'campaign_label', label: 'Campaign' },
  { key: 'score', label: 'AI Score', type: 'score' },
  { key: 'outplay_enrolled', label: 'Outplay', type: 'badge' },
  { key: 'reasoning', label: 'Analysis', type: 'analysis' },
  { key: 'processed_at', label: 'Processed', type: 'date' },
];

const OUTREACH_COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'linkedin_url', label: 'LinkedIn', type: 'link' },
  { key: 'title', label: 'Title', type: 'truncate' },
  { key: 'company', label: 'Company' },
  { key: 'company_type', label: 'Industry Type', type: 'badge' },
  { key: 'crm_tag', label: 'CRM Tag', type: 'badge' },
  { key: 'qualification_status', label: 'Qualification', type: 'badge' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'region', label: 'Region' },
  { key: 'lead_source', label: 'Lead Source', type: 'badge' },
  { key: 'relevance_reason', label: 'Relevance', type: 'tooltip' },
  { key: 'status', label: 'Status', type: 'badge' },
  { key: 'outplay_enrolled', label: 'Outplay' },
  { key: 'created_at', label: 'Created', type: 'date' },
];

const REMOVED_COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'title', label: 'Title', type: 'truncate' },
  { key: 'company', label: 'Company' },
  { key: 'company_type', label: 'Industry Type', type: 'badge' },
  { key: 'email', label: 'Email' },
  { key: 'region', label: 'Region' },
  { key: 'lead_source', label: 'Lead Source', type: 'badge' },
  { key: 'removal_reason', label: 'Removed Because', type: 'badge' },
  { key: 'removed_at', label: 'Removed At', type: 'date' },
];

const REPORT_COLUMNS: Column[] = [
  { key: 'generated_at', label: 'Generated', type: 'date' },
  { key: 'health_rating', label: 'Health', type: 'badge' },
  { key: 'health_score', label: 'Score', type: 'score' },
  { key: 'one_liner', label: 'Summary', type: 'truncate' },
  { key: 'status', label: 'Status', type: 'badge' },
];

const AGENT_META: Record<string, { name: string; description: string; steps: number }> = {
  agent1: {
    name: 'Hangout Social',
    description:
      'Generates SEO-optimized blog posts, runs quality checks, creates LinkedIn post text, and auto-posts to LinkedIn.',
    steps: 8,
  },
  agent2: {
    name: 'Matters',
    description:
      'Deduplicates leads, scrapes websites, scores for travel industry fit using AI, seeds blog topics to Hangout Social, and auto-enrolls into Klenty/Outplay campaigns.',
    steps: 8,
  },
  agent3: {
    name: 'Matters broad',
    description:
      'Scalable outbound lead generation targeting travel tech companies — OTAs, Bedbanks, Wholesalers, TMCs, Hotel Distribution Platforms. Discovers decision-makers (CTO, VP Eng, Head of Product, Supply/Connectivity Manager) via Apollo.io CRM search + LLM Boolean simulation fallback, collects and validates contact data, cleans and qualifies leads, uploads to Matters Board CRM with "Qualified Lead / Travel Tech Prospect" tags, and auto-enrolls approved prospects into Outplay 4-email sequences (Day 1 Intro → Day 3 Follow-up → Day 7 Value → Day 14 Final).',
    steps: 6,
  },
  agent4: {
    name: 'Ringside View',
    description:
      'Aggregates data from all agents, generates AI-powered performance insights, and creates executive reports with funnel visualizations.',
    steps: 6,
  },
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card elevation={0} variant="outlined" sx={{ textAlign: 'center', p: 1.5 }}>
      <Typography variant="h5" fontWeight={700} color="primary.main">
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Card>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [blogs, setBlogs] = useState<BlogRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [outreachTargets, setOutreachTargets] = useState<OutreachTargetRecord[]>([]);
  const [rejectedProspects, setRejectedProspects] = useState<RejectedProspectRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [newTopicText, setNewTopicText] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadWebsite, setNewLeadWebsite] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [runError, setRunError] = useState('');
  const [runSuccess, setRunSuccess] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [forcingEnrollId, setForcingEnrollId] = useState<string | null>(null);
  const [retryingEnrollId, setRetryingEnrollId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent 1 LinkedIn toggle — only relevant when LinkedIn is configured
  const [enableLinkedIn, setEnableLinkedIn] = useState(true);

  const isAgent1 = id === 'agent1';
  const isAgent2 = id === 'agent2';
  const isAgent3 = id === 'agent3';
  const isAgent4 = id === 'agent4';
  const isImplemented = isAgent1 || isAgent2 || isAgent3 || isAgent4;
  const meta = AGENT_META[id] ?? { name: `Agent ${id}`, description: '', steps: 0 };

  const fetchStatus = useCallback(() => {
    if (isAgent1) return agent1Api.getStatus();
    if (isAgent2) return agent2Api.getStatus();
    if (isAgent3) return agent3Api.getStatus();
    return agent4Api.getStatus();
  }, [isAgent1, isAgent2, isAgent3]);

  const agentId = isAgent1 ? 'agent1' : isAgent2 ? 'agent2' : isAgent3 ? 'agent3' : 'agent4';

  const { status, isPolling, startPolling, setStatus } = useAgentPoller({
    agentId,
    fetchStatus,
  });

  useEffect(() => {
    if (!isImplemented) return;
    const cached = getAgentState(agentId as 'agent1' | 'agent2' | 'agent3' | 'agent4');
    if (cached) setStatus(cached);
    if (cached?.status === 'running') startPolling();
    if (isAgent1) {
      agent1Api.getTopics().then(setTopics).catch(() => { });
      agent1Api.getBlogs().then(setBlogs).catch(() => { });
    } else if (isAgent2) agent2Api.getLeads().then(setLeads).catch(() => { });
    else if (isAgent3) {
      agent3Api.getOutreachTargets().then(setOutreachTargets).catch(() => { });
      agent3Api.getRejectedProspects().then(setRejectedProspects).catch(() => { });
    } else if (isAgent4) agent4Api.getReports().then(setReports).catch(() => { });
  }, [id, isImplemented, isAgent1, isAgent2, isAgent3, isAgent4, agentId, setStatus, startPolling]);

  useEffect(() => {
    if (status?.status === 'completed') {
      if (isAgent1) {
        agent1Api.getTopics().then(setTopics);
        agent1Api.getBlogs().then(setBlogs);
      }
      if (isAgent2) agent2Api.getLeads().then(setLeads);
      if (isAgent3) {
        agent3Api.getOutreachTargets().then(setOutreachTargets);
        agent3Api.getRejectedProspects().then(setRejectedProspects);
      }
      if (isAgent4) agent4Api.getReports().then(setReports);
    }
  }, [status?.status, isAgent1, isAgent2, isAgent3, isAgent4]);

  const handleRun = useCallback(async () => {
    const config = getLLMConfig();
    if (!config?.apiKey) {
      setRunError('Configure your LLM provider in Settings first.');
      return;
    }
    try {
      if (isAgent1) await agent1Api.run({ linkedin: enableLinkedIn });
      else if (isAgent2) await agent2Api.run();
      else if (isAgent3) await agent3Api.run();
      else await agent4Api.run();
      appendLog({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${meta.name} started`,
        agent_id: id,
      });
      setRunSuccess(`${meta.name} started!`);
      startPolling();
      setRunError('');
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : 'Failed to start agent');
    }
  }, [isAgent1, isAgent2, isAgent3, id, meta.name, startPolling, enableLinkedIn]);

  const handleAddTopic = async () => {
    if (!newTopicText.trim()) { setFormError('Topic cannot be empty'); return; }
    setFormError('');
    try {
      await agent1Api.addTopic(newTopicText.trim());
      setNewTopicText('');
      setFormSuccess('Topic added successfully');
      agent1Api.getTopics().then(setTopics);
    } catch (err) { setFormError(extractApiError(err)); }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFormError('Please select a .csv file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('File too large. Maximum allowed size is 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setCsvUploading(true);
    setFormError('');
    try {
      const result = await agent1Api.uploadTopicsCsv(file);
      setFormSuccess(`${result.added_count} topic(s) imported from CSV`);
      agent1Api.getTopics().then(setTopics);
    } catch (err) {
      setFormError(extractApiError(err));
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddLead = async () => {
    const emailTrimmed = newLeadEmail.trim();
    if (!emailTrimmed) { setFormError('Email is required'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrimmed)) {
      setFormError('Please enter a valid email address');
      return;
    }
    const websiteTrimmed = newLeadWebsite.trim();
    if (websiteTrimmed && !/^https?:\/\//.test(websiteTrimmed)) {
      setFormError('Website URL must start with http:// or https://');
      return;
    }
    setFormError('');
    try {
      await agent2Api.addLead({
        email: emailTrimmed,
        website: websiteTrimmed || undefined,
        name: newLeadName.trim() || undefined,
        company: newLeadCompany.trim() || undefined,
      });
      setNewLeadEmail(''); setNewLeadWebsite('');
      setNewLeadName(''); setNewLeadCompany('');
      setFormSuccess('Lead added successfully');
      agent2Api.getLeads().then(setLeads);
    } catch (err) { setFormError(extractApiError(err)); }
  };

  const handleForceEnroll = async (rejectedId: string) => {
    setForcingEnrollId(rejectedId);
    try {
      const outplayCfg = getOutplayConfig();
      const body: Record<string, unknown> = {};
      if (outplayCfg?.clientSecret) {
        body.outplay = {
          client_secret: outplayCfg.clientSecret,
          client_id: outplayCfg.clientId || '',
          user_id: outplayCfg.userId || '',
          location: outplayCfg.location || 'us4',
          sequence_id_a: outplayCfg.sequenceIdA || '',
          sequence_id_b: outplayCfg.sequenceIdB || '',
          sequence_id_c: outplayCfg.sequenceIdC || '',
        };
      }
      const result = await agent3Api.forceEnrollRejected(rejectedId, body);
      setFormSuccess(
        result.outplay_enrolled
          ? '✓ Filtered prospect force-enrolled in Outplay sequence'
          : result.message || 'Could not enroll — check Outplay config in Settings',
      );
      agent3Api.getRejectedProspects().then(setRejectedProspects);
    } catch (err) {
      setFormError(extractApiError(err));
    } finally {
      setForcingEnrollId(null);
    }
  };

  const handleRetryEnroll = async (targetId: string) => {
    setRetryingEnrollId(targetId);
    try {
      const outplayCfg = getOutplayConfig();
      const body: Record<string, unknown> = {};
      if (outplayCfg?.clientSecret) {
        body.outplay = {
          client_secret: outplayCfg.clientSecret,
          client_id: outplayCfg.clientId || '',
          user_id: outplayCfg.userId || '',
          location: outplayCfg.location || 'us4',
          sequence_id_a: outplayCfg.sequenceIdA || '',
          sequence_id_b: outplayCfg.sequenceIdB || '',
          sequence_id_c: outplayCfg.sequenceIdC || '',
        };
      }
      const result = await agent3Api.retryEnroll(targetId, body);
      setFormSuccess(
        result.outplay_enrolled
          ? '✓ Prospect enrolled in Outplay sequence'
          : result.message || 'Enrollment failed — check Outplay config in Settings',
      );
      agent3Api.getOutreachTargets().then(setOutreachTargets);
    } catch (err) {
      setFormError(extractApiError(err));
    } finally {
      setRetryingEnrollId(null);
    }
  };

  const downloadBlogHtml = (blog: BlogRecord) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const a = document.createElement('a');
    a.href = `${BASE_URL}/agents/agent1/blogs/${blog.id}/download?format=html`;
    a.download = `${blog.slug || 'blog'}.html`;
    a.click();
  };

  const downloadLinkedInTxt = (blog: BlogRecord) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const a = document.createElement('a');
    a.href = `${BASE_URL}/agents/agent1/blogs/${blog.id}/download?format=linkedin`;
    a.download = `linkedin-${blog.slug || 'post'}.txt`;
    a.click();
  };

  if (!isImplemented) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/agents')} sx={{ mb: 2 }}>
          Back to Agents
        </Button>
        <Typography variant="h4" gutterBottom>{meta.name}</Typography>
        <Alert severity="info" sx={{ maxWidth: 500 }}>
          This agent is not yet implemented. Check back in the next release.
        </Alert>
      </Box>
    );
  }

  const completedSteps = status?.steps.filter((s) => s.status === 'completed').length ?? 0;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/agents')} sx={{ mb: 2 }} size="small">
        All Agents
      </Button>

      <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={1}>
        <Typography variant="h4">{meta.name}</Typography>
        <StatusBadge status={isPolling ? 'running' : (status?.status ?? 'idle')} size="medium" />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 700 }}>
        {meta.description}
      </Typography>

      {runError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRunError('')}>{runError}</Alert>
      )}

      <Box display="flex" flexDirection="column" gap={1} mb={3}>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={isPolling ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRun}
            disabled={isPolling || status?.status === 'running'}
          >
            {isPolling ? 'Running…' : 'Run Now'}
          </Button>
        </Box>

        {isAgent1 && (
          <Box display="flex" gap={3} alignItems="center" sx={{ pl: 0.5 }}>
            <Tooltip title={getLinkedInConfig()?.accessToken ? 'Post to LinkedIn after blog generation' : 'LinkedIn not configured in Settings — add access token to enable auto-posting'}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableLinkedIn}
                    onChange={(e) => setEnableLinkedIn(e.target.checked)}
                    size="small"
                    disabled={!getLinkedInConfig()?.accessToken}
                  />
                }
                label={<Typography variant="caption" color={getLinkedInConfig()?.accessToken ? 'text.primary' : 'text.disabled'}>Post to LinkedIn</Typography>}
              />
            </Tooltip>
          </Box>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard label="Steps Completed" value={`${completedSteps}/${meta.steps}`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Last Status"
            value={status?.status ? status.status.charAt(0).toUpperCase() + status.status.slice(1) : 'Never run'}
          />
        </Grid>
        {isAgent1 && (
          <>
            <Grid item xs={6} sm={3}>
              <StatCard label="Topics Pending" value={topics.filter((t) => t.status === 'Pending').length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Published Blogs" value={topics.filter((t) => t.status === 'Published').length} />
            </Grid>
          </>
        )}
        {isAgent2 && (
          <>
            <Grid item xs={6} sm={3}>
              <StatCard label="Total Leads" value={leads.length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Qualified Leads (Sequence A)" value={leads.filter((l) => l.campaign === 'A').length} />
            </Grid>
          </>
        )}
        {isAgent3 && (
          <>
            <Grid item xs={6} sm={3}>
              <StatCard label="Total Prospects" value={outreachTargets.length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Qualified Leads" value={outreachTargets.filter((t) => (t as any).crm_tag === 'Qualified Lead').length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Valid Emails" value={outreachTargets.filter((t) => t.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.email)).length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Filtered Out" value={rejectedProspects.length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Outplay Enrolled" value={outreachTargets.filter((t) => t.outplay_enrolled).length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Qualified Prospects" value={outreachTargets.filter((t) => (t as any).qualification_status === 'Qualified').length} />
            </Grid>
          </>
        )}
        {isAgent4 && (
          <>
            <Grid item xs={6} sm={3}>
              <StatCard label="Reports Generated" value={reports.length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Latest Health" value={reports[reports.length - 1]?.health_rating ?? 'N/A'} />
            </Grid>
          </>
        )}
      </Grid>

      {status?.status === 'failed' && status.error && (
        <Alert severity="error" sx={{ mb: 3 }}>Run failed: {status.error}</Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Workflow Steps</Typography>
            <Divider sx={{ mb: 2 }} />
            <StepperFlow steps={status?.steps ?? []} />
            {status?.result && (
              <Box mt={3} p={2} bgcolor="action.hover" borderRadius={2}>
                <Typography variant="caption" fontWeight={600} display="block" mb={1}>
                  Last Run Summary
                </Typography>
                {Object.entries(status.result as Record<string, unknown>).map(([k, v]) => (
                  <Box key={k} display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {k.replace(/_/g, ' ')}
                    </Typography>
                    <Typography variant="caption" fontWeight={500}>{String(v)}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper elevation={0} variant="outlined">
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
              <Tab label={
                isAgent1 ? 'Topics & Results' :
                  isAgent2 ? 'Leads & Results' :
                    isAgent3 ? 'Outreach Targets' :
                      'Reports'
              } />
              {(isAgent1 || isAgent2) && <Tab label="Downloads" />}
              {(isAgent1 || isAgent2) && <Tab label="Add Data" />}
            </Tabs>

            <Box p={3}>
              {tabValue === 0 && isAgent1 && (
                <ResultsTable columns={TOPIC_COLUMNS} rows={topics as unknown as Record<string, unknown>[]}
                  emptyMessage="No topics yet. Add some in the 'Add Data' tab and run the agent." />
              )}
              {tabValue === 0 && isAgent2 && (() => {
                const lastRunId = status?.run_id;
                const outplayThisRun = lastRunId
                  ? leads.filter((l) => l.outplay_enrolled_run_id === lastRunId)
                  : [];
                return (
                  <Box>
                    {outplayThisRun.length > 0 && (
                      <Box mb={2} p={2} sx={{ border: 1, borderColor: 'success.main', borderRadius: 2, bgcolor: 'success.50' }}>
                        <Typography variant="subtitle2" color="success.dark" gutterBottom>
                          Last Run — Enrolled in Outplay Sequence ({outplayThisRun.length} lead{outplayThisRun.length !== 1 ? 's' : ''})
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {outplayThisRun.map((l) => (
                            <Chip key={l.id || l.email} label={l.email} size="small" color="success" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}
                    <ResultsTable
                      columns={LEAD_COLUMNS}
                      rows={leads.map((l) => ({
                        ...l,
                        outplay_enrolled: l.outplay_enrolled ? 'Enrolled' : 'Not enrolled',
                      })) as unknown as Record<string, unknown>[]}
                      emptyMessage="No leads yet. Add some in the 'Add Data' tab and run the agent."
                    />
                  </Box>
                );
              })()}
              {tabValue === 0 && isAgent3 && (
                <Box>
                  {formError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>{formError}</Alert>
                  )}

                  {/* ── Outreach Targets (auto-enrolled) ────────────────── */}
                  {outreachTargets.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No outreach targets yet. Run the agent to generate prospects.
                    </Typography>
                  ) : (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        All prospects discovered by Agent 3 are <strong>automatically enrolled</strong> in the Outplay Travel Tech Outreach sequence (Sequence C).
                        Prospects are tagged <strong>Qualified Lead</strong> or <strong>Travel Tech Prospect</strong>, classified by industry type.
                        Only validated emails are enrolled. Sequence stops automatically on reply.
                      </Typography>
                      <ResultsTable
                        columns={OUTREACH_COLUMNS}
                        rows={outreachTargets.map((t) => ({
                          ...t,
                          name: [t.first_name, t.last_name].filter(Boolean).join(' '),
                          outplay_enrolled: t.outplay_enrolled ? 'Enrolled' : 'Not enrolled',
                        })) as unknown as Record<string, unknown>[]}
                        emptyMessage="No targets yet."
                      />

                      {/* ── Not-Enrolled Prospects — Retry Enroll ─────── */}
                      {(() => {
                        const notEnrolled = outreachTargets.filter((t) => !t.outplay_enrolled && t.email);
                        if (notEnrolled.length === 0) return null;
                        return (
                          <Box mt={3} p={2} sx={{ border: 1, borderColor: 'warning.main', borderRadius: 2 }}>
                            <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                              Not Enrolled in Outplay ({notEnrolled.length})
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                              These prospects were not enrolled — either Outplay was not configured when the agent ran, or enrollment failed.
                              Use <strong>Retry Enroll</strong> to attempt enrollment now.
                            </Typography>
                            {notEnrolled.map((t) => (
                              <Box key={t.id} display="flex" alignItems="flex-start" gap={2} mb={1} p={1.5}
                                bgcolor="background.paper" borderRadius={1} sx={{ border: 1, borderColor: 'divider' }}>
                                <Box flex={1} minWidth={0}>
                                  <Typography variant="body2" fontWeight={500} noWrap>
                                    {[t.first_name, t.last_name].filter(Boolean).join(' ') || '(No name)'} — {t.title || '?'} at {t.company || '?'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {t.email}{t.region ? ` · ${t.region}` : ''}
                                  </Typography>
                                  {t.outplay_enroll_error && (
                                    <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.25 }}>
                                      ⚠ {t.outplay_enroll_error}
                                    </Typography>
                                  )}
                                </Box>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={retryingEnrollId === t.id ? <CircularProgress size={12} color="inherit" /> : <CheckCircleIcon />}
                                  onClick={() => handleRetryEnroll(t.id)}
                                  disabled={!!retryingEnrollId}
                                  sx={{ flexShrink: 0 }}
                                >
                                  Retry Enroll
                                </Button>
                              </Box>
                            ))}
                          </Box>
                        );
                      })()}
                    </Box>
                  )}

                  {/* ── Filtered Out Contacts (with Force Enroll) ─────── */}
                  <Box mt={5}>
                    <Divider sx={{ mb: 3 }} />
                    <Typography variant="h6" gutterBottom>
                      Filtered Out ({rejectedProspects.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      Contacts removed during Step 4 — duplicate emails, off-target roles, or non-travel-tech companies.
                      Use <strong>Force Enroll</strong> to manually send a filtered prospect into the Outplay sequence anyway.
                    </Typography>
                    {rejectedProspects.length > 0 ? (
                      <Box>
                        <ResultsTable
                          columns={REMOVED_COLUMNS}
                          rows={rejectedProspects.map((p) => ({
                            ...p,
                            name: [p.first_name, p.last_name].filter(Boolean).join(' '),
                          })) as unknown as Record<string, unknown>[]}
                          emptyMessage="No filtered contacts."
                        />
                        <Box mt={2}>
                          {rejectedProspects.filter((p) => !p.force_enrolled && p.email).map((p) => (
                            <Box key={p.id} display="flex" alignItems="center" gap={2} mb={1} p={1.5}
                              bgcolor="action.hover" borderRadius={1}>
                              <Box flex={1}>
                                <Typography variant="body2" fontWeight={500}>
                                  {[p.first_name, p.last_name].filter(Boolean).join(' ') || '(No name)'} — {p.title || '?'} at {p.company || '?'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {p.email}
                                  {p.region ? ` · ${p.region}` : ''}
                                  {p.removal_reason ? ` · Removed: ${p.removal_reason.replace(/_/g, ' ')}` : ''}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={forcingEnrollId === p.id ? <CircularProgress size={12} color="inherit" /> : <CheckCircleIcon />}
                                onClick={() => handleForceEnroll(p.id)}
                                disabled={!!forcingEnrollId}
                              >
                                Approve
                              </Button>
                            </Box>
                          ))}
                          {rejectedProspects.filter((p) => !p.force_enrolled && p.email).length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                              All filtered prospects have been enrolled or have no valid email.
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        No filtered contacts yet — run Agent 3 to populate.
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              {tabValue === 0 && isAgent4 && (
                <Box>
                  <ResultsTable
                    columns={REPORT_COLUMNS}
                    rows={reports as unknown as Record<string, unknown>[]}
                    emptyMessage="No reports yet. Run the agent to generate your first report."
                  />
                  {reports.length > 0 && reports[reports.length - 1]?.executive_summary && (
                    <Box mt={3} p={2} bgcolor="action.hover" borderRadius={2}>
                      <Typography variant="subtitle2" gutterBottom>Latest Executive Summary</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                        {reports[reports.length - 1].executive_summary}
                      </Typography>
                    </Box>
                  )}
                  {reports.length > 0 && reports[reports.length - 1]?.key_insights && (
                    <Box mt={2} p={2} bgcolor="info.50" borderRadius={2}>
                      <Typography variant="subtitle2" gutterBottom>Key Insights</Typography>
                      {reports[reports.length - 1].key_insights?.map((insight, i) => (
                        <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {insight}</Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {tabValue === 1 && isAgent1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Download Generated Content</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Download blog posts as HTML and LinkedIn posts as TXT — available even if WordPress or LinkedIn integration is not configured.
                  </Typography>
                  {blogs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No published blogs yet. Run the agent first to generate content.
                    </Typography>
                  ) : (
                    <Box>
                      {[...blogs].reverse().map((blog) => (
                        <Box
                          key={blog.id}
                          display="flex"
                          alignItems="center"
                          gap={2}
                          flexWrap="wrap"
                          p={2}
                          mb={1.5}
                          sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}
                        >
                          <Box flex={1} minWidth={0}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {blog.title || blog.topic}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {blog.quality_score ? `Score: ${blog.quality_score}/100  ·  ` : ''}
                              {blog.slug ? `${blog.slug}  ·  ` : ''}
                              {blog.created_at ? new Date(blog.created_at).toLocaleDateString() : ''}
                            </Typography>
                          </Box>
                          <Box display="flex" gap={1} flexShrink={0}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<DownloadIcon fontSize="small" />}
                              onClick={() => downloadBlogHtml(blog)}
                              disabled={!blog.id}
                            >
                              Blog HTML
                            </Button>
                            {blog.linkedin_post && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={<DownloadIcon fontSize="small" />}
                                onClick={() => downloadLinkedInTxt(blog)}
                                disabled={!blog.id}
                              >
                                LinkedIn TXT
                              </Button>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {tabValue === 1 && isAgent2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Download Leads Analysis</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Export leads as CSV. Filter by campaign to download a specific segment.
                  </Typography>
                  {leads.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No leads yet. Add some in the &apos;Add Data&apos; tab and run the agent.
                    </Typography>
                  ) : (
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {[
                        { label: 'All Leads', campaign: undefined, color: 'primary' as const },
                        { label: 'Qualified — Marktech Sequence A', campaign: 'A', color: 'success' as const },
                        { label: 'Personal — Marktech Sequence B', campaign: 'B', color: 'info' as const },
                        { label: 'Nurture — Need Manual Attention', campaign: 'nurture', color: 'warning' as const },
                        { label: 'Disqualified — No Outreach', campaign: 'disqualified', color: 'error' as const },
                      ].map(({ label, campaign, color }) => {
                        const count = campaign
                          ? leads.filter((l) => l.campaign === campaign).length
                          : leads.length;
                        return (
                          <Box key={label} display="flex" alignItems="center" gap={2} p={1.5}
                            sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                            <Box flex={1}>
                              <Typography variant="body2" fontWeight={600}>{label}</Typography>
                              <Typography variant="caption" color="text.secondary">{count} lead{count !== 1 ? 's' : ''}</Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              color={color}
                              startIcon={<DownloadIcon fontSize="small" />}
                              onClick={() => agent2Api.downloadLeads(campaign)}
                              disabled={count === 0}
                            >
                              Download CSV
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              )}

              {((isAgent1 && tabValue === 2) || (isAgent2 && tabValue === 2)) && (
                <Box>
                  {formError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>{formError}</Alert>
                  )}

                  {isAgent1 && (
                    <Box maxWidth={520}>
                      <Typography variant="h6" gutterBottom>Add New Topic</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Topics with status <Chip label="Pending" size="small" /> will be picked up on the next run.
                      </Typography>
                      <TextField
                        label="Blog topic"
                        placeholder="e.g., Hotel Distribution Technology Trends 2026"
                        value={newTopicText}
                        onChange={(e) => setNewTopicText(e.target.value)}
                        fullWidth size="small" sx={{ mb: 2 }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(); }}
                      />
                      <Button variant="contained" onClick={handleAddTopic}>Add Topic</Button>

                      <Divider sx={{ my: 4 }} />

                      <Typography variant="h6" gutterBottom>Bulk Import from CSV</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Upload a CSV file with one topic per row, or with a &quot;topic&quot; column header.
                      </Typography>
                      <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        onChange={handleCsvUpload}
                        style={{ display: 'none' }}
                      />
                      <Button
                        variant="outlined"
                        startIcon={csvUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={csvUploading}
                      >
                        {csvUploading ? 'Uploading…' : 'Upload CSV'}
                      </Button>
                    </Box>
                  )}

                  {isAgent2 && (
                    <Box maxWidth={520}>
                      <Typography variant="h6" gutterBottom>Add New Lead</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Business email + website → <Chip label="Qualified" size="small" color="success" /> (AI-scored for ICP fit).
                        Business email, no website → <Chip label="Nurture" size="small" color="warning" /> (manual review).
                        Gmail/Yahoo/free domain → <Chip label="Personal" size="small" color="info" /> (Sequence B).
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField label="Email *" value={newLeadEmail}
                            onChange={(e) => setNewLeadEmail(e.target.value)}
                            fullWidth size="small" placeholder="contact@company.com" />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField label="Website" value={newLeadWebsite}
                            onChange={(e) => setNewLeadWebsite(e.target.value)}
                            fullWidth size="small" placeholder="https://company.com" />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField label="Full Name" value={newLeadName}
                            onChange={(e) => setNewLeadName(e.target.value)} fullWidth size="small" />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField label="Company" value={newLeadCompany}
                            onChange={(e) => setNewLeadCompany(e.target.value)} fullWidth size="small" />
                        </Grid>
                        <Grid item xs={12}>
                          <Button variant="contained" onClick={handleAddLead}>Add Lead</Button>
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={!!runSuccess} autoHideDuration={3000} onClose={() => setRunSuccess('')}
        message={runSuccess} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} />
      <Snackbar open={!!formSuccess} autoHideDuration={2000} onClose={() => setFormSuccess('')}
        message={formSuccess} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} />
    </Box>
  );
}

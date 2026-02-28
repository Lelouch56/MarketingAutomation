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
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import StepperFlow from '../../../components/agents/StepperFlow';
import ResultsTable, { Column } from '../../../components/data/ResultsTable';
import StatusBadge from '../../../components/agents/StatusBadge';
import { useAgentPoller } from '../../../lib/hooks/useAgentPoller';
import { agent1Api, agent2Api, agent3Api, agent4Api, extractApiError } from '../../../services/api';
import { getLLMConfig, appendLog, getAgentState, getWordPressConfig, getLinkedInConfig } from '../../../lib/storage';
import { TopicRecord, LeadRecord, OutreachTargetRecord, ReportRecord } from '../../../types';

const TOPIC_COLUMNS: Column[] = [
  { key: 'topic', label: 'Topic', type: 'truncate' },
  { key: 'status', label: 'Status', type: 'badge' },
  { key: 'quality_score', label: 'Quality Score', type: 'score' },
  { key: 'blog_title', label: 'Blog Title', type: 'truncate' },
  { key: 'url', label: 'Blog URL', type: 'link' },
  { key: 'updated_at', label: 'Published', type: 'date' },
];

const LEAD_COLUMNS: Column[] = [
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Company' },
  { key: 'category', label: 'Category', type: 'badge' },
  { key: 'campaign_label', label: 'Campaign' },
  { key: 'score', label: 'AI Score', type: 'score' },
  { key: 'reasoning', label: 'Analysis', type: 'truncate' },
  { key: 'processed_at', label: 'Processed', type: 'date' },
];

const OUTREACH_COLUMNS: Column[] = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'title', label: 'Title', type: 'truncate' },
  { key: 'company', label: 'Company' },
  { key: 'status', label: 'Status', type: 'badge' },
  { key: 'klenty_enrolled', label: 'Klenty' },
  { key: 'created_at', label: 'Created', type: 'date' },
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
    name: 'Content Writer & SEO',
    description:
      'Generates SEO-optimized blog posts, runs quality checks, creates LinkedIn posts, and publishes to WordPress.',
    steps: 7,
  },
  agent2: {
    name: 'Lead Qualification',
    description:
      'Deduplicates leads, scrapes websites, scores for travel industry fit using AI, and auto-enrolls into Klenty campaigns.',
    steps: 7,
  },
  agent3: {
    name: 'LinkedIn Outbound',
    description:
      'AI-generates B2B prospect profiles for the travel industry, filters decision-makers, and auto-enrolls approved prospects into Klenty email sequences.',
    steps: 7,
  },
  agent4: {
    name: 'Analytics & Reports',
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
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [outreachTargets, setOutreachTargets] = useState<OutreachTargetRecord[]>([]);
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
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent 1 publish toggles — only relevant when respective integration is configured
  const [enableWordPress, setEnableWordPress] = useState(true);
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
    if (isAgent1) agent1Api.getTopics().then(setTopics).catch(() => { });
    else if (isAgent2) agent2Api.getLeads().then(setLeads).catch(() => { });
    else if (isAgent3) agent3Api.getOutreachTargets().then(setOutreachTargets).catch(() => { });
    else if (isAgent4) agent4Api.getReports().then(setReports).catch(() => { });
  }, [id, isImplemented, isAgent1, isAgent2, isAgent3, isAgent4, agentId, setStatus, startPolling]);

  useEffect(() => {
    if (status?.status === 'completed') {
      if (isAgent1) agent1Api.getTopics().then(setTopics);
      if (isAgent2) agent2Api.getLeads().then(setLeads);
      if (isAgent3) agent3Api.getOutreachTargets().then(setOutreachTargets);
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
      if (isAgent1) await agent1Api.run({ wordpress: enableWordPress, linkedin: enableLinkedIn });
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
  }, [isAgent1, isAgent2, isAgent3, id, meta.name, startPolling, enableWordPress, enableLinkedIn]);

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

  const handleApproveTarget = async (targetId: string) => {
    setApprovingId(targetId);
    try {
      await agent3Api.approveTarget(targetId);
      setFormSuccess('Prospect approved for outreach');
      agent3Api.getOutreachTargets().then(setOutreachTargets);
    } catch (err) {
      setFormError(extractApiError(err));
    } finally {
      setApprovingId(null);
    }
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
            <Tooltip title={getWordPressConfig()?.siteUrl ? 'Publish blog to WordPress' : 'WordPress not configured in Settings'}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableWordPress}
                    onChange={(e) => setEnableWordPress(e.target.checked)}
                    size="small"
                    disabled={!getWordPressConfig()?.siteUrl}
                  />
                }
                label={<Typography variant="caption" color={getWordPressConfig()?.siteUrl ? 'text.primary' : 'text.disabled'}>WordPress</Typography>}
              />
            </Tooltip>
            <Tooltip title={getLinkedInConfig()?.accessToken ? 'Post to LinkedIn after publishing' : 'LinkedIn not configured in Settings'}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableLinkedIn}
                    onChange={(e) => setEnableLinkedIn(e.target.checked)}
                    size="small"
                    disabled={!getLinkedInConfig()?.accessToken}
                  />
                }
                label={<Typography variant="caption" color={getLinkedInConfig()?.accessToken ? 'text.primary' : 'text.disabled'}>LinkedIn</Typography>}
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
              <StatCard label="Fit Clients (Campaign A)" value={leads.filter((l) => l.campaign === 'A').length} />
            </Grid>
          </>
        )}
        {isAgent3 && (
          <>
            <Grid item xs={6} sm={3}>
              <StatCard label="Total Prospects" value={outreachTargets.length} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label="Pending Approval" value={outreachTargets.filter((t) => t.status === 'pending_approval').length} />
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
              {(isAgent1 || isAgent2) && <Tab label="Add Data" />}
            </Tabs>

            <Box p={3}>
              {tabValue === 0 && isAgent1 && (
                <ResultsTable columns={TOPIC_COLUMNS} rows={topics as unknown as Record<string, unknown>[]}
                  emptyMessage="No topics yet. Add some in the 'Add Data' tab and run the agent." />
              )}
              {tabValue === 0 && isAgent2 && (
                <ResultsTable columns={LEAD_COLUMNS} rows={leads as unknown as Record<string, unknown>[]}
                  emptyMessage="No leads yet. Add some in the 'Add Data' tab and run the agent." />
              )}
              {tabValue === 0 && isAgent3 && (
                <Box>
                  {formError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>{formError}</Alert>
                  )}
                  {outreachTargets.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No outreach targets yet. Run the agent to generate prospects.
                    </Typography>
                  ) : (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Approve prospects to enroll them in Klenty email sequences.
                      </Typography>
                      <ResultsTable
                        columns={OUTREACH_COLUMNS}
                        rows={outreachTargets.map((t) => ({
                          ...t,
                          klenty_enrolled: t.klenty_enrolled ? 'Enrolled' : 'Not Enrolled',
                        })) as unknown as Record<string, unknown>[]}
                        emptyMessage="No targets yet."
                      />
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>Approve Pending Prospects</Typography>
                        {outreachTargets.filter((t) => t.status === 'pending_approval').map((t) => (
                          <Box key={t.id} display="flex" alignItems="center" gap={2} mb={1} p={1.5}
                            bgcolor="action.hover" borderRadius={1}>
                            <Box flex={1}>
                              <Typography variant="body2" fontWeight={500}>
                                {t.first_name} {t.last_name} — {t.title} at {t.company}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">{t.email}</Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={approvingId === t.id ? <CircularProgress size={12} color="inherit" /> : <CheckCircleIcon />}
                              onClick={() => handleApproveTarget(t.id)}
                              disabled={!!approvingId}
                            >
                              Approve
                            </Button>
                          </Box>
                        ))}
                        {outreachTargets.filter((t) => t.status === 'pending_approval').length === 0 && (
                          <Typography variant="body2" color="text.secondary">No prospects awaiting approval.</Typography>
                        )}
                      </Box>
                    </Box>
                  )}
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

              {tabValue === 1 && (isAgent1 || isAgent2) && (
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
                        Business emails with websites → <Chip label="Hot" size="small" color="error" /> (AI-scored).
                        Gmail/free domains → <Chip label="Warm" size="small" color="warning" />.
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

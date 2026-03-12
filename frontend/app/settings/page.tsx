'use client';

import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  InputAdornment,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useState, useEffect } from 'react';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import {
  getLLMConfig,
  setLLMConfig,
  getWordPressConfig,
  setWordPressConfig,
  getLinkedInConfig,
  setLinkedInConfig,
  getKlentyConfig,
  setKlentyConfig,
  getOutplayConfig,
  setOutplayConfig,
  getApolloConfig,
  setApolloConfig,
  getSalesNavigatorConfig,
  setSalesNavigatorConfig,
  getHubSpotConfig,
  setHubSpotConfig,
  getPhantomBusterConfig,
  setPhantomBusterConfig,
} from '../../lib/storage';
import { LLMConfig, WordPressConfig, LinkedInConfig, KlentyConfig, OutplayConfig, ApolloConfig, SalesNavigatorConfig, HubSpotConfig, PhantomBusterConfig, MODEL_OPTIONS, PROVIDER_LABELS } from '../../types';
import { integrationsApi } from '../../services/api';

const OTHER_INTEGRATIONS = [
  {
    name: 'Zoho CRM',
    description: 'Pull leads from Zoho and merge into the Master Lead Table.',
    docs: 'https://www.zoho.com/crm/developer/docs/',
    status: 'Coming Soon',
  },
  {
    name: 'Power BI',
    description: 'Push agent performance data to Power BI dashboards.',
    docs: 'https://learn.microsoft.com/en-us/power-bi/',
    status: 'Coming Soon',
  },
];

const KEY_PATTERNS: Record<string, { pattern: RegExp; example: string }> = {
  openai: { pattern: /^sk-/, example: 'sk-...' },
  gemini: { pattern: /^AIza/, example: 'AIzaSy...' },
  anthropic: { pattern: /^sk-ant-/, example: 'sk-ant-...' },
  grok: { pattern: /^xai-/, example: 'xai-...' },
  groq: { pattern: /^gsk_/, example: 'gsk_...' },
};

export default function SettingsPage() {
  // LLM state
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
  });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<{ success: boolean; message: string } | null>(null);

  // WordPress state
  const [wpConfig, setWpConfig] = useState<WordPressConfig>({
    siteUrl: '',
    username: '',
    appPassword: '',
    publishStatus: 'draft',
  });
  const [wpSaved, setWpSaved] = useState(false);
  const [wpShowPass, setWpShowPass] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [wpTesting, setWpTesting] = useState(false);
  const [wpPublishTestResult, setWpPublishTestResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);
  const [wpPublishTesting, setWpPublishTesting] = useState(false);

  // LinkedIn state
  const [liConfig, setLiConfig] = useState<LinkedInConfig>({
    accessToken: '',
    authorUrn: '',
  });
  const [liSaved, setLiSaved] = useState(false);
  const [liShowToken, setLiShowToken] = useState(false);
  const [liTestResult, setLiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [liTesting, setLiTesting] = useState(false);
  const [liPublishTestResult, setLiPublishTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [liPublishTesting, setLiPublishTesting] = useState(false);

  // Klenty state
  const [klentyConfig, setKlentyConfigState] = useState<KlentyConfig>({
    apiKey: '',
    userEmail: '',
    campaignAName: 'Campaign A',
    campaignBName: 'Campaign B',
    campaignCName: 'Campaign C',
  });
  const [klentySaved, setKlentySaved] = useState(false);
  const [klentyShowKey, setKlentyShowKey] = useState(false);
  const [klentyTestResult, setKlentyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [klentyTesting, setKlentyTesting] = useState(false);

  // Outplay state
  const [outplayConfig, setOutplayConfigState] = useState<OutplayConfig>({
    apiKey: '',
    sequenceNameA: 'Travel Fit Sequence',
    sequenceNameB: 'Warm Lead Sequence',
    sequenceNameC: 'Cold Lead Sequence',
  });
  const [outplaySaved, setOutplaySaved] = useState(false);
  const [outplayShowKey, setOutplayShowKey] = useState(false);
  const [outplayTestResult, setOutplayTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [outplayTesting, setOutplayTesting] = useState(false);

  // Apollo state
  const [apolloConfig, setApolloConfigState] = useState<ApolloConfig>({
    apiKey: '',
    perPage: 10,
  });
  const [apolloSaved, setApolloSaved] = useState(false);
  const [apolloShowKey, setApolloShowKey] = useState(false);
  const [apolloTestResult, setApolloTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [apolloTesting, setApolloTesting] = useState(false);

  // Sales Navigator state
  const [salesNavConfig, setSalesNavConfigState] = useState<SalesNavigatorConfig>({
    accessToken: '',
    count: 10,
  });
  const [salesNavSaved, setSalesNavSaved] = useState(false);
  const [salesNavShowToken, setSalesNavShowToken] = useState(false);
  const [salesNavTestResult, setSalesNavTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [salesNavTesting, setSalesNavTesting] = useState(false);

  // HubSpot state
  const [hubspotConfig, setHubSpotConfigState] = useState<HubSpotConfig>({
    accessToken: '',
    maxContacts: 100,
  });
  const [hubspotSaved, setHubSpotSaved] = useState(false);
  const [hubspotShowToken, setHubSpotShowToken] = useState(false);
  const [hubspotTestResult, setHubSpotTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hubspotTesting, setHubSpotTesting] = useState(false);

  // PhantomBuster state
  const [pbConfig, setPbConfigState] = useState<PhantomBusterConfig>({
    apiKey: '',
    searchPhantomId: '',
    connectionPhantomId: '',
    sessionCookie: '',
    connectionsPerLaunch: 10,
  });
  const [pbSaved, setPbSaved] = useState(false);
  const [pbShowKey, setPbShowKey] = useState(false);
  const [pbShowCookie, setPbShowCookie] = useState(false);
  const [pbTestResult, setPbTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pbTesting, setPbTesting] = useState(false);

  useEffect(() => {
    const existing = getLLMConfig();
    if (existing) setConfig(existing);
    const existingWp = getWordPressConfig();
    if (existingWp) setWpConfig(existingWp);
    const existingLi = getLinkedInConfig();
    if (existingLi) setLiConfig(existingLi);
    const existingKlenty = getKlentyConfig();
    if (existingKlenty) setKlentyConfigState(existingKlenty);
    const existingOutplay = getOutplayConfig();
    if (existingOutplay) setOutplayConfigState(existingOutplay);
    const existingApollo = getApolloConfig();
    if (existingApollo) setApolloConfigState(existingApollo);
    const existingSalesNav = getSalesNavigatorConfig();
    if (existingSalesNav) setSalesNavConfigState(existingSalesNav);
    const existingHubSpot = getHubSpotConfig();
    if (existingHubSpot) setHubSpotConfigState(existingHubSpot);
    const existingPb = getPhantomBusterConfig();
    if (existingPb) setPbConfigState(existingPb);
  }, []);

  // ── LLM handlers ──────────────────────────────────────────────
  const handleProviderChange = (provider: LLMConfig['provider']) => {
    setConfig((prev) => ({
      ...prev,
      provider,
      model: MODEL_OPTIONS[provider][0],
    }));
    setValidation(null);
  };

  const handleSave = () => {
    if (!config.apiKey.trim()) {
      setValidation({ success: false, message: 'API key cannot be empty.' });
      return;
    }
    setLLMConfig(config);
    setSaved(true);
    setValidation(null);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleValidate = () => {
    if (!config.apiKey.trim()) {
      setValidation({ success: false, message: 'Enter an API key first.' });
      return;
    }
    const check = KEY_PATTERNS[config.provider];
    if (check && !check.pattern.test(config.apiKey)) {
      setValidation({
        success: false,
        message: `Key format looks incorrect for ${PROVIDER_LABELS[config.provider]}. Expected format: ${check.example}`,
      });
    } else {
      setValidation({
        success: true,
        message: `Key format looks valid for ${PROVIDER_LABELS[config.provider]}. It will be verified when running an agent.`,
      });
    }
  };

  // ── WordPress handlers ────────────────────────────────────────
  const handleWpSave = () => {
    setWordPressConfig(wpConfig);
    setWpSaved(true);
    setTimeout(() => setWpSaved(false), 3000);
  };

  const handleWpTest = async () => {
    if (!wpConfig.siteUrl || !wpConfig.username || !wpConfig.appPassword) {
      setWpTestResult({ success: false, message: 'Fill in all WordPress fields first.' });
      return;
    }
    setWpTesting(true);
    setWpTestResult(null);
    try {
      const result = await integrationsApi.testWordPress({
        site_url: wpConfig.siteUrl,
        username: wpConfig.username,
        app_password: wpConfig.appPassword,
      });
      setWpTestResult(result);
    } catch {
      setWpTestResult({ success: false, message: 'Connection test failed. Check your credentials.' });
    } finally {
      setWpTesting(false);
    }
  };

  const handleWpTestPublish = async () => {
    if (!wpConfig.siteUrl || !wpConfig.username || !wpConfig.appPassword) {
      setWpPublishTestResult({ success: false, message: 'Fill in all WordPress fields first.' });
      return;
    }
    setWpPublishTesting(true);
    setWpPublishTestResult(null);
    try {
      const result = await integrationsApi.testWordPressPublish({
        site_url: wpConfig.siteUrl,
        username: wpConfig.username,
        app_password: wpConfig.appPassword,
      });
      if (result.link) {
        setWpPublishTestResult({
          success: true,
          message: 'Dummy post published successfully!',
          link: result.link,
        });
      } else {
        setWpPublishTestResult({
          success: false,
          message: result.message || 'Failed to publish dummy HTML.',
        });
      }
    } catch (err: any) {
      setWpPublishTestResult({
        success: false,
        message: err.response?.data?.detail || err.message || 'Error publishing dummy HTML',
      });
    } finally {
      setWpPublishTesting(false);
    }
  };

  // ── LinkedIn handlers ─────────────────────────────────────────
  const handleLiSave = () => {
    setLinkedInConfig(liConfig);
    setLiSaved(true);
    setTimeout(() => setLiSaved(false), 3000);
  };

  const handleLiTest = async () => {
    if (!liConfig.accessToken || !liConfig.authorUrn) {
      setLiTestResult({ success: false, message: 'Fill in all LinkedIn fields first.' });
      return;
    }
    setLiTesting(true);
    setLiTestResult(null);
    try {
      const result = await integrationsApi.testLinkedIn({
        access_token: liConfig.accessToken,
        author_urn: liConfig.authorUrn,
      });
      setLiTestResult(result);
    } catch {
      setLiTestResult({ success: false, message: 'Connection test failed. Check your token.' });
    } finally {
      setLiTesting(false);
    }
  };

  // ── Klenty handlers ───────────────────────────────────────────
  const handleKlentySave = () => {
    setKlentyConfig(klentyConfig);
    setKlentySaved(true);
    setTimeout(() => setKlentySaved(false), 3000);
  };

  const handleKlentyTest = async () => {
    if (!klentyConfig.apiKey || !klentyConfig.userEmail) {
      setKlentyTestResult({ success: false, message: 'Enter Klenty API key and account email first.' });
      return;
    }
    setKlentyTesting(true);
    setKlentyTestResult(null);
    try {
      const result = await integrationsApi.testKlenty({
        api_key: klentyConfig.apiKey,
        user_email: klentyConfig.userEmail,
        campaign_a_name: klentyConfig.campaignAName,
        campaign_b_name: klentyConfig.campaignBName,
        campaign_c_name: klentyConfig.campaignCName,
      });
      setKlentyTestResult(result);
    } catch {
      setKlentyTestResult({ success: false, message: 'Connection test failed. Check your Klenty credentials.' });
    } finally {
      setKlentyTesting(false);
    }
  };

  // ── Outplay handlers ──────────────────────────────────────────
  const handleOutplaySave = () => {
    setOutplayConfig(outplayConfig);
    setOutplaySaved(true);
    setTimeout(() => setOutplaySaved(false), 3000);
  };

  const handleOutplayTest = async () => {
    if (!outplayConfig.apiKey) {
      setOutplayTestResult({ success: false, message: 'Enter your Outplay API key first.' });
      return;
    }
    setOutplayTesting(true);
    setOutplayTestResult(null);
    try {
      const result = await integrationsApi.testOutplay({
        api_key: outplayConfig.apiKey,
        sequence_name_a: outplayConfig.sequenceNameA,
        sequence_name_b: outplayConfig.sequenceNameB,
        sequence_name_c: outplayConfig.sequenceNameC,
      });
      setOutplayTestResult(result);
    } catch {
      setOutplayTestResult({ success: false, message: 'Connection test failed. Check your Outplay API key.' });
    } finally {
      setOutplayTesting(false);
    }
  };

  // ── Apollo handlers ───────────────────────────────────────────
  const handleApolloSave = () => {
    setApolloConfig(apolloConfig);
    setApolloSaved(true);
    setTimeout(() => setApolloSaved(false), 3000);
  };

  const handleApolloTest = async () => {
    if (!apolloConfig.apiKey) {
      setApolloTestResult({ success: false, message: 'Enter your Apollo.io API key first.' });
      return;
    }
    setApolloTesting(true);
    setApolloTestResult(null);
    try {
      const result = await integrationsApi.testApollo({
        api_key: apolloConfig.apiKey,
        per_page: apolloConfig.perPage,
      });
      setApolloTestResult(result);
    } catch {
      setApolloTestResult({ success: false, message: 'Connection test failed. Check your Apollo API key.' });
    } finally {
      setApolloTesting(false);
    }
  };

  // ── Sales Navigator handlers ──────────────────────────────────
  const handleSalesNavSave = () => {
    setSalesNavigatorConfig(salesNavConfig);
    setSalesNavSaved(true);
    setTimeout(() => setSalesNavSaved(false), 3000);
  };

  const handleSalesNavTest = async () => {
    if (!salesNavConfig.accessToken) {
      setSalesNavTestResult({ success: false, message: 'Enter your Sales Navigator access token first.' });
      return;
    }
    setSalesNavTesting(true);
    setSalesNavTestResult(null);
    try {
      const result = await integrationsApi.testSalesNavigator({
        access_token: salesNavConfig.accessToken,
        count: salesNavConfig.count,
      });
      setSalesNavTestResult(result);
    } catch {
      setSalesNavTestResult({ success: false, message: 'Connection test failed. Check your access token.' });
    } finally {
      setSalesNavTesting(false);
    }
  };

  // ── HubSpot handlers ─────────────────────────────────────────
  const handleHubSpotSave = () => {
    setHubSpotConfig(hubspotConfig);
    setHubSpotSaved(true);
    setTimeout(() => setHubSpotSaved(false), 3000);
  };

  const handleHubSpotTest = async () => {
    if (!hubspotConfig.accessToken) {
      setHubSpotTestResult({ success: false, message: 'Enter your HubSpot access token first.' });
      return;
    }
    setHubSpotTesting(true);
    setHubSpotTestResult(null);
    try {
      const result = await integrationsApi.testHubSpot({
        access_token: hubspotConfig.accessToken,
        max_contacts: hubspotConfig.maxContacts,
      });
      setHubSpotTestResult(result);
    } catch {
      setHubSpotTestResult({ success: false, message: 'Connection test failed. Check your HubSpot token.' });
    } finally {
      setHubSpotTesting(false);
    }
  };

  // ── PhantomBuster handlers ────────────────────────────────────
  const handlePbSave = () => {
    setPhantomBusterConfig(pbConfig);
    setPbSaved(true);
    setTimeout(() => setPbSaved(false), 3000);
  };

  const handlePbTest = async () => {
    if (!pbConfig.apiKey) {
      setPbTestResult({ success: false, message: 'Enter your PhantomBuster API key first.' });
      return;
    }
    setPbTesting(true);
    setPbTestResult(null);
    try {
      const result = await integrationsApi.testPhantomBuster({
        api_key: pbConfig.apiKey,
        search_phantom_id: pbConfig.searchPhantomId,
        connection_phantom_id: pbConfig.connectionPhantomId,
        session_cookie: pbConfig.sessionCookie,
        connections_per_launch: pbConfig.connectionsPerLaunch,
      });
      setPbTestResult({
        success: result.status === 'ok',
        message: result.status === 'ok'
          ? `Connected! Account: ${result.email || 'unknown'}`
          : (result.message || 'Connection failed.'),
      });
    } catch {
      setPbTestResult({ success: false, message: 'Connection test failed. Check your API key.' });
    } finally {
      setPbTesting(false);
    }
  };

  const handleLiTestPublish = async () => {
    if (!liConfig.accessToken || !liConfig.authorUrn) {
      setLiPublishTestResult({ success: false, message: 'Fill in all LinkedIn fields first.' });
      return;
    }
    setLiPublishTesting(true);
    setLiPublishTestResult(null);
    try {
      const result = await integrationsApi.testLinkedInPublish({
        access_token: liConfig.accessToken,
        author_urn: liConfig.authorUrn,
      });
      if (result.post_urn) {
        setLiPublishTestResult({
          success: true,
          message: result.message || 'Dummy post published successfully!',
        });
      } else {
        setLiPublishTestResult({
          success: false,
          message: result.message || 'Failed to publish dummy post.',
        });
      }
    } catch (err: any) {
      setLiPublishTestResult({
        success: false,
        message: err.response?.data?.detail || err.message || 'Error publishing dummy post',
      });
    } finally {
      setLiPublishTesting(false);
    }
  };

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your AI provider and integration connections
        </Typography>
      </Box>

      {/* ──────────────────────── LLM Configuration ──────────────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>LLM Provider Configuration</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your API key is stored in your browser&apos;s local storage and sent directly to the AI
          provider when running agents. It is <strong>never stored on our servers</strong>.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Provider</InputLabel>
              <Select
                value={config.provider}
                label="Provider"
                onChange={(e) => handleProviderChange(e.target.value as LLMConfig['provider'])}
              >
                <MenuItem value="openai">OpenAI (ChatGPT)</MenuItem>
                <MenuItem value="gemini">Google Gemini</MenuItem>
                <MenuItem value="anthropic">Anthropic Claude</MenuItem>
                <MenuItem value="grok">xAI (Grok)</MenuItem>
                <MenuItem value="groq">Groq — Free Llama (Recommended)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Model</InputLabel>
              <Select
                value={config.model}
                label="Model"
                onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
              >
                {MODEL_OPTIONS[config.provider].map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="API Key"
              type={showKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => {
                setConfig((prev) => ({ ...prev, apiKey: e.target.value }));
                setValidation(null);
              }}
              placeholder={KEY_PATTERNS[config.provider]?.example ?? 'API key'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowKey((s) => !s)}>
                      {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={3} alignItems="center" flexWrap="wrap">
          <Button variant="contained" onClick={handleSave} startIcon={saved ? <CheckCircleIcon /> : undefined}>
            {saved ? 'Saved!' : 'Save Configuration'}
          </Button>
          <Button variant="outlined" onClick={handleValidate}>
            Validate Key Format
          </Button>
        </Box>

        {validation && (
          <Alert
            severity={validation.success ? 'success' : 'error'}
            sx={{ mt: 2, maxWidth: 600 }}
            onClose={() => setValidation(null)}
          >
            {validation.message}
          </Alert>
        )}

        <Divider sx={{ mt: 3, mb: 2 }} />

        <Box>
          <Typography variant="subtitle2" gutterBottom color="text.secondary">
            How to get your API key:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            <li>
              <Typography variant="body2">
                <strong>OpenAI:</strong>{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                  platform.openai.com/api-keys
                </a>
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Google Gemini:</strong>{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                  aistudio.google.com/app/apikey
                </a>
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Anthropic Claude:</strong>{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                  console.anthropic.com/settings/keys
                </a>
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>xAI (Grok):</strong>{' '}
                <a href="https://console.xai.com" target="_blank" rel="noopener noreferrer">
                  console.xai.com
                </a>
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Groq (Free Llama):</strong>{' '}
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
                  console.groq.com/keys
                </a>
                {' '}— free tier, no credit card required
              </Typography>
            </li>
          </Box>
        </Box>
      </Paper>

      {/* ──────────────────────── WordPress Integration ──────────────────── */}
      <Typography variant="h6" gutterBottom>Integrations</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Connect external services to enable full automation capabilities.
      </Typography>

      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>WordPress REST API</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: wpConfig.siteUrl ? 'success.main' : 'action.hover',
              color: wpConfig.siteUrl ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {wpConfig.siteUrl ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Publish AI-generated blogs directly to your WordPress site. Requires an Application Password
          (Users → Profile → Application Passwords in your WP admin).
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="WordPress Site URL"
              placeholder="https://yoursite.com"
              value={wpConfig.siteUrl}
              onChange={(e) => setWpConfig((p) => ({ ...p, siteUrl: e.target.value }))}
              fullWidth size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Username"
              placeholder="admin"
              value={wpConfig.username}
              onChange={(e) => setWpConfig((p) => ({ ...p, username: e.target.value }))}
              fullWidth size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Application Password"
              type={wpShowPass ? 'text' : 'password'}
              value={wpConfig.appPassword}
              onChange={(e) => setWpConfig((p) => ({ ...p, appPassword: e.target.value }))}
              fullWidth size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setWpShowPass((s) => !s)}>
                      {wpShowPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Publish Status</InputLabel>
              <Select
                value={wpConfig.publishStatus}
                label="Publish Status"
                onChange={(e) => setWpConfig((p) => ({ ...p, publishStatus: e.target.value as 'draft' | 'publish' }))}
              >
                <MenuItem value="draft">Draft (review first)</MenuItem>
                <MenuItem value="publish">Publish immediately</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleWpSave}
            startIcon={wpSaved ? <CheckCircleIcon /> : undefined}>
            {wpSaved ? 'Saved!' : 'Save WordPress Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleWpTest}
            disabled={wpTesting || wpPublishTesting}
            startIcon={wpTesting ? <CircularProgress size={14} /> : undefined}>
            {wpTesting ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button variant="outlined" color="secondary" size="small" onClick={handleWpTestPublish}
            disabled={wpPublishTesting || wpTesting}
            startIcon={wpPublishTesting ? <CircularProgress size={14} /> : undefined}>
            {wpPublishTesting ? 'Publishing…' : 'Test Publish (Dummy)'}
          </Button>
        </Box>

        {wpTestResult && (
          <Alert severity={wpTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setWpTestResult(null)}>
            {wpTestResult.message}
          </Alert>
        )}

        {wpPublishTestResult && (
          <Alert severity={wpPublishTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setWpPublishTestResult(null)}>
            {wpPublishTestResult.message}
            {wpPublishTestResult.link && (
              <Box mt={1}>
                <a href={wpPublishTestResult.link} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                  <b>View Published Post</b>
                </a>
              </Box>
            )}
          </Alert>
        )}
      </Paper>

      {/* ──────────────────────── LinkedIn Integration ───────────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>LinkedIn API</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: liConfig.accessToken ? 'success.main' : 'action.hover',
              color: liConfig.accessToken ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {liConfig.accessToken ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Auto-post LinkedIn content after blog publication. Requires an OAuth access token from a
          LinkedIn developer app. Tokens expire after 60 days.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Access Token"
              type={liShowToken ? 'text' : 'password'}
              value={liConfig.accessToken}
              onChange={(e) => setLiConfig((p) => ({ ...p, accessToken: e.target.value }))}
              fullWidth size="small"
              placeholder="AQV..."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setLiShowToken((s) => !s)}>
                      {liShowToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Author URN"
              value={liConfig.authorUrn}
              onChange={(e) => setLiConfig((p) => ({ ...p, authorUrn: e.target.value }))}
              fullWidth size="small"
              placeholder="urn:li:person:xxxxxx"
              helperText="Your LinkedIn person or organization URN"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleLiSave}
            startIcon={liSaved ? <CheckCircleIcon /> : undefined}>
            {liSaved ? 'Saved!' : 'Save LinkedIn Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleLiTest}
            disabled={liTesting || liPublishTesting}
            startIcon={liTesting ? <CircularProgress size={14} /> : undefined}>
            {liTesting ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button variant="outlined" color="secondary" size="small" onClick={handleLiTestPublish}
            disabled={liPublishTesting || liTesting}
            startIcon={liPublishTesting ? <CircularProgress size={14} /> : undefined}>
            {liPublishTesting ? 'Publishing…' : 'Test Publish (Dummy)'}
          </Button>
        </Box>

        {liTestResult && (
          <Alert severity={liTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setLiTestResult(null)}>
            {liTestResult.message}
          </Alert>
        )}

        {liPublishTestResult && (
          <Alert severity={liPublishTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setLiPublishTestResult(null)}>
            {liPublishTestResult.message}
          </Alert>
        )}
      </Paper>

      {/* ──────────────────────── Klenty Integration ────────────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>Klenty — Email Outreach Automation</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: klentyConfig.apiKey ? 'success.main' : 'action.hover',
              color: klentyConfig.apiKey ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {klentyConfig.apiKey ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Auto-enroll qualified leads into Klenty email sequences. When Agent 2 or Agent 3 runs, fit leads
          are automatically added to Campaign A, warm leads to Campaign B, and cold leads to Campaign C.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Klenty API Key"
              type={klentyShowKey ? 'text' : 'password'}
              value={klentyConfig.apiKey}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, apiKey: e.target.value }))}
              fullWidth size="small"
              placeholder="Your Klenty API key"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setKlentyShowKey((s) => !s)}>
                      {klentyShowKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Klenty Account Email"
              value={klentyConfig.userEmail}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, userEmail: e.target.value }))}
              fullWidth size="small"
              placeholder="your@company.com"
              helperText="The email used to log into your Klenty account"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Campaign A Name (Fit Clients)"
              value={klentyConfig.campaignAName}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, campaignAName: e.target.value }))}
              fullWidth size="small"
              placeholder="Campaign A"
              helperText="For hot leads with score > 70"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Campaign B Name (Warm Leads)"
              value={klentyConfig.campaignBName}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, campaignBName: e.target.value }))}
              fullWidth size="small"
              placeholder="Campaign B"
              helperText="For warm leads"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Campaign C Name (Cold Leads)"
              value={klentyConfig.campaignCName}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, campaignCName: e.target.value }))}
              fullWidth size="small"
              placeholder="Campaign C"
              helperText="For cold leads"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleKlentySave}
            startIcon={klentySaved ? <CheckCircleIcon /> : undefined}>
            {klentySaved ? 'Saved!' : 'Save Klenty Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleKlentyTest}
            disabled={klentyTesting}
            startIcon={klentyTesting ? <CircularProgress size={14} /> : undefined}>
            {klentyTesting ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>

        {klentyTestResult && (
          <Alert severity={klentyTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setKlentyTestResult(null)}>
            {klentyTestResult.message}
          </Alert>
        )}
      </Paper>

      {/* ──────────────────────── Outplay Integration ────────────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>Outplay — Email Outreach Automation</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: outplayConfig.apiKey ? 'success.main' : 'action.hover',
              color: outplayConfig.apiKey ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {outplayConfig.apiKey ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Alternative to Klenty — auto-enroll qualified leads into Outplay sequences. You can configure
          both Klenty and Outplay to enroll leads into both platforms simultaneously.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Outplay API Key"
              type={outplayShowKey ? 'text' : 'password'}
              value={outplayConfig.apiKey}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, apiKey: e.target.value }))}
              fullWidth size="small"
              placeholder="Your Outplay API key"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setOutplayShowKey((s) => !s)}>
                      {outplayShowKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence A Name (Fit Clients)"
              value={outplayConfig.sequenceNameA}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, sequenceNameA: e.target.value }))}
              fullWidth size="small"
              placeholder="Travel Fit Sequence"
              helperText="For hot leads with score > 70"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence B Name (Warm Leads)"
              value={outplayConfig.sequenceNameB}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, sequenceNameB: e.target.value }))}
              fullWidth size="small"
              placeholder="Warm Lead Sequence"
              helperText="For warm leads"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence C Name (Cold Leads)"
              value={outplayConfig.sequenceNameC}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, sequenceNameC: e.target.value }))}
              fullWidth size="small"
              placeholder="Cold Lead Sequence"
              helperText="For cold leads"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleOutplaySave}
            startIcon={outplaySaved ? <CheckCircleIcon /> : undefined}>
            {outplaySaved ? 'Saved!' : 'Save Outplay Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleOutplayTest}
            disabled={outplayTesting}
            startIcon={outplayTesting ? <CircularProgress size={14} /> : undefined}>
            {outplayTesting ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>

        {outplayTestResult && (
          <Alert severity={outplayTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setOutplayTestResult(null)}>
            {outplayTestResult.message}
          </Alert>
        )}
      </Paper>

      {/* ──────────────────────── Apollo.io Integration ─────────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>Apollo.io — Prospect Search (Agent 3)</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: apolloConfig.apiKey ? 'success.main' : 'action.hover',
              color: apolloConfig.apiKey ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {apolloConfig.apiKey ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Enables Agent 3 to fetch <strong>real B2B prospect profiles</strong> from Apollo.io instead of AI-generated dummy data.
          Free tier provides 50 credits/month. Without this, Agent 3 falls back to LLM-generated prospect data.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Apollo.io API Key"
              type={apolloShowKey ? 'text' : 'password'}
              value={apolloConfig.apiKey}
              onChange={(e) => setApolloConfigState((p) => ({ ...p, apiKey: e.target.value }))}
              fullWidth size="small"
              placeholder="Your Apollo.io API key"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setApolloShowKey((s) => !s)}>
                      {apolloShowKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Results Per Run"
              type="number"
              value={apolloConfig.perPage}
              onChange={(e) => setApolloConfigState((p) => ({ ...p, perPage: parseInt(e.target.value) || 10 }))}
              fullWidth size="small"
              inputProps={{ min: 1, max: 25 }}
              helperText="Max prospects to fetch (1–25)"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleApolloSave}
            startIcon={apolloSaved ? <CheckCircleIcon /> : undefined}>
            {apolloSaved ? 'Saved!' : 'Save Apollo Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleApolloTest}
            disabled={apolloTesting}
            startIcon={apolloTesting ? <CircularProgress size={14} /> : undefined}>
            {apolloTesting ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>

        {apolloTestResult && (
          <Alert severity={apolloTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setApolloTestResult(null)}>
            {apolloTestResult.message}
          </Alert>
        )}

        <Divider sx={{ mt: 3, mb: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Get your free API key at{' '}
          <a href="https://app.apollo.io/settings/integrations/api" target="_blank" rel="noopener noreferrer">
            app.apollo.io/settings/integrations/api
          </a>
          {' '}· Free tier: 50 credits/month · No credit card required
        </Typography>
      </Paper>

      {/* ──────────────────────── Sales Navigator Integration ────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>LinkedIn Sales Navigator — Primary Prospect Search (Agent 3)</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: salesNavConfig.accessToken ? 'success.main' : 'action.hover',
              color: salesNavConfig.accessToken ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {salesNavConfig.accessToken ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Agent 3 will use Sales Navigator as the <strong>primary source</strong> for real B2B prospect profiles.
          Falls back to Apollo.io, then AI generation if not configured or unavailable.
          Requires a LinkedIn Sales Navigator Team/Enterprise plan and SNAP API partner access.
        </Typography>
        <Alert severity="info" sx={{ mb: 2.5 }} icon={false}>
          <strong>Priority order for Agent 3 prospect sourcing:</strong>
          {' '}Sales Navigator (this) → Apollo.io → AI-generated fallback
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Sales Navigator Access Token"
              type={salesNavShowToken ? 'text' : 'password'}
              value={salesNavConfig.accessToken}
              onChange={(e) => setSalesNavConfigState((p) => ({ ...p, accessToken: e.target.value }))}
              fullWidth size="small"
              placeholder="OAuth2 access token with r_sales_nav_search scope"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSalesNavShowToken((s) => !s)}>
                      {salesNavShowToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText="OAuth2 token with r_sales_nav_profile + r_sales_nav_search scopes"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Prospects Per Run"
              type="number"
              value={salesNavConfig.count}
              onChange={(e) => setSalesNavConfigState((p) => ({ ...p, count: parseInt(e.target.value) || 10 }))}
              fullWidth size="small"
              inputProps={{ min: 1, max: 25 }}
              helperText="Prospects to fetch per run (1–25)"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleSalesNavSave}
            startIcon={salesNavSaved ? <CheckCircleIcon /> : undefined}>
            {salesNavSaved ? 'Saved!' : 'Save Sales Navigator Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleSalesNavTest}
            disabled={salesNavTesting}
            startIcon={salesNavTesting ? <CircularProgress size={14} /> : undefined}>
            {salesNavTesting ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>

        {salesNavTestResult && (
          <Alert severity={salesNavTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 600 }}
            onClose={() => setSalesNavTestResult(null)}>
            {salesNavTestResult.message}
          </Alert>
        )}

        <Divider sx={{ mt: 3, mb: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Get your access token via LinkedIn OAuth2 with scopes: <code>r_sales_nav_profile r_sales_nav_search</code>.
          Requires Sales Navigator Team or Enterprise subscription + LinkedIn SNAP partner approval.
        </Typography>
      </Paper>

      {/* ──────────────────────── HubSpot CRM Integration ───────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>HubSpot CRM — Lead Source (Agent 2)</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: hubspotConfig.accessToken ? 'success.main' : 'action.hover',
              color: hubspotConfig.accessToken ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {hubspotConfig.accessToken ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          When configured, Agent 2 automatically pulls contacts from your HubSpot CRM and merges them
          with leads from the local database before processing. Duplicates are removed automatically.
          Requires a HubSpot Private App with <strong>crm.objects.contacts.read</strong> scope.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              label="HubSpot Private App Token"
              type={hubspotShowToken ? 'text' : 'password'}
              value={hubspotConfig.accessToken}
              onChange={(e) => setHubSpotConfigState((p) => ({ ...p, accessToken: e.target.value }))}
              fullWidth size="small"
              placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setHubSpotShowToken((s) => !s)}>
                      {hubspotShowToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText="Create a Private App at HubSpot Settings → Integrations → Private Apps"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Max Contacts Per Run"
              type="number"
              value={hubspotConfig.maxContacts}
              onChange={(e) => setHubSpotConfigState((p) => ({ ...p, maxContacts: parseInt(e.target.value) || 100 }))}
              fullWidth size="small"
              inputProps={{ min: 1, max: 1000 }}
              helperText="Contacts to import per agent run (1–1000)"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleHubSpotSave}
            startIcon={hubspotSaved ? <CheckCircleIcon /> : undefined}>
            {hubspotSaved ? 'Saved!' : 'Save HubSpot Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleHubSpotTest}
            disabled={hubspotTesting}
            startIcon={hubspotTesting ? <CircularProgress size={14} /> : undefined}>
            {hubspotTesting ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>

        {hubspotTestResult && (
          <Alert severity={hubspotTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 600 }}
            onClose={() => setHubSpotTestResult(null)}>
            {hubspotTestResult.message}
          </Alert>
        )}

        <Divider sx={{ mt: 3, mb: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Create a free Private App at{' '}
          <a href="https://app.hubspot.com/private-apps" target="_blank" rel="noopener noreferrer">
            app.hubspot.com/private-apps
          </a>
          {' '}· Required scope: <code>crm.objects.contacts.read</code>
        </Typography>
      </Paper>

      {/* ──────────────────────── PhantomBuster Integration ─────────────── */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>PhantomBuster — LinkedIn Prospect Discovery &amp; Connection Sending</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: pbConfig.apiKey ? 'success.main' : 'action.hover',
              color: pbConfig.apiKey ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {pbConfig.apiKey ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Agent 3 uses PhantomBuster to discover LinkedIn decision-makers at Agent 2&apos;s hot-lead companies
          (via &quot;LinkedIn Search Export&quot; phantom) and send personalized connection requests
          (via &quot;LinkedIn Connection Sender&quot; phantom). Falls back to Apollo or LLM if not configured.
          Priority: <strong>PhantomBuster → Apollo → LLM</strong>.
          Requires a <strong>14-day free trial</strong> at phantombuster.com.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="PhantomBuster API Key"
              type={pbShowKey ? 'text' : 'password'}
              value={pbConfig.apiKey}
              onChange={(e) => setPbConfigState((p) => ({ ...p, apiKey: e.target.value }))}
              fullWidth size="small"
              placeholder="Your PhantomBuster API key"
              helperText="Settings → API in your PhantomBuster dashboard"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setPbShowKey((s) => !s)}>
                      {pbShowKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Search Phantom ID"
              value={pbConfig.searchPhantomId}
              onChange={(e) => setPbConfigState((p) => ({ ...p, searchPhantomId: e.target.value }))}
              fullWidth size="small"
              placeholder="Agent ID of LinkedIn Search Export phantom"
              helperText='Phantom Store → "LinkedIn Search Export" → Agent ID'
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Connection Phantom ID"
              value={pbConfig.connectionPhantomId}
              onChange={(e) => setPbConfigState((p) => ({ ...p, connectionPhantomId: e.target.value }))}
              fullWidth size="small"
              placeholder="Agent ID of LinkedIn Connection Sender phantom"
              helperText='Phantom Store → "LinkedIn Connection Sender" → Agent ID'
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Connections Per Launch"
              type="number"
              value={pbConfig.connectionsPerLaunch}
              onChange={(e) => setPbConfigState((p) => ({ ...p, connectionsPerLaunch: parseInt(e.target.value) || 10 }))}
              fullWidth size="small"
              inputProps={{ min: 1, max: 20 }}
              helperText="Max connection requests per run (1–20, default 10)"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="LinkedIn Session Cookie (li_at)"
              type={pbShowCookie ? 'text' : 'password'}
              value={pbConfig.sessionCookie}
              onChange={(e) => setPbConfigState((p) => ({ ...p, sessionCookie: e.target.value }))}
              fullWidth size="small"
              placeholder="Your LinkedIn li_at session cookie"
              helperText="Browser DevTools → Application → Cookies → linkedin.com → li_at  ⚠ For demo/local use only"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setPbShowCookie((s) => !s)}>
                      {pbShowCookie ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handlePbSave}
            startIcon={pbSaved ? <CheckCircleIcon /> : undefined}>
            {pbSaved ? 'Saved!' : 'Save PhantomBuster Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handlePbTest}
            disabled={pbTesting}
            startIcon={pbTesting ? <CircularProgress size={14} /> : undefined}>
            {pbTesting ? 'Testing…' : 'Test Connection'}
          </Button>
        </Box>

        {pbTestResult && (
          <Alert severity={pbTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 600 }}
            onClose={() => setPbTestResult(null)}>
            {pbTestResult.message}
          </Alert>
        )}

        <Divider sx={{ mt: 3, mb: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Setup guide: 1) Sign up at{' '}
          <a href="https://phantombuster.com" target="_blank" rel="noopener noreferrer">phantombuster.com</a>
          {' '}(14-day free trial) · 2) Phantom Store → &quot;LinkedIn Search Export&quot; → save → copy Agent ID ·
          3) Phantom Store → &quot;LinkedIn Connection Sender&quot; → save → copy Agent ID ·
          4) Run Agent 2 first to populate hot leads → then run Agent 3.
        </Typography>
      </Paper>

      {/* ──────────────────────── Other Integrations (Coming Soon) ────────── */}
      <Grid container spacing={2}>
        {OTHER_INTEGRATIONS.map((integration) => (
          <Grid item xs={12} sm={6} md={4} key={integration.name}>
            <Card elevation={0} variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {integration.name}
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      fontSize: 11,
                      bgcolor: 'action.hover',
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {integration.status}
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                  {integration.description}
                </Typography>
                <Tooltip title="View API Documentation">
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={<LinkIcon fontSize="small" />}
                    href={integration.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    disabled
                  >
                    Connect
                  </Button>
                </Tooltip>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

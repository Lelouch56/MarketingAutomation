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
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useState, useEffect } from 'react';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import {
  getLLMConfig,
  setLLMConfig,
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
  getImageGenConfig,
  setImageGenConfig,
} from '../../lib/storage';
import { LLMConfig, LinkedInConfig, KlentyConfig, OutplayConfig, ApolloConfig, SalesNavigatorConfig, HubSpotConfig, PhantomBusterConfig, ImageGenConfig, MODEL_OPTIONS, PROVIDER_LABELS, IMAGE_GEN_MODEL_OPTIONS, IMAGE_GEN_PROVIDER_LABELS } from '../../types';
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

  // Image Generation state
  const [imgGenConfig, setImgGenConfig] = useState<ImageGenConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.0-flash-exp-image-generation',
    enabled: true,
  });
  const [imgGenShowKey, setImgGenShowKey] = useState(false);
  const [imgGenSaved, setImgGenSaved] = useState(false);

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
  // LinkedIn image test
  const [liImageUrl, setLiImageUrl] = useState('');
  const [liImageTestResult, setLiImageTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [liImageTesting, setLiImageTesting] = useState(false);

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
    clientSecret: '',
    clientId: '',
    userId: '',
    location: 'us4',
    sequenceIdA: '',
    sequenceIdB: '',
    sequenceIdC: '',
  });
  const [outplaySaved, setOutplaySaved] = useState(false);
  const [outplayShowKey, setOutplayShowKey] = useState(false);
  const [outplayTestResult, setOutplayTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [outplayTesting, setOutplayTesting] = useState(false);
  const [outplayProspectResult, setOutplayProspectResult] = useState<{ success: boolean; message: string } | null>(null);
  const [outplayProspectTesting, setOutplayProspectTesting] = useState(false);

  // Apollo state
  const [apolloConfig, setApolloConfigState] = useState<ApolloConfig>({
    apiKey: '',
    perPage: 10,
    sequenceIdOta: '',
    sequenceIdHotels: '',
    emailAccountId: '',
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
    listId: '',
  });
  const [hubspotSaved, setHubSpotSaved] = useState(false);
  const [hubspotShowToken, setHubSpotShowToken] = useState(false);
  const [hubspotTestResult, setHubSpotTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hubspotTesting, setHubSpotTesting] = useState(false);
  const [hubspotProspectResult, setHubSpotProspectResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hubspotProspectTesting, setHubSpotProspectTesting] = useState(false);

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
    const existingLi = getLinkedInConfig();
    if (existingLi) setLiConfig(existingLi);
    const existingKlenty = getKlentyConfig();
    if (existingKlenty) setKlentyConfigState(existingKlenty);
    const existingOutplay = getOutplayConfig();
    if (existingOutplay) setOutplayConfigState((prev) => ({ ...prev, ...existingOutplay }));
    const existingApollo = getApolloConfig();
    if (existingApollo) setApolloConfigState((prev) => ({ ...prev, ...existingApollo }));
    const existingSalesNav = getSalesNavigatorConfig();
    if (existingSalesNav) setSalesNavConfigState(existingSalesNav);
    const existingHubSpot = getHubSpotConfig();
    if (existingHubSpot) setHubSpotConfigState({ listId: '', ...existingHubSpot });
    const existingPb = getPhantomBusterConfig();
    if (existingPb) setPbConfigState(existingPb);
    const existingImgGen = getImageGenConfig();
    if (existingImgGen) setImgGenConfig(existingImgGen);
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

  // ── Image Gen handlers ──────────────────────────────────────────
  const handleImgGenProviderChange = (provider: ImageGenConfig['provider']) => {
    setImgGenConfig((prev) => ({
      ...prev,
      provider,
      model: IMAGE_GEN_MODEL_OPTIONS[provider][0],
    }));
  };

  const handleImgGenSave = () => {
    setImageGenConfig(imgGenConfig);
    setImgGenSaved(true);
    setTimeout(() => setImgGenSaved(false), 3000);
  };

  // ── LinkedIn handlers ─────────────────────────────────────────
  const handleLiSave = () => {
    setLinkedInConfig(liConfig);
    setLiSaved(true);
    setTimeout(() => setLiSaved(false), 3000);
  };

  const handleLiTest = async () => {
    if (!liConfig.accessToken) {
      setLiTestResult({ success: false, message: 'Enter your LinkedIn access token first.' });
      return;
    }
    setLiTesting(true);
    setLiTestResult(null);
    try {
      const result = await integrationsApi.testLinkedIn({
        access_token: liConfig.accessToken,
        author_urn: liConfig.authorUrn,
      });
      // Auto-fill URN from /v2/me response if field is still empty
      if (result.person_urn && !liConfig.authorUrn) {
        setLiConfig((prev) => ({ ...prev, authorUrn: result.person_urn }));
      }
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
    if (!outplayConfig.clientSecret || !outplayConfig.clientId) {
      setOutplayTestResult({ success: false, message: 'Enter your Outplay Client Secret and Client ID first.' });
      return;
    }
    setOutplayTesting(true);
    setOutplayTestResult(null);
    try {
      const result = await integrationsApi.testOutplay({
        client_secret: outplayConfig.clientSecret,
        client_id: outplayConfig.clientId,
        user_id: outplayConfig.userId,
        location: outplayConfig.location,
        sequence_id_a: outplayConfig.sequenceIdA,
        sequence_id_b: outplayConfig.sequenceIdB,
      });
      setOutplayTestResult(result);
    } catch {
      setOutplayTestResult({ success: false, message: 'Connection test failed. Check your Outplay Client Secret.' });
    } finally {
      setOutplayTesting(false);
    }
  };

  const handleOutplayTestProspect = async () => {
    if (!outplayConfig.clientSecret || !outplayConfig.clientId) {
      setOutplayProspectResult({ success: false, message: 'Enter your Outplay Client Secret and Client ID first.' });
      return;
    }
    setOutplayProspectTesting(true);
    setOutplayProspectResult(null);
    try {
      const result = await integrationsApi.testOutplayProspect({
        client_secret: outplayConfig.clientSecret,
        client_id: outplayConfig.clientId,
        user_id: outplayConfig.userId,
        location: outplayConfig.location,
        sequence_id_a: outplayConfig.sequenceIdA,
        sequence_id_b: outplayConfig.sequenceIdB,
      });
      setOutplayProspectResult(result);
    } catch {
      setOutplayProspectResult({ success: false, message: 'Failed to send test prospect. Check your config.' });
    } finally {
      setOutplayProspectTesting(false);
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
        list_id: hubspotConfig.listId,
      });
      setHubSpotTestResult(result);
    } catch {
      setHubSpotTestResult({ success: false, message: 'Connection test failed. Check your HubSpot token.' });
    } finally {
      setHubSpotTesting(false);
    }
  };

  const handleHubSpotTestProspect = async () => {
    if (!hubspotConfig.accessToken) {
      setHubSpotProspectResult({ success: false, message: 'Enter your HubSpot access token first.' });
      return;
    }
    setHubSpotProspectTesting(true);
    setHubSpotProspectResult(null);
    try {
      const result = await integrationsApi.testHubSpotProspect({
        access_token: hubspotConfig.accessToken,
        max_contacts: hubspotConfig.maxContacts,
        list_id: hubspotConfig.listId,
      });
      setHubSpotProspectResult(result);
    } catch {
      setHubSpotProspectResult({ success: false, message: 'Test prospect failed. Check your token and try again.' });
    } finally {
      setHubSpotProspectTesting(false);
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

  const handleLiTestPostWithImage = async () => {
    if (!liConfig.accessToken || !liConfig.authorUrn) {
      setLiImageTestResult({ success: false, message: 'Fill in LinkedIn access token and author URN first.' });
      return;
    }
    if (!liImageUrl.trim()) {
      setLiImageTestResult({ success: false, message: 'Enter a public image URL to test image posting.' });
      return;
    }
    setLiImageTesting(true);
    setLiImageTestResult(null);
    try {
      const result = await integrationsApi.testLinkedInPublishWithImage({
        access_token: liConfig.accessToken,
        author_urn: liConfig.authorUrn,
        image_url: liImageUrl.trim(),
      });
      setLiImageTestResult({
        success: !!result.post_urn,
        message: result.post_urn
          ? `Image post published! URN: ${result.post_urn}`
          : (result.message || 'Failed to publish image post.'),
      });
    } catch (err: any) {
      setLiImageTestResult({
        success: false,
        message: err.response?.data?.detail || err.message || 'Error publishing image post',
      });
    } finally {
      setLiImageTesting(false);
    }
  };

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your AI provider and integration connections
        </Typography>
      </Box>

      {/* ──────────────────────── LLM Configuration ──────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
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

      {/* ──────────────────────── Image Generation Config ──────────────── */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">Image Generation (Agent 1 — Hangout Social)</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={imgGenConfig.enabled}
                onChange={(e) => setImgGenConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
            }
            label={imgGenConfig.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Separate provider for LinkedIn post images. Allows using a free text LLM (e.g. Groq) while generating images with Gemini (also free).
        </Typography>

        {imgGenConfig.enabled && (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Provider</InputLabel>
                  <Select
                    value={imgGenConfig.provider}
                    label="Provider"
                    onChange={(e) => handleImgGenProviderChange(e.target.value as ImageGenConfig['provider'])}
                  >
                    {(Object.keys(IMAGE_GEN_PROVIDER_LABELS) as ImageGenConfig['provider'][]).map((p) => (
                      <MenuItem key={p} value={p}>{IMAGE_GEN_PROVIDER_LABELS[p]}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={imgGenConfig.model}
                    label="Model"
                    onChange={(e) => setImgGenConfig((prev) => ({ ...prev, model: e.target.value }))}
                  >
                    {IMAGE_GEN_MODEL_OPTIONS[imgGenConfig.provider].map((m) => (
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
                  type={imgGenShowKey ? 'text' : 'password'}
                  value={imgGenConfig.apiKey}
                  onChange={(e) => setImgGenConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={imgGenConfig.provider === 'gemini' ? 'AIzaSy...' : imgGenConfig.provider === 'ideogram' ? 'Ideogram API key...' : 'sk-...'}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setImgGenShowKey(!imgGenShowKey)}>
                          {imgGenShowKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
            <Box display="flex" gap={2} mt={2} alignItems="center">
              <Button variant="contained" size="small" onClick={handleImgGenSave} startIcon={imgGenSaved ? <CheckCircleIcon /> : undefined}>
                {imgGenSaved ? 'Saved!' : 'Save Image Config'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                {imgGenConfig.provider === 'ideogram' ? (
                  <>Get a free Ideogram key at{' '}<a href="https://ideogram.ai/manage-api" target="_blank" rel="noopener noreferrer">ideogram.ai/manage-api</a></>
                ) : imgGenConfig.provider === 'gemini' ? (
                  <>Get a free Gemini key at{' '}<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com</a></>
                ) : (
                  <>Get an OpenAI key at{' '}<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com</a></>
                )}
              </Typography>
            </Box>
          </>
        )}

        {!imgGenConfig.enabled && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Agent 1 will use the main LLM config above for images (only works if the main provider is OpenAI or Gemini).
          </Typography>
        )}
      </Paper>

      {/* ──────────────────────── Integrations Header ──────────────────── */}
      <Typography variant="h6" gutterBottom>Integrations</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Connect external services to enable full automation capabilities.
      </Typography>

      {/* ──────────────────────── LinkedIn Integration ───────────────────── */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>LinkedIn API — Auto-Post Blogs &amp; Content</Typography>
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
          Agent 1 auto-posts to LinkedIn after each blog is generated. Supports text posts, URL-preview posts
          (article card), and image posts. Requires an OAuth access token — tokens expire after 60 days.
        </Typography>

        {/* How-to guide */}
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mb: 2.5 }}>
          <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
            🔑 How to get your LinkedIn Access Token &amp; Author URN
          </Typography>
          <Typography variant="caption" display="block" sx={{ lineHeight: 1.8 }}>
            1. Go to <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer">developer.linkedin.com/apps</a> → Create a new app<br />
            2. Under <b>Products</b> tab → Request access to <b>"Share on LinkedIn"</b> (gives <code>w_member_social</code>)<br />
            3. Also request <b>"Sign In with LinkedIn using OpenID Connect"</b> (gives <code>profile</code> scope — needed to auto-fill URN)<br />
            4. Go to <a href="https://www.linkedin.com/developers/tools/oauth/token-inspector" target="_blank" rel="noreferrer">OAuth Token Inspector</a> → select your app → check <code>w_member_social</code> + <code>profile</code> → click <b>"Request access token"</b><br />
            5. Paste token below → click <b>Test Connection</b> → Author URN <b>auto-fills automatically</b> ✓
          </Typography>
        </Box>

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
              helperText="Auto-filled when you click Test Connection — or enter manually"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2.5} alignItems="center" flexWrap="wrap">
          <Button variant="contained" size="small" onClick={handleLiSave}
            startIcon={liSaved ? <CheckCircleIcon /> : undefined}>
            {liSaved ? 'Saved!' : 'Save LinkedIn Config'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleLiTest}
            disabled={liTesting || liPublishTesting || liImageTesting}
            startIcon={liTesting ? <CircularProgress size={14} /> : undefined}>
            {liTesting ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button variant="outlined" color="secondary" size="small" onClick={handleLiTestPublish}
            disabled={liPublishTesting || liTesting || liImageTesting}
            startIcon={liPublishTesting ? <CircularProgress size={14} /> : undefined}>
            {liPublishTesting ? 'Publishing…' : 'Test Text Post'}
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

        {/* Image post test */}
        <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            🖼️ Test Image + Text Post
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            Posts a test message with an image to LinkedIn. Enter any publicly accessible image URL
            (e.g. from Unsplash, your CDN, or a blog post). LinkedIn will upload and attach the image.
          </Typography>
          <Box display="flex" gap={1.5} alignItems="flex-start" flexWrap="wrap">
            <TextField
              label="Public Image URL"
              value={liImageUrl}
              onChange={(e) => setLiImageUrl(e.target.value)}
              size="small"
              placeholder="https://images.unsplash.com/photo-..."
              sx={{ flexGrow: 1, minWidth: 240 }}
            />
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={handleLiTestPostWithImage}
              disabled={liImageTesting || liTesting || liPublishTesting}
              startIcon={liImageTesting ? <CircularProgress size={14} /> : undefined}
              sx={{ whiteSpace: 'nowrap', mt: 0.25 }}
            >
              {liImageTesting ? 'Posting…' : 'Test Post + Image'}
            </Button>
          </Box>
          {liImageTestResult && (
            <Alert severity={liImageTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
              onClose={() => setLiImageTestResult(null)}>
              {liImageTestResult.message}
            </Alert>
          )}
        </Box>
      </Paper>

      {/* ──────────────────────── Klenty Integration ────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
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
              label="Campaign A Name (Qualified Leads)"
              value={klentyConfig.campaignAName}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, campaignAName: e.target.value }))}
              fullWidth size="small"
              placeholder="Campaign A"
              helperText="For Qualified Leads — business email + website, ICP score > 70"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Campaign B Name (Personal Leads)"
              value={klentyConfig.campaignBName}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, campaignBName: e.target.value }))}
              fullWidth size="small"
              placeholder="Campaign B"
              helperText="For Personal Leads — Gmail, Yahoo, Outlook, etc."
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Campaign C Name (Nurture Leads)"
              value={klentyConfig.campaignCName}
              onChange={(e) => setKlentyConfigState((p) => ({ ...p, campaignCName: e.target.value }))}
              fullWidth size="small"
              placeholder="Campaign C"
              helperText="Optional — for Nurture Leads needing manual review"
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
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>Outplay — Email Outreach Automation</Typography>
          <Box
            component="span"
            sx={{
              fontSize: 11, bgcolor: (outplayConfig.clientSecret && outplayConfig.clientId) ? 'success.main' : 'action.hover',
              color: (outplayConfig.clientSecret && outplayConfig.clientId) ? 'white' : 'text.secondary',
              px: 1, py: 0.25, borderRadius: 1,
            }}
          >
            {(outplayConfig.clientSecret && outplayConfig.clientId) ? 'Configured' : 'Not Configured'}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Alternative to Klenty — auto-enroll qualified leads into Outplay sequences. You can configure
          both Klenty and Outplay to enroll leads into both platforms simultaneously.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Client Secret"
              type={outplayShowKey ? 'text' : 'password'}
              value={outplayConfig.clientSecret}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, clientSecret: e.target.value }))}
              fullWidth size="small"
              placeholder="Your Outplay client_secret"
              helperText="Sent as X-CLIENT-SECRET header — found in Outplay Settings → API"
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
              label="Client ID"
              value={outplayConfig.clientId}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, clientId: e.target.value }))}
              fullWidth size="small"
              placeholder="Your Outplay client_id"
              helperText="?client_id= query param — found in Outplay Settings → API"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="User ID"
              value={outplayConfig.userId}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, userId: e.target.value }))}
              fullWidth size="small"
              placeholder="e.g. 39520"
              helperText="Your Outplay user ID — required to enroll prospects in sequences (Settings → API or profile URL)"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Location / Server Region"
              value={outplayConfig.location}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, location: e.target.value }))}
              fullWidth size="small"
              placeholder="us4"
              helperText="Regional server prefix, e.g. us4 → us4-api.outplayhq.com"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence A ID — Qualified Lead Marktech"
              value={outplayConfig.sequenceIdA}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, sequenceIdA: e.target.value }))}
              fullWidth size="small"
              placeholder="e.g. 51355"
              helperText="For Qualified Leads (business email + website, ICP score > 70) — numeric ID from Outplay sequence URL"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence B ID — Personal Lead Marktech"
              value={outplayConfig.sequenceIdB}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, sequenceIdB: e.target.value }))}
              fullWidth size="small"
              placeholder="e.g. 51356"
              helperText="For Personal Leads (Gmail, Yahoo, Outlook, etc.) — numeric ID from Outplay sequence URL"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence C ID — Travel Tech Outreach (Matters broad)"
              value={outplayConfig.sequenceIdC}
              onChange={(e) => setOutplayConfigState((p) => ({ ...p, sequenceIdC: e.target.value }))}
              fullWidth size="small"
              placeholder="e.g. 51357"
              helperText="Used by Agent 3 (Matters broad) for OTA / Bedbank / TMC / Travel Tech decision-maker outreach"
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
          <Button variant="outlined" size="small" color="secondary" onClick={handleOutplayTestProspect}
            disabled={outplayProspectTesting}
            startIcon={outplayProspectTesting ? <CircularProgress size={14} /> : undefined}>
            {outplayProspectTesting ? 'Sending…' : 'Send Test Prospect'}
          </Button>
        </Box>

        {outplayTestResult && (
          <Alert severity={outplayTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 500 }}
            onClose={() => setOutplayTestResult(null)}>
            {outplayTestResult.message}
          </Alert>
        )}

        {outplayProspectResult && (
          <Alert severity={outplayProspectResult.success ? 'success' : 'error'} sx={{ mt: 1, maxWidth: 500 }}
            onClose={() => setOutplayProspectResult(null)}>
            {outplayProspectResult.success
              ? `✓ Dummy prospect created and enrolled in Qualified Lead Marktech sequence ${outplayConfig.sequenceIdA}`
              : outplayProspectResult.message}
          </Alert>
        )}
      </Paper>

      {/* ──────────────────────── Apollo.io Integration ─────────────────── */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
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
          Enables Agent 3 to fetch <strong>real B2B prospect profiles</strong> from Apollo.io and automatically
          enroll them into outreach sequences. Configure your API key and the two ICP sequences below —
          no Outplay or Klenty required; Apollo&apos;s built-in sequences handle the full campaign lifecycle.
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
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence ID — ICP1 OTA"
              value={apolloConfig.sequenceIdOta}
              onChange={(e) => setApolloConfigState((p) => ({ ...p, sequenceIdOta: e.target.value }))}
              fullWidth size="small"
              placeholder="e.g. 69b481adc8c6cb00151b8450"
              helperText="For OTA / Travel Tech / TMC companies"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sequence ID — ICP2 Hotels"
              value={apolloConfig.sequenceIdHotels}
              onChange={(e) => setApolloConfigState((p) => ({ ...p, sequenceIdHotels: e.target.value }))}
              fullWidth size="small"
              placeholder="e.g. 69b482d302534400215b74ec"
              helperText="For Bedbank / Hotel Wholesaler / Hotel Distribution"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email Account ID (optional)"
              value={apolloConfig.emailAccountId}
              onChange={(e) => setApolloConfigState((p) => ({ ...p, emailAccountId: e.target.value }))}
              fullWidth size="small"
              placeholder="Apollo mailbox ID"
              helperText="Apollo mailbox used to send sequence emails"
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
          Get your API key at{' '}
          <a href="https://app.apollo.io/settings/integrations/api" target="_blank" rel="noopener noreferrer">
            app.apollo.io/settings/integrations/api
          </a>
          {' '}· Find Sequence IDs in Apollo → Sequences → open a sequence → copy the ID from the URL
          {' '}· Free tier: 50 credits/month
        </Typography>
      </Paper>

      {/* ──────────────────────── Sales Navigator Integration ────────────── */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
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
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>HubSpot CRM — Lead Source (Agent 2) &amp; Email Sequences (Agent 3)</Typography>
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
          Agent 2 pulls contacts from HubSpot CRM as a lead source. Agent 3 creates prospects as
          HubSpot contacts, sets their lead status to <strong>"In Progress"</strong>, and optionally adds
          them to a specific list. All <strong>completely free</strong> on any HubSpot plan.
          Private App scopes needed: <code>crm.objects.contacts.read/write</code> + <code>crm.lists.write</code> (for list).
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
          <Grid item xs={12} sm={8}>
            <TextField
              label="List ID (optional — adds contact to a specific list)"
              value={hubspotConfig.listId}
              onChange={(e) => setHubSpotConfigState((p) => ({ ...p, listId: e.target.value }))}
              fullWidth size="small"
              placeholder="e.g. 9"
              helperText="Create a Static list in HubSpot (Contacts → Lists → Create list → choose 'Static list', NOT 'Active list'). Then open it — the number in the URL (e.g. objectLists/9) is your List ID. Create a Workflow triggered by this list to auto-send emails."
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
          <Button variant="outlined" color="secondary" size="small" onClick={handleHubSpotTestProspect}
            disabled={hubspotProspectTesting || !hubspotConfig.accessToken}
            startIcon={hubspotProspectTesting ? <CircularProgress size={14} /> : undefined}>
            {hubspotProspectTesting ? 'Sending…' : 'Send Test Prospect'}
          </Button>
        </Box>

        {hubspotTestResult && (
          <Alert severity={hubspotTestResult.success ? 'success' : 'error'} sx={{ mt: 2, maxWidth: 600 }}
            onClose={() => setHubSpotTestResult(null)}>
            {hubspotTestResult.message}
          </Alert>
        )}

        {hubspotProspectResult && (
          <Alert severity={hubspotProspectResult.success ? 'success' : 'error'} sx={{ mt: 1, maxWidth: 600 }}
            onClose={() => setHubSpotProspectResult(null)}>
            {hubspotProspectResult.message}
          </Alert>
        )}

        <Divider sx={{ mt: 3, mb: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Create a Private App at{' '}
          <a href="https://app.hubspot.com/private-apps" target="_blank" rel="noopener noreferrer">
            app.hubspot.com/private-apps
          </a>
          {' '}· Scopes: <code>crm.objects.contacts.read/write</code> (required) + <code>crm.lists.write</code> (for list)
          · List ID: the number from <code>objectLists/N</code> in the URL — e.g. <code>objectLists/9</code> → enter <strong>9</strong>
        </Typography>
      </Paper>

      {/* ──────────────────────── PhantomBuster Integration ─────────────── */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px' }}>
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

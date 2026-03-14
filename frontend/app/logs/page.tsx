'use client';

import {
  Box,
  Typography,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import LogsTable from '../../components/logs/LogsTable';
import { globalApi } from '../../services/api';
import { getLogs, clearLogs as clearLocalLogs, appendLog } from '../../lib/storage';
import { LogEntry } from '../../types';

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [source, setSource] = useState<'backend' | 'local'>('backend');
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const loadLogs = async () => {
    if (source === 'backend') {
      try {
        const params: Record<string, string> = {};
        if (levelFilter) params.level = levelFilter;
        if (agentFilter !== 'all') params.agent_id = agentFilter;
        const data = await globalApi.getLogs(params);
        setLogs(data);
        setTotalCount(data.length);
        setError('');
      } catch {
        setError('Cannot connect to backend. Showing local browser logs instead.');
        const local = getLogs();
        setLogs(local);
        setTotalCount(local.length);
        setSource('local');
      }
    } else {
      const local = getLogs();
      const filtered = local.filter((l) => {
        if (levelFilter && l.level !== levelFilter) return false;
        if (agentFilter !== 'all' && l.agent_id !== agentFilter) return false;
        return true;
      });
      setLogs(filtered);
      setTotalCount(local.length);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [levelFilter, agentFilter, source]);

  const handleClear = async () => {
    try {
      if (source === 'backend') await globalApi.clearLogs();
    } catch {}
    clearLocalLogs();
    setLogs([]);
    setTotalCount(0);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Activity Logs</Typography>
          <Typography variant="body2" color="text.secondary">
            Track all agent runs and system events{' '}
            <Chip label={`${totalCount} entries`} size="small" sx={{ ml: 0.5, bgcolor: 'rgba(23,84,207,0.08)', color: 'primary.main', fontWeight: 600 }} />
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadLogs}>
            Refresh
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleClear}
          >
            Clear All
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
        <ToggleButtonGroup
          value={source}
          exclusive
          onChange={(_, v) => v && setSource(v)}
          size="small"
        >
          <ToggleButton value="backend">Backend Logs</ToggleButton>
          <ToggleButton value="local">Browser Logs</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={levelFilter}
          exclusive
          onChange={(_, v) => setLevelFilter(v)}
          size="small"
        >
          <ToggleButton value={null as unknown as string}>All Levels</ToggleButton>
          <ToggleButton value="info">Info</ToggleButton>
          <ToggleButton value="warning">Warning</ToggleButton>
          <ToggleButton value="error">Error</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Agent</InputLabel>
          <Select
            value={agentFilter}
            label="Agent"
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <MenuItem value="all">All Agents</MenuItem>
            <MenuItem value="agent1">Content & SEO</MenuItem>
            <MenuItem value="agent2">Lead Qualification</MenuItem>
            <MenuItem value="agent3">Email Campaign</MenuItem>
            <MenuItem value="agent4">Analytics</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <LogsTable logs={logs} />
    </Box>
  );
}

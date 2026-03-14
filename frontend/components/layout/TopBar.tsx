'use client';

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getLLMConfig } from '../../lib/storage';
import { PROVIDER_LABELS } from '../../types';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/agents': 'All Agents',
  '/logs': 'Activity Logs',
  '/settings': 'Settings',
};

const AGENT_TITLES: Record<string, string> = {
  'agent1': 'Hangout Social',
  'agent2': 'Matters',
  'agent3': 'Matter Boards',
  'agent4': 'Ringside View',
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [llmLabel, setLlmLabel] = useState<string | null>(null);

  useEffect(() => {
    const config = getLLMConfig();
    if (config?.apiKey) {
      setLlmLabel(`${PROVIDER_LABELS[config.provider]} · ${config.model}`);
    } else {
      setLlmLabel(null);
    }
  }, [pathname]);

  let title = PAGE_TITLES[pathname] || 'Inbound 360';
  if (pathname.startsWith('/agents/')) {
    const agentId = pathname.split('/agents/')[1]?.split('/')[0];
    title = agentId ? (AGENT_TITLES[agentId] ?? 'Agent Details') : 'Agent Details';
  }

  const isLivePage = pathname === '/' || pathname.startsWith('/agents/');

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        zIndex: 1,
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: 3 }}>
        {/* Title + Live badge */}
        <Box display="flex" alignItems="center" gap={1.5} sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 18, color: 'text.primary' }}>
            {title}
          </Typography>
          {isLivePage && (
            <Chip
              label="Live"
              size="small"
              sx={{
                bgcolor: 'rgba(23,84,207,0.1)',
                color: 'primary.main',
                fontWeight: 700,
                fontSize: 10,
                height: 20,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                borderRadius: '4px',
              }}
            />
          )}
        </Box>

        {/* Right side actions */}
        <Box display="flex" alignItems="center" gap={1}>
          {llmLabel ? (
            <Chip
              label={llmLabel}
              size="small"
              sx={{
                bgcolor: 'rgba(5,150,105,0.1)',
                color: '#059669',
                border: '1px solid rgba(5,150,105,0.25)',
                fontWeight: 600,
                fontSize: 11,
                height: 24,
              }}
            />
          ) : (
            <Chip
              label="LLM Not Configured"
              size="small"
              onClick={() => router.push('/settings')}
              sx={{
                bgcolor: 'rgba(237,108,2,0.1)',
                color: 'warning.main',
                border: '1px solid rgba(237,108,2,0.25)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 11,
                height: 24,
              }}
            />
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'divider' }} />

          <Tooltip title="Notifications">
            <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'rgba(23,84,207,0.06)' } }}>
              <NotificationsIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              size="small"
              onClick={() => router.push('/settings')}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'rgba(23,84,207,0.06)' } }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

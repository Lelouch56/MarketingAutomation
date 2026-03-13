'use client';

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
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
  }, [pathname]); // refresh on navigation

  const title = pathname.startsWith('/agents/')
    ? 'Agent Details'
    : PAGE_TITLES[pathname] || 'Inbound 360';

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
      <Toolbar sx={{ minHeight: 56 }}>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600, color: 'text.primary' }}>
          {title}
        </Typography>

        <Box display="flex" alignItems="center" gap={1.5}>
          {llmLabel ? (
            <Chip
              label={llmLabel}
              color="success"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500, fontSize: 11 }}
            />
          ) : (
            <Chip
              label="LLM Not Configured"
              color="warning"
              size="small"
              variant="outlined"
              onClick={() => router.push('/settings')}
              sx={{ cursor: 'pointer', fontWeight: 500, fontSize: 11 }}
            />
          )}

          <Tooltip title="Settings">
            <IconButton size="small" onClick={() => router.push('/settings')}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

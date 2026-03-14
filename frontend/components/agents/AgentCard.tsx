'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  LinearProgress,
  Tooltip,
  IconButton,
  Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ConstructionIcon from '@mui/icons-material/Construction';
import WorkIcon from '@mui/icons-material/Work';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import ForumIcon from '@mui/icons-material/Forum';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useRouter } from 'next/navigation';
import { AgentRunStatus } from '../../types';

interface Props {
  agentId: string;
  name: string;
  description: string;
  status: AgentRunStatus | null;
  stepsCount: number;
  onRun: () => Promise<void>;
  isRunning: boolean;
  lastRun?: string;
  implemented?: boolean;
}

const AGENT_ICON_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  agent1: { icon: ForumIcon, color: '#EA580C', bg: '#FFF7ED' },
  agent2: { icon: WorkIcon, color: '#2563EB', bg: '#EFF6FF' },
  agent3: { icon: DashboardCustomizeIcon, color: '#9333EA', bg: '#FAF5FF' },
  agent4: { icon: VisibilityIcon, color: '#059669', bg: '#ECFDF5' },
};

function StatusPill({ status, isRunning }: { status: string; isRunning: boolean }) {
  const effectiveStatus = isRunning ? 'running' : status;

  if (effectiveStatus === 'running') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.4,
          bgcolor: 'rgba(5,150,105,0.08)',
          borderRadius: '100px',
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: '#059669',
            animation: 'pulse 1.5s infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.3 },
            },
          }}
        />
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Running
        </Typography>
      </Box>
    );
  }
  if (effectiveStatus === 'completed') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, bgcolor: 'rgba(5,150,105,0.08)', borderRadius: '100px' }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#059669' }} />
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Done</Typography>
      </Box>
    );
  }
  if (effectiveStatus === 'failed') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, bgcolor: 'rgba(211,47,47,0.08)', borderRadius: '100px' }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#D32F2F' }} />
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#D32F2F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, bgcolor: 'rgba(100,116,139,0.1)', borderRadius: '100px' }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#94a3b8' }} />
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Idle</Typography>
    </Box>
  );
}

export default function AgentCard({
  agentId,
  name,
  description,
  status,
  stepsCount,
  onRun,
  isRunning,
  lastRun,
  implemented = true,
}: Props) {
  const router = useRouter();

  const completedSteps = status?.steps?.filter((s) => s.status === 'completed').length ?? 0;
  const progress = stepsCount > 0 && isRunning ? (completedSteps / stepsCount) * 100 : 0;
  const currentStep = status?.steps?.find((s) => s.status === 'running');

  const iconCfg = AGENT_ICON_CONFIG[agentId] ?? { icon: SmartToyIcon, color: '#64748b', bg: '#f1f5f9' };
  const AgentIcon = iconCfg.icon;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(23,84,207,0.08)',
        borderRadius: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(23,84,207,0.1)',
          borderColor: 'rgba(23,84,207,0.2)',
        },
        opacity: implemented ? 1 : 0.7,
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1, p: 2.5 }}>
        {/* Header row: icon + status */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box
            sx={{
              width: 44,
              height: 44,
              bgcolor: iconCfg.bg,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AgentIcon sx={{ color: iconCfg.color, fontSize: 22 }} />
          </Box>
          <StatusPill status={status?.status ?? 'idle'} isRunning={isRunning} />
        </Box>

        {/* Name */}
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: 'text.primary', lineHeight: 1.3 }}>
            {name}
          </Typography>
          {!implemented && (
            <Chip
              icon={<ConstructionIcon sx={{ fontSize: '11px !important' }} />}
              label="Soon"
              size="small"
              sx={{ fontSize: 10, height: 18 }}
            />
          )}
        </Box>

        {/* Description */}
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, lineHeight: 1.6, fontSize: 12.5 }}>
          {description}
        </Typography>

        {/* Progress bar when running */}
        {isRunning && (
          <Box sx={{ mb: 1 }}>
            <Box display="flex" justifyContent="space-between" mb={0.75} alignItems="center">
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {currentStep
                  ? currentStep.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  : 'Processing...'}
              </Typography>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary' }}>
                {completedSteps}/{stepsCount} · {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                borderRadius: 8,
                height: 5,
                bgcolor: 'rgba(23,84,207,0.08)',
                '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: 'primary.main' },
              }}
            />
          </Box>
        )}

        {/* Completed status */}
        {!isRunning && status?.status === 'completed' && status.completed_at && (
          <Typography sx={{ fontSize: 11.5, color: '#059669', fontWeight: 600 }}>
            ✓ Completed {new Date(status.completed_at).toLocaleString()}
          </Typography>
        )}

        {/* Failed status */}
        {!isRunning && status?.status === 'failed' && (
          <Typography sx={{ fontSize: 11.5, color: 'error.main', fontWeight: 600 }}>
            ✗ Failed: {status.error?.slice(0, 80) ?? 'Unknown error'}
          </Typography>
        )}

        {/* Last run */}
        {!isRunning && (!status || status.status === 'idle') && lastRun && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
            Last run: {new Date(lastRun).toLocaleString()}
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2.5, pb: 2.5, pt: 0 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={onRun}
          disabled={isRunning || !implemented}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 12.5,
            px: 2,
            py: 0.75,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {isRunning ? 'Running…' : 'Run Now'}
        </Button>

        <Tooltip title="View Details">
          <span>
            <IconButton
              size="small"
              onClick={() => router.push(`/agents/${agentId}`)}
              disabled={!implemented}
              sx={{
                color: 'text.secondary',
                '&:hover': { bgcolor: 'rgba(23,84,207,0.06)', color: 'primary.main' },
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

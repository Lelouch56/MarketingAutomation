'use client';

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
import { useRouter } from 'next/navigation';
import StatusBadge from './StatusBadge';
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

  const completedSteps =
    status?.steps?.filter((s) => s.status === 'completed').length ?? 0;
  const progress =
    stepsCount > 0 && isRunning ? (completedSteps / stepsCount) * 100 : 0;

  const currentStep = status?.steps?.find((s) => s.status === 'running');

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
        opacity: implemented ? 1 : 0.75,
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {name}
            </Typography>
            {!implemented && (
              <Chip
                icon={<ConstructionIcon sx={{ fontSize: '12px !important' }} />}
                label="Coming Soon"
                size="small"
                sx={{ fontSize: 10, height: 20 }}
              />
            )}
          </Box>
          <StatusBadge status={isRunning ? 'running' : (status?.status ?? 'idle')} />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
          {description}
        </Typography>

        {isRunning && (
          <Box sx={{ mb: 1 }}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                {currentStep
                  ? currentStep.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  : 'Processing...'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {completedSteps}/{stepsCount}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ borderRadius: 4, height: 6 }}
            />
          </Box>
        )}

        {!isRunning && status?.status === 'completed' && status.completed_at && (
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 500 }}>
            ✓ Completed {new Date(status.completed_at).toLocaleString()}
          </Typography>
        )}

        {!isRunning && status?.status === 'failed' && (
          <Typography variant="caption" color="error.main" sx={{ fontWeight: 500 }}>
            ✗ Failed: {status.error?.slice(0, 80) ?? 'Unknown error'}
          </Typography>
        )}

        {!isRunning && (!status || status.status === 'idle') && lastRun && (
          <Typography variant="caption" color="text.secondary">
            Last run: {new Date(lastRun).toLocaleString()}
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2, pt: 0 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={onRun}
          disabled={isRunning || !implemented}
        >
          {isRunning ? 'Running…' : 'Run Now'}
        </Button>

        <Tooltip title="View Details">
          <span>
            <IconButton
              size="small"
              onClick={() => router.push(`/agents/${agentId}`)}
              disabled={!implemented}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

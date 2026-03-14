import { Box, Typography } from '@mui/material';

interface Props {
  status: string;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; animate?: boolean }> = {
  idle:      { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Idle' },
  running:   { color: '#059669', bg: 'rgba(5,150,105,0.08)',  label: 'Running', animate: true },
  completed: { color: '#059669', bg: 'rgba(5,150,105,0.08)',  label: 'Completed' },
  failed:    { color: '#D32F2F', bg: 'rgba(211,47,47,0.08)',  label: 'Failed' },
};

export default function StatusBadge({ status, size = 'small' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const dotSize = size === 'medium' ? 8 : 7;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: size === 'medium' ? 1.5 : 1.25,
        py: size === 'medium' ? 0.6 : 0.4,
        bgcolor: cfg.bg,
        borderRadius: '100px',
      }}
    >
      <Box
        sx={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          bgcolor: cfg.color,
          flexShrink: 0,
          ...(cfg.animate && {
            animation: 'statusPulse 1.5s infinite',
            '@keyframes statusPulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.3 },
            },
          }),
        }}
      />
      <Typography
        sx={{
          fontSize: size === 'medium' ? 11 : 10,
          fontWeight: 700,
          color: cfg.color,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          lineHeight: 1,
        }}
      >
        {cfg.label}
      </Typography>
    </Box>
  );
}

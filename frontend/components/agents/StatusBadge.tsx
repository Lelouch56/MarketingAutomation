import { Chip } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

interface Props {
  status: string;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<
  string,
  { color: 'default' | 'warning' | 'success' | 'error'; label: string }
> = {
  idle:      { color: 'default',  label: 'Idle' },
  running:   { color: 'warning',  label: 'Running' },
  completed: { color: 'success',  label: 'Completed' },
  failed:    { color: 'error',    label: 'Failed' },
};

export default function StatusBadge({ status, size = 'small' }: Props) {
  const config = STATUS_CONFIG[status] ?? { color: 'default' as const, label: status };

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      icon={
        <FiberManualRecordIcon
          sx={{ fontSize: '8px !important', ml: '4px !important' }}
        />
      }
      sx={{ fontWeight: 600, letterSpacing: '0.01em' }}
    />
  );
}

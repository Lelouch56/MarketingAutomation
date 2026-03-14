import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  Chip,
  Typography,
  Box,
} from '@mui/material';
import { LogEntry } from '../../types';

interface Props {
  logs: LogEntry[];
}

const LEVEL_COLORS: Record<string, 'info' | 'warning' | 'error' | 'default'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
};

const AGENT_LABELS: Record<string, string> = {
  agent1: 'Content & SEO',
  agent2: 'Lead Qual.',
  agent3: 'Email Campaign',
  agent4: 'Analytics',
};

export default function LogsTable({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No logs yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Run an agent to see activity appear here.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px', overflow: 'hidden' }}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Level</TableCell>
            <TableCell>Agent</TableCell>
            <TableCell>Message</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} hover sx={{ '&:hover': { bgcolor: 'rgba(23,84,207,0.03)' } }}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: 10 }}>
                  {new Date(log.timestamp).toLocaleDateString()}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={log.level}
                  size="small"
                  sx={{
                    textTransform: 'capitalize',
                    fontWeight: 700,
                    fontSize: 10.5,
                    borderRadius: '100px',
                    ...(log.level === 'info' && { bgcolor: 'rgba(2,136,209,0.1)', color: '#0288D1' }),
                    ...(log.level === 'warning' && { bgcolor: 'rgba(237,108,2,0.1)', color: '#ED6C02' }),
                    ...(log.level === 'error' && { bgcolor: 'rgba(211,47,47,0.1)', color: '#D32F2F' }),
                  }}
                />
              </TableCell>
              <TableCell>
                {log.agent_id ? (
                  <Chip
                    label={AGENT_LABELS[log.agent_id] ?? log.agent_id}
                    size="small"
                    sx={{ fontSize: 10.5, bgcolor: 'rgba(23,84,207,0.08)', color: 'primary.main', fontWeight: 600, borderRadius: '100px' }}
                  />
                ) : (
                  <Typography variant="caption" color="text.disabled">—</Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ maxWidth: 500, wordBreak: 'break-word', fontSize: 13 }}>
                  {log.message}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

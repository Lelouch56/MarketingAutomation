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
    <TableContainer component={Paper} elevation={0} variant="outlined">
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
            <TableRow key={log.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ display: 'block', fontSize: 10 }}
                >
                  {new Date(log.timestamp).toLocaleDateString()}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={log.level}
                  color={LEVEL_COLORS[log.level] ?? 'default'}
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                />
              </TableCell>
              <TableCell>
                {log.agent_id ? (
                  <Chip
                    label={AGENT_LABELS[log.agent_id] ?? log.agent_id}
                    size="small"
                    sx={{ fontSize: 11 }}
                  />
                ) : (
                  <Typography variant="caption" color="text.disabled">—</Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ maxWidth: 500, wordBreak: 'break-word' }}>
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

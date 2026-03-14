'use client';

import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  Button,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '../../components/agents/StatusBadge';
import { globalApi, extractApiError } from '../../services/api';
import { AgentMeta } from '../../types';

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    setError('');
    globalApi
      .getAgents()
      .then(setAgents)
      .catch((err) => setError(extractApiError(err) || 'Could not connect to backend. Make sure the server is running.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          All Agents
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage and monitor all 4 marketing automation agents
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: '1px solid rgba(23,84,207,0.1)', borderRadius: '12px', overflow: 'hidden' }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Agent</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell>Steps</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Run</TableCell>
                <TableCell>Availability</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id} hover sx={{ '&:hover': { bgcolor: 'rgba(23,84,207,0.03)' } }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {agent.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {agent.description.slice(0, 60)}…
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{agent.type}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={agent.schedule} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{agent.steps_count}</Typography>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={agent.status} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {agent.last_run
                        ? new Date(agent.last_run).toLocaleString()
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={agent.implemented ? 'Live' : 'Coming Soon'}
                      size="small"
                      sx={agent.implemented
                        ? { bgcolor: 'rgba(5,150,105,0.1)', color: '#059669', fontWeight: 700, fontSize: 11, borderRadius: '100px' }
                        : { bgcolor: 'rgba(100,116,139,0.1)', color: '#64748b', fontWeight: 600, fontSize: 11, borderRadius: '100px' }
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      onClick={() => router.push(`/agents/${agent.id}`)}
                      disabled={!agent.implemented}
                    >
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

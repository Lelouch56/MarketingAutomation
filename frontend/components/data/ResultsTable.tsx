import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  Chip,
  Link,
  Typography,
  Box,
  Tooltip,
} from '@mui/material';

export interface Column {
  key: string;
  label: string;
  type?: 'text' | 'badge' | 'link' | 'score' | 'date' | 'truncate' | 'analysis' | 'tooltip';
}

interface Props {
  columns: Column[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
}

const BADGE_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  // Lead categories
  Hot: 'error',
  Warm: 'warning',
  Cold: 'default',
  // Topic / agent statuses
  Published: 'success',
  Pending: 'default',
  Processing: 'warning',
  Failed: 'error',
  // Verdicts
  APPROVED: 'success',
  REJECTED: 'error',
  // Analysis status (agent2)
  completed: 'success',
  skipped: 'default',
  failed: 'error',
  // Enrollment status (agent2 Outplay / Klenty / HubSpot)
  Enrolled: 'success',
  'Not enrolled': 'default',
  Added: 'warning',
  // Topic source (agent1)
  web_scrape: 'info',
};

function CellValue({ value, type, row }: { value: unknown; type?: string; row?: Record<string, unknown> }) {
  if (value == null || value === '') {
    return <Typography variant="caption" color="text.disabled">—</Typography>;
  }

  const str = String(value);

  switch (type) {
    case 'badge':
      // Boolean values → "Demo" (orange) or "Real" (green) chips
      if (typeof value === 'boolean') {
        return value ? (
          <Chip label="Demo" size="small" color="warning" variant="outlined" sx={{ fontWeight: 600 }} />
        ) : (
          <Chip label="Real" size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} />
        );
      }
      return (
        <Chip
          label={str}
          color={BADGE_COLORS[str] ?? 'default'}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );

    case 'link':
      return (
        <Link href={str} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 13 }}>
          {str.replace('https://', '').slice(0, 40)}
          {str.length > 40 ? '…' : ''}
        </Link>
      );

    case 'score': {
      const n = Number(value);
      if (isNaN(n)) return <Typography variant="caption">—</Typography>;
      const color = n > 70 ? 'success' : n > 40 ? 'warning' : 'error';
      return (
        <Chip
          label={`${n}/100`}
          color={color}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      );
    }

    case 'date':
      try {
        return (
          <Typography variant="caption">
            {new Date(str).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Typography>
        );
      } catch {
        return <Typography variant="caption">{str}</Typography>;
      }

    case 'truncate':
      return (
        <Typography
          variant="body2"
          sx={{
            maxWidth: 300,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={str}
        >
          {str}
        </Typography>
      );

    case 'tooltip':
      return (
        <Tooltip
          title={
            <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {str}
            </Typography>
          }
          placement="left"
          arrow
          componentsProps={{
            tooltip: {
              sx: {
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 3,
                maxWidth: 380,
              },
            },
            arrow: { sx: { color: 'background.paper' } },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              maxWidth: 260,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'help',
              textDecoration: 'underline dotted',
              textUnderlineOffset: 3,
            }}
          >
            {str}
          </Typography>
        </Tooltip>
      );

    case 'analysis': {
      const signals = Array.isArray(row?.signals) ? (row.signals as string[]) : [];
      const concerns = Array.isArray(row?.concerns) ? (row.concerns as string[]) : [];
      const website = row?.website ? String(row.website) : null;
      const analysisStatus = row?.analysis_status ? String(row.analysis_status) : null;
      const score = row?.score != null ? Number(row.score) : null;
      const companyType = row?.company_type ? String(row.company_type).replace(/_/g, ' ') : null;

      const tooltipContent = (
        <Box sx={{ maxWidth: 380, p: 0.5 }}>
          {/* Website + analysis status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>🌐 Website:</Typography>
            <Typography variant="caption">{website || 'Not provided'}</Typography>
            {analysisStatus && (
              <Chip
                label={analysisStatus}
                size="small"
                color={BADGE_COLORS[analysisStatus] ?? 'default'}
                sx={{ height: 16, fontSize: 10 }}
              />
            )}
          </Box>
          {/* Score + company type */}
          {(score != null || companyType) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              {score != null && (
                <Chip
                  label={`Score: ${score}/100`}
                  size="small"
                  color={score > 70 ? 'success' : score > 40 ? 'warning' : 'error'}
                  variant="outlined"
                  sx={{ height: 18, fontSize: 11 }}
                />
              )}
              {companyType && (
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                  {companyType}
                </Typography>
              )}
            </Box>
          )}
          {/* Full reasoning */}
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            📝 Analysis
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, lineHeight: 1.5 }}>
            {str}
          </Typography>
          {/* Signals */}
          {signals.length > 0 && (
            <>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.light', display: 'block', mb: 0.5 }}>
                ✅ Signals
              </Typography>
              <Box sx={{ mb: 1 }}>
                {signals.map((s, i) => (
                  <Typography key={i} variant="caption" sx={{ display: 'block', pl: 1.5 }}>
                    • {s}
                  </Typography>
                ))}
              </Box>
            </>
          )}
          {/* Concerns */}
          {concerns.length > 0 && (
            <>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.light', display: 'block', mb: 0.5 }}>
                ⚠️ Concerns
              </Typography>
              <Box>
                {concerns.map((c, i) => (
                  <Typography key={i} variant="caption" sx={{ display: 'block', pl: 1.5 }}>
                    • {c}
                  </Typography>
                ))}
              </Box>
            </>
          )}
        </Box>
      );

      return (
        <Tooltip
          title={tooltipContent}
          placement="left"
          arrow
          componentsProps={{
            tooltip: {
              sx: {
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 3,
                maxWidth: 420,
              },
            },
            arrow: { sx: { color: 'background.paper' } },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'help',
              textDecoration: 'underline dotted',
              textUnderlineOffset: 3,
            }}
          >
            {str}
          </Typography>
        </Tooltip>
      );
    }

    default:
      return <Typography variant="body2">{str}</Typography>;
  }
}

export default function ResultsTable({ columns, rows, emptyMessage }: Props) {
  if (rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage ?? 'No data yet.'}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} hover>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  <CellValue value={row[col.key]} type={col.type} row={row} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

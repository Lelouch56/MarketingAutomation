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
} from '@mui/material';

export interface Column {
  key: string;
  label: string;
  type?: 'text' | 'badge' | 'link' | 'score' | 'date' | 'truncate';
}

interface Props {
  columns: Column[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
}

const BADGE_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  // Categories
  Hot: 'error',
  Warm: 'warning',
  Cold: 'default',
  // Statuses
  Published: 'success',
  Pending: 'default',
  Processing: 'warning',
  Failed: 'error',
  // Verdicts
  APPROVED: 'success',
  REJECTED: 'error',
};

function CellValue({ value, type }: { value: unknown; type?: string }) {
  if (value == null || value === '') {
    return <Typography variant="caption" color="text.disabled">—</Typography>;
  }

  const str = String(value);

  switch (type) {
    case 'badge':
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
                  <CellValue value={row[col.key]} type={col.type} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

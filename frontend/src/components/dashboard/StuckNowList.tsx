import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Link,
} from '@mui/material';
import type { StuckPr } from '@/types/dashboard';

function formatWait(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 24) {
    return `${(hours / 24).toFixed(1)}d`;
  }
  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  }
  return `${Math.round(seconds / 60)}m`;
}

export function StuckNowList({ items }: { items: StuckPr[] }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Stuck now
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing is waiting.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>PR</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Waiting on</TableCell>
                <TableCell align="right">Open for</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((pr) => (
                <TableRow key={`${pr.repo}#${pr.number}`}>
                  <TableCell>
                    <Link href={pr.url} target="_blank" rel="noopener" underline="hover">
                      #{pr.number}
                    </Link>{' '}
                    {pr.title}
                  </TableCell>
                  <TableCell>{pr.authorLogin}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={pr.waitingOn}
                      color={pr.waitingOn === 'reviewer' ? 'warning' : 'default'}
                    />
                    {pr.requestedReviewers.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {pr.requestedReviewers.join(', ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color={pr.slaBreached ? 'error' : 'text.primary'}>
                      {formatWait(pr.waitingSeconds)}
                      {pr.slaBreached ? ' ⚠' : ''}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import type { ReviewerLoad } from '@/types/dashboard';

export function FairnessChart({ loads }: { loads: ReviewerLoad[] }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Review load by reviewer
        </Typography>
        {loads.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No reviews recorded yet.
          </Typography>
        ) : (
          <BarChart
            height={Math.max(160, loads.length * 32)}
            layout="horizontal"
            yAxis={[{ scaleType: 'band', data: loads.map((l) => l.login) }]}
            xAxis={[{ label: 'reviews' }]}
            series={[{ label: 'Reviews', data: loads.map((l) => l.reviewCount) }]}
          />
        )}
      </CardContent>
    </Card>
  );
}

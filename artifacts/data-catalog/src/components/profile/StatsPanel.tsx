import React from 'react';
import { Box, Typography } from '@mui/material';
import { ColumnProfile } from '../../types/profile';
import { profileTokens } from './profileTokens';

interface StatRowProps {
  label: string;
  value: React.ReactNode;
}

const StatRow: React.FC<StatRowProps> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.65 }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.primary" dir="ltr">
      {value}
    </Typography>
  </Box>
);

const StatDivider = () => (
  <Box sx={{ height: '1px', bgcolor: profileTokens.color.border, my: 0.75 }} />
);

interface StatsPanelProps {
  column: ColumnProfile;
}

/**
 * Renders the correct stat block based on which stats object is present.
 * Falls back to an empty-state message when no stats apply.
 */
const StatsPanel: React.FC<StatsPanelProps> = ({ column }) => {
  const { numeric_stats, string_stats, datetime_stats } = column;

  if (numeric_stats) {
    const q = numeric_stats.quartiles;
    return (
      <Box>
        <StatRow label="ממוצע"       value={numeric_stats.avg?.toFixed(2) ?? '—'} />
        <StatRow label="סטיית תקן"   value={numeric_stats.stdDev?.toFixed(2) ?? '—'} />
        <StatDivider />
        <StatRow label="מינימום"     value={numeric_stats.min?.toFixed(2) ?? '—'} />
        {q && q.length === 3 && (
          <>
            <StatRow label="רבעון תחתון" value={q[0]?.toFixed(2) ?? '—'} />
            <StatRow label="חציון"       value={q[1]?.toFixed(2) ?? '—'} />
            <StatRow label="רבעון עליון" value={q[2]?.toFixed(2) ?? '—'} />
          </>
        )}
        <StatRow label="מקסימום"     value={numeric_stats.max?.toFixed(2) ?? '—'} />
      </Box>
    );
  }

  if (string_stats) {
    return (
      <Box>
        <StatRow label="אורך ממוצע"   value={string_stats.avg_length?.toFixed(2) ?? '—'} />
        <StatRow label="אורך מינימלי" value={string_stats.min_length ?? '—'} />
        <StatRow label="אורך מקסימלי" value={string_stats.max_length ?? '—'} />
      </Box>
    );
  }

  if (datetime_stats) {
    return (
      <Box>
        <StatRow
          label="תאריך מוקדם"
          value={datetime_stats.min ? new Date(datetime_stats.min).toLocaleString('he-IL') : '—'}
        />
        <StatRow
          label="תאריך מאוחר"
          value={datetime_stats.max ? new Date(datetime_stats.max).toLocaleString('he-IL') : '—'}
        />
        {datetime_stats.format && (
          <StatRow label="פורמט" value={datetime_stats.format} />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 80 }}>
      <Typography variant="body2" color="text.disabled">
        אין סטטיסטיקות נוספות עבור סוג נתונים זה
      </Typography>
    </Box>
  );
};

export default StatsPanel;

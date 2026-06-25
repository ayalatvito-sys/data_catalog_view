import React from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import { ColumnProfile } from './types';
import { profileTokens, getNullnessTone } from './profileTokens';
import MetricBar from './MetricBar';
import StatsPanel from './StatsPanel';
import TopValuesPanel from './TopValuesPanel';

interface ColumnCardProps {
  column: ColumnProfile;
}

const ColumnCard: React.FC<ColumnCardProps> = ({ column }) => {
  const nullness = column.nullness || 0;
  const uniqueness = column.uniqueness || 0;
  const tone = getNullnessTone(nullness);

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: profileTokens.color.surface,
        border: '1px solid #dadce0',
        borderRadius: 2, // ~12px, matches DatasetCard
        overflow: 'hidden',
        // Same recipe as DatasetCard: transparent accent edge that reveals on hover,
        // soft diffuse shadow instead of a hard border, gentle lift.
        borderInlineStart: `4px solid transparent`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderInlineStartColor: tone.main,
          boxShadow: '0 4px 6px rgba(32,33,36,0.1)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          p: { xs: 2.5, md: 3 },
          gap: { xs: 3, md: 4 },
        }}
      >
        {/* Identity + headline metrics */}
        <Box sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1} flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={600} color="text.primary">
              {column.column_name}
            </Typography>
          </Box>

          {column.data_type !== 'UNKNOWN' && (
            <Chip
              label={column.data_type}
              size="small"
              variant="outlined"
              sx={{ mb: 2.5, fontWeight: 500 }}
            />
          )}

          <MetricBar
            label="ערכים חסרים"
            value={nullness}
            color={tone.main}
            tooltip={`רמת שלמות הנתונים: ${tone.label}`}
          />
          <MetricBar
            label="ייחודיות"
            value={uniqueness}
            color={profileTokens.color.accent}
            tooltip="אחוז הערכים השונים מתוך כל הערכים בעמודה"
          />
        </Box>

        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

        {/* Stats */}
        <Box sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', mb: 1.5 }}
          >
            סטטיסטיקות
          </Typography>
          <StatsPanel column={column} />
        </Box>

        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

        {/* Top values */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', mb: 1.5 }}
          >
            ערכים נפוצים
          </Typography>
          <TopValuesPanel values={column.top_n} />
        </Box>
      </Box>
    </Box>
  );
};

export default ColumnCard;
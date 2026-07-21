import React from 'react';
import { Box, Typography } from '@mui/material';
import { TopNValue } from '../../types/profile';
import { profileTokens } from './profileTokens';

interface TopValuesPanelProps {
  values: TopNValue[];
}

/**
 * Frequency-distribution bar chart for the top N categorical values.
 * Each bar is scaled relative to the highest-percentage value in the slice.
 */
const TopValuesPanel: React.FC<TopValuesPanelProps> = ({ values }) => {
  if (!values || values.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 80,
        }}
      >
        <Typography variant="body2" color="text.disabled">
          לא נמצאו נתונים קטגוריאליים
        </Typography>
      </Box>
    );
  }

  const top = values.slice(0, 6);
  const maxPct = Math.max(...top.map((v) => v.percentage || 0), 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {top.map((item, idx) => {
        const pct = item.percentage || 0;
        const relativeWidth = (pct / maxPct) * 100;

        return (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Value label — truncated with ellipsis */}
            <Typography
              variant="body2"
              title={item.value || 'ריק'}
              sx={{
                width: 92,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'text.primary',
              }}
            >
              {item.value || '(ריק)'}
            </Typography>

            {/* Proportional bar */}
            <Box
              sx={{
                flex: 1,
                height: 8,
                borderRadius: 1,
                bgcolor: profileTokens.color.track,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${relativeWidth}%`,
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  opacity: 0.35 + 0.65 * (pct / maxPct),
                  transition: 'width 0.3s ease-in-out',
                }}
              />
            </Box>

            {/* Percentage label */}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                width: 42,
                textAlign: 'left',
                color: 'text.primary',
                flexShrink: 0,
              }}
            >
              {pct.toFixed(1)}%
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default TopValuesPanel;

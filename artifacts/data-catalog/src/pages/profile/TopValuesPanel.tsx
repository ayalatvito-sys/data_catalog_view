import React from 'react';
import { Box, Typography } from '@mui/material';
import { TopNValue } from './types';
import { profileTokens } from './profileTokens';

interface TopValuesPanelProps {
  values: TopNValue[];
}

const TopValuesPanel: React.FC<TopValuesPanelProps> = ({ values }) => {
  if (!values || values.length === 0) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100%" minHeight={80}>
        <Typography variant="body2" color="text.disabled">
          לא נמצאו נתונים קטגוריאליים
        </Typography>
      </Box>
    );
  }

  const top = values.slice(0, 6);
  const maxPct = Math.max(...top.map((v) => v.percentage || 0), 1);

  return (
    <Box display="flex" flexDirection="column" gap={1.25}>
      {top.map((item, idx) => {
        const pct = item.percentage || 0;
        return (
          <Box key={idx} display="flex" alignItems="center" gap={1.5}>
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
            <Box sx={{ flex: 1, height: 8, borderRadius: 1, bgcolor: profileTokens.color.track, overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${(pct / maxPct) * 100}%`,
                  bgcolor: profileTokens.color.accent,
                  borderRadius: 1,
                  opacity: 0.45 + 0.55 * (pct / maxPct),
                  transition: 'width 0.3s ease-in-out',
                }}
              />
            </Box>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ width: 42, textAlign: 'left', color: 'text.primary', flexShrink: 0 }}
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
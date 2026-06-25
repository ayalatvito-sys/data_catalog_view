import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { profileTokens } from './profileTokens';

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
  tooltip: string;
}

// A single labeled progress metric, used for Nullness and Uniqueness.
const MetricBar: React.FC<MetricBarProps> = ({ label, value, color, tooltip }) => {
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Box mb={2}>
        <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.5}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: profileTokens.color.ink }}>
            {value.toFixed(1)}%
          </Typography>
        </Box>
        <Box
          sx={{
            position: 'relative',
            height: 6,
            borderRadius: 3,
            bgcolor: profileTokens.color.track,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              insetInlineEnd: 0, // RTL-aware: fill grows from the right
              top: 0,
              height: '100%',
              width: `${Math.min(Math.max(value, 0), 100)}%`,
              bgcolor: color,
              borderRadius: 3,
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </Box>
      </Box>
    </Tooltip>
  );
};

export default MetricBar;
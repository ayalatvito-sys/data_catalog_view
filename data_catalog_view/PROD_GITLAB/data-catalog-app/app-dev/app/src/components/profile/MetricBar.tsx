import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { profileTokens } from './profileTokens';

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
  tooltip: string;
}

/**
 * Labeled progress metric used for Nullness and Uniqueness.
 * RTL-aware: the fill grows from the inline-end (right in Hebrew/Arabic).
 */
const MetricBar: React.FC<MetricBarProps> = ({ label, value, color, tooltip }) => (
  <Tooltip title={tooltip} arrow placement="top">
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: profileTokens.color.ink }}
        >
          {value.toFixed(1)}%
        </Typography>
      </Box>

      {/* Track */}
      <Box
        sx={{
          position: 'relative',
          height: 6,
          borderRadius: 3,
          bgcolor: profileTokens.color.track,
          overflow: 'hidden',
        }}
      >
        {/* Fill — insetInlineEnd anchors the fill to the RTL start (right) side */}
        <Box
          sx={{
            position: 'absolute',
            insetInlineEnd: 0,
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

export default MetricBar;

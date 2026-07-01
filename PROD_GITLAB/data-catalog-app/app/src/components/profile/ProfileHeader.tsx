import React from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'; // RTL: "back" points right
import { profileTokens } from './profileTokens';

interface ProfileHeaderProps {
  tableId: string;
  datasetId?: string;
  scannedRows?: number;
  columnCount: number;
  onBack: () => void;
}

/**
 * Page-level header for the Table Profile view.
 * Matches the AppBar + title pattern used in CatalogPage and DatasetPage:
 *  – white surface, #dadce0 border
 *  – Heebo 600 heading, text.secondary metadata row
 *  – primary.main accent on interactive elements
 *  – Roboto Mono for the table identifier (mirrors DatasetCard's dataset_id)
 */
const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  tableId,
  datasetId,
  scannedRows,
  columnCount,
  onBack,
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 2,
      mb: 4,
      pb: 3,
      borderBottom: `1px solid ${profileTokens.color.border}`,
    }}
  >
    {/* Back button — styled identically to DatasetPage's AppBar back button */}
    <IconButton
      onClick={onBack}
      aria-label="חזרה"
      sx={{
        bgcolor: profileTokens.color.surface,
        border: `1px solid ${profileTokens.color.border}`,
        borderRadius: 2,
        width: 40,
        height: 40,
        mt: 0.5,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: profileTokens.color.accentSoft,
          borderColor: 'primary.main',
        },
      }}
    >
      <ArrowForwardIcon fontSize="small" color="action" />
    </IconButton>

    {/* Title + meta */}
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            fontFamily: profileTokens.font.mono,
          }}
        >
          {tableId}
        </Typography>
        <Chip
          label={`${columnCount} עמודות`}
          size="small"
          variant="outlined"
          color="primary"
          sx={{ fontWeight: 500 }}
        />
      </Box>

      {/* Metadata row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
        {datasetId && (
          <>
            <Typography variant="body2" color="text.secondary">
              {datasetId}
            </Typography>
            <Box
              sx={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                bgcolor: 'text.disabled',
              }}
            />
          </>
        )}
        <Typography variant="body2" color="text.secondary">
          נסרקו{' '}
          <Box
            component="span"
            sx={{ fontWeight: 600, color: 'text.primary' }}
          >
            {scannedRows?.toLocaleString('he-IL') ?? 'N/A'}
          </Box>{' '}
          שורות
        </Typography>
      </Box>
    </Box>
  </Box>
);

export default ProfileHeader;

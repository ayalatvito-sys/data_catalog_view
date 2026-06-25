import React from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'; // RTL: "back" points right

interface ProfileHeaderProps {
  tableId: string;
  datasetId?: string;
  scannedRows?: number;
  columnCount: number;
  onBack: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  tableId,
  datasetId,
  scannedRows,
  columnCount,
  onBack,
}) => {
  return (
    <Box display="flex" alignItems="flex-start" gap={2} mb={5}>
      <IconButton
        onClick={onBack}
        aria-label="חזרה"
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #dadce0',
          borderRadius: 2,
          width: 40,
          height: 40,
          mt: 0.5,
          transition: 'all 0.2s ease-in-out',
          '&:hover': { bgcolor: '#e8f0fe', borderColor: 'primary.main' },
        }}
      >
        <ArrowForwardIcon fontSize="small" color="action" />
      </IconButton>

      <Box flex={1}>
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          <Typography variant="h5" fontWeight={600} color="text.primary">
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

        <Box display="flex" alignItems="center" gap={1} mt={0.75}>
          <Typography variant="body2" color="text.secondary">
            {datasetId || 'ללא מערך נתונים'}
          </Typography>
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            נסרקו <Box component="span" fontWeight={600} color="text.primary">{scannedRows?.toLocaleString() ?? 'N/A'}</Box> שורות
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ProfileHeader;
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { TableChart, Place, Event } from '@mui/icons-material';
import { Dataset } from '@workspace/api-client-react';

interface DatasetCardProps {
  dataset: Dataset;
}

export default function DatasetCard({ dataset }: DatasetCardProps) {
  return (
    <Card 
      elevation={0}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #dadce0',
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        borderRight: '4px solid transparent', // Left border highlight in RTL is borderRight
        '&:hover': {
          borderRightColor: 'primary.main',
          boxShadow: '0 4px 6px rgba(32,33,36,0.1)',
          transform: 'translateY(-2px)'
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column' }}>
        <Typography 
          variant="subtitle1" 
          component="h2" 
          dir="ltr"
          sx={{ 
            fontFamily: '"Roboto Mono", monospace', 
            fontWeight: 500,
            mb: 1,
            color: '#1a73e8',
            textAlign: 'left'
          }}
        >
          {dataset.dataset_id}
        </Typography>
        
        <Typography 
          variant="body2" 
          color={dataset.description_he ? 'text.primary' : 'text.disabled'}
          sx={{ mb: 3, minHeight: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {dataset.description_he || 'אין תיאור'}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 'auto' }}>
          <Chip 
            icon={<TableChart fontSize="small" />} 
            label={`${dataset.tables_count} טבלאות`}
            size="small"
            variant="outlined"
            sx={{ direction: 'rtl' }}
          />
          <Chip 
            icon={<Place fontSize="small" />} 
            label={dataset.location}
            size="small"
            variant="outlined"
          />
          <Chip 
            icon={<Event fontSize="small" />} 
            label={new Date(dataset.created_at).toLocaleDateString('he-IL')}
            size="small"
            variant="outlined"
          />
        </Box>
      </CardContent>
    </Card>
  );
}

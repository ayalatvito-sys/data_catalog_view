import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Typography, Box, Chip,
  Tooltip, Dialog, DialogTitle, DialogContent, IconButton
} from '@mui/material';
import { TableChart, Place, Update, Close, InfoOutlined } from '@mui/icons-material';
import { Dataset } from '@workspace/api-client-react';

interface DatasetCardProps {
  dataset: Dataset & { last_modified?: string | null };
}

export default function DatasetCard({ dataset }: DatasetCardProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const hasDesc = !!dataset.description_he;

  const displayDate = dataset.last_modified
    ? new Date(dataset.last_modified).toLocaleDateString('he-IL')
    : new Date(dataset.created_at).toLocaleDateString('he-IL');

  const dateLabel = dataset.last_modified ? 'עודכן' : 'נוצר';

  return (
    <>
      <Card
        elevation={0}
        onClick={() => navigate(`/dataset/${dataset.dataset_id}`)}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #dadce0',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          borderRight: '4px solid transparent',
          '&:hover': {
            borderRightColor: 'primary.main',
            boxShadow: '0 4px 6px rgba(32,33,36,0.1)',
            transform: 'translateY(-2px)',
          },
        }}
      >
        <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column' }}>

          <Tooltip title={dataset.dataset_id} placement="top" arrow>
            <Typography
              variant="subtitle1"
              component="h2"
              dir="ltr"
              sx={{
                fontFamily: '"Roboto Mono", monospace',
                fontWeight: 500,
                mb: 1,
                color: '#1a73e8',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {dataset.dataset_id}
            </Typography>
          </Tooltip>

          <Box sx={{ mb: 3, minHeight: 48, position: 'relative' }}>
            <Typography
              variant="body2"
              color={hasDesc ? 'text.primary' : 'text.disabled'}
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                pr: hasDesc ? 3 : 0,
              }}
            >
              {dataset.description_he || 'אין תיאור'}
            </Typography>

            {hasDesc && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                sx={{ position: 'absolute', top: -4, left: 0, color: 'text.secondary' }}
                title="קרא תיאור מלא"
              >
                <InfoOutlined fontSize="small" />
              </IconButton>
            )}
          </Box>

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
            <Tooltip title={dateLabel} arrow>
              <Chip
                icon={<Update fontSize="small" />}
                label={displayDate}
                size="small"
                variant="outlined"
                color={dataset.last_modified ? 'primary' : 'default'}
                sx={{ opacity: dataset.last_modified ? 1 : 0.7 }}
              />
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontFamily='"Roboto Mono", monospace' color="primary">
            {dataset.dataset_id}
          </Typography>
          <IconButton onClick={() => setOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {dataset.description_he && (
            <Typography variant="body1" sx={{ mb: 2 }}>
              {dataset.description_he}
            </Typography>
          )}
          {dataset.description && (
            <Typography variant="body2" color="text.secondary" dir="ltr">
              {dataset.description}
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
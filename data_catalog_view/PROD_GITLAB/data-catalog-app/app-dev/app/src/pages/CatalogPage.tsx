import { useEffect, useState } from 'react';
import {
  Container, Box, Typography, TextField, MenuItem, Select,
  FormControl, InputLabel, Grid, Skeleton, Alert, Button,
  IconButton, AppBar, Toolbar, Chip, CircularProgress, Tooltip,
  Badge,
} from '@mui/material';
import { Search, Refresh, ErrorOutlined, Timeline } from '@mui/icons-material';
import {
  useListDatasets,
  getListDatasetsQueryKey,
  useGetCatalogStats,
  getGetCatalogStatsQueryKey
} from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import StatsBar from '../components/StatsBar';
import DatasetCard from '../components/DatasetCard';
import { useRefresh } from '../contexts/RefreshContext';
import PipelineStatusDrawer, { PIPELINE_STATUS_QUERY_KEY } from '../components/PipelineStatusDrawer';
import { fetchPipelineStatuses } from '../services/pipelineService';

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'tables_count'>('name');
  const [pipelineDrawerOpen, setPipelineDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { registerHardRefresh, triggerHardRefresh, isRefreshing } = useRefresh();

  // Pre-fetch pipeline statuses so the badge count is always available
  const { data: pipelineData } = useQuery({
    queryKey: PIPELINE_STATUS_QUERY_KEY,
    queryFn: () => fetchPipelineStatuses(false),
  });

  const failedCount = pipelineData?.pipelines.filter(
    (p) =>
      p.current_status?.toUpperCase() === 'FAILED' ||
      p.current_status?.toUpperCase() === 'FAILURE',
  ).length ?? 0;

  const { data: statsData } = useGetCatalogStats({
    query: { queryKey: getGetCatalogStatsQueryKey() }
  });

  const queryParams = {
    search: search || undefined,
    sort_by: sortBy,
    sort_dir: (sortBy === 'tables_count' ? 'desc' : 'asc') as 'asc' | 'desc'
  };

  const { data, isLoading, isError, refetch } = useListDatasets(
    queryParams,
    {
      query: {
        queryKey: getListDatasetsQueryKey(queryParams)
      }
    }
  );

  // Register the hard-refresh handler for this page.
  // Uses queryClient.clear() to wipe ALL cached entries reliably (avoids
  // guessing the generated URL-based query key structure).
  useEffect(() => {
    registerHardRefresh(async () => {
      // 1. Bypass backend cache for all endpoints (including pipelines)
      await Promise.allSettled([
        fetch(`/api/datasets?refresh=true`),
        fetch(`/api/catalog/stats?refresh=true`),
        fetch(`/api/pipelines/status?refresh=true`),
      ]);
      // 2. Wipe React Query cache so active queries refetch automatically
      queryClient.clear();
    });
  }, [registerHardRefresh, queryClient]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #dadce0' }}>
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 'bold', color: '#202124' }}>
            קטלוג נתונים
          </Typography>
          {statsData?.project_id && (
            <Chip label={`פרויקט: ${statsData.project_id}`} sx={{ ml: 2 }} variant="outlined" />
          )}

          {/* Pipeline status button */}
          <Tooltip title="סטטוס תהליכים נתונים">
            <IconButton
              onClick={() => setPipelineDrawerOpen(true)}
              color={failedCount > 0 ? 'error' : 'default'}
              sx={{ ml: 0.5 }}
              aria-label="פתח פאנל סטטוס תהליכים"
            >
              <Badge
                badgeContent={failedCount > 0 ? failedCount : undefined}
                color="error"
                max={99}
              >
                <Timeline />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="רענן נתונים מ-GCP">
            <span>
              <IconButton
                onClick={triggerHardRefresh}
                color="primary"
                disabled={isRefreshing || isLoading}
              >
                {isRefreshing ? <CircularProgress size={20} /> : <Refresh />}
              </IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <PipelineStatusDrawer
        open={pipelineDrawerOpen}
        onClose={() => setPipelineDrawerOpen(false)}
      />

      <Container maxWidth="xl" sx={{ mt: 4, mb: 8, flexGrow: 1 }}>
        <StatsBar />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 4, alignItems: { xs: 'stretch', md: 'center' } }}>
          <TextField
            fullWidth
            placeholder="חיפוש מאגרי נתונים..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <Search color="action" sx={{ ml: 1, mr: -0.5 }} />,
              }
            }}
            size="small"
            sx={{ flexGrow: 1, maxWidth: { md: 400 }, backgroundColor: '#fff' }}
          />

          <FormControl size="small" sx={{ minWidth: 200, backgroundColor: '#fff' }}>
            <InputLabel id="sort-select-label">מיון לפי</InputLabel>
            <Select
              labelId="sort-select-label"
              value={sortBy}
              label="מיון לפי"
              onChange={(e) => setSortBy(e.target.value as 'name' | 'tables_count')}
            >
              <MenuItem value="name">שם</MenuItem>
              <MenuItem value="tables_count">מספר טבלאות</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {isError ? (
          <Alert
            severity="error"
            icon={<ErrorOutlined />}
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                נסה שוב
              </Button>
            }
          >
            אירעה שגיאה בטעינת הנתונים. אנא ודא שה-API פועל ושנקבעו הרשאות GCP.
          </Alert>
        ) : isLoading ? (
          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={n}>
                <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : data?.datasets.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10, px: 2, backgroundColor: '#fff', borderRadius: 2, border: '1px dashed #dadce0' }}>
            <Search sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'text.secondary' }}>
              לא נמצאו מאגרי נתונים
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
              נסה לשנות את מילות החיפוש
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {data?.datasets.map((dataset) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={dataset.dataset_id}>
                <DatasetCard dataset={dataset} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}

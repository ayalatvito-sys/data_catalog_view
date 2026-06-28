import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, CircularProgress, Button,
  AppBar, Toolbar, IconButton, Tooltip
} from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileResponse } from '../types/profile';
import { fetchTableProfile } from '../services/profileService';
import ProfileHeader from '../components/profile/ProfileHeader';
import ColumnCard from '../components/profile/ColumnCard';
import { useRefresh } from '../contexts/RefreshContext';

const TableProfilePage: React.FC = () => {
  const { datasetId, tableId } = useParams<{ datasetId: string; tableId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerHardRefresh, triggerHardRefresh, isRefreshing } = useRefresh();

  const queryKey = ['tableProfile', datasetId, tableId];

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProfileResponse, Error>({
    queryKey,
    queryFn: () => fetchTableProfile(datasetId!, tableId!),
    enabled: Boolean(datasetId && tableId),
  });

  // Register the hard-refresh handler for this page
  useEffect(() => {
    registerHardRefresh(async () => {
      // 1. Remove React Query cache entry for this profile
      queryClient.removeQueries({ queryKey });
      // 2. Refetch with ?refresh=true to bypass backend cache
      await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchTableProfile(datasetId!, tableId!, true),
      });
    });
  }, [registerHardRefresh, queryClient, datasetId, tableId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 2,
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={28} thickness={4} color="primary" />
        <Typography variant="body2" color="text.secondary">
          טוען פרופיל נתונים…
        </Typography>
      </Box>
    );
  }

  // ── Error / empty ──────────────────────────────────────────────────────────
  if (isError || !profile) {
    return (
      <Container maxWidth="sm" dir="rtl" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600, mb: 1 }}>
          לא ניתן להציג את פרופיל הנתונים
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error?.message || 'ודא שתהליך פרופיל הנתונים הסתיים בהצלחה ב-GCP.'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
          sx={{
            borderColor: 'divider',
            color: 'text.primary',
            textTransform: 'none',
            borderRadius: 2,
            '&:hover': { borderColor: 'primary.main', bgcolor: '#e8f0fe' },
          }}
        >
          חזרה
        </Button>
      </Container>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Toolbar with back + refresh */}
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #dadce0', bgcolor: '#fff' }}>
        <Toolbar>
          <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ fontFamily: '"Roboto Mono", monospace', color: '#1a73e8', fontWeight: 700, flexGrow: 1 }}>
            {datasetId}.{tableId}
          </Typography>
          <Tooltip title="רענן נתוני פרופיל מ-GCP">
            <span>
              <IconButton
                color="primary"
                disabled={isRefreshing || isLoading}
                onClick={triggerHardRefresh}
              >
                {isRefreshing ? <CircularProgress size={20} /> : <Refresh />}
              </IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 5 }} dir="rtl">
        <ProfileHeader
          tableId={profile.table_id}
          datasetId={datasetId}
          scannedRows={profile.scanned_rows}
          columnCount={profile.columns.length}
          onBack={() => navigate(-1)}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {profile.columns.map((col) => (
            <ColumnCard key={col.column_name} column={col} />
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default TableProfilePage;

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, CircularProgress, Button } from '@mui/material';
import { ProfileResponse } from '../types/profile';
import { fetchTableProfile } from '../services/profileService';
import ProfileHeader from '../components/profile/ProfileHeader';
import ColumnCard from '../components/profile/ColumnCard';

const TableProfilePage: React.FC = () => {
  const { datasetId, tableId } = useParams<{ datasetId: string; tableId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard: params are guaranteed by the router pattern, but handle defensively
    if (!datasetId || !tableId) {
      setError('פרמטרים חסרים בכתובת ה-URL');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchTableProfile(datasetId, tableId)
      .then((data) => setProfile(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [datasetId, tableId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
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
  if (error || !profile) {
    return (
      <Container maxWidth="sm" dir="rtl" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600, mb: 1 }}>
          לא ניתן להציג את פרופיל הנתונים
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error || 'ודא שתהליך פרופיל הנתונים הסתיים בהצלחה ב-GCP.'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
          sx={{
            borderColor: 'divider',
            color: 'text.primary',
            textTransform: 'none',
            borderRadius: 2,
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: '#e8f0fe',
            },
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

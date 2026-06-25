import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, CircularProgress, Button } from '@mui/material';
import { ProfileResponse } from './profile/types';
import ProfileHeader from './profile/ProfileHeader';
import ColumnCard from './profile/ColumnCard';

const TableProfilePage: React.FC = () => {
  const { datasetId, tableId } = useParams<{ datasetId: string; tableId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data fetching logic — unchanged from the original implementation.
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/datasets/${datasetId}/tables/${tableId}/profile`);
        if (!response.ok) throw new Error('שגיאה בשליפת פרופיל הנתונים');
        const data = await response.json();
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [datasetId, tableId]);

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="60vh"
        gap={2}
        sx={{ bgcolor: '#f8f9fa' }}
      >
        <CircularProgress size={28} thickness={4} color="primary" />
        <Typography variant="body2" color="text.secondary">
          טוען פרופיל נתונים…
        </Typography>
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Container maxWidth="sm" dir="rtl" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
          לא ניתן להציג את פרופיל הנתונים
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error || 'ודא שתהליך פרופיל הנתונים הסתיים בהצלחה ב-GCP.'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
          sx={{ borderColor: '#dadce0', color: 'text.primary', textTransform: 'none', borderRadius: 2 }}
        >
          חזרה
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 5 }} dir="rtl">
        <ProfileHeader
          tableId={profile.table_id}
          datasetId={datasetId}
          scannedRows={profile.scanned_rows}
          columnCount={profile.columns.length}
          onBack={() => navigate(-1)}
        />

        <Box display="flex" flexDirection="column" gap={2}>
          {profile.columns.map((col) => (
            <ColumnCard key={col.column_name} column={col} />
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default TableProfilePage;
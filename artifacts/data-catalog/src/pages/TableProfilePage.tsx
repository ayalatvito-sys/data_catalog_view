import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
  Tooltip,
  Paper
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// --- הגדרות הטיפוסים (תואם בדיוק ל-Backend שלנו) ---
interface TopNValue {
  value: string;
  percentage?: number;
  count?: number;
}

interface NumericStats {
  min?: number;
  max?: number;
  avg?: number;
  stdDev?: number;
  median?: number;
}

interface ColumnProfile {
  column_name: string;
  nullness: number;
  uniqueness: number;
  top_n: TopNValue[];
  numeric_stats?: NumericStats;
}

interface ProfileResponse {
  table_id: string;
  scanned_rows?: number;
  columns: ColumnProfile[];
}

const TableProfilePage: React.FC = () => {
  const { datasetId, tableId } = useParams<{ datasetId: string; tableId: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // שימי לב לעדכן את נתיב ה-API לכתובת האמיתית של השרת שלך
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

  // פונקציית עזר לבחירת צבע לבר ה-Nulls (הרבה ריקים = אדום/אזהרה)
  const getNullnessColor = (percent: number) => {
    if (percent > 50) return 'error';
    if (percent > 20) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Container>
        <Typography color="error" variant="h6">
          {error || 'לא נמצאו נתונים'}
        </Typography>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>חזור</Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }} dir="rtl">
      {/* כותרת העמוד וניווט חזרה */}
      <Box display="flex" alignItems="center" mb={4}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            פרופיל נתונים: {profile.table_id}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Dataset: {datasetId} | נסרקו {profile.scanned_rows?.toLocaleString() || 'N/A'} שורות
          </Typography>
        </Box>
      </Box>

      {/* גריד הכרטיסיות של העמודות */}
      <Grid container spacing={3}>
        {profile.columns.map((col) => (
          <Grid item xs={12} md={6} lg={4} key={col.column_name}>
            <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent>
                {/* שם העמודה */}
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {col.column_name}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                {/* מדדי אחוזים (Progress Bars) */}
                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" color="text.secondary">ערכים חסרים (Nulls)</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {(col.nullness * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <Tooltip title="אחוז השורות שבהן אין מידע בעמודה זו">
                    <LinearProgress 
                      variant="determinate" 
                      value={col.nullness * 100} 
                      color={getNullnessColor(col.nullness * 100)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Tooltip>
                </Box>

                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" color="text.secondary">ייחודיות (Uniqueness)</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {(col.uniqueness * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <Tooltip title="אחוז הערכים השונים מתוך כלל הערכים">
                    <LinearProgress 
                      variant="determinate" 
                      value={col.uniqueness * 100} 
                      color="primary"
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Tooltip>
                </Box>

                {/* נתונים סטטיסטיים לנומרי (יוצג רק אם קיים) */}
                {col.numeric_stats && (
                  <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>סטטיסטיקות מספרים:</Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">מינימום</Typography>
                        <Typography variant="body2">{col.numeric_stats.min?.toFixed(2) || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">מקסימום</Typography>
                        <Typography variant="body2">{col.numeric_stats.max?.toFixed(2) || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">ממוצע</Typography>
                        <Typography variant="body2">{col.numeric_stats.avg?.toFixed(2) || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">חציון</Typography>
                        <Typography variant="body2">{col.numeric_stats.median?.toFixed(2) || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                )}

                {/* ערכים נפוצים (Top N) */}
                {col.top_n && col.top_n.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>ערכים נפוצים ביותר:</Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {col.top_n.slice(0, 5).map((item, idx) => (
                        <Chip 
                          key={idx}
                          label={`${item.value || 'ריק'} (${(item.percentage! * 100).toFixed(1)}%)`}
                          size="small"
                          variant="outlined"
                          sx={{ bgcolor: 'action.hover' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default TableProfilePage;
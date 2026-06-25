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
  IconButton,
  Divider,
  CircularProgress,
  Paper
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

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
  quartiles?: number[];
}

interface StringStats {
  min_length?: number;
  max_length?: number;
  avg_length?: number;
}

interface DatetimeStats {
  min?: string;
  max?: string;
  format?: string;
}

interface ColumnProfile {
  column_name: string;
  data_type: string;
  nullness: number;
  uniqueness: number;
  top_n: TopNValue[];
  numeric_stats?: NumericStats;
  string_stats?: StringStats;
  datetime_stats?: DatetimeStats;
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

  const getNullnessColor = (percent: number) => {
    if (percent > 50) return 'error';
    if (percent > 10) return 'warning';
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
      <Container dir="rtl">
        <Typography color="error" variant="h6" mt={4}>
          {error || 'לא נמצאו נתונים. ודא שפרופיל הנתונים הסתיים בהצלחה ב-GCP.'}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }} dir="rtl">
      {/* כותרת עליונה */}
      <Box display="flex" alignItems="center" mb={4}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 2, bgcolor: 'background.paper', boxShadow: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary.main">
            {profile.table_id}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Dataset: {datasetId} | נסרקו {profile.scanned_rows?.toLocaleString() || 'N/A'} שורות
          </Typography>
        </Box>
      </Box>

      {/* רשימת העמודות - כל עמודה מקבלת שורה רחבה משלה */}
      <Box display="flex" flexDirection="column" gap={3}>
        {profile.columns.map((col) => (
          <Card key={col.column_name} elevation={2} sx={{ borderRadius: 2, overflow: 'visible' }}>
            <CardContent sx={{ p: 3 }}>
              <Grid container spacing={4}>
                
                {/* בלוק 1: שם העמודה, סוג נתונים ומדדי אחוזים */}
                <Grid item xs={12} md={3}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="h6" fontWeight="bold">
                      {col.column_name}
                    </Typography>
                    {col.data_type !== 'UNKNOWN' && (
                      <Chip label={col.data_type} size="small" color="default" sx={{ fontWeight: 'medium' }} />
                    )}
                  </Box>
                  <Divider sx={{ mb: 2, width: '70%' }} />
                  
                  <Box mb={3}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" color="text.secondary">ערכים חסרים (Nulls)</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {col.nullness.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={col.nullness} 
                      color={getNullnessColor(col.nullness)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Box>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" color="text.secondary">ייחודיות (Uniqueness)</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {col.uniqueness.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={col.uniqueness} 
                      color="primary"
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                </Grid>

                {/* בלוק 2: סטטיסטיקות דינאמיות לפי סוג הנתונים */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    סטטיסטיקות
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50', minHeight: '140px' }}>
                    <Box display="flex" flexDirection="column" gap={1}>
                      
                      {/* תצוגה למספרים */}
                      {col.numeric_stats && (
                        <>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">ממוצע</Typography>
                            <Typography variant="body2" fontWeight="medium">{col.numeric_stats.avg?.toFixed(2) || '-'}</Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">סטיית תקן</Typography>
                            <Typography variant="body2" fontWeight="medium">{col.numeric_stats.stdDev?.toFixed(2) || '-'}</Typography>
                          </Box>
                          <Divider sx={{ my: 0.5 }} />
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">מינימום</Typography>
                            <Typography variant="body2" fontWeight="medium">{col.numeric_stats.min?.toFixed(2) || '-'}</Typography>
                          </Box>
                          {col.numeric_stats.quartiles && col.numeric_stats.quartiles.length === 3 && (
                            <>
                              <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">רבעון תחתון</Typography>
                                <Typography variant="body2" fontWeight="medium">{col.numeric_stats.quartiles[0]?.toFixed(2) || '-'}</Typography>
                              </Box>
                              <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">חציון</Typography>
                                <Typography variant="body2" fontWeight="medium">{col.numeric_stats.quartiles[1]?.toFixed(2) || '-'}</Typography>
                              </Box>
                              <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">רבעון עליון</Typography>
                                <Typography variant="body2" fontWeight="medium">{col.numeric_stats.quartiles[2]?.toFixed(2) || '-'}</Typography>
                              </Box>
                            </>
                          )}
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">מקסימום</Typography>
                            <Typography variant="body2" fontWeight="medium">{col.numeric_stats.max?.toFixed(2) || '-'}</Typography>
                          </Box>
                        </>
                      )}

                      {/* תצוגה למחרוזות (טקסט) */}
                      {col.string_stats && (
                        <>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">אורך ממוצע</Typography>
                            <Typography variant="body2" fontWeight="medium">{col.string_stats.avg_length?.toFixed(2) || '-'}</Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">אורך מינימלי</Typography>
                            <Typography variant="body2" fontWeight="medium">{col.string_stats.min_length || '-'}</Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">אורך מקסימלי</Typography>
                            <Typography variant="body2" fontWeight="medium">{col.string_stats.max_length || '-'}</Typography>
                          </Box>
                        </>
                      )}

                      {/* תצוגה לתאריכים */}
                      {col.datetime_stats && (
                        <>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" color="text.secondary">תאריך מוקדם ביותר</Typography>
                            <Typography variant="body2" fontWeight="medium" sx={{ direction: 'ltr' }}>
                              {col.datetime_stats.min ? new Date(col.datetime_stats.min).toLocaleString('he-IL') : '-'}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" color="text.secondary">תאריך מאוחר ביותר</Typography>
                            <Typography variant="body2" fontWeight="medium" sx={{ direction: 'ltr' }}>
                              {col.datetime_stats.max ? new Date(col.datetime_stats.max).toLocaleString('he-IL') : '-'}
                            </Typography>
                          </Box>
                          {col.datetime_stats.format && (
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2" color="text.secondary">פורמט מזוהה</Typography>
                              <Typography variant="body2" fontWeight="medium" sx={{ direction: 'ltr' }}>{col.datetime_stats.format}</Typography>
                            </Box>
                          )}
                        </>
                      )}

                      {/* אם אין סטטיסטיקות בכלל */}
                      {!col.numeric_stats && !col.string_stats && !col.datetime_stats && (
                        <Typography variant="body2" color="text.disabled" sx={{ mt: 1, textAlign: 'center' }}>
                          לא קיימות סטטיסטיקות נוספות לסוג נתונים זה.
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Grid>

                {/* בלוק 3: גרף ברים אופקי לערכים נפוצים */}
                <Grid item xs={12} md={5}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    ערכים נפוצים ביותר (Top Values)
                  </Typography>
                  {col.top_n && col.top_n.length > 0 ? (
                    <Box display="flex" flexDirection="column" gap={1.5} mt={1}>
                      {col.top_n.slice(0, 8).map((item, idx) => (
                        <Box key={idx} display="flex" alignItems="center">
                          {/* שם הערך */}
                          <Typography 
                            variant="body2" 
                            sx={{ width: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title={item.value || 'ריק'}
                          >
                            {item.value || '(ריק)'}
                          </Typography>
                          
                          {/* הבר עצמו */}
                          <Box sx={{ flexGrow: 1, mx: 2 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={item.percentage || 0} 
                              sx={{ height: 12, borderRadius: 1, bgcolor: 'grey.200' }}
                            />
                          </Box>
                          
                          {/* תווית האחוזים */}
                          <Typography variant="body2" sx={{ width: 45, textAlign: 'left', fontWeight: 'bold' }}>
                            {item.percentage?.toFixed(1)}%
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 2 }}>
                      לא נמצאו נתונים קטגוריאליים.
                    </Typography>
                  )}
                </Grid>

              </Grid>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Container>
  );
};

export default TableProfilePage;
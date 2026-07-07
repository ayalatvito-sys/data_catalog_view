import { Box, Card, CardContent, Typography, Skeleton, Grid } from '@mui/material';
import { Storage, TableChart, Update } from '@mui/icons-material';
import { useGetCatalogStats, getGetCatalogStatsQueryKey } from '@workspace/api-client-react';

export default function StatsBar() {
  const { data: stats, isLoading, isError } = useGetCatalogStats({
    query: { queryKey: getGetCatalogStatsQueryKey() }
  });

  if (isError) {
    return null;
  }

  const statItems = [
    {
      title: 'מאגרי נתונים',
      value: stats?.total_datasets ?? 0,
      icon: <Storage color="primary" />,
    },
    {
      title: 'סך הכל טבלאות',
      value: stats?.total_tables ?? 0,
      icon: <TableChart color="primary" />,
    },
    // "מיקומים" removed — all data resides in a single region
    {
      title: 'עודכן לאחרונה',
      value: stats?.last_updated
        ? new Date(stats.last_updated).toLocaleDateString('he-IL')
        : 'לא ידוע',
      icon: <Update color="primary" />,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      {statItems.map((item, index) => (
        <Grid size={{ xs: 12, sm: 4, md: 4 }} key={index}>
          <Card elevation={0} sx={{ border: '1px solid #dadce0', borderRadius: 2 }}>
            <CardContent sx={{ p: '16px !important' }}>
              {/* Title row */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {item.title}
              </Typography>

              {/* Value + icon row */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                {isLoading ? (
                  <Skeleton width={60} height={36} />
                ) : (
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#202124', lineHeight: 1 }}>
                    {item.value}
                  </Typography>
                )}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: '#e8f0fe',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

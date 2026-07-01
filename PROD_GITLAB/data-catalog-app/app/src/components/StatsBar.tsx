import { Box, Card, CardContent, Typography, Skeleton, Grid } from '@mui/material';
import { Storage, TableChart, Place, Update } from '@mui/icons-material';
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
    {
      title: 'מיקומים',
      value: stats?.locations_count ?? 0,
      icon: <Place color="primary" />,
    },
    {
      title: 'עודכן לאחרונה',
      value: stats?.last_updated ? new Date(stats.last_updated).toLocaleDateString('he-IL') : 'לא ידוע',
      icon: <Update color="primary" />,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      {statItems.map((item, index) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
          <Card elevation={0} sx={{ border: '1px solid #dadce0', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: '16px !important' }}>
              <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', backgroundColor: '#e8f0fe' }}>
                {item.icon}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {item.title}
                </Typography>
                {isLoading ? (
                  <Skeleton width={60} height={32} />
                ) : (
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#202124' }}>
                    {item.value}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

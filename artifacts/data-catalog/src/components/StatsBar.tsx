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
      icon: <Storage />,
    },
    {
      title: 'סך הכל טבלאות',
      value: stats?.total_tables ?? 0,
      icon: <TableChart />,
    },
    // "מיקומים" removed — all data resides in a single region
    {
      title: 'עודכן לאחרונה',
      value: stats?.last_updated
        ? new Date(stats.last_updated).toLocaleDateString('he-IL')
        : 'לא ידוע',
      icon: <Update />,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      {statItems.map((item, index) => (
        <Grid size={{ xs: 12, sm: 4, md: 4 }} key={index}>
          <Card elevation={0} sx={{ border: '1px solid #dadce0', borderRadius: 2 }}>
            {/*
              RTL layout:
              - paddingRight anchors content firmly to the right edge
              - title and value+icon row both use flex-start (= visual right in RTL)
            */}
            <CardContent sx={{ p: '10px 14px 10px 14px !important', pr: '24px !important' }}>

              {/* Title — right-aligned, sits directly above the value/icon pair */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'right', mb: 0.75, fontWeight: 500, lineHeight: 1.3 }}
              >
                {item.title}
              </Typography>

              {/* Value (left) + Icon (right) — row-reverse pushes icon to the right visually */}
              <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>

                {/* Icon — second in DOM, but row-reverse places it on the visual right */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    backgroundColor: '#e8f0fe',
                    flexShrink: 0,
                    color: '#1a73e8',
                    '& .MuiSvgIcon-root': { fontSize: 16 },
                  }}
                >
                  {item.icon}
                </Box>

                {/* Value — first in DOM, row-reverse places it to the left of the icon */}
                {isLoading ? (
                  <Skeleton width={48} height={26} />
                ) : (
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 700, color: '#202124', lineHeight: 1 }}
                  >
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

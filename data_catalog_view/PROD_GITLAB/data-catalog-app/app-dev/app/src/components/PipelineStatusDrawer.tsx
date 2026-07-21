/**
 * PipelineStatusDrawer
 *
 * A slide-in Drawer showing pipeline execution statuses grouped by environment.
 * Integrates with React Query (24 h cache, same policy as the rest of the app)
 * and with RefreshContext so the global Refresh button also invalidates this data.
 */

import { useCallback, useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Skeleton,
  Alert,
  Tooltip,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Close,
  Timeline,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  Sync,
  FiberManualRecord,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPipelineStatuses, type PipelineStatus } from '../services/pipelineService';

// ─── Constants ────────────────────────────────────────────────────────────────

export const PIPELINE_STATUS_QUERY_KEY = ['pipelines', 'status'] as const;

const DRAWER_WIDTH = 400;

// ─── Status styling ───────────────────────────────────────────────────────────

interface StatusStyle {
  color: string;
  bg: string;
  icon: React.ReactElement;
  label: string;
}

function getStatusStyle(status: string | null): StatusStyle {
  const s = (status ?? '').toUpperCase();
  switch (s) {
    case 'SUCCESS':
    case 'SUCCEEDED':
      return {
        color: '#fff',
        bg: '#1e8e3e',
        icon: <CheckCircle sx={{ fontSize: 14 }} />,
        label: status ?? 'SUCCESS',
      };
    case 'FAILED':
    case 'FAILURE':
      return {
        color: '#fff',
        bg: '#d93025',
        icon: <ErrorIcon sx={{ fontSize: 14 }} />,
        label: status ?? 'FAILED',
      };
    case 'RUNNING':
    case 'IN_PROGRESS':
      return {
        color: '#fff',
        bg: '#1a73e8',
        icon: <Sync sx={{ fontSize: 14 }} />,
        label: status ?? 'RUNNING',
      };
    case 'PENDING':
    case 'WAITING':
      return {
        color: '#202124',
        bg: '#fdd663',
        icon: <HourglassEmpty sx={{ fontSize: 14 }} />,
        label: status ?? 'PENDING',
      };
    default:
      return {
        color: '#fff',
        bg: '#5f6368',
        icon: <FiberManualRecord sx={{ fontSize: 14 }} />,
        label: status ?? 'UNKNOWN',
      };
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const { color, bg, icon, label } = getStatusStyle(status);
  return (
    <Chip
      icon={<Box sx={{ color, display: 'flex', alignItems: 'center', pl: 0.5 }}>{icon}</Box>}
      label={label}
      size="small"
      sx={{
        backgroundColor: bg,
        color,
        fontWeight: 600,
        fontSize: '0.72rem',
        letterSpacing: 0.3,
        height: 24,
        '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
      }}
    />
  );
}

function PipelineItem({ pipeline }: { pipeline: PipelineStatus }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.25,
        px: 2,
        gap: 1,
        borderRadius: 1,
        transition: 'background-color 0.15s',
        '&:hover': { backgroundColor: '#f1f3f4' },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: '#202124',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {pipeline.pipeline_name ?? '—'}
        </Typography>
        <Typography variant="caption" sx={{ color: '#5f6368' }}>
          {formatDate(pipeline.as_of_date)}
        </Typography>
      </Box>
      <StatusBadge status={pipeline.current_status} />
    </Box>
  );
}

function EnvironmentSection({
  environment,
  pipelines,
}: {
  environment: string;
  pipelines: PipelineStatus[];
}) {
  const failedCount = pipelines.filter(
    (p) =>
      p.current_status?.toUpperCase() === 'FAILED' ||
      p.current_status?.toUpperCase() === 'FAILURE',
  ).length;

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* Environment header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          backgroundColor: '#f1f3f4',
          borderBottom: '1px solid #e8eaed',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <Typography
          variant="overline"
          sx={{
            fontWeight: 700,
            fontSize: '0.7rem',
            color: '#5f6368',
            letterSpacing: 1.2,
            lineHeight: 1,
            flex: 1,
          }}
        >
          {environment}
        </Typography>
        {failedCount > 0 && (
          <Chip
            label={`${failedCount} שגיאות`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: '#fce8e6',
              color: '#d93025',
            }}
          />
        )}
        <Chip
          label={pipelines.length}
          size="small"
          sx={{ height: 18, fontSize: '0.65rem', backgroundColor: '#e8eaed', color: '#5f6368' }}
        />
      </Box>

      {/* Pipeline items */}
      <Box>
        {pipelines.map((p, i) => (
          <Box key={`${p.pipeline_name}-${i}`}>
            <PipelineItem pipeline={p} />
            {i < pipelines.length - 1 && (
              <Divider sx={{ mx: 2, borderColor: '#f1f3f4' }} />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SkeletonList() {
  return (
    <Box sx={{ px: 2, pt: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={18} />
            <Skeleton variant="text" width="40%" height={14} />
          </Box>
          <Skeleton variant="rounded" width={72} height={24} />
        </Box>
      ))}
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PipelineStatusDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function PipelineStatusDrawer({ open, onClose }: PipelineStatusDrawerProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: PIPELINE_STATUS_QUERY_KEY,
    queryFn: () => fetchPipelineStatuses(false),
    enabled: open, // only fetch when drawer is visible
  });

  // Group pipelines by environment, preserving insertion order
  const grouped = useCallback(() => {
    if (!data?.pipelines) return [];
    const map = new Map<string, PipelineStatus[]>();
    for (const p of data.pipelines) {
      const env = p.environment ?? 'אחר';
      if (!map.has(env)) map.set(env, []);
      map.get(env)!.push(p);
    }
    return Array.from(map.entries()).map(([env, pipelines]) => ({ env, pipelines }));
  }, [data])();

  const totalFailed = data?.pipelines.filter(
    (p) =>
      p.current_status?.toUpperCase() === 'FAILED' ||
      p.current_status?.toUpperCase() === 'FAILURE',
  ).length ?? 0;

  const [refreshError, setRefreshError] = useState(false);

  const handleManualRefresh = async () => {
    try {
      await fetchPipelineStatuses(true); // bypass backend cache
      queryClient.invalidateQueries({ queryKey: PIPELINE_STATUS_QUERY_KEY });
    } catch {
      setRefreshError(true);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(32,33,36,0.45)' } },
        paper: {
          sx: {
            width: DRAWER_WIDTH,
            boxShadow: '0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      {/* ── Drawer header ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #dadce0',
          flexShrink: 0,
        }}
      >
        <Timeline sx={{ color: '#1a73e8', fontSize: 22 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#202124', lineHeight: 1.2 }}>
            סטטוס תהליכי נתונים
          </Typography>
          {data && (
            <Typography variant="caption" sx={{ color: '#5f6368' }}>
              {data.pipelines.length} תהליכים
              {totalFailed > 0 && (
                <Box component="span" sx={{ color: '#d93025', fontWeight: 600, ml: 0.5 }}>
                  · {totalFailed} נכשלו
                </Box>
              )}
            </Typography>
          )}
        </Box>

        {/* Manual refresh spinner */}
        {isFetching && !isLoading && (
          <CircularProgress size={18} thickness={4} sx={{ color: '#1a73e8' }} />
        )}

        <Tooltip title="רענן">
          <span>
            <IconButton
              size="small"
              onClick={handleManualRefresh}
              disabled={isFetching}
              aria-label="רענן סטטוס תהליכים"
            >
              <Sync fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: '#5f6368' }}
          aria-label="סגור"
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Drawer body ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {isLoading ? (
          <SkeletonList />
        ) : isError ? (
          <Box sx={{ px: 2, py: 3 }}>
            <Alert
              severity="error"
              action={
                <Chip
                  label="נסה שוב"
                  size="small"
                  onClick={() => refetch()}
                  sx={{ cursor: 'pointer' }}
                />
              }
            >
              שגיאה בטעינת הנתונים
            </Alert>
          </Box>
        ) : grouped.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: '#5f6368' }}>
            <Timeline sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
            <Typography variant="body2">אין נתוני תהליכים</Typography>
          </Box>
        ) : (
          grouped.map(({ env, pipelines }) => (
            <EnvironmentSection key={env} environment={env} pipelines={pipelines} />
          ))
        )}
      </Box>

      {/* ── Refresh error snackbar ── */}
      <Snackbar
        open={refreshError}
        autoHideDuration={4000}
        onClose={() => setRefreshError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setRefreshError(false)} sx={{ width: '100%' }}>
          שגיאה בביצוע הרענון
        </Alert>
      </Snackbar>
    </Drawer>
  );
}

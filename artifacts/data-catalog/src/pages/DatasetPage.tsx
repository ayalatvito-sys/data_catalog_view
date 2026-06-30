import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Chip, IconButton, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Alert, Tooltip, AppBar, Toolbar, Badge,
  Select, MenuItem
} from '@mui/material';
import {
  ArrowBack, TableChart, AccountTree, Circle,
  AttachMoney, LocationOn, Security, Refresh
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRefresh } from '../contexts/RefreshContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TableDetail {
  table_id: string;
  table_type: string;
  creation_time: string;
  row_count: number;
  size_bytes: number;
  last_modified: string;
  is_financial: boolean;
  financial_columns?: string;
  is_geographical: boolean;
  geographical_columns?: string;
  is_sensitive: boolean;
  sensitive_columns?: string;
  project_name: string;
  system_name?: string;
  project_manager?: string;
  characterization_link?: string;
}

interface Relationship {
  edge_id: string;
  source_dataset: string;
  source_table: string;
  target_dataset: string;
  target_table: string;
  relationship_type: string;
  confidence_score: number;
  description_edge: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return '#1e8e3e';
  if (score >= 0.5) return '#f9ab00';
  return '#d93025';
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchTables(datasetId: string, refresh = false): Promise<TableDetail[]> {
  const url = `/api/datasets/${datasetId}/tables${refresh ? '?refresh=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('שגיאה בטעינת טבלאות');
  const data = await res.json();
  return data.tables ?? [];
}

async function fetchRelationships(datasetId: string, refresh = false): Promise<Relationship[]> {
  const url = `/api/datasets/${datasetId}/relationships?min_confidence=0.5${refresh ? '&refresh=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.relationships ?? [];
}

// ─── Table Icons ──────────────────────────────────────────────────────────────
function TableIcons({ table }: { table: TableDetail }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {table.is_financial && (
        <Tooltip
          arrow
          title={
            <Box sx={{ p: 0.5, maxWidth: 250 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>נתונים פיננסיים</Typography>
              <Typography variant="caption" sx={{ color: '#e8eaed', display: 'block', lineHeight: 1.4 }}>
                <strong>עמודות:</strong> {table.financial_columns || 'לא צוין'}
              </Typography>
            </Box>
          }
        >
          <AttachMoney sx={{ fontSize: 18, color: '#1e8e3e', cursor: 'help' }} />
        </Tooltip>
      )}
      {table.is_geographical && (
        <Tooltip
          arrow
          title={
            <Box sx={{ p: 0.5, maxWidth: 250 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>נתונים גאוגרפיים</Typography>
              <Typography variant="caption" sx={{ color: '#e8eaed', display: 'block', lineHeight: 1.4 }}>
                <strong>עמודות:</strong> {table.geographical_columns || 'לא צוין'}
              </Typography>
            </Box>
          }
        >
          <LocationOn sx={{ fontSize: 18, color: '#1a73e8', cursor: 'help' }} />
        </Tooltip>
      )}
      {table.is_sensitive && (
        <Tooltip
          arrow
          title={
            <Box sx={{ p: 0.5, maxWidth: 250 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>נתונים רגישים (PII)</Typography>
              <Typography variant="caption" sx={{ color: '#e8eaed', display: 'block', lineHeight: 1.4 }}>
                <strong>עמודות:</strong> {table.sensitive_columns || 'לא צוין'}
              </Typography>
            </Box>
          }
        >
          <Security sx={{ fontSize: 18, color: '#d93025', cursor: 'help' }} />
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Force Graph ──────────────────────────────────────────────────────────────
interface GraphProps {
  datasetId: string;
  tables: TableDetail[];
  relationships: Relationship[];
}

function ForceGraph({ datasetId, tables, relationships }: GraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const tableSet = new Set(tables.map(t => `${datasetId}.${t.table_id}`));
    const nodeMap = new Map<string, { id: string; label: string; dataset: string; x: number; y: number; vx: number; vy: number; r: number }>();

    tables.forEach(t => {
      const id = `${datasetId}.${t.table_id}`;
      nodeMap.set(id, { id, label: t.table_id, dataset: datasetId, x: Math.random() * 600 + 100, y: Math.random() * 400 + 100, vx: 0, vy: 0, r: 28 });
    });

    relationships.forEach(rel => {
      const srcId = `${rel.source_dataset}.${rel.source_table}`;
      const tgtId = `${rel.target_dataset}.${rel.target_table}`;
      if (!nodeMap.has(srcId)) nodeMap.set(srcId, { id: srcId, label: rel.source_table, dataset: rel.source_dataset, x: Math.random() * 600 + 100, y: Math.random() * 400 + 100, vx: 0, vy: 0, r: 22 });
      if (!nodeMap.has(tgtId)) nodeMap.set(tgtId, { id: tgtId, label: rel.target_table, dataset: rel.target_dataset, x: Math.random() * 600 + 100, y: Math.random() * 400 + 100, vx: 0, vy: 0, r: 22 });
    });

    const nodes = [...nodeMap.values()];
    const edges = relationships.map(rel => ({
      source: `${rel.source_dataset}.${rel.source_table}`,
      target: `${rel.target_dataset}.${rel.target_table}`,
      confidence: rel.confidence_score,
    }));

    const W = canvas.width;
    const H = canvas.height;

    function simulate() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 4000 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }
      edges.forEach(e => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) return;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.03 * e.confidence;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      });
      nodes.forEach(n => {
        n.vx += (W / 2 - n.x) * 0.003;
        n.vy += (H / 2 - n.y) * 0.003;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x = Math.max(n.r + 10, Math.min(W - n.r - 10, n.x + n.vx));
        n.y = Math.max(n.r + 10, Math.min(H - n.r - 10, n.y + n.vy));
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      edges.forEach(e => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) return;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = e.confidence >= 0.8 ? 'rgba(30,142,62,0.5)' : 'rgba(249,171,0,0.5)';
        ctx.lineWidth = e.confidence >= 0.8 ? 2.5 : 1.5;
        ctx.stroke();
      });
      nodes.forEach(n => {
        const isOwn = tableSet.has(n.id);
        ctx.shadowColor = isOwn ? 'rgba(26,115,232,0.3)' : 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = isOwn ? 12 : 6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = isOwn ? '#1a73e8' : '#e8f0fe';
        ctx.fill();
        ctx.strokeStyle = isOwn ? '#1557b0' : '#c5cae9';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = isOwn ? '#fff' : '#3c4043';
        ctx.font = `${isOwn ? 'bold ' : ''}11px "Roboto Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxW = n.r * 2 - 8;
        let label = n.label;
        while (ctx.measureText(label).width > maxW && label.length > 4) label = label.slice(0, -1);
        if (label !== n.label) label += '…';
        ctx.fillText(label, n.x, n.y);
        if (!isOwn) {
          ctx.font = '9px sans-serif';
          ctx.fillStyle = '#5f6368';
          ctx.fillText(n.dataset, n.x, n.y + n.r + 10);
        }
      });
    }

    let running = true;
    function loop() {
      if (!running) return;
      simulate();
      draw();
      animRef.current = requestAnimationFrame(loop);
    }
    loop();

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < n.r);
      if (hit) {
        setTooltip({ x: e.clientX, y: e.clientY, text: `${hit.dataset}.${hit.label}` });
        canvas.style.cursor = 'pointer';
      } else {
        setTooltip(null);
        canvas.style.cursor = 'default';
      }
    };
    canvas.addEventListener('mousemove', onMove);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousemove', onMove);
    };
  }, [datasetId, tables, relationships]);

  return (
    <Box sx={{ position: 'relative' }}>
      <canvas ref={canvasRef} width={900} height={520}
        style={{ width: '100%', height: 'auto', borderRadius: 8, background: '#f8f9fa', display: 'block' }} />
      {tooltip && (
        <Box sx={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10,
          bgcolor: 'rgba(32,33,36,0.85)', color: '#fff', px: 1.5, py: 0.5,
          borderRadius: 1, fontSize: 12, fontFamily: 'monospace', pointerEvents: 'none', zIndex: 9999
        }}>
          {tooltip.text}
        </Box>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DatasetPage() {
  const { dataset_id } = useParams();
  const navigate = useNavigate();
  const datasetId = dataset_id ?? '';

  const [tab, setTab] = useState(0);
  const [activeProject, setActiveProject] = useState<string>('כללי');
  const [activeSystem, setActiveSystem] = useState<string>('הכל');

  const queryClient = useQueryClient();
  const { registerHardRefresh, triggerHardRefresh, isRefreshing } = useRefresh();

  // ── React Query: Tables ────────────────────────────────────────────────────
  const tablesQueryKey = ['tables', datasetId];
  const {
    data: tables = [],
    isLoading: loadingTables,
    isError: tablesError,
  } = useQuery<TableDetail[]>({
    queryKey: tablesQueryKey,
    queryFn: () => fetchTables(datasetId),
    enabled: Boolean(datasetId),
  });

  // ── React Query: Relationships ─────────────────────────────────────────────
  const relsQueryKey = ['relationships', datasetId];
  const {
    data: relationships = [],
    isLoading: loadingRels,
  } = useQuery<Relationship[]>({
    queryKey: relsQueryKey,
    queryFn: () => fetchRelationships(datasetId),
    enabled: Boolean(datasetId),
  });

  // ── Register hard-refresh handler ──────────────────────────────────────────
  useEffect(() => {
    registerHardRefresh(async () => {
      queryClient.removeQueries({ queryKey: tablesQueryKey });
      queryClient.removeQueries({ queryKey: relsQueryKey });
      await Promise.all([
        queryClient.fetchQuery({ queryKey: tablesQueryKey, queryFn: () => fetchTables(datasetId, true) }),
        queryClient.fetchQuery({ queryKey: relsQueryKey, queryFn: () => fetchRelationships(datasetId, true) }),
      ]);
    });
  }, [registerHardRefresh, queryClient, datasetId]);

  // ── Filtering logic (unchanged) ────────────────────────────────────────────
  const externalDatasets = [...new Set(
    relationships.flatMap(r => [r.source_dataset, r.target_dataset]).filter(d => d !== datasetId)
  )];

  const hasFinancial   = tables.some(t => t.is_financial);
  const hasGeographical = tables.some(t => t.is_geographical);
  const hasSensitive   = tables.some(t => t.is_sensitive);

  const uniqueProjects = [...new Set(tables.map(t => t.project_name || 'כללי'))];

  useEffect(() => {
    if (uniqueProjects.length > 0 && !uniqueProjects.includes(activeProject)) {
      setActiveProject(uniqueProjects[0]);
    }
  }, [tables, activeProject]);

  const projectTables  = tables.filter(t => (t.project_name || 'כללי') === activeProject);
  const uniqueSystems  = [...new Set(projectTables.map(t => t.system_name || 'לא הוגדר'))];

  useEffect(() => {
    setActiveSystem('הכל');
  }, [activeProject]);

  const finalDisplayedTables = activeSystem === 'הכל'
    ? projectTables
    : projectTables.filter(t => (t.system_name || 'לא הוגדר') === activeSystem);

  const displaySystemName = activeSystem !== 'הכל'
    ? activeSystem
    : (uniqueSystems.length === 1 ? uniqueSystems[0] : 'מספר מערכות');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #dadce0', bgcolor: '#fff' }}>
        <Toolbar>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 1 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ fontFamily: '"Roboto Mono", monospace', color: '#1a73e8', fontWeight: 700 }}>
            {datasetId}
          </Typography>

          {/* סיכום אייקוני ה-DS */}
          <Box sx={{ display: 'flex', gap: 0.5, mx: 2 }}>
            {hasFinancial    && <Tooltip title="מכיל נתונים פיננסיים"  arrow><AttachMoney sx={{ color: '#1e8e3e' }} /></Tooltip>}
            {hasGeographical && <Tooltip title="מכיל נתונים גאוגרפיים" arrow><LocationOn  sx={{ color: '#1a73e8' }} /></Tooltip>}
            {hasSensitive    && <Tooltip title="מכיל נתונים רגישים"    arrow><Security    sx={{ color: '#d93025' }} /></Tooltip>}
          </Box>

          <Box sx={{ flexGrow: 1 }} />
          {externalDatasets.length > 0 && (
            <Tooltip title={`מחובר ל: ${externalDatasets.join(', ')}`}>
              <Chip label={`${externalDatasets.length} datasets מחוברים`} size="small" color="primary" variant="outlined" sx={{ mr: 1 }} />
            </Tooltip>
          )}
          <Tooltip title="רענן נתונים מ-GCP">
            <span>
              <IconButton
                color="primary"
                disabled={isRefreshing || loadingTables}
                onClick={triggerHardRefresh}
              >
                {isRefreshing ? <CircularProgress size={20} /> : <Refresh />}
              </IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 4, pt: 3 }}>
        {tablesError && <Alert severity="error" sx={{ mb: 2 }}>שגיאה בטעינת טבלאות</Alert>}

        {/* <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #dadce0' }}>
          <Tab icon={<TableChart fontSize="small" />} iconPosition="start"
            label={<span>טבלאות {!loadingTables && <Badge badgeContent={tables.length} color="primary" sx={{ ml: 1 }} />}</span>} />
          <Tab icon={<AccountTree fontSize="small" />} iconPosition="start"
            label={<span>גרף קשרים {!loadingRels && <Badge badgeContent={relationships.length} color="secondary" sx={{ ml: 1 }} />}</span>} />
        </Tabs> */}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #dadce0' }}>
        
        {/* טאב טבלאות */}
        <Tab 
          icon={<TableChart fontSize="small" />} 
          iconPosition="start"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              <span>טבלאות</span>
              {!loadingTables && (
                <Box
                  sx={{
                    ml: 1.5, // הרווח מהטקסט (ב-RTL זה דוחף שמאלה)
                    bgcolor: 'primary.main', // צבע רקע כחול של MUI
                    color: 'white',
                    borderRadius: '12px', // עיגול הקצוות כדי ליצור צורת "גלולה"
                    px: 1, // ריפוד פנימי בצדדים כדי שהמספר לא יגע בדפנות
                    minWidth: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    lineHeight: 1,
                  }}
                >
                  {tables.length > 99 ? '99+' : tables.length}
                </Box>
              )}
            </Box>
          } 
        />

        {/* טאב גרף קשרים */}
        <Tab 
          icon={<AccountTree fontSize="small" />} 
          iconPosition="start"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              <span>גרף קשרים</span>
              {!loadingRels && (
                <Box
                  sx={{
                    ml: 1.5,
                    bgcolor: 'secondary.main', // צבע רקע סגול של MUI
                    color: 'white',
                    borderRadius: '12px',
                    px: 1,
                    minWidth: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    lineHeight: 1,
                  }}
                >
                  {relationships.length > 99 ? '99+' : relationships.length}
                </Box>
              )}
            </Box>
          } 
        />
      </Tabs>

        {/* Tab 0 — Tables */}
        {tab === 0 && (
          loadingTables
            ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            : <Box>
                {uniqueProjects.length > 1 && (
                  <Tabs
                    value={activeProject}
                    onChange={(_, newVal) => setActiveProject(newVal)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.875rem' } }}
                  >
                    {uniqueProjects.map(proj => (
                      <Tab key={proj} label={proj} value={proj} />
                    ))}
                  </Tabs>
                )}

                {finalDisplayedTables.length > 0 && (
                  <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #dadce0', borderRadius: 2, bgcolor: '#fff', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>שם פרויקט</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#202124', fontSize: '0.95rem', mt: 0.2 }}>
                        {finalDisplayedTables[0].project_name || 'כללי'}
                      </Typography>
                    </Box>

                    {uniqueSystems.length > 1 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>שם מערכת</Typography>
                        <Select
                          value={activeSystem}
                          onChange={(e) => setActiveSystem(e.target.value)}
                          variant="standard"
                          disableUnderline
                          sx={{
                            color: '#1a73e8',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            mt: 0.2,
                            '& .MuiSelect-select': { py: 0, pl: 3, pr: 0, display: 'flex', alignItems: 'center', backgroundColor: 'transparent !important' },
                            '& .MuiSvgIcon-root': { right: 'auto', left: 0, color: '#1a73e8' }
                          }}
                        >
                          <MenuItem value="הכל"><em>כל המערכות ({uniqueSystems.length})</em></MenuItem>
                          {uniqueSystems.map(sys => <MenuItem key={sys} value={sys}>{sys}</MenuItem>)}
                        </Select>
                      </Box>
                    ) : displaySystemName !== 'לא הוגדר' ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>שם מערכת</Typography>
                        <Typography variant="body2" sx={{ color: '#202124', fontSize: '0.95rem', mt: 0.2 }}>{displaySystemName}</Typography>
                      </Box>
                    ) : null}

                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>מנהל פרויקט</Typography>
                      <Typography variant="body2" sx={{ color: '#202124', fontSize: '0.95rem', mt: 0.2 }}>
                        {finalDisplayedTables[0].project_manager || 'לא הוגדר'}
                      </Typography>
                    </Box>

                    {finalDisplayedTables[0].characterization_link && (
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>אפיון</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.95rem', mt: 0.2 }}>
                          <a href={finalDisplayedTables[0].characterization_link} target="_blank" rel="noreferrer" style={{ color: '#1a73e8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            מסמך אפיון
                          </a>
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                )}

                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #dadce0', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                        <TableCell sx={{ fontWeight: 700 }}>שם טבלה</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>סוג</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">שורות</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">גודל</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>עדכון אחרון</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>סיווג</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {finalDisplayedTables.map(t => (
                        <TableRow key={t.table_id} hover>
                          <TableCell sx={{ fontFamily: '"Roboto Mono", monospace', fontSize: 13 }}>
                            <Box component="span"
                              onClick={() => navigate(`/datasets/${datasetId}/tables/${t.table_id}/profile`)}
                              sx={{ color: '#1a73e8', cursor: 'pointer', transition: 'color 0.2s ease', '&:hover': { color: '#1557b0' } }}
                            >
                              {t.table_id}
                            </Box>
                          </TableCell>
                          <TableCell><Chip label={t.table_type} size="small" variant="outlined" /></TableCell>
                          <TableCell align="right">{t.row_count?.toLocaleString('he-IL') ?? '—'}</TableCell>
                          <TableCell align="right">{t.size_bytes ? formatBytes(t.size_bytes) : '—'}</TableCell>
                          <TableCell sx={{ color: '#5f6368', fontSize: 12 }}>
                            {t.last_modified ? new Date(t.last_modified).toLocaleDateString('he-IL') : '—'}
                          </TableCell>
                          <TableCell><TableIcons table={t} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
        )}

        {/* Tab 1 — Graph */}
        {tab === 1 && (
          loadingRels
            ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            : relationships.length === 0
              ? <Alert severity="info">לא נמצאו קשרים עם confidence ≥ 0.5</Alert>
              : <Box>
                  <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                    {[['#1e8e3e', 'גבוה (≥0.8)'], ['#f9ab00', 'בינוני (0.5–0.8)']].map(([color, label]) => (
                      <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Circle sx={{ color, fontSize: 12 }} />
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#1a73e8' }} />
                      <Typography variant="caption" color="text.secondary">טבלאות ב-{datasetId}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#e8f0fe', border: '1px solid #c5cae9' }} />
                      <Typography variant="caption" color="text.secondary">טבלאות חיצוניות</Typography>
                    </Box>
                  </Box>

                  <ForceGraph datasetId={datasetId} tables={tables} relationships={relationships} />

                  <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: '#5f6368' }}>
                    כל הקשרים ({relationships.length})
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #dadce0', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                          <TableCell sx={{ fontWeight: 700 }}>מקור</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>יעד</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>סוג</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="center">confidence</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {relationships.map(r => (
                          <TableRow key={r.edge_id} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                              <Typography variant="caption" color="text.secondary">{r.source_dataset}.</Typography>
                              {r.source_table}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                              <Typography variant="caption" color="text.secondary">{r.target_dataset}.</Typography>
                              {r.target_table}
                            </TableCell>
                            <TableCell><Chip label={r.relationship_type} size="small" variant="outlined" /></TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <Circle sx={{ color: confidenceColor(r.confidence_score), fontSize: 10 }} />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                  {(r.confidence_score * 100).toFixed(0)}%
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
        )}
      </Box>
    </Box>
  );
}

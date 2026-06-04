import { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  Box, Typography, Chip, IconButton, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Alert, Tooltip, AppBar, Toolbar, Badge
} from '@mui/material';
import {
  ArrowBack, TableChart, AccountTree, Circle
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TableDetail {
  table_id: string;
  table_type: string;
  creation_time: string;
  row_count: number;
  size_bytes: number;
  last_modified: string;
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

    // Build nodes
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
      // Repulsion
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
      // Attraction along edges
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
      // Center gravity
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

      // Edges
      edges.forEach(e => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) return;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = e.confidence >= 0.8 ? 'rgba(30,142,62,0.5)' : e.confidence >= 0.5 ? 'rgba(249,171,0,0.5)' : 'rgba(217,48,37,0.3)';
        ctx.lineWidth = e.confidence >= 0.8 ? 2.5 : 1.5;
        ctx.stroke();
      });

      // Nodes
      nodes.forEach(n => {
        const isMain = n.dataset === datasetId;
        const isOwn = tableSet.has(n.id);

        // Shadow
        ctx.shadowColor = isOwn ? 'rgba(26,115,232,0.3)' : 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = isOwn ? 12 : 6;

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = isOwn ? '#1a73e8' : isMain ? '#4285f4' : '#e8f0fe';
        ctx.fill();
        ctx.strokeStyle = isOwn ? '#1557b0' : '#c5cae9';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = isOwn ? '#fff' : '#3c4043';
        ctx.font = `${isOwn ? 'bold ' : ''}11px "Roboto Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxW = n.r * 2 - 8;
        let label = n.label;
        while (ctx.measureText(label).width > maxW && label.length > 4) {
          label = label.slice(0, -1);
        }
        if (label !== n.label) label += '…';
        ctx.fillText(label, n.x, n.y);

        // Dataset badge for external nodes
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

    // Tooltip on hover
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
  const [, params] = useRoute('/dataset/:dataset_id');
  const [, navigate] = useLocation();
  const datasetId = params?.dataset_id ?? '';

  const [tab, setTab] = useState(0);
  const [tables, setTables] = useState<TableDetail[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRels, setLoadingRels] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    setLoadingTables(true);
    fetch(`/api/datasets/${datasetId}/tables`)
      .then(r => r.json())
      .then(d => { setTables(d.tables ?? []); setLoadingTables(false); })
      .catch(() => { setError('שגיאה בטעינת טבלאות'); setLoadingTables(false); });

    setLoadingRels(true);
    fetch(`/api/datasets/${datasetId}/relationships?min_confidence=0.5`)
      .then(r => r.json())
      .then(d => { setRelationships(d.relationships ?? []); setLoadingRels(false); })
      .catch(() => { setLoadingRels(false); });
  }, [datasetId]);

  const externalDatasets = [...new Set(
    relationships.flatMap(r => [r.source_dataset, r.target_dataset]).filter(d => d !== datasetId)
  )];

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
          <Box sx={{ flexGrow: 1 }} />
          {externalDatasets.length > 0 && (
            <Tooltip title={`מחובר ל: ${externalDatasets.join(', ')}`}>
              <Chip label={`${externalDatasets.length} datasets מחוברים`} size="small" color="primary" variant="outlined" />
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 4, pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #dadce0' }}>
          <Tab icon={<TableChart fontSize="small" />} iconPosition="start"
            label={<span>טבלאות {!loadingTables && <Badge badgeContent={tables.length} color="primary" sx={{ ml: 1 }} />}</span>} />
          <Tab icon={<AccountTree fontSize="small" />} iconPosition="start"
            label={<span>גרף קשרים {!loadingRels && <Badge badgeContent={relationships.length} color="secondary" sx={{ ml: 1 }} />}</span>} />
        </Tabs>

        {/* Tab 0 — Tables */}
        {tab === 0 && (
          loadingTables ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box> :
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #dadce0', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>שם טבלה</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>סוג</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">שורות</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">גודל</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>עדכון אחרון</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tables.map(t => (
                  <TableRow key={t.table_id} hover>
                    <TableCell sx={{ fontFamily: '"Roboto Mono", monospace', fontSize: 13, color: '#1a73e8' }}>
                      {t.table_id}
                    </TableCell>
                    <TableCell><Chip label={t.table_type} size="small" variant="outlined" /></TableCell>
                    <TableCell align="right">{t.row_count?.toLocaleString('he-IL') ?? '—'}</TableCell>
                    <TableCell align="right">{t.size_bytes ? formatBytes(t.size_bytes) : '—'}</TableCell>
                    <TableCell sx={{ color: '#5f6368', fontSize: 12 }}>
                      {t.last_modified ? new Date(t.last_modified).toLocaleDateString('he-IL') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Tab 1 — Graph */}
        {tab === 1 && (
          loadingRels ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box> :
          relationships.length === 0 ? (
            <Alert severity="info">לא נמצאו קשרים עם confidence ≥ 0.5</Alert>
          ) : (
            <Box>
              {/* Legend */}
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

              {/* Relationships list */}
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
          )
        )}
      </Box>
    </Box>
  );
}
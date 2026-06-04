import { Router, type IRouter } from "express";
import { BigQuery } from "@google-cloud/bigquery";
import { listDatasets, getDataset, getProjectId } from "../lib/bigquery";

const router: IRouter = Router();
const bq = new BigQuery();

// GET /api/datasets
router.get("/datasets", async (req, res) => {
  try {
    let datasets = await listDatasets();

    const { search, sort_by, sort_dir } = req.query as {
      search?: string;
      sort_by?: "name" | "tables_count";
      sort_dir?: "asc" | "desc";
    };

    if (search) {
      const q = search.toLowerCase();
      datasets = datasets.filter((d) =>
        d.dataset_id.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q)
      );
    }

    const field = sort_by ?? "name";
    const dir = sort_dir ?? "asc";
    datasets.sort((a, b) => {
      const av = field === "tables_count" ? a.tables_count : a.dataset_id;
      const bv = field === "tables_count" ? b.tables_count : b.dataset_id;
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });

    res.json({ datasets, total: datasets.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/datasets/:dataset_id
router.get("/datasets/:dataset_id", async (req, res) => {
  try {
    const ds = await getDataset(req.params.dataset_id);
    if (!ds) return res.status(404).json({ error: "Dataset not found" });
    res.json(ds);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/datasets/:dataset_id/tables
router.get("/datasets/:dataset_id/tables", async (req, res) => {
  try {
    const { dataset_id } = req.params;
    const projectId = getProjectId();
    const query = `
      SELECT
        table_id,
        table_type,
        CAST(creation_time AS STRING) as creation_time,
        row_count,
        size_bytes,
        CAST(last_modified AS STRING) as last_modified
      FROM \`${projectId}.dataplex_insights_outputs.insights_table_details\`
      WHERE dataset_id = @dataset_id
      ORDER BY table_id
    `;
    const [rows] = await bq.query({ query, params: { dataset_id } });
    res.json({ tables: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/datasets/:dataset_id/relationships
router.get("/datasets/:dataset_id/relationships", async (req, res) => {
  try {
    const { dataset_id } = req.params;
    const min_confidence = parseFloat((req.query.min_confidence as string) ?? "0.5");
    const projectId = getProjectId();
    const query = `
      SELECT
        edge_id,
        source_dataset,
        source_table,
        target_dataset,
        target_table,
        relationship_type,
        confidence_score,
        description_edge,
        CAST(last_updated AS STRING) as last_updated
      FROM \`${projectId}.dataplex_insights_outputs.insights_relationship_edges\`
      WHERE (source_dataset = @dataset_id OR target_dataset = @dataset_id)
        AND confidence_score >= @min_confidence
      ORDER BY confidence_score DESC
    `;
    const [rows] = await bq.query({ query, params: { dataset_id, min_confidence } });
    res.json({ relationships: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/catalog/stats
router.get("/catalog/stats", async (_req, res) => {
  try {
    const datasets = await listDatasets();
    const total_tables = datasets.reduce((s, d) => s + d.tables_count, 0);
    const locations = new Set(datasets.map((d) => d.location));
    res.json({
      total_datasets: datasets.length,
      total_tables,
      locations_count: locations.size,
      project_id: getProjectId(),
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/catalog/locations
router.get("/catalog/locations", async (_req, res) => {
  try {
    const datasets = await listDatasets();
    const locations = [...new Set(datasets.map((d) => d.location))];
    res.json({ locations });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
import { BigQuery } from "@google-cloud/bigquery";
import { TranslationServiceClient } from "@google-cloud/translate";

const bq = new BigQuery();
const translateClient = new TranslationServiceClient();

const EXCLUDED_DATASETS = new Set([
  "dataplex_insights_outputs",
  "temp",
  "Logging",
  "admin",
  "metrics",
]);

export function getProjectId(): string {
  return process.env["GOOGLE_CLOUD_PROJECT"] ?? process.env["GCLOUD_PROJECT"] ?? "";
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const TTL = 5 * 60 * 1000; // 5 דקות
let cache: { data: DatasetRow[]; time: number } | null = null;

export function getCachedDatasets(): DatasetRow[] | null {
  if (cache && Date.now() - cache.time < TTL) return cache.data;
  return null;
}

export function setCachedDatasets(data: DatasetRow[]) {
  cache = { data, time: Date.now() };
}

// ─── Translation ──────────────────────────────────────────────────────────────
async function translateToHebrew(text: string | null | undefined): Promise<string | null> {
  if (!text) return null;
  try {
    const projectId = getProjectId();
    const parent = `projects/${projectId}/locations/global`;
    const [response] = await translateClient.translateText({
      parent,
      contents: [text.slice(0, 1000)],
      targetLanguageCode: "he",
      mimeType: "text/plain",
    });
    return response.translations?.[0]?.translatedText ?? null;
  } catch (err) {
    console.error("Translation error:", err);
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DatasetRow {
  dataset_id: string;
  description: string | null;
  description_he: string | null;
  location: string;
  tables_count: number;
  created_at: string;
}

// ─── BQ Queries ───────────────────────────────────────────────────────────────
export async function listDatasets(): Promise<DatasetRow[]> {
  const hit = getCachedDatasets();
  if (hit) return hit;

  const projectId = getProjectId();
  const [datasets] = await bq.getDatasets({ projectId });
  const filtered = datasets.filter((ds) => !EXCLUDED_DATASETS.has(ds.id ?? ""));
  const rows = await Promise.all(
    filtered.map(async (ds) => {
      const [meta] = await ds.getMetadata();
      const [tables] = await ds.getTables();
      const description = meta.description ?? null;
      const description_he = await translateToHebrew(description);
      return {
        dataset_id: ds.id ?? "",
        description,
        description_he,
        location: meta.location ?? "unknown",
        tables_count: tables.length,
        created_at: meta.creationTime
          ? new Date(Number(meta.creationTime)).toISOString()
          : new Date().toISOString(),
      } as DatasetRow;
    })
  );

  setCachedDatasets(rows);
  return rows;
}

export async function getDataset(datasetId: string): Promise<DatasetRow | null> {
  const hit = getCachedDatasets();
  if (hit) {
    const found = hit.find((d) => d.dataset_id === datasetId);
    if (found) return found;
  }

  const projectId = getProjectId();
  const ds = bq.dataset(datasetId, { projectId });
  try {
    const [meta] = await ds.getMetadata();
    const [tables] = await ds.getTables();
    const description = meta.description ?? null;
    const description_he = await translateToHebrew(description);
    return {
      dataset_id: datasetId,
      description,
      description_he,
      location: meta.location ?? "unknown",
      tables_count: tables.length,
      created_at: meta.creationTime
        ? new Date(Number(meta.creationTime)).toISOString()
        : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
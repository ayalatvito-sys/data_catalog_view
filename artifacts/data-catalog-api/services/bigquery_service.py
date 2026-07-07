import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List

from cache_utils import cached

logger = logging.getLogger(__name__)

EXCLUDED_DATASETS = {
    "dataplex_insights_outputs",
    "temp",
    "Logging",
    "admin",
    "metrics",
}


class BigQueryService:
    def __init__(self, project_id: str, location: str):
        self.project_id = project_id
        self.location = location
        self._client = None
        self._available = False
        self._init_client()

    def _init_client(self):
        try:
            from google.cloud import bigquery
            self._client = bigquery.Client(project=self.project_id)
            self._available = True
            logger.info("BigQuery client initialized for project %s", self.project_id)
        except Exception as e:
            self._available = False
            logger.warning("BigQuery init failed: %s", e)

    @property
    def is_available(self) -> bool:
        return self._available

    # ─── Datasets ─────────────────────────────────────────────────────────────

    @cached(ttl=300)
    async def list_datasets(self, *, refresh: bool = False):
        """Returns all non-excluded datasets.  Cached 5 min; bypass with refresh=True."""
        if not self._available:
            raise RuntimeError("BigQuery credentials not configured.")
        loop = asyncio.get_event_loop()
        datasets = await loop.run_in_executor(None, self._fetch_datasets)
        return datasets

    def _fetch_datasets(self):
        from models import Dataset
        result = []
        for ds_ref in self._client.list_datasets(project=self.project_id):
            if ds_ref.dataset_id in EXCLUDED_DATASETS:
                continue
            full_ds = self._client.get_dataset(ds_ref.reference)
            tables = list(self._client.list_tables(full_ds))

            created_at = self._fmt_dt(full_ds.created)
            last_modified = self._fmt_dt(full_ds.modified)

            result.append(Dataset(
                dataset_id=ds_ref.dataset_id,
                description=full_ds.description or None,
                description_he=None,
                location=full_ds.location or self.location,
                tables_count=len(tables),
                created_at=created_at,
                last_modified=last_modified,
            ))
        return result

    async def get_dataset(self, dataset_id: str, *, refresh: bool = False):
        datasets = await self.list_datasets(refresh=refresh)
        for ds in datasets:
            if ds.dataset_id == dataset_id:
                return ds
        return None

    # ─── Tables ───────────────────────────────────────────────────────────────

    @cached(ttl=300)
    async def list_tables(self, dataset_id: str, *, refresh: bool = False) -> list:
        """Returns all tables for a dataset.  Cached 5 min; bypass with refresh=True."""
        if not self._available:
            raise RuntimeError("BigQuery credentials not configured.")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_tables, dataset_id)

    def _fetch_tables(self, dataset_id: str):
        from models import TableDetail
        result = []
        dataset_ref = self._client.dataset(dataset_id, project=self.project_id)
        for t in self._client.list_tables(dataset_ref):
            full_table = self._client.get_table(t.reference)
            result.append(TableDetail(
                table_id=t.table_id,
                table_type=str(full_table.table_type or "TABLE"),
                creation_time=self._fmt_dt(full_table.created),
                row_count=full_table.num_rows or 0,
                size_bytes=full_table.num_bytes or 0,
                last_modified=self._fmt_dt(full_table.modified),
            ))
        result.sort(key=lambda t: t.table_id)
        return result

    # ─── Relationships (from Dataplex BQ table) ───────────────────────────────

    @cached(ttl=300)
    async def list_relationships(self, dataset_id: str, min_confidence: float = 0.5, *, refresh: bool = False) -> list:
        """Returns relationship edges for a dataset.  Cached 5 min."""
        if not self._available:
            raise RuntimeError("BigQuery credentials not configured.")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_relationships, dataset_id, min_confidence)

    def _fetch_relationships(self, dataset_id: str, min_confidence: float):
        from models import Relationship
        query = f"""
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
            FROM `{self.project_id}.dataplex_insights_outputs.insights_relationship_edges`
            WHERE (source_dataset = @dataset_id OR target_dataset = @dataset_id)
              AND confidence_score >= @min_confidence
            ORDER BY confidence_score DESC
        """
        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("dataset_id", "STRING", dataset_id),
            bigquery.ScalarQueryParameter("min_confidence", "FLOAT64", min_confidence),
        ])
        rows = self._client.query(query, job_config=job_config).result()
        return [Relationship(**dict(row)) for row in rows]

    # ─── Pipelines Status ───────────────────────────────────────────────────

    @cached(ttl=300)
    async def get_pipeline_statuses(self, *, refresh: bool = False) -> list:
        """Returns pipeline statuses from the latest status view. Cached 5 min; bypass with refresh=True."""
        if not self._available:
            raise RuntimeError("BigQuery credentials not configured.")
        
        import asyncio
        loop = asyncio.get_event_loop()
        # קריאה לפונקציה הפנימית שעושה את השאילתה
        return await loop.run_in_executor(None, self._fetch_pipeline_statuses)

    def _fetch_pipeline_statuses(self) -> list:
        query = """
            SELECT 
                pipeline_name,
                environment,
                as_of_date,
                current_status
            FROM `dgt-gcp-econ-dev-datalake.Logging.view2_pipeline_latest_status`
            ORDER BY as_of_date DESC
        """
        try:
            query_job = self._client.query(query)
            results = query_job.result()
            # ממירים כל שורה למילון כדי ש-FastAPI ידע להפוך את זה ל-JSON
            return [dict(row) for row in results]
        except Exception as e:
            print(f"Error fetching pipeline statuses: {e}")
            return []

    # ─── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _fmt_dt(dt) -> Optional[str]:
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return str(dt)

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List

logger = logging.getLogger(__name__)


class BigQueryService:
    def __init__(self, project_id: str, location: str):
        self.project_id = project_id
        self.location = location
        self._client = None
        self._available = False
        self._datasets_cache: Optional[List] = None
        self._cache_ts: float = 0
        self._cache_ttl: float = 300
        self._init_client()

    def _init_client(self):
        try:
            from google.cloud import bigquery
            self._client = bigquery.Client(project=self.project_id)
            self._available = True
            logger.info("BigQuery client initialized successfully for project %s", self.project_id)
        except Exception as e:
            self._available = False
            logger.warning("BigQuery client initialization failed (credentials not configured): %s", e)

    async def list_datasets(self):
        if not self._available:
            raise RuntimeError(
                "BigQuery credentials not configured. "
                "Set up Application Default Credentials: "
                "https://cloud.google.com/docs/authentication/external/set-up-adc"
            )

        import time
        now = time.time()
        if self._datasets_cache is not None and (now - self._cache_ts) < self._cache_ttl:
            return list(self._datasets_cache)

        loop = asyncio.get_event_loop()
        datasets = await loop.run_in_executor(None, self._fetch_datasets)
        self._datasets_cache = datasets
        self._cache_ts = now
        return list(datasets)

    def _fetch_datasets(self):
        from models import Dataset
        from google.cloud import bigquery

        result = []
        for ds_ref in self._client.list_datasets(project=self.project_id):
            dataset_id = ds_ref.dataset_id
            full_ds = self._client.get_dataset(ds_ref.reference)

            tables = list(self._client.list_tables(full_ds))
            tables_count = len(tables)

            created_at = ""
            if full_ds.created:
                if isinstance(full_ds.created, datetime):
                    created_at = full_ds.created.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                else:
                    created_at = str(full_ds.created)

            result.append(Dataset(
                dataset_id=dataset_id,
                description=full_ds.description or None,
                description_he=None,
                location=full_ds.location or self.location,
                tables_count=tables_count,
                created_at=created_at,
            ))

        return result

    async def get_dataset(self, dataset_id: str):
        datasets = await self.list_datasets()
        for ds in datasets:
            if ds.dataset_id == dataset_id:
                return ds
        return None

    @property
    def is_available(self) -> bool:
        return self._available

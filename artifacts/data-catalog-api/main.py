import os
import time
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from services.bigquery_service import BigQueryService
from services.translation_service import TranslationService
from models import DatasetList, Dataset, CatalogStats, LocationList

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "dgt-gcp-econ-dev-datalake")
LOCATION = os.getenv("GCP_LOCATION", "me-west1")

bq_service: Optional[BigQueryService] = None
translation_service: Optional[TranslationService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global bq_service, translation_service
    logger.info("Starting Data Catalog API for project: %s", PROJECT_ID)
    bq_service = BigQueryService(project_id=PROJECT_ID, location=LOCATION)
    translation_service = TranslationService(project_id=PROJECT_ID)
    if not bq_service.is_available:
        logger.warning(
            "BigQuery credentials not found. API will return 503 for dataset endpoints. "
            "Set GOOGLE_APPLICATION_CREDENTIALS to a service account key JSON path."
        )
    yield
    logger.info("Shutting down Data Catalog API")


app = FastAPI(
    title="Data Catalog API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/catalog-api")


def require_bq():
    if not bq_service or not bq_service.is_available:
        raise HTTPException(
            status_code=503,
            detail=(
                "BigQuery credentials not configured. "
                "Set GOOGLE_APPLICATION_CREDENTIALS to a service account key JSON path, "
                "or run 'gcloud auth application-default login'."
            ),
        )


@router.get("/datasets", response_model=DatasetList)
async def list_datasets(
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None, enum=["name", "tables_count"]),
    sort_dir: Optional[str] = Query("asc", enum=["asc", "desc"]),
):
    require_bq()
    try:
        datasets = await bq_service.list_datasets()

        for ds in datasets:
            if ds.description:
                ds.description_he = await translation_service.translate_to_hebrew(ds.description)
            else:
                ds.description_he = None

        if search:
            search_lower = search.lower()
            datasets = [d for d in datasets if search_lower in d.dataset_id.lower()]

        reverse = sort_dir == "desc"
        if sort_by == "tables_count":
            datasets.sort(key=lambda d: d.tables_count, reverse=reverse)
        else:
            datasets.sort(key=lambda d: d.dataset_id.lower(), reverse=reverse)

        return DatasetList(datasets=datasets, total=len(datasets))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing datasets")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/datasets/{dataset_id}", response_model=Dataset)
async def get_dataset(dataset_id: str):
    require_bq()
    try:
        dataset = await bq_service.get_dataset(dataset_id)
        if dataset is None:
            raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")

        if dataset.description:
            dataset.description_he = await translation_service.translate_to_hebrew(dataset.description)

        return dataset
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching dataset %s", dataset_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/catalog/stats", response_model=CatalogStats)
async def get_catalog_stats():
    require_bq()
    try:
        datasets = await bq_service.list_datasets()
        total_tables = sum(d.tables_count for d in datasets)
        locations = set(d.location for d in datasets)

        return CatalogStats(
            total_datasets=len(datasets),
            total_tables=total_tables,
            locations_count=len(locations),
            project_id=PROJECT_ID,
            last_updated=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting catalog stats")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/catalog/locations", response_model=LocationList)
async def list_locations():
    require_bq()
    try:
        datasets = await bq_service.list_datasets()
        locations = sorted(set(d.location for d in datasets))
        return LocationList(locations=locations)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing locations")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/healthz")
async def health_check():
    return {
        "status": "ok",
        "bigquery_available": bq_service.is_available if bq_service else False,
        "project_id": PROJECT_ID,
    }


app.include_router(router)

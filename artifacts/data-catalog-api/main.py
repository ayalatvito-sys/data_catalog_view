import os
import time
import logging
from typing import Optional
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from services.bigquery_service import BigQueryService
from services.dataplex_service import DataplexService
from services.translation_service import TranslationService
from models import (
    DatasetList, Dataset, CatalogStats, LocationList,
    TableList, RelationshipList
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "dgt-gcp-econ-dev-datalake")
LOCATION   = os.getenv("GCP_LOCATION", "me-west1")

bq_service: Optional[BigQueryService] = None
dataplex_service: Optional[DataplexService] = None
translation_service: Optional[TranslationService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global bq_service, dataplex_service, translation_service
    logger.info("Starting Data Catalog API — project: %s", PROJECT_ID)
    bq_service          = BigQueryService(project_id=PROJECT_ID, location=LOCATION)
    dataplex_service    = DataplexService(project_id=PROJECT_ID, location=LOCATION)
    translation_service = TranslationService(project_id=PROJECT_ID)
    if not bq_service.is_available:
        logger.warning("BigQuery not available — run 'gcloud auth application-default login'")
    yield
    logger.info("Shutting down")


app = FastAPI(title="Data Catalog API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api")


def require_bq():
    if not bq_service or not bq_service.is_available:
        raise HTTPException(status_code=503, detail="BigQuery not available")


# ─── Datasets ─────────────────────────────────────────────────────────────────

@router.get("/datasets", response_model=DatasetList)
async def list_datasets(
    search:   Optional[str] = Query(None),
    sort_by:  Optional[str] = Query(None, enum=["name", "tables_count"]),
    sort_dir: Optional[str] = Query("asc", enum=["asc", "desc"]),
):
    require_bq()
    try:
        datasets = await bq_service.list_datasets()

        for ds in datasets:
            if ds.description:
                ds.description_he = await translation_service.translate_to_hebrew(ds.description)

        if search:
            q = search.lower()
            datasets = [d for d in datasets if q in d.dataset_id.lower() or q in (d.description or "").lower()]

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
        ds = await bq_service.get_dataset(dataset_id)
        if not ds:
            raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
        if ds.description:
            ds.description_he = await translation_service.translate_to_hebrew(ds.description)
        return ds
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching dataset %s", dataset_id)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Tables ───────────────────────────────────────────────────────────────────

# @router.get("/datasets/{dataset_id}/tables", response_model=TableList)
# async def list_tables(dataset_id: str):
#     require_bq()
#     try:
#         tables = await bq_service.list_tables(dataset_id)

#         # הוסף aspects מ-Dataplex לכל טבלה
#         if dataplex_service and dataplex_service.is_available:
#             # אם זה מופע של ייצור שיש בו מספר פרויקטים נפרדים, סורק טבלה-טבלה
#             if dataset_id == "MSSQL_mss_production":
#                 for t in tables:
#                     aspects = await dataplex_service.get_table_aspects(dataset_id, t.table_id)
#                     t.is_financial    = aspects["is_financial"]
#                     t.is_geographical = aspects["is_geographical"]
#                     t.is_sensitive    = aspects["is_sensitive"]
#                     t.project_name    = aspects.get("project_name", "כללי")
#                     t.system_name     = aspects.get("system_name")
#                     t.project_manager = aspects.get("project_manager")
#                     t.characterization_link = aspects.get("characterization_link")
#             else:
#                 # בכל שאר המופעים - שולף פעם אחת ברמת ה-Dataset ומחיל על כל הטבלאות (שיפור ביצועים משמעותי)
#                 dataset_aspects = await dataplex_service.get_dataset_aspects(dataset_id)
#                 for t in tables:
#                     t.is_financial    = dataset_aspects["is_financial"]
#                     t.is_geographical = dataset_aspects["is_geographical"]
#                     t.is_sensitive    = dataset_aspects["is_sensitive"]
#                     t.project_name    = dataset_aspects.get("project_name", "כללי")
#                     t.system_name     = dataset_aspects.get("system_name")
#                     t.project_manager = dataset_aspects.get("project_manager")
#                     t.characterization_link = dataset_aspects.get("characterization_link")

#         return TableList(tables=tables, total=len(tables))
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.exception("Error listing tables for %s", dataset_id)
#         raise HTTPException(status_code=500, detail=str(e))

@router.get("/datasets/{dataset_id}/tables", response_model=TableList)
async def list_tables(dataset_id: str):
    require_bq()
    try:
        tables = await bq_service.list_tables(dataset_id)

        if dataplex_service and dataplex_service.is_available:
            # 1. שולפים קודם את נתוני ה-Dataset כדי לבדוק אם יש עליו תיוגים הוליסטיים
            dataset_aspects = await dataplex_service.get_dataset_aspects(dataset_id)
            
            # 2. האם הוגדרו תיוגים על ה-Dataset עצמו?
            if dataset_aspects.get("has_custom_aspects"):
                # כן! נחיל אותם על כל הטבלאות במהירות
                for t in tables:
                    t.is_financial    = dataset_aspects.get("is_financial", False)
                    t.is_geographical = dataset_aspects.get("is_geographical", False)
                    t.is_sensitive    = dataset_aspects.get("is_sensitive", False)
                    t.project_name    = dataset_aspects.get("project_name", "כללי")
                    t.system_name     = dataset_aspects.get("system_name")
                    t.project_manager = dataset_aspects.get("project_manager")
                    t.characterization_link = dataset_aspects.get("characterization_link")
            else:
                # לא הוגדרו תיוגים על ה-DS -> שולפים את המידע עבור *כל טבלה בנפרד*.
                # כדי למנוע קריסות ואיטיות, נשתמש ב-gather כדי לאסוף את הנתונים במקביל!
                tasks = [dataplex_service.get_table_aspects(dataset_id, t.table_id) for t in tables]
                
                # return_exceptions מגן עלינו שאם טבלה אחת נכשלת, שאר הטבלאות עדיין יגיעו בהצלחה
                all_table_aspects = await asyncio.gather(*tasks, return_exceptions=True)
                
                # עכשיו משייכים את התוצאות לטבלאות המתאימות
                for t, aspects in zip(tables, all_table_aspects):
                    # הגנה: אם חזרה שגיאה מטבלה מסוימת, נתייחס אליה כאל מילון ריק
                    if isinstance(aspects, Exception) or not aspects:
                        aspects = {}
                        
                    t.is_financial    = aspects.get("is_financial", False)
                    t.is_geographical = aspects.get("is_geographical", False)
                    t.is_sensitive    = aspects.get("is_sensitive", False)
                    t.project_name    = aspects.get("project_name", "כללי")
                    t.system_name     = aspects.get("system_name")
                    t.project_manager = aspects.get("project_manager")
                    t.characterization_link = aspects.get("characterization_link")

        return TableList(tables=tables, total=len(tables))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing tables for %s", dataset_id)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Relationships ────────────────────────────────────────────────────────────
 
@router.get("/datasets/{dataset_id}/relationships", response_model=RelationshipList)
async def list_relationships(
    dataset_id: str,
    min_confidence: float = Query(0.5, ge=0.0, le=1.0),
):
    require_bq()
    try:
        rels = await bq_service.list_relationships(dataset_id, min_confidence)
        return RelationshipList(relationships=rels, total=len(rels))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing relationships for %s", dataset_id)
        raise HTTPException(status_code=500, detail=str(e))
 
# ─── Catalog ──────────────────────────────────────────────────────────────────

@router.get("/catalog/stats", response_model=CatalogStats)
async def get_catalog_stats():
    require_bq()
    try:
        datasets = await bq_service.list_datasets()
        return CatalogStats(
            total_datasets=len(datasets),
            total_tables=sum(d.tables_count for d in datasets),
            locations_count=len(set(d.location for d in datasets)),
            project_id=PROJECT_ID,
            last_updated=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/catalog/locations", response_model=LocationList)
async def list_locations():
    require_bq()
    try:
        datasets = await bq_service.list_datasets()
        return LocationList(locations=sorted(set(d.location for d in datasets)))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/healthz")
async def health_check():
    return {
        "status": "ok",
        "bigquery_available":  bq_service.is_available  if bq_service  else False,
        "dataplex_available":  dataplex_service.is_available if dataplex_service else False,
        "project_id": PROJECT_ID,
    }


app.include_router(router)
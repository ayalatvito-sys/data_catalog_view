import os
import logging
from google.cloud import bigquery
from google.cloud import dataplex_v1
from google.cloud import datacatalog_v1
from google.cloud import translate_v2 as translate

# --- הגדרות ---
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "dgt-gcp-econ-dev-datalake")
LOCATION = os.getenv("GCP_LOCATION", "me-west1")
TRANSLATION_HEADER = "### Description translated into Hebrew"

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

EXCLUDED_DATASETS = {"dataplex_insights_outputs", "temp", "Logging", "admin", "metrics"}

def get_translation(client: translate.Client, text: str) -> str:
    if not text or not text.strip():
        return ""
    try:
        res = client.translate(text, target_language="iw", source_language="en")
        return res.get("translatedText", text)
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text

def extract_hebrew_translation(overview: str) -> str:
    if not overview or TRANSLATION_HEADER not in overview:
        return ""
    parts = overview.split(TRANSLATION_HEADER)
    return parts[1].strip()

def update_overview_with_translation(overview: str, translated_text: str) -> str:
    if not overview:
        return f"{TRANSLATION_HEADER}\n\n{translated_text}"
    if TRANSLATION_HEADER in overview:
        original_content = overview.split(TRANSLATION_HEADER)[0].strip()
        return f"{original_content}\n\n{TRANSLATION_HEADER}\n\n{translated_text}".strip()
    return f"{overview.strip()}\n\n{TRANSLATION_HEADER}\n\n{translated_text}"

def sync_datasets():
    bq_client = bigquery.Client(project=PROJECT_ID)
    dataplex_client = dataplex_v1.CatalogServiceClient()
    catalog_client = datacatalog_v1.DataCatalogClient()
    translate_client = translate.Client()

    logger.info("🚀 Starting sync: Data Catalog (EN) -> Dataplex Overview (HE) & BigQuery (EN)")

    datasets = list(bq_client.list_datasets())
    for dataset_ref in datasets:
        dataset_id = dataset_ref.dataset_id
        if dataset_id in EXCLUDED_DATASETS:
            continue
            
        try:
            # 1. שליפת האנגלית מ-Data Catalog
            linked_resource = f"//bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/{dataset_id}"
            try:
                catalog_entry = catalog_client.lookup_entry(request={"linked_resource": linked_resource})
                catalog_desc = catalog_entry.description or ""
            except Exception:
                logger.warning(f"[{dataset_id}] Not found in Data Catalog. Skipping.")
                continue

            # 2. שליפת העברית וה-Overview מ-Dataplex
            dp_entry_name = (
                f"projects/{PROJECT_ID}/locations/{LOCATION}/entryGroups/@bigquery/"
                f"entries/bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/{dataset_id}"
            )
            
            aspect_full_path = "projects/dataplex-types/locations/global/aspectTypes/overview"
            aspect_map_key = "dataplex-types.global.overview"
            
            req = dataplex_v1.GetEntryRequest(
                name=dp_entry_name,
                view=dataplex_v1.EntryView.CUSTOM,
                aspect_types=[aspect_full_path]
            )
            try:
                dp_entry = dataplex_client.get_entry(request=req)
            except Exception:
                logger.warning(f"[{dataset_id}] Not found in Dataplex Catalog. Skipping.")
                continue

            current_overview = ""
            # התיקון לפי הסכמה: שולפים מתוך מפתח 'content'
            if aspect_map_key in dp_entry.aspects and dp_entry.aspects[aspect_map_key].data:
                current_overview = dp_entry.aspects[aspect_map_key].data.get("content", "")
            
            current_translation = extract_hebrew_translation(current_overview)

            # 3. שליפת התיאור מ-BigQuery
            bq_dataset = bq_client.get_dataset(dataset_ref.reference)
            bq_desc = bq_dataset.description or ""

            needs_translation = False
            update_bq = False

            # --- לוגיקת סנכרון ---
            if catalog_desc and not current_translation:
                needs_translation = True
            
            if catalog_desc != bq_desc:
                update_bq = True
                needs_translation = True

            # --- ביצוע העדכונים ---
            if needs_translation:
                logger.info(f"[{dataset_id}] Translating and updating Dataplex Overview...")
                new_heb = get_translation(translate_client, catalog_desc)
                new_overview = update_overview_with_translation(current_overview, new_heb)
                
                aspect = dataplex_v1.Aspect()
                aspect.aspect_type = aspect_full_path 
                
                # התיקון לפי הסכמה: שמירה בשדות 'content' ו-'contentType'
                aspect.data = {
                    "content": new_overview,
                    "contentType": "MARKDOWN"
                }
                
                dp_entry.aspects[aspect_map_key] = aspect
                
                # התיקון של ה-API: שימוש ב-aspect_keys במקום update_mask ספציפי
                upd_req = dataplex_v1.UpdateEntryRequest(
                    entry=dp_entry,
                    update_mask={"paths": ["aspects"]},
                    aspect_keys=[aspect_map_key],
                    allow_missing=False
                )
                dataplex_client.update_entry(request=upd_req)
                logger.info(f"[{dataset_id}] ✅ Overview updated in Dataplex.")

            if update_bq:
                logger.info(f"[{dataset_id}] Syncing Data Catalog description -> BigQuery...")
                bq_dataset.description = catalog_desc
                bq_client.update_dataset(bq_dataset, ["description"])
                logger.info(f"[{dataset_id}] ✅ BigQuery updated.")

            if not needs_translation and not update_bq:
                logger.info(f"[{dataset_id}] In sync. No action needed.")

        except Exception as e:
            logger.error(f"Error processing {dataset_id}: {e}")

if __name__ == "__main__":
    sync_datasets()
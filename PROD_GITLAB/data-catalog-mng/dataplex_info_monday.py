# """
# Cloud Function: Monday.com → Dataplex Catalog Aspect Sync
# Reads project metadata from a Monday.com JSON export stored in BigQuery
# and updates Dataplex Catalog Entries with a custom Aspect Template.

# Trigger: HTTP (compatible with Cloud Scheduler via HTTP target)
# """

# import json
# import logging
# import os
# import functions_framework

# from google.cloud import bigquery
# from google.cloud import dataplex_v1
# from google.api_core.exceptions import NotFound
# from google.protobuf import field_mask_pb2

# # ---------------------------------------------------------------------------
# # Logging
# # ---------------------------------------------------------------------------
# logging.basicConfig(
#     level=logging.INFO,
#     format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
# )
# logger = logging.getLogger("dataplex-sync")

# # ---------------------------------------------------------------------------
# # Environment / constants  (override via Cloud Function env-vars)
# # ---------------------------------------------------------------------------
# SOURCE_PROJECT   = os.environ.get("SOURCE_PROJECT",   "dgt-gcp-econ-dev-datalake")
# SOURCE_DATASET   = os.environ.get("SOURCE_DATASET",   "monday")
# SOURCE_TABLE     = os.environ.get("SOURCE_TABLE",     "db_projects_mapping")
# ROW_ID           = os.environ.get("ROW_ID",           "5092737444")

# TARGET_PROJECT   = os.environ.get("TARGET_PROJECT",   SOURCE_PROJECT)
# TARGET_LOCATION  = os.environ.get("TARGET_LOCATION",  "me-west1")   # Dataplex location
# BQ_LOCATION      = os.environ.get("BQ_LOCATION",      "me-west1")            # BigQuery location
# ASPECT_TYPE_ID   = os.environ.get("ASPECT_TYPE_ID",   "db-tasks-information")

# MSS_PRODUCTION_DB = "mss_production"

# # Monday.com column title → internal key mapping
# COLUMN_MAP = {
#     "פרויקט":           "project_name",
#     "מערכת":            "system_name",
#     "מנהל פרויקטים":    "project_manager",
#     "קישור לאפיון":     "characterization_link",
#     "DB":               "db",
#     "prefix":           "prefix",
# }


# # ---------------------------------------------------------------------------
# # Cloud Function entry-point
# # ---------------------------------------------------------------------------
# @functions_framework.http
# def main(request):
#     """HTTP-triggered entry point (also usable via Cloud Scheduler HTTP job)."""
#     logger.info("=== Dataplex sync started ===")

#     try:
#         all_metadata_rows = fetch_all_metadata_from_bigquery()
#         logger.info("Fetched %d row(s) from BigQuery.", len(all_metadata_rows))
#     except Exception as exc:
#         logger.critical("Fatal error fetching rows from BigQuery: %s", exc, exc_info=True)
#         return (json.dumps({"error": str(exc)}), 500, {"Content-Type": "application/json"})

#     all_results = []

#     for row_index, metadata in enumerate(all_metadata_rows):
#         row_label = f"row[{row_index}] id={metadata.get('_source_id', '?')}"
#         logger.info("--- Processing %s | %s ---", row_label, _redact(metadata))

#         # resolve_target_tables may skip this row (e.g. empty prefix on mss_production)
#         try:
#             tables = resolve_target_tables(metadata, row_label=row_label)
#         except Exception as exc:
#             logger.error("Skipping %s — could not resolve tables: %s", row_label, exc, exc_info=True)
#             all_results.append({"row": row_label, "status": "skipped", "detail": str(exc)})
#             continue

#         logger.info("%s → %d target table(s).", row_label, len(tables))

#         for project, dataset, table in tables:
#             table_ref = f"{project}.{dataset}.{table}"
#             try:
#                 resp = update_dataplex_aspect(
#                     project=project,
#                     dataset=dataset,
#                     table=table,
#                     location=TARGET_LOCATION,
#                     aspect_type_id=ASPECT_TYPE_ID,
#                     data_dict=metadata,
#                 )
#                 logger.info("Updated entry %s → %s", table_ref, resp.name)
#                 all_results.append({"row": row_label, "table": table_ref, "status": "ok"})
#             except Exception as exc:
#                 logger.error("Failed to update %s: %s", table_ref, exc, exc_info=True)
#                 all_results.append({"row": row_label, "table": table_ref, "status": "error", "detail": str(exc)})

#     success = sum(1 for r in all_results if r["status"] == "ok")
#     skipped = sum(1 for r in all_results if r["status"] == "skipped")
#     logger.info(
#         "=== Sync complete: %d succeeded / %d skipped / %d errors (total=%d) ===",
#         success, skipped, len(all_results) - success - skipped, len(all_results),
#     )
#     return (
#         json.dumps({
#             "processed": len(all_results),
#             "succeeded": success,
#             "skipped":   skipped,
#             "results":   all_results,
#         }),
#         200,
#         {"Content-Type": "application/json"},
#     )


# # ---------------------------------------------------------------------------
# # Step 1 — Fetch & parse ALL matching Monday.com rows from BigQuery
# # ---------------------------------------------------------------------------
# def fetch_all_metadata_from_bigquery() -> list[dict]:
#     """
#     Reads ALL rows matching id = ROW_ID from BigQuery (no LIMIT).
#     Each row's json_str is parsed independently.

#     Returns:
#         List of flat metadata dicts (one per valid row).
#         Rows with NULL/empty json_str or parse errors are logged and skipped.

#     Raises:
#         ValueError: if the query itself returns zero rows at all.
#     """
#     client = bigquery.Client(project=SOURCE_PROJECT)

#     # No LIMIT — process every matching row
#     query = f"""
#         SELECT id, json_str
#         FROM `{SOURCE_PROJECT}.{SOURCE_DATASET}.{SOURCE_TABLE}`
#         WHERE id = @row_id
#     """
#     job_config = bigquery.QueryJobConfig(
#         query_parameters=[bigquery.ScalarQueryParameter("row_id", "INT64", int(ROW_ID))]
#     )

#     logger.info(
#         "Querying BigQuery (no LIMIT): %s.%s.%s where id='%s'",
#         SOURCE_PROJECT, SOURCE_DATASET, SOURCE_TABLE, ROW_ID,
#     )
#     rows = list(client.query(query, job_config=job_config).result())

#     if not rows:
#         raise ValueError(
#             f"No rows found in {SOURCE_PROJECT}.{SOURCE_DATASET}.{SOURCE_TABLE} "
#             f"with id='{ROW_ID}'"
#         )

#     results = []
#     for bq_row in rows:
#         source_id = bq_row.get("id", "unknown")
#         raw_json  = bq_row.get("json_str")

#         if not raw_json:
#             logger.warning("Row id='%s' has NULL/empty json_str — skipping.", source_id)
#             continue

#         try:
#             metadata = _parse_monday_json(raw_json)
#             metadata["_source_id"] = source_id   # carry id for logging
#             results.append(metadata)
#         except ValueError as exc:
#             logger.warning("Row id='%s' failed to parse — skipping. Reason: %s", source_id, exc)

#     return results


# def _parse_monday_json(raw_json) -> dict:
#     """
#     Parses the Monday.com column_values JSON blob and returns a flat dict
#     using internal key names defined in COLUMN_MAP.

#     Handles missing / empty / null values gracefully, and supports both
#     raw strings and pre-parsed dictionaries from BigQuery.
#     """
#     # בדיקה האם BigQuery כבר המיר לנו את ה-JSON למילון
#     if isinstance(raw_json, dict):
#         payload = raw_json
#     else:
#         try:
#             payload = json.loads(raw_json)
#         except json.JSONDecodeError as exc:
#             raise ValueError(f"Failed to parse json_str as JSON: {exc}") from exc

#     column_values = payload.get("column_values", [])
#     if not column_values:
#         raise ValueError("Payload contains no 'column_values' array.")

#     extracted: dict = {internal: "" for internal in COLUMN_MAP.values()}

#     for entry in column_values:
#         title = (entry.get("column") or {}).get("title", "").strip()
        
#         # תמיכה גם ב-text וגם ב-display_value במידה ו-text ריק (כמו שדיברנו קודם)
#         text_val = entry.get("text")
#         if not text_val:
#             text_val = entry.get("display_value") or ""
#         text = str(text_val).strip()

#         internal_key = COLUMN_MAP.get(title)
#         if internal_key:
#             extracted[internal_key] = text
#             logger.debug("Mapped '%s' → '%s' = '%s'", title, internal_key, text)

#     # Validate mandatory fields
#     missing = [k for k in ("project_name", "system_name", "project_manager", "db") if not extracted.get(k)]
#     if missing:
#         raise ValueError(f"Mandatory fields missing or empty after parsing: {missing}")

#     return extracted

# # ---------------------------------------------------------------------------
# # Step 2 — Resolve which BigQuery tables to annotate
# # ---------------------------------------------------------------------------
# def resolve_target_tables(
#     metadata: dict,
#     row_label: str = "",
# ) -> list[tuple[str, str, str]]:
#     """
#     Returns a list of (project, dataset, table) tuples to annotate.

#     Routing logic:
#       - DB != 'mss_production' → ALL tables in that dataset.
#       - DB == 'mss_production' + non-empty prefix → tables starting with prefix.
#       - DB == 'mss_production' + EMPTY prefix → logs a warning and returns []
#         (caller skips this row and continues to the next one).
#     """
#     db      = metadata["db"]
#     prefix  = metadata.get("prefix", "").strip()
#     dataset = db   # The Monday "DB" value is the BigQuery dataset name

#     # ── mss_production with empty prefix: warn and skip ──────────────────────
#     if db == MSS_PRODUCTION_DB and not prefix:
#         logger.warning(
#             "%s | DB='mss_production' but 'prefix' is empty — "
#             "skipping this row to avoid updating all tables unintentionally.",
#             row_label,
#         )
#         return []

#     client = bigquery.Client(project=TARGET_PROJECT)
#     logger.info(
#         "%s | Listing tables in dataset '%s' (project=%s) …",
#         row_label, dataset, TARGET_PROJECT,
#     )

#     # יצירת השם החלופי: MSSQL_ + אותיות קטנות + החלפת רווחים בקו תחתון
#     alt_dataset = f"MSSQL_{dataset.lower().replace(' ', '_')}"
    
#     try:
#         # ניסיון 1: לפי השם המדויק במאנדיי
#         all_tables = list(client.list_tables(f"{TARGET_PROJECT}.{dataset}"))
#     except NotFound:
#         logger.info(
#             "%s | Exact dataset '%s' not found. Trying alternative name: '%s'", 
#             row_label, dataset, alt_dataset
#         )
#         try:
#             # ניסיון 2: עם ההמרה
#             all_tables = list(client.list_tables(f"{TARGET_PROJECT}.{alt_dataset}"))
#             # אם הצלחנו, אנחנו מעדכנים את המשתנה dataset כדי שההמשך ישתמש בשם התקין
#             dataset = alt_dataset 
#         except NotFound:
#              raise RuntimeError(f"Dataset not found using original name ('{db}') or alternative ('{alt_dataset}').")
#         except Exception as exc:
#              raise RuntimeError(f"Error accessing alternative dataset '{alt_dataset}': {exc}") from exc
#     except Exception as exc:
#         raise RuntimeError(f"Unexpected error accessing dataset '{dataset}': {exc}") from exc

#     if not all_tables:
#         logger.warning("%s | No tables found in %s.%s.", row_label, TARGET_PROJECT, dataset)
#         return []

#     if db == MSS_PRODUCTION_DB:
#         filtered = [t for t in all_tables if t.table_id.startswith(prefix)]
#         logger.info(
#             "%s | mss_production mode: %d table(s) match prefix '%s' (out of %d total).",
#             row_label, len(filtered), prefix, len(all_tables),
#         )
#     else:
#         filtered = all_tables
#         logger.info(
#             "%s | Standard mode: annotating all %d table(s) in '%s'.",
#             row_label, len(filtered), dataset,
#         )

#     return [(TARGET_PROJECT, dataset, t.table_id) for t in filtered]


# # ---------------------------------------------------------------------------
# # Step 3 — Write Dataplex Aspect
# # ---------------------------------------------------------------------------
# def update_dataplex_aspect(
#     project: str,
#     dataset: str,
#     table: str,
#     location: str,
#     aspect_type_id: str,
#     data_dict: dict,
# ) -> dataplex_v1.Entry:
#     """
#     Creates or updates a Dataplex Catalog Aspect on the BigQuery table entry.

#     Args:
#         project:        GCP project ID that owns the BigQuery table.
#         dataset:        BigQuery dataset name.
#         table:          BigQuery table name.
#         location:       Dataplex / Catalog location (e.g. 'us-central1').
#         aspect_type_id: Short ID of the Dataplex Aspect Type.
#         data_dict:      Parsed metadata dict from _parse_monday_json().

#     Returns:
#         The updated dataplex_v1.Entry object.
#     """
#     dataplex_client = dataplex_v1.CatalogServiceClient()

#     # --- Entry name -----------------------------------------------------------
#     # Format documented at:
#     # https://cloud.google.com/dataplex/docs/reference/rest/v1/projects.locations.entryGroups.entries
#     bq_resource = (
#         f"bigquery.googleapis.com/projects/{project}"
#         f"/datasets/{dataset}/tables/{table}"
#     )
#     entry_name = (
#         f"projects/{project}/locations/{location}"
#         f"/entryGroups/@bigquery/entries/{bq_resource}"
#     )

#     # --- Aspect Type name -----------------------------------------------------
#     aspect_type_name = (
#         f"projects/{project}/locations/{location}/aspectTypes/{aspect_type_id}"
#     )

#     # --- Build Aspect data (safe string coercion) ------------------------------
#     characterization_link = _safe_str(data_dict.get("characterization_link"))

#     aspect_data = {
#         "project-name":          _safe_str(data_dict.get("project_name")),
#         "system-name":           _safe_str(data_dict.get("system_name")),
#         "project-manager":       _safe_str(data_dict.get("project_manager")),
#         "characterization-link": characterization_link,
#     }

#     aspect = dataplex_v1.Aspect()
#     aspect.aspect_type = aspect_type_name
#     aspect.data = aspect_data

#     # --- Build Entry with aspects dict ----------------------------------------
#     entry       = dataplex_v1.Entry()
#     entry.name  = entry_name
#     aspect_key  = f"{project}.{location}.{aspect_type_id}"
#     entry.aspects = {aspect_key: aspect}

#     # --- Update mask ----------------------------------------------------------
#     update_mask = field_mask_pb2.FieldMask(paths=["aspects"])

#     request = dataplex_v1.UpdateEntryRequest(
#         entry=entry,
#         update_mask=update_mask,
#         allow_missing=False,   # Fail explicitly if the Dataplex entry doesn't exist
#     )

#     logger.debug(
#         "Sending UpdateEntry for %s | aspect_key=%s | data=%s",
#         entry_name, aspect_key, aspect_data,
#     )
#     return dataplex_client.update_entry(request=request)


# # ---------------------------------------------------------------------------
# # Helpers
# # ---------------------------------------------------------------------------
# def _safe_str(value) -> str:
#     """Return a stripped string, defaulting to empty string for None/falsy."""
#     if value is None:
#         return ""
#     return str(value).strip()


# def _redact(metadata: dict) -> dict:
#     """Return a copy of metadata safe for logging (no sensitive data here, but extensible)."""
#     return {k: v for k, v in metadata.items() if k not in ("characterization_link",)}

# if __name__ == "__main__":
#     # יצירת בקשת דמה ריקה כדי לספק לפונקציה את הארגומנט שהיא מצפה לו
#     class DummyRequest:
#         pass
    
#     response = main(DummyRequest())
#     print(response)


"""
Cloud Function: Monday.com → Dataplex Catalog Aspect Sync
Reads project metadata from a Monday.com JSON export stored in BigQuery
and updates Dataplex Catalog Entries with a custom Aspect Template.
"""

import json
import logging
import os
import functions_framework

from google.cloud import bigquery
from google.cloud import dataplex_v1
from google.api_core.exceptions import NotFound
from google.protobuf import field_mask_pb2

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("dataplex-sync")

# ---------------------------------------------------------------------------
# Environment / constants  (override via Cloud Function env-vars)
# ---------------------------------------------------------------------------
SOURCE_PROJECT   = os.environ.get("SOURCE_PROJECT",   "dgt-gcp-econ-dev-datalake")
SOURCE_DATASET   = os.environ.get("SOURCE_DATASET",   "monday")
SOURCE_TABLE     = os.environ.get("SOURCE_TABLE",     "db_projects_mapping")
ROW_ID           = os.environ.get("ROW_ID",           "5092737444")

TARGET_PROJECT   = os.environ.get("TARGET_PROJECT",   SOURCE_PROJECT)
TARGET_LOCATION  = os.environ.get("TARGET_LOCATION",  "me-west1")
BQ_LOCATION      = os.environ.get("BQ_LOCATION",      "me-west1")
ASPECT_TYPE_ID   = os.environ.get("ASPECT_TYPE_ID",   "db-tasks-information")

MSS_PRODUCTION_DB = "mss_production"

COLUMN_MAP = {
    "פרויקט":           "project_name",
    "מערכת":            "system_name",
    "מנהל פרויקטים":    "project_manager",
    "קישור לאפיון":     "characterization_link",
    "DB":               "db",
    "prefix":           "prefix",
}

# # ---------------------------------------------------------------------------
# # Cloud Function entry-point
# # ---------------------------------------------------------------------------
# @functions_framework.http
# def main(request):
#     logger.info("=== Dataplex sync started ===")

#     try:
#         all_metadata_rows = fetch_all_metadata_from_bigquery()
#         logger.info("Fetched %d processed row(s) from BigQuery (after splitting DBs).", len(all_metadata_rows))
#     except Exception as exc:
#         logger.critical("Fatal error fetching rows from BigQuery: %s", exc, exc_info=True)
#         return (json.dumps({"error": str(exc)}), 500, {"Content-Type": "application/json"})

#     all_results = []

#     for row_index, metadata in enumerate(all_metadata_rows):
#         row_label = f"row[{row_index}] id={metadata.get('_source_id', '?')}"
#         logger.info("--- Processing %s | %s ---", row_label, _redact(metadata))

#         try:
#             targets = resolve_target_entries(metadata, row_label=row_label)
#         except Exception as exc:
#             logger.error("Skipping %s — could not resolve target: %s", row_label, exc, exc_info=True)
#             all_results.append({"row": row_label, "status": "skipped", "detail": str(exc)})
#             continue

#         logger.info("%s → %d target entry(s) resolved.", row_label, len(targets))

#         for project, dataset, table in targets:
#             # אם table הוא None, נתייג את ה-Dataset. אחרת, נתייג את הטבלה.
#             target_ref = f"{project}.{dataset}.{table}" if table else f"{project}.{dataset} (Dataset)"
#             try:
#                 resp = update_dataplex_aspect(
#                     project=project,
#                     dataset=dataset,
#                     table=table,
#                     location=TARGET_LOCATION,
#                     aspect_type_id=ASPECT_TYPE_ID,
#                     data_dict=metadata,
#                 )
#                 logger.info("Updated entry %s → %s", target_ref, resp.name)
#                 all_results.append({"row": row_label, "target": target_ref, "status": "ok"})
#             except Exception as exc:
#                 logger.error("Failed to update %s: %s", target_ref, exc, exc_info=True)
#                 all_results.append({"row": row_label, "target": target_ref, "status": "error", "detail": str(exc)})

#     success = sum(1 for r in all_results if r["status"] == "ok")
#     skipped = sum(1 for r in all_results if r["status"] == "skipped")
#     logger.info(
#         "=== Sync complete: %d succeeded / %d skipped / %d errors (total=%d) ===",
#         success, skipped, len(all_results) - success - skipped, len(all_results),
#     )
#     return (
#         json.dumps({
#             "processed": len(all_results),
#             "succeeded": success,
#             "skipped":   skipped,
#             "results":   all_results,
#         }),
#         200,
#         {"Content-Type": "application/json"},
#     )

# ---------------------------------------------------------------------------
# Cloud Function entry-point (UPDATED)
# ---------------------------------------------------------------------------
@functions_framework.http
def main(request):
    logger.info("=== Dataplex sync started ===")

    try:
        all_metadata_rows = fetch_all_metadata_from_bigquery()
        logger.info("Fetched %d processed row(s) from BigQuery.", len(all_metadata_rows))
    except Exception as exc:
        logger.critical("Fatal error fetching rows: %s", exc, exc_info=True)
        return (json.dumps({"error": str(exc)}), 500, {"Content-Type": "application/json"})

    all_results = []
    
    # שלב חדש: תכנון כל משימות העדכון לפי הלוגיקה של קיבוץ ופרפיקסים
    tasks = plan_sync_tasks(all_metadata_rows)
    logger.info("Planning complete. Total %d Dataplex entries to update.", len(tasks))

    for task in tasks:
        project = task["project"]
        dataset = task["dataset"]
        table = task["table"]
        metadata = task["metadata"]
        
        target_ref = f"{project}.{dataset}.{table}" if table else f"{project}.{dataset} (Dataset)"
        row_label = f"source_id={metadata.get('_source_id', '?')}"
        
        try:
            resp = update_dataplex_aspect(
                project=project,
                dataset=dataset,
                table=table,
                location=TARGET_LOCATION,
                aspect_type_id=ASPECT_TYPE_ID,
                data_dict=metadata,
            )
            logger.info("Updated entry %s → %s", target_ref, resp.name)
            all_results.append({"row": row_label, "target": target_ref, "status": "ok"})
        except Exception as exc:
            logger.error("Failed to update %s: %s", target_ref, exc, exc_info=True)
            all_results.append({"row": row_label, "target": target_ref, "status": "error", "detail": str(exc)})

    success = sum(1 for r in all_results if r["status"] == "ok")
    errors = sum(1 for r in all_results if r["status"] == "error")
    
    logger.info(
        "=== Sync complete: %d succeeded / %d errors (total=%d) ===",
        success, errors, len(all_results),
    )
    
    return (
        json.dumps({
            "planned_tasks": len(tasks),
            "succeeded": success,
            "errors": errors,
            "results": all_results,
        }),
        200,
        {"Content-Type": "application/json"},
    )

# ---------------------------------------------------------------------------
# Step 1 — Fetch & parse ALL matching Monday.com rows from BigQuery
# ---------------------------------------------------------------------------
def fetch_all_metadata_from_bigquery() -> list[dict]:
    client = bigquery.Client(project=SOURCE_PROJECT)

    query = f"""
        SELECT id, json_str
        FROM `{SOURCE_PROJECT}.{SOURCE_DATASET}.{SOURCE_TABLE}`
        WHERE id = @row_id
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("row_id", "INT64", int(ROW_ID))]
    )

    rows = list(client.query(query, job_config=job_config).result())

    if not rows:
        raise ValueError(f"No rows found with id='{ROW_ID}'")

    results = []
    for bq_row in rows:
        source_id = bq_row.get("id", "unknown")
        raw_json  = bq_row.get("json_str")

        if not raw_json:
            continue

        try:
            metadata = _parse_monday_json(raw_json)
            
            # --- שינוי 1: פיצול שדות DB מרובים המופרדים בפסיק ---
            db_string = metadata.get("db", "")
            dbs_list = [d.strip() for d in db_string.split(",") if d.strip()]
            
            if not dbs_list:
                logger.warning("Row id='%s' has empty DB after splitting — skipping.", source_id)
                continue
                
            # יצירת אובייקט עבור כל DB בנפרד
            for single_db in dbs_list:
                meta_copy = metadata.copy()
                meta_copy["db"] = single_db
                meta_copy["_source_id"] = source_id
                results.append(meta_copy)
                
        except ValueError as exc:
            logger.warning("Row id='%s' failed to parse — skipping. Reason: %s", source_id, exc)

    return results

def _parse_monday_json(raw_json) -> dict:
    if isinstance(raw_json, dict):
        payload = raw_json
    else:
        try:
            payload = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Failed to parse json_str as JSON: {exc}") from exc

    column_values = payload.get("column_values", [])
    extracted: dict = {internal: "" for internal in COLUMN_MAP.values()}

    for entry in column_values:
        title = (entry.get("column") or {}).get("title", "").strip()
        text_val = entry.get("text")
        if not text_val:
            text_val = entry.get("display_value") or ""
        text = str(text_val).strip()

        internal_key = COLUMN_MAP.get(title)
        if internal_key:
            extracted[internal_key] = text

    # missing = [k for k in ("project_name", "system_name", "project_manager", "db") if not extracted.get(k)]
    # if missing:
    #     raise ValueError(f"Mandatory fields missing: {missing}")
    # --- התיקון: רק ה-DB מוגדר כשדה חובה ---
    if not extracted.get("db"):
        raise ValueError("Mandatory field missing: ['db']")
    return extracted

# # ---------------------------------------------------------------------------
# # Step 2 — Resolve target entry (Dataset or Table)
# # ---------------------------------------------------------------------------
# def resolve_target_entries(
#     metadata: dict,
#     row_label: str = "",
# ) -> list[tuple[str, str, str]]:
#     """
#     Returns a list of (project, dataset, table) tuples.
#     If 'table' is None, it means the target is the Dataset itself.
#     """
#     db      = metadata["db"]
#     prefix  = metadata.get("prefix", "").strip()
#     dataset = db 

#     if db == MSS_PRODUCTION_DB and not prefix:
#         logger.warning("%s | mss_production but empty 'prefix' — skipping.", row_label)
#         return []

#     client = bigquery.Client(project=TARGET_PROJECT)
#     alt_dataset = f"MSSQL_{dataset.lower()}"
    
#     # בדיקה שה-Dataset אכן קיים
#     try:
#         client.get_dataset(f"{TARGET_PROJECT}.{dataset}")
#     except NotFound:
#         try:
#             client.get_dataset(f"{TARGET_PROJECT}.{alt_dataset}")
#             dataset = alt_dataset 
#         except NotFound:
#              raise RuntimeError(f"Dataset not found: '{db}' or '{alt_dataset}'")
             
#     # --- שינוי 2: החלטה אם להחזיר את רמת ה-Dataset או רמת הטבלאות ---
#     if db == MSS_PRODUCTION_DB:
#         all_tables = list(client.list_tables(f"{TARGET_PROJECT}.{dataset}"))
#         filtered = [t for t in all_tables if t.table_id.startswith(prefix)]
#         logger.info("%s | mss_production mode: %d table(s) match prefix '%s'.", row_label, len(filtered), prefix)
#         return [(TARGET_PROJECT, dataset, t.table_id) for t in filtered]
#     else:
#         logger.info("%s | Standard mode: annotating Dataset '%s' directly.", row_label, dataset)
#         return [(TARGET_PROJECT, dataset, None)] # None מציין שמדובר ב-Dataset

from collections import defaultdict

# ---------------------------------------------------------------------------
# Step 2 — Plan target entries (Group by DB and resolve longest prefix)
# ---------------------------------------------------------------------------
def plan_sync_tasks(all_metadata_rows) -> list[dict]:
    """
    Groups rows by DB, fetches tables for each dataset, and determines the 
    best matching metadata (Aspect) for each table based on longest prefix.
    Returns a list of tasks (dicts) to be executed.
    """
    # 1. קיבוץ שורות לפי DB
    db_to_rows = defaultdict(list)
    for row in all_metadata_rows:
        db = row.get("db", "").strip().lower()
        db_to_rows[db].append(row)
        
    tasks = []
    client = bigquery.Client(project=TARGET_PROJECT)

    for db, rows in db_to_rows.items():
        db = rows[0].get("db", "").strip()
        prefix_rows = []
        fallback_row = None
        
        # 2. הפרדת שורות עם פרפיקס לשורת ברירת מחדל
        for r in rows:
            # חילוץ מילה ראשונה וניקוי רווחים
            raw_prefix = r.get("prefix", "").strip()
            clean_prefix = raw_prefix.split()[0] if raw_prefix else ""
            r["prefix"] = clean_prefix  # שמירת הערך הנקי חזרה
            
            if clean_prefix:
                prefix_rows.append(r)
            else:
                fallback_row = r
        logger.info("GROUPING CHECK: DB '%s' grouped with %d prefix rows, fallback exists: %s", 
                    db, len(prefix_rows), bool(fallback_row))        
        # 3. מיון שורות הפרפיקס מהארוך לקצר (כדי לתפוס קודם את BC ורק אז את B)
        prefix_rows.sort(key=lambda x: len(x.get("prefix", "")), reverse=True)
        
        # 4. מציאת ה-Dataset הנכון (בדיקה מול BQ)
        dataset = db
        alt_dataset = f"MSSQL_{dataset.lower()}"
        try:
            client.get_dataset(f"{TARGET_PROJECT}.{dataset}")
        except NotFound:
            try:
                client.get_dataset(f"{TARGET_PROJECT}.{alt_dataset}")
                dataset = alt_dataset 
            except NotFound:
                logger.error("Dataset not found: '%s' or '%s'. Skipping.", db, alt_dataset)
                continue
                
        # 5. שיבוץ משימות לפי הלוגיקה
        if db == MSS_PRODUCTION_DB:
            if not prefix_rows:
                logger.warning("DB '%s' has no prefix rows. Skipping.", db)
                continue
            
            all_tables = list(client.list_tables(f"{TARGET_PROJECT}.{dataset}"))
            for table in all_tables:
                t_name = table.table_id
                for pr in prefix_rows:
                    if t_name.startswith(pr["prefix"]):
                        tasks.append({"project": TARGET_PROJECT, "dataset": dataset, "table": t_name, "metadata": pr})
                        break # ברגע שמצאנו את ההתאמה הארוכה ביותר, עוצרים
                        
        else: # שאר ה-DBs
            if not prefix_rows:
                # אין פרפיקסים בכלל ב-DB הזה -> נתייג רק את ה-Dataset עצמו
                if fallback_row:
                    tasks.append({"project": TARGET_PROJECT, "dataset": dataset, "table": None, "metadata": fallback_row})
            else:
                # יש גם פרפיקסים וגם (אולי) ברירת מחדל -> עוברים טבלה טבלה
                all_tables = list(client.list_tables(f"{TARGET_PROJECT}.{dataset}"))
                for table in all_tables:
                    t_name = table.table_id
                    matched = False
                    
                    for pr in prefix_rows:
                        if t_name.startswith(pr["prefix"]):
                            tasks.append({"project": TARGET_PROJECT, "dataset": dataset, "table": t_name, "metadata": pr})
                            matched = True
                            break # ברגע שמצאנו את ההתאמה הארוכה ביותר, עוצרים
                            
                    # אם הטבלה לא התאימה לאף פרפיקס, ויש לנו שורת ברירת מחדל - נשתמש בה
                    if not matched and fallback_row:
                        tasks.append({"project": TARGET_PROJECT, "dataset": dataset, "table": t_name, "metadata": fallback_row})

    return tasks

# ---------------------------------------------------------------------------
# Step 3 — Write Dataplex Aspect
# ---------------------------------------------------------------------------
def update_dataplex_aspect(
    project: str,
    dataset: str,
    table: str, # יכול להיות None עכשיו
    location: str,
    aspect_type_id: str,
    data_dict: dict,
) -> dataplex_v1.Entry:
    
    dataplex_client = dataplex_v1.CatalogServiceClient()

    # --- שינוי נתיב ה-Entry בהתאם לסוג (Dataset או Table) ---
    if table:
        bq_resource = f"bigquery.googleapis.com/projects/{project}/datasets/{dataset}/tables/{table}"
    else:
        bq_resource = f"bigquery.googleapis.com/projects/{project}/datasets/{dataset}"
        
    entry_name = (
        f"projects/{project}/locations/{location}"
        f"/entryGroups/@bigquery/entries/{bq_resource}"
    )

    aspect_type_name = f"projects/{project}/locations/{location}/aspectTypes/{aspect_type_id}"
    characterization_link = _safe_str(data_dict.get("characterization_link"))

    aspect_data = {
        "project-name":          _safe_str(data_dict.get("project_name")),
        "system-name":           _safe_str(data_dict.get("system_name")),
        "project-manager":       _safe_str(data_dict.get("project_manager")),
        "characterization-link": characterization_link,
    }

    aspect = dataplex_v1.Aspect()
    aspect.aspect_type = aspect_type_name
    aspect.data = aspect_data

    entry       = dataplex_v1.Entry()
    entry.name  = entry_name
    aspect_key  = f"{project}.{location}.{aspect_type_id}"
    entry.aspects = {aspect_key: aspect}

    update_mask = field_mask_pb2.FieldMask(paths=["aspects"])

    request = dataplex_v1.UpdateEntryRequest(
        entry=entry,
        update_mask=update_mask,
        allow_missing=False, 
    )

    return dataplex_client.update_entry(request=request)

def _safe_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()

def _redact(metadata: dict) -> dict:
    return {k: v for k, v in metadata.items() if k not in ("characterization_link",)}

if __name__ == "__main__":
    class DummyRequest:
        pass
    response = main(DummyRequest())
    print(response)
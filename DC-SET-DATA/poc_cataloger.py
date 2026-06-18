"""
GCP Metadata Cataloging POC
----------------------------
Extracts BigQuery table metadata, analyzes it with Gemini 2.5 Flash,
and applies structured Aspect metadata to the table via Dataplex.
"""
import json
from google.cloud import bigquery
from google.cloud import dataplex_v1
from google import genai

# ─────────────────────────────────────────────
# ⚙️ CONFIG — הנתונים מוגדרים בדיוק לפי הטרמינל שלך
# ─────────────────────────────────────────────
PROJECT_ID        = "dgt-gcp-econ-dev-datalake" 
DATASET_ID        = "MSSQL_foreign_trade_resources" 
TABLE_ID          = "purchase_requests" 
DATAPLEX_LOCATION = "me-west1" 

ASPECT_TYPE_ID   = "ui-metadata"  
GEMINI_MODEL     = "gemini-3.0-flash"                  # Gemini model to use
SAMPLE_ROWS      = 10                                  # Number of sample rows to pull for analysis
# ─────────────────────────────────────────────

def extract_bigquery_metadata(project: str, dataset: str, table: str) -> dict:
    """שליפת הסכמה ומדגם נתונים מ-BigQuery"""
    bq = bigquery.Client(project=project)
    table_ref = f"{project}.{dataset}.{table}"
    bq_table  = bq.get_table(table_ref)

    schema = [
        {"name": field.name, "type": field.field_type}
        for field in bq_table.schema
    ]

    query = f"""
        SELECT *
        FROM `{table_ref}`
        LIMIT {SAMPLE_ROWS}
    """
    rows = list(bq.query(query).result())
    sample_rows = [dict(row) for row in rows]

    for row in sample_rows:
        for k, v in row.items():
            if not isinstance(v, (str, int, float, bool, type(None))):
                row[k] = str(v)

    print(f"[BQ] Schema: {len(schema)} columns | Sample rows fetched: {len(sample_rows)}")
    return {"schema": schema, "sample_rows": sample_rows}

def analyze_with_gemini(metadata: dict) -> dict:
    """ניתוח סמנטי של הדאטה באמצעות Gemini"""
    client = genai.Client(vertexai=True)

    schema_str = json.dumps(metadata["schema"], indent=2)
    sample_str = json.dumps(metadata["sample_rows"], indent=2, default=str)

    prompt = f"""
You are a data governance assistant.
Analyze the BigQuery table schema and sample rows below and classify the table.

Return ONLY a valid JSON object with exactly these three boolean fields:
  - "is_financial": true if the table contains financial data such as amounts, costs, budgets, pricing, revenue, billing, or monetary transactions.
  - "is_geographical": true if the table contains location data such as country, city, region, district, address, latitude, longitude, or any spatial reference.
  - "is_sensitive": true if the table contains personally identifiable information (PII) such as Israeli ID numbers (Teudat Zehut), full names, email addresses, phone numbers, passwords, or other credentials.

Do not include explanations, markdown fences, or any text outside the JSON object.

--- SCHEMA ---
{schema_str}

--- SAMPLE ROWS ---
{sample_str}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    result = json.loads(raw)
    for field in ("is_financial", "is_geographical", "is_sensitive"):
        if field not in result:
            raise ValueError(f"Gemini response missing field: {field}")
        result[field] = bool(result[field])

    print(f"[Gemini] Classification: {result}")
    return result

def update_dataplex_aspect(project: str, dataset: str, table: str, location: str, aspect_type_id: str, classification: dict) -> None:
    """כתיבת התוצאות לפי המבנה הרשמי שנחשף בטרמינל שלך"""
    dataplex_client = dataplex_v1.CatalogServiceClient()

    # 🎯 הכתובת האמיתית והמלאה שגוגל יצרה אוטומטית לטבלה שלכם!
    entry_name = f"projects/{project}/locations/{location}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project}/datasets/{dataset}/tables/{table}"
    aspect_type_name = f"projects/{project}/locations/{location}/aspectTypes/{aspect_type_id}"
    
    print(f"[Dataplex] Targeting official entry path: {entry_name}")

    aspect = dataplex_v1.Aspect()
    aspect.aspect_type = aspect_type_name
    
    # ✨ תרגום קו תחתון של ה-AI למקפים של שדות ה-Dataplex שלך
    aspect.data = {
        "is-financial": classification["is_financial"],
        "is-geographical": classification["is_geographical"],
        "is-sensitive": classification["is_sensitive"]
    }

    entry = dataplex_v1.Entry()
    entry.name = entry_name
    
    aspect_key = f"{project}.{location}.{aspect_type_id}"
    entry.aspects = {aspect_key: aspect}

    request = dataplex_v1.UpdateEntryRequest(
        entry=entry,
        update_mask={"paths": ["aspects"]},
        allow_missing=False,
    )

    updated = dataplex_client.update_entry(request=request)
    print(f"[Dataplex] Success! Aspect '{aspect_type_id}' applied to entry: {updated.name}")

def main():
    print("=" * 60)
    print(f"Table : {PROJECT_ID}.{DATASET_ID}.{TABLE_ID}")
    print(f"Model : {GEMINI_MODEL}")
    print("=" * 60)

    metadata = extract_bigquery_metadata(PROJECT_ID, DATASET_ID, TABLE_ID)
    classification = analyze_with_gemini(metadata)
    
    update_dataplex_aspect(
        project=PROJECT_ID, 
        dataset=DATASET_ID, 
        table=TABLE_ID,
        location=DATAPLEX_LOCATION, 
        aspect_type_id=ASPECT_TYPE_ID,
        classification=classification
    )
    print("\n✅ POC COMPLETE. Final classification written to Dataplex Knowledge Catalog!")
    print(json.dumps(classification, indent=2))

if __name__ == "__main__":
    main()







# def extract_bigquery_metadata(project: str, dataset: str, table: str) -> dict:
#     """
#     Fetches schema and a sample of rows from a BigQuery table.
#     Returns a dict with 'schema' (list of {name, type}) and 'sample_rows' (list of dicts).
#     """
#     bq = bigquery.Client(project=project)
#     table_ref = f"{project}.{dataset}.{table}"
#     bq_table  = bq.get_table(table_ref)

#     schema = [
#         {"name": field.name, "type": field.field_type}
#         for field in bq_table.schema
#     ]

#     # # Build a WHERE clause that filters out NULLs on every column (best-effort sample)
#     # non_null_filters = " AND ".join(
#     #     f"`{field.name}` IS NOT NULL" for field in bq_table.schema
#     # )
#     # where_clause = f"WHERE {non_null_filters}" if non_null_filters else ""

#     # query = f"""
#     #     SELECT *
#     #     FROM `{table_ref}`
#     #     {where_clause}
#     #     LIMIT {SAMPLE_ROWS}
#     # """
#     query = f"""
#         SELECT *
#         FROM `{table_ref}`
#         LIMIT {SAMPLE_ROWS}
#     """
#     rows = list(bq.query(query).result())

#     sample_rows = [dict(row) for row in rows]
#     # Convert any non-serialisable types to strings
#     for row in sample_rows:
#         for k, v in row.items():
#             if not isinstance(v, (str, int, float, bool, type(None))):
#                 row[k] = str(v)

#     print(f"[BQ] Schema: {len(schema)} columns | Sample rows fetched: {len(sample_rows)}")
#     return {"schema": schema, "sample_rows": sample_rows}


# def analyze_with_gemini(metadata: dict) -> dict:
#     """
#     Sends the schema + sample rows to Gemini and parses the returned JSON
#     with three boolean fields: is_financial, is_geographical, is_sensitive.
#     """
#     client = genai.Client(vertexai=True)

#     schema_str = json.dumps(metadata["schema"], indent=2)
#     sample_str = json.dumps(metadata["sample_rows"], indent=2, default=str)

#     prompt = f"""
# You are a data governance assistant.
# Analyze the BigQuery table schema and sample rows below and classify the table.

# Return ONLY a valid JSON object with exactly these three boolean fields:
#   - "is_financial": true if the table contains financial data such as amounts, costs,
#     budgets, pricing, revenue, billing, or monetary transactions.
#   - "is_geographical": true if the table contains location data such as country, city,
#     region, district, address, latitude, longitude, or any spatial reference.
#   - "is_sensitive": true if the table contains personally identifiable information (PII)
#     such as Israeli ID numbers (Teudat Zehut), full names, email addresses, phone
#     numbers, passwords, or other credentials.

# Do not include explanations, markdown fences, or any text outside the JSON object.

# --- SCHEMA ---
# {schema_str}

# --- SAMPLE ROWS ---
# {sample_str}
# """

#     response = client.models.generate_content(
#         model=GEMINI_MODEL,
#         contents=prompt,
#     )

#     raw = response.text.strip()
#     # Strip accidental markdown fences if the model adds them
#     if raw.startswith("```"):
#         raw = raw.split("```")[1]
#         if raw.startswith("json"):
#             raw = raw[4:]
#     raw = raw.strip()

#     result = json.loads(raw)

#     # Validate and coerce to bool
#     for field in ("is_financial", "is_geographical", "is_sensitive"):
#         if field not in result:
#             raise ValueError(f"Gemini response missing field: {field}")
#         result[field] = bool(result[field])

#     print(f"[Gemini] Classification: {result}")
#     return result


# def update_dataplex_aspect(
#     project: str,
#     dataset: str,
#     table: str,
#     location: str,
#     aspect_type_id: str,
#     classification: dict,
# ) -> None:
#     """
#     Applies (creates or replaces) a Dataplex Aspect on the BigQuery table entry.

#     The Dataplex entry name for a BigQuery table follows this pattern:
#       projects/{project}/locations/{location}/entryGroups/@bigquery/entries/
#         {project}.{location}.{dataset}.{table}
#     """
#     dataplex_client = dataplex_v1.CatalogServiceClient()

#     # Fully-qualified Aspect Type resource name
#     aspect_type_name = (
#         f"projects/{project}/locations/{location}"
#         f"/aspectTypes/{aspect_type_id}"
#     )

#     # BigQuery entry name convention used by Dataplex auto-sync
#     entry_name = (
#         f"projects/{project}/locations/{location}"
#         f"/entryGroups/@bigquery/entries/"
#         f"{project}.{location}.{dataset}.{table}"
#     )

#     # Build the Aspect payload
#     aspect = dataplex_v1.Aspect()
#     aspect.aspect_type = aspect_type_name
#     # aspect.data = classification   # dict with is_financial, is_geographical, is_sensitive
#     aspect.data = {
#             "is-financial": classification["is_financial"],
#             "is-geographical": classification["is_geographical"],
#             "is-sensitive": classification["is_sensitive"]
#         }

#     entry = dataplex_v1.Entry()
#     entry.name = entry_name
#     aspect_key = f"{project}.{location}.{aspect_type_id}"
#     entry.aspects = {aspect_key: aspect}
#     # entry.aspects = {aspect_type_id: aspect}

#     # update_mask restricts the patch to only the aspects field
#     request = dataplex_v1.UpdateEntryRequest(
#         entry=entry,
#         update_mask={"paths": ["aspects"]},
#         allow_missing=False,
#     )

#     updated = dataplex_client.update_entry(request=request)
#     print(f"[Dataplex] Aspect '{aspect_type_id}' applied to entry: {updated.name}")


# def main():
#     print("=" * 60)
#     print(f"Table : {PROJECT_ID}.{DATASET_ID}.{TABLE_ID}")
#     print(f"Model : {GEMINI_MODEL}")
#     print("=" * 60)

#     # Step 1 — Extract metadata from BigQuery
#     metadata = extract_bigquery_metadata(PROJECT_ID, DATASET_ID, TABLE_ID)

#     # Step 2 — Classify with Gemini
#     classification = analyze_with_gemini(metadata)

#     # Step 3 — Update Dataplex entry with the classification Aspect
#     update_dataplex_aspect(
#         project=PROJECT_ID,
#         dataset=DATASET_ID,
#         table=TABLE_ID,
#         location=DATAPLEX_LOCATION,
#         aspect_type_id=ASPECT_TYPE_ID,
#         classification=classification,
#     )

#     print("\n✅ Done. Final classification written to Dataplex:")
#     print(json.dumps(classification, indent=2))


# if __name__ == "__main__":
#     main()
"""
להקליד בשורת החיפוש aspect:ui-metadata.is-financial=true
"""
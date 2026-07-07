import json
import time
from google.cloud import bigquery
from google.cloud import dataplex_v1
from google import genai

# ─────────────────────────────────────────────
# ⚙️ CONFIG
# ─────────────────────────────────────────────
PROJECT_ID              = "dgt-gcp-econ-dev-datalake" 
DATAPLEX_LOCATION       = "me-west1" 
ASPECT_TYPE_ID          = "ui-metadata"  
GEMINI_MODEL            = "gemini-3.5-flash"                  
SAMPLE_ROWS             = 10

# שליטה והגבלות ריצה
MAX_TABLES_TO_PROCESS   = 700  # הגבלה כדי למנוע חריגת עלויות בטעות
MAX_RETRIES             = 3   # מספר ניסיונות מול ה-API של Gemini
RETRY_DELAY_SECONDS     = 5   # זמן המתנה בין ניסיונות כושלים (Rate Limits)

# Datasets שיש להתעלם מהם
EXCLUDED_DATASETS = {
    "dataplex_insights_outputs",
    "temp",
    "Logging",
    "admin",
    "metrics",
}

# דגל לשליטה האם לדלג על טבלאות שכבר תויגו (מומלץ לשים True בשוטף, ו-False כשמוסיפים שדות חדשים למודל)
SKIP_ALREADY_TAGGED = True
# ─────────────────────────────────────────────

def extract_schema(fields, prefix=""):
    """
    פונקציה רקורסיבית לשליפת סכמה, כולל פירוק של שדות מסוג RECORD/STRUCT.
    כך ה-AI יראה את הנתיב המלא: customer.email
    """
    schema_list = []
    for field in fields:
        full_name = f"{prefix}{field.name}"
        schema_list.append({"name": full_name, "type": field.field_type})
        
        # אם זה RECORD, נצלול פנימה כדי להוציא את תתי-השדות
        if field.field_type == "RECORD":
            schema_list.extend(extract_schema(field.fields, prefix=f"{full_name}."))
            
    return schema_list

# def extract_bigquery_metadata(bq_client: bigquery.Client, project: str, dataset: str, table: str) -> dict:
#     """שליפת הסכמה ומדגם נתונים מ-BigQuery"""
#     table_ref = f"{project}.{dataset}.{table}"
#     bq_table  = bq_client.get_table(table_ref)

#     # שימוש בפונקציה הרקורסיבית החדשה
#     schema = extract_schema(bq_table.schema)

#     query = f"SELECT * FROM `{table_ref}` LIMIT {SAMPLE_ROWS}"
#     rows = list(bq_client.query(query).result())
#     sample_rows = [dict(row) for row in rows]

#     # המרה לטקסט כדי למנוע שגיאות סריאליזציה ב-JSON
#     for row in sample_rows:
#         for k, v in row.items():
#             if not isinstance(v, (str, int, float, bool, type(None))):
#                 row[k] = str(v)

#     return {"schema": schema, "sample_rows": sample_rows}
def extract_bigquery_metadata(bq_client: bigquery.Client, project: str, dataset: str, table: str) -> dict:
    """שליפת הסכמה ומדגם נתונים מ-BigQuery עם הגנת אורך (Truncation) ושמירה על סוגי נתונים"""
    table_ref = f"{project}.{dataset}.{table}"
    bq_table  = bq_client.get_table(table_ref)

    # שימוש בפונקציה הרקורסיבית (בהנחה שקיימת אצלך בקובץ)
    schema = extract_schema(bq_table.schema)

    query = f"SELECT * FROM `{table_ref}` LIMIT {SAMPLE_ROWS}"
    rows = list(bq_client.query(query).result())
    sample_rows = [dict(row) for row in rows]

    # חיתוך מחרוזות מפלצתיות תוך שמירה על טיפוסי הנתונים המקוריים
    for row in sample_rows:
        for k, v in row.items():
            if isinstance(v, (str, int, float, bool, type(None))):
                normalized = v
            else:
                normalized = str(v)

            # מבצעים חיתוך אך ורק אם זה טקסט והוא ארוך מדי
            if isinstance(normalized, str) and len(normalized) > 500:
                normalized = normalized[:500] + "... [TRUNCATED]"

            row[k] = normalized

    return {"schema": schema, "sample_rows": sample_rows}
def analyze_with_gemini(genai_client, metadata: dict) -> dict:
    """ניתוח סמנטי ב-Gemini כולל ולידציה נוקשה ומנגנון Retry"""
    schema_str = json.dumps(metadata["schema"], indent=2)
    sample_str = json.dumps(metadata["sample_rows"], indent=2, default=str)

    prompt = f"""
You are a data governance assistant.
Analyze the BigQuery table schema and sample rows below and classify the table.

Return ONLY a valid JSON object with EXACTLY these fields:
  - "is_financial": (boolean) true if the table contains financial data.
  - "financial_columns": (string) A comma-separated list of column names that triggered the financial classification. If none, return "".
  - "is_geographical": (boolean) true if the table contains location/spatial data.
  - "geographical_columns": (string) A comma-separated list of column names for geographical data. If none, return "".
  - "is_sensitive": (boolean) true if the table contains PII.
  - "sensitive_columns": (string) A comma-separated list of sensitive column names. If none, return "".

Do not include explanations or markdown fences outside the JSON object.

--- SCHEMA ---
{schema_str}

--- SAMPLE ROWS ---
{sample_str}
"""

    for attempt in range(MAX_RETRIES):
        try:
            response = genai_client.models.generate_content(
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
            
            # --- Strict Validation (ההגנה הקריטית מפני תשובות שגויות) ---
            required_bools = ["is_financial", "is_geographical", "is_sensitive"]
            required_strings = ["financial_columns", "geographical_columns", "sensitive_columns"]
            
            for field in required_bools:
                if field not in result:
                    raise ValueError(f"Missing boolean field: {field}")
                if not isinstance(result[field], bool):
                    raise ValueError(f"Field '{field}' must be a strict boolean, got {type(result[field])}")
                    
            for field in required_strings:
                if field not in result:
                    raise ValueError(f"Missing string field: {field}")
                if not isinstance(result[field], str):
                    raise ValueError(f"Field '{field}' must be a string, got {type(result[field])}")

            return result

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"      ⚠️ Gemini API Error (Attempt {attempt+1}/{MAX_RETRIES}): {e}. Retrying in {RETRY_DELAY_SECONDS}s...")
                time.sleep(RETRY_DELAY_SECONDS)
            else:
                raise RuntimeError(f"Failed to analyze with Gemini after {MAX_RETRIES} attempts. Last error: {e}")

def update_dataplex_aspect(dataplex_client, project: str, dataset: str, table: str, location: str, aspect_type_id: str, classification: dict) -> None:
    """כתיבת התוצאות ל-Dataplex"""
    entry_name = f"projects/{project}/locations/{location}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project}/datasets/{dataset}/tables/{table}"
    aspect_type_name = f"projects/{project}/locations/{location}/aspectTypes/{aspect_type_id}"
    
    aspect = dataplex_v1.Aspect()
    aspect.aspect_type = aspect_type_name
    
    aspect.data = {
        "is-financial": classification["is_financial"],
        "financial-columns": classification["financial_columns"],
        "is-geographical": classification["is_geographical"],
        "geographical-columns": classification["geographical_columns"],
        "is-sensitive": classification["is_sensitive"],
        "sensitive-columns": classification["sensitive_columns"]
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
    print(f"      ✅ Applied aspect to: {updated.name.split('/')[-1]}")

def is_table_already_tagged(dataplex_client, project: str, dataset: str, table: str, location: str, aspect_type_id: str) -> bool:
    """בודק ב-Dataplex האם הטבלה כבר עברה קטלוג, כדי לחסוך עלויות AI"""
    entry_name = f"projects/{project}/locations/{location}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project}/datasets/{dataset}/tables/{table}"
    aspect_type_name = f"projects/{project}/locations/{location}/aspectTypes/{aspect_type_id}"
    
    try:
        # מבקשים מגוגל את הרשומה, ורק את האספקט הספציפי שלנו
        request = dataplex_v1.GetEntryRequest(
            name=entry_name,
            view=dataplex_v1.EntryView.CUSTOM,
            aspect_types=[aspect_type_name]
        )
        entry = dataplex_client.get_entry(request=request)
        
        # --- התיקון הקריטי: חיפוש לפי סיומת במקום שם פרויקט מפורש ---
        if entry.aspects:
            for key in entry.aspects.keys():
                if key.endswith(f".{aspect_type_id}"):
                    return True
                    
        return False
        
    except Exception:
        # אם יש שגיאה 404 (הרשומה עדיין לא נוצרה ב-Dataplex) או כל בעיה אחרת, נניח שלא תויג
        return False

def main():
    print(f"🚀 Starting Project-Wide BQ Classification: {PROJECT_ID}")
    
    bq_client = bigquery.Client(project=PROJECT_ID)
    dataplex_client = dataplex_v1.CatalogServiceClient()
    genai_client = genai.Client(
        vertexai=True,
        project=PROJECT_ID)

    datasets = list(bq_client.list_datasets())
    processed_tables_count = 0

    skipped_tables_count = 0

    for dataset in datasets:
        if processed_tables_count >= MAX_TABLES_TO_PROCESS:
            print(f"\n⏹️ Reached MAX_TABLES_TO_PROCESS limit ({MAX_TABLES_TO_PROCESS}). Stopping execution.")
            break
            
        dataset_id = dataset.dataset_id
        
        if dataset_id in EXCLUDED_DATASETS:
            print(f"⏭️ Skipping excluded dataset: {dataset_id}")
            continue
            
        print(f"\n📁 Processing dataset: {dataset_id}")
        tables = list(bq_client.list_tables(dataset_id))
        
        for table in tables:
            if processed_tables_count >= MAX_TABLES_TO_PROCESS:
                break
                
            table_id = table.table_id
            
            # סינון חכם: מתעלמים מ-Views ומתמקדים רק בטבלאות אמיתיות
            if table.table_type != "TABLE":
                print(f"   ⏭️ Skipping non-table object: {table_id} (Type: {table.table_type})")
                continue

            # --- שימוש בדגל החדש לבדיקה אם לדלג ---
            if SKIP_ALREADY_TAGGED and is_table_already_tagged(dataplex_client, PROJECT_ID, dataset_id, table_id, DATAPLEX_LOCATION, ASPECT_TYPE_ID):
                print(f"   💸 Skipping table {table_id} (Already tagged in Dataplex)")
                skipped_tables_count += 1
                continue
            # ----------------------------------------
                
            print(f"   ⏳ Analyzing table: {table_id}...")
            
            try:
                metadata = extract_bigquery_metadata(bq_client, PROJECT_ID, dataset_id, table_id)
                classification = analyze_with_gemini(genai_client, metadata)
                update_dataplex_aspect(
                    dataplex_client, PROJECT_ID, dataset_id, table_id, 
                    DATAPLEX_LOCATION, ASPECT_TYPE_ID, classification
                )
                processed_tables_count += 1
                
            except Exception as e:
                print(f"   ❌ Error processing table {table_id}: {e}")

    print(f"\n🎉 RUN COMPLETE! Successfully processed {processed_tables_count} tables.")

if __name__ == "__main__":
    main()
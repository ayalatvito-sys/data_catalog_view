import json
import os
from datetime import datetime
from google.cloud import bigquery
# שינוי האימפורט ל-SDK החדש
from google import genai
from google.genai import types

PROJECT_ID = "dgt-gcp-econ-dev-datalake"
DATASET_ID = "MSSQL_mss_production"
BQ_LOCATION = "me-west1"
AI_LOCATION = "europe-west3"



# אתחול ה-Clients
bq_client = bigquery.Client(project=PROJECT_ID, location=BQ_LOCATION)
# הגדרת ה-Client החדש עבור Vertex AI
# אתחול ה-Client עם השרת הייעודי של אזור me-west1
ai_client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=AI_LOCATION
)
def get_tables_schema():
    """שליפת כל הטבלאות והעמודות שלהן מתוך ה-Dataset"""
    query = f"""
    SELECT 
        table_name, 
        STRING_AGG(column_name, ', ') as columns
    FROM 
        `{PROJECT_ID}.{DATASET_ID}.INFORMATION_SCHEMA.COLUMNS`
    GROUP BY 
        table_name
    """
    query_job = bq_client.query(query)
    results = query_job.result()
    
    tables_data = []
    for row in results:
        tables_data.append({
            "table_name": row.table_name,
            "columns": row.columns
        })
    return tables_data

def analyze_with_gemini(tables_schema):
    """שליחת המידע לג'מיני לצורך תיוג וסיווג"""
    
    prompt = f"""
    You are a data architecture expert. I will give you a list of tables and their columns from a migrated MSSQL database.
    Your task is to categorize each table into business domains/topics so we can display them in different tabs in our UI application.
    
    Allowed categories/tags examples: "Finance", "Customers", "Inventory", "HR", "Sales", "Logs/System", "Operations", "Marketing". 
    You can create other categories if needed, but keep them concise.
    A table can have multiple tags if it belongs to more than one topic.

    Return a JSON array of objects, where each object has exactly these keys:
    - table_name: (string)
    - primary_category: (string - the single most relevant category for the UI tab)
    - all_tags: (array of strings - all relevant categories for this table)
    - description: (string - a short 1-sentence description in Hebrew of what this table probably holds)

    Here is the data:
    {json.dumps(tables_schema)}
    """
    
    # שימוש בגרסה ספציפית שזמינה בפריסות אזוריות
    response = ai_client.models.generate_content(
        model='gemini-1.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,
        ),
    )
    
    return json.loads(response.text)

def save_to_bigquery(tagged_tables):
    """שמירת התוצאות לטבלת הניהול ב-BigQuery"""
    rows_to_insert = []
    current_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    
    for item in tagged_tables:
        rows_to_insert.append({
            "table_name": item["table_name"],
            "primary_category": item["primary_category"],
            "all_tags": item["all_tags"],
            "description": item["description"],
            "updated_at": current_time
        })
        
    table_ref = bq_client.dataset(DATASET_ID).table("app_table_metadata")
    
    # מחיקת הנתונים הישנים לפני הכנסת החדשים
    bq_client.query(f"TRUNCATE TABLE `{PROJECT_ID}.{DATASET_ID}.app_table_metadata`").result()
    
    # הכנסת הנתונים החדשים
    errors = bq_client.insert_rows_json(table_ref, rows_to_insert)
    if errors == []:
        print("הנתונים נשמרו בהצלחה בטבלת הניהול ב-BigQuery!")
    else:
        print("שגיאה בהרצת ה-Insert:", errors)

if __name__ == "__main__":
    print("1. שולף מבנה טבלאות מ-BigQuery...")
    schema_data = get_tables_schema()
    
    print(f"מצאתי {len(schema_data)} טבלאות. שולח לניתוח ב-Vertex AI Gemini...")
    ai_results = analyze_with_gemini(schema_data)
    
    print("3. שומר את התוצאות המתויגות ב-BigQuery...")
    save_to_bigquery(ai_results)
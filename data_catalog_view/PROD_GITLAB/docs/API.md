# תיעוד API — קטלוג הנתונים

כל ה-endpoints נמצאים תחת ה-prefix `/api`. ה-API אינו דורש authentication (ממשק פנימי).

---

## תוכן עניינים

1. [Health Check](#1-health-check)
2. [Datasets](#2-datasets)
3. [Tables](#3-tables)
4. [Table Profile](#4-table-profile)
5. [Relationships](#5-relationships)
6. [Catalog Stats](#6-catalog-stats)
7. [Locations](#7-locations)
8. [Pipeline Status](#8-pipeline-status)
9. [נספח — Pydantic Models](#נספח--pydantic-models)

---

## פרמטר `refresh` — קיים בכל endpoint

| שם | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `refresh` | `boolean` | `false` | כאשר `true`, מתעלם מה-backend cache ושולף נתונים עדכניים מ-GCP |

---

## 1. Health Check

### `GET /api/healthz`

**מטרה:** בדיקת תקינות ה-API ומצב החיבורים ל-GCP.

**פרמטרים:** אין.

**תגובה — 200 OK:**
```json
{
  "status": "ok",
  "bigquery_available": true,
  "dataplex_available": true,
  "project_id": "dgt-gcp-econ-dev-datalake"
}
```

**הערה:** תמיד מחזיר 200, גם כשהשירותים לא זמינים — המצב מוצג ב-payload.

**שימוש ב-Cloud Run health probe:**
```
GET /api/healthz
```

---

## 2. Datasets

### `GET /api/datasets`

**מטרה:** שליפת רשימת כל ה-datasets הפעילים בפרויקט GCP, ממוינים ומסוננים לפי הפרמטרים.

**פרמטרים:**

| שם | סוג | ברירת מחדל | ערכים חוקיים |
|---|---|---|---|
| `search` | `string` | — | חיפוש חופשי בשם ובתיאורים (EN/HE) |
| `sort_by` | `string` | `name` | `name`, `tables_count` |
| `sort_dir` | `string` | `asc` | `asc`, `desc` |
| `refresh` | `boolean` | `false` | |

**לוגיקת חיפוש (server-side):**
```python
q = search.lower()
datasets = [d for d in datasets if
    q in d.dataset_id.lower() or
    q in (d.description or "").lower() or
    q in (d.description_he or "").lower()
]
```

**תגובה — 200 OK:**
```json
{
  "datasets": [
    {
      "dataset_id": "my_dataset",
      "description": "English description from Data Catalog",
      "description_he": "תיאור בעברית מה-Dataplex Overview",
      "location": "me-west1",
      "tables_count": 42,
      "created_at": "2024-01-15T08:30:00Z",
      "last_modified": "2024-06-20T14:00:00Z"
    }
  ],
  "total": 1
}
```

**שגיאות:**

| Status | תיאור |
|---|---|
| `503` | BigQuery לא זמין |
| `500` | שגיאת שרת כללית |

---

### `GET /api/datasets/{dataset_id}`

**מטרה:** שליפת dataset בודד עם תיאוריו.

**Path Parameters:**

| שם | סוג | תיאור |
|---|---|---|
| `dataset_id` | `string` | מזהה ה-dataset ב-BigQuery |

**תגובה — 200 OK:**
```json
{
  "dataset_id": "my_dataset",
  "description": "English description",
  "description_he": "תיאור בעברית",
  "location": "me-west1",
  "tables_count": 42,
  "created_at": "2024-01-15T08:30:00Z",
  "last_modified": "2024-06-20T14:00:00Z"
}
```

**שגיאות:**

| Status | תיאור |
|---|---|
| `404` | Dataset לא נמצא |
| `503` | BigQuery לא זמין |
| `500` | שגיאת שרת כללית |

---

## 3. Tables

### `GET /api/datasets/{dataset_id}/tables`

**מטרה:** שליפת רשימת הטבלאות ב-dataset, כולל מטאדאטה מ-Dataplex.

**Path Parameters:**

| שם | סוג | תיאור |
|---|---|---|
| `dataset_id` | `string` | מזהה ה-dataset |

**Query Parameters:** `refresh` (ראה למעלה)

**תגובה — 200 OK:**
```json
{
  "tables": [
    {
      "table_id": "my_table",
      "table_type": "TABLE",
      "creation_time": "2024-01-15T08:30:00Z",
      "row_count": 100000,
      "size_bytes": 5242880,
      "last_modified": "2024-06-20T14:00:00Z",
      "is_financial": true,
      "financial_columns": "amount, total_price",
      "is_geographical": false,
      "geographical_columns": "",
      "is_sensitive": true,
      "sensitive_columns": "id_number, email",
      "project_name": "פרויקט A",
      "system_name": "מערכת ERP",
      "project_manager": "ישראל ישראלי",
      "characterization_link": "https://..."
    }
  ],
  "total": 1
}
```

**שגיאות:**

| Status | תיאור |
|---|---|
| `503` | BigQuery לא זמין |
| `500` | שגיאת שרת כללית |

---

## 4. Table Profile

### `GET /api/datasets/{dataset_id}/tables/{table_id}/profile`

**מטרה:** שליפת פרופיל נתונים ברמת עמודה מ-Dataplex DataScan.

**Path Parameters:**

| שם | סוג | תיאור |
|---|---|---|
| `dataset_id` | `string` | מזהה ה-dataset |
| `table_id` | `string` | מזהה הטבלה |

**Query Parameters:** `refresh`

**תגובה — 200 OK:**
```json
{
  "table_id": "my_table",
  "scanned_rows": 50000,
  "columns": [
    {
      "column_name": "amount",
      "data_type": "NUMERIC",
      "nullness": 0.02,
      "uniqueness": 0.98,
      "top_n": [
        { "value": "100.00", "percentage": 5.3, "count": 2650 }
      ],
      "numeric_stats": {
        "min": 0.01,
        "max": 99999.99,
        "avg": 1234.56,
        "stdDev": 500.0,
        "median": null,
        "quartiles": []
      },
      "string_stats": null,
      "datetime_stats": null
    },
    {
      "column_name": "email",
      "data_type": "STRING",
      "nullness": 0.0,
      "uniqueness": 1.0,
      "top_n": [],
      "numeric_stats": null,
      "string_stats": {
        "min_length": 5,
        "max_length": 120,
        "avg_length": 22.3
      },
      "datetime_stats": null
    }
  ]
}
```

**שגיאות:**

| Status | תיאור |
|---|---|
| `404` | Dataplex DataScan לא נמצא עבור הטבלה |
| `503` | BigQuery לא זמין |
| `500` | שגיאת שרת כללית |

---

## 5. Relationships

### `GET /api/datasets/{dataset_id}/relationships`

**מטרה:** שליפת קשרים בין טבלאות שנוצרו ע"י Dataplex Insights.

**Path Parameters:**

| שם | סוג | תיאור |
|---|---|---|
| `dataset_id` | `string` | מזהה ה-dataset (מקור **או** יעד) |

**Query Parameters:**

| שם | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `min_confidence` | `float` | `0.5` | סף מינימלי ל-confidence score (0.0–1.0) |
| `refresh` | `boolean` | `false` | |

**תגובה — 200 OK:**
```json
{
  "relationships": [
    {
      "edge_id": "edge_001",
      "source_dataset": "my_dataset",
      "source_table": "orders",
      "target_dataset": "other_dataset",
      "target_table": "customers",
      "relationship_type": "FOREIGN_KEY",
      "confidence_score": 0.92,
      "description_edge": "orders.customer_id → customers.id",
      "last_updated": "2024-06-20T10:00:00Z"
    }
  ],
  "total": 1
}
```

**הערה:** הקשרים נשלפים מ-`dataplex_insights_outputs.insights_relationship_edges` ב-BigQuery, לא ממנגנון Dataplex API ישיר.

**שגיאות:**

| Status | תיאור |
|---|---|
| `503` | BigQuery לא זמין |
| `500` | שגיאת שרת כללית |

---

## 6. Catalog Stats

### `GET /api/catalog/stats`

**מטרה:** מספרי סיכום גלובאליים עבור ה-StatsBar בעמוד הראשי.

**Query Parameters:** `refresh`

**תגובה — 200 OK:**
```json
{
  "total_datasets": 25,
  "total_tables": 340,
  "locations_count": 2,
  "project_id": "dgt-gcp-econ-dev-datalake",
  "last_updated": "2024-06-21T12:00:00Z"
}
```

**שגיאות:**

| Status | תיאור |
|---|---|
| `503` | BigQuery לא זמין |
| `500` | שגיאת שרת כללית |

---

## 7. Locations

### `GET /api/catalog/locations`

**מטרה:** רשימת ה-GCP locations שבהם מאוחסנים datasets.

**Query Parameters:** `refresh`

**תגובה — 200 OK:**
```json
{
  "locations": ["me-west1", "us-central1"]
}
```

---

## 8. Pipeline Status

### `GET /api/pipelines/status`

**מטרה:** סטטוס עדכני של תהליכי נתונים (pipelines) לפי pipeline ו-environment.

**Query Parameters:** `refresh`

**תגובה — 200 OK:**
```json
{
  "pipelines": [
    {
      "pipeline_name": "daily_etl",
      "environment": "production",
      "as_of_date": "2024-06-21T06:00:00",
      "current_status": "SUCCESS"
    },
    {
      "pipeline_name": "weekly_report",
      "environment": "production",
      "as_of_date": "2024-06-20T22:00:00",
      "current_status": "FAILED"
    }
  ]
}
```

**מקור הנתונים:** `dgt-gcp-econ-dev-datalake.Logging.view2_pipeline_latest_status`

---

## נספח — Pydantic Models

```python
class Dataset:
    dataset_id: str
    description: Optional[str]
    description_he: Optional[str]
    location: str
    tables_count: int
    created_at: str
    last_modified: Optional[str]

class TableDetail:
    table_id: str
    table_type: str            # "TABLE" | "VIEW" | "MATERIALIZED_VIEW" | "EXTERNAL"
    creation_time: Optional[str]
    row_count: int             # 0 אם לא ידוע
    size_bytes: int            # 0 אם לא ידוע
    last_modified: Optional[str]
    is_financial: bool
    is_geographical: bool
    is_sensitive: bool
    financial_columns: Optional[str]
    geographical_columns: Optional[str]
    sensitive_columns: Optional[str]
    project_name: str          # ברירת מחדל: "כללי"
    system_name: Optional[str]
    project_manager: Optional[str]
    characterization_link: Optional[str]

class ColumnProfile:
    column_name: str
    data_type: str             # "NUMERIC" | "STRING" | "DATETIME" | "ARRAY" | "BOOLEAN" | "UNKNOWN"
    nullness: float            # 0.0 – 1.0
    uniqueness: float          # 0.0 – 1.0
    top_n: List[TopNValue]
    numeric_stats: Optional[NumericStats]
    string_stats: Optional[StringStats]
    datetime_stats: Optional[DatetimeStats]

class TopNValue:
    value: str
    percentage: Optional[float]
    count: Optional[int]

class NumericStats:
    min: Optional[float]
    max: Optional[float]
    avg: Optional[float]
    stdDev: Optional[float]
    median: Optional[float]
    quartiles: List[float]

class StringStats:
    min_length: Optional[int]
    max_length: Optional[int]
    avg_length: Optional[float]

class DatetimeStats:
    min: Optional[str]
    max: Optional[str]
    format: Optional[str]

class PipelineStatus:
    pipeline_name: Optional[str]
    environment: Optional[str]
    as_of_date: Optional[datetime]
    current_status: Optional[str]

class CatalogStats:
    total_datasets: int
    total_tables: int
    locations_count: int
    project_id: str
    last_updated: Optional[str]
```

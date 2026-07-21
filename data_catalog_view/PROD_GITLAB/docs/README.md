# קטלוג הנתונים — תיעוד טכני מלא

> **שפת תיעוד:** עברית. כל שמות הקלאסים, הפונקציות, המשתנים, שירותי GCP, פקודות ו-code snippets — נשמרים באנגלית.

---

## תוכן עניינים

1. [סקירת הפרויקט](#1-סקירת-הפרויקט)
2. [מטרה עסקית](#2-מטרה-עסקית)
3. [ארכיטקטורה ברמה גבוהה](#3-ארכיטקטורה-ברמה-גבוהה)
4. [מבנה הפרויקט](#4-מבנה-הפרויקט)
5. [ארכיטקטורת ה-Backend (api-dev)](#5-ארכיטקטורת-ה-backend)
6. [ארכיטקטורת ה-Frontend (app-dev)](#6-ארכיטקטורת-ה-frontend)
7. [סקריפטי הניהול (mng-dev)](#7-סקריפטי-הניהול)
8. [זרימת הנתונים](#8-זרימת-הנתונים)
9. [אינטגרציה עם BigQuery](#9-אינטגרציה-עם-bigquery)
10. [אינטגרציה עם Dataplex ו-Knowledge Catalog](#10-אינטגרציה-עם-dataplex-ו-knowledge-catalog)
11. [מנגנון ה-Cache](#11-מנגנון-ה-cache)
12. [Logging](#12-logging)
13. [טיפול בשגיאות](#13-טיפול-בשגיאות)
14. [שיקולי ביצועים](#14-שיקולי-ביצועים)
15. [הרשאות IAM](#15-הרשאות-iam)
16. [דגשים חשובים למתחזק המערכת](#16-דגשים-חשובים-למתחזק-המערכת)

---

## 1. סקירת הפרויקט

קטלוג הנתונים הוא אפליקציית Web המאפשרת גילוי, חקירה ומעקב אחר נתוני BigQuery של ארגון. המערכת מציגה:

- רשימת כל ה-datasets הפעילים בפרויקט GCP
- טבלאות בכל dataset כולל מטאדאטה ותיוגים סמנטיים
- פרופיל נתונים ברמת עמודה (Data Profile) שנשלף מ-Dataplex DataScan
- גרף קשרים בין טבלאות שנוצר על ידי Dataplex Insights
- סטטוס תהליכי נתונים (pipelines) בזמן אמת

המערכת בנויה על **שלושה repositories עצמאיים**:

| Repository | תיאור | סביבת ריצה |
|---|---|---|
| `api-dev` | FastAPI backend | Cloud Run |
| `app-dev` | React frontend + Nginx | Cloud Run |
| `mng-dev` | סקריפטי ניהול Knowledge Catalog | Cloud Function / Cloud Scheduler / ריצה ידנית |

---

## 2. מטרה עסקית

המערכת נבנתה עבור צוותי Data Engineering וניהול נתונים כדי:

1. **גילוי נתונים** — מציאת datasets וטבלאות רלוונטיים ללא גישה ישירה ל-BigQuery Console
2. **סיווג נתונים** — הצגה ויזואלית האם טבלה מכילה נתונים פיננסיים, גאוגרפיים, או רגישים (PII), כולל שמות העמודות הרלוונטיות
3. **ניהול ממשקי נתונים** — כל טבלה ממוּפית לפרויקט, מערכת ומנהל פרויקט (מגיע מ-Monday.com דרך Dataplex Aspect)
4. **פרופיל איכות נתונים** — הצגת סטטיסטיקות ברמת עמודה: null rate, uniqueness, top N values, numeric/string/datetime stats
5. **ניטור pipelines** — מעקב אחר סטטוס תהליכי נתונים לפי סביבה מתוך BigQuery view
6. **תיעוד בעברית** — תיאורי datasets בעברית מאוחסנים ב-Dataplex ומוצגים בממשק

---

## 3. ארכיטקטורה ברמה גבוהה

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (RTL Hebrew UI)                                        │
│  React + MUI + React Query                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Run: data-catalog-app (app-dev)                          │
│  Nginx 1.27 (port 8080)                                         │
│  ├── /              → serves Vite static build                  │
│  └── /api/*         → proxy_pass → data-catalog-api             │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP (internal Cloud Run)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Run: data-catalog-api (api-dev)                          │
│  FastAPI + Uvicorn (port 8080)                                  │
│  ├── BigQueryService      → BigQuery Client                     │
│  ├── DataplexService      → Dataplex CatalogServiceClient       │
│  │                           + DataCatalogClient (legacy)       │
│  └── In-memory TTL Cache  → 5 minutes                          │
└──────────┬─────────────────────────────┬────────────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────┐    ┌────────────────────────────────────┐
│  Google BigQuery      │    │  Dataplex Knowledge Catalog        │
│  ├── datasets         │    │  ├── Entry Group @bigquery         │
│  ├── tables           │    │  ├── ui-metadata aspect (per table)│
│  ├── insights_outputs │    │  ├── db-tasks-information aspect   │
│  └── pipeline status  │    │  └── overview aspect (per dataset) │
└──────────────────────┘    └────────────────────────────────────┘
                                          ▲
                                          │ כותב aspects
                             ┌────────────────────────────────────┐
                             │  mng-dev (Cloud Function / Manual) │
                             │  ├── cataloger.py (Gemini AI)      │
                             │  ├── sync_descriptions.py (תרגום)  │
                             │  └── dataplex_info_monday.py       │
                             └────────────────────────────────────┘
```

### זרימת הבקשה (Request Flow)

```
Browser → Nginx (app-dev) → FastAPI (api-dev)
                                    ├── BigQueryService.list_datasets()
                                    │       └── [Cache HIT] return
                                    │       └── [Cache MISS] BigQuery API → cache → return
                                    └── DataplexService.get_dataset_aspects()
                                            └── Dataplex CatalogServiceClient (EntryView.CUSTOM)
```

---

## 4. מבנה הפרויקט

### api-dev (Backend)

```
api-dev/
├── main.py                    # FastAPI app + כל ה-routes
├── models.py                  # Pydantic models — DTOs של כל ה-API responses
├── cache_utils.py             # מנגנון cache in-memory עם TTL
├── services/
│   ├── bigquery_service.py    # שירות BigQuery — datasets, tables, relationships, pipelines
│   └── dataplex_service.py    # שירות Dataplex — aspects metadata
├── requirements.txt
└── Dockerfile
```

### app-dev (Frontend)

```
app-dev/
├── app/src/
│   ├── App.tsx                # React router, providers (QueryClient, ThemeProvider, RTL)
│   ├── pages/
│   │   ├── CatalogPage.tsx    # עמוד ראשי — grid של כל ה-datasets
│   │   ├── DatasetPage.tsx    # עמוד dataset — רשימת טבלאות + גרף קשרים
│   │   └── TableProfilePage.tsx # עמוד פרופיל עמודות
│   ├── components/
│   │   ├── DatasetCard.tsx    # כרטיסיית dataset בגריד
│   │   ├── StatsBar.tsx       # שורת סטטיסטיקות גלובאליות
│   │   ├── PipelineStatusDrawer.tsx # מגירת סטטוס pipelines
│   │   └── profile/           # רכיבי Data Profile (ColumnCard, MetricBar וכו')
│   ├── contexts/
│   │   └── RefreshContext.tsx  # ניהול מצב רענון גלובאלי
│   ├── services/
│   │   ├── pipelineService.ts  # fetcher ל-pipeline status
│   │   └── profileService.ts   # fetcher ל-table profile
│   └── theme.ts                # MUI theme עם RTL
├── lib/api-client-react/
│   └── src/generated/
│       ├── api.ts              # React Query hooks שנוצרו ע"י Orval
│       └── api.schemas.ts      # TypeScript types
└── Dockerfile + nginx.conf.template
```

### mng-dev (Management Scripts)

```
mng-dev/
├── cataloger.py               # סיווג טבלאות עם Gemini AI → Dataplex ui-metadata aspect
├── sync_descriptions.py       # סנכרון תיאורים EN→HE בין Data Catalog, BigQuery ו-Dataplex
├── dataplex_info_monday.py    # סנכרון מטאדאטה מ-Monday.com → Dataplex db-tasks-information aspect
└── requirements.txt
```

---

## 5. ארכיטקטורת ה-Backend

### `main.py` — FastAPI Application

`main.py` מכיל את כל ה-routes תחת prefix `/api` ומנהל את מחזור החיים של השירותים.

#### Lifespan ואתחול

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    bq_service       = BigQueryService(project_id=PROJECT_ID, location=LOCATION)
    dataplex_service = DataplexService(project_id=PROJECT_ID, location=LOCATION)
```

שני השירותים מאותחלים פעם אחת בעת עלייה (startup). אם `BigQueryService` לא הצליח להאתחל (אין credentials), `bq_service.is_available` מחזיר `False` וכל endpoint יחזיר `503`.

#### `require_bq()` Guard

פונקציה פנימית שנקראת בתחילת כל route handler התלוי ב-BigQuery:

```python
def require_bq():
    if not bq_service or not bq_service.is_available:
        raise HTTPException(status_code=503, detail="BigQuery not available")
```

#### Routes

| Method | Path | תיאור |
|---|---|---|
| `GET` | `/api/healthz` | בדיקת תקינות |
| `GET` | `/api/datasets` | רשימת כל ה-datasets (עם חיפוש ומיון) |
| `GET` | `/api/datasets/{id}` | dataset בודד |
| `GET` | `/api/datasets/{id}/tables` | טבלאות ב-dataset |
| `GET` | `/api/datasets/{id}/relationships` | קשרים בין טבלאות |
| `GET` | `/api/datasets/{id}/tables/{table}/profile` | פרופיל עמודות |
| `GET` | `/api/catalog/stats` | סטטיסטיקות גלובאליות |
| `GET` | `/api/catalog/locations` | רשימת locations |
| `GET` | `/api/pipelines/status` | סטטוס pipelines |

---

### `BigQueryService` (`services/bigquery_service.py`)

האחראי על כל אינטראקציה עם BigQuery. **כל המתודות הן async** ומשתמשות ב-`run_in_executor` כדי לא לחסום את event loop של FastAPI, כיוון שה-BigQuery SDK הרשמי הוא synchronous.

| מתודה | TTL Cache | תיאור |
|---|---|---|
| `list_datasets()` | 5 דק' | כל ה-datasets מלבד ה-`EXCLUDED_DATASETS` |
| `get_dataset(id)` | — | מחזיר מ-`list_datasets()` ללא קריאה נוספת |
| `list_tables(dataset_id)` | 5 דק' | כל הטבלאות ב-dataset, ממוינות לפי שם |
| `list_relationships(dataset_id, min_confidence)` | 5 דק' | קשרים מ-`dataplex_insights_outputs.insights_relationship_edges` |
| `get_pipeline_statuses()` | 5 דק' | סטטוס pipelines מ-`Logging.view2_pipeline_latest_status` |

#### `EXCLUDED_DATASETS`

```python
EXCLUDED_DATASETS = {
    "dataplex_insights_outputs", "temp", "Logging", "admin", "metrics"
}
```

datasets אלו מסוננים מהתוצאות המוחזרות ל-frontend. הם datasets פנימיים/תפעוליים.

#### קשרים — Dataplex Insights Table

הקשרים בין טבלאות **אינם** נשלפים מ-Dataplex API אלא ישירות מ-BigQuery. Dataplex Insights כותב את תוצאות הניתוח שלו לטבלה `dataplex_insights_outputs.insights_relationship_edges`. הסיבה: ממשק ה-Dataplex API לקשרים מורכב יותר; הגישה הישירה ל-BigQuery פשוטה ומהירה יותר.

---

### `DataplexService` (`services/dataplex_service.py`)

האחראי על שליפת **aspects** מ-Dataplex Knowledge Catalog. משתמש ב-`dataplex_v1.CatalogServiceClient` ובנוסף ב-`DataCatalogClient` (legacy) לשליפת תיאורים אנגליים ממקורות ישנים יותר.

#### `get_dataset_aspects(dataset_id)`

מחזיר dict עם:
- `description_en` — תיאור אנגלי (מ-Data Catalog legacy)
- `description_he` — תיאור עברי (מ-Dataplex `overview` aspect, תחת header ספציפי)
- `has_custom_aspects` — האם ה-dataset עצמו מכיל `ui-metadata` aspect
- שדות סיווג: `is_financial`, `is_geographical`, `is_sensitive` + עמודות מתאימות
- שדות פרויקט: `project_name`, `system_name`, `project_manager`, `characterization_link`

#### `get_table_aspects(dataset_id, table_id)`

מחזיר dict עם אותם שדות סיווג — אך ברמת הטבלה הבודדת (מ-`ui-metadata` aspect על הטבלה עצמה).

#### `get_table_profile(dataset_id, table_id)`

שולף פרופיל נתונים ברמת עמודה מ-Dataplex DataScan. מחזיר `TableProfileResponse` עם רשימת `ColumnProfile`.

#### Dynamic Aspect Key Lookup

```python
matched_key = next((k for k in aspects.keys() if k.endswith(".ui-metadata")), None)
```

מפתח ה-aspect הוא `{project}.{location}.{aspect_type_id}`. כתיבה קשיחה (hardcode) של המפתח תשבר בעת שינוי פרויקט GCP. שיטת ה-dynamic lookup רובוסטית לשינויים.

#### `EntryView.CUSTOM` — חובה לשליפת Aspects

```python
dataplex_v1.GetEntryRequest(
    name=entry_name,
    view=dataplex_v1.EntryView.CUSTOM,
    aspect_types=[aspect_type_path]
)
```

שימוש ב-`EntryView.FULL` יחזיר **את כל** ה-aspects (עלות API גבוהה). שימוש ב-view ברירת מחדל עלול לא להחזיר aspects כלל. `EntryView.CUSTOM` בשילוב עם `aspect_types` מציין בדיוק מה נדרש.

---

### `cache_utils.py` — מנגנון ה-Cache

ראה [סעיף 11](#11-מנגנון-ה-cache).

---

### `Dockerfile` — Multi-stage Build

```dockerfile
# שלב 1: Builder — התקנת dependencies
FROM python:3.12-slim AS builder
RUN pip install --prefix=/install -r requirements.txt

# שלב 2: Runtime — image רזה עם non-root user
FROM python:3.12-slim AS runtime
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
COPY --from=builder /install /usr/local
COPY --chown=appuser:appgroup . .
USER appuser

ENV PORT=8080
ENV GCP_PROJECT_ID="dgt-gcp-econ-dev-datalake"
ENV GCP_LOCATION="me-west1"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2"]
```

נקודות מפתח:
- **Multi-stage build** — image ה-runtime לא מכיל build tools → image קטן ובטוח יותר
- **Non-root user** (`appuser`) — best practice של Cloud Run
- **2 workers** — מותאם ל-1 vCPU של Cloud Run; לשינוי הקצאת CPU יש לעדכן גם `--workers`
- **`PORT` env var** — Cloud Run מזריק את ה-port אוטומטית; אין לקדד hardcode

---

## 6. ארכיטקטורת ה-Frontend

### RTL ו-Hebrew

```tsx
const cacheRtl = createCache({ key: "muirtl", stylisPlugins: [rtlPlugin] });
<CacheProvider value={cacheRtl}>
  <ThemeProvider theme={theme}>
```

ה-app מוגדר עם RTL מלא באמצעות `@emotion/cache` ו-`stylis-plugin-rtl`. כל הטקסטים בממשק הם עברית.

### React Query — קליינט

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24,  // 24 שעות
      gcTime:    1000 * 60 * 60 * 24,   // 24 שעות
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});
```

ה-`staleTime` של 24 שעות הוא **החלטה מכוונת** — נתוני BigQuery אינם משתנים לעיתים קרובות, וה-API של GCP יקר. משמעות: משתמש שנכנס לאפליקציה יראה נתונים מ-cache עד 24 שעות אם לא לחץ על כפתור הרענון.

### עמודים

#### `CatalogPage.tsx`

- שולף datasets ו-catalog stats בטעינה
- חיפוש (search) ומיון (sort) מועברים כ-query params ל-backend
- מציג `PipelineStatusDrawer` עם badge מספר הpipelines הכושלים

#### `DatasetPage.tsx`

- שולף טבלאות וקשרים ב-dataset
- `Tabs`: רשימת טבלאות | גרף קשרים
- גרף הקשרים בנוי ב-SVG עם `ForceGraph` (force-directed layout)

#### `TableProfilePage.tsx`

- שולף פרופיל עמודות מ-`/api/datasets/{id}/tables/{table}/profile`
- מציג `ColumnCard` לכל עמודה עם MetricBar, TopValuesPanel, StatsPanel

### Generated API Client

```
lib/api-client-react/src/generated/
├── api.ts          # React Query hooks: useListDatasets, useGetDataset, useGetCatalogStats...
└── api.schemas.ts  # TypeScript types: Dataset, CatalogStats, DatasetList...
```

הקובץ נוצר ע"י **Orval** מ-OpenAPI spec. **אין לערוך ידנית.** לעדכון: לשנות את ה-OpenAPI spec ולהריץ `pnpm --filter @workspace/api-spec run codegen`.

### `RefreshContext`

מאפשר לכל רכיב להירשם ל-"Hard Refresh" גלובאלי. לחיצה על כפתור הרענון שולחת בקשות עם `?refresh=true` ל-backend (עוקף את שני שכבות ה-cache — React Query ו-backend).

---

## 7. סקריפטי הניהול

ראה [MNG.md](./MNG.md) לתיעוד מפורט.

### סקירה

| סקריפט | תדירות | מה הוא עושה |
|---|---|---|
| `cataloger.py` | פעם ביום (Cloud Scheduler) | מסווג טבלאות BQ עם Gemini AI → כותב `ui-metadata` aspect ב-Dataplex |
| `dataplex_info_monday.py` | פעם ביום (Cloud Scheduler) | מסנכרן מטאדאטה פרויקטים מ-Monday.com → כותב `db-tasks-information` aspect ב-Dataplex |
| `sync_descriptions.py` | ידני / Cloud Scheduler | מתרגם תיאורים EN→HE (Cloud Translation API) → עדכון `overview` aspect ב-Dataplex |

---

## 8. זרימת הנתונים

### זרימת מטאדאטה (כתיבה — mng-dev)

```
Monday.com JSON Export
        │
        ▼
BigQuery Table (monday.db_projects_mapping)
        │
        ▼
dataplex_info_monday.py
        │  (HTTP trigger / Cloud Scheduler)
        ▼
Dataplex Entry (dataset / table level)
        └── db-tasks-information aspect
                ├── project-name
                ├── system-name
                ├── project-manager
                └── characterization-link

BigQuery Table Schema + Sample Rows
        │
        ▼
cataloger.py
        │  (Gemini AI analysis)
        ▼
Dataplex Entry (table level)
        └── ui-metadata aspect
                ├── is-financial / financial-columns
                ├── is-geographical / geographical-columns
                └── is-sensitive / sensitive-columns

Data Catalog (legacy) — תיאור EN
        │
        ▼
sync_descriptions.py
        │  (Cloud Translation API)
        ▼
Dataplex overview aspect (dataset level)
        └── content: "[תוכן קיים]\n\n### Description translated into Hebrew\n\n[תיאור עברי]"
```

### זרימת קריאה (Frontend ← API)

```
Browser → /api/datasets
        → BigQueryService.list_datasets() [Cache 5 min]
                → BigQuery: list_datasets + get_dataset (metadata)
        → DataplexService.get_dataset_aspects() [per dataset]
                → Dataplex: GetEntry (EntryView.CUSTOM)
                        → ui-metadata: is_financial, is_geographical, is_sensitive
                        → overview: description_he
        → merge + return DatasetList

Browser → /api/datasets/{id}/tables
        → BigQueryService.list_tables() [Cache 5 min]
        → DataplexService.get_dataset_aspects() [optimization check]
                → has_custom_aspects=True:
                        → שימוש בנתוני dataset-level בלבד (מהיר)
                → has_custom_aspects=False:
                        → asyncio.gather(*[get_table_aspects() per table]) (מקבילי)
        → merge + return TableList
```

---

## 9. אינטגרציה עם BigQuery

### חיבור

```python
self._client = bigquery.Client(project=self.project_id)
```

נעשה שימוש ב-Application Default Credentials (ADC). ב-Cloud Run, ה-service account של ה-service משמש אוטומטית.

### Async Wrapper Pattern

כל קריאת BigQuery מבוצעת ב-`run_in_executor`:

```python
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(None, self._fetch_datasets)
```

הסיבה: ה-BigQuery SDK הוא synchronous. `run_in_executor` מבצע אותו ב-thread pool נפרד, ומונע חסימה של event loop ה-FastAPI.

### שאילתת קשרים

```sql
SELECT edge_id, source_dataset, source_table, target_dataset, target_table,
       relationship_type, confidence_score, description_edge, last_updated
FROM `{project}.dataplex_insights_outputs.insights_relationship_edges`
WHERE (source_dataset = @dataset_id OR target_dataset = @dataset_id)
  AND confidence_score >= @min_confidence
ORDER BY confidence_score DESC
```

שאילתה זו נדרשת להרשאת BigQuery `roles/bigquery.dataViewer` על ה-dataset `dataplex_insights_outputs`.

### שאילתת Pipeline Status

```sql
SELECT pipeline_name, environment, as_of_date, current_status
FROM `dgt-gcp-econ-dev-datalake.Logging.view2_pipeline_latest_status`
ORDER BY as_of_date DESC
```

ה-view מכיל את הסטטוס האחרון של כל pipeline. שם ה-view והטבלה הם **hardcoded** ב-`bigquery_service.py` ואינם מוגדרים כ-environment variables.

---

## 10. אינטגרציה עם Dataplex ו-Knowledge Catalog

### Aspect Types

| Aspect Type ID | ברמת | כותב | קורא |
|---|---|---|---|
| `ui-metadata` | טבלה | `cataloger.py` | `DataplexService.get_table_aspects()` |
| `db-tasks-information` | dataset + table | `dataplex_info_monday.py` | `DataplexService.get_dataset_aspects()` |
| `overview` (global type) | dataset | `sync_descriptions.py` | `DataplexService.get_dataset_aspects()` |

### מבנה Entry Name

```
projects/{PROJECT}/locations/me-west1/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{PROJECT}/datasets/{DATASET}/tables/{TABLE}
```

לרמת dataset (ללא `/tables/{TABLE}`):
```
.../entries/bigquery.googleapis.com/projects/{PROJECT}/datasets/{DATASET}
```

### תיאור עברי — הסכמה

```
[תוכן overview קיים...]

### Description translated into Hebrew

[תיאור בעברית]
```

`DataplexService` מחפש את ה-header הקבוע `"### Description translated into Hebrew"` ומחלץ את כל מה שאחריו. `sync_descriptions.py` כותב על-פי אותה סכמה.

> ⚠️ שינוי ה-header ישבור את כל שליפות התיאור העברי. ה-header מוגדר כ-`TRANSLATION_HEADER` ב-`sync_descriptions.py`.

### `has_custom_aspects` — אופטימיזציה

כאשר ה-flag מחזיר `True`, ה-backend משתמש ב-dataset-level aspects עבור כל הטבלאות ב-dataset — **קריאה אחת** ל-Dataplex במקום קריאה לכל טבלה בנפרד.

`has_custom_aspects = True` כאשר ה-dataset עצמו מכיל `ui-metadata` או `db-tasks-information` aspect.
- **`dataplex_info_monday.py`** כותב aspects **ברמת ה-dataset** → יוצר את ה-flag.
- **`cataloger.py`** כותב aspects **ברמת הטבלה** → **לא** יוצר את ה-flag.

לכן: dataset שעבר עדכון דרך `dataplex_info_monday.py` משתמש באופטימיזציה; dataset שתויג רק דרך `cataloger.py` מבצע שליפה מקבילית לכל טבלה.

---

## 11. מנגנון ה-Cache

### `cache_utils.py` — `@cached` Decorator

```python
@cached(ttl=300)
async def list_datasets(self, *, refresh: bool = False):
    ...
```

**מאפיינים:**
- **In-memory**: ה-cache מאוחסן ב-Python dict גלובאלי (`_STORE`). לא persistent בין restarts.
- **TTL**: 300 שניות (5 דקות) כברירת מחדל לכל endpoint.
- **Bypass**: `refresh=True` מתעלם מה-cache קיים, שולף מ-GCP, ומאחסן תוצאה חדשה.
- **Cache Key**: `"{func.__qualname__}:{positional_args[1:]}"` — קלאס + שם מתודה + ארגומנטים (ללא `self`).

### שתי שכבות Cache

```
Frontend (React Query)   →   staleTime: 24 שעות
        ↓ [לחיצת רענון → refresh=true]
Backend (cache_utils)    →   TTL: 5 דקות
        ↓ [refresh=true]
GCP APIs (BigQuery / Dataplex)
```

כפתור הרענון ב-frontend עוקף **את שתי השכבות**.

### מגבלה: Multi-Instance

ה-cache הוא in-process. ב-Cloud Run עם מספר instances, כל instance מחזיק cache נפרד. אין cache מרכזי משותף (Redis וכד').

---

## 12. Logging

### Backend

```python
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

כל מודול מגדיר `logger` משלו. Log level ברירת מחדל: `INFO`.

| רמה | מתי |
|---|---|
| `INFO` | אתחול שירותים, Cache bypass (refresh=True), עדכוני Dataplex |
| `DEBUG` | Cache HIT / MISS / STALE |
| `WARNING` | BigQuery/Dataplex לא זמין באתחול |
| `ERROR` | שגיאות בשרות ספציפי (ע"י `logger.exception()`) |

### Frontend

אין logging מסודר. שגיאות API מוצגות למשתמש ב-`Alert` component של MUI.

### Debugging עם Logs

**בדיקה אם BigQuery זמין:**
```
INFO: BigQuery client initialized for project dgt-gcp-econ-dev-datalake
```
אם חסר — credentials לא מוגדרים ב-Cloud Run environment.

**בדיקה אם Cache עובד:**
```
DEBUG: Cache HIT  BigQueryService.list_datasets:()
DEBUG: Cache MISS BigQueryService.list_tables:('my_dataset',)
DEBUG: Cache STALE BigQueryService.list_datasets:()
INFO:  Cache BYPASS (refresh=True) BigQueryService.list_datasets:()
```

**שגיאות Dataplex:**
אם aspects אינם נשלפים, חפש שגיאות עם `logger.exception()` שמציינות את שם ה-aspect type ו-entry name.

---

## 13. טיפול בשגיאות

### Backend

כל route handler עטוף ב-`try/except`:

```python
try:
    ...
except HTTPException:
    raise  # מעביר 404/503 כפי שהם
except Exception as e:
    logger.exception("Error ...")
    raise HTTPException(status_code=500, detail=str(e))
```

**קודי שגיאה:**

| קוד | מצב |
|---|---|
| `503` | BigQuery לא זמין (credentials חסרים) |
| `404` | Dataset לא נמצא |
| `500` | שגיאה כללית (נרשמת ב-logs) |

**Dataplex — שגיאות Silent:** אם שליפת Dataplex נכשלת, הנתונים מוחזרים ללא מטאדאטה מ-Dataplex (שדות `None`/ברירת מחדל), ולא כ-error response. הסיבה: מטאדאטה ה-Dataplex הוא תוספת לנתוני BigQuery, לא מקור נתונים עיקרי.

### Frontend

- שגיאות query מוצגות כ-`Alert` עם כפתור "נסה שוב" שמפעיל `refetch()`
- מצב טעינה: `Skeleton` placeholders
- רשימה ריקה: empty state ייעודי עם הוראות

---

## 14. שיקולי ביצועים

### Parallel Dataplex Fetches

```python
tasks = [dataplex_service.get_dataset_aspects(ds.dataset_id) for ds in datasets]
all_ds_aspects = await asyncio.gather(*tasks, return_exceptions=True)
```

כל שליפת aspects של dataset מבוצעת במקביל. `return_exceptions=True` מבטיח שכישלון של dataset אחד לא יעצור את השאר.

### Dataset-Level Optimization

כאשר `has_custom_aspects=True`, הטבלאות מקבלות מטאדאטה מרמת ה-dataset (**קריאה אחת**) במקום קריאה נפרדת לכל טבלה. זה קריטי ל-datasets עם עשרות טבלאות.

### Async Thread Pool

כל קריאות BigQuery (synchronous SDK) מבוצעות ב-thread pool דרך `run_in_executor` — מונע חסימת event loop ומאפשר concurrency.

### React Query Client-Side Cache

`staleTime: 24h` מבטיח שהמשתמש לא שולח בקשות מיותרות לשרת בין ביקורים. נתונים שנשלפו פעם אחת נשמרים בזיכרון הדפדפן למשך 24 שעות.

---

## 15. הרשאות IAM

הרשאות מינימליות שנדרשות ל-service account של Cloud Run (api-dev):

| שירות | הרשאה |
|---|---|
| BigQuery | `roles/bigquery.dataViewer` על הפרויקט |
| BigQuery | `roles/bigquery.jobUser` — להרצת שאילתות |
| Dataplex | `roles/dataplex.viewer` |
| Dataplex | `dataplex.entries.getData` |
| Dataplex | `dataplex.aspectTypes.use` |

> **הערה:** גישה ל-Data Profile aspects ב-Dataplex דרשה בעבר תפקיד מותאם אישית. במידה ושגיאות `PERMISSION_DENIED` מתקבלות בעת שליפת profile, יש לוודא שה-service account מחזיק ב-`dataplex.entryGroups.useDataProfileAspect`.

---

## 16. דגשים חשובים למתחזק המערכת

### 16.1 `EXCLUDED_DATASETS` — מוגדר בשני מקומות

`EXCLUDED_DATASETS` מוגדר **גם** ב-`bigquery_service.py` **וגם** ב-`cataloger.py`. שינוי ברשימה דורש עדכון בשני המקומות באופן ידני.

### 16.2 Pipeline Status — Hardcoded Table Name

```python
FROM `dgt-gcp-econ-dev-datalake.Logging.view2_pipeline_latest_status`
```

שם ה-view hardcoded ב-`_fetch_pipeline_statuses()` ב-`bigquery_service.py`. שינוי שם ה-view ב-BigQuery דורש שינוי קוד ו-deployment מחדש.

### 16.3 Code Debug שנשאר

`dataplex_service.py` מכיל בלוקי קוד גדולים ב-comment — ניסיונות debugging ישנים של שליפת Data Profile. ניתן להסיר בבטחה.

`dataplex_info_monday.py` מכיל את כל הגרסה הישנה כ-comment בראש הקובץ, לפני הגרסה הפעילה. **בעת עריכה, יש לשים לב לא לבלבל בין קוד מוסתר לקוד פעיל.**

### 16.4 `has_custom_aspects` — הבנת ה-Flag

ה-flag מוחזר `True` כאשר ה-dataset עצמו (לא הטבלאות!) מכיל `ui-metadata` או `db-tasks-information` aspect. `cataloger.py` כותב aspects **ברמת הטבלה** ולכן **לא** מפעיל את האופטימיזציה. `dataplex_info_monday.py` כותב aspects **ברמת ה-dataset** ולכן **כן** מפעיל אותה.

### 16.5 Aspect Key Discovery Pattern

```python
matched_key = next((k for k in aspects.keys() if k.endswith(".ui-metadata")), None)
```

**למה:** מפתח ה-aspect הוא `{project}.{location}.{aspect_type_id}`. כשהפרויקט משתנה, hardcoded key ישבור. שיטה זו רובוסטית.

### 16.6 Hebrew Description — הסכמה

תיאור עברי של dataset מאוחסן ב-Dataplex `overview` aspect תחת שדה `content` בפורמט:

```
[תוכן קיים...]

### Description translated into Hebrew

[תיאור בעברית]
```

המערכת מחפשת את ה-header הקבוע ומחלצת את כל מה שאחריו. שינוי ה-header ישבור את כל התיאורים הקיימים.

### 16.7 תרגומים — תהליך Offline

תרגום תיאורי datasets EN→HE מבוצע **offline** דרך `sync_descriptions.py` (רכיב `mng-dev`) באמצעות Cloud Translation API. תרגום בזמן ריצה **אינו** מבוצע ב-API server. הפרדה זו מכוונת: תרגום הוא פעולה יקרה שאינה מתאימה ל-hot path.

### 16.8 React Query staleTime = 24 שעות

זו החלטה מכוונת (ניתן לראות את ה-comment המקורי ב-`App.tsx` עם 5 דקות שהוחלף ל-24 שעות). **משמעות:** משתמש שנכנס לאפליקציה יראה נתונים ישנים עד 24 שעות אם לא לחץ על כפתור הרענון. שינוי ל-staleTime קצר יותר ישפיע על עומס GCP API.

### 16.9 `EntryView.CUSTOM` — חובה לשליפת Aspects

```python
dataplex_v1.GetEntryRequest(
    name=entry_name,
    view=dataplex_v1.EntryView.CUSTOM,
    aspect_types=[aspect_type_path]
)
```

שימוש ב-`EntryView.FULL` יחזיר **את כל** ה-aspects (עלות גבוהה יותר). שימוש ב-view ברירת מחדל עלול שלא להחזיר aspects כלל.

### 16.10 `cataloger.py` — מגבלת עלות

```python
MAX_TABLES_TO_PROCESS = 700
SKIP_ALREADY_TAGGED = True
```

`MAX_TABLES_TO_PROCESS` מגן מפני חריגת עלויות Gemini בטעות. `SKIP_ALREADY_TAGGED=True` הוא הגדרת ברירת מחדל לריצה שוטפת. יש לשנות ל-`False` רק כאשר מוסיפים שדות חדשים ל-aspect ורוצים לעדכן טבלאות שכבר תויגו.

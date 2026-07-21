# סקריפטי הניהול (mng-dev) — תיעוד טכני

> **שפת תיעוד:** עברית. כל שמות הקלאסים, הפונקציות, המשתנים, שירותי GCP, פקודות ו-code snippets — נשמרים באנגלית.

---

## תוכן עניינים

1. [סקירה](#1-סקירה)
2. [cataloger.py — סיווג טבלאות עם Gemini AI](#2-catalogerpy--סיווג-טבלאות-עם-gemini-ai)
3. [dataplex_info_monday.py — סנכרון מ-Monday.com](#3-dataplex_info_mondaypy--סנכרון-ממondaycom)
4. [sync_descriptions.py — תרגום תיאורים EN→HE](#4-sync_descriptionspy--תרגום-תיאורים-enhe)
5. [דרישות והרשאות](#5-דרישות-והרשאות)
6. [הרצה ידנית](#6-הרצה-ידנית)
7. [דגשים חשובים](#7-דגשים-חשובים)

---

## 1. סקירה

ה-`mng-dev` repository מכיל שלושה סקריפטי Python עצמאיים שאחראים על **כתיבת מטאדאטה** ל-Dataplex Knowledge Catalog. הם אינם חלק מה-API server ואינם רצים בתגובה לבקשות משתמש. כל אחד מהם רץ באופן מתוזמן (Cloud Scheduler) או ידני.

| סקריפט | Aspect שכותב | רמת Entry | תדירות מומלצת |
|---|---|---|---|
| `cataloger.py` | `ui-metadata` | טבלה | פעם ביום |
| `dataplex_info_monday.py` | `db-tasks-information` | dataset + table | פעם ביום |
| `sync_descriptions.py` | `overview` | dataset | לפי דרישה / ידני |

---

## 2. `cataloger.py` — סיווג טבלאות עם Gemini AI

### מטרה

סורק את כל הטבלאות ב-BigQuery, שולח לכל טבלה את הסכמה ומדגם שורות ל-Gemini AI, ומקבל סיווג סמנטי: האם הטבלה מכילה נתונים פיננסיים, גאוגרפיים, או PII. התוצאה נכתבת ל-Dataplex כ-`ui-metadata` aspect ברמת הטבלה.

### תצורה

```python
PROJECT_ID            = "dgt-gcp-econ-dev-datalake"
DATAPLEX_LOCATION     = "me-west1"
ASPECT_TYPE_ID        = "ui-metadata"
GEMINI_MODEL          = "gemini-3.5-flash"
SAMPLE_ROWS           = 10          # מספר שורות לדגימה לכל טבלה
MAX_TABLES_TO_PROCESS = 700         # הגבלת עלות
MAX_RETRIES           = 3           # ניסיונות חוזרים על כשל Gemini
RETRY_DELAY_SECONDS   = 5
SKIP_ALREADY_TAGGED   = True        # לדלג על טבלאות שכבר תויגו
```

### זרימת פעולה

```
BigQuery → list_datasets() → list_tables() (per dataset)
    → [SKIP if SKIP_ALREADY_TAGGED and aspect exists]
    → extract_bigquery_metadata()          שליפת סכמה + LIMIT 10 שורות
    → analyze_with_gemini()                שליחה ל-Gemini API
    → update_dataplex_aspect()             כתיבת aspect ל-Dataplex
```

### `extract_bigquery_metadata()`

שולפת את סכמת הטבלה ומדגם נתונים. מיוחד:
- **Recursive schema**: שדות מסוג `RECORD`/`STRUCT` מפורקים רקורסיבית לנתיב מלא (למשל `customer.email`) כדי שה-AI יבין את המבנה.
- **Truncation**: מחרוזות ארוכות מ-500 תווים נחתכות עם `[TRUNCATED]` — מונע שגיאות בגודל prompt.

### `analyze_with_gemini()` — Prompt + Validation

הפונקציה שולחת prompt מובנה ל-Gemini ומצפה לתגובת JSON תקינה עם 6 שדות בדיוק:

```json
{
  "is_financial": true,
  "financial_columns": "amount, total_price",
  "is_geographical": false,
  "geographical_columns": "",
  "is_sensitive": true,
  "sensitive_columns": "id_number, email"
}
```

**Strict Validation:** לאחר קבלת התגובה, הפונקציה מוודאת:
- 3 שדות boolean הם `bool` בדיוק (לא string "true")
- 3 שדות string הם `str`
- כל השדות קיימים

אם הולידציה נכשלת — מנגנון ה-retry מנסה שוב עד `MAX_RETRIES` פעמים עם המתנה של `RETRY_DELAY_SECONDS`.

### `is_table_already_tagged()`

בודק ב-Dataplex האם ה-aspect `ui-metadata` כבר קיים על הטבלה. משמש כ-guard כאשר `SKIP_ALREADY_TAGGED=True` — חוסך קריאות AI יקרות על טבלאות שכבר עברו עיבוד.

### `update_dataplex_aspect()`

כותב את תוצאות ה-AI ל-Dataplex:

```python
aspect.data = {
    "is-financial":           classification["is_financial"],      # bool
    "financial-columns":      classification["financial_columns"],  # str
    "is-geographical":        classification["is_geographical"],
    "geographical-columns":   classification["geographical_columns"],
    "is-sensitive":           classification["is_sensitive"],
    "sensitive-columns":      classification["sensitive_columns"],
}
```

שימו לב: שמות השדות ב-aspect משתמשים ב-hyphen (`is-financial`) ולא underscore (`is_financial`).

### Datasets מוחרגים

```python
EXCLUDED_DATASETS = {
    "dataplex_insights_outputs", "temp", "Logging", "admin", "metrics"
}
```

גם Views (לא `TABLE`) מדולגים.

### הרצה

```bash
python cataloger.py
```

---

## 3. `dataplex_info_monday.py` — סנכרון מ-Monday.com

### מטרה

מסנכרן מטאדאטה ניהולית של פרויקטים מ-Monday.com (שמות פרויקטים, מנהלים, קישורי אפיון) ל-Dataplex כ-`db-tasks-information` aspect.

### מקור הנתונים

נתוני Monday.com מיוצאים ל-BigQuery לטבלה:
```
{SOURCE_PROJECT}.{SOURCE_DATASET}.{SOURCE_TABLE}
```
ברירת מחדל: `dgt-gcp-econ-dev-datalake.monday.db_projects_mapping`

### ניתוב — `resolve_target_tables()`

לכל שורת מטאדאטה מ-Monday.com, הפונקציה מחשבת לאילו טבלאות ב-BigQuery יש לכתוב את ה-aspect. שורה עם `DB=mss_production` ו-`prefix` ריק מדולגת.

### `update_dataplex_aspect()`

כותב aspect `db-tasks-information` עם השדות:

```python
aspect.data = {
    "project-name":          project_name,
    "system-name":           system_name,
    "project-manager":       project_manager,
    "characterization-link": characterization_link,
}
```

ה-aspect נכתב **ברמת ה-dataset וברמת הטבלה** גם יחד. כתיבה ברמת ה-dataset מפעילה את האופטימיזציה `has_custom_aspects` ב-API server (ראה [README.md — סעיף 16.4](./README.md#164-has_custom_aspects--הבנת-ה-flag)).

### Cloud Function Entry Point

```python
@functions_framework.http
def main(request):
    ...
```

הסקריפט מוגדר כ-Cloud Function עם HTTP trigger. ניתן להפעיל אותו ישירות מ-Cloud Scheduler כ-HTTP job.

### הרצה ידנית

```bash
python dataplex_info_monday.py
```

### הערה על גרסאות בקובץ

הקובץ מכיל את הגרסה הישנה כ-comment בחלק הראשון. **בעת עריכה, יש לשים לב לא לבלבל בין קוד מוסתר (comment) לקוד הפעיל.**

---

## 4. `sync_descriptions.py` — תרגום תיאורים EN→HE

### מטרה

מסנכרן תיאורי datasets בין שלושה מקורות:
1. **Data Catalog** (legacy) — מקור האמת לתיאורים באנגלית
2. **BigQuery** — תיאור ה-dataset ב-BigQuery עצמו
3. **Dataplex `overview` aspect** — מאוחסן תיאור עברי מתורגם

### לוגיקת סנכרון

```
לכל dataset:
    1. שלוף תיאור EN מ-Data Catalog
    2. שלוף overview קיים מ-Dataplex (כולל תיאור HE קיים)
    3. שלוף תיאור קיים מ-BigQuery

    אם (EN קיים) AND (HE חסר):      → תרגם + עדכן Dataplex
    אם (EN != BQ description):       → תרגם + עדכן Dataplex + עדכן BigQuery
    אם הכל מסונכרן:                  → דלג
```

### `get_translation()`

```python
res = client.translate(text, target_language="iw", source_language="en")
```

משתמש ב-Cloud Translation API (v2). שפת יעד: `"iw"` (קוד ISO לעברית).

### כתיבת Overview ל-Dataplex

```python
aspect.data = {
    "content": new_overview,       # מחרוזת עם header מובנה
    "contentType": "MARKDOWN"
}
```

עדכון ה-aspect משתמש ב-`aspect_keys` parameter:

```python
upd_req = dataplex_v1.UpdateEntryRequest(
    entry=dp_entry,
    update_mask={"paths": ["aspects"]},
    aspect_keys=[aspect_map_key],
    allow_missing=False
)
```

### פורמט ה-overview

```
[תוכן overview קיים...]

### Description translated into Hebrew

[תיאור בעברית שתורגם ע"י Cloud Translation API]
```

ה-header `"### Description translated into Hebrew"` מוגדר כ-`TRANSLATION_HEADER` constant. ה-API server שולף את התיאור העברי על-פי header זה.

### הרצה

```bash
python sync_descriptions.py
```

---

## 5. דרישות והרשאות

### `requirements.txt`

```
functions-framework==3.*
google-cloud-bigquery==3.*
google-cloud-dataplex==2.*
protobuf==5.*
google-cloud-datacatalog
```

> `google-genai` נדרש עבור `cataloger.py` (Gemini API) אך אינו ב-`requirements.txt` הנוכחי. יש להוסיף ידנית לסביבת ריצה של `cataloger.py`.

### הרשאות IAM הנדרשות

| שירות | הרשאה | נדרש עבור |
|---|---|---|
| BigQuery | `roles/bigquery.dataViewer` | קריאת datasets/tables/שאילתות |
| BigQuery | `roles/bigquery.jobUser` | הרצת queries ב-cataloger.py |
| BigQuery | `roles/bigquery.dataEditor` | עדכון description ב-sync_descriptions.py |
| Dataplex | `roles/dataplex.editor` | כתיבת aspects |
| Data Catalog | `roles/datacatalog.viewer` | קריאת תיאורים ב-sync_descriptions.py |
| Translation | `roles/cloudtranslate.user` | שימוש ב-Cloud Translation API |
| Vertex AI / Gemini | גישה ל-Gemini API | cataloger.py |

---

## 6. הרצה ידנית

### Prerequisites

```bash
gcloud auth application-default login
pip install -r requirements.txt
pip install google-genai  # עבור cataloger.py בלבד
```

### Environment Variables (אופציונאלי)

```bash
export GCP_PROJECT_ID="dgt-gcp-econ-dev-datalake"
export GCP_LOCATION="me-west1"
```

### הרצת הסקריפטים

```bash
# סיווג טבלאות חדשות עם AI
python cataloger.py

# סנכרון מטאדאטה מ-Monday.com
python dataplex_info_monday.py

# תרגום תיאורי datasets EN→HE
python sync_descriptions.py
```

### כשמוסיפים שדות חדשים ל-ui-metadata

1. עדכן את ה-aspect type ב-Dataplex Console
2. שנה `SKIP_ALREADY_TAGGED = False` ב-`cataloger.py`
3. הרץ `cataloger.py` (יעדכן **כל** הטבלאות, כולל ממותגות)
4. שנה בחזרה ל-`True`

---

## 7. דגשים חשובים

### 7.1 מגבלת עלות Gemini

`MAX_TABLES_TO_PROCESS = 700` — ערך הגנה קריטי. בכל שינוי, יש לוודא שהערך סביר לפי גודל ה-dataset הנוכחי. עלות Gemini נמדדת לפי tokens; טבלאות עם סכמה מורכבת יצרכו יותר.

### 7.2 `allow_missing=False` ב-UpdateEntryRequest

כל שלושת הסקריפטים משתמשים ב-`allow_missing=False`. משמעות: אם ה-entry לא קיים ב-Dataplex (למשל dataset חדש שטרם אינדוקס), הכתיבה תיכשל. **לא** יווצרו entries חדשים אוטומטית.

### 7.3 Aspect Key Format

```python
aspect_key = f"{project}.{location}.{aspect_type_id}"
# Example: "dgt-gcp-econ-dev-datalake.me-west1.ui-metadata"
```

זהו המפתח בתוך `entry.aspects` dict. **הפורמט חייב להתאים בדיוק** לפורמט שב-Dataplex.

### 7.4 חוסר בגרסת `google-genai` ב-requirements.txt

`cataloger.py` מייבא `from google import genai` אך `google-genai` אינו ב-`requirements.txt`. יש להוסיף לפני deployment של Cloud Function שמריץ `cataloger.py`.

### 7.5 שגיאות Dataplex Silent ב-cataloger.py

כשל בכתיבת aspect לטבלה ספציפית נרשם ב-print ב-`❌` אך **לא מעצור את הריצה**. ניתן לזהות טבלאות כושלות מ-output הריצה ולטפל בהן ידנית.

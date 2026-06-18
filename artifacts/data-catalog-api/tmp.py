
# from google.cloud import dataplex_v1

# PROJECT_ID = "dgt-gcp-econ-dev-datalake"
# LOCATION = "me-west1"

# client = dataplex_v1.CatalogServiceClient()

# entry_name = (
#     f"projects/{PROJECT_ID}/locations/{LOCATION}"
#     f"/entryGroups/@bigquery/entries/"
#     f"bigquery.googleapis.com/projects/{PROJECT_ID}"
#     f"/datasets/MSSQL_foreign_trade_resources/tables/purchase_requests"
# )

# entry = client.get_entry(request=dataplex_v1.GetEntryRequest(name=entry_name))

# # מצא את ה-ui-metadata key
# ui_key = next((k for k in entry.aspects.keys() if "ui-metadata" in k), None)
# print("UI metadata key:", ui_key)
# if ui_key:
#     print("Data:", dict(entry.aspects[ui_key].data))

import subprocess
import google.oauth2.credentials
from google.cloud import dataplex_v1
from google.protobuf.json_format import MessageToJson

PROJECT_ID = "dgt-gcp-econ-dev-datalake"
LOCATION = "me-west1"
DATASET_ID = "MSSQL_foreign_trade_resources"
TABLE_ID = "purchase_requests"

# 1. הדפסת החשבון הפעיל בטרמינל לביטחון מלא
try:
    active_account = subprocess.check_output("gcloud config get-value account", shell=True).decode("utf-8").strip()
    print(f"👤 [ACCOUNT] החשבון שמריץ את הטרמינל כרגע: {active_account}")
except:
    print("👤 [ACCOUNT] לא הצלחתי למשוך את שם החשבון")

# 2. משיכת הטוקן החי מהטרמינל
token = subprocess.check_output("gcloud auth print-access-token", shell=True).decode("utf-8").strip()
creds = google.oauth2.credentials.Credentials(token)
client = dataplex_v1.CatalogServiceClient(credentials=creds)

entry_name = f"projects/{PROJECT_ID}/locations/{LOCATION}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/{DATASET_ID}/tables/{TABLE_ID}"

# בניית הנתיב המלא של ה-Aspect Type שלכם בגוגל
aspect_type_path = f"projects/{PROJECT_ID}/locations/{LOCATION}/aspectTypes/ui-metadata"

print("\n🔮 פונה לגוגל קלאוד בעזרת EntryView.CUSTOM (בדיוק כמו שה-UI עושה)...")
try:
    # ✨ הפיצוח: מאלצים את גוגל להביא את האספקט הספציפי במצב CUSTOM
    request = dataplex_v1.GetEntryRequest(
        name=entry_name,
        view=dataplex_v1.EntryView.CUSTOM,
        aspect_types=[aspect_type_path]
    )
    
    entry = client.get_entry(request=request)
    raw_json = MessageToJson(entry._pb)
    
    print("\n🔮 --- ה-JSON שהתקבל בקריאה הממוקדת --- 🔮")
    import json
    parsed = json.loads(raw_json)
    ui_aspect = parsed.get("aspects", {}).get("231125788095.me-west1.ui-metadata", {})
    print(json.dumps(ui_aspect, indent=2))
    
except Exception as e:
    print(f"❌ נכשל בפורמט CUSTOM המלא, מנסה וריאציה קצרה... שגיאה: {e}")
    try:
        # ניסיון גיבוי למקרה שגוגל מעדיפה רק את ה-ID הקצר ברשימה
        request = dataplex_v1.GetEntryRequest(
            name=entry_name,
            view=dataplex_v1.EntryView.CUSTOM,
            aspect_types=["ui-metadata"]
        )
        entry = client.get_entry(request=request)
        raw_json = MessageToJson(entry._pb)
        import json
        parsed = json.loads(raw_json)
        print(json.dumps(parsed.get("aspects", {}), indent=2))
    except Exception as e2:
        print(f"❌ גם הוריאציה השנייה נכשלה: {e2}")
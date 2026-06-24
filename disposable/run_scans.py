import sys
import re
from google.cloud import dataplex_v1

# ---- הגדרות הפרויקט והסינון ----
PROJECT_ID = "dgt-gcp-econ-dev-datalake"  
LOCATION = "me-west1"  # סורק את כל ה-Locations בפרויקט שבהם קיימות סריקות

EXCLUDED_DATASETS = {
    "dataplex_insights_outputs",
    "temp",
    "Logging",
    "admin",
    "metrics",
}

def run_filtered_scans():
    # אתחול הלקוח של Dataplex DataScan
    client = dataplex_v1.DataScanServiceClient()
    parent = f"projects/{PROJECT_ID}/locations/{LOCATION}"

    print(f"🔎 מזהה ומאחזר את כל סריקות ה-Data Profile בפרויקט: {PROJECT_ID}...")
    
    try:
        # שליפת כל הסריקות הקיימות בפרויקט
        request = dataplex_v1.ListDataScansRequest(parent=parent)
        page_result = client.list_data_scans(request=request)
        
        scans_triggered = 0

        for scan in page_result:
            # מתוך ה-Resource Name המלא, נחלץ רק את ה-Scan ID האחרון
            scan_id = scan.name.split("/")[-1]
            
            # בדיקה האם הסריקה מתחילה ב-prefix הנדרש: scan-[dataset]-[table]
            if not scan_id.startswith("scan-"):
                continue
            
            # חילוץ שם ה-Dataset מתוך מבנה השם (הטקסט שנמצא בין המקף הראשון לשני)
            # דוגמה: scan-MSSQL_foreign_trade-technician_travels -> MSSQL_foreign_trade
            match = re.match(r"^scan-([^-]+)-", scan_id)
            if not match:
                continue
                
            dataset_name = match.group(1)

            # בדיקה האם ה-Dataset נמצא ברשימת ההחרגה
            if dataset_name in EXCLUDED_DATASETS:
                print(f"⏭️  מדלג על סריקה '{scan_id}' מכיוון שה-Dataset '{dataset_name}' מוחרג.")
                continue

            # הרצת הסריקה בפועל
            print(f"🚀 מפעיל את הסריקה: {scan_id} (Dataset: {dataset_name})...")
            try:
                run_request = dataplex_v1.RunDataScanRequest(name=scan.name)
                client.run_data_scan(request=run_request)
                scans_triggered += 1
            except Exception as run_error:
                print(f"❌ שגיאה בהפעלת הסריקה {scan_id}: {run_error}")

        print(f"\n✅ סיום! הופעלו בהצלחה {scans_triggered} סריקות פרופילינג.")

    except Exception as e:
        print(f"❌ שגיאה כללית בשליפת הסריקות מהפרויקט: {e}", file=sys.stderr)

if __name__ == "__main__":
    run_filtered_scans()
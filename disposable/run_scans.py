import sys
from google.cloud import dataplex_v1

# ---- הגדרות הפרויקט והמיקום ----
PROJECT_ID = "dgt-gcp-econ-dev-datalake"
LOCATION = "me-west1"  

def run_all_scans_unconditional():
    # אתחול הלקוח של Dataplex
    client = dataplex_v1.DataScanServiceClient()
    parent = f"projects/{PROJECT_ID}/locations/{LOCATION}"

    print(f"🚀 מתחיל הפעלה גורפת של כל הסריקות שמתחילות ב-'scan-' בפרויקט {PROJECT_ID} (אזור: {LOCATION})...")
    
    try:
        # שליפת כל הסריקות הקיימות במיקום המוגדר
        request = dataplex_v1.ListDataScansRequest(parent=parent)
        page_result = client.list_data_scans(request=request)
        
        scans_triggered = 0
        scans_skipped = 0

        for scan in page_result:
            # חילוץ ה-ID של הסריקה
            scan_id = scan.name.split("/")[-1]
            
            # בדיקה פשוטה וגמישה בלבד: האם מתחיל ב-scan-?
            if scan_id.startswith("scan-"):
                print(f"⚡ מפעיל את הסריקה: {scan_id}...")
                try:
                    run_request = dataplex_v1.RunDataScanRequest(name=scan.name)
                    client.run_data_scan(request=run_request)
                    scans_triggered += 1
                except Exception as run_error:
                    print(f"❌ שגיאה בהפעלת הסריקה {scan_id}: {run_error}")
            else:
                scans_skipped += 1

        print(f"\n✅ סיום התהליך!")
        print(f"🎯 סך הכל הופעלו בהצלחה: {scans_triggered} סריקות.")
        print(f"ℹ️  סריקות אחרות (ללא קידומת scan-) שנדחו: {scans_skipped}")

    except Exception as e:
        print(f"❌ שגיאה כללית בשליפת או הרצת הסריקות: {e}", file=sys.stderr)

if __name__ == "__main__":
    run_all_scans_unconditional()
import sys
from google.cloud import dataplex_v1

PROJECT_ID = "dgt-gcp-econ-dev-datalake"
LOCATION = "me-west1"

def inspect_first_scan():
    client = dataplex_v1.DataScanServiceClient()
    parent = f"projects/{PROJECT_ID}/locations/{LOCATION}"

    try:
        request = dataplex_v1.ListDataScansRequest(parent=parent)
        page_result = client.list_data_scans(request=request)
        
        # לוקחים את הסריקה הראשונה שמתחילה ב-scan- ומדפיסים את המבנה שלה
        for scan in page_result:
            scan_id = scan.name.split("/")[-1]
            if scan_id.startswith("scan-") and hasattr(scan, "data_profile_spec"):
                print("\n==========================================")
                print(f"🔍 חוקר את מבנה הסריקה: {scan_id}")
                print("==========================================\n")
                
                # הדפסת השדות הזמינים בתוך ה-DataProfileSpec
                print("--- השדות הקיימים בתוך data_profile_spec הם: ---")
                print(dir(scan.data_profile_spec))
                
                print("\n--- ייצוג הטקסט המלא של ה-Spec (אם יש הגדרות קיימות): ---")
                print(scan.data_profile_spec)
                
                # אם קיים post_scan_actions, נחקור גם אותו
                if hasattr(scan.data_profile_spec, "post_scan_actions"):
                    print("\n--- השדות הקיימים בתוך post_scan_actions הם: ---")
                    print(dir(scan.data_profile_spec.post_scan_actions))
                    print(scan.data_profile_spec.post_scan_actions)
                
                return # עוצרים אחרי הראשונה

        print("⚠️ לא נמצאה סריקה מתאימה לחקירה.")
    except Exception as e:
        print(f"❌ שגיאה במהלך החקירה: {e}", file=sys.stderr)

if __name__ == "__main__":
    inspect_first_scan()
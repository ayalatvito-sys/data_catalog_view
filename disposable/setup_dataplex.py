# import time
# from google.cloud import bigquery
# from google.cloud import dataplex_v1
# from google.api_core.exceptions import AlreadyExists, NotFound

# # ==================== הגדרות משתנים ====================
# PROJECT_ID = "dgt-gcp-econ-dev-datalake"  # החלף בשם הפרויקט שלך ב-GCP
# LOCATION = "me-west1"         # האזור (Region) שבו הנתונים וה-Dataplex נמצאים
# TARGET_DATASET = "dataplex_insights_outputs"
# # =======================================================

# def init_clients():
#     bq_client = bigquery.Client(project=PROJECT_ID)
#     dataplex_client = dataplex_v1.DataScanServiceClient()
#     return bq_client, dataplex_client

# def ensure_target_dataset(bq_client):
#     """בודק אם ה-Dataset קיים, ואם לא - יוצר אותו"""
#     dataset_ref = bq_client.dataset(TARGET_DATASET)
#     try:
#         # בדיקה אם ה-Dataset קיים באמת
#         bq_client.get_dataset(dataset_ref)
#         print(f"Target dataset '{TARGET_DATASET}' already exists. Moving on...")
#     except NotFound:
#         # אם הוא לא נמצא, רק אז מייצרים אותו
#         dataset = bigquery.Dataset(dataset_ref)
#         dataset.location = LOCATION
#         bq_client.create_dataset(dataset, timeout=30)
#         print(f"Created target dataset: {TARGET_DATASET}")
#     except Exception as e:
#         # לכל מקרה של שגיאה אחרת (כמו בעיית הרשאות), שלא נקרוס אלא נדע מה קרה
#         print(f"Note regarding target dataset: {e}")
# def create_dataplex_scan(dataplex_client, source_dataset, source_table):
#     """מייצר משימת סריקה ב-Dataplex לפי ה-Schema המעודכנת של GCP"""
    
#     # הגדרת הטבלה המרכזית שקלט הנתונים יישפך אליה עבור ה-Dataset הספציפי הזה
#     target_table_name = f"insights_results_{source_dataset}"
#     results_table_path = f"projects/{PROJECT_ID}/datasets/{TARGET_DATASET}/tables/{target_table_name}"
    
#     # נתיב משאב המקור (הטבלה שסורקים)
#     source_resource = f"//bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/{source_dataset}/tables/{source_table}"
    
#     # מזהה ייחודי עבור ה-DataScan ב-Dataplex
#     scan_id = f"scan-{source_dataset}-{source_table}".replace("_", "-").lower()
#     parent = f"projects/{PROJECT_ID}/locations/{LOCATION}"
    
#     # ---- התיקון המעודכן: post_scan_actions נמצא כעת בתוך ה-data_profile_spec ----
#     scan_data = {
#         "data": {
#             "resource": source_resource
#         },
#         "data_profile_spec": {
#             "post_scan_actions": {
#                 "bigquery_export": {
#                     "results_table": results_table_path
#                 }
#             }
#         }
#     }
    
#     # המרה של המילון לאובייקט DataScan
#     scan = dataplex_v1.DataScan(scan_data)
    
#     request = dataplex_v1.CreateDataScanRequest(
#         parent=parent,
#         data_scan=scan,
#         data_scan_id=scan_id
#     )
    
#     try:
#         operation = dataplex_client.create_data_scan(request=request)
#         print(f"  -> Creating DataScan for {source_table}... Waiting to finish...")
#         operation.result()  # ממתין ליצירת ה-Scan ב-GCP
#         print(f"  ✓ DataScan created successfully: {scan_id}")
#     except AlreadyExists:
#         print(f"  - DataScan {scan_id} already exists, skipping creation.")
#     except Exception as e:
#         print(f"  ✗ Failed to create scan for {source_table}: {e}")
                
# def main():
#     bq_client, dataplex_client = init_clients()
    
#     # 1. וידוא קיום ה-Dataset המרכזי לתוצאות
#     ensure_target_dataset(bq_client)
    
#     # 2. ריצה על כל ה-Datasets בפרויקט
#     datasets = list(bq_client.list_datasets())
#     print(f"Found {len(datasets)} datasets in project {PROJECT_ID}")
    
#     for dataset in datasets:
#         ds_id = dataset.dataset_id
        
#         # מדלגים על ה-Dataset של התוצאות עצמו כדי למנוע לולאה אינסופית
#         if ds_id == TARGET_DATASET:
#             continue
            
#         print(f"\nProcessing Dataset: {ds_id}")
        
#         # 3. שליפת כל הטבלאות מתוך ה-Dataset הנוכחי
#         try:
#             tables = list(bq_client.list_tables(ds_id))
#             if not tables:
#                 print(f" No tables found in dataset {ds_id}.")
#                 continue
                
#             for table in tables:
#                 # 4. יצירת סריקה לכל טבלה
#                 create_dataplex_scan(dataplex_client, ds_id, table.table_id)
                
#         except Exception as e:
#             print(f"Error accessing dataset {ds_id}: {e}")

# if __name__ == "__main__":
#     main()


import time
from google.cloud import bigquery
from google.cloud import dataplex_v1
from google.api_core.exceptions import AlreadyExists, NotFound

# ==================== הגדרות משתנים מעודכנות ====================
PROJECT_ID = "dgt-gcp-econ-dev-datalake"  # שם הפרויקט שלך
LOCATION = "me-west1"                 # ה-Region האירופי שבו הנתונים נמצאים
TARGET_DATASET = "dataplex_insights_outputs"
TARGET_TABLE = "central_data_profiles"    # טבלת היעד המרכזית עבור כל החברה
# רשימת Datasets טכניים שנדלג עליהם אוטומטית כדי לחסוך כסף ולמנוע רעש

DATASETS_TO_SKIP = [TARGET_DATASET, "Logging", "admin", "metrics"]
# =======================================================

def init_clients():
    bq_client = bigquery.Client(project=PROJECT_ID)
    dataplex_client = dataplex_v1.DataScanServiceClient()
    return bq_client, dataplex_client

def ensure_target_dataset(bq_client):
    """בודק אם ה-Dataset המרכזי קיים, ואם לא - יוצר אותו"""
    dataset_ref = bq_client.dataset(TARGET_DATASET)
    try:
        bq_client.get_dataset(dataset_ref)
        print(f"Target dataset '{TARGET_DATASET}' exists. Moving on...")
    except NotFound:
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = LOCATION
        bq_client.create_dataset(dataset, timeout=30)
        print(f"✓ Created central target dataset: {TARGET_DATASET}")
    except Exception as e:
        print(f"Note regarding target dataset: {e}")

def create_dataplex_scan(dataplex_client, source_dataset, source_table):
    """מייצר משימת סריקה ב-Dataplex ומנתב את התוצאה לטבלה המרכזית"""
    
    # נתיב קבוע לטבלה המרכזית - כולם כותבים לאותו מקום לטובת המפה שלכם
    results_table_path = f"projects/{PROJECT_ID}/datasets/{TARGET_DATASET}/tables/{TARGET_TABLE}"
    
    # נתיב משאב המקור (הטבלה הנוכחית שנסרקת)
    source_resource = f"//bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/{source_dataset}/tables/{source_table}"
    
    # מזהה ייחודי קבוע ומאובטח לסריקה (אותיות קטנות ומקפים בלבד)
    scan_id = f"scan-{source_dataset}-{source_table}".replace("_", "-").lower()
    parent = f"projects/{PROJECT_ID}/locations/{LOCATION}"
    
    # בניית מבנה הנתונים התואם לעדכוני ה-API האחרונים של גוגל (ה-Export יושב בתוך ה-Profile Spec)
    scan_data = {
        "data": {
            "resource": source_resource
        },
        "data_profile_spec": {
            "post_scan_actions": {
                "bigquery_export": {
                    "results_table": results_table_path
                }
            }
        }
    }
    
    scan = dataplex_v1.DataScan(scan_data)
    request = dataplex_v1.CreateDataScanRequest(
        parent=parent,
        data_scan=scan,
        data_scan_id=scan_id
    )
    
    try:
        # שליחת בקשת היצירה לגוגל
        operation = dataplex_client.create_data_scan(request=request)
        print(f"  -> Requesting DataScan for {source_table}...")
        operation.result()  # ממתין מספר שניות לאישור היצירה ב-GCP
        print(f"  ✓ DataScan created successfully: {scan_id}")
    except AlreadyExists:
        print(f"  - DataScan {scan_id} already exists. Skipped.")
    except Exception as e:
        # דילוג אוטומטי על טבלאות לא נתמכות (כמו Views או טבלאות חיצוניות) בלי לעצור את הריצה
        print(f"  ✗ Skipped {source_table} (Likely a View or External table): {e}")

def main():
    bq_client, dataplex_client = init_clients()
    
    # 1. וידוא קיום ה-Dataset המרכזי
    ensure_target_dataset(bq_client)
    
    # 2. שליפת כל ה-Datasets בפרויקט
    datasets = list(bq_client.list_datasets())
    print(f"Found {len(datasets)} datasets in project {PROJECT_ID}")
    
    for dataset in datasets:
        ds_id = dataset.dataset_id
        
        # דילוג על ה-Dataset של התוצאות עצמו כדי למנוע לולאה עצמית
        if ds_id in DATASETS_TO_SKIP:
            print(f"\nSkipping technical dataset: {ds_id}")
            continue
            
        print(f"\nProcessing Dataset: {ds_id}")
        
        try:
            # 3. שליפת הטבלאות מתוך ה-Dataset הנוכחי
            tables = list(bq_client.list_tables(ds_id))
            if not tables:
                print(f"  No tables found in dataset {ds_id}.")
                continue
                
            for table in tables:
                # 4. יצירת סריקה ממוקדת לכל טבלה בפרויקט
                create_dataplex_scan(dataplex_client, ds_id, table.table_id)
                
        except Exception as e:
            print(f"  Error accessing dataset {ds_id}: {e}")

if __name__ == "__main__":
    main()
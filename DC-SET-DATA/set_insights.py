from google.cloud import bigquery
from google.cloud import dataplex_v1

project_id = "dgt-gcp-econ-dev-datalake"
location = "me-west1" # שנו לאזור שבו נמצאים ה-Datasets שלכם

bq_client = bigquery.Client(project=project_id)
dataplex_client = dataplex_v1.DataScanServiceClient()

datasets = bq_client.list_datasets()

for dataset in datasets:
    dataset_id = dataset.dataset_id
    print(f"Working on: {dataset_id}")
    
    # הגדרת ה-DataScan בצורה מפורשת
    scan_id = f"insights-{dataset_id.replace('_', '-')}" # ה-ID חייב להיות עם מקפים ולא קו תחתי
    parent = f"projects/{project_id}/locations/{location}"
    
    # יצירת האובייקט בצורה בטוחה
    ds_obj = dataplex_v1.DataScan()
    ds_obj.data.resource = f"//bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}"
    
    # כאן אנחנו מגדירים את ה-Spec - שימי לב לשם השדה המדויק
    ds_obj.data_documentation_spec = dataplex_v1.DataScan.DataDocumentationSpec()
    
    # פרסום ל-Catalog
    ds_obj.data_documentation_spec.catalog_publishing_enabled = True

    try:
        # בדיקה אם סריקה כזו כבר קיימת (אופציונלי)
        request = dataplex_v1.CreateDataScanRequest(
            parent=parent,
            data_scan=ds_obj,
            data_scan_id=scan_id
        )
        
        operation = dataplex_client.create_data_scan(request=request)
        print(f"Successfully started scan for {dataset_id}. Op: {operation.name}")
        
    except Exception as e:
        print(f"Error for {dataset_id}: {e}")
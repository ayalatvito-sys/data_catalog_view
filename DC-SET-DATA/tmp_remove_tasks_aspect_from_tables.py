import os
from google.cloud import bigquery
from google.cloud import dataplex_v1
from google.protobuf import field_mask_pb2

# --- הגדרות ---
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "dgt-gcp-econ-dev-datalake") 
LOCATION = os.getenv("GCP_LOCATION", "me-west1")

def remove_tasks_aspect_from_tables():
    bq_client = bigquery.Client(project=PROJECT_ID)
    dataplex_client = dataplex_v1.CatalogServiceClient()

    print(f"Starting aspect cleanup in project: {PROJECT_ID}")
    
    datasets = list(bq_client.list_datasets())
    
    for dataset in datasets:
        dataset_id = dataset.dataset_id
        
        # דילוג על MSSQL_mss_production
        if dataset_id == "MSSQL_mss_production":
            print(f"⏭️ Skipping dataset: {dataset_id}")
            continue
            
        print(f"📁 Scanning dataset: {dataset_id}")
        tables = list(bq_client.list_tables(dataset_id))
        
        for table in tables:
            table_id = table.table_id
            
            entry_name = (
                f"projects/{PROJECT_ID}/locations/{LOCATION}"
                f"/entryGroups/@bigquery/entries/"
                f"bigquery.googleapis.com/projects/{PROJECT_ID}"
                f"/datasets/{dataset_id}/tables/{table_id}"
            )
            
            try:
                # 1. מביאים את האובייקט בשביל לשלוף את המפתח המדויק של האספקט ששמור עליו
                request = dataplex_v1.GetEntryRequest(
                    name=entry_name,
                    view=dataplex_v1.EntryView.FULL
                )
                
                try:
                    entry = dataplex_client.get_entry(request=request)
                except Exception:
                    continue

                # 2. מוצאים את המפתח המדויק של אספקט המשימות
                matched_keys = [k for k in entry.aspects.keys() if "db-tasks-information" in k]
                
                if matched_keys:
                    print(f"   🗑️ Found aspect on {dataset_id}.{table_id}. Removing...")
                    
                    # 3. מרוקנים את כל האספקטים מהאובייקט המקומי (זה לא מוחק אותם בפועל עדיין)
                    entry.aspects.clear()
                    
                    # 4. שולחים בקשת מחיקה ממוקדת באמצעות UpdateEntry
                    update_request = dataplex_v1.UpdateEntryRequest(
                        entry=entry,
                        update_mask=field_mask_pb2.FieldMask(paths=["aspects"]),
                        aspect_keys=matched_keys,   # 🎯 הקסם: "תסתכל רק על האספקט הזה"
                        delete_missing_aspects=True # 🗑️ אומר למערכת למחוק את מה שסומן ב-aspect_keys כי הוא לא קיים יותר באובייקט
                    )
                    
                    dataplex_client.update_entry(request=update_request)
                    print(f"      ✅ Successfully removed.")
                    
            except Exception as e:
                print(f"   ❌ Error processing {dataset_id}.{table_id}: {e}")

    print("🎉 Cleanup completed!")

if __name__ == "__main__":
    remove_tasks_aspect_from_tables()
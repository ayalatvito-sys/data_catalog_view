from google.cloud import dataplex_v1

PROJECT_ID = "dgt-gcp-econ-dev-datalake"
LOCATION = "me-west1"
DATASET_ID = "MSSQL_mss_production"
TABLE_ID = "diamond_promil_payments"

client = dataplex_v1.CatalogServiceClient()
schema_name = "projects/dataplex-types/locations/global/aspectTypes/data-profile"

print("🔍 1. Fetching the official Schema for Data Profile...")
try:
    aspect_type = client.get_aspect_type(name=schema_name)
    print("✅ SCHEMA METADATA TEMPLATE:")
    print(aspect_type.metadata_template)
except Exception as e:
    print(f"❌ Schema fetch error: {e}")

print("\n--------------------------------------------------\n")

print("🔍 2. Forcing Google to fetch the actual payload using CUSTOM view...")
entry_name = (
    f"projects/{PROJECT_ID}/locations/{LOCATION}/entryGroups/@bigquery/"
    f"entries/bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/{DATASET_ID}/tables/{TABLE_ID}"
)

# ה-CUSTOM יחד עם ציון הנתיב המפורש מכריח את ה-API להביא את הנתונים עצמם!
req = dataplex_v1.GetEntryRequest(
    name=entry_name,
    view=dataplex_v1.EntryView.CUSTOM,
    aspect_types=[schema_name]
)

try:
    entry = client.get_entry(request=req)
    found = False
    
    for key, aspect in entry.aspects.items():
        if "data-profile" in key.lower():
            found = True
            print(f"✅ Found Aspect: {key}")
            
            if aspect.data:
                print("\n🎉 SUCCESS! WE GOT THE DATA DICT:")
                print(dict(aspect.data))
            else:
                print("\n❌ The 'data' field is STILL totally empty!")
                
    if not found:
         print("❌ Aspect not found in the explicit CUSTOM request.")

except Exception as e:
    print(f"❌ Fetch Error: {e}")
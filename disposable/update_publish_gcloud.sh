#!/bin/bash

PROJECT_ID="dgt-gcp-econ-dev-datalake"
LOCATION="me-west1" # <-- שני למיקום המדויק של הסריקות שלך (למשל me-west1)

# רשימת ה-Datasets להחרגה (מופרדים ברווח)
EXCLUDED_DATASETS="dataplex_insights_outputs temp Logging admin metrics"

echo "🔄 מתחיל עדכון הגדרות פרסום (Publish) ל-YES ללא מחיקה..."

# 1. שליפת כל נתיבי הסריקות שמתחילות ב-scan- בפרויקט ובמיקום הספציפי
SCANS=$(gcloud dataplex datascans list --location=$LOCATION --project=$PROJECT_ID --format="value(name)")

for SCAN_PATH in $SCANS; do
    # חילוץ ה-ID של הסריקה מתוך הנתיב
    SCAN_ID=$(basename $SCAN_PATH)
    
    # בדיקה אם זו סריקה שמתחילה ב-prefix שלנו
    if [[ $SCAN_ID == scan-* ]]; then
        
        # חילוץ שם ה-Dataset (הטקסט בין המקף הראשון לשני)
        DATASET_NAME=$(echo $SCAN_ID | cut -d'-' -f2)
        
        # בדיקה אם ה-Dataset נמצא ברשימת ההחרגה
        if [[ " $EXCLUDED_DATASETS " =~ " $DATASET_NAME " ]]; then
            echo "⏭️  מדלג על החרגה: $SCAN_ID"
            continue
        fi
        
        echo "🛠️  מעדכן הגדרת Publish ל-YES עבור: $SCAN_ID"
        
        # עדכון הסריקה הקיימת במקומה!
        gcloud dataplex datascans update data-profile $SCAN_ID \
            --location=$LOCATION \
            --project=$PROJECT_ID \
            --enable-catalog-publishing
            
    fi
done

echo "✅ העדכון הסתיים בהצלחה! כל הסריקות הרלוונטיות עודכנו ל-Publish=YES (ללא מחיקה)."
echo "כעת את יכולה להריץ מחדש את סקריפט הפייתון הראשון שלך (`run_scans.py`) כדי להפעיל את כולן מחדש!"
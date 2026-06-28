import json
import csv

# 1. קריאת קובץ ה-JSON המקורי שלך
with open('insights_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 2. כתיבת הנתונים לקובץ CSV חדש
with open('insights_relationships.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    
    # כתיבת שורת הכותרות (Headers)
    writer.writerow(['table1', 'table2', 'relationship', 'source'])
    
    # מאחר ו-data הוא כבר הרשימה עצמה, נרוץ ישירות עליו בלולאה
    for row in data:
        writer.writerow([
            row.get('table1'), 
            row.get('table2'), 
            row.get('relationship'), 
            row.get('source')
        ])

print("הקובץ הומר בהצלחה ומאובטח מקומית!")
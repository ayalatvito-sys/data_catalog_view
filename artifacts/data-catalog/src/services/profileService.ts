// API service layer for Table Profile data fetching.
// Keeps network logic out of page/component files.

import { ProfileResponse } from '../types/profile';

export async function fetchTableProfile(
  datasetId: string,
  tableId: string,
): Promise<ProfileResponse> {
  const response = await fetch(
    `/api/datasets/${datasetId}/tables/${tableId}/profile`,
  );
  if (!response.ok) {
    throw new Error('שגיאה בשליפת פרופיל הנתונים');
  }
  return response.json() as Promise<ProfileResponse>;
}

// API service layer for Table Profile data fetching.
// Keeps network logic out of page/component files.

import { ProfileResponse } from '../types/profile';

export async function fetchTableProfile(
  datasetId: string,
  tableId: string,
  refresh = false,
): Promise<ProfileResponse> {
  const url = `/api/datasets/${datasetId}/tables/${tableId}/profile${refresh ? '?refresh=true' : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('שגיאה בשליפת פרופיל הנתונים');
  }
  return response.json() as Promise<ProfileResponse>;
}

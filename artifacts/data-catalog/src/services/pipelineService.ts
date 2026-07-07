// API service layer for Pipeline Status data fetching.

export interface PipelineStatus {
  pipeline_name: string | null;
  environment: string | null;
  as_of_date: string | null; // ISO datetime string from the API
  current_status: string | null;
}

export interface PipelineStatusResponse {
  pipelines: PipelineStatus[];
}

export async function fetchPipelineStatuses(
  refresh = false,
): Promise<PipelineStatusResponse> {
  const url = `/api/pipelines/status${refresh ? '?refresh=true' : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('שגיאה בשליפת סטטוס הצינורות');
  }
  return response.json() as Promise<PipelineStatusResponse>;
}

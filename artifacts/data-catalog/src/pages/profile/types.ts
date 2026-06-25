export interface TopNValue {
  value: string;
  percentage?: number;
  count?: number;
}

export interface NumericStats {
  min?: number;
  max?: number;
  avg?: number;
  stdDev?: number;
  median?: number;
  quartiles?: number[];
}

export interface StringStats {
  min_length?: number;
  max_length?: number;
  avg_length?: number;
}

export interface DatetimeStats {
  min?: string;
  max?: string;
  format?: string;
}

export interface ColumnProfile {
  column_name: string;
  data_type: string;
  nullness: number;
  uniqueness: number;
  top_n: TopNValue[];
  numeric_stats?: NumericStats;
  string_stats?: StringStats;
  datetime_stats?: DatetimeStats;
}

export interface ProfileResponse {
  table_id: string;
  scanned_rows?: number;
  columns: ColumnProfile[];
}
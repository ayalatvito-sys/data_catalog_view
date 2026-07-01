from typing import Optional, List
from pydantic import BaseModel

class Dataset(BaseModel):
    dataset_id: str
    description: Optional[str] = None
    description_he: Optional[str] = None
    location: str
    tables_count: int
    created_at: str
    last_modified: Optional[str] = None


class DatasetList(BaseModel):
    datasets: List[Dataset]
    total: int


class CatalogStats(BaseModel):
    total_datasets: int
    total_tables: int
    locations_count: int
    project_id: str
    last_updated: Optional[str] = None


class LocationList(BaseModel):
    locations: List[str]


class TableDetail(BaseModel):
    table_id: str
    table_type: str
    creation_time: Optional[str] = None
    row_count: int = 0
    size_bytes: int = 0
    last_modified: Optional[str] = None
    is_financial: bool = False
    is_geographical: bool = False
    is_sensitive: bool = False
    financial_columns: Optional[str] = None
    geographical_columns: Optional[str] = None
    sensitive_columns: Optional[str] = None
    # --- השדות החדשים מהתיוג שלנו ---
    project_name: str = "כללי"
    system_name: Optional[str] = None
    project_manager: Optional[str] = None
    characterization_link: Optional[str] = None


class TableList(BaseModel):
    tables: List[TableDetail]
    total: int


class Relationship(BaseModel):
    edge_id: str
    source_dataset: str
    source_table: str
    target_dataset: str
    target_table: str
    relationship_type: str
    confidence_score: float
    description_edge: Optional[str] = None
    last_updated: Optional[str] = None


class RelationshipList(BaseModel):
    relationships: List[Relationship]
    total: int


class ErrorResponse(BaseModel):
    error: str


class TopNValue(BaseModel):
    value: str
    percentage: Optional[float] = None
    count: Optional[int] = None

class NumericStats(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    avg: Optional[float] = None
    stdDev: Optional[float] = None
    median: Optional[float] = None
    quartiles: List[float] = []

class StringStats(BaseModel):
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    avg_length: Optional[float] = None

class DatetimeStats(BaseModel):
    min: Optional[str] = None
    max: Optional[str] = None
    format: Optional[str] = None

class ColumnProfile(BaseModel):
    column_name: str
    data_type: str = "UNKNOWN" # שדה הסוג (STRING/NUMERIC/DATETIME)
    nullness: Optional[float] = 0.0
    uniqueness: Optional[float] = 0.0
    top_n: List[TopNValue] = []
    numeric_stats: Optional[NumericStats] = None
    string_stats: Optional[StringStats] = None
    datetime_stats: Optional[DatetimeStats] = None

class TableProfileResponse(BaseModel):
    table_id: str
    scanned_rows: Optional[int] = None
    columns: List[ColumnProfile] = []
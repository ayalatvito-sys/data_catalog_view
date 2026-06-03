from typing import Optional, List
from pydantic import BaseModel


class Dataset(BaseModel):
    dataset_id: str
    description: Optional[str] = None
    description_he: Optional[str] = None
    location: str
    tables_count: int
    created_at: str


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


class ErrorResponse(BaseModel):
    error: str

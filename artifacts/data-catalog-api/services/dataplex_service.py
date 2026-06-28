import asyncio
import logging
from typing import Optional

from cache_utils import cached

logger = logging.getLogger(__name__)

class DataplexService:
    """
    שולף aspects מ-Dataplex Knowledge Catalog לכל טבלה.
    aspect key: {project_id}.me-west1.ui-metadata
    fields: is-financial, is-geographical, is-sensitive
    """
    def __init__(self, project_id: str, location: str = "me-west1"):
        self.project_id = project_id
        self.location = location
        self._client = None
        self._available = False
        self._init_client()

    def _init_client(self):
        try:
            from google.cloud import dataplex_v1
            self._client = dataplex_v1.CatalogServiceClient()
            self._available = True
            logger.info("Dataplex CatalogService client initialized successfully")
        except Exception as e:
            self._available = False
            logger.warning("Dataplex init failed: %s", e)

    @property
    def is_available(self) -> bool:
        return self._available

    @cached(ttl=300)
    async def get_table_aspects(self, dataset_id: str, table_id: str, *, refresh: bool = False) -> dict:
        defaults = {"is_financial": False, "is_geographical": False, "is_sensitive": False}
        if not self._available:
            return defaults
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._fetch_aspects, dataset_id, table_id
        )

    def _fetch_aspects(self, dataset_id: str, table_id: str) -> dict:
        defaults = {"is_financial": False, "is_geographical": False, "is_sensitive": False}
        try:
            proj = self.project_id
            entry_name = (
                f"projects/{proj}/locations/{self.location}"
                f"/entryGroups/@bigquery/entries/"
                f"bigquery.googleapis.com/projects/{proj}"
                f"/datasets/{dataset_id}/tables/{table_id}"
            )
            
            from google.cloud import dataplex_v1
            
            aspect_type_path = f"projects/{proj}/locations/{self.location}/aspectTypes/ui-metadata"
            tasks_aspect_path = f"projects/{proj}/locations/{self.location}/aspectTypes/db-tasks-information"
            
            request = dataplex_v1.GetEntryRequest(
                name=entry_name,
                view=dataplex_v1.EntryView.CUSTOM,
                aspect_types=[aspect_type_path, tasks_aspect_path]
            )
            
            entry = self._client.get_entry(request=request)
            aspects = entry.aspects or {}

            # --- דיבוג (נשאיר רק עבור טבלת ה-diamond_dealers) ---
            if table_id == "diamond_dealers":
                logger.info(f"DEBUG ASPECT KEYS for {table_id}: {list(aspects.keys())}")
                for k, v in aspects.items():
                    if 'tasks' in k:
                         logger.info(f"DEBUG ASPECT DATA for {k}: {v.data}")
            # -------------------------------------------------------
            
            # שליפת הנתונים מה-UI Metadata
            matched_ui_key = next((k for k in aspects.keys() if k.endswith(".ui-metadata")), None)

            if matched_ui_key and aspects[matched_ui_key].data:
                ui_data = aspects[matched_ui_key].data
                fin_val = ui_data.get("is-financial") or ui_data.get("is_financial") or False
                geo_val = ui_data.get("is-geographical") or ui_data.get("is_geographical") or False
                sen_val = ui_data.get("is-sensitive") or ui_data.get("is_sensitive") or False

                fin_cols = ui_data.get("financial-columns") or ui_data.get("financial_columns") or ""
                geo_cols = ui_data.get("geographical-columns") or ui_data.get("geographical_columns") or ""
                sen_cols = ui_data.get("sensitive-columns") or ui_data.get("sensitive_columns") or ""
            else:
                fin_val = geo_val = sen_val = False
                fin_cols = geo_cols = sen_cols = ""

            # שליפת הנתונים מתיוג הפרויקטים שלנו
            matched_tasks_key = next((k for k in aspects.keys() if k.endswith(".db-tasks-information")), None)
            project_name = "כללי"
            system_name = project_manager = characterization_link = None
            
            if matched_tasks_key and aspects[matched_tasks_key].data:
                tasks_data = aspects[matched_tasks_key].data
                project_name = tasks_data.get("project-name") or "כללי"
                system_name = tasks_data.get("system-name")
                project_manager = tasks_data.get("project-manager")
                characterization_link = tasks_data.get("characterization-link")

            return {
                "is_financial":    bool(fin_val),
                "financial_columns": fin_cols,
                "is_geographical": bool(geo_val),
                "geographical_columns": geo_cols,
                "is_sensitive":    bool(sen_val),
                "sensitive_columns": sen_cols,
                "project_name": project_name,
                "system_name": system_name,
                "project_manager": project_manager,
                "characterization_link": characterization_link,
            }
            
        except Exception as e:
            logger.error("Aspects fetch failed for %s.%s: %s", dataset_id, table_id, e)
            return defaults

    @cached(ttl=300)
    async def get_dataset_aspects(self, dataset_id: str, *, refresh: bool = False) -> dict:
        defaults = {"is_financial": False, "is_geographical": False, "is_sensitive": False}
        if not self._available:
            return defaults
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._fetch_dataset_aspects, dataset_id
        )

    def _fetch_dataset_aspects(self, dataset_id: str) -> dict:
            defaults = {"is_financial": False, "is_geographical": False, "is_sensitive": False, "has_custom_aspects": False, "description_en": None, "description_he": None}
            if not self._available:
                return defaults
            try:
                from google.cloud import dataplex_v1
                from google.cloud import datacatalog_v1

                proj = self.project_id

                # --- 1. שליפת אנגלית מ-Data Catalog ---
                catalog_client = datacatalog_v1.DataCatalogClient()
                linked_resource = f"//bigquery.googleapis.com/projects/{proj}/datasets/{dataset_id}"
                description_en = None
                try:
                    catalog_entry = catalog_client.lookup_entry(request={"linked_resource": linked_resource})
                    description_en = catalog_entry.description
                except Exception as e:
                    logger.warning(f"Could not fetch Data Catalog description for {dataset_id}: {e}")

                entry_name = (
                    f"projects/{proj}/locations/{self.location}"
                    f"/entryGroups/@bigquery/entries/"
                    f"bigquery.googleapis.com/projects/{proj}"
                    f"/datasets/{dataset_id}"
                )
                
                aspect_type_path = f"projects/{proj}/locations/{self.location}/aspectTypes/ui-metadata"
                tasks_aspect_path = f"projects/{proj}/locations/{self.location}/aspectTypes/db-tasks-information"
                overview_full_path = "projects/dataplex-types/locations/global/aspectTypes/overview"

                request = dataplex_v1.GetEntryRequest(
                    name=entry_name,
                    view=dataplex_v1.EntryView.CUSTOM,
                    aspect_types=[aspect_type_path, tasks_aspect_path, overview_full_path]
                )
                
                entry = self._client.get_entry(request=request)
                aspects = entry.aspects or {}

                # זיהוי מפתחות
                matched_overview_key = next((k for k in aspects.keys() if k.endswith(".overview")), None)
                matched_ui_key = next((k for k in aspects.keys() if k.endswith(".ui-metadata")), None)
                matched_tasks_key = next((k for k in aspects.keys() if k.endswith(".db-tasks-information")), None)
                
                # חילוץ עברית מתוך ה-Overview
                description_he = None
                if matched_overview_key and aspects[matched_overview_key].data:
                    overview_dict = dict(aspects[matched_overview_key].data)
                    overview_content = overview_dict.get("content", "")
                    
                    header = "### Description translated into Hebrew"
                    if header in overview_content:
                        description_he = overview_content.split(header)[1].strip()

                # --- הוספת דגל חכם ---
                has_custom_aspects = bool(matched_ui_key or matched_tasks_key)

                # שליפת הנתונים מה-UI Metadata
                if matched_ui_key and aspects[matched_ui_key].data:
                    ui_data = aspects[matched_ui_key].data
                    fin_val = ui_data.get("is-financial") or ui_data.get("is_financial") or False
                    geo_val = ui_data.get("is-geographical") or ui_data.get("is_geographical") or False
                    sen_val = ui_data.get("is-sensitive") or ui_data.get("is_sensitive") or False

                    fin_cols = ui_data.get("financial-columns") or ui_data.get("financial_columns") or ""
                    geo_cols = ui_data.get("geographical-columns") or ui_data.get("geographical_columns") or ""
                    sen_cols = ui_data.get("sensitive-columns") or ui_data.get("sensitive_columns") or ""
                else:
                    fin_val = geo_val = sen_val = False
                    fin_cols = geo_cols = sen_cols = ""

                # שליפת הנתונים מתיוג הפרויקטים שלנו
                project_name = "כללי"
                system_name = project_manager = characterization_link = None
                
                if matched_tasks_key and aspects[matched_tasks_key].data:
                    tasks_data = aspects[matched_tasks_key].data
                    project_name = tasks_data.get("project-name") or "כללי"
                    system_name = tasks_data.get("system-name")
                    project_manager = tasks_data.get("project-manager")
                    characterization_link = tasks_data.get("characterization-link")

                return {
                    "is_financial":    bool(fin_val),
                    "financial_columns": fin_cols,
                    "is_geographical": bool(geo_val),
                    "geographical_columns": geo_cols,
                    "is_sensitive":    bool(sen_val),
                    "sensitive_columns": sen_cols,
                    "project_name": project_name,
                    "system_name": system_name,
                    "project_manager": project_manager,
                    "characterization_link": characterization_link,
                    "has_custom_aspects": has_custom_aspects,
                    "description_en": description_en,
                    "description_he": description_he,
                }
                
            except Exception as e:
                logger.error("Aspects fetch failed for dataset %s: %s", dataset_id, e)
                return defaults

    @cached(ttl=300)
    async def get_table_profiling(self, dataset_id: str, table_id: str, *, refresh: bool = False) -> dict:
        """שולף את הנתונים באופן אסינכרוני"""
        if not self._available:
            return {}
            
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_table_profiling_sync, dataset_id, table_id)

    def _fetch_table_profiling_sync(self, dataset_id: str, table_id: str) -> dict:
        """השליפה הפיזית מ-Dataplex במבנה של CUSTOM"""
        try:
            from google.cloud import dataplex_v1
            
            entry_name = (
                f"projects/{self.project_id}/locations/{self.location}/entryGroups/@bigquery/"
                f"entries/bigquery.googleapis.com/projects/{self.project_id}/datasets/{dataset_id}/tables/{table_id}"
            )
            
            schema_name = "projects/dataplex-types/locations/global/aspectTypes/data-profile"
            
            req = dataplex_v1.GetEntryRequest(
                name=entry_name,
                view=dataplex_v1.EntryView.CUSTOM,
                aspect_types=[schema_name]
            )
            
            entry = self._client.get_entry(request=req)
            
            # חיפוש דינאמי של מפתח הפרופיילינג
            for key, aspect in entry.aspects.items():
                if "data-profile" in key.lower():
                    if aspect.data:
                        return dict(aspect.data)
            return {}
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Profile fetch failed for %s.%s: %s", dataset_id, table_id, e)
            return {}

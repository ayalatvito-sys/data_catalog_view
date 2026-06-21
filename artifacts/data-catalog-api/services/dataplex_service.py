import asyncio
import logging
from typing import Optional

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

    async def get_table_aspects(self, dataset_id: str, table_id: str) -> dict:
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
                aspect_types=[aspect_type_path, tasks_aspect_path] # הוספנו את התבנית החדשה לבקשה
            )
            
            entry = self._client.get_entry(request=request)
            aspects = entry.aspects or {}

            # --- הדפסת הדיבוג (נראה מה באמת חוזר מגוגל) ---
            if table_id == "diamond_dealers":
                logger.info(f"DEBUG ASPECT KEYS for {table_id}: {list(aspects.keys())}")
                for k, v in aspects.items():
                    if 'tasks' in k:
                         logger.info(f"DEBUG ASPECT DATA for {k}: {v.data}")
            # ---------------------------------------------
            
            # שליפת הנתונים מה-UI Metadata
            matched_ui_key = next((k for k in aspects.keys() if k.endswith(".ui-metadata")), None)
            # if not matched_key:
            #     return defaults

            # raw_aspect = aspects[matched_key]
            # if not raw_aspect.data:
            #     return defaults
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
            # logger.debug("Aspects fetch failed for %s.%s: %s", dataset_id, table_id, e)
            logger.error("Aspects fetch failed for %s.%s: %s", dataset_id, table_id, e)
            return defaults

    async def get_dataset_aspects(self, dataset_id: str) -> dict:
        defaults = {"is_financial": False, "is_geographical": False, "is_sensitive": False}
        if not self._available:
            return defaults
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._fetch_dataset_aspects, dataset_id
        )

    # def _fetch_dataset_aspects(self, dataset_id: str) -> dict:
    #     defaults = {"is_financial": False, "is_geographical": False, "is_sensitive": False}
    #     try:
    #         proj = self.project_id
    #         # שים לב: ה-entry_name נעצר ברמת ה-dataset ולא יורד לטבלה
    #         entry_name = (
    #             f"projects/{proj}/locations/{self.location}"
    #             f"/entryGroups/@bigquery/entries/"
    #             f"bigquery.googleapis.com/projects/{proj}"
    #             f"/datasets/{dataset_id}"
    #         )
            
    #         from google.cloud import dataplex_v1
            
    #         aspect_type_path = f"projects/{proj}/locations/{self.location}/aspectTypes/ui-metadata"
    #         tasks_aspect_path = f"projects/{proj}/locations/{self.location}/aspectTypes/db-tasks-information"
            
    #         request = dataplex_v1.GetEntryRequest(
    #             name=entry_name,
    #             view=dataplex_v1.EntryView.CUSTOM,
    #             aspect_types=[aspect_type_path, tasks_aspect_path]
    #         )
            
    #         entry = self._client.get_entry(request=request)
    #         aspects = entry.aspects or {}
            
    #         # שליפת הנתונים מה-UI Metadata
    #         matched_ui_key = next((k for k in aspects.keys() if k.endswith(".ui-metadata")), None)
    #         if matched_ui_key and aspects[matched_ui_key].data:
    #             ui_data = aspects[matched_ui_key].data
    #             fin_val = ui_data.get("is-financial") or ui_data.get("is_financial") or False
    #             geo_val = ui_data.get("is-geographical") or ui_data.get("is_geographical") or False
    #             sen_val = ui_data.get("is-sensitive") or ui_data.get("is_sensitive") or False
    #         else:
    #             fin_val = geo_val = sen_val = False

    #         # שליפת הנתונים מתיוג הפרויקטים שלנו
    #         matched_tasks_key = next((k for k in aspects.keys() if k.endswith(".db-tasks-information")), None)
    #         project_name = "כללי"
    #         system_name = project_manager = characterization_link = None
            
    #         if matched_tasks_key and aspects[matched_tasks_key].data:
    #             tasks_data = aspects[matched_tasks_key].data
    #             project_name = tasks_data.get("project-name") or "כללי"
    #             system_name = tasks_data.get("system-name")
    #             project_manager = tasks_data.get("project-manager")
    #             characterization_link = tasks_data.get("characterization-link")

    #         return {
    #             "is_financial":    bool(fin_val),
    #             "is_geographical": bool(geo_val),
    #             "is_sensitive":    bool(sen_val),
    #             "project_name": project_name,
    #             "system_name": system_name,
    #             "project_manager": project_manager,
    #             "characterization_link": characterization_link,
    #         }
            
    #     except Exception as e:
    #         logger.error("Aspects fetch failed for dataset %s: %s", dataset_id, e)
    #         return defaults

    def _fetch_dataset_aspects(self, dataset_id: str) -> dict:
            # הוספנו את has_custom_aspects לערכי ברירת המחדל
            defaults = {"is_financial": False, "is_geographical": False, "is_sensitive": False, "has_custom_aspects": False}
            if not self._available:
                return defaults
            try:
                proj = self.project_id
                entry_name = (
                    f"projects/{proj}/locations/{self.location}"
                    f"/entryGroups/@bigquery/entries/"
                    f"bigquery.googleapis.com/projects/{proj}"
                    f"/datasets/{dataset_id}"
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
                
                # זיהוי מפתחות
                matched_ui_key = next((k for k in aspects.keys() if k.endswith(".ui-metadata")), None)
                matched_tasks_key = next((k for k in aspects.keys() if k.endswith(".db-tasks-information")), None)
                
                # --- הוספת דגל חכם ---
                # אם מצאנו לפחות אחד מהמפתחות שלנו, זה אומר שיש הגדרות ברמת ה-DS
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
                    "has_custom_aspects": has_custom_aspects, # מחזירים את התשובה לראוטר
                }
                
            except Exception as e:
                logger.error("Aspects fetch failed for dataset %s: %s", dataset_id, e)
                return defaults
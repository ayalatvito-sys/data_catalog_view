import asyncio
import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class TranslationService:
    def __init__(self, project_id: str):
        self.project_id = project_id
        self._cache: dict[str, str] = {}
        self._client = None
        self._available = False
        self._initialized = False

    def _init_client(self):
        if self._initialized:
            return
        self._initialized = True
        try:
            from google.cloud import translate_v2 as translate
            self._client = translate.Client()
            self._available = True
            logger.info("Google Cloud Translation API initialized successfully")
        except Exception as e:
            logger.warning(f"Translation API not available, using English fallback: {e}")
            self._available = False

    async def translate_to_hebrew(self, text: str) -> str:
        if not text or not text.strip():
            return text

        self._init_client()

        if not self._available:
            return text

        cache_key = hashlib.md5(text.encode()).hexdigest()
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self._client.translate(text, target_language="iw", source_language="en"),
            )
            translated = result.get("translatedText", text)
            self._cache[cache_key] = translated
            return translated
        except Exception as e:
            logger.warning(f"Translation failed for text, returning original: {e}")
            return text

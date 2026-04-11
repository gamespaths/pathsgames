from typing import List, Optional, Dict, Any
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_detail import StoryDetail
from app.core.models.story.difficulty_info import DifficultyInfo
from app.core.ports.story.story_query_port import StoryQueryPort
from app.core.ports.story.story_read_port import StoryReadPort

class StoryQueryService(StoryQueryPort):
    def __init__(self, read_port: StoryReadPort):
        self.read_port = read_port

    def list_public_stories(self, lang: str = "en") -> List[StorySummary]:
        lang = lang or "en"
        raw_stories = self.read_port.find_public_stories()
        return [self._map_to_summary(r, lang) for r in raw_stories]

    def list_all_stories(self, lang: str = "en") -> List[StorySummary]:
        lang = lang or "en"
        raw_stories = self.read_port.find_all_stories()
        return [self._map_to_summary(r, lang) for r in raw_stories]

    def get_story_detail(self, uuid: str, lang: str = "en") -> Optional[StoryDetail]:
        lang = lang or "en"
        raw_story = self.read_port.find_story_by_uuid(uuid)
        if not raw_story:
            return None

        story_id = raw_story.get("id")
        texts = self.read_port.find_texts_for_story(story_id)
        
        # Difficulty
        raw_diffs = self.read_port.find_difficulties_for_story(story_id)
        difficulties = []
        for rd in raw_diffs:
            desc = self._resolve_text(texts, rd.get("id_text_description"), lang)
            difficulties.append(DifficultyInfo(
                uuid=rd.get("uuid", ""),
                description=desc,
                expCost=rd.get("exp_cost", 5),
                maxWeight=rd.get("max_weight", 10),
                minCharacter=rd.get("min_character", 1),
                maxCharacter=rd.get("max_character", 4),
                costHelpComa=rd.get("cost_help_coma", 3),
                costMaxCharacteristics=rd.get("cost_max_characteristics", 3),
                numberMaxFreeAction=rd.get("number_max_free_action", 1)
            ))

        # Counts
        loc_count = self.read_port.count_locations_for_story(story_id)
        event_count = self.read_port.count_events_for_story(story_id)
        item_count = self.read_port.count_items_for_story(story_id)

        title = self._resolve_text(texts, raw_story.get("id_text_title"), lang)
        desc = self._resolve_text(texts, raw_story.get("id_text_description"), lang)
        copyright_txt = self._resolve_text(texts, raw_story.get("id_text_copyright"), lang)

        return StoryDetail(
            uuid=raw_story.get("uuid"),
            title=title,
            description=desc,
            author=raw_story.get("author"),
            category=raw_story.get("category"),
            group=raw_story.get("group_name"),
            visibility=raw_story.get("visibility"),
            priority=raw_story.get("priority", 0),
            peghi=raw_story.get("peghi", 0),
            versionMin=raw_story.get("version_min"),
            versionMax=raw_story.get("version_max"),
            clockSingularDescription=raw_story.get("clock_singular"),
            clockPluralDescription=raw_story.get("clock_plural"),
            copyrightText=copyright_txt,
            linkCopyright=raw_story.get("link_copyright"),
            locationCount=loc_count,
            eventCount=event_count,
            itemCount=item_count,
            difficulties=difficulties
        )

    def _map_to_summary(self, raw_story: Dict[str, Any], lang: str) -> StorySummary:
        story_id = raw_story.get("id")
        texts = self.read_port.find_texts_for_story(story_id)
        
        title = self._resolve_text(texts, raw_story.get("id_text_title"), lang)
        desc = self._resolve_text(texts, raw_story.get("id_text_description"), lang)
        
        diff_count = len(self.read_port.find_difficulties_for_story(story_id))

        return StorySummary(
            uuid=raw_story.get("uuid"),
            title=title,
            description=desc,
            author=raw_story.get("author"),
            category=raw_story.get("category"),
            group=raw_story.get("group_name"),
            visibility=raw_story.get("visibility"),
            priority=raw_story.get("priority", 0),
            peghi=raw_story.get("peghi", 0),
            difficultyCount=diff_count
        )

    def _resolve_text(self, texts: List[Dict[str, Any]], txt_id: Optional[int], target_lang: str) -> Optional[str]:
        if txt_id is None:
            return None
            
        candidates = [t for t in texts if t.get("id_text") == txt_id]
        if not candidates:
            return None

        # 1. Exact language match
        for t in candidates:
            if t.get("lang") == target_lang:
                return t.get("short_text") or t.get("long_text")

        # 2. English fallback
        for t in candidates:
            if t.get("lang") == "en":
                return t.get("short_text") or t.get("long_text")

        # 3. Any available
        t = candidates[0]
        return t.get("short_text") or t.get("long_text")

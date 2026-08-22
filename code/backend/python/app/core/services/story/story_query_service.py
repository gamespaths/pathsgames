from typing import List, Optional, Dict, Any
from app.core.models.story.story_summary import StorySummary
from app.core.models.story.story_detail import StoryDetail
from app.core.models.story.difficulty_info import DifficultyInfo
from app.core.models.story.character_template_info import CharacterTemplateInfo
from app.core.models.story.class_info import ClassInfo
from app.core.models.story.class_bonus_info import ClassBonusInfo
from app.core.models.story.trait_info import TraitInfo
from app.core.models.story.card_info import CardInfo
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

    def list_categories(self) -> List[str]:
        return self.read_port.find_unique_categories()

    def list_groups(self) -> List[str]:
        return self.read_port.find_unique_groups()

    def list_stories_by_category(self, category: str, lang: str = "en") -> List[StorySummary]:
        lang = lang or "en"
        raw_stories = self.read_port.find_stories_by_category(category)
        return [self._map_to_summary(r, lang) for r in raw_stories]

    def list_stories_by_group(self, group: str, lang: str = "en") -> List[StorySummary]:
        lang = lang or "en"
        raw_stories = self.read_port.find_stories_by_group(group)
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
                numberMaxFreeAction=rd.get("number_max_free_action", 1),
                traitCostPositiveBudget=rd.get("trait_cost_positive_budget"),
                traitCostNegativeBudget=rd.get("trait_cost_negative_budget"),
                idCard=rd.get("id_card"),
                card=self._resolve_card(story_id, texts, rd.get("id_card"), lang),
                life=rd.get("life", 100),
                energy=rd.get("energy", 100),
                sad=rd.get("sad", 0),
                dexterity=rd.get("dexterity", 10),
                intelligence=rd.get("intelligence", 10),
                constitution=rd.get("constitution", 10),
                weight=rd.get("weight", 10)
            ))

        # Counts
        loc_count = self.read_port.count_locations_for_story(story_id)
        event_count = self.read_port.count_events_for_story(story_id)
        item_count = self.read_port.count_items_for_story(story_id)

        title = self._resolve_text(texts, raw_story.get("id_text_title"), lang)
        desc = self._resolve_text(texts, raw_story.get("id_text_description"), lang)
        copyright_txt = self._resolve_text(texts, raw_story.get("id_text_copyright"), lang)

        # Step 15: Classes, Templates, Traits
        raw_classes = self.read_port.find_classes_for_story(story_id)
        raw_class_bonuses = self.read_port.find_class_bonuses_for_story(story_id)
        raw_templates = self.read_port.find_character_templates_for_story(story_id)
        raw_traits = self.read_port.find_traits_for_story(story_id)

        classes = []
        for c in raw_classes:
            cls_name = self._resolve_text(texts, c.get("id_text_name"), lang)
            cls_desc = self._resolve_text(texts, c.get("id_text_description"), lang)
            cls_id = c.get("id")
            cls_bonuses = []
            for b in raw_class_bonuses:
                if b.get("id_class") == cls_id:
                    cls_bonuses.append(ClassBonusInfo(
                        uuid=b.get("uuid") or str(b.get("id", "")),
                        statistic=b.get("statistic") or b.get("bonus_type"),
                        value=b.get("value") if b.get("value") is not None else (b.get("bonus_value") or 0),
                    ))
            classes.append(ClassInfo(
                uuid=c.get("uuid") or str(c.get("id", "")),
                id=c.get("id"),
                name=cls_name,
                description=cls_desc,
                weightMax=c.get("weight_max", 0) or 0,
                dexterityBase=c.get("dexterity_base", 0) or 0,
                intelligenceBase=c.get("intelligence_base", 0) or 0,
                constitutionBase=c.get("constitution_base", 0) or 0,
                idCard=c.get("id_card"),
                card=self._resolve_card(story_id, texts, c.get("id_card"), lang),
                bonuses=cls_bonuses,
            ))

        templates = []
        for t in raw_templates:
            tpl_name = self._resolve_text(texts, t.get("id_text_name"), lang)
            tpl_desc = self._resolve_text(texts, t.get("id_text_description"), lang)
            templates.append(CharacterTemplateInfo(
                uuid=t.get("uuid") or str(t.get("id", "")),
                name=tpl_name,
                description=tpl_desc,
                lifeMax=t.get("life_max", 0) or 0,
                energyMax=t.get("energy_max", 0) or 0,
                sadMax=t.get("sad_max", 0) or 0,
                dexterityStart=t.get("dexterity_start", 0) or 0,
                intelligenceStart=t.get("intelligence_start", 0) or 0,
                constitutionStart=t.get("constitution_start", 0) or 0,
                idCard=t.get("id_card"),
                card=self._resolve_card(story_id, texts, t.get("id_card"), lang),
                idClassPermitted=t.get("id_class_permitted"),
                idClassProhibited=t.get("id_class_prohibited"),
            ))

        traits = [self._to_trait_info(story_id, texts, tr, lang) for tr in raw_traits]

        # Step 15: Card
        card = None
        story_id_card = raw_story.get("id_card")
        if story_id_card is not None:
            raw_card = self.read_port.find_card_for_story(story_id, story_id_card)
            if raw_card:
                card_title = self._resolve_text(texts, raw_card.get("id_text_title") or raw_card.get("id_text_name"), lang)
                card_description = self._resolve_text(texts, raw_card.get("id_text_description"), lang)
                card_copyright_text = self._resolve_text(texts, raw_card.get("id_text_copyright"), lang)
                card = CardInfo(
                    uuid=raw_card.get("uuid") or str(raw_card.get("id", "")),
                    cardType=raw_card.get("card_type"),
                    urlImage=raw_card.get("url_image"),
                    alternativeImage=raw_card.get("alternative_image"),
                    awesomeIcon=raw_card.get("awesome_icon"),
                    styleMain=raw_card.get("style_main"),
                    styleDetail=raw_card.get("style_detail"),
                    styleImageLittle=raw_card.get("style_image_little"),
                    styleImageMedium=raw_card.get("style_image_medium"),
                    styleImageLarge=raw_card.get("style_image_large"),
                    title=card_title,
                    description=card_description,
                    copyrightText=card_copyright_text,
                    linkCopyright=raw_card.get("link_copyright")
                )

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
            clockSingularDescription=self._resolve_text(texts, raw_story.get("id_text_clock_singular"), lang),
            clockPluralDescription=self._resolve_text(texts, raw_story.get("id_text_clock_plural"), lang),
            idTextClockSingular=raw_story.get("id_text_clock_singular"),
            idTextClockPlural=raw_story.get("id_text_clock_plural"),
            copyrightText=copyright_txt,
            linkCopyright=raw_story.get("link_copyright"),
            locationCount=loc_count,
            eventCount=event_count,
            itemCount=item_count,
            classCount=len(raw_classes),
            characterTemplateCount=len(raw_templates),
            traitCount=len(raw_traits),
            difficulties=difficulties,
            classes=classes,
            characterTemplates=templates,
            traits=traits,
            card=card
        )

    def _map_to_summary(self, raw_story: Dict[str, Any], lang: str) -> StorySummary:
        story_id = raw_story.get("id")
        texts = self.read_port.find_texts_for_story(story_id)
        
        title = self._resolve_text(texts, raw_story.get("id_text_title"), lang)
        desc = self._resolve_text(texts, raw_story.get("id_text_description"), lang)
        
        diff_count = len(self.read_port.find_difficulties_for_story(story_id))

        # Card resolution
        card = None
        story_id_card = raw_story.get("id_card")
        if story_id_card is not None:
            raw_card = self.read_port.find_card_for_story(story_id, story_id_card)
            if raw_card:
                card_title = self._resolve_text(texts, raw_card.get("id_text_title") or raw_card.get("id_text_name"), lang)
                card_description = self._resolve_text(texts, raw_card.get("id_text_description"), lang)
                card_copyright_text = self._resolve_text(texts, raw_card.get("id_text_copyright"), lang)
                card = CardInfo(
                    uuid=raw_card.get("uuid") or str(raw_card.get("id", "")),
                    cardType=raw_card.get("card_type"),
                    urlImage=raw_card.get("url_image"),
                    alternativeImage=raw_card.get("alternative_image"),
                    awesomeIcon=raw_card.get("awesome_icon"),
                    styleMain=raw_card.get("style_main"),
                    styleDetail=raw_card.get("style_detail"),
                    styleImageLittle=raw_card.get("style_image_little"),
                    styleImageMedium=raw_card.get("style_image_medium"),
                    styleImageLarge=raw_card.get("style_image_large"),
                    title=card_title,
                    description=card_description,
                    copyrightText=card_copyright_text,
                    linkCopyright=raw_card.get("link_copyright")
                )

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
            difficultyCount=diff_count,
            card=card,
            idTextClockSingular=raw_story.get("id_text_clock_singular"),
            idTextClockPlural=raw_story.get("id_text_clock_plural")
        )

    # === Step 23: Trait listing filtered by class ===

    def list_traits_for_class(self, story_uuid: str, class_uuid: str, lang: str = "en"):
        """Lists the story traits selectable with the given class.

        Returns a ``(status, traits)`` tuple where status is ``"OK"``,
        ``"STORY_NOT_FOUND"`` or ``"CLASS_NOT_FOUND"``.
        """
        if not story_uuid or not story_uuid.strip():
            return "STORY_NOT_FOUND", []
        raw_story = self.read_port.find_story_by_uuid(story_uuid)
        if not raw_story:
            return "STORY_NOT_FOUND", []
        story_id = raw_story["id"]

        clazz = None
        if class_uuid and class_uuid.strip():
            for c in self.read_port.find_classes_for_story(story_id):
                if c.get("uuid") == class_uuid:
                    clazz = c
                    break
        if clazz is None:
            return "CLASS_NOT_FOUND", []
        class_id = clazz.get("id")

        texts = self.read_port.find_texts_for_story(story_id)
        traits = [
            self._to_trait_info(story_id, texts, tr, lang)
            for tr in self.read_port.find_traits_for_story(story_id)
            if self._is_trait_selectable(tr, class_id)
        ]
        return "OK", traits

    @staticmethod
    def _is_trait_selectable(tr: Dict[str, Any], class_id) -> bool:
        permitted = tr.get("id_class_permitted")
        prohibited = tr.get("id_class_prohibited")
        permitted_ok = permitted is None or (class_id is not None and permitted == class_id)
        prohibited_ok = prohibited is None or class_id is None or prohibited != class_id
        return permitted_ok and prohibited_ok

    def _to_trait_info(self, story_id: int, texts: List[Dict[str, Any]],
                       tr: Dict[str, Any], lang: str) -> TraitInfo:
        tr_name = self._resolve_text(texts, tr.get("id_text_name"), lang)
        tr_desc = self._resolve_text(texts, tr.get("id_text_description"), lang)
        return TraitInfo(
            uuid=tr.get("uuid") or str(tr.get("id", "")),
            name=tr_name,
            description=tr_desc,
            costPositive=tr.get("cost_positive", 0) or 0,
            costNegative=tr.get("cost_negative", 0) or 0,
            idClassPermitted=tr.get("id_class_permitted"),
            idClassProhibited=tr.get("id_class_prohibited"),
            idCard=tr.get("id_card"),
            card=self._resolve_card(story_id, texts, tr.get("id_card"), lang),
            # v0.35.2 — reported on BOTH projections; nothing is filtered out here.
            hideOnStartMatch=tr.get("hide_on_start_match") == 1,
            life=tr.get("life", 0) or 0,
            energy=tr.get("energy", 0) or 0,
            sad=tr.get("sad", 0) or 0,
            dexterity=tr.get("dexterity", 0) or 0,
            intelligence=tr.get("intelligence", 0) or 0,
            constitution=tr.get("constitution", 0) or 0,
            weight=tr.get("weight", 0) or 0,
        )

    def _resolve_card(self, story_id: int, texts: List[Dict[str, Any]], id_card: Optional[int], lang: str) -> Optional[CardInfo]:
        if id_card is None:
            return None
        raw_card = self.read_port.find_card_for_story(story_id, id_card)
        if not raw_card:
            return None
        card_title = self._resolve_text(texts, raw_card.get("id_text_title") or raw_card.get("id_text_name"), lang)
        card_description = self._resolve_text(texts, raw_card.get("id_text_description"), lang)
        card_copyright_text = self._resolve_text(texts, raw_card.get("id_text_copyright"), lang)
        return CardInfo(
            uuid=raw_card.get("uuid") or str(raw_card.get("id", "")),
            cardType=raw_card.get("card_type"),
            urlImage=raw_card.get("url_image"),
            alternativeImage=raw_card.get("alternative_image"),
            awesomeIcon=raw_card.get("awesome_icon"),
            styleMain=raw_card.get("style_main"),
            styleDetail=raw_card.get("style_detail"),
            styleImageLittle=raw_card.get("style_image_little"),
            styleImageMedium=raw_card.get("style_image_medium"),
            styleImageLarge=raw_card.get("style_image_large"),
            title=card_title,
            description=card_description,
            copyrightText=card_copyright_text,
            linkCopyright=raw_card.get("link_copyright")
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

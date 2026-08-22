from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import Integer, Numeric
from app.core.ports.story.story_persistence_port import StoryPersistencePort
from app.adapters.persistence.story.models import (
    StoryEntity, TextEntity, StoryDifficultyEntity, 
    LocationEntity, LocationNeighborEntity, EventEntity, EventEffectEntity, 
    ItemEntity, ItemEffectEntity, ClassEntity, ClassBonusEntity, 
    TraitEntity, ChoiceEntity, ChoiceConditionEntity, ChoiceEffectEntity,
    CharacterTemplateEntity, WeatherRuleEntity, GlobalRandomEventEntity,
    MissionEntity, MissionStepEntity, CreatorEntity, CardEntity, KeyEntity
)

# Distinguishes "the caller sent this column as null" from "the caller did not send it".
_MISSING = object()

# Admin/import keys that differ from a column's own camelCase, per table. Mirrors the
# aliases the dedicated save_choice_* methods already accept, so the generic CRUD path
# stores the same rows the import path does. Order is the fallback order tried.
_ADMIN_KEY_ALIASES = {
    "list_choices_conditions": {
        "id_choice": ("idChoices",),
        "condition_type": ("type",),
        "condition_key": ("key",),
        "condition_value": ("value",),
        "condition_operator": ("operator",),
    },
    "list_choices_effects": {
        # The effect fields (statistics/value/key/idEvent/…) already match the columns'
        # own camelCase; only the choice link uses the story-relative plural.
        "id_choice": ("idChoices",),
    },
}


def _normalize_optional_fk(value):
    """0 means "no restriction" on an optional story reference; so does None.

    The CRUD writes a raw 0 where an import writes None, and both have to read as unset.
    """
    number = value if isinstance(value, int) else None
    if number is None and isinstance(value, str):
        try:
            number = int(value)
        except (ValueError, TypeError):
            return None
    if number is None or number <= 0:
        return None
    return number


def _get_long(data, *keys):
    """Try multiple keys to extract an integer value from data dict."""
    if data is None:
        return None
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        if isinstance(value, int):
            return value
        if isinstance(value, (float,)):
            return int(value)
        if isinstance(value, str):
            try:
                return int(value)
            except (ValueError, TypeError):
                continue
    return None


def _coerce_value(col_type, value):
    """Coerce a JSON value to match the SQLAlchemy column type.

    The import JSON sometimes carries empty strings ("") or other non-numeric
    text in numeric fields. PostgreSQL rejects '' for integer/numeric columns
    (SQLite silently accepts it). This mirrors the Java importer's getInteger,
    which maps empty/non-numeric strings to NULL.
    """
    if value is None:
        return None
    if isinstance(col_type, Integer):
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            s = value.strip()
            if s == "":
                return None
            try:
                return int(s)
            except ValueError:
                try:
                    return int(float(s))
                except ValueError:
                    return None
        return value
    if isinstance(col_type, Numeric):  # covers Float and Numeric
        if isinstance(value, bool):
            return float(value)
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, str):
            s = value.strip()
            if s == "":
                return None
            try:
                return float(s)
            except ValueError:
                return None
        return value
    return value

class StoryPersistenceAdapter(StoryPersistencePort):

    def __init__(self, session_factory):
        self.session_factory = session_factory

    def find_story_id_by_uuid(self, uuid: str) -> Optional[int]:
        with self.session_factory() as session:
            story = session.query(StoryEntity.id).filter(StoryEntity.uuid == uuid).first()
            return story.id if story else None

    def delete_story_by_id(self, story_id: int) -> None:
        with self.session_factory() as session:
            # We must delete in correct order due to potential foreign keys if mapped later
            # For now, just delete all related tables explicitly
            
            # Sub-sub entities
            session.query(LocationNeighborEntity).filter(LocationNeighborEntity.id_story == story_id).delete()
            session.query(EventEffectEntity).filter(EventEffectEntity.id_story == story_id).delete()
            session.query(ItemEffectEntity).filter(ItemEffectEntity.id_story == story_id).delete()
            session.query(ClassBonusEntity).filter(ClassBonusEntity.id_story == story_id).delete()
            session.query(ChoiceConditionEntity).filter(ChoiceConditionEntity.id_story == story_id).delete()
            session.query(ChoiceEffectEntity).filter(ChoiceEffectEntity.id_story == story_id).delete()
            session.query(MissionStepEntity).filter(MissionStepEntity.id_story == story_id).delete()

            # Direct sub-entities
            session.query(LocationEntity).filter(LocationEntity.id_story == story_id).delete()
            session.query(EventEntity).filter(EventEntity.id_story == story_id).delete()
            session.query(ItemEntity).filter(ItemEntity.id_story == story_id).delete()
            session.query(ClassEntity).filter(ClassEntity.id_story == story_id).delete()
            session.query(ChoiceEntity).filter(ChoiceEntity.id_story == story_id).delete()
            session.query(MissionEntity).filter(MissionEntity.id_story == story_id).delete()
            session.query(StoryDifficultyEntity).filter(StoryDifficultyEntity.id_story == story_id).delete()
            session.query(TextEntity).filter(TextEntity.id_story == story_id).delete()
            session.query(TraitEntity).filter(TraitEntity.id_story == story_id).delete()
            session.query(CharacterTemplateEntity).filter(CharacterTemplateEntity.id_story == story_id).delete()
            session.query(WeatherRuleEntity).filter(WeatherRuleEntity.id_story == story_id).delete()
            session.query(GlobalRandomEventEntity).filter(GlobalRandomEventEntity.id_story == story_id).delete()
            session.query(CreatorEntity).filter(CreatorEntity.id_story == story_id).delete()
            session.query(CardEntity).filter(CardEntity.id_story == story_id).delete()
            session.query(KeyEntity).filter(KeyEntity.id_story == story_id).delete()

            # Finally, the story itself
            session.query(StoryEntity).filter(StoryEntity.id == story_id).delete()
            session.commit()

    def save_story(self, data: Dict[str, Any]) -> int:
        with self.session_factory() as session:
            explicit_id = _get_long(data, "id", "idStory", "id_story")
            s_ent = StoryEntity(
                uuid=data.get("uuid"),
                author=data.get("author"),
                category=data.get("category"),
                group_name=data.get("group"),
                visibility=data.get("visibility", "DRAFT"),
                priority=data.get("priority", 0),
                peghi=data.get("peghi", 0),
                version_min=data.get("versionMin"),
                version_max=data.get("versionMax"),
                id_text_clock_singular=data.get("idTextClockSingular"),
                id_text_clock_plural=data.get("idTextClockPlural"),
                link_copyright=data.get("linkCopyright"),
                id_text_title=data.get("idTextTitle"),
                id_text_description=data.get("idTextDescription"),
                id_text_copyright=data.get("idTextCopyright"),
                id_location_start=data.get("idLocationStart"),
                id_image=data.get("idImage"),
                id_location_all_player_coma=data.get("idLocationAllPlayerComa"),
                id_event_all_player_coma=data.get("idEventAllPlayerComa"),
                id_event_end_game=data.get("idEventEndGame"),
                id_creator=data.get("idCreator"),
                id_card=data.get("idCard")
            )
            if explicit_id is not None:
                s_ent.id = explicit_id
            session.add(s_ent)
            session.commit()
            session.refresh(s_ent)
            return s_ent.id

    def save_texts(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        # Texts are language-scoped: the same logical text (id_text) appears once per
        # language, so the import JSON commonly reuses the same surrogate "id" across
        # language variants. The PK is (id, id_story), so every row still needs a UNIQUE
        # id. Nothing references the surrogate id (all FKs target id_text), so a reused
        # id is safely re-allocated above the highest id present. The real per-story
        # identity (id_text, lang) is preserved. Mirrors the Java StoryImportService.
        from sqlalchemy import text as sa_text
        field_map = {
            "uuid": "uuid", "id_card": "idCard",
            "id_text_name": "idTextName", "id_text_description": "idTextDescription",
            "id_text": "idText", "lang": "lang",
            "short_text": "shortText", "long_text": "longText",
            "id_text_copyright": "idTextCopyright", "link_copyright": "linkCopyright",
            "id_creator": "idCreator",
        }
        with self.session_factory() as session:
            max_id = session.execute(
                sa_text("SELECT COALESCE(MAX(id), 0) FROM list_texts WHERE id_story = :sid"),
                {"sid": story_id}
            ).scalar() or 0
            resolved = [_get_long(item, "id") for item in items]
            for rid in resolved:
                if rid is not None:
                    max_id = max(max_id, rid)
            used_ids = set()
            for item, rid in zip(items, resolved):
                if rid is None or rid in used_ids:
                    max_id += 1
                    rid = max_id
                used_ids.add(rid)
                kwargs = {"id_story": story_id, "id": rid}
                for db_col, json_key in field_map.items():
                    if json_key in item:
                        kwargs[db_col] = item[json_key]
                if kwargs.get("lang") is None:
                    kwargs["lang"] = "en"
                session.add(TextEntity(**kwargs))
            session.commit()

    def save_difficulties(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(StoryDifficultyEntity, story_id, items, {
            "uuid": "uuid", "id_card": "idCard", "id_text_name": "idTextName",
            "id_text_description": "idTextDescription",
            "exp_cost": "expCost", "max_weight": "maxWeight",
            "min_character": "minCharacter", "max_character": "maxCharacter",
            "cost_help_coma": "costHelpComa", "cost_max_characteristics": "costMaxCharacteristics",
            "number_max_free_action": "numberMaxFreeAction",
            "trait_cost_positive_budget": "traitCostPositiveBudget",
            "trait_cost_negative_budget": "traitCostNegativeBudget",
            "life": "life", "energy": "energy", "sad": "sad",
            "dexterity": "dexterity", "intelligence": "intelligence",
            "constitution": "constitution", "weight": "weight"
        })

    def save_locations(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            next_loc_id = self._make_id_counter(session, "list_locations", "id", story_id)
            next_nb_id = self._make_id_counter(session, "list_locations_neighbors", "id", story_id)
            for item in items:
                kwargs = dict(
                    id_story=story_id,
                    uuid=item.get("uuid") or str(__import__('uuid').uuid4()),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    is_safe=item.get("isSafe", 0),
                    max_characters=item.get("maxCharacters"),
                    id_event_on_enter=item.get("idEventOnEnter"),
                    id_event_if_counter_zero=item.get("idEventIfCounterZero"),
                    counter_time=item.get("counterTime"),
                    id_card=item.get("idCard"),
                    # Step 33 — the location-side trigger columns. A null column is not a
                    # trigger, so an authored story that names none behaves exactly as before.
                    id_event_if_first_time=item.get("idEventIfFirstTime"),
                    id_event_not_first_time=item.get("idEventNotFirstTime"),
                    id_event_if_character_enter_empty_location=item.get(
                        "idEventIfCharacterEnterEmptyLocation"),
                    id_event_if_character_start_time=item.get("idEventIfCharacterStartTime"),
                    priority_automatic_event=item.get("priorityAutomaticEvent"),
                )
                explicit_id = _get_long(item, "id")
                kwargs["id"] = explicit_id if explicit_id is not None else next_loc_id()
                loc = LocationEntity(**self._coerce_kwargs(LocationEntity, kwargs))
                session.add(loc)
                session.flush()

                for n in item.get("neighbors", []):
                    ne = LocationNeighborEntity(
                        id=next_nb_id(),
                        id_story=story_id,
                        # A uuid is required for the neighbor to be addressable via the
                        # admin CRUD API (GET/PUT/DELETE .../location-neighbors/{uuid}).
                        uuid=n.get("uuid") or str(__import__('uuid').uuid4()),
                        id_location_from=loc.id,
                        id_location_to=n.get("idLocationTo"),
                        direction=n.get("direction"),
                        energy_cost=n.get("energyCost", 1),
                        condition_key=n.get("conditionKey"),
                        condition_value=n.get("conditionValue"),
                        id_card=n.get("idCard"),
                        id_card_back=n.get("idCardBack"),
                        # `flag_back` decides whether the edge can be walked BACKWARDS.
                        # The column and the movement engine have always honoured it
                        # (movement_service._traversable_from), but the import never mapped
                        # it, so every imported story silently became one-way: the column
                        # defaults to 0 and no authored value could ever reach it.
                        flag_back=n.get("flagBack", 0),
                    )
                    session.add(ne)
            session.commit()

    def save_events(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            next_ev_id = self._make_id_counter(session, "list_events", "id", story_id)
            next_ef_id = self._make_id_counter(session, "list_events_effects", "id", story_id)
            for item in items:
                kwargs = dict(
                    id_story=story_id,
                    uuid=item.get("uuid") or str(__import__('uuid').uuid4()),
                    id_card=item.get("idCard"),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    # v0.29.0 — the JSON contract spells these `type` and `costEnery` (the
                    # historical typo). Reading only `eventType`/`energyCost`, as this did,
                    # dropped both on every Java-authored story.
                    type=item.get("type", item.get("eventType")),
                    cost_enery=item.get("costEnery", item.get("energyCost", 0)),
                    coin_cost=item.get("coinCost", 0),
                    flag_end_time=item.get("flagEndTime", 0),
                    id_event_next=item.get("idEventNext"),
                    id_specific_location=item.get("idSpecificLocation")
                    if item.get("idSpecificLocation") is not None else item.get("idLocation"),
                    id_weather=item.get("idWeather"),
                    registry_key_condition=item.get("registryKeyCondition"),
                    registry_value_condition=item.get("registryValueCondition"),
                    id_item_condition=item.get("idItemCondition"),
                    id_class_condition=item.get("idClassCondition"),
                    id_item_to_add=item.get("idItemToAdd"),
                )
                explicit_id = _get_long(item, "id")
                kwargs["id"] = explicit_id if explicit_id is not None else next_ev_id()
                ev = EventEntity(**self._coerce_kwargs(EventEntity, kwargs))
                session.add(ev)
                session.flush()

                # Effects may be nested under the event (Python's own format) or authored as a
                # top-level `eventEffects` array (the Java/JSON contract) — see save_event_effects.
                for ef in item.get("effects", []):
                    session.add(self._event_effect(story_id, next_ef_id(), ef, ev.id))
            session.commit()

    def save_event_effects(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        """v0.29.0 — the top-level `eventEffects` array of the shared JSON contract."""
        with self.session_factory() as session:
            next_ef_id = self._make_id_counter(session, "list_events_effects", "id", story_id)
            for ef in items:
                explicit_id = _get_long(ef, "id")
                new_id = explicit_id if explicit_id is not None else next_ef_id()
                session.add(self._event_effect(story_id, new_id, ef, ef.get("idEvent")))
            session.commit()

    def _event_effect(self, story_id: int, new_id: int, ef: Dict[str, Any],
                      id_event: Any) -> EventEffectEntity:
        return EventEffectEntity(
            id=new_id,
            id_story=story_id,
            uuid=ef.get("uuid") or str(__import__('uuid').uuid4()),
            # The effect's own card is the narrative the board renders — never imported before.
            id_card=ef.get("idCard"),
            id_text_name=ef.get("idTextName"),
            id_text_description=ef.get("idTextDescription"),
            id_event=id_event,
            statistics=ef.get("statistics", ef.get("effectType")),
            value=ef.get("value", ef.get("effectValue", 0)),
            target=ef.get("target", "ALL"),
            target_class=ef.get("targetClass"),
            traits_to_add=ef.get("traitsToAdd"),
            traits_to_remove=ef.get("traitsToRemove"),
            id_item_target=ef.get("idItemTarget"),
            item_action=ef.get("itemAction"),
            key_to_add=ef.get("keyToAdd"),
            key_value_to_add=ef.get("keyValueToAdd"),
            characteristic_to_add=ef.get("characteristicToAdd"),
            characteristic_to_remove=ef.get("characteristicToRemove"),
            id_weather=ef.get("idWeather"),
            # v0.29.3 — forced movement: moves the recipients here, no Step 28 checks.
            id_location=ef.get("idLocation"),
        )

    def save_items(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            next_it_id = self._make_id_counter(session, "list_items", "id", story_id)
            next_ie_id = self._make_id_counter(session, "list_items_effects", "id", story_id)
            for item in items:
                kwargs = dict(
                    id_story=story_id,
                    uuid=item.get("uuid") or str(__import__('uuid').uuid4()),
                    id_card=item.get("idCard"),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    weight=item.get("weight", 0),
                    # v0.34.0 — step 34 gates use-item on these three.
                    is_consumabile=item.get("isConsumabile", 1),
                    # v0.35.0 — absent stays None, which reads as "show the effects": an
                    # old story file keeps behaving exactly as before the column existed.
                    flag_show_effects=item.get("flagShowEffects"),
                    # v0.35.1 — absent stays None: no cap, one unit per drop and per use.
                    max_per_character=item.get("maxPerCharacter"),
                    amount_drop=item.get("amountDrop"),
                    amount_use=item.get("amountUse"),
                    id_class_permitted=_normalize_optional_fk(item.get("idClassPermitted")),
                    id_class_prohibited=_normalize_optional_fk(item.get("idClassProhibited")),
                )
                explicit_id = _get_long(item, "id")
                kwargs["id"] = explicit_id if explicit_id is not None else next_it_id()
                it = ItemEntity(**self._coerce_kwargs(ItemEntity, kwargs))
                session.add(it)
                session.flush()

                # Legacy shape: effects nested under the item. The canonical TOP-LEVEL
                # `itemEffects` array (same as Java and AWS) is imported by save_item_effects.
                for ef in item.get("effects", []):
                    session.add(self._item_effect(story_id, next_ie_id(), ef, it.id))
            session.commit()

    def save_item_effects(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        """v0.34.0 — the canonical top-level `itemEffects` array, keyed by idItem."""
        with self.session_factory() as session:
            next_id = self._make_id_counter(session, "list_items_effects", "id", story_id)
            for ef in items:
                explicit_id = _get_long(ef, "id")
                new_id = explicit_id if explicit_id is not None else next_id()
                session.add(self._item_effect(story_id, new_id, ef, ef.get("idItem")))
            session.commit()

    def _item_effect(self, story_id: int, new_id: int, ef: Dict[str, Any],
                     id_item: Any) -> ItemEffectEntity:
        return ItemEffectEntity(
            id=new_id,
            id_story=story_id,
            uuid=ef.get("uuid") or str(__import__('uuid').uuid4()),
            id_card=ef.get("idCard"),
            id_item=id_item,
            # effectType/type stay readable so older story files still import.
            effect_code=ef.get("effectCode", ef.get("effectType", ef.get("type"))),
            effect_value=ef.get("effectValue", ef.get("value", 0)),
            traits_to_add=ef.get("traitsToAdd"),
            traits_to_remove=ef.get("traitsToRemove"),
        )

    def save_classes(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            next_cls_id = self._make_id_counter(session, "list_classes", "id", story_id)
            next_cb_id = self._make_id_counter(session, "list_classes_bonus", "id", story_id)
            for item in items:
                kwargs = dict(
                    id_story=story_id,
                    uuid=item.get("uuid") or str(__import__('uuid').uuid4()),
                    id_card=item.get("idCard"),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    weight_max=item.get("weightMax", 10),
                    dexterity_base=item.get("dexterityBase", 1),
                    intelligence_base=item.get("intelligenceBase", 1),
                    constitution_base=item.get("constitutionBase", 1)
                )
                explicit_id = _get_long(item, "id")
                kwargs["id"] = explicit_id if explicit_id is not None else next_cls_id()
                cls = ClassEntity(**self._coerce_kwargs(ClassEntity, kwargs))
                session.add(cls)
                session.flush()

                for b in item.get("bonuses", []):
                    cb = ClassBonusEntity(
                        id=next_cb_id(),
                        id_story=story_id,
                        id_class=cls.id,
                        statistic=b.get("statistic", b.get("bonusType", b.get("type"))),
                        value=b.get("value", b.get("bonusValue")),
                    )
                    session.add(cb)
            session.commit()

    def save_choices(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        """Step 31: only the list_choices rows. Conditions and effects arrive as the
        canonical TOP-LEVEL choiceConditions / choiceEffects arrays (keyed by idChoices)
        via save_choice_conditions / save_choice_effects — the nested
        choices[].conditions/effects shape was a Python-only drift and is gone."""
        with self.session_factory() as session:
            next_ch_id = self._make_id_counter(session, "list_choices", "id", story_id)
            for item in items:
                kwargs = dict(
                    id_story=story_id,
                    # Step 32: a choice MUST carry a uuid — select-choice addresses an
                    # option by it, so a null one makes every option unresolvable. Every
                    # other save_* has always generated it; list_choices was the gap.
                    uuid=item.get("uuid") or str(__import__('uuid').uuid4()),
                    id_card=item.get("idCard"),
                    id_event=item.get("idEvent"),
                    id_location=item.get("idLocation"),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    id_text_narrative=item.get("idTextNarrative"),
                    priority=item.get("priority", 0),
                    # otherwiseFlag is the canonical key (Java/AWS/demo JSONs);
                    # isOtherwise stays accepted for older Python-authored payloads.
                    is_otherwise=item.get("otherwiseFlag", item.get("isOtherwise", 0)),
                    is_progress=item.get("isProgress", 0),
                    id_event_torun=item.get("idEventTorun", item.get("idEventToRun")),
                    limit_sad=item.get("limitSad"),
                    limit_dex=item.get("limitDex"),
                    limit_int=item.get("limitInt"),
                    limit_cos=item.get("limitCos"),
                    logic_operator=item.get("logicOperator") or "AND",
                )
                explicit_id = _get_long(item, "id")
                kwargs["id"] = explicit_id if explicit_id is not None else next_ch_id()
                ch = ChoiceEntity(**self._coerce_kwargs(ChoiceEntity, kwargs))
                session.add(ch)
            session.commit()

    def save_choice_conditions(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            next_cc_id = self._make_id_counter(
                session, "list_choices_conditions", "id", story_id)
            for c in items:
                explicit_id = _get_long(c, "id")
                cc = ChoiceConditionEntity(
                    id=explicit_id if explicit_id is not None else next_cc_id(),
                    id_story=story_id,
                    uuid=c.get("uuid") or str(__import__('uuid').uuid4()),
                    id_choice=c.get("idChoices", c.get("idChoice")),
                    condition_type=c.get("type", c.get("conditionType")),
                    condition_key=c.get("key", c.get("conditionKey")),
                    condition_value=c.get("value", c.get("conditionValue")),
                    # The per-row comparator; "=" is the schema default.
                    condition_operator=c.get("operator", c.get("conditionOperator")) or "=",
                )
                session.add(cc)
            session.commit()

    def save_choice_effects(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            next_ce_id = self._make_id_counter(
                session, "list_choices_effects", "id", story_id)
            for ef in items:
                explicit_id = _get_long(ef, "id")
                ce = ChoiceEffectEntity(
                    id=explicit_id if explicit_id is not None else next_ce_id(),
                    id_story=story_id,
                    uuid=ef.get("uuid") or str(__import__('uuid').uuid4()),
                    id_card=ef.get("idCard"),
                    id_choice=ef.get("idChoices", ef.get("idChoice")),
                    # Step 32 realigned the model onto the canonical column names; the old
                    # effectType/effectValue spellings stay readable for older story files.
                    statistics=ef.get("statistics", ef.get("effectType", ef.get("type"))),
                    value=ef.get("value", ef.get("effectValue")),
                    flag_group=ef.get("flagGroup", 0),
                    key=ef.get("key"),
                    value_to_add=ef.get("valueToAdd"),
                    value_to_remove=ef.get("valueToRemove"),
                    id_event=ef.get("idEvent"),
                    id_location=ef.get("idLocation"),
                    id_weather=ef.get("idWeather"),
                    id_item_target=ef.get("idItemTarget"),
                    item_action=ef.get("itemAction"),
                )
                session.add(ce)
            session.commit()

    def save_cards(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(CardEntity, story_id, items, {
            "uuid": "uuid", "id_card": "idCard", "card_type": "cardType",
            "id_text_name": "idTextName", "id_text_title": "idTextTitle",
            "id_text_description": "idTextDescription", "id_text_copyright": "idTextCopyright",
            "url_image": "urlImage", "alternative_image": "alternativeImage",
            "awesome_icon": "awesomeIcon", "style_main": "styleMain",
            "style_detail": "styleDetail",
            "style_image_little": "styleImageLittle",
            "style_image_medium": "styleImageMedium",
            "style_image_large": "styleImageLarge",
            "link_copyright": "linkCopyright",
            "id_creator": "idCreator", "id_reference": "idReference"
        })

    def save_keys(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(KeyEntity, story_id, items, {
            "id_card": "idCard", "key_name": "keyName", "key_value": "keyValue",
            "key_group": "keyGroup", "is_visible": "isVisible"
        })

    def save_traits(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(TraitEntity, story_id, items, {
            "uuid": "uuid", "id_card": "idCard", "id_text_name": "idTextName", "id_text_description": "idTextDescription",
            "cost_positive": "costPositive", "cost_negative": "costNegative",
            "id_class_permitted": "idClassPermitted", "id_class_prohibited": "idClassProhibited",
            "life": "life", "energy": "energy", "sad": "sad",
            "dexterity": "dexterity", "intelligence": "intelligence",
            "constitution": "constitution", "weight": "weight"
        })

    def save_character_templates(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(CharacterTemplateEntity, story_id, items, {
            "uuid": "uuid", "id_tipo": "idTipo", "id_card": "idCard",
            "id_text_name": "idTextName", "id_text_description": "idTextDescription",
            "life_max": "lifeMax", "energy_max": "energyMax", "sad_max": "sadMax",
            "dexterity_start": "dexterityStart", "intelligence_start": "intelligenceStart",
            "constitution_start": "constitutionStart",
            "id_class_permitted": "idClassPermitted", "id_class_prohibited": "idClassProhibited"
        })

    def save_weather_rules(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(WeatherRuleEntity, story_id, items, {
            "id_card": "idCard", "id_text_name": "idTextName", "probability": "probability",
            "delta_energy": "deltaEnergy", "id_event": "idEvent",
            "cost_move_safe_location": "costMoveSafeLocation",
            "cost_move_not_safe_location": "costMoveNotSafeLocation",
            "condition_key": "conditionKey", "condition_value": "conditionValue",
            "time_start": "timeStart", "time_end": "timeEnd", "is_active": "isActive"
        })

    def save_global_random_events(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(GlobalRandomEventEntity, story_id, items, {
            "id_card": "idCard", "id_event": "idEvent", "probability": "probability", 
            "condition_key": "conditionKey", "condition_value": "conditionValue"
        })

    def save_missions(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            next_m_id = self._make_id_counter(session, "list_missions", "id", story_id)
            next_st_id = self._make_id_counter(session, "list_missions_steps", "id", story_id)
            for item in items:
                kwargs = dict(
                    id_story=story_id,
                    id_card=item.get("idCard"),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    condition_key=item.get("conditionKey"),
                    condition_value_from=item.get("conditionValueFrom"),
                    condition_value_to=item.get("conditionValueTo"),
                    id_event_completed=item.get("idEventCompleted")
                )
                explicit_id = _get_long(item, "id")
                kwargs["id"] = explicit_id if explicit_id is not None else next_m_id()
                m = MissionEntity(**self._coerce_kwargs(MissionEntity, kwargs))
                session.add(m)
                session.flush()

                for idx, step in enumerate(item.get("steps", [])):
                    st = MissionStepEntity(
                        id=next_st_id(),
                        id_story=story_id,
                        id_mission=m.id,
                        step_order=step.get("stepOrder", idx + 1),
                        id_text_description=step.get("idTextDescription"),
                        condition_key=step.get("conditionKey"),
                        condition_value=step.get("conditionValue"),
                        id_event_completed=step.get("idEventCompleted")
                    )
                    session.add(st)
            session.commit()

    def save_creators(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(CreatorEntity, story_id, items, {
            "uuid": "uuid", "id_card": "idCard", "id_text": "idText",
            "creator_name": "creatorName", "creator_role": "creatorRole",
            "link": "link", "url": "url",
            "url_image": "urlImage", "url_emote": "urlEmote",
            "url_instagram": "urlInstagram"
        })

    @staticmethod
    def _make_id_counter(session, table_name: str, id_col: str, story_id: int):
        from sqlalchemy import text as sa_text
        current = session.execute(
            sa_text(f"SELECT COALESCE(MAX({id_col}), 0) FROM {table_name} WHERE id_story = :sid"),
            {"sid": story_id}
        ).scalar() or 0
        state = [current]
        def next_id():
            state[0] += 1
            return state[0]
        return next_id

    @staticmethod
    def _coerce_kwargs(entity_class, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        """Coerce kwargs in place to match the entity's column types (e.g. ''→None
        for integer columns). Returns the same dict for convenient chaining."""
        columns = entity_class.__table__.columns
        for col_name, value in list(kwargs.items()):
            if col_name in columns:
                kwargs[col_name] = _coerce_value(columns[col_name].type, value)
        return kwargs

    def _insert_batch(self, entity_class, story_id: int, items: List[Dict[str, Any]], field_map: Dict[str, str]) -> None:
        id_col = "id_tipo" if entity_class == CharacterTemplateEntity else "id"
        table_name = entity_class.__tablename__
        with self.session_factory() as session:
            next_id = self._make_id_counter(session, table_name, id_col, story_id)
            for item in items:
                kwargs = {"id_story": story_id}
                explicit_id = _get_long(item, "id", "idTipo", "id_tipo")
                kwargs[id_col] = explicit_id if explicit_id is not None else next_id()
                for db_col, json_key in field_map.items():
                    if json_key in item:
                        kwargs[db_col] = item[json_key]
                session.add(entity_class(**self._coerce_kwargs(entity_class, kwargs)))
            session.commit()

    # Step 17: Generic entity CRUD

    _TABLE_MODEL_MAP = None

    def _get_model_map(self):
        if self._TABLE_MODEL_MAP is None:
            StoryPersistenceAdapter._TABLE_MODEL_MAP = {
                "list_stories_difficulty": StoryDifficultyEntity,
                "list_locations": LocationEntity,
                "list_locations_neighbors": LocationNeighborEntity,
                "list_events": EventEntity,
                "list_events_effects": EventEffectEntity,
                "list_items": ItemEntity,
                "list_items_effects": ItemEffectEntity,
                "list_character_templates": CharacterTemplateEntity,
                "list_classes": ClassEntity,
                "list_classes_bonus": ClassBonusEntity,
                "list_traits": TraitEntity,
                "list_creator": CreatorEntity,
                "list_cards": CardEntity,
                "list_texts": TextEntity,
                "list_keys": KeyEntity,
                "list_choices": ChoiceEntity,
                "list_choices_conditions": ChoiceConditionEntity,
                "list_choices_effects": ChoiceEffectEntity,
                "list_weather_rules": WeatherRuleEntity,
                "list_global_random_events": GlobalRandomEventEntity,
                "list_missions": MissionEntity,
                "list_missions_steps": MissionStepEntity,
            }
        return self._TABLE_MODEL_MAP

    def _value_for_column(self, table_name: str, col_name: str, data: Dict[str, Any]):
        """The incoming value for a column, or the ``_MISSING`` sentinel when absent.

        The generic path pulls each column from the camelCase spelling OF THAT COLUMN.
        For the choice sub-tables the admin form (and the canonical import shape) use
        DIFFERENT keys — the story-relative ``idChoices`` for the ``id_choice`` link, and
        the short ``type``/``key``/``value``/``operator`` for the ``condition_*`` columns.
        Without these aliases an admin-created choice-condition landed with every one of
        those columns NULL: an orphaned, empty row that (under OR, with no effective
        conditions) would have opened the option to everyone. The import path already
        accepted both spellings; this brings the admin CRUD into line.
        """
        for key in (self._to_camel(col_name), col_name,
                    *_ADMIN_KEY_ALIASES.get(table_name, {}).get(col_name, ())):
            if key in data:
                return data[key]
        return _MISSING

    def save_entity(self, story_id: int, table_name: str, data: Dict[str, Any]) -> None:
        model = self._get_model_map().get(table_name)
        if not model:
            return
        with self.session_factory() as session:
            kwargs = {"id_story": story_id}

            # Handle ID (Step 17: generate next ID if not provided)
            id_col = "id_tipo" if table_name == "list_character_templates" else "id"
            explicit_id = _get_long(data, "id", "id_tipo", "idTipo")
            if explicit_id is None:
                explicit_id = self.next_scoped_id(table_name, id_col, story_id)
            kwargs[id_col] = explicit_id

            for col in model.__table__.columns:
                col_name = col.name
                if col_name in ("id", "id_story", "id_tipo"):
                    continue
                value = self._value_for_column(table_name, col_name, data)
                if value is not _MISSING:
                    kwargs[col_name] = value
            session.add(model(**kwargs))
            session.commit()

    def update_entity(self, story_id: int, table_name: str, uuid: str, data: Dict[str, Any]) -> None:
        model = self._get_model_map().get(table_name)
        if not model:
            return
        with self.session_factory() as session:
            entity = session.query(model).filter(
                model.id_story == story_id,
                model.uuid == uuid
            ).first()
            if not entity:
                return
            for col in model.__table__.columns:
                col_name = col.name
                if col_name in ("id", "id_story", "uuid"):
                    continue
                value = self._value_for_column(table_name, col_name, data)
                if value is not _MISSING:
                    setattr(entity, col_name, value)
            session.commit()

    def delete_entity_by_uuid(self, table_name: str, uuid: str) -> None:
        model = self._get_model_map().get(table_name)
        if not model:
            return
        with self.session_factory() as session:
            session.query(model).filter(model.uuid == uuid).delete()
            session.commit()

    def update_story_by_id(self, story_id: int, data: Dict[str, Any]) -> None:
        with self.session_factory() as session:
            story = session.query(StoryEntity).filter(StoryEntity.id == story_id).first()
            if not story:
                return
            field_map = {
                "author": "author", "category": "category", "group": "group_name",
                "visibility": "visibility", "priority": "priority", "peghi": "peghi",
                "versionMin": "version_min", "versionMax": "version_max",
                "idTextTitle": "id_text_title", "idTextDescription": "id_text_description",
                "idTextClockSingular": "id_text_clock_singular", "idTextClockPlural": "id_text_clock_plural",
                "idLocationStart": "id_location_start", "idImage": "id_image",
                "idLocationAllPlayerComa": "id_location_all_player_coma", "idEventAllPlayerComa": "id_event_all_player_coma",
                "idEventEndGame": "id_event_end_game", "idTextCopyright": "id_text_copyright",
                "linkCopyright": "link_copyright", "idCreator": "id_creator", "idCard": "id_card",
            }
            for json_key, db_attr in field_map.items():
                if json_key in data:
                    setattr(story, db_attr, data[json_key])
            session.commit()

    @staticmethod
    def _to_camel(snake_str: str) -> str:
        parts = snake_str.split("_")
        return parts[0] + "".join(p.capitalize() for p in parts[1:])

    # === Explicit-ID import support ===

    _SYNC_TABLES = [
        ("list_stories", "id"),
        ("list_texts", "id"),
        ("list_stories_difficulty", "id"),
        ("list_creator", "id"),
        ("list_cards", "id"),
        ("list_keys", "id"),
        ("list_classes", "id"),
        ("list_traits", "id"),
        ("list_character_templates", "id"),
        ("list_locations", "id"),
        ("list_events", "id"),
        ("list_items", "id"),
        ("list_choices", "id"),
        ("list_weather_rules", "id"),
        ("list_global_random_events", "id"),
        ("list_missions", "id"),
    ]

    def exists_story_id(self, story_id: int) -> bool:
        with self.session_factory() as session:
            return session.query(StoryEntity).filter(StoryEntity.id == story_id).first() is not None

    def exists_entity_id(self, table_name: str, id_column: str, entity_id: int, story_id: int) -> bool:
        from sqlalchemy import text
        with self.session_factory() as session:
            sql = text(f"SELECT COUNT(1) FROM {table_name} WHERE {id_column} = :eid AND id_story = :sid")
            result = session.execute(sql, {"eid": entity_id, "sid": story_id}).scalar()
            return result is not None and result > 0

    def next_scoped_id(self, table_name: str, id_column: str, story_id: int) -> int:
        from sqlalchemy import text
        with self.session_factory() as session:
            sql = text(f"SELECT COALESCE(MAX({id_column}), 0) + 1 FROM {table_name} WHERE id_story = :sid")
            result = session.execute(sql, {"sid": story_id}).scalar()
            return result if result else 1

    def next_global_id(self, table_name: str, id_column: str) -> int:
        from sqlalchemy import text
        with self.session_factory() as session:
            sql = text(f"SELECT COALESCE(MAX({id_column}), 0) + 1 FROM {table_name}")
            result = session.execute(sql).scalar()
            return result if result else 1

    def sync_sequences(self) -> None:
        """Sync PostgreSQL sequences after explicit-id inserts. No-op on SQLite."""
        from sqlalchemy import text
        with self.session_factory() as session:
            dialect = session.bind.dialect.name if session.bind else ""
            if dialect != "postgresql":
                return
            for table_name, id_column in self._SYNC_TABLES:
                try:
                    sql = text(
                        f"SELECT setval(pg_get_serial_sequence('{table_name}', '{id_column}'), "
                        f"COALESCE((SELECT MAX({id_column}) FROM {table_name}), 1), true)"
                    )
                    session.execute(sql)
                except Exception:
                    pass  # Table or sequence may not exist
            session.commit()



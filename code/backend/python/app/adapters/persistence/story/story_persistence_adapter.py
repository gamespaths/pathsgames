from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.core.ports.story.story_persistence_port import StoryPersistencePort
from app.adapters.persistence.story.models import (
    StoryEntity, TextEntity, StoryDifficultyEntity, 
    LocationEntity, LocationNeighborEntity, EventEntity, EventEffectEntity, 
    ItemEntity, ItemEffectEntity, ClassEntity, ClassBonusEntity, 
    TraitEntity, ChoiceEntity, ChoiceConditionEntity, ChoiceEffectEntity,
    CharacterTemplateEntity, WeatherRuleEntity, GlobalRandomEventEntity,
    MissionEntity, MissionStepEntity, CreatorEntity, CardEntity, KeyEntity
)

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
                clock_singular=data.get("clockSingularDescription"),
                clock_plural=data.get("clockPluralDescription"),
                link_copyright=data.get("linkCopyright"),
                id_text_title=data.get("idTextTitle"),
                id_text_description=data.get("idTextDescription"),
                id_text_copyright=data.get("idTextCopyright")
            )
            session.add(s_ent)
            session.commit()
            session.refresh(s_ent)
            return s_ent.id

    def save_texts(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(TextEntity, story_id, items, {
            "id_text": "idText", "lang": "lang", 
            "short_text": "shortText", "long_text": "longText"
        })

    def save_difficulties(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(StoryDifficultyEntity, story_id, items, {
            "uuid": "uuid", "id_text_description": "idTextDescription",
            "exp_cost": "expCost", "max_weight": "maxWeight",
            "min_character": "minCharacter", "max_character": "maxCharacter",
            "cost_help_coma": "costHelpComa", "cost_max_characteristics": "costMaxCharacteristics",
            "number_max_free_action": "numberMaxFreeAction"
        })

    def save_locations(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            for item in items:
                loc = LocationEntity(
                    id_story=story_id,
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    is_safe=item.get("isSafe", 0),
                    max_characters=item.get("maxCharacters"),
                    id_event_on_enter=item.get("idEventOnEnter"),
                    id_event_if_counter_zero=item.get("idEventIfCounterZero"),
                    counter_start=item.get("counterStart"),
                    id_card=item.get("idCard")
                )
                session.add(loc)
                session.flush() # get loc.id
                
                # Neighbors
                neighbors = item.get("neighbors", [])
                for n in neighbors:
                    ne = LocationNeighborEntity(
                        id_story=story_id,
                        id_location_from=loc.id,
                        id_location_to=n.get("idLocationTo"),
                        direction=n.get("direction"),
                        energy_cost=n.get("energyCost", 1),
                        condition_key=n.get("conditionKey"),
                        condition_value=n.get("conditionValue")
                    )
                    session.add(ne)
            session.commit()

    def save_events(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            for item in items:
                ev = EventEntity(
                    id_story=story_id,
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    event_type=item.get("eventType", item.get("type")),
                    trigger_type=item.get("triggerType"),
                    energy_cost=item.get("energyCost", 0),
                    coin_cost=item.get("coinCost", 0),
                    id_event_next=item.get("idEventNext"),
                    flag_interrupt=item.get("flagInterrupt", 0),
                    flag_end_time=item.get("flagEndTime", 0),
                    id_location=item.get("idLocation")
                )
                session.add(ev)
                session.flush()
                
                # Effects
                effects = item.get("effects", [])
                for ef in effects:
                    efe = EventEffectEntity(
                        id_story=story_id,
                        id_event=ev.id,
                        effect_type=ef.get("effectType", ef.get("type")),
                        effect_value=ef.get("effectValue", ef.get("value")),
                        flag_group=ef.get("flagGroup", 0)
                    )
                    session.add(efe)
            session.commit()

    def save_items(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            for item in items:
                it = ItemEntity(
                    id_story=story_id,
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    weight=item.get("weight", 0),
                    id_class=item.get("idClass")
                )
                session.add(it)
                session.flush()
                
                # Effects
                effects = item.get("effects", [])
                for ef in effects:
                    ie = ItemEffectEntity(
                        id_story=story_id,
                        id_item=it.id,
                        effect_type=ef.get("effectType", ef.get("type")),
                        effect_value=ef.get("effectValue", ef.get("value"))
                    )
                    session.add(ie)
            session.commit()

    def save_classes(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            for item in items:
                cls = ClassEntity(
                    id_story=story_id,
                    uuid=item.get("uuid") or str(__import__('uuid').uuid4()),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    weight_max=item.get("weightMax", 10),
                    dexterity_base=item.get("dexterityBase", 1),
                    intelligence_base=item.get("intelligenceBase", 1),
                    constitution_base=item.get("constitutionBase", 1)
                )
                session.add(cls)
                session.flush()
                
                # Bonuses
                bonuses = item.get("bonuses", [])
                for b in bonuses:
                    cb = ClassBonusEntity(
                        id_story=story_id,
                        id_class=cls.id,
                        bonus_type=b.get("bonusType", b.get("type")),
                        bonus_value=b.get("bonusValue", b.get("value"))
                    )
                    session.add(cb)
            session.commit()

    def save_choices(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            for item in items:
                ch = ChoiceEntity(
                    id_story=story_id,
                    id_event=item.get("idEvent"),
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    priority=item.get("priority", 0),
                    is_otherwise=item.get("isOtherwise", 0),
                    is_progress=item.get("isProgress", 0),
                    id_event_torun=item.get("idEventToRun")
                )
                session.add(ch)
                session.flush()
                
                # Conditions
                conds = item.get("conditions", [])
                for c in conds:
                    cc = ChoiceConditionEntity(
                        id_story=story_id,
                        id_choice=ch.id,
                        condition_type=c.get("conditionType", c.get("type")),
                        condition_key=c.get("conditionKey"),
                        condition_value=c.get("conditionValue"),
                        condition_operator=c.get("conditionOperator", "AND")
                    )
                    session.add(cc)
                    
                # Effects
                effs = item.get("effects", [])
                for ef in effs:
                    ce = ChoiceEffectEntity(
                        id_story=story_id,
                        id_choice=ch.id,
                        effect_type=ef.get("effectType", ef.get("type")),
                        effect_value=ef.get("effectValue", ef.get("value")),
                        flag_group=ef.get("flagGroup", 0)
                    )
                    session.add(ce)
            session.commit()

    def save_cards(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(CardEntity, story_id, items, {
            "uuid": "uuid", "id_card": "idCard", "card_type": "cardType",
            "id_text_name": "idTextName", "id_text_title": "idTextTitle",
            "id_text_description": "idTextDescription", "id_text_copyright": "idTextCopyright",
            "image_url": "imageUrl", "alternative_image": "alternativeImage",
            "awesome_icon": "awesomeIcon", "style_main": "styleMain",
            "style_detail": "styleDetail", "link_copyright": "linkCopyright",
            "id_creator": "idCreator", "id_reference": "idReference"
        })

    def save_keys(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(KeyEntity, story_id, items, {
            "key_name": "keyName", "key_value": "keyValue",
            "key_group": "keyGroup", "is_visible": "isVisible"
        })

    def save_traits(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(TraitEntity, story_id, items, {
            "uuid": "uuid", "id_text_name": "idTextName", "id_text_description": "idTextDescription",
            "cost_positive": "costPositive", "cost_negative": "costNegative",
            "id_class_permitted": "idClassPermitted", "id_class_prohibited": "idClassProhibited"
        })

    def save_character_templates(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(CharacterTemplateEntity, story_id, items, {
            "uuid": "uuid", "id_tipo": "idTipo",
            "id_text_name": "idTextName", "id_text_description": "idTextDescription",
            "life_max": "lifeMax", "energy_max": "energyMax", "sad_max": "sadMax",
            "dexterity_start": "dexterityStart", "intelligence_start": "intelligenceStart",
            "constitution_start": "constitutionStart"
        })

    def save_weather_rules(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(WeatherRuleEntity, story_id, items, {
            "id_text_name": "idTextName", "probability": "probability", 
            "delta_energy": "deltaEnergy", "id_event": "idEvent", 
            "condition_key": "conditionKey", "condition_value": "conditionValue",
            "time_start": "timeStart", "time_end": "timeEnd", "is_active": "isActive"
        })

    def save_global_random_events(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        self._insert_batch(GlobalRandomEventEntity, story_id, items, {
            "id_event": "idEvent", "probability": "probability", 
            "condition_key": "conditionKey", "condition_value": "conditionValue"
        })

    def save_missions(self, story_id: int, items: List[Dict[str, Any]]) -> None:
        with self.session_factory() as session:
            for item in items:
                m = MissionEntity(
                    id_story=story_id,
                    id_text_name=item.get("idTextName"),
                    id_text_description=item.get("idTextDescription"),
                    condition_key=item.get("conditionKey"),
                    condition_value_from=item.get("conditionValueFrom"),
                    condition_value_to=item.get("conditionValueTo"),
                    id_event_completed=item.get("idEventCompleted")
                )
                session.add(m)
                session.flush()
                
                steps = item.get("steps", [])
                for idx, step in enumerate(steps):
                    st = MissionStepEntity(
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
            "uuid": "uuid", "id_text": "idText",
            "creator_name": "creatorName", "creator_role": "creatorRole",
            "link": "link", "url": "url",
            "url_image": "urlImage", "url_emote": "urlEmote",
            "url_instagram": "urlInstagram"
        })

    def _insert_batch(self, entity_class, story_id: int, items: List[Dict[str, Any]], field_map: Dict[str, str]) -> None:
        with self.session_factory() as session:
            for item in items:
                kwargs = {"id_story": story_id}
                for db_col, json_key in field_map.items():
                    if json_key in item:
                        kwargs[db_col] = item[json_key]
                session.add(entity_class(**kwargs))
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

    def save_entity(self, story_id: int, table_name: str, data: Dict[str, Any]) -> None:
        model = self._get_model_map().get(table_name)
        if not model:
            return
        with self.session_factory() as session:
            kwargs = {"id_story": story_id}
            for col in model.__table__.columns:
                col_name = col.name
                if col_name in ("id", "id_story"):
                    continue
                # Try camelCase key from data
                camel_key = self._to_camel(col_name)
                if camel_key in data:
                    kwargs[col_name] = data[camel_key]
                elif col_name in data:
                    kwargs[col_name] = data[col_name]
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
                camel_key = self._to_camel(col_name)
                if camel_key in data:
                    setattr(entity, col_name, data[camel_key])
                elif col_name in data:
                    setattr(entity, col_name, data[col_name])
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
            }
            for json_key, db_attr in field_map.items():
                if json_key in data:
                    setattr(story, db_attr, data[json_key])
            session.commit()

    @staticmethod
    def _to_camel(snake_str: str) -> str:
        parts = snake_str.split("_")
        return parts[0] + "".join(p.capitalize() for p in parts[1:])


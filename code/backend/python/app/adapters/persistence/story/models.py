"""
SQLAlchemy ORM models for the 23 story-related tables.
Maps to the same schema as Java Flyway migrations (V0.10.x).
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float
from app.adapters.persistence.auth.models import Base


class StoryEntity(Base):
    __tablename__ = "list_stories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False)
    author = Column(String(255))
    category = Column(String(100))
    group_name = Column("group_name", String(100))
    visibility = Column(String(20), default="DRAFT")
    priority = Column(Integer, default=0)
    peghi = Column(Integer, default=0)
    version_min = Column(String(20))
    version_max = Column(String(20))
    clock_singular = Column(String(100))
    clock_plural = Column(String(100))
    link_copyright = Column(String(500))
    id_story = Column(Integer)
    id_text_name = Column(Integer)
    id_text_title = Column(Integer)
    id_text_description = Column(Integer)
    id_text_copyright = Column(Integer)


class StoryDifficultyEntity(Base):
    __tablename__ = "list_stories_difficulty"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    uuid = Column(String(36))
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    exp_cost = Column(Integer)
    max_weight = Column(Integer)
    min_character = Column(Integer)
    max_character = Column(Integer)
    cost_help_coma = Column(Integer)
    cost_max_characteristics = Column(Integer)
    number_max_free_action = Column(Integer)


class TextEntity(Base):
    __tablename__ = "list_texts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_text = Column(Integer, nullable=False)
    lang = Column(String(10), default="en")
    short_text = Column(String(1000))
    long_text = Column(Text)


class KeyEntity(Base):
    __tablename__ = "list_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    key_name = Column(String(255))
    key_value = Column(String(255))
    key_group = Column(String(100))
    is_visible = Column(Integer, default=0)


class ClassEntity(Base):
    __tablename__ = "list_classes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)


class ClassBonusEntity(Base):
    __tablename__ = "list_classes_bonus"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_class = Column(Integer)
    bonus_type = Column(String(50))
    bonus_value = Column(Integer)


class TraitEntity(Base):
    __tablename__ = "list_traits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    cost = Column(Integer)
    id_class = Column(Integer)


class CharacterTemplateEntity(Base):
    __tablename__ = "list_character_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_tipo = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    base_des = Column(Integer, default=0)
    base_int = Column(Integer, default=0)
    base_cos = Column(Integer, default=0)
    base_energy = Column(Integer, default=0)
    base_life = Column(Integer, default=0)


class LocationEntity(Base):
    __tablename__ = "list_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    is_safe = Column(Integer, default=0)
    max_characters = Column(Integer)
    id_event_on_enter = Column(Integer)
    id_event_if_counter_zero = Column(Integer)
    counter_start = Column(Integer)
    id_card = Column(Integer)


class LocationNeighborEntity(Base):
    __tablename__ = "list_locations_neighbors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_location_from = Column(Integer)
    id_location_to = Column(Integer)
    direction = Column(String(20))
    energy_cost = Column(Integer, default=1)
    condition_key = Column(String(255))
    condition_value = Column(String(255))


class ItemEntity(Base):
    __tablename__ = "list_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    weight = Column(Integer, default=0)
    id_class = Column(Integer)


class ItemEffectEntity(Base):
    __tablename__ = "list_items_effects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_card = Column(Integer)
    id_item = Column(Integer)
    effect_type = Column(String(50))
    effect_value = Column(Integer)


class WeatherRuleEntity(Base):
    __tablename__ = "list_weather_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    probability = Column(Float)
    delta_energy = Column(Integer, default=0)
    id_event = Column(Integer)
    condition_key = Column(String(255))
    condition_value = Column(String(255))
    time_start = Column(Integer)
    time_end = Column(Integer)
    is_active = Column(Integer, default=1)


class EventEntity(Base):
    __tablename__ = "list_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    event_type = Column(String(50))
    trigger_type = Column(String(50))
    energy_cost = Column(Integer, default=0)
    coin_cost = Column(Integer, default=0)
    id_event_next = Column(Integer)
    flag_interrupt = Column(Integer, default=0)
    flag_end_time = Column(Integer, default=0)
    id_location = Column(Integer)


class EventEffectEntity(Base):
    __tablename__ = "list_events_effects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_event = Column(Integer)
    effect_type = Column(String(50))
    effect_value = Column(Integer)
    flag_group = Column(Integer, default=0)


class ChoiceEntity(Base):
    __tablename__ = "list_choices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_event = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    priority = Column(Integer, default=0)
    is_otherwise = Column(Integer, default=0)
    is_progress = Column(Integer, default=0)
    id_event_torun = Column(Integer)


class ChoiceConditionEntity(Base):
    __tablename__ = "list_choices_conditions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_card = Column(Integer)
    id_choice = Column(Integer)
    condition_type = Column(String(50))
    condition_key = Column(String(255))
    condition_value = Column(String(255))
    condition_operator = Column(String(10), default="AND")


class ChoiceEffectEntity(Base):
    __tablename__ = "list_choices_effects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_choice = Column(Integer)
    effect_type = Column(String(50))
    effect_value = Column(Integer)
    flag_group = Column(Integer, default=0)


class GlobalRandomEventEntity(Base):
    __tablename__ = "list_global_random_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_event = Column(Integer)
    probability = Column(Float)
    condition_key = Column(String(255))
    condition_value = Column(String(255))


class MissionEntity(Base):
    __tablename__ = "list_missions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    condition_key = Column(String(255))
    condition_value_from = Column(String(255))
    condition_value_to = Column(String(255))
    id_event_completed = Column(Integer)


class MissionStepEntity(Base):
    __tablename__ = "list_missions_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_mission = Column(Integer)
    step_order = Column(Integer)
    id_text_description = Column(Integer)
    condition_key = Column(String(255))
    condition_value = Column(String(255))
    id_event_completed = Column(Integer)


class CreatorEntity(Base):
    __tablename__ = "list_creator"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    creator_name = Column(String(255))
    creator_role = Column(String(100))
    link = Column(String(500))


class CardEntity(Base):
    __tablename__ = "list_cards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_card = Column(Integer)
    card_type = Column(String(50))
    id_text_name = Column(Integer)
    image_url = Column(String(500))
    id_reference = Column(Integer)

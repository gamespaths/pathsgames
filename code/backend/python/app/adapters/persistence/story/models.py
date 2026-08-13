"""
SQLAlchemy ORM models for the 23 story-related tables.
Maps to the same schema as Java Flyway migrations (V0.10.x).
Updated to use composite primary keys (id, id_story) for scoped identity.
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
    id_text_clock_singular = Column(Integer)
    id_text_clock_plural = Column(Integer)
    link_copyright = Column(Text)
    id_card = Column(Integer)
    id_text_title = Column(Integer)
    id_text_description = Column(Integer)
    id_text_copyright = Column(Integer)
    id_location_start = Column(Integer)
    id_image = Column(Integer)
    id_location_all_player_coma = Column(Integer)
    id_event_all_player_coma = Column(Integer)
    id_event_end_game = Column(Integer)
    id_creator = Column(Integer)


class StoryDifficultyEntity(Base):
    __tablename__ = "list_stories_difficulty"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    exp_cost = Column(Integer)
    max_weight = Column(Integer)
    min_character = Column(Integer)
    max_character = Column(Integer)
    cost_help_coma = Column(Integer)
    cost_max_characteristics = Column(Integer)
    number_max_free_action = Column(Integer)
    # Step 23 — trait cost budgets; NULL = no limit
    trait_cost_positive_budget = Column(Integer)
    trait_cost_negative_budget = Column(Integer)
    life = Column(Integer, nullable=False, default=0)
    energy = Column(Integer, nullable=False, default=0)
    sad = Column(Integer, nullable=False, default=0)
    dexterity = Column(Integer, nullable=False, default=0)
    intelligence = Column(Integer, nullable=False, default=0)
    constitution = Column(Integer, nullable=False, default=0)
    weight = Column(Integer, nullable=False, default=0)


class TextEntity(Base):
    __tablename__ = "list_texts"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_text = Column(Integer, nullable=False)
    lang = Column(String(10), default="en")
    short_text = Column(String(1000))
    long_text = Column(Text)
    id_text_copyright = Column(Integer)
    link_copyright = Column(Text)
    id_creator = Column(Integer)


class KeyEntity(Base):
    __tablename__ = "list_keys"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    key_name = Column(String(255))
    key_value = Column(String(255))
    key_group = Column(String(100))
    is_visible = Column(Integer, default=0)


class ClassEntity(Base):
    __tablename__ = "list_classes"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    weight_max = Column(Integer, default=10)
    dexterity_base = Column(Integer, default=1)
    intelligence_base = Column(Integer, default=1)
    constitution_base = Column(Integer, default=1)


class ClassBonusEntity(Base):
    __tablename__ = "list_classes_bonus"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_class = Column(Integer)
    statistic = Column(String(50))
    value = Column(Integer)


class TraitEntity(Base):
    __tablename__ = "list_traits"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    cost_positive = Column(Integer, default=0)
    cost_negative = Column(Integer, default=0)
    id_class_permitted = Column(Integer)
    id_class_prohibited = Column(Integer)
    life = Column(Integer, default=0)
    energy = Column(Integer, default=0)
    sad = Column(Integer, default=0)
    dexterity = Column(Integer, default=0)
    intelligence = Column(Integer, default=0)
    constitution = Column(Integer, default=0)
    weight = Column(Integer, default=0)


class CharacterTemplateEntity(Base):
    __tablename__ = "list_character_templates"

    id_tipo = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    life_max = Column(Integer, default=10)
    energy_max = Column(Integer, default=10)
    sad_max = Column(Integer, default=10)
    dexterity_start = Column(Integer, default=1)
    intelligence_start = Column(Integer, default=1)
    constitution_start = Column(Integer, default=1)
    id_class_permitted = Column(Integer)
    id_class_prohibited = Column(Integer)


class LocationEntity(Base):
    __tablename__ = "list_locations"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    is_safe = Column(Integer, default=0)
    max_characters = Column(Integer)
    id_event_on_enter = Column(Integer)
    id_event_if_counter_zero = Column(Integer)
    counter_time = Column(Integer)
    id_card = Column(Integer)
    # Step 33 — the location-side trigger columns. They have existed in the Java schema
    # since V0.10.3; Python never carried them because nothing read them. The engine does
    # now. A null column is not a trigger.
    id_event_if_first_time = Column(Integer)
    id_event_not_first_time = Column(Integer)
    id_event_if_character_enter_empty_location = Column(Integer)
    id_event_if_character_start_time = Column(Integer)
    priority_automatic_event = Column(Integer, default=0)


class LocationNeighborEntity(Base):
    __tablename__ = "list_locations_neighbors"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_card_back = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_location_from = Column(Integer)
    id_location_to = Column(Integer)
    direction = Column(String(20))
    flag_back = Column(Integer, nullable=False, default=0)
    energy_cost = Column(Integer, default=1)
    condition_key = Column(String(255))
    condition_value = Column(String(255))


class ItemEntity(Base):
    __tablename__ = "list_items"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    weight = Column(Integer, default=0)
    id_class = Column(Integer)


class ItemEffectEntity(Base):
    __tablename__ = "list_items_effects"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    id_card = Column(Integer)
    id_item = Column(Integer)
    effect_type = Column(String(50))
    effect_value = Column(Integer)


class WeatherRuleEntity(Base):
    __tablename__ = "list_weather_rules"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    probability = Column(Float)
    delta_energy = Column(Integer, default=0)
    # Step 27 — movement-cost modifiers per weather (safe / not-safe location)
    cost_move_safe_location = Column(Integer, default=0)
    cost_move_not_safe_location = Column(Integer, default=0)
    id_event = Column(Integer)
    condition_key = Column(String(255))
    condition_value = Column(String(255))
    time_start = Column(Integer)
    time_end = Column(Integer)
    is_active = Column(Integer, default=1)


class EventEntity(Base):
    """v0.29.0 — the CONDITION side of an event.

    Realigned onto the Java column names (the reference implementation): the table used to
    call these `event_type` and `energy_cost`, which meant a Java-authored story imported
    into Python silently lost its costs. Everything an event DOES now lives on
    EventEffectEntity; what is left here is the cost, the chain, and the conditions — all
    of which combine in AND.

    `cost_enery` keeps the historical typo of the shared DDL on purpose: the JSON contract,
    the admin form and the Java entity all spell it that way.
    """

    __tablename__ = "list_events"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    # AUTOMATIC / FIRST / NORMAL / ONCE (free text: authored stories also use END, END_GAME).
    # Only NORMAL and ONCE are player-executable; ONCE is spent once per MATCH.
    type = Column(String(50))
    cost_enery = Column(Integer, default=0)
    coin_cost = Column(Integer, default=0)
    flag_end_time = Column(Integer, default=0)
    id_event_next = Column(Integer)
    # ── conditions (AND) ────────────────────────────────────────────────────
    # The owning location of a location-specific event; NULL = no location constraint.
    id_specific_location = Column(Integer)
    # CONDITION: the match's current weather must equal this. Beware the mirror —
    # EventEffectEntity.id_weather carries the same name but SETS the weather.
    id_weather = Column(Integer)
    registry_key_condition = Column(String(200))
    registry_value_condition = Column(String(500))
    id_item_condition = Column(Integer)
    id_class_condition = Column(Integer)
    # DEPRECATED v0.29.0: ignored by the engine. Items are granted through effects.
    id_item_to_add = Column(Integer)


class EventEffectEntity(Base):
    """v0.29.0 — the EFFECT side of an event, one row per effect.

    Realigned onto the Java column set; the old `effect_type`/`effect_value`/`flag_group`
    trio was disjoint from it, so no Java-authored effect survived an import.
    The inherited `id_card` is the row's NARRATIVE card — that, not the event's card, is
    what the board renders.
    """

    __tablename__ = "list_events_effects"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_event = Column(Integer)
    # life, energy, sad, exp, dex, int, cos, food, magic, coin
    statistics = Column(String(50))
    value = Column(Integer, default=0)
    # ALL = every character in the actor's location (INV-27); ONLY_ONE = the actor.
    target = Column(String(20), default="ALL")
    target_class = Column(Integer)
    traits_to_add = Column(String(200))
    traits_to_remove = Column(String(200))
    id_item_target = Column(Integer)
    item_action = Column(String(20))
    key_to_add = Column(String(200))
    key_value_to_add = Column(String(500))
    characteristic_to_add = Column(String(200))
    characteristic_to_remove = Column(String(200))
    # EFFECT: sets gaming_match.id_current_weather (the opposite of EventEntity.id_weather).
    id_weather = Column(Integer)
    # EFFECT (v0.29.3): moves the recipients to this location — no Step 28 checks, no energy.
    id_location = Column(Integer)


class ChoiceEntity(Base):
    __tablename__ = "list_choices"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_event = Column(Integer)
    # Deprecated since Step 31 (R8): a choice binds to an event, never to a location.
    id_location = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    # The post-selection narrative — revealed by Step 32, never on the pending options.
    id_text_narrative = Column(Integer)
    priority = Column(Integer, default=0)
    is_otherwise = Column(Integer, default=0)
    is_progress = Column(Integer, default=0)
    id_event_torun = Column(Integer)
    # Step 31 inline limits: dex/int/cos are minimums, sad is a maximum. NULL = no limit.
    limit_sad = Column(Integer)
    limit_dex = Column(Integer)
    limit_int = Column(Integer)
    limit_cos = Column(Integer)
    # AND (default) or OR — how the list_choices_conditions rows combine (INV-31).
    logic_operator = Column(String(10), default="AND")


class ChoiceConditionEntity(Base):
    __tablename__ = "list_choices_conditions"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    # The admin CRUD addresses every entity by uuid (create re-reads by it, update and
    # delete filter on it). The schema has carried this column since V0.10.4; the model
    # dropped it, so create/get/update/delete of a choice-condition raised
    # AttributeError on this backend — the same drift Step 32 fixed on ChoiceEffectEntity.
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_choice = Column(Integer)
    condition_type = Column(String(50))
    condition_key = Column(String(255))
    condition_value = Column(String(255))
    # The per-row COMPARATOR (=, !=, >, <) — the AND/OR combiner lives on the choice
    # (logic_operator). The old "AND" default conflated the two (fixed in Step 31).
    condition_operator = Column(String(10), default="=")


class ChoiceEffectEntity(Base):
    """Step 32 — what a selected option does, one row per effect.

    Realigned onto the Java column set, the way `EventEffectEntity` was in Step 29 and for
    the same reason: the old `effect_type`/`effect_value` pair was disjoint from the
    canonical `statistics`/`value`, so nothing a Java-authored story wrote in those columns
    survived an import here. The row also gained `uuid` (the response identifies each
    applied effect by it) and the whole effect vocabulary the resolution engine speaks.

    The inherited `id_card` is the row's NARRATIVE card — that, not the choice's card, is
    what the board renders for this effect.
    """

    __tablename__ = "list_choices_effects"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_choice = Column(Integer)
    # life, energy, sad, exp, dex, int, cos, food, magic, coin
    statistics = Column(String(50))
    value = Column(Integer, default=0)
    # 1 = every character in the actor's location (INV-46); 0 = the actor alone.
    flag_group = Column(Integer, default=0)
    # The registry pair: value_to_add SETS the key, value_to_remove clears it — but only
    # when the stored value still matches, so an option cannot wipe a key the story moved on.
    key = Column(String(200))
    value_to_add = Column(String(500))
    value_to_remove = Column(String(500))
    # ── v0.32.0 effect targets, twins of the list_events_effects columns ──
    # EFFECT: runs that event inline, with its whole id_event_next chain.
    id_event = Column(Integer)
    # EFFECT: moves the recipients there — no adjacency check, no energy cost.
    id_location = Column(Integer)
    # EFFECT: SETS gaming_match.id_current_weather, once per row.
    id_weather = Column(Integer)
    id_item_target = Column(Integer)
    item_action = Column(String(20))


class GlobalRandomEventEntity(Base):
    __tablename__ = "list_global_random_events"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_event = Column(Integer)
    probability = Column(Float)
    condition_key = Column(String(255))
    condition_value = Column(String(255))


class MissionEntity(Base):
    __tablename__ = "list_missions"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    condition_key = Column(String(255))
    condition_value_from = Column(String(255))
    condition_value_to = Column(String(255))
    id_event_completed = Column(Integer)


class MissionStepEntity(Base):
    __tablename__ = "list_missions_steps"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    id_mission = Column(Integer)
    step_order = Column(Integer)
    id_text_description = Column(Integer)
    condition_key = Column(String(255))
    condition_value = Column(String(255))
    id_event_completed = Column(Integer)


class CreatorEntity(Base):
    __tablename__ = "list_creator"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    id_text_name = Column(Integer)
    id_text_description = Column(Integer)
    id_text = Column(Integer)
    creator_name = Column(String(255))
    creator_role = Column(String(100))
    link = Column(String(500))
    url = Column(String(500))
    url_image = Column(Text)
    url_emote = Column(String(500))
    url_instagram = Column(String(500))


class CardEntity(Base):
    __tablename__ = "list_cards"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), primary_key=True, nullable=False)
    uuid = Column(String(36))
    id_card = Column(Integer)
    card_type = Column(String(50))
    id_text_name = Column(Integer)
    id_text_title = Column(Integer)
    id_text_description = Column(Integer)
    id_text_copyright = Column(Integer)
    url_image = Column(Text)
    alternative_image = Column(Text)
    awesome_icon = Column(String(100))
    style_main = Column(String(100))
    style_detail = Column(String(100))
    style_image_little = Column(String(100))
    style_image_medium = Column(String(100))
    style_image_large = Column(String(100))
    link_copyright = Column(Text)
    id_creator = Column(Integer)
    id_reference = Column(Integer)

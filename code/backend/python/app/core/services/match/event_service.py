"""Step 29 — normal (player-triggered) events. Mirrors ``EventExecutionService.java``.

Executes a NORMAL or ONCE event for the caller's character: the event is checked by
:mod:`event_availability` (the same verdict match-info publishes as ``available``), its
energy and coin cost is paid once, then the whole ``id_event_next`` chain applies its
effects.

Rules worth stating, because they are easy to get wrong:

* **Turns are untouched.** No turn is required and none is consumed — same as Step 28
  movement. ``turn_consumed`` is always False; Step 61 revisits this.
* **Chained events are consequences, not choices.** They are not re-checked and cost
  nothing: the player already paid to start the chain. The single exception is the ONCE
  invariant, which is a data rule rather than an eligibility one.
* **Coma short-circuits everything.** When life reaches zero the chain stops and
  ``flag_end_time`` does not fire: Step 29 only raises the flags, Step 38 owns the rest.
* **game_over is only a flag.** Moving the match to GAMEOVER is Step 38.
"""
from typing import Any, Dict, List, Optional

from app.core.models.match.event_models import (
    AppliedEffect, EntityChange, EventCheckContext, EventError, EventExecutionResult,
    RegistryChange, StatChange,
)
from app.core.ports.match.event_ports import MSG_EVENT_EXECUTED, EventPort, EventStorePort
from app.core.services.match import event_availability

ADD = "ADD"
REMOVE = "REMOVE"
TARGET_ONLY_ONE = "ONLY_ONE"

# A chain longer than this is treated as broken and simply stops. The Step 22 validator
# rejects cycles at import, but the admin CRUD path is lenient and never sees the whole
# graph, so an authored A -> B -> A can reach the engine. The visited set already breaks
# such a loop; this is the belt to its braces.
MAX_CHAIN = 32

# The statistics that live on the character vs on the backpack.
_CHARACTER_STATS = {"life", "energy", "sad", "exp", "dex", "int", "cos"}
_BACKPACK_STATS = {"food", "magic", "coin"}
_CLAMPED = {"life": "life_max", "energy": "energy_max", "sad": "sad_max"}
_FIELD = {"dex": "dexterity", "int": "intelligence", "cos": "constitution"}


def _clamp(value: int, low: int, high: int) -> int:
    if high < low:
        return low
    return max(low, min(high, value))


class _Live:
    """In-memory, mutable view of one character for the duration of an execution.

    Stats are edited here and written once at the end, so a chain of effects on the same
    character costs one UPDATE rather than one per effect — and each effect sees what the
    previous one did.
    """

    def __init__(self, view: Dict[str, Any], backpack: Dict[str, int]) -> None:
        self.id = view["id"]
        self.uuid = view.get("uuid")
        self.dexterity = view.get("dexterity") or 0
        self.intelligence = view.get("intelligence") or 0
        self.constitution = view.get("constitution") or 0
        self.energy = view.get("energy") or 0
        self.life = view.get("life") or 0
        self.sad = view.get("sad") or 0
        self.exp = view.get("exp") or 0
        self.energy_max = view.get("energy_max") or 0
        self.life_max = view.get("life_max") or 0
        self.sad_max = view.get("sad_max") or 0
        self.food = backpack.get("food", 0)
        self.magic = backpack.get("magic", 0)
        self.coin = backpack.get("coin", 0)
        csv = view.get("characteristics") or ""
        self.characteristics: List[str] = [c.strip() for c in csv.split(",") if c.strip()]
        self.backpack_dirty = False
        self.characteristics_dirty = False
        self.coma_set = bool(view.get("is_coma"))

    def get(self, name: str) -> int:
        return getattr(self, _FIELD.get(name, name))

    def set(self, name: str, value: int) -> None:
        setattr(self, _FIELD.get(name, name), value)


class EventService(EventPort):

    def __init__(self, store: EventStorePort, content_read_port=None,
                 time_service=None) -> None:
        self.store = store
        # Resolves the localized cards (nullable: the cards are then left None).
        self.content_read_port = content_read_port
        # TimeAdvancementService, for an event carrying flag_end_time (nullable: time then
        # never ends). Held as the concrete class, not the port: force_time_end is
        # deliberately absent from TimeAdvancementPort so REST cannot reach it.
        self.time_service = time_service

    # ── the public flow ─────────────────────────────────────────────────────

    def execute_event(self, match_uuid: str, user_uuid: str, event_uuid: str,
                      lang: str = "en") -> EventExecutionResult:
        user_id = self.store.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            raise self._not_found()
        match = self.store.find_match_for_event(match_uuid)
        if not match:
            raise self._not_found()

        # The caller must own a character in this match (masked as not-found otherwise).
        actor = self.store.find_character_by_match_and_user(match["id"], user_id)
        if not actor:
            raise self._not_found()

        if match.get("status") != "RUNNING":
            raise EventError(EventError.MATCH_NOT_RUNNING, "Match is not RUNNING")

        event = self.store.find_event_by_story_and_uuid(match["id_story"], event_uuid)
        if not event:
            raise EventError(EventError.EVENT_NOT_FOUND, "Event not found in this story")

        ctx = self.store.load_check_context(match["id"], actor["id"])
        verdict = event_availability.check(event, ctx)
        if not verdict.available:
            raise EventError(verdict.reason, f"Event cannot be executed: {verdict.reason}")

        x = _Exec(self, match, actor, ctx, lang or "en", event)
        self._deduct_costs(x, event)
        self._run_chain(x, event)
        if x.end_time and not x.coma_triggered:
            self._force_time_end(x)
        return self._build_result(x)

    # ── costs ───────────────────────────────────────────────────────────────

    def _deduct_costs(self, x: "_Exec", event: Dict[str, Any]) -> None:
        """Paid once, by the actor, for the event they asked for. The check procedure already
        proved they can afford it, so neither can go negative."""
        x.energy_spent = event.get("cost_enery") or 0
        x.coin_spent = event.get("coin_cost") or 0
        if x.energy_spent:
            live = x.live(x.actor)
            live.energy = _clamp(live.energy - x.energy_spent, 0, live.energy_max)
        if x.coin_spent:
            live = x.live(x.actor)
            live.coin = max(0, live.coin - x.coin_spent)
            live.backpack_dirty = True

    # ── the chain ───────────────────────────────────────────────────────────

    def _run_chain(self, x: "_Exec", first: Dict[str, Any]) -> None:
        events_by_id = self.store.find_events_by_id(x.match["id_story"])
        effects_by_event = self.store.find_effects_by_event_id(x.match["id_story"])
        end_game_id = self.store.find_id_event_end_game(x.match["id_story"])

        current: Optional[Dict[str, Any]] = first
        while current:
            self._apply_event(x, current, effects_by_event, end_game_id)
            if x.coma_triggered:
                return  # coma stops the chain, and flag_end_time with it

            nxt = current.get("id_event_next")
            if not nxt or nxt <= 0:
                return
            if nxt in x.visited or len(x.visited) >= MAX_CHAIN:
                return  # authored loop, or a chain long enough to be a bug
            nxt_event = events_by_id.get(nxt)
            if not nxt_event:
                return  # dangling id_event_next
            if (nxt_event.get("type") or "").strip().upper() == "ONCE" \
                    and nxt in x.ctx.consumed_event_ids:
                return  # a spent ONCE event stays spent, even mid-chain
            current = nxt_event  # not re-checked, not charged

    def _apply_event(self, x: "_Exec", event: Dict[str, Any],
                     effects_by_event: Dict[int, List[Dict[str, Any]]],
                     end_game_id: Optional[int]) -> None:
        event_id = event.get("id")
        x.visited.add(event_id)
        x.ctx.consumed_event_ids.add(event_id)
        if event.get("uuid") and event["uuid"] not in x.executed_event_uuids:
            x.executed_event_uuids.append(event["uuid"])

        for effect in effects_by_event.get(event_id, []):
            self._apply_effect(x, event, effect)

        x.end_time = x.end_time or (event.get("flag_end_time") or 0) == 1
        x.game_over = x.game_over or (end_game_id is not None and end_game_id == event_id)

        self._check_coma(x)
        self.store.log_event_executed(x.match["id"], x.actor["id"], event_id,
                                      x.current_clock, f"{MSG_EVENT_EXECUTED} {event_id}")

    # ── effects ─────────────────────────────────────────────────────────────

    def _apply_effect(self, x: "_Exec", event: Dict[str, Any], effect: Dict[str, Any]) -> None:
        recipients = self._resolve_recipients(x, effect)

        # Weather is a property of the MATCH, not of a character: it applies once per effect
        # row no matter how many (or how few) characters that row targets.
        id_weather = effect.get("id_weather")
        if id_weather:
            self.store.set_current_weather(x.match["id"], id_weather)
            x.weather_applied = True

        touched: List[str] = []
        for recipient in recipients:
            touched.append(recipient.get("uuid"))
            self._apply_stat(x, recipient, effect)
            self._apply_item(x, recipient, effect)
            self._apply_traits(x, recipient, effect, event)
            self._apply_characteristics(x, recipient, effect)
            self._apply_registry(x, recipient, effect, event)

        x.effects.append(AppliedEffect(
            event_uuid=event.get("uuid"),
            effect_uuid=effect.get("uuid"),
            statistic=effect.get("statistics"),
            value=effect.get("value"),
            target=effect.get("target"),
            target_class=effect.get("target_class"),
            character_uuids=touched,
            card=x.resolve_card(effect.get("id_card")),
        ))

    def _resolve_recipients(self, x: "_Exec", effect: Dict[str, Any]) -> List[Dict[str, Any]]:
        """INV-27: ALL means every character standing in the ACTOR's location, not every
        character of the match. target_class then narrows that set; matching nobody is legal
        and simply applies nothing."""
        target = (effect.get("target") or "ALL").strip().upper()
        if target == TARGET_ONLY_ONE or x.actor.get("id_location") is None:
            base = [x.actor]
        else:
            base = [c for c in x.all_characters()
                    if c.get("id_location") == x.actor.get("id_location")]

        target_class = effect.get("target_class")
        if not target_class or target_class <= 0:
            return base
        return [c for c in base if c.get("id_class") == target_class]

    def _apply_stat(self, x: "_Exec", recipient: Dict[str, Any],
                    effect: Dict[str, Any]) -> None:
        stat = (effect.get("statistics") or "").strip().lower()
        if not stat:
            return
        delta = effect.get("value") or 0
        live = x.live(recipient)

        if stat in _CHARACTER_STATS:
            before = live.get(stat)
            cap = getattr(live, _CLAMPED[stat]) if stat in _CLAMPED else None
            after = _clamp(before + delta, 0, cap) if cap is not None else max(0, before + delta)
            live.set(stat, after)
        elif stat in _BACKPACK_STATS:
            before = getattr(live, stat)
            after = max(0, before + delta)
            setattr(live, stat, after)
            live.backpack_dirty = True
        else:
            return  # an unknown statistic is authored noise, not an error

        x.stat_changes.append(StatChange(recipient.get("uuid"), stat, before, after, after - before))

    def _apply_item(self, x: "_Exec", recipient: Dict[str, Any],
                    effect: Dict[str, Any]) -> None:
        id_item = effect.get("id_item_target")
        action = (effect.get("item_action") or "").strip().upper()
        if not id_item or id_item <= 0 or not action:
            return
        item_uuid = x.item_uuids().get(id_item)
        if action == ADD:
            self.store.add_item(x.match["id"], recipient["id"], id_item)
            x.item_added = True
            x.item_changes.append(EntityChange(recipient.get("uuid"), item_uuid, ADD))
            if recipient["id"] == x.actor["id"]:
                x.ctx.owned_item_ids.add(id_item)
        elif action == REMOVE and self.store.remove_item(x.match["id"], recipient["id"], id_item):
            x.item_removed = True
            x.item_changes.append(EntityChange(recipient.get("uuid"), item_uuid, REMOVE))
            if recipient["id"] == x.actor["id"]:
                x.ctx.owned_item_ids.discard(id_item)

    def _apply_traits(self, x: "_Exec", recipient: Dict[str, Any], effect: Dict[str, Any],
                      event: Dict[str, Any]) -> None:
        for id_trait in _csv_ids(effect.get("traits_to_add")):
            if self.store.add_trait(x.match["id"], recipient["id"], id_trait, event.get("id")):
                x.trait_changes.append(EntityChange(
                    recipient.get("uuid"), x.trait_uuids().get(id_trait), ADD))
        for id_trait in _csv_ids(effect.get("traits_to_remove")):
            if self.store.remove_trait(x.match["id"], recipient["id"], id_trait):
                x.trait_changes.append(EntityChange(
                    recipient.get("uuid"), x.trait_uuids().get(id_trait), REMOVE))

    def _apply_characteristics(self, x: "_Exec", recipient: Dict[str, Any],
                               effect: Dict[str, Any]) -> None:
        add = _csv(effect.get("characteristic_to_add"))
        remove = _csv(effect.get("characteristic_to_remove"))
        if not add and not remove:
            return
        live = x.live(recipient)
        for value in add:
            if value not in live.characteristics:
                live.characteristics.append(value)
                live.characteristics_dirty = True
                x.characteristic_changes.append(EntityChange(recipient.get("uuid"), value, ADD))
        for value in remove:
            if value in live.characteristics:
                live.characteristics.remove(value)
                live.characteristics_dirty = True
                x.characteristic_changes.append(EntityChange(recipient.get("uuid"), value, REMOVE))

    def _apply_registry(self, x: "_Exec", recipient: Dict[str, Any], effect: Dict[str, Any],
                        event: Dict[str, Any]) -> None:
        """The registry is match-scoped, so it is written once per effect row (by the actor),
        not once per recipient. The in-memory context is updated too, so a later event in the
        same chain sees the value its predecessor just wrote."""
        key = effect.get("key_to_add")
        if not key or recipient["id"] != x.actor["id"]:
            return
        value = effect.get("key_value_to_add")
        old = x.ctx.registry.get(key)
        self.store.upsert_registry(x.match["id"], key, value, x.actor["id"],
                                   event.get("id"), x.current_clock)
        x.ctx.registry[key] = value
        x.registry_changes.append(RegistryChange(key, old, value))

    # ── coma & time end ─────────────────────────────────────────────────────

    def _check_coma(self, x: "_Exec") -> None:
        """Step 29 only raises the flags: life at zero sets is_coma and is_sleeping and
        returns. Rescue, group coma and game over are Step 38."""
        for live in x.living.values():
            if live.life <= 0 and not live.coma_set:
                live.coma_set = True
                self.store.set_character_coma(x.match["id"], live.id)
                if live.id == x.actor["id"]:
                    x.coma_triggered = True
                    x.forced_sleep = True

    def _force_time_end(self, x: "_Exec") -> None:
        if self.time_service is None:
            return
        # The recovery reads the character rows, so this event's effects must already be on
        # disk. _flush also latches x.flushed, which stops _build_result from writing the
        # now-stale in-memory copy back over what the recovery just computed.
        self._flush(x)
        new_clock = self.time_service.force_time_end(x.match["uuid"])
        x.time_ended = True
        x.forced_sleep = True
        x.current_clock = new_clock
        # The recovery rewrote the stats: report what the database now holds.
        fresh = self.store.find_character_by_match_and_user(x.match["id"], x.actor["id_user"])
        if fresh:
            live = x.live(x.actor)
            live.energy = fresh.get("energy") or 0
            live.life = fresh.get("life") or 0
            live.sad = fresh.get("sad") or 0

    # ── persistence & result ────────────────────────────────────────────────

    def _flush(self, x: "_Exec") -> None:
        """Write back every character the event touched. Called once, at the end."""
        if x.flushed:
            return
        x.flushed = True
        for live in x.living.values():
            self.store.update_character_stats(x.match["id"], live.id, {
                "dexterity": live.dexterity, "intelligence": live.intelligence,
                "constitution": live.constitution, "energy": live.energy,
                "life": live.life, "sad": live.sad, "exp": live.exp,
            })
            if live.backpack_dirty:
                self.store.update_backpack(x.match["id"], live.id, {
                    "food": live.food, "magic": live.magic, "coin": live.coin,
                })
            if live.characteristics_dirty:
                csv = ",".join(live.characteristics) if live.characteristics else None
                self.store.set_character_characteristics(x.match["id"], live.id, csv)

    def _build_result(self, x: "_Exec") -> EventExecutionResult:
        self._flush(x)
        actor = x.live(x.actor)
        changed = any([
            x.time_ended, x.item_added, x.item_removed, x.weather_applied, x.forced_sleep,
            x.coma_triggered, x.game_over, x.stat_changes, x.registry_changes,
            x.trait_changes, x.characteristic_changes,
        ])
        return EventExecutionResult(
            match_uuid=x.match["uuid"],
            event_uuid=x.event.get("uuid"),
            event_type=x.event.get("type"),
            card=x.resolve_card(x.event.get("id_card")),
            executed_event_uuids=list(x.executed_event_uuids),
            energy_spent=x.energy_spent,
            coin_spent=x.coin_spent,
            new_energy=actor.energy,
            new_coin=actor.coin,
            current_clock=x.current_clock,
            turn_consumed=False,  # v0.29.0 never touches the turn queue
            time_ended=x.time_ended,
            item_added=x.item_added,
            item_removed=x.item_removed,
            weather_applied=x.weather_applied,
            forced_sleep=x.forced_sleep,
            coma_triggered=x.coma_triggered,
            game_over=x.game_over,
            refresh_recommended=bool(changed),
            stat_changes=x.stat_changes,
            registry_changes=x.registry_changes,
            trait_changes=x.trait_changes,
            item_changes=x.item_changes,
            characteristic_changes=x.characteristic_changes,
            effects=x.effects,
            pending_choices=[],
        )

    @staticmethod
    def _not_found() -> EventError:
        """Masks an unknown match AND a caller who is not in it: neither leaks the other."""
        return EventError(EventError.MATCH_NOT_FOUND, "Match not found or not accessible")


class _Exec:
    """The mutable accumulator of one execution."""

    def __init__(self, service: EventService, match: Dict[str, Any], actor: Dict[str, Any],
                 ctx: EventCheckContext, lang: str, event: Dict[str, Any]) -> None:
        self._service = service
        self.match = match
        self.actor = actor
        self.ctx = ctx
        self.lang = lang
        self.event = event

        self.living: Dict[int, _Live] = {}
        self.visited: set = set()
        self.executed_event_uuids: List[str] = []
        self._card_cache: Dict[int, Any] = {}
        self._all_characters: Optional[List[Dict[str, Any]]] = None
        self._item_uuids: Optional[Dict[int, str]] = None
        self._trait_uuids: Optional[Dict[int, str]] = None

        self.stat_changes: List[StatChange] = []
        self.registry_changes: List[RegistryChange] = []
        self.trait_changes: List[EntityChange] = []
        self.item_changes: List[EntityChange] = []
        self.characteristic_changes: List[EntityChange] = []
        self.effects: List[AppliedEffect] = []

        self.current_clock = match.get("current_clock") or 0
        self.energy_spent = 0
        self.coin_spent = 0
        self.end_time = False
        self.time_ended = False
        self.item_added = False
        self.item_removed = False
        self.weather_applied = False
        self.forced_sleep = False
        self.coma_triggered = False
        self.game_over = False
        self.flushed = False

    def all_characters(self) -> List[Dict[str, Any]]:
        """Lazily loaded: only a target=ALL effect needs the other characters."""
        if self._all_characters is None:
            self._all_characters = self._service.store.find_characters_for_event(self.match["id"])
        return self._all_characters

    def item_uuids(self) -> Dict[int, str]:
        if self._item_uuids is None:
            self._item_uuids = self._service.store.find_item_uuids_by_id(self.match["id_story"])
        return self._item_uuids

    def trait_uuids(self) -> Dict[int, str]:
        if self._trait_uuids is None:
            self._trait_uuids = self._service.store.find_trait_uuids_by_id(self.match["id_story"])
        return self._trait_uuids

    def live(self, view: Dict[str, Any]) -> _Live:
        key = view["id"]
        if key not in self.living:
            backpack = self._service.store.find_backpack(self.match["id"], key) or {}
            self.living[key] = _Live(view, backpack)
        return self.living[key]

    def resolve_card(self, id_card: Optional[int]) -> Optional[Dict[str, Any]]:
        """Memoized: an effect's card is reachable from several rows of the same chain.

        The Python card reader takes no lang yet (unlike the Java one), so `lang` is carried
        on the request but not honoured here — same as GET /locations on this backend.
        """
        port = self._service.content_read_port
        if port is None or not id_card:
            return None
        if id_card not in self._card_cache:
            self._card_cache[id_card] = port.find_card_by_story_id_and_card_id(
                self.match["id_story"], id_card)
        return self._card_cache[id_card]


def _csv(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [v.strip() for v in str(value).split(",") if v.strip()]


def _csv_ids(value: Optional[str]) -> List[int]:
    """CSV of story-local ids; anything non-numeric is skipped rather than raising."""
    out: List[int] = []
    for part in _csv(value):
        try:
            out.append(int(part))
        except ValueError:
            pass  # authored noise
    return out

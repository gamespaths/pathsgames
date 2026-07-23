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
  ``flag_end_time`` does not fire. Step 30 added what happens next: the sadness and coma
  rules of :mod:`edge_state_evaluator`, and — once every character is down — the story's
  ``id_event_all_player_coma`` epilogue.
* **game_over is only a flag.** Moving the match to GAMEOVER is step 59, together with the
  rescue endpoints.
* **Forced movement bypasses Step 28.** An effect's ``id_location`` (v0.29.3) moves its
  recipients with no neighbor, energy or availability check; only a cost-0 movement log
  row is written per moved character.
"""
from typing import Any, Dict, List, Optional

from app.core.models.match.event_models import (
    STATUS_APPLIED, STATUS_CHOICES_PENDING, AppliedEffect, ChoiceCheckContext,
    ChoiceResolutionResult, EdgeStateOutcome, EntityChange, EventCheckContext, EventError,
    EventExecutionResult, LocationChange, RegistryChange, StatChange,
)
from app.core.ports.match.edge_state_ports import MSG_ALL_PLAYER_COMA, EdgeStateStorePort
from app.core.ports.match.event_ports import (
    MSG_CHOICE_SELECTED, MSG_EVENT_EXECUTED, EventPort, EventStorePort,
)
from app.core.services.match import choice_availability, edge_state_evaluator, event_availability

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
        # The raw sadness before the cap, so the Step 30 overflow rule reads what the effect
        # really added rather than what the column can hold. set_sad is the only door to
        # ``sad``, so no future effect type can bypass the check by writing the field.
        self.sad = 0
        self.sad_unclamped = 0
        self.set_sad(view.get("sad") or 0)

    def set_sad(self, raw: int) -> None:
        self.sad_unclamped = raw
        self.sad = _clamp(raw, 0, self.sad_max)

    def get(self, name: str) -> int:
        return getattr(self, _FIELD.get(name, name))

    def set(self, name: str, value: int) -> None:
        if _FIELD.get(name, name) == "sad":
            self.set_sad(value)
            return
        setattr(self, _FIELD.get(name, name), value)


class EventService(EventPort):

    def __init__(self, store: EventStorePort, edge_store: EdgeStateStorePort = None,
                 content_read_port=None, time_service=None) -> None:
        self.store = store
        self.edge_store = edge_store
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

        # Step 31: an event owning options presents them instead of applying anything.
        # The availability verdict moves inside the branch — an already-open cycle must
        # bypass it, having been paid for when it opened.
        choices = self.store.find_choices_by_event_id(match["id_story"], event.get("id") or 0)
        if choices:
            return self._execute_choice_event(match, actor, ctx, lang or "en", event, choices)

        verdict = event_availability.check(event, ctx)
        if not verdict.available:
            raise EventError(verdict.reason, f"Event cannot be executed: {verdict.reason}")

        x = _Exec(self, match, actor, ctx, lang or "en", event)
        self._deduct_costs(x, event)
        self._run_chain(x, event)
        # Before the time-end branch, not after: _force_time_end flushes and latches
        # x.flushed, which would freeze the epilogue's own stat changes out of the database.
        self._resolve_all_player_coma(x)
        if x.end_time and not x.coma_triggered:
            self._force_time_end(x)
        return self._build_result(x)

    # ── choices (Step 31) ───────────────────────────────────────────────────

    def _execute_choice_event(self, match: Dict[str, Any], actor: Dict[str, Any],
                              ctx: EventCheckContext, lang: str, event: Dict[str, Any],
                              choices: List[Dict[str, Any]]) -> EventExecutionResult:
        """A choice-event stops at its threshold: pay, mark, present — never apply.

        The whole Step 29 tail (effects, chain, flag_end_time, edge states, epilogue,
        game_over) belongs to the resolution, which is Step 32.

        An OPEN cycle — EVENT_EXECUTED markers outnumbering CHOICE_SELECTED markers —
        re-serves the options as a pure read: no verdict, no cost, no marker. Bypassing
        the verdict is deliberate: the open already deducted energy and consumed the
        ONCE, so re-checking would reject the very event the player has paid for.
        Option availability, in contrast, is re-evaluated fresh on every serve.
        """
        event_id = event.get("id") or 0
        x = _Exec(self, match, actor, ctx, lang, event)
        # The consumed set is already built from EVENT_EXECUTED markers, so the two count
        # queries run only for an event that was executed at least once.
        open_cycle = event_id in ctx.consumed_event_ids and (
            self.store.count_log_markers(match["id"], event_id, MSG_EVENT_EXECUTED)
            > self.store.count_log_markers(match["id"], event_id, MSG_CHOICE_SELECTED))
        if not open_cycle:
            verdict = event_availability.check(event, ctx)
            if not verdict.available:
                raise EventError(verdict.reason, f"Event cannot be executed: {verdict.reason}")
            self._deduct_costs(x, event)
            # The marker slice of _apply_event, without its effects: same message format,
            # so the ONCE accounting and the log timeline cannot tell the flows apart.
            x.visited.add(event_id)
            x.ctx.consumed_event_ids.add(event_id)
            self.store.log_event_executed(match["id"], actor["id"], event_id,
                                          x.current_clock, f"{MSG_EVENT_EXECUTED} {event_id}")
        # Both paths: "index 0 is always the event" holds on a re-fetch too, so the
        # frontend cannot tell a page refresh from the first open (beside energy_spent=0).
        if event.get("uuid"):
            x.executed_event_uuids.append(event["uuid"])
        x.status = STATUS_CHOICES_PENDING
        x.pending_choices = self._build_pending_choices(x, choices)
        return self._build_result(x)

    # ── choice resolution (Step 32) ─────────────────────────────────────────

    def select_choice(self, match_uuid: str, user_uuid: str, choice_uuid: str,
                      lang: str = "en") -> ChoiceResolutionResult:
        """Resolve one option of an open choice-event: apply its list_choices_effects, run
        the events they and id_event_torun point at, record the milestone, close the cycle.

        **Nothing is charged.** The energy, the coins and the ONCE were all spent when the
        event was opened (Step 31), which is what makes the open-cycle count — not the Step
        29 availability procedure — the right gate here: re-running that procedure would
        reject the very event the player has already paid for. The count comparison doubles
        as the cost-bypass guard, since it is false both for an event never opened and for
        one already resolved.
        """
        user_id = self.store.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            raise self._not_found()
        match = self.store.find_match_for_event(match_uuid)
        if not match:
            raise self._not_found()
        actor = self.store.find_character_by_match_and_user(match["id"], user_id)
        if not actor:
            raise self._not_found()
        if match.get("status") != "RUNNING":
            raise EventError(EventError.MATCH_NOT_RUNNING, "Match is not RUNNING")

        choice = self.store.find_choice_by_story_and_uuid(match["id_story"], choice_uuid)
        if not choice:
            raise EventError(EventError.CHOICE_NOT_FOUND, "Choice not found in this story")

        ctx = self.store.load_check_context(match["id"], actor["id"])
        # Coma outranks sleep, as everywhere else: a comatose character is also flagged
        # asleep, and the two are not the same news — one waits, the other needs a rescue.
        if ctx.coma:
            raise EventError(EventError.COMA, "Character is in a coma")
        if ctx.sleeping:
            raise EventError(EventError.SLEEPING, "Character is sleeping")

        # R8 (Step 31) makes id_event mandatory on import, but the CRUD path is lenient, so
        # an orphan option can reach the engine — it resolves to no cycle and is rejected.
        event_id = choice.get("id_event") or 0
        events_by_id = self.store.find_events_by_id(match["id_story"])
        event = events_by_id.get(event_id)
        if not event:
            raise EventError(EventError.EVENT_NOT_FOUND,
                             "The event owning this choice does not exist")
        if self.store.count_log_markers(match["id"], event_id, MSG_EVENT_EXECUTED) \
                <= self.store.count_log_markers(match["id"], event_id, MSG_CHOICE_SELECTED):
            raise EventError(EventError.CHOICE_NOT_OPEN,
                             "No open choice cycle for this event: open it before resolving it")

        x = _Exec(self, match, actor, ctx, lang or "en", event)
        x.seed_events_by_id(events_by_id)  # already read above — do not pay for it twice

        self._require_still_available(x, choice)

        choice_id = choice.get("id") or 0
        self._apply_choice_effects(x, choice_id, event_id, event)
        # The option's own outcome event, last: every effect row has set the stage (a key
        # written, an item granted) that the outcome event is authored to read.
        if not x.coma_triggered and x.status != STATUS_CHOICES_PENDING:
            self._run_linked_event(x, choice.get("id_event_torun"))

        self._resolve_all_player_coma(x)
        if x.end_time and not x.coma_triggered:
            self._force_time_end(x)

        self._write_resolution_markers(x, choice, event_id, choice_id)

        return ChoiceResolutionResult(
            execution=self._build_result(x),
            choice_uuid=choice.get("uuid"),
            event_uuid=event.get("uuid"),
            narrative=self.store.resolve_short_text(
                match["id_story"], choice.get("id_text_narrative"), x.lang),
            choice_card=x.resolve_card(choice.get("id_card")),
            choice_event_uuid=x.choice_event_uuid,
            choice_event_card=x.choice_event_card,
            progress_recorded=x.progress_recorded,
        )

    def _require_still_available(self, x: "_Exec", choice: Dict[str, Any]) -> None:
        """The option's verdict, re-evaluated now rather than trusted from the open: the
        world may have moved since the options were served — an item spent, a stat drained,
        a key flipped — and an option that has become impossible must not resolve."""
        conditions_by_choice = self.store.find_choice_conditions_by_choice_id(
            x.match["id_story"])
        rows = conditions_by_choice.get(choice.get("id"), [])
        cctx = self._build_choice_context(x, [choice], conditions_by_choice)
        verdict = choice_availability.check(choice, rows, cctx)
        if not verdict.available:
            raise EventError(EventError.CHOICE_NOT_AVAILABLE,
                             f"Choice cannot be selected: {verdict.reason}")

    def _apply_choice_effects(self, x: "_Exec", choice_id: int, event_id: int,
                              event: Dict[str, Any]) -> None:
        """Every list_choices_effects row of the option, in authored (id) order, then the
        events those rows link to.

        The two phases mirror ``_apply_event`` exactly, and for the same reason. All the
        rows land first, then the Step 30 rules get their single pass over whoever they
        touched — so a lethal row does **not** silence its siblings, any more than a lethal
        effect silences the other effects of its event. What a coma does stop is the
        consequences: a character who can no longer act does not act out what follows.

        The links run after every row for the same reason the outcome event does: an event
        authored to read a key the option writes must find it already written.
        """
        linked: List[int] = []
        for effect in self.store.find_choice_effects_by_choice_id(x.match["id_story"], choice_id):
            self._apply_choice_effect(x, effect, event)
            if effect.get("id_event"):
                linked.append(effect["id_event"])
        # No _apply_event ran for these rows, so the edge pass has to be given here — once,
        # over everyone the rows touched, exactly where _apply_event would have run it.
        self._check_edge_states(x, event_id)
        for link in linked:
            if x.coma_triggered or x.status == STATUS_CHOICES_PENDING:
                return  # down, or waiting on the player again: the rest is not ours to run
            self._run_linked_event(x, link)

    def _apply_choice_effect(self, x: "_Exec", effect: Dict[str, Any],
                             event: Dict[str, Any]) -> None:
        """One list_choices_effects row. The vocabulary is the event effects' own — the
        helpers are literally the same methods, the Step 32 model realignment having given
        the two tables the same column names — with two differences that come from the
        table rather than from the engine:

        * who it lands on is ``flag_group``, not ``target``/``target_class``;
        * the registry pair is ``key``/``value_to_add`` plus a ``value_to_remove`` that
          events have no equivalent of.

        ``id_event`` is collected rather than run here — see ``_apply_choice_effects``.
        """
        recipients = self._resolve_choice_recipients(x, effect)

        # Weather belongs to the MATCH: once per row, however many characters it targets.
        id_weather = effect.get("id_weather")
        if id_weather:
            self.store.set_current_weather(x.match["id"], id_weather)
            x.weather_applied = True

        touched: List[str] = []
        for recipient in recipients:
            touched.append(recipient.get("uuid"))
            self._apply_stat(x, recipient, effect)
            self._apply_item(x, recipient, effect)
            self._apply_movement(x, recipient, effect)
        self._apply_choice_registry(x, effect, event)

        # The row's OWN card is the narrative, exactly as for an event effect.
        x.effects.append(AppliedEffect(
            event_uuid=event.get("uuid"),
            effect_uuid=effect.get("uuid"),
            statistic=effect.get("statistics"),
            value=effect.get("value"),
            target="ALL" if (effect.get("flag_group") or 0) == 1 else TARGET_ONLY_ONE,
            target_class=None,
            character_uuids=touched,
            card=x.resolve_card(effect.get("id_card")),
        ))

    def _resolve_choice_recipients(self, x: "_Exec",
                                   effect: Dict[str, Any]) -> List[Dict[str, Any]]:
        """INV-46: flag_group = 1 means every character standing in the ACTOR's location —
        the same set an event effect's target=ALL resolves (INV-27), never every character
        of the match. Anything else is the acting character alone."""
        actor_location = x.location_of(x.actor)
        if (effect.get("flag_group") or 0) != 1 or actor_location is None:
            return [x.actor]
        return [c for c in x.all_characters() if x.location_of(c) == actor_location]

    def _apply_choice_registry(self, x: "_Exec", effect: Dict[str, Any],
                               event: Dict[str, Any]) -> None:
        """The registry pair of a choice effect. ``value_to_add`` sets the key;
        ``value_to_remove`` clears it, but only when the stored value actually matches — an
        option must not be able to wipe a key some other branch of the story has since moved
        on. Written once per row by the actor: the registry is match-scoped."""
        key = effect.get("key")
        if not key:
            return
        old = x.ctx.registry.get(key)
        add = effect.get("value_to_add")
        remove = effect.get("value_to_remove")
        if add:
            value = add
        elif remove and remove == old:
            value = None  # clears both value columns — the key reads as unset afterwards
        else:
            return
        self.store.upsert_registry(x.match["id"], key, value, x.actor["id"],
                                   event.get("id"), x.current_clock)
        x.ctx.registry[key] = value
        x.registry_changes.append(RegistryChange(key, old, value))

    def _run_linked_event(self, x: "_Exec", id_event: Optional[int]) -> None:
        """Run an event a choice points at — ``id_event_torun`` on the option, or
        ``id_event`` on one of its effect rows.

        A linked event is a **consequence**, so it is neither re-checked nor charged (the
        Step 29 chain rule). If it is itself a choice-event the resolution does not apply
        its effects — they are withheld by definition — but presents its options instead,
        so a story that chains a choice onto a choice keeps working; the options are served
        free, the open having already been paid for by the choice that led here.
        """
        if not id_event or id_event <= 0:
            return
        linked = x.events_by_id().get(id_event)
        if not linked or id_event in x.visited:
            return  # dangling id, or already run in this resolution
        if (linked.get("type") or "").strip().upper() == "ONCE" \
                and id_event in x.ctx.consumed_event_ids:
            return  # a spent ONCE stays spent, whoever points at it

        nested = self.store.find_choices_by_event_id(x.match["id_story"], id_event)
        if nested:
            x.visited.add(id_event)
            x.ctx.consumed_event_ids.add(id_event)
            if linked.get("uuid") and linked["uuid"] not in x.executed_event_uuids:
                x.executed_event_uuids.append(linked["uuid"])
            self.store.log_event_executed(x.match["id"], x.actor["id"], id_event,
                                          x.current_clock, f"{MSG_EVENT_EXECUTED} {id_event}")
            x.status = STATUS_CHOICES_PENDING
            x.pending_choices = self._build_pending_choices(x, nested)
            return

        if x.choice_event_uuid is None:
            x.choice_event_uuid = linked.get("uuid")
            x.choice_event_card = x.resolve_card(linked.get("id_card"))
        self._run_chain(x, linked)

    def _write_resolution_markers(self, x: "_Exec", choice: Dict[str, Any],
                                  event_id: int, choice_id: int) -> None:
        """Close the cycle. All three rows describe a resolution that has already happened —
        the effects and the linked events ran first, so a failure midway leaves no marker
        claiming otherwise.

        The CHOICE_SELECTED marker carries the OWNING EVENT's id, never the option's:
        count_log_markers pairs it against EVENT_EXECUTED by event, and a row stamped with
        the choice id would leave the cycle open for ever.
        """
        self.store.log_event_executed(x.match["id"], x.actor["id"], event_id,
                                      x.current_clock, f"{MSG_CHOICE_SELECTED} {event_id}")
        self.store.log_choice_executed(x.match["id"], event_id, choice_id, x.current_clock,
                                       f"{MSG_CHOICE_SELECTED} {choice_id}")
        if (choice.get("is_progress") or 0) == 1:
            self.store.insert_story_progress(x.match["id"], event_id, choice_id, x.current_clock)
            x.progress_recorded = True

    def _build_pending_choices(self, x: "_Exec",
                               choices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Evaluate and shape every option — sorted by priority then id, none dropped."""
        conditions_by_choice = self.store.find_choice_conditions_by_choice_id(
            x.match["id_story"])
        cctx = self._build_choice_context(x, choices, conditions_by_choice)
        ordered = sorted(choices, key=lambda c: (c.get("priority") or 0, c.get("id") or 0))
        out: List[Dict[str, Any]] = []
        for choice in ordered:
            rows = conditions_by_choice.get(choice.get("id"), [])
            availability = choice_availability.check(choice, rows, cctx)
            out.append({
                "uuid": choice.get("uuid"),
                "priority": choice.get("priority"),
                "name": self.store.resolve_short_text(
                    x.match["id_story"], choice.get("id_text_name"), x.lang),
                "description": self.store.resolve_short_text(
                    x.match["id_story"], choice.get("id_text_description"), x.lang),
                "card": x.resolve_card(choice.get("id_card")),
                "available": availability.available,
                "reason": availability.reason,
            })
        return out

    def _build_choice_context(self, x: "_Exec", choices: List[Dict[str, Any]],
                              conditions_by_choice: Dict[int, List[Dict[str, Any]]],
                              ) -> ChoiceCheckContext:
        """One context for N options. The party reads (locations, stat sums) and the trait
        read cost a query each, so they happen only when some condition needs them."""
        needs_party = False
        needs_traits = False
        sum_keys: set = set()
        for choice in choices:
            for row in conditions_by_choice.get(choice.get("id"), []):
                kind = (row.get("type") or "").strip().upper()
                if kind == "ALL_IN_SAME_LOC":
                    needs_party = True
                elif kind == "TRAITS":
                    needs_traits = True
                elif kind == "STATISTICS_SUM":
                    needs_party = True
                    if (row.get("key") or "").strip():
                        sum_keys.add(row["key"].strip().lower())

        actor_stats = self._actor_stats_of(x)
        party_locations: List[Optional[int]] = []
        party_stat_sums: Dict[str, int] = {}
        if needs_party:
            sums_need_backpack = bool(sum_keys & _BACKPACK_STATS)
            for member in x.all_characters():
                party_locations.append(x.location_of(member))
                if member["id"] == x.actor["id"]:
                    member_stats = actor_stats
                else:
                    backpack = None
                    if sums_need_backpack:
                        backpack = self.store.find_backpack(x.match["id"], member["id"]) or {}
                    member_stats = self._view_stats(member, backpack)
                for key in sum_keys:
                    party_stat_sums[key] = party_stat_sums.get(key, 0) \
                        + (member_stats.get(key) or 0)
        return ChoiceCheckContext(
            actor_stats=actor_stats,
            id_class=x.actor.get("id_class"),
            id_location=x.location_of(x.actor),
            owned_item_ids=x.ctx.owned_item_ids,
            trait_ids=self.store.find_trait_ids_by_character(x.match["id"], x.actor["id"])
            if needs_traits else set(),
            registry=x.ctx.registry,
            party_locations=party_locations,
            party_stat_sums=party_stat_sums,
        )

    def _actor_stats_of(self, x: "_Exec") -> Dict[str, int]:
        """The actor as the checker must see them: post-deduction when the open just paid.

        The read-only path must NOT go through ``x.live()`` — that would enrol the actor
        in the flush and write rows nothing has changed.
        """
        enrolled = x.living.get(x.actor["id"])
        if enrolled is None:
            backpack = self.store.find_backpack(x.match["id"], x.actor["id"]) or {}
            return self._view_stats(x.actor, backpack)
        return {
            "life": enrolled.life, "energy": enrolled.energy, "sad": enrolled.sad,
            "exp": enrolled.exp, "dex": enrolled.dexterity, "int": enrolled.intelligence,
            "cos": enrolled.constitution, "food": enrolled.food, "magic": enrolled.magic,
            "coin": enrolled.coin,
        }

    @staticmethod
    def _view_stats(view: Dict[str, Any],
                    backpack: Optional[Dict[str, int]]) -> Dict[str, int]:
        """Backpack None when the caller does not need food/magic/coin for this member."""
        stats = {
            "life": view.get("life") or 0, "energy": view.get("energy") or 0,
            "sad": view.get("sad") or 0, "exp": view.get("exp") or 0,
            "dex": view.get("dexterity") or 0, "int": view.get("intelligence") or 0,
            "cos": view.get("constitution") or 0,
        }
        if backpack is not None:
            stats["food"] = backpack.get("food", 0)
            stats["magic"] = backpack.get("magic", 0)
            stats["coin"] = backpack.get("coin", 0)
        return stats

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
        events_by_id = x.events_by_id()
        effects_by_event = x.effects_by_event()
        end_game_id = x.end_game_id()

        current: Optional[Dict[str, Any]] = first
        while current:
            self._apply_event(x, current, effects_by_event, end_game_id)
            # Coma stops the chain, and flag_end_time with it — but not the
            # all-players-in-coma epilogue, which runs only once everyone is already down.
            if x.coma_triggered and not x.epilogue_phase:
                return

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

        self._check_edge_states(x, event_id)
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
            self._apply_movement(x, recipient, effect)

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
        # Locations come from the tracked map, not the raw views: a forced movement earlier
        # in the chain must be seen by the effects that follow it.
        actor_location = x.location_of(x.actor)
        if target == TARGET_ONLY_ONE or actor_location is None:
            base = [x.actor]
        else:
            base = [c for c in x.all_characters()
                    if x.location_of(c) == actor_location]

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

    def _apply_movement(self, x: "_Exec", recipient: Dict[str, Any],
                        effect: Dict[str, Any]) -> None:
        """v0.29.3 forced movement: the recipient is moved to ``id_location``, skipping the
        whole Step 28 procedure — no neighbor check, no energy cost, no availability
        verdict. An id that matches no location of the story is authored noise and is
        skipped; so is a move to the location the recipient already stands in. The tracked
        position is updated, so a later effect of the same chain resolves ``target=ALL``
        where the recipient now stands."""
        id_location = effect.get("id_location")
        if not id_location or id_location <= 0:
            return
        target_uuid = x.location_uuids().get(id_location)
        if target_uuid is None:
            return  # authored noise, not an error
        origin = x.location_of(recipient)
        if origin == id_location:
            return  # already there: nothing to move, nothing to log
        self.store.update_character_location(x.match["id"], recipient["id"], id_location)
        self.store.insert_movement_log(x.match["id"], recipient["id"], origin, id_location, 0)
        x.set_location(recipient["id"], id_location)
        x.movement_applied = True
        x.location_changes.append(LocationChange(
            character_uuid=recipient.get("uuid"),
            from_location_uuid=x.location_uuids().get(origin) if origin else None,
            to_location_uuid=target_uuid))

    # ── coma & time end ─────────────────────────────────────────────────────

    def _check_edge_states(self, x: "_Exec", id_event: Optional[int]) -> None:
        """Step 30: run the sadness-overflow and coma rules over every character this event
        touched. Only touched characters can have changed, so ``living`` is the right set.

        Resetting ``sad`` and latching ``coma_set`` here is what makes the rules idempotent
        for the rest of the chain: the next event re-runs this and finds nothing to fire.
        """
        for live in x.living.values():
            v = edge_state_evaluator.evaluate(edge_state_evaluator.CharacterState(
                live.id, live.life, live.sad_unclamped, live.sad_max, live.constitution,
                live.coma_set))
            if not v.anything():
                continue
            if v.sadness_overflow:
                x.stat_changes.append(StatChange(
                    character_uuid=live.uuid, statistic="life", before=live.life,
                    after=v.life_after, delta=v.life_after - live.life))
                x.stat_changes.append(StatChange(
                    character_uuid=live.uuid, statistic="sad", before=live.sad,
                    after=0, delta=-live.sad))
                live.life = v.life_after
                live.set_sad(0)
                x.sadness_overflow_uuids.append(live.uuid)
            if v.coma_triggered:
                live.coma_set = True
                x.coma_uuids.append(live.uuid)
                if live.id == x.actor["id"]:
                    x.coma_triggered = True
            if v.forced_sleep and live.id == x.actor["id"]:
                x.forced_sleep = True
            edge_state_evaluator.persist(self.edge_store, x.match["id"], v, x.current_clock,
                                         id_event)

    def _resolve_all_player_coma(self, x: "_Exec") -> None:
        """The all-players-in-coma epilogue: run the story's id_event_all_player_coma so the
        frontend has something to show once nobody can act any more.

        This cannot live inside the chain. _run_chain unwinds as soon as the actor falls into
        a coma, and the actor is necessarily one of the comatose — a comatose character is
        rejected by the availability check before an execution even starts. So by the time
        everyone is down, the chain is already returning.

        Moving the match to GAMEOVER is deliberately NOT done here: that, and the rescue
        endpoints, belong to step 59.
        """
        if x.all_coma_resolved:
            return
        # Latched before any work, so a re-entry from inside the epilogue is a no-op.
        x.all_coma_resolved = True

        flags = []
        for view in x.all_characters():
            touched = x.living.get(view["id"])
            # Deliberately not x.live(view): that would query the backpack of every character
            # in the match and enrol them all in the flush, writing rows nothing changed.
            flags.append(touched.coma_set if touched else bool(view.get("is_coma")))
        if not edge_state_evaluator.all_in_coma(flags):
            return

        x.all_players_in_coma = True
        edge_state_evaluator.log_all_player_coma(
            self.edge_store, x.match["id"], x.actor["id"], x.current_clock)

        coma_event_id = self.store.find_id_event_all_player_coma(x.match["id_story"])
        if coma_event_id is None:
            return  # a story need not author an epilogue
        coma_event = x.events_by_id().get(coma_event_id)
        if not coma_event:
            return  # dangling id_event_all_player_coma
        if (coma_event.get("type") or "").strip().upper() == "ONCE" \
                and coma_event_id in x.ctx.consumed_event_ids:
            return  # a ONCE epilogue fires once per match, not once per collapse

        x.coma_event_uuid = coma_event.get("uuid")
        x.coma_event_card = x.resolve_card(coma_event.get("id_card"))
        x.coma_event_mark = len(x.executed_event_uuids)
        x.coma_effect_mark = len(x.effects)
        x.epilogue_phase = True
        try:
            self._run_chain(x, coma_event)
        finally:
            x.epilogue_phase = False

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
        edge_state = self._build_edge_state(x)
        changed = any([
            x.time_ended, x.item_added, x.item_removed, x.weather_applied,
            x.movement_applied, x.forced_sleep,
            x.coma_triggered, x.game_over, x.stat_changes, x.registry_changes,
            x.trait_changes, x.characteristic_changes, edge_state.anything(),
        ])
        return EventExecutionResult(
            match_uuid=x.match["uuid"],
            event_uuid=x.event.get("uuid"),
            event_type=x.event.get("type"),
            card=x.resolve_card(x.event.get("id_card")),
            executed_event_uuids=self._chain_event_uuids(x),
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
            movement_applied=x.movement_applied,
            forced_sleep=x.forced_sleep,
            coma_triggered=x.coma_triggered,
            game_over=x.game_over,
            refresh_recommended=bool(changed),
            stat_changes=x.stat_changes,
            registry_changes=x.registry_changes,
            trait_changes=x.trait_changes,
            item_changes=x.item_changes,
            characteristic_changes=x.characteristic_changes,
            location_changes=x.location_changes,
            status=x.status,
            effects=self._chain_effects(x),
            pending_choices=x.pending_choices,
            edge_state=edge_state,
        )

    @staticmethod
    def _chain_event_uuids(x: "_Exec") -> List[str]:
        """The events the player's own chain ran — the epilogue's are sliced off the tail."""
        if x.coma_event_uuid is None:
            return list(x.executed_event_uuids)
        return list(x.executed_event_uuids[:x.coma_event_mark])

    @staticmethod
    def _chain_effects(x: "_Exec") -> List[AppliedEffect]:
        if x.coma_event_uuid is None:
            return x.effects
        return x.effects[:x.coma_effect_mark]

    @staticmethod
    def _build_edge_state(x: "_Exec") -> EdgeStateOutcome:
        if not x.sadness_overflow_uuids and not x.coma_uuids and not x.all_players_in_coma:
            return EdgeStateOutcome.none()
        coma_events: List[str] = []
        coma_effects: List[AppliedEffect] = []
        if x.coma_event_uuid is not None:
            coma_events = list(x.executed_event_uuids[x.coma_event_mark:])
            coma_effects = x.effects[x.coma_effect_mark:]
        return EdgeStateOutcome(
            sadness_overflow_uuids=list(x.sadness_overflow_uuids),
            coma_uuids=list(x.coma_uuids),
            all_players_in_coma=x.all_players_in_coma,
            coma_event_uuid=x.coma_event_uuid,
            coma_event_card=x.coma_event_card,
            coma_executed_event_uuids=coma_events,
            coma_effects=coma_effects,
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
        self._location_uuids: Optional[Dict[int, str]] = None
        # Current location per character: seeded from the views, rewritten by forced movement.
        self._location_by_character: Dict[int, Optional[int]] = {}

        self.stat_changes: List[StatChange] = []
        self.registry_changes: List[RegistryChange] = []
        self.trait_changes: List[EntityChange] = []
        self.item_changes: List[EntityChange] = []
        self.characteristic_changes: List[EntityChange] = []
        self.location_changes: List[LocationChange] = []
        self.effects: List[AppliedEffect] = []

        self.current_clock = match.get("current_clock") or 0
        self.energy_spent = 0
        self.coin_spent = 0
        # ── Step 31 choices ──
        self.status = STATUS_APPLIED
        self.pending_choices: List[Dict[str, Any]] = []
        # ── Step 32 resolution ──
        # The event an effect's id_event ran: the card the board narrates with.
        self.choice_event_uuid: Optional[str] = None
        self.choice_event_card: Optional[Dict[str, Any]] = None
        self.progress_recorded = False
        self.end_time = False
        self.time_ended = False
        self.item_added = False
        self.item_removed = False
        self.weather_applied = False
        self.movement_applied = False
        self.forced_sleep = False
        self.coma_triggered = False
        self.game_over = False
        self.flushed = False

        # ── Step 30 edge states ──
        self.sadness_overflow_uuids: List[str] = []
        self.coma_uuids: List[str] = []
        self.all_players_in_coma = False
        # The epilogue has been decided — set before any work, so re-entry is a no-op.
        self.all_coma_resolved = False
        # True while the all-players-in-coma chain runs, relaxing the coma guard in _run_chain.
        self.epilogue_phase = False
        self.coma_event_uuid: Optional[str] = None
        self.coma_event_card: Optional[Dict[str, Any]] = None
        # Where the epilogue's own events and effects start, so _build_result can slice them.
        self.coma_event_mark = 0
        self.coma_effect_mark = 0
        self._events_by_id: Optional[Dict[int, Dict[str, Any]]] = None
        self._effects_by_event: Optional[Dict[int, List[Dict[str, Any]]]] = None
        self._end_game_id: Optional[int] = None
        self._end_game_loaded = False

    def events_by_id(self) -> Dict[int, Dict[str, Any]]:
        """Loaded once and shared by the main chain and the epilogue, so the epilogue
        costs no extra query."""
        if self._events_by_id is None:
            self._events_by_id = self._service.store.find_events_by_id(self.match["id_story"])
        return self._events_by_id

    def seed_events_by_id(self, events_by_id: Dict[int, Dict[str, Any]]) -> None:
        """Hand over a map the caller has already read — select_choice needs it to resolve
        the owning event before the accumulator even exists."""
        self._events_by_id = events_by_id

    def effects_by_event(self) -> Dict[int, List[Dict[str, Any]]]:
        if self._effects_by_event is None:
            self._effects_by_event = self._service.store.find_effects_by_event_id(
                self.match["id_story"])
        return self._effects_by_event

    def end_game_id(self) -> Optional[int]:
        """None is a legal value here, hence the separate loaded flag."""
        if not self._end_game_loaded:
            self._end_game_id = self._service.store.find_id_event_end_game(
                self.match["id_story"])
            self._end_game_loaded = True
        return self._end_game_id

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

    def location_uuids(self) -> Dict[int, str]:
        """Lazily loaded: only a forced-movement effect needs the story's locations."""
        if self._location_uuids is None:
            self._location_uuids = self._service.store.find_location_uuids_by_id(
                self.match["id_story"])
        return self._location_uuids

    def location_of(self, view: Dict[str, Any]) -> Optional[int]:
        """The tracked position wins over the (possibly stale) view."""
        key = view["id"]
        if key not in self._location_by_character:
            self._location_by_character[key] = view.get("id_location")
        return self._location_by_character[key]

    def set_location(self, id_character: int, id_location: int) -> None:
        self._location_by_character[id_character] = id_location

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

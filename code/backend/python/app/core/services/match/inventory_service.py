"""InventoryService - Steps 34 and 35: what a character carries, and what it costs.

Everything item-shaped lives here — the validation order, the row removal, the
log_item_usage write, the listing and the resources. The application of the effects
themselves is delegated to `EventService.apply_standalone_effects`, so that an item moves
a statistic through exactly the code an event uses and trips exactly the same step-30
edge states.
"""
import json
from typing import Any, Dict, List, Optional

from app.core.models.match.match_models import ItemEffectPreview, ItemInstanceInfo
from app.core.ports.match.event_ports import ITEM_ACTION_DROP, ITEM_ACTION_USE
from app.core.ports.match.inventory_ports import InventoryError, InventoryPort, InventoryStorePort

_RUNNING = "RUNNING"
_DEFAULT_LANG = "en"

#: Step 34 — the ONE genuine divergence between the item vocabulary the schema documents
#: (LIFE, ENERGY, EXP, SADNESS, DEX, INT, COS, FOOD, MAGIC, COIN) and the token the engine
#: acts on. Every other code differs only by case, and the engine already lowercases.
#: Applied on the ITEM path only: normalising inside the engine would silently widen the
#: event and choice vocabularies too, and diverge from the Java and AWS twins.
_EFFECT_CODE_ALIASES = {"sadness": "sad", "coins": "coin"}


def normalize_effect_code(effect_code: Optional[str]) -> Optional[str]:
    """Case-insensitive translation. An unknown code is lowercased rather than rejected,
    so the engine keeps treating it as authored noise instead of failing the whole usage."""
    if effect_code is None or not str(effect_code).strip():
        return None
    key = str(effect_code).strip().lower()
    return _EFFECT_CODE_ALIASES.get(key, key)


#: Step 35 — the statistic tokens the engine actually acts on. Anything else is authored
#: noise: apply_stat drops it in silence, so the promise must not show it either.
_KNOWN_EFFECT_CODES = {"life", "energy", "sad", "exp", "dex", "int", "cos",
                       "food", "magic", "coin"}


def shows_effects(item: Optional[Dict[str, Any]]) -> bool:
    """v0.35.0 — flag_show_effects: may the promise be read? Only an explicit 0 hides it.

    None is the reading of every story authored before the column existed, and those
    already shipped the promise: treating an absence as a refusal would take the feature
    away from all of them at once. It gates what is REPORTED, never what is applied — a
    secret item still does exactly what its rows say.
    """
    return (item or {}).get("flag_show_effects") != 0


def preview_effects(rows: Optional[List[Dict[str, Any]]]) -> List[ItemEffectPreview]:
    """Step 35 — the list_items_effects rows of ONE item, as the board may read them
    before the item is used. Shared by the inventory listing and the match /info players[]
    projection, so the two can never promise different effects.

    Rows whose code lands outside the engine vocabulary are dropped rather than shown:
    promising an effect apply_stat would discard is a promise nothing keeps.
    """
    out: List[ItemEffectPreview] = []
    for row in rows or []:
        statistic = normalize_effect_code(row.get("effect_code"))
        if statistic not in _KNOWN_EFFECT_CODES:
            continue
        value = row.get("effect_value")
        out.append(ItemEffectPreview(statistic=statistic,
                                     value=value if isinstance(value, int) else 0))
    return out


def action_amount(authored) -> int:
    """v0.35.1 — amount_use / amount_drop: null, zero or a negative all read as one unit.

    An action that moved nothing would be an action the player can trigger for free, over
    and over: the schema allows the value, the engine refuses to honour it as written.
    """
    return authored if isinstance(authored, int) and authored >= 1 else 1


def _unit_weight(weight) -> int:
    return weight if isinstance(weight, int) else 0


def _unit_amount(amount) -> int:
    """A null amount counts as one — the movement gate must agree with this."""
    return amount if isinstance(amount, int) else 1


def total_weight(items: List[ItemInstanceInfo]) -> int:
    """Sigma (item.weight x amount)."""
    return sum(_unit_weight(i.weight) * _unit_amount(i.amount) for i in (items or []))


class InventoryService(InventoryPort):

    def __init__(self, store: InventoryStorePort, user_access_port,
                 story_read_port, effect_engine) -> None:
        self.store = store
        self.user_access_port = user_access_port
        # StoryMatchReadPort: resolves the item name and the item card.
        self.story_read_port = story_read_port
        # EventService: the one engine, reused rather than duplicated.
        self.effect_engine = effect_engine

    # ── read ────────────────────────────────────────────────────────────────

    def list_inventory(self, match_uuid: str, user_uuid: str, lang: str) -> Dict[str, Any]:
        ctx = self._load(match_uuid, user_uuid, require_action=False)
        items = self._map_items(ctx, lang)
        return {
            "match_uuid": ctx["match"]["uuid"],
            "character_uuid": ctx["actor"]["uuid"],
            "items": items,
            "weight": total_weight(items),
            "weight_max": ctx["actor"]["weight_max"],
        }

    def get_resources(self, match_uuid: str, user_uuid: str) -> Dict[str, Any]:
        ctx = self._load(match_uuid, user_uuid, require_action=False)
        backpack = self.store.find_backpack(ctx["match"]["id"], ctx["actor"]["id"]) or {}
        return {
            "match_uuid": ctx["match"]["uuid"],
            "character_uuid": ctx["actor"]["uuid"],
            "food": backpack.get("food", 0),
            "magic": backpack.get("magic", 0),
            "coin": backpack.get("coin", 0),
            "weight": total_weight(self._map_items(ctx, None)),
            "weight_max": ctx["actor"]["weight_max"],
        }

    # ── write ───────────────────────────────────────────────────────────────

    def use_item(self, match_uuid: str, user_uuid: str, item_instance_uuid: str, lang: str):
        ctx = self._load(match_uuid, user_uuid, require_action=True)
        row = self._find_own_row(ctx, item_instance_uuid)
        item = self._resolve_item(ctx, row)

        if item.get("is_consumabile") != 1:
            raise InventoryError(InventoryError.ITEM_NOT_CONSUMABLE,
                                 "This item cannot be used, only carried")
        self._check_class_gate(item, ctx["actor"].get("id_class"))

        # v0.35.1 — how many units one usage spends. A null amount_use reads as 1, and
        # holding fewer is a refusal rather than a smaller sip: an effect that fired on half
        # the recipe would be a lie about what the player did.
        spend = action_amount(item.get("amount_use"))
        held = _unit_amount(row.get("amount"))
        if held < spend:
            raise InventoryError(
                InventoryError.ITEM_NOT_ENOUGH,
                f"The character carries {held} of this item and using it takes {spend}")

        effects = self._standalone_effects(ctx, item)
        card = self._resolve_card(ctx, item.get("id_card"))

        # The units go first: an item whose effects grant the same item back must not pay
        # for itself, and what was spent stays spent even if the effect chain ends in a
        # coma. Before v0.35.1 that meant deleting the row; now it means charging the units
        # and deleting the row only when nothing survives them.
        left = held - spend
        if left > 0:
            self.store.update_inventory_amount(ctx["match"]["id"], row["id"], left)
        else:
            self.store.delete_inventory_row(ctx["match"]["id"], row["id"])

        result = self.effect_engine.apply_standalone_effects(
            ctx["match"]["id"], ctx["actor"]["id"], effects, card, lang, source_consumed=True)
        self.store.log_item_action(ctx["match"]["id"], ctx["actor"]["id"], item["id"],
                                   ITEM_ACTION_USE, spend, to_effects_json(result),
                                   resource_delta(result, ctx["actor"]["uuid"]))
        return result

    def drop_item(self, match_uuid: str, user_uuid: str,
                  item_instance_uuid: str) -> Dict[str, Any]:
        ctx = self._load(match_uuid, user_uuid, require_action=True)
        row = self._find_own_row(ctx, item_instance_uuid)
        # No consumable gate and no class gate here: a non-consumable item must be
        # droppable, that is the whole point of carrying one.
        item = self._items_by_id(ctx).get(row.get("id_item"))
        held = _unit_amount(row.get("amount"))
        # v0.35.1 — a null amount_drop reads as 1. Holding fewer is NOT a refusal, unlike a
        # usage: a player putting something down can always put down everything they hold.
        # A row whose story item is gone goes in ONE gesture: there is no author left to say
        # how many units a drop takes, and step 34 keeps such a row droppable precisely so
        # it cannot weigh the character down forever.
        dropped = held if item is None else min(held, action_amount(item.get("amount_drop")))

        left = held - dropped
        if left > 0:
            self.store.update_inventory_amount(ctx["match"]["id"], row["id"], left)
        else:
            self.store.delete_inventory_row(ctx["match"]["id"], row["id"])
        ctx["inventory"] = None  # force a re-read for the remaining weight
        # v0.35.4 — a drop moves no resource, but it IS an item event: without this row the
        # timeline would show the item arriving and being used and never leaving.
        if item is not None:
            self.store.log_item_action(ctx["match"]["id"], ctx["actor"]["id"], item["id"],
                                       ITEM_ACTION_DROP, dropped, None, None)

        return {
            "match_uuid": ctx["match"]["uuid"],
            "character_uuid": ctx["actor"]["uuid"],
            "item_instance_uuid": row.get("uuid"),
            "item_uuid": item.get("uuid") if item else None,
            "amount_dropped": dropped,
            "weight": total_weight(self._map_items(ctx, None)),
            "weight_max": ctx["actor"]["weight_max"],
        }

    # ── validation ──────────────────────────────────────────────────────────

    def _load(self, match_uuid: str, user_uuid: str, require_action: bool) -> Dict[str, Any]:
        """Resolves user, match and character, in the order the other gameplay services use.

        `require_action` adds the gates an action needs and a read does not: the match must
        be running and the character must be awake and out of coma.
        """
        user = self.user_access_port.find_by_uuid(user_uuid) if user_uuid else None
        if not user:
            raise self._not_found()
        match = self.store.find_match_by_uuid(match_uuid)
        if not match:
            raise self._not_found()
        actor = self.store.find_character_by_match_and_user(match["id"], user["id"])
        if not actor:
            raise self._not_found()
        if require_action:
            if match.get("status") != _RUNNING:
                raise InventoryError(InventoryError.MATCH_NOT_RUNNING, "The match is not running")
            if actor.get("is_coma"):
                raise InventoryError(InventoryError.COMA, "The character is in a coma")
            if actor.get("is_sleeping"):
                raise InventoryError(InventoryError.SLEEPING, "The character is sleeping")
        return {"match": match, "actor": actor, "inventory": None, "items_by_id": None}

    def _inventory(self, ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
        if ctx.get("inventory") is None:
            ctx["inventory"] = self.store.find_inventory(ctx["match"]["id"], ctx["actor"]["id"])
        return ctx["inventory"]

    def _items_by_id(self, ctx: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
        """A match with no story resolves an empty map, so nothing can be used on it."""
        if ctx.get("items_by_id") is None:
            story_id = ctx["match"].get("id_story")
            ctx["items_by_id"] = {} if story_id is None else self.store.find_items_by_id(story_id)
        return ctx["items_by_id"]

    def _find_own_row(self, ctx: Dict[str, Any], item_instance_uuid: str) -> Dict[str, Any]:
        """Only ever searches the caller's own rows, so another player's item is
        indistinguishable from one that does not exist. That masking IS the
        "the row belongs to the caller" rule — there is no comparison to forget."""
        if not item_instance_uuid or not str(item_instance_uuid).strip():
            raise InventoryError(InventoryError.ITEM_NOT_FOUND, "Item not found in the inventory")
        for row in self._inventory(ctx):
            if row.get("uuid") == item_instance_uuid:
                return row
        raise InventoryError(InventoryError.ITEM_NOT_FOUND, "Item not found in the inventory")

    def _resolve_item(self, ctx: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
        """A row whose story item is gone — or is authored without an id — is reported as a
        missing item: everything downstream is keyed by that id. A match with no story
        resolves an empty item map, so passing this check also guarantees id_story."""
        item = self._items_by_id(ctx).get(row.get("id_item")) if row.get("id_item") else None
        if not item or item.get("id") is None:
            raise InventoryError(InventoryError.ITEM_NOT_FOUND, "Item not found in the story")
        return item

    @staticmethod
    def _check_class_gate(item: Dict[str, Any], id_class) -> None:
        """0 or None means "no restriction": the CRUD writes a raw 0 where the importer
        writes None, and both have to read as unset."""
        permitted = item.get("id_class_permitted")
        prohibited = item.get("id_class_prohibited")
        if isinstance(permitted, int) and permitted > 0 and permitted != id_class:
            raise InventoryError(InventoryError.ITEM_CLASS_NOT_PERMITTED,
                                 "The character's class cannot use this item")
        if isinstance(prohibited, int) and prohibited > 0 and id_class is not None \
                and prohibited == id_class:
            raise InventoryError(InventoryError.ITEM_CLASS_PROHIBITED,
                                 "The character's class is forbidden from using this item")

    # ── mapping ─────────────────────────────────────────────────────────────

    def _map_items(self, ctx: Dict[str, Any], lang: Optional[str]) -> List[ItemInstanceInfo]:
        story_id = ctx["match"].get("id_story")
        card_cache: Dict[int, Any] = {}
        # Step 35 — one query for the whole story, cached on the ctx: drop-item maps the
        # remaining items after removing the row, and use-item reads the same rows again.
        effects_by_item = self._effects_by_item(ctx)
        out: List[ItemInstanceInfo] = []
        for row in self._inventory(ctx):
            item = self._items_by_id(ctx).get(row.get("id_item")) if row.get("id_item") else None
            info = ItemInstanceInfo(
                uuid=row.get("uuid"),
                item_uuid=item.get("uuid") if item else None,
                name=None,
                weight=item.get("weight") if item else 0,
                amount=row.get("amount"),
                state=row.get("state"),
            )
            if item:
                info.id_card = item.get("id_card")
                info.is_consumabile = item.get("is_consumabile") == 1
                info.card = self._resolve_card(ctx, item.get("id_card"), card_cache)
                info.name = self._resolve_name(story_id, item.get("id_text_name"), lang)
                info.max_per_character = item.get("max_per_character")
                info.amount_drop = item.get("amount_drop")
                info.amount_use = item.get("amount_use")
                if shows_effects(item):
                    info.effects = preview_effects(effects_by_item.get(item.get("id")))
            out.append(info)
        return out

    def _effects_by_item(self, ctx: Dict[str, Any]) -> Dict[int, List[Dict[str, Any]]]:
        if ctx.get("effects_by_item") is None:
            story_id = ctx["match"].get("id_story")
            ctx["effects_by_item"] = ({} if story_id is None
                                      else self.store.find_item_effects_by_item_id(story_id))
        return ctx["effects_by_item"]

    def _resolve_name(self, story_id, id_text_name, lang) -> Optional[str]:
        if story_id is None or id_text_name is None or self.story_read_port is None:
            return None
        text = self.story_read_port.find_text_by_story_id_text_and_lang(
            story_id, id_text_name, lang or _DEFAULT_LANG)
        return text.get("short_text") if text else None

    def _resolve_card(self, ctx: Dict[str, Any], id_card,
                      cache: Optional[Dict[int, Any]] = None):
        story_id = ctx["match"].get("id_story")
        if id_card is None or story_id is None or self.story_read_port is None:
            return None
        if cache is not None and id_card in cache:
            return cache[id_card]
        card = self.story_read_port.find_card_by_story_id_and_card_id(story_id, id_card)
        if cache is not None:
            cache[id_card] = card
        return card

    def _standalone_effects(self, ctx: Dict[str, Any],
                            item: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Maps list_items_effects rows onto what the engine consumes."""
        rows = self._effects_by_item(ctx).get(item["id"], [])
        return [
            {
                "effect_uuid": e.get("uuid"),
                "statistics": normalize_effect_code(e.get("effect_code")),
                "value": e.get("effect_value"),
                "traits_to_add": e.get("traits_to_add"),
                "traits_to_remove": e.get("traits_to_remove"),
                "id_card": e.get("id_card"),
            }
            for e in rows
        ]

    @staticmethod
    def _not_found() -> InventoryError:
        return InventoryError(InventoryError.MATCH_NOT_FOUND, "Match not found")


def resource_delta(result, actor_uuid: str) -> Dict[str, int]:
    """v0.35.4 — what the usage did to the ACTOR's four resources, summed over its effects.

    An item that heals the whole party still writes one row, and that row belongs to
    whoever used it — so a stat change on anybody else is left out of it.
    """
    delta = {"energy": 0, "food": 0, "magic": 0, "coin": 0}
    for change in result.stat_changes:
        if actor_uuid is not None and change.character_uuid != actor_uuid:
            continue
        if change.statistic in delta:
            delta[change.statistic] += change.delta
    return delta


def to_effects_json(result) -> str:
    """Serialises what the usage changed, for log_item_usage.effects_json.

    Key order is fixed so the column stays diffable, and matches the Java twin.
    """
    return json.dumps({
        "statChanges": [
            {"characterUuid": s.character_uuid, "statistic": s.statistic,
             "before": s.before, "after": s.after, "delta": s.delta}
            for s in result.stat_changes
        ],
        "traitChanges": [
            {"characterUuid": t.character_uuid, "traitUuid": t.value, "action": t.action}
            for t in result.trait_changes
        ],
        "sadnessOverflow": bool(result.edge_state.sadness_overflow_uuids),
        "comaTriggered": bool(result.coma_triggered),
    }, separators=(",", ":"))

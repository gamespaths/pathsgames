"""Step 23 — trait selection validation shared by match create and join.

Rules:
* every trait uuid must exist in the story (``TRAIT_NOT_FOUND``);
* no duplicate selections (``TRAIT_DUPLICATED``);
* ``id_class_permitted``/``id_class_prohibited`` must match the selected
  class (``TRAIT_NOT_COMPATIBLE``); a permitted-restricted trait is rejected
  when no class is selected;
* the sum of ``cost_positive`` and the sum of ``cost_negative`` must each
  stay within the difficulty budgets (``TRAIT_COST_EXCEEDED``); a ``None``
  budget means "no limit".
"""
from typing import Any, Dict, List, Optional

TRAIT_NOT_FOUND = "TRAIT_NOT_FOUND"
TRAIT_DUPLICATED = "TRAIT_DUPLICATED"
TRAIT_NOT_COMPATIBLE = "TRAIT_NOT_COMPATIBLE"
TRAIT_COST_EXCEEDED = "TRAIT_COST_EXCEEDED"


class TraitSelectionError(Exception):
    """Raised on the first violated rule; callers translate :attr:`code`."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def resolve_and_validate(
    story_read_port,
    story_id: int,
    clazz: Optional[Dict[str, Any]],
    difficulty: Optional[Dict[str, Any]],
    trait_uuids: Optional[List[str]],
) -> List[Dict[str, Any]]:
    """Resolves and validates the selected traits. Blank uuids are ignored."""
    resolved: List[Dict[str, Any]] = []
    if not trait_uuids:
        return resolved
    seen = set()
    for uuid in trait_uuids:
        if not uuid or not uuid.strip():
            continue
        key = uuid.strip()
        if key in seen:
            raise TraitSelectionError(TRAIT_DUPLICATED,
                                      f"Trait selected more than once: {key}")
        seen.add(key)
        trait = story_read_port.find_trait_by_uuid(story_id, key)
        if trait is None:
            raise TraitSelectionError(TRAIT_NOT_FOUND, f"Trait not found: {key}")
        _validate_class_compatibility(trait, clazz, key)
        resolved.append(trait)
    _validate_cost_budget(resolved, difficulty)
    return resolved


def _validate_class_compatibility(trait: Dict[str, Any],
                                  clazz: Optional[Dict[str, Any]],
                                  uuid: str) -> None:
    class_id = clazz.get("id") if clazz else None
    permitted = trait.get("id_class_permitted")
    prohibited = trait.get("id_class_prohibited")
    if permitted is not None and (class_id is None or permitted != class_id):
        raise TraitSelectionError(TRAIT_NOT_COMPATIBLE,
                                  f"Trait {uuid} is permitted only for another class")
    if prohibited is not None and class_id is not None and prohibited == class_id:
        raise TraitSelectionError(TRAIT_NOT_COMPATIBLE,
                                  f"Trait {uuid} is prohibited for the selected class")


def _validate_cost_budget(traits: List[Dict[str, Any]],
                          difficulty: Optional[Dict[str, Any]]) -> None:
    if not difficulty or not traits:
        return
    total_positive = sum(int(t.get("cost_positive") or 0) for t in traits)
    total_negative = sum(int(t.get("cost_negative") or 0) for t in traits)
    positive_budget = difficulty.get("trait_cost_positive_budget")
    negative_budget = difficulty.get("trait_cost_negative_budget")
    if positive_budget is not None and total_positive > int(positive_budget):
        raise TraitSelectionError(
            TRAIT_COST_EXCEEDED,
            f"Total positive trait cost {total_positive} exceeds the difficulty budget {positive_budget}")
    if negative_budget is not None and total_negative > int(negative_budget):
        raise TraitSelectionError(
            TRAIT_COST_EXCEEDED,
            f"Total negative trait cost {total_negative} exceeds the difficulty budget {negative_budget}")

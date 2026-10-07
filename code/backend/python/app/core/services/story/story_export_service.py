"""v0.41.4 Step 41 H — the internal story exporter: header plus the 22 admin CRUD lists, tsInsert/tsUpdate/
idStory removed, text ids fixed, nulls stripped (react-admin StoriesPage export). Admin only (decision 62)."""
from typing import Any, Dict, Optional

from app.core.services.match.canonical_json import drop_nulls

# Admin CRUD entity type and JSON key, in the react-admin export order.
ENTITY_TYPES = (
    ("texts", "texts"), ("difficulties", "difficulties"), ("classes", "classes"), ("locations", "locations"),
    ("events", "events"), ("items", "items"), ("choices", "choices"), ("creators", "creators"),
    ("cards", "cards"), ("keys", "keys"), ("traits", "traits"), ("character-templates", "characterTemplates"),
    ("weather-rules", "weatherRules"), ("global-random-events", "globalRandomEvents"), ("missions", "missions"),
    ("location-neighbors", "locationNeighbors"), ("event-effects", "eventEffects"),
    ("choice-conditions", "choiceConditions"), ("choice-effects", "choiceEffects"),
    ("item-effects", "itemEffects"), ("class-bonuses", "classBonuses"), ("mission-steps", "missionSteps"),
)
_DROPPED = ("tsInsert", "tsUpdate", "idStory")


def _as_int(value):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _entity(json_key: str, row: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: v for k, v in dict(row).items() if k not in _DROPPED}
    if json_key == "texts" and row.get("idText") is not None:
        out["id"] = out["idText"] = _as_int(row.get("idText"))
    elif out.get("id") is None and out.get("idTipo") is not None:
        # The character templates' story-local id (id_tipo), so the export keeps it.
        out["id"] = out["idTipo"]
    return out


class StoryExportService:

    def __init__(self, crud_service) -> None:
        self.crud = crud_service

    def export_story(self, story_uuid: str) -> Optional[Dict[str, Any]]:
        """The story import JSON (StoryFormat.md §1), nulls stripped; None when the story is unknown."""
        header = self.crud.get_story(story_uuid)
        if header is None:
            return None
        data = {k: v for k, v in header.items() if k not in ("tsInsert", "tsUpdate")}
        for entity_type, json_key in ENTITY_TYPES:
            rows = self.crud.list_entities(story_uuid, entity_type) or []
            data[json_key] = [_entity(json_key, r) for r in rows]
        return drop_nulls(data)

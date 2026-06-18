"""StoryValidatorPort - inbound port for story integrity validation (Step 22).

Mirrors the Java reference: three entry points share one rule engine.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class StoryValidationError:
    """A single referential-integrity or domain-rule violation."""
    rule: str
    entity_type: str
    entity_id: Optional[str]
    field_name: Optional[str]
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule": self.rule,
            "entityType": self.entity_type,
            "entityId": self.entity_id,
            "field": self.field_name,
            "message": self.message,
        }


@dataclass
class StoryValidationReport:
    """Accumulates validation errors. Valid when empty."""
    errors: List[StoryValidationError] = field(default_factory=list)

    def add(self, rule: str, entity_type: str, entity_id: Optional[str],
            field_name: Optional[str], message: str) -> None:
        self.errors.append(StoryValidationError(rule, entity_type, entity_id, field_name, message))

    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def summary(self) -> str:
        if not self.errors:
            return "story is valid"
        head = "; ".join(e.message for e in self.errors[:5])
        return head if len(self.errors) <= 5 else f"{head}; (+{len(self.errors) - 5} more)"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.is_valid(),
            "count": len(self.errors),
            "errors": [e.to_dict() for e in self.errors],
        }


class StoryValidationException(Exception):
    """Raised by import / CRUD save paths when validation fails -> HTTP 400."""

    def __init__(self, report: StoryValidationReport):
        super().__init__(f"Story validation failed: {report.summary()}")
        self.report = report


class StoryValidatorPort(ABC):
    @abstractmethod
    def validate_import_data(self, story_data: Dict[str, Any]) -> StoryValidationReport:
        ...

    @abstractmethod
    def validate_story(self, story_id: int) -> StoryValidationReport:
        ...

    @abstractmethod
    def validate_entity(self, entity_type: str, data: Dict[str, Any]) -> StoryValidationReport:
        ...

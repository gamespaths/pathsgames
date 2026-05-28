from dataclasses import dataclass

@dataclass
class StoryImportResult:
    storyUuid: str
    status: str
    textsImported: int = 0
    locationsImported: int = 0
    eventsImported: int = 0
    itemsImported: int = 0
    difficultiesImported: int = 0
    classesImported: int = 0
    choicesImported: int = 0

from dataclasses import dataclass

@dataclass
class ClassInfo:
    uuid: str
    name: str | None = None
    description: str | None = None
    weightMax: int = 0
    dexterityBase: int = 0
    intelligenceBase: int = 0
    constitutionBase: int = 0

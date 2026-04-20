from dataclasses import dataclass

@dataclass
class CreatorInfo:
    uuid: str
    name: str | None = None
    link: str | None = None
    url: str | None = None
    urlImage: str | None = None
    urlEmote: str | None = None
    urlInstagram: str | None = None

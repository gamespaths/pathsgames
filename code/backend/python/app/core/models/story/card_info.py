from dataclasses import dataclass

@dataclass
class CardInfo:
    uuid: str
    imageUrl: str | None = None
    alternativeImage: str | None = None
    awesomeIcon: str | None = None
    styleMain: str | None = None
    styleDetail: str | None = None
    title: str | None = None

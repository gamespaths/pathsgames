from pydantic import BaseModel, ConfigDict

class GuestStats(BaseModel):
    total_guests: int = 0
    active_guests: int = 0
    expired_guests: int = 0

    model_config = ConfigDict(populate_by_name=True)

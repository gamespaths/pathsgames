from pydantic import BaseModel, ConfigDict, Field

class GuestStats(BaseModel):
    total_guests: int = Field(0, alias="totalGuests")
    active_guests: int = Field(0, alias="activeGuests")
    expired_guests: int = Field(0, alias="expiredGuests")

    model_config = ConfigDict(populate_by_name=True)

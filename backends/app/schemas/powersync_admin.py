from pydantic import BaseModel


class PowerSyncActionResponse(BaseModel):
    status: str
    output: str

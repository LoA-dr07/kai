from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.household import Household
from app.schemas.household import HouseholdOut

router = APIRouter(prefix="/household", tags=["household"])


@router.get("", response_model=HouseholdOut)
def get_household(db: Session = Depends(get_db)):
    household = db.query(Household).first()
    if not household:
        raise HTTPException(status_code=404, detail="No household found")
    return household

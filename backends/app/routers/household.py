from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.household import Household, HouseholdMember
from app.schemas.household import HouseholdOut

router = APIRouter(prefix="/household", tags=["household"])


@router.get("", response_model=HouseholdOut)
def get_household(db: Session = Depends(get_db)):
    household = (
        db.query(Household)
        .options(joinedload(Household.members).joinedload(HouseholdMember.user))
        .first()
    )
    if not household:
        raise HTTPException(status_code=404, detail="No household found")
    # Flatten HouseholdMember -> User for response
    return HouseholdOut(
        id=household.id,
        name=household.name,
        members=[m.user for m in household.members],
    )

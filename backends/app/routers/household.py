from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.household import Household, HouseholdMember
from app.schemas.household import HouseholdOut, HouseholdSettings, HouseholdSettingsUpdate
from app.schemas.user import UserOut

router = APIRouter(prefix="/household", tags=["household"])


def _get_household_or_404(db: Session) -> Household:
    """Local variant of app.utils.household.get_household_or_404() that eager-loads
    members, needed for _household_to_out() below. Other routers that only need the
    household row itself use the shared helper instead."""
    household = (
        db.query(Household)
        .options(joinedload(Household.members).joinedload(HouseholdMember.user))
        .first()
    )
    if not household:
        raise HTTPException(status_code=404, detail="No household found")
    return household


def _household_to_out(household: Household) -> HouseholdOut:
    raw_settings = household.settings or {}
    return HouseholdOut(
        id=household.id,
        name=household.name,
        members=[UserOut.model_validate(m.user) for m in household.members],
        settings=HouseholdSettings(**raw_settings),
    )


@router.get("", response_model=HouseholdOut)
def get_household(db: Session = Depends(get_db)):
    household = _get_household_or_404(db)
    return _household_to_out(household)


@router.put("/settings", response_model=HouseholdOut)
def update_household_settings(
    payload: HouseholdSettingsUpdate,
    db: Session = Depends(get_db),
):
    household = _get_household_or_404(db)
    household.settings = payload.settings.model_dump()
    db.commit()
    db.refresh(household)
    return _household_to_out(household)

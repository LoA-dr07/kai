"""Shared household lookup helpers (single-household app, no multi-tenancy)."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.household import Household


def get_household(db: Session) -> Household | None:
    """Return the single household, or None if not seeded yet."""
    return db.query(Household).first()


def get_household_or_404(db: Session) -> Household:
    household = get_household(db)
    if not household:
        raise HTTPException(status_code=404, detail="No household found")
    return household
